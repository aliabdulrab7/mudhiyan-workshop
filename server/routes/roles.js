const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  DuplicateRoleError,
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

function roleRefCount(id) {
  const n = db.prepare(
    `SELECT COUNT(*) AS n FROM technicians WHERE role_id = ? AND active = 1 AND archived_at IS NULL`
  ).get(id).n;
  return { reference_count: n, referencing_tables: n > 0 ? [{ table: 'technicians', count: n }] : [] };
}

// GET /api/roles?include_archived=true → { items: [...] }
// Default: archived_at IS NULL (active + inactive, but not archived).
router.get('/', (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  const sql = includeArchived
    ? `SELECT * FROM roles ORDER BY sort_order, id`
    : `SELECT * FROM roles WHERE archived_at IS NULL ORDER BY sort_order, id`;
  res.json({ items: db.prepare(sql).all() });
});

// GET /api/roles/:id/ref-count → { reference_count, referencing_tables }
// Used by ArchiveConfirmDialog to show how many records reference this role.
// Must be declared before /:id (PATCH/DELETE) to avoid Express matching 'ref-count' as an id.
router.get('/:id/ref-count', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  res.json(roleRefCount(id));
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
    id = db.prepare(
      `INSERT INTO roles (value, display_label_ar, sort_order) VALUES (?, ?, ?)`
    ).run(value, label, sortOrder).lastInsertRowid;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateRoleError(value);
    throw e;
  }
  res.status(201).json(readRow(id));
});

// POST /api/roles/:id/archive — sets archived_at; NOT blocked by ref-count (archive is informational).
router.post('/:id/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  db.prepare(
    `UPDATE roles SET archived_at = datetime('now'), active = 0 WHERE id = ?`
  ).run(id);
  res.json(readRow(id));
});

// POST /api/roles/:id/restore — clears archived_at and re-activates.
router.post('/:id/restore', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!readRow(id)) throw notFound();
  db.prepare(
    `UPDATE roles SET archived_at = NULL, active = 1 WHERE id = ?`
  ).run(id);
  res.json(readRow(id));
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

// DELETE /api/roles/:id — hard-delete; blocked if active technicians reference it.
// Returns { reference_count, referencing_tables } in 409 body for UI dependency display.
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = readRow(id);
  if (!row) throw notFound();
  const { reference_count, referencing_tables } = roleRefCount(id);
  if (reference_count > 0) {
    return res.status(409).json({
      error: `لا يمكن حذف الدور — مستخدم من ${reference_count} فني`,
      reference_count,
      referencing_tables,
    });
  }
  db.prepare(`DELETE FROM roles WHERE id = ?`).run(id);
  res.json({ ok: true, id });
});

module.exports = router;
