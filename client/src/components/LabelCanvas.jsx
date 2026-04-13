import { useRef, useEffect, useState } from "react";
import QRCode   from "qrcode";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";
import { getConfig } from "../api/orders";

// B21: 40mm × 30mm @ 203 DPI = 320 × 240 px
const W = 320;
const H = 240;

// ── Customer label — QR code points to /track/:customer_token ────────────────
async function drawCustomerLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width  = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#CCCCCC";
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header
  ctx.fillStyle = "#1B2B5E";
  ctx.fillRect(2, 2, W - 4, 34);
  ctx.fillStyle = "#C9973A";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("مصنع المضيان", W - 10, 23);

  // Order number
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 52);

  // Customer + piece
  ctx.font = "bold 12px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.fillText(order.customer_name, W - 10, 72);
  ctx.font = "10px Almarai, Arial";
  ctx.fillStyle = "#555555";
  ctx.fillText(order.piece_type, W - 10, 88);

  // QR code
  try {
    const { ip, port } = await getConfig();
    if (ip === "localhost" || ip === "127.0.0.1") {
      ctx.font = "bold 9px Arial";
      ctx.fillStyle = "#CC0000";
      ctx.textAlign = "center";
      ctx.direction = "ltr";
      ctx.fillText("QR unavailable — check network", W / 2, 170);
      return;
    }

    const trackUrl = `http://${ip}:${port}/track/${order.customer_token}`;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, trackUrl, {
      width: 110, margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
    ctx.drawImage(qrCanvas, W - 120, 100);

    // Scan instruction
    ctx.font = "9px Almarai, Arial";
    ctx.fillStyle = "#888888";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText("امسح للمتابعة والموافقة", W - 10, 98);
  } catch (e) {
    console.error("Customer label QR failed", e);
  }
}

// ── Shop label — CODE128 barcode for internal scanning ───────────────────────
function drawShopLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width  = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#CCCCCC";
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header
  ctx.fillStyle = "#1B2B5E";
  ctx.fillRect(2, 2, W - 4, 34);
  ctx.fillStyle = "#C9973A";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("نسخة الورشة", W - 10, 23);

  // Order number
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 52);

  // Customer + piece + date
  ctx.font = "bold 12px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.fillText(order.customer_name, W - 10, 72);
  ctx.font = "10px Almarai, Arial";
  ctx.fillStyle = "#555555";
  const dateStr = new Date(order.created_at).toLocaleDateString("ar-SA");
  ctx.fillText(`${order.piece_type} — ${dateStr}`, W - 10, 88);

  // CODE128 barcode
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: false,
      margin: 4,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const bx = Math.max(2, Math.floor((W - barcodeCanvas.width) / 2));
    ctx.drawImage(barcodeCanvas, bx, 100);
  } catch (e) {
    console.error("Barcode draw failed", e);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#CC0000";
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText("Barcode error", W / 2, 160);
  }
}

export default function LabelCanvas({ order }) {
  const customerRef = useRef(null);
  const shopRef     = useRef(null);
  const [ready, setReady] = useState(false);
  const { connect, printAll, disconnect, isConnected, isPrinting, error: btError } = useLabelPrint();

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
          { ref: shopRef,     title: "ملصق الورشة" },
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
