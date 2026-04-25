const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const { db }     = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

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

// ── User settings ───────────────────────────────────────────────────────────
// Settings are scoped to the authenticated user — no role gating beyond auth.
// Sound-on-scan and other per-device toggles live in localStorage, not here.

const SETTINGS_FIELDS    = new Set(['default_label_preset', 'default_printer_mode']);
const PRINTER_MODE_ENUM  = new Set(['niimbot', 'universal']);
const LABEL_PRESET_ENUM  = new Set(['50x30', '57x32', '80x50', '100x50', '100x100', 'a4']);

function ensureSettingsRow(userId) {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
}

function readSettings(userId) {
  return db.prepare(
    'SELECT default_label_preset, default_printer_mode FROM user_settings WHERE user_id = ?'
  ).get(userId);
}

router.get('/me/settings', requireAuth, (req, res) => {
  ensureSettingsRow(req.user.id);
  res.json(readSettings(req.user.id));
});

router.patch('/me/settings', requireAuth, (req, res) => {
  const body = req.body || {};
  const keys = Object.keys(body);

  for (const k of keys) {
    if (!SETTINGS_FIELDS.has(k)) {
      return res.status(400).json({ error: `حقل غير معروف: ${k}` });
    }
  }
  if ('default_printer_mode' in body
      && body.default_printer_mode !== null
      && !PRINTER_MODE_ENUM.has(body.default_printer_mode)) {
    return res.status(400).json({ error: 'وضع الطابعة غير معروف' });
  }
  if ('default_label_preset' in body
      && body.default_label_preset !== null
      && !LABEL_PRESET_ENUM.has(body.default_label_preset)) {
    return res.status(400).json({ error: 'حجم الملصق غير معروف' });
  }

  ensureSettingsRow(req.user.id);

  if (keys.length > 0) {
    const sets   = keys.map(k => `${k} = ?`).concat(["updated_at = datetime('now','localtime')"]);
    const values = keys.map(k => body[k]);
    values.push(req.user.id);
    db.prepare(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = ?`).run(...values);
  }

  res.json(readSettings(req.user.id));
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  // Force-relogin is enforced client-side: tokens minted before the change
  // remain valid until expiry. Document the limitation in CLAUDE.md.
  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  res.json({ ok: true, must_relogin: true });
});

module.exports = router;
