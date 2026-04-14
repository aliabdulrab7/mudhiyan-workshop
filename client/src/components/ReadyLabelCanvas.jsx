import { useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";

const W = 320;
const H = 160;

function drawReadyLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width  = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Status (Left/Center)
  ctx.fillStyle = "#059669";
  ctx.font = "bold 22px Almarai, Arial";
  ctx.textAlign = "left";
  ctx.direction = "rtl";
  ctx.fillText("✓ جاهز - READY", 15, 45);

  // Order Number (Center)
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 45);

  // Customer Name (Right)
  ctx.fillStyle = "#333333";
  ctx.font = "bold 20px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText(order.customer_name, W - 15, 45);

  // Barcode (Bottom)
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2.2,
      height: 70,
      displayValue: false,
      margin: 2,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const bx = (W - barcodeCanvas.width) / 2;
    ctx.drawImage(barcodeCanvas, bx, 75);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

export default function ReadyLabelCanvas({ order, autoPrint = false }) {
  const labelRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  useEffect(() => {
    if (autoPrint && ready && isConnected && !isPrinting && !hasAutoPrinted && labelRef.current) {
      setHasAutoPrinted(true);
      printAll([labelRef.current]);
    }
  }, [autoPrint, ready, isConnected, isPrinting, hasAutoPrinted, printAll]);

  useEffect(() => {
    if (!order || !labelRef.current) return;
    setReady(false);
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
          <canvas style={{ width: "100%", maxWidth: "320px", display: "block", border: "1px solid #eee", borderRadius: "4px", backgroundColor: "#fff", cursor: "pointer", transition: "transform 0.2s" }} ref={labelRef} />
        </div>
      </div>
      
      {!isConnected ? (
        <button className="btn-ghost" onClick={connect} disabled={isPrinting} style={{ width: "100%", maxWidth: "320px", justifyContent: "center", border: "1px solid var(--gold-border)" }}>
          {btError ? "إعادة المحاولة" : "اقتران بطابعة ملصقات (Niimbot)"}
        </button>
      ) : (
        <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "320px" }}>
          <button className="btn-gold" onClick={() => printAll([labelRef.current])} disabled={isPrinting || !ready} style={{ flex: 1, justifyContent: "center" }}>
            {isPrinting ? "جاري الطباعة..." : "طباعة ملصق (جاهز)"}
          </button>
          <button className="btn-ghost" onClick={disconnect} disabled={isPrinting} style={{ padding: "8px" }} title="إلغاء الاقتران">
            ✖
          </button>
        </div>
      )}
      {btError && <div style={{ fontSize: "0.8rem", color: "#DC2626", maxWidth: "320px" }}>{btError}</div>}
    </div>
  );
}
