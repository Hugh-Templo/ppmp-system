-- PS-DBM CSE catalogue (APP-CSE 2027 Form) stored in PostgreSQL for
-- end-user item combobox classification (CSE vs nonCSE).

CREATE TABLE IF NOT EXISTS cse_catalog_item (
  id SERIAL PRIMARY KEY,
  code VARCHAR NOT NULL DEFAULT '',
  description VARCHAR NOT NULL,
  unit_of_measure VARCHAR NOT NULL DEFAULT 'piece',
  category VARCHAR NOT NULL DEFAULT 'Common-Use Supplies and Equipment',
  is_cse BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cse_catalog_item_code ON cse_catalog_item(code);
CREATE INDEX IF NOT EXISTS idx_cse_catalog_item_description ON cse_catalog_item(description);
CREATE INDEX IF NOT EXISTS idx_cse_catalog_item_category ON cse_catalog_item(category);
