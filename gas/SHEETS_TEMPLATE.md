# Google Sheets Template — Indicative PPMP (Per Office)

See `gas/README.md` for deployment. Each office gets one spreadsheet per fiscal year, aligned with the official RA 12009 (NGPA) templates in `templates/`.

## Per-office spreadsheet tabs

Each office spreadsheet (`{OFFICE_CODE}_Indicative_PPMP_{FY}`) contains 7 tabs, in order:

1. `PPMP_Header` — office metadata, status, totals, edit lock
2. `Items_CSE` — structured 14-column CSE line items (web app writes here)
3. `Items_nonCSE` — structured 14-column non-CSE line items
4. `PPMP_CSE_Form` — printable NGPA_PPMP.xlsx-style form (formulas mirror `Items_CSE`)
5. `PPMP_nonCSE_Form` — printable NGPA_PPMP.xlsx-style form (formulas mirror `Items_nonCSE`)
6. `Signatory` — key/value pairs
7. `Audit_Log` — event history

### 1. `PPMP_Header`

Row 1 = column names, Row 2 = values.

Columns (16):
`office_code`, `office_name`, `fiscal_year`, `title`, `type`, `status`, `posting_status`,
`budget_allocation`, `total_estimated_budget`, `remarks`, `is_editable`, `edit_lock_reason`,
`submitted_at`, `reviewed_at`, `posted_at`, `spreadsheet_id`.

### 2 & 3. `Items_CSE` and `Items_nonCSE`

Both tabs have the same 14-column layout, mapped to NGPA_PPMP.xlsx columns 1–12:

| # | Column             | NGPA Col | Type       | Notes                                                              |
|---|--------------------|----------|------------|--------------------------------------------------------------------|
| A | `row_id`           | —        | int        | Auto-assigned; used by sync                                        |
| B | `description`      | 1        | text       | General Description and Objective                                  |
| C | `project_type`     | 2        | dropdown   | Goods / Infrastructure / Consulting Services / General Support Services |
| D | `quantity_size`    | 3        | text       | Quantity/size by lot, item, or package (or reference to TOR)       |
| E | `procurement_mode` | 4        | dropdown   | Full NGPA list (see below)                                         |
| F | `pre_proc_conf`    | 5        | Yes/No     | Pre-Procurement Conference                                         |
| G | `proc_start`       | 6        | MM/YYYY    | Start of Procurement Activity                                      |
| H | `proc_end`         | 7        | MM/YYYY    | End of Procurement Activity                                        |
| I | `delivery_period`  | 8        | MM/YYYY    | Expected Delivery / Implementation Period (or "as needed")         |
| J | `fund_source`      | 9        | dropdown   | GoP-Current, GoP-Continuing, Foreign, SPF, Corporate, Income, Others |
| K | `estimated_budget` | 10       | number     | Estimated Budget / ABC (PhP)                                       |
| L | `supporting_docs`  | 11       | text       | Attached supporting documents (URLs or filenames)                  |
| M | `remarks`          | 12       | text       | Additional details / clarifications                                |
| N | `locked`           | —        | bool       | Drives per-row edit lock                                           |

Only difference between `Items_CSE` and `Items_nonCSE` is which tab the row belongs to — the sync sets `is_cse` accordingly.

### 4 & 5. `PPMP_CSE_Form` and `PPMP_nonCSE_Form`

Printable views mirroring the official NGPA_PPMP.xlsx layout. Rows are populated automatically from the corresponding `Items_*` tab via:

```
=IFERROR(FILTER(Items_CSE!B2:M, Items_CSE!B2:B<>""), "")
```

End users never edit these tabs — they only edit `Items_*` through the web app. Use these tabs for printing/exporting the PPMP in RA 12009 format.

### 6. `Signatory`

Two-column Field/Value pairs:

`submitted_by`, `submitted_by_designation`, `prepared_by`, `prepared_by_designation`,
`aip_reference`, `responsibility_center_no`, `office_code_from_pr`.

### 7. `Audit_Log`

`timestamp`, `actor_email`, `action`, `old_status`, `new_status`, `remarks`.

## Dropdown option lists

### `PROJECT_TYPES` (NGPA Col 2)

- Goods
- Infrastructure
- Consulting Services
- General Support Services

### `PROCUREMENT_MODES` (NGPA Col 4)

From NGPA_nonCSE-APP.xlsx Dropdown tab:

- Competitive Bidding
- Limited Source Bidding
- Competitive Dialogue
- Unsolicited Offer with Bid Matching
- Direct Contracting
- Direct Acquisition
- Repeat Order
- Small Value Procurement
- Negotiated Procurement — Two Failed Bidding
- Negotiated Procurement — Emergency Cases
- Negotiated Procurement — Take Over of Contracts
- Negotiated Procurement — Adjacent or Contiguous
- Negotiated Procurement — Agency-to-Agency
- Negotiated Procurement — Scientific, Scholarly or Artistic Work, Exclusive Technology
- Negotiated Procurement — Highly Technical Consultants
- Negotiated Procurement — Defense Cooperation Agreements and Inventory-Based Items
- Negotiated Procurement — Lease of Real Property and Venue
- Negotiated Procurement — NGO Participation
- Negotiated Procurement — Community Participation
- Negotiated Procurement — UN Agencies, International Organizations
- Negotiated Procurement — Direct Retail Purchase of Petroleum Fuel, Oil and Lubricants
- Direct Sales
- Direct Procurement for Science, Technology, and Innovation

### `FUND_SOURCES` (NGPA Col 9)

- GoP - Current Budget Year
- GoP - Continuing Fund
- Foreign
- Special Purpose Fund
- Corporate Budget
- Income
- Others, specify in Remarks

## Master registry files (owned by BAC Drive)

### `Office_Registry`

`office_code`, `office_name`, `contact_email`, `budget_allocation`, `google_group`

### `Submission_Status`

`office_code`, `office_name`, `fiscal_year`, `spreadsheet_id`, `status`, `posting_status`,
`total_estimated_budget`, `submitted_at`, `reviewed_at`, `posted_at`, `remarks`

## FastAPI sync (Option B)

`app/sheets_sync.py` reads:

- `Submission_Status!A2:K` on the master workbook
- `PPMP_Header!A2:P2` on each office workbook
- `Items_CSE!A2:N` and `Items_nonCSE!A2:N` on each office workbook

Items are upserted into `PPMPItem` keyed by `(indicative_ppmp_id, sheet_row_id, is_cse)`. The `is_cse` flag is set from the originating tab.

## BAC APP export (BAC Admin)

Once indicative PPMPs are approved and consolidated (`POST /api/bac/consolidate/{fiscal_year}`), BAC Admin can download:

- `GET /api/bac/apps/{fy}/export/cse` → filled `NGPA_CSE-APP.xlsx`
- `GET /api/bac/apps/{fy}/export/noncse` → filled `NGPA_nonCSE-APP.xlsx`
- `GET /api/bac/apps/{fy}/export/combined` → filled `APP-CSE&nonCSE {fy} Form.xlsx`

These endpoints render the consolidated `APPRow` records into the corresponding official templates in `templates/`.
