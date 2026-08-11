# PPMP System — Laravel + React

Ormoc City PPMP-APP Consolidation System for **Hostinger cloud** (Laravel API + React UI).

## Stack

| Layer | Path | Tech |
|-------|------|------|
| **Backend** | `laravel-backend/` | Laravel 12, PHP 8.2+, MySQL, JWT |
| **Frontend** | `frontend/` | React 19, Vite |

## Local development

**Terminal 1 — Laravel API (port 8000):**
```powershell
cd c:\xampp\htdocs\appbac\laravel-backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000
```

**Terminal 2 — React UI (port 5173):**
```powershell
cd c:\xampp\htdocs\appbac\frontend
npm install
npm run dev
```

Or from the repo root:
```powershell
npm run backend    # Laravel on :8000
npm run dev        # Vite on :5173
```

Open `http://localhost:5173` — the Vite dev server proxies `/api` to Laravel.

## Hostinger deployment

See **[HOSTINGER_DEPLOY.md](HOSTINGER_DEPLOY.md)** for upload steps, MySQL setup, and production build.

## Default accounts (after seed)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | bac_admin |
| `budget` | `budget123` | budget_office |
| `bac_user` | `user123` | end_user |
