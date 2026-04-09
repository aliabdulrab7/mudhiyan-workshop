const express = require('express');
const { db, createOrder } = require('../db');

const router = express.Router();
const ALLOWED_STATUSES = ['received', 'in_progress', 'ready', 'delivered'];

// GET /api/stats
router.get('/stats', (req, res) => {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'received')    AS received,
      SUM(status = 'in_progress') AS in_progress,
      SUM(status = 'ready')       AS ready,
      SUM(status = 'delivered')   AS delivered
    FROM orders
  `).get();
  res.json(row);
});

// GET /api/orders/barcode/:value — must be before /:id to avoid conflict
router.get('/barcode/:value', (req, res) => {
  const order = db.prepare(
    'SELECT * FROM orders WHERE order_number = ?'
  ).get(req.params.value);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// GET /api/orders
router.get('/', (req, res) => {
  const { status, search, limit, offset } = req.query;

  // Fix #5: validate status against allowed values
  if (status && status !== 'all' && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  // Fix #3: clamp limit/offset to prevent unbounded queries
  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (customer_name LIKE ? OR order_number LIKE ? OR phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// POST /api/orders
router.post('/', (req, res) => {
  const { customer_name, phone, piece_type, notes = '' } = req.body;

  if (!customer_name || !phone || !piece_type) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال ونوع القطعة مطلوبة' });
  }

  // Fix #10: field length limits
  if (customer_name.trim().length > 100) return res.status(400).json({ error: 'الاسم طويل جداً (100 حرف كحد أقصى)' });
  if (notes.trim().length > 1000)        return res.status(400).json({ error: 'الملاحظات طويلة جداً (1000 حرف كحد أقصى)' });

  try {
    // Fix #1: use atomic transaction instead of separate generateOrderNumber + INSERT
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      piece_type: piece_type.trim(),
      notes: notes.trim(),
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  const result = db.prepare(`
    UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?
  `).run(status, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(updated);
});

module.exports = router;
