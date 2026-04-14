import { useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";

// NIIMBOT B21S — 5cm × 3cm label @ 203 DPI
// Physical pixels: 400×240px
// Safe zone (40px all sides): x[40..360] y[40..200] → 320×160px usable
const W = 400;
const H = 240;
const PAD = 40;

function drawReadyLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width  = W;
  canvas.height = H;

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Row 1: Status badge (left) + Order number (center) + Name (right) ──
  // Baseline at y = PAD + 26 = 66

  // "جاهز" badge on the left
  ctx.fillStyle = "#059669";
  ctx.font = "bold 20px Almarai, Arial";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("✓ READY", PAD, PAD + 26);

  // Order number centered
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, PAD + 26);

  // Customer name on the right
  ctx.fillStyle = "#333333";
  ctx.font = "bold 18px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const maxNameWidth = 100;
  let name = order.customer_name;
  while (ctx.measureText(name).width > maxNameWidth && name.length > 2) {
    name = name.slice(0, -1);
  }
  if (name !== order.customer_name) name += '…';
  ctx.fillText(name, W - PAD, PAD + 26);

  // ── Separator line ──
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 40);
  ctx.lineTo(W - PAD, PAD + 40);
  ctx.stroke();

  // ── Barcode — centered, safely within bottom boundary ──
  // Top at y=92, height=75, bottom at y=167 < 200 ✓
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2,
      height: 75,
      displayValue: false,
      margin: 0,
      background: "#FFFFFF",
      lineColor: "#000000",
    });

    const bx = Math.max(PAD, (W - barcodeCanvas.width) / 2);
    ctx.drawImage(barcodeCanvas, bx, 92);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

export default function ReadyLabelCanvas({ order, autoPrint = false }) {
  const labelRef = useRef(null);
  const autoPrintedOrderRef = useRef(null);
  const [ready, setReady] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  useEffect(() => {
    if (!autoPrint || !order?.id || !ready || !isConnected || isPrinting || !labelRef.current) return;
    if (autoPrintedOrderRef.current === order.id) return;

    autoPrintedOrderRef.current = order.id;
    printAll([labelRef.current], { copiesPerCanvas: 1, maxLabels: 1 });
  }, [autoPrint, order?.id, ready, isConnected, isPrinting, printAll]);

  useEffect(() => {
    if (!order || !labelRef.current) return;
    setReady(false);
    autoPrintedOrderRef.current = null;
    Promise.resolve().then(() => {
      drawReadyLabel(labelRef.current, order);
      setReady(true);
    });
  }, [order]);

  if (!order) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <canvas
            style={{
              width: "100%",
              maxWidth: "320px",
              display: "block",
              border: "1px solid #E5E7EB",
              borderRadius: "4px",
              backgroundColor: "#fff",
              cursor: "pointer",
              transition: "transform 0.2s",
              opacity: ready ? 1 : 0.5,
            }}
            ref={labelRef}
          />
        </div>
      </div>

      {!isConnected ? (
        <button
          className="btn-ghost"
          onClick={connect}
          disabled={isPrinting}
          style={{ width: "100%", maxWidth: "320px", justifyContent: "center" }}
        >
          {btError ? "إعادة المحاولة" : "اقتران بطابعة ملصقات (Niimbot B21S)"}
        </button>
      ) : (
        <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px" }}>
          <button
            className="btn-gold"
            onClick={() => printAll([labelRef.current], { copiesPerCanvas: 1, maxLabels: 1 })}
            disabled={isPrinting || !ready}
            style={{ flex: 1, justifyContent: "center" }}
          >
            {isPrinting ? "جاري الطباعة..." : "⎙ طباعة ملصق (جاهز)"}
          </button>
          <button
            className="btn-ghost"
            onClick={disconnect}
            disabled={isPrinting}
            style={{ padding: "8px" }}
            title="إلغاء الاقتران"
          >
            ✖
          </button>
        </div>
      )}
      {btError && (
        <div style={{ fontSize: "0.8rem", color: "#DC2626", maxWidth: "320px" }}>{btError}</div>
      )}
    </div>
  );
}
