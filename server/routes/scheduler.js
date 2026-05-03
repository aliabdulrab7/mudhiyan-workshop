const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ShiftService = require('../services/ShiftService');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('workshop'));

// POST /api/scheduler/run — trigger scheduler immediately (for manual override / testing)
router.post('/run', (req, res) => {
  res.json(ShiftService.runScheduler());
});

// GET /api/scheduler/status — snapshot of current time + what scheduler would do
router.get('/status', (req, res) => {
  res.json(ShiftService.getSchedulerStatus());
});

module.exports = router;
