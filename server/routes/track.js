const express = require('express');
const { db }  = require('../db');

const router = express.Router();

// GET /api/track/:token — public, returns limited fields only
router.get('/:token', (req, res) => {
  const order = db.prepare(`
    SELECT order_number, piece_type, status, cost, created_at
    FROM orders WHERE customer_token = ?
  `).get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  res.json(order);
});

// POST /api/track/:token/approve — public customer approval
router.post('/:token/approve', (req, res) => {
  const order = db.prepare('SELECT id, status FROM orders WHERE customer_token = ?').get(req.params.token);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status !== 'pending_approval') {
    return res.status(400).json({ error: 'الطلب لا يحتاج إلى موافقة' });
  }
  db.prepare(
    `UPDATE orders SET status = 'in_progress', updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(order.id);
  res.json({ status: 'in_progress' });
});

module.exports = router;
