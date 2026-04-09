import { useEffect, useRef, useId } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScan, active = true }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  // Fix #8: unique id per instance — avoids conflicts on hot reload or dual mount
  const uid = useId().replace(/:/g, '-');
  const scannerId = `scanner${uid}`;

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps: 10,
        qrbox: { width: 260, height: 100 },
        formatsToSupport: [7], // CODE_128 = 7
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => { onScan(decodedText); },
      () => { /* scan errors are expected noise */ }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [active, scannerId]);

  return (
    <div
      id={scannerId}
      ref={containerRef}
      style={{
        '--bs-bg': 'var(--bg-surface)',
        '--bs-border': 'var(--gold-border)',
      }}
    />
  );
}
