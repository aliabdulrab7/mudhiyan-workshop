const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('workshop'));

// GET /api/admin/branches — list all shops with their employees
router.get('/branches', (_req, res) => {
  const shops = db.prepare(`
    SELECT s.id, s.name,
           u.id   AS user_id,
           u.username
    FROM shops s
    LEFT JOIN users u ON u.shop_id = s.id AND u.role = 'shop_employee'
    ORDER BY s.id
  `).all();
  res.json(shops);
});

// POST /api/admin/branches — create shop + employee in one step
router.post('/branches', (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'الاسم واسم المستخدم وكلمة المرور مطلوبة' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });

  const create = db.transaction(() => {
    const shop = db.prepare('INSERT INTO shops (name) VALUES (?)').run(name.trim());
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, ?, ?)'
    ).run(username.trim(), hash, 'shop_employee', shop.lastInsertRowid);
    return db.prepare(`
      SELECT s.id, s.name, u.id AS user_id, u.username
      FROM shops s JOIN users u ON u.shop_id = s.id
      WHERE s.id = ?
    `).get(shop.lastInsertRowid);
  });

  try {
    res.status(201).json(create());
  } catch (e) {
    res.status(500).json({ error: 'فشل إنشاء الفرع' });
  }
});

// DELETE /api/admin/branches/:id — remove shop and its employees
router.delete('/branches/:id', (req, res) => {
  const id = Number(req.params.id);
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(id);
  if (!shop) return res.status(404).json({ error: 'الفرع غير موجود' });

  db.transaction(() => {
    db.prepare('DELETE FROM users WHERE shop_id = ?').run(id);
    db.prepare('DELETE FROM shops WHERE id = ?').run(id);
  })();

  res.json({ ok: true });
});

module.exports = router;
