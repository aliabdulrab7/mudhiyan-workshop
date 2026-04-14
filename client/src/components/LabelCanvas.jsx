import { useRef, useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import useLabelPrint from "./useLabelPrint";
import { getConfig } from "../api/orders";

// NIIMBOT B21S — 5cm × 3cm label @ 203 DPI
// Canvas: 400 × 240 px
// Safe zone (40px all sides): x[40..360] y[40..200] → 320 × 160 px usable
const W = 400;
const H = 240;
const PAD = 40;

// QR column: x[258..358], 100×100px — right side of label
const QR_X = 258;
const QR_SIZE = 100;

/**
 * Draw one order label:
 *   y=60  — order number (left, monospace)
 *   y=78  — customer name (right, RTL)
 *   y=88  — separator
 *   y=95  — QR code (right column, 100×100)
 *   y=108 — items list (left column, up to 3)
 *   y=195 — bottom of QR / safe boundary
 */
async function drawOrderLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Order number ──
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, PAD, PAD + 20);

  // ── Customer name ──
  ctx.fillStyle = "#333333";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  let name = order.customer_name;
  const maxNameW = W - PAD * 2;
  while (ctx.measureText(name).width > maxNameW && name.length > 2) {
    name = name.slice(0, -1);
  }
  if (name !== order.customer_name) name += "…";
  ctx.fillText(name, W - PAD, PAD + 38);

  // ── Separator ──
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 48);
  ctx.lineTo(W - PAD, PAD + 48);
  ctx.stroke();

  // ── QR code (right column) ──
  const QR_Y = PAD + 55; // y=95, ends y=195 ✓
  try {
    let scanUrl = order.order_number;
    try {
      const config = await getConfig();
      scanUrl = `http://${config.ip}/scan?code=${order.order_number}`;
    } catch (_) {}

    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, scanUrl, {
      width: QR_SIZE,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    ctx.drawImage(qrCanvas, QR_X, QR_Y);
  } catch (e) {
    console.error("QR draw failed", e);
  }

  // ── Items list (left column, x[40..250]) ──
  const items = order?.items?.length
    ? order.items
    : [{ item_type: order?.piece_type || "—", quantity: 1, notes: order?.notes || "" }];

  const maxItemW = QR_X - PAD - 8; // ≈ 210px
  items.slice(0, 3).forEach((item, i) => {
    let line = `${item.item_type} × ${item.quantity}`;
    if (item.notes?.trim()) line += ` — ${item.notes.trim()}`;

    ctx.fillStyle = "#1A6EA0";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "right";
    ctx.direction = "rtl";

    while (ctx.measureText(line).width > maxItemW && line.length > 2) {
      line = line.slice(0, -1);
    }
    ctx.fillText(line, QR_X - 8, PAD + 72 + i * 17);
  });

  if (items.length > 3) {
    ctx.fillStyle = "#999999";
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.fillText(`+${items.length - 3} أخرى`, QR_X - 8, PAD + 72 + 3 * 17);
  }
}

export default function LabelCanvas({ order, autoPrint = false, copies = 2 }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  useEffect(() => {
    if (!order) return;
    setReady(false);

    const draw = async () => {
      try {
        if (canvasRef.current) await drawOrderLabel(canvasRef.current, order);
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

  // Auto-print once connected and ready — print `copies` times
  useEffect(() => {
    if (!autoPrint || !ready || !isConnected || isPrinting || hasAutoPrinted) return;
    if (!canvasRef.current) return;
    setHasAutoPrinted(true);
    const canvasList = Array(copies).fill(canvasRef.current);
    printAll(canvasList);
  }, [autoPrint, ready, isConnected, isPrinting, hasAutoPrinted, copies, printAll]);

  const handlePrint = useCallback(() => {
    if (canvasRef.current) {
      const canvasList = Array(copies).fill(canvasRef.current);
      printAll(canvasList);
    }
  }, [copies, printAll]);

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
                {isPrinting ? "جاري الطباعة..." : `⎙ طباعة ${copies} ملصقات`}
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
