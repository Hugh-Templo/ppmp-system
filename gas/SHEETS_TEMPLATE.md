# Google Sheets Template — Indicative PPMP (Per Office)

See `gas/README.md` for deployment. Each office gets one spreadsheet per fiscal year.

## Tab 1: PPMP_Header (row 1 = headers, row 2 = values)

office_code, office_name, fiscal_year, title, type, status, posting_status,
budget_allocation, total_estimated_budget, remarks, is_editable, edit_lock_reason,
submitted_at, reviewed_at, posted_at, spreadsheet_id

## Tab 2: PPMP_Items

row_id, description, category, is_cse, quantity, unit_of_measure, unit_cost,
estimated_budget, procurement_mode, q1_qty, q2_qty, q3_qty, q4_qty, locked

## Tab 3: Signatory

Field/Value pairs: submitted_by, submitted_by_designation, prepared_by,
prepared_by_designation, aip_reference, responsibility_center_no, office_code_from_pr

## Tab 4: Audit_Log

timestamp, actor_email, action, old_status, new_status, remarks

## Master: Office_Registry

office_code, office_name, contact_email, budget_allocation, google_group

## Master: Submission_Status

office_code, office_name, fiscal_year, spreadsheet_id, status, posting_status,
total_estimated_budget, submitted_at, reviewed_at, posted_at, remarks
