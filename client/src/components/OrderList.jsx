import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrders, updateOrderStatus } from '../api/orders';
import StatusBadge, { STATUS } from './StatusBadge';
import OrderDetail from './OrderDetail';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';
import { buildReadyWaUrl } from '../utils/whatsapp';
import SkeletonLoader from './SkeletonLoader';

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
  { value: 'inspection',       label: 'قيد الفحص' },
  { value: 'waiting_approval', label: 'بانتظار الموافقة' },
  { value: 'in_repair',        label: 'قيد الإصلاح' },
  { value: 'quality_check',    label: 'فحص الجودة' },
  { value: 'ready_for_return', label: 'جاهزة للإرجاع' },
  { value: 'returned_to_shop', label: 'وصلت للفرع' },
  { value: 'delivered',        label: 'تم التسليم' },
];

export default function OrderList({ refresh, defaultStatus = 'all', onRefresh, shopId = null }) {
  const [orders, setOrders]       = useState([]);
  const [status, setStatus]       = useState(defaultStatus);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [listError, setListError] = useState('');
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
    setListError('');
    getOrders({ status, search, shop_id: shopId })
      .then(data => { setOrders(data); })
      .catch(() => setListError('تعذّر تحميل الطلبات، يرجى إعادة المحاولة'))
      .finally(() => setLoading(false));
  }, [status, search, refresh, shopId]);

  async function changeStatus(order, newStatus) {
    try {
      const updated = await updateOrderStatus(order.id, newStatus);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
    } catch (e) {
      setListError(e.message || 'تعذّر تحديث الحالة');
    }
  }

  function formatDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('ar-SA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Workshop quick-advance shortcuts (subset of full state machine)
  const nextStatus = {
    received:      'inspection',
    in_repair:     'quality_check',
    quality_check: 'ready_for_return',
  };

  const nextLabel = {
    received:      'بدء الفحص',
    in_repair:     'فحص الجودة',
    quality_check: 'جاهز للإرجاع',
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
                background: status === f.value ? 'rgba(41,128,185,0.10)' : '#FFFFFF',
                border: `1px solid ${status === f.value ? 'rgba(41,128,185,0.35)' : '#E5E7EB'}`,
                color: status === f.value ? '#2980B9' : 'var(--text-muted)',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '0.82rem',
                fontFamily: 'Almarai, sans-serif',
                fontWeight: status === f.value ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
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

      {/* Error banner */}
      {listError && (
        <div style={{
          padding: '10px 14px', marginBottom: '12px',
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.20)',
          borderRadius: 'var(--radius)',
          color: '#DC2626', fontSize: '0.88rem',
        }}>
          {listError}
        </div>
      )}

      {/* Table / Cards */}
      {loading ? (
        <SkeletonLoader type="list" count={4} isMobile={isMobile} />
      ) : orders.length === 0 ? (
        <div style={{
          color: 'var(--text-muted)',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px dashed #D1D5DB',
          borderRadius: 'var(--radius-lg)',
          background: '#FFFFFF',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.25 }}>◈</div>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>
            {status === 'all' && !search ? 'لا توجد طلبات بعد' : 'لا توجد طلبات تطابق هذا الفلتر'}
          </div>
          {status !== 'all' && (
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              جرّب تغيير الفلتر أو مسح البحث
            </div>
          )}
        </div>
      ) : isMobile ? (
        /* ── Mobile card view ── */
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <AnimatePresence mode="popLayout">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
              className="order-row"
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #F3F4F6',
                cursor: 'pointer',
              }}
              onClick={() => setSelected(order)}
            >
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
                {!isWorkshop && order.status === 'ready_for_return' && (
                  <button
                    className={isMobile ? 'btn-gold mobile-status-btn' : 'btn-ghost-sm'}
                    style={isMobile ? {} : { borderColor: 'rgba(5,150,105,0.4)', color: '#059669' }}
                    onClick={() => changeStatus(order, 'returned_to_shop')}
                  >
                    ✓ تأكيد الوصول
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Desktop table view ── */
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr 110px 120px 130px 140px',
            padding: '10px 18px',
            borderBottom: '1px solid #E5E7EB',
            background: '#F9FAFB',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <span>رقم الطلب</span>
            <span>العميل / القطعة</span>
            <span>الجوال</span>
            <span>التاريخ</span>
            <span>الحالة</span>
            <span>إجراء</span>
          </div>

          {/* Rows */}
          <AnimatePresence mode="popLayout">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
              className="order-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 110px 120px 130px 140px',
                padding: '14px 18px',
                borderBottom: i < orders.length - 1 ? '1px solid #F3F4F6' : 'none',
                alignItems: 'center',
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
                {!isWorkshop && order.status === 'ready_for_return' && (
                  <button
                    className="btn-ghost-sm"
                    style={{ borderColor: 'rgba(5,150,105,0.4)', color: '#059669' }}
                    onClick={() => changeStatus(order, 'returned_to_shop')}
                  >
                    ✓ تأكيد الوصول
                  </button>
                )}
                {order.status === 'delivered' && (
                  <span style={{ color: '#16A34A', fontSize: '0.78rem' }}>✓</span>
                )}
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
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
