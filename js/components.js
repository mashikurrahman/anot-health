/**
 * Anot Health - Universal Site Components (Region-Aware)
 * Injects the shared header, footer, scroll-progress bar, and scroll-top
 * button into every page, dynamically localizing navigation, compliance links,
 * and contact details for Canadian vs US visitors.
 */

(function () {
    'use strict';

    /* Show the "Canada (CAD)" / "United States (USD)" control in the footer.
       Region detection itself is automatic and unaffected by this (js/geo-switcher.js:
       ?region= override, then saved preference, then timezone, then GeoIP) - this only
       controls whether the manual escape hatch is visible.

       Turned off on request. With it hidden, a visitor whom detection puts in the wrong
       region has no on-page way back, and the choice is cached for 30 days. The
       ?region=us / ?region=ca links below still work and are the recovery route:
           https://anot.health/pricing.html?region=us
           https://anot.health/pricing-ca.html?region=ca
       Set this back to true to restore the control. */
    const SHOW_REGION_SWITCHER = true;

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
        // localStorage throws when site data is blocked; fall back to the cookie.
        let storedRegion = null;
        try {
            storedRegion = localStorage.getItem('anot_selected_region');
        } catch (e) {}
        const savedRegion = storedRegion || getCookie('anot_region');
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
    const scribingUrl = isCanadian ? 'scribing-ca.html' : 'scribing.html';
    const billingUrl = isCanadian ? 'billing-ca.html' : 'billing.html';
    const codingUrl = isCanadian ? 'coding-ca.html' : 'coding.html';
    const pricingUrl = isCanadian ? 'pricing-ca.html' : 'pricing.html';
    const aboutUrl = isCanadian ? 'about-ca.html' : 'about.html';
    const contactUrl = isCanadian ? 'contact-ca.html' : 'contact.html';

    /* Current page: drives the active state in the nav and the mega menu. */
    const currentPath = window.location.pathname.toLowerCase();
    const currentFile = (currentPath.split('/').pop() || 'index.html').toLowerCase();
    const onHomepage = ['index.html', 'homepage-2.html', 'homepage-ca.html'].indexOf(currentFile) > -1;
    const act = (file) => currentFile === file.toLowerCase() ? ' active' : '';

    const isContactPage = currentFile === 'contact.html' || currentFile === 'contact-ca.html' || currentPath.endsWith('/contact') || currentPath.endsWith('/contact-ca');
    // Only applied to explicit CTA buttons (e.g. Book Demo), NEVER to navigation menu links
    const modalCtaAttrs = isContactPage
        ? ''
        : ' data-open-contact-modal="true" onclick="if(window.openContactModal){window.openContactModal();return false;}"';

    // The Trust Center is the compliance page for this visitor's region. Before this
    // was added to the menu, hipaa.html had no inbound link anywhere on the site.
    const trustUrl = isCanadian ? 'pipeda.html' : 'hipaa.html';

    const servicePages = [
        'billing.html', 'billing-ca.html',
        'coding.html', 'coding-ca.html',
        'scribing.html', 'scribing-ca.html',
        'payroll.html',
        'specialties.html',
        'hipaa.html', 'pipeda.html'
    ];
    const isServicePage = servicePages.includes(currentFile);

    /* Region switcher. Detection is automatic (js/geo-switcher.js), so this is a
       deliberately quiet escape hatch for the cases detection gets wrong — a VPN,
       a corporate proxy, a clinician travelling. It sits in the footer fine print,
       styled as a status label rather than a control, but stays keyboard-reachable
       and clearly labelled for assistive technology. */
    const regionChipHTML = !SHOW_REGION_SWITCHER
        ? ''
        : isCanadian
            ? `<button type="button" onclick="setAnotRegion('us')" class="h2-region-link" title="Switch to the United States site" aria-label="Currently viewing the Canadian site in Canadian dollars. Activate to switch to the United States site.">Canada (CAD)</button>`
            : `<button type="button" onclick="setAnotRegion('ca')" class="h2-region-link" title="Switch to the Canadian site" aria-label="Currently viewing the United States site in US dollars. Activate to switch to the Canadian site.">United States (USD)</button>`;

    /* Company social profiles. An icon is shown only when its URL is filled in,
       so the header never links to a generic social-network home page. */
    const SOCIAL_PROFILES = [
        { url: 'https://www.linkedin.com/company/anot-health', label: 'Anot Health on LinkedIn', icon: 'linkedin' },
        { url: '', label: 'Anot Health on X', icon: 'twitter' }
    ];
    const socialLinks = SOCIAL_PROFILES.filter((profile) => profile.url);
    const socialLinksHTML = socialLinks.length
        ? `<div class="h2-topbar-socials">${socialLinks.map((profile) =>
            `<a href="${profile.url}" target="_blank" rel="noopener noreferrer" aria-label="${profile.label}"><i data-lucide="${profile.icon}" class="icon-xs"></i></a>`
        ).join('')}</div>`
        : '';

    /* Site Header — one shared header for every page */
    const headerHTML = `
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <aside class="h2-topbar" aria-label="Contact and hours">
        <div class="container">
            <div class="h2-topbar-inner">
                <div class="h2-topbar-left">
                    <span class="h2-topbar-item"><i data-lucide="clock" class="icon-xs"></i> Dedicated Clinical Practice Support</span>
                    <span class="h2-topbar-item h2-topbar-hide-md"><i data-lucide="map-pin" class="icon-xs"></i> ${isCanadian ? 'Serving Outpatient Clinics &amp; Group Practices Nationwide' : 'Nationwide Support &bull; US-Based'}</span>
                </div>
                <div class="h2-topbar-right">
                    <a href="mailto:admin@anot.health" class="h2-topbar-item h2-topbar-link"><i data-lucide="mail" class="icon-xs"></i> admin@anot.health</a>
                    ${socialLinksHTML}
                </div>
            </div>
        </div>
    </aside>

    <header class="h2-navbar" role="banner" id="siteHeader">
        <div class="container">
            <div class="h2-nav-inner">
                <a href="${homeUrl}" class="h2-logo" aria-label="Anot Health home">
                    <img src="images/logo-symbol-ah.webp?v=202609301615" alt="Anot Health" class="h2-logo-img" decoding="async">
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
                            <button type="button" class="h2-nav-link h2-dropdown-toggle${isServicePage ? ' active' : ''}" aria-expanded="false" aria-controls="h2ServicesMenu" style="background:transparent;border:none;outline:none;font:inherit;cursor:pointer;">
                                <span>Services</span>
                                <i data-lucide="chevron-down" class="h2-nav-arrow icon-xs"></i>
                            </button>
                            <div class="h2-dropdown-menu h2-mega-menu" id="h2ServicesMenu">
                                <div class="h2-mega-head">
                                    <span class="h2-mega-head-eyebrow">Services &amp; Operations</span>
                                    <span class="h2-mega-head-note">Human-verified workflows</span>
                                </div>
                                <div class="h2-mega-cols">
                                    <div class="h2-mega-col">
                                        <p class="h2-mega-col-title" id="h2MegaColServices">What we run</p>
                                        <div class="h2-mega-list" role="group" aria-labelledby="h2MegaColServices">
                                            <a href="${scribingUrl}" class="h2-mega-item${act(scribingUrl)}">
                                                <span class="h2-mega-item-icon"><i data-lucide="mic"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>Clinical Documentation</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>SOAP notes ready to sign</small>
                                                </span>
                                            </a>
                                            <a href="${billingUrl}" class="h2-mega-item${act(billingUrl)}">
                                                <span class="h2-mega-item-icon"><i data-lucide="credit-card"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>${isCanadian ? 'Provincial Billing' : 'Revenue Cycle Management'}</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>${isCanadian ? 'OHIP, MSP &amp; AHCIP claims' : 'Clean claims, faster payment'}</small>
                                                </span>
                                            </a>
                                            <a href="${codingUrl}" class="h2-mega-item${act(codingUrl)}">
                                                <span class="h2-mega-item-icon"><i data-lucide="file-check-2"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>Coding &amp; Compliance</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>${isCanadian ? 'Provincial coding accuracy' : 'AAPC-certified accuracy'}</small>
                                                </span>
                                            </a>
                                            <a href="payroll.html" class="h2-mega-item${act('payroll.html')}">
                                                <span class="h2-mega-item-icon"><i data-lucide="wallet"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>Payroll Administration</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>RVU bonuses reconciled</small>
                                                </span>
                                            </a>
                                        </div>
                                    </div>

                                    <div class="h2-mega-col">
                                        <p class="h2-mega-col-title" id="h2MegaColFit">Find your fit</p>
                                        <div class="h2-mega-list" role="group" aria-labelledby="h2MegaColFit">
                                            <a href="specialties.html" class="h2-mega-item${act('specialties.html')}">
                                                <span class="h2-mega-item-icon"><i data-lucide="stethoscope"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>Medical Specialties</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>Built around your specialty</small>
                                                </span>
                                            </a>
                                            <a href="${pricingUrl}" class="h2-mega-item${act(pricingUrl)}">
                                                <span class="h2-mega-item-icon"><i data-lucide="tag"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>Plans &amp; pricing</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>Compare the three plans</small>
                                                </span>
                                            </a>
                                            <a href="${aboutUrl}" class="h2-mega-item${act(aboutUrl)}">
                                                <span class="h2-mega-item-icon"><i data-lucide="users"></i></span>
                                                <span class="h2-mega-item-body">
                                                    <span class="h2-mega-item-title-row">
                                                        <strong>The expert-led model</strong>
                                                        <i data-lucide="arrow-right" class="h2-mega-arrow"></i>
                                                    </span>
                                                    <small>Why humans review every note</small>
                                                </span>
                                            </a>
                                        </div>
                                    </div>

                                    <div class="h2-mega-col h2-mega-col-feature">
                                        <p class="h2-mega-col-title">Trust &amp; compliance</p>
                                        <a href="${trustUrl}" class="h2-mega-feature${act(trustUrl)}">
                                            <span class="h2-mega-feature-icon"><i data-lucide="shield-check"></i></span>
                                            <strong class="h2-mega-feature-title">${isCanadian ? 'PIPEDA Trust Center' : 'Trust Center'}</strong>
                                            <span class="h2-mega-feature-text">${isCanadian
                                                ? 'PIPEDA and provincial privacy law, Canadian data residency, and the safeguards behind every workflow.'
                                                : 'HIPAA-conscious workflows, layered expert review, and the safeguards behind every note we touch.'}</span>
                                            <ul class="h2-mega-feature-points">
                                                <li><i data-lucide="check"></i>${isCanadian ? 'Data stays in Canada' : 'HIPAA-conscious by design'}</li>
                                                <li><i data-lucide="check"></i>SOC 2 Type II controls</li>
                                                <li><i data-lucide="check"></i>${isCanadian ? 'Provincial privacy law' : 'Signed BAAs available'}</li>
                                            </ul>
                                            <span class="h2-mega-feature-cta">${isCanadian ? 'View PIPEDA Trust Center' : 'View the Trust Center'} <i data-lucide="arrow-right"></i></span>
                                        </a>
                                    </div>
                                </div>
                                <a href="${contactUrl}?focus=demo#demo-form" class="h2-mega-bar"${modalCtaAttrs}>
                                    <span class="h2-mega-bar-text"><i data-lucide="calendar"></i> Need custom practice workflows?</span>
                                    <span class="h2-mega-bar-cta">Book a walkthrough <i data-lucide="arrow-right"></i></span>
                                </a>
                            </div>
                        </li>

                        <li><a href="${pricingUrl}" class="h2-nav-link${act(pricingUrl)}">Pricing</a></li>
                        <li><a href="${aboutUrl}" class="h2-nav-link${act(aboutUrl)}">About</a></li>
                        <li><a href="${contactUrl}" class="h2-nav-link${act(contactUrl)}">Contact</a></li>
                    </ul>
                </nav>

                <div class="h2-nav-actions">
                    <a href="${contactUrl}?focus=demo#demo-form" class="h2-btn-primary"${modalCtaAttrs}><i data-lucide="calendar" class="icon-xs"></i> Book Demo</a>
                </div>
            </div>
        </div>
    </header>`;

    /* Site Footer */
    const footerCopyright = isCanadian
        ? `&copy; 2026 Anot Health Canada. All rights reserved.`
        : `&copy; 2026 Anot Health. All rights reserved.`;

    /* Short footer, matching the homepages exactly. The region switcher lives
       in the header topbar on every page, so keeping it out of the footer
       loses no functionality. Email is the only published contact channel. */
    const footerHTML = `
    <footer class="h2-footer">
        <div class="container">
            <div class="h2-footer-row">
                <a href="${homeUrl}" class="h2-footer-logo" aria-label="Anot Health Home">
                    <img src="images/logo-full-light.webp?v=202609301615" alt="Anot Health" loading="lazy" decoding="async">
                </a>
                <nav class="h2-footer-nav" aria-label="Footer">
                    <a href="${aboutUrl}">About</a>
                    <a href="${scribingUrl}">Services</a>
                    <a href="${pricingUrl}">Pricing</a>
                    <a href="privacy.html">Privacy</a>
                    <a href="terms.html">Terms</a>
                    <a href="${contactUrl}">Contact</a>
                </nav>
            </div>
            <div class="h2-footer-bottom">
                <div>${footerCopyright}</div>
                ${regionChipHTML ? `<div class="h2-footer-meta">${regionChipHTML}</div>` : ''}
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

    /* Mobile nav toggle & dropdown accordions */
    const navToggle = document.querySelector('.h2-nav-toggle');
    const siteNav = document.getElementById('h2SiteNav');
    const dropdownItem = document.querySelector('.h2-nav-dropdown');
    const dropdownToggle = document.querySelector('.h2-dropdown-toggle');

    if (navToggle && siteNav) {
        navToggle.addEventListener('click', function () {
            const open = siteNav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', String(open));
            if (!open && dropdownItem) {
                dropdownItem.classList.remove('is-open');
                if (dropdownToggle) dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });

        /* Services mega menu - W3C disclosure-navigation pattern.
           The toggle is a real <button> with aria-expanded/aria-controls (not a menu
           role: typical site navigation does not need the menubar keyboard model).
           Previously the menu opened on CSS :hover alone, so aria-expanded stayed
           "false" on desktop however long the menu was open - assistive technology was
           told the opposite of what was on screen. State is now driven from here and
           the CSS follows .is-open, so the two can no longer disagree. */
        const DESKTOP = () => window.innerWidth > 1000;
        const OPEN_DELAY = 140;   // ignores a pointer merely passing over the trigger
        const CLOSE_DELAY = 260;  // survives the diagonal cursor path into the panel
        let openTimer = null, closeTimer = null;

        function setMega(open) {
            if (!dropdownItem || !dropdownToggle) return;
            dropdownItem.classList.toggle('is-open', open);
            dropdownToggle.setAttribute('aria-expanded', String(open));
        }
        const clearTimers = () => { clearTimeout(openTimer); clearTimeout(closeTimer); };

        if (dropdownToggle && dropdownItem) {
            // Click works at every width: tap targets on mobile, and a keyboard
            // Enter/Space on desktop both land here.
            dropdownToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                clearTimers();
                setMega(!dropdownItem.classList.contains('is-open'));
            });

            // Pointer intent, desktop only. Touch devices fire no mouseenter, so they
            // keep the click behaviour above.
            dropdownItem.addEventListener('mouseenter', function () {
                if (!DESKTOP()) return;
                clearTimers();
                openTimer = setTimeout(() => setMega(true), OPEN_DELAY);
            });
            dropdownItem.addEventListener('mouseleave', function () {
                if (!DESKTOP()) return;
                clearTimers();
                closeTimer = setTimeout(() => setMega(false), CLOSE_DELAY);
            });

            /* Escape closes and returns focus to the trigger, per the W3C pattern.
               Bound to the document rather than the menu: the panel can be open with
               focus still outside it (opened by hover, or by a click that left focus
               on the body), and Escape has to work in that state too. */
            document.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape' && e.key !== 'Esc') return;
                if (!dropdownItem.classList.contains('is-open')) return;
                clearTimers();
                setMega(false);
                // Only pull focus back if it was inside the menu, so Escape pressed
                // elsewhere on the page does not yank the page around.
                if (dropdownItem.contains(document.activeElement)) dropdownToggle.focus();
            });

            // Tabbing out of the panel closes it, so the menu never hangs open behind
            // the rest of the page.
            dropdownItem.addEventListener('focusout', function (e) {
                if (!DESKTOP()) return;
                if (e.relatedTarget && dropdownItem.contains(e.relatedTarget)) return;
                setMega(false);
            });

            // A click anywhere else dismisses it.
            document.addEventListener('click', function (e) {
                if (!dropdownItem.classList.contains('is-open')) return;
                if (dropdownItem.contains(e.target)) return;
                clearTimers();
                setMega(false);
            });
        }

        // Close after choosing an actual destination link (exclude dropdown toggle on mobile)
        siteNav.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;
            if (link.classList.contains('h2-dropdown-toggle') && window.innerWidth <= 1000) {
                return;
            }
            siteNav.classList.remove('is-open');
            navToggle.setAttribute('aria-expanded', 'false');
            if (dropdownItem) {
                dropdownItem.classList.remove('is-open');
                if (dropdownToggle) dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Reset state when returning to desktop width
        window.addEventListener('resize', function () {
            if (window.innerWidth > 1000) {
                if (siteNav.classList.contains('is-open')) {
                    siteNav.classList.remove('is-open');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
                if (dropdownItem && dropdownItem.classList.contains('is-open')) {
                    dropdownItem.classList.remove('is-open');
                    if (dropdownToggle) dropdownToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    /* ==========================================================================
       Universal Pop-Up Consultation Modal (All Non-Contact Pages)
       Intercepts all "Contact", "Book Demo", and consultation buttons across
       the site and displays an instant, calm pop-up consultation modal.
       ========================================================================== */
    if (!isContactPage) {
        const modalHTML = `
        <div class="anot-modal-overlay" id="anotContactModal" data-lenis-prevent aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="anotModalTitle">
            <div class="anot-modal-dialog" id="anotModalDialog" data-lenis-prevent style="max-width: 580px;">
                <button type="button" class="anot-modal-close" id="anotModalCloseBtn" aria-label="Close dialog">&times;</button>
                
                <!-- Simple Header -->
                <div class="stepper-header modal-stepper-header" id="modalStepperHeader" style="margin-bottom: 20px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 700; color: #2563EB; background: #EFF6FF; border: 1px solid #DBEAFE; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
                        <i data-lucide="calendar" class="icon-xs"></i> <span>15-Minute Operational Walkthrough</span>
                    </div>
                    <h3 class="stepper-title" id="anotModalTitle" style="font-size: 1.45rem; margin-bottom: 4px;">Request Your Walkthrough</h3>
                    <p class="stepper-subtitle" style="font-size: 0.88rem; max-width: 440px; margin: 0 auto; color: #64748B;">Pick a time that fits your clinical schedule. No sales pressure.</p>
                </div>

                <!-- 1-Screen Fast Form -->
                <form id="anotModalForm" action="/api/contact" method="POST" novalidate>
                    <input type="hidden" name="source" value="modal-${currentFile}">
                    <input type="hidden" name="region" value="${isCanadian ? 'Canada (PIPEDA)' : 'US/International'}">
                    <input type="hidden" name="role" value="Clinician / Provider">
                    <input type="hidden" name="practice_size" value="2-5 Providers">
                    <input type="hidden" name="service" id="modal_service" value="${isCanadian ? 'Clinical Scribing (Ambient AI + Certified Scribe)' : 'Clinical Documentation & Ambient Scribing'}">
                    <input type="hidden" name="preferred_date" id="modal_preferred_date" value="">
                    <input type="hidden" name="time_slot" id="modal_time_slot" value="10:30 AM ET">
                    <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true" style="display:none;">

                    <!-- Name & Email Row -->
                    <div class="stepper-row-2col" style="margin-bottom: 12px;">
                        <div class="stepper-field" style="margin-bottom: 0;">
                            <label for="modal_name" class="stepper-field-label">Your Name <span class="required-dot">*</span></label>
                            <input type="text" id="modal_name" name="name" class="stepper-input" placeholder="Dr. Jane Smith, MD" autocomplete="name" required>
                            <div class="stepper-field-error" id="modal_err_name">Please enter your name.</div>
                        </div>
                        <div class="stepper-field" style="margin-bottom: 0;">
                            <label for="modal_email" class="stepper-field-label">Work / Clinic Email <span class="required-dot">*</span></label>
                            <input type="email" id="modal_email" name="email" class="stepper-input" placeholder="doctor@clinic.com" autocomplete="email" required>
                            <div class="stepper-field-error" id="modal_err_email">Please enter a valid work email.</div>
                        </div>
                    </div>

                    <!-- Practice Name -->
                    <div class="stepper-field" style="margin-bottom: 14px;">
                        <label for="modal_practice" class="stepper-field-label">Practice / Clinic Name <span class="required-dot">*</span></label>
                        <input type="text" id="modal_practice" name="practice" class="stepper-input" placeholder="e.g. Metro Specialty Health Partners" autocomplete="organization" required>
                        <div class="stepper-field-error" id="modal_err_practice">Please enter your clinic or practice name.</div>
                    </div>

                    <!-- Service Chips (Compact & Fast) -->
                    <div class="stepper-field" style="margin-bottom: 14px;">
                        <label class="stepper-field-label">Primary Service Area</label>
                        <div class="stepper-service-chips" id="modalServiceGrid" role="radiogroup" aria-label="Select primary service">
                            <button type="button" class="stepper-service-chip is-active" data-service="${isCanadian ? 'Clinical Scribing (Ambient AI + Certified Scribe)' : 'Clinical Documentation & Ambient Scribing'}" role="radio" aria-checked="true">
                                <span>${isCanadian ? 'Clinical Scribing' : 'Documentation & Scribing'}</span>
                                <span class="stepper-service-chip-check">&#10003;</span>
                            </button>
                            <button type="button" class="stepper-service-chip" data-service="${isCanadian ? 'Provincial Medical Billing & RA Reconciliation' : 'Revenue Cycle Management & Medical Billing'}" role="radio" aria-checked="false">
                                <span>${isCanadian ? 'Provincial Billing' : 'Medical Billing & RCM'}</span>
                                <span class="stepper-service-chip-check">&#10003;</span>
                            </button>
                            <button type="button" class="stepper-service-chip" data-service="${isCanadian ? 'Clinical Coding & Provincial Compliance' : 'Specialty Clinical Coding & Auditing'}" role="radio" aria-checked="false">
                                <span>${isCanadian ? 'Clinical Coding' : 'Specialty Coding'}</span>
                                <span class="stepper-service-chip-check">&#10003;</span>
                            </button>
                            <button type="button" class="stepper-service-chip" data-service="${isCanadian ? 'Full Practice Operations Suite' : 'Full Operations Suite'}" role="radio" aria-checked="false">
                                <span>Full Operations Suite</span>
                                <span class="stepper-service-chip-check">&#10003;</span>
                            </button>
                        </div>
                    </div>

                    <!-- Date & Time (Combined Compact Block) -->
                    <div class="stepper-field" style="margin-bottom: 14px;">
                        <label class="stepper-field-label">Preferred Date &amp; Time (Eastern Time)</label>
                        <div class="stepper-day-strip" id="modalStepperDayStrip" role="radiogroup" aria-label="Select consultation date" style="margin-bottom: 10px;"></div>
                        <div class="stepper-slot-grid" id="modalTimeSlots" role="radiogroup" aria-label="Select consultation time slot">
                            <button type="button" class="stepper-slot-btn" data-slot="09:30 AM ET" role="radio" aria-checked="false">09:30 AM</button>
                            <button type="button" class="stepper-slot-btn is-active" data-slot="10:30 AM ET" role="radio" aria-checked="true">10:30 AM</button>
                            <button type="button" class="stepper-slot-btn" data-slot="02:00 PM ET" role="radio" aria-checked="false">02:00 PM</button>
                            <button type="button" class="stepper-slot-btn" data-slot="03:30 PM ET" role="radio" aria-checked="false">03:30 PM</button>
                        </div>
                    </div>

                    <!-- Collapsible Optional Note -->
                    <details class="stepper-note-details">
                        <summary class="stepper-note-summary">+ Add clinical note or EHR question (optional)</summary>
                        <textarea id="modal_message" name="message" class="stepper-textarea" aria-label="Anything else we should know before the walkthrough (optional)" placeholder="Tell us about your EHR system, current documentation challenges, or provider count..."></textarea>
                    </details>

                    <!-- Unified Submit CTA -->
                    <button type="submit" class="stepper-btn-submit-unified" id="modalStepperSubmitBtn">
                        Confirm Walkthrough Request <i data-lucide="arrow-right" class="icon-xs"></i>
                    </button>

                    <div class="stepper-trust-note" style="margin-top: 12px; padding: 8px 12px; font-size: 0.78rem;">
                        <i data-lucide="lock" class="icon-xs" style="color: #2563EB;"></i>
                        <span>Confidential &amp; ${isCanadian ? 'PIPEDA' : 'HIPAA'}-compliant. 15-minute practical review.</span>
                    </div>
                </form>

                <!-- Success Screen (Line-Draw Check) -->
                <div id="modalStepperSuccessView" class="stepper-success-view" style="display: none;">
                    <div class="stepper-success-icon-wrap">
                        <svg class="stepper-check-svg" viewBox="0 0 52 52" aria-hidden="true">
                            <circle class="stepper-check-circle" cx="26" cy="26" r="24"/>
                            <path class="stepper-check-path" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <h3 class="stepper-success-title">Consultation Request Received</h3>
                    <p class="stepper-success-copy">
                        Thank you for reaching out, <strong data-modal-success-name>Doctor</strong>. We have received your consultation request for <strong data-modal-success-practice>your clinic</strong>.
                    </p>
                    <div class="stepper-success-details">
                        <div style="margin-bottom: 8px;">
                            <strong>Requested Time:</strong> <span data-modal-success-date>Upcoming business day</span> at <span data-modal-success-time>10:30 AM ET</span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Next Step:</strong> We'll confirm by sending a calendar invitation to <strong data-modal-success-email>your email</strong>.
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Preparation:</strong> An Anot clinical onboarding director will review your workflow requirements prior to the session.
                        </div>
                        <div>
                            <strong>Direct Inquiries:</strong> <a href="mailto:admin@anot.health" style="color: #2563EB; font-weight: 600;">admin@anot.health</a>
                        </div>
                    </div>
                    <div style="margin-top: 24px; text-align: center;">
                        <button type="button" class="btn btn-primary" id="modalSuccessDoneBtn" style="padding: 12px 36px; border-radius: 9px; cursor: pointer;">Done</button>
                    </div>
                </div>
            </div>
        </div>`;

        // Inject modal container into document body
        const injectModal = () => {
            if (document.getElementById('anotContactModal')) return;
            const modalWrapper = document.createElement('div');
            modalWrapper.innerHTML = modalHTML;
            document.body.appendChild(modalWrapper.firstElementChild);

            const modalEl = document.getElementById('anotContactModal');
            const modalForm = document.getElementById('anotModalForm');
            const closeBtn = document.getElementById('anotModalCloseBtn');
            const doneBtn = document.getElementById('modalSuccessDoneBtn');
            const successView = document.getElementById('modalStepperSuccessView');
            const stepperHeader = document.getElementById('modalStepperHeader');
            const submitBtn = document.getElementById('modalStepperSubmitBtn');

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            // 1. Dynamic Business Day Generator (Upcoming 5 Business Days)
            const dayStripContainer = document.getElementById('modalStepperDayStrip');
            const preferredDateInput = document.getElementById('modal_preferred_date');

            function getUpcomingBusinessDays(count = 5) {
                const days = [];
                let curr = new Date();
                if (curr.getHours() >= 16) curr.setDate(curr.getDate() + 1);

                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                while (days.length < count) {
                    const dayOfWeek = curr.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        days.push({
                            dayShort: dayNames[dayOfWeek],
                            dateNum: curr.getDate(),
                            monthShort: monthNames[curr.getMonth()],
                            formattedString: `${fullDayNames[dayOfWeek]}, ${fullMonthNames[curr.getMonth()]} ${curr.getDate()}, ${curr.getFullYear()}`
                        });
                    }
                    curr.setDate(curr.getDate() + 1);
                }
                return days;
            }

            if (dayStripContainer) {
                const businessDays = getUpcomingBusinessDays(5);
                dayStripContainer.innerHTML = '';
                businessDays.forEach((day, index) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `stepper-day-card ${index === 0 ? 'is-active' : ''}`;
                    btn.setAttribute('role', 'radio');
                    btn.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
                    btn.setAttribute('aria-label', day.formattedString);
                    btn.dataset.dateString = day.formattedString;
                    btn.innerHTML = `
                        <span class="stepper-day-name">${day.dayShort}</span>
                        <span class="stepper-day-number">${day.dateNum}</span>
                        <span class="stepper-day-month">${day.monthShort}</span>
                    `;
                    btn.addEventListener('click', () => {
                        dayStripContainer.querySelectorAll('.stepper-day-card').forEach(c => {
                            c.classList.remove('is-active');
                            c.setAttribute('aria-checked', 'false');
                        });
                        btn.classList.add('is-active');
                        btn.setAttribute('aria-checked', 'true');
                        if (preferredDateInput) preferredDateInput.value = day.formattedString;
                    });
                    dayStripContainer.appendChild(btn);
                });
                if (preferredDateInput && businessDays.length > 0) {
                    preferredDateInput.value = businessDays[0].formattedString;
                }
            }

            // 2. Interactive Time Slot Selection
            const timeSlotButtons = Array.from(modalEl.querySelectorAll('.stepper-slot-btn'));
            const timeSlotInput = document.getElementById('modal_time_slot');
            timeSlotButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    timeSlotButtons.forEach(b => {
                        b.classList.remove('is-active');
                        b.setAttribute('aria-checked', 'false');
                    });
                    btn.classList.add('is-active');
                    btn.setAttribute('aria-checked', 'true');
                    if (timeSlotInput) {
                        timeSlotInput.value = btn.dataset.slot || btn.textContent.trim();
                    }
                });
            });

            // 3. Service Selection Chips
            const serviceChips = Array.from(modalEl.querySelectorAll('.stepper-service-chip'));
            const serviceInput = document.getElementById('modal_service');

            serviceChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    serviceChips.forEach(c => {
                        c.classList.remove('is-active');
                        c.setAttribute('aria-checked', 'false');
                    });
                    chip.classList.add('is-active');
                    chip.setAttribute('aria-checked', 'true');
                    const val = chip.dataset.service || '';
                    if (serviceInput) serviceInput.value = val;
                });
            });

            // 4. Validation Helpers
            function clearFieldError(input) {
                if (!input) return;
                input.classList.remove('has-error');
                const err = modalEl.querySelector(`#modal_err_${input.name}`);
                if (err) err.classList.remove('is-visible');
            }

            function showFieldError(input, msg) {
                if (!input) return;
                input.classList.add('has-error');
                const err = modalEl.querySelector(`#modal_err_${input.name}`);
                if (err) {
                    if (msg) err.textContent = msg;
                    err.classList.add('is-visible');
                }
            }

            modalEl.querySelectorAll('input, select, textarea').forEach(inp => {
                inp.addEventListener('input', () => clearFieldError(inp));
                inp.addEventListener('change', () => clearFieldError(inp));
            });

            // Inline blur validation for immediate polite feedback
            const modalNameEl = document.getElementById('modal_name');
            const modalEmailEl = document.getElementById('modal_email');
            const modalPracticeEl = document.getElementById('modal_practice');

            if (modalNameEl) {
                modalNameEl.addEventListener('blur', () => {
                    if (modalNameEl.value.trim().length > 0 && modalNameEl.value.trim().length < 2) {
                        showFieldError(modalNameEl, 'Please enter your full name.');
                    }
                });
            }
            if (modalEmailEl) {
                modalEmailEl.addEventListener('blur', () => {
                    const val = modalEmailEl.value.trim();
                    if (val && !emailRegex.test(val)) {
                        showFieldError(modalEmailEl, 'Please enter a valid work email.');
                    }
                });
            }
            if (modalPracticeEl) {
                modalPracticeEl.addEventListener('blur', () => {
                    const val = modalPracticeEl.value.trim();
                    if (val && val.length < 2) {
                        showFieldError(modalPracticeEl, 'Please enter your clinic or practice name.');
                    }
                });
            }

            function validateForm() {
                let valid = true;
                let firstInvalid = null;

                if (!modalNameEl.value.trim()) {
                    showFieldError(modalNameEl, 'Please enter your name.');
                    valid = false;
                    if (!firstInvalid) firstInvalid = modalNameEl;
                }
                if (!emailRegex.test(modalEmailEl.value.trim())) {
                    showFieldError(modalEmailEl, 'Please enter a valid work email.');
                    valid = false;
                    if (!firstInvalid) firstInvalid = modalEmailEl;
                }
                if (!modalPracticeEl.value.trim()) {
                    showFieldError(modalPracticeEl, 'Please enter your clinic or practice name.');
                    valid = false;
                    if (!firstInvalid) firstInvalid = modalPracticeEl;
                }

                if (firstInvalid) firstInvalid.focus();
                return valid;
            }

            // 5. Modal Open / Close Logic with Focus Trap & Restoration
            let previousActiveElement = null;

            function handleModalKeyDown(e) {
                if (e.key === 'Escape') {
                    closeContactModal();
                    return;
                }
                if (e.key === 'Tab') {
                    const modal = document.getElementById('anotContactModal');
                    if (!modal || !modal.classList.contains('is-open')) return;

                    const focusableSelectors = 'button:not([disabled]):not([style*="display: none"]):not(.is-hidden), [href], input:not([disabled]):not([type="hidden"]):not([style*="display: none"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
                    const focusables = Array.from(modal.querySelectorAll(focusableSelectors))
                        .filter(el => el.offsetParent !== null);

                    if (focusables.length === 0) return;

                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];

                    if (e.shiftKey) {
                        if (document.activeElement === first || !modal.contains(document.activeElement)) {
                            e.preventDefault();
                            last.focus();
                        }
                    } else {
                        if (document.activeElement === last || !modal.contains(document.activeElement)) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }
            }

            function openContactModal(serviceHint) {
                let modal = document.getElementById('anotContactModal');
                if (!modal) {
                    injectModal();
                    modal = document.getElementById('anotContactModal');
                }
                if (!modal) return;

                previousActiveElement = document.activeElement;

                const form = document.getElementById('anotModalForm');
                const success = document.getElementById('modalStepperSuccessView');
                const header = document.getElementById('modalStepperHeader');

                if (success) success.style.display = 'none';
                if (form) form.style.display = 'block';
                if (header) header.style.display = 'block';

                if (serviceHint) {
                    const hintLower = serviceHint.toLowerCase();
                    const chips = Array.from(modal.querySelectorAll('.stepper-service-chip'));
                    const match = chips.find(c => {
                        const sVal = (c.dataset.service || '').toLowerCase();
                        return sVal.includes(hintLower) ||
                               (hintLower.includes('billing') && sVal.includes('billing')) ||
                               (hintLower.includes('coding') && sVal.includes('coding')) ||
                               (hintLower.includes('scrib') && sVal.includes('scrib'));
                    });
                    if (match) {
                        chips.forEach(c => {
                            c.classList.remove('is-active');
                            c.setAttribute('aria-checked', 'false');
                        });
                        match.classList.add('is-active');
                        match.setAttribute('aria-checked', 'true');
                        if (serviceInput) serviceInput.value = match.dataset.service;
                    }
                }

                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                modal.style.display = 'flex';
                document.body.classList.add('anot-modal-locked');
                if (window.lenis) window.lenis.stop();

                document.addEventListener('keydown', handleModalKeyDown);

                setTimeout(() => {
                    const firstInput = document.getElementById('modal_name');
                    if (firstInput) firstInput.focus();
                    refreshIcons();
                }, 60);
            }

            function closeContactModal() {
                const modal = document.getElementById('anotContactModal');
                if (!modal) return;
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                document.body.classList.remove('anot-modal-locked');
                if (window.lenis) window.lenis.start();

                document.removeEventListener('keydown', handleModalKeyDown);

                if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                    previousActiveElement.focus();
                }
            }

            window.openContactModal = openContactModal;
            window.closeContactModal = closeContactModal;

            if (closeBtn) closeBtn.addEventListener('click', closeContactModal);
            if (doneBtn) doneBtn.addEventListener('click', closeContactModal);

            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeContactModal();
            });

            // Prevent modal scroll from propagating to Lenis / background window
            const stopModalScroll = (e) => {
                e.stopPropagation();
            };
            const modalDialogEl = document.getElementById('anotModalDialog');
            if (modalDialogEl) {
                modalDialogEl.addEventListener('wheel', stopModalScroll, { passive: true });
                modalDialogEl.addEventListener('touchmove', stopModalScroll, { passive: true });
            }
            modalEl.addEventListener('wheel', stopModalScroll, { passive: true });
            modalEl.addEventListener('touchmove', stopModalScroll, { passive: true });

            // 6. Form Submission Handler
            if (modalForm) {
                modalForm.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    if (!validateForm()) return;

                    const botCheck = modalForm.querySelector('input[name="botcheck"]');
                    if (botCheck && botCheck.checked) return;

                    const originalBtnHTML = submitBtn.innerHTML;
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `
                        <span style="display:inline-flex; align-items:center; gap:8px;">
                            <span class="spinner" style="width:15px; height:15px; border:2px solid #FFFFFF; border-top-color:transparent; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block;"></span>
                            Scheduling Walkthrough...
                        </span>
                    `;

                    const formData = new FormData(modalForm);
                    const payload = Object.fromEntries(formData.entries());

                    try {
                        const response = await fetch('/api/contact', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });

                        const result = await response.json();
                        if (!response.ok || !result.success) {
                            throw new Error(result.error || 'Submission failed');
                        }

                        if (typeof gtag === 'function') {
                            gtag('event', 'generate_lead', {
                                event_category: 'Consultation Form Modal',
                                event_label: 'Walkthrough Modal'
                            });
                        }

                        if (successView) {
                            const nameSpan = successView.querySelector('[data-modal-success-name]');
                            const practiceSpan = successView.querySelector('[data-modal-success-practice]');
                            const emailSpan = successView.querySelector('[data-modal-success-email]');
                            const dateSpan = successView.querySelector('[data-modal-success-date]');
                            const timeSpan = successView.querySelector('[data-modal-success-time]');

                            if (nameSpan) nameSpan.textContent = payload.name || 'Doctor';
                            if (practiceSpan) practiceSpan.textContent = payload.practice || 'your clinic';
                            if (emailSpan) emailSpan.textContent = payload.email || 'your email';
                            if (dateSpan) dateSpan.textContent = payload.preferred_date || 'Upcoming business day';
                            if (timeSpan) timeSpan.textContent = payload.time_slot || '10:30 AM ET';

                            modalForm.style.display = 'none';
                            if (stepperHeader) stepperHeader.style.display = 'none';
                            successView.style.display = 'block';
                            refreshIcons();
                        }
                    } catch (err) {
                        console.error('Modal submission error:', err);
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnHTML;
                        alert('There was a problem submitting your request. Please try again or email admin@anot.health directly.');
                    }
                });
            }
        };

        // Inject modal into DOM
        if (document.body) {
            injectModal();
        } else {
            document.addEventListener('DOMContentLoaded', injectModal);
        }

        // Layer 1: Click Interceptor (Catches only elements explicitly marked for modal opening)
        document.addEventListener('click', function(e) {
            let el = e.target;
            let link = null;
            while (el && el !== document && el !== document.body) {
                if (el.getAttribute && (el.getAttribute('data-open-contact-modal') === 'true' || el.classList.contains('open-contact-modal'))) {
                    link = el;
                    break;
                }
                el = el.parentElement || el.parentNode;
            }

            if (!link) return;

            const currentPath = window.location.pathname.toLowerCase();
            const onContactPage = currentPath.endsWith('contact.html') || currentPath.endsWith('contact-ca.html') || currentPath.endsWith('/contact') || currentPath.endsWith('/contact-ca');

            if (!onContactPage) {
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                const href = (link.getAttribute('href') || '').toLowerCase();
                let serviceHint = '';
                if (href.includes('service=')) {
                    try {
                        serviceHint = decodeURIComponent(href.split('service=')[1].split('&')[0].split('#')[0]);
                    } catch (err) {}
                } else if (href.includes('focus=')) {
                    try {
                        serviceHint = decodeURIComponent(href.split('focus=')[1].split('&')[0].split('#')[0]);
                    } catch (err) {}
                }

                if (window.openContactModal) {
                    window.openContactModal(serviceHint);
                }
                return false;
            }
        }, true);

        // Layer 2: Bind explicit modal CTA elements directly
        function bindAllContactLinks() {
            const currentPath = window.location.pathname.toLowerCase();
            const onContactPage = currentPath.endsWith('contact.html') || currentPath.endsWith('contact-ca.html') || currentPath.endsWith('/contact') || currentPath.endsWith('/contact-ca');
            if (onContactPage) return;

            document.querySelectorAll('[data-open-contact-modal="true"], .open-contact-modal').forEach(a => {
                a.onclick = function(e) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    let serviceHint = '';
                    const href = (this.getAttribute('href') || '').toLowerCase();
                    if (href.includes('service=')) {
                        try { serviceHint = decodeURIComponent(this.getAttribute('href').split('service=')[1].split('&')[0].split('#')[0]); } catch(err) {}
                    }
                    if (window.openContactModal) {
                        window.openContactModal(serviceHint);
                    }
                    return false;
                };
            });
        }

        bindAllContactLinks();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindAllContactLinks);
        }
        window.addEventListener('load', bindAllContactLinks);
        setTimeout(bindAllContactLinks, 300);
    }
})();










