const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'الجلسة منتهية' });
  }
}

function requireRole(role) {
  const allowed = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: 'غير مسموح' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
