// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const AWS = require('aws-sdk');
const multer = require('multer');
const { google } = require('googleapis');
const { exec } = require('child_process');
const fs = require('fs');
const nodemailer = require('nodemailer');

const stateFolderMap = {
    'AL': '1epb-ERt2N9GdhISH4M908894hfnmt2EE',
    'AK': '1yRadDAOUk2YQJ7wTxUkONv2qoWlROjeW',
    'AZ': '1Zlc_aHJuevIir6wXEVOv4ArpOPdTaSVR',
    'AR': '1cWeUV7aqsJXfcN-kTzF8WuxcjaInpDP-',
    'CA': '11n3teV6bN6BI77hU11rC6ORRvtfFHF1U',
    'CO': '1mUdDvQ5EGTYlEccdYAR91ugIzEchb6Qp',
    'CT': '1G733wSRLE_TVWjmRC_qxOFqlwRo2oRpb',
    'DE': '1lb4vE-813ERU6wYUzWHcL49RPlEaqwuL',
    'FL': '1_lmRF29gBFGNlAhiklnIf7OmUUe4ATLL',
    'GA': '1G5T5z2Te-HueCwt9oDO8b8LMZUQDPeGy',
    'HI': '1zmbStnAXhGcyhxMontHbktfAIcM52hF_',
    'ID': '1WZKQzIIiwGfBUOXuTWh5MxI8nA-VMTnI',
    'IL': '1Z0qXwEagpkF0w9LQ7nwnOhb7UBF5RlSH',
    'IN': '19EoZQZ70itJ_aGv-BA_482EVOewJEGZs',
    'IA': '1LOat41dmSjoQ2c96Q4L_V3Dlwq5SyH1P',
    'KS': '1TbVwzXY3mtWr02ub1uW2xZuwdvsEEf9e',
    'KY': '15wrNax6imAtaahPUxhqWvRb20yktkO0i',
    'LA': '1OIMG9XER7VVU7lSbukay_kaaU1ARQwFA',
    'ME': '1SIN0DrEPHcMt3ehgoLz8WdzAS5Z9ZH1x',
    'MD': '13h3bzZ9v2ZtpfOkxr-OcSUotr0AvllLx',
    'MA': '1vkIrbUNwL01Z5zTZROUgXR6vdH46aX6G',
    'MI': '1B5YGqmYt_z42Tz0QJUUEtM23q05WyqU_',
    'MN': '1vci_VmXacifdNwMp-eRZctjC-GF0727r',
    'MS': '15gc4TFKxhaBFHmSHcrgZjplr6Vdzj9b7',
    'MO': '1tjdGpTr7oVLGe20XY2-gkTvBCKus6Uhr',
    'MT': '1nVdvqGVSVgr4ZC-Zf4fhkbuFklSaRgIy',
    'NE': '175R9-KJ8P3LU4zEcXJ3Hpfh-b71FUD6b',
    'NV': '1CKgEGdF0yRvjhFgSXsV0VmAdvFjJ6tbq',
    'NH': '1mhu-DjAdE9cTk5rXMtz9XWRGw8BYl-tg',
    'NJ': '1-wQTi6jBK0lz5VChq6JCCzMRoZpTlRPQ',
    'NM': '11WAiieJ4-ayVR4id2Ow4cdsmMkBJu6vz',
    'NY': '1-dsEdutEw-tTgm4NMSPAZwFrP-hlEeCd',
    'NC': '1lRDqbHTKocDtvGU4f0JrCwHspeBBB4oG',
    'ND': '1M5vUvaS93LDfuEbElOt7PCs9FGhFVpI7',
    'OH': '1KjjPBO-3KEGodLiC_e54cR5VafN0VgHx',
    'OK': '1j9_D8CetLpa_evApCBqb99IXn2RtJ1lP',
    'OR': '1g0SmDWiPl80sYR44Ioa53EOdr7VqQOcU',
    'PA': '1yk19zw6Wf9Odhmdq2Svw7uCsQV6LwIai',
    'RI': '1fKE0FJhoMPVKkWXRQaZp-rzylV0htQsf',
    'SC': '1bX2Ji4rQXmg2eZBlk6VeB-GE-1noCcxc',
    'SD': '1g8zIS_jhvlt7koGDov3M1YF_1RYHRKve',
    'TN': '1ZXFmEuiEC6GncVRYb_PpQynlZTcsq8dQ',
    'TX': '1Fa2Tw3lGacSORqrFEVg4yVN488Cb-y6n',
    'UT': '1hH1p-0TxMeXyuC1IbVyBuSoJ3YcfAph0',
    'VT': '1RV8GLoacFJ-aCRfCryp3U8MbNAsUDNn3',
    'VA': '1w5xMB2oEMz7AUt8Np7TwVNGDJNtWFPO9',
    'WA': '1jJ9Xn7auRyV9SK_EX_wrhdZf5aGvOFpA',
    'WV': '1Ce0nAUFZmaso6MHavQKniA2tNEXjoIsd',
    'WI': '1Thf7BtpOtKZko_oKJenRIC3zDTZmQI4R',
    'WY': '1s3LKH3Pd1Q5jaA8vaxkF49wmEijlgdLo'
};

const storage = multer.memoryStorage(); // Stores the file as a buffer in memory
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});


function getFolderIdForState(state) {
    return stateFolderMap[state];
}

async function convertToPDF(buffer, mimetype) {
    return new Promise((resolve, reject) => {
        // File paths
        let inputPath;
        const outputPath = '/tmp/output.pdf'; // Converted file

        // Based on mimetype, decide the file extension and if conversion is needed
        switch (mimetype) {
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                inputPath = '/tmp/input.docx';
                break;
            case 'application/msword':
                inputPath = '/tmp/input.doc';
                break;
            case 'application/pdf':
                resolve(buffer); // If it's a PDF, no conversion is needed. Return the original buffer.
                return;
            default:
                reject(new Error('Unsupported file type'));
                return;
        }

        // Write the file to the server
        fs.writeFileSync(inputPath, buffer);

        // Convert the file
        exec(`unoconv -f pdf -o ${outputPath} ${inputPath}`, (error) => {
            if (error) {
                reject(error);
                return;
            }

            // Read the converted file
            const pdfBuffer = fs.readFileSync(outputPath);
            resolve(pdfBuffer);

            // Cleanup temporary files
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        });
    });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
});

pool.connect()
    .then(client => {
        console.log('Connected to database');
        client.release();
    })
    .catch((err) => console.error('Connection error', err.stack));

app.use(cors());

AWS.config.update({
    region: 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

app.get('/api/data', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT *, ST_AsGeoJSON(wkb_geometry) as geom FROM cwpp_official');
        res.send(rows.map(row => {
            let properties = { ...row };
            delete properties.wkb_geometry;
            delete properties.geom;
            return {
                type: 'Feature',
                geometry: JSON.parse(row.geom),
                properties: properties
            };
        }));
    } catch (err) {
        console.log(err.stack);
        res.status(500).send('Error fetching data');
    }
});

app.post('/api/data', upload.single('file'), async (req, res) => {
    // Parse the feature string into a JSON object
    const feature = JSON.parse(req.body.feature);
    const { name, jurisdiction, county, state, year_published, contact_email } = feature.properties;
    const geometry = feature.geometry;

    const file = req.file;
    const folderId = getFolderIdForState(state);

    try {
        const pdfBuffer = await convertToPDF(file.buffer, file.mimetype);

        const driveResponse = await drive.files.create({
            auth: jwtClient,
            media: {
                mimeType: 'application/pdf',
                body: require('stream').Readable.from(pdfBuffer)
            },
            requestBody: {
                name: file.originalname,
                parents: [folderId]
            }
        });

        const link = `<a href='https://drive.google.com/file/d/${driveResponse.data.id}/view?usp=drivesdk' target='_blank'>${county}</a>`;

        const query = `
            INSERT INTO cwpp_unconfirmed (name, jurisdiction, county, state, year_published, wkb_geometry, pdf, contact_email) 
            VALUES ($1, $2, $3, $4, $5, ST_GeomFromGeoJSON($6), $7, $8)
            RETURNING uid, contact_email, name;
        `;

        const result = await pool.query(query, [name, jurisdiction, county, state, year_published, JSON.stringify(geometry), link, contact_email]);
        const uid = result.rows[0].uid;
        const contact_email_use = result.rows[0].contact_email;
        const name_use = result.rows[0].name;

        // Check if the insert was successful
        if (result.rowCount === 0) {
            console.error('Failed to insert data into cwpp_unconfirmed.');
            return res.status(500).send('Failed to add feature to database.');
        }

        const lambdaParams = {
            FunctionName: 'emailerFunction',
            Payload: JSON.stringify({ uid: uid, contact_email_use: contact_email_use, name_use: name_use })
        };
        lambda.invoke(lambdaParams, (err, data) => {
            if (err) {
                console.error('Error invoking Lambda function:', err);
            } else {
                console.log('Lambda function invoked successfully:', data.Payload);
            }
        });

        res.status(201).send('Feature added');
    } catch (err) {
        console.log(err.stack);
        res.status(500).send(`Error adding data: ${err.message}`);
    }
});

app.get('/confirm/:uid', async (req, res) => {
    const uid = req.params.uid;
    try {
        // Begin a transaction
        await pool.query('BEGIN');
        console.log('Transaction started.');

        // Fetch data from cwpp_unconfirmed
        const fetchQuery = `
            SELECT contact_email, name FROM cwpp_unconfirmed WHERE uid = $1
        `;
        const fetchRes = await pool.query(fetchQuery, [uid]);
        const contact_email_confirmed = fetchRes.rows[0].contact_email;
        const name_confirmed = fetchRes.rows[0].name;
        console.log(`Fetched contact_email: ${contact_email_confirmed}, name: ${name_confirmed}`);

        // 1. Insert into cwpp_official
        const insertToWideQuery = `
            INSERT INTO cwpp_official
            SELECT * FROM cwpp_unconfirmed WHERE uid = $1
        `;
        const wideRes = await pool.query(insertToWideQuery, [uid]);
        console.log(`Inserted ${wideRes.rowCount} rows into cwpp_official.`);

        // 2. Insert into cwpp_confirmed
        const insertToConfirmedQuery = `
            INSERT INTO cwpp_confirmed
            SELECT * FROM cwpp_unconfirmed WHERE uid = $1
        `;
        const confirmedRes = await pool.query(insertToConfirmedQuery, [uid]);
        console.log(`Inserted ${confirmedRes.rowCount} rows into cwpp_confirmed.`);

        // 3. Delete from cwpp_unconfirmed
        const deleteQuery = `
            DELETE FROM cwpp_unconfirmed WHERE uid = $1
        `;
        const deleteRes = await pool.query(deleteQuery, [uid]);
        console.log(`Deleted ${deleteRes.rowCount} rows from cwpp_unconfirmed.`);

        // Commit the transaction
        await pool.query('COMMIT');
        console.log('Transaction committed.');

        // Send an email to notify that the feature has been confirmed
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: contact_email_confirmed,
            subject: `${name_confirmed} has been Added to the Official Dataset`,
            text: `The ${name_confirmed} CWPP you recently submitted has been confirmed and added to our database, and is viewable at https://fireadapted.org/cwpp-database/.`
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log('Email send error:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });

        res.send('Feature confirmed and added to the official dataset');
    } catch (err) {
        // If there's an error, roll back the transaction
        await pool.query('ROLLBACK');
        console.log('Transaction rolled back due to error.', err.stack);
        res.status(500).send('Error processing confirm action');
    }
});

// Deny feature: transfer from cwpp_unconfirmed to cwpp_denied
app.get('/deny/:uid', async (req, res) => {
    const uid = req.params.uid;

    const denyQuery = `
        WITH transferred AS (
            INSERT INTO cwpp_denied
            SELECT * FROM cwpp_unconfirmed WHERE uid = $1
            RETURNING uid
        )
        DELETE FROM cwpp_unconfirmed WHERE uid IN (SELECT uid FROM transferred);
    `;

    try {
        await pool.query(denyQuery, [uid]);  // <-- Fix here
        res.send('Feature denied and moved to denied dataset');
    } catch (err) {
        console.log(err.stack);
        res.status(500).send('Error processing deny action');
    }
});

app.get('/api/token', (req, res) => {
    res.send({ token: process.env.MAPBOX_ACCESS_TOKEN });
});

const drive = google.drive('v3');
const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
);

app.get('/api/states', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT DISTINCT state FROM cwpp_official');
        res.send(rows.map(row => row.state));
    } catch (err) {
        console.log(err.stack);
        res.status(500).send('Error fetching unique states');
    }
});

app.post('/contact-email', async (req, res) => {
    try {
        const { email, subject, message } = req.body;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            }
        });

        // Email options for sending the enquiry to you:
        const adminMailOptions = {
            from: process.env.EMAIL,
            to: process.env.EMAIL,
            subject: `CWPP Database Enquiry from ${email}: ${subject}`,
            text: message
        };

        // Email options for sending a confirmation to the user:
        const userMailOptions = {
            from: process.env.EMAIL,
            to: email, // Send to the user's email
            subject: 'Recent CWPP Enquiry',
            text: 'Thank you for reaching out to FACNet concerning our CWPP database. We will review your message and get back to you within 48 hours.'
        };

        // Send the email to you:
        transporter.sendMail(adminMailOptions, async (error, info) => {
            if (error) {
                console.log('Email send error:', error);
                res.status(500).json({ error: 'Failed to send email.' });
                return;
            }

            console.log('Email sent to admin:', info.response);

            // After sending to you successfully, send the confirmation email to the user:
            transporter.sendMail(userMailOptions, (userError, userInfo) => {
                if (userError) {
                    console.log('Email send error to user:', userError);
                    res.status(500).json({ error: 'Failed to send confirmation email to user.' });
                    return;
                }

                console.log('Confirmation email sent to user:', userInfo.response);
                res.json({ message: 'Emails sent successfully.' });
            });
        });

    } catch (err) {
        console.error('Error processing email:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


jwtClient.authorize(err => {
    if (err) {
        console.error("Error authorizing Google Drive:", err);
    } else {
        console.log("Successfully authorized Google Drive.");
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});