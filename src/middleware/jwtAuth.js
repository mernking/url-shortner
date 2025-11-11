const jwt = require('jsonwebtoken');
const { getUserPermissions } = require('./rbac');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

async function jwtAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Malformed authorization header' });
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;

    // Attach user permissions for easy access
    try {
      req.user.permissions = await getUserPermissions(payload.userId);
    } catch (permError) {
      console.error('Failed to load user permissions:', permError);
      req.user.permissions = [];
    }

    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = jwtAuth;