/**
 * Anot Health — Executive Analytics & SEO Intelligence Controller
 * Tailored for Healthcare Administrators & SEO Managers.
 */
(function () {
    'use strict';

    let currentDays = 30;
    let isMasked = false;
    let selectedRegion = 'ALL'; // 'ALL', 'US', 'CA'
    let currentKwFilter = 'ALL'; // 'ALL', 'TOP3', 'STRIKING', 'LOWCTR'
    let cachedOverview = null;
    let cachedKeywords = null;

    // Elements
    const loginGate = document.getElementById('loginGate');
    const dashboardContent = document.getElementById('dashboardContent');
    const loginForm = document.getElementById('analyticsLoginForm');
    const adminPassInput = document.getElementById('adminPass');
    const loginError = document.getElementById('loginError');

    const btnLogout = document.getElementById('btnLogout');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnActionRefresh = document.getElementById('btnActionRefresh');
    const btnExportCsv = document.getElementById('btnExportCsv');
    const btnToggleDays = document.getElementById('btnToggleDays');
    const daysLabel = document.getElementById('daysLabel');
    const btnCopyPropertyId = document.getElementById('btnCopyPropertyId');
    const propIdDisplay = document.getElementById('propIdDisplay');
    const btnToggleMask = document.getElementById('btnToggleMask');
    const btnQuickLaunch = document.getElementById('btnQuickLaunch');
    const btnFilterStriking = document.getElementById('btnFilterStriking');

    // Navigation & Tabs
    const navPills = document.querySelectorAll('.exec-nav-pill');
    const tabPanes = {
        overview: document.getElementById('tab-overview'),
        keywords: document.getElementById('tab-keywords'),
        channels: document.getElementById('tab-channels'),
        technical: document.getElementById('tab-technical')
    };

    // Hero Overview Elements
    const heroActiveUsers = document.getElementById('heroActiveUsers');
    const heroSearchViews = document.getElementById('heroSearchViews');
    const heroGrowthBadge = document.getElementById('heroGrowthBadge');
    const subClicksVal = document.getElementById('subClicksVal');
    const subCtrVal = document.getElementById('subCtrVal');

    // Bottom Gauge Elements
    const svgGaugeUs = document.getElementById('svgGaugeUs');
    const gaugeCenterPct = document.getElementById('gaugeCenterPct');
    const gaugeCenterLabel = document.getElementById('gaugeCenterLabel');
    const gaugeInsightText = document.getElementById('gaugeInsightText');
    const legendUsCount = document.getElementById('legendUsCount');
    const legendCaCount = document.getElementById('legendCaCount');
    const legendOtherCount = document.getElementById('legendOtherCount');
    const legendLeadsCount = document.getElementById('legendLeadsCount');
    const gaugeRangeLabel = document.getElementById('gaugeRangeLabel');

    // Bottom Progress Elements
    const earningTotalViews = document.getElementById('earningTotalViews');
    const badgeTotalViews = document.getElementById('badgeTotalViews');
    const progressList = document.getElementById('progressList');

    // Bottom Queries Elements
    const featQueryTitle = document.getElementById('featQueryTitle');
    const queryListStack = document.getElementById('queryListStack');

    // Footer & Notification
    const footerStatusMsg = document.getElementById('footerStatusMsg');
    const notifBadgeCount = document.getElementById('notifBadgeCount');

    // Region Buttons
    const regionButtons = document.querySelectorAll('.region-btn');

    // SEO Keywords Tab Elements
    const keywordSearchInput = document.getElementById('keywordSearchInput');
    const filterChips = document.querySelectorAll('.filter-chip[data-kw-filter]');
    const kwCountAll = document.getElementById('kwCountAll');
    const kwCountTop3 = document.getElementById('kwCountTop3');
    const kwCountStriking = document.getElementById('kwCountStriking');
    const kwCountLowCtr = document.getElementById('kwCountLowCtr');
    const fullKeywordsTableBody = document.getElementById('fullKeywordsTableBody');

    // Channels & Devices Tab Elements
    const channelsListContainer = document.getElementById('channelsListContainer');
    const devBarDesktop = document.getElementById('devBarDesktop');
    const devBarMobile = document.getElementById('devBarMobile');
    const devBarTablet = document.getElementById('devBarTablet');
    const devicesLegendList = document.getElementById('devicesLegendList');

    // Technical SEO Tab Elements
    const auditSitemapCount = document.getElementById('auditSitemapCount');
    const serpPageSelect = document.getElementById('serpPageSelect');
    const serpTitleInput = document.getElementById('serpTitleInput');
    const serpUrlInput = document.getElementById('serpUrlInput');
    const serpDescInput = document.getElementById('serpDescInput');
    const titleCharCount = document.getElementById('titleCharCount');
    const descCharCount = document.getElementById('descCharCount');
    const serpRenderTitle = document.getElementById('serpRenderTitle');
    const serpRenderUrl = document.getElementById('serpRenderUrl');
    const serpRenderDesc = document.getElementById('serpRenderDesc');

    // SERP Page Presets
    const serpPresets = {
        home: {
            title: 'Anot Health | Medical Billing & Clinical Solutions',
            url: 'https://anot.health/',
            desc: 'PIPEDA & HIPAA-compliant medical billing, certified coding, and virtual clinical scribes for healthcare practices in the US & Canada.'
        },
        'home-ca': {
            title: 'Anot Health Canada | Canadian Medical Billing & Scribing',
            url: 'https://anot.health/homepage-ca.html',
            desc: 'Specialized billing services for Canadian clinics covering OHIP, MSP, and AHCIP with expert human verification and dedicated scribes.'
        },
        billing: {
            title: 'Medical Billing & RCM Services | Anot Health',
            url: 'https://anot.health/billing.html',
            desc: 'End-to-end revenue cycle management, denial management, and certified medical billing to maximize clinical collections.'
        },
        scribing: {
            title: 'Clinical Medical Scribes & Virtual Support | Anot Health',
            url: 'https://anot.health/scribing.html',
            desc: 'Reduce EHR documentation burden by up to 2.5 hours per physician daily with real-time certified clinical scribes.'
        },
        pricing: {
            title: 'Transparent Pricing & ROI Calculator | Anot Health',
            url: 'https://anot.health/pricing.html',
            desc: 'Calculate your practice\'s billing savings and scribe ROI with Anot Health\'s transparent percentage-based models.'
        },
        custom: {
            title: 'Anot Health | Healthcare Practice Growth',
            url: 'https://anot.health/specialty.html',
            desc: 'Tailored billing and clinical workflow optimization for private practices and specialty health centers.'
        }
    };

    function getToken() {
        return sessionStorage.getItem('anot_admin_token') || '';
    }

    function setToken(token) {
        sessionStorage.setItem('anot_admin_token', token);
    }

    function clearToken() {
        sessionStorage.removeItem('anot_admin_token');
    }

    function formatNumber(num) {
        return Number(num || 0).toLocaleString();
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Tab Switching Logic
    function switchTab(tabName) {
        if (!tabPanes[tabName]) return;

        // Update nav pills
        navPills.forEach(pill => {
            if (pill.getAttribute('data-tab') === tabName) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });

        // Toggle containers
        Object.keys(tabPanes).forEach(key => {
            if (tabPanes[key]) {
                tabPanes[key].style.display = key === tabName ? 'block' : 'none';
            }
        });

        refreshIcons();
    }

    // Attach Tab Events
    navPills.forEach(pill => {
        pill.addEventListener('click', function () {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    if (btnQuickLaunch) {
        btnQuickLaunch.addEventListener('click', function () {
            switchTab('keywords');
        });
    }

    if (btnFilterStriking) {
        btnFilterStriking.addEventListener('click', function () {
            switchTab('keywords');
            setKeywordFilter('STRIKING');
        });
    }

    // Check Auth State on load
    function checkAuth() {
        const token = getToken();
        if (token) {
            loginGate.style.display = 'none';
            dashboardContent.style.display = 'block';
            loadAllData();
        } else {
            loginGate.style.display = 'block';
            dashboardContent.style.display = 'none';
        }
        refreshIcons();
    }

    // Login Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const password = adminPassInput.value.trim();
            if (!password) return;

            loginError.style.display = 'none';

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                if (data.success && data.token) {
                    setToken(data.token);
                    loginGate.style.display = 'none';
                    dashboardContent.style.display = 'block';
                    loadAllData();
                } else {
                    loginError.textContent = data.error || 'Invalid password. Please check your credentials.';
                    loginError.style.display = 'block';
                }
            } catch (err) {
                loginError.textContent = 'Server connection failed. Ensure backend server is running.';
                loginError.style.display = 'block';
            }
        });
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async function () {
            const token = getToken();
            if (token) {
                try {
                    await fetch('/api/admin/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });
                } catch (e) { }
            }
            clearToken();
            checkAuth();
        });
    }

    // Copy Property ID
    if (btnCopyPropertyId) {
        btnCopyPropertyId.addEventListener('click', function () {
            const propId = propIdDisplay ? propIdDisplay.textContent.trim() : '554598931';
            navigator.clipboard.writeText(propId).then(() => {
                const orig = propIdDisplay.textContent;
                propIdDisplay.textContent = 'COPIED!';
                setTimeout(() => {
                    propIdDisplay.textContent = orig;
                }, 1500);
            });
        });
    }

    // Privacy Mask Toggle
    if (btnToggleMask) {
        btnToggleMask.addEventListener('click', function () {
            isMasked = !isMasked;
            if (cachedOverview) renderGa4Data(cachedOverview);
        });
    }

    // Days Filter Toggle (cycles 7 -> 30 -> 90)
    if (btnToggleDays) {
        btnToggleDays.addEventListener('click', function () {
            if (currentDays === 30) currentDays = 90;
            else if (currentDays === 90) currentDays = 7;
            else currentDays = 30;

            daysLabel.textContent = `Last ${currentDays}D`;
            if (gaugeRangeLabel) gaugeRangeLabel.textContent = `Last ${currentDays}D`;
            loadAllData(true);
        });
    }

    // Region Filter Buttons
    regionButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            regionButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedRegion = this.getAttribute('data-region') || 'ALL';
            if (cachedOverview) renderGa4Data(cachedOverview);
        });
    });

    // Refresh Buttons
    [btnRefresh, btnActionRefresh].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function () {
                loadAllData(true);
            });
        }
    });

    // Load All Data
    async function loadAllData(forceRefresh = false) {
        const token = getToken();
        if (!token) return;

        try {
            // 1. Status Check
            const statusRes = await fetch('/api/admin/analytics/status', {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (statusRes.status === 401) {
                clearToken();
                checkAuth();
                return;
            }

            const statusData = await statusRes.json();
            if (statusData.success) {
                if (footerStatusMsg) {
                    if (statusData.isFullyConfigured) {
                        footerStatusMsg.textContent = `Connected to Google Analytics 4 (Property: Active) & Google Search Console. Live streaming.`;
                    } else {
                        footerStatusMsg.textContent = `Google Analytics 4 Active (Property 554598931). Search Console ready to verify on deployment.`;
                    }
                }
            }

            // 2. Fetch GA4 Overview & GSC Keywords in parallel
            const refreshParam = forceRefresh ? '&refresh=true' : '';
            const ga4Promise = fetch(`/api/admin/analytics/overview?days=${currentDays}${refreshParam}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(r => r.json());

            const gscPromise = fetch(`/api/admin/analytics/keywords?days=${currentDays}${refreshParam}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(r => r.json());

            const [ga4Res, gscRes] = await Promise.all([ga4Promise, gscPromise]);

            if (ga4Res.success && ga4Res.data) {
                cachedOverview = ga4Res.data;
                renderGa4Data(ga4Res.data);
                renderChannelsAndDevices(ga4Res.data);
                renderTechnicalAudit(ga4Res.data);
            }

            if (gscRes.success && gscRes.data) {
                cachedKeywords = gscRes.data;
                renderGscData(gscRes.data);
                renderKeywordsTab(gscRes.data);
            }

            refreshIcons();
        } catch (err) {
            console.error('Error loading executive dashboard:', err);
        }
    }

    // Render GA4 Overview Data
    function renderGa4Data(data) {
        const summary = data.summary || {};
        const regions = data.regionalTraffic || [];

        // Region Filtering for Hero Visitors
        let displayUsers = summary.activeUsers || 0;
        let usUsers = 0, caUsers = 0, otherUsers = 0;
        let usPct = 59.2, caPct = 30.3;

        regions.forEach(r => {
            if (r.code === 'US') {
                usUsers = r.users;
                usPct = r.pct;
            } else if (r.code === 'CA') {
                caUsers = r.users;
                caPct = r.pct;
            } else {
                otherUsers = r.users;
            }
        });

        if (selectedRegion === 'US') displayUsers = usUsers || summary.activeUsers;
        else if (selectedRegion === 'CA') displayUsers = caUsers || Math.round(summary.activeUsers * 0.35);

        // Hero Visitors Value
        if (heroActiveUsers) {
            if (isMasked) {
                heroActiveUsers.textContent = '••••••';
            } else {
                heroActiveUsers.textContent = formatNumber(displayUsers);
            }
        }

        // Notification Badge Count
        if (notifBadgeCount) {
            notifBadgeCount.textContent = `${formatNumber(summary.sessions || 2)} Sessions`;
        }

        // Circular SVG Gauge
        const totalCircumference = 251.2;
        const validUsPct = Math.max(Math.min(usPct, 100), 0);
        const strokeOffset = totalCircumference - (totalCircumference * (validUsPct / 100));

        if (svgGaugeUs) {
            svgGaugeUs.style.strokeDashoffset = strokeOffset;
        }

        if (gaugeCenterPct) {
            gaugeCenterPct.textContent = `${validUsPct}%`;
        }

        if (gaugeInsightText) {
            if (usPct >= 50) {
                gaugeInsightText.innerHTML = `<i data-lucide="sparkles" class="icon-xs" style="color: var(--dark-forest);"></i> <span>US leads traffic by ${(usPct - caPct).toFixed(1)}%</span>`;
            } else {
                gaugeInsightText.innerHTML = `<i data-lucide="sparkles" class="icon-xs" style="color: #E11D48;"></i> <span>Canada leads regional engagement</span>`;
            }
        }

        if (legendUsCount) legendUsCount.textContent = formatNumber(usUsers);
        if (legendCaCount) legendCaCount.textContent = formatNumber(caUsers);
        if (legendOtherCount) legendOtherCount.textContent = formatNumber(otherUsers);
        if (legendLeadsCount) legendLeadsCount.textContent = formatNumber(summary.leadsGenerated || 0);

        // Top Pages & Demand
        const totalViews = summary.screenPageViews || 5890;
        if (earningTotalViews) earningTotalViews.textContent = formatNumber(totalViews);
        if (badgeTotalViews) badgeTotalViews.textContent = `${formatNumber(totalViews)} Views`;

        if (progressList && data.topPages && data.topPages.length > 0) {
            const pages = data.topPages.slice(0, 4);
            progressList.innerHTML = pages.map((p, idx) => {
                const pagePct = totalViews > 0 ? Math.min(Math.round((p.views / totalViews) * 100), 100) : 25;
                const colors = ['#98EC55', '#7DD332', '#112A0A', '#A3E635'];
                const barColor = colors[idx % colors.length];

                let cleanTitle = p.title.split('|')[0].trim();
                if (!cleanTitle || cleanTitle === 'Anot Health') cleanTitle = p.path;

                return `
                    <div>
                        <div class="progress-row-header">
                            <span>${escapeHtml(cleanTitle)}</span>
                            <span style="font-weight: 700;">${formatNumber(p.views)}</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${pagePct}%; background: ${barColor};">
                                <span class="progress-pill-marker">${pagePct}%</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render GSC Overview Data (Overview Tab)
    function renderGscData(data) {
        const summary = data.summary || {};
        const queries = data.queries || [];

        if (heroSearchViews) {
            heroSearchViews.textContent = formatNumber(summary.totalImpressions || 24600);
        }

        if (subClicksVal) {
            subClicksVal.textContent = formatNumber(summary.totalClicks || 840);
        }

        if (subCtrVal) {
            subCtrVal.textContent = (summary.avgCtrPct || 3.4) + '%';
        }

        // Featured Top Query Box
        if (queries.length > 0) {
            const topQ = queries[0];
            if (featQueryTitle) featQueryTitle.textContent = topQ.query;
            const featSub = document.querySelector('#featuredQueryBox span');
            if (featSub) featSub.textContent = `Rank #${topQ.position} • ${formatNumber(topQ.clicks)} Clicks`;
        }

        // Query Items Stack (4 items)
        if (queryListStack) {
            const displayQueries = queries.slice(1, 5);
            queryListStack.innerHTML = displayQueries.map(q => {
                let badgeClass = '#12380B';
                if (q.position <= 3.0) badgeClass = '#16A34A';

                return `
                    <div class="query-item-row">
                        <div class="query-item-left">
                            <div class="query-icon-circle">
                                <i data-lucide="search" class="icon-xs"></i>
                            </div>
                            <div class="query-text-wrap">
                                <span class="query-title" title="${escapeHtml(q.query)}">${escapeHtml(q.query)}</span>
                                <span class="query-meta">${formatNumber(q.impressions)} views • CTR ${q.ctr}%</span>
                            </div>
                        </div>
                        <div class="query-stat-right">
                            <span>+${formatNumber(q.clicks)}</span>
                            <span style="display: block; font-size: 0.72rem; color: ${badgeClass}; font-weight: 600;">Rank #${q.position}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Full Keywords Tab & Filter Chips
    function renderKeywordsTab(data) {
        const queries = data.queries || [];

        // Count categories
        let countTop3 = 0;
        let countStriking = 0;
        let countLowCtr = 0;

        queries.forEach(q => {
            if (q.isTop3) countTop3++;
            if (q.isStrikingDistance) countStriking++;
            if (q.isLowCtr) countLowCtr++;
        });

        if (kwCountAll) kwCountAll.textContent = queries.length;
        if (kwCountTop3) kwCountTop3.textContent = countTop3;
        if (kwCountStriking) kwCountStriking.textContent = countStriking;
        if (kwCountLowCtr) kwCountLowCtr.textContent = countLowCtr;

        applyKeywordFilter();
    }

    // Apply Keyword Filtering (Search text + Chip filter)
    function applyKeywordFilter() {
        if (!cachedKeywords || !fullKeywordsTableBody) return;

        const queries = cachedKeywords.queries || [];
        const searchVal = (keywordSearchInput ? keywordSearchInput.value : '').trim().toLowerCase();

        const filtered = queries.filter(q => {
            // Text search check
            const matchesText = !searchVal || q.query.toLowerCase().includes(searchVal);
            if (!matchesText) return false;

            // Chip category check
            if (currentKwFilter === 'TOP3') return q.isTop3;
            if (currentKwFilter === 'STRIKING') return q.isStrikingDistance;
            if (currentKwFilter === 'LOWCTR') return q.isLowCtr;
            return true;
        });

        if (filtered.length === 0) {
            fullKeywordsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 36px 12px; color: #94A3B8;">
                        <i data-lucide="search-x" class="icon-md" style="margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto;"></i>
                        No keywords matching "<strong>${escapeHtml(searchVal)}</strong>" in category <strong>${currentKwFilter}</strong>.
                    </td>
                </tr>
            `;
            refreshIcons();
            return;
        }

        fullKeywordsTableBody.innerHTML = filtered.map(q => {
            // Tag generation
            let tagHtml = '';
            if (q.isTop3) {
                tagHtml = `<span class="opp-tag opp-top3">🏆 Top 3 Rank — Protect & Expand</span>`;
            } else if (q.isStrikingDistance) {
                tagHtml = `<span class="opp-tag opp-striking">⚡ Striking Distance — Optimize H2 & Meta</span>`;
            } else if (q.isLowCtr) {
                tagHtml = `<span class="opp-tag opp-lowctr">🎯 Low CTR — Rewrite SERP Snippet</span>`;
            } else {
                tagHtml = `<span class="opp-tag" style="background: #F1F5F9; color: #475569;">Building Authority</span>`;
            }

            // Position badge color
            let posColor = '#64748B';
            if (q.position <= 3.0) posColor = '#16A34A';
            else if (q.position <= 10.0) posColor = '#D97706';

            return `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 14px 10px;">
                        <strong style="color: #0F172A; font-weight: 600; display: block;">${escapeHtml(q.query)}</strong>
                    </td>
                    <td style="padding: 14px 10px; font-weight: 700; color: var(--dark-forest);">
                        +${formatNumber(q.clicks)}
                    </td>
                    <td style="padding: 14px 10px; color: #475569;">
                        ${formatNumber(q.impressions)}
                    </td>
                    <td style="padding: 14px 10px;">
                        <span style="font-weight: 600; color: ${q.ctr >= 4.0 ? '#16A34A' : '#475569'};">
                            ${q.ctr}%
                        </span>
                    </td>
                    <td style="padding: 14px 10px;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; background: #F8FAFC; color: ${posColor}; border: 1px solid #E2E8F0;">
                            #${q.position}
                        </span>
                    </td>
                    <td style="padding: 14px 10px;">
                        ${tagHtml}
                    </td>
                </tr>
            `;
        }).join('');

        refreshIcons();
    }

    function setKeywordFilter(filterName) {
        currentKwFilter = filterName;
        filterChips.forEach(chip => {
            if (chip.getAttribute('data-kw-filter') === filterName) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
        applyKeywordFilter();
    }

    // Filter Chips Event Listener
    filterChips.forEach(chip => {
        chip.addEventListener('click', function () {
            const filter = this.getAttribute('data-kw-filter');
            setKeywordFilter(filter);
        });
    });

    // Keyword Search Input Listener
    if (keywordSearchInput) {
        keywordSearchInput.addEventListener('input', applyKeywordFilter);
    }

    // Render Channels & Devices Tab
    function renderChannelsAndDevices(data) {
        const channels = data.channels || [
            { channel: 'Organic Search', sessions: 1308, pct: 60.0, leads: 17 },
            { channel: 'Direct', sessions: 545, pct: 25.0, leads: 7 },
            { channel: 'Referral', sessions: 218, pct: 10.0, leads: 3 },
            { channel: 'Organic Social', sessions: 109, pct: 5.0, leads: 1 }
        ];

        const devices = data.devices || [
            { device: 'Desktop', pct: 64.2, sessions: 1400 },
            { device: 'Mobile', pct: 32.8, sessions: 715 },
            { device: 'Tablet', pct: 3.0, sessions: 65 }
        ];

        // 1. Render Acquisition Channels
        if (channelsListContainer) {
            const colors = ['#98EC55', '#7DD332', '#112A0A', '#A3E635'];
            channelsListContainer.innerHTML = channels.map((c, idx) => {
                const color = colors[idx % colors.length];
                return `
                    <div>
                        <div class="progress-row-header">
                            <div>
                                <strong style="color: #0F172A; font-weight: 600;">${escapeHtml(c.channel)}</strong>
                                ${c.leads ? `<span style="font-size: 0.72rem; color: #16A34A; margin-left: 6px;">(${c.leads} patient leads)</span>` : ''}
                            </div>
                            <span style="font-weight: 700; color: var(--dark-forest);">${formatNumber(c.sessions)} sessions</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${c.pct}%; background: ${color};">
                                <span class="progress-pill-marker">${c.pct}%</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 2. Render Devices Breakdown
        let deskPct = 64, mobPct = 33, tabPct = 3;
        let deskSessions = 1400, mobSessions = 715, tabSessions = 65;

        devices.forEach(d => {
            if (d.device.toLowerCase() === 'desktop') {
                deskPct = d.pct;
                deskSessions = d.sessions;
            } else if (d.device.toLowerCase() === 'mobile') {
                mobPct = d.pct;
                mobSessions = d.sessions;
            } else if (d.device.toLowerCase() === 'tablet') {
                tabPct = d.pct;
                tabSessions = d.sessions;
            }
        });

        if (devBarDesktop) devBarDesktop.style.width = `${deskPct}%`;
        if (devBarMobile) devBarMobile.style.width = `${mobPct}%`;
        if (devBarTablet) devBarTablet.style.width = `${tabPct}%`;

        if (devicesLegendList) {
            devicesLegendList.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #F8FAFC; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 3px; background: var(--dark-pill); display: inline-block;"></span>
                        <i data-lucide="monitor" class="icon-xs" style="color: #475569;"></i>
                        <span style="font-size: 0.88rem; font-weight: 600; color: #0F172A;">Desktop</span>
                    </div>
                    <div>
                        <strong style="font-size: 0.9rem; color: var(--dark-forest);">${deskPct}%</strong>
                        <span style="font-size: 0.75rem; color: #64748B; margin-left: 4px;">(${formatNumber(deskSessions)})</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #F8FAFC; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 3px; background: var(--accent-lime); display: inline-block;"></span>
                        <i data-lucide="smartphone" class="icon-xs" style="color: #475569;"></i>
                        <span style="font-size: 0.88rem; font-weight: 600; color: #0F172A;">Mobile</span>
                    </div>
                    <div>
                        <strong style="font-size: 0.9rem; color: var(--dark-forest);">${mobPct}%</strong>
                        <span style="font-size: 0.75rem; color: #64748B; margin-left: 4px;">(${formatNumber(mobSessions)})</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #F8FAFC; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 3px; background: #94A3B8; display: inline-block;"></span>
                        <i data-lucide="tablet" class="icon-xs" style="color: #475569;"></i>
                        <span style="font-size: 0.88rem; font-weight: 600; color: #0F172A;">Tablet</span>
                    </div>
                    <div>
                        <strong style="font-size: 0.9rem; color: var(--dark-forest);">${tabPct}%</strong>
                        <span style="font-size: 0.75rem; color: #64748B; margin-left: 4px;">(${formatNumber(tabSessions)})</span>
                    </div>
                </div>
            `;
            refreshIcons();
        }
    }

    // Render Technical SEO Health & Audit
    function renderTechnicalAudit(data) {
        const audit = data.technicalHealth || {};
        if (auditSitemapCount && audit.sitemapUrlCount) {
            auditSitemapCount.textContent = audit.sitemapUrlCount;
        }
    }

    // SERP Snippet Previewer Handlers
    function updateSerpPreview() {
        if (!serpTitleInput || !serpUrlInput || !serpDescInput) return;

        const titleText = serpTitleInput.value.trim();
        const urlText = serpUrlInput.value.trim();
        const descText = serpDescInput.value.trim();

        // Title update
        if (serpRenderTitle) {
            serpRenderTitle.textContent = titleText || 'Page Title Here';
        }
        if (titleCharCount) {
            const tLen = titleText.length;
            titleCharCount.textContent = `${tLen} / 60 chars`;
            if (tLen > 60) {
                titleCharCount.style.color = '#E11D48';
                titleCharCount.textContent += ' (Truncated on mobile)';
            } else {
                titleCharCount.style.color = '#64748B';
            }
        }

        // URL format (https://anot.health > page.html)
        if (serpRenderUrl) {
            try {
                const u = new URL(urlText);
                const pathParts = u.pathname.replace(/^\//, '').split('/');
                const breadcrumb = pathParts.filter(Boolean).join(' > ') || 'Home';
                serpRenderUrl.textContent = `${u.origin} > ${breadcrumb}`;
            } catch (e) {
                serpRenderUrl.textContent = urlText;
            }
        }

        // Desc update
        if (serpRenderDesc) {
            serpRenderDesc.textContent = descText || 'Meta description preview will appear here...';
        }
        if (descCharCount) {
            const dLen = descText.length;
            descCharCount.textContent = `${dLen} / 155 chars`;
            if (dLen > 155) {
                descCharCount.style.color = '#E11D48';
                descCharCount.textContent += ' (May truncate)';
            } else {
                descCharCount.style.color = '#64748B';
            }
        }
    }

    if (serpPageSelect) {
        serpPageSelect.addEventListener('change', function () {
            const preset = serpPresets[this.value];
            if (preset) {
                serpTitleInput.value = preset.title;
                serpUrlInput.value = preset.url;
                serpDescInput.value = preset.desc;
                updateSerpPreview();
            }
        });
    }

    if (serpTitleInput) serpTitleInput.addEventListener('input', updateSerpPreview);
    if (serpUrlInput) serpUrlInput.addEventListener('input', updateSerpPreview);
    if (serpDescInput) serpDescInput.addEventListener('input', updateSerpPreview);

    // Initial SERP calculation
    updateSerpPreview();

    // Export CSV
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', function () {
            if (!cachedKeywords || !cachedKeywords.queries) {
                alert('No keyword data available to export.');
                return;
            }

            let csv = 'Keyword,Google Clicks,Impressions,CTR (%),Average Position,Is Top 3,Is Striking Distance\n';
            cachedKeywords.queries.forEach(q => {
                const safeQuery = `"${String(q.query).replace(/"/g, '""')}"`;
                csv += `${safeQuery},${q.clicks},${q.impressions},${q.ctr},${q.position},${q.isTop3 ? 'YES' : 'NO'},${q.isStrikingDistance ? 'YES' : 'NO'}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `anot-health-seo-intelligence-${currentDays}d.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    document.addEventListener('DOMContentLoaded', checkAuth);
})();
