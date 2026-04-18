import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrders, updateOrderStatus } from '../api/orders';
import StatusPill from './StatusPill';
import DataTable from './DataTable';
import OrderDetail from './OrderDetail';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';
import { buildTrackingUrl } from '../utils/whatsapp';
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
  { value: 'new',              label: 'جديد' },
  { value: 'received',         label: 'مستلمة' },
  { value: 'inspection',       label: 'قيد الفحص' },
  { value: 'waiting_approval', label: 'بانتظار الموافقة' },
  { value: 'approved',         label: 'موافق عليها' },
  { value: 'rejected',         label: 'مرفوضة' },
  { value: 'in_repair',        label: 'قيد الإصلاح' },
  { value: 'quality_check',    label: 'فحص الجودة' },
  { value: 'ready_for_return', label: 'جاهزة للإرجاع' },
  { value: 'returned_to_shop', label: 'وصلت للفرع' },
  { value: 'delivered',        label: 'تم التسليم' },
];

const nextStatus = {
  new:           'received',
  received:      'inspection',
  in_repair:     'quality_check',
  quality_check: 'ready_for_return',
};

const nextLabel = {
  new:           'استلام في الورشة',
  received:      'بدء الفحص',
  in_repair:     'فحص الجودة',
  quality_check: 'جاهز للإرجاع',
};

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function OrderList({ refresh, defaultStatus = 'all', onRefresh, shopId = null }) {
  const [orders, setOrders]       = useState([]);
  const [status, setStatus]       = useState(defaultStatus);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [listError, setListError] = useState('');
  const [copiedId, setCopiedId]   = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const isMobile   = useMobile();
  const isWorkshop = getRole() === 'workshop';

  function copyTrackingLink(order, e) {
    e.stopPropagation();
    if (!order.customer_token) return;
    navigator.clipboard.writeText(buildTrackingUrl(order.customer_token)).then(() => {
      setCopiedId(order.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleOrderUpdated(updated) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelected(updated);
    onRefresh?.();
  }

  useEffect(() => {
    setLoading(true);
    setListError('');
    getOrders({ status, search, shop_id: shopId })
      .then(data => { setOrders(data); setBulkSelected(new Set()); })
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

  function ActionCell({ order }) {
    return (
      <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
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
        {order.customer_token && (
          <button
            className="btn-ghost-sm"
            onClick={e => copyTrackingLink(order, e)}
            title="نسخ رابط المتابعة"
            style={copiedId === order.id
              ? { color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)', padding: '3px 8px' }
              : { padding: '3px 8px' }
            }
          >
            {copiedId === order.id ? '✓' : '⎘'}
          </button>
        )}
      </div>
    );
  }

  const columns = [
    {
      key: 'order_number',
      label: 'رقم الطلب',
      width: 160,
      render: row => <span className="order-stamp">{row.order_number}</span>,
    },
    {
      key: 'customer',
      label: 'العميل / القطعة',
      render: row => (
        <div>
          <div className="text-sm font-semibold text-text">{row.customer_name}</div>
          <div className="text-xs text-text-muted mt-0.5">
            {row.piece_type}{row.notes ? ` — ${row.notes.slice(0, 30)}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'الجوال',
      width: 110,
      mono: true,
      render: row => <span className="text-text-soft">{row.phone.slice(-9)}</span>,
    },
    {
      key: 'created_at',
      label: 'التاريخ',
      width: 120,
      render: row => <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'status',
      label: 'الحالة',
      width: 160,
      render: row => <StatusPill status={row.status} size="sm" />,
    },
    {
      key: 'actions',
      label: 'إجراء',
      width: 150,
      render: row => <ActionCell order={row} />,
    },
  ];

  return (
    <div>
      {/* Filters + Search */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className={`flex gap-1.5 ${isMobile ? 'scroll-row' : ''}`}>
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
        <div className="px-3.5 py-2.5 mb-3 rounded text-sm"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)', color: '#DC2626' }}>
          {listError}
        </div>
      )}

      {/* Table / Cards */}
      {loading ? (
        <SkeletonLoader type="list" count={4} isMobile={isMobile} />
      ) : isMobile ? (
        /* ── Mobile card view ── */
        <div className="bg-bg-raised border border-border rounded-lg overflow-hidden">
          <AnimatePresence mode="popLayout">
            {orders.length === 0 ? (
              <div className="py-16 text-center text-text-muted text-sm">
                {status === 'all' && !search ? 'لا توجد طلبات بعد' : 'لا توجد طلبات تطابق هذا الفلتر'}
              </div>
            ) : orders.map((order, i) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                className="order-row p-4 border-b border-border-faint last:border-0 cursor-pointer"
                onClick={() => setSelected(order)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="order-stamp">{order.order_number}</span>
                  <StatusPill status={order.status} size="sm" />
                </div>
                <div className="font-semibold text-[0.95rem] mb-1">{order.customer_name}</div>
                <div className="text-text-muted text-xs mb-3">
                  {order.piece_type}{order.notes ? ` — ${order.notes.slice(0, 40)}` : ''} · {formatDate(order.created_at)}
                </div>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  {isWorkshop && nextStatus[order.status] && (
                    <button
                      className="btn-ghost mobile-status-btn"
                      onClick={() => changeStatus(order, nextStatus[order.status])}
                    >
                      {nextLabel[order.status]}
                    </button>
                  )}
                  {!isWorkshop && order.status === 'ready_for_return' && (
                    <button
                      className="btn-gold mobile-status-btn"
                      onClick={() => changeStatus(order, 'returned_to_shop')}
                    >
                      ✓ تأكيد الوصول
                    </button>
                  )}
                  {order.customer_token && (
                    <button
                      className="btn-ghost mobile-status-btn"
                      onClick={e => copyTrackingLink(order, e)}
                      style={copiedId === order.id ? { color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)' } : {}}
                    >
                      {copiedId === order.id ? '✓' : '⎘'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Desktop DataTable view ── */
        <DataTable
          columns={columns}
          rows={orders}
          selected={bulkSelected}
          onSelect={setBulkSelected}
          getRowKey={row => row.id}
          onRowClick={row => setSelected(row)}
        />
      )}

      {/* Bulk selection bar */}
      <AnimatePresence>
        {bulkSelected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-text text-white rounded-full px-5 py-2.5 flex items-center gap-4 shadow-lg z-50 text-sm font-medium"
          >
            <span className="font-mono">{bulkSelected.size}</span> طلب محدد
            <button
              className="text-white/60 hover:text-white transition-colors text-xs"
              onClick={() => setBulkSelected(new Set())}
            >
              إلغاء
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order detail panel */}
      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleOrderUpdated}
        />
      )}

      {/* Copy toast */}
      <AnimatePresence>
        {copiedId && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-text text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-50 flex items-center gap-2 whitespace-nowrap"
          >
            <span style={{ color: '#4ADE80' }}>✓</span> تم نسخ رابط المتابعة
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
