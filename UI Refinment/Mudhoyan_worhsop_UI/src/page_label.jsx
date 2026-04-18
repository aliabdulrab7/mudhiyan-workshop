// Label print page
function LabelPrintPage({ lang, orders }) {
  const t = I18N[lang];
  const [selected, setSelected] = React.useState(orders[0]?.id);
  const order = orders.find(o => o.id === selected) || orders[0];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar.label}</h1>
          <div className="page-sub">{lang === 'ar' ? 'طباعة ملصقات التتبّع — متوافق مع طابعات Niimbot & Zebra' : 'Print tracking stickers — works with Niimbot & Zebra printers'}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Icon.Download size={13}/> PDF</button>
          <button className="btn btn-sm btn-primary"><Icon.Printer size={13}/> {lang === 'ar' ? 'طباعة' : 'Print'} <Kbd>⌘</Kbd><Kbd>P</Kbd></button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        <div className="card">
          <div className="sec-head">
            <span className="sec-title">{lang === 'ar' ? 'اختر طلبًا' : 'Pick an order'}</span>
          </div>
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {orders.slice(0, 12).map(o => (
              <div key={o.id} className="mini-row" onClick={() => setSelected(o.id)}
                   style={selected === o.id ? { background: 'var(--primary-soft)' } : {}}>
                <span className="stamp">{o.order_number}</span>
                <span className="name">{o.customer[lang]}</span>
                <span className="meta">{o.piece[lang]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="sec-head">
            <span className="sec-title">{lang === 'ar' ? 'معاينة الملصق' : 'Label preview'} · 58×40mm</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm btn-ghost">58mm</button>
              <button className="btn btn-sm btn-ghost">40mm</button>
              <button className="btn btn-sm btn-ghost">Jewelry tag</button>
            </div>
          </div>

          <div style={{ padding: 32, display: 'flex', justifyContent: 'center', background: 'var(--bg-soft)' }}>
            <div className="label-preview">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="brand">WORKBENCH</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{order.branch.en}</span>
              </div>
              <div className="divider"/>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>{order.order_number}</div>
              <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                {order.customer.en}<br/>
                {order.piece.en} · {order.issue.en}
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="barcode">
                  {Array.from({ length: 48 }).map((_, i) => {
                    const seed = (i * 13 + order.order_number.charCodeAt(3 + (i % 3))) % 7;
                    const w = seed < 3 ? 2 : seed < 5 ? 3 : 1;
                    const skip = seed === 6;
                    return <div key={i} className="b" style={{ flex: w, background: skip ? 'transparent' : '#000' }}/>;
                  })}
                </div>
                <div style={{ textAlign: 'center', fontSize: 9, letterSpacing: '0.2em', marginTop: 3 }}>{order.order_number}</div>
              </div>
              <div className="divider"/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                <span>ETA {formatDate(order.etaAt)}</span>
                <span>+{order.customer.phone.slice(-4)}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm">1×</button>
              <button className="btn btn-sm btn-primary">2×</button>
              <button className="btn btn-sm">3×</button>
              <button className="btn btn-sm">5×</button>
            </div>
            <span className="text-mute">· {lang === 'ar' ? 'طبع ملصقين' : 'prints 2 copies'}</span>
            <span style={{ flex: 1 }}/>
            <span className="mono text-xs text-mute">Niimbot B1 · ready</span>
            <span className="dot" style={{ width: 6, height: 6, borderRadius: 50, background: 'var(--status-ready)', display: 'inline-block' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LabelPrintPage });
