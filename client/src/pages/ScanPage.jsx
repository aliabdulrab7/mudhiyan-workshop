import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';
import ScanResult from '../components/ScanResult';
import { getOrderByBarcode } from '../api/orders';

export default function ScanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState('scanning'); // scanning | loading | found | error
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScanned, setLastScanned] = useState('');

  // Fix #7: useCallback + correct deps so useEffect below can list it safely
  const handleScan = useCallback(async (value) => {
    if (value === lastScanned && state === 'found') return;
    setLastScanned(value);
    setState('loading');
    setErrorMsg('');

    try {
      const foundOrder = await getOrderByBarcode(value);
      // Fix #2: do NOT auto-promote status — let the user confirm in ScanResult
      setOrder(foundOrder);
      setState('found');
    } catch (e) {
      setErrorMsg(`لم يُعثر على طلب: ${value}`);
      setState('error');
    }
  }, [lastScanned, state]);

  // Fix #7: lastScanned + handleScan in deps
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && code !== lastScanned) {
      handleScan(code);
    }
  }, [searchParams, lastScanned, handleScan]);

  function resetScanner() {
    setState('scanning');
    setOrder(null);
    setErrorMsg('');
    setLastScanned('');
    setSearchParams({});
  }

  const viaMobile = !!searchParams.get('code');

  return (
    <div style={{ padding: viaMobile ? '20px' : 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)' }}>
      {!viaMobile && (
        <>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
              مسح الباركود
            </h1>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              وجّه كاميرا الكمبيوتر للباركود — أو امسح QR الملصق بالجوال
            </div>
          </div>
          <div className="gold-line" style={{ marginBottom: '28px' }} />
        </>
      )}

      <div style={{ display: 'flex', gap: '36px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {!viaMobile && (
          <div style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            minWidth: '320px',
            flex: '0 0 auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: state === 'scanning' ? 'var(--status-ready-fg)' : 'var(--text-muted)',
                display: 'inline-block',
                ...(state === 'scanning' ? { animation: 'pulse-gold 1.5s infinite' } : {}),
              }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {state === 'scanning' ? 'الكاميرا جاهزة' :
                 state === 'loading'  ? 'جاري البحث...' : 'جاهز'}
              </span>
            </div>

            <div style={{ display: state === 'found' ? 'none' : 'block' }}>
              <BarcodeScanner
                onScan={handleScan}
                active={state === 'scanning' || state === 'error'}
              />
            </div>

            {state === 'loading' && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                ⟳ جاري البحث...
              </div>
            )}

            {state === 'error' && (
              <div style={{
                marginTop: '12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                color: '#DC2626',
                fontSize: '0.83rem',
              }}>
                {errorMsg}
                <div style={{ marginTop: '8px' }}>
                  <button className="btn-ghost-sm" onClick={resetScanner}>حاول مجدداً</button>
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'found' && order && (
          <ScanResult order={order} onScanAgain={resetScanner} onOrderUpdated={setOrder} />
        )}

        {viaMobile && state === 'loading' && (
          <div style={{ color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>
            ⟳ جاري البحث...
          </div>
        )}

        {viaMobile && state === 'error' && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            color: '#DC2626',
            maxWidth: '400px',
          }}>
            <div style={{ marginBottom: '10px' }}>{errorMsg}</div>
            <button className="btn-ghost-sm" onClick={resetScanner}>رجوع</button>
          </div>
        )}
      </div>
    </div>
  );
}
