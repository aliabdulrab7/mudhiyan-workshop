const express = require('express');
const { db, createOrder } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_STATUSES = ['received', 'pending_approval', 'in_progress', 'ready', 'delivered'];

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
      SUM(status = 'delivered')         AS delivered
    FROM orders ${where}
  `).get(...params);
  res.json(row);
});

// GET /api/orders/barcode/:value — must be before /:id
router.get('/barcode/:value', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.value)
    : db.prepare('SELECT * FROM orders WHERE order_number = ? AND shop_id = ?').get(req.params.value, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// GET /api/orders
router.get('/', (req, res) => {
  const { status, search, limit, offset } = req.query;
  const isWorkshop = req.user.role === 'workshop';

  if (status && status !== 'all' && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let query  = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (!isWorkshop) { query += ' AND shop_id = ?'; params.push(req.user.shop_id); }
  if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
  if (search) {
    query += ' AND (customer_name LIKE ? OR order_number LIKE ? OR phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  res.json(db.prepare(query).all(...params));
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
    : db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// POST /api/orders — shop_employee only
router.post('/', requireRole('shop_employee'), (req, res) => {
  const { customer_name, phone, piece_type, notes = '' } = req.body;
  if (!customer_name || !phone || !piece_type) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال ونوع القطعة مطلوبة' });
  }
  if (customer_name.trim().length > 100) return res.status(400).json({ error: 'الاسم طويل جداً' });
  if (notes.trim().length > 1000) return res.status(400).json({ error: 'الملاحظات طويلة جداً' });

  try {
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      piece_type: piece_type.trim(),
      notes: notes.trim(),
      shop_id: req.user.shop_id,
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// PATCH /api/orders/:id/status — workshop only
router.patch('/:id/status', requireRole('workshop'), (req, res) => {
  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }
  const result = db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// PATCH /api/orders/:id/cost — workshop only
router.patch('/:id/cost', requireRole('workshop'), (req, res) => {
  const cost = parseInt(req.body.cost, 10);
  if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'تكلفة غير صالحة' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status !== 'received') {
    return res.status(400).json({ error: 'يمكن تحديد السعر فقط عند استلام الطلب' });
  }

  const newStatus = cost > 0 ? 'pending_approval' : 'in_progress';
  db.prepare(
    `UPDATE orders SET cost = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(cost, newStatus, req.params.id);

  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

module.exports = router;
