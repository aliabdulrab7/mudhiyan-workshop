import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearAuth, getRole, getUsername } from '../api/auth';
import { getOrders } from '../api/orders';
import { useSettings } from '../contexts/SettingsContext';
import { isMuted, setMuted } from '../utils/bulkScanAudio';
import CommandPalette from './CommandPalette';
import ChangePasswordDialog from './ChangePasswordDialog';
import Dropdown from './ui/Dropdown';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import Select from './ui/Select';
import { Icons } from './icons';

const LABEL_PRESET_OPTIONS = [
  { value: '50x30',   label: '50×30 مم (Niimbot)' },
  { value: '57x32',   label: '57×32 مم' },
  { value: '80x50',   label: '80×50 مم' },
  { value: '100x50',  label: '100×50 مم' },
  { value: '100x100', label: '100×100 مم (شحن)' },
  { value: 'a4',      label: 'A4 (ورقة عادية)' },
];

const PRINTER_MODE_OPTIONS = [
  { value: 'universal', label: 'متصفح / طابعة النظام' },
  { value: 'niimbot',   label: 'Niimbot B21 (بلوتوث)' },
];

function labelFor(options, value, fallback) {
  return options.find((o) => o.value === value)?.label ?? fallback;
}

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
  { to: '/roles',          icon: Icons.User,     label: 'الأدوار',       roles: ['workshop'] },
  { to: '/specializations',  icon: Icons.Tag,    label: 'التخصصات',     roles: ['workshop'] },
  { to: '/workshop-status', icon: Icons.Layers, label: 'حالة الورشة',  roles: ['workshop'] },
  { to: '/spec-map',        icon: Icons.Tag,    label: 'خريطة التخصصات', roles: ['workshop'] },
  { to: '/scheduler',       icon: Icons.Clock,  label: 'الجدولة',         roles: ['workshop'] },
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
  '/roles':         'الأدوار',
  '/specializations':  'التخصصات',
  '/workshop-status':  'حالة الورشة',
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();
  const username = getUsername();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const { settings, status: settingsStatus, ensureLoaded, updateSetting } = useSettings();
  const [labelDialogOpen, setLabelDialogOpen]     = useState(false);
  const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

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
            <Button
              as={NavLink}
              to="/new"
              variant="primary"
              size="sm"
              icon={<Icons.Plus size={12} />}
              testId="layout__topbar__new-order-link"
            >
              صيانة جديدة
            </Button>
            <Dropdown
              align="end"
              testId="layout__user-menu"
              onOpenChange={(open) => { if (open) ensureLoaded(); }}
              trigger={
                <Button
                  variant="subtle"
                  size="sm"
                  icon={<Icons.Settings size={13} />}
                  testId="layout__topbar__action__settings"
                  aria-label="القائمة"
                  className="!px-1.5"
                />
              }
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint">المستخدم</div>
                <div className="text-sm font-semibold text-text mt-0.5" dir="ltr" style={{ textAlign: 'start' }}>
                  {username}
                </div>
                <div className="text-[11px] text-text-faint mt-0.5">
                  {role === 'workshop' ? 'مدير الورشة' : 'موظف الفرع'}
                </div>
              </div>

              <Dropdown.Section title="خيارات الطباعة">
                <Dropdown.Item
                  testId="user-menu__label-preset"
                  onSelect={() => setLabelDialogOpen(true)}
                >
                  <span className="flex-1 truncate">حجم الملصق الافتراضي</span>
                  <span className="text-[11px] text-text-faint flex-shrink-0">
                    {settingsStatus === 'error'
                      ? 'تعذر التحميل'
                      : settingsStatus !== 'ready'
                        ? '…'
                        : labelFor(LABEL_PRESET_OPTIONS, settings?.default_label_preset, 'افتراضي')}
                  </span>
                </Dropdown.Item>
                <Dropdown.Item
                  testId="user-menu__printer-mode"
                  onSelect={() => setPrinterDialogOpen(true)}
                >
                  <span className="flex-1 truncate">وضع الطابعة الافتراضي</span>
                  <span className="text-[11px] text-text-faint flex-shrink-0">
                    {settingsStatus === 'error'
                      ? 'تعذر التحميل'
                      : settingsStatus !== 'ready'
                        ? '…'
                        : labelFor(PRINTER_MODE_OPTIONS, settings?.default_printer_mode, 'افتراضي')}
                  </span>
                </Dropdown.Item>
              </Dropdown.Section>

              <Dropdown.Section title="الصوت">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  data-testid="user-menu__sound-toggle"
                  aria-checked={!muted}
                  onClick={toggleSound}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start outline-none focus:bg-bg-soft transition-colors text-text hover:bg-bg-soft"
                >
                  <span className="flex-1 truncate">صوت المسح</span>
                  <span
                    className={`text-[11px] flex-shrink-0 ${muted ? 'text-text-faint' : 'text-[var(--success)]'}`}
                  >
                    {muted ? 'إيقاف' : 'تشغيل'}
                  </span>
                </button>
              </Dropdown.Section>

              <Dropdown.Separator />

              <Dropdown.Item
                testId="user-menu__change-password"
                onSelect={() => setChangePasswordOpen(true)}
              >
                تغيير كلمة المرور
              </Dropdown.Item>

              <Dropdown.Separator />

              <Dropdown.Item
                testId="user-menu__logout"
                destructive
                icon={<Icons.Logout size={14} />}
                onSelect={handleLogout}
              >
                تسجيل الخروج
              </Dropdown.Item>
            </Dropdown>
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

      <SettingDialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        title="حجم الملصق الافتراضي"
        testId="settings-dialog__label-preset"
        currentValue={settings?.default_label_preset || ''}
        options={LABEL_PRESET_OPTIONS}
        onSave={(v) => updateSetting('default_label_preset', v || null)}
      />
      <SettingDialog
        open={printerDialogOpen}
        onClose={() => setPrinterDialogOpen(false)}
        title="وضع الطابعة الافتراضي"
        testId="settings-dialog__printer-mode"
        currentValue={settings?.default_printer_mode || ''}
        options={PRINTER_MODE_OPTIONS}
        onSave={(v) => updateSetting('default_printer_mode', v || null)}
      />

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}

function SettingDialog({ open, onClose, title, testId, currentValue, options, onSave }) {
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  // Reset draft to current server value every time the dialog opens, so reopening
  // after a cancel or after another path changed the value never shows stale draft.
  useEffect(() => {
    if (open) setValue(currentValue);
  }, [open, currentValue]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } catch (_) {
      // SettingsContext already toasted + reverted; keep dialog open so user can retry.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? () => {} : onClose} title={title} size="sm" testId={testId}>
      <Dialog.Body>
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          options={[{ value: '', label: 'استخدام الإعداد الافتراضي للتطبيق' }, ...options]}
          testId={`${testId}__select`}
        />
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving} testId={`${testId}__cancel`}>
          إلغاء
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} testId={`${testId}__save`}>
          حفظ
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
