/**
 * Anot Health - Client-Side Geo-Detection & Region Switcher
 * Detects Canadian vs US visitors and routes them to the appropriate localized version.
 * Supports:
 *   1. Direct URL override: ?region=ca or ?region=us
 *   2. Cached user preference: localStorage('anot_selected_region') & cookie
 *   3. Instant Timezone heuristic: America/Toronto, Vancouver, Edmonton, etc. (0ms latency)
 *   4. Lightweight GeoIP fallback API
 *   5. Regional Page Pair Mapping (Home, Pricing, Billing, Trust)
 */

(function () {
    'use strict';

    const CANADIAN_TIMEZONES = [
        'America/Toronto',
        'America/Montreal',
        'America/Vancouver',
        'America/Edmonton',
        'America/Calgary',
        'America/Winnipeg',
        'America/Halifax',
        'America/St_Johns',
        'America/Regina',
        'America/Moncton',
        'America/Whitehorse',
        'America/Yellowknife',
        'America/Iqaluit',
        'America/Glace_Bay',
        'America/Goose_Bay',
        'America/Rainy_River',
        'America/Rankin_Inlet',
        'America/Resolute',
        'America/Swift_Current',
        'America/Cambridge_Bay',
        'America/Dawson',
        'America/Dawson_Creek',
        'America/Inuvik',
        'America/Pangnirtung'
    ];

    // Regional Page Pair Mapping: US page <-> CA page
    const PAIRS_US_TO_CA = {
        'index.html': 'homepage-ca.html',
        'homepage-2.html': 'homepage-ca.html',
        'pricing.html': 'pricing-ca.html',
        'billing.html': 'billing-ca.html',
        'hipaa.html': 'pipeda.html',
        'scribing.html': 'scribing-ca.html',
        'coding.html': 'coding-ca.html',
        'about.html': 'about-ca.html',
        'contact.html': 'contact-ca.html'
    };

    const PAIRS_CA_TO_US = {
        'homepage-ca.html': 'index.html',
        'pricing-ca.html': 'pricing.html',
        'billing-ca.html': 'billing.html',
        'pipeda.html': 'hipaa.html',
        'scribing-ca.html': 'scribing.html',
        'coding-ca.html': 'coding.html',
        'about-ca.html': 'about.html',
        'contact-ca.html': 'contact.html'
    };

    function setCookie(name, value, days) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
    }

    function saveRegionPreference(region) {
        try {
            localStorage.setItem('anot_selected_region', region);
            setCookie('anot_region', region, 30);
        } catch (e) {}
    }

    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    function getPageFilename() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
        return filename || 'index.html';
    }

    /* Carry the querystring and hash across a regional redirect, so deep links
       like contact.html?service=coding#demo-form still land on the right form
       and section after being routed to their regional twin. The region/country
       params are dropped because they have already been consumed. */
    function withContext(target) {
        const params = new URLSearchParams(window.location.search);
        params.delete('region');
        params.delete('country');
        const qs = params.toString();
        return target + (qs ? '?' + qs : '') + window.location.hash;
    }

    // Manual switcher function exposed globally (invoked by flag buttons in headers/footers)
    window.setAnotRegion = function (region) {
        const cleanRegion = region.toLowerCase() === 'ca' ? 'ca' : 'us';
        saveRegionPreference(cleanRegion);

        if (typeof gtag === 'function') {
            gtag('event', 'select_region', {
                region: cleanRegion === 'ca' ? 'Canada' : 'United States'
            });
        }

        const currentFile = getPageFilename();
        if (cleanRegion === 'ca') {
            if (PAIRS_US_TO_CA[currentFile]) {
                window.location.href = withContext(PAIRS_US_TO_CA[currentFile]);
                return;
            }
        } else {
            if (PAIRS_CA_TO_US[currentFile]) {
                window.location.href = withContext(PAIRS_CA_TO_US[currentFile]);
                return;
            }
        }
        // If on an agnostic page (contact, about, specialties, etc.), refresh to update header/footer
        window.location.reload();
    };

    const currentFile = getPageFilename();
    const isRoot = currentFile === '' || currentFile === 'index.html';

    // 1. Check for manual URL override (?region=ca or ?region=us)
    const urlRegion = getQueryParam('region') || getQueryParam('country');
    if (urlRegion) {
        const clean = urlRegion.toLowerCase() === 'ca' ? 'ca' : 'us';
        saveRegionPreference(clean);
        if (clean === 'ca' && PAIRS_US_TO_CA[currentFile]) {
            window.location.replace(withContext(PAIRS_US_TO_CA[currentFile]));
            return;
        } else if (clean === 'us' && PAIRS_CA_TO_US[currentFile]) {
            window.location.replace(withContext(PAIRS_CA_TO_US[currentFile]));
            return;
        }
        return;
    }

    // 2. Check for existing cached user selection
    let savedRegion = null;
    try {
        savedRegion = localStorage.getItem('anot_selected_region');
    } catch (e) {}

    if (savedRegion === 'ca') {
        if (PAIRS_US_TO_CA[currentFile]) {
            window.location.replace(withContext(PAIRS_US_TO_CA[currentFile]));
            return;
        }
        return;
    } else if (savedRegion === 'us') {
        if (PAIRS_CA_TO_US[currentFile]) {
            window.location.replace(withContext(PAIRS_CA_TO_US[currentFile]));
            return;
        }
        return;
    }

    // 3. Fast Timezone heuristic (instant execution, 0ms latency)
    try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone && CANADIAN_TIMEZONES.includes(userTimezone)) {
            saveRegionPreference('ca');
            if (PAIRS_US_TO_CA[currentFile]) {
                window.location.replace(withContext(PAIRS_US_TO_CA[currentFile]));
            }
            return;
        }
    } catch (e) {}

    // 4. Asynchronous GeoIP lookup fallback for IP-based verification on primary pages
    if (PAIRS_US_TO_CA[currentFile]) {
        fetch('https://api.country.is/', { cache: 'no-cache' })
            .then(res => res.json())
            .then(data => {
                if (data && data.country === 'CA') {
                    saveRegionPreference('ca');
                    window.location.replace(withContext(PAIRS_US_TO_CA[currentFile]));
                } else if (data && data.country) {
                    saveRegionPreference('us');
                }
            })
            .catch(() => {
                // Secondary fallback
                fetch('https://ipapi.co/json/')
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.country_code === 'CA') {
                            saveRegionPreference('ca');
                            window.location.replace(withContext(PAIRS_US_TO_CA[currentFile]));
                        }
                    })
                    .catch(() => {});
            });
    }
})();
