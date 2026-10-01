/**
 * Anot Health - High-Efficiency Clinical Consultation Form Controller
 * Streamlined 1-screen consultation booking for contact.html & contact-ca.html.
 * Handles dynamic 5-day business strip, quick time slot selector, service chips,
 * instant field validation, and AJAX submission with personalized checkmark confirmation.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#stepperForm');
    if (!form) return;

    const submitBtn = document.querySelector('#stepperSubmitBtn');
    const successView = document.querySelector('#stepperSuccessView');
    const stepperHeader = document.querySelector('.stepper-header');

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ----------------------------------------------------
    // 1. Dynamic Business Day Generator (Upcoming 5 Business Days)
    // ----------------------------------------------------
    const dayStripContainer = document.querySelector('#stepperDayStrip');
    const preferredDateInput = form.querySelector('#preferred_date');

    function getUpcomingBusinessDays(count = 5) {
        const days = [];
        let curr = new Date();
        // If current hour is past 4 PM, advance to tomorrow
        if (curr.getHours() >= 16) {
            curr.setDate(curr.getDate() + 1);
        }

        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        while (days.length < count) {
            const dayOfWeek = curr.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Saturday & Sunday
                days.push({
                    dayShort: dayNames[dayOfWeek],
                    dayFull: fullDayNames[dayOfWeek],
                    dateNum: curr.getDate(),
                    monthShort: monthNames[curr.getMonth()],
                    monthFull: fullMonthNames[curr.getMonth()],
                    year: curr.getFullYear(),
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
                if (preferredDateInput) {
                    preferredDateInput.value = day.formattedString;
                }
            });

            dayStripContainer.appendChild(btn);
        });

        // Default set to first business day
        if (preferredDateInput && businessDays.length > 0) {
            preferredDateInput.value = businessDays[0].formattedString;
        }
    }

    // ----------------------------------------------------
    // 2. Interactive Time Slot Selection
    // ----------------------------------------------------
    const timeSlotButtons = Array.from(form.querySelectorAll('.stepper-slot-btn'));
    const timeSlotInput = form.querySelector('#time_slot');

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

    // ----------------------------------------------------
    // 3. Compact Service Chips Selection
    // ----------------------------------------------------
    const serviceChips = Array.from(form.querySelectorAll('.stepper-service-chip, .stepper-service-card'));
    const serviceInput = form.querySelector('#service');

    serviceChips.forEach(chip => {
        chip.addEventListener('click', () => {
            serviceChips.forEach(c => {
                c.classList.remove('is-active');
                c.setAttribute('aria-checked', 'false');
            });
            chip.classList.add('is-active');
            chip.setAttribute('aria-checked', 'true');

            const val = chip.dataset.service || chip.textContent.trim();
            if (serviceInput) {
                serviceInput.value = val;
                clearFieldError(serviceInput);
            }
        });
    });

    // URL parameter pre-selection for service (e.g. ?service=billing)
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = (urlParams.get('service') || '').toLowerCase();
    if (serviceParam && serviceChips.length > 0) {
        const matchingChip = serviceChips.find(c => (c.dataset.service || c.textContent).toLowerCase().includes(serviceParam));
        if (matchingChip) {
            serviceChips.forEach(c => {
                c.classList.remove('is-active');
                c.setAttribute('aria-checked', 'false');
            });
            matchingChip.classList.add('is-active');
            matchingChip.setAttribute('aria-checked', 'true');
            if (serviceInput) {
                serviceInput.value = matchingChip.dataset.service || matchingChip.textContent.trim();
            }
        }
    }

    // ----------------------------------------------------
    // 4. Validation Engine
    // ----------------------------------------------------
    function clearFieldError(input) {
        if (!input) return;
        input.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
        const parent = input.closest('.stepper-field') || input.parentElement;
        const errEl = parent ? parent.querySelector('.stepper-field-error') : null;
        if (errEl) {
            errEl.classList.remove('is-visible');
            errEl.textContent = '';
        }
    }

    function showFieldError(input, message) {
        if (!input) return;
        input.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
        const parent = input.closest('.stepper-field') || input.parentElement;
        let errEl = parent ? parent.querySelector('.stepper-field-error') : null;
        if (!errEl && parent) {
            errEl = document.createElement('div');
            errEl.className = 'stepper-field-error';
            errEl.id = `err_${input.id || Math.random().toString(36).substring(2, 6)}`;
            parent.appendChild(errEl);
        }
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.add('is-visible');
            input.setAttribute('aria-describedby', errEl.id);
        }
    }

    function validateField(input) {
        if (!input) return true;
        const val = input.value.trim();
        const isRequired = input.hasAttribute('required');

        if (isRequired && !val) {
            showFieldError(input, 'This field is required.');
            return false;
        }

        if (input.type === 'email' && val) {
            if (!emailRegex.test(val)) {
                showFieldError(input, 'Please enter a valid work email address.');
                return false;
            }
        }

        clearFieldError(input);
        return true;
    }

    // Live and blur validation listeners
    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => clearFieldError(input));
        input.addEventListener('change', () => clearFieldError(input));
        input.addEventListener('blur', () => {
            if (input.value.trim().length > 0) {
                validateField(input);
            }
        });
    });

    function validateEntireForm() {
        const inputs = Array.from(form.querySelectorAll('input[required], select[required], textarea[required]'));
        let isValid = true;
        let firstInvalid = null;

        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
                if (!firstInvalid) firstInvalid = input;
            }
        });

        if (firstInvalid) {
            firstInvalid.focus();
        }

        return isValid;
    }

    // ----------------------------------------------------
    // 5. Form Submission Handler
    // ----------------------------------------------------
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate all required fields
        if (!validateEntireForm()) return;

        // Anti-bot check
        const botCheck = form.querySelector('input[name="botcheck"]');
        if (botCheck && botCheck.checked) {
            return;
        }

        const submitBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span style="display:inline-flex; align-items:center; gap:8px;">
                    <span class="spinner" style="width:16px; height:16px; border:2px solid #FFFFFF; border-top-color:transparent; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block;"></span>
                    Scheduling Walkthrough...
                </span>
            `;
        }

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(form.action || '/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || 'Submission failed');
            }

            // Analytics lead generation event
            if (typeof gtag === 'function') {
                gtag('event', 'generate_lead', {
                    event_category: 'Consultation Form',
                    event_label: 'Clinical Consultation Walkthrough'
                });
            }

            // Populate Success Confirmation
            if (successView) {
                const nameSpan = successView.querySelector('[data-success-name]');
                const practiceSpan = successView.querySelector('[data-success-practice]');
                const emailSpan = successView.querySelector('[data-success-email]');
                const dateSpan = successView.querySelector('[data-success-date]');
                const timeSpan = successView.querySelector('[data-success-time]');

                if (nameSpan) nameSpan.textContent = payload.name || 'Doctor';
                if (practiceSpan) practiceSpan.textContent = payload.practice || 'Your Clinic';
                if (emailSpan) emailSpan.textContent = payload.email || 'your email';
                if (dateSpan) dateSpan.textContent = payload.preferred_date || 'Upcoming business day';
                if (timeSpan) timeSpan.textContent = payload.time_slot || 'Morning';

                // Smoothly swap form to success view
                form.style.display = 'none';
                if (stepperHeader) stepperHeader.style.display = 'none';
                successView.style.display = 'block';

                if (window.lucide?.createIcons) {
                    window.lucide.createIcons();
                }

                successView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch (err) {
            console.error('Consultation request failed:', err);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtnText;
            }

            let errDiv = form.querySelector('.form-submit-error');
            if (!errDiv) {
                errDiv = document.createElement('div');
                errDiv.className = 'form-submit-error';
                errDiv.style.cssText = 'background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; padding: 14px 18px; border-radius: 9px; margin-top: 18px; font-size: 0.88rem; line-height: 1.5;';
                form.appendChild(errDiv);
            }
            errDiv.innerHTML = 'There was an issue scheduling your walkthrough. Please try again or email us directly at <strong>admin@anot.health</strong>.';
        }
    });
});
