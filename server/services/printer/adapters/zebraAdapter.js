'use strict';

/**
 * zebraAdapter.js
 *
 * Generates ZPL II command strings and sends them to a Zebra (or any ZPL-compatible)
 * printer via:
 *   1. Direct TCP socket to port 9100 (standard raw-IP Zebra port)
 *   2. Fallback: CUPS raw queue via `lp -o raw`
 *
 * The adapter does NOT hardcode Zebra-specific features.
 * Any printer that accepts ZPL II commands on port 9100 or via a CUPS raw queue
 * is supported (Zebra, Citizen, Datamax, Bixolon, Sato, etc.).
 *
 * ZPL II reference: Zebra Programming Guide (ZPL-ZBI2-PM-EN), available on zebra.com.
 */

const net               = require('net');
const { writeFile, unlink } = require('fs/promises');
const { exec }          = require('child_process');
const { promisify }     = require('util');
const path              = require('path');
const os                = require('os');
const { generateLayout } = require('../labelLayoutEngine');

const execAsync  = promisify(exec);
const ZPL_PORT   = 9100;
const TCP_TIMEOUT_MS = 8_000;

// ─────────────────────────────────────────────────────────────────────────────
// ZPL II label generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode a string for ZPL ^FD (field data).
 * Escapes the caret (^) and tilde (~) which are ZPL control characters.
 */
function zplEscape(str) {
  return String(str ?? '').replace(/\^/g, '_').replace(/~/g, '_');
}

/**
 * Build a complete ZPL II label from a layout descriptor.
 *
 * All coordinates are in dots (device pixels at the printer's DPI).
 * The printer must be configured to the same DPI as layout.dpi.
 */
function buildZpl(layout) {
  const { widthDots, heightDots, dpi, elements } = layout;

  const lines = [
    '^XA',                          // Start of label format
    `^PW${widthDots}`,              // Print width in dots
    `^LL${heightDots}`,             // Label length in dots
    '^LH0,0',                       // Label home — origin at top-left
    '^CI28',                        // Character encoding: UTF-8
    `^MD30`,                        // Media darkness (0–30); adjust per printer
  ];

  for (const el of elements) {
    // Field Origin — x,y in dots (ZPL uses column,row order)
    lines.push(`^FO${el.x},${el.y}`);

    if (el.type === 'text') {
      // ^A0 — scalable font, orientation Normal
      // height and width in dots
      const h = Math.max(20, el.fontDots);
      const w = Math.round(h * 0.65);
      lines.push(
        `^A0N,${h},${w}`,
        `^FD${zplEscape(el.data)}^FS`,
      );
    }

    if (el.type === 'barcode') {
      // ^BY — bar code field default: module width, ratio, bar height
      const moduleW = Math.max(2, Math.round(el.width / (el.data.length * 11)));
      const barH    = el.height;
      lines.push(
        `^BY${moduleW},3,${barH}`,
        // ^BCN — Code 128 auto-subtype, Normal orientation, height, print label, no check digit
        `^BCN,${barH},Y,N,N`,
        `^FD${zplEscape(el.data)}^FS`,
      );
    }

    if (el.type === 'qr') {
      // ^BQ — QR code bar code
      // Model 2 (standard), magnification factor derived from desired dot-size
      const mag = Math.max(1, Math.min(10, Math.round(el.size / 50)));
      lines.push(
        `^BQN,2,${mag},Q,7`,
        // ^FH\ tells the firmware to interpret \& as field separator
        // QA, = high error correction level
        `^FH\\^FDQA,${zplEscape(el.data)}^FS`,
      );
    }
  }

  lines.push(
    '^PQ1,0,1,Y',   // Print quantity: 1 label, 0 pause, 1 reprint on error, cut after
    '^XZ',           // End of label format
  );

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Transmission strategies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send raw ZPL bytes over a TCP socket directly to a printer's port 9100.
 * This bypasses the OS print spooler entirely and is the fastest path.
 */
function sendViaTcp(host, zpl, port = ZPL_PORT) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let settled = false;

    function settle(fn, val) {
      if (settled) return;
      settled = true;
      sock.destroy();
      fn(val);
    }

    sock.setTimeout(TCP_TIMEOUT_MS);
    sock.connect(port, host, () => {
      sock.write(Buffer.from(zpl, 'utf8'), () => {
        // Short drain delay — some printers close the connection before ACK
        setTimeout(() => settle(resolve, { ok: true, method: 'tcp', host, port }), 200);
      });
    });
    sock.on('error',   (err) => settle(reject, err));
    sock.on('timeout', ()    => settle(reject, new Error(`TCP timeout after ${TCP_TIMEOUT_MS}ms to ${host}:${port}`)));
  });
}

/**
 * Send ZPL via a CUPS raw queue.
 * Requires the CUPS printer to be configured as a "raw" queue so it forwards
 * bytes unmodified to the printer.
 */
async function sendViaCupsRaw(printerName, zpl) {
  const tmpPath = path.join(
    os.tmpdir(),
    `mudhiyan_zpl_${Date.now()}_${Math.random().toString(36).slice(2)}.zpl`,
  );
  try {
    await writeFile(tmpPath, zpl, 'utf8');
    await execAsync(`lp -d "${printerName}" -o raw "${tmpPath}"`);
    return { ok: true, method: 'cups_raw', printer: printerName };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/**
 * Attempt to extract the printer's IP address from its CUPS device URI.
 * Handles: socket://192.168.1.10:9100 and ipp://192.168.1.10/...
 * Returns null when running on Windows or when CUPS is unavailable.
 */
async function resolveDeviceIp(printerName) {
  if (os.platform() === 'win32') return null;
  try {
    const { stdout } = await execAsync(`lpoptions -p "${printerName}" 2>/dev/null`);
    const m = stdout.match(/device-uri=(?:socket|ipp):\/\/([0-9A-Za-z.\-]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a label to a ZPL-capable printer.
 *
 * Strategy:
 *   1. Resolve the printer's IP from CUPS → attempt direct TCP on port 9100.
 *   2. If no IP or TCP fails → fall back to CUPS raw queue.
 *   3. If CUPS also fails → throw with a descriptive error.
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

  const zpl = buildZpl(layout);

  // Strategy 1: direct TCP (fastest, no spooler involved)
  const ip = await resolveDeviceIp(printerName);
  if (ip) {
    try { return await sendViaTcp(ip, zpl); }
    catch (tcpErr) {
      // TCP failed — fall through to CUPS
      console.warn(`[zebraAdapter] TCP to ${ip}:${ZPL_PORT} failed (${tcpErr.message}), trying CUPS raw`);
    }
  }

  // Strategy 2: CUPS raw queue
  try { return await sendViaCupsRaw(printerName, zpl); }
  catch (cupsErr) {
    throw new Error(
      `ZPL print failed for printer "${printerName}": ${cupsErr.message}. ` +
      `Ensure the printer is reachable and the CUPS queue is configured as a raw queue.`,
    );
  }
}

module.exports = { print, buildZpl, sendViaTcp };
