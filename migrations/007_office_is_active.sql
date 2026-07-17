-- Soft-delete support for offices: hide from active lists without removing
-- PPMPs or per-office template folders under templates/end-users/.

ALTER TABLE office
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_office_is_active ON office(is_active);
