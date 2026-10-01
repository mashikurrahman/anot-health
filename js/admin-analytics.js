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
    const serpSaveBtn = document.getElementById('serpSaveBtn');
    const serpResetBtn = document.getElementById('serpResetBtn');
    const serpSaveStatus = document.getElementById('serpSaveStatus');

    // SERP page templates: each one is that page's LIVE <title>, canonical URL and meta description,
    // read from the page itself. billing and scribing have no meta description yet, so their
    // social-share (og:description) text stands in for it.
    const serpPresets = {
        home: {
            title: 'Anot Health | Clean & Human-Centered Healthcare Operations',
            url: 'https://anot.health/',
            desc: 'Streamlined clinical documentation, medical coding, revenue cycle, and payroll support for healthcare teams. Clean, human-led operations with advanced AI assistance.'
        },
        'home-ca': {
            title: 'Anot Health | Human-Verified Clinical Operations for Medical Practices',
            url: 'https://anot.health/homepage-ca.html',
            desc: 'Streamlined clinical documentation, Accuro & Telus EMR workflows, provincial billing (OHIP, MSP, AHCIP), and in-country cloud data residency for healthcare teams.'
        },
        billing: {
            title: 'Revenue Cycle Management | Anot Health',
            url: 'https://anot.health/billing.html',
            desc: 'AI-assisted billing workflows with trained review to help practices submit cleaner claims and protect revenue.'
        },
        scribing: {
            title: 'Clinical Documentation | Anot Health',
            url: 'https://anot.health/scribing.html',
            desc: 'Expert-led clinical documentation powered by advanced AI and validated by experienced specialists before every note is delivered.'
        },
        pricing: {
            title: 'Pricing | Anot Health \u2014 From $199 per provider',
            url: 'https://anot.health/pricing.html',
            desc: 'AI Scribe at $199 per provider per month, Verified Scribe with certified human review at $899, or a custom scope covering billing, coding and payroll.'
        },
        specialties: {
            title: 'Medical Specialties | Anot Health',
            url: 'https://anot.health/specialties.html',
            desc: 'Expert-led clinical support across 50+ medical specialties, using advanced AI helpers for primary care to surgical subspecialties.'
        }
    };

    // Saved SERP snippets. The server keeps whatever the admin edited and saved for each template;
    // a template with no saved version shows the live page text from serpPresets above.
    let savedSnippets = {};   // template key -> { title, url, desc, savedAt }
    let serpActiveKey = serpPageSelect ? serpPageSelect.value : 'home';
    let serpBaseline = null;  // the fields as last loaded or saved, to spot unsaved edits
    let serpSaving = false;
    let serpNotice = null;    // { text, state } shown in place of the normal status, e.g. an error

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

    // Show / Hide Password Toggles for all eye buttons
    document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            const icon = this.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                refreshIcons();
            }
        });
    });

    // Change / Reset Password Modal Controls
    const changePassModal = document.getElementById('changePassModal');
    const btnOpenChangePass = document.getElementById('btnOpenChangePass');
    const btnHeaderChangePass = document.getElementById('btnHeaderChangePass');
    const btnCloseChangePass = document.getElementById('btnCloseChangePass');
    const tabModeDirect = document.getElementById('tabModeDirect');
    const tabModeReset = document.getElementById('tabModeReset');
    const formDirectChange = document.getElementById('formDirectChange');
    const formResetViaEmail = document.getElementById('formResetViaEmail');
    const changePassFeedback = document.getElementById('changePassFeedback');
    const currPassNote = document.getElementById('currPassNote');

    function openChangePassModal() {
        if (!changePassModal) return;
        changePassModal.style.display = 'flex';
        if (changePassFeedback) changePassFeedback.style.display = 'none';

        const token = getToken();
        if (token && currPassNote) {
            currPassNote.textContent = '(already verified by login session)';
        } else if (currPassNote) {
            currPassNote.textContent = '(or fallback during migration)';
        }
        refreshIcons();
    }

    function closeChangePassModal() {
        if (!changePassModal) return;
        changePassModal.style.display = 'none';
    }

    if (btnOpenChangePass) btnOpenChangePass.addEventListener('click', openChangePassModal);
    if (btnHeaderChangePass) btnHeaderChangePass.addEventListener('click', openChangePassModal);
    if (btnCloseChangePass) btnCloseChangePass.addEventListener('click', closeChangePassModal);

    if (changePassModal) {
        changePassModal.addEventListener('click', function(e) {
            if (e.target === changePassModal) closeChangePassModal();
        });
    }

    if (tabModeDirect && tabModeReset) {
        tabModeDirect.addEventListener('click', () => {
            tabModeDirect.classList.add('active');
            tabModeDirect.style.background = '#ffffff';
            tabModeDirect.style.color = '#0F172A';
            tabModeDirect.style.fontWeight = '600';
            tabModeDirect.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';

            tabModeReset.classList.remove('active');
            tabModeReset.style.background = 'transparent';
            tabModeReset.style.color = '#64748B';
            tabModeReset.style.fontWeight = '500';
            tabModeReset.style.boxShadow = 'none';

            if (formDirectChange) formDirectChange.style.display = 'block';
            if (formResetViaEmail) formResetViaEmail.style.display = 'none';
            if (changePassFeedback) changePassFeedback.style.display = 'none';
            refreshIcons();
        });

        tabModeReset.addEventListener('click', () => {
            tabModeReset.classList.add('active');
            tabModeReset.style.background = '#ffffff';
            tabModeReset.style.color = '#0F172A';
            tabModeReset.style.fontWeight = '600';
            tabModeReset.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';

            tabModeDirect.classList.remove('active');
            tabModeDirect.style.background = 'transparent';
            tabModeDirect.style.color = '#64748B';
            tabModeDirect.style.fontWeight = '500';
            tabModeDirect.style.boxShadow = 'none';

            if (formDirectChange) formDirectChange.style.display = 'none';
            if (formResetViaEmail) formResetViaEmail.style.display = 'block';
            if (changePassFeedback) changePassFeedback.style.display = 'none';
            refreshIcons();
        });
    }

    function showPassFeedback(msg, isError) {
        if (!changePassFeedback) return;
        changePassFeedback.textContent = msg;
        changePassFeedback.style.color = isError ? '#BE123C' : '#047857';
        changePassFeedback.style.background = isError ? '#FFF1F2' : '#ECFDF5';
        changePassFeedback.style.padding = '12px 14px';
        changePassFeedback.style.borderRadius = '12px';
        changePassFeedback.style.border = isError ? '1px solid #FECDD3' : '1px solid #A7F3D0';
        changePassFeedback.style.display = 'block';
    }

    if (formDirectChange) {
        formDirectChange.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currPass = (document.getElementById('currPassInput')?.value || '').trim();
            const newPass = (document.getElementById('newPassInput')?.value || '').trim();
            const confirmPass = (document.getElementById('confirmPassInput')?.value || '').trim();

            if (changePassFeedback) changePassFeedback.style.display = 'none';

            if (!newPass || newPass.length < 8) {
                showPassFeedback('New password must be at least 8 characters long.', true);
                return;
            }
            if (newPass !== confirmPass) {
                showPassFeedback('New passwords do not match. Please verify.', true);
                return;
            }

            const token = getToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const submitBtn = document.getElementById('btnSubmitChangePass');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i data-lucide="loader-2" class="icon-xs spin"></i> Updating...'; refreshIcons(); }

            try {
                const res = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ currentPassword: currPass, newPassword: newPass })
                });
                const data = await res.json();
                if (data.success) {
                    showPassFeedback('Password changed successfully! Logging in...', false);
                    if (data.token) setToken(data.token);
                    setTimeout(() => {
                        closeChangePassModal();
                        loginGate.style.display = 'none';
                        dashboardContent.style.display = 'block';
                        loadAllData();
                    }, 1200);
                } else {
                    showPassFeedback(data.error || 'Failed to update password. Please check your current password.', true);
                }
            } catch (err) {
                showPassFeedback('Connection error while updating password. Verify server is online.', true);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="check" class="icon-xs"></i> Update Password'; refreshIcons(); }
            }
        });
    }

    const btnSendResetCode = document.getElementById('btnSendResetCode');
    const codeSentNotice = document.getElementById('codeSentNotice');
    if (btnSendResetCode) {
        btnSendResetCode.addEventListener('click', async () => {
            btnSendResetCode.disabled = true;
            btnSendResetCode.innerHTML = '<i data-lucide="loader-2" class="icon-xs spin"></i> Sending code...';
            refreshIcons();

            try {
                const res = await fetch('/api/admin/request-reset-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (codeSentNotice) {
                    codeSentNotice.textContent = data.message || 'Verification code dispatched to admin email.';
                    codeSentNotice.style.display = 'block';
                }
            } catch (err) {
                if (codeSentNotice) {
                    codeSentNotice.textContent = 'Verification code generated. (Master recovery key can also be used).';
                    codeSentNotice.style.display = 'block';
                }
            } finally {
                btnSendResetCode.disabled = false;
                btnSendResetCode.innerHTML = '<i data-lucide="mail" class="icon-xs"></i> Resend 6-Digit Code';
                refreshIcons();
            }
        });
    }

    if (formResetViaEmail) {
        formResetViaEmail.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = (document.getElementById('resetCodeInput')?.value || '').trim();
            const newPass = (document.getElementById('resetNewPassInput')?.value || '').trim();
            const confirmPass = (document.getElementById('resetConfirmPassInput')?.value || '').trim();

            if (changePassFeedback) changePassFeedback.style.display = 'none';

            if (!code) {
                showPassFeedback('Please enter the 6-digit verification code or master key.', true);
                return;
            }
            if (!newPass || newPass.length < 8) {
                showPassFeedback('New password must be at least 8 characters long.', true);
                return;
            }
            if (newPass !== confirmPass) {
                showPassFeedback('New passwords do not match. Please verify.', true);
                return;
            }

            const submitBtn = document.getElementById('btnSubmitResetPass');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i data-lucide="loader-2" class="icon-xs spin"></i> Resetting...'; refreshIcons(); }

            try {
                const res = await fetch('/api/admin/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, newPassword: newPass })
                });
                const data = await res.json();
                if (data.success) {
                    showPassFeedback('Password reset successfully! Logging you in...', false);
                    if (data.token) setToken(data.token);
                    setTimeout(() => {
                        closeChangePassModal();
                        loginGate.style.display = 'none';
                        dashboardContent.style.display = 'block';
                        loadAllData();
                    }, 1200);
                } else {
                    showPassFeedback(data.error || 'Invalid code or reset failed.', true);
                }
            } catch (err) {
                showPassFeedback('Connection error while resetting password.', true);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="shield-check" class="icon-xs"></i> Reset & Log In'; refreshIcons(); }
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

        loadSavedSnippets();

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
                    footerStatusMsg.textContent = statusData.isFullyConfigured
                        ? 'Configured for Google Analytics 4 and Google Search Console.'
                        : 'Not connected: the server is missing Google credentials or IDs (see backend/.env).';
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
            showSampleDataWarning(ga4Res?.data, gscRes?.data);

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

    // The server substitutes sample numbers when Google isn't connected or a query
    // fails. Say so plainly, so nobody mistakes them for real traffic.
    function describeSampleReason(label, data) {
        if (!data || !data.isMock) return '';
        if (data.error) return `${label}: Google returned an error (${data.error}).`;
        const missing = data.missingDetails || {};
        if (missing.hasCredentialsFile === false) return `${label}: backend/service-account.json is missing.`;
        if (missing.hasPropertyId === false) return `${label}: GA4_PROPERTY_ID is not set.`;
        if (missing.hasSiteUrl === false) return `${label}: GSC_SITE_URL is not set.`;
        return `${label}: not connected.`;
    }

    function showSampleDataWarning(overview, keywords) {
        const banner = document.getElementById('sampleDataBanner');
        const reasonEl = document.getElementById('sampleDataReason');
        if (!banner || !reasonEl) return;
        const reasons = [
            describeSampleReason('Google Analytics', overview),
            describeSampleReason('Search Console', keywords)
        ].filter(Boolean);
        banner.hidden = reasons.length === 0;
        const badge = document.getElementById('connectionBadgeText');
        if (badge) badge.textContent = reasons.length ? 'SAMPLE DATA' : 'GOOGLE CONNECTED';
        reasonEl.textContent = ' ' + reasons.join(' ');
    }

    // Render GA4 Overview Data
    function renderGa4Data(data) {
        const summary = data.summary || {};
        const regions = data.regionalTraffic || [];

        // Region Filtering for Hero Visitors
        let displayUsers = summary.activeUsers || 0;
        let usUsers = 0, caUsers = 0, otherUsers = 0;
        let usPct = 0, caPct = 0, otherPct = 0;

        regions.forEach(r => {
            if (r.code === 'US') {
                usUsers = r.users;
                usPct = r.pct;
            } else if (r.code === 'CA') {
                caUsers = r.users;
                caPct = r.pct;
            } else {
                otherUsers = r.users;
                otherPct = r.pct;
            }
        });

        if (selectedRegion === 'US') displayUsers = usUsers;
        else if (selectedRegion === 'CA') displayUsers = caUsers;

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
            notifBadgeCount.textContent = `${formatNumber(summary.sessions ?? 0)} Sessions`;
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
            // Name whichever region really has the most users; say so when it's a tie.
            const ranked = [
                { label: 'US', pct: usPct },
                { label: 'Canada', pct: caPct },
                { label: 'Other countries', pct: otherPct }
            ].sort((a, b) => b.pct - a.pct);
            let insight;
            if (ranked[0].pct === 0) {
                insight = 'No regional traffic recorded yet';
            } else if (ranked[0].pct === ranked[1].pct) {
                insight = `${ranked[0].label} and ${ranked[1].label} are tied at ${ranked[0].pct}%`;
            } else {
                insight = `${ranked[0].label} ${ranked[0].label === 'Other countries' ? 'lead' : 'leads'} with ${ranked[0].pct}% of users`;
            }
            gaugeInsightText.innerHTML = `<i data-lucide="sparkles" class="icon-xs" style="color: var(--dark-forest);"></i> <span>${escapeHtml(insight)}</span>`;
        }

        if (legendUsCount) legendUsCount.textContent = formatNumber(usUsers);
        if (legendCaCount) legendCaCount.textContent = formatNumber(caUsers);
        if (legendOtherCount) legendOtherCount.textContent = formatNumber(otherUsers);
        if (legendLeadsCount) legendLeadsCount.textContent = formatNumber(summary.leadsGenerated || 0);

        // Top Pages & Demand
        const totalViews = summary.screenPageViews ?? 0;
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
            heroSearchViews.textContent = formatNumber(summary.totalImpressions ?? 0);
        }

        if (subClicksVal) {
            subClicksVal.textContent = formatNumber(summary.totalClicks ?? 0);
        }

        if (subCtrVal) {
            subCtrVal.textContent = (summary.avgCtrPct ?? 0) + '%';
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
        // A device GA4 didn't report had no sessions; show 0 rather than a placeholder.
        let deskPct = 0, mobPct = 0, tabPct = 0;
        let deskSessions = 0, mobSessions = 0, tabSessions = 0;

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
                const breadcrumb = pathParts.filter(Boolean).join(' > ');
                // Google shows just the domain for a homepage, and "domain > page" for inner pages
                serpRenderUrl.textContent = breadcrumb ? `${u.origin} > ${breadcrumb}` : u.origin;
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

        renderSerpStatus();
    }

    // ── Saving edits ──────────────────────────────────────────────────────
    function serpFieldsNow() {
        return {
            title: serpTitleInput.value.trim(),
            url: serpUrlInput.value.trim(),
            desc: serpDescInput.value.trim()
        };
    }

    // True when the fields differ from what was last loaded or saved.
    function serpIsDirty() {
        if (!serpBaseline || !serpTitleInput || !serpUrlInput || !serpDescInput) return false;
        const now = serpFieldsNow();
        return now.title !== serpBaseline.title || now.url !== serpBaseline.url || now.desc !== serpBaseline.desc;
    }

    function serpSavedAtLabel(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    // Keeps the status line and the two buttons in step with the fields.
    function renderSerpStatus() {
        if (!serpSaveStatus || !serpSaveBtn || !serpResetBtn || !serpBaseline) return;
        const dirty = serpIsDirty();
        const saved = savedSnippets[serpActiveKey];
        let text;
        let state = 'idle';
        if (serpSaving) {
            text = 'Saving...';
        } else if (serpNotice) {
            text = serpNotice.text;
            state = serpNotice.state;
        } else if (dirty) {
            text = 'Unsaved changes';
            state = 'dirty';
        } else if (saved) {
            const when = serpSavedAtLabel(saved.savedAt);
            text = when ? `Saved \u2713 ${when}` : 'Saved \u2713';
            state = 'saved';
        } else {
            text = 'Showing the live page text.';
        }
        if (serpSaveStatus.textContent !== text) serpSaveStatus.textContent = text;
        serpSaveStatus.setAttribute('data-state', state);
        serpSaveBtn.disabled = serpSaving || !dirty;
        serpResetBtn.disabled = serpSaving || !(dirty || saved);
        if (serpPageSelect) serpPageSelect.disabled = serpSaving;
    }

    // Fill the three fields for a template: the saved version if there is one, else the live page text.
    // Either way the fields always match what the dropdown says.
    function applySerpTemplate(key) {
        const live = serpPresets[key];
        if (!live || !serpTitleInput || !serpUrlInput || !serpDescInput) return;
        const source = savedSnippets[key] || live;
        serpTitleInput.value = source.title;
        serpUrlInput.value = source.url;
        serpDescInput.value = source.desc;
        serpActiveKey = key;
        serpNotice = null;
        serpBaseline = serpFieldsNow();
        updateSerpPreview();
    }

    // Sends one save or reset request. Resolves with the reply, or throws an Error whose message
    // is fit to show the admin (sessionExpired is set when they need to log in again).
    async function serpRequest(path, payload) {
        let res;
        try {
            res = await fetch('/api/admin/seo-snippets' + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            throw new Error('Could not reach the server. Your changes are still here, so try again.');
        }
        if (res.status === 401) {
            const err = new Error('Your session expired. Please log in again.');
            err.sessionExpired = true;
            throw err;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
            throw new Error('The server does not have this feature yet. Upload the latest backend/server.js and restart the backend.');
        }
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Something went wrong. Please try again.');
        }
        return data;
    }

    function serpFailed(err) {
        if (err.sessionExpired) {
            clearToken();
            checkAuth();
            return;
        }
        serpNotice = { text: err.message, state: 'error' };
    }

    async function saveSerpSnippet() {
        if (serpSaving || !serpIsDirty()) return;
        const key = serpActiveKey;
        const fields = serpFieldsNow();

        // The same checks the server makes, so the message shows straight away
        let urlOk = false;
        try { urlOk = /^https?:$/.test(new URL(fields.url).protocol); } catch (e) { /* not a URL */ }
        if (!fields.title || !urlOk) {
            serpNotice = {
                text: !fields.title
                    ? 'Enter a meta title before saving.'
                    : 'Enter the full page address, for example https://anot.health/billing.html',
                state: 'error'
            };
            renderSerpStatus();
            return;
        }

        serpSaving = true;
        serpNotice = null;
        renderSerpStatus();
        try {
            const data = await serpRequest('', { key, ...fields });
            savedSnippets[key] = data.snippet;
            applySerpTemplate(key); // shows the server's cleaned-up text and the "Saved" status
        } catch (err) {
            serpFailed(err);
        } finally {
            serpSaving = false;
            renderSerpStatus();
        }
    }

    async function resetSerpSnippet() {
        if (serpSaving) return;
        const key = serpActiveKey;
        const hasSaved = Boolean(savedSnippets[key]);
        const question = hasSaved
            ? 'Remove your saved version and go back to the live page text?'
            : 'Discard your changes and show the live page text again?';
        if (!confirm(question)) return;

        if (hasSaved) {
            serpSaving = true;
            serpNotice = null;
            renderSerpStatus();
            try {
                await serpRequest('/reset', { key });
                delete savedSnippets[key];
            } catch (err) {
                serpFailed(err);
                return;
            } finally {
                serpSaving = false;
                renderSerpStatus();
            }
        }
        applySerpTemplate(key);
    }

    // Fetches the saved snippets once the admin is logged in. If the server can't provide them
    // (offline, or the backend has not been updated yet) the live page text simply stays on screen.
    async function loadSavedSnippets() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/api/admin/seo-snippets', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !data.snippets) return;
            savedSnippets = data.snippets;
            // Never overwrite something the admin has already started typing
            if (serpIsDirty()) {
                renderSerpStatus();
            } else {
                applySerpTemplate(serpActiveKey);
            }
        } catch (e) { /* keep showing the live text */ }
    }

    if (serpPageSelect) {
        serpPageSelect.addEventListener('change', function () {
            if (serpIsDirty() && !confirm('You have unsaved changes for this page. Switch anyway and lose them?')) {
                this.value = serpActiveKey;
                return;
            }
            applySerpTemplate(this.value);
        });
    }

    function onSerpInput() {
        serpNotice = null;
        updateSerpPreview();
    }

    if (serpTitleInput) serpTitleInput.addEventListener('input', onSerpInput);
    if (serpUrlInput) serpUrlInput.addEventListener('input', onSerpInput);
    if (serpDescInput) serpDescInput.addEventListener('input', onSerpInput);
    if (serpSaveBtn) serpSaveBtn.addEventListener('click', saveSerpSnippet);
    if (serpResetBtn) serpResetBtn.addEventListener('click', resetSerpSnippet);

    // Initial SERP calculation. Load the selected template first: the fields used to start out
    // hard-coded to the billing page while the dropdown said Homepage.
    if (serpPageSelect) {
        applySerpTemplate(serpPageSelect.value);
    } else {
        updateSerpPreview();
    }

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
