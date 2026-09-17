# Anot Health - cPanel Deployment Guide
**Geo-Detection System Setup for US/Canada Visitor Routing**

---

## ✅ Pre-Deployment Checklist

- [ ] All files uploaded to cPanel public_html directory
- [ ] `.htaccess` file is present in root directory
- [ ] All HTML files included:
  - [ ] `index.html` (US homepage)
  - [ ] `homepage-ca.html` (Canada homepage)
  - [ ] `pricing.html` & `pricing-ca.html`
  - [ ] `billing.html` & `billing-ca.html`
  - [ ] `hipaa.html` & `pipeda.html`
  - [ ] All service pages (coding, scribing, payroll, etc.)
  - [ ] All support pages (contact, about, specialties, privacy, terms)
- [ ] `/css/` folder with `style.css`
- [ ] `/js/` folder with `geo-switcher.js` and `components.js`
- [ ] `/images/` folder with all image assets
- [ ] `/backend/` folder (if email forms needed)
- [ ] `backend/server.js` configured for Express
- [ ] Environment variables set up (if using email)

---

## 🌍 How Geo-Detection Works (Detection Priority)

### **Layer 1: Server-Side (.htaccess)** ⚡ Fastest
The `.htaccess` file handles routing at the server level before the browser loads JavaScript:

1. **Manual URL Override** - `?region=ca` or `?region=us` parameter
2. **Cookie-Based** - Saved user preference from previous visit (`anot_region` cookie)
3. **Cloudflare GeoIP** - If using Cloudflare proxy (automatic detection)
4. **Server GeoIP Module** - If `mod_geoip` is enabled on cPanel (optional)

### **Layer 2: Client-Side (geo-switcher.js)** 📱 Fallback
JavaScript-based detection runs in the browser:

1. **Timezone Detection** - Browser's native timezone (instant, 0ms)
   - Detects 24 Canadian timezones
   - No external API call needed
2. **GeoIP API Fallback** - External IP lookup if timezone is unknown
   - `api.country.is`
   - `ipapi.co` (secondary)

### **Layer 3: Dynamic Header (components.js)** 🎯 Always Accurate
Every page loads region-aware navigation:

- Correct service page links for CA vs US
- Localized pricing links (CAD vs USD)
- Regional trust/compliance links (PIPEDA vs HIPAA)
- Correct phone number and currency

---

## 🚀 Deployment Steps on cPanel

### **Step 1: Upload Files to Public HTML**

```
anot.health/
├── index.html (US home)
├── homepage-ca.html (CA home)
├── .htaccess ← IMPORTANT: Copy this file
├── css/
│   └── style.css
├── js/
│   ├── geo-switcher.js
│   ├── components.js
│   └── main.js
├── images/
│   └── [all image files]
└── [all other HTML files]
```

**cPanel Upload Tips:**
- Use cPanel File Manager or FTP
- Ensure `.htaccess` is visible (might need to show hidden files)
- Verify file permissions: `.htaccess` should be `644`

### **Step 2: Verify Apache Modules (cPanel Dashboard)**

1. Login to cPanel
2. Go to **Home > Software > EasyApache 4** (or Modules)
3. Verify these are enabled:
   - ✅ `mod_rewrite` (REQUIRED for .htaccess routing)
   - ✅ `mod_headers` (for cache headers)
   - ✅ `mod_expires` (for cache expiration)
   - ⚠️ `mod_geoip` (optional, for server-side GeoIP detection)

If `mod_rewrite` is not enabled, contact cPanel support to enable it.

### **Step 3: Check .htaccess Rules**

The `.htaccess` file includes these routing rules:

```apache
# Example routing rules (already in your .htaccess)
RewriteCond %{HTTP_COOKIE} anot_region=ca [NC]
RewriteRule ^index\.html$ /homepage-ca.html [R=302,L]
```

No manual edits needed unless you're using Cloudflare (see below).

### **Step 4: Enable Server-Side GeoIP (Optional)**

If `mod_geoip` is available on your server:

1. Download the GeoIP database: `GeoIP.dat`
2. Upload to server (usually `/usr/share/GeoIP/`)
3. The `.htaccess` file already includes the detection rules—no changes needed

**Your .htaccess already includes:**
```apache
<IfModule mod_geoip.c>
    RewriteCond %{ENV:GEOIP_COUNTRY_CODE} ^CA$ [NC]
    # Routing rules...
</IfModule>
```

---

## 🧪 Testing Geo-Detection

### **Test 1: Manual Region Override (Easiest)**
Open these URLs in your browser:

```
https://anot.health/?region=ca
→ Should load homepage-ca.html (Canada version)

https://anot.health/?region=us
→ Should load index.html (US version)

https://anot.health/pricing.html?region=ca
→ Should redirect to pricing-ca.html
```

### **Test 2: Timezone Detection**
1. Change your computer's timezone to a Canadian timezone (e.g., America/Toronto)
2. Clear browser cookies and localStorage
3. Visit `https://anot.health/`
4. Should automatically show homepage-ca.html

**Canadian Timezones Detected:**
- America/Toronto
- America/Vancouver
- America/Montreal
- America/Calgary
- America/Edmonton
- [+ 19 more Canadian zones]

### **Test 3: Cookie Persistence**
1. Visit homepage-ca.html
2. Click the "Switch to 🇺🇸" button to set the region preference
3. Revisit `https://anot.health/`
4. Should remember your preference and show US version
5. Cookie lasts 30 days

### **Test 4: VPN Testing**
1. Use a Canadian VPN/proxy
2. Clear cookies and localStorage
3. Visit `https://anot.health/`
4. Should route to Canadian version (via GeoIP APIs)

### **Test 5: Service Page Redirects**
Test these redirects work:
```
pricing.html?region=ca → pricing-ca.html ✓
billing.html?region=ca → billing-ca.html ✓
hipaa.html?region=ca → pipeda.html ✓
```

---

## 🔧 If Something Isn't Working

### **Problem: Users stay on wrong region**
**Solutions:**
1. Verify `.htaccess` is in the root directory
2. Check `mod_rewrite` is enabled in cPanel
3. Clear browser cache and cookies
4. Test with `?region=ca` parameter

### **Problem: Canadian visitors see US version**
**Causes:**
1. Browser timezone isn't set to Canadian timezone
2. GeoIP APIs are blocked/slow
3. `.htaccess` rules aren't executing

**Fix:**
- Verify mod_rewrite is enabled
- Check .htaccess permissions (should be 644)
- Monitor browser console for errors in geo-switcher.js

### **Problem: Getting 404 errors after redirect**
**Cause:** Page pair not in geo-switcher.js mapping

**Fix:** Edit `js/geo-switcher.js`:
```javascript
const PAIRS_US_TO_CA = {
    'index.html': 'homepage-ca.html',
    'pricing.html': 'pricing-ca.html',
    // Add missing pairs here
};
```

### **Problem: Cloudflare conflicts**
**Solution:** If using Cloudflare:
1. Ensure Cloudflare has Geo-Location enabled
2. Your `.htaccess` checks for `CF-IPCountry` header
3. Priority: User cookie > Cloudflare GeoIP > Timezone

---

## 📊 Monitoring & Analytics

After deployment, track:

1. **Traffic by Region**
   - Monitor which pages get the most visits (index.html vs homepage-ca.html)
   - Check Google Analytics: audience > geo

2. **Geo-Detection Accuracy**
   - Add logging to geo-switcher.js for debugging
   - Check browser console for detection method used

3. **Cookie Tracking**
   - Monitor `anot_region` cookie in browser dev tools
   - Verify 30-day persistence works

---

## 🚨 Important Notes

### **JavaScript Dependency**
- Server-side `.htaccess` handles the primary routing
- Client-side geo-switcher.js handles fallback and manual switching
- If JS is disabled, `.htaccess` routing still works ✅

### **Timezone Accuracy**
- Timezone detection is ~95% accurate for Canada
- Some users may have manual timezone overrides
- GeoIP APIs provide fallback for 5% edge cases

### **CORS & External APIs**
These external APIs are used as fallback:
- `https://api.country.is/` - IP-based country detection
- `https://ipapi.co/json/` - Secondary IP geolocation

Both are CORS-enabled and should work fine.

### **URL Structure**
- US pages: `index.html`, `pricing.html`, `billing.html`, `hipaa.html`
- CA pages: `homepage-ca.html`, `pricing-ca.html`, `billing-ca.html`, `pipeda.html`
- Agnostic pages: `contact.html`, `about.html`, `specialties.html` (same for both regions)

---

## ✨ Quick Summary

| Component | Status | Function |
|-----------|--------|----------|
| `.htaccess` | ✅ Ready | Server-side routing (fastest) |
| `geo-switcher.js` | ✅ Ready | Client-side timezone detection + manual switch |
| `components.js` | ✅ Ready | Region-aware header/footer injection |
| Page Pairs | ✅ Ready | US ↔ CA page mapping |
| Cookies | ✅ Ready | 30-day user preference saving |
| GeoIP APIs | ✅ Ready | Fallback IP-based detection |

**You're good to deploy!** 🚀

---

## 📞 Support

If you encounter issues:
1. Check `.htaccess` is in root directory
2. Verify `mod_rewrite` is enabled
3. Clear browser cache and cookies
4. Check browser console for JavaScript errors
5. Contact cPanel support if mod_rewrite isn't available

Good luck with your deployment! 🎉
