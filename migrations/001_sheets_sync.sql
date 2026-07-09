-- Run after deploying sheets sync (new columns on existing tables)

ALTER TABLE indicative_ppmp
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER,
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS spreadsheet_id VARCHAR;

ALTER TABLE ppmpitem
  ALTER COLUMN ppmp_id DROP NOT NULL;

ALTER TABLE ppmpitem
  ADD COLUMN IF NOT EXISTS indicative_ppmp_id INTEGER REFERENCES indicative_ppmp(id),
  ADD COLUMN IF NOT EXISTS sheet_row_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_ppmpitem_indicative_ppmp_id ON ppmpitem(indicative_ppmp_id);
CREATE INDEX IF NOT EXISTS idx_indicative_ppmp_spreadsheet_id ON indicative_ppmp(spreadsheet_id);
