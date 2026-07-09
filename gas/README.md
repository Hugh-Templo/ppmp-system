# Google Apps Script — PPMP Indicative System

Deploy under a **BAC personal Gmail account** (e.g. `bac.ormoc@gmail.com`). No Google Workspace required — each office uses its own personal Gmail (e.g. `cho.ormoc@gmail.com`) listed in `Office_Registry`.

## Projects

| Folder | Web App | Users |
|--------|---------|-------|
| `setup/` | N/A (run manually) | BAC admin |
| `end-user/` | End User PPMP Form | 40 office representatives |
| `budget-office/` | Budget Office Review | City Budget Office staff |

## Deployment Steps

### 1. Create Drive folder structure

Sign in as `bac.ormoc@gmail.com` and create:

```
PPMP_Indicative/
├── _Master/
│   ├── Office_Registry.gsheet
│   └── Submission_Status_2027.gsheet   (created by setup script)
└── 2027/
    └── (office sheets created by setup script)
```

Then create `Office_Registry.gsheet` inside `_Master/` with columns
`office_code`, `office_name`, `contact_email`, `budget_allocation`.

**Quick start (no emails yet):** import `templates/end-users/Office_Registry_import.csv`
(generated from `templates/end-users/offices_list.xlsx`) into a new Google Sheet.
Leave `contact_email` blank for now — setup will still create all office PPMP sheets;
end users cannot sign in until BAC fills in their Gmail per row.

When emails are ready, set `contact_email` to the **exact** Gmail each office rep will use.

### 2. Run setup script

1. Open [script.google.com](https://script.google.com) → New project (signed in as `bac.ormoc@gmail.com`)
2. Copy files from `gas/setup/` into the project
3. Set `MASTER_FOLDER_ID` and `OFFICE_REGISTRY_ID` in `Config.gs`
4. Run `setupFiscalYear(2027)` — creates one spreadsheet per office and `Submission_Status_2027`

### 3. Deploy End User Web App

1. New Apps Script project → copy all files from `gas/end-user/`
2. Set IDs in `Config.gs` (`OFFICE_REGISTRY_ID`, `SUBMISSION_STATUS_ID`, `FISCAL_YEAR`)
3. Deploy → New deployment → Web app
   - Execute as: **Me** (`bac.ormoc@gmail.com`)
   - Who has access: **Anyone** (Google sign-in required — do NOT pick "Anyone anonymous")
4. Share the web app URL with each office. Access control is enforced by `Auth.gs`, which matches the signed-in email against `contact_email` in `Office_Registry`.

### 4. Deploy Budget Office Web App

1. New Apps Script project → copy all files from `gas/budget-office/`
2. Add authorized emails to `BUDGET_OFFICE_EMAILS` in `Auth.gs` (e.g. `budget.ormoc@gmail.com`)
3. Deploy → New deployment → Web app
   - Execute as: **Me** (`bac.ormoc@gmail.com`)
   - Who has access: **Anyone** (Google sign-in required)
4. Share the URL with budget office staff.

### 5. Connect FastAPI (Option B)

1. Create a Google Cloud service account with **Google Sheets API** enabled
2. Share `Submission_Status_2027` spreadsheet with the service account email (Viewer)
3. Download JSON key → save as `credentials/google-service-account.json`
4. Run DB migrations in order:
   - `migrations/001_sheets_sync.sql`
   - `migrations/002_ngpa_columns.sql` (NGPA / RA 12009 columns on `ppmpitem` and `approw`)
5. Set env vars in `.env` (see below)
6. BAC Admin can manually sync via `POST /api/bac/sync-sheets` or wait for hourly Celery job

### 6. Consolidate & Export APP (BAC Admin)

Once offices' indicative PPMPs are approved and posted:

1. `POST /api/bac/consolidate/{fiscal_year}` — builds an `APP` grouped by
   `(is_cse, description, project_type, procurement_mode, fund_source)` with CSE
   and non-CSE kept as separate rows.
2. Download the official RA 12009 outputs (BAC dashboard has three buttons):
   - `GET /api/bac/apps/{fy}/export/cse`      → filled `NGPA_CSE-APP.xlsx`
   - `GET /api/bac/apps/{fy}/export/noncse`   → filled `NGPA_nonCSE-APP.xlsx`
   - `GET /api/bac/apps/{fy}/export/combined` → filled `APP-CSE&nonCSE {fy} Form.xlsx`

The three templates live in `templates/` and are opened via openpyxl, so the
official layouts, formatting, and formulas are preserved.

## Environment Variables (FastAPI)

```env
GOOGLE_SERVICE_ACCOUNT_FILE=./credentials/google-service-account.json
GOOGLE_MASTER_SPREADSHEET_ID=submission_status_sheet_id
GOOGLE_SYNC_FISCAL_YEAR=2027
```

## Per-office Sheet Structure

Each office's spreadsheet contains 7 tabs, aligned with the RA 12009 NGPA
templates in `templates/`:

1. `PPMP_Header` — office metadata, status, totals, edit lock
2. `Items_CSE` — structured CSE line items (web app writes here)
3. `Items_nonCSE` — structured non-CSE line items
4. `PPMP_CSE_Form` — printable NGPA_PPMP layout (formulas mirror `Items_CSE`)
5. `PPMP_nonCSE_Form` — printable NGPA_PPMP layout (formulas mirror `Items_nonCSE`)
6. `Signatory`
7. `Audit_Log`

`Items_CSE` / `Items_nonCSE` use the 14-column NGPA layout (see
`SHEETS_TEMPLATE.md` for column reference and dropdown options).

## Edit Lock Rules

- **Draft / Returned** → end user can edit
- **Pending Budget Review** (submitted) → locked
- **Approved** → permanently locked
- Budget office **Return for Revision** unlocks (only if not Approved)
- Budget office **Approve** permanently locks

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| "No office assigned to <email>" | Email not in `Office_Registry.contact_email`, or typo. Add/fix the row. |
| "Unauthorized. Only Budget Office staff..." | Email not in `BUDGET_OFFICE_EMAILS`. Add it in `gas/budget-office/Auth.gs` and redeploy. |
| Office rep can open sheet directly and edit past a lock | The lock lives in the web app. Do not share raw sheets with edit access; keep sheets owned by `bac.ormoc@gmail.com` only. |
| End user prompted for permissions on first open | Normal — Google asks for consent because the app runs as BAC. |
