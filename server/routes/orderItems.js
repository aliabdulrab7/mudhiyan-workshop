/**
 * Order Items router
 * Handles per-item operations: update, diagnosis, photos, services, parts, technicians.
 * All write operations check order.locked_at before proceeding.
 */

const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const OrderService  = require('../services/OrderService');
const { syncItemCost, refreshOrderCost } = require('../helpers/costHelpers');
const { errorToHttpStatus } = require('../errors');

const router = express.Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_PHOTO_TYPES = new Set(['before_repair', 'after_repair', 'damage', 'delivery']);

function getItem(itemId) {
  return db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
}

function getOrder(orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

function checkLocked(order, res) {
  if (order.locked_at) {
    res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });
    return true;
  }
  return false;
}

// ── PUT /api/order-items/:id — update item details ────────────────────────────
// 6.7 — workshop only: edits repair_description, workshop_comment, and item fields
router.put('/:id', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const allowed = [
    'item_name', 'item_type', 'quantity', 'notes', 'workshop_comment',
    'brand', 'model', 'serial_number',
    'ring_size_before', 'ring_size_after',
    'bracelet_adjustment', 'necklace_adjustment',
    'repair_description',
  ];

  // 7.7 — Length guards
  if (req.body.workshop_comment !== undefined && req.body.workshop_comment.length > 1000) {
    return res.status(400).json({ error: 'تعليق الورشة طويل جداً (الحد الأقصى 1000 حرف)' });
  }
  if (req.body.notes !== undefined && req.body.notes.length > 2000) {
    return res.status(400).json({ error: 'الملاحظات طويلة جداً (الحد الأقصى 2000 حرف)' });
  }

  const updates = [];
  const values  = [];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'لا توجد حقول للتحديث' });
  }

  updates.push(`updated_at = datetime('now','localtime')`);
  values.push(item.id);

  db.prepare(`UPDATE order_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM order_items WHERE id = ?').get(item.id));
});

// ── POST /api/order-items/:id/diagnosis — set repair description + cost ───────
// Triggers OrderService.transition() — does not set status directly.
router.post('/:id/diagnosis', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  if (order.status !== 'inspection') {
    return res.status(400).json({ error: 'لا يمكن إضافة تشخيص إلا في مرحلة الفحص' });
  }

  const { repair_description, estimated_cost } = req.body;
  const cost = parseFloat(estimated_cost) || 0;
  if (cost < 0) return res.status(400).json({ error: 'التكلفة لا يمكن أن تكون سالبة' });

  // Update item: repair description + cost fields
  db.prepare(`
    UPDATE order_items
    SET repair_description = ?,
        updated_at         = datetime('now','localtime')
    WHERE id = ?
  `).run(repair_description?.trim() ?? null, item.id);

  syncItemCost(item.id, cost);

  // Recalculate order total and determine transition
  const total = refreshOrderCost(order.id);
  const targetStatus = total > 0 ? 'waiting_approval' : 'in_repair';

  let updated;
  try {
    updated = OrderService.transition(
      order.id,
      targetStatus,
      req.user,
      { notes: `تشخيص الصنف #${item.id}: ${repair_description ?? ''} — تكلفة: ${cost} ريال` }
    );
  } catch (err) {
    return res.status(errorToHttpStatus(err)).json({ error: err.message });
  }

  const updatedItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(item.id);
  const allItems    = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order').all(order.id);

  res.json({
    order: { ...updated, items: allItems },
    item: updatedItem,
    ...(updated._notification && { _notification: updated._notification }),
  });
});

// ── POST /api/order-items/:id/photos — add a photo URL ────────────────────────
// 6.7 — workshop only: repair photos are uploaded by the workshop
router.post('/:id/photos', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const { photo_url, photo_type } = req.body;
  if (!photo_url || !photo_url.trim()) {
    return res.status(400).json({ error: 'رابط الصورة مطلوب' });
  }
  if (!VALID_PHOTO_TYPES.has(photo_type)) {
    return res.status(400).json({
      error: `نوع الصورة غير صالح. المقبول: ${[...VALID_PHOTO_TYPES].join(', ')}`,
    });
  }

  const result = db.prepare(`
    INSERT INTO item_photos (order_item_id, photo_url, photo_type, uploaded_by)
    VALUES (?, ?, ?, ?)
  `).run(item.id, photo_url.trim(), photo_type, req.user.username);

  res.status(201).json(
    db.prepare('SELECT * FROM item_photos WHERE id = ?').get(result.lastInsertRowid)
  );
});

// ── GET /api/order-items/:id/photos — list photos for item ────────────────────
router.get('/:id/photos', (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  res.json(
    db.prepare('SELECT * FROM item_photos WHERE order_item_id = ? ORDER BY created_at').all(item.id)
  );
});

// ── POST /api/order-items/:id/services — assign a service to item ─────────────
router.post('/:id/services', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const { service_id, price, notes } = req.body;
  if (!service_id) return res.status(400).json({ error: 'service_id مطلوب' });

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
  if (!service) return res.status(404).json({ error: 'الخدمة غير موجودة' });

  const finalPrice = price !== undefined ? parseFloat(price) : service.default_price;
  if (isNaN(finalPrice) || finalPrice < 0) {
    return res.status(400).json({ error: 'السعر غير صالح' });
  }

  const result = db.prepare(`
    INSERT INTO order_item_services (order_item_id, service_id, price, notes)
    VALUES (?, ?, ?, ?)
  `).run(item.id, service.id, finalPrice, notes?.trim() ?? null);

  res.status(201).json(
    db.prepare(`
      SELECT ois.*, s.name AS service_name
      FROM order_item_services ois
      JOIN services s ON s.id = ois.service_id
      WHERE ois.id = ?
    `).get(result.lastInsertRowid)
  );
});

// ── POST /api/order-items/:id/parts — record parts used (deducts stock) ───────
router.post('/:id/parts', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const { inventory_item_id, quantity } = req.body;
  if (!inventory_item_id) return res.status(400).json({ error: 'inventory_item_id مطلوب' });

  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'الكمية يجب أن تكون أكبر من صفر' });

  // Atomic: check stock then deduct — single transaction prevents race conditions
  const recordPart = db.transaction(() => {
    const invItem = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(inventory_item_id);
    if (!invItem) {
      const err = new Error('المادة غير موجودة في المخزون'); err.status = 404; throw err;
    }
    if (invItem.stock_qty < qty) {
      const err = new Error(`الكمية المطلوبة (${qty}) تتجاوز المخزون المتاح (${invItem.stock_qty})`);
      err.status = 400; throw err;
    }

    db.prepare(`
      UPDATE inventory_items
      SET stock_qty = stock_qty - ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(qty, invItem.id);

    const result = db.prepare(`
      INSERT INTO repair_parts_used (order_item_id, inventory_item_id, quantity)
      VALUES (?, ?, ?)
    `).run(item.id, invItem.id, qty);

    return db.prepare(`
      SELECT rp.*, i.name AS part_name, i.unit
      FROM repair_parts_used rp
      JOIN inventory_items i ON i.id = rp.inventory_item_id
      WHERE rp.id = ?
    `).get(result.lastInsertRowid);
  });

  try {
    res.status(201).json(recordPart());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── POST /api/order-items/:id/technicians — assign technician to item ─────────
router.post('/:id/technicians', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const { technician_id } = req.body;
  if (!technician_id) return res.status(400).json({ error: 'technician_id مطلوب' });

  const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(technician_id);
  if (!tech) return res.status(404).json({ error: 'الفني غير موجود' });

  // Prevent duplicate assignment
  const existing = db.prepare(`
    SELECT id FROM order_item_technicians
    WHERE order_item_id = ? AND technician_id = ?
  `).get(item.id, tech.id);
  if (existing) return res.status(409).json({ error: 'الفني مُعيَّن بالفعل لهذا الصنف' });

  const result = db.prepare(`
    INSERT INTO order_item_technicians (order_item_id, technician_id)
    VALUES (?, ?)
  `).run(item.id, tech.id);

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

module.exports = router;
