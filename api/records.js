const { getPool, ensureTable, getStorageInfo } = require('./_db');
const { requireAuth } = require('./_auth');

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 2000; // generous ceiling so "export all" can request everything in one call

function parseBody(req) {
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }
  return body || {};
}

function validateBody(body) {
  const cat = (body.category || 'tor').toString().trim();
  const isTor = cat === 'tor';

  const requiredTor = ['log_date', 'name', 'control_no', 'course', 'documents_released', 'purpose', 'receipt_no'];
  const requiredMailing = ['log_date', 'name', 'purpose', 'school', 'delivery_method'];
  const required = isTor ? requiredTor : requiredMailing;

  for (const f of required) {
    if (!body[f] || !String(body[f]).trim()) {
      return `Missing required field: ${f}`;
    }
  }

  // Amount only validated if provided (for TOR mainly, mailing can omit or set 0)
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount < 0) {
      return 'Amount must be a valid number (0 or more)';
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  try {
    await ensureTable();
    const pool = getPool();

    // Anyone can view/search the log
    if (req.method === 'GET') {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
      const search = (req.query.search || '').toString().trim();
      const category = (req.query.category || '').toString().trim();

      const whereParts = [];
      const values = [];

      if (search) {
        values.push(`%${search}%`);
        const searchIdx = values.length;
        whereParts.push(`(
          name ILIKE $${searchIdx} OR
          control_no ILIKE $${searchIdx} OR
          course ILIKE $${searchIdx} OR
          documents_released ILIKE $${searchIdx} OR
          purpose ILIKE $${searchIdx} OR
          receipt_no ILIKE $${searchIdx} OR
          school ILIKE $${searchIdx} OR
          delivery_method ILIKE $${searchIdx} OR
          amount::text ILIKE $${searchIdx}
        )`);
      }

      if (category && ['tor', 'mailing'].includes(category)) {
        values.push(category);
        whereParts.push(`category = $${values.length}`);
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM logbook_entries ${whereClause}`,
        values
      );
      const total = Number(countResult.rows[0].total);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(page, totalPages);
      const offset = (currentPage - 1) * pageSize;

      const dataValues = [...values, pageSize, offset];
      const limitIdx = dataValues.length - 1;
      const offsetIdx = dataValues.length;

      const { rows } = await pool.query(
        `SELECT id, log_date, name, control_no, course, documents_released, purpose, receipt_no, amount,
                category, school, delivery_method, created_at, updated_at
         FROM logbook_entries
         ${whereClause}
         ORDER BY log_date DESC, id DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        dataValues
      );

      let storage = null;
      try {
        storage = await getStorageInfo();
      } catch {
        storage = null;
      }

      return res.status(200).json({
        records: rows,
        pagination: { page: currentPage, pageSize, total, totalPages },
        storage,
      });
    }

    // Everything else requires a valid admin token
    const auth = requireAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
    }

    const body = parseBody(req);

    if (req.method === 'POST') {
      const error = validateBody(body);
      if (error) return res.status(400).json({ error });

      const cat = (body.category || 'tor').toString().trim();
      const isTor = cat === 'tor';

      const log_date = body.log_date;
      const name = body.name.trim();
      const purpose = body.purpose.trim();
      const amount = Number(body.amount) || 0;

      let control_no = '', course = '', documents_released = '', receipt_no = '';
      let school = '', delivery_method = '';

      if (isTor) {
        control_no = (body.control_no || '').trim();
        course = (body.course || '').trim();
        documents_released = (body.documents_released || '').trim();
        receipt_no = (body.receipt_no || '').trim();
      } else {
        school = (body.school || '').trim();
        delivery_method = (body.delivery_method || '').trim();
      }

      const { rows } = await pool.query(
        `INSERT INTO logbook_entries
           (log_date, name, control_no, course, documents_released, purpose, receipt_no, amount,
            category, school, delivery_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [log_date, name, control_no, course, documents_released, purpose, receipt_no, amount,
         cat, school, delivery_method]
      );
      return res.status(201).json({ record: rows[0] });
    }

    if (req.method === 'PUT') {
      const id = req.query.id || body.id;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const error = validateBody(body);
      if (error) return res.status(400).json({ error });

      const cat = (body.category || 'tor').toString().trim();
      const isTor = cat === 'tor';

      const log_date = body.log_date;
      const name = body.name.trim();
      const purpose = body.purpose.trim();
      const amount = Number(body.amount) || 0;

      let control_no = '', course = '', documents_released = '', receipt_no = '';
      let school = '', delivery_method = '';

      if (isTor) {
        control_no = (body.control_no || '').trim();
        course = (body.course || '').trim();
        documents_released = (body.documents_released || '').trim();
        receipt_no = (body.receipt_no || '').trim();
      } else {
        school = (body.school || '').trim();
        delivery_method = (body.delivery_method || '').trim();
      }

      const { rows } = await pool.query(
        `UPDATE logbook_entries
         SET log_date = $1, name = $2, control_no = $3, course = $4,
             documents_released = $5, purpose = $6, receipt_no = $7, amount = $8,
             category = $9, school = $10, delivery_method = $11, updated_at = NOW()
         WHERE id = $12 RETURNING *`,
        [log_date, name, control_no, course, documents_released, purpose, receipt_no, amount,
         cat, school, delivery_method, id]
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
