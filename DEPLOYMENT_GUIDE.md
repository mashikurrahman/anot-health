# Anot Health — Complete Namecheap cPanel Live Deployment Guide
**Production Deployment for `anot.health` (Static Frontend + Node.js Backend API + SEO Suite)**

---

## 🏛️ 1. Architecture Overview

Anot Health runs as a high-performance **hybrid application** on Namecheap cPanel:

```
                          VISITOR / BROWSER
                                 │
                  https://anot.health / https://www.anot.health
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            Standard Web Pages          /api/* Requests
         (HTML, CSS, JS, Images)       (Contact Forms, Analytics)
                     │                       │
                     ▼                       ▼
             Apache Web Server       Phusion Passenger
               (public_html/)          (Node.js App)
                     │                       │
            Instant CDN Speed,         backend/server.js
           Gzip, Cache, Security        Gmail SMTP Dispatch
           & Geo-Routing (.htaccess)    Google Analytics 4 & GSC
                                       data/leads.json Logging
```

* **Frontend (`public_html/`)**: Served directly by Apache for maximum speed, HTTP/2 multiplexing, and geo-targeted routing via `.htaccess`.
* **Backend (`anot-backend` or `public_html/backend`)**: Managed by **CloudLinux Phusion Passenger** via cPanel's **Setup Node.js App** at `anot.health/api`.
* **Security Shield**: Sensitive server files (`.env`, `service-account.json`, `leads.json`) are blocked with HTTP `403 Forbidden` both at the Apache `.htaccess` layer and inside Express middleware.

---

## 📋 2. Pre-Flight Checklist: What You Need Ready

Your GitHub repository (`https://github.com/mashikurrahman/anot-health`) contains all code, **except** secrets protected by `.gitignore`. Before beginning, have these 2 files ready on your computer:

### 1. `backend/.env` (SMTP & Dashboard Secrets)
Ensure your local `backend/.env` contains your own working credentials, in this shape
(never commit the real file — it's gitignored on purpose):
```env
PORT=3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<your-sending-gmail-address>
SMTP_PASS=<your-gmail-app-password>
CONTACT_TO=<addresses that should receive new leads>
ADMIN_ANALYTICS_PASSWORD=<a strong, unique password - do not reuse this doc's old default>
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GA4_PROPERTY_ID=<your numeric GA4 property ID>
GSC_SITE_URL=https://anot.health/
```

### 2. `backend/service-account.json` (Google Cloud Service Account)
The Google Cloud JSON key for your analytics bot:
* Client Email: `anot-dashboard-bot@molten-raceway-477409-j8.iam.gserviceaccount.com`

---

## 🚀 3. Step-by-Step Deployment Instructions

### Step 1: Upload Static Frontend to `public_html/`

1. **Prepare ZIP file**:
   * On your computer, open your project folder `anot-health-master`.
   * Select all frontend files and folders:
     * HTML files (`index.html`, `pricing.html`, `contact.html`, etc.)
     * `css/`, `js/`, `images/`, `data/` folders
     * `.htaccess`, `robots.txt`, `sitemap.xml`, `site.webmanifest`
   * Right-click and compress to a `.zip` archive (e.g., `anot-frontend.zip`).
   *(Note: You do not need to include `node_modules` or `.git`)*.

2. **Open cPanel File Manager**:
   * Log into your Namecheap cPanel dashboard.
   * Go to **Files** ➔ **File Manager**.
   * In the top-right corner, click **Settings** ➔ Check **"Show Hidden Files (dotfiles)"** ➔ Click **Save**. *(This is vital so you can see `.htaccess`)*.
   * Navigate into the **`public_html`** directory.

3. **Upload & Extract**:
   * Click **Upload** in the top toolbar.
   * Upload `anot-frontend.zip`.
   * Return to File Manager, select `anot-frontend.zip`, and click **Extract** ➔ Extract to `/public_html`.
   * Delete the `.zip` file after extracting.

4. **Verify File Permissions**:
   * Folders should be `755` (`rwxr-xr-x`).
   * Files (including `.htaccess`) should be `644` (`rw-r--r--`).
   * Ensure `data/` directory has write permission (`775` or `755`) so `data/leads.json` can be created and updated when consultation requests are submitted.

---

### Step 2: Configure the Node.js Backend API

1. **Create Application in cPanel**:
   * In cPanel, scroll to the **SOFTWARE** section.
   * Click **Setup Node.js App**.
   * Click the blue **Create Application** button.
   * Fill in the application parameters:
     | Field | Recommended Value | Notes |
     |---|---|---|
     | **Node.js version** | `20.x` (or `18.x`) | Select latest LTS available |
     | **Application mode** | `Production` | Optimized runtime |
     | **Application root** | `anot-backend` | Dedicated directory in `/home/username/` |
     | **Application URL** | `anot.health/api` | Select domain and enter `api` path |
     | **Application startup file** | `server.js` | Main entry point |
   * Click **Create** (top right).

2. **Upload Backend Files into `anot-backend/`**:
   * Return to **File Manager**.
   * Navigate to the newly created folder: `/home/username/anot-backend/`.
   * Upload the following 4 files from your local `backend/` folder:
     * `server.js`
     * `analyticsService.js`
     * `package.json`
     * `.env`
     * `service-account.json`
   *(Do NOT upload `node_modules/` — cPanel installs them directly in the next step)*.

3. **Install Dependencies via cPanel**:
   * Go back to **Setup Node.js App**.
   * Click the **Edit** (pencil icon) next to your `anot.health/api` application.
   * Under the **Detected configuration files** section, you will see `package.json`.
   * Click the **Run NPM Install** button.
   * Wait 30–60 seconds. You will see a green success message confirming all packages (`express`, `nodemailer`, `googleapis`, `@google-analytics/data`, `cors`, `dotenv`) are installed.

4. **Start the Application**:
   * Click **Restart** or **Start App** at the top of the page.
   * Your API is now live and listening at `https://anot.health/api/`!

---

### Step 3: Connect Google Search Console (Fix GSC 403 Error)

Because the Google Cloud service account is newly configured, Google Search Console requires you to authorize it on `https://anot.health/`:

1. Open [Google Search Console](https://search.google.com/search-console).
2. Ensure you have the property **`https://anot.health/`** selected in the top-left dropdown.
3. In the left sidebar, click **Settings** (bottom left).
4. Click **Users and permissions**.
5. Click **Add user** (top right).
6. Fill in:
   * **Email address**: `anot-dashboard-bot@molten-raceway-477409-j8.iam.gserviceaccount.com`
   * **Permission**: **Full** (or **Owner**)
7. Click **Add**.

> [!TIP]
> Once added, the **Admin Analytics & SEO Dashboard** at `https://anot.health/admin-analytics.html` will automatically begin pulling real Google Search queries, clicks, impressions, and rankings without any further configuration!

---

### Step 4: Verify SSL & Geo-Routing

1. **Verify Free AutoSSL (HTTPS)**:
   * In cPanel, search for **SSL/TLS Status**.
   * Confirm that `anot.health` and `www.anot.health` show green locks with active certificates.
   * If not, click **Run AutoSSL** and allow Namecheap 5 minutes to issue the Comodo/Sectigo SSL certificate.

2. **Verify Geo-Redirection**:
   * Visit `https://anot.health/?region=ca` ➔ should display Canadian flag and route to `homepage-ca.html`.
   * Visit `https://anot.health/?region=us` ➔ should display US flag and route to `index.html`.
   * Switch languages/regions using the top-nav pills to verify cookie persistence (`anot_region`).

---

## 🧪 4. Live Testing & Verification Checklist

Complete these checks immediately after deployment:

- [ ] **Homepage Check**: Open `https://anot.health` in an incognito window. Header, hero, navigation, and mobile menu load crisply.
- [ ] **Contact Form Submission**:
  - Go to `https://anot.health/contact.html`.
  - Submit a test consultation inquiry.
  - Expect: Green success checkmark `"Thank you! Your request has been received."`
- [ ] **Email Dispatch Verification**:
  - Check `mashikurrahman7@gmail.com` and `admin@anot.health`.
  - Expect: Form notification email received with user details.
- [ ] **Lead Persistence Verification**:
  - In cPanel File Manager, inspect `anot-backend/data/leads.json` or `public_html/data/leads.json`.
  - Expect: New submission recorded as a JSON lead record.
- [ ] **Admin Intelligence Dashboard**:
  - Visit `https://anot.health/admin-analytics.html`.
  - Enter the `ADMIN_ANALYTICS_PASSWORD` value from your live server's `.env`.
  - Expect: Metrics cards display active GA4 status (`GA4 CONNECTED`), Traffic graphs, Top Visited Pages, and Search Console Keywords.
- [ ] **Security Shield Audit**:
  - In browser, visit `https://anot.health/backend/.env` ➔ **Must return 403 Forbidden**.
  - Visit `https://anot.health/data/leads.json` ➔ **Must return 403 Forbidden**.
  - Visit `https://anot.health/backend/service-account.json` ➔ **Must return 403 Forbidden**.

---

## 🛠️ 5. Troubleshooting Common cPanel Issues

### Issue 1: Contact Form shows "Failed to send message" or 404
* **Cause**: Node.js app is not running, or Application URL was not set to `anot.health/api`.
* **Fix**:
  1. In cPanel ➔ **Setup Node.js App**, confirm the app status is **Started**.
  2. Confirm Application URL is set to `anot.health` with path `api`.
  3. Check the application log in cPanel or view `/home/username/anot-backend/passenger.log` (or `stderr.log`).

### Issue 2: Contact Form says "Too many requests"
* **Cause**: Built-in rate limiter (5 submissions per 15 minutes per IP).
* **Fix**: Wait 15 minutes or test from a different network/mobile data connection.

### Issue 3: Search Console data shows "Unable to retrieve queries"
* **Cause**: The service account bot was not added to Google Search Console or domain URL mismatch.
* **Fix**: Verify Step 3 above. In GSC, the property must match `GSC_SITE_URL=https://anot.health/`.

### Issue 4: Updates pushed to GitHub are not appearing live
* **Cause**: Namecheap shared hosting does not automatically pull from GitHub unless configured with cPanel Git™ Version Control or manual upload.
* **Fix**:
  * **Option A (Manual)**: Re-upload the updated file in cPanel File Manager.
  * **Option B (Git Version Control)**: In cPanel ➔ **Git™ Version Control** ➔ Click **Manage** next to your repository ➔ Click **Pull or Deploy** ➔ Click **Deploy HEAD Commit**.

---

## 🔒 6. Server Contacts & Security Reference

* **Domain**: `anot.health`
* **Admin Dashboard**: `https://anot.health/admin-analytics.html`
* **Primary Notification Email**: `mashikurrahman7@gmail.com`
* **Secondary Notification Email**: `admin@anot.health`
* **Repository**: `https://github.com/mashikurrahman/anot-health`
