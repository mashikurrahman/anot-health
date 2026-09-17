/**
 * Anot Health - Universal Site Components (Region-Aware)
 * Injects the shared header, footer, scroll-progress bar, and scroll-top
 * button into every page, dynamically localizing navigation, compliance links,
 * and contact details for Canadian vs US visitors.
 */

(function () {
    'use strict';

    const CANADIAN_TIMEZONES = [
        'America/Toronto', 'America/Montreal', 'America/Vancouver',
        'America/Edmonton', 'America/Calgary', 'America/Winnipeg',
        'America/Halifax', 'America/St_Johns', 'America/Regina'
    ];

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // Determine region: URL override > localStorage > cookie > current page hint > timezone
    let isCanadian = false;
    const urlParams = new URLSearchParams(window.location.search);
    const regionParam = urlParams.get('region') || urlParams.get('country');

    if (regionParam) {
        isCanadian = regionParam.toLowerCase() === 'ca';
    } else {
        const savedRegion = localStorage.getItem('anot_selected_region') || getCookie('anot_region');
        if (savedRegion) {
            isCanadian = savedRegion === 'ca';
        } else {
            const currentPath = window.location.pathname.toLowerCase();
            if (currentPath.includes('-ca.html') || currentPath.includes('pipeda.html')) {
                isCanadian = true;
            } else {
                try {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (tz && CANADIAN_TIMEZONES.includes(tz)) {
                        isCanadian = true;
                    }
                } catch (e) {}
            }
        }
    }

    /* Scroll Progress Bar */
    const scrollProgressHTML = `<div class="scroll-progress" id="scrollProgress"></div>`;

    /* Regional Navigation Paths */
    const homeUrl = isCanadian ? 'homepage-ca.html' : 'index.html';
    const trustUrl = isCanadian ? 'pipeda.html' : 'hipaa.html';
    const trustLabel = isCanadian ? 'PIPEDA Trust' : 'HIPAA Trust';
    const scribingUrl = isCanadian ? 'scribing-ca.html' : 'scribing.html';
    const billingUrl = isCanadian ? 'billing-ca.html' : 'billing.html';
    const codingUrl = isCanadian ? 'coding-ca.html' : 'coding.html';
    const pricingUrl = isCanadian ? 'pricing-ca.html' : 'pricing.html';
    const aboutUrl = isCanadian ? 'about-ca.html' : 'about.html';
    const contactUrl = isCanadian ? 'contact-ca.html' : 'contact.html';
    const phone = isCanadian ? '(888) 555-ANOT' : '(800) 555-ANOT';

    /* tel: URIs must be digits only — letters in a vanity number are not
       dialable on iOS or Android, so translate them off the keypad. */
    const KEYPAD = { A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 5, L: 5,
                     M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7, T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9 };
    const telHref = '+1' + phone.toUpperCase().replace(/[A-Z]/g, (c) => KEYPAD[c]).replace(/\D/g, '');

    /* Current page: used for active state and for section anchors that only
       exist on the homepage (on inner pages they must jump back to it). */
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const onHomepage = ['index.html', 'homepage-2.html', 'homepage-ca.html'].indexOf(currentFile) > -1;
    const sect = (hash) => onHomepage ? hash : homeUrl + hash;
    const act = (file) => currentFile === file.toLowerCase() ? ' active' : '';

    const servicePages = [
        'billing.html', 'billing-ca.html',
        'coding.html', 'coding-ca.html',
        'scribing.html', 'scribing-ca.html',
        'payroll.html', 'specialties.html'
    ];
    const isServicePage = servicePages.includes(currentFile);

    /* Region switcher. Detection is automatic (js/geo-switcher.js), so this is a
       deliberately quiet escape hatch for the cases detection gets wrong — a VPN,
       a corporate proxy, a clinician travelling. It sits in the footer fine print,
       styled as a status label rather than a control, but stays keyboard-reachable
       and clearly labelled for assistive technology. */
    const regionChipHTML = isCanadian
        ? `<button type="button" onclick="setAnotRegion('us')" class="h2-region-link" title="Switch to the United States site" aria-label="Currently viewing the Canadian site in Canadian dollars. Activate to switch to the United States site.">Canada (CAD)</button>`
        : `<button type="button" onclick="setAnotRegion('ca')" class="h2-region-link" title="Switch to the Canadian site" aria-label="Currently viewing the United States site in US dollars. Activate to switch to the Canadian site.">United States (USD)</button>`;

    /* Site Header — one shared header for every page */
    const headerHTML = `
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <aside class="h2-topbar" aria-label="Contact and hours">
        <div class="container">
            <div class="h2-topbar-inner">
                <div class="h2-topbar-left">
                    <span class="h2-topbar-item"><i data-lucide="clock" class="icon-xs"></i> ${isCanadian ? '24/7 Canadian Clinical Support' : '24/7 Clinical Operations Support'}</span>
                    <a href="tel:${telHref}" class="h2-topbar-item h2-topbar-link"><i data-lucide="phone" class="icon-xs"></i> ${phone}</a>
                    <span class="h2-topbar-item h2-topbar-hide-md"><i data-lucide="map-pin" class="icon-xs"></i> ${isCanadian ? 'Serving Clinics Coast-to-Coast Across Canada' : 'Nationwide Support &bull; US-Based'}</span>
                </div>
                <div class="h2-topbar-right">
                    <a href="mailto:admin@anot.health" class="h2-topbar-item h2-topbar-link"><i data-lucide="mail" class="icon-xs"></i> admin@anot.health</a>
                    <div class="h2-topbar-socials">
                        <a href="https://linkedin.com" target="_blank" rel="noopener" aria-label="Anot Health on LinkedIn"><i data-lucide="linkedin" class="icon-xs"></i></a>
                        <a href="https://twitter.com" target="_blank" rel="noopener" aria-label="Anot Health on Twitter"><i data-lucide="twitter" class="icon-xs"></i></a>
                    </div>
                </div>
            </div>
        </div>
    </aside>

    <header class="h2-navbar" role="banner">
        <div class="container">
            <div class="h2-nav-inner">
                <a href="${homeUrl}" class="h2-logo" aria-label="Anot Health home">
                    <img src="images/Logo-anot.webp?v=202606082127" alt="Anot Health" class="h2-logo-img" decoding="async">
                </a>

                <button class="h2-nav-toggle" type="button" aria-expanded="false" aria-controls="h2SiteNav" aria-label="Open menu">
                    <span class="h2-nav-toggle-line"></span>
                    <span class="h2-nav-toggle-line"></span>
                    <span class="h2-nav-toggle-line"></span>
                </button>

                <nav aria-label="Main Navigation" class="h2-nav" id="h2SiteNav">
                    <ul class="h2-nav-links">
                        <li><a href="${homeUrl}" class="h2-nav-link${onHomepage ? ' active' : ''}">Home</a></li>

                        <li class="h2-nav-dropdown">
                            <a href="${sect('#services')}" class="h2-nav-link h2-dropdown-toggle${isServicePage ? ' active' : ''}">Services</a>
                            <div class="h2-dropdown-menu h2-mega-menu">
                                <div class="h2-mega-head">
                                    <span class="h2-mega-head-eyebrow">Our Services</span>
                                    <span class="h2-mega-head-note">Human-verified operations</span>
                                </div>
                                <div class="h2-mega-grid">
                                    <a href="${scribingUrl}" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="mic"></i></span>
                                        <span class="h2-mega-item-body"><strong>Clinical Documentation</strong><small>SOAP notes ready to sign</small></span>
                                    </a>
                                    <a href="${billingUrl}" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="credit-card"></i></span>
                                        <span class="h2-mega-item-body"><strong>${isCanadian ? 'Provincial Billing' : 'Revenue Cycle Management'}</strong><small>${isCanadian ? 'OHIP, MSP &amp; AHCIP claims' : 'Clean claims, faster payment'}</small></span>
                                    </a>
                                    <a href="${codingUrl}" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="file-check-2"></i></span>
                                        <span class="h2-mega-item-body"><strong>Coding &amp; Compliance</strong><small>${isCanadian ? 'Provincial coding accuracy' : 'AAPC-certified accuracy'}</small></span>
                                    </a>
                                    <a href="payroll.html" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="wallet"></i></span>
                                        <span class="h2-mega-item-body"><strong>Payroll Admin</strong><small>RVU bonuses reconciled</small></span>
                                    </a>
                                    <a href="specialties.html" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="stethoscope"></i></span>
                                        <span class="h2-mega-item-body"><strong>50+ Specialties</strong><small>Cardiology to Family Med</small></span>
                                    </a>
                                    <a href="${trustUrl}" class="h2-mega-item">
                                        <span class="h2-mega-item-icon"><i data-lucide="shield-check"></i></span>
                                        <span class="h2-mega-item-body"><strong>${trustLabel} Center</strong><small>${isCanadian ? 'Canadian data residency' : 'Two-stage human review'}</small></span>
                                    </a>
                                </div>
                                <a href="${contactUrl}?focus=demo#demo-form" class="h2-mega-bar">
                                    <span class="h2-mega-bar-text"><i data-lucide="calendar"></i> Not sure where to start?</span>
                                    <span class="h2-mega-bar-cta">Book a demo <i data-lucide="arrow-right"></i></span>
                                </a>
                            </div>
                        </li>

                        <li><a href="${pricingUrl}" class="h2-nav-link${act(pricingUrl)}">Pricing</a></li>
                        <li><a href="${aboutUrl}" class="h2-nav-link${act(aboutUrl)}">About</a></li>
                        <li><a href="${contactUrl}" class="h2-nav-link${act(contactUrl)}">Contact</a></li>
                    </ul>
                </nav>

                <div class="h2-nav-actions">
                    <a href="${contactUrl}?focus=demo#demo-form" class="h2-btn-primary"><i data-lucide="calendar" class="icon-xs"></i> Book Demo</a>
                </div>
            </div>
        </div>
    </header>`;

    /* Site Footer */
    const footerCopyright = isCanadian
        ? `&copy; 2026 Anot Health Canada. All rights reserved.`
        : `&copy; 2026 Anot Health. All rights reserved.`;

    /* Short footer, matching the homepages exactly. The region switcher and the
       phone number both live in the header topbar on every page, so keeping
       them out of the footer loses no functionality. */
    const footerHTML = `
    <footer class="h2-footer">
        <div class="container">
            <div class="h2-footer-row">
                <a href="${homeUrl}" class="h2-footer-logo" aria-label="Anot Health Home">
                    <img src="images/Logo-anot.webp?v=202606082127" alt="Anot Health" loading="lazy" decoding="async">
                </a>
                <nav class="h2-footer-nav" aria-label="Footer">
                    <a href="${aboutUrl}">About</a>
                    <a href="${scribingUrl}">Services</a>
                    <a href="specialties.html">Specialties</a>
                    <a href="${pricingUrl}">Pricing</a>
                    <a href="${trustUrl}">${trustLabel}</a>
                    <a href="privacy.html">Privacy</a>
                    <a href="terms.html">Terms</a>
                    <a href="${contactUrl}">Contact</a>
                </nav>
            </div>
            <div class="h2-footer-bottom">
                <div>${footerCopyright}</div>
                <div class="h2-footer-meta">${regionChipHTML}</div>
            </div>
        </div>
    </footer>`;

    /* Scroll-to-Top Button */
    const scrollTopHTML = `
    <button type="button" class="scroll-top" id="scrollTopButton" aria-label="Scroll back to top">
        <i data-lucide="arrow-up" class="icon-md"></i>
    </button>`;

    /* Injection Logic */
    function inject(mountId, html) {
        const mount = document.getElementById(mountId);
        if (mount) {
            mount.outerHTML = html;
        }
    }

    inject('scroll-progress-mount', scrollProgressHTML);
    inject('header-mount', headerHTML);
    inject('footer-mount', footerHTML);
    inject('scroll-top-mount', scrollTopHTML);

    // Refresh lucide icons for injected elements
    function refreshIcons() {
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }
    refreshIcons();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refreshIcons);
    }
    setTimeout(refreshIcons, 50);

    /* Mobile nav toggle */
    const navToggle = document.querySelector('.h2-nav-toggle');
    const siteNav = document.getElementById('h2SiteNav');

    if (navToggle && siteNav) {
        navToggle.addEventListener('click', function () {
            const open = siteNav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', String(open));
        });

        // close after choosing a destination
        siteNav.addEventListener('click', function (e) {
            if (e.target.closest('a')) {
                siteNav.classList.remove('is-open');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // reset state when returning to desktop width
        window.addEventListener('resize', function () {
            if (window.innerWidth > 1000 && siteNav.classList.contains('is-open')) {
                siteNav.classList.remove('is-open');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
})();
