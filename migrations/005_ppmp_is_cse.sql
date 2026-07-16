-- PPMP-level CSE / nonCSE flag. Items still carry their own is_cse and can
-- override this default so a single PPMP may end up mixed if the user picks
-- catalog entries of the other type; the PPMP row still displays the badge
-- chosen at creation.

ALTER TABLE ppmp
  ADD COLUMN IF NOT EXISTS is_cse BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ppmp_is_cse ON ppmp(is_cse);
