// Sidebar navigation
function Sidebar({ page, setPage, lang, counts }) {
  const t = I18N[lang];
  const items1 = [
    { key: 'dashboard', icon: <Icon.Dashboard/>, label: t.sidebar.dashboard },
    { key: 'orders',    icon: <Icon.Orders/>,    label: t.sidebar.orders, badge: counts.active },
    { key: 'inbox',     icon: <Icon.Inbox/>,     label: t.sidebar.inbox,  badge: counts.mine },
    { key: 'new',       icon: <Icon.Plus/>,      label: t.sidebar.newOrder },
    { key: 'scan',      icon: <Icon.Scan/>,      label: t.sidebar.scan },
    { key: 'label',     icon: <Icon.Printer/>,   label: t.sidebar.label },
    { key: 'track',     icon: <Icon.Link/>,      label: t.sidebar.track },
  ];
  const items2 = [
    { key: 'inventory', icon: <Icon.Box/>,     label: t.sidebar.inventory },
    { key: 'reports',   icon: <Icon.Chart/>,   label: t.sidebar.reports },
    { key: 'branches',  icon: <Icon.Branch/>,  label: t.sidebar.branches },
  ];

  const Item = ({ it }) => (
    <div
      className={`nav-item ${page === it.key ? 'active' : ''}`}
      onClick={() => setPage(it.key)}
    >
      <span className="icon">{it.icon}</span>
      <span style={{ flex: 1 }}>{it.label}</span>
      {it.badge != null && it.badge > 0 && <span className="badge">{it.badge}</span>}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">W</div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">{t.brand}</div>
          <div className="brand-sub">{t.brandSub}</div>
        </div>
      </div>

      <div className="sidebar-section">{t.sidebar.section1}</div>
      {items1.map(it => <Item key={it.key} it={it}/>)}

      <div className="sidebar-section">{t.sidebar.section2}</div>
      {items2.map(it => <Item key={it.key} it={it}/>)}

      <div style={{ flex: 1 }}/>
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name="Rania M" size={24}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Rania M.</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Nakheel branch</div>
        </div>
        <Icon.Ellipsis stroke="var(--text-muted)"/>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
