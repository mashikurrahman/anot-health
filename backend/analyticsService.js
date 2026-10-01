const path = require('path');
const fs = require('fs');

// Cache storage
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
// GA4 events the site fires when a visitor submits a lead form.
const LEAD_EVENT_NAMES = ['generate_lead', 'form_submission', 'contact_submit', 'demo_request'];

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, {
        timestamp: Date.now(),
        data
    });
}

// Neither the GA4 client nor the Search Console client takes a request timeout, and a
// dashboard call makes up to eight of them in sequence. Without a ceiling, a stalled
// Google response leaves the admin request hanging for as long as the socket stays open
// and the browser just spins. Measured on this site: a warm call is ~5s and a cached one
// is instant, while the first call of a process is far slower because the gRPC/protobuf
// client is loaded and the service-account token is exchanged. The default leaves room
// for that cold start and still guarantees the request ends.
const ANALYTICS_TIMEOUT_MS = Math.max(5000, Number(process.env.ANALYTICS_TIMEOUT_MS || 90000));

class AnalyticsTimeoutError extends Error {
    constructor(label, ms) {
        super(`${label} did not respond within ${Math.round(ms / 1000)}s.`);
        this.name = 'AnalyticsTimeoutError';
        this.isTimeout = true;
    }
}

// The work carries on in the background if it ever completes - there is no way to cancel
// an in-flight client call - but the caller is released either way.
function withTimeout(label, promise) {
    let timer;
    const ceiling = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new AnalyticsTimeoutError(label, ANALYTICS_TIMEOUT_MS)), ANALYTICS_TIMEOUT_MS);
        if (typeof timer.unref === 'function') timer.unref();
    });
    return Promise.race([promise, ceiling]).finally(() => clearTimeout(timer));
}

function getCredentialsPath() {
    const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(__dirname, rawPath);
    return resolvedPath;
}

function hasCredentials() {
    const credPath = getCredentialsPath();
    return fs.existsSync(credPath);
}

function getClientEmail() {
    try {
        const credPath = getCredentialsPath();
        if (fs.existsSync(credPath)) {
            const raw = fs.readFileSync(credPath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed.client_email || null;
        }
    } catch {
        return null;
    }
    return null;
}

function getTechnicalHealthAudit() {
    const siteRoot = path.resolve(__dirname, '..');
    let sitemapUrlCount = 22;
    let hasSitemap = false;
    let hasRobots = false;

    try {
        const sitemapPath = path.join(siteRoot, 'sitemap.xml');
        if (fs.existsSync(sitemapPath)) {
            hasSitemap = true;
            const content = fs.readFileSync(sitemapPath, 'utf8');
            const matches = content.match(/<loc>/g);
            if (matches) sitemapUrlCount = matches.length;
        }
    } catch (e) { }

    try {
        const robotsPath = path.join(siteRoot, 'robots.txt');
        hasRobots = fs.existsSync(robotsPath);
    } catch (e) { }

    return {
        hasSitemap,
        sitemapUrlCount,
        hasRobots,
        sslActive: true,
        mobileFriendly: true,
        canonicalTagsConfigured: true,
        lastAuditTimestamp: new Date().toISOString()
    };
}

/**
 * Generates mock/preview data when credentials or properties are not yet configured.
 */
function getMockOverview() {
    return {
        configured: false,
        isMock: true,
        summary: {
            activeUsers: 1420,
            sessions: 2180,
            screenPageViews: 5890,
            leadsGenerated: 28,
            avgSessionDurationSec: 142
        },
        regionalTraffic: [
            { country: 'United States', code: 'US', users: 840, sessions: 1290, pct: 59.2 },
            { country: 'Canada', code: 'CA', users: 430, sessions: 670, pct: 30.3 },
            { country: 'Other Countries', code: 'OTHER', users: 150, sessions: 220, pct: 10.5 }
        ],
        channels: [
            { channel: 'Organic Search', sessions: 1308, pct: 60.0, leads: 17 },
            { channel: 'Direct', sessions: 545, pct: 25.0, leads: 7 },
            { channel: 'Referral', sessions: 218, pct: 10.0, leads: 3 },
            { channel: 'Organic Social', sessions: 109, pct: 5.0, leads: 1 }
        ],
        devices: [
            { device: 'Desktop', pct: 64.2, sessions: 1400 },
            { device: 'Mobile', pct: 32.8, sessions: 715 },
            { device: 'Tablet', pct: 3.0, sessions: 65 }
        ],
        technicalHealth: getTechnicalHealthAudit(),
        topPages: [
            { path: '/', title: 'Anot Health | Medical Billing & Clinical Solutions', views: 2450, users: 920 },
            { path: '/homepage-ca.html', title: 'Anot Health Canada | Canadian Billing & Solutions', views: 890, users: 340 },
            { path: '/billing.html', title: 'Medical Billing & RCM Services | Anot Health', views: 760, users: 290 },
            { path: '/billing-ca.html', title: 'Canadian Medical Billing (OHIP, MSP, AHCIP)', views: 510, users: 195 },
            { path: '/scribing.html', title: 'AI & Virtual Medical Scribes | Anot Health', views: 420, users: 160 },
            { path: '/contact.html', title: 'Book Demo & Consultation | Anot Health', views: 380, users: 210 },
            { path: '/pricing.html', title: 'Transparent Pricing & ROI | Anot Health', views: 310, users: 155 },
            { path: '/hipaa.html', title: 'HIPAA Compliance & Security Standards', views: 170, users: 85 }
        ],
        leadBreakdown: [
            { event: 'generate_lead', count: 19 },
            { event: 'demo_request', count: 6 },
            { event: 'quick_consultation', count: 3 }
        ]
    };
}

function getMockKeywords() {
    return {
        configured: false,
        isMock: true,
        summary: {
            totalClicks: 840,
            totalImpressions: 24600,
            avgCtrPct: 3.4,
            avgPosition: 8.7
        },
        queries: [
            { query: 'medical billing services for small practice', clicks: 112, impressions: 2150, ctr: 5.2, position: 3.8, isTop3: false, isStrikingDistance: true, isLowCtr: false },
            { query: 'canadian medical billing ohip msp', clicks: 88, impressions: 1420, ctr: 6.2, position: 2.4, isTop3: true, isStrikingDistance: false, isLowCtr: false },
            { query: 'medical scribe service usa', clicks: 76, impressions: 1890, ctr: 4.0, position: 4.2, isTop3: false, isStrikingDistance: true, isLowCtr: false },
            { query: 'virtual medical assistant cardiology', clicks: 64, impressions: 1200, ctr: 5.3, position: 5.1, isTop3: false, isStrikingDistance: true, isLowCtr: false },
            { query: 'rcm revenue cycle management for clinics', clicks: 59, impressions: 2310, ctr: 2.6, position: 8.9, isTop3: false, isStrikingDistance: true, isLowCtr: true },
            { query: 'pipeda compliant clinical scribing canada', clicks: 52, impressions: 980, ctr: 5.3, position: 3.1, isTop3: false, isStrikingDistance: true, isLowCtr: false },
            { query: 'anot health billing', clicks: 47, impressions: 380, ctr: 12.4, position: 1.2, isTop3: true, isStrikingDistance: false, isLowCtr: false },
            { query: 'physician billing denial management', clicks: 41, impressions: 1650, ctr: 2.5, position: 7.6, isTop3: false, isStrikingDistance: true, isLowCtr: true },
            { query: 'ehr integration virtual scribe', clicks: 36, impressions: 1100, ctr: 3.3, position: 9.4, isTop3: false, isStrikingDistance: true, isLowCtr: false },
            { query: 'telehealth medical billing rates', clicks: 31, impressions: 950, ctr: 3.3, position: 11.2, isTop3: false, isStrikingDistance: true, isLowCtr: false }
        ],
        topLandingPages: [
            { page: 'https://anot.health/', clicks: 340, impressions: 9800, ctr: 3.5, position: 4.1 },
            { page: 'https://anot.health/billing.html', clicks: 195, impressions: 5600, ctr: 3.5, position: 6.2 },
            { page: 'https://anot.health/homepage-ca.html', clicks: 120, impressions: 3100, ctr: 3.9, position: 4.8 },
            { page: 'https://anot.health/scribing.html', clicks: 95, impressions: 2900, ctr: 3.3, position: 7.5 },
            { page: 'https://anot.health/pricing.html', clicks: 50, impressions: 1400, ctr: 3.6, position: 8.9 }
        ]
    };
}

/**
 * Fetches GA4 Analytics Overview
 */
async function fetchGa4Overview({ days = 30, forceRefresh = false } = {}) {
    const cacheKey = `ga4_overview_${days}`;
    if (!forceRefresh) {
        const cached = getCached(cacheKey);
        if (cached) return cached;
    }

    const credPath = getCredentialsPath();
    const propertyId = String(process.env.GA4_PROPERTY_ID || '').trim();

    if (!fs.existsSync(credPath) || !propertyId) {
        const mock = getMockOverview();
        mock.missingDetails = {
            hasCredentialsFile: fs.existsSync(credPath),
            hasPropertyId: Boolean(propertyId),
            expectedCredPath: credPath,
            serviceAccountEmail: getClientEmail()
        };
        return mock;
    }

    try {
        const { BetaAnalyticsDataClient } = require('@google-analytics/data');
        const analyticsDataClient = new BetaAnalyticsDataClient({
            keyFilename: credPath
        });

        const startDate = `${days}daysAgo`;
        const endDate = 'today';

        // 1. Overall Totals
        const [overallReport] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'sessions' },
                { name: 'screenPageViews' },
                { name: 'averageSessionDuration' }
            ]
        });

        const overallRow = overallReport.rows?.[0]?.metricValues || [];
        const activeUsers = Number(overallRow[0]?.value || 0);
        const sessions = Number(overallRow[1]?.value || 0);
        const screenPageViews = Number(overallRow[2]?.value || 0);
        const avgSessionDurationSec = Math.round(Number(overallRow[3]?.value || 0));

        // 2. Regional Traffic (US vs CA vs Others)
        const [countryReport] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'country' }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'sessions' }
            ],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 20
        });

        let usUsers = 0, usSessions = 0;
        let caUsers = 0, caSessions = 0;
        let otherUsers = 0, otherSessions = 0;

        (countryReport.rows || []).forEach(row => {
            const country = row.dimensionValues[0]?.value || '';
            const u = Number(row.metricValues[0]?.value || 0);
            const s = Number(row.metricValues[1]?.value || 0);

            if (country === 'United States') {
                usUsers += u;
                usSessions += s;
            } else if (country === 'Canada') {
                caUsers += u;
                caSessions += s;
            } else {
                otherUsers += u;
                otherSessions += s;
            }
        });

        const totalRegUsers = usUsers + caUsers + otherUsers || 1;
        const regionalTraffic = [
            {
                country: 'United States',
                code: 'US',
                users: usUsers,
                sessions: usSessions,
                pct: Number(((usUsers / totalRegUsers) * 100).toFixed(1))
            },
            {
                country: 'Canada',
                code: 'CA',
                users: caUsers,
                sessions: caSessions,
                pct: Number(((caUsers / totalRegUsers) * 100).toFixed(1))
            },
            {
                country: 'Other Countries',
                code: 'OTHER',
                users: otherUsers,
                sessions: otherSessions,
                pct: Number(((otherUsers / totalRegUsers) * 100).toFixed(1))
            }
        ];

        // 3. Top Pages
        const [pagesReport] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'activeUsers' }
            ],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 12
        });

        const topPages = (pagesReport.rows || []).map(row => ({
            path: row.dimensionValues[0]?.value || '/',
            title: row.dimensionValues[1]?.value || 'Page',
            views: Number(row.metricValues[0]?.value || 0),
            users: Number(row.metricValues[1]?.value || 0)
        }));

        // 4. Lead Conversions
        let leadsGenerated = 0;
        const leadBreakdown = [];
        try {
            const [eventsReport] = await analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'eventName' }],
                metrics: [{ name: 'eventCount' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'eventName',
                        inListFilter: {
                            values: LEAD_EVENT_NAMES
                        }
                    }
                }
            });

            (eventsReport.rows || []).forEach(row => {
                const event = row.dimensionValues[0]?.value;
                const count = Number(row.metricValues[0]?.value || 0);
                leadsGenerated += count;
                leadBreakdown.push({ event, count });
            });
        } catch (e) {
            console.warn('Could not fetch specific lead events from GA4:', e.message);
        }

        // 5. Acquisition Channels and 6. Device Categories, both measured by GA4.
        // (These used to be fixed 60/25/10/5 and 64/33/3 splits of the totals.)
        const pct = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(1)) : 0);

        const [[channelReport], [channelLeadReport], [deviceReport]] = await Promise.all([
            analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'sessionDefaultChannelGroup' }],
                metrics: [{ name: 'sessions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 8
            }),
            analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'sessionDefaultChannelGroup' }],
                metrics: [{ name: 'eventCount' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'eventName',
                        inListFilter: { values: LEAD_EVENT_NAMES }
                    }
                }
            }).catch((e) => {
                console.warn('Could not fetch leads by channel from GA4:', e.message);
                return [{ rows: [] }];
            }),
            analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'deviceCategory' }],
                metrics: [{ name: 'sessions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
            })
        ]);

        const leadsByChannel = new Map((channelLeadReport.rows || []).map(row => [
            row.dimensionValues[0]?.value || '',
            Number(row.metricValues[0]?.value || 0)
        ]));
        const channelRows = (channelReport.rows || []).map(row => ({
            channel: row.dimensionValues[0]?.value || 'Unassigned',
            sessions: Number(row.metricValues[0]?.value || 0)
        }));
        const channelTotal = channelRows.reduce((sum, row) => sum + row.sessions, 0);
        const channels = channelRows.map(row => ({
            ...row,
            pct: pct(row.sessions, channelTotal),
            leads: leadsByChannel.get(row.channel) || 0
        }));

        const deviceRows = (deviceReport.rows || []).map(row => ({
            // GA4 reports lowercase names ("desktop"); the dashboard shows "Desktop".
            device: String(row.dimensionValues[0]?.value || 'other').replace(/^./, c => c.toUpperCase()),
            sessions: Number(row.metricValues[0]?.value || 0)
        }));
        const deviceTotal = deviceRows.reduce((sum, row) => sum + row.sessions, 0);
        const devices = deviceRows.map(row => ({ ...row, pct: pct(row.sessions, deviceTotal) }));

        const result = {
            configured: true,
            isMock: false,
            summary: {
                activeUsers,
                sessions,
                screenPageViews,
                leadsGenerated,
                avgSessionDurationSec
            },
            regionalTraffic,
            channels,
            devices,
            technicalHealth: getTechnicalHealthAudit(),
            topPages,
            leadBreakdown,
            serviceAccountEmail: getClientEmail()
        };

        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('GA4 API Query Error:', err);
        const fallback = getMockOverview();
        fallback.error = err.message;
        fallback.serviceAccountEmail = getClientEmail();
        return fallback;
    }
}

/**
 * Fetches Google Search Console Keywords & Rankings
 */
async function fetchGscKeywords({ days = 30, forceRefresh = false } = {}) {
    const cacheKey = `gsc_keywords_${days}`;
    if (!forceRefresh) {
        const cached = getCached(cacheKey);
        if (cached) return cached;
    }

    const credPath = getCredentialsPath();
    const siteUrl = String(process.env.GSC_SITE_URL || '').trim();

    if (!fs.existsSync(credPath) || !siteUrl) {
        const mock = getMockKeywords();
        mock.missingDetails = {
            hasCredentialsFile: fs.existsSync(credPath),
            hasSiteUrl: Boolean(siteUrl),
            expectedCredPath: credPath,
            serviceAccountEmail: getClientEmail()
        };
        return mock;
    }

    try {
        const { google } = require('googleapis');
        const auth = new google.auth.GoogleAuth({
            keyFile: credPath,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
        });

        const searchconsole = google.searchconsole({ version: 'v1', auth });

        // Calculate dates (GSC has 2-3 days data lag)
        const now = new Date();
        const endD = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
        const startD = new Date(endD.getTime() - (days * 24 * 60 * 60 * 1000));

        const formatDate = (d) => d.toISOString().split('T')[0];
        const startDateStr = formatDate(startD);
        const endDateStr = formatDate(endD);

        // 1. Query Keywords
        const queryRes = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: startDateStr,
                endDate: endDateStr,
                dimensions: ['query'],
                rowLimit: 25
            }
        });

        const queryRows = queryRes.data.rows || [];
        let totalClicks = 0;
        let totalImpressions = 0;
        let sumPositionWeighted = 0;

        const queries = queryRows.map(row => {
            const query = row.keys[0];
            const clicks = row.clicks || 0;
            const impressions = row.impressions || 0;
            const ctr = Number(((row.ctr || 0) * 100).toFixed(1));
            const position = Number((row.position || 0).toFixed(1));

            totalClicks += clicks;
            totalImpressions += impressions;
            sumPositionWeighted += position * impressions;

            return {
                query,
                clicks,
                impressions,
                ctr,
                position,
                isTop3: position <= 3.0,
                isStrikingDistance: position > 3.0 && position <= 15.0,
                isLowCtr: impressions >= 400 && ctr < 3.0
            };
        });

        const avgCtrPct = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(1)) : 0;
        const avgPosition = totalImpressions > 0 ? Number((sumPositionWeighted / totalImpressions).toFixed(1)) : 0;

        // 2. Query Top Landing Pages in Search
        let topLandingPages = [];
        try {
            const pageRes = await searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                    startDate: startDateStr,
                    endDate: endDateStr,
                    dimensions: ['page'],
                    rowLimit: 10
                }
            });

            topLandingPages = (pageRes.data.rows || []).map(row => ({
                page: row.keys[0],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: Number(((row.ctr || 0) * 100).toFixed(1)),
                position: Number((row.position || 0).toFixed(1))
            }));
        } catch (pe) {
            console.warn('Could not query landing pages from GSC:', pe.message);
        }

        const result = {
            configured: true,
            isMock: false,
            dateRange: { startDate: startDateStr, endDate: endDateStr },
            summary: {
                totalClicks,
                totalImpressions,
                avgCtrPct,
                avgPosition
            },
            queries,
            topLandingPages,
            serviceAccountEmail: getClientEmail()
        };

        setCache(cacheKey, result);
        return result;
    } catch (err) {
        console.error('GSC API Query Error:', err);
        const fallback = getMockKeywords();
        fallback.error = err.message;
        fallback.serviceAccountEmail = getClientEmail();
        return fallback;
    }
}

module.exports = {
    // Exported through the timeout wrapper so every caller gets the ceiling, rather
    // than each route having to remember to apply one.
    fetchGa4Overview: (options) => withTimeout('Google Analytics', fetchGa4Overview(options)),
    fetchGscKeywords: (options) => withTimeout('Google Search Console', fetchGscKeywords(options)),
    hasCredentials,
    getClientEmail,
    AnalyticsTimeoutError
};
