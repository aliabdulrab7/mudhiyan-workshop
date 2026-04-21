import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearAuth, getRole } from '../api/auth';
import { getOrders } from '../api/orders';
import CommandPalette from './CommandPalette';
import { Icons } from './icons';

const navItems = [
  { to: '/',            icon: Icons.Orders,    label: 'الطلبات',      badge: null },
  { to: '/new',         icon: Icons.Plus,      label: 'صيانة جديدة', roles: ['shop_employee'] },
  { to: '/scan',        icon: Icons.Scan,      label: 'مسح' },
  { to: '/branches',    icon: Icons.Branch,    label: 'الفروع',      roles: ['workshop'] },
  { to: '/reports',     icon: Icons.Chart,     label: 'التقارير',    roles: ['workshop'] },
  { to: '/technicians', icon: Icons.User,      label: 'الفنيون',     roles: ['workshop'] },
  { to: '/inventory',   icon: Icons.Box,       label: 'المخزون',     roles: ['workshop'] },
  { to: '/services',    icon: Icons.Tag,       label: 'الخدمات',     roles: ['workshop'] },
  { to: '/repair-options', icon: Icons.Settings, label: 'خيارات الإصلاح', roles: ['workshop'] },
];

const mobileNav = [
  { to: '/',     icon: Icons.Orders, label: 'الطلبات' },
  { to: '/new',  icon: Icons.Plus,   label: 'جديد',   roles: ['shop_employee'] },
  { to: '/scan', icon: Icons.Scan,   label: 'مسح' },
];

const PAGE_LABELS = {
  '/':            'الطلبات',
  '/new':         'صيانة جديدة',
  '/scan':        'مسح الباركود',
  '/branches':    'الفروع',
  '/reports':     'التقارير',
  '/technicians': 'الفنيون',
  '/inventory':   'المخزون',
  '/services':    'الخدمات',
  '/repair-options': 'خيارات الإصلاح',
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [orders, setOrders] = useState([]);

  const visible       = navItems.filter(n => !n.roles || n.roles.includes(role));
  const visibleMobile = mobileNav.filter(n => !n.roles || n.roles.includes(role));

  const currentLabel = PAGE_LABELS[location.pathname] ?? '';

  useEffect(() => {
    let cancelled = false;
    getOrders({ status: 'all' })
      .then(data => { if (!cancelled) setOrders(data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Icons.Diamond size={12} stroke="#fff" sw={2} />
          </div>
          <div>
            <div className="brand-name">المضيان</div>
            <div className="brand-sub">إدارة الصيانة</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
          {visible.map(({ to, icon: NavIcon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              data-testid={`layout__nav__${to === '/' ? 'orders' : to.slice(1)}`}
            >
              <NavIcon size={14} />
              <span style={{ flex: 1 }}>{label}</span>
              {badge != null && <span className="badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: search hint + user */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setPaletteOpen(true)}
            className="nav-item"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-soft)' }}
            data-testid="layout__sidebar__search-button"
          >
            <Icons.Search size={13} />
            <span style={{ flex: 1, color: 'var(--text-faint)', fontSize: 12 }}>بحث سريع…</span>
            <span className="kbd">⌘K</span>
          </button>
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ width: '100%', marginTop: 2 }}
            data-testid="layout__sidebar__logout"
          >
            <Icons.Logout size={14} />
            <span style={{ flex: 1 }}>تسجيل الخروج</span>
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', padding: '6px 0 2px' }}>
            يتطلب Chrome أو Edge للطباعة
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="main-col">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-crumbs">
            <span>المضيان</span>
            {currentLabel && <><span className="sep">/</span><span className="current">{currentLabel}</span></>}
          </div>

          <button
            className="topbar-search"
            onClick={() => setPaletteOpen(true)}
            data-testid="layout__topbar__search-button"
          >
            <Icons.Search size={13} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>بحث أو تنقل…</span>
            <span className="hint"><span className="kbd">⌘</span><span className="kbd">K</span></span>
          </button>

          <div className="topbar-actions">
            <NavLink to="/new" className="btn btn-sm btn-primary" data-testid="layout__topbar__new-order-link">
              <Icons.Plus size={12} /> صيانة جديدة
            </NavLink>
            <button className="btn btn-sm btn-ghost btn-icon" data-testid="layout__topbar__action__notifications">
              <Icons.Bell size={13} />
            </button>
            <button className="btn btn-sm btn-ghost btn-icon" data-testid="layout__topbar__action__settings">
              <Icons.Settings size={13} />
            </button>
          </div>
        </div>

        {/* Page content */}
        <main className="page">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="bottom-tab-bar">
        {visibleMobile.map(({ to, icon: TabIcon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
            data-testid={`layout__tab__${to === '/' ? 'orders' : to.slice(1)}`}
          >
            <TabIcon size={20} className="tab-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="tab-item"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          data-testid="layout__tab__logout"
        >
          <Icons.Logout size={20} className="tab-icon" />
          <span>خروج</span>
        </button>
      </nav>

      {/* ⌘K Command palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        orders={orders}
      />
    </div>
  );
}
