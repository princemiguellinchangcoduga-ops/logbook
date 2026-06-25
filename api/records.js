const { getPool, ensureTable } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    await ensureTable();
    const pool = getPool();

    // Anyone can view the log
    if (req.method === 'GET') {
      const { rows } = await pool.query(
        'SELECT id, log_date, transaction, filed_by, created_at, updated_at FROM logbook_entries ORDER BY log_date DESC, id DESC'
      );
      return res.status(200).json({ records: rows });
    }

    // Everything else requires a valid admin token
    const auth = requireAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
    }

    let body = req.body;
    if (!body || typeof body === 'string') {
      try {
        body = JSON.parse(body || '{}');
      } catch {
        body = {};
      }
    }
    body = body || {};

    if (req.method === 'POST') {
      const { log_date, transaction, filed_by } = body;
      if (!log_date || !transaction || !filed_by) {
        return res.status(400).json({ error: 'log_date, transaction, and filed_by are required' });
      }
      const { rows } = await pool.query(
        'INSERT INTO logbook_entries (log_date, transaction, filed_by) VALUES ($1, $2, $3) RETURNING *',
        [log_date, transaction, filed_by]
      );
      return res.status(201).json({ record: rows[0] });
    }

    if (req.method === 'PUT') {
      const id = req.query.id || body.id;
      const { log_date, transaction, filed_by } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (!log_date || !transaction || !filed_by) {
        return res.status(400).json({ error: 'log_date, transaction, and filed_by are required' });
      }
      const { rows } = await pool.query(
        'UPDATE logbook_entries SET log_date = $1, transaction = $2, filed_by = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
        [log_date, transaction, filed_by, id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({ record: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || body.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { rows } = await pool.query('DELETE FROM logbook_entries WHERE id = $1 RETURNING id', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json({ deleted: rows[0].id });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
