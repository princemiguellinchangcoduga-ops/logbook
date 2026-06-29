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

      // Fresh installs get the current schema right away.
      await p.query(`
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
      `);

      // Upgrade older deployments of this app that used a previous/different schema.
      await p.query(`ALTER TABLE logbook_entries ALTER COLUMN log_date TYPE TIMESTAMPTZ USING log_date::timestamptz;`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS control_no TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS course TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS documents_released TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS receipt_no TEXT NOT NULL DEFAULT '';`);
      await p.query(`ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0;`);
      // Fields from earlier versions of this app that are no longer used.
      await p.query(`ALTER TABLE logbook_entries DROP COLUMN IF EXISTS student_name;`);
      await p.query(`ALTER TABLE logbook_entries DROP COLUMN IF EXISTS transaction_no;`);
      await p.query(`ALTER TABLE logbook_entries DROP COLUMN IF EXISTS document_type;`);
      await p.query(`ALTER TABLE logbook_entries DROP COLUMN IF EXISTS transaction;`);
      await p.query(`ALTER TABLE logbook_entries DROP COLUMN IF EXISTS filed_by;`);

      await p.query(`CREATE INDEX IF NOT EXISTS idx_logbook_log_date ON logbook_entries (log_date DESC);`);
    })();
  }
  return tableReady;
}

const DEFAULT_STORAGE_LIMIT_MB = 500;

// Reports how close the database is to its storage limit (e.g. a Prisma Postgres
// or Neon free-tier cap). Set STORAGE_LIMIT_MB in env vars if yours differs.
async function getStorageInfo() {
  const p = getPool();
  const { rows } = await p.query('SELECT pg_database_size(current_database()) AS bytes;');
  const bytes = Number(rows[0].bytes);
  const limitMb = Number(process.env.STORAGE_LIMIT_MB) || DEFAULT_STORAGE_LIMIT_MB;
  const limitBytes = limitMb * 1024 * 1024;
  const percent = limitBytes ? Math.min(100, (bytes / limitBytes) * 100) : 0;
  return { bytes, limitBytes, percent };
}

module.exports = { getPool, ensureTable, getStorageInfo };
