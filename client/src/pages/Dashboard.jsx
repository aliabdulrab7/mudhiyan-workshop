import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getStats, getOrders } from '../api/orders';
import { getRole } from '../api/auth';
import OrderList from '../components/OrderList';
import Toast from '../components/Toast';
import { useApprovalNotifications } from '../hooks/useApprovalNotifications';
import SkeletonLoader from '../components/SkeletonLoader';

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
  { key: 'received',         label: 'مستلمة',          icon: '◈', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))' },
  { key: 'pending_approval', label: 'بانتظار الموافقة', icon: '⏳', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' },
  { key: 'in_progress',      label: 'قيد العمل',        icon: '⟳', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))' },
  { key: 'ready',            label: 'جاهزة',            icon: '✓', gradient: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.04))' },
  { key: 'delivered',        label: 'مُسلَّمة',         icon: '✦', gradient: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))' },
];

const STATUS_COLORS = {
  received: '#818CF8',
  pending_approval: '#FBBF24',
  in_progress: '#60A5FA',
  ready: '#34D399',
  delivered: '#A78BFA',
};

export default function Dashboard() {
  const [stats, setStats]             = useState(null);
  const [actionOrders, setActionOrders] = useState({ received: [], pending: [] });
  const [filterStatus, setFilterStatus] = useState('all');
  const [refresh, setRefresh]         = useState(0);
  const [toasts, setToasts]           = useState([]);
  const isMobile  = useMobile();
  const navigate  = useNavigate();
  const isWorkshop = getRole() === 'workshop';

  async function loadData() {
    const [s, received, pending] = await Promise.all([
      getStats().catch(() => null),
      isWorkshop ? getOrders({ status: 'received' })         : Promise.resolve([]),
      isWorkshop ? getOrders({ status: 'pending_approval' }) : Promise.resolve([]),
    ]);
    if (s) setStats(s);
    setActionOrders({ received, pending });
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

  function applyFilter(status) {
    setFilterStatus(status);
  }

  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)' }}
    >
      <Toast
        notifications={toasts.map(t => ({ id: t._toastId, ...t }))}
        onDismiss={dismissToast}
      />

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.6rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.01em',
        }}>
          لوحة الطلبات
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '6px' }}>{dateStr}</div>
      </div>

      {/* Action panels — workshop only */}
      {isWorkshop && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '14px',
          marginBottom: '28px',
        }}>
          <ActionPanel
            icon="◈" title="تنتظر التقييم"
            count={actionOrders.received.length}
            accent="#818CF8"
            emptyText="لا توجد طلبات جديدة"
            orders={actionOrders.received}
            active={filterStatus === 'received'}
            onFilterClick={() => applyFilter(filterStatus === 'received' ? 'all' : 'received')}
          />
          <ActionPanel
            icon="⏳" title="بانتظار موافقة العميل"
            count={actionOrders.pending.length}
            accent="#FBBF24"
            emptyText="لا توجد طلبات بانتظار الموافقة"
            orders={actionOrders.pending}
            active={filterStatus === 'pending_approval'}
            onFilterClick={() => applyFilter(filterStatus === 'pending_approval' ? 'all' : 'pending_approval')}
            highlight={actionOrders.pending.length > 0}
          />
        </div>
      )}

      {/* Stat cards */}
      {stats ? (
        <div
          className={isMobile ? 'scroll-row' : ''}
          style={isMobile ? {
            display: 'flex', gap: '10px', marginBottom: '24px',
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            marginBottom: '28px',
          }}
        >
          {STAT_CARDS.map(({ key, label, icon, gradient }, i) => (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => applyFilter(filterStatus === key ? 'all' : key)}
              style={{
                background: filterStatus === key ? `${gradient}, rgba(212,168,67,0.04)` : gradient,
                border: `1px solid ${filterStatus === key ? 'rgba(196,152,48,0.30)' : 'rgba(196,152,48,0.10)'}`,
                borderRadius: '14px',
                padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: '8px',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.2s ease',
                ...(isMobile ? { minWidth: '120px', flexShrink: 0 } : {}),
                boxShadow: filterStatus === key ? '0 0 20px rgba(212,168,67,0.06)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: STATUS_COLORS[key], fontSize: '0.85rem' }}>{icon}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</span>
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: STATUS_COLORS[key],
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1,
              }}>
                {stats[key] ?? 0}
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <SkeletonLoader type="stats" isMobile={isMobile} />
      )}

      <div className="gold-line" style={{ marginBottom: '24px' }} />

      <OrderList
        key={filterStatus}
        defaultStatus={filterStatus}
        refresh={refresh}
        onRefresh={() => setRefresh(r => r + 1)}
      />

      {isMobile && (
        <button className="fab-new-order" onClick={() => navigate('/new')} aria-label="صيانة جديدة">
          ✦
        </button>
      )}
    </motion.div>
  );
}

function ActionPanel({ icon, title, count, accent, emptyText, orders, active, onFilterClick, highlight }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onFilterClick}
      style={{
        background: 'rgba(17,24,42,0.6)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${highlight && count > 0 ? `${accent}33` : 'rgba(255,255,255,0.04)'}`,
        borderRadius: '16px',
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        outline: active ? `2px solid ${accent}` : 'none',
        outlineOffset: '2px',
        boxShadow: count > 0 ? `0 0 24px ${accent}08` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1rem', color: accent }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <span style={{
          background: count > 0 ? `${accent}18` : 'rgba(255,255,255,0.04)',
          color: count > 0 ? accent : 'var(--text-muted)',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 800,
          fontSize: '0.95rem',
          padding: '3px 12px',
          borderRadius: '20px',
          border: `1px solid ${count > 0 ? `${accent}30` : 'transparent'}`,
        }}>
          {count}
        </span>
      </div>

      {count === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {orders.slice(0, 3).map(o => (
            <div key={o.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              fontSize: '0.8rem',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.customer_name}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: accent, fontSize: '0.72rem' }}>
                {o.order_number}
              </span>
            </div>
          ))}
          {count > 3 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', paddingTop: '2px' }}>
              +{count - 3} أخرى
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
