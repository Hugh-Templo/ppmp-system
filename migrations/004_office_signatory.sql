-- Persist per-office signatory + template path so the Dashboard Signatory tab
-- can rewrite each office's NGPA_PPMP.xlsx footer without re-parsing Excel.
-- All new columns are nullable so existing office rows remain valid.

ALTER TABLE office
  ADD COLUMN IF NOT EXISTS submitted_by VARCHAR,
  ADD COLUMN IF NOT EXISTS submitted_by_designation VARCHAR,
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR,
  ADD COLUMN IF NOT EXISTS prepared_by_designation VARCHAR,
  ADD COLUMN IF NOT EXISTS aip_reference VARCHAR,
  ADD COLUMN IF NOT EXISTS responsibility_center_no VARCHAR,
  ADD COLUMN IF NOT EXISTS office_code_from_pr VARCHAR,
  ADD COLUMN IF NOT EXISTS ppmp_template_path VARCHAR;
