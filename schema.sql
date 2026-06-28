-- This table is created (and auto-migrated) by the API on first request,
-- but you can also run this manually in your Postgres console if you prefer.

CREATE TABLE IF NOT EXISTS logbook_entries (
  id SERIAL PRIMARY KEY,
  log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction TEXT NOT NULL,
  filed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If you have an older deployment where log_date was DATE-only, this upgrades it
-- (the API already does this automatically, so you don't need to run it by hand):
ALTER TABLE logbook_entries
ALTER COLUMN log_date TYPE TIMESTAMPTZ USING log_date::timestamptz;
