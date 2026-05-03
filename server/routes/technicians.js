const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/technicians — workshop only
// WF-1a: minimal compat. Full create flow (role_id, specialization_ids, etc.)
// lands in WF-1b TechnicianService.
router.post('/', requireRole('workshop'), (req, res) => {
  const { user_id, name } = req.body;

  // user_id is optional — technicians don't need a login (per WF-1 design)
  const result = db.prepare(`
    INSERT INTO technicians (user_id, name) VALUES (?, ?)
  `).run(user_id ?? null, name?.trim() ?? '');

  res.status(201).json(db.prepare(`
    SELECT t.*, u.username
    FROM technicians t LEFT JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(result.lastInsertRowid));
});

// GET /api/technicians — workshop only (no shop_employee surface consumes this)
router.get('/', requireRole('workshop'), (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, u.username
    FROM technicians t
    LEFT JOIN users u ON u.id = t.user_id
    ORDER BY t.id
  `).all());
});

module.exports = router;
