$(document).ready(function () {
    $("#loadingScreen").show();

    var map = L.map('map').setView([39.5501, -105.7821], 4);
    var drawnItems = new L.FeatureGroup();
    var drawnGeometry = null;
    var drawControlActive = false;
    var highlightedPolygon = null;
    var zIndexCounter = 500;
    var isEditMode = false;
    let geoJSONLayer = null;
    let allFeatures = [];


    $('#add-custom-polygon').hide();
    $('#community').hide();
    $('#community-label').hide();

    function getNextZIndex() {
        return zIndexCounter++;
    }

    function setZIndexWithImportant(element) {
        var zIndexValue = getNextZIndex();
        element.attr('style', function (i, style) {
            return style + 'z-index: ' + zIndexValue + ' !important;';
        });
    }

    var drawControl = new L.Control.Draw({
        position: 'bottomleft',
        draw: {
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false,
            rectangle: false,
            polygon: {
                shapeOptions: {
                    fillColor: '#f00',
                    fillOpacity: .2,
                    opacity: 1,
                    color: '#000',
                    weight: 2
                }
            },
        },
        edit: {
            featureGroup: drawnItems
        }
    });

    $('#add-geometry').on('click', function (e) {
        e.preventDefault();

        if (!drawControlActive) {
            map.addControl(drawControl);
            drawControlActive = true;
        } else {
            map.removeControl(drawControl);
            drawControlActive = false;
        }
    });

    map.on(L.Draw.Event.CREATED, function (event) {
        var layer = event.layer;
        drawnGeometry = layer.toGeoJSON().geometry;
        drawnItems.addLayer(layer);
        map.addLayer(drawnItems);
    });

    function isValidName(name) {
        return typeof name === 'string' && name.trim().length > 0;
    }

    function isValidCounty(county) {
        return typeof county === 'string' && county.trim().length > 0;
    }

    function isValidYear(year) {
        return year.length === 4 && !isNaN(year);
    }

    function isValidEmail(email) {
        // A simple email regex for validation
        var regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return regex.test(email);
    }

    function isValidReport(fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) {
            return false;
        }

        var fileName = fileInput.files[0].name;
        var extension = fileName.split('.').pop().toLowerCase();

        // Ensure it's either a PDF or Word doc
        return ['pdf', 'doc', 'docx'].includes(extension);
    }

    function populateDropdown(endpoint, dropdownElement, type) {
        var stateValue = document.getElementById("state").value;

        // Clear the dropdown of any previous values
        while (dropdownElement.firstChild) {
            dropdownElement.removeChild(dropdownElement.firstChild);
        }

        let whereClause, outField;
        if (type === "counties") {
            whereClause = `STATE_ABBR='${stateValue}'`;
            outField = 'NAME';
        } else if (type === "communities") {
            whereClause = `ST='${stateValue}'`;
            outField = 'NAME';
        } else {
            console.error("Invalid type provided");
            return;
        }

        axios.get(endpoint, {
            params: {
                f: 'json',
                where: whereClause,
                outFields: outField,
                returnGeometry: true,
                outSR: '4326'
            }
        })
            .then(function (response) {

                var features = response.data.features;

                features.sort(function (a, b) {
                    return a.attributes.NAME.localeCompare(b.attributes.NAME);
                });

                features.forEach(function (feature) {
                    var optionValue = feature.attributes[outField];

                    // Remove "County" from the end if it exists
                    if (optionValue.endsWith(" County")) {
                        optionValue = optionValue.substring(0, optionValue.length - " County".length);
                    }

                    var optionText = optionValue;
                    var option = new Option(optionText, optionValue);
                    // Store geometry data as a JSON string in a data attribute
                    option.setAttribute('data-geometry', JSON.stringify(feature.geometry));
                    dropdownElement.append(option);
                });
            })
            .catch(function (error) {
                console.error("Error fetching data: ", error);
            });
    }

    // Dropdown initialization logic
    var countiesDropdown = document.getElementById("county");
    var countiesEndpoint = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Counties/FeatureServer/0/query';

    document.getElementById("state").addEventListener("change", function () {
        populateDropdown(countiesEndpoint, countiesDropdown, "counties");
    });

    populateDropdown(countiesEndpoint, countiesDropdown, "counties");

    var communitiesDropdown = document.getElementById("community");
    var communitiesEndpoint = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Populated_Places/FeatureServer/0/query';

    document.getElementById("state").addEventListener("change", function () {
        populateDropdown(communitiesEndpoint, communitiesDropdown, "communities");
    });

    populateDropdown(communitiesEndpoint, communitiesDropdown, "communities");

    function toGeoJSON(geometryData) {
        if (!geometryData.rings || !geometryData.rings.length) {
            return null;  // Return null if the structure isn't as expected
        }

        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: geometryData.rings
            },
            properties: {}
        };
    }

    function renderGeometryOnMap(geometryData) {
        // Remove previously rendered geometry if any
        if (highlightedPolygon) {
            map.removeLayer(highlightedPolygon);
        }

        // Convert the geometry data to GeoJSON format
        var geoJSONData = toGeoJSON(geometryData);
        console.log(geoJSONData);
        if (!geoJSONData) {
            console.error("Failed to convert geometry data to GeoJSON format.");
            return;
        }

        // Convert the GeoJSON data to a Leaflet layer
        highlightedPolygon = L.geoJSON(geoJSONData, {
            style: {
                fillColor: '#1a1aff',
                fillOpacity: 0.6,
                color: '#000',
                weight: 2
            }
        }).addTo(map);

        // Fit the map view to the new geometry bounds
        map.fitBounds(highlightedPolygon.getBounds());
    }

    // Event listener for the counties dropdown
    countiesDropdown.addEventListener('change', function () {

        // Check if the jurisdiction level is set to 'county'
        var jurisdictionLevel = document.getElementById("jurisdiction").value;
        if (jurisdictionLevel === 'County') {

            let selectedOption = countiesDropdown.options[countiesDropdown.selectedIndex];
            let geometryData = JSON.parse(selectedOption.getAttribute('data-geometry'));

            renderGeometryOnMap(geometryData);

            // Convert the geometry data to GeoJSON format
            var geoJSONData = toGeoJSON(geometryData);
            if (geoJSONData) {
                drawnGeometry = geoJSONData.geometry;
            }

            $('#add-geometry').hide(); // Hide the "Add Geometry" button
            $('#add-custom-polygon').show(); // Show the "Add Custom Polygon" button
        } else {
            $('#add-geometry').show(); // Otherwise, show it
            $('#add-custom-polygon').hide();
        }
    });

    // Event listener for the communities dropdown
    communitiesDropdown.addEventListener('change', function () {

        // Check if the jurisdiction level is set to 'county'
        var jurisdictionLevel = document.getElementById("jurisdiction").value;
        if (jurisdictionLevel === 'Community') {

            let selectedOption = communitiesDropdown.options[communitiesDropdown.selectedIndex];
            let geometryData = JSON.parse(selectedOption.getAttribute('data-geometry'));

            renderGeometryOnMap(geometryData);

            // Convert the geometry data to GeoJSON format
            var geoJSONData = toGeoJSON(geometryData);
            if (geoJSONData) {
                drawnGeometry = geoJSONData.geometry;
            }

            $('#add-geometry').hide(); // Hide the "Add Geometry" button
            $('#add-custom-polygon').show(); // Show the "Add Custom Polygon" button
        } else {
            $('#add-geometry').show(); // Otherwise, show it
            $('#add-custom-polygon').hide();
        }
    });

    document.getElementById("jurisdiction").addEventListener("change", function () {
        var jurisdictionValue = this.value;
        $('#add-custom-polygon').hide();
        $('#add-geometry').show();
        if (jurisdictionValue === "Community") {
            $('#community-label').show();
            $('#community').show();
        } else {
            $('#community-label').hide();
            $('#community').hide();
        }
    });

    document.getElementById('add-feature-form').addEventListener('submit', function (e) {
        e.preventDefault();

        var name = document.getElementById('name').value;
        var county = document.getElementById('county').value;
        var year_published = document.getElementById('year_published').value;
        var contact_email = document.getElementById('contact_email').value;
        var reportFileInput = document.getElementById('documentUpload');

        var errorMessage = "";

        if (!isValidName(name)) {
            errorMessage += "CWPP Name should be a valid string.\n";
        }

        if (!isValidCounty(county)) {
            errorMessage += "County should be a valid string.\n";
        }

        if (!isValidYear(year_published)) {
            errorMessage += "Year Published should be a 4 character integer.\n";
        }

        if (!isValidEmail(contact_email)) {
            errorMessage += "Contact Email should be a valid email address.\n";
        }

        if (!isValidReport(reportFileInput)) {
            errorMessage += "A valid report (PDF or Word document) must be attached.\n";
        }

        if (errorMessage !== "") {
            alert(errorMessage);
            return;
        }

        var newFeature = {
            "type": "Feature",
            "properties": {
                "name": document.getElementById('name').value,
                "jurisdiction": document.getElementById('jurisdiction').value,
                "county": document.getElementById('county').value,
                "state": document.getElementById('state').value,
                "year_published": document.getElementById('year_published').value,
                "contact_email": document.getElementById('contact_email').value,
            },
            "geometry": drawnGeometry || { "type": "Polygon", "coordinates": [[[-107.578125, 57.987308], [-98.964838, 55.780551], [-95.537104, 52.220838], [-102.919922, 48.175622], [-106.259766, 45.162946], [-106.523437, 27.638225], [-102.744141, 27.326426], [-103.359375, 44.861906], [-100.546875, 46.940484], [-92.373042, 52.123268], [-95.712891, 56.476372], [-106.699219, 59.188044], [-107.578125, 57.987308]]] }
        };

        console.log('Drawn Geometry:', drawnGeometry);

        console.log(JSON.stringify(newFeature));

        const formData = new FormData();
        formData.append('file', document.getElementById('documentUpload').files[0]);
        formData.append('feature', JSON.stringify(newFeature));

        axios.post('/api/data', formData)
            .then(function (response) {
                $("#add-feature-dialog").dialog("close");

                // Clear edited geometries and reset map zoom/position
                console.log('Post Submission Drawn Geometry:', drawnGeometry);
                //map.removeLayer(drawnGeometry);
                map.removeLayer(drawnItems);
                map.removeLayer(highlightedPolygon);
                map.removeLayer(editableLayers);
                //map.removeControl(layer);
                applyFilters(null);
                console.log(response.data);
            })
            .catch(function (error) {
                console.log(error);
            });
    });

    function resetDropdown(dropdownElement) {
        // Clear the dropdown
        while (dropdownElement.firstChild) {
            dropdownElement.removeChild(dropdownElement.firstChild);
        }
        // Add a placeholder option
        var option = new Option("", "", true, true);
        option.setAttribute("disabled", "disabled");
        option.setAttribute("hidden", "hidden");
        dropdownElement.append(option);
    }


    $(document).on('click', 'button[title="Close"]', function () {

        // Clear the map layers
        map.removeLayer(drawnItems);
        map.removeLayer(highlightedPolygon);
        map.removeLayer(editableLayers);
        applyFilters(null);

        // Clear the form fields
        $('#add-feature-form')[0].reset();
        $('#jurisdiction').val('');
        $('#state').val('');
        $('#county').val('');
        $('#community').val('');
        // Reset dropdowns
        resetDropdown(document.getElementById("county"));
        resetDropdown(document.getElementById("community"));
        $('#community').hide();
        $('#community-label').hide();

        // If you have a draw control and an edit control instance available, 
        // disable any active draw/edit actions and remove them from the map.
        if (drawControl) {
            map.removeControl(drawControl);
        }
        if (editControl) {
            map.removeControl(editControl);
        }
        if (drawControlActive) {
            drawControlActive = false;
        }
        if (editableLayers) {
            editableLayers.clearLayers();
        }
        if (editHandler && editHandler.enabled()) {
            editHandler.disable();
        }
    });

    var AddFeatureControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Add Feature';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'create-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';

            link.onclick = function (e) {
                console.log("Add Feature button clicked!");
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                $("#add-feature-dialog").dialog("open");
            }

            setZIndexWithImportant($(container));

            return container;
        },
    });

    map.addControl(new AddFeatureControl());

    $("#add-feature-dialog").dialog({
        autoOpen: false,
        height: 400,
        width: 350,
        modal: false,
        close: function () {
            if (drawControlActive) {
                map.removeControl(drawControl);
                drawControlActive = false;
            }
        }
    });

    // Array to store the original polygons
    var originalMultipolygon = [];

    // Array to store all edited polygons
    var editedPolygons = [];

    var originalPolygonIdMap = {};
    var editablePolygonIdMap = {};


    // Generate a unique ID for polygons
    function generateUniqueId() {
        return Math.random().toString(36).substr(2, 9);
    }

    function captureOriginalState() {
        originalMultipolygon = [];
        let counter = 0;  // Add a counter to differentiate the layers.
        highlightedPolygon.eachLayer(function (layer) {
            layer._latlngs.forEach(function (latlngArray) {
                let coords = latlngArray.map(latLng => [latLng.lng, latLng.lat]);
                let geoJson = {
                    type: 'Polygon',
                    coordinates: [coords]
                };
                let customId = generateUniqueId() + '-' + counter; // Append the counter to the generated ID.
                geoJson._customId = customId;
                originalPolygonIdMap[counter] = customId;  // Use the counter as the key instead of layer._leaflet_id.
                originalMultipolygon.push(geoJson);
                counter++;  // Increment the counter.
            });
        });
    }

    map.on(L.Draw.Event.EDITED, function (event) {
        var layers = event.layers;

        editedPolygons = [];
        layers.eachLayer(function (layer) {
            let geoJson = layer.toGeoJSON().geometry;
            geoJson._customId = editablePolygonIdMap[layer._leaflet_id];
            editedPolygons.push(geoJson);
        });

        editedPolygons.forEach(editedPolygon => {
            const matchedIndex = originalMultipolygon.findIndex(op => op._customId === editedPolygon._customId);
            if (matchedIndex !== -1) {
                originalMultipolygon[matchedIndex] = editedPolygon;
            } else {
            }
        });

        // Now, construct the final MultiPolygon using the originalMultipolygon
        drawnGeometry = {
            type: "MultiPolygon",
            coordinates: originalMultipolygon.map(p => p.coordinates)
        };
    });

    var editableLayers = L.featureGroup().addTo(map);

    var editControl = new L.Control.Draw({
        draw: false,
        edit: {
            featureGroup: editableLayers,
            edit: true,
            remove: false
        }
    });

    // Close button logic for boundary-action-pane
    $('#boundary-action-pane .close-button').click(function () {
        $('#boundary-action-pane').hide();
    });

    $('#add-custom-polygon').on('click', function (e) {
        e.preventDefault();
        $('#boundary-action-pane').css('display', 'block');
    });

    function editPolygon() {
        captureOriginalState();
        if (!drawControlActive) {
            map.addControl(editControl);
            drawControlActive = true;

            let counter = 0;  // Start a counter for each layer.
            Object.keys(highlightedPolygon._layers).forEach(function (layerKey) {
                var layer = highlightedPolygon._layers[layerKey];

                layer._latlngs.forEach(function (latlngArray) {
                    var polygon = L.polygon(latlngArray, {
                        fillColor: '#f00',
                        fillOpacity: .2,
                        opacity: 1,
                        color: '#000',
                        weight: 2
                    }).addTo(map);

                    polygon._customId = originalPolygonIdMap[counter];  // Retrieve the ID using the counter.
                    editablePolygonIdMap[polygon._leaflet_id] = originalPolygonIdMap[counter];
                    editableLayers.addLayer(polygon);

                    // Remove the existing highlightedPolygon from the map
                    map.removeLayer(highlightedPolygon);
                    if (polygon.editing) {
                        polygon.editing.enable();
                    } else {
                        console.warn("Unable to enable editing for polygon:", polygon);
                    }
                });
                counter++;
            });


            setTimeout(function () {
                if (editControl._toolbars.edit) {
                    editControl._toolbars.edit._modes.edit.handler.enable();
                }
                drawControlActive = true;
            }, 200);
        } else {
            editableLayers.eachLayer(function (layer) {
                if (layer && layer.editing) {
                    layer.editing.disable();
                }
            });
            map.removeControl(editControl);
            drawControlActive = false;
        }
    }


    $('#btn-edit-boundary').on('click', function () {
        editPolygon();
        $('#boundary-action-pane').css('display', 'none');
    });

    function addPolygon() {
        if (!drawControlActive) {
            map.addControl(drawControl);
            drawControlActive = true;

            currentZoomLevel = map.getZoom();
            var adjustedZoomLevel = currentZoomLevel - 1;
            map.setZoom(adjustedZoomLevel);

            // Directly start the polygon drawing mode
            if (drawControl._toolbars.draw) {
                drawControl._toolbars.draw._modes.polygon.handler.enable();
            }

            if (highlightedPolygon) {
                // Convert the highlightedPolygon to GeoJSON format
                var geometryData = highlightedPolygon.toGeoJSON();

                // Simplify the GeoJSON data using Turf.js
                var simplifiedGeoJSON = turf.simplify(geometryData, { tolerance: 0.005, highQuality: false });

                // Remove the existing highlightedPolygon from the map
                map.removeLayer(highlightedPolygon);

                // Create a new Leaflet layer from the simplified GeoJSON data
                highlightedPolygon = L.geoJSON(simplifiedGeoJSON, {
                    style: {
                        fillOpacity: .2,
                        opacity: .2
                    }
                }).addTo(map);
            }
        } else {
            map.removeControl(drawControl);
            drawControlActive = false;
        }
    }

    $('#btn-add-boundary').on('click', function () {
        addPolygon();
        $('#boundary-action-pane').css('display', 'none');
    });


    $("#open-add-feature-dialog").on("click", function () {
        $("#add-feature-dialog").dialog("open");
    });

    var overlappingFeatures = [];
    var currentFeatureIndex = 0;

    function navigateFeature(step) {
        currentFeatureIndex += step;
        if (currentFeatureIndex >= 0 && currentFeatureIndex < overlappingFeatures.length) {
            // Close the currently opened popup.
            map.closePopup();
            // Show the popup for the new current feature.
            showPopup(currentFeatureIndex);
        }
    }

    function showPopup(index) {
        let feature = overlappingFeatures[index];
        let existingPopupContent = feature.getPopup().getContent();

        // Create next/previous buttons
        let previousButtonHTML = (index > 0) ? '<button id="previous-button" class="navigate-feature-button" data-direction="-1">Previous</button>' : '';
        let nextButtonHTML = (index < overlappingFeatures.length - 1) ? '<button id="next-button" class="navigate-feature-button" data-direction="1">Next</button>' : '';

        let popupContentHTML = existingPopupContent + previousButtonHTML + nextButtonHTML;

        // Unbind the old popup and bind the new one
        feature.unbindPopup();
        feature.bindPopup(popupContentHTML);

        if (highlightedPolygon !== null) {
            highlightedPolygon.setStyle({
                fillColor: getColor(highlightedPolygon.feature.properties.jurisdiction),
                fillOpacity: 1
            });
        }

        feature.setStyle({
            fillColor: '#f00',  // highlight color
            fillOpacity: 1
        });
        highlightedPolygon = feature;

        feature.openPopup();

        // Clear existing click events and listen to new ones on the 'previous' and 'next' buttons
        $("#previous-button").off("click").on("click", function () {
            navigateFeature(-1);
        });

        $("#next-button").off("click").on("click", function () {
            navigateFeature(1);
        });
    }

    map.on('popupclose', function (e) {
        currentFeatureIndex = 0;
        if (highlightedPolygon !== null) {
            highlightedPolygon.setStyle({
                fillColor: getColor(highlightedPolygon.feature.properties.jurisdiction),
                fillOpacity: 1
            });
            highlightedPolygon = null;
        }
    });

    function onEachFeature(feature, layer) {
        layer.id = L.Util.stamp(layer);
        if (feature.properties) {
            let popupContent = "";
            for (let key in feature.properties) {
                if (feature.properties[key] && feature.properties[key].toString().trim() !== "") {
                    popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                }
            }
            if (popupContent !== "") {
                layer.bindPopup(popupContent);
                layer.on('click', function (e) {
                    if (isEditMode) {
                        layer.setStyle({
                            fillColor: '#0000ff', // Blue color to indicate a feature selected for editing
                            fillOpacity: 0.6
                        });
                        return; // Exit early to avoid executing the popup logic
                    }

                    overlappingFeatures = [];
                    currentFeatureIndex = 0;
                    var clickedPoint = map.mouseEventToLatLng(e.originalEvent);
                    map.eachLayer(function (otherLayer) {
                        if (otherLayer instanceof L.Polygon) {
                            if (otherLayer.getBounds().contains(clickedPoint)) {
                                overlappingFeatures.push(otherLayer);
                            }
                        }
                    });
                    showPopup(currentFeatureIndex);
                });
            }
        }
    }

    var token;

    axios.get('/api/token')
        .then(function (response) {
            token = response.data.token;
            var streets = L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${token}`, {
                maxZoom: 18,
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1,
            })

            var satellite = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${token}`, {
                maxZoom: 19,
                attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
            });

            var lightGray = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/{z}/{x}/{y}?access_token=${token}`, {
                maxZoom: 19,
                tileSize: 512,
                zoomOffset: -1,
                attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
            });


            lightGray.addTo(map); // default layer

            var LayerSwitcherControl = L.Control.extend({
                options: {
                    position: 'topright'
                },

                onAdd: function (map) {
                    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    var link = L.DomUtil.create('a', '', container);
                    link.href = '#';
                    link.title = 'Switch Layer';

                    var icon = L.DomUtil.create('ion-icon', '', link);
                    icon.setAttribute('name', 'grid-outline');
                    icon.style.fontSize = '26px';
                    icon.style.padding = '6px';

                    var layersDiv = L.DomUtil.create('div', 'layers-content', container);
                    layersDiv.style.display = 'none';

                    var createLayerButton = function (name, layer, imageUrl) {
                        var button = L.DomUtil.create('button', '', layersDiv);
                        button.innerHTML = name;

                        var img = L.DomUtil.create('img', '', button);
                        img.src = imageUrl; // Set the image source

                        button.onclick = function () {
                            map.removeLayer(streets);
                            map.removeLayer(satellite);
                            map.removeLayer(lightGray);
                            map.addLayer(layer);
                        };
                    };


                    createLayerButton('Streets', streets, 'https://miro.medium.com/v2/resize:fit:1400/0*yPSQlTHRvLaIVBcG.jpg');
                    createLayerButton('Satellite', satellite, 'https://miro.medium.com/v2/resize:fit:900/0*si0GnRAqoAwGL5GD.jpg');
                    createLayerButton('Light Gray', lightGray, 'https://miro.medium.com/v2/resize:fit:1024/0*QqAUvTurSNIloa1a.jpg');


                    link.onclick = function () {
                        layersDiv.style.display = (layersDiv.style.display === 'none' ? 'block' : 'none');
                    }

                    return container;
                }
            });

            map.addControl(new LayerSwitcherControl());

            map.addControl(new HelpControl());

        })
        .catch(function (error) {
            console.log(error);
        });

    axios.get('/api/data').then(response => {
        geoJSONLayer = L.geoJSON(response.data, {
            onEachFeature: onEachFeature,
            style: function (feature) {
                return {
                    color: getColor(feature.properties.jurisdiction),
                    fillOpacity: 1
                };
            }
        }).addTo(map);
        allFeatures = response.data;
        $("#loadingScreen").hide();
    });


    function getColor(d) {
        return d === 'County' ? 'rgba(243,222,44, 0.25)' :
            d === 'Fire Protection District' ? 'rgba(189, 117, 122, 0.25)' :
                d === 'Community' ? 'rgba(55, 173, 184, 0.25)' :
                    'rgba(255, 237, 160, 0.4)';
    }

    // UPDATE UPDATE

    /* // Add a hosted feature layer to the map
    var currentIncidents = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/0'
    })

    // Add a hosted feature layer to the map
    var currentBoundaries = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1'
    })

    // Add a hosted feature layer to the map
    var wildHaz0 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/0'
    })

    // Add a hosted feature layer to the map
    var wildHaz1 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/1'
    })

    // Add a hosted feature layer to the map
    var wildHaz2 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/2'
    })

    // Add a hosted feature layer to the map
    var wildHaz3 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/3'
    })

    // Add a hosted feature layer to the map
    var wildHaz4 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/4'
    })

    // Add a hosted feature layer to the map
    var wildHaz5 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/5'
    })

    // Add a hosted feature layer to the map
    var wildHaz6 = L.esri.featureLayer({
        url: 'https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/USA_Wildfire_Hazard_Potential/FeatureServer/6'
    })

    // Add a hosted feature layer to the map
    var wind0 = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/NOAA_METAR_current_wind_speed_direction_v1/FeatureServer/0'
    })

    // Add a hosted feature layer to the map
    var wind1 = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/NOAA_METAR_current_wind_speed_direction_v1/FeatureServer/1'
    })

    var LayerControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Layers';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'layers-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';

            // The actual layer list, initially hidden
            var layerList = L.DomUtil.create('div', 'layer-list', container);
            layerList.style.display = 'none';

            // Add layers here. This is just an example.
            var layers = [
                { name: 'Current Incidents', layer: currentIncidents },
                { name: 'Current Incident Boundaries', layer: currentBoundaries },
                { name: 'Wildfire Hazard Potential1', layer: wildHaz0 },
                { name: 'Wildfire Hazard Potential2', layer: wildHaz1 },
                { name: 'Wildfire Hazard Potential3', layer: wildHaz2 },
                { name: 'Wildfire Hazard Potential4', layer: wildHaz3 },
                { name: 'Wildfire Hazard Potential5', layer: wildHaz4 },
                { name: 'Wildfire Hazard Potential6', layer: wildHaz5 },
                { name: 'Wildfire Hazard Potential7', layer: wildHaz6 },
                { name: 'Wind Speed and Direction1', layer: wind0 },
                { name: 'Wind Speed and Direction', layer: wind1 }
            ];

            layers.forEach(function (item) {
                var layerDiv = L.DomUtil.create('div', '', layerList);
                var checkbox = L.DomUtil.create('input', '', layerDiv);
                checkbox.type = 'checkbox';
                checkbox.checked = false;
                checkbox.onchange = function () {
                    if (this.checked) {
                        map.addLayer(item.layer);
                    } else {
                        map.removeLayer(item.layer);
                    }
                };
                var label = L.DomUtil.create('label', '', layerDiv);
                label.innerHTML = item.name;
                label.insertBefore(checkbox, label.firstChild);
            });

            link.onclick = function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                layerList.style.display = (layerList.style.display === 'none' ? 'block' : 'none');
            }

            setZIndexWithImportant($(container));

            return container;
        }
    });

    map.addControl(new LayerControl()); */

    var CollapsibleLegendControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Legend';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'book-outline');  // Change the icon to something that signifies a legend. For this example, I used 'book-outline'
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';

            var legendDiv = L.DomUtil.create('div', 'legend-content', container);
            legendDiv.style.display = 'none';

            // Legend content
            var grades = ['Community', 'County', 'Fire Protection District'];
            for (var i = 0; i < grades.length; i++) {
                legendDiv.innerHTML +=
                    '<i style="background:' + getColor(grades[i]) + '"></i> ' +
                    grades[i] + '<br>';
            }

            link.onclick = function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                legendDiv.style.display = (legendDiv.style.display === 'none' ? 'block' : 'none');
            }

            setZIndexWithImportant($(container));

            return container;
        }
    });

    map.addControl(new CollapsibleLegendControl());

    function applyFilters(selectedState) {
        if (!allFeatures || allFeatures.length === 0) {
            console.warn("Data not yet loaded or is empty.");
            return;
        }
        if (geoJSONLayer) {
            map.removeLayer(geoJSONLayer);
        }

        if (selectedState === null) { // If Clear Filter is clicked, show all features
            allFeatures.forEach(feature => {
                feature.properties.show_on_map = true;
            });
        } else { // Otherwise, filter based on the selected state
            allFeatures.forEach(feature => {
                feature.properties.show_on_map = feature.properties.state === selectedState;
            });
        }

        geoJSONLayer = L.geoJSON(allFeatures, {
            filter: function (feature) {
                return feature.properties.show_on_map;
            },
            style: function (feature) {
                return {
                    color: getColor(feature.properties.jurisdiction),
                    fillOpacity: 1
                };
            },
            onEachFeature: onEachFeature // This ensures that for each feature, the popup and events are correctly set.
        }).addTo(map);

        if (geoJSONLayer.getBounds().isValid()) { // Ensure that bounds exist
            map.fitBounds(geoJSONLayer.getBounds());
        }
    }

    var CollapsibleFilterControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Filter';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'filter-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';

            var filterDiv = L.DomUtil.create('div', 'filter-content', container);
            filterDiv.style.display = 'none';

            // Clear filter button
            var clearButton = L.DomUtil.create('button', '', filterDiv);
            clearButton.innerHTML = "Clear Filter";
            clearButton.onclick = function () {
                const buttons = filterDiv.getElementsByTagName('button');
                for (let button of buttons) {
                    button.classList.remove('selected');
                }
                applyFilters(null);
            }

            filterDiv.appendChild(document.createElement('br'));

            fetch('/api/states')
                .then(response => response.json())
                .then(states => {

                    states.sort((a, b) => a.localeCompare(b));
                    states.forEach(state => {
                        var button = L.DomUtil.create('button', '', filterDiv);
                        button.innerHTML = state;
                        button.id = state;
                        button.value = state;

                        L.DomEvent.on(button, 'click', function (e) {
                            L.DomEvent.stopPropagation(e);

                            const buttons = filterDiv.getElementsByTagName('button');
                            for (let button of buttons) {
                                button.classList.remove('selected');
                            }

                            e.target.classList.add('selected');
                            applyFilters(state);
                        });

                        filterDiv.appendChild(document.createElement('br'));
                    });
                })
                .catch(error => {
                    console.error("Failed to fetch states:", error);
                });

            link.onclick = function () {
                filterDiv.style.display = (filterDiv.style.display === 'none' ? 'block' : 'none');
            }

            setZIndexWithImportant($(container));

            return container;
        }
    });

    map.addControl(new CollapsibleFilterControl());

    // UPDATE UPDATE

    /* // Global variable declarations for the buttons
    var tutorialButton;
    var contactButton;

    // HelpControl Creation
    var HelpControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Help & Tutorial';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'help-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';

            var helpDiv = L.DomUtil.create('div', 'help-content', container);
            helpDiv.style.display = 'none';

            // Tutorial Button
            tutorialButton = L.DomUtil.create('button', '', helpDiv);
            tutorialButton.innerHTML = 'Adding a CWPP Tutorial';

            // Assign onclick event to tutorialButton here
            tutorialButton.onclick = function () {
                currentPage = 1;
                updateTutorialPane();
                tutorialPane.style.display = 'block';
                contactForm.style.display = 'none'; // close the contact form
                tutorialPane.style.zIndex = getNextZIndex(); // bring the tutorial pane to the front
            };

            // Contact Us Button
            contactButton = L.DomUtil.create('button', '', helpDiv);
            contactButton.innerHTML = 'Contact Us';

            // Assign onclick event to contactButton here
            contactButton.onclick = function () {
                contactForm.style.display = 'block';
                tutorialPane.style.display = 'none'; // close the tutorial pane
                contactForm.style.zIndex = getNextZIndex(); // bring the contact form to the front
            };

            link.onclick = function () {
                helpDiv.style.display = (helpDiv.style.display === 'none' ? 'block' : 'none');
            }

            return container;
        }
    });

    // Tutorial Pane Creation and Logic
    var tutorialPane = L.DomUtil.create('div', 'tutorial-pane', document.body);
    var currentPage = 1;

    var pages = [
        "Page 1 content here...",
        "Page 2 content here...",
        "Page 3 content here...",
        "Page 4 content here..."
    ];

    function updateTutorialPane() {
        tutorialPane.innerHTML = `
            <div class="page-number">${currentPage}</div>
            <div class="page-content">${pages[currentPage - 1]}</div>`;
        const prevButton = document.createElement('button');
        prevButton.innerText = 'Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => changePage(-1));

        const nextButton = document.createElement('button');
        nextButton.innerText = 'Next';
        nextButton.disabled = currentPage === 4;
        nextButton.addEventListener('click', () => changePage(1));

        const navigationButtons = document.createElement('div');
        navigationButtons.className = 'navigation-buttons';
        navigationButtons.appendChild(prevButton);
        navigationButtons.appendChild(nextButton);

        tutorialPane.appendChild(navigationButtons);
        tutorialPane.appendChild(tutorialCloseButton);
    }

    function changePage(step) {
        currentPage += step;
        currentPage = Math.max(1, Math.min(currentPage, 4)); // Ensure the page is between 1 and 4
        updateTutorialPane();
    }

    // Add close button to Tutorial Pane:
    var tutorialCloseButton = document.createElement("span");
    tutorialCloseButton.innerHTML = "x";
    tutorialCloseButton.classList.add("close-button");
    tutorialCloseButton.onclick = function () {
        tutorialPane.style.display = 'none';
    };

    document.body.appendChild(tutorialPane);

    // Contact Form Creation and Logic
    var contactForm = L.DomUtil.create('div', 'contact-form', document.body);

    contactForm.innerHTML = `<div class="form-field">
                            <label>Email Address:</label>
                            <input type="email">
                         </div>
                         <div class="form-field">
                            <label>Subject:</label>
                            <input type="text">
                         </div>
                         <div class="form-field">
                            <label>Message:</label>
                            <textarea></textarea>
                         </div>
                         <button>Submit</button>`;

    async function submitContactForm() {
        console.log("Submitting contact form...");
        // Gather form data...
        const email = contactForm.querySelector('input[type="email"]').value;
        const subject = contactForm.querySelector('input[type="text"]').value;
        const message = contactForm.querySelector('textarea').value;

        try {
            // Sending the email using a POST request to your server:
            const response = await fetch('/contact-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, subject, message })
            });

            const responseData = await response.json();

            if (response.ok) {
                console.log(responseData.message);
            } else {
                console.error(responseData.error);
            }
        } catch (error) {
            console.error("Error sending email:", error);
        }

        // Close the form
        contactForm.style.display = 'none';
    }

    var submitButton = contactForm.querySelector('button');
    submitButton.addEventListener('click', submitContactForm);


    // Add close button to Contact Form:
    var contactCloseButton = document.createElement("span");
    contactCloseButton.innerHTML = "x";
    contactCloseButton.classList.add("close-button");
    contactCloseButton.onclick = function () {
        contactForm.style.display = 'none';
    };
    contactForm.appendChild(contactCloseButton);

    document.body.appendChild(contactForm); */

    L.control.scale().addTo(map);

});

