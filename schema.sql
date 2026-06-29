-- This table is created (and auto-migrated) by the API on first request,
-- but you can also run this manually in your Postgres console if you prefer.

CREATE TABLE IF NOT EXISTS logbook_entries (
  id SERIAL PRIMARY KEY,
  log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL DEFAULT '',
  control_no TEXT NOT NULL DEFAULT '',
  course TEXT NOT NULL DEFAULT '',
  documents_released TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  receipt_no TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logbook_log_date ON logbook_entries (log_date DESC);

-- If you have an older deployment with a different schema, this upgrades it.
-- The API already does this automatically on startup, so you don't need to
-- run it by hand:
ALTER TABLE logbook_entries ALTER COLUMN log_date TYPE TIMESTAMPTZ USING log_date::timestamptz;
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS control_no TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS course TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS documents_released TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS receipt_no TEXT NOT NULL DEFAULT '';
ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE logbook_entries DROP COLUMN IF EXISTS student_name;
ALTER TABLE logbook_entries DROP COLUMN IF EXISTS transaction_no;
ALTER TABLE logbook_entries DROP COLUMN IF EXISTS document_type;
ALTER TABLE logbook_entries DROP COLUMN IF EXISTS transaction;
ALTER TABLE logbook_entries DROP COLUMN IF EXISTS filed_by;
