require('dotenv').config();
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    const uid = event.uid;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        }
    });

    let info = await transporter.sendMail({
        from: process.env.EMAIL,
        to: process.env.EMAIL,
        subject: 'Review New Feature',
        html: `<p>A new feature with uid ${uid} has been added.</p>
               <p><a href="http://localhost:3000/confirm/${uid}">Confirm</a></p>
               <p><a href="http://localhost:3000/deny/${uid}">Deny</a></p>`
    });

    return { statusCode: 200, body: 'Email sent' };
};


