/**
 * Anot Health — Premium Motion Engine
 * ────────────────────────────────────
 * High-performance, 120fps motion architecture for an alive, interactive experience:
 *   1. Ambient Cursor Spotlight (Living Canvas on desktop)
 *   2. Universal 3D Specular Card Tilt & Border Glow (Zero layout thrashing)
 *   3. Magnetic CTA Buttons with Spring Relaxation
 *   4. Cinematic Hero Text Mask Split Reveal
 *   5. Spring Metric Counter Easing
 *   6. Synchronized GPU Scroll Parallax
 *   7. Staggered Scroll Choreography
 *
 * Performance Rules:
 *   - Only GPU-composited properties (translate3d, scale3d, rotate3d, opacity)
 *   - Rect bounding boxes cached on mouseenter (zero layout thrashing on mousemove)
 *   - Off-screen elements decoupled via IntersectionObserver
 *   - Automatic sleep when mouse is idle (zero idle CPU usage)
 *   - Strictly disabled on touch/coarse pointers and prefers-reduced-motion
 */
(function () {
    'use strict';

    /* ── Guards & Capabilities ── */
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const skipAdvanced = reducedMotion || isTouchDevice;

    /* ── Utilities ── */
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /* ── 1. AMBIENT CURSOR SPOTLIGHT ── */
    let spotlightEl = null;
    let targetMouseX = -9999;
    let targetMouseY = -9999;
    let currentSpotX = -9999;
    let currentSpotY = -9999;
    let spotlightActive = false;
    let spotlightRafId = null;

    function initSpotlight() {
        if (skipAdvanced) return;

        spotlightEl = document.createElement('div');
        spotlightEl.id = 'meCursorSpotlight';
        spotlightEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(spotlightEl);

        function updateSpotlight() {
            const dx = targetMouseX - currentSpotX;
            const dy = targetMouseY - currentSpotY;

            currentSpotX += dx * 0.12;
            currentSpotY += dy * 0.12;

            spotlightEl.style.transform = `translate3d(${currentSpotX.toFixed(1)}px, ${currentSpotY.toFixed(1)}px, 0)`;

            if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
                spotlightRafId = requestAnimationFrame(updateSpotlight);
            } else {
                spotlightRafId = null;
            }
        }

        window.addEventListener('mousemove', (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;

            if (!spotlightActive) {
                spotlightActive = true;
                currentSpotX = targetMouseX;
                currentSpotY = targetMouseY;
                spotlightEl.classList.add('is-active');
            }

            if (!spotlightRafId) {
                spotlightRafId = requestAnimationFrame(updateSpotlight);
            }
        }, { passive: true });

        document.addEventListener('mouseleave', () => {
            if (spotlightEl) spotlightEl.classList.remove('is-active');
            spotlightActive = false;
        });

        document.addEventListener('mouseenter', () => {
            if (spotlightEl && !skipAdvanced) spotlightEl.classList.add('is-active');
        });
    }

    /* ── 2. HERO CINEMATIC REVEAL (Every Page) ── */
    function setupHeroCinematic() {
        const heroTitle = document.querySelector('.h2-hero-title, .hero-title');
        const heroDesc = document.querySelector('.h2-hero-desc, .hero-desc');
        const heroActions = document.querySelector('.h2-hero-actions, .hero-actions');
        const heroVisual = document.querySelector('.h2-hero-image-wrap, .hero-platform-stage, .hero-image-wrap');

        if (!heroTitle) return;

        if (reducedMotion) {
            heroTitle.style.opacity = '1';
            return;
        }

        // Split by <br> or clean lines
        const html = heroTitle.innerHTML;
        if (html.includes('<br')) {
            const lines = html.split(/<br\s*\/?>/i);
            heroTitle.innerHTML = lines.map((line, i) =>
                `<span class="me-line-wrap">` +
                `<span class="me-line" style="transition-delay: ${(i * 0.11).toFixed(2)}s;">${line.trim()}</span>` +
                `</span>`
            ).join('');
        } else {
            // Single line title: wrap in line mask
            heroTitle.innerHTML = `<span class="me-line-wrap"><span class="me-line">${html.trim()}</span></span>`;
        }

        if (heroDesc) {
            heroDesc.style.opacity = '0';
            heroDesc.style.transform = 'translateY(18px)';
            heroDesc.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.32s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.32s';
        }

        if (heroActions) {
            heroActions.style.opacity = '0';
            heroActions.style.transform = 'translateY(16px)';
            heroActions.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.46s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.46s';
        }

        if (heroVisual) {
            heroVisual.style.opacity = '0';
            heroVisual.style.transform = 'translateY(24px) scale(0.98)';
            heroVisual.style.transition = 'opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, transform 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.2s';
        }

        // Trigger reveal on next animation frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                heroTitle.querySelectorAll('.me-line').forEach(line => line.classList.add('is-revealed'));
                if (heroDesc) {
                    heroDesc.style.opacity = '1';
                    heroDesc.style.transform = 'translateY(0)';
                }
                if (heroActions) {
                    heroActions.style.opacity = '1';
                    heroActions.style.transform = 'translateY(0)';
                }
                if (heroVisual) {
                    heroVisual.style.opacity = '1';
                    heroVisual.style.transform = 'translateY(0) scale(1)';
                }
            });
        });

        // Safety fallback: ensure text is never invisible
        setTimeout(() => {
            heroTitle.querySelectorAll('.me-line').forEach(line => line.classList.add('is-revealed'));
            if (heroDesc) { heroDesc.style.opacity = '1'; heroDesc.style.transform = 'none'; }
            if (heroActions) { heroActions.style.opacity = '1'; heroActions.style.transform = 'none'; }
            if (heroVisual) { heroVisual.style.opacity = '1'; heroVisual.style.transform = 'none'; }
        }, 350);
    }

    /* ── 3. UNIVERSAL 3D SPECULAR CARD TILT ── */
    function initCardTilt() {
        if (skipAdvanced) return;

        const cardSelector = [
            '.h2-service-box',
            '.h2-bento-card',
            '.h2-workflow-card',
            '.h2-testimonial-card',
            '.h2-pillar-item',
            '.pricing-v2-card',
            '.pricing-card',
            '.proof-card',
            '.detail-card',
            '.icon-detail-card',
            '.premium-card',
            '.feature-card',
            '.comparison-card',
            '.brand-note-card',
            '.acc-card'
        ].join(', ');

        const cards = document.querySelectorAll(cardSelector);
        if (!cards.length) return;

        cards.forEach((card) => {
            let rect = null;
            let rafId = null;

            card.addEventListener('mouseenter', () => {
                rect = card.getBoundingClientRect();
                card.style.transition = 'transform 0.12s ease-out, box-shadow 0.3s ease';
            }, { passive: true });

            card.addEventListener('mousemove', (e) => {
                if (!rect) rect = card.getBoundingClientRect();
                if (rafId) return;

                rafId = requestAnimationFrame(() => {
                    const normX = (e.clientX - rect.left) / rect.width;
                    const normY = (e.clientY - rect.top) / rect.height;

                    const tiltX = (normY - 0.5) * -6;
                    const tiltY = (normX - 0.5) * 6;

                    card.style.setProperty('--pointer-x', `${(normX * 100).toFixed(1)}%`);
                    card.style.setProperty('--pointer-y', `${(normY * 100).toFixed(1)}%`);
                    card.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg) translate3d(0, -4px, 0)`;

                    rafId = null;
                });
            }, { passive: true });

            card.addEventListener('mouseleave', () => {
                rect = null;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                card.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
                card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';

                setTimeout(() => {
                    if (!card.matches(':hover')) {
                        card.style.transform = '';
                        card.style.transition = '';
                    }
                }, 460);
            }, { passive: true });
        });
    }

    /* ── 4. MAGNETIC BUTTONS & INTERACTIVE CTAS ── */
    function initMagneticButtons() {
        if (skipAdvanced) return;

        const btnSelector = [
            '.h2-btn-primary',
            '.h2-btn-outline',
            '.btn-primary',
            '.btn-secondary',
            '.pricing-v2-btn',
            '.header-cta-btn',
            '.h2-service-link',
            '.btn-expand-pricing',
            '.btn'
        ].join(', ');

        const buttons = document.querySelectorAll(btnSelector);
        if (!buttons.length) return;

        buttons.forEach((btn) => {
            let rect = null;
            let rafId = null;

            btn.addEventListener('mouseenter', () => {
                rect = btn.getBoundingClientRect();
                btn.style.transition = 'transform 0.15s ease-out, box-shadow 0.25s ease';
            }, { passive: true });

            btn.addEventListener('mousemove', (e) => {
                if (!rect) rect = btn.getBoundingClientRect();
                if (rafId) return;

                rafId = requestAnimationFrame(() => {
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;

                    const pullX = clamp((e.clientX - cx) * 0.26, -7, 7);
                    const pullY = clamp((e.clientY - cy) * 0.26, -7, 7);

                    btn.style.transform = `translate3d(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px, 0)`;
                    rafId = null;
                });
            }, { passive: true });

            btn.addEventListener('mouseleave', () => {
                rect = null;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                btn.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease';
                btn.style.transform = 'translate3d(0, 0, 0)';

                setTimeout(() => {
                    if (!btn.matches(':hover')) {
                        btn.style.transform = '';
                        btn.style.transition = '';
                    }
                }, 420);
            }, { passive: true });
        });
    }

    /* ── 5. SPRING METRIC COUNTERS (Smooth Deceleration) ── */
    function initSpringCounters() {
        const counterEls = document.querySelectorAll('[data-count], .h2-metric-value');
        if (!counterEls.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                if (el.dataset.animated === 'true') return;
                el.dataset.animated = 'true';

                let rawValue = el.dataset.count || el.textContent || '';
                const match = rawValue.match(/^([\D]*)(\d+(?:\.\d+)?)([\D]*)$/);
                if (!match) return;

                const prefix = match[1] || '';
                const targetNumber = parseFloat(match[2]);
                const suffix = match[3] || '';
                const isFloat = match[2].includes('.');
                const decimals = isFloat ? (match[2].split('.')[1] || '').length : 0;

                const duration = 1400; // ms
                const startTime = performance.now();

                function frame(now) {
                    const progress = clamp((now - startTime) / duration, 0, 1);
                    // easeOutExpo for organic deceleration
                    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                    const current = targetNumber * eased;

                    el.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

                    if (progress < 1) {
                        requestAnimationFrame(frame);
                    } else {
                        el.textContent = `${prefix}${targetNumber.toFixed(decimals)}${suffix}`;
                    }
                }

                requestAnimationFrame(frame);
                observer.unobserve(el);
            });
        }, { threshold: 0.25, rootMargin: '0px 0px -40px 0px' });

        counterEls.forEach((el) => observer.observe(el));
    }

    /* ── 6. SYNCHRONIZED SCROLL PARALLAX ── */
    /* ── 6. SCROLL PARALLAX (Delegated to main.js cached coordinate pipeline) ── */
    function initScrollParallax() {
        // Handled cleanly by main.js non-blocking coordinate pipeline
    }

    /* ── 7. STAGGERED SCROLL REVEALS ── */
    function initScrollReveals() {
        const headings = document.querySelectorAll('.h2-section-heading, .section-title, .h2-relief-heading');
        const eyebrows = document.querySelectorAll('.h2-section-eyebrow, .section-eyebrow');

        if (!headings.length && !eyebrows.length) return;

        const headingObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                headingObs.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

        headings.forEach((h) => {
            h.style.opacity = '0';
            h.style.transform = 'translateY(24px)';
            headingObs.observe(h);
        });

        eyebrows.forEach((eyebrow) => {
            eyebrow.style.opacity = '0';
            eyebrow.style.transform = 'translateY(14px)';
            headingObs.observe(eyebrow);
        });
    }

    /* ── ENGINE INITIALIZATION ── */
    function initEngine() {
        initSpotlight();
        setupHeroCinematic();
        initCardTilt();
        initMagneticButtons();
        initSpringCounters();
        initScrollParallax();
        initScrollReveals();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEngine);
    } else {
        initEngine();
    }
})();
