const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Missing database connection string. Set POSTGRES_URL (Vercel Postgres) or DATABASE_URL in your environment variables.'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

let tableReady;
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      const p = getPool();
      await p.query(`
        CREATE TABLE IF NOT EXISTS logbook_entries (
          id SERIAL PRIMARY KEY,
          log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          transaction TEXT NOT NULL,
          filed_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      // Upgrades older deployments where log_date was DATE-only (no time).
      // Safe to run every time - it's a no-op once the column is already TIMESTAMPTZ.
      await p.query(`
        ALTER TABLE logbook_entries
        ALTER COLUMN log_date TYPE TIMESTAMPTZ USING log_date::timestamptz;
      `);
    })();
  }
  return tableReady;
}

module.exports = { getPool, ensureTable };
