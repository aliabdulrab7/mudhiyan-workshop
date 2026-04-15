import { useRef, useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import useLabelPrint from "./useLabelPrint";

// NIIMBOT B21S — 5cm × 3cm label @ 203 DPI
// Canvas: 400 × 240 px
// Safe zone (40px all sides): x[40..360] y[40..200] → 320 × 160 px usable
const W = 400;
const H = 240;
const PAD = 40;

/**
 * ── Customer label ──
 * qr_content: customer_tracking_url
 */
async function drawCustomerLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Header — Brand ──
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 20px Almarai, Arial';
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("مجوهرات سليمان المضيان", W - PAD, PAD + 25);

  // ── Order number ──
  ctx.fillStyle = "#374151";
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(order.order_number, W - PAD, PAD + 50);

  // ── Separator ──
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 60);
  ctx.lineTo(W - PAD, PAD + 60);
  ctx.stroke();

  // ── Tracking QR code (Left) ──
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
    ctx.direction = "rtl";
    ctx.fillText("امسح لمتابعة الطلب", PAD, PAD + 206);
  } catch (e) {
    console.error("Customer QR failed", e);
  }

  // ── Instruction ──
  ctx.fillStyle = "#111111";
  ctx.font = "bold 14px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("بطاقة المتابعة", W - PAD, PAD + 84);

  ctx.fillStyle = "#4B5563";
  ctx.font = "11px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("عزيزنا العميل، يمكنك", W - PAD, PAD + 105);
  ctx.fillText("متابعة حالة مجوهراتك", W - PAD, PAD + 120);
  ctx.fillText("عن طريق مسح الرمز", W - PAD, PAD + 135);
}

/**
 * ── Workshop label ──
 * Purpose: internal workshop identification with items summary
 */
async function drawWorkshopLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Status/Source ──
  ctx.fillStyle = "#059669";
  ctx.font = "bold 16px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(order.shop_name || "الورشة المركزية", W - PAD, PAD + 25);

  // ── Order Number ──
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, PAD, PAD + 25);

  // ── Separator ──
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 40);
  ctx.lineTo(W - PAD, PAD + 40);
  ctx.stroke();

  // ── Customer Info ──
  ctx.fillStyle = "#111111";
  ctx.font = "bold 14px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(order.customer_name, W - PAD, PAD + 60);
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(order.phone, W - PAD, PAD + 75);

  // ── Items List ──
  const items = order?.items || [];
  ctx.fillStyle = "#374151";
  ctx.font = "bold 11px Almarai, Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("الأصناف:", W - PAD, PAD + 95);

  items.slice(0, 4).forEach((item, i) => {
    let line = `• ${item.item_name}`;
    if (item.workshop_comment) line += ` (${item.workshop_comment})`;

    ctx.font = "9px Almarai, Arial";
    const maxW = W - PAD * 2;
    while (ctx.measureText(line).width > maxW && line.length > 5) {
      line = line.slice(0, -1) + "…";
    }
    ctx.fillText(line, W - PAD - 10, PAD + 112 + i * 14);
  });

  if (items.length > 4) {
    ctx.fillText(`+${items.length - 4} أصناف أخرى...`, W - PAD - 10, PAD + 112 + 4 * 14);
  }
}

export default function LabelCanvas({ order, autoPrint = false }) {
  const customerRef = useRef(null);
  const shopRef = useRef(null);
  const autoPrintedOrderRef = useRef(null);
  const [ready, setReady] = useState(false);
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

    const draw = async () => {
      try {
        if (customerRef.current) await drawCustomerLabel(customerRef.current, order);
        if (shopRef.current)     await drawWorkshopLabel(shopRef.current, order);
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
  }, [order]);

  // Auto-print Once
  useEffect(() => {
    if (!autoPrint || !order?.id || !ready || !isConnected || isPrinting) return;
    if (autoPrintedOrderRef.current === order.id) return;

    autoPrintedOrderRef.current = order.id;
    printAll(getPrintableCanvases(), { copiesPerCanvas: 1, maxLabels: 2 });
  }, [autoPrint, order?.id, ready, isConnected, isPrinting, printAll, getPrintableCanvases]);

  const handlePrint = useCallback(() => {
    if (ready && isConnected) {
      printAll(getPrintableCanvases(), { copiesPerCanvas: 1, maxLabels: 2 });
    }
  }, [ready, isConnected, printAll, getPrintableCanvases]);

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Label previews */}
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
                style={{ display: "block", maxWidth: "160px" }}
              />
            </div>
          </div>
        ))}
      </div>

      {!ready && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "10px" }}>
          ⟳ جاري توليد الملصق...
        </div>
      )}

      {/* Print controls */}
      {!bluetoothAvailable ? (
        <div style={{
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.20)",
          borderRadius: "var(--radius)",
          padding: "10px 14px",
          color: "#DC2626",
          fontSize: "0.83rem",
        }}>
          ⚠ طابعة Niimbot تتطلب Chrome أو Edge مع دعم Bluetooth
        </div>
      ) : (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {!isConnected ? (
            <>
              <button className="btn-ghost" onClick={() => connect('bluetooth')}>⌘ اتصال بلوتوث</button>
              {supportsSerial && (
                <button className="btn-ghost" onClick={() => connect('serial')}>USB-C / Serial</button>
              )}
            </>
          ) : (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16A34A", fontSize: "0.83rem" }}>
                <span className="pulse-gold" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                متصل {printerMeta?.transport === 'serial' ? 'USB' : 'Bluetooth'}
              </span>
              <button
                className="btn-gold"
                disabled={isPrinting || !ready}
                onClick={handlePrint}
              >
                {isPrinting ? "جاري الطباعة..." : "⎙ طباعة الملصقات"}
              </button>
              {isPrinting && (
                <button 
                  className="btn-ghost-sm" 
                  style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}
                  onClick={disconnect}
                >
                  ⚠ إيقاف إجباري
                </button>
              )}
              {!isPrinting && <button className="btn-ghost-sm" onClick={disconnect}>قطع الاتصال</button>}
            </>
          )}
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
