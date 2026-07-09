# Google Apps Script — PPMP Indicative System

Deploy under the **BAC Google Workspace account**.

## Projects

| Folder | Web App | Users |
|--------|---------|-------|
| `setup/` | N/A (run manually) | BAC admin |
| `end-user/` | End User PPMP Form | 40 office representatives |
| `budget-office/` | Budget Office Review | City Budget Office staff |

## Deployment Steps

### 1. Create Drive folder structure

On the BAC account, create:

```
PPMP_Indicative/
├── _Master/
│   ├── Office_Registry.gsheet
│   └── Submission_Status_2027.gsheet
└── 2027/
    └── (office sheets created by setup script)
```

### 2. Run setup script

1. Open [script.google.com](https://script.google.com) → New project
2. Copy files from `gas/setup/` into the project
3. Set `MASTER_FOLDER_ID` and `OFFICE_REGISTRY_ID` in `Config.gs`
4. Run `setupFiscalYear(2027)` — creates 40 office spreadsheets from template

### 3. Deploy End User Web App

1. New Apps Script project → copy all files from `gas/end-user/`
2. Set IDs in `Config.gs` (MASTER_SHEET_ID, SUBMISSION_STATUS_ID, FISCAL_YEAR)
3. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone within [your domain]**
4. Share each office sheet with the office Google Group (Editor)

### 4. Deploy Budget Office Web App

1. New Apps Script project → copy all files from `gas/budget-office/`
2. Set `BUDGET_OFFICE_EMAILS` in `Auth.gs`
3. Deploy same as above
4. Share `_Master` folder and all office sheets with Budget Office group (Editor)

### 5. Connect FastAPI (Option B)

1. Create a Google Cloud service account with **Google Sheets API** enabled
2. Share `Submission_Status_2027` spreadsheet with the service account email (Viewer)
3. Download JSON key → save as `credentials/google-service-account.json`
4. Run DB migration: `migrations/001_sheets_sync.sql`
5. Set env vars in `.env` (see below)
6. BAC Admin can manually sync via `POST /api/bac/sync-sheets` or wait for hourly Celery job

## Environment Variables (FastAPI)

```env
GOOGLE_SERVICE_ACCOUNT_FILE=./credentials/google-service-account.json
GOOGLE_DRIVE_PPMP_FOLDER_ID=your_drive_folder_id
GOOGLE_MASTER_SPREADSHEET_ID=submission_status_sheet_id
GOOGLE_SYNC_FISCAL_YEAR=2027
```

## Edit Lock Rules

- **Draft / Returned** → end user can edit
- **Pending Budget Review** (submitted) → locked
- **Approved** → permanently locked
- Budget office **Return for Revision** unlocks (only if not Approved)
- Budget office **Approve** permanently locks
