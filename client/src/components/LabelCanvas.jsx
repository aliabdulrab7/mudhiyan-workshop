import { useRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";
import { getConfig } from "../api/orders";

// Portrait orientation for 20mm x 40mm labels
const W = 160;
const H = 320;

// Draw a simplified vertical label (Serial, Name, Barcode)
async function drawMiniLabel(canvas, order, title) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Serial Number (Top)
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 45);

  // Customer Name (Middle)
  ctx.fillStyle = "#333333";
  ctx.font = "bold 18px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillText(order.customer_name, W / 2, 85);

  // Barcode (Bottom)
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 1.5,
      height: 100,
      displayValue: false,
      margin: 4,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    
    // Draw barcode centered and near bottom
    const bx = (W - barcodeCanvas.width) / 2;
    ctx.drawImage(barcodeCanvas, bx, 120);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

async function drawCustomerLabel(canvas, order) {
  return drawMiniLabel(canvas, order, "عميل");
}

function drawShopLabel(canvas, order) {
  // Sync wrapper for drawMiniLabel
  const ctx = canvas.getContext("2d");
  drawMiniLabel(canvas, order, "ورشة");
}

export default function LabelCanvas({ order, autoPrint = false }) {
  const customerRef = useRef(null);
  const shopRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

  useEffect(() => {
    if (autoPrint && ready && isConnected && !isPrinting && !hasAutoPrinted && customerRef.current && shopRef.current) {
      setHasAutoPrinted(true);
      printAll([customerRef.current, shopRef.current]);
    }
  }, [autoPrint, ready, isConnected, isPrinting, hasAutoPrinted, printAll]);

  useEffect(() => {
    if (!order || !customerRef.current || !shopRef.current) return;
    setReady(false);
    Promise.all([
      drawCustomerLabel(customerRef.current, order),
      Promise.resolve(drawShopLabel(shopRef.current, order)),
    ])
      .then(() => setReady(true))
      .catch(err => { console.error("Label draw failed", err); setReady(true); });
  }, [order]);

  const bluetoothAvailable = typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Two label previews side by side */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
        {[
          { ref: customerRef, title: "ملصق العميل" },
          { ref: shopRef, title: "ملصق الورشة" },
        ].map(({ ref, title }) => (
          <div key={title}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "6px", textAlign: "center" }}>
              {title}
            </div>
            <div style={{
              border: "1px solid var(--gold-border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              display: "inline-block",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(27,43,94,0.1)",
              opacity: ready ? 1 : 0.5,
              transition: "opacity 0.3s",
            }}>
              <canvas ref={ref} style={{ display: "block", maxWidth: "160px" }} />
            </div>
          </div>
        ))}
      </div>

      {!ready && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "10px" }}>
          ⟳ جاري توليد الملصقات...
        </div>
      )}

      {/* Print controls */}
      {!bluetoothAvailable ? (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
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
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--status-ready-fg)", fontSize: "0.83rem" }}>
                <span className="pulse-gold" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--status-ready-fg)", display: "inline-block" }} />
                متصل
              </span>
              <button
                className="btn-gold"
                disabled={isPrinting || !ready}
                onClick={() => printAll([customerRef.current, shopRef.current])}
              >
                {isPrinting ? "جاري الطباعة..." : "⎙ طباعة الملصقين"}
              </button>
              <button className="btn-ghost-sm" onClick={disconnect}>قطع الاتصال</button>
            </>
          )}
        </div>
      )}

      {btError && (
        <div style={{ marginTop: "10px", color: "#DC2626", fontSize: "0.82rem", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius)" }}>
          {btError}
        </div>
      )}
    </div>
  );
}
