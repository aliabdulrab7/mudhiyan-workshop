import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getStats, getOrders, getBranchStats } from '../api/orders';
import { getRole } from '../api/auth';
import OrderList from '../components/OrderList';
import StatusPill from '../components/StatusPill';
import Toast from '../components/Toast';
import { useApprovalNotifications } from '../hooks/useApprovalNotifications';
import SkeletonLoader from '../components/SkeletonLoader';
import { Icons } from '../components/icons';

function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

const STAT_CARDS = [
  { key: 'new',              label: 'جديد',              color: '#64748B' },
  { key: 'received',         label: 'مستلمة',            color: '#2980B9' },
  { key: 'inspection',       label: 'قيد الفحص',          color: '#7C3AED' },
  { key: 'waiting_approval', label: 'بانتظار الموافقة',   color: '#D97706' },
  { key: 'in_repair',        label: 'قيد الإصلاح',        color: '#1A6EA0' },
  { key: 'quality_check',    label: 'فحص الجودة',         color: '#6B7280' },
  { key: 'ready_for_return', label: 'جاهزة للإرجاع',      color: '#16A34A' },
  { key: 'returned_to_shop', label: 'وصلت للفرع',         color: '#059669' },
];

export default function Dashboard() {
  const [stats, setStats]               = useState(null);
  const [actionOrders, setActionOrders] = useState({ received: [], pending: [], rejected: [] });
  const [branchStats, setBranchStats]   = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [refresh, setRefresh]           = useState(0);
  const [toasts, setToasts]             = useState([]);
  const isMobile   = useMobile();
  const navigate   = useNavigate();
  const isWorkshop = getRole() === 'workshop';

  async function loadData() {
    const [s, received, pending, rejected, branches] = await Promise.all([
      getStats().catch(() => null),
      isWorkshop ? getOrders({ status: 'received' })         : Promise.resolve([]),
      isWorkshop ? getOrders({ status: 'waiting_approval' }) : Promise.resolve([]),
      isWorkshop ? getOrders({ status: 'rejected' })         : Promise.resolve([]),
      isWorkshop ? getBranchStats().catch(() => [])          : Promise.resolve([]),
    ]);
    if (s) setStats(s);
    setActionOrders({ received, pending, rejected });
    setBranchStats(branches);
  }

  useEffect(() => { loadData(); }, [refresh]);

  const handleApproved = useCallback((order) => {
    setToasts(prev => [...prev, { ...order, _toastId: Date.now() + Math.random() }]);
    setRefresh(r => r + 1);
  }, []);

  useApprovalNotifications(handleApproved);

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t._toastId !== id));
  }

  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const branchMax = Math.max(...branchStats.map(b => (b.received || 0) + (b.in_progress || 0) + (b.ready || 0) + (b.pending_approval || 0)), 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)' }}
    >
      <Toast
        notifications={toasts.map(t => ({ id: t._toastId, ...t }))}
        onDismiss={dismissToast}
      />

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text m-0 mb-1">لوحة الطلبات</h1>
          <div className="text-xs text-text-muted">{dateStr}</div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost-sm flex items-center gap-1.5"
            onClick={() => setRefresh(r => r + 1)}
          >
            <Icons.Refresh size={11} />
            تحديث
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {stats ? (
        <div
          className={isMobile ? 'scroll-row' : ''}
          style={isMobile ? {
            display: 'flex', gap: '10px', marginBottom: '20px',
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          {STAT_CARDS.map(({ key, label, color }, i) => (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
              className="stat-card text-right transition-all"
              style={{
                background: filterStatus === key
                  ? `color-mix(in oklch, ${color} 9%, var(--bg-raised))`
                  : 'var(--bg-raised)',
                border: `1px solid ${filterStatus === key
                  ? `color-mix(in oklch, ${color} 30%, var(--border))`
                  : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '14px 14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                ...(isMobile ? { minWidth: '118px', flexShrink: 0 } : {}),
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[11px] text-text-muted leading-tight">{label}</span>
              </div>
              <div className="font-mono text-3xl font-semibold leading-none" style={{ color }}>
                {stats[key] ?? 0}
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <SkeletonLoader type="stats" isMobile={isMobile} />
      )}

      {/* ── Action panels — workshop only ── */}
      {isWorkshop && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <ActionPanel
            icon={<Icons.Inbox size={14} />}
            title="تنتظر التقييم"
            count={actionOrders.received.length}
            color="#2980B9"
            emptyText="لا توجد طلبات جديدة"
            orders={actionOrders.received}
            active={filterStatus === 'received'}
            onFilterClick={() => setFilterStatus(filterStatus === 'received' ? 'all' : 'received')}
          />
          <ActionPanel
            icon={<Icons.Orders size={14} />}
            title="بانتظار موافقة العميل"
            count={actionOrders.pending.length}
            color="#D97706"
            emptyText="لا توجد طلبات بانتظار الموافقة"
            orders={actionOrders.pending}
            active={filterStatus === 'waiting_approval'}
            onFilterClick={() => setFilterStatus(filterStatus === 'waiting_approval' ? 'all' : 'waiting_approval')}
            highlight={actionOrders.pending.length > 0}
          />
        </div>
      )}

      {/* ── Rejected alert ── */}
      <AnimatePresence>
        {isWorkshop && actionOrders.rejected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(220,38,38,0.25)', borderTop: '2px solid #DC2626' }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-bg-raised border-b" style={{ borderColor: 'rgba(220,38,38,0.12)' }}>
              <div className="flex items-center gap-2">
                <Icons.Warn size={14} stroke="#DC2626" />
                <span className="font-bold text-sm" style={{ color: '#DC2626' }}>طلبات مرفوضة — يجب إعادتها للفرع</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ color: '#DC2626', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.20)' }}>
                  {actionOrders.rejected.length}
                </span>
              </div>
              <button
                onClick={() => setFilterStatus('rejected')}
                className="text-xs cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: '#DC2626', fontFamily: 'Almarai, sans-serif' }}
              >
                عرض الكل ←
              </button>
            </div>
            {actionOrders.rejected.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-faint last:border-0 bg-bg-raised text-sm">
                <span className="font-mono text-xs" style={{ color: '#DC2626' }}>{o.order_number}</span>
                <span className="font-semibold flex-1 text-text">{o.customer_name}</span>
                <span className="text-text-muted">{o.piece_type}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Branch load — workshop only ── */}
      {isWorkshop && branchStats.length > 0 && (
        <div className="bg-bg-raised border border-border rounded-lg mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Icons.Branch size={13} stroke="var(--text-muted)" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">الفروع</span>
            </div>
            {selectedBranch && (
              <button
                onClick={() => setSelectedBranch(null)}
                className="text-xs cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontFamily: 'Almarai, sans-serif' }}
              >
                ← عرض الكل
              </button>
            )}
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            {branchStats.map(branch => {
              const total = (branch.received || 0) + (branch.in_progress || 0) + (branch.ready || 0) + (branch.pending_approval || 0);
              const ready = branch.ready || 0;
              const isActive = selectedBranch === branch.shop_id;
              return (
                <div
                  key={branch.shop_id}
                  className={`grid items-center gap-3 cursor-pointer py-1 px-2 rounded transition-colors ${isActive ? 'bg-[var(--primary-soft)]' : 'hover:bg-bg-soft'}`}
                  style={{ gridTemplateColumns: '1fr 120px 40px' }}
                  onClick={() => setSelectedBranch(isActive ? null : branch.shop_id)}
                >
                  <span className="text-sm text-text truncate">{branch.shop_name}</span>
                  <div className="h-2 bg-bg-soft rounded overflow-hidden relative">
                    <div className="h-full rounded transition-all" style={{ width: `${(total / branchMax) * 100}%`, background: 'var(--primary)' }} />
                    {ready > 0 && (
                      <div className="absolute inset-y-0 rounded transition-all" style={{ width: `${(ready / branchMax) * 100}%`, background: '#16A34A', left: 0 }} />
                    )}
                  </div>
                  <span className="font-mono text-xs text-text-muted text-left">{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="gold-line mb-5" />

      {/* ── Orders table ── */}
      <OrderList
        key={`${filterStatus}-${selectedBranch}`}
        defaultStatus={filterStatus}
        shopId={selectedBranch}
        refresh={refresh}
        onRefresh={() => setRefresh(r => r + 1)}
      />

      {isMobile && (
        <button className="fab-new-order" onClick={() => navigate('/new')} aria-label="صيانة جديدة">
          +
        </button>
      )}
    </motion.div>
  );
}

function ActionPanel({ icon, title, count, color, emptyText, orders, active, onFilterClick, highlight }) {
  return (
    <div
      onClick={onFilterClick}
      className="bg-bg-raised border rounded-lg overflow-hidden cursor-pointer transition-all"
      style={{
        borderColor: highlight && count > 0 ? `color-mix(in oklch, ${color} 30%, var(--border))` : 'var(--border)',
        borderTop: highlight && count > 0 ? `2px solid ${color}` : undefined,
        boxShadow: active ? `0 0 0 2px ${color}` : 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        <span
          className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-full"
          style={{
            color,
            background: `color-mix(in oklch, ${color} 9%, var(--bg-raised))`,
            border: `1px solid color-mix(in oklch, ${color} 20%, var(--border))`,
          }}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="px-4 py-5 text-xs text-text-faint text-center italic">{emptyText}</div>
      ) : (
        <div className="flex flex-col">
          {orders.slice(0, 4).map(o => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-faint last:border-0 text-sm hover:bg-bg-soft transition-colors">
              <span className="order-stamp text-[11px] px-2 py-0.5">{o.order_number}</span>
              <span className="font-medium text-text flex-1 truncate">{o.customer_name}</span>
              <span className="text-xs text-text-muted">{o.piece_type}</span>
            </div>
          ))}
          {count > 4 && (
            <div className="px-4 py-2 text-xs text-text-faint text-center">
              +{count - 4} أخرى
            </div>
          )}
        </div>
      )}
    </div>
  );
}
