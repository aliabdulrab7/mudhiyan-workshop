const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  DuplicateRoleError,
  RoleInUseError,
  ValidationError,
} = require('../errors');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('workshop'));

const ALLOWED_PATCH = new Set(['display_label_ar', 'sort_order', 'active']);

function notFound() {
  const err = new Error('Role not found');
  err.name = 'NotFoundError';
  return err;
}

function readRow(id) {
  return db.prepare(`SELECT * FROM roles WHERE id = ?`).get(id);
}

// GET /api/roles → { items: [...] }
// All roles, including inactive, sorted by sort_order then id.
router.get('/', (_req, res) => {
  const items = db.prepare(`
    SELECT id, value, display_label_ar, sort_order, active, created_at
    FROM roles ORDER BY sort_order, id
  `).all();
  res.json({ items });
});

// POST /api/roles { value, display_label_ar }
router.post('/', (req, res) => {
  const value = (req.body?.value ?? '').toString().trim();
  const label = (req.body?.display_label_ar ?? '').toString().trim();
  if (!value) throw new ValidationError('value مطلوب');
  if (!label) throw new ValidationError('display_label_ar مطلوب');
  const sortOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM roles`).get().next;
  let id;
  try {
    id = db.prepare(`
      INSERT INTO roles (value, display_label_ar, sort_order) VALUES (?, ?, ?)
    `).run(value, label, sortOrder).lastInsertRowid;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateRoleError(value);
    throw e;
  }
  res.status(201).json(readRow(id));
});

// PATCH /api/roles/:id — value is intentionally NOT editable
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
    db.prepare(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json(readRow(id));
});

// DELETE /api/roles/:id — soft (active=0); blocks if referenced.
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = readRow(id);
  if (!row) throw notFound();
  const ref = db.prepare(
    `SELECT COUNT(*) AS n FROM technicians WHERE role_id = ? AND active = 1`
  ).get(id).n;
  if (ref > 0) throw new RoleInUseError(ref);
  db.prepare(`UPDATE roles SET active = 0 WHERE id = ?`).run(id);
  res.json(readRow(id));
});

module.exports = router;
