const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  DuplicateSpecializationError,
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

function specRefCount(id) {
  const n = db.prepare(
    `SELECT COUNT(*) AS n FROM technician_specializations WHERE specialization_id = ?`
  ).get(id).n;
  return { reference_count: n, referencing_tables: n > 0 ? [{ table: 'technician_specializations', count: n }] : [] };
}

// GET /api/specializations?include_archived=true → { items: [...] }
// Default: archived_at IS NULL.
router.get('/', (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  const sql = includeArchived
    ? `SELECT * FROM specializations ORDER BY sort_order, id`
    : `SELECT * FROM specializations WHERE archived_at IS NULL ORDER BY sort_order, id`;
  res.json({ items: db.prepare(sql).all() });
});

// GET /api/specializations/:id/ref-count → { reference_count, referencing_tables }
router.get('/:id/ref-count', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  res.json(specRefCount(id));
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
    id = db.prepare(
      `INSERT INTO specializations (value, display_label_ar, sort_order) VALUES (?, ?, ?)`
    ).run(value, label, sortOrder).lastInsertRowid;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateSpecializationError(value);
    throw e;
  }
  res.status(201).json(readRow(id));
});

// POST /api/specializations/:id/archive
router.post('/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  db.prepare(
    `UPDATE specializations SET archived_at = datetime('now'), active = 0 WHERE id = ?`
  ).run(id);
  res.json(readRow(id));
});

// POST /api/specializations/:id/restore
router.post('/:id/restore', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  db.prepare(
    `UPDATE specializations SET archived_at = NULL, active = 1 WHERE id = ?`
  ).run(id);
  res.json(readRow(id));
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

// DELETE /api/specializations/:id — hard-delete; blocked if referenced by any tech assignment.
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = readRow(id);
  if (!row) throw notFound();
  const { reference_count, referencing_tables } = specRefCount(id);
  if (reference_count > 0) {
    return res.status(409).json({
      error: `لا يمكن حذف التخصص — مستخدم من ${reference_count} فني`,
      reference_count,
      referencing_tables,
    });
  }
  db.prepare(`DELETE FROM specializations WHERE id = ?`).run(id);
  res.json({ ok: true, id });
});

module.exports = router;
