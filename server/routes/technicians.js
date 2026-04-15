const express = require('express');
const { db }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/technicians — workshop only
router.post('/', requireRole('workshop'), (req, res) => {
  const { user_id, specialization } = req.body;

  // user_id is optional — technician may not have a system login yet
  const result = db.prepare(`
    INSERT INTO technicians (user_id, specialization) VALUES (?, ?)
  `).run(user_id ?? null, specialization?.trim() ?? null);

  res.status(201).json(db.prepare(`
    SELECT t.*, u.username
    FROM technicians t LEFT JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(result.lastInsertRowid));
});

// GET /api/technicians
router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, u.username
    FROM technicians t
    LEFT JOIN users u ON u.id = t.user_id
    ORDER BY t.id
  `).all());
});

module.exports = router;
