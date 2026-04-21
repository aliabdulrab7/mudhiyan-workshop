const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { db }     = require('../db');
const OrderService   = require('../services/OrderService');
const { errorToHttpStatus } = require('../errors');

const router = express.Router();

// 8.8 — Rate limit public customer-facing endpoints: 60 req/min per IP
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  message: { error: 'طلبات كثيرة، حاول بعد لحظة' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(trackLimiter);

// ── Status display labels (Arabic) ────────────────────────────────────────────
const STATUS_LABELS = {
  new:              'تم إنشاء الطلب',
  received:         'استُلم في الورشة',
  inspection:       'قيد الفحص',
  waiting_approval: 'بانتظار موافقتك',
  approved:         'تمت الموافقة',
  rejected:         'تم الرفض',
  in_repair:        'قيد الإصلاح',
  quality_check:    'فحص الجودة',
  ready_for_return: 'جاهز للإرجاع للفرع',
  returned_to_shop: 'وصل للفرع',
  delivered:        'تم التسليم',
  closed:           'مغلق',
  cancelled:        'ملغى',
};

// GET /api/track/:token — public, returns limited fields only (no internal IDs)
router.get('/:token', (req, res) => {
  const order = db.prepare(`
    SELECT id, order_number, piece_type, status, cost, cost_status, created_at
    FROM orders WHERE customer_token = ?
  `).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  // Internal `id` stays hidden — the customer references items by `sort_order`.
  const items = db.prepare(`
    SELECT
      item_name,
      item_type,
      quantity,
      repair_description,
      estimated_cost,
      approval_status,
      sort_order
    FROM order_items
    WHERE order_id = ?
    ORDER BY sort_order
  `).all(order.id);

  res.json({
    tracking_number:      order.order_number,
    piece_type:           order.piece_type,
    status:               order.status,
    status_label:         STATUS_LABELS[order.status] ?? order.status,
    estimated_cost:       order.cost,
    cost_status:          order.cost_status,
    created_at:           order.created_at,
    show_approval_buttons: order.status === 'waiting_approval',
    items,
  });
});

// ── Per-item decision helpers ─────────────────────────────────────────────────

// Apply a list of { sort_order, decision } to an order's pending items.
// Runs in a transaction so partial writes can't happen. Returns the final order
// status after the aggregate transition ('approved' or 'rejected').
function applyDecisions(orderId, decisions, actor) {
  const pendingCosted = db.prepare(
    `SELECT id, sort_order FROM order_items
     WHERE order_id = ?
       AND approval_status = 'pending'
       AND estimated_cost IS NOT NULL AND estimated_cost > 0`
  ).all(orderId);
  const sortToId = new Map(pendingCosted.map(r => [r.sort_order, r.id]));

  const resolved = [];
  for (const d of decisions) {
    const sortOrder = d.sort_order ?? d.item_id; // accept either key
    if (!sortToId.has(sortOrder)) {
      const err = new Error('قرار غير صالح — صنف غير مؤهل للموافقة');
      err.name = 'ValidationError';
      throw err;
    }
    if (d.decision !== 'approve' && d.decision !== 'reject') {
      const err = new Error('قرار غير صالح');
      err.name = 'ValidationError';
      throw err;
    }
    resolved.push({ id: sortToId.get(sortOrder), decision: d.decision });
  }

  const decidedSet = new Set(resolved.map(r => r.id));
  for (const { id } of pendingCosted) {
    if (!decidedSet.has(id)) {
      const err = new Error('يجب اتخاذ قرار لكل صنف معلق');
      err.name = 'ValidationError';
      throw err;
    }
  }

  // Atomic: write per-item decisions, recompute orders.cost + cost_status.
  // orders.cost is the amount the shop will actually invoice, so it must
  // exclude rejected items — only approved-or-skipped items count.
  let agg, newTotal, targetStatus;
  const writeAll = db.transaction(() => {
    const upd = db.prepare(
      `UPDATE order_items SET approval_status = ? WHERE id = ? AND order_id = ?`
    );
    for (const { id, decision } of resolved) {
      upd.run(decision === 'approve' ? 'approved' : 'rejected', id, orderId);
    }

    // Aggregate: at least one item "will be worked on" if any row ends up
    // approved or skipped (free). Otherwise the whole order is rejected.
    agg = db.prepare(
      `SELECT
         SUM(CASE WHEN approval_status IN ('approved','skipped') THEN 1 ELSE 0 END) AS workable,
         SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM order_items WHERE order_id = ?`
    ).get(orderId);

    targetStatus = (agg?.workable ?? 0) > 0 ? 'approved' : 'rejected';

    // Recompute orders.cost from just the items we'll actually charge for.
    // Rejected items contribute nothing; skipped (free) contribute their
    // estimated_cost of 0; only approved items add real money.
    newTotal = db.prepare(
      `SELECT COALESCE(SUM(estimated_cost), 0) AS total
       FROM order_items
       WHERE order_id = ?
         AND estimated_cost IS NOT NULL
         AND approval_status IN ('approved','skipped')`
    ).get(orderId).total;

    db.prepare(
      `UPDATE orders
       SET cost = ?, cost_status = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(newTotal, targetStatus === 'approved' ? 'APPROVED' : 'REJECTED', orderId);
  });
  writeAll();

  return OrderService.transition(
    orderId,
    targetStatus,
    actor,
    { notes: targetStatus === 'approved'
        ? `العميل وافق على ${agg.workable} صنف، رفض ${agg.rejected ?? 0}`
        : 'العميل رفض جميع الأصناف المسعّرة' }
  );
}

// POST /api/track/:token/decide — per-item customer decisions
// Body: { decisions: [{ item_id, decision: 'approve' | 'reject' }, ...] }
router.post('/:token/decide', (req, res) => {
  const { decisions } = req.body || {};
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return res.status(400).json({ error: 'لا توجد قرارات' });
  }

  const order = db.prepare(
    'SELECT id, status FROM orders WHERE customer_token = ?'
  ).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status !== 'waiting_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج موافقة في هذه المرحلة' });
  }

  try {
    const updated = applyDecisions(order.id, decisions, {
      role: 'workshop',
      username: 'customer_qr',
    });
    res.json({
      status:       updated.status,
      status_label: STATUS_LABELS[updated.status] ?? updated.status,
      ...(updated._notification && { _notification: updated._notification }),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

// POST /api/track/:token/approve — legacy "approve everything" shim
router.post('/:token/approve', (req, res) => {
  const order = db.prepare(
    'SELECT id, status FROM orders WHERE customer_token = ?'
  ).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status !== 'waiting_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج موافقة في هذه المرحلة' });
  }

  const pending = db.prepare(
    `SELECT sort_order FROM order_items
     WHERE order_id = ?
       AND approval_status = 'pending'
       AND estimated_cost IS NOT NULL AND estimated_cost > 0`
  ).all(order.id);

  const decisions = pending.map(r => ({ sort_order: r.sort_order, decision: 'approve' }));

  try {
    const updated = decisions.length === 0
      // No costed-pending items — just transition via OrderService.
      // (Edge case: order in waiting_approval with nothing to decide.)
      ? OrderService.transition(order.id, 'approved',
          { role: 'workshop', username: 'customer_qr' },
          { notes: 'موافقة العميل (لا توجد أصناف مسعّرة معلقة)' })
      : applyDecisions(order.id, decisions,
          { role: 'workshop', username: 'customer_qr' });
    res.json({
      status:       updated.status,
      status_label: STATUS_LABELS[updated.status] ?? updated.status,
      ...(updated._notification && { _notification: updated._notification }),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

// POST /api/track/:token/reject — legacy "reject everything" shim
router.post('/:token/reject', (req, res) => {
  const order = db.prepare(
    'SELECT id, status FROM orders WHERE customer_token = ?'
  ).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status !== 'waiting_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج موافقة في هذه المرحلة' });
  }

  const pending = db.prepare(
    `SELECT sort_order FROM order_items
     WHERE order_id = ?
       AND approval_status = 'pending'
       AND estimated_cost IS NOT NULL AND estimated_cost > 0`
  ).all(order.id);

  const decisions = pending.map(r => ({ sort_order: r.sort_order, decision: 'reject' }));

  try {
    const updated = decisions.length === 0
      ? OrderService.transition(order.id, 'rejected',
          { role: 'workshop', username: 'customer_qr' },
          { notes: 'رفض العميل (لا توجد أصناف مسعّرة معلقة)' })
      : applyDecisions(order.id, decisions,
          { role: 'workshop', username: 'customer_qr' });
    res.json({
      status:       updated.status,
      status_label: STATUS_LABELS[updated.status] ?? updated.status,
      ...(updated._notification && { _notification: updated._notification }),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

module.exports = router;
