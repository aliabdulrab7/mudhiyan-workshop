// Scan page: camera stage + result preview
function ScanPage({ lang, orders, onOpenOrder }) {
  const t = I18N[lang];
  const [result, setResult] = React.useState(null);
  const [scanning, setScanning] = React.useState(true);

  // Demo: cycle through a few orders automatically
  React.useEffect(() => {
    if (!scanning) return;
    const id = setTimeout(() => {
      const pick = orders[Math.floor(Math.random() * orders.length)];
      setResult(pick);
      setScanning(false);
    }, 3200);
    return () => clearTimeout(id);
  }, [scanning, orders]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar.scan}</h1>
          <div className="page-sub">{lang === 'ar' ? 'امسح الباركود على الملصق لسحب الطلب فورًا' : 'Scan a barcode on any label to pull up the order instantly'}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Icon.QR size={13}/> {lang === 'ar' ? 'إدخال يدوي' : 'Manual entry'}</button>
          <button className="btn btn-sm btn-primary" onClick={() => { setResult(null); setScanning(true); }}><Icon.Refresh size={12}/> {lang === 'ar' ? 'مسح آخر' : 'Scan another'}</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="scan-stage">
            <div className="reticle"/>
            <div className="corner tl"/><div className="corner tr"/>
            <div className="corner bl"/><div className="corner br"/>
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'center' }}>
              <span className="pill" style={{ background: 'oklch(1 0 0 / 0.12)', color: '#fff', border: '1px solid oklch(1 0 0 / 0.2)' }}>
                <span className="dot" style={{ background: scanning ? 'var(--status-ready)' : 'var(--text-faint)' }}/>
                {scanning ? (lang === 'ar' ? 'جارٍ المسح…' : 'Scanning…') : (lang === 'ar' ? 'تم' : 'Captured')}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-faint)' }}>
            <span><Kbd>C</Kbd> {lang === 'ar' ? 'كاميرا' : 'Camera'}</span>
            <span><Kbd>M</Kbd> {lang === 'ar' ? 'يدوي' : 'Manual'}</span>
            <span><Kbd>esc</Kbd> {lang === 'ar' ? 'إلغاء' : 'cancel'}</span>
            <span style={{ marginLeft: 'auto' }} className="mono">WebCam · 720p · BE</span>
          </div>
        </div>

        <div className="card">
          <div className="sec-head">
            <span className="sec-title">{lang === 'ar' ? 'نتيجة المسح' : 'Scan result'}</span>
            {result && <button className="btn btn-sm btn-primary" onClick={() => onOpenOrder(result)}><Icon.Arrow size={12}/> {lang === 'ar' ? 'فتح الطلب' : 'Open order'}</button>}
          </div>
          {!result ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
              {lang === 'ar' ? 'وجّه الكاميرا نحو الملصق…' : 'Point camera at the sticker…'}
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span className="stamp" style={{ fontSize: 13 }}>{result.order_number}</span>
                <StatusPill status={result.status} dir={dir}/>
              </div>
              <div className="kv-grid">
                <div className="kv-key">{t.detail.customer}</div>
                <div className="kv-val">{result.customer[lang]}</div>
                <div className="kv-key">{t.detail.piece}</div>
                <div className="kv-val">{result.piece[lang]}</div>
                <div className="kv-key">{t.detail.branch}</div>
                <div className="kv-val">{result.branch[lang]}</div>
                <div className="kv-key">{t.detail.technician}</div>
                <div className="kv-val">{result.technician?.[lang] || t.table.unassigned}</div>
                <div className="kv-key">{t.detail.eta}</div>
                <div className="kv-val mono">{formatDate(result.etaAt, dir)}</div>
              </div>
              <hr className="hr"/>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm"><Icon.Sparkle size={12}/> {lang === 'ar' ? 'تقدّم الحالة' : 'Advance status'}</button>
                <button className="btn btn-sm"><Icon.Printer size={12}/> {lang === 'ar' ? 'إعادة طباعة' : 'Reprint label'}</button>
                <button className="btn btn-sm"><Icon.Bell size={12}/> {lang === 'ar' ? 'إشعار' : 'Notify'}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="card">
          <div className="sec-head">
            <span className="sec-title">{lang === 'ar' ? 'آخر عمليات المسح' : 'Recent scans'}</span>
            <span className="sec-sub mono">{lang === 'ar' ? 'اليوم' : 'today'}</span>
          </div>
          {orders.slice(0, 5).map((o, i) => (
            <div key={o.id} className="mini-row" onClick={() => onOpenOrder(o)}>
              <span className="mono text-xs text-mute" style={{ width: 48 }}>{['2m', '8m', '14m', '32m', '1h'][i]}</span>
              <span className="stamp">{o.order_number}</span>
              <span className="name">{o.customer[lang]}</span>
              <StatusPill status={o.status} dir={dir}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScanPage });
