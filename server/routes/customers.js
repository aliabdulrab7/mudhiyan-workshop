const express = require('express');
const { db }  = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/customers
router.post('/', (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'الاسم مطلوب' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'رقم الجوال مطلوب' });

  const result = db.prepare(`
    INSERT INTO customers (name, phone, email)
    VALUES (?, ?, ?)
  `).run(name.trim(), phone.trim(), email?.trim() ?? null);

  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid));
});

// GET /api/customers
router.get('/', (req, res) => {
  const { search } = req.query;
  let query  = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY created_at DESC LIMIT 200';
  res.json(db.prepare(query).all(...params));
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });
  res.json(customer);
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

  const name  = req.body.name?.trim()  ?? customer.name;
  const phone = req.body.phone?.trim() ?? customer.phone;
  const email = req.body.email?.trim() ?? customer.email;

  db.prepare(`
    UPDATE customers SET name = ?, phone = ?, email = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(name, phone, email, req.params.id);

  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

module.exports = router;
