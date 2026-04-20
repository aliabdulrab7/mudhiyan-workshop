const express = require('express');
const { db, createOrder } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const OrderService = require('../services/OrderService');
const { errorToHttpStatus } = require('../errors');
const { syncAllItemCosts, refreshOrderCost } = require('../helpers/costHelpers');
const { normalizePhone } = require('../helpers/phoneHelper');

const router = express.Router();

// Current workflow statuses
const STATUS_SEQUENCE = [
  'new', 'received', 'inspection', 'waiting_approval', 'in_repair',
  'quality_check', 'ready_for_return', 'returned_to_shop', 'delivered', 'closed',
];

// Legacy statuses kept for existing data backward compatibility
const ALLOWED_STATUSES = [
  ...STATUS_SEQUENCE,
  'diagnosing', 'ready_for_pickup', 'pending_approval', 'in_progress', 'ready', 'returned', 'invoiced',
  'rejected', 'cancelled',
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
      SUM(status = 'new')                                                         AS new,
      SUM(status = 'received')                                                    AS received,
      SUM(status IN ('inspection','diagnosing'))                                  AS inspection,
      SUM(status IN ('waiting_approval','pending_approval'))                      AS waiting_approval,
      SUM(status IN ('in_repair','in_progress'))                                  AS in_repair,
      SUM(status = 'quality_check')                                               AS quality_check,
      SUM(status IN ('ready_for_return','ready_for_pickup','ready'))              AS ready_for_return,
      SUM(status = 'returned_to_shop')                                            AS returned_to_shop,
      SUM(status = 'delivered')                                                   AS delivered,
      SUM(status = 'closed')                                                      AS closed
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
      COALESCE(SUM(o.status IN ('new','received')), 0)                                       AS received,
      COALESCE(SUM(o.status IN ('waiting_approval','pending_approval')), 0)                  AS pending_approval,
      COALESCE(SUM(o.status IN ('in_repair','in_progress','inspection','diagnosing')), 0)    AS in_progress,
      COALESCE(SUM(o.status IN ('ready_for_return','ready_for_pickup','ready','returned_to_shop','quality_check')), 0) AS ready,
      COALESCE(SUM(o.status = 'delivered'), 0)                                               AS delivered,
      COUNT(o.id)                                                                             AS total
    FROM shops s
    LEFT JOIN orders o ON o.shop_id = s.id
    GROUP BY s.id
    ORDER BY (COALESCE(SUM(o.status IN ('ready_for_return','ready_for_pickup','ready','returned_to_shop','quality_check')), 0)) DESC, s.name
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
      query += " AND o.status IN ('in_repair','in_progress','inspection','diagnosing')";
    } else if (status === 'pending_approval') {
      query += " AND o.status IN ('waiting_approval','pending_approval')";
    } else if (status === 'ready') {
      query += " AND o.status IN ('ready_for_return','ready_for_pickup','ready','returned_to_shop','quality_check')";
    } else if (status === 'diagnosing') {
      query += " AND o.status IN ('inspection','diagnosing')";
    } else if (status === 'ready_for_pickup') {
      query += " AND o.status IN ('ready_for_return','ready_for_pickup')";
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

  // Urgent orders float to the top (active only); within each bucket, newest first.
  // `locked_at IS NULL` ensures delivered/closed orders don't hog the top even if flagged.
  query += " ORDER BY (o.is_urgent = 1 AND o.locked_at IS NULL) DESC, o.created_at DESC LIMIT ? OFFSET ?";
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
// 6.4 — shop_employee scoped to their own shop; workshop sees all
router.get('/:id/history', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id)
    : db.prepare('SELECT id FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  const history = db.prepare(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(history);
});

// POST /api/orders — shop_employee only
router.post('/', requireRole('shop_employee'), (req, res) => {
  const { customer_name, phone, notes, items, urgency } = req.body;
  const is_urgent = urgency === 'rush' ? 1 : 0;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال مطلوبان' });
  }
  if (customer_name.trim().length > 100) return res.status(400).json({ error: 'الاسم طويل جداً (الحد الأقصى 100 حرف)' });
  if (notes && notes.length > 2000) return res.status(400).json({ error: 'الملاحظات طويلة جداً (الحد الأقصى 2000 حرف)' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'يجب إضافة صنف واحد على الأقل' });
  }

  // 7.1 — Phone normalization
  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  for (const item of items) {
    if (!item.item_name || !item.item_name.trim()) {
      return res.status(400).json({ error: 'اسم الصنف مطلوب لكل عنصر' });
    }
    if (!item.workshop_comment || !item.workshop_comment.trim()) {
      return res.status(400).json({ error: 'تعليق الورشة مطلوب لكل صنف' });
    }
    if (item.workshop_comment.length > 1000) {
      return res.status(400).json({ error: 'تعليق الورشة طويل جداً (الحد الأقصى 1000 حرف)' });
    }
  }

  try {
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone:         normalizedPhone,
      notes:         notes ?? '',
      items:         items.map(i => ({
        item_name:        i.item_name.trim(),
        brand:            (i.brand || '').trim(),
        model:            (i.model || '').trim(),
        serial_number:    (i.serial_number || '').trim(),
        workshop_comment: i.workshop_comment.trim(),
      })),
      shop_id:    req.user.shop_id,
      created_by: req.user.username,
      is_urgent,
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// PATCH /api/orders/:id/status
// All transitions go through OrderService.transition() — no direct DB updates.
// 6.8 — requireAuth is already applied by router.use() above; removed duplicate.
router.patch('/:id/status', (req, res) => {
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'الحالة مطلوبة' });
  }

  // Scope check: shop_employee can only act on their own shop's orders
  if (req.user.role === 'shop_employee') {
    const order = db.prepare(
      'SELECT id FROM orders WHERE id = ? AND shop_id = ?'
    ).get(req.params.id, req.user.shop_id);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  try {
    const updated = OrderService.transition(
      parseInt(req.params.id, 10),
      status,
      req.user,
      { notes: notes ?? null }
    );
    const items = db.prepare(
      'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
    ).all(updated.id);
    res.json({ ...updated, items });
  } catch (err) {
    // 8.6 — Include from/to for transition errors so the client can display context
    if (err.name === 'InvalidTransitionError') {
      return res.status(409).json({
        error: `لا يمكن الانتقال من '${err.from}' إلى '${err.to}'`,
        from: err.from,
        to:   err.to,
      });
    }
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/cost — workshop only (order-level, backward compat)
// Sets the same cost on all items, then transitions through OrderService.
router.patch('/:id/cost', requireRole('workshop'), (req, res) => {
  const cost = parseInt(req.body.cost, 10);
  if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'تكلفة غير صالحة' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.locked_at) return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });

  // Sync all items and recalculate order cost
  syncAllItemCosts(order.id, cost);
  const total = refreshOrderCost(order.id);

  let updated;
  let sendApproval = false;

  if (order.status === 'inspection') {
    const targetStatus = total > 0 ? 'waiting_approval' : 'in_repair';
    try {
      updated = OrderService.transition(
        order.id,
        targetStatus,
        req.user,
        { notes: `تكلفة الإصلاح: ${total} ريال` }
      );
      sendApproval = targetStatus === 'waiting_approval';
    } catch (err) {
      return res.status(errorToHttpStatus(err)).json({ error: err.message });
    }
  } else {
    updated = db.prepare(`
      SELECT o.*, COALESCE(s.name, '') AS shop_name
      FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
      WHERE o.id = ?
    `).get(order.id);
  }

  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(updated.id);

  const notification = sendApproval ? updated._notification : null;
  res.json({
    ...updated,
    items,
    ...(sendApproval && { _sendApproval: true }),
    ...(notification && { _notification: notification }),
  });
});

// POST /api/orders/:orderId/items/:itemId/cost — workshop only
// Sets cost on a single item, recalculates order total, triggers transition.
router.post('/:orderId/items/:itemId/cost', requireRole('workshop'), (req, res) => {
  const { estimated_cost } = req.body;
  const cost = parseFloat(estimated_cost);
  if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'تكلفة غير صالحة' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.locked_at) return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });

  if (order.status !== 'inspection') {
    return res.status(400).json({ error: 'لا يمكن تحديد التكلفة إلا في مرحلة الفحص' });
  }

  const item = db.prepare(
    'SELECT * FROM order_items WHERE id = ? AND order_id = ?'
  ).get(req.params.itemId, req.params.orderId);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  // Update this specific item
  db.prepare(`
    UPDATE order_items
    SET estimated_cost    = ?,
        approval_required = ?,
        approval_status   = ?,
        updated_at        = COALESCE(updated_at, datetime('now','localtime'))
    WHERE id = ?
  `).run(
    cost > 0 ? cost : null,
    cost > 0 ? 1 : 0,
    cost > 0 ? 'pending' : 'skipped',
    item.id
  );

  // Recalculate order total from all items
  const total = refreshOrderCost(order.id);

  // Re-read order to get fresh cost/cost_status before deciding transition
  const freshOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);

  const targetStatus = total > 0 ? 'waiting_approval' : 'in_repair';
  let updated;
  let sendApproval = false;

  try {
    updated = OrderService.transition(
      order.id,
      targetStatus,
      req.user,
      { notes: `تكلفة الصنف #${item.id}: ${cost} ريال، الإجمالي: ${total} ريال` }
    );
    sendApproval = targetStatus === 'waiting_approval';
  } catch (err) {
    return res.status(errorToHttpStatus(err)).json({ error: err.message });
  }

  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(updated.id);

  const notification = updated._notification ?? null;
  res.json({
    ...updated,
    items,
    ...(sendApproval && { _sendApproval: true }),
    ...(notification && { _notification: notification }),
  });
});

// POST /api/orders/:id/confirm-payment — shop_employee only (ADR-013)
// Staff confirms physical payment was collected at the counter.
// Must be called before PATCH /status { delivered } will succeed.
// 6.6 — restricted to shop_employee per ADR-013.
router.post('/:id/confirm-payment', requireRole('shop_employee'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (order.locked_at) {
    return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });
  }

  if (order.status !== 'returned_to_shop') {
    return res.status(400).json({
      error: 'تأكيد الدفع متاح فقط عندما تكون القطعة في الفرع',
    });
  }

  // Shop isolation: shop_employee can only confirm for their own shop
  if (order.shop_id !== req.user.shop_id) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  db.prepare(`
    UPDATE orders
    SET payment_confirmed = 1, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(order.id);

  const updated = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(order.id);

  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(updated.id);

  res.json({ ...updated, items });
});

// PUT /api/orders/:id — update order-level fields (blocked after DELIVERED)
router.put('/:id', requireAuth, (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
    : db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.locked_at) return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });

  // 7.1 — Phone normalization on update
  if (req.body.phone !== undefined) {
    try {
      req.body.phone = normalizePhone(req.body.phone);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  // 7.7 — Length guards
  if (req.body.customer_name && req.body.customer_name.trim().length > 100) {
    return res.status(400).json({ error: 'الاسم طويل جداً (الحد الأقصى 100 حرف)' });
  }
  if (req.body.notes !== undefined && req.body.notes.length > 2000) {
    return res.status(400).json({ error: 'الملاحظات طويلة جداً (الحد الأقصى 2000 حرف)' });
  }

  const allowed = ['customer_name', 'phone', 'notes', 'is_urgent'];
  const updates = []; const values = [];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'لا توجد حقول للتحديث' });

  updates.push(`updated_at = datetime('now','localtime')`);
  values.push(order.id);
  db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id WHERE o.id = ?
  `).get(order.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order').all(order.id);
  res.json({ ...updated, items });
});

// DELETE /api/orders/:id — workshop admin only, only if status = received (no work started)
router.delete('/:id', requireRole('workshop'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (order.status !== 'received') {
    return res.status(400).json({ error: 'لا يمكن حذف الطلب بعد بدء العمل عليه' });
  }

  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  res.json({ ok: true, deleted_id: order.id });
});

// POST /api/orders/:orderId/items/:itemId/assign-technician — workshop only
router.post('/:orderId/items/:itemId/assign-technician', requireRole('workshop'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.locked_at) return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });

  const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?')
    .get(req.params.itemId, req.params.orderId);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const { technician_id } = req.body;
  if (!technician_id) return res.status(400).json({ error: 'technician_id مطلوب' });

  const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(technician_id);
  if (!tech) return res.status(404).json({ error: 'الفني غير موجود' });

  const existing = db.prepare(
    'SELECT id FROM order_item_technicians WHERE order_item_id = ? AND technician_id = ?'
  ).get(item.id, tech.id);
  if (existing) return res.status(409).json({ error: 'الفني مُعيَّن بالفعل لهذا الصنف' });

  const result = db.prepare(
    'INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)'
  ).run(item.id, tech.id);

  res.status(201).json(
    db.prepare(`
      SELECT oit.*, t.specialization, u.username
      FROM order_item_technicians oit
      JOIN technicians t ON t.id = oit.technician_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE oit.id = ?
    `).get(result.lastInsertRowid)
  );
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
