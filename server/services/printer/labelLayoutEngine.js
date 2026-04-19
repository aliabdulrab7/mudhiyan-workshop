'use strict';

/**
 * labelLayoutEngine.js
 *
 * Generates a device-independent label layout from content + physical dimensions.
 * Output coordinates are in device dots at the given DPI.
 * Adapters (HTML, ZPL, etc.) translate these to their own coordinate systems.
 *
 * Supports any label size — does NOT hardcode any dimensions.
 * Layout scales proportionally from content density and available space.
 */

const MM_PER_INCH = 25.4;

/** Convert millimetres → device dots at the given DPI. */
function mmToDots(mm, dpi) {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/**
 * Compute proportional margin:
 *   5% of the shorter label dimension, clamped to [2mm, 6mm].
 */
function calcMarginMm(widthMm, heightMm) {
  const shorter = Math.min(widthMm, heightMm);
  return Math.max(2, Math.min(6, shorter * 0.05));
}

/**
 * generateLayout({ width_mm, height_mm, dpi, content }) → layout
 *
 * content shape:
 *   { qrCode?: string, barcode?: string, textLines?: string[] }
 *
 * layout shape:
 *   { widthDots, heightDots, margin, dpi, widthMm, heightMm, elements[] }
 *
 * element types:
 *   { type:'text',    data, x, y, fontDots, bold, maxW }
 *   { type:'barcode', data, x, y, width, height }
 *   { type:'qr',      data, x, y, size }
 */
function generateLayout({ width_mm, height_mm, dpi = 203, content = {} }) {
  if (!width_mm || !height_mm || width_mm <= 0 || height_mm <= 0) {
    throw new Error('width_mm and height_mm must be positive numbers');
  }
  if (!dpi || dpi <= 0) throw new Error('dpi must be a positive number');

  const widthDots  = mmToDots(width_mm,  dpi);
  const heightDots = mmToDots(height_mm, dpi);
  const marginMm   = calcMarginMm(width_mm, height_mm);
  const margin     = mmToDots(marginMm, dpi);

  const usableW = widthDots  - margin * 2;
  const usableH = heightDots - margin * 2;

  // Scale factor relative to 50×30mm baseline (400×240px @ 203dpi)
  const BASELINE_W = mmToDots(50, 203) - 80;  // usable width at baseline
  const BASELINE_H = mmToDots(30, 203) - 80;  // usable height at baseline
  const scale      = Math.min(usableW / BASELINE_W, usableH / BASELINE_H);

  const elements = [];
  const hasQr      = !!content.qrCode;
  const hasBarcode  = !!content.barcode;
  const textLines   = (content.textLines || []).slice(0, 8);

  // ── QR code ──────────────────────────────────────────────────────────────
  // Square. If barcode also present, occupy the right column; else full height.
  if (hasQr) {
    const maxQrFrac = hasBarcode ? 0.45 : 0.6;
    const qrSize    = Math.round(Math.min(usableW * maxQrFrac, usableH * 0.90));
    const qrX       = hasBarcode
      ? widthDots - margin - qrSize   // right column
      : margin;                        // left side
    const qrY       = margin + Math.round((usableH - qrSize) / 2);

    elements.push({ type: 'qr', data: content.qrCode, x: qrX, y: qrY, size: qrSize });
  }

  // ── Barcode ───────────────────────────────────────────────────────────────
  // Horizontal band at the bottom.
  if (hasBarcode) {
    const barH = Math.round(usableH * 0.25);
    const barW = hasQr ? Math.round(usableW * 0.52) : usableW;
    const barX = margin;
    const barY = heightDots - margin - barH;

    elements.push({
      type: 'barcode', data: content.barcode,
      x: barX, y: barY, width: barW, height: barH,
    });
  }

  // ── Text lines ────────────────────────────────────────────────────────────
  // Stacked from the top of the usable area.
  // If QR is on the left, text goes in the remaining right column; else full width.
  const textAreaW = (hasQr && !hasBarcode)
    ? Math.round(usableW * 0.52)
    : (hasQr && hasBarcode ? Math.round(usableW * 0.52) : usableW);

  const textX         = hasQr ? widthDots - margin - textAreaW : margin;
  const baseFontDots  = Math.round(Math.max(10, 14 * scale));
  const lineSpacing   = Math.round(baseFontDots * 1.55);

  textLines.forEach((text, idx) => {
    const isFirst  = idx === 0;
    const fontDots = isFirst ? Math.round(baseFontDots * 1.2) : baseFontDots;
    elements.push({
      type:      'text',
      data:      String(text),
      x:         textX,
      y:         margin + idx * lineSpacing,
      fontDots,
      bold:      isFirst,
      maxW:      textAreaW,
    });
  });

  return {
    widthDots,
    heightDots,
    margin,
    dpi,
    scale,
    widthMm:  width_mm,
    heightMm: height_mm,
    elements,
  };
}

module.exports = { generateLayout, mmToDots };
