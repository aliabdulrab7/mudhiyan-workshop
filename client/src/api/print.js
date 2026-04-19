import { getToken } from './auth';

const BASE = '/api/print';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Fetch all OS-registered printers. Returns [{ name }] */
export async function getPrinters() {
  const res = await fetch(`${BASE}/printers`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل قائمة الطابعات');
  const data = await res.json();
  return data.printers;
}

/** Fetch capabilities for a single printer. */
export async function getPrinterCapabilities(printerName) {
  const res = await fetch(
    `${BASE}/printers/${encodeURIComponent(printerName)}/capabilities`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error('فشل تحميل إمكانيات الطابعة');
  return res.json();
}

/**
 * Send a print job.
 * @param {string} printerName
 * @param {{ barcode?, qrCode?, textLines?, qrDataUrl? }} labelData
 * @param {object} [caps] — optional caps override (skip server re-detection)
 */
export async function printLabel(printerName, labelData, caps) {
  const res = await fetch(`${BASE}/label`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ printerName, labelData, caps }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل الطباعة');
  return data;
}

/**
 * Fetch HTML preview for a label (no print job).
 * Returns { html, layout }
 */
export async function getPreview(labelData, caps) {
  const res = await fetch(`${BASE}/preview`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ labelData, caps }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء المعاينة');
  return data;
}
