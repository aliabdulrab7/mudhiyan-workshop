const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const { db }     = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 8.7 — Brute-force protection: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  message: { error: 'محاولات كثيرة، حاول بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'بيانات غير صحيحة' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, shop_id: user.shop_id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, role: user.role, shop_id: user.shop_id, username: user.username });
});

module.exports = router;
