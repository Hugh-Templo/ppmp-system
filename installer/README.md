# PPMP System — Windows server installer

Full desktop install for a new server PC: **embedded Python API**, **rclone**, **always-on Windows service**, and **Electron UI**.

You install **PostgreSQL** yourself before running Setup.

## Target PC (install order)

1. Install [PostgreSQL](https://www.postgresql.org/download/windows/) and create database `ppmpbacdb`.
2. Run `PPMP-System-Setup.exe` **as Administrator**.
3. On the **API and database** page (before files are configured as a service):
   - Enter **API port** (default `8000`) — the service keeps listening on this port
   - Enter **DATABASE_URL** (e.g. `postgresql://postgres:YOURPASSWORD@localhost:5432/ppmpbacdb`)
4. Finish setup. The **PPMP-API** Windows service starts automatically.
5. Configure Drive once: Start Menu → **PPMP System** → **Configure rclone** → create remote named `gdrive`.
6. Launch **PPMP System** from the Start Menu / desktop.

Uninstall via Windows **Apps & features** (stops and removes the PPMP-API service).

## Build PC (create Setup.exe)

Prerequisites:

- Windows x64
- Node.js + npm (for Electron UI)
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) (`ISCC.exe` on PATH recommended)
- Network access (downloads embeddable Python, rclone, WinSW)

```powershell
cd C:\xampp\htdocs\ppmpsys

# Stage payload (Python + pip deps + rclone + WinSW + app + Electron UI)
powershell -ExecutionPolicy Bypass -File .\installer\scripts\prepare-runtime.ps1

# Or skip Electron if you already copied win-unpacked to installer\payload\ui:
# powershell -ExecutionPolicy Bypass -File .\installer\scripts\prepare-runtime.ps1 -SkipElectron

# Compile Setup.exe
powershell -ExecutionPolicy Bypass -File .\installer\scripts\build-installer.ps1
```

Output: `dist-installer\PPMP-System-Setup.exe`

### Manual Inno compile

```text
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\ppmp-setup.iss
```

## Install layout

| Path | Purpose |
|------|---------|
| `runtime\python\` | Embedded CPython + packages |
| `app\` | FastAPI application |
| `tools\rclone\` | Bundled rclone |
| `tools\winsw\` | WinSW service wrapper (`PPMP-API`) |
| `ui\` | Electron desktop app |
| `.env` | `DATABASE_URL`, `RCLONE_PATH`, folder paths |
| `api-config.json` | `{ "apiBaseUrl": "http://127.0.0.1:<port>" }` |
| `IT_ppmps\` | Local PPMP sync folders |
| `logs\` | API service logs |

## Service

- Name: **PPMP-API**
- Command: `python -m uvicorn app.main:app --host 0.0.0.0 --port <chosen>`
- Start: Automatic
- Manage: `services.msc` or `tools\winsw\PPMP-API.exe start|stop|restart`

## Notes

- Redis/Celery are **not** required for the Drive PPMP → APP flow.
- Do not ship production secrets in the Setup; operators set `DATABASE_URL` at install and configure rclone on the server.
- If the chosen port is in use or Postgres connection fails, `Configure-Install.ps1` aborts with an error (re-run Setup with corrected values).
