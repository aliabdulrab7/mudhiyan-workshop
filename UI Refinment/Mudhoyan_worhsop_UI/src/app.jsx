// Main app: routes between pages, handles global shortcuts, manages shared state
const { useState, useEffect, useMemo } = React;

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "indigo",
  "accentColor": "oklch(0.55 0.19 270)",
  "rowH": 36,
  "sidebarW": 224,
  "monoIds": true,
  "zebra": false
}/*EDITMODE-END*/;

function App() {
  const [page, setPage] = useState(() => localStorage.getItem('wb:page') || 'dashboard');
  const [lang, setLang] = useState(() => localStorage.getItem('wb:lang') || 'en');
  const [filter, setFilter] = useState('all');
  const [openOrder, setOpenOrder] = useState(null);
  const [selected, setSelected] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [orders, setOrders] = useState(ORDERS);
  const [toasts, setToasts] = useState([]);

  // Persist
  useEffect(() => { localStorage.setItem('wb:page', page); }, [page]);
  useEffect(() => { localStorage.setItem('wb:lang', lang); }, [lang]);

  // Set html dir
  useEffect(() => {
    document.documentElement.setAttribute('data-dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  // Apply tweaks to CSS vars
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--primary', tweaks.accentColor);
    root.setProperty('--primary-soft', `color-mix(in oklch, ${tweaks.accentColor} 10%, white)`);
    root.setProperty('--primary-ring', `color-mix(in oklch, ${tweaks.accentColor} 25%, transparent)`);
    root.setProperty('--row-h', tweaks.rowH + 'px');
    root.setProperty('--sidebar-w', tweaks.sidebarW + 'px');
  }, [tweaks]);

  // Edit mode host integration
  useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    }
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Persist tweaks to disk when changed via edit mode
  function updateTweaks(next) {
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*');
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); return; }
      if (inField) return;
      if (e.key === '/') { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === 'n') { e.preventDefault(); setPage('new'); }
      if (e.key === 'g') {
        const once = (k) => { setPage(k); document.removeEventListener('keydown', handler); };
        const handler = (e2) => {
          if (e2.key === 'd') once('dashboard');
          else if (e2.key === 'o') once('orders');
          else if (e2.key === 's') once('scan');
          else if (e2.key === 'l') once('label');
          else if (e2.key === 't') once('track');
          else if (e2.key === 'i') once('inbox');
          document.removeEventListener('keydown', handler);
        };
        document.addEventListener('keydown', handler, { once: true });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Live-update toast demo
  useEffect(() => {
    const id = setTimeout(() => {
      setToasts([{ id: 1, text: lang === 'ar' ? 'وافق العميل على تسعير WB-2055' : 'Customer approved quote for WB-2055' }]);
      setTimeout(() => setToasts([]), 4200);
    }, 2600);
    return () => clearTimeout(id);
  }, [lang]);

  const counts = {
    active: orders.filter(o => !['delivered', 'closed'].includes(o.status)).length,
    mine: orders.filter(o => o.technician?.id === 't2').length,
  };

  function handleUpdate(updated) {
    setOrders(list => list.map(o => o.id === updated.id ? updated : o));
    setOpenOrder(updated);
  }

  const isTrack = page === 'track';

  return (
    <div>
      {/* Track page is public — no app shell */}
      {isTrack ? (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          <TrackPage lang={lang} orders={orders}/>
          <button className="btn btn-sm" style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }} onClick={() => setPage('dashboard')}>
            <Icon.Arrow size={12} className="flip-rtl"/> Back to app
          </button>
          <button className="btn btn-sm" style={{ position: 'fixed', top: 16, right: 140, zIndex: 50 }} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
            <Icon.Globe size={12}/> {lang === 'en' ? 'عربي' : 'EN'}
          </button>
        </div>
      ) : (
        <div className="app-shell">
          <Sidebar page={page} setPage={setPage} lang={lang} counts={counts}/>
          <div className="main-col">
            <Topbar page={page} lang={lang} setLang={setLang}
                    onOpenPalette={() => setPaletteOpen(true)}
                    onOpenTweaks={() => setTweaksOpen(true)}
                    onNewOrder={() => setPage('new')}/>
            <div className="page">
              {page === 'dashboard' && <DashboardPage lang={lang} orders={orders}
                                          onOpenOrder={setOpenOrder}
                                          onOpenOrders={(f) => { setFilter(f); setPage('orders'); }}/>}
              {page === 'orders' && <OrdersPage lang={lang} orders={orders}
                                       filter={filter} setFilter={setFilter}
                                       selected={selected} setSelected={setSelected}
                                       onOpenOrder={setOpenOrder}/>}
              {page === 'inbox' && <OrdersPage lang={lang} orders={orders.filter(o => o.technician?.id === 't2')}
                                       filter={filter} setFilter={setFilter}
                                       selected={selected} setSelected={setSelected}
                                       onOpenOrder={setOpenOrder}/>}
              {page === 'new' && <NewOrderPage lang={lang} onCancel={() => setPage('orders')} onSave={() => setPage('orders')}/>}
              {page === 'scan' && <ScanPage lang={lang} orders={orders} onOpenOrder={setOpenOrder}/>}
              {page === 'label' && <LabelPrintPage lang={lang} orders={orders}/>}
              {['inventory', 'reports', 'branches'].includes(page) && (
                <ComingSoon page={page} lang={lang}/>
              )}
            </div>
          </div>
        </div>
      )}

      {openOrder && <OrderDetail order={openOrder} onClose={() => setOpenOrder(null)} lang={lang} onUpdate={handleUpdate}/>}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} lang={lang} setPage={setPage} orders={orders}/>

      <div className="toast-layer">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span className="dot"/> {t.text}
          </div>
        ))}
      </div>

      {editMode && !isTrack && <TweaksPanel open={true} onClose={() => setEditMode(false)} tweaks={tweaks} setTweaks={updateTweaks}/>}
    </div>
  );
}

function ComingSoon({ page, lang }) {
  const t = I18N[lang];
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar[page]}</h1>
          <div className="page-sub">{lang === 'ar' ? 'قريبًا — ركّزنا على الطلبات والاستلام والمسح في هذا العرض' : 'Coming up next — this prototype focuses on orders, intake, scan, label & tracking'}</div>
        </div>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>
            {page === 'inventory' ? <Icon.Box size={48}/> : page === 'reports' ? <Icon.Chart size={48}/> : <Icon.Branch size={48}/>}
          </div>
          <div style={{ fontSize: 13 }}>
            {lang === 'ar' ? `صفحة ${t.sidebar[page]} — خارج نطاق هذه المسودة` : `The ${t.sidebar[page]} page is outside this prototype's scope.`}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
