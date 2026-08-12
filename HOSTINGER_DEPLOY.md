# Hostinger Deployment Guide for PPMP System (Laravel Backend)

This guide walks you through deploying the converted **Laravel 11 Backend** and **React Frontend** to **Hostinger Shared Hosting** (cPanel / hPanel).

---

## Requirements on Hostinger
- **PHP 8.2 or 8.3** (enabled via Hostinger -> Advanced -> PHP Configuration)
- **MySQL Database**
- PHP Extensions: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `zip`, `gd` (all enabled by default on Hostinger)

---

## Step 1: Create a MySQL Database on Hostinger
1. Log in to your **Hostinger hPanel**.
2. Go to **Databases** -> **Management**.
3. Create a new MySQL Database:
   - **Database Name**: e.g., `u123456789_ppmpsys`
   - **Database Username**: e.g., `u123456789_ppmpuser`
   - **Password**: `[YourSecurePassword]`
4. Note down the Database Name, Username, and Password.

---

## Step 2: Prepare & Upload the Backend Files
1. Copy the contents of `laravel-backend/` to your Hostinger server (via FTP or Hostinger File Manager).
2. Recommended directory layout on Hostinger:
   ```
   /home/u123456789/
   ├── laravel-backend/        <-- Contains all backend code (app, bootstrap, config, database, vendor, etc.)
   └── public_html/            <-- Contains public entry points (or React build)
   ```

---

## Step 3: Configure `.env` on Hostinger
1. In `laravel-backend/`, copy `.env.hostinger.example` to `.env` (or edit `.env`).
2. Update the database credentials:
   ```ini
   APP_NAME="PPMP APP Consolidation System"
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://yourdomain.com

   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=u123456789_ppmpsys
   DB_USERNAME=u123456789_ppmpuser
   DB_PASSWORD=YourDatabasePasswordHere

   JWT_SECRET=8df5e8c4601be24e772f778a48ef0406d4e5f2e825a0756788db9f18a28723c0
   JWT_TTL=60
   ```
3. Generate an APP key (or run `php artisan key:generate` via Hostinger SSH terminal).

---

## Step 4: Run Migrations and Seed Database
1. Open **SSH Access** in Hostinger hPanel (or use terminal).
2. Navigate to `laravel-backend`:
   ```bash
   cd ~/laravel-backend
   ```
3. Run the migrations & seed default accounts:
   ```bash
   php artisan migrate:fresh --seed --force
   ```

Default accounts created:
- **Admin**: `admin` / `admin123` (Role: `bac_admin`)
- **Budget**: `budget` / `budget123` (Role: `budget_office`)
- **End User**: `bac_user` / `user123` (Role: `end_user`)

---

## Step 5: Web Root Configuration on Hostinger
Point your domain or subfolder to the `public/` folder:
- **Option A (Subdomain / Document Root change)**: Change the Domain's Document Root in Hostinger hPanel to `laravel-backend/public`.
- **Option B (htaccess redirect in public_html)**: Create a `.htaccess` file inside `public_html/` with:
  ```apache
  <IfModule mod_rewrite.c>
      RewriteEngine On
      RewriteRule ^$ public/ [L]
      RewriteRule (.*) public/$1 [L]
  </IfModule>
  ```

---

## Step 6: Deploy Frontend (React)
1. Build the frontend locally with your Hostinger backend URL:
   ```bash
   cd frontend
   npm run build
   ```
2. Upload the contents of `frontend/dist` directly to Hostinger.

---

## Step 7: Cloudflare Free (edge DDoS)

Cloudflare’s **Free** plan includes unmetered DDoS mitigation and Bot Fight Mode. No paid Rate Limiting or advanced WAF is required — Laravel already rate-limits login/API traffic.

1. Create a free account at [cloudflare.com](https://www.cloudflare.com) and **Add a site** for your domain.
2. Replace Hostinger nameservers with the Cloudflare nameservers shown in the dashboard (or follow Cloudflare’s DNS import).
3. In DNS, ensure your A/CNAME records are **proxied** (orange cloud), not DNS-only (grey cloud).
4. SSL/TLS → Overview:
   - Prefer **Full (strict)** if Hostinger already has a valid HTTPS certificate.
   - Use **Full** temporarily if the origin cert is missing or self-signed, then switch to Full (strict).
5. Security → Bots: enable **Bot Fight Mode**.
6. During an active attack only: Security → Settings → **Under Attack Mode** (shows a challenge page). Turn it off when traffic is normal.
7. Keep Laravel `TrustProxies` enabled (already configured in the app) so rate limits use the visitor IP (`CF-Connecting-IP` / `X-Forwarded-For`), not Cloudflare’s edge IP.

Also set production CORS in `laravel-backend/.env`:
```ini
FRONTEND_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Local XAMPP / `php artisan serve` does not use Cloudflare; proxying applies only to the public domain.

---

## Verification
1. Visit `https://yourdomain.com/api/health` — should return `{"status":"running"}`.
2. Visit `https://yourdomain.com` — React login page loads.
3. Login with `admin` / `admin123`.
4. Confirm response headers include `X-Content-Type-Options: nosniff` (and related security headers).
5. Rapid-fire login attempts should return HTTP `429` after the login limit.
