require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const CONTACT_TO = process.env.CONTACT_TO || process.env.SMTP_USER || 'admin@anot.health';
const SITE_ROOT = path.resolve(__dirname, '..');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://anot.health';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 500;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

app.use(cors({
    origin: [ALLOWED_ORIGIN, 'http://localhost:3000'],
    methods: ['POST'],
    allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json({ limit: '16kb' }));

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        servername: process.env.SMTP_HOST
    }
});

// Rate limiting: 5 submissions per IP per 15 minutes
const rateMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateMap.get(ip);
    if (!entry || now - entry[1] > RATE_WINDOW_MS) {
        rateMap.set(ip, [1, now]);
        return false;
    }
    entry[0] += 1;
    return entry[0] > RATE_LIMIT;
}

app.post('/api/contact', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(clientIp)) {
        return res.status(429).json({ success: false, error: 'Too many requests. Please wait before trying again.' });
    }

    try {
        const { name, email, practice, service, specialty, focus, message, _subject, subject } = req.body;

        const nameStr = String(name || '').trim().slice(0, MAX_FIELD_LEN);
        const emailStr = String(email || '').trim().slice(0, MAX_FIELD_LEN);
        const practiceStr = String(practice || '').trim().slice(0, MAX_FIELD_LEN);
        const serviceStr = String(service || '').trim().slice(0, MAX_FIELD_LEN);
        const specialtyStr = String(specialty || '').trim().slice(0, MAX_FIELD_LEN);
        const focusStr = String(focus || '').trim().slice(0, MAX_FIELD_LEN);
        const messageStr = String(message || '').trim().slice(0, 4000);
        const subjectStr = String(_subject || subject || '').trim().slice(0, MAX_FIELD_LEN);

        if (!nameStr || !emailStr || !messageStr) {
            return res.status(400).json({ success: false, error: 'name, email, and message are required.' });
        }
        if (!EMAIL_RE.test(emailStr)) {
            return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }

        const mailOptions = {
            from: `"Anot Health Website" <${process.env.SMTP_USER}>`,
            replyTo: emailStr,
            to: CONTACT_TO,
            subject: subjectStr || 'New Website Contact Form Submission',
            text: `
You have received a new demo request from the website!

Name: ${nameStr}
Email: ${emailStr}
Practice: ${practiceStr}
Service of interest: ${serviceStr}
Focus: ${focusStr}
Specialty: ${specialtyStr}

Message:
${messageStr}
            `,
            html: `
                <h3>New Demo Request</h3>
                <ul>
                    <li><strong>Name:</strong> ${escapeHtml(nameStr)}</li>
                    <li><strong>Email:</strong> ${escapeHtml(emailStr)}</li>
                    <li><strong>Practice:</strong> ${escapeHtml(practiceStr)}</li>
                    <li><strong>Service:</strong> ${escapeHtml(serviceStr)}</li>
                    <li><strong>Focus:</strong> ${escapeHtml(focusStr)}</li>
                    <li><strong>Specialty:</strong> ${escapeHtml(specialtyStr)}</li>
                </ul>
                <p><strong>Message:</strong></p>
                <p>${escapeHtml(messageStr).replace(/\n/g, '<br>')}</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

app.use(express.static(SITE_ROOT, {
    extensions: ['html']
}));

app.listen(PORT, () => {
    console.log(`Custom backend server running on http://localhost:${PORT}`);
    console.log(`Static site root: ${SITE_ROOT}`);
    console.log('Contact form endpoint ready at /api/contact');

    // Verify SMTP credentials once at startup, not per request
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter.verify().then(() => {
            console.log('SMTP connection verified.');
        }).catch((err) => {
            console.warn('SMTP verification failed at startup:', err.message);
        });
    } else {
        console.warn('SMTP environment variables not set — email sending will fail.');
    }
});
