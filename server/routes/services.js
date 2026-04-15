const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/services — workshop only
router.post('/', requireRole('workshop'), (req, res) => {
  const { name, description, default_price } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
  const price = parseFloat(default_price) || 0;

  const result = db.prepare(`
    INSERT INTO services (name, description, default_price)
    VALUES (?, ?, ?)
  `).run(name.trim(), description?.trim() ?? null, price);

  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid));
});

// GET /api/services — all authenticated users
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM services ORDER BY name').all());
});

// PUT /api/services/:id — workshop only
router.put('/:id', requireRole('workshop'), (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!service) return res.status(404).json({ error: 'الخدمة غير موجودة' });

  const name          = req.body.name?.trim()        ?? service.name;
  const description   = req.body.description?.trim() ?? service.description;
  const default_price = req.body.default_price !== undefined
    ? parseFloat(req.body.default_price)
    : service.default_price;

  db.prepare(`
    UPDATE services SET name = ?, description = ?, default_price = ? WHERE id = ?
  `).run(name, description, default_price, req.params.id);

  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

module.exports = router;
