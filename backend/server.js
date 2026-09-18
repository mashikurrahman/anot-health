const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const crypto = require('crypto');
const analyticsService = require('./analyticsService');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const CONTACT_TO = process.env.CONTACT_TO || 'admin@anot.health, mashikurrahman7@gmail.com';
const SITE_ROOT = path.resolve(__dirname, '..');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://anot.health';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 500;

// Admin authentication for dashboard
const ADMIN_PASSWORD = process.env.ADMIN_ANALYTICS_PASSWORD || 'AnotAdmin2026!';
const adminSessions = new Map(); // token -> timestamp
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function cleanExpiredSessions() {
    const now = Date.now();
    for (const [token, ts] of adminSessions.entries()) {
        if (now - ts > SESSION_MAX_AGE_MS) adminSessions.delete(token);
    }
}
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !adminSessions.has(token)) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please login to view analytics.' });
    }
    adminSessions.set(token, Date.now());
    next();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const allowedOrigins = [
    'https://anot.health',
    'https://www.anot.health',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];
if (process.env.ALLOWED_ORIGIN) {
    allowedOrigins.push(process.env.ALLOWED_ORIGIN);
}

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.anot.health')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));
app.use(express.json({ limit: '16kb' }));

// Gracefully handle malformed or oversized request bodies without terminating the process
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'Request body too large.' });
    }
    next(err);
});

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

// Admin login brute-force protection: max 5 attempts per IP per 15 minutes
const loginRateMap = new Map();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isLoginRateLimited(ip) {
    const now = Date.now();
    const entry = loginRateMap.get(ip);
    if (!entry || now - entry[1] > LOGIN_WINDOW_MS) {
        loginRateMap.set(ip, [1, now]);
        return false;
    }
    entry[0] += 1;
    return entry[0] > LOGIN_RATE_LIMIT;
}

function saveLead(lead) {
    try {
        const candidateDirs = [
            path.resolve(SITE_ROOT, 'data'),
            path.resolve(__dirname, '..', 'data'),
            path.resolve(__dirname, 'data')
        ];
        let targetDir = candidateDirs.find(d => fs.existsSync(d)) || candidateDirs[0];
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const leadsFile = path.join(targetDir, 'leads.json');
        let leads = [];
        if (fs.existsSync(leadsFile)) {
            leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8') || '[]');
        }
        leads.unshift(lead);
        fs.writeFileSync(leadsFile, JSON.stringify(leads.slice(0, 1000), null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving lead to data/leads.json:', e);
    }
}

// ----------------------------------------------------
// API Router: Dual-mounted at /api and / for Passenger compatibility
// ----------------------------------------------------
const apiRouter = express.Router();

apiRouter.post('/contact', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(clientIp)) {
        return res.status(429).json({ success: false, error: 'Too many requests. Please wait before trying again.' });
    }

    try {
        const { name, email, practice, service, specialty, focus, message, _subject, subject, region, region_location, province, phone } = req.body;

        const nameStr = String(name || '').trim().slice(0, MAX_FIELD_LEN);
        const emailStr = String(email || '').trim().slice(0, MAX_FIELD_LEN);
        const practiceStr = String(practice || '').trim().slice(0, MAX_FIELD_LEN);
        const serviceStr = String(service || '').trim().slice(0, MAX_FIELD_LEN);
        const specialtyStr = String(specialty || '').trim().slice(0, MAX_FIELD_LEN);
        const focusStr = String(focus || '').trim().slice(0, MAX_FIELD_LEN);
        const regionStr = String(region || region_location || province || '').trim().slice(0, MAX_FIELD_LEN);
        const phoneStr = String(phone || '').trim().slice(0, MAX_FIELD_LEN);
        const messageStr = String(message || '').trim().slice(0, 4000);
        const subjectStr = String(_subject || subject || '').trim().slice(0, MAX_FIELD_LEN);

        if (!nameStr || !emailStr) {
            return res.status(400).json({ success: false, error: 'name and email are required.' });
        }
        if (!EMAIL_RE.test(emailStr)) {
            return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }

        const leadRecord = {
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            createdAt: new Date().toISOString(),
            ip: clientIp,
            name: nameStr,
            email: emailStr,
            phone: phoneStr,
            practice: practiceStr,
            region: regionStr,
            service: serviceStr,
            focus: focusStr,
            specialty: specialtyStr,
            message: messageStr,
            subject: subjectStr || 'New Website Demo / Contact Request'
        };

        saveLead(leadRecord);

        // Attempt SMTP dispatch if configured
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            try {
                const mailOptions = {
                    from: `"Anot Health Website" <${process.env.SMTP_USER}>`,
                    replyTo: emailStr,
                    to: CONTACT_TO,
                    subject: subjectStr || 'New Website Demo / Contact Request',
                    text: `
You have received a new consultation / demo request from the website!

Name: ${nameStr}
Email: ${emailStr}
Phone: ${phoneStr || 'Not provided'}
Practice: ${practiceStr || 'Not provided'}
Region / Province: ${regionStr || 'Not specified'}
Service of interest: ${serviceStr || 'Not specified'}
Focus: ${focusStr || 'General walkthrough'}
Specialty: ${specialtyStr || 'Not specified'}

Message:
${messageStr || 'No custom message entered.'}
                    `,
                    html: `
                        <h3>New Consultation / Demo Request</h3>
                        <ul>
                            <li><strong>Name:</strong> ${escapeHtml(nameStr)}</li>
                            <li><strong>Email:</strong> ${escapeHtml(emailStr)}</li>
                            <li><strong>Phone:</strong> ${escapeHtml(phoneStr) || '<em>Not provided</em>'}</li>
                            <li><strong>Practice:</strong> ${escapeHtml(practiceStr) || '<em>Not provided</em>'}</li>
                            <li><strong>Region / Province:</strong> ${escapeHtml(regionStr) || '<em>Not specified</em>'}</li>
                            <li><strong>Service:</strong> ${escapeHtml(serviceStr) || '<em>Not specified</em>'}</li>
                            <li><strong>Focus:</strong> ${escapeHtml(focusStr) || '<em>General walkthrough</em>'}</li>
                            <li><strong>Specialty:</strong> ${escapeHtml(specialtyStr) || '<em>Not specified</em>'}</li>
                        </ul>
                        <p><strong>Message:</strong></p>
                        <p>${messageStr ? escapeHtml(messageStr).replace(/\n/g, '<br>') : '<em>No custom message entered.</em>'}</p>
                    `
                };
                const info = await transporter.sendMail(mailOptions);
                console.log('Lead notification email sent:', info.messageId);
            } catch (mailErr) {
                console.warn('SMTP delivery notification warning:', mailErr.message);
            }
        } else {
            console.log('Lead saved to database (SMTP credentials pending in .env):', leadRecord.id);
        }

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error processing contact lead:', error);
        res.status(500).json({ success: false, error: 'Failed to process message.' });
    }
});

// Admin Login
apiRouter.post('/admin/login', (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (isLoginRateLimited(clientIp)) {
        return res.status(429).json({ success: false, error: 'Too many failed login attempts. Please wait 15 minutes before trying again.' });
    }

    const { password } = req.body || {};
    if (!password || String(password) !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, Date.now());

    res.json({
        success: true,
        token,
        expiresInHours: 12
    });
});

// Admin Logout
apiRouter.post('/admin/logout', requireAdminAuth, (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
        adminSessions.delete(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
});

// Analytics Status Check
apiRouter.get('/admin/analytics/status', requireAdminAuth, (req, res) => {
    const hasCreds = analyticsService.hasCredentials();
    const serviceAccountEmail = analyticsService.getClientEmail();
    const propertyId = process.env.GA4_PROPERTY_ID || '';
    const siteUrl = process.env.GSC_SITE_URL || '';

    res.json({
        success: true,
        hasCredentials: hasCreds,
        serviceAccountEmail,
        hasGa4PropertyId: Boolean(propertyId.trim()),
        hasGscSiteUrl: Boolean(siteUrl.trim()),
        isFullyConfigured: Boolean(hasCreds && propertyId.trim() && siteUrl.trim())
    });
});

// GA4 Traffic & Conversions Overview
apiRouter.get('/admin/analytics/overview', requireAdminAuth, async (req, res) => {
    try {
        const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
        const forceRefresh = req.query.refresh === 'true';
        const data = await analyticsService.fetchGa4Overview({ days, forceRefresh });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error in /api/admin/analytics/overview:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve analytics overview.' });
    }
});

// GSC Keywords & Search Queries
apiRouter.get('/admin/analytics/keywords', requireAdminAuth, async (req, res) => {
    try {
        const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
        const forceRefresh = req.query.refresh === 'true';
        const data = await analyticsService.fetchGscKeywords({ days, forceRefresh });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error in /api/admin/analytics/keywords:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve search console queries.' });
    }
});

// Mount router at both /api and / to handle sub-URI deployments and root deployments
app.use('/api', apiRouter);
app.use('/', apiRouter);

// ----------------------------------------------------
// Security Shield: Block sensitive internal paths & files
// ----------------------------------------------------
app.use((req, res, next) => {
    const rawPath = decodeURIComponent(req.path).toLowerCase();

    // Deny all requests into backend directory, dotfiles, credentials, and source
    // scripts. data/chatbot-knowledge.json, cache-version.json and site.webmanifest
    // are legitimate public JSON the front end fetches at runtime and must stay
    // reachable - only the lead database and credential files are blocked by name.
    if (
        rawPath.startsWith('/backend') ||
        rawPath.startsWith('/.') ||
        rawPath.includes('/.') ||
        rawPath === '/data/leads.json' ||
        /(^|\/)service-account.*\.json$/.test(rawPath) ||
        /(^|\/)package(-lock)?\.json$/.test(rawPath) ||
        rawPath.endsWith('.env') ||
        rawPath.endsWith('.log') ||
        rawPath.endsWith('.ps1') ||
        rawPath.endsWith('.py') ||
        rawPath.endsWith('.sh')
    ) {
        return res.status(403).type('text/plain').send('403 Forbidden: Access to internal server resource is restricted.');
    }
    next();
});

app.use(express.static(SITE_ROOT, {
    extensions: ['html'],
    dotfiles: 'deny'
}));

// Catch-all error handler: a rejected CORS origin otherwise falls through to
// Express's default handler, which returns 500 and leaks the server's file
// paths in a stack trace.
app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).type('text/plain').send('403 Forbidden: Origin not allowed.');
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
});

// Start server when executed directly (or managed by Passenger)
const server = app.listen(PORT, () => {
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

module.exports = app;
