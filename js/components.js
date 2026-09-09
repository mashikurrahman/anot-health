/**
 * Anot Health - Universal Site Components
 * Injects the shared header, footer, scroll-progress bar, and scroll-top
 * button into every page so they only need to be maintained in one place.
 *
 * Usage: Each HTML page should contain these mount points inside <body>:
 *   <div id="scroll-progress-mount"></div>
 *   <div id="header-mount"></div>
 *   ... page <main> content ...
 *   <div id="footer-mount"></div>
 *   <div id="scroll-top-mount"></div>
 */

(function () {
    'use strict';

    /* Scroll Progress Bar */
    const scrollProgressHTML = `
    <div class="scroll-progress" id="scrollProgress"></div>`;

    /* Site Header */
    const headerHTML = `
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <header class="header" id="siteHeader">
        <div class="header-inner">
            <a href="index.html" class="logo logo-wide"><img src="images/logo-markss.webp?v=202606082127" alt="Anot Health"
                    class="logo-img logo-img-wide" decoding="async"></a>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav"
                aria-label="Open menu">
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
                <span class="nav-toggle-line"></span>
            </button>
            <nav class="nav" id="siteNav">
                <ul class="nav-list">
                    <li class="nav-item"><a href="index.html" class="nav-link">Home</a></li>
                    <li class="nav-item nav-item-dropdown">
                        <button class="nav-link nav-link-dropdown nav-dropdown-toggle" type="button"
                            aria-expanded="false">Services <i data-lucide="chevron-down"
                                class="icon-xs nav-caret"></i></button>
                        <ul class="nav-dropdown">
                            <li><a href="scribing.html" class="nav-dropdown-link">Clinical Documentation</a></li>
                            <li><a href="billing.html" class="nav-dropdown-link">Revenue Cycle</a></li>
                            <li><a href="coding.html" class="nav-dropdown-link">Coding &amp; Compliance</a></li>
                            <li><a href="payroll.html" class="nav-dropdown-link">Payroll Admin</a></li>
                        </ul>
                    </li>
                    <li class="nav-item"><a href="about.html" class="nav-link">About</a></li>
                    <li class="nav-item"><a href="specialties.html" class="nav-link">Specialties</a></li>
                    <li class="nav-item"><a href="contact.html" class="nav-link">Contact</a></li>
                    <li><a href="https://anot-health.vercel.app/login" class="btn btn-outline btn-nav-dashboard" target="_blank" rel="noopener noreferrer">Dashboard</a></li>
                    <li><a href="contact.html" class="btn btn-cyan btn-nav-demo">Get a Demo</a></li>
                </ul>
            </nav>
        </div>
    </header>`;

    /* Site Footer */
    const footerHTML = `
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div>
                    <a href="index.html" class="footer-logo-link footer-logo-link-wide">
                        <img src="images/Logo-anot.webp?v=202606082127" alt="Anot Health" class="footer-logo-img footer-logo-img-wide" loading="lazy" decoding="async">
                    </a>
                    <p class="footer-desc">Expert-led clinical documentation, coding, billing, and payroll support for
                        healthcare teams that demand accuracy, strengthened by advanced AI and human review.</p>
                </div>
                <div>
                    <h4 class="footer-title">Services</h4>
                    <ul class="footer-list">
                        <li><a href="scribing.html" class="footer-link">Clinical Documentation</a></li>
                        <li><a href="billing.html" class="footer-link">Revenue Cycle</a></li>
                        <li><a href="coding.html" class="footer-link">Coding &amp; Compliance</a></li>
                        <li><a href="payroll.html" class="footer-link">Payroll Admin</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="footer-title">Company</h4>
                    <ul class="footer-list">
                        <li><a href="index.html" class="footer-link">Home</a></li>
                        <li><a href="about.html" class="footer-link">About</a></li>
                        <li><a href="specialties.html" class="footer-link">Specialties</a></li>
                        <li><a href="hipaa.html" class="footer-link">Trust Center</a></li>
                        <li><a href="contact.html" class="footer-link">Contact</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="footer-title">Get in Touch</h4>
                    <ul class="footer-list">
                        <li><a href="mailto:admin@anot.health" class="footer-link">admin@anot.health</a></li>
                        <li><a href="contact.html" class="footer-link">Request a demo</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 Anot Health. All rights reserved.</p>
                <div class="footer-legal">
                    <a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="hipaa.html">HIPAA</a>
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
})();







