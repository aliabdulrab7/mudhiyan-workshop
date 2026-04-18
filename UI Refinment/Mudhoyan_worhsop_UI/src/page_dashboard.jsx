// Dashboard: stats, action panels, recent activity, branches
function DashboardPage({ lang, orders, onOpenOrder, onOpenOrders }) {
  const t = I18N[lang];
  const counts = statusCounts(orders);

  const statCards = [
    { key: 'new',              value: counts.new,              label: t.stats.new,       color: 'var(--status-new)',        spark: [1,2,1,3,2,2,3] },
    { key: 'received',         value: counts.received,         label: t.stats.received,  color: 'var(--status-received)',   spark: [3,4,2,5,6,4,7] },
    { key: 'inspection',       value: counts.inspection,       label: t.stats.inspection,color: 'var(--status-inspection)', spark: [2,3,3,4,2,3,2] },
    { key: 'waiting_approval', value: counts.waiting_approval, label: t.stats.waiting,   color: 'var(--status-waiting)',    spark: [1,2,2,3,2,2,2] },
    { key: 'in_repair',        value: counts.in_repair,        label: t.stats.repair,    color: 'var(--status-repair)',     spark: [4,5,4,5,4,4,4] },
    { key: 'quality_check',    value: counts.quality_check,    label: t.stats.quality,   color: 'var(--status-quality)',    spark: [1,2,1,2,2,2,2] },
    { key: 'ready_for_return', value: counts.ready_for_return, label: t.stats.ready,     color: 'var(--status-ready)',      spark: [2,2,3,3,3,3,3] },
    { key: 'returned_to_shop', value: counts.returned_to_shop + counts.delivered, label: t.stats.delivered, color: 'var(--status-delivered)', spark: [1,1,2,2,2,2,2] },
  ];

  const newOrders       = orders.filter(o => o.status === 'new');
  const received        = orders.filter(o => o.status === 'received');
  const awaitingApproval= orders.filter(o => o.status === 'waiting_approval');
  const ready           = orders.filter(o => o.status === 'ready_for_return');
  const rejected        = orders.filter(o => o.status === 'rejected');

  const dateStr = new Date('2026-04-18T10:40:00Z').toLocaleDateString(lang === 'ar' ? 'ar' : 'en', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar.dashboard}</h1>
          <div className="page-sub">{dateStr} · {orders.length} {lang === 'ar' ? 'طلبًا نشطًا' : 'active orders'}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Icon.Refresh size={13}/> {lang === 'ar' ? 'تحديث' : 'Refresh'}</button>
          <button className="btn btn-sm"><Icon.Download size={13}/> {t.actions.export}</button>
        </div>
      </div>

      <div className="dash">
        {/* Stat cards */}
        <div className="grid-stats">
          {statCards.map(c => (
            <div key={c.key} className="stat-card card" onClick={() => onOpenOrders(c.key)}>
              <div className="stat-label">
                <span className="dot" style={{ width: 6, height: 6, borderRadius: 50, background: c.color }}/>
                {c.label}
              </div>
              <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
              <Sparkline data={c.spark} color={c.color}/>
            </div>
          ))}
        </div>

        {/* Rejected alert — only show if any exist */}
        {rejected.length > 0 && (
          <div className="card" style={{ borderTop: `2px solid var(--status-rejected)`, padding: 0, overflow: 'hidden' }}>
            <div className="sec-head">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--status-rejected)', display: 'grid', placeItems: 'center' }}><Icon.Warn size={15}/></span>
                <span className="sec-title">{lang === 'ar' ? 'طلبات مرفوضة — تحتاج إعادة للفرع' : 'Rejected orders — return to branch'}</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--status-rejected)', marginLeft: 4 }}>{rejected.length}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onOpenOrders('rejected')}><Icon.ChevRight size={13}/></button>
            </div>
            {rejected.slice(0, 3).map(o => (
              <div key={o.id} className="mini-row" onClick={() => onOpenOrder(o)}>
                <span className="stamp">{o.order_number}</span>
                <span className="name">{o.customer[lang]}</span>
                <span className="meta">{o.piece[lang]} · {o.issue[lang]}</span>
                <StatusPill status={o.status} dir={lang === 'ar' ? 'rtl' : 'ltr'}/>
              </div>
            ))}
          </div>
        )}

        {/* Main action panels */}
        <div className="grid-two">
          <ActionPanel
            title={lang === 'ar' ? 'استلامات جديدة — لم تُستلم بعد' : 'New intakes — not yet received'}
            icon={<Icon.Plus/>}
            count={newOrders.length}
            color="var(--status-new)"
            orders={newOrders.slice(0, 4)}
            lang={lang}
            onOrder={onOpenOrder}
            empty={lang === 'ar' ? 'لا استلامات جديدة' : 'No new intakes'}
          />
          <ActionPanel
            title={lang === 'ar' ? 'تنتظر التقييم' : 'Awaiting intake review'}
            icon={<Icon.Inbox/>}
            count={received.length}
            color="var(--status-received)"
            orders={received.slice(0, 4)}
            lang={lang}
            onOrder={onOpenOrder}
            empty={lang === 'ar' ? 'لا جديد' : 'Nothing new'}
          />
        </div>

        <div className="grid-two">
          <ActionPanel
            title={lang === 'ar' ? 'بانتظار موافقة العميل' : 'Awaiting customer approval'}
            icon={<Icon.Clock/>}
            count={awaitingApproval.length}
            color="var(--status-waiting)"
            orders={awaitingApproval.slice(0, 4)}
            lang={lang}
            onOrder={onOpenOrder}
            empty={lang === 'ar' ? 'لا شيء معلّق' : 'All clear'}
            highlight
          />
          <ReadyToReturn orders={ready.slice(0, 5)} lang={lang} onOrder={onOpenOrder}/>
        </div>

        <div className="grid-two">
          <BranchLoad orders={orders} lang={lang}/>
          <ActivityFeed orders={orders.slice(0, 8)} lang={lang}/>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({ title, icon, count, color, orders, empty, lang, onOrder, highlight }) {
  return (
    <div className="card">
      <div className="sec-head" style={{ borderTop: highlight ? `2px solid ${color}` : 'none' }}>
        <div className="flex items-center gap-2">
          <span style={{ color, display: 'grid', placeItems: 'center' }}>{icon}</span>
          <span className="sec-title">{title}</span>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 4 }}>{count}</span>
        </div>
        <button className="btn btn-ghost btn-sm"><Icon.ChevRight size={13}/></button>
      </div>
      {orders.length === 0 ? (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>{empty}</div>
      ) : orders.map(o => (
        <div key={o.id} className="mini-row" onClick={() => onOrder(o)}>
          <span className="stamp">{o.order_number}</span>
          <span className="name">{o.customer[lang]}</span>
          <span className="meta">{o.piece[lang]} · {o.issue[lang]}</span>
          <span className="meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {relTime(o.createdAt, lang === 'ar' ? 'rtl' : 'ltr')}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReadyToReturn({ orders, lang, onOrder }) {
  return (
    <div className="card">
      <div className="sec-head">
        <div className="flex items-center gap-2">
          <Icon.Sparkle stroke="var(--status-ready)"/>
          <span className="sec-title">{lang === 'ar' ? 'جاهزة للإرجاع للفرع' : 'Ready to return to branch'}</span>
        </div>
        <button className="btn btn-sm"><Icon.Printer size={13}/> {lang === 'ar' ? 'طباعة جماعية' : 'Bulk print'}</button>
      </div>
      {orders.length === 0 ? (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
          {lang === 'ar' ? 'لا شيء جاهز' : 'Nothing ready yet'}
        </div>
      ) : orders.map(o => (
        <div key={o.id} className="mini-row" onClick={() => onOrder(o)}>
          <span className="stamp">{o.order_number}</span>
          <span className="name">{o.customer[lang]}</span>
          <span className="meta">{o.branch[lang]}</span>
          <StatusPill status={o.status} dir={lang === 'ar' ? 'rtl' : 'ltr'}/>
        </div>
      ))}
    </div>
  );
}

function BranchLoad({ orders, lang }) {
  const byBranch = BRANCHES.map(b => {
    const subset = orders.filter(o => o.branch.id === b.id && !['delivered', 'closed'].includes(o.status));
    return { ...b, count: subset.length, ready: subset.filter(o => o.status === 'ready_for_return').length };
  });
  const max = Math.max(...byBranch.map(b => b.count), 1);
  return (
    <div className="card">
      <div className="sec-head">
        <div className="flex items-center gap-2">
          <Icon.Branch/>
          <span className="sec-title">{lang === 'ar' ? 'الفروع' : 'Branch load'}</span>
        </div>
        <span className="sec-sub">{orders.length} {lang === 'ar' ? 'نشطة' : 'total'}</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {byBranch.map(b => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 12.5 }}>{b[lang]}</span>
            <div style={{ background: 'var(--bg-soft)', borderRadius: 4, height: 8, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${(b.count / max) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 4 }}/>
              {b.ready > 0 && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: `${(b.ready / max) * 100}%`, background: 'var(--status-ready)', borderRadius: 4 }}/>
              )}
            </div>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right' }}>{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ orders, lang }) {
  return (
    <div className="card">
      <div className="sec-head">
        <div className="flex items-center gap-2">
          <Icon.Bolt/>
          <span className="sec-title">{lang === 'ar' ? 'النشاط المباشر' : 'Live activity'}</span>
          <span className="pill" style={{ borderColor: 'var(--status-ready)', color: 'var(--status-ready)' }}>
            <span className="dot" style={{ background: 'var(--status-ready)' }}/>
            {lang === 'ar' ? 'مباشر' : 'Live'}
          </span>
        </div>
        <span className="sec-sub mono">{lang === 'ar' ? 'آخر 30 دقيقة' : 'last 30m'}</span>
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        {orders.map((o, i) => {
          const ago = (i + 1) * 4;
          const texts = {
            en: [
              ['Status →', I18N.en.status[o.status] || o.status],
              ['Assigned to', o.technician?.en || 'unassigned'],
              ['Note added', o.workshop_notes.en],
              ['Customer notified', o.customer.en],
              ['Quoted', formatMoney(o.value)],
            ],
            ar: [
              ['تغيّرت الحالة →', I18N.ar.status[o.status] || o.status],
              ['عُيِّن إلى', o.technician?.ar || 'غير مُعيّن'],
              ['أُضيفت ملاحظة', o.workshop_notes.ar],
              ['إشعار العميل', o.customer.ar],
              ['تسعير', formatMoney(o.value, 'rtl')],
            ],
          };
          const [label, val] = texts[lang][i % 5];
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12.5, borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11, width: 40 }}>{ago}m</span>
              <span className="stamp">{o.order_number}</span>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{val}</span>
              <span style={{ flex: 1 }}/>
              <span className="meta" style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{o.technician?.[lang] || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
