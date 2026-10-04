const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY || 're_123'); // Fallback to avoid crash

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Enable CORS for specific origins
const allowedOrigins = ['https://studiognails.intrface.in', 'http://localhost:3000', 'http://localhost:5000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST']
}));

// Parse JSON bodies (increased limit for image uploads)
app.use(express.json({ limit: '10mb' }));

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// Rate Limiting
const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many submissions from this IP, please try again after 15 minutes.'
});

// Apply rate limiter to the submit endpoint
app.use('/api/submit', submitLimiter);

// Submit Endpoint
app.post('/api/submit', async (req, res) => {
    try {
        const data = req.body;

        // Sanitize inputs to prevent HTML injection in emails
        const escapeHTML = (str) => {
            if (typeof str !== 'string') return '';
            return str.replace(/[&<>'"]/g, tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
        };

        const safeFirstName = escapeHTML(data.firstName);
        const safeLastName = escapeHTML(data.lastName);
        const safeEmail = escapeHTML(data.emailAddress);
        const safePhone = escapeHTML(data.phoneNumber);
        const safeCoffee = escapeHTML(data.coffeePreference);

        const htmlBody = `
            <h2>Matra x StudioG.Nails Navratri Workshop Registration</h2>
            
            <h3>--- Personal Details ---</h3>
            <p><b>Name:</b> ${safeFirstName} ${safeLastName}</p>
            <p><b>Email:</b> ${safeEmail || 'N/A'}</p>
            <p><b>WhatsApp Number:</b> ${safePhone || 'N/A'}</p>
            
            <h3>--- Preferences ---</h3>
            <p><b>Coffee Preference:</b> ${safeCoffee || 'N/A'}</p>
        `;

        // If no API key, mock success for local testing
        if (!process.env.RESEND_API_KEY) {
            console.log("Mocking email send. HTML:", htmlBody);
            return res.status(200).json({ success: true, message: 'Mock submission successful (No API Key)', id: 'mock-id' });
        }

        // Prepare attachments
        const attachments = [];
        if (data.paymentScreenshot && data.paymentScreenshot.content) {
            attachments.push({
                filename: data.paymentScreenshot.filename || 'payment.png',
                content: data.paymentScreenshot.content
            });
        }

        // Send notification email to the Team via Resend
        const { data: emailData, error } = await resend.emails.send({
            from: 'noreply@intrface.in',
            to: ['kalsibilliz99@gmail.com'],
            subject: `Matra x StudioG.Nails Navratri Workshop Registration: ${safeFirstName} ${safeLastName}`,
            html: htmlBody,
            reply_to: safeEmail || 'no-reply@intrface.in',
            attachments: attachments.length > 0 ? attachments : undefined
        });

        if (error) {
            console.error('Resend Error (Team Notification):', error);
            return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
        }

        // Send confirmation email to the Client
        if (safeEmail) {
            const clientHtmlBody = `
                <h2>Registration Confirmed! 🎉</h2>
                <p>Hi ${safeFirstName},</p>
                <p>Thank you for registering for the StudioG.Nails Navratri Nail Art Workshop.</p>
                <p>We have successfully received your details and payment screenshot. Our team will review it and get back to you if needed.</p>
                <br>
                <h3>Your Workshop Details:</h3>
                <ul>
                    <li><b>Date:</b> 06/10/2026 (Tuesday)</li>
                    <li><b>Time:</b> 11 AM to 2 PM</li>
                    <li><b>Coffee:</b> ${safeCoffee || 'N/A'}</li>
                </ul>
                <br>
                <p>Looking forward to seeing you!</p>
                <p>- The StudioG.Nails Team</p>
            `;

            await resend.emails.send({
                from: 'noreply@intrface.in',
                to: [safeEmail],
                subject: 'Workshop Registration Confirmed - StudioG.Nails',
                html: clientHtmlBody
            });
        }

        res.status(200).json({ success: true, message: 'Submission successful', id: emailData.id });
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

module.exports = app;
