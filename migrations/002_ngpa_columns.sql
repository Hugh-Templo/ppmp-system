-- NGPA / RA 12009 template alignment: extend ppmpitem with 12-column NGPA_PPMP fields.
-- All new columns are nullable so existing rows remain valid.

ALTER TABLE ppmpitem
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN unit_of_measure DROP NOT NULL;

ALTER TABLE ppmpitem
  ADD COLUMN IF NOT EXISTS project_type VARCHAR,       -- NGPA Col 2
  ADD COLUMN IF NOT EXISTS quantity_size TEXT,         -- NGPA Col 3
  ADD COLUMN IF NOT EXISTS pre_proc_conf BOOLEAN DEFAULT FALSE,  -- NGPA Col 5
  ADD COLUMN IF NOT EXISTS proc_start VARCHAR,         -- NGPA Col 6 (MM/YYYY)
  ADD COLUMN IF NOT EXISTS proc_end VARCHAR,           -- NGPA Col 7
  ADD COLUMN IF NOT EXISTS delivery_period VARCHAR,    -- NGPA Col 8
  ADD COLUMN IF NOT EXISTS fund_source VARCHAR,        -- NGPA Col 9
  ADD COLUMN IF NOT EXISTS supporting_docs TEXT,       -- NGPA Col 11
  ADD COLUMN IF NOT EXISTS remarks TEXT;               -- NGPA Col 12

CREATE INDEX IF NOT EXISTS idx_ppmpitem_project_type ON ppmpitem(project_type);
CREATE INDEX IF NOT EXISTS idx_ppmpitem_fund_source ON ppmpitem(fund_source);

-- APPRow: add NGPA columns for CSE/non-CSE consolidated APP export
ALTER TABLE approw
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN total_quantity DROP NOT NULL,
  ALTER COLUMN unit_of_measure DROP NOT NULL,
  ALTER COLUMN unit_cost DROP NOT NULL;

ALTER TABLE approw
  ADD COLUMN IF NOT EXISTS project_type VARCHAR,
  ADD COLUMN IF NOT EXISTS fund_source VARCHAR,
  ADD COLUMN IF NOT EXISTS quantity_size TEXT,
  ADD COLUMN IF NOT EXISTS proc_start VARCHAR,
  ADD COLUMN IF NOT EXISTS proc_end VARCHAR,
  ADD COLUMN IF NOT EXISTS delivery_period VARCHAR,
  ADD COLUMN IF NOT EXISTS pre_proc_conf BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS end_user_offices TEXT;

CREATE INDEX IF NOT EXISTS idx_approw_is_cse ON approw(is_cse);
CREATE INDEX IF NOT EXISTS idx_approw_project_type ON approw(project_type);
