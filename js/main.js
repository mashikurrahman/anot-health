document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('motion-enhanced');

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }

    const nav = document.getElementById('siteNav');
    const navToggle = document.querySelector('.nav-toggle');
    const servicesMenu = document.querySelector('.nav-item-dropdown');
    const servicesToggle = document.querySelector('.nav-dropdown-toggle');
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');
    const heroTiltQuery = window.matchMedia('(min-width: 1025px)');
    const servicePages = ['scribing.html', 'billing.html', 'coding.html', 'payroll.html'];
    const trustPages = ['hipaa.html', 'privacy.html', 'terms.html'];
    const contentPages = ['about.html', 'specialties.html', 'contact.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const currentHash = window.location.hash;
    const siteEmail = 'admin@anot.health';
    const siteDomain = 'anot.health';
    const scrollTopButton = document.getElementById('scrollTopButton');
    const videoModal = document.getElementById('heroVideoModal');
    const videoPlayer = document.getElementById('heroVideoPlayer');
    const heroPlatformStage = document.querySelector('.hero-platform-stage');
    const heroMobileSlider = document.querySelector('[data-hero-mobile-slider]');
    const heroMobileTrack = heroMobileSlider?.querySelector('[data-hero-mobile-track]');
    const heroMobileDots = heroMobileSlider ? Array.from(heroMobileSlider.querySelectorAll('[data-hero-dot]')) : [];
    const heroMobilePrev = heroMobileSlider?.querySelector('[data-hero-prev]');
    const heroMobileNext = heroMobileSlider?.querySelector('[data-hero-next]');
    const deferredHeroShots = Array.from(document.querySelectorAll('.hero-platform-shot[data-src]'));
    const workflowStory = document.querySelector('[data-workflow-story]');
    const useLightweightMode = mobileQuery.matches || coarsePointerQuery.matches || reducedMotionQuery.matches;
    let lastVideoTrigger = null;

    document.body.classList.toggle('touch-optimized', useLightweightMode);
    if (heroPlatformStage) {
        heroPlatformStage.dataset.lightweight = String(useLightweightMode);
    }

    if (!useLightweightMode && deferredHeroShots.length) {
        deferredHeroShots.forEach((image) => {
            if (!image.getAttribute('src')) {
                image.setAttribute('src', image.dataset.src);
            }
        });
    }

    if (heroMobileSlider && heroMobileTrack && heroMobileDots.length) {
        const updateHeroMobileDots = (index) => {
            heroMobileDots.forEach((dot, dotIndex) => {
                const isActive = dotIndex === index;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-selected', String(isActive));
            });
        };

        const heroMobileSlides = Array.from(heroMobileTrack.children);
        const getHeroMobileIndex = () => {
            const slideWidth = heroMobileTrack.clientWidth || heroMobileSlides[0]?.clientWidth || 1;
            return Math.max(0, Math.min(heroMobileSlides.length - 1, Math.round(heroMobileTrack.scrollLeft / slideWidth)));
        };

        const scrollHeroMobileTo = (index) => {
            const safeIndex = Math.max(0, Math.min(heroMobileSlides.length - 1, index));
            const slide = heroMobileSlides[safeIndex];
            if (!slide) {
                return;
            }
            heroMobileTrack.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
            updateHeroMobileDots(safeIndex);
        };

        heroMobileDots.forEach((dot) => {
            dot.addEventListener('click', () => {
                scrollHeroMobileTo(Number(dot.dataset.heroDot || 0));
            });
        });

        heroMobilePrev?.addEventListener('click', () => {
            scrollHeroMobileTo(getHeroMobileIndex() - 1);
        });

        heroMobileNext?.addEventListener('click', () => {
            scrollHeroMobileTo(getHeroMobileIndex() + 1);
        });

        heroMobileTrack.addEventListener('scroll', () => {
            updateHeroMobileDots(getHeroMobileIndex());
        }, { passive: true });

        window.addEventListener('resize', () => {
            if (mobileQuery.matches) {
                updateHeroMobileDots(getHeroMobileIndex());
            }
        });

        updateHeroMobileDots(0);
    }

    function setServicesExpanded(expanded) {
        if (!servicesMenu || !servicesToggle) return;
        servicesMenu.classList.toggle('is-open', expanded);
        servicesToggle.setAttribute('aria-expanded', String(expanded));
    }

    function setNavExpanded(expanded) {
        if (!nav || !navToggle) return;
        nav.classList.toggle('is-open', expanded);
        navToggle.classList.toggle('is-open', expanded);
        navToggle.setAttribute('aria-expanded', String(expanded));
    }

    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            const expanded = navToggle.getAttribute('aria-expanded') === 'true';
            setNavExpanded(!expanded);
            if (expanded) {
                setServicesExpanded(false);
            }
        });
    }

    if (servicesToggle && servicesMenu) {
        servicesToggle.addEventListener('click', () => {
            const expanded = servicesToggle.getAttribute('aria-expanded') === 'true';
            setServicesExpanded(!expanded);
        });
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
        const clickedInsideHeader = target.closest('.header-inner');

        if (!clickedInsideHeader) {
            setNavExpanded(false);
            setServicesExpanded(false);
            return;
        }

        if (servicesMenu && !target.closest('.nav-item-dropdown')) {
            setServicesExpanded(false);
        }
    });

    document.querySelectorAll('.nav a').forEach((link) => {
        link.addEventListener('click', () => {
            if (mobileQuery.matches) {
                setNavExpanded(false);
                setServicesExpanded(false);
            }
        });
    });

    function setActiveLinks(selector, matchHref) {
        document.querySelectorAll(selector).forEach((link) => {
            if (link.getAttribute('href') === matchHref) {
                link.classList.add('active');
                if (link.matches('.nav-link')) {
                    link.setAttribute('aria-current', 'page');
                }
            }
        });
    }

    if (currentPage === 'index.html') {
        if (currentHash === '#services') {
            servicesToggle?.classList.add('active');
        } else {
            setActiveLinks('.nav-link, .footer-link', 'index.html');
        }
    } else {
        setActiveLinks('.nav-link, .footer-link', currentPage);
    }

    if (servicePages.includes(currentPage)) {
        servicesToggle?.classList.add('active');
        document.querySelectorAll('.nav-dropdown-link, .footer-link').forEach((link) => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            }
        });
    }

    if (trustPages.includes(currentPage)) {
        setActiveLinks('.nav-link, .footer-link', 'hipaa.html');
    }

    window.addEventListener('resize', () => {
        if (!mobileQuery.matches) {
            setNavExpanded(false);
            setServicesExpanded(false);
        }
    });

    if (finePointerQuery.matches && !useLightweightMode) {
        const magneticBtns = document.querySelectorAll('.btn');
        magneticBtns.forEach((btn) => {
            btn.addEventListener('mousemove', (event) => {
                const rect = btn.getBoundingClientRect();
                const x = event.clientX - rect.left - rect.width / 2;
                const y = event.clientY - rect.top - rect.height / 2;
                const maxOffset = 6;
                const tx = Math.max(-maxOffset, Math.min(maxOffset, x * 0.12));
                const ty = Math.max(-maxOffset, Math.min(maxOffset, y * 0.12));
                btn.style.transform = `translate(${tx}px, ${ty}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translate(0px, 0px)';
            });
        });
    }

    const scrollProgress = document.getElementById('scrollProgress');
    const siteHeader = document.getElementById('siteHeader');
    function handleScrollUi() {
        const h = document.documentElement;
        if (scrollProgress) {
            scrollProgress.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + '%';
        }
        if (siteHeader) {
            siteHeader.classList.toggle('scrolled', window.scrollY > 30);
        }
        if (scrollTopButton) {
            scrollTopButton.classList.toggle('is-visible', window.scrollY > 320);
        }
    }

    window.addEventListener('scroll', handleScrollUi, { passive: true });
    handleScrollUi();

    if (scrollTopButton) {
        scrollTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const staggerGroups = document.querySelectorAll('.card-grid, .proof-grid, .audience-grid, .implementation-grid, .faq-grid, .icon-detail-grid, .contact-support-grid, .legal-summary-grid, .stat-band');
    staggerGroups.forEach((group) => {
        group.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((el, index) => {
            if (useLightweightMode) {
                el.style.transitionDelay = '0s';
            } else if (!el.classList.contains('delay-100') && !el.classList.contains('delay-200') && !el.classList.contains('delay-300')) {
                el.style.transitionDelay = `${Math.min(index * 0.08, 0.32)}s`;
            }
        });
    });

    const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (useLightweightMode) {
        revealEls.forEach((el) => {
            el.classList.add('visible');
            el.classList.remove('scrolled-past');
        });
    }
    if (!useLightweightMode) {
        const revealObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    entry.target.classList.remove('scrolled-past');
                } else if (entry.boundingClientRect.top < 0) {
                    entry.target.classList.add('scrolled-past');
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        revealEls.forEach((el) => revealObs.observe(el));
    }

    const spotlightEls = document.querySelectorAll('.video-spotlight');
    if (useLightweightMode) {
        spotlightEls.forEach((el) => el.classList.add('is-active'));
    } else {
        const spotlightObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle('is-active', entry.isIntersecting);
            });
        }, { threshold: 0.35 });
        spotlightEls.forEach((el) => spotlightObs.observe(el));
    }

    const stagedGroups = document.querySelectorAll('[data-stage-group]');
    if (useLightweightMode) {
        stagedGroups.forEach((group) => {
            group.dataset.played = 'true';
            group.querySelectorAll('[data-stage-item]').forEach((item) => item.classList.add('is-active'));
        });
    } else {
        const stagedObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const group = entry.target;
                if (group.dataset.played === 'true') return;
                group.dataset.played = 'true';
                const items = Array.from(group.querySelectorAll('[data-stage-item]'));
                items.forEach((item, index) => {
                    const activate = () => item.classList.add('is-active');
                    if (reducedMotionQuery.matches) {
                        activate();
                    } else {
                        window.setTimeout(activate, index * 140);
                    }
                });
            });
        }, { threshold: 0.28 });
        stagedGroups.forEach((group) => stagedObs.observe(group));
    }

    if (workflowStory) {
        const workflowSteps = Array.from(workflowStory.querySelectorAll('[data-workflow-step]'));
        const workflowChips = Array.from(workflowStory.querySelectorAll('[data-workflow-chip]'));
        if (useLightweightMode) {
            workflowStory.dataset.played = 'true';
            workflowStory.classList.add('is-active');
            workflowSteps.forEach((step, index) => {
                step.classList.add('is-active');
                workflowChips[index]?.classList.add('is-active');
            });
        } else {
            const workflowObs = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (workflowStory.dataset.played === 'true') return;
                    workflowStory.dataset.played = 'true';
                    workflowStory.classList.add('is-active');
                    workflowSteps.forEach((step, index) => {
                        const activate = () => {
                            step.classList.add('is-active');
                            workflowChips[index]?.classList.add('is-active');
                        };
                        if (reducedMotionQuery.matches) {
                            activate();
                        } else {
                            window.setTimeout(activate, index * 180);
                        }
                    });
                });
            }, { threshold: 0.3 });
            workflowObs.observe(workflowStory);
        }
    }

    const parallaxItems = document.querySelectorAll('.parallax-layer, .synergy-wrap');
    let tick = false;

    function updateParallax() {
        const scrolled = window.pageYOffset;
        const winH = window.innerHeight;

        parallaxItems.forEach((el) => {
            const offset = el.offsetTop;
            const distance = scrolled - offset;
            if (Math.abs(distance) < winH * 1.5) {
                const speed = parseFloat(el.dataset.speed) || 0.05;
                el.style.transform = `translate3d(0, ${distance * speed}px, 0)`;
            }
        });
        tick = false;
    }

    if (!useLightweightMode && parallaxItems.length) {
        window.addEventListener('scroll', () => {
            if (!tick) {
                requestAnimationFrame(updateParallax);
                tick = true;
            }
        }, { passive: true });
    }

    const autoVideos = Array.from(document.querySelectorAll('[data-auto-video]'));
    if (autoVideos.length) {
        const syncVideoPlayback = async (video, shouldPlay) => {
            if (!shouldPlay) {
                video.pause();
                return;
            }
            try {
                await video.play();
            } catch (error) {
                /* autoplay may be blocked; poster/fallback remains visible */
            }
        };

        if (useLightweightMode) {
            autoVideos.forEach((video) => {
                video.pause();
                video.removeAttribute('autoplay');
                video.preload = 'none';
            });
        } else {
            const autoVideoObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    syncVideoPlayback(entry.target, entry.isIntersecting);
                });
            }, { threshold: 0.35 });

            autoVideos.forEach((video) => {
                video.preload = video.dataset.preload || 'metadata';
                autoVideoObserver.observe(video);
            });
        }
    }

    if (heroPlatformStage && finePointerQuery.matches && !useLightweightMode) {
        heroPlatformStage.addEventListener('mousemove', (event) => {
            if (!heroTiltQuery.matches) return;
            const rect = heroPlatformStage.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;
            heroPlatformStage.style.setProperty('--hero-motion-x', `${x * 0.08}px`);
            heroPlatformStage.style.setProperty('--hero-motion-y', `${y * 0.05}px`);
            const tiltX = Math.max(-5, Math.min(5, (x / rect.width) * 9));
            const tiltY = Math.max(-4, Math.min(4, (y / rect.height) * 8));
            heroPlatformStage.style.setProperty('--hero-tilt-x', `${tiltX}deg`);
            heroPlatformStage.style.setProperty('--hero-tilt-y', `${tiltY * -1}deg`);
        });

        heroPlatformStage.addEventListener('mouseleave', () => {
            heroPlatformStage.style.setProperty('--hero-motion-x', '0px');
            heroPlatformStage.style.setProperty('--hero-motion-y', '0px');
            heroPlatformStage.style.setProperty('--hero-tilt-x', '0deg');
            heroPlatformStage.style.setProperty('--hero-tilt-y', '0deg');
        });
    }

    const motionSurfaces = document.querySelectorAll('.premium-card, .proof-card, .detail-card, .implementation-step, .faq-item, .surface-panel, .hero-platform-shell, .icon-detail-card, .legal-summary-card, .contact-support-card, .trust-strip-item, .stat-band-item, .step-row, .metric-chip, .comparison-card, .explorer-panel, .explorer-metric, .conversion-card, .brand-note-card, .brand-focus-item');
    motionSurfaces.forEach((surface) => {
        surface.classList.add('motion-surface');
        if (finePointerQuery.matches && !useLightweightMode) {
            surface.addEventListener('mousemove', (event) => {
                const rect = surface.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 100;
                const y = ((event.clientY - rect.top) / rect.height) * 100;
                surface.style.setProperty('--pointer-x', `${x}%`);
                surface.style.setProperty('--pointer-y', `${y}%`);
            });
        }
    });

    const toggleGroups = document.querySelectorAll('[data-toggle-group]');
    toggleGroups.forEach((group) => {
        const buttons = Array.from(group.querySelectorAll('[data-toggle-button]'));
        const panels = Array.from(group.querySelectorAll('[data-toggle-panel]'));
        if (!buttons.length || !panels.length) return;

        const setActivePanel = (target) => {
            buttons.forEach((button) => {
                const isActive = button.dataset.toggleButton === target;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-selected', String(isActive));
            });

            panels.forEach((panel) => {
                const isActive = panel.dataset.togglePanel === target;
                panel.classList.toggle('is-active', isActive);
                panel.hidden = !isActive;
            });
        };

        const initialTarget = buttons.find((button) => button.classList.contains('is-active'))?.dataset.toggleButton
            || panels.find((panel) => !panel.hidden)?.dataset.togglePanel
            || buttons[0].dataset.toggleButton;

        setActivePanel(initialTarget);

        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                setActivePanel(button.dataset.toggleButton || initialTarget);
            });
        });
    });

    const counterObs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const format = el.dataset.format || 'plain';
            if (target === 0) {
                el.textContent = '0';
                counterObs.unobserve(el);
                return;
            }

            const duration = 1500;
            const startTime = performance.now();

            function step(timestamp) {
                const progress = Math.min((timestamp - startTime) / duration, 1);
                const current = Math.floor(progress * target);
                if (format === 'compact') {
                    el.textContent = `${(current / 1000000).toFixed(1)}M+`;
                } else if (format === 'plus') {
                    el.textContent = `${current}+`;
                } else if (format === 'percent') {
                    el.textContent = `${current}%`;
                } else {
                    el.textContent = `${current}`;
                }
                if (progress < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
            counterObs.unobserve(el);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach((el) => counterObs.observe(el));

    const typingDemo = document.querySelector('[data-typing-demo]');
    if (typingDemo) {
        const lines = Array.from(typingDemo.querySelectorAll('[data-typing-text]'));
        const statusCopy = typingDemo.querySelector('[data-typing-status-copy]');
        const listeningPill = typingDemo.querySelector('.typing-status-pill.is-listening');
        const processingPill = typingDemo.querySelector('.typing-status-pill.is-processing');
        const reviewPill = typingDemo.querySelector('.typing-status-pill.is-review');

        const setCurrentPill = (pill) => {
            [listeningPill, processingPill, reviewPill].forEach((item) => item?.classList.remove('is-current'));
            pill?.classList.add('is-current');
        };

        const typeLine = (line, text, speed = 18) => new Promise((resolve) => {
            let index = 0;
            line.textContent = '';
            line.classList.add('is-typing');
            const tickTyping = () => {
                line.textContent = text.slice(0, index);
                index += 1;
                if (index <= text.length) {
                    window.setTimeout(tickTyping, speed);
                    return;
                }
                line.classList.remove('is-typing');
                line.classList.add('is-typed');
                resolve();
            };
            tickTyping();
        });

        const runTypingDemo = async () => {
            if (typingDemo.dataset.played === 'true') return;
            typingDemo.dataset.played = 'true';
            setCurrentPill(listeningPill);
            if (statusCopy) statusCopy.textContent = 'Listening and preparing a first-pass note.';
            if (reducedMotionQuery.matches) {
                lines.forEach((line) => {
                    line.textContent = line.dataset.typingText || '';
                    line.classList.add('is-typed');
                });
                setCurrentPill(reviewPill);
                typingDemo.classList.add('is-complete');
                if (statusCopy) statusCopy.textContent = 'Validated note ready for clinician sign-off.';
                return;
            }

            window.setTimeout(() => setCurrentPill(processingPill), 420);
            for (const line of lines) {
                const text = line.dataset.typingText || '';
                await typeLine(line, text);
                await new Promise((resolve) => window.setTimeout(resolve, 240));
            }
            setCurrentPill(reviewPill);
            typingDemo.classList.add('is-complete');
            if (statusCopy) statusCopy.textContent = 'Validated note ready for clinician sign-off.';
        };

        const typingObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                runTypingDemo();
            });
        }, { threshold: 0.35 });
        typingObs.observe(typingDemo);
    }

    if (videoModal) {
        const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

        const trapFocus = (event) => {
            if (videoModal.hidden) return;
            const focusable = Array.from(videoModal.querySelectorAll(FOCUSABLE));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    if (document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        const closeVideoModal = () => {
            videoModal.hidden = true;
            videoModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('video-modal-open');
            if (videoPlayer) {
                videoPlayer.pause();
                videoPlayer.currentTime = 0;
            }
            lastVideoTrigger?.focus?.();
        };

        document.querySelectorAll('[data-video-open]').forEach((trigger) => {
            trigger.addEventListener('click', async () => {
                lastVideoTrigger = trigger;
                videoModal.hidden = false;
                videoModal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('video-modal-open');
                if (window.lucide?.createIcons) {
                    window.lucide.createIcons();
                }
                // Move focus into the modal
                const closeBtn = videoModal.querySelector('.video-modal-close');
                closeBtn?.focus();
                if (videoPlayer) {
                    try {
                        await videoPlayer.play();
                    } catch (error) {
                        /* autoplay may be blocked; controls remain available */
                    }
                }
            });
        });

        videoModal.querySelectorAll('[data-video-close]').forEach((closer) => {
            closer.addEventListener('click', closeVideoModal);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !videoModal.hidden) {
                closeVideoModal();
                return;
            }
            trapFocus(event);
        });
    }

    const demoRequestForm = document.querySelector('[data-demo-form]');
    if (demoRequestForm) {
        const formStatus = demoRequestForm.querySelector('[data-form-status]');
        const formTitle = demoRequestForm.querySelector('[data-form-title]');
        const formSubtitle = demoRequestForm.querySelector('[data-form-subtitle]');
        const formContext = demoRequestForm.querySelector('[data-form-context]');
        const contextTitle = demoRequestForm.querySelector('[data-context-title]');
        const contextCopy = demoRequestForm.querySelector('[data-context-copy]');
        const serviceField = demoRequestForm.querySelector('#service');
        const messageField = demoRequestForm.querySelector('#message');
        const focusField = demoRequestForm.querySelector('[data-focus-field]');
        const subjectField = demoRequestForm.querySelector('[data-subject-field]');
        const submitButton = demoRequestForm.querySelector('[data-form-submit]') || demoRequestForm.querySelector('button[type="submit"]');
        const intentButtons = Array.from(demoRequestForm.querySelectorAll('[data-intent-button]'));
        const defaultStatus = formStatus?.textContent || '';
        const defaultSubtitle = formSubtitle?.textContent || '';
        const defaultSubmitLabel = submitButton?.textContent || '';
        const demoIntentConfig = {
            documentation: {
                title: 'Request Your Clinical Documentation Demo',
                subtitle: 'We will tailor the walkthrough around documentation volume, note readiness, and provider relief.',
                contextTitle: 'Clinical documentation walkthrough',
                contextCopy: 'Best for practices trying to reduce chart backlog, after-hours note cleanup, and sign-off friction.',
                message: 'We want to reduce after-hours charting and improve note turnaround for our team.',
                submitLabel: 'Book Documentation Demo'
            },
            billing: {
                title: 'Request Your Revenue Cycle Demo',
                subtitle: 'We will focus the conversation on claim readiness, denials, and time-to-paid performance.',
                contextTitle: 'Revenue cycle walkthrough',
                contextCopy: 'Best for teams trying to tighten claim submission quality, reduce preventable denials, and protect cash flow.',
                message: 'We want to reduce denials and speed up cash flow without lowering review quality.',
                submitLabel: 'Book Revenue Demo'
            },
            coding: {
                title: 'Request Your Coding & Compliance Demo',
                subtitle: 'We will tailor the walkthrough around coding specificity, audit confidence, and cleaner reimbursement logic.',
                contextTitle: 'Coding and compliance walkthrough',
                contextCopy: 'Best for practices that need stronger coding accuracy, review confidence, and compliance-minded support.',
                message: 'We want to improve coding accuracy and give our team more confidence before claims go out.',
                submitLabel: 'Book Coding Demo'
            },
            payroll: {
                title: 'Request Your Payroll Administration Demo',
                subtitle: 'We will show how Anot supports verified hours, provider compensation inputs, and cleaner payroll cycles.',
                contextTitle: 'Payroll administration walkthrough',
                contextCopy: 'Best for groups trying to stabilize provider payroll inputs, reconciliation, and finance handoffs.',
                message: 'We want to stabilize provider payroll and reduce reconciliation work for our finance team.',
                submitLabel: 'Book Payroll Demo'
            },
            multiple: {
                title: 'Request Your Anot Demo',
                subtitle: 'We will shape the walkthrough around the connected workflows your team needs to improve first.',
                contextTitle: 'Multi-service walkthrough',
                contextCopy: 'Best for operators evaluating documentation, coding, billing, and payroll as one connected operating model.',
                message: 'We want to understand how Anot can improve several connected workflows across our practice.',
                submitLabel: 'Book Your Pilot Demo'
            }
        };

        function humanizeFocus(value) {
            return String(value || '')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());
        }

        function setSuggestedMessage(nextMessage) {
            if (!messageField || !nextMessage) return;
            const previousAuto = messageField.dataset.autoValue || '';
            const currentValue = messageField.value.trim();
            if (!currentValue || currentValue === previousAuto) {
                messageField.value = nextMessage;
                messageField.dataset.autoValue = nextMessage;
            }
        }

        function setIntent(service, focus = '') {
            const config = demoIntentConfig[service] || demoIntentConfig.multiple;
            const focusLabel = humanizeFocus(focus);
            const contextLine = focusLabel
                ? `${config.contextCopy} Current goal: ${focusLabel}.`
                : config.contextCopy;
            const suggestedMessage = focusLabel
                ? `We want to ${String(focus).replace(/-/g, ' ')}.`
                : config.message;

            demoRequestForm.dataset.selectedService = service;
            demoRequestForm.dataset.selectedFocus = focus;

            if (serviceField && Array.from(serviceField.options).some((option) => option.value === service)) {
                serviceField.value = service;
            }
            if (focusField) {
                focusField.value = focusLabel || 'General walkthrough';
            }

            if (formTitle) formTitle.textContent = config.title;
            if (formSubtitle) formSubtitle.textContent = config.subtitle;
            if (formContext) formContext.hidden = false;
            if (contextTitle) contextTitle.textContent = config.contextTitle;
            if (contextCopy) contextCopy.textContent = contextLine;
            if (submitButton) submitButton.textContent = config.submitLabel || defaultSubmitLabel;
            if (formStatus) {
                formStatus.textContent = focusLabel
                    ? `We will tailor the walkthrough around ${focusLabel.toLowerCase()}.`
                    : defaultStatus;
            }

            setSuggestedMessage(suggestedMessage);

            intentButtons.forEach((button) => {
                const isActive = button.dataset.service === service;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        intentButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setIntent(button.dataset.service || 'multiple', button.dataset.focus || '');
            });
        });

        const searchParams = new URLSearchParams(window.location.search);
        const serviceParam = String(searchParams.get('service') || '').trim();
        const focusParam = String(searchParams.get('focus') || '').trim();
        if (serviceParam && demoIntentConfig[serviceParam]) {
            setIntent(serviceParam, focusParam);
        } else if (formSubtitle) {
            formSubtitle.textContent = defaultSubtitle;
        }

        function syncContactFormMeta() {
            if (focusField) {
                focusField.value = humanizeFocus(demoRequestForm.dataset.selectedFocus || '') || 'General walkthrough';
            }
        }

        function buildContactSubject(formData) {
            return `New Demo Request: ${String(formData.get('practice') || formData.get('name') || 'Visitor').trim() || 'Visitor'}`;
        }

        syncContactFormMeta();

        demoRequestForm.addEventListener('submit', async (event) => {
            const provider = String(demoRequestForm.dataset.submitProvider || '').trim().toLowerCase();
            if (!provider) {
                return;
            }
            event.preventDefault();

            const submitBtn = submitButton || demoRequestForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit Request';
            syncContactFormMeta();
            const formData = new FormData(demoRequestForm);
            if (subjectField) {
                subjectField.value = buildContactSubject(formData);
                formData.set(subjectField.name || '_subject', subjectField.value);
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i data-lucide="loader-2" class="icon-sm" style="animation: spin 1s linear infinite;"></i> Sending...';
            }
            if (formStatus) {
                formStatus.textContent = 'Sending your request...';
            }
            if (window.lucide?.createIcons) {
                window.lucide.createIcons();
            }

            try {
                let response;
                let result = {};

                if (provider === 'backend') {
                    const endpoint = demoRequestForm.dataset.apiEndpoint || demoRequestForm.getAttribute('action') || '/api/contact';
                    const payload = Object.fromEntries(formData.entries());
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    result = await response.json();
                } else if (provider === 'web3forms') {
                    response = await fetch('https://api.web3forms.com/submit', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json'
                        },
                        body: formData
                    });
                    result = await response.json();
                } else {
                    throw new Error('Unsupported form provider.');
                }

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Submission failed.');
                }

                if (formStatus) {
                    formStatus.innerHTML = `<div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.24); padding: 18px; border-radius: 16px; color: #047857; font-weight: 600; display: flex; align-items: flex-start; gap: 12px; line-height: 1.6;"><i data-lucide="check-circle-2" class="icon-md"></i><div><strong style="display:block; margin-bottom:4px;">Success!</strong>Your demo request was submitted successfully. Our team will contact you within 1 business day.</div></div>`;
                }
                demoRequestForm.reset();
                syncContactFormMeta();
                formStatus?.focus();
                formStatus?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                if (window.lucide?.createIcons) {
                    window.lucide.createIcons();
                }
            } catch (error) {
                console.error('Contact form submission failed.', error);
                if (formStatus) {
                    formStatus.innerHTML = `<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.18); padding: 16px; border-radius: 12px; color: #b91c1c; font-size: 0.95rem; line-height: 1.6;">There was a problem sending your request. Please try again or email us directly at <strong>${siteEmail}</strong>.</div>`;
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    }

    // --- Smooth Page Transitions ---
    // Allows cross-page links with anchor hashes (e.g. contact.html#demo-form)
    const isLocalLink = (link) => {
        return link.hostname === window.location.hostname &&
               link.pathname !== window.location.pathname &&
               link.target !== '_blank' &&
               !link.hasAttribute('download') &&
               !link.href.startsWith('mailto:');
    };

    document.querySelectorAll('a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (isLocalLink(this) && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                const targetUrl = this.href;
                document.body.classList.add('page-transitioning-out');
                
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300); // Wait for CSS fade out animation
            }
        });
    });
});
