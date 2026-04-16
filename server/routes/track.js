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
    SELECT order_number, piece_type, status, cost, cost_status, created_at
    FROM orders WHERE customer_token = ?
  `).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  // Fetch items — exclude internal `id` and `order_id` fields
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
    WHERE order_id = (SELECT id FROM orders WHERE customer_token = ?)
    ORDER BY sort_order
  `).all(req.params.token);

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

// POST /api/track/:token/approve — public customer approval
// Token-gated, no auth required. Only valid when order is in waiting_approval.
router.post('/:token/approve', (req, res) => {
  const order = db.prepare('SELECT id, status FROM orders WHERE customer_token = ?').get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (order.status !== 'waiting_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج موافقة في هذه المرحلة' });
  }

  try {
    // Mark all pending items as approved
    db.prepare(`
      UPDATE order_items
      SET approval_status = 'approved'
      WHERE order_id = ? AND approval_status = 'pending'
    `).run(order.id);

    // Sync order cost_status
    db.prepare(`
      UPDATE orders
      SET cost_status = 'APPROVED', updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(order.id);

    const updated = OrderService.transition(
      order.id,
      'approved',
      { role: 'workshop', username: 'customer_qr' },
      { notes: 'موافقة العميل عبر رمز QR' }
    );
    res.json({
      status:       updated.status,
      status_label: STATUS_LABELS[updated.status] ?? updated.status,
      ...(updated._notification && { _notification: updated._notification }),
    });
  } catch (err) {
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

// POST /api/track/:token/reject — public customer rejection
// Token-gated, no auth required. Only valid when order is in waiting_approval.
router.post('/:token/reject', (req, res) => {
  const order = db.prepare('SELECT id, status FROM orders WHERE customer_token = ?').get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (order.status !== 'waiting_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج موافقة في هذه المرحلة' });
  }

  try {
    // Mark all pending items as rejected
    db.prepare(`
      UPDATE order_items
      SET approval_status = 'rejected'
      WHERE order_id = ? AND approval_status = 'pending'
    `).run(order.id);

    // Sync order cost_status
    db.prepare(`
      UPDATE orders
      SET cost_status = 'REJECTED', updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(order.id);

    const updated = OrderService.transition(
      order.id,
      'rejected',
      { role: 'workshop', username: 'customer_qr' },
      { notes: 'رفض العميل عبر رمز QR' }
    );
    res.json({
      status:       updated.status,
      status_label: STATUS_LABELS[updated.status] ?? updated.status,
      ...(updated._notification && { _notification: updated._notification }),
    });
  } catch (err) {
    res.status(errorToHttpStatus(err)).json({ error: err.message });
  }
});

module.exports = router;
