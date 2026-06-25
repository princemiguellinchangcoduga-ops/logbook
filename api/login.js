const { createToken } = require('./_auth');

// Change these via Vercel environment variables: ADMIN_USERNAME, ADMIN_PASSWORD.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }

  const { username, password } = body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = createToken(username);
    return res.status(200).json({ token });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
};
