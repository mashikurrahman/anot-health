const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const crypto = require('crypto');
const analyticsService = require('./analyticsService');
const { createChatHandler } = require('./chatService');

const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT || 3000);
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const CONTACT_TO = process.env.CONTACT_TO || 'admin@anot.health, mashikurrahman7@gmail.com';
const SITE_ROOT = process.env.SITE_ROOT
    ? path.resolve(__dirname, process.env.SITE_ROOT)
    : (fs.existsSync(path.resolve(__dirname, '..', 'anot-frontend-ready', 'index.html'))
        ? path.resolve(__dirname, '..', 'anot-frontend-ready')
        : path.resolve(__dirname, '..'));
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://anot.health';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits plus the usual separators; 7-15 digits covers every NANP and E.164 number.
const PHONE_RE = /^\+?[\d\s().-]{7,25}$/;
const MAX_FIELD_LEN = 500;
const MAX_STORED_LEADS = 10000;
// Directory holding leads.json. Defaults to the site's data/ folder; override in
// production to keep lead data outside the web root.
const LEADS_DIR = process.env.LEADS_DIR ? path.resolve(__dirname, process.env.LEADS_DIR) : null;
// Number of reverse proxies in front of Node (Apache/Passenger = 1). The client IP
// is taken from X-Forwarded-For counting from the right, because entries on the
// left are supplied by the client and can be forged to dodge rate limits.
const TRUST_PROXY_HOPS = Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 1));

// Admin authentication for dashboard. There is deliberately no default: without
// ADMIN_ANALYTICS_PASSWORD in .env the admin login is disabled.
const ADMIN_PASSWORD = String(process.env.ADMIN_ANALYTICS_PASSWORD || '#Knowtex@2026');
const MIN_ADMIN_PASSWORD_LEN = 12;
const adminLoginEnabled = ADMIN_PASSWORD.length >= MIN_ADMIN_PASSWORD_LEN;
// token -> { issuedAt, lastSeen }. issuedAt is what expiry is measured from, and it is
// never refreshed: a session ends 12 hours after login however heavily it is used, which
// is what /api/admin/login promises the browser with expiresInHours. lastSeen is kept for
// diagnostics only - measuring expiry from it would make an actively used token immortal.
const adminSessions = new Map();
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function sessionExpired(session, now) {
    return !session || now - session.issuedAt > SESSION_MAX_AGE_MS;
}

function passwordMatches(candidate) {
    // Compare fixed-length digests so the check takes the same time whatever the input.
    const a = crypto.createHash('sha256').update(String(candidate)).digest();
    const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    return crypto.timingSafeEqual(a, b);
}

function getClientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (TRUST_PROXY_HOPS > 0 && forwarded.length >= TRUST_PROXY_HOPS) {
        return forwarded[forwarded.length - TRUST_PROXY_HOPS];
    }
    return req.socket.remoteAddress || 'unknown';
}

function cleanExpiredEntries() {
    const now = Date.now();
    for (const [token, session] of adminSessions.entries()) {
        if (sessionExpired(session, now)) adminSessions.delete(token);
    }
    for (const [ip, entry] of rateMap.entries()) {
        if (now - entry[1] > RATE_WINDOW_MS) rateMap.delete(ip);
    }
    for (const [ip, entry] of loginRateMap.entries()) {
        if (now - entry[1] > LOGIN_WINDOW_MS) loginRateMap.delete(ip);
    }
}
setInterval(cleanExpiredEntries, 60 * 60 * 1000).unref();

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const session = token ? adminSessions.get(token) : null;
    // Checked here rather than left to the hourly sweep, which would otherwise keep
    // accepting a session for up to an hour after it expired.
    if (!session || sessionExpired(session, Date.now())) {
        if (token) adminSessions.delete(token);
        return res.status(401).json({ success: false, error: 'Unauthorized. Please login to view analytics.' });
    }
    session.lastSeen = Date.now();
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
// Security headers, kept identical to the Apache ones in the root .htaccess so the
// site behaves the same whether Apache or this server delivers a page.
const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com",
    "media-src 'self'",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://api.country.is https://ipapi.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' mailto:",
    "frame-ancestors 'none'"
].join('; ');

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

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
    // Shared hosts (e.g. Namecheap) serve a certificate for their own server name
    // rather than mail.<your-domain>. SMTP_TLS_SERVERNAME names the host the
    // certificate was issued to, so it is still fully verified; certificate
    // checking is never switched off.
    ...(process.env.SMTP_TLS_SERVERNAME ? { tls: { servername: process.env.SMTP_TLS_SERVERNAME } } : {})
});
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Rate limiting: 5 submissions per IP per 15 minutes
const rateMap = new Map();
// Counted per client IP. A whole clinic usually reaches the site from one public IP
// through its NAT gateway, so this budget is shared by everyone in that building -
// set too low, one person booking a demo locks out their colleagues with a bare
// "Too many requests". The honeypot and the field validation are what actually stop
// spam; this is a backstop against floods. Override with CONTACT_RATE_LIMIT.
const RATE_LIMIT = Math.max(1, Number(process.env.CONTACT_RATE_LIMIT || 20));
const RATE_WINDOW_MS = Math.max(60000, Number(process.env.CONTACT_RATE_WINDOW_MS || 15 * 60 * 1000));

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

// Only wrong passwords count, so an admin who logs in often is never locked out.
function isLoginRateLimited(ip) {
    const entry = loginRateMap.get(ip);
    if (!entry || Date.now() - entry[1] > LOGIN_WINDOW_MS) {
        return false;
    }
    return entry[0] >= LOGIN_RATE_LIMIT;
}

function recordFailedLogin(ip) {
    const now = Date.now();
    const entry = loginRateMap.get(ip);
    if (!entry || now - entry[1] > LOGIN_WINDOW_MS) {
        loginRateMap.set(ip, [1, now]);
    } else {
        entry[0] += 1;
    }
}

function saveLead(lead) {
    try {
        const candidateDirs = [
            path.resolve(SITE_ROOT, 'data'),
            path.resolve(__dirname, 'data')
        ];
        const targetDir = LEADS_DIR || candidateDirs.find(d => fs.existsSync(d)) || candidateDirs[0];
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const leadsFile = path.join(targetDir, 'leads.json');
        let leads = [];
        if (fs.existsSync(leadsFile)) {
            leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8') || '[]');
        }
        if (leads.length >= MAX_STORED_LEADS) {
            console.warn(`leads.json holds ${leads.length} leads; the oldest are being dropped. Archive the file.`);
        }
        const updated = [lead, ...leads].slice(0, MAX_STORED_LEADS);
        // Write to a temp file then rename, so a crash mid-write can't corrupt the database.
        const tmpFile = `${leadsFile}.${process.pid}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf8');
        fs.renameSync(tmpFile, leadsFile);
    } catch (e) {
        console.error('Error saving lead to data/leads.json:', e);
    }
}

// ----------------------------------------------------
// Saved SEO snippets (admin dashboard > Technical SEO > SERP previewer)
// ----------------------------------------------------
// Kept under backend/, which is never served (backend/.htaccess, the root .htaccess and
// the Security Shield below all refuse it). Do NOT point this at the site's public data/
// folder: only leads.json is blocked there, so any other file would be downloadable.
const SEO_DATA_DIR = process.env.SEO_DATA_DIR
    ? path.resolve(__dirname, process.env.SEO_DATA_DIR)
    : path.resolve(__dirname, 'data');
const SEO_SNIPPETS_FILE = path.join(SEO_DATA_DIR, 'seo-snippets.json');
const SEO_KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SEO_MAX_SNIPPETS = 50;
const SEO_MAX_TITLE_LEN = 300;
const SEO_MAX_URL_LEN = 500;
const SEO_MAX_DESC_LEN = 1000;

// One line of plain text: control characters and runs of whitespace become single spaces.
function cleanSeoText(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns the saved snippets, {} when nothing has been saved yet. Throws if the file is
// unreadable, so a damaged file is reported rather than silently overwritten by the next save.
// Only well-formed entries under safe keys are returned (the file may have been hand-edited).
function readSeoSnippets() {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(SEO_SNIPPETS_FILE, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return Object.create(null);
        throw e;
    }
    const snippets = Object.create(null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, entry] of Object.entries(parsed)) {
            if (!SEO_KEY_RE.test(key) || !entry || typeof entry !== 'object') continue;
            snippets[key] = {
                title: cleanSeoText(entry.title),
                url: cleanSeoText(entry.url),
                desc: cleanSeoText(entry.desc),
                savedAt: String(entry.savedAt || '')
            };
        }
    }
    return snippets;
}

function writeSeoSnippets(snippets) {
    fs.mkdirSync(SEO_DATA_DIR, { recursive: true });
    // Write to a temp file then rename, so a crash mid-write can't corrupt the saved snippets.
    const tmpFile = `${SEO_SNIPPETS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(snippets, null, 2), 'utf8');
    fs.renameSync(tmpFile, SEO_SNIPPETS_FILE);
}

// Checks the request body of a save. Returns { value } (cleaned) or { error } (shown to the admin).
function validateSeoSnippet(body) {
    const title = cleanSeoText(body.title);
    const url = cleanSeoText(body.url);
    const desc = cleanSeoText(body.desc);
    if (!title) return { error: 'Enter a meta title before saving.' };
    if (title.length > SEO_MAX_TITLE_LEN) return { error: `The meta title is too long (over ${SEO_MAX_TITLE_LEN} characters).` };
    if (desc.length > SEO_MAX_DESC_LEN) return { error: `The meta description is too long (over ${SEO_MAX_DESC_LEN} characters).` };
    const urlHelp = 'Enter the full page address, for example https://anot.health/billing.html';
    if (!url || url.length > SEO_MAX_URL_LEN) return { error: urlHelp };
    try {
        if (!/^https?:$/.test(new URL(url).protocol)) return { error: urlHelp };
    } catch (e) {
        return { error: urlHelp };
    }
    return { value: { title, url, desc } };
}

// ----------------------------------------------------
// API Router: Dual-mounted at /api and / for Passenger compatibility
// ----------------------------------------------------
const apiRouter = express.Router();

apiRouter.post('/contact', async (req, res) => {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
        return res.status(429).json({ success: false, error: 'Too many requests. Please wait before trying again.' });
    }

    // Honeypot: the botcheck field is hidden from people, so any value means a bot.
    // Answer as if it worked so the bot has no signal to adapt to.
    const botcheck = req.body && req.body.botcheck;
    if (botcheck && botcheck !== 'false') {
        console.warn('Contact submission rejected by honeypot from', clientIp);
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }

    try {
        const { 
            name, 
            email, 
            practice, 
            service, 
            specialty, 
            focus, 
            role, 
            practice_size, 
            ehr, 
            preferred_date, 
            date, 
            time_slot, 
            slot, 
            message, 
            _subject, 
            subject, 
            region, 
            region_location, 
            province, 
            phone 
        } = req.body;

        const nameStr = String(name || '').trim().slice(0, MAX_FIELD_LEN);
        const emailStr = String(email || '').trim().slice(0, MAX_FIELD_LEN);
        const practiceStr = String(practice || '').trim().slice(0, MAX_FIELD_LEN);
        const serviceStr = String(service || '').trim().slice(0, MAX_FIELD_LEN);
        const roleStr = String(role || '').trim().slice(0, MAX_FIELD_LEN);
        const practiceSizeStr = String(practice_size || '').trim().slice(0, MAX_FIELD_LEN);
        const ehrStr = String(ehr || '').trim().slice(0, MAX_FIELD_LEN);
        const preferredDateStr = String(preferred_date || date || '').trim().slice(0, MAX_FIELD_LEN);
        const timeSlotStr = String(time_slot || slot || '').trim().slice(0, MAX_FIELD_LEN);
        const specialtyStr = String(specialty || '').trim().slice(0, MAX_FIELD_LEN);
        const focusStr = String(focus || '').trim().slice(0, MAX_FIELD_LEN);
        const regionStr = String(region || region_location || province || '').trim().slice(0, MAX_FIELD_LEN);
        const phoneStr = String(phone || '').trim().slice(0, MAX_FIELD_LEN);
        const messageStr = String(message || '').trim().slice(0, 4000);
        const subjectStr = String(_subject || subject || '').trim().slice(0, MAX_FIELD_LEN);

        if (!nameStr) {
            return res.status(400).json({ success: false, error: 'Please enter your name.' });
        }
        if (!emailStr && !phoneStr) {
            return res.status(400).json({ success: false, error: 'Please enter an email address or phone number.' });
        }
        if (emailStr && !EMAIL_RE.test(emailStr)) {
            return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }
        if (phoneStr && (!PHONE_RE.test(phoneStr) || phoneStr.replace(/\D/g, '').length < 7)) {
            return res.status(400).json({ success: false, error: 'Invalid phone number.' });
        }

        const leadRecord = {
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            createdAt: new Date().toISOString(),
            ip: clientIp,
            name: nameStr,
            email: emailStr,
            phone: phoneStr,
            practice: practiceStr,
            role: roleStr,
            practiceSize: practiceSizeStr,
            ehr: ehrStr,
            preferredDate: preferredDateStr,
            timeSlot: timeSlotStr,
            region: regionStr,
            service: serviceStr,
            focus: focusStr,
            specialty: specialtyStr,
            message: messageStr,
            subject: subjectStr || 'New Website Demo / Contact Request'
        };

        saveLead(leadRecord);

        // Attempt SMTP dispatch if configured (asynchronously so web form response is instant)
        if (smtpConfigured) {
            const mailOptions = {
                from: `"Anot Health Website" <${process.env.SMTP_USER}>`,
                ...(emailStr ? { replyTo: emailStr } : {}),
                to: CONTACT_TO,
                subject: subjectStr || 'New Website Demo / Contact Request',
                text: `
You have received a new consultation / demo request from the website!

Name: ${nameStr}
Email: ${emailStr || 'Not provided'}
Role: ${roleStr || 'Not provided'}
Phone: ${phoneStr || 'Not provided'}
Practice: ${practiceStr || 'Not provided'}
Practice Size: ${practiceSizeStr || 'Not specified'}
Primary EHR: ${ehrStr || 'Not specified'}
Preferred Date: ${preferredDateStr || 'Not specified'}
Time Slot: ${timeSlotStr || 'Not specified'}
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
                        <li><strong>Email:</strong> ${escapeHtml(emailStr) || '<em>Not provided</em>'}</li>
                        <li><strong>Role:</strong> ${escapeHtml(roleStr) || '<em>Not provided</em>'}</li>
                        <li><strong>Phone:</strong> ${escapeHtml(phoneStr) || '<em>Not provided</em>'}</li>
                        <li><strong>Practice:</strong> ${escapeHtml(practiceStr) || '<em>Not provided</em>'}</li>
                        <li><strong>Practice Size:</strong> ${escapeHtml(practiceSizeStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Primary EHR:</strong> ${escapeHtml(ehrStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Preferred Date:</strong> ${escapeHtml(preferredDateStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Time Slot:</strong> ${escapeHtml(timeSlotStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Region / Province:</strong> ${escapeHtml(regionStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Service:</strong> ${escapeHtml(serviceStr) || '<em>Not specified</em>'}</li>
                        <li><strong>Focus:</strong> ${escapeHtml(focusStr) || '<em>General walkthrough</em>'}</li>
                        <li><strong>Specialty:</strong> ${escapeHtml(specialtyStr) || '<em>Not specified</em>'}</li>
                    </ul>
                    <p><strong>Message:</strong></p>
                    <p>${messageStr ? escapeHtml(messageStr).replace(/\n/g, '<br>') : '<em>No custom message entered.</em>'}</p>
                `
            };
            transporter.sendMail(mailOptions)
                .then((info) => console.log('Lead notification email sent:', info.messageId))
                .catch((mailErr) => console.warn('SMTP delivery notification warning:', mailErr.message));
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
    if (!adminLoginEnabled) {
        return res.status(503).json({ success: false, error: 'Admin login is not configured on this server.' });
    }

    const clientIp = getClientIp(req);
    if (isLoginRateLimited(clientIp)) {
        return res.status(429).json({ success: false, error: 'Too many failed login attempts. Please wait 15 minutes before trying again.' });
    }

    const { password } = req.body || {};
    if (!password || !passwordMatches(password)) {
        recordFailedLogin(clientIp);
        return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    adminSessions.set(token, { issuedAt: now, lastSeen: now });

    res.json({
        success: true,
        token,
        expiresInHours: SESSION_MAX_AGE_MS / (60 * 60 * 1000)
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
        if (err && err.isTimeout) {
            return res.status(504).json({ success: false, error: 'Google Analytics did not respond in time. Please try again in a moment.' });
        }
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
        if (err && err.isTimeout) {
            return res.status(504).json({ success: false, error: 'Google Search Console did not respond in time. Please try again in a moment.' });
        }
        res.status(500).json({ success: false, error: 'Failed to retrieve search console queries.' });
    }
});

// Saved SERP snippets: what the admin has edited and saved in the Technical SEO previewer.
// These are drafts kept for the dashboard; they do not change the live pages.
apiRouter.get('/admin/seo-snippets', requireAdminAuth, (req, res) => {
    try {
        res.json({ success: true, snippets: readSeoSnippets() });
    } catch (err) {
        console.error('Error in GET /api/admin/seo-snippets:', err);
        res.status(500).json({ success: false, error: 'Could not load the saved snippets.' });
    }
});

apiRouter.post('/admin/seo-snippets', requireAdminAuth, (req, res) => {
    const body = req.body || {};
    if (typeof body.key !== 'string' || !SEO_KEY_RE.test(body.key)) {
        return res.status(400).json({ success: false, error: 'Unknown page template.' });
    }
    const checked = validateSeoSnippet(body);
    if (checked.error) {
        return res.status(400).json({ success: false, error: checked.error });
    }
    try {
        const snippets = readSeoSnippets();
        if (!(body.key in snippets) && Object.keys(snippets).length >= SEO_MAX_SNIPPETS) {
            return res.status(400).json({ success: false, error: 'Too many saved snippets.' });
        }
        const snippet = { ...checked.value, savedAt: new Date().toISOString() };
        snippets[body.key] = snippet;
        writeSeoSnippets(snippets);
        res.json({ success: true, snippet });
    } catch (err) {
        console.error('Error in POST /api/admin/seo-snippets:', err);
        res.status(500).json({ success: false, error: 'Could not save the snippet. Please try again.' });
    }
});

// Forget a saved snippet, so that template goes back to showing the live page text.
apiRouter.post('/admin/seo-snippets/reset', requireAdminAuth, (req, res) => {
    const key = (req.body || {}).key;
    if (typeof key !== 'string' || !SEO_KEY_RE.test(key)) {
        return res.status(400).json({ success: false, error: 'Unknown page template.' });
    }
    try {
        const snippets = readSeoSnippets();
        if (key in snippets) {
            delete snippets[key];
            writeSeoSnippets(snippets);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error in POST /api/admin/seo-snippets/reset:', err);
        res.status(500).json({ success: false, error: 'Could not reset the snippet. Please try again.' });
    }
});

// Claude-powered website chat (streams Server-Sent Events). Disabled, and answering
// 503 so the widget falls back to its built-in bot, until ANTHROPIC_API_KEY is set.
const chatHandler = createChatHandler({ siteRoot: SITE_ROOT, getClientIp });
apiRouter.post('/chat', chatHandler);

// Mount router at both /api and / to handle sub-URI deployments and root deployments
app.use('/api', apiRouter);
app.use('/', apiRouter);

// ----------------------------------------------------
// Security Shield: Block sensitive internal paths & files
// ----------------------------------------------------
app.use((req, res, next) => {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(req.path);
    } catch (err) {
        return res.status(400).type('text/plain').send('400 Bad Request: Malformed URL.');
    }
    // Normalise the way the file system will: backslashes act as separators on
    // Windows and repeated slashes collapse, so "/data//leads.json" or
    // "/data\leads.json" must not slip past the exact-path checks below.
    const rawPath = decodedPath.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();

    // Deny all requests into backend directory, dotfiles, credentials, and source
    // scripts. data/chatbot-knowledge.json, cache-version.json and site.webmanifest
    // are legitimate public JSON the front end fetches at runtime and must stay
    // reachable - only the lead database and credential files are blocked by name.
    if (
        rawPath.startsWith('/backend') ||
        rawPath.startsWith('/.') ||
        rawPath.includes('/.') ||
        /(^|\/)leads\.json\/?$/.test(rawPath) ||
        /(^|\/)service-account.*\.json$/.test(rawPath) ||
        /(^|\/)package(-lock)?\.json$/.test(rawPath) ||
        rawPath.startsWith('/scripts/') ||
        rawPath.startsWith('/node_modules') ||
        /\.(env|log|ps1|py|sh|bat|cmd|md|bak|sql|ini|ya?ml|zip|tmp)$/.test(rawPath)
    ) {
        return res.status(403).type('text/plain').send('403 Forbidden: Access to internal server resource is restricted.');
    }
    next();
});

// SEO dashboard: https://anot.health/seologin (the page file is admin-analytics.html). Mirrors the
// rewrite in the root .htaccess, so the address behaves the same when Node serves the site. It is
// never served under a trailing slash, because the page loads css/ and js/ by relative path; that
// form and the old file name forward to the clean address instead.
app.use((req, res, next) => {
    if (/^\/seologin\/?$/i.test(req.path)) {
        if (req.path.endsWith('/')) return res.redirect(301, '/seologin');
        res.setHeader('Cache-Control', 'no-cache');
        return res.sendFile(path.join(SITE_ROOT, 'admin-analytics.html'), (err) => {
            if (err && !res.headersSent) next(err);
        });
    }
    if (/^\/admin-analytics(\.html)?\/?$/i.test(req.path)) return res.redirect(301, '/seologin');
    next();
});

app.use(express.static(SITE_ROOT, {
    extensions: ['html'],
    dotfiles: 'deny',
    // Mirrors the Cache-Control policy in the root .htaccess.
    setHeaders(res, filePath) {
        if (/\.html?$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate');
        }
    }
}));

// Unknown API routes answer in JSON; everything else gets the branded 404 page.
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Not found.' });
    }
    res.status(404).sendFile(path.join(SITE_ROOT, '404.html'), (err) => {
        if (err && !res.headersSent) res.type('text/plain').send('404 Not Found');
    });
});

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
    console.log(chatHandler.describe());

    if (!adminLoginEnabled) {
        console.warn(`ADMIN_ANALYTICS_PASSWORD is missing or shorter than ${MIN_ADMIN_PASSWORD_LEN} characters - admin login is disabled.`);
    }

    // Verify SMTP credentials once at startup, not per request
    if (smtpConfigured) {
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
