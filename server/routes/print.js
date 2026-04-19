'use strict';

/**
 * print.js — Routes for universal label printing
 *
 * GET  /api/print/printers                          — list OS printers
 * GET  /api/print/printers/:name/capabilities       — detect size / DPI / adapter
 * POST /api/print/label                             — send a print job
 * POST /api/print/preview                           — return preview HTML (no print)
 */

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getAvailablePrinters,
  getPrinterCapabilities,
  printLabel,
  generatePreview,
} = require('../services/printer/printerManager');

const router = express.Router();

// All print routes require a logged-in workshop or shop_employee user
const guard = [requireAuth, requireRole(['workshop', 'shop_employee'])];

// ── GET /api/print/printers ───────────────────────────────────────────────────
router.get('/printers', ...guard, async (_req, res) => {
  try {
    const printers = await getAvailablePrinters();
    res.json({ printers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/print/printers/:name/capabilities ───────────────────────────────
router.get('/printers/:name/capabilities', ...guard, async (req, res) => {
  try {
    const caps = await getPrinterCapabilities(req.params.name);
    res.json(caps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/print/label ─────────────────────────────────────────────────────
/**
 * Body:
 *   {
 *     printerName: string,
 *     labelData: { barcode?, qrCode?, textLines?, qrDataUrl? },
 *     caps?: { widthMm, heightMm, dpi, adapter }   // optional override
 *   }
 */
router.post('/label', ...guard, async (req, res) => {
  const { printerName, labelData, caps } = req.body || {};

  if (!printerName) {
    return res.status(400).json({ error: 'printerName مطلوب' });
  }
  if (!labelData || typeof labelData !== 'object') {
    return res.status(400).json({ error: 'labelData مطلوب' });
  }

  try {
    const result = await printLabel(printerName, labelData, caps || null);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/print/preview ───────────────────────────────────────────────────
/**
 * Body:
 *   {
 *     labelData: { barcode?, qrCode?, textLines?, qrDataUrl? },
 *     caps?: { widthMm, heightMm, dpi }
 *   }
 */
router.post('/preview', ...guard, async (req, res) => {
  const { labelData, caps } = req.body || {};

  if (!labelData || typeof labelData !== 'object') {
    return res.status(400).json({ error: 'labelData مطلوب' });
  }

  try {
    const defaultCaps = { widthMm: 50, heightMm: 30, dpi: 203 };
    const { html, layout } = generatePreview(labelData, { ...defaultCaps, ...(caps || {}) });
    res.json({ html, layout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
