import { useState, useEffect, useRef } from 'react';
import { getPrinters, getPrinterCapabilities, printLabel, getPreview } from '../api/print';
import { Icons } from './icons';

/**
 * PrintPanel
 *
 * Displays:
 *   • Printer dropdown (populated from /api/print/printers)
 *   • Detected label size + adapter type
 *   • Live HTML preview (iframe)
 *   • "Test Print" button
 *
 * Props:
 *   labelData — { barcode?, qrCode?, textLines?, qrDataUrl? }
 *   onClose?  — called when the panel should be dismissed
 */
export default function PrintPanel({ labelData, onClose }) {
  const [printers, setPrinters]       = useState([]);
  const [selected, setSelected]       = useState('');
  const [caps, setCaps]               = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading]         = useState(true);
  const [capsLoading, setCapsLoading] = useState(false);
  const [printing, setPrinting]       = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const iframeRef = useRef(null);

  // Load printer list on mount
  useEffect(() => {
    setLoading(true);
    getPrinters()
      .then(list => {
        setPrinters(list);
        if (list.length > 0) setSelected(list[0].name);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // When printer selection changes → fetch capabilities + preview
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setCapsLoading(true);
    setError('');
    setSuccess('');

    getPrinterCapabilities(selected)
      .then(async c => {
        if (!active) return;
        setCaps(c);
        const { html } = await getPreview(labelData, c);
        if (!active) return;
        setPreviewHtml(html);
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setCapsLoading(false); });

    return () => { active = false; };
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject preview HTML into iframe
  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(previewHtml);
      doc.close();
    }
  }, [previewHtml]);

  async function handlePrint() {
    if (!selected) return;
    setPrinting(true);
    setError('');
    setSuccess('');
    try {
      await printLabel(selected, labelData, caps);
      setSuccess('تم إرسال طلب الطباعة بنجاح');
    } catch (e) {
      setError(e.message);
    } finally {
      setPrinting(false);
    }
  }

  const adapterLabel = caps?.adapter === 'zebra' ? 'ZPL (Zebra)' : 'Generic (CUPS/HTML)';

  return (
    <div className="card" style={{ padding: '20px 24px', maxWidth: 520 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Icons.Printer size={15} />
          طباعة الملصق
        </div>
        {onClose && (
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 8px' }}>
            <Icons.X size={13} />
          </button>
        )}
      </div>

      {/* Printer select */}
      <div style={{ marginBottom: 14 }}>
        <label className="field-label">الطابعة</label>
        {loading ? (
          <div className="skeleton" style={{ height: 34, borderRadius: 'var(--radius-sm)' }} />
        ) : printers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '8px 0' }}>
            لا توجد طابعات مسجّلة في النظام
          </div>
        ) : (
          <select
            className="input"
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{ direction: 'ltr', textAlign: 'left' }}
          >
            {printers.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Capabilities */}
      {capsLoading && (
        <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-sm)', marginBottom: 14 }} />
      )}
      {caps && !capsLoading && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 14, fontSize: 12,
          padding: '8px 12px', background: 'var(--surface-alt)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
        }}>
          <span><strong style={{ color: 'var(--text)' }}>الحجم:</strong> {caps.widthMm}×{caps.heightMm} mm</span>
          <span><strong style={{ color: 'var(--text)' }}>DPI:</strong> {caps.dpi}</span>
          <span style={{ marginRight: 'auto' }}>{adapterLabel}</span>
        </div>
      )}

      {/* Live preview */}
      {previewHtml && !capsLoading && (
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">معاينة</label>
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
          }}>
            <iframe
              ref={iframeRef}
              title="label-preview"
              style={{
                width: caps ? `${caps.widthMm * 2}px` : 200,
                height: caps ? `${caps.heightMm * 2}px` : 120,
                border: 'none',
                display: 'block',
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Error / success */}
      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 12, padding: '8px 12px', marginBottom: 10,
          background: 'oklch(0.58 0.21 25 / 0.06)', border: '1px solid oklch(0.58 0.21 25 / 0.2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          color: 'var(--success)', fontSize: 12, padding: '8px 12px', marginBottom: 10,
          background: 'oklch(0.60 0.15 150 / 0.06)', border: '1px solid oklch(0.60 0.15 150 / 0.2)',
          borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icons.Check size={12} /> {success}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          disabled={!selected || printing || loading || capsLoading}
          onClick={handlePrint}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          {printing ? 'جاري الطباعة...' : <><Icons.Printer size={13} /> طباعة</>}
        </button>
        {onClose && (
          <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
        )}
      </div>
    </div>
  );
}
