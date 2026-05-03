/**
 * Order Items router
 * Handles per-item operations: update, diagnosis, photos, services, parts, technicians.
 * All write operations check order.locked_at before proceeding.
 */

const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const OrderService       = require('../services/OrderService');
const TechnicianService  = require('../services/TechnicianService');
const { syncItemCost, refreshOrderCost } = require('../helpers/costHelpers');
const { errorToHttpStatus } = require('../errors');
const { ITEMS_WITH_TECH_SQL } = require('../helpers/itemQueries');

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
// Writes per-item diagnosis + cost. Does NOT transition the order — workshop
// must explicitly POST /api/orders/:id/send-for-approval when ready.
router.post('/:id/diagnosis', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  const QUOTEABLE = new Set(['inspection', 'in_repair', 'rejected', 'waiting_approval']);
  if (!QUOTEABLE.has(order.status)) {
    return res.status(400).json({ error: 'لا يمكن إضافة تشخيص في هذه المرحلة' });
  }

  const { repair_description, estimated_cost } = req.body;
  const cost = parseFloat(estimated_cost) || 0;
  if (cost < 0) return res.status(400).json({ error: 'التكلفة لا يمكن أن تكون سالبة' });

  db.prepare(`
    UPDATE order_items
    SET repair_description = ?,
        updated_at         = datetime('now','localtime')
    WHERE id = ?
  `).run(repair_description?.trim() ?? null, item.id);

  syncItemCost(item.id, cost);
  refreshOrderCost(order.id);

  const freshOrder = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(order.id);
  const updatedItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(item.id);
  const allItems    = db.prepare(ITEMS_WITH_TECH_SQL).all(order.id);

  res.json({
    order: { ...freshOrder, items: allItems },
    item: updatedItem,
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

// ── POST /api/order-items/:id/auto-assign — score all active techs and assign the best.
// MUST stay before /:id/technicians to avoid Express route collision.
// 422 NoSuitableTechnicianError when no active techs; 409 if order locked; 404 if item missing.
// Returns { technician: { id, name, status, role_id }, score, matched_specs }.
router.post('/:id/auto-assign', requireRole('workshop'), (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const result = TechnicianService.autoAssign(itemId, { assignedBy: req.user?.id });
  res.json(result);
});

// ── POST /api/order-items/:id/technicians — set the technician for this item ──
// Replace-style: each item has at most one technician at a time. Idempotent —
// re-assigning the same tech is a no-op success, not 409. The schema is M:M
// (order_item_technicians) but the product treats it as 1:1; this endpoint is
// the source of truth for that semantic.
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

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM order_item_technicians WHERE order_item_id = ?').run(item.id);
    db.prepare(`
      INSERT INTO order_item_technicians (order_item_id, technician_id)
      VALUES (?, ?)
    `).run(item.id, tech.id);
  });
  replace();

  res.json({
    ok: true,
    technician: db.prepare(`
      SELECT t.*, u.username
      FROM technicians t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(tech.id),
  });
});

// ── GET /api/order-items/:id/suggested-technicians ───────────────────────────
// Ranks active technicians by specialization match + status + workload for the
// given item. Uses ITEM_TYPE_SPEC_MAP from TechnicianService. 404 if item missing.
router.get('/:id/suggested-technicians', requireRole('workshop'), (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { limit } = req.query;
  res.json(TechnicianService.suggestForItem(itemId, { limit }));
});

// ── DELETE /api/order-items/:id/technicians — unassign all technicians ────────
router.delete('/:id/technicians', requireRole('workshop'), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  const order = getOrder(item.order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (checkLocked(order, res)) return;

  db.prepare('DELETE FROM order_item_technicians WHERE order_item_id = ?').run(item.id);
  res.json({ ok: true });
});

module.exports = router;
