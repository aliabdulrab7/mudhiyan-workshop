import React, { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus } from '../api/orders';
import StatusBadge, { STATUS } from './StatusBadge';
import OrderDetail from './OrderDetail';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';
import { buildReadyWaUrl } from '../utils/whatsapp';

function useMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

const FILTERS = [
  { value: 'all',              label: 'الكل' },
  { value: 'received',         label: 'مستلمة' },
  { value: 'pending_approval', label: 'بانتظار الموافقة' },
  { value: 'in_progress',      label: 'قيد العمل' },
  { value: 'ready',            label: 'جاهزة' },
  { value: 'delivered',        label: 'تم التسليم' },
];

export default function OrderList({ refresh, defaultStatus = 'all', onRefresh }) {
  const [orders, setOrders]       = useState([]);
  const [status, setStatus]       = useState(defaultStatus);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const navigate   = useNavigate();
  const isMobile   = useMobile();
  const isWorkshop = getRole() === 'workshop';

  function handleOrderUpdated(updated) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelected(updated);
    onRefresh?.();
  }

  useEffect(() => {
    setLoading(true);
    getOrders({ status, search })
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, search, refresh]);

  async function changeStatus(order, newStatus) {
    try {
      const updated = await updateOrderStatus(order.id, newStatus);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
    } catch (e) {
      console.error(e);
    }
  }

  function formatDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('ar-SA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  const nextStatus = {
    received:         'in_progress',
    pending_approval: 'in_progress',
    in_progress:      'ready',
    ready:            'delivered',
  };

  const nextLabel = {
    received:         'بدء الإصلاح',
    pending_approval: 'موافقة يدوية',
    in_progress:      'تعيين جاهزة',
    ready:            'تسليم',
  };

  return (
    <div>
      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }} className={isMobile ? 'scroll-row' : ''}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className="filter-chip"
              style={{
                background: status === f.value ? 'rgba(201,168,76,0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${status === f.value ? 'var(--gold)' : 'var(--gold-border)'}`,
                color: status === f.value ? 'var(--gold)' : 'var(--text-secondary)',
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '0.82rem',
                fontFamily: 'Almarai, sans-serif',
                fontWeight: status === f.value ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input-base"
          type="text"
          placeholder="بحث باسم العميل أو رقم الطلب..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={isMobile ? { width: '100%' } : { maxWidth: '280px' }}
        />
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
          جاري التحميل...
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          color: 'var(--text-muted)',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px dashed var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.4 }}>◈</div>
          لا توجد طلبات
        </div>
      ) : isMobile ? (
        /* ── Mobile card view ── */
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {orders.map((order, i) => (
            <div key={order.id} className="order-row row-animate" style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(201,168,76,0.08)',
              animationDelay: `${i * 30}ms`,
              cursor: 'pointer',
            }} onClick={() => setSelected(order)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span className="order-stamp">{order.order_number}</span>
                <StatusBadge status={order.status} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '3px' }}>{order.customer_name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>
                {order.piece_type}{order.notes ? ` — ${order.notes.slice(0, 40)}` : ''} · {formatDate(order.created_at)}
              </div>
              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                {isWorkshop && nextStatus[order.status] && (
                  <button
                    className={isMobile ? 'btn-ghost mobile-status-btn' : 'btn-ghost-sm'}
                    onClick={() => changeStatus(order, nextStatus[order.status])}
                  >
                    {nextLabel[order.status]}
                  </button>
                )}
                {order.status === 'delivered' && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Desktop table view ── */
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr 110px 120px 130px 140px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--gold-border)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            <span>رقم الطلب</span>
            <span>العميل / القطعة</span>
            <span>الجوال</span>
            <span>التاريخ</span>
            <span>الحالة</span>
            <span>إجراء</span>
          </div>

          {/* Rows */}
          {orders.map((order, i) => (
            <div
              key={order.id}
              className="order-row row-animate"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 110px 120px 130px 140px',
                padding: '13px 16px',
                borderBottom: i < orders.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none',
                alignItems: 'center',
                animationDelay: `${i * 30}ms`,
                cursor: 'pointer',
              }}
              onClick={() => setSelected(order)}
            >
              <span className="order-stamp">{order.order_number}</span>

              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order.customer_name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {order.piece_type}{order.notes ? ` — ${order.notes.slice(0, 30)}` : ''}
                </div>
              </div>

              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}>
                {order.phone.slice(-9)}
              </span>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {formatDate(order.created_at)}
              </span>

              <StatusBadge status={order.status} />

              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                {isWorkshop && nextStatus[order.status] && (
                  <button
                    className="btn-ghost-sm"
                    onClick={() => changeStatus(order, nextStatus[order.status])}
                  >
                    {nextLabel[order.status]}
                  </button>
                )}
                {order.status === 'delivered' && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order detail panel */}
      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
}
