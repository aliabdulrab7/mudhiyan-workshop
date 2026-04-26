import { useRef, useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";
import { useSettings } from "../contexts/SettingsContext";
import Button from "./ui/Button";
import Select from "./ui/Select";

// Base design-canvas (NIIMBOT B21S @ 203 DPI): 400×240 px = 50×30 mm.
// All draw code below is expressed in these base coordinates. A `fit` transform
// scales + centers the base box onto the actual canvas, so any mm size works.
const BASE_W = 400;
const BASE_H = 240;
const PAD = 40;
const DPI_PX_PER_MM = 8; // 400px / 50mm

// Label sizes for universal (browser) printing.
// mm values drive @page size + canvas pixel dimensions.
const LABEL_SIZES = [
  { id: '50x30',   label: '50×30 مم ()',  w: 50,  h: 30  },
  { id: '57x32',   label: '57×32 مم',           w: 57,  h: 32  },
  { id: '80x50',   label: '80×50 مم',           w: 80,  h: 50  },
  { id: '100x50',  label: '100×50 مم',          w: 100, h: 50  },
  { id: '100x100', label: '100×100 مم (شحن)',   w: 100, h: 100 },
  { id: 'a4',      label: 'A4 (ورقة عادية)',     w: 210, h: 297 },
];
const SIZE_STORAGE_KEY = 'label_size_preset';

// Pixel dimensions for a given label size (at 8 px/mm).
// Capped max pixel count to avoid huge canvases on A4 (still reads crisp on print).
function canvasPxForSize(size) {
  const cap = 12; // px/mm cap on larger labels
  const dpi = size.w > 100 || size.h > 100 ? cap : DPI_PX_PER_MM;
  return { w: Math.round(size.w * dpi), h: Math.round(size.h * dpi) };
}

// Fit the BASE_W×BASE_H design box onto the real canvas, preserving aspect + centering.
// After this call, draw code can use base coordinates directly.
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

/**
 * ── Customer label ── (QR for tracking)
 * All coordinates are in the BASE_W×BASE_H design space; fitCanvas handles scale.
 */
async function drawCustomerLabel(canvas, order) {
  const ctx = fitCanvas(canvas);
  const W = BASE_W, H = BASE_H;

  // Header — Brand
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 20px Almarai, Arial';
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("مجوهرات سليمان المضيان", W - PAD, PAD + 25);

  // Order number
  ctx.fillStyle = "#374151";
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(order.order_number, W - PAD, PAD + 50);

  // Separator
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 60);
  ctx.lineTo(W - PAD, PAD + 60);
  ctx.stroke();

  // Tracking QR code (left)
  try {
    const trackUrl = `${window.location.origin}/track/${order.customer_token}`;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, trackUrl, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: "L",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas, PAD, PAD + 62, 132, 132);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = "#6B7280";
    ctx.font = "9px Almarai, Arial";
    ctx.textAlign = "left";
    ctx.fillText("امسح لمتابعة الطلب", PAD, PAD + 206);
  } catch (e) {
    console.error("Customer QR failed", e);
  }

  // Instruction (right column)
  ctx.fillStyle = "#111111";
  ctx.font = "bold 14px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("بطاقة المتابعة", W - PAD, PAD + 84);

  ctx.fillStyle = "#4B5563";
  ctx.font = "11px Almarai, Arial";
  ctx.fillText("عزيزنا العميل، يمكنك", W - PAD, PAD + 105);
  ctx.fillText("متابعة حالة مجوهراتك", W - PAD, PAD + 120);
  ctx.fillText("عن طريق مسح الرمز", W - PAD, PAD + 135);
}

/**
 * ── Workshop label ── (internal ID + CODE128 barcode for scan-tracking)
 * Base coords BASE_W×BASE_H; fitCanvas scales to any canvas size.
 */
async function drawWorkshopLabel(canvas, order) {
  const ctx = fitCanvas(canvas);
  const W = BASE_W, H = BASE_H;

  // Shop name
  ctx.fillStyle = "#059669";
  ctx.font = "bold 14px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(order.shop_name || "الورشة المركزية", W - PAD, PAD + 18);

  // Urgency stamp (red pill on the left)
  if (order.is_urgent) {
    const pillW = 70, pillH = 20;
    const px = PAD, py = PAD + 4;
    ctx.fillStyle = "#DC2626";
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + pillW - r, py);
    ctx.quadraticCurveTo(px + pillW, py, px + pillW, py + r);
    ctx.lineTo(px + pillW, py + pillH - r);
    ctx.quadraticCurveTo(px + pillW, py + pillH, px + pillW - r, py + pillH);
    ctx.lineTo(px + r, py + pillH);
    ctx.quadraticCurveTo(px, py + pillH, px, py + pillH - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px Almarai, Arial";
    ctx.textAlign = "center";
    ctx.fillText("مستعجل", px + pillW / 2, py + 14);
    ctx.textAlign = "right";
  }

  // Separator
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 26);
  ctx.lineTo(W - PAD, PAD + 26);
  ctx.stroke();

  // Customer Info
  ctx.fillStyle = "#111111";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.fillText(order.customer_name, W - PAD, PAD + 44);
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = "#374151";
  ctx.fillText(order.phone, W - PAD, PAD + 58);

  // Items summary (one line)
  const items = order?.items || [];
  if (items.length) {
    const names = items.map(x => x.item_name).join("، ");
    let line = `${items.length} قطع: ${names}`;
    ctx.font = "9px Almarai, Arial";
    ctx.fillStyle = "#4B5563";
    const maxW = W - PAD * 2;
    while (ctx.measureText(line).width > maxW && line.length > 5) {
      line = line.slice(0, -1) + "…";
    }
    ctx.fillText(line, W - PAD, PAD + 72);
  }

  // CODE128 Barcode (bottom, fit-to-width, centered)
  try {
    const bcCanvas = document.createElement("canvas");
    JsBarcode(bcCanvas, order.order_number, {
      format: "CODE128",
      displayValue: true,
      font: "JetBrains Mono, monospace",
      fontSize: 13,
      fontOptions: "bold",
      textMargin: 1,
      width: 1.8,
      height: 50,
      margin: 0,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const maxW = W - PAD * 2;
    const scale = Math.min(1, maxW / bcCanvas.width);
    const drawW = bcCanvas.width * scale;
    const drawH = bcCanvas.height * scale;
    const x = (W - drawW) / 2;
    const y = H - PAD - drawH + 10;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bcCanvas, x, y, drawW, drawH);
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

export default function LabelCanvas({ order, autoPrint = false }) {
  const customerRef = useRef(null);
  const shopRef = useRef(null);
  const autoPrintedOrderRef = useRef(null);
  const [ready, setReady] = useState(false);
  const { settings, ensureLoaded } = useSettings() || {};
  useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
  const [sizeId, setSizeId] = useState(() => {
    try { return localStorage.getItem(SIZE_STORAGE_KEY) || '50x30'; } catch (_) { return '50x30'; }
  });
  // Adopt the server-side default once settings finishes loading. Local overrides
  // via the in-canvas selector are kept (localStorage write below) and survive
  // until the user changes the server default again.
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
    connect,
    printAll,
    disconnect,
    isConnected,
    isPrinting,
    error: btError,
    printerMeta,
    lastPrintMeta,
    supportsSerial,
  } = useLabelPrint();

  const getPrintableCanvases = useCallback(
    () => [customerRef.current, shopRef.current].filter(Boolean).slice(0, 2),
    []
  );

  useEffect(() => {
    if (!order) return;
    setReady(false);
    autoPrintedOrderRef.current = null;

    const px = canvasPxForSize(size);

    const draw = async () => {
      try {
        if (customerRef.current) {
          customerRef.current.width = px.w;
          customerRef.current.height = px.h;
          await drawCustomerLabel(customerRef.current, order);
        }
        if (shopRef.current) {
          shopRef.current.width = px.w;
          shopRef.current.height = px.h;
          await drawWorkshopLabel(shopRef.current, order);
        }
        setReady(true);
      } catch (err) {
        console.error("Label draw failed", err);
        setReady(true);
      }
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(draw);
    } else {
      draw();
    }
  }, [order, size.id]);

  // Auto-print Once (Niimbot only, native size only)
  useEffect(() => {
    if (!autoPrint || !order?.id || !ready || !isConnected || isPrinting) return;
    if (sizeId !== '50x30') return;
    if (autoPrintedOrderRef.current === order.id) return;

    autoPrintedOrderRef.current = order.id;
    printAll(getPrintableCanvases(), { copiesPerCanvas: 1, maxLabels: 2 });
  }, [autoPrint, order?.id, ready, isConnected, isPrinting, printAll, getPrintableCanvases, sizeId]);

  const handlePrint = useCallback(() => {
    if (ready && isConnected) {
      printAll(getPrintableCanvases(), { copiesPerCanvas: 1, maxLabels: 2 });
    }
  }, [ready, isConnected, printAll, getPrintableCanvases]);

  // Universal print: opens OS print dialog for any printer (label or regular).
  // Uses @page size so the printer driver sizes the label correctly.
  const handleUniversalPrint = useCallback(() => {
    if (!ready) return;
    const customer = customerRef.current?.toDataURL('image/png');
    const shop = shopRef.current?.toDataURL('image/png');
    if (!customer || !shop) return;

    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;

    const { w, h } = size;
    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>طباعة ملصقات ${order.order_number}</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet {
    width: ${w}mm; height: ${h}mm;
    display: flex; align-items: center; justify-content: center;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .sheet img {
    max-width: 100%; max-height: 100%;
    image-rendering: pixelated;
  }
  @media screen {
    body { padding: 16px; display: flex; flex-direction: column; gap: 12px; align-items: center; font-family: system-ui, sans-serif; }
    .sheet { border: 1px dashed #ccc; }
    .hint { font-size: 12px; color: #666; }
  }
  @media print { .hint { display: none; } }
</style>
</head>
<body>
  <div class="hint">إذا لم تبدأ الطباعة تلقائياً، استخدم Ctrl/Cmd + P</div>
  <div class="sheet"><img src="${customer}" alt="customer" /></div>
  <div class="sheet"><img src="${shop}" alt="shop" /></div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }, [ready, size, order]);

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Label previews — preview scales to true aspect ratio; max 180px on longer edge */}
      {(() => {
        const aspect = size.w / size.h; // w/h ratio in mm (same as px)
        const MAX = 180;
        const pvW = aspect >= 1 ? MAX : Math.round(MAX * aspect);
        const pvH = aspect >= 1 ? Math.round(MAX / aspect) : MAX;
        return (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            {[
              { ref: customerRef, title: "ملصق العميل" },
              { ref: shopRef,     title: "ملصق الورشة" },
            ].map(({ ref, title }) => (
              <div key={title}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "6px", textAlign: "center" }}>
                  {title}
                </div>
                <div style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  display: "inline-block",
                  opacity: ready ? 1 : 0.4,
                  transition: "opacity 0.3s",
                }}>
                  <canvas
                    ref={ref}
                    style={{ display: "block", width: `${pvW}px`, height: `${pvH}px` }}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {!ready && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "10px" }}>
          ⟳ جاري توليد الملصق...
        </div>
      )}

      {/* Label size selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>مقاس الملصق:</label>
        <Select
          value={sizeId}
          onChange={e => setSizeId(e.target.value)}
          options={LABEL_SIZES.map(s => ({ value: s.id, label: s.label }))}
          style={{ minWidth: 180 }}
          testId="label-canvas__size-select"
        />
      </div>

      {/* Print controls */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Universal browser print — works with any OS-installed printer */}
        <Button
          variant="gold"
          disabled={!ready}
          onClick={handleUniversalPrint}
          title="طباعة عبر المتصفح — تدعم أي طابعة مثبتة في النظام"
          testId="label-canvas__universal-print"
        >
          طباعة
        </Button>

        {/* Niimbot B21 direct path — only valid at the printer's native 50×30 */}
        {bluetoothAvailable && sizeId === '50x30' && (
          !isConnected ? (
            <>
              <Button variant="ghost" onClick={() => connect('bluetooth')} testId="label-canvas__connect-bluetooth">: بلوتوث</Button>
              {supportsSerial && (
                <Button variant="ghost" onClick={() => connect('serial')} testId="label-canvas__connect-usb">: USB-C</Button>
              )}
            </>
          ) : (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16A34A", fontSize: "0.83rem" }}>
                <span className="pulse-gold" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                متصل {printerMeta?.transport === 'serial' ? 'USB' : 'Bluetooth'}
              </span>
              <Button
                variant="ghost"
                disabled={isPrinting || !ready}
                onClick={handlePrint}
                testId="label-canvas__niimbot-print"
              >
                {isPrinting ? "جاري الطباعة..." : "طباعة "}
              </Button>
              {isPrinting && (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}
                  onClick={disconnect}
                  testId="label-canvas__abort"
                >
                  ⚠ إيقاف
                </Button>
              )}
              {!isPrinting && <Button variant="ghost" size="sm" onClick={disconnect} testId="label-canvas__disconnect">قطع الاتصال</Button>}
            </>
          )
        )}
      </div>

      {(!bluetoothAvailable || sizeId !== '50x30') && (
        <div style={{
          marginTop: 8,
          fontSize: "0.76rem",
          color: "var(--text-muted)",
        }}>
          {!bluetoothAvailable
            ? ' المباشر يتطلب Chrome/Edge مع بلوتوث — استخدم زر "طباعة (أي طابعة)" بدلاً من ذلك.'
            : ' B21 يدعم مقاس 50×30 مم فقط — لأي مقاس آخر استخدم "طباعة (أي طابعة)".'}
        </div>
      )}

      {btError && (
        <div style={{ marginTop: "10px", color: "#DC2626", fontSize: "0.82rem", padding: "8px 12px", background: "rgba(220,38,38,0.06)", borderRadius: "var(--radius)", border: "1px solid rgba(220,38,38,0.15)" }}>
          {btError}
        </div>
      )}

      {(printerMeta || lastPrintMeta) && (
        <div style={{ marginTop: "10px", padding: "10px 12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "var(--radius)", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {printerMeta && (
            <div>
              {`النقل: ${printerMeta.transport || '-'} | الجهاز: ${printerMeta.deviceName || '-'} | الموديل: ${printerMeta.model || printerMeta.modelId || '-'} | البروتوكول: ${printerMeta.protocolVersion ?? '-'} | المهمة: ${printerMeta.taskType || '-'} | interval: ${printerMeta.packetIntervalMs}ms`}
            </div>
          )}
          {lastPrintMeta && (
            <div>
              {`آخر طباعة: ${lastPrintMeta.ok ? 'نجحت' : 'فشلت'} | الزمن: ${lastPrintMeta.durationMs}ms | الصفحات: ${lastPrintMeta.totalPages} | المهمة: ${lastPrintMeta.taskType || '-'}${lastPrintMeta.error ? ` | الخطأ: ${lastPrintMeta.error}` : ''}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
