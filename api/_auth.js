const crypto = require('crypto');

// Set ADMIN_TOKEN_SECRET in your Vercel environment variables to a long random string.
const SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret-please';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function createToken(username) {
  return sign({ user: username, exp: Date.now() + TOKEN_TTL_MS });
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyToken(token);
}

module.exports = { createToken, verifyToken, requireAuth };
