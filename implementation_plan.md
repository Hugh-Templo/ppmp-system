# Sync UI, FastAPI Backend Logic, and Database from `ppmpsys` to `appbac`

This plan outlines copying the updated **React Frontend UI**, **FastAPI Backend Logic**, and **Database Migrations** from `C:\xampp\htdocs\ppmpsys` into the current working directory `c:\xampp\htdocs\appbac` (on the `cloud-host` branch).

## User Review Required

> [!IMPORTANT]
> - **FastAPI Backend Activation**: The backend will be restored to the FastAPI Python structure (`app/` directory with `uvicorn app.main:app`).
> - **Files Overwritten**: Updated source files in `frontend/src`, `app/`, and `migrations/` will be synchronized with `C:\xampp\htdocs\ppmpsys`.

## Proposed Changes

### Database & Migrations

#### [MODIFY] [migrations](file:///c:/xampp/htdocs/appbac/migrations)
- Copy latest SQL migration scripts (`009_user_plain_password.sql`, `010_ppmp_posting_status.sql`, etc.) from `C:\xampp\htdocs\ppmpsys\migrations`.
- Synchronize `dbm_classification_init.sql` and root SQL schema definitions.

---

### FastAPI Backend (`app/`)

#### [MODIFY] [app](file:///c:/xampp/htdocs/appbac/app)
- Sync all Python FastAPI modules from `C:\xampp\htdocs\ppmpsys\app`:
  - `app/config.py`
  - `app/database.py`
  - `app/drive_sync.py`
  - `app/models.py`
  - `app/routers/auth.py`
  - `app/routers/bac.py`
  - `app/routers/budget.py`
  - `app/routers/offices.py`
  - `app/routers/dbm.py`

---

### Frontend UI (`frontend/`)

#### [MODIFY] [frontend/src](file:///c:/xampp/htdocs/appbac/frontend/src)
- Sync updated React frontend assets & logic from `C:\xampp\htdocs\ppmpsys\frontend`:
  - `frontend/src/Dashboard.jsx`
  - `frontend/src/Login.jsx`
  - `frontend/src/LoginSplit.jsx`
  - `frontend/src/index.css`
  - `frontend/src/App.jsx`
  - `frontend/src/App.css`
  - `frontend/src/api.js`

---

### Configuration & Dependencies

#### [MODIFY] [2 servers.txt](file:///c:/xampp/htdocs/appbac/2%20servers.txt)
- Ensure backend startup instructions point back to FastAPI: `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

## Verification Plan

### Automated Verification
- Verify Python FastAPI backend imports and app startup:
  ```powershell
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
  ```
- Build frontend to ensure zero React compile/syntax errors:
  ```powershell
  cd frontend
  npm run build
  ```

### Manual Verification
- Test login flow at `http://localhost:5173` (or `http://localhost:5174`).
- Verify backend API endpoints (`/api/auth/token`, `/api/offices`, `/api/bac/...`) respond correctly.
