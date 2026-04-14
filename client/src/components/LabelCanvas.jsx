import { useRef, useEffect, useState, useCallback } from "react";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";

// NIIMBOT B21S — 5cm × 3cm label @ 203 DPI
// Canvas: 400 × 240 px
// Safe zone (40px all sides): x[40..360] y[40..200] → 320 × 160 px usable
const W = 400;
const H = 240;
const PAD = 40;

/**
 * Draw one order label:
 *   Row 1 (y=60):  order number
 *   Row 2 (y=78):  customer name (RTL)
 *   Separator (y=88)
 *   Items zone (y=104–144): up to 3 items, "type × qty — notes"
 *   Separator (y=148)
 *   Barcode (y=155, height=42)
 */
function drawOrderLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Order number ──
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, PAD, PAD + 20);

  // ── Customer name ──
  ctx.fillStyle = "#333333";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  const maxNameW = W - PAD * 2;
  let name = order.customer_name;
  while (ctx.measureText(name).width > maxNameW && name.length > 2) {
    name = name.slice(0, -1);
  }
  if (name !== order.customer_name) name += "…";
  ctx.fillText(name, W - PAD, PAD + 38);

  // ── Separator ──
  const sep = (y) => {
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
  };
  sep(PAD + 48);

  // ── Items ──
  const items = order?.items?.length
    ? order.items
    : [{ item_type: order?.piece_type || "—", quantity: 1, notes: order?.notes || "" }];

  const shown = items.slice(0, 3);
  shown.forEach((item, i) => {
    let line = `${item.item_type} × ${item.quantity}`;
    if (item.notes?.trim()) line += ` — ${item.notes.trim()}`;

    ctx.fillStyle = "#1A6EA0";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "right";
    ctx.direction = "rtl";

    const maxW = W - PAD * 2;
    while (ctx.measureText(line).width > maxW && line.length > 2) {
      line = line.slice(0, -1);
    }
    ctx.fillText(line, W - PAD, PAD + 64 + i * 16);
  });

  if (items.length > 3) {
    ctx.fillStyle = "#999999";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.fillText(`+${items.length - 3} أخرى`, W - PAD, PAD + 64 + 3 * 16);
  }

  // ── Separator before barcode ──
  sep(PAD + 108);

  // ── Barcode (y=155, height=42, ends y=197 < 200 ✓) ──
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2,
      height: 42,
      displayValue: false,
      margin: 0,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const bx = Math.max(PAD, (W - barcodeCanvas.width) / 2);
    ctx.drawImage(barcodeCanvas, bx, PAD + 115);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

export default function LabelCanvas({ order, autoPrint = false }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  useEffect(() => {
    if (!order) return;
    setReady(false);

    const draw = () => {
      try {
        if (canvasRef.current) drawOrderLabel(canvasRef.current, order);
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

  // Auto-print once connected and ready
  useEffect(() => {
    if (!autoPrint || !ready || !isConnected || isPrinting || hasAutoPrinted) return;
    if (!canvasRef.current) return;
    setHasAutoPrinted(true);
    printAll([canvasRef.current]);
  }, [autoPrint, ready, isConnected, isPrinting, hasAutoPrinted, printAll]);

  const handlePrint = useCallback(() => {
    if (canvasRef.current) printAll([canvasRef.current]);
  }, [printAll]);

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Label preview */}
      <div style={{ marginBottom: "16px" }}>
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
            ref={canvasRef}
            style={{ display: "block", maxWidth: "200px" }}
          />
        </div>
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
            <button className="btn-ghost" onClick={connect}>⌘ اتصال بالطابعة</button>
          ) : (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16A34A", fontSize: "0.83rem" }}>
                <span className="pulse-gold" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                متصل
              </span>
              <button
                className="btn-gold"
                disabled={isPrinting || !ready}
                onClick={handlePrint}
              >
                {isPrinting ? "جاري الطباعة..." : "⎙ طباعة الملصق"}
              </button>
              <button className="btn-ghost-sm" onClick={disconnect}>قطع الاتصال</button>
            </>
          )}
        </div>
      )}

      {btError && (
        <div style={{ marginTop: "10px", color: "#DC2626", fontSize: "0.82rem", padding: "8px 12px", background: "rgba(220,38,38,0.06)", borderRadius: "var(--radius)", border: "1px solid rgba(220,38,38,0.15)" }}>
          {btError}
        </div>
      )}
    </div>
  );
}
