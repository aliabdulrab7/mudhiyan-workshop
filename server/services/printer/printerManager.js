'use strict';

/**
 * printerManager.js
 *
 * Orchestrates printer detection, capability resolution, and job dispatch.
 *
 * Responsibilities:
 *   1. List OS-registered printers (CUPS on macOS/Linux, PowerShell on Windows)
 *   2. Retrieve printer capabilities (page size, DPI, type)
 *   3. Detect whether a printer speaks ZPL (Zebra et al.) or generic CUPS
 *   4. Route print jobs to the correct adapter
 *   5. Fall back to the generic HTML adapter when printer type is unknown
 */

const { exec }    = require('child_process');
const { promisify } = require('util');
const os          = require('os');

const genericAdapter = require('./adapters/genericAdapter');
const zebraAdapter   = require('./adapters/zebraAdapter');

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Printer detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse `lpstat -a` output into an array of printer name strings.
 * Sample line:  Brother_QL-820NWB accepting requests since ...
 */
function parseLpstat(stdout) {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * Return the list of CUPS-registered printers (macOS / Linux).
 */
async function getCupsPrinters() {
  try {
    const { stdout } = await execAsync('lpstat -a 2>/dev/null');
    return parseLpstat(stdout);
  } catch {
    return [];
  }
}

/**
 * Return the list of Windows printers via PowerShell.
 */
async function getWindowsPrinters() {
  try {
    const cmd = 'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"';
    const { stdout } = await execAsync(cmd);
    return stdout
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Return all printers registered with the OS.
 * Each entry: { name: string }
 */
async function getAvailablePrinters() {
  const names = os.platform() === 'win32'
    ? await getWindowsPrinters()
    : await getCupsPrinters();

  return names.map(name => ({ name }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known ZPL-capable printer name fragments (case-insensitive).
 * Any printer whose CUPS name or make/model contains one of these is treated
 * as ZPL-capable and routed to zebraAdapter.
 */
const ZPL_HINTS = [
  'zebra', 'zpl', 'zt', 'zd', 'zm', 'gz',   // Zebra model prefixes
  'citizen', 'datamax', 'bixolon', 'sato',    // Other ZPL-compatible brands
];

/**
 * Detect if the printer is ZPL-capable based on its CUPS device-uri / make-model.
 */
async function isZplPrinter(printerName) {
  if (os.platform() === 'win32') return false; // CUPS not available on Windows
  try {
    const { stdout } = await execAsync(`lpoptions -p "${printerName}" 2>/dev/null`);
    const lower = stdout.toLowerCase();
    return ZPL_HINTS.some(hint => lower.includes(hint));
  } catch { return false; }
}

/**
 * Parse a page-size string like "Custom.50x30mm" or "oe_62x100mm_62x100mm".
 * Returns { widthMm, heightMm } or null.
 */
function parsePageSizeMm(sizeStr) {
  // Match patterns: NxNmm or N.Nx N.Nmm
  const m = sizeStr.match(/([\d.]+)[xX]([\d.]+)mm/);
  if (!m) return null;
  return { widthMm: parseFloat(m[1]), heightMm: parseFloat(m[2]) };
}

/**
 * Query CUPS for the printer's current page size and DPI.
 * Returns partial caps: { widthMm?, heightMm?, dpi? }
 */
async function queryCupsCaps(printerName) {
  const caps = {};
  try {
    const { stdout } = await execAsync(`lpoptions -p "${printerName}" -l 2>/dev/null`);

    // Page size
    const psLine = stdout.split('\n').find(l => l.startsWith('PageSize'));
    if (psLine) {
      // The currently selected value is marked with an asterisk: *Custom.50x30mm
      const selected = (psLine.match(/\*(\S+)/) || [])[1];
      if (selected) {
        const size = parsePageSizeMm(selected);
        if (size) Object.assign(caps, size);
      }
    }

    // Resolution — e.g. "Resolution/Output Resolution: 203dpi *300dpi 600dpi"
    const resLine = stdout.split('\n').find(l => l.startsWith('Resolution'));
    if (resLine) {
      const resSel = (resLine.match(/\*(\d+)dpi/) || [])[1];
      if (resSel) caps.dpi = parseInt(resSel, 10);
    }
  } catch { /* CUPS unavailable — skip */ }
  return caps;
}

/**
 * Retrieve capabilities for a named printer.
 *
 * Returns:
 *   {
 *     printerName: string,
 *     adapter: 'zebra' | 'generic',
 *     widthMm: number,       // label width (defaults to 50)
 *     heightMm: number,      // label height (defaults to 30)
 *     dpi: number,           // printer DPI (defaults to 203)
 *   }
 */
async function getPrinterCapabilities(printerName) {
  const [zpl, cupsCaps] = await Promise.all([
    isZplPrinter(printerName),
    os.platform() !== 'win32' ? queryCupsCaps(printerName) : Promise.resolve({}),
  ]);

  return {
    printerName,
    adapter:   zpl ? 'zebra' : 'generic',
    widthMm:   cupsCaps.widthMm  || 50,
    heightMm:  cupsCaps.heightMm || 30,
    dpi:       cupsCaps.dpi      || 203,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Job dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a label to the named printer.
 *
 * labelData shape:
 *   { barcode?: string, qrCode?: string, textLines?: string[], qrDataUrl?: string }
 *
 * Automatically resolves capabilities and routes to the correct adapter.
 * Accepts an optional `caps` override to skip the capability query (e.g. when
 * the caller already fetched caps from GET /api/print/printers/:name/capabilities).
 */
async function printLabel(printerName, labelData, capsOverride) {
  const caps = capsOverride || await getPrinterCapabilities(printerName);

  if (caps.adapter === 'zebra') {
    return zebraAdapter.print(printerName, labelData, caps);
  }
  return genericAdapter.print(printerName, labelData, caps);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview (no print job)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a preview HTML string without sending a print job.
 * Uses genericAdapter which renders HTML regardless of ZPL status.
 */
function generatePreview(labelData, caps) {
  return genericAdapter.generatePreviewHtml(labelData, caps);
}

module.exports = {
  getAvailablePrinters,
  getPrinterCapabilities,
  printLabel,
  generatePreview,
};
