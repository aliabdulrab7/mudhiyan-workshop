const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/inventory — workshop only
router.post('/', requireRole('workshop'), (req, res) => {
  const { name, category, stock_qty, unit, cost_per_unit } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'اسم المادة مطلوب' });

  const qty  = parseFloat(stock_qty)   || 0;
  const cost = parseFloat(cost_per_unit) || 0;

  const result = db.prepare(`
    INSERT INTO inventory_items (name, category, stock_qty, unit, cost_per_unit)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), category?.trim() ?? null, qty, unit?.trim() ?? 'piece', cost);

  res.status(201).json(
    db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(result.lastInsertRowid)
  );
});

// GET /api/inventory
router.get('/', (req, res) => {
  const { category, search } = req.query;
  let query  = 'SELECT * FROM inventory_items WHERE 1=1';
  const params = [];

  if (category) { query += ' AND category = ?'; params.push(category); }
  if (search)   { query += ' AND name LIKE ?';   params.push(`%${search}%`); }

  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
});

// PATCH /api/inventory/:id/stock — workshop only
// quantity_change: positive = restock, negative = consume
router.patch('/:id/stock', requireRole('workshop'), (req, res) => {
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'المادة غير موجودة' });

  const change = parseFloat(req.body.quantity_change);
  if (isNaN(change)) return res.status(400).json({ error: 'quantity_change يجب أن يكون رقماً' });

  const newQty = item.stock_qty + change;
  if (newQty < 0) {
    return res.status(400).json({ error: 'المخزون لا يمكن أن يكون سالباً' });
  }

  db.prepare(`
    UPDATE inventory_items
    SET stock_qty = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(newQty, item.id);

  res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id));
});

module.exports = router;
