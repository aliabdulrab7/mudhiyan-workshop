const express = require('express');
const { db, createOrder } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_STATUSES = ['received', 'pending_approval', 'in_progress', 'ready', 'delivered', 'returned'];

// All order routes require auth
router.use(requireAuth);

// GET /api/orders/stats
router.get('/stats', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const where  = isWorkshop ? '' : 'WHERE shop_id = ?';
  const params = isWorkshop ? [] : [req.user.shop_id];

  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'received')          AS received,
      SUM(status = 'pending_approval')  AS pending_approval,
      SUM(status = 'in_progress')       AS in_progress,
      SUM(status = 'ready')             AS ready,
      SUM(status = 'delivered')         AS delivered,
      SUM(status = 'returned')          AS returned
    FROM orders ${where}
  `).get(...params);
  res.json(row);
});

// GET /api/orders/branch-stats — workshop only: per-branch breakdown
router.get('/branch-stats', requireRole('workshop'), (req, res) => {
  const rows = db.prepare(`
    SELECT
      s.id   AS shop_id,
      s.name AS shop_name,
      COALESCE(SUM(o.status = 'received'),         0) AS received,
      COALESCE(SUM(o.status = 'pending_approval'), 0) AS pending_approval,
      COALESCE(SUM(o.status = 'in_progress'),      0) AS in_progress,
      COALESCE(SUM(o.status = 'ready'),            0) AS ready,
      COALESCE(SUM(o.status = 'delivered'),        0) AS delivered,
      COALESCE(SUM(o.status = 'returned'),         0) AS returned,
      COUNT(o.id)                                      AS total
    FROM shops s
    LEFT JOIN orders o ON o.shop_id = s.id
    GROUP BY s.id
    ORDER BY (COALESCE(SUM(o.status = 'ready'), 0)) DESC, s.name
  `).all();
  res.json(rows);
});

// GET /api/orders/barcode/:value — must be before /:id
router.get('/barcode/:value', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare(`
        SELECT o.*, COALESCE(s.name, '') AS shop_name
        FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
        WHERE o.order_number = ?
      `).get(req.params.value)
    : db.prepare(`
        SELECT o.*, COALESCE(s.name, '') AS shop_name
        FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
        WHERE o.order_number = ? AND o.shop_id = ?
      `).get(req.params.value, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// GET /api/orders
router.get('/', (req, res) => {
  const { status, search, limit, offset, shop_id } = req.query;
  const isWorkshop = req.user.role === 'workshop';

  if (status && status !== 'all' && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let query = `
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o
    LEFT JOIN shops s ON s.id = o.shop_id
    WHERE 1=1`;
  const params = [];

  if (!isWorkshop) {
    query += ' AND o.shop_id = ?';
    params.push(req.user.shop_id);
  } else if (shop_id) {
    // Workshop can filter by a specific branch
    query += ' AND o.shop_id = ?';
    params.push(parseInt(shop_id, 10));
  }

  if (status && status !== 'all') { query += ' AND o.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (o.customer_name LIKE ? OR o.order_number LIKE ? OR o.phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  res.json(db.prepare(query).all(...params));
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare(`
        SELECT o.*, COALESCE(s.name, '') AS shop_name
        FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
        WHERE o.id = ?
      `).get(req.params.id)
    : db.prepare(`
        SELECT o.*, COALESCE(s.name, '') AS shop_name
        FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
        WHERE o.id = ? AND o.shop_id = ?
      `).get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(order.id);
  res.json({ ...order, items });
});

// POST /api/orders — shop_employee only
router.post('/', requireRole('shop_employee'), (req, res) => {
  const { customer_name, phone, items } = req.body;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال مطلوبان' });
  }
  if (customer_name.trim().length > 100) return res.status(400).json({ error: 'الاسم طويل جداً' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'يجب إضافة صنف واحد على الأقل' });
  }

  const ALLOWED_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'أخرى'];
  for (const item of items) {
    if (!ALLOWED_TYPES.includes(item.item_type)) {
      return res.status(400).json({ error: `نوع غير صالح: ${item.item_type}` });
    }
    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'العدد يجب أن يكون بين 1 و 99' });
    }
  }

  try {
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      items: items.map(i => ({
        item_type: i.item_type,
        quantity:  parseInt(i.quantity, 10),
        notes:     (i.notes || '').trim(),
      })),
      shop_id: req.user.shop_id,
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// PATCH /api/orders/:id/status
// Workshop: any transition. shop_employee: ready → delivered only (their own orders).
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const isWorkshop = req.user.role === 'workshop';

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  if (!isWorkshop) {
    // Branch employees may only mark their own ready orders as delivered or returned
    if (status !== 'delivered' && status !== 'returned') {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const order = db.prepare(
      'SELECT status FROM orders WHERE id = ? AND shop_id = ?'
    ).get(req.params.id, req.user.shop_id);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (order.status !== 'ready') {
      return res.status(400).json({ error: 'لا يمكن تغيير حالة هذا الطلب بعد' });
    }
  }

  const result = isWorkshop
    ? db.prepare(
        `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
      ).run(status, req.params.id)
    : db.prepare(
        `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ? AND shop_id = ?`
      ).run(status, req.params.id, req.user.shop_id);

  if (result.changes === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// PATCH /api/orders/:id/cost — workshop only, allowed at any status
router.patch('/:id/cost', requireRole('workshop'), (req, res) => {
  const cost = parseInt(req.body.cost, 10);
  if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'تكلفة غير صالحة' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  // Only change status when order is still in received state
  let newStatus = order.status;
  if (order.status === 'received') {
    newStatus = cost > 0 ? 'pending_approval' : 'in_progress';
  }

  db.prepare(
    `UPDATE orders SET cost = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(cost, newStatus, req.params.id);

  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// GET /api/orders/:id/comments
router.get('/:id/comments', (req, res) => {
  const comments = db.prepare(
    `SELECT * FROM order_comments WHERE order_id = ? ORDER BY created_at ASC`
  ).all(req.params.id);
  res.json(comments);
});

// POST /api/orders/:id/comments — workshop only
router.post('/:id/comments', requireRole('workshop'), (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'التعليق لا يمكن أن يكون فارغاً' });

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  const result = db.prepare(
    `INSERT INTO order_comments (order_id, author, body) VALUES (?, ?, ?)`
  ).run(req.params.id, req.user.username, body.trim());

  res.status(201).json(
    db.prepare('SELECT * FROM order_comments WHERE id = ?').get(result.lastInsertRowid)
  );
});

module.exports = router;
