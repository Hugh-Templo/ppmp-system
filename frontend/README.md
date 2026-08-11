# PPMP Frontend (React + Vite)

Browser UI for the Ormoc City PPMP-APP Consolidation System. The UI talks to the **Laravel** backend over `/api`.

## Prerequisites

- Node.js 18+
- Laravel backend running on `http://127.0.0.1:8000` (see repo root `README.md`)

## Development

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. API calls are proxied to Laravel on port 8000.

## Production / Hostinger

Build with your production API URL (same origin on Hostinger):

```powershell
npm run build
```

Upload `dist/` to your Hostinger `public_html` (see `HOSTINGER_DEPLOY.md`).

## Electron (optional desktop)

```powershell
npm run electron:dev
```

Packaged builds use `VITE_API_BASE_URL` or `api-config.json` for the API base URL.
