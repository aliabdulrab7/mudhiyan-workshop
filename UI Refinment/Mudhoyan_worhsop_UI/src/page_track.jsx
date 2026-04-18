// Public customer tracking page (no sidebar, simpler layout)
function TrackPage({ lang, orders }) {
  const order = orders.find(o => o.status === 'in_repair') || orders[0];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const stages = ['received', 'inspection', 'in_repair', 'quality_check', 'ready_for_return', 'delivered'];
  const currentIdx = stages.indexOf(order.status);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '0 24px 48px' }}>
      <div className="track-shell">
        <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>W</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Workbench</div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            {lang === 'ar' ? 'طلبك قيد المتابعة' : 'Your order is being tracked'}
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            {lang === 'ar' ? `مرحبًا ${order.customer.ar} — إليك حالة طلبك الآن` : `Hi ${order.customer.en.split(' ')[0]} — here's the status right now`}
          </div>
        </div>

        <div className="track-card">
          <div className="track-hero">
            <div className="track-mark">{order.order_number.slice(-3)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{order.order_number}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 2 }}>
                {order.piece[lang]} · {order.issue[lang]}
              </div>
            </div>
            <StatusPill status={order.status} dir={dir}/>
          </div>

          <div style={{ padding: '20px 4px', background: 'var(--bg-soft)', borderRadius: 8, marginTop: 16 }}>
            <div dir={dir} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>{lang === 'ar' ? 'بدأ' : 'Started'}</span>
              <span>{lang === 'ar' ? 'متوقّع الوصول للفرع' : 'Ready for pickup'}: <span className="mono" style={{ color: 'var(--text)' }}>{formatDate(order.etaAt, dir)}</span></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, padding: '8px 14px', position: 'relative' }}>
              {stages.map((s, i) => {
                const done = i < currentIdx;
                const cur = i === currentIdx;
                return (
                  <div key={s} style={{ position: 'relative', textAlign: 'center' }}>
                    {i < stages.length - 1 && (
                      <div style={{ position: 'absolute', top: 9, left: '50%', right: '-50%', height: 2, background: done ? 'var(--primary)' : 'var(--border)' }}/>
                    )}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', margin: '0 auto 8px',
                      background: done ? 'var(--primary)' : cur ? 'var(--bg-raised)' : 'var(--bg-raised)',
                      border: `2px solid ${done || cur ? 'var(--primary)' : 'var(--border-strong)'}`,
                      boxShadow: cur ? '0 0 0 4px var(--primary-ring)' : 'none',
                      position: 'relative', zIndex: 1,
                      display: 'grid', placeItems: 'center',
                      color: '#fff', fontSize: 10,
                    }}>
                      {done ? '✓' : ''}
                      {cur && <span style={{ width: 8, height: 8, borderRadius: 50, background: 'var(--primary)' }}/>}
                    </div>
                    <div style={{ fontSize: 10.5, color: cur ? 'var(--text)' : 'var(--text-muted)', fontWeight: cur ? 600 : 400, lineHeight: 1.2 }}>
                      {I18N[lang].status[s]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 14, background: 'var(--bg-soft)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                {lang === 'ar' ? 'استلام في' : 'Dropped off at'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{order.branch[lang]}</div>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {order.createdAt.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--bg-soft)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                {lang === 'ar' ? 'القيمة المُقدّرة' : 'Estimated total'}
              </div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{formatMoney(order.services.reduce((s, x) => s + x.price, 0), dir)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {order.services.length} {lang === 'ar' ? 'خدمة' : 'services'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button className="btn btn-lg btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <Icon.Phone size={13}/> {lang === 'ar' ? 'تواصل مع الفرع' : 'Contact branch'}
            </button>
            <button className="btn btn-lg" style={{ flex: 1, justifyContent: 'center' }}>
              <Icon.Check size={13}/> {lang === 'ar' ? 'وافق على التسعير' : 'Approve quote'}
            </button>
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            {lang === 'ar' ? 'يُحدَّث تلقائيًا · لا يتطلب إنشاء حساب' : 'Auto-updates · no account required'}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TrackPage });
