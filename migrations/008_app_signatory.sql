-- Agency-wide APP footer signatories (CSE + nonCSE). Singleton row id=1.

CREATE TABLE IF NOT EXISTS app_signatory (
  id INTEGER PRIMARY KEY,
  prepared_by VARCHAR,
  prepared_by_designation VARCHAR,
  recommended_by VARCHAR,
  recommended_by_designation VARCHAR,
  approved_by_name VARCHAR,
  approved_by_designation VARCHAR,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_signatory (id, updated_at)
SELECT 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM app_signatory WHERE id = 1);
