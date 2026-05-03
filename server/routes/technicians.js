const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const TechnicianService  = require('../services/TechnicianService');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('workshop'));

// GET /api/technicians?role_id=&status=&search=&active=&with=workload&limit=&offset=
//
// Returns { items, total, limit, offset }. Each item carries top-3
// specializations; full list is on GET /:id. with=workload adds active_count
// and urgent_count per row (separate aggregate, not joined into the row read).
router.get('/', (req, res) => {
  const { role_id, status, search, active, limit, offset } = req.query;
  const withWorkload = req.query.with === 'workload';
  const result = TechnicianService.list({
    role_id, status, search, active, withWorkload, limit, offset,
  });
  res.json(result);
});

// GET /api/technicians/picker — optimized picker payload, least-busy first.
// MUST stay before /:id to avoid Express matching 'picker' as an id.
// Params: q, specialization_id, status (default 'available'; 'all' = no filter), limit, offset
router.get('/picker', (req, res) => {
  const { q, specialization_id, status, limit, offset } = req.query;
  res.json(TechnicianService.pickerQuery({ q, specialization_id, status, limit, offset }));
});

// GET /api/technicians/workload-summary — live status board snapshot.
// MUST stay before /:id (literal route).
// Query: ?active_only=true (default true; pass false to include inactive techs)
// Returns { technicians: [...] } sorted available→busy→off_shift→on_leave, name ASC.
router.get('/workload-summary', (req, res) => {
  const activeOnly = req.query.active_only !== 'false';
  res.json({ technicians: TechnicianService.getWorkloadSummary({ activeOnly }) });
});

// GET /api/technicians/item-type-spec-map — full configurable map for admin UI.
// Returns { map: [{ item_type, spec_values, updated_at, updated_by_username }] }
// MUST stay before /:id (literal segment).
router.get('/item-type-spec-map', (req, res) => {
  const rows = require('../db').db.prepare(`
    SELECT m.item_type, m.spec_values, m.updated_at, u.username AS updated_by_username
    FROM item_type_spec_map m
    LEFT JOIN users u ON u.id = m.updated_by
    ORDER BY m.item_type
  `).all();
  const map = rows.map(r => ({
    item_type:           r.item_type,
    spec_values:         (() => { try { return JSON.parse(r.spec_values); } catch { return []; } })(),
    updated_at:          r.updated_at,
    updated_by_username: r.updated_by_username ?? null,
  }));
  res.json({ map });
});

// PUT /api/technicians/item-type-spec-map/:itemType — upsert one row.
// Body: { spec_values: string[] }. 422 on unknown spec value.
// Arabic item types must be URL-encoded by the client; Express decodes them.
// MUST stay before /:id (literal prefix).
router.put('/item-type-spec-map/:itemType', (req, res) => {
  const itemType  = decodeURIComponent(req.params.itemType);
  const { spec_values } = req.body || {};
  const row = TechnicianService.updateItemTypeSpecMap(itemType, spec_values, req.user?.id);
  res.json({
    item_type:           row.item_type,
    spec_values:         (() => { try { return JSON.parse(row.spec_values); } catch { return []; } })(),
    updated_at:          row.updated_at,
    updated_by_username: row.updated_by_username ?? null,
  });
});

// GET /api/technicians/:id — full detail
router.get('/:id', (req, res) => {
  res.json(TechnicianService.getDetail(parseInt(req.params.id, 10)));
});

// GET /api/technicians/:id/status-history — paginated status change log.
// Returns { history: [{ from_status, to_status, changed_by_username, reason, changed_at }] }
// limit default 20, max 100. 404 on bad id.
router.get('/:id/status-history', (req, res) => {
  const techId    = parseInt(req.params.id, 10);
  const safeLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const tech = TechnicianService.getDetail(techId); // throws NotFoundError → 404 if missing
  const history = db.prepare(`
    SELECT sl.from_status, sl.to_status, sl.reason, sl.changed_at,
           u.username AS changed_by_username
    FROM technician_status_log sl
    LEFT JOIN users u ON u.id = sl.changed_by
    WHERE sl.technician_id = ?
    ORDER BY sl.id DESC
    LIMIT ?
  `).all(techId, safeLimit);


  res.json({ history });
});

// POST /api/technicians — create
router.post('/', (req, res) => {
  const tech = TechnicianService.create(req.body || {});
  res.status(201).json(tech);
});

// PATCH /api/technicians/:id — update (general fields: name, role_id, phone, notes, active)
router.patch('/:id', (req, res) => {
  const tech = TechnicianService.update(parseInt(req.params.id, 10), req.body || {});
  res.json(tech);
});

// PATCH /api/technicians/:id/status — status change with audit log.
// Body: { status: 'available'|'busy'|'off_shift'|'on_leave', reason?: string }
// 422 InvalidStatusError on bad enum; 404 on bad id.
router.patch('/:id/status', (req, res) => {
  const techId = parseInt(req.params.id, 10);
  const { status, reason } = req.body || {};
  if (!status) return res.status(422).json({ error: 'حقل الحالة مطلوب' });
  const tech = TechnicianService.changeStatus(techId, status, {
    reason: reason ?? null,
    changedBy: req.user?.id ?? null,
  });
  res.json(tech);
});

// DELETE /api/technicians/:id — soft delete (active=0)
// Throws TechnicianHasAssignmentsError (409) if open work is assigned.
router.delete('/:id', (req, res) => {
  const tech = TechnicianService.softDelete(parseInt(req.params.id, 10));
  res.json(tech);
});

// POST /api/technicians/:id/specializations { specialization_id }
// Idempotent (UNIQUE on (technician_id, specialization_id)).
router.post('/:id/specializations', (req, res) => {
  const techId = parseInt(req.params.id, 10);
  const specId = parseInt(req.body?.specialization_id, 10);
  if (!Number.isFinite(specId)) {
    return res.status(400).json({ error: 'specialization_id مطلوب' });
  }
  const specializations = TechnicianService.addSpecialization(techId, specId);
  res.json({ specializations });
});

// DELETE /api/technicians/:id/specializations/:specializationId
router.delete('/:id/specializations/:specializationId', (req, res) => {
  const techId = parseInt(req.params.id, 10);
  const specId = parseInt(req.params.specializationId, 10);
  const specializations = TechnicianService.removeSpecialization(techId, specId);
  res.json({ specializations });
});

module.exports = router;
