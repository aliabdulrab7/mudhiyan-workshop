import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getOrders } from '../api/orders';
import { getRole } from '../api/auth';
import OrderList from '../components/OrderList';
import Toast from '../components/Toast';
import { useApprovalNotifications } from '../hooks/useApprovalNotifications';

function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

export default function Dashboard() {
  const [stats, setStats]             = useState(null);
  const [actionOrders, setActionOrders] = useState({ received: [], pending: [] });
  const [filterStatus, setFilterStatus] = useState('all');
  const [refresh, setRefresh]         = useState(0);
  const [toasts, setToasts]           = useState([]);
  const isMobile  = useMobile();
  const navigate  = useNavigate();
  const isWorkshop = getRole() === 'workshop';

  // Load stats + action-required orders
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

  // Notification handler
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
    <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)' }}>

      {/* In-app toast notifications */}
      <Toast
        notifications={toasts.map(t => ({ id: t._toastId, ...t }))}
        onDismiss={dismissToast}
      />

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          لوحة الطلبات
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>{dateStr}</div>
      </div>

      {/* ── Action-required panels — workshop only ── */}
      {isWorkshop && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '14px',
          marginBottom: '28px',
        }}>
          {/* Received — needs cost assessment */}
          <ActionPanel
            icon="◈"
            title="تنتظر التقييم"
            count={actionOrders.received.length}
            accent="var(--status-received-fg)"
            accentBg="var(--status-received-bg)"
            emptyText="لا توجد طلبات جديدة"
            orders={actionOrders.received}
            active={filterStatus === 'received'}
            onFilterClick={() => applyFilter(filterStatus === 'received' ? 'all' : 'received')}
          />

          {/* Pending approval — waiting for customer */}
          <ActionPanel
            icon="⏳"
            title="بانتظار موافقة العميل"
            count={actionOrders.pending.length}
            accent="var(--status-pending-fg)"
            accentBg="var(--status-pending-bg)"
            emptyText="لا توجد طلبات بانتظار الموافقة"
            orders={actionOrders.pending}
            active={filterStatus === 'pending_approval'}
            onFilterClick={() => applyFilter(filterStatus === 'pending_approval' ? 'all' : 'pending_approval')}
            highlight={actionOrders.pending.length > 0}
          />
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <div
          className={isMobile ? 'scroll-row' : ''}
          style={isMobile ? {
            display: 'flex', gap: '12px', marginBottom: '24px',
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          {[
            { key: 'received',         label: 'مستلمة',          icon: '◈', color: 'var(--status-received-fg)'  },
            { key: 'pending_approval', label: 'بانتظار الموافقة', icon: '⏳', color: 'var(--status-pending-fg)'   },
            { key: 'in_progress',      label: 'قيد العمل',        icon: '⟳', color: 'var(--status-progress-fg)'  },
            { key: 'ready',            label: 'جاهزة',            icon: '✓', color: 'var(--status-ready-fg)'      },
            { key: 'delivered',        label: 'مُسلَّمة',         icon: '✦', color: 'var(--gold)'                  },
          ].map(({ key, label, icon, color }) => (
            <button
              key={key}
              onClick={() => applyFilter(filterStatus === key ? 'all' : key)}
              style={{
                background: filterStatus === key ? 'rgba(201,151,58,0.08)' : 'var(--bg-surface)',
                border: `1px solid ${filterStatus === key ? 'var(--gold)' : 'var(--gold-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: '6px',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.15s',
                ...(isMobile ? { minWidth: '110px', flexShrink: 0 } : {}),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color, fontSize: '0.9rem' }}>{icon}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                {stats[key] ?? 0}
              </div>
            </button>
          ))}
        </div>
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
    </div>
  );
}

function ActionPanel({ icon, title, count, accent, accentBg, emptyText, orders, active, onFilterClick, highlight }) {
  return (
    <div
      onClick={onFilterClick}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${highlight && count > 0 ? accent : 'var(--gold-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: active ? `2px solid ${accent}` : 'none',
        outlineOffset: '2px',
      }}
    >
      {/* Panel header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem', color: accent }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <span style={{
          background: count > 0 ? accentBg : 'var(--bg-elevated)',
          color: count > 0 ? accent : 'var(--text-muted)',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 800,
          fontSize: '0.95rem',
          padding: '2px 10px',
          borderRadius: '20px',
          border: `1px solid ${count > 0 ? accent : 'transparent'}`,
        }}>
          {count}
        </span>
      </div>

      {/* Order snippets */}
      {count === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {orders.slice(0, 3).map(o => (
            <div key={o.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px',
              background: 'var(--bg-elevated)',
              borderRadius: '6px',
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
    </div>
  );
}
