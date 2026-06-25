-- This table is created automatically the first time the API runs,
-- but you can also run this manually in your Postgres console if you prefer.

CREATE TABLE IF NOT EXISTS logbook_entries (
  id SERIAL PRIMARY KEY,
  log_date DATE NOT NULL,
  transaction TEXT NOT NULL,
  filed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
