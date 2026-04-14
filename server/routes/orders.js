const express = require('express');
const { db, createOrder } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// New 9-stage workflow
const STATUS_SEQUENCE = [
  'received', 'diagnosing', 'waiting_approval', 'in_repair',
  'quality_check', 'ready_for_pickup', 'invoiced', 'delivered', 'closed',
];

// Legacy statuses kept for existing data backward compatibility
const ALLOWED_STATUSES = [
  ...STATUS_SEQUENCE,
  'pending_approval', 'in_progress', 'ready', 'returned',
];

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
      SUM(status = 'received')                                                    AS received,
      SUM(status = 'diagnosing')                                                  AS diagnosing,
      SUM(status IN ('waiting_approval','pending_approval'))                       AS waiting_approval,
      SUM(status IN ('in_repair','in_progress'))                                   AS in_repair,
      SUM(status = 'quality_check')                                               AS quality_check,
      SUM(status IN ('ready_for_pickup','ready'))                                  AS ready_for_pickup,
      SUM(status = 'invoiced')                                                    AS invoiced,
      SUM(status = 'delivered')                                                   AS delivered,
      SUM(status = 'closed')                                                      AS closed,
      SUM(status = 'returned')                                                    AS returned
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
      COALESCE(SUM(o.status = 'received'), 0)                                        AS received,
      COALESCE(SUM(o.status IN ('waiting_approval','pending_approval')), 0)           AS pending_approval,
      COALESCE(SUM(o.status IN ('in_repair','in_progress','diagnosing')), 0)          AS in_progress,
      COALESCE(SUM(o.status IN ('ready_for_pickup','ready','quality_check')), 0)      AS ready,
      COALESCE(SUM(o.status IN ('invoiced','delivered')), 0)                          AS delivered,
      COUNT(o.id)                                                                     AS total
    FROM shops s
    LEFT JOIN orders o ON o.shop_id = s.id
    GROUP BY s.id
    ORDER BY (COALESCE(SUM(o.status IN ('ready_for_pickup','ready','quality_check')), 0)) DESC, s.name
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
  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(order.id);
  res.json({ ...order, items });
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
    SELECT o.*, COALESCE(s.name, '') AS shop_name,
      (SELECT GROUP_CONCAT(oi.item_name, '، ')
       FROM order_items oi WHERE oi.order_id = o.id
       ORDER BY oi.sort_order) AS items_summary
    FROM orders o
    LEFT JOIN shops s ON s.id = o.shop_id
    WHERE 1=1`;
  const params = [];

  if (!isWorkshop) {
    query += ' AND o.shop_id = ?';
    params.push(req.user.shop_id);
  } else if (shop_id) {
    query += ' AND o.shop_id = ?';
    params.push(parseInt(shop_id, 10));
  }

  // Map legacy status filters to new equivalents
  if (status && status !== 'all') {
    if (status === 'in_progress') {
      query += " AND o.status IN ('in_repair','in_progress','diagnosing')";
    } else if (status === 'pending_approval') {
      query += " AND o.status IN ('waiting_approval','pending_approval')";
    } else if (status === 'ready') {
      query += " AND o.status IN ('ready_for_pickup','ready','quality_check')";
    } else {
      query += ' AND o.status = ?';
      params.push(status);
    }
  }
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

// GET /api/orders/:id/history
router.get('/:id/history', (req, res) => {
  const history = db.prepare(
    `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC`
  ).all(req.params.id);
  res.json(history);
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

  for (const item of items) {
    if (!item.item_name || !item.item_name.trim()) {
      return res.status(400).json({ error: 'اسم الصنف مطلوب لكل عنصر' });
    }
    if (!item.workshop_comment || !item.workshop_comment.trim()) {
      return res.status(400).json({ error: 'تعليق الورشة مطلوب لكل صنف' });
    }
  }

  try {
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone:         phone.trim(),
      items:         items.map(i => ({
        item_name:        i.item_name.trim(),
        brand:            (i.brand || '').trim(),
        model:            (i.model || '').trim(),
        serial_number:    (i.serial_number || '').trim(),
        workshop_comment: i.workshop_comment.trim(),
      })),
      shop_id:    req.user.shop_id,
      created_by: req.user.username,
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const isWorkshop = req.user.role === 'workshop';

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  if (!isWorkshop) {
    // Branch employees: specific allowed transitions only
    const currentOrder = db.prepare(
      'SELECT status FROM orders WHERE id = ? AND shop_id = ?'
    ).get(req.params.id, req.user.shop_id);
    if (!currentOrder) return res.status(404).json({ error: 'الطلب غير موجود' });

    const allowed = [
      ['ready_for_pickup', 'invoiced'],
      ['invoiced', 'delivered'],
      ['ready', 'delivered'],    // legacy
      ['ready', 'returned'],     // legacy
    ];
    const ok = allowed.some(([f, t]) => f === currentOrder.status && t === status);
    if (!ok) return res.status(403).json({ error: 'غير مصرح' });
  } else {
    // Workshop: enforce sequential progression for new status values
    const currentOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(req.params.id);
    if (!currentOrder) return res.status(404).json({ error: 'الطلب غير موجود' });

    const fromIdx = STATUS_SEQUENCE.indexOf(currentOrder.status);
    const toIdx   = STATUS_SEQUENCE.indexOf(status);

    if (fromIdx !== -1 && toIdx !== -1 && toIdx !== fromIdx + 1) {
      return res.status(400).json({ error: 'لا يمكن تخطي مراحل الطلب' });
    }

    // Record status history
    db.prepare(`
      INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, currentOrder.status, status, req.user.username);
  }

  const result = isWorkshop
    ? db.prepare(
        `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
      ).run(status, req.params.id)
    : db.prepare(
        `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ? AND shop_id = ?`
      ).run(status, req.params.id, req.user.shop_id);

  if (result.changes === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

  const updated = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(req.params.id);
  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(updated.id);
  res.json({ ...updated, items });
});

// PATCH /api/orders/:id/cost — workshop only
router.patch('/:id/cost', requireRole('workshop'), (req, res) => {
  const cost = parseInt(req.body.cost, 10);
  if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'تكلفة غير صالحة' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  // Auto-transition to waiting_approval if cost set
  let newStatus = order.status;
  if (['received', 'diagnosing'].includes(order.status) && cost > 0) {
    newStatus = 'waiting_approval';
  } else if (order.status === 'received' && cost === 0) {
    newStatus = 'diagnosing';
  }

  if (newStatus !== order.status) {
    db.prepare(`
      INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, ?, ?, ?)
    `).run(order.id, order.status, newStatus, req.user.username);
  }

  db.prepare(
    `UPDATE orders SET cost = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(cost, newStatus, req.params.id);

  const updated = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(req.params.id);
  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(updated.id);

  if (newStatus === 'waiting_approval') {
    // Signal frontend to open WhatsApp approval link
    res.json({ ...updated, items, _sendApproval: true });
  } else {
    res.json({ ...updated, items });
  }
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
