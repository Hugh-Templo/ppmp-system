# PPMP frontend (React + Vite + Electron)

Browser UI and Windows desktop shell for the Ormoc City PPMP-APP Consolidation System. The UI talks to the FastAPI backend over `/api`.

## Prerequisites

- Node.js 20+
- FastAPI backend running on `http://127.0.0.1:8000` (see repo root)

## Browser (Vite)

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). API calls use the Vite proxy to FastAPI.

## Electron desktop

### Dev

1. Start FastAPI on port 8000.
2. From the **repo root** or from `frontend`:

```bash
npm run electron:dev
```

(If you are already in `frontend`, the same command works there.)

This starts Vite and opens an Electron window against `http://127.0.0.1:5173`. Login uses `POST /api/auth/token` (proxied to FastAPI), then `GET /api/auth/me`.

### Windows installer

```bash
npm run electron:build
```

Builds the React app with `VITE_API_BASE_URL=http://127.0.0.1:8000`, then packages a Windows NSIS installer under `dist-electron/`.

To point a packaged build at another API host, set `VITE_API_BASE_URL` before build (see `.env.electron.example`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite browser app |
| `npm run build` | Production web build (`dist/`) |
| `npm run electron:dev` | Electron + Vite HMR |
| `npm run electron:build` | Windows `.exe` installer |

## Notes

- Packaged Electron loads `dist/index.html` via `loadFile` and calls FastAPI at `VITE_API_BASE_URL`.
- Dev Electron leaves `VITE_API_BASE_URL` empty so relative `/api` paths go through the Vite proxy.
- Backend (Postgres, Redis, Celery, Google APIs) stays on the server; it is not bundled into the desktop app.
