import { useRef, useEffect, useState, useCallback } from "react";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";
import { useSettings } from "../contexts/SettingsContext";
import Button from "./ui/Button";

// Base design-canvas (NIIMBOT B21S @ 203 DPI): 400×240 px = 50×30 mm.
// Drawing uses base coords; fitCanvas scales/centers onto the real canvas.
const BASE_W = 400;
const BASE_H = 240;
const PAD = 40;
const DPI_PX_PER_MM = 8;

const LABEL_SIZES = [
  { id: '50x30',   label: '50×30 مم ()',  w: 50,  h: 30  },
  { id: '57x32',   label: '57×32 مم',           w: 57,  h: 32  },
  { id: '80x50',   label: '80×50 مم',           w: 80,  h: 50  },
  { id: '100x50',  label: '100×50 مم',          w: 100, h: 50  },
  { id: '100x100', label: '100×100 مم (شحن)',   w: 100, h: 100 },
  { id: 'a4',      label: 'A4 (ورقة عادية)',     w: 210, h: 297 },
];
const SIZE_STORAGE_KEY = 'label_size_preset';

function canvasPxForSize(size) {
  const dpi = size.w > 100 || size.h > 100 ? 12 : DPI_PX_PER_MM;
  return { w: Math.round(size.w * dpi), h: Math.round(size.h * dpi) };
}

function fitCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / BASE_W, H / BASE_H);
  const ox = (W - BASE_W * s) / 2;
  const oy = (H - BASE_H * s) / 2;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  return ctx;
}

function drawReadyLabel(canvas, order) {
  const ctx = fitCanvas(canvas);
  const W = BASE_W, H = BASE_H;

  // Row 1: READY badge + Customer name
  ctx.fillStyle = "#059669";
  ctx.font = "bold 16px Almarai, Arial";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("✓ READY", PAD, PAD + 18);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 14px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  const maxNameW = W - PAD * 2 - 90;
  let name = order.customer_name || '';
  while (ctx.measureText(name).width > maxNameW && name.length > 2) name = name.slice(0, -1);
  if (name !== (order.customer_name || '')) name += '…';
  ctx.fillText(name, W - PAD, PAD + 18);

  // Separator
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 28);
  ctx.lineTo(W - PAD, PAD + 28);
  ctx.stroke();

  // Phone (optional, small)
  if (order.phone) {
    ctx.fillStyle = "#374151";
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.direction = "ltr";
    ctx.fillText(order.phone, W - PAD, PAD + 44);
  }

  // CODE128 Barcode (bottom, fit-to-width, centered, with text)
  try {
    const bc = document.createElement("canvas");
    JsBarcode(bc, order.order_number, {
      format: "CODE128",
      displayValue: true,
      font: "JetBrains Mono, monospace",
      fontSize: 14,
      fontOptions: "bold",
      textMargin: 2,
      width: 2,
      height: 60,
      margin: 0,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const maxW = W - PAD * 2;
    const scale = Math.min(1, maxW / bc.width);
    const drawW = bc.width * scale;
    const drawH = bc.height * scale;
    const x = (W - drawW) / 2;
    const y = H - PAD - drawH + 14;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bc, x, y, drawW, drawH);
    ctx.imageSmoothingEnabled = true;
  } catch (e) {
    console.error("Barcode draw failed", e);
    ctx.fillStyle = "#111111";
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(order.order_number, W / 2, H - PAD - 10);
  }
}

export default function ReadyLabelCanvas({ order, autoPrint = false }) {
  const labelRef = useRef(null);
  const autoPrintedOrderRef = useRef(null);
  const [ready, setReady] = useState(false);
  const { settings, ensureLoaded } = useSettings() || {};
  useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
  const [sizeId, setSizeId] = useState(() => {
    try { return localStorage.getItem(SIZE_STORAGE_KEY) || '50x30'; } catch (_) { return '50x30'; }
  });
  const serverDefault = settings?.default_label_preset;
  useEffect(() => {
    if (serverDefault && LABEL_SIZES.some(s => s.id === serverDefault)) {
      setSizeId(serverDefault);
    }
  }, [serverDefault]);
  const size = LABEL_SIZES.find(s => s.id === sizeId) || LABEL_SIZES[0];
  useEffect(() => {
    try { localStorage.setItem(SIZE_STORAGE_KEY, sizeId); } catch (_) {}
  }, [sizeId]);

  const {
    connect, printAll, disconnect,
    isConnected, isPrinting,
    error: btError, printerMeta, lastPrintMeta, supportsSerial,
  } = useLabelPrint();

  useEffect(() => {
    if (!order || !labelRef.current) return;
    setReady(false);
    autoPrintedOrderRef.current = null;
    const px = canvasPxForSize(size);
    labelRef.current.width = px.w;
    labelRef.current.height = px.h;
    Promise.resolve().then(() => {
      drawReadyLabel(labelRef.current, order);
      setReady(true);
    });
  }, [order, size.id]);

  useEffect(() => {
    if (!autoPrint || !order?.id || !ready || !isConnected || isPrinting || !labelRef.current) return;
    if (sizeId !== '50x30') return;
    if (autoPrintedOrderRef.current === order.id) return;
    autoPrintedOrderRef.current = order.id;
    printAll([labelRef.current], { copiesPerCanvas: 1, maxLabels: 1 });
  }, [autoPrint, order?.id, ready, isConnected, isPrinting, printAll, sizeId]);

  const handleUniversalPrint = useCallback(() => {
    if (!ready || !labelRef.current) return;
    const img = labelRef.current.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=480,height=480');
    if (!win) return;
    const { w, h } = size;
    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"/><title>طباعة ${order.order_number}</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet { width: ${w}mm; height: ${h}mm; display: flex; align-items: center; justify-content: center; }
  .sheet img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
  @media screen {
    body { padding: 16px; display: flex; flex-direction: column; gap: 12px; align-items: center; font-family: system-ui, sans-serif; }
    .sheet { border: 1px dashed #ccc; }
    .hint { font-size: 12px; color: #666; }
  }
  @media print { .hint { display: none; } }
</style></head>
<body>
  <div class="hint">إذا لم تبدأ الطباعة تلقائياً، استخدم Ctrl/Cmd + P</div>
  <div class="sheet"><img src="${img}" alt="ready"/></div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); });
    window.onafterprint = function () { window.close(); };
  </script>
</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }, [ready, size, order]);

  if (!order) return null;

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;
  const aspect = size.w / size.h;
  const MAX = 200;
  const pvW = aspect >= 1 ? MAX : Math.round(MAX * aspect);
  const pvH = aspect >= 1 ? Math.round(MAX / aspect) : MAX;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
      {/* Preview */}
      <div style={{
        border: "1px solid #E5E7EB", borderRadius: "var(--radius)",
        overflow: "hidden", background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        opacity: ready ? 1 : 0.4, transition: "opacity 0.3s",
      }}>
        <canvas ref={labelRef} style={{ display: "block", width: `${pvW}px`, height: `${pvH}px` }} />
      </div>

      {/* Size selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 320 }}>
        <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>المقاس:</label>
        <select
          className="select"
          value={sizeId}
          onChange={e => setSizeId(e.target.value)}
          style={{ flex: 1, height: 30, fontSize: "0.82rem" }}
          data-testid="ready-label-canvas__size-select"
        >
          {LABEL_SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Print buttons */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 320, flexWrap: "wrap" }}>
        <Button
          variant="gold"
          disabled={!ready}
          onClick={handleUniversalPrint}
          className="flex-1 justify-center"
          title="طباعة عبر المتصفح — تدعم أي طابعة"
          testId="ready-label-canvas__universal-print"
        >
          طباعة
        </Button>

        {bluetoothAvailable && sizeId === '50x30' && (
          !isConnected ? (
            <>
              <Button variant="ghost" onClick={() => connect('bluetooth')} disabled={isPrinting} testId="ready-label-canvas__connect-bluetooth">
                بلوتوث
              </Button>
              {supportsSerial && (
                <Button variant="ghost" onClick={() => connect('serial')} disabled={isPrinting} testId="ready-label-canvas__connect-usb">
                  USB-C
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => printAll([labelRef.current], { copiesPerCanvas: 1, maxLabels: 1 })}
                disabled={isPrinting || !ready}
                testId="ready-label-canvas__niimbot-print"
              >
                {isPrinting ? "..." : ""}
              </Button>
              <Button variant="ghost" onClick={disconnect} disabled={isPrinting} title="قطع الاتصال" testId="ready-label-canvas__disconnect">✖</Button>
            </>
          )
        )}
      </div>

      {(!bluetoothAvailable || sizeId !== '50x30') && (
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
          {!bluetoothAvailable
            ? ' يتطلب Chrome/Edge مع بلوتوث.'
            : ' B21 يدعم مقاس 50×30 مم فقط.'}
        </div>
      )}

      {btError && (
        <div style={{ fontSize: "0.8rem", color: "#DC2626", maxWidth: 320 }}>{btError}</div>
      )}

      {(printerMeta || lastPrintMeta) && (
        <div style={{
          fontSize: "0.76rem", color: "var(--text-secondary)",
          maxWidth: 320, lineHeight: 1.7,
          background: "#F9FAFB", border: "1px solid #E5E7EB",
          borderRadius: "var(--radius)", padding: "10px 12px",
        }}>
          {printerMeta && (
            <div>{`النقل: ${printerMeta.transport || '-'} | الجهاز: ${printerMeta.deviceName || '-'} | الموديل: ${printerMeta.model || printerMeta.modelId || '-'}`}</div>
          )}
          {lastPrintMeta && (
            <div>{`آخر طباعة: ${lastPrintMeta.ok ? 'نجحت' : 'فشلت'} | ${lastPrintMeta.durationMs}ms${lastPrintMeta.error ? ` | ${lastPrintMeta.error}` : ''}`}</div>
          )}
        </div>
      )}
    </div>
  );
}
