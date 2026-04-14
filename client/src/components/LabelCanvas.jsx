import { useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";

// NIIMBOT B21S — 5cm × 3cm label @ 203 DPI
// Physical pixels: 5/2.54 × 203 ≈ 400px wide, 3/2.54 × 203 ≈ 240px tall
const W = 400;
const H = 240;

// B21S hardware safe zone: 40px padding on all sides
// Safe area: x[40..360] y[40..200] → 320×160 usable pixels
const PAD = 40;

function drawLabel(canvas, order, labelType) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Row 1: Serial (left) + Customer name (right) ──
  // y=40 (top of safe area) + font-size 26 = baseline at y=66
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, PAD, PAD + 26);

  // Customer name — truncate if too long
  ctx.fillStyle = "#333333";
  ctx.font = "bold 22px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const maxNameWidth = W - PAD * 2 - 160; // leave room for order number
  let name = order.customer_name;
  while (ctx.measureText(name).width > maxNameWidth && name.length > 2) {
    name = name.slice(0, -1);
  }
  if (name !== order.customer_name) name += '…';
  ctx.fillText(name, W - PAD, PAD + 26);

  // ── Label type badge (below row 1, small) ──
  if (labelType) {
    ctx.fillStyle = "#888888";
    ctx.font = "14px Almarai, Arial";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText(labelType, W - PAD, PAD + 46);
  }

  // ── Barcode — centered, safely within bottom safe zone ──
  // Available vertical space: PAD+56 to 200 = ~104px for barcode
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

    // Center horizontally within safe area, top of barcode at y=108
    const bx = Math.max(PAD, (W - barcodeCanvas.width) / 2);
    const by = 108;

    // Verify it fits: by + 75 = 183 < 200 ✓
    ctx.drawImage(barcodeCanvas, bx, by);
  } catch (e) {
    console.error("Barcode draw failed", e);
  }
}

async function drawCustomerLabel(canvas, order) {
  drawLabel(canvas, order, "عميل");
}

function drawShopLabel(canvas, order) {
  drawLabel(canvas, order, "ورشة");
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
      Promise.resolve(drawCustomerLabel(customerRef.current, order)),
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
              border: "1px solid #E5E7EB",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              display: "inline-block",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
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
        <div style={{ marginTop: "10px", color: "#DC2626", fontSize: "0.82rem", padding: "8px 12px", background: "rgba(220,38,38,0.06)", borderRadius: "var(--radius)", border: "1px solid rgba(220,38,38,0.15)" }}>
          {btError}
        </div>
      )}
    </div>
  );
}
