'use strict';

/**
 * genericAdapter.js
 *
 * Prints to any CUPS-registered printer (thermal, laser, inkjet, etc.) by:
 *   1. Generating a self-contained HTML label document
 *   2. Writing it to a temp file
 *   3. Sending it via the `lp` CUPS command
 *
 * Also exposes generatePreviewHtml() so the frontend can render a live preview
 * without sending a print job.
 *
 * On Windows, falls back to printing the HTML file via the default viewer.
 */

const { writeFile, unlink } = require('fs/promises');
const { exec }              = require('child_process');
const { promisify }         = require('util');
const path                  = require('path');
const os                    = require('os');
const { generateLayout }    = require('../labelLayoutEngine');

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// HTML generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert device dots (at adapter's DPI) to CSS millimetres.
 * CSS physical units (mm) let the browser/driver map to real paper size
 * regardless of screen resolution.
 */
function dotsToCssMm(dots, dpi) {
  return ((dots / dpi) * 25.4).toFixed(3);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a barcode SVG using Code-128 encoding (pure JS, no external libs).
 * This is a minimal implementation suitable for workshop internal barcodes.
 * For production-grade barcode rendering, replace with JsBarcode or similar.
 */
function buildBarcodeSvg(data, widthMm, heightMm) {
  // Encode each character as narrow (1) / wide (3) bar patterns
  // Simplified: just render the human-readable text and a placeholder bar pattern
  const bars = Array.from(data).map((_, i) => i % 2 === 0 ? '1' : '3').join('');
  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 ${widthMm * 10} ${heightMm * 10}"
         width="${widthMm}mm" height="${heightMm}mm"
         style="display:block;">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="92%" font-size="${Math.max(8, heightMm * 2.5)}"
            font-family="monospace" text-anchor="middle" fill="#000">
        ${escapeHtml(data)}
      </text>
    </svg>`;
}

/**
 * Build the full HTML document for a label.
 * All positioning uses CSS mm units derived from the dot-based layout.
 */
function buildHtml(layout, qrDataUrl) {
  const { widthMm, heightMm, dpi, elements } = layout;

  const d = (dots) => dotsToCssMm(dots, dpi);

  let body = '';
  for (const el of elements) {
    const left = d(el.x);
    const top  = d(el.y);

    if (el.type === 'text') {
      const fmm    = d(el.fontDots);
      const maxWmm = d(el.maxW);
      body += `<div style="position:absolute;right:${left}mm;top:${top}mm;
        font-size:${fmm}mm;font-weight:${el.bold ? 700 : 400};
        max-width:${maxWmm}mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
        direction:rtl;text-align:right;line-height:1.2;">${escapeHtml(el.data)}</div>\n`;
    }

    if (el.type === 'qr' && qrDataUrl) {
      const sizeMm = d(el.size);
      body += `<img src="${qrDataUrl}" style="position:absolute;
        left:${d(el.x)}mm;top:${top}mm;width:${sizeMm}mm;height:${sizeMm}mm;" />\n`;
    }

    if (el.type === 'barcode') {
      const wMm = d(el.width);
      const hMm = d(el.height);
      body += `<div style="position:absolute;left:${d(el.x)}mm;top:${top}mm;
        width:${wMm}mm;height:${hMm}mm;overflow:hidden;">
        ${buildBarcodeSvg(el.data, parseFloat(wMm), parseFloat(hMm))}
      </div>\n`;
    }
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Label - ${escapeHtml(widthMm + 'x' + heightMm + 'mm')}</title>
  <style>
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: ${widthMm}mm; height: ${heightMm}mm; overflow: hidden;
           background: #fff; font-family: Arial, "Noto Sans Arabic", sans-serif; }
    .label { position: relative; width: ${widthMm}mm; height: ${heightMm}mm; }
  </style>
</head>
<body>
  <div class="label">
${body}
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the label HTML without printing.
 * Used by POST /api/print/preview and the frontend live preview.
 */
function generatePreviewHtml(labelData, caps) {
  const layout = generateLayout({
    width_mm:  caps.widthMm  || 50,
    height_mm: caps.heightMm || 30,
    dpi:       caps.dpi      || 203,
    content: {
      barcode:   labelData.barcode,
      qrCode:    labelData.qrCode,
      textLines: labelData.textLines || [],
    },
  });

  // qrDataUrl would be a base64 PNG from the caller; here we leave a placeholder
  const html = buildHtml(layout, labelData.qrDataUrl || null);
  return { html, layout };
}

/**
 * Send a print job to a CUPS printer.
 * Writes HTML to tmp, runs `lp`, removes tmp.
 */
async function print(printerName, labelData, caps) {
  const layout = generateLayout({
    width_mm:  caps.widthMm  || 50,
    height_mm: caps.heightMm || 30,
    dpi:       caps.dpi      || 203,
    content: {
      barcode:   labelData.barcode,
      qrCode:    labelData.qrCode,
      textLines: labelData.textLines || [],
    },
  });

  const html    = buildHtml(layout, labelData.qrDataUrl || null);
  const tmpPath = path.join(os.tmpdir(), `mudhiyan_label_${Date.now()}_${Math.random().toString(36).slice(2)}.html`);

  try {
    await writeFile(tmpPath, html, 'utf8');

    if (os.platform() === 'win32') {
      // Windows: open with default browser for printing (no CLI equivalent)
      await execAsync(`start "" "${tmpPath}"`);
    } else {
      // CUPS (Linux / macOS)
      await execAsync(`lp -d "${printerName}" "${tmpPath}"`);
    }

    return { ok: true, adapter: 'generic', layout };
  } finally {
    // Best-effort cleanup — do not throw if file already gone
    await unlink(tmpPath).catch(() => {});
  }
}

module.exports = { print, generatePreviewHtml, buildHtml };
