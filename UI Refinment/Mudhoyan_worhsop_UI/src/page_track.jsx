// Public customer tracking page (no sidebar, simpler layout)
function TrackPage({ lang, orders }) {
  // Pick a waiting_approval order for demo so the approval flow is visible by default
  const defaultOrder = orders.find(o => o.status === 'waiting_approval')
    || orders.find(o => o.status === 'in_repair')
    || orders[0];

  const [localOrder, setLocalOrder] = React.useState(defaultOrder);
  const [decision, setDecision] = React.useState(null); // null | 'approved' | 'rejected'
  const [confirming, setConfirming] = React.useState(null); // which action is pending confirmation

  const order = localOrder;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Simplified stages shown to customer (no internal statuses)
  const stages = ['received', 'inspection', 'in_repair', 'quality_check', 'ready_for_return', 'delivered'];
  const displayStatus = order.status === 'waiting_approval' ? 'inspection'
    : order.status === 'approved' ? 'in_repair'
    : order.status === 'rejected' ? 'inspection'
    : order.status;
  const currentIdx = stages.indexOf(displayStatus);

  function handleApprove() {
    setLocalOrder({ ...order, status: 'approved' });
    setDecision('approved');
    setConfirming(null);
  }

  function handleReject() {
    setLocalOrder({ ...order, status: 'rejected' });
    setDecision('rejected');
    setConfirming(null);
  }

  const isWaitingApproval = order.status === 'waiting_approval';
  const isRejected = order.status === 'rejected';
  const totalCost = order.services.reduce((s, x) => s + x.price, 0);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '0 24px 48px' }}>
      <div className="track-shell">
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>W</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Workbench</div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            {lang === 'ar' ? 'طلبك قيد المتابعة' : 'Your order is being tracked'}
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            {lang === 'ar'
              ? `مرحبًا ${order.customer.ar} — إليك حالة طلبك الآن`
              : `Hi ${order.customer.en.split(' ')[0]} — here's the status right now`}
          </div>
        </div>

        <div className="track-card">
          {/* Order hero */}
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

          {/* Progress bar */}
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
                      background: done ? 'var(--primary)' : 'var(--bg-raised)',
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

          {/* Info grid */}
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
            <div style={{ padding: 14, background: isWaitingApproval ? 'color-mix(in oklch, var(--status-waiting) 8%, white)' : 'var(--bg-soft)', borderRadius: 8, border: isWaitingApproval ? '1px solid color-mix(in oklch, var(--status-waiting) 25%, transparent)' : '1px solid transparent' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                {lang === 'ar' ? 'تكلفة الإصلاح' : 'Repair cost'}
              </div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: isWaitingApproval ? 'var(--status-waiting)' : 'var(--text)' }}>
                {formatMoney(totalCost, dir)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {order.services.length} {lang === 'ar' ? 'خدمة' : 'services'}
              </div>
            </div>
          </div>

          {/* Services breakdown */}
          {order.services.length > 0 && (
            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {order.services.map((s, i) => (
                <div key={i} style={{ display: 'flex', padding: '8px 14px', borderBottom: i < order.services.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? s.name_ar : s.name_en}</span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>{formatMoney(s.price, dir)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Decision feedback */}
          {decision === 'approved' && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'color-mix(in oklch, var(--status-approved) 10%, white)', borderRadius: 8, border: '1px solid color-mix(in oklch, var(--status-approved) 25%, transparent)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon.Check size={16} stroke="var(--status-approved)"/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--status-approved)' }}>
                  {lang === 'ar' ? 'تمت الموافقة!' : 'Quote approved!'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {lang === 'ar' ? 'سيبدأ فريق الورشة بالإصلاح قريبًا.' : 'The workshop team will begin repairs shortly.'}
                </div>
              </div>
            </div>
          )}
          {decision === 'rejected' && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'color-mix(in oklch, var(--status-rejected) 10%, white)', borderRadius: 8, border: '1px solid color-mix(in oklch, var(--status-rejected) 25%, transparent)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon.X size={16} stroke="var(--status-rejected)"/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--status-rejected)' }}>
                  {lang === 'ar' ? 'تم الرفض' : 'Repair declined'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {lang === 'ar' ? 'ستُعاد قطعتك للفرع دون إصلاح. سنتواصل معك قريبًا.' : 'Your item will be returned to the branch unrepaired. We\'ll be in touch.'}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={`https://wa.me/${order.customer.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-lg"
              style={{ flex: 1, justifyContent: 'center', minWidth: 140, textDecoration: 'none' }}
            >
              <Icon.Phone size={13}/> {lang === 'ar' ? 'تواصل مع الفرع' : 'Contact branch'} <Icon.Arrow size={10}/>
            </a>

            {isWaitingApproval && !decision && (
              <>
                {confirming === 'reject' ? (
                  <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    <button className="btn btn-lg" style={{ flex: 1, justifyContent: 'center', color: 'var(--text-muted)' }} onClick={() => setConfirming(null)}>
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button className="btn btn-lg" style={{ flex: 1, justifyContent: 'center', background: 'var(--status-rejected)', color: '#fff', borderColor: 'var(--status-rejected)' }} onClick={handleReject}>
                      <Icon.X size={13}/> {lang === 'ar' ? 'تأكيد الرفض' : 'Confirm reject'}
                    </button>
                  </div>
                ) : confirming === 'approve' ? (
                  <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    <button className="btn btn-lg" style={{ flex: 1, justifyContent: 'center', color: 'var(--text-muted)' }} onClick={() => setConfirming(null)}>
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button className="btn btn-lg btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleApprove}>
                      <Icon.Check size={13}/> {lang === 'ar' ? 'تأكيد الموافقة' : 'Confirm approval'}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-lg"
                      style={{ flex: 1, justifyContent: 'center', minWidth: 120, color: 'var(--status-rejected)', borderColor: 'color-mix(in oklch, var(--status-rejected) 30%, var(--border))' }}
                      onClick={() => setConfirming('reject')}
                    >
                      <Icon.X size={13}/> {lang === 'ar' ? 'رفض الإصلاح' : 'Decline repair'}
                    </button>
                    <button
                      className="btn btn-lg btn-primary"
                      style={{ flex: 1, justifyContent: 'center', minWidth: 140 }}
                      onClick={() => setConfirming('approve')}
                    >
                      <Icon.Check size={13}/> {lang === 'ar' ? 'وافق على التسعير' : 'Approve quote'}
                    </button>
                  </>
                )}
              </>
            )}

            {isRejected && !decision && (
              <div style={{ flex: 1, padding: '12px 16px', background: 'color-mix(in oklch, var(--status-rejected) 8%, white)', borderRadius: 8, border: '1px solid color-mix(in oklch, var(--status-rejected) 20%, transparent)', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                {lang === 'ar' ? 'رُفض الإصلاح — قطعتك في طريقها للفرع' : 'Repair was declined — your item is being returned to the branch'}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            {lang === 'ar' ? 'يُحدَّث تلقائيًا · لا يتطلب إنشاء حساب' : 'Auto-updates · no account required'}
          </div>
        </div>

        {/* Order picker for demo */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {lang === 'ar' ? 'عرض تجريبي — اختر طلبًا' : 'Demo — pick an order'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {orders.slice(0, 8).map(o => (
              <button
                key={o.id}
                className={`chip ${localOrder.id === o.id ? 'active' : ''}`}
                onClick={() => { setLocalOrder(o); setDecision(null); setConfirming(null); }}
              >
                <span className="mono" style={{ fontSize: 10.5 }}>{o.order_number}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>·</span>
                <StatusPill status={o.status} dir={dir}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TrackPage });
