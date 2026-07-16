-- Final PPMP table for RA 12009 Phase 4 (post-GAA finalization).
-- Creates the table if SQLModel.create_all has not already provisioned it,
-- and adds versioning fields so supplemental revisions (v2+) can coexist
-- with the original Final PPMP (v1) for the same office and fiscal year.

CREATE TABLE IF NOT EXISTS final_ppmp (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  fiscal_year INTEGER NOT NULL,
  office_id INTEGER NOT NULL REFERENCES office(id),
  status VARCHAR NOT NULL DEFAULT 'Draft',
  type VARCHAR NOT NULL DEFAULT 'Final',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approval_status VARCHAR NOT NULL DEFAULT 'Draft',
  approved_at TIMESTAMP,
  approved_by INTEGER,
  verification_notes TEXT
);

ALTER TABLE final_ppmp
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_final_ppmp_fiscal_year ON final_ppmp(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_final_ppmp_office_id ON final_ppmp(office_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_final_ppmp_office_fy_version'
  ) THEN
    ALTER TABLE final_ppmp
      ADD CONSTRAINT uq_final_ppmp_office_fy_version
      UNIQUE (office_id, fiscal_year, version);
  END IF;
END $$;
