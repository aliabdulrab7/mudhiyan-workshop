import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';
import ManualEntryInput from '../components/ManualEntryInput';
import ScanResult from '../components/ScanResult';
// TODO: OrdersPage passes dead props orderId + onStatusChange — clean up when next touching OrdersPage
import OrderDetail from '../components/OrderDetail';
import BulkScanSession from '../components/BulkScanSession';
import { getOrderByBarcode } from '../api/orders';
import StatusPill from '../components/StatusPill';
import { Icons } from '../components/icons';
import Button from '../components/ui/Button';

const cameraSupported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

export default function ScanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState]     = useState('scanning'); // scanning | loading | found | error
  const [order, setOrder]     = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [manualMode, setManualMode] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkMode, setBulkMode]     = useState(false);

  const handleScan = useCallback(async (value) => {
    if (value === lastScanned && state === 'found') return;
    setLastScanned(value);
    setState('loading');
    setErrorMsg('');
    try {
      const foundOrder = await getOrderByBarcode(value);
      setOrder(foundOrder);
      setState('found');
    } catch (e) {
      setErrorMsg(`لم يُعثر على طلب: ${value}`);
      setState('error');
    }
  }, [lastScanned, state]);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && code !== lastScanned) handleScan(code);
  }, [searchParams, lastScanned, handleScan]);

  function resetScanner() {
    setState('scanning'); setOrder(null);
    setErrorMsg(''); setLastScanned('');
    setSearchParams({});
  }

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    resetScanner();
  }, []);

  const switchToManual = useCallback(() => {
    setState('scanning');
    setOrder(null);
    setErrorMsg('');
    setLastScanned('');
    setManualMode(true);
    setSearchParams({});
  }, [setSearchParams]);

  const switchToCamera = useCallback(() => {
    if (!cameraSupported) return;
    setState('scanning');
    setOrder(null);
    setErrorMsg('');
    setLastScanned('');
    setManualMode(false);
    setSearchParams({});
  }, [setSearchParams]);

  useEffect(() => {
    function onKey(e) {
      if (drawerOpen || bulkMode) return;
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (typing) return;
      if ((e.key === 'm' || e.key === 'M') && !manualMode) {
        e.preventDefault();
        switchToManual();
      }
      if ((e.key === 'c' || e.key === 'C') && manualMode && cameraSupported) {
        e.preventDefault();
        switchToCamera();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manualMode, drawerOpen, bulkMode, switchToManual, switchToCamera]);

  const viaMobile = !!searchParams.get('code');

  // Mobile / iPhone QR flow — simplified view
  if (viaMobile) {
    return (
      <div style={{ padding: 24 }}>
        {state === 'loading' && (
          <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
            <Icons.Refresh size={20} /> جاري البحث...
          </div>
        )}
        {state === 'error' && (
          <div style={{
            padding: 16, borderRadius: 'var(--radius)',
            background: 'oklch(0.58 0.21 25 / 0.08)',
            border: '1px solid oklch(0.58 0.21 25 / 0.2)',
            color: 'var(--danger)', maxWidth: 400,
          }}>
            <div style={{ marginBottom: 10 }}>{errorMsg}</div>
            <Button size="sm" onClick={resetScanner}>رجوع</Button>
          </div>
        )}
        {state === 'found' && order && (
          <ScanResult order={order} onScanAgain={resetScanner} onOrderUpdated={setOrder} />
        )}
      </div>
    );
  }

  // Desktop camera scan flow — new 2-column layout
  return (
    <div>
      {/* Mode strip — always top-of-page, color-coded. Single-mode is compact; BulkScanSession owns bulk variants. */}
      {!bulkMode && (
        <div
          data-testid="scan__mode-strip__single"
          style={{
            width: '100%',
            minHeight: 56,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: 'var(--bg-raised)',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'Almarai, sans-serif',
            fontSize: 14,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>الوضع العادي — مسح فردي</span>
          <Button variant="primary" size="sm" onClick={() => setBulkMode(true)} testId="scan__toggle-bulk-mode">
            تبديل إلى الوضع الدفعي
          </Button>
        </div>
      )}

      {bulkMode && (
        <BulkScanSession onExitBulk={() => setBulkMode(false)} />
      )}

      {bulkMode ? null : (
      <>
      <div className="page-head">
        <div>
          <h1 className="page-title">مسح الباركود</h1>
          <div className="page-sub">امسح الباركود على الملصق لسحب الطلب فورًا</div>
        </div>
        <div className="page-actions">
          {cameraSupported && manualMode && (
            <Button
              size="sm"
              icon={<Icons.QR size={13} />}
              onClick={switchToCamera}
              testId="scan__switch-camera"
            >
              مسح بالكاميرا
            </Button>
          )}
          <Button variant="primary" size="sm" icon={<Icons.Refresh size={12} />} onClick={resetScanner} testId="scan__reset">
            مسح آخر
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Camera card */}
        <div className="card" style={{ padding: 16 }}>
          {manualMode ? (
            <ManualEntryInput
              onSubmit={(v) => handleScan(v)}
            />
          ) : state === 'found' ? (
            <div className="scan-stage" style={{ opacity: 0.5 }}>
              <div className="reticle" />
              <div className="corner tl" /><div className="corner tr" />
              <div className="corner bl" /><div className="corner br" />
              <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'center' }}>
                <span className="pill" style={{ background: 'oklch(1 0 0 / 0.12)', color: '#fff', border: '1px solid oklch(1 0 0 / 0.2)' }}>
                  <span className="dot" style={{ background: 'var(--text-faint)' }} />
                  تم
                </span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: state === 'found' ? 'none' : 'block' }}>
                <BarcodeScanner
                  onScan={handleScan}
                  active={state === 'scanning' || state === 'error'}
                />
              </div>
              {state === 'loading' && (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Icons.Refresh size={18} /> جاري البحث...
                </div>
              )}
            </div>
          )}

          {/* Status bar */}
          <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-faint)' }}>
            {cameraSupported && <span><span className="kbd">C</span> كاميرا</span>}
            <span><span className="kbd">M</span> يدوي</span>
            <span style={{ marginRight: 'auto' }} className="mono">
              {manualMode ? 'إدخال يدوي' : 'WebCam · 720p'}
            </span>
          </div>

          {/* Error */}
          {state === 'error' && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'oklch(0.58 0.21 25 / 0.08)',
              border: '1px solid oklch(0.58 0.21 25 / 0.2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 12.5,
            }}>
              {errorMsg}
              <div style={{ marginTop: 8 }}>
                <Button size="sm" onClick={resetScanner}>حاول مجدداً</Button>
              </div>
            </div>
          )}
        </div>

        {/* Result card */}
        <div className="card">
          <div className="sec-head">
            <span className="sec-title">نتيجة المسح</span>
            {order && (
              <Button variant="primary" size="sm" icon={<Icons.Arrow size={12} />} onClick={() => setDrawerOpen(true)} testId="scan__open-order">
                فتح الطلب
              </Button>
            )}
          </div>

          {!order ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
              وجّه الكاميرا نحو الملصق…
            </div>
          ) : (
            <ScanResult order={order} onScanAgain={resetScanner} onOrderUpdated={setOrder} />
          )}
        </div>
      </div>

      {drawerOpen && order && (
        <OrderDetail
          order={order}
          onClose={handleDrawerClose}
          onUpdated={setOrder}
        />
      )}
      </>
      )}
    </div>
  );
}
