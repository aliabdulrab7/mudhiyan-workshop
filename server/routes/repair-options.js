const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_NEEDS = [null, 'size', 'stone', 'color', 'text'];

function normalizeNeeds(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  return ALLOWED_NEEDS.includes(s) ? s : undefined; // undefined signals invalid
}

// GET /api/repair-options?item_type=&include_archived=true
// Default: archived_at IS NULL AND active = 1.
// With ?include_archived=true: all rows regardless of archived_at (still active=1 unless ?active=all).
// All authenticated users — shop_employee needs this at /new intake.
router.get('/', (req, res) => {
  const { item_type } = req.query;
  const includeArchived = req.query.include_archived === 'true';

  let sql, params;
  if (includeArchived) {
    // Show all rows (active and inactive, archived and not) — management view.
    sql = item_type
      ? `SELECT * FROM repair_options WHERE item_type = ? ORDER BY sort_order, id`
      : `SELECT * FROM repair_options ORDER BY item_type, sort_order, id`;
    params = item_type ? [item_type] : [];
  } else {
    // Default: active only, not archived.
    sql = item_type
      ? `SELECT * FROM repair_options WHERE item_type = ? AND active = 1 AND archived_at IS NULL ORDER BY sort_order, id`
      : `SELECT * FROM repair_options WHERE active = 1 AND archived_at IS NULL ORDER BY item_type, sort_order, id`;
    params = item_type ? [item_type] : [];
  }
  res.json(db.prepare(sql).all(...params));
});

// POST /api/repair-options — workshop only
router.post('/', requireRole('workshop'), (req, res) => {
  const item_type = (req.body.item_type || '').trim();
  const value     = (req.body.value || '').trim();
  if (!item_type) return res.status(400).json({ error: 'نوع القطعة مطلوب' });
  if (!value)     return res.status(400).json({ error: 'اسم الإصلاح مطلوب' });

  const needs = normalizeNeeds(req.body.needs);
  if (needs === undefined) return res.status(400).json({ error: 'نوع التفاصيل غير صالح' });

  const maxOrder = db.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM repair_options WHERE item_type = ?`
  ).get(item_type).next;

  try {
    const result = db.prepare(
      `INSERT INTO repair_options (item_type, value, needs, sort_order) VALUES (?, ?, ?, ?)`
    ).run(item_type, value, needs, maxOrder);
    res.status(201).json(db.prepare('SELECT * FROM repair_options WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'هذا الإصلاح مسجل مسبقاً لهذا النوع' });
    }
    throw err;
  }
});

// POST /api/repair-options/:id/archive — workshop only
router.post('/:id/archive', requireRole('workshop'), (req, res) => {
  const row = db.prepare('SELECT * FROM repair_options WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الخيار غير موجود' });
  db.prepare(
    `UPDATE repair_options SET archived_at = datetime('now'), active = 0 WHERE id = ?`
  ).run(row.id);
  res.json(db.prepare('SELECT * FROM repair_options WHERE id = ?').get(row.id));
});

// POST /api/repair-options/:id/restore — workshop only
router.post('/:id/restore', requireRole('workshop'), (req, res) => {
  const row = db.prepare('SELECT * FROM repair_options WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الخيار غير موجود' });
  db.prepare(
    `UPDATE repair_options SET archived_at = NULL, active = 1 WHERE id = ?`
  ).run(row.id);
  res.json(db.prepare('SELECT * FROM repair_options WHERE id = ?').get(row.id));
});

// PATCH /api/repair-options/:id — workshop only
router.patch('/:id', requireRole('workshop'), (req, res) => {
  const row = db.prepare('SELECT * FROM repair_options WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الخيار غير موجود' });

  const value = req.body.value !== undefined ? String(req.body.value).trim() : row.value;
  if (!value) return res.status(400).json({ error: 'اسم الإصلاح مطلوب' });

  let needs = row.needs;
  if (req.body.needs !== undefined) {
    const n = normalizeNeeds(req.body.needs);
    if (n === undefined) return res.status(400).json({ error: 'نوع التفاصيل غير صالح' });
    needs = n;
  }

  const active     = req.body.active !== undefined ? (req.body.active ? 1 : 0) : row.active;
  const sort_order = req.body.sort_order !== undefined ? parseInt(req.body.sort_order, 10) : row.sort_order;

  try {
    db.prepare(
      `UPDATE repair_options SET value = ?, needs = ?, active = ?, sort_order = ? WHERE id = ?`
    ).run(value, needs, active, sort_order, row.id);
    res.json(db.prepare('SELECT * FROM repair_options WHERE id = ?').get(row.id));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'هذا الإصلاح مسجل مسبقاً لهذا النوع' });
    }
    throw err;
  }
});

// DELETE /api/repair-options/:id — hard delete; repair_options has no FK references.
// Always returns { ok: true, reference_count: 0 } on success.
router.delete('/:id', requireRole('workshop'), (req, res) => {
  const result = db.prepare('DELETE FROM repair_options WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'الخيار غير موجود' });
  res.json({ ok: true, reference_count: 0, referencing_tables: [] });
});

module.exports = router;
