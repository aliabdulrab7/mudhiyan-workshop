const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  DuplicateSpecializationError,
  SpecializationInUseError,
  ValidationError,
} = require('../errors');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('workshop'));

const ALLOWED_PATCH = new Set(['display_label_ar', 'sort_order', 'active']);

function notFound() {
  const err = new Error('Specialization not found');
  err.name = 'NotFoundError';
  return err;
}

function readRow(id) {
  return db.prepare(`SELECT * FROM specializations WHERE id = ?`).get(id);
}

// GET /api/specializations → { items: [...] }
router.get('/', (_req, res) => {
  const items = db.prepare(`
    SELECT id, value, display_label_ar, sort_order, active, created_at
    FROM specializations ORDER BY sort_order, id
  `).all();
  res.json({ items });
});

// POST /api/specializations { value, display_label_ar }
router.post('/', (req, res) => {
  const value = (req.body?.value ?? '').toString().trim();
  const label = (req.body?.display_label_ar ?? '').toString().trim();
  if (!value) throw new ValidationError('value مطلوب');
  if (!label) throw new ValidationError('display_label_ar مطلوب');
  const sortOrder = db.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM specializations`
  ).get().next;
  let id;
  try {
    id = db.prepare(`
      INSERT INTO specializations (value, display_label_ar, sort_order)
      VALUES (?, ?, ?)
    `).run(value, label, sortOrder).lastInsertRowid;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateSpecializationError(value);
    throw e;
  }
  res.status(201).json(readRow(id));
});

// PATCH /api/specializations/:id — value is intentionally NOT editable
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = readRow(id);
  if (!row) throw notFound();
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!ALLOWED_PATCH.has(k)) continue;
    if (k === 'active') {
      sets.push('active = ?');
      params.push(v ? 1 : 0);
    } else if (k === 'sort_order') {
      sets.push('sort_order = ?');
      params.push(parseInt(v, 10) || 0);
    } else if (k === 'display_label_ar') {
      const label = (v ?? '').toString().trim();
      if (!label) throw new ValidationError('display_label_ar لا يمكن أن يكون فارغاً');
      sets.push('display_label_ar = ?');
      params.push(label);
    }
  }
  if (sets.length) {
    params.push(id);
    db.prepare(`UPDATE specializations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json(readRow(id));
});

// DELETE /api/specializations/:id — soft; blocks if referenced.
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = readRow(id);
  if (!row) throw notFound();
  const ref = db.prepare(
    `SELECT COUNT(*) AS n FROM technician_specializations WHERE specialization_id = ?`
  ).get(id).n;
  if (ref > 0) throw new SpecializationInUseError(ref);
  db.prepare(`UPDATE specializations SET active = 0 WHERE id = ?`).run(id);
  res.json(readRow(id));
});

module.exports = router;
