const express = require('express');
const bcrypt  = require('bcryptjs');
const { db }  = require('../db');
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

// PATCH /api/admin/branches/:id — rename a branch
router.patch('/branches/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(id);
  if (!shop) return res.status(404).json({ error: 'الفرع غير موجود' });
  db.prepare('UPDATE shops SET name = ? WHERE id = ?').run(name.trim(), id);
  res.json({ ok: true, branch: { id, name: name.trim() } });
});

// PATCH /api/admin/branches/:id/password — reset the branch employee's password
router.patch('/branches/:id/password', async (req, res) => {
  const id = Number(req.params.id);
  const { new_password } = req.body || {};
  if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }
  const employee = db.prepare(
    "SELECT id FROM users WHERE shop_id = ? AND role = 'shop_employee' LIMIT 1"
  ).get(id);
  if (!employee) return res.status(404).json({ error: 'لا يوجد موظف لهذا الفرع' });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, employee.id);
  res.json({ ok: true });
});

// GET /api/admin/branches/:id/summary — branch order statistics
router.get('/branches/:id/summary', (req, res) => {
  const id = Number(req.params.id);
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(id);
  if (!shop) return res.status(404).json({ error: 'الفرع غير موجود' });

  const total_orders = db.prepare(
    'SELECT COUNT(*) AS n FROM orders WHERE shop_id = ?'
  ).get(id).n;

  const open_orders = db.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND status NOT IN ('delivered','cancelled','rejected','closed')"
  ).get(id).n;

  const today_orders = db.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND date(created_at,'localtime') = date('now','localtime')"
  ).get(id).n;

  const recent_orders = db.prepare(
    'SELECT order_number, status, piece_type, is_urgent, created_at FROM orders WHERE shop_id = ? ORDER BY created_at DESC LIMIT 5'
  ).all(id);

  res.json({ total_orders, open_orders, today_orders, recent_orders });
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

// ── Workshop users management ─────────────────────────────────────────────────

router.get('/users', (_req, res) => {
  const users = db.prepare(
    `SELECT id, username, role, active, created_at FROM users WHERE role = 'workshop' ORDER BY created_at ASC`
  ).all();
  res.json(users);
});

router.post('/users', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });

  const hash   = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, 'workshop', 1)`
  ).run(username.trim(), hash);

  const user = db.prepare(
    `SELECT id, username, role, active, created_at FROM users WHERE id = ?`
  ).get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.patch('/users/:id', (req, res) => {
  const id     = Number(req.params.id);
  const target = db.prepare(`SELECT id, username, role, active FROM users WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (target.role !== 'workshop') return res.status(403).json({ error: 'غير مسموح' });

  const { username, active } = req.body;

  if (username !== undefined) {
    if (!String(username).trim()) return res.status(400).json({ error: 'اسم المستخدم لا يمكن أن يكون فارغاً' });
    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(String(username).trim(), id);
    if (conflict) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  }
  if (active !== undefined && (active === 0 || active === false) && id === req.user.id) {
    return res.status(400).json({ error: 'لا يمكن تعطيل حسابك الخاص' });
  }

  const sets = []; const params = [];
  if (username !== undefined) { sets.push('username = ?'); params.push(String(username).trim()); }
  if (active  !== undefined) { sets.push('active = ?');   params.push(active ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'لا توجد تحديثات' });

  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare(
    `SELECT id, username, role, active, created_at FROM users WHERE id = ?`
  ).get(id);
  res.json(updated);
});

router.patch('/users/:id/password', (req, res) => {
  const id     = Number(req.params.id);
  const target = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (target.role !== 'workshop') return res.status(403).json({ error: 'غير مسموح' });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  res.json({ ok: true });
});

module.exports = router;
