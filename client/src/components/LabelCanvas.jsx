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
 * Draw one item label onto a canvas.
 * Shows: order number, customer name, item type, quantity, notes, barcode.
 */
function drawItemLabel(canvas, order, item) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Row 1: Order number (left LTR) | Item type (right RTL) ──
  // baseline y = PAD + 24 = 64
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, PAD, PAD + 24);

  ctx.fillStyle = "#1A6EA0";
  ctx.font = "bold 22px Arial";      // Arial as safe fallback for Arabic
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(item.item_type, W - PAD, PAD + 24);

  // ── Row 2: Quantity badge (left) | Customer name (right) ──
  // baseline y = 64 + 24 = 88
  ctx.fillStyle = "#555555";
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(`x${item.quantity}`, PAD, PAD + 48);

  ctx.fillStyle = "#333333";
  ctx.font = "16px Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  // truncate name to fit
  let name = order.customer_name;
  const maxNameW = W - PAD * 2 - 50;
  while (ctx.measureText(name).width > maxNameW && name.length > 2) {
    name = name.slice(0, -1);
  }
  if (name !== order.customer_name) name += "…";
  ctx.fillText(name, W - PAD, PAD + 48);

  // ── Row 3: Notes (full width, if present) ──
  // baseline y = 88 + 18 = 106
  if (item.notes && item.notes.trim()) {
    ctx.fillStyle = "#666666";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    // truncate notes to fit single line
    let notes = item.notes.trim();
    const maxNotesW = W - PAD * 2;
    while (ctx.measureText(notes).width > maxNotesW && notes.length > 2) {
      notes = notes.slice(0, -1);
    }
    if (notes !== item.notes.trim()) notes += "…";
    ctx.fillText(notes, W - PAD, PAD + 66);
  }

  // ── Thin separator line ──
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 76);
  ctx.lineTo(W - PAD, PAD + 76);
  ctx.stroke();

  // ── Barcode: centered, starts at y=124, height=65, ends at y=189 < 200 ✓ ──
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2,
      height: 65,
      displayValue: false,
      margin: 0,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const bx = Math.max(PAD, (W - barcodeCanvas.width) / 2);
    ctx.drawImage(barcodeCanvas, bx, PAD + 84);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

export default function LabelCanvas({ order, autoPrint = false }) {
  // Build a flat list of items — expand quantity into repeat entries if needed,
  // but one row per item line (quantity shown in the label text)
  const items = order?.items?.length
    ? order.items
    : [{ item_type: order?.piece_type || "—", quantity: 1, notes: order?.notes || "" }];

  // Dynamic refs — one canvas per item
  const canvasRefs = useRef([]);
  canvasRefs.current = items.map((_, i) => canvasRefs.current[i] ?? { current: null });

  const [ready, setReady] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  // Draw all item labels whenever order changes
  useEffect(() => {
    if (!order) return;
    setReady(false);

    // Wait for fonts so Arabic text renders correctly
    const draw = () => {
      try {
        items.forEach((item, i) => {
          const canvas = canvasRefs.current[i]?.current;
          if (canvas) drawItemLabel(canvas, order, item);
        });
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
    const canvases = items.map((_, i) => canvasRefs.current[i]?.current).filter(Boolean);
    if (canvases.length === 0) return;
    setHasAutoPrinted(true);
    printAll(canvases);
  }, [autoPrint, ready, isConnected, isPrinting, hasAutoPrinted, printAll]);

  const handlePrint = useCallback(() => {
    const canvases = items.map((_, i) => canvasRefs.current[i]?.current).filter(Boolean);
    printAll(canvases);
  }, [items, printAll]);

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;
  const totalLabels = items.length;

  return (
    <div>
      {/* Per-item label previews */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        {items.map((item, i) => {
          // Ensure ref slot exists
          if (!canvasRefs.current[i]) canvasRefs.current[i] = { current: null };
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              {/* Item badge */}
              <div style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#1A6EA0",
                background: "rgba(41,128,185,0.08)",
                border: "1px solid rgba(41,128,185,0.20)",
                borderRadius: "20px",
                padding: "2px 8px",
                direction: "rtl",
              }}>
                {item.item_type} × {item.quantity}
              </div>

              {/* Canvas preview */}
              <div style={{
                border: "1px solid #E5E7EB",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                opacity: ready ? 1 : 0.4,
                transition: "opacity 0.3s",
              }}>
                <canvas
                  ref={el => { canvasRefs.current[i] = { current: el }; }}
                  style={{ display: "block", maxWidth: "160px" }}
                />
              </div>

              {/* Notes preview */}
              {item.notes?.trim() && (
                <div style={{
                  fontSize: "0.65rem",
                  color: "var(--text-muted)",
                  maxWidth: "160px",
                  textAlign: "center",
                  direction: "rtl",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!ready && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "10px" }}>
          ⟳ جاري توليد الملصقات...
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
                {isPrinting ? "جاري الطباعة..." : `⎙ طباعة ${totalLabels} ملصق`}
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
