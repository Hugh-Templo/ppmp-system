-- Budget validate → post to BAC → unpost for revision (office PPMP path).
-- Approved + Posted = eligible for BAC consolidation.
-- Existing Approved rows are backfilled as Posted so current APPs keep working.

ALTER TABLE ppmp
  ADD COLUMN IF NOT EXISTS posting_status VARCHAR NOT NULL DEFAULT 'Draft';

ALTER TABLE ppmp
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE ppmp
  ADD COLUMN IF NOT EXISTS posted_by INTEGER;

UPDATE ppmp
SET posting_status = 'Posted'
WHERE status = 'Approved'
  AND (posting_status IS NULL OR posting_status = 'Draft');

CREATE INDEX IF NOT EXISTS idx_ppmp_posting_status ON ppmp(posting_status);
