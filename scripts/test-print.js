#!/usr/bin/env node
'use strict';

/**
 * test-print.js
 *
 * Manual test script for the universal label printer layer.
 * Run from the repo root:
 *
 *   node scripts/test-print.js
 *   node scripts/test-print.js --printer "Brother QL-820NWB" --print
 *
 * Flags:
 *   --printer <name>   Use a specific printer (otherwise shows list + exits)
 *   --print            Actually send a print job (default: preview only)
 *   --width <mm>       Override label width in mm   (default: auto-detected)
 *   --height <mm>      Override label height in mm  (default: auto-detected)
 */

const path = require('path');

// Resolve modules relative to the server directory
const serverDir = path.join(__dirname, '..', 'server');
const {
  getAvailablePrinters,
  getPrinterCapabilities,
  printLabel,
  generatePreview,
} = require(path.join(serverDir, 'services', 'printer', 'printerManager'));

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}
const PRINTER_NAME   = argValue('--printer');
const SHOULD_PRINT   = args.includes('--print');
const WIDTH_OVERRIDE = argValue('--width')  ? parseFloat(argValue('--width'))  : null;
const HEIGHT_OVERRIDE= argValue('--height') ? parseFloat(argValue('--height')) : null;

// ── Sample label data ─────────────────────────────────────────────────────────
const SAMPLE_LABEL = {
  barcode:   'WRK-20260419-0001',
  qrCode:    'WRK-20260419-0001',
  textLines: [
    'خاتم ذهب',
    'أحمد محمد',
    '0501234567',
    'إصلاح وتلميع',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

function hr() { console.log('─'.repeat(60)); }

async function main() {
  hr();
  console.log('mudhiyan-workshop — Universal Label Printer Test');
  hr();

  // 1. Detect printers
  console.log('\n▸ Detecting printers…');
  const printers = await getAvailablePrinters();

  if (printers.length === 0) {
    console.log('  No printers found (CUPS not available or no printers registered).\n');
  } else {
    console.log(`  Found ${printers.length} printer(s):`);
    printers.forEach((p, i) => console.log(`    ${i + 1}. ${p.name}`));
  }

  // 2. If no --printer flag, just show the list and exit
  if (!PRINTER_NAME) {
    if (printers.length > 0) {
      console.log('\n  Run with --printer "<name>" to test a specific printer.');
      console.log('  Add --print to actually send the job.\n');
    }
    hr();
    return;
  }

  // 3. Resolve capabilities for the chosen printer
  console.log(`\n▸ Capabilities for: ${PRINTER_NAME}`);
  const caps = await getPrinterCapabilities(PRINTER_NAME);

  // Apply optional overrides
  if (WIDTH_OVERRIDE)  caps.widthMm  = WIDTH_OVERRIDE;
  if (HEIGHT_OVERRIDE) caps.heightMm = HEIGHT_OVERRIDE;

  console.log(`  Adapter  : ${caps.adapter}`);
  console.log(`  Label    : ${caps.widthMm}mm × ${caps.heightMm}mm`);
  console.log(`  DPI      : ${caps.dpi}`);

  // 4. Generate preview HTML (always)
  console.log('\n▸ Generating HTML preview…');
  const { html, layout } = generatePreview(SAMPLE_LABEL, caps);
  console.log(`  Layout   : ${layout.widthDots}×${layout.heightDots} dots  (scale ${layout.scale.toFixed(3)})`);
  console.log(`  Elements : ${layout.elements.length}`);
  layout.elements.forEach(el =>
    console.log(`    • ${el.type.padEnd(8)} @ (${el.x}, ${el.y})`),
  );
  console.log(`  HTML     : ${html.length} chars`);

  // 5. Optionally send a real print job
  if (SHOULD_PRINT) {
    console.log(`\n▸ Sending print job to "${PRINTER_NAME}"…`);
    try {
      const result = await printLabel(PRINTER_NAME, SAMPLE_LABEL, caps);
      console.log('  Result:', JSON.stringify(result));
      console.log('\n  ✅ Print job sent successfully.');
    } catch (err) {
      console.error(`\n  ❌ Print failed: ${err.message}`);
      process.exitCode = 1;
    }
  } else {
    console.log('\n  (Dry run — add --print to send the job.)');
  }

  hr();
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
