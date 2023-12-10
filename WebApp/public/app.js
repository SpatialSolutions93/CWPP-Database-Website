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
                $(".leaflet-draw-edit-edit").hide();

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
            link.title = 'Add CWPP';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'create-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';
            icon.removeAttribute('title');  // Remove any default title
            icon.title = 'Add CWPP';

            // Function to modify the shadow DOM
            var modifyShadowDOM = function () {
                var shadowRoot = icon.shadowRoot;
                if (shadowRoot) {
                    var svgTitle = shadowRoot.querySelector('title');
                    if (svgTitle) {
                        svgTitle.textContent = 'Add CWPP';

                    } else {
                        setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                    }
                } else {
                    setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                }
            };

            // Start polling
            modifyShadowDOM();

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

    // Global scope
    var overlappingFeatures = [];
    var currentFeatureIndex = 0;

    // Update the navigateFeature function
    function navigateFeature(step) {
        let newIndex = currentFeatureIndex + step;
        if (newIndex >= 0 && newIndex < overlappingFeatures.length) {
            currentFeatureIndex = newIndex; // Update the index
            showPopup(newIndex); // Show the popup for the new index
        }
    }

    // When a popup opens, attach event listeners to its buttons
    map.on('popupopen', function (e) {
        var popupElement = e.popup._contentNode;
        $(popupElement).find("#previous-button").off("click").on("click", function () {
            navigateFeature(-1);
        });
        $(popupElement).find("#next-button").off("click").on("click", function () {
            navigateFeature(1);
        });
    });

    map.on('popupclose', function (e) {
        if (highlightedPolygon) {
            resetHighlight(highlightedPolygon); // Reset the style of the highlighted polygon
            highlightedPolygon = null; // Clear the reference to the highlighted polygon
        }
    });


    // Function to display popup
    function showPopup(index) {
        if (index < 0 || index >= overlappingFeatures.length) {
            console.error("Invalid feature index:", index);
            return;
        }

        let feature = overlappingFeatures[index];
        let popupContentHTML = createPopupContent(feature);

        // Add navigation buttons if necessary
        popupContentHTML += getNavigationButtonsHTML(index);

        // Bind and open the new popup
        feature.unbindPopup().bindPopup(popupContentHTML, { closeButton: true }).openPopup();

        highlightFeature(feature);

        // Attach event listeners to the buttons in the popup
        setTimeout(function () {
            attachButtonListeners();
        }, 10); // Delay to ensure the popup is fully rendered
    }

    function attachButtonListeners() {
        // Detach any existing listeners to avoid duplicates
        $("#previous-button").off("click");
        $("#next-button").off("click");

        // Attach new listeners
        $("#previous-button").on("click", function () {
            navigateFeature(-1);
        });
        $("#next-button").on("click", function () {
            navigateFeature(1);
        });
    }

    // Create popup content
    function createPopupContent(feature) {
        let properties = feature.feature ? feature.feature.properties : feature.properties;
        let popupContent = '';

        // Define a mapping for the field names
        const fieldNamesMapping = {
            'name': 'Name',
            'pdf': 'PDF',
            'jurisdiction': 'Jurisdiction',
            'county': 'County',
            'state': 'State',
            'year_published': 'Year Published',
            'boundary_area_sqkm': 'Boundary Area (sq km)'
            // 'uid' is not included as we want to exclude it
        };

        for (let key in properties) {
            if (properties.hasOwnProperty(key) && properties[key] && key in fieldNamesMapping) {
                popupContent += `<b>${fieldNamesMapping[key]}:</b> ${properties[key]}<br>`;
            }
        }
        return popupContent;
    }

    // Function to get navigation buttons HTML
    function getNavigationButtonsHTML(index) {
        let buttonsHTML = '';
        if (index > 0) {
            buttonsHTML += `<button id="previous-button" class="navigate-feature-button">Previous</button>`;
        }
        if (index < overlappingFeatures.length - 1) {
            buttonsHTML += `<button id="next-button" class="navigate-feature-button">Next</button>`;
        }
        return buttonsHTML;
    }

    function highlightFeature(feature) {
        if (highlightedPolygon) {
            resetHighlight(highlightedPolygon);
        }
        feature.setStyle({
            fillColor: '#f00', // highlight color
            fillOpacity: 1
        });
        highlightedPolygon = feature;
    }

    function resetHighlight(feature) {
        feature.setStyle({
            fillColor: getColor(feature.feature.properties.jurisdiction),
            fillOpacity: 1
        });
    }

    function onEachFeature(feature, layer) {
        layer.on('click', function (e) {
            if (isEditMode) {
                // Edit mode logic
                return;
            }

            overlappingFeatures = getOverlappingFeaturesAtPoint(e.latlng);
            // Always start with the first feature in the overlapping features array
            currentFeatureIndex = 0; // Set to 0 instead of indexOf

            if (overlappingFeatures.length > 1) {
                // More than one feature overlapping, show navigation
                showPopup(currentFeatureIndex);
            } else {
                // Only one feature, open popup without navigation
                layer.openPopup();
            }
        });
    }

    function getOverlappingFeaturesAtPoint(latlng) {
        let features = [];
        map.eachLayer(function (layer) {
            if (layer instanceof L.Polygon && layer.getBounds().contains(latlng)) {
                features.push(layer);
            }
        });
        return features;
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
                    link.title = 'Basemaps';

                    var icon = L.DomUtil.create('ion-icon', '', link);
                    icon.setAttribute('name', 'grid-outline');
                    icon.style.fontSize = '26px';
                    icon.style.padding = '6px';
                    icon.removeAttribute('title');  // Remove any default title
                    icon.title = 'Basemaps';

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

                    // Function to modify the shadow DOM
                    var modifyShadowDOM = function () {
                        var shadowRoot = icon.shadowRoot;
                        if (shadowRoot) {
                            var svgTitle = shadowRoot.querySelector('title');
                            if (svgTitle) {
                                svgTitle.textContent = 'Basemaps';

                            } else {
                                setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                            }
                        } else {
                            setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                        }
                    };

                    // Start polling
                    modifyShadowDOM();

                    link.onclick = function () {
                        layersDiv.style.display = (layersDiv.style.display === 'none' ? 'block' : 'none');
                    }

                    return container;
                }
            });

            map.addControl(new LayerSwitcherControl());

            // Using jQuery to attach the event listener
            $('.layers-content').on('mousewheel', function (event) {
                event.stopPropagation(); // Stop event from propagating to the map
            });

            var ResourcesControl = L.Control.extend({
                options: {
                    position: 'topright'
                },

                onAdd: function (map) {
                    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    var link = L.DomUtil.create('a', '', container);
                    link.href = '#';
                    link.title = 'Resources for CWPP Creation';

                    var icon = L.DomUtil.create('ion-icon', '', link);
                    icon.setAttribute('name', 'documents-outline');
                    icon.style.fontSize = '26px';
                    icon.style.padding = '6px';
                    icon.removeAttribute('title'); // Remove any default title
                    icon.title = 'Resources for CWPP Creation';

                    var resourcesDiv = L.DomUtil.create('div', 'resources-content', container);
                    resourcesDiv.style.display = 'none';

                    var resourcesList = [
                        '<a href="http://www.communitiescommittee.org/pdfs/cwpphandbook.pdf" target="_blank">Preparing a Community Wildfire Protection Plan (Communities Committee)</a>',
                        '<a href="https://www.usfa.fema.gov/downloads/pdf/publications/creating_a_cwpp.pdf" target="_blank">Creating a Community Wildfire Protection Plan (Federal Emergency Management Agency)</a>',
                        '<a href="https://www.oregon.gov/ODF/Documents/Fire/CWPPEvalGuide.pdf" target="_blank">Community Wildfire Protection Plan Evaluation Guide (University of Oregon)</a>',
                        '<a href="https://srcity.org/DocumentCenter/View/24615/COMMUNITY-GUIDE-to-Preparing-and-Implementing-a-Community-Wildfire-Protection-Plan?bidId=" target="_blank">Community Guide to Preparing and Implementing a Community Wildfire Protection Plan (International Fire Chiefs Association)</a>'
                    ];

                    var ul = L.DomUtil.create('ul', '', resourcesDiv);
                    // Loop through the resourcesList and create list items with links
                    resourcesList.forEach(function (resourceHtmlString) {
                        var li = L.DomUtil.create('li', '', ul);
                        // Directly set the innerHTML to include the anchor tags with hyperlinks
                        li.innerHTML = resourceHtmlString;
                    });

                    // Function to modify the shadow DOM
                    var modifyShadowDOM = function () {
                        var shadowRoot = icon.shadowRoot;
                        if (shadowRoot) {
                            var svgTitle = shadowRoot.querySelector('title');
                            if (svgTitle) {
                                svgTitle.textContent = 'Resources for CWPP Creation';

                            } else {
                                setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                            }
                        } else {
                            setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                        }
                    };

                    // Start polling
                    modifyShadowDOM();

                    link.onclick = function () {
                        resourcesDiv.style.display = (resourcesDiv.style.display === 'none' ? 'block' : 'none');
                    }

                    return container;
                }
            });

            map.addControl(new ResourcesControl());

            // Using jQuery to attach the event listener
            $('.resources-content').on('mousewheel', function (event) {
                event.stopPropagation(); // Stop event from propagating to the map
            });


            map.addControl(new HelpControl());

        })
        .catch(function (error) {
            console.log(error);
        });

    function initializeMapWithData() {
        axios.get('/api/data').then(response => {
            allFeatures = response.data;
            geoJSONLayer = L.geoJSON(response.data, {
                onEachFeature: onEachFeature,
                style: function (feature) {
                    return {
                        color: getColor(feature.properties.jurisdiction),
                        fillOpacity: 1
                    };
                }
            }).addTo(map);

            if (geoJSONLayer.getBounds().isValid()) {
                map.fitBounds(geoJSONLayer.getBounds());
            }

            setTimeout(function () {
                $("#loadingScreen").hide();
            }, 1000); // 1000 milliseconds = 1 second
        });
    }

    initializeMapWithData();

    // Add a hosted feature layer to the map
    var currentIncidents = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/0',
        pointToLayer: function (feature, latlng) {
            var iconUrl;
            var iconSize = [30, 30]; // Set icon size

            // Determine which icon to use
            if (feature.properties.IncidentTypeCategory === 'RX') {
                iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACABAMAAAAxEHz4AAAAB3RJTUUH5QQWCjAYyxKlYQAAAAlwSFlzAAAK8AAACvABQqw0mAAAADBQTFRF57Vn571r571z771z78OB786U89em9+K99+zQ/+/W/+/e//fn//fv///v////////0LJAnAAAABB0Uk5T////////////////////AOAjXRkAAAWiSURBVHjazZnNbxtFFMDXVmIblcPuap0mgKKdFQUJqvIvJJUIEoc2lRDigELLIZRLSStoeoprBKrUQ9JeOFJx6ymFO6pVJE4c8jcQxYlJ0VhCQBMSxYxnd2fezL6ZndSK4J2ieN9v5n3NxxtvMKJ4/2/A7w/vLC/fuvtj/7kAT2+e9z0ulVc/eXxswNPP/UqQZBL4lXceHwtw9E1cSRTxq5/23QEHH1fCRBPiT3RcAb2ZIEEkGFt1A+zEYYIKqa64APZM+kNCqxywP2PUZ4SxB2WAw3mLPiOMb5QArlv1GeG0HfBzNSmR+EMbYD8o02fRXLMAlsJyAKmbAd1SA7gRCybA4ayLfpJEGwbATw4GcCPO4oAD3IN+ERt0UMAP6ATiuaJh5GUMcIhPYJy2kVBuIADcA/ECvW31ggAc4SEYo/QyFoh+AfAXOgFygVKMTD4qAJbQCYSUUoL9UNMB+1V0AlOU9tBf4jUN8AR34QqlOzj6FQ1wCbWgxizYRgFJUwU8w+e5wABdPMHjlgJ4YnShCZC8qABwC+pDwJYB0ISAf8wWSABRSfEDAPgDHYVbIE0IZ5WvyFsAcBvTTy0QAPLGjlpudQk4QpMttUCEkWX1l8oUwr4A4EEM1jkgTyRyjvaUgdJAemYX1Li+TOVJStvwQ3JOAFAXsBFTyZWYS3qKFxoCgC4F8bUMMCsBVNk4ohxwgLogzPTFglIojLiTAf62uYCNCv8xD438LANsWl1AN0MAUBJ7OgPcs7pAZBIH7MJINjLAFXQG6zkgT4S6YtBQmikAz8MmFUIgQNmA+xyAB6EuAZnjGgqOm/mIA9BElj6k+c7yEtVtIC0O+BM6Ngh1H+aez5FghSIXOeBXOPCZbIZkVQJSLw73GB4HkM7THPA9nMC319M/IgpkVpkT2OpOcQAMTJ1+B4Ku5GKcz2lT2lDnAJAGbA1pKy4HThC1AephggNALbKP2oUgsCoOYWIAJ0QcQKAF9H4KWIAAbrZMDFlQbFXzBocgLBdyC2EUU7PBnOT6QzaGAGnSMHYZYFUBsGUNIGVFshXBg5tKU+RJSKlmgywu4EWWy95gTwImxa+RBtiqjms+TQFrCoDn2m6Yz0WR+AU9sTigxQCylobHCUovFfJoKF9Br84bAKH0cZ3aZMkASOfNvThlBbQNgJpINDURCyKqQQM0xARLAFsGQKbFVr289p0AIoxi2PkyQNcAyLW6Fa2WCoBchSeSSGWpddm3A0Qu81QWxRQLrd7MiuMMOrCcJYD+Rt0AvJzFghLb5405kS8oYklzB4gwRsqiSpwBIhMnlGW9JPhARC3UlY2lJH+BiK3llLq1NVwBYkGZVjfXmitAHL8vqtt75KgvLkHDUxY8YGhruVFkMT5SjziucRQbC+lrh6wpN4C43jT1Y964k77cFvJjnoijmxPkGWdaP+q65aJY1MVRV57znDJB7kudwnE/u6RYRW6tUfHC4WKDbGg0kCuPgw3iQAOuPPr+ao2B/LaFXPvIZBlAnhLBtQ8cFcMSN4IzHrh4AieUuVEOpVx9QQPEXtPbst2cNUEK13/yrtUD8kyoXP9hAyJcdQmB3oAAlw5y2qi/OyP1tRYIbGH410yAG+BqElnaQGMGI7qgYV9oA8FGFJlA9XfiBFigN6IGsOXmv47o95SWd6EVpjbj/Lni+Io+0oxT24H+a5ofttWWO9IO1BqSfnQV6n+htvyxhqTeEiWVM1fXs/DfPO+pHQLQlbU0ZQMvfPv9xcXF94intVvxpizSFg4C/kpU6E8Y2sLujek3Bzhg5Nb4yM15x+eB2sAM2Bv1gWLkJ5JyI7T3jRN4Jip5qKquDcoAg2e2p7LiY9sJPNaN/lzIyurKaA+WbHn62tefTCsfHOPJlMmu9mg7t2748MSejbkhvzxcZvK8D9eO8t8D/gUyR4WhpHKfbwAAAABJRU5ErkJggg=='; // Replace with your base64 string
            } else if (feature.properties.IncidentTypeCategory === 'CX') {
                iconUrl = 'data:image/png;base64,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'; // Replace with your base64 string
            } else if (feature.properties.FireDiscoveryAge === 0) {
                iconUrl = 'data:image/png;base64,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'; // Replace with your base64 string
            } else {
                return; // Default Icon URL
            }

            var icon = L.icon({
                iconUrl: iconUrl,
                iconSize: iconSize,
                iconAnchor: [15, 15], // Center the icon
                popupAnchor: [0, -15] // Adjust the popup anchor
            });

            return L.marker(latlng, { icon: icon });
        }
    });

    // Add a hosted feature layer to the map with custom styling based on 'FeatureCategory'
    var currentBoundaries = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1',
        style: function (feature) {
            // Check the 'FeatureCategory' field to determine the style
            if (feature.properties.FeatureCategory === 'Wildfire Daily Fire Perimeter') {
                return {
                    color: '#e82020', // Outline color
                    opacity: 1,       // Outline opacity
                    weight: 1,        // Outline thickness
                    fillColor: '#e82020', // Fill color
                    fillOpacity: 0.7  // 70% fill transparency
                };
            } else if (feature.properties.FeatureCategory === 'Prescribed Fire') {
                return {
                    color: '#e82020', // Outline color
                    opacity: 1,       // Outline opacity
                    weight: 1,        // Outline thickness
                    fillColor: '#e82020', // Fill color
                    fillOpacity: 0.7  // 70% fill transparency
                };
            } else {
                // Default style for other categories
                return {
                    color: '#000',    // Default outline color
                    opacity: 1,       // Default outline opacity
                    weight: 1,        // Default outline thickness
                    fillColor: '#000', // Default fill color
                    fillOpacity: 0.7  // Default fill transparency
                };
            }
        }
    })

    var LayerControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Fire Layers';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'layers-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';
            icon.removeAttribute('title');  // Remove any default title
            icon.title = 'Fire Layers';

            // The actual layer list, initially hidden
            var layerList = L.DomUtil.create('div', 'layer-list', container);
            layerList.style.display = 'none';

            // Add layers here. This is just an example.
            var layers = [
                { name: 'Current Incidents', layer: currentIncidents },
                { name: 'Current Incident Boundaries', layer: currentBoundaries }
            ];

            // Inside your LayerControl's onAdd function
            layers.forEach(function (item) {
                var layerDiv = L.DomUtil.create('div', '', layerList);
                var checkbox = L.DomUtil.create('input', '', layerDiv);
                checkbox.type = 'checkbox';
                checkbox.checked = false;
                // When adding/removing layers from the map
                checkbox.onchange = function () {
                    if (this.checked) {
                        map.addLayer(item.layer);
                        if (item.name === 'Current Incident Boundaries') {
                            collapsibleLegendControl.updateLegend('currentBoundaries', 'Wildfire Daily Fire Perimeter', true);
                            collapsibleLegendControl.updateLegend('currentBoundaries', 'Prescribed Fire', true);
                        } else if (item.name === 'Current Incidents') {
                            // Add legend items for the 'currentIncidents' layer
                            collapsibleLegendControl.updateLegend('currentIncidents', 'Prescribed Fire', true);
                            collapsibleLegendControl.updateLegend('currentIncidents', 'Incident Complex', true);
                            collapsibleLegendControl.updateLegend('currentIncidents', 'New (Past 24-hour)', true);
                        }
                    } else {
                        map.removeLayer(item.layer);
                        if (item.name === 'Current Incident Boundaries') {
                            collapsibleLegendControl.updateLegend('currentBoundaries', 'Wildfire Daily Fire Perimeter', false);
                            collapsibleLegendControl.updateLegend('currentBoundaries', 'Prescribed Fire', false);
                        } else if (item.name === 'Current Incidents') {
                            // Remove legend items for the 'currentIncidents' layer
                            collapsibleLegendControl.updateLegend('currentIncidents', 'Prescribed Fire', false);
                            collapsibleLegendControl.updateLegend('currentIncidents', 'Incident Complex', false);
                            collapsibleLegendControl.updateLegend('currentIncidents', 'New (Past 24-hour)', false);
                        }
                    }
                };


                var label = L.DomUtil.create('label', '', layerDiv);
                label.innerHTML = item.name;
                label.insertBefore(checkbox, label.firstChild);
            });


            // Function to modify the shadow DOM
            var modifyShadowDOM = function () {
                var shadowRoot = icon.shadowRoot;
                if (shadowRoot) {
                    var svgTitle = shadowRoot.querySelector('title');
                    if (svgTitle) {
                        svgTitle.textContent = 'Fire Layers';

                    } else {
                        setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                    }
                } else {
                    setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                }
            };

            // Start polling
            modifyShadowDOM();

            link.onclick = function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                layerList.style.display = (layerList.style.display === 'none' ? 'block' : 'none');
            }

            setZIndexWithImportant($(container));

            return container;
        }
    });

    map.addControl(new LayerControl());

    var CollapsibleLegendControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            var self = this;

            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'Legend';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'book-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';
            icon.removeAttribute('title');
            icon.title = 'Legend';

            // Create legendDiv as a property of the control
            this.legendDiv = L.DomUtil.create('div', 'legend-content', container);
            this.legendDiv.style.display = 'none';

            // Create and add the static title for CWPPs at the top of the legend
            var cwppTitle = document.createElement('div');
            cwppTitle.className = 'legend-header';
            cwppTitle.innerText = 'CWPPs by Jurisdiction Level';
            this.legendDiv.appendChild(cwppTitle);  // Append the title at the top of the legend

            var grades = ['Community', 'County', 'Fire Protection District'];
            for (var i = 0; i < grades.length; i++) {
                // Define the border color based on the category
                var borderColor = getCWPPBorderColor(grades[i]);

                // Add the legend patch with the background color and border
                this.legendDiv.innerHTML +=
                    '<i style="background:' + getColor(grades[i]) + '; border: 2px solid ' + borderColor + ';"></i> ' +
                    grades[i] + '<br>';
            }

            // Function to modify the shadow DOM
            var modifyShadowDOM = function () {
                var shadowRoot = icon.shadowRoot;
                if (shadowRoot) {
                    var svgTitle = shadowRoot.querySelector('title');
                    if (svgTitle) {
                        svgTitle.textContent = 'Legend';

                    } else {
                        setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                    }
                } else {
                    setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                }
            };

            // Start polling
            modifyShadowDOM();

            link.onclick = function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                self.legendDiv.style.display = (self.legendDiv.style.display === 'none' ? 'block' : 'none'); // Use 'self' to refer to the control instance
            };

            setZIndexWithImportant($(container));

            return container;
        },

        updateLegend: function (layerName, category, add) {
            var legendDiv = this.legendDiv;
            var legendItemId = layerName + "-" + category.replace(/\s+/g, '-').toLowerCase();
            var legendItem = document.getElementById(legendItemId);

            if (add && !legendItem) {
                var newLegendItem = document.createElement('div');
                newLegendItem.id = legendItemId;
                newLegendItem.className = 'legend-item ' + layerName + '-item';

                if (layerName === 'currentIncidents') {
                    var iconUrl = getIconUrl(category); // Function to get icon URL
                    newLegendItem.innerHTML = '<i style="background-image: url(' + iconUrl + '); background-size: cover;"></i> ' + category;
                } else if (layerName === 'currentBoundaries') {
                    var fillColor = getFillColor(category);
                    var borderColor = getBorderColor(category);
                    newLegendItem.innerHTML = '<i style="background:' + fillColor + '; border: 2px solid ' + borderColor + ';"></i> ' + category;
                }
                addLegendHeader(this.legendDiv, layerName, this.getHeaderText(layerName), true);
                insertLegendItem(this.legendDiv, newLegendItem, layerName);

            } else if (!add && legendItem) {
                legendItem.remove();
                // Check if there are any items left for this category
                var remainingItems = this.legendDiv.querySelectorAll('.' + layerName + '-item');
                if (remainingItems.length === 0) {
                    addLegendHeader(this.legendDiv, layerName, this.getHeaderText(layerName), false);
                }
            }
        },

        getHeaderText: function (layerName) {
            switch (layerName) {
                case 'currentIncidents':
                    return 'Current Incidents';
                case 'currentBoundaries':
                    return 'Current Incident Boundaries';
                case 'cwpp':
                    return 'CWPPs';
                default:
                    return '';
            }
        },

    });

    function addLegendHeader(legendDiv, category, headerText, shouldAdd) {
        var headerId = category + '-header';
        var header = document.getElementById(headerId);

        if (shouldAdd && !header) {
            header = document.createElement('div');
            header.id = headerId;
            header.className = 'legend-header';
            header.innerText = headerText;

            // Insert the header at the correct position based on the category order
            var nextHeader = getNextHeader(legendDiv, category);
            if (nextHeader) {
                legendDiv.insertBefore(header, nextHeader);
            } else {
                legendDiv.appendChild(header);
            }
        } else if (!shouldAdd && header) {
            header.remove();
        }
    }

    function insertLegendItem(legendDiv, newLegendItem, layerName) {
        // Find the header for this layer
        var header = legendDiv.querySelector('#' + layerName + '-header');

        // If the header isn't found, create it and insert it into the correct position.
        if (!header) {
            addLegendHeader(legendDiv, layerName, getHeaderText(layerName), true);
            header = legendDiv.querySelector('#' + layerName + '-header');
        }

        // If the header is found, insert the new item directly after the header.
        if (header) {
            // Insert the new item after the header
            legendDiv.insertBefore(newLegendItem, header.nextSibling);
        }
    }

    // Function to get the next header based on the current category
    function getNextHeader(legendDiv, currentCategory) {
        var order = ['cwpp', 'currentIncidents', 'currentBoundaries'];
        var currentIndex = order.indexOf(currentCategory);
        for (var i = currentIndex + 1; i < order.length; i++) {
            var nextHeader = legendDiv.querySelector('#' + order[i] + '-header');
            if (nextHeader) {
                return nextHeader;
            }
        }
        return null; // This means it's the last category
    }

    // Instantiate and add the legend control to the map
    var collapsibleLegendControl = new CollapsibleLegendControl();
    map.addControl(collapsibleLegendControl);

    // Using jQuery to attach the event listener
    $('.legend-content').on('mousewheel', function (event) {
        event.stopPropagation(); // Stop event from propagating to the map
    });

    function getIconUrl(category) {
        switch (category) {
            case 'Prescribed Fire':
                return 'data:image/png;base64,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'; // Replace [BASE64_STRING_FOR_PRESCRIBED_FIRE] with the actual string
            case 'Incident Complex':
                return 'data:image/png;base64,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'; // Replace [BASE64_STRING_FOR_INCIDENT_COMPLEX] with the actual string
            case 'New (Past 24-hour)':
                return 'data:image/png;base64,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'; // Replace [BASE64_STRING_FOR_NEW_FIRE] with the actual string
            default:
                return '';
        }
    }


    function getColor(d) {
        return d === 'County' ? 'rgba(243,222,44, 0.25)' :
            d === 'Fire Protection District' ? 'rgba(189, 117, 122, 0.25)' :
                d === 'Community' ? 'rgba(55, 173, 184, 0.25)' :
                    'rgba(255, 237, 160, 0.4)';
    }


    function getCWPPBorderColor(d) {
        return d === 'County' ? 'rgba(243, 222, 44, 0.6)' :
            d === 'Fire Protection District' ? 'rgba(189, 117, 122, 0.6)' :
                d === 'Community' ? 'rgba(55, 173, 184, 0.6)' :
                    '#000'; // Default border color, if needed
    }


    function getFillColor(category) {
        switch (category) {
            case 'Wildfire Daily Fire Perimeter':
                return 'rgba(232, 32, 32, 0.7)'; // Example color for Wildfire Daily Fire Perimeter
            case 'Prescribed Fire':
                return 'rgba(255, 165, 0, 0.7)'; // Example color for Prescribed Fire
            default:
                return 'rgba(0, 0, 0, 0.7)';
        }
    }

    function getBorderColor(category) {
        switch (category) {
            case 'Wildfire Daily Fire Perimeter':
                return '#e82020'; // Example border color for Wildfire Daily Fire Perimeter
            case 'Prescribed Fire':
                return '#FFA500'; // Example border color for Prescribed Fire
            default:
                return '#000';
        }
    }


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
            position: 'topleft'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            var link = L.DomUtil.create('a', '', container);
            link.href = '#';
            link.title = 'State Filters';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'filter-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';
            icon.removeAttribute('title');  // Remove any default title
            icon.title = 'State Filters';

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

            // Function to modify the shadow DOM
            var modifyShadowDOM = function () {
                var shadowRoot = icon.shadowRoot;
                if (shadowRoot) {
                    var svgTitle = shadowRoot.querySelector('title');
                    if (svgTitle) {
                        svgTitle.textContent = 'State Filters';

                    } else {
                        setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                    }
                } else {
                    setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                }
            };

            // Start polling
            modifyShadowDOM();

            link.onclick = function () {
                filterDiv.style.display = (filterDiv.style.display === 'none' ? 'block' : 'none');
            }

            setZIndexWithImportant($(container));

            return container;
        }
    });

    map.addControl(new CollapsibleFilterControl());

    // Using jQuery to attach the event listener
    $('.filter-content').on('mousewheel', function (event) {
        event.stopPropagation(); // Stop event from propagating to the map
    });

    // Global variable declarations for the buttons
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
            link.title = 'Tutorial & Contact Us';

            var icon = L.DomUtil.create('ion-icon', '', link);
            icon.setAttribute('name', 'help-outline');
            icon.style.fontSize = '26px';
            icon.style.padding = '6px';
            icon.removeAttribute('title');  // Remove any default title
            icon.title = 'Tutorial & Contact Us';
            console.log("Icon:", icon)

            var helpDiv = L.DomUtil.create('div', 'help-content', container);
            helpDiv.style.display = 'none';

            // Tutorial Button
            tutorialButton = L.DomUtil.create('button', '', helpDiv);
            tutorialButton.innerHTML = 'Tutorial';

            // Assign onclick event to tutorialButton here
            tutorialButton.onclick = function () {
                updateTutorialPane();
                tutorialPane.style.display = 'block'; // Show the tutorial pane
                contactForm.style.display = 'none'; // Hide the contact form
                tutorialPane.style.zIndex = getNextZIndex();
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

            // Function to modify the shadow DOM
            var modifyShadowDOM = function () {
                var shadowRoot = icon.shadowRoot;
                if (shadowRoot) {
                    var svgTitle = shadowRoot.querySelector('title');
                    if (svgTitle) {
                        svgTitle.textContent = 'Tutorial & Contact Us';

                    } else {
                        setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                    }
                } else {
                    setTimeout(modifyShadowDOM, 50); // Retry after 50ms
                }
            };

            // Start polling
            modifyShadowDOM();

            link.onclick = function () {
                helpDiv.style.display = (helpDiv.style.display === 'none' ? 'block' : 'none');
            }

            return container;
        }
    });

    // Tutorial Pane Creation and Logic
    var tutorialPane = L.DomUtil.create('div', 'tutorial-pane', document.body);
    tutorialPane.style.display = 'none'; // Initially hidden
    tutorialPane.style.flexDirection = 'column';
    tutorialPane.style.alignItems = 'flex-start';
    tutorialPane.style.maxWidth = '350px'; // Set a max width for the pane

    // Define the widgets with their names, icons, and descriptions
    var widgets = [
        {
            name: "Fire Layers",
            icon: 'layers-outline',
            description: "Manage the display of various fire-related layers on the map"
        },
        {
            name: "Legend",
            icon: 'book-outline', // Assuming you have an icon for Legend
            description: "Show the map legend"
        },
        {
            name: "State Filters",
            icon: 'filter-outline',
            description: "Filter CWPPs by state"
        },
        {
            name: "Add CWPP",
            icon: 'create-outline',
            description: "Add a new CWPP to the repository, be sure to fill in all fields and edit or create geometry as necessary"
        },
        {
            name: "Basemaps",
            icon: 'grid-outline',
            description: "Switch between different basemap styles"
        },
        {
            name: "Resources",
            icon: 'documents-outline',
            description: "Access links to resources for CWPP creation"
        }

    ];

    // Function to update the tutorial pane with widget information
    function updateTutorialPane() {
        tutorialPane.innerHTML = ''; // Clear existing content

        // Generate HTML content for each widget
        widgets.forEach(function (widget) {
            var widgetContainer = L.DomUtil.create('div', 'widget-container', tutorialPane);
            widgetContainer.style.display = 'flex';
            widgetContainer.style.alignItems = 'center';
            widgetContainer.style.marginBottom = '10px';

            // Create a container for the icon to control its size and centering
            var iconContainer = L.DomUtil.create('div', 'icon-container', widgetContainer);
            iconContainer.style.width = '26px';
            iconContainer.style.height = '26px';
            iconContainer.style.display = 'flex';
            iconContainer.style.justifyContent = 'center';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.marginRight = '10px';

            var iconElement = L.DomUtil.create('ion-icon', '', iconContainer);
            iconElement.setAttribute('name', widget.icon);
            iconElement.style.fontSize = '26px'; // This controls the scale of the icon

            var widgetName = L.DomUtil.create('div', 'widget-name', widgetContainer);
            widgetName.innerHTML = `<strong>${widget.name}</strong>`;
            widgetName.style.marginRight = '10px';

            var widgetDesc = L.DomUtil.create('div', 'widget-description', widgetContainer);
            widgetDesc.innerHTML = widget.description;
        });

        // Inside the HelpControl onAdd function
        var tutorialCloseButton = L.DomUtil.create('button', 'tutorial-close-button', tutorialPane);
        tutorialCloseButton.innerHTML = '×'; // Using the multiplication symbol to represent 'x'
        tutorialCloseButton.onclick = function () {
            tutorialPane.style.display = 'none';
        };

        tutorialPane.appendChild(tutorialCloseButton);
    }

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

    document.body.appendChild(contactForm);

    L.control.scale().addTo(map);

});

