# Manual Hostinger Upload (FileZilla)

Use this when GitHub Actions FTP deploy is unavailable. Upload only what you changed.

## Server layout

```
public_html/
  index.html          ← from frontend/dist/
  assets/             ← from frontend/dist/assets/
  Ormoc_City.png      ← from frontend/dist/ (and other public images)
  .htaccess           ← from deploy/htaccess-root
  backend/            ← Laravel API
  templates/          ← Excel masters
```

## What to upload

| If you changed locally | Do this first | Upload with FileZilla |
|------------------------|---------------|------------------------|
| `frontend/src/**`, `frontend/public/**`, `frontend/index.html` | `cd frontend` → `npm run build` | **Contents of** `frontend/dist/` → `public_html/` (overwrite `index.html`, `assets/`, logos). Copy `deploy/htaccess-root` → `public_html/.htaccess` if missing |
| `app/data/item_catalog.json`, `app/data/title_catalog.json` | none (or sync CSE catalog) | → `public_html/app/data/` (create folders if needed). Needed for item/title suggestions when DB catalog is empty |
| `backend/app/**`, `backend/routes/**`, `backend/config/**`, etc. | none (or `composer install --no-dev` only if `composer.json` changed) | Changed files under `backend/` → `public_html/backend/` (keep the same relative paths) |
| `backend/composer.json` / `composer.lock` | `cd backend` → `composer install --no-dev` | Upload updated `backend/vendor/` too |
| `templates/**` | none | `templates/` → `public_html/templates/` |
| `deploy/htaccess-root` | none | → `public_html/.htaccess` |
| `gas/**` | n/a | **Not** Hostinger — deploy in Google Apps Script |

## Never upload

- Local `backend/.env` (XAMPP settings will break the live site)
- `frontend/src/` (server only uses the built `dist/`)
- `node_modules/`, `.git/`
- `backend/storage/logs/`, `backend/storage/framework/cache/`, sessions, views
- Test files (`backend/tests/`, `phpunit.xml`)

Note: `app/data/*.json` is gitignored under `data/`. Upload those files manually to Hostinger when needed.

## Frontend upload steps

```powershell
cd c:\xampp\htdocs\appbac\frontend
npm run build
```

Then in FileZilla, upload **everything inside** `frontend/dist/` into `public_html/` (not the `dist` folder itself).

After upload, hard-refresh the browser (`Ctrl+F5`). New `index.html` points at new hashed files under `assets/` (e.g. `index-XXXX.js`). Old unused asset files can be deleted later.

## Backend upload tips

- Mirror paths: local `backend/app/Services/Foo.php` → `public_html/backend/app/Services/Foo.php`
- Keep the Hostinger `.env` on the server; never replace it with your local file
- If you only changed one PHP file, uploading that single file is enough

## Quick checklist (typical UI change)

1. Edit code locally and verify with `npm run dev`
2. `npm run build` in `frontend/`
3. Upload `frontend/dist/` contents → `public_html/`
4. If API changed too, upload the matching files under `backend/`
5. Hard-refresh the live site
