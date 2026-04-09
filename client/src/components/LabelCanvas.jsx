import { useRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import useLabelPrint from "./useLabelPrint";
import { getConfig } from "../api/orders";

// B21 label: 40mm × 30mm at 203 DPI → 320 × 240 px
const W = 320;
const H = 240;

async function drawLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = "#CCCCCC";
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header strip
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(2, 2, W - 4, 34);

  // Shop name in header
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("مصنع المضيان", W - 10, 23);

  // Order number (monospace, prominent)
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 54);

  // Customer name
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.fillText(order.customer_name, W - 10, 74);

  // Piece type + date
  ctx.font = "11px Almarai, Arial";
  ctx.fillStyle = "#555555";
  const dateStr = new Date(order.created_at).toLocaleDateString("ar-SA");
  ctx.fillText(`${order.piece_type} — ${dateStr}`, W - 10, 90);

  // QR Code — fetch LAN IP to build scan URL
  try {
    const { ip, port } = await getConfig();

    // Fix #11: warn if IP resolved to localhost (iPhone won't be able to reach it)
    if (ip === "localhost" || ip === "127.0.0.1") {
      ctx.font = "bold 10px Arial";
      ctx.fillStyle = "#CC0000";
      ctx.textAlign = "center";
      ctx.direction = "ltr";
      ctx.fillText("QR unavailable - check network", W / 2, 170);
      return;
    }

    const scanUrl = `http://${ip}:${port}/scan?code=${encodeURIComponent(order.order_number)}`;

    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, scanUrl, {
      width: 110,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    // Draw QR on right side of label
    const qrX = W - 120;
    const qrY = 100;
    ctx.drawImage(qrCanvas, qrX, qrY);

    // "امسح QR" label below QR
    ctx.font = "9px Almarai, Arial";
    ctx.fillStyle = "#888888";
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.fillText("Scan QR", qrX + 55, qrY + 118);
  } catch (e) {
    console.error("QR generation failed", e);
  }

  // Phone number on left side
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillStyle = "#777777";
  ctx.fillText("+" + order.phone, 10, 120);

  // Scan instruction (Arabic)
  ctx.font = "9px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#AAAAAA";
  ctx.fillText("امسح لإشعار العميل", W - 125, 115);
}

export default function LabelCanvas({ order }) {
  const canvasRef = useRef(null);
  const [qrReady, setQrReady] = useState(false);
  const {
    connect,
    print,
    disconnect,
    isConnected,
    isPrinting,
    error: btError,
  } = useLabelPrint();

  useEffect(() => {
    if (canvasRef.current && order) {
      setQrReady(false);
      // Fix #13: handle promise rejection from drawLabel
      drawLabel(canvasRef.current, order)
        .then(() => setQrReady(true))
        .catch((err) => {
          console.error("Label draw failed", err);
          setQrReady(true);
        });
    }
  }, [order]);

  const bluetoothAvailable =
    typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Label preview */}
      <div
        style={{
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          display: "inline-block",
          background: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          marginBottom: "16px",
          opacity: qrReady ? 1 : 0.5,
          transition: "opacity 0.3s",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", maxWidth: "100%" }}
        />
      </div>

      {!qrReady && (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            marginBottom: "10px",
          }}
        >
          ⟳ جاري توليد QR...
        </div>
      )}

      {/* Print controls */}
      {!bluetoothAvailable ? (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            color: "#FCA5A5",
            fontSize: "0.83rem",
          }}
        >
          ⚠ طابعة Niimbot تتطلب Chrome أو Edge مع دعم Bluetooth
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {!isConnected ? (
            <button className="btn-ghost" onClick={connect}>
              ⌘ اتصال بالطابعة
            </button>
          ) : (
            <>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--status-ready-fg)",
                  fontSize: "0.83rem",
                }}
              >
                <span
                  className="pulse-gold"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--status-ready-fg)",
                    display: "inline-block",
                  }}
                />
                متصل
              </span>
              <button
                className="btn-gold"
                disabled={isPrinting || !qrReady}
                onClick={() => print(canvasRef.current)}
              >
                {isPrinting ? "جاري الطباعة..." : "⎙ طباعة الملصق"}
              </button>
              <button className="btn-ghost-sm" onClick={disconnect}>
                قطع الاتصال
              </button>
            </>
          )}
        </div>
      )}

      {btError && (
        <div
          style={{
            marginTop: "10px",
            color: "#FCA5A5",
            fontSize: "0.82rem",
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "var(--radius)",
          }}
        >
          {btError}
        </div>
      )}
    </div>
  );
}
