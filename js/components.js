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
    const billingUrl = isCanadian ? 'billing-ca.html' : 'billing.html';
    const pricingUrl = isCanadian ? 'pricing-ca.html' : 'pricing.html';
    const phone = isCanadian ? '(888) 555-ANOT' : '(800) 555-ANOT';

    /* Country Switcher Button in Header */
    const regionBtnHTML = isCanadian
        ? `<button onclick="setAnotRegion('us')" class="h2-country-btn" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 9999px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;" title="Switch to US Version"><span class="flag">🇨🇦</span> Canada (CAD) &bull; <span style="opacity: 0.85;">Switch to 🇺🇸</span></button>`
        : `<button onclick="setAnotRegion('ca')" class="h2-country-btn" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 9999px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;" title="Switch to Canadian Version"><span class="flag">🇺🇸</span> USA (USD) &bull; <span style="opacity: 0.85;">Switch to 🇨🇦</span></button>`;

    /* Site Header */
    const headerHTML = `
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <header class="header" id="siteHeader">
        <div class="header-inner">
            <a href="${homeUrl}" class="logo logo-wide" aria-label="Anot Health Home">
                <img src="images/Logo-anot.webp?v=202606082127" alt="Anot Health" class="logo-img logo-img-wide" decoding="async">
            </a>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Open menu">
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
            </button>
            <nav class="nav" id="siteNav">
                <ul class="nav-list" style="align-items: center;">
                    <li class="nav-item"><a href="${homeUrl}" class="nav-link">Home</a></li>
                    <li class="nav-item nav-item-dropdown">
                        <button class="nav-link nav-link-dropdown nav-dropdown-toggle" type="button" aria-expanded="false">
                            Services <i data-lucide="chevron-down" class="icon-xs nav-caret"></i>
                        </button>
                        <ul class="nav-dropdown">
                            <li><a href="scribing.html" class="nav-dropdown-link">Clinical Documentation</a></li>
                            <li><a href="${billingUrl}" class="nav-dropdown-link">${isCanadian ? 'Provincial Billing (OHIP/MSP)' : 'Revenue Cycle Management'}</a></li>
                            <li><a href="coding.html" class="nav-dropdown-link">Coding &amp; Compliance</a></li>
                            <li><a href="payroll.html" class="nav-dropdown-link">Payroll Admin</a></li>
                        </ul>
                    </li>
                    <li class="nav-item"><a href="${pricingUrl}" class="nav-link">Pricing</a></li>
                    <li class="nav-item"><a href="about.html" class="nav-link">About</a></li>
                    <li class="nav-item"><a href="specialties.html" class="nav-link">Specialties</a></li>
                    <li class="nav-item"><a href="contact.html" class="nav-link">Contact</a></li>
                    <li class="nav-item" style="margin-left: 4px;">
                        ${regionBtnHTML}
                    </li>
                    <li><a href="contact.html?focus=demo#demo-form" class="btn btn-cyan btn-nav-demo">Book Demo</a></li>
                </ul>
            </nav>
        </div>
    </header>`;

    /* Site Footer */
    const footerDesc = isCanadian
        ? 'Expert-led clinical documentation, provincial billing (OHIP, MSP, AHCIP), and EMR workflows for Canadian healthcare practices &mdash; pairing advanced speech AI with certified human scribes.'
        : 'Expert-led clinical documentation, medical coding, revenue cycle, and payroll support for healthcare teams that demand accuracy, strengthened by advanced AI and human review.';

    const footerCopyright = isCanadian
        ? `&copy; 2026 Anot Health Canada. All rights reserved. In-Country AWS Canada Central Data Residency &bull; PIPEDA &amp; Provincial Privacy Compliant.`
        : `&copy; 2026 Anot Health. All rights reserved. Built for compassionate, error-free clinical operations.`;

    const footerHTML = `
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div>
                    <a href="${homeUrl}" class="footer-logo-link footer-logo-link-wide" aria-label="Anot Health Home">
                        <img src="images/Logo-anot.webp?v=202606082127" alt="Anot Health" class="footer-logo-img footer-logo-img-wide" loading="lazy" decoding="async">
                    </a>
                    <p class="footer-desc">${footerDesc}</p>
                </div>
                <div>
                    <h4 class="footer-title">Services</h4>
                    <ul class="footer-list">
                        <li><a href="scribing.html" class="footer-link">Clinical Documentation</a></li>
                        <li><a href="${billingUrl}" class="footer-link">${isCanadian ? 'Provincial Billing' : 'Revenue Cycle'}</a></li>
                        <li><a href="coding.html" class="footer-link">Coding &amp; Compliance</a></li>
                        <li><a href="payroll.html" class="footer-link">Payroll Admin</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="footer-title">Company</h4>
                    <ul class="footer-list">
                        <li><a href="${homeUrl}" class="footer-link">Home</a></li>
                        <li><a href="${pricingUrl}" class="footer-link">Pricing (${isCanadian ? 'CAD' : 'USD'})</a></li>
                        <li><a href="about.html" class="footer-link">About</a></li>
                        <li><a href="specialties.html" class="footer-link">Specialties</a></li>
                        <li><a href="${trustUrl}" class="footer-link">${trustLabel}</a></li>
                        <li><a href="contact.html" class="footer-link">Contact</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="footer-title">Get in Touch</h4>
                    <ul class="footer-list">
                        <li><a href="mailto:admin@anot.health" class="footer-link">admin@anot.health</a></li>
                        <li><span class="footer-link" style="color: #94a3b8; font-size: 0.85rem;"><i data-lucide="phone" class="icon-xs"></i> ${phone}</span></li>
                        <li><a href="contact.html?focus=demo#demo-form" class="footer-link">Request a Demo</a></li>
                        <li style="margin-top: 10px;">${regionBtnHTML}</li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>${footerCopyright}</p>
                <div class="footer-legal">
                    <a href="privacy.html">Privacy</a>
                    <a href="terms.html">Terms</a>
                    <a href="${trustUrl}">${isCanadian ? 'PIPEDA' : 'HIPAA'}</a>
                </div>
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
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
})();
