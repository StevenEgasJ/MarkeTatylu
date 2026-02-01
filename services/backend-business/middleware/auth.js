const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    console.warn('Auth middleware: missing Authorization header for', { path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const parts = auth.split(' ');
  if (parts.length !== 2) {
    console.warn('Auth middleware: invalid Authorization header format', { header: auth, path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Invalid auth header' });
  }
  const token = parts[1];
  try {
    const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload;
    next();
  } catch (err) {
    console.warn('Auth middleware: token verification failed', { error: err && err.message, path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authMiddleware };