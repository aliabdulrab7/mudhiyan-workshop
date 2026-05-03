const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const TechnicianService = require('../services/TechnicianService');

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

// GET /api/technicians/:id — full detail
router.get('/:id', (req, res) => {
  res.json(TechnicianService.getDetail(parseInt(req.params.id, 10)));
});

// POST /api/technicians — create
router.post('/', (req, res) => {
  const tech = TechnicianService.create(req.body || {});
  res.status(201).json(tech);
});

// PATCH /api/technicians/:id — update
router.patch('/:id', (req, res) => {
  const tech = TechnicianService.update(parseInt(req.params.id, 10), req.body || {});
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
