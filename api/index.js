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

// Enable CORS for frontend requests
app.use(cors({
    origin: '*',
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

        const htmlBody = `
            <h2>New StudioG.Nails Workshop Registration</h2>
            
            <h3>--- Personal Details ---</h3>
            <p><b>Name:</b> ${data.firstName || ''} ${data.lastName || ''}</p>
            <p><b>Email:</b> ${data.emailAddress || 'N/A'}</p>
            <p><b>WhatsApp Number:</b> ${data.phoneNumber || 'N/A'}</p>
            
            <h3>--- Preferences ---</h3>
            <p><b>Coffee Preference:</b> ${data.coffeePreference || 'N/A'}</p>
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

        // Send email via Resend
        const { data: emailData, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
            to: ['teams@intrface.in'], // Consider changing if not testing
            subject: 'New Workshop Registration',
            html: htmlBody,
            reply_to: data.emailAddress || 'no-reply@intrface.in',
            attachments: attachments.length > 0 ? attachments : undefined
        });

        if (error) {
            console.error('Resend Error:', error);
            return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
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
