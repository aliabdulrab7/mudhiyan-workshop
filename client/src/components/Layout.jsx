import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuth, getRole } from '../api/auth';
import { getOrders } from '../api/orders';
import CommandPalette from './CommandPalette';
import { Icons } from './icons';

const nav = [
  { to: '/',            Icon: Icons.Orders,       label: 'الطلبات' },
  { to: '/new',         Icon: Icons.Plus,          label: 'صيانة جديدة', roles: ['shop_employee'] },
  { to: '/scan',        Icon: Icons.Scan,          label: 'مسح' },
  { to: '/branches',    Icon: Icons.Branch,        label: 'الفروع',    roles: ['workshop'] },
  { to: '/reports',     Icon: Icons.Chart,         label: 'التقارير',  roles: ['workshop'] },
  { to: '/technicians', Icon: Icons.User,          label: 'الفنيون',   roles: ['workshop'] },
  { to: '/inventory',   Icon: Icons.Box,           label: 'المخزون',   roles: ['workshop'] },
  { to: '/services',    Icon: Icons.Tag,           label: 'الخدمات',   roles: ['workshop'] },
];

// Mobile tab bar shows a condensed set
const mobileNav = [
  { to: '/',      Icon: Icons.Orders, label: 'الطلبات' },
  { to: '/new',   Icon: Icons.Plus,   label: 'جديد',   roles: ['shop_employee'] },
  { to: '/scan',  Icon: Icons.Scan,   label: 'مسح' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const role = getRole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [orders, setOrders] = useState([]);

  const visibleNav       = nav.filter(n => !n.roles || n.roles.includes(role));
  const visibleMobileNav = mobileNav.filter(n => !n.roles || n.roles.includes(role));

  // Lightweight order list for palette search
  useEffect(() => {
    let cancelled = false;
    getOrders({ status: 'all' })
      .then(data => { if (!cancelled) setOrders(data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ⌘K / Ctrl+K keyboard shortcut
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
    <div className="main-layout" style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>

      {/* Sidebar — desktop */}
      <aside className="sidebar" style={{
        width: '240px',
        minWidth: '240px',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: 'var(--primary)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <Icons.Diamond size={14} stroke="#fff" sw={2} />
            </div>
            <div style={{
              fontFamily: 'Almarai, sans-serif',
              fontWeight: 700,
              fontSize: '0.88rem',
              color: 'var(--text)',
              lineHeight: 1.3,
            }}>
              مجوهرات سليمان المضيان
            </div>
          </div>
          <div style={{ color: 'var(--text-faint)', fontSize: '0.68rem', marginTop: '4px', paddingRight: '40px' }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        {/* Search / palette button */}
        <div style={{ padding: '10px 10px 0' }}>
          <button
            onClick={() => setPaletteOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              background: 'var(--bg-soft)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.80rem',
              fontFamily: 'Almarai, sans-serif',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Icons.Search size={13} stroke="var(--text-muted)" />
            <span style={{ flex: 1, textAlign: 'right' }}>بحث سريع…</span>
            <kbd style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '1px 5px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--text-faint)',
            }}>⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1 }}>
          {visibleNav.map(({ to, Icon: NavIcon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                color: isActive ? 'var(--primary)' : 'var(--text-soft)',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s ease',
              })}
            >
              <NavIcon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-faint)',
              borderRadius: '6px',
              padding: '7px 10px',
              fontSize: '0.80rem',
              fontFamily: 'Almarai, sans-serif',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#DC2626';
              e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)';
              e.currentTarget.style.background = 'rgba(220,38,38,0.04)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-faint)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icons.Logout size={13} />
            تسجيل الخروج
          </button>
          <div style={{ color: 'var(--text-faint)', fontSize: '0.60rem', marginTop: '8px', textAlign: 'center' }}>
            يتطلب Chrome أو Edge للطباعة
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'transparent' }}>
        {children}
      </main>

      {/* Bottom tab bar — mobile */}
      <nav className="bottom-tab-bar">
        {visibleMobileNav.map(({ to, Icon: TabIcon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
          >
            <TabIcon size={20} className="tab-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="tab-item"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
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
