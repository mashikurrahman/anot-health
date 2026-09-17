# Anot Health - Post-Deployment Testing Guide

**Test these after uploading to cPanel to ensure geo-detection works correctly**

---

## 🧪 Test 1: Manual Region Override (No Dependencies)

### Test URL Parameters
Run these tests in order:

```
1. https://anot.health/?region=us
   Expected: Shows US version (index.html)
   Check: "USA (USD)" button in top bar
   ✓ Pass / ✗ Fail

2. https://anot.health/?region=ca
   Expected: Shows Canada version (homepage-ca.html)
   Check: "Canada (CAD)" button in top bar
   ✓ Pass / ✗ Fail

3. https://anot.health/pricing.html?region=ca
   Expected: Redirects to pricing-ca.html
   Check: URL changes to pricing-ca.html
   ✓ Pass / ✗ Fail

4. https://anot.health/billing.html?region=us
   Expected: Redirects to billing.html (no change)
   Check: Page loads correctly
   ✓ Pass / ✗ Fail
```

**If these fail:** `.htaccess` routing not working. Check:
- [ ] `.htaccess` is in root directory
- [ ] `mod_rewrite` is enabled in cPanel
- [ ] File permissions on `.htaccess` are 644

---

## 🧪 Test 2: Services Dropdown Menu

### Desktop Hover Test
```
1. Open https://anot.health/
2. Hover over "Services" in header
3. Dropdown menu appears with options
4. Click "Clinical Coding"
5. Navigate to coding.html

Expected Results:
✓ Dropdown appears smoothly
✓ Menu items visible and readable
✓ Links navigate to correct pages
✓ No console errors (press F12)
```

### Mobile/Touch Test
```
1. Open https://anot.health/ on mobile
2. Tap "Services"
3. Dropdown appears or menu opens
4. Tap a service link
5. Navigates correctly

Expected Results:
✓ Menu is accessible on mobile
✓ Links are tappable (not tiny)
✓ No layout breaking
```

---

## 🧪 Test 3: Region Switcher Button

### Test Flag Button
```
1. Open https://anot.health/ (US version)
2. Look for flag button in top-right bar
3. Click the button labeled "Switch to 🇨🇦"
4. Page redirects to homepage-ca.html
5. Button now says "Switch to 🇺🇸"
6. Refresh page
7. Still on Canadian version (saved preference)

Expected Results:
✓ Flag button exists
✓ Click switches regions correctly
✓ Preference persists after refresh
✓ Cookie lasts 30 days
```

### Verify Preference Saving
```
1. Open DevTools (F12) > Application > Cookies
2. Look for cookie named "anot_region"
3. Value should be "ca" or "us"
4. Check localStorage for "anot_selected_region"

Expected Results:
✓ Cookie exists with correct value
✓ Expires in 30 days
✓ localStorage also contains region
```

---

## 🧪 Test 4: Automatic Timezone Detection

### Setup Canadian Timezone
```
1. Go to Windows Settings > Time & Language > Date & time
2. Change timezone to "America/Toronto" (Eastern Canada)
3. Clear all cookies: F12 > Application > Clear All
4. Visit https://anot.health/
5. Wait 2-3 seconds for detection

Expected Results:
✓ Page auto-redirects to homepage-ca.html
✓ "Canada (CAD)" shown in top bar
✓ Canadian pricing (CAD) displayed
✓ No "Switch to 🇨🇦" button (already on Canada version)
```

### Test Multiple Timezones
```
Test these Canadian timezones:
- America/Toronto ✓/✗
- America/Vancouver ✓/✗
- America/Calgary ✓/✗
- America/Montreal ✓/✗
- America/Edmonton ✓/✗

For each:
1. Set timezone in Windows settings
2. Clear cookies/localStorage (F12)
3. Visit https://anot.health/
4. Check if redirects to Canadian version
```

---

## 🧪 Test 5: Geographic IP Detection (Fallback)

### Test with VPN
```
1. Install VPN (example: NordVPN, ExpressVPN)
2. Connect to Canadian VPN server
3. Clear cookies/localStorage
4. Visit https://anot.health/ in Incognito mode
5. Wait 3-5 seconds

Expected Results:
✓ Auto-detects Canadian IP
✓ Redirects to homepage-ca.html
✓ Shows Canadian pricing
✓ No manual intervention needed
```

**Note:** This requires external GeoIP APIs (api.country.is). May take 3-5 seconds due to network latency.

---

## 🧪 Test 6: Cookie Persistence

### Test 30-Day Cookie
```
1. Visit homepage-ca.html manually
2. Click "Switch to 🇺🇸" button
3. Redirects to index.html (US version)
4. Close browser completely
5. Re-open browser
6. Visit https://anot.health/

Expected Results:
✓ Still shows US version
✓ Preference remembered for 30 days
✓ Cookie visible in DevTools
```

### Force Cookie Expiration
```
1. F12 > Application > Cookies
2. Find "anot_region" cookie
3. Delete it
4. Refresh page
5. Should re-detect timezone or use GeoIP

Expected Results:
✓ Preference cleared
✓ Geo-detection runs again
✓ User redirected based on new detection
```

---

## 🧪 Test 7: Page Pair Routing

### Test All Regional Page Pairs
```
Test these redirects work:

US → CA (with ?region=ca):
- index.html → homepage-ca.html ✓/✗
- pricing.html → pricing-ca.html ✓/✗
- billing.html → billing-ca.html ✓/✗
- hipaa.html → pipeda.html ✓/✗

CA → US (with ?region=us):
- homepage-ca.html → index.html ✓/✗
- pricing-ca.html → pricing.html ✓/✗
- billing-ca.html → billing.html ✓/✗
- pipeda.html → hipaa.html ✓/✗
```

---

## 🧪 Test 8: Dynamic Header/Footer

### Verify Region-Aware Content
```
1. Visit index.html (US version)
   Check:
   - Phone: "(800) 555-ANOT" ✓/✗
   - Currency: USD ✓/✗
   - Trust link: "HIPAA Trust" ✓/✗
   - Location: "US-Based" ✓/✗

2. Visit homepage-ca.html (CA version)
   Check:
   - Phone: "(888) 555-ANOT" ✓/✗
   - Currency: CAD ✓/✗
   - Trust link: "PIPEDA Trust" ✓/✗
   - Location: "Coast-to-Coast" ✓/✗
```

---

## 🧪 Test 9: Navigation Links

### Verify All Service Links Work
```
From Services Dropdown (US version):
1. Clinical Coding → coding.html ✓/✗
2. Medical Scribing → scribing.html ✓/✗
3. Billing & Revenue Cycle → billing.html ✓/✗
4. Payroll Support → payroll.html ✓/✗
5. Specialties → specialties.html ✓/✗

From Services Dropdown (CA version):
1. Clinical Documentation → scribing-ca.html ✓/✗
2. Provincial Billing → billing-ca.html ✓/✗
3. Coding & Compliance → coding-ca.html ✓/✗
4. Payroll Support → payroll.html ✓/✗
5. Specialties → specialties.html ✓/✗
```

---

## 🧪 Test 10: Console Errors

### Check Browser Console
```
1. Open DevTools (F12)
2. Click Console tab
3. Refresh page
4. Check for red errors

Expected Results:
✓ No 404 errors
✓ No CORS errors
✓ No undefined variable errors
✓ geo-switcher.js runs without errors
✓ components.js injects header/footer

Common Issues:
✗ Failed to load geo-switcher.js → Check js/ folder
✗ Failed to fetch GeoIP → OK, timeout is expected
✗ Uncaught ReferenceError → Check script tags
```

---

## 📊 Results Summary Template

Copy and fill out after testing:

```
=== DEPLOYMENT TEST RESULTS ===
Date: _______________
Site: anot.health

✓ Test 1 - URL Parameters (region=ca/us): PASS / FAIL
✓ Test 2 - Services Dropdown: PASS / FAIL
✓ Test 3 - Region Switcher: PASS / FAIL
✓ Test 4 - Timezone Detection: PASS / FAIL
✓ Test 5 - VPN/GeoIP Detection: PASS / FAIL
✓ Test 6 - Cookie Persistence: PASS / FAIL
✓ Test 7 - Page Pair Routing: PASS / FAIL
✓ Test 8 - Dynamic Header/Footer: PASS / FAIL
✓ Test 9 - Navigation Links: PASS / FAIL
✓ Test 10 - Console Errors: PASS / FAIL

Overall Status: ___READY FOR PRODUCTION___ / NEEDS FIX

Issues Found:
1. _______________________
2. _______________________
3. _______________________

Notes:
_______________________________
_______________________________
```

---

## 🔧 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| URL params not working | Check mod_rewrite enabled in cPanel |
| Dropdown not appearing | Clear CSS cache (Ctrl+Shift+R) |
| Wrong region shown | Clear all cookies and localStorage |
| GeoIP detection slow | Normal (3-5 sec); retry on fresh page |
| Timezone detection not working | Verify browser timezone is accurate |
| Flag button missing | Check components.js loaded correctly |
| Service links broken | Verify all HTML files exist in root |

---

## ✅ Deployment Success Criteria

All tests must PASS:
- [x] URL parameter routing works
- [x] Services dropdown visible and functional
- [x] Region switcher saves preference
- [x] At least one geo-detection method works
- [x] All service pages accessible
- [x] No console errors
- [x] Mobile layout responsive

**If all tests pass: ✅ DEPLOYMENT SUCCESSFUL**

---

**Good luck! 🚀**
