import React, { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus } from '../api/orders';
import StatusPill, { PriorityDot } from './StatusPill';
import OrderDetail from './OrderDetail';
import { getRole } from '../api/auth';
import { buildTrackingUrl } from '../utils/whatsapp';
import SkeletonLoader from './SkeletonLoader';
import { Icons } from './icons';

const FILTERS = [
  { value: 'all',              label: 'الكل' },
  { value: 'new',              label: 'جديد' },
  { value: 'received',         label: 'مستلمة' },
  { value: 'inspection',       label: 'قيد الفحص' },
  { value: 'waiting_approval', label: 'بانتظار الموافقة' },
  { value: 'approved',         label: 'موافق عليها' },
  { value: 'in_repair',        label: 'قيد الإصلاح' },
  { value: 'quality_check',    label: 'فحص الجودة' },
  { value: 'ready_for_return', label: 'جاهزة للإرجاع' },
  { value: 'returned_to_shop', label: 'وصلت للفرع' },
  { value: 'delivered',        label: 'تم التسليم' },
];

const NEXT_STATUS = {
  new:           'received',
  received:      'inspection',
  in_repair:     'quality_check',
  quality_check: 'ready_for_return',
};

const NEXT_LABEL = {
  new:           'استلام',
  received:      'بدء الفحص',
  in_repair:     'فحص الجودة',
  quality_check: 'جاهز للإرجاع',
};

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [focusRow, setFocusRow]   = useState(0);
  const [sortCol, setSortCol]     = useState('created_at');
  const [sortDir, setSortDir]     = useState('desc');
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

  async function changeStatus(order, newSt) {
    try {
      const updated = await updateOrderStatus(order.id, newSt);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
    } catch (e) {
      setListError(e.message || 'تعذّر تحديث الحالة');
    }
  }

  function toggleBulk(id) {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const allSelected = orders.length > 0 && orders.every(o => bulkSelected.has(o.id));
  function toggleAll() {
    if (allSelected) setBulkSelected(new Set());
    else setBulkSelected(new Set(orders.map(o => o.id)));
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  // Keyboard j/k navigation
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'j') { e.preventDefault(); setFocusRow(f => Math.min(orders.length - 1, f + 1)); }
      if (e.key === 'k') { e.preventDefault(); setFocusRow(f => Math.max(0, f - 1)); }
      if (e.key === 'x' || e.key === ' ') {
        if (orders[focusRow]) { e.preventDefault(); toggleBulk(orders[focusRow].id); }
      }
      if (e.key === 'Enter') {
        if (orders[focusRow]) { e.preventDefault(); setSelected(orders[focusRow]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orders, focusRow]);

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="sort">⇅</span>;
    return <span className="sort" style={{ opacity: 0.9, color: 'var(--primary)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      {/* Filter chips */}
      <div style={{ padding: '0 24px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`chip${status === f.value ? ' active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {listError && (
        <div style={{
          margin: '0 24px 10px', padding: '10px 14px', fontSize: 12.5,
          background: 'oklch(0.58 0.21 25 / 0.06)', color: 'var(--danger)',
          border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius-sm)',
        }}>
          {listError}
        </div>
      )}

      {loading ? (
        <div style={{ margin: '0 24px' }}>
          <SkeletonLoader type="list" count={5} />
        </div>
      ) : (
        <div className="table-wrap">
          {/* Toolbar */}
          <div className="table-toolbar">
            <Icons.Search size={13} stroke="var(--text-muted)" />
            <input
              className="input"
              style={{ border: 'none', background: 'transparent', height: 26, maxWidth: 280 }}
              placeholder="بحث باسم العميل أو رقم الطلب…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost"><Icons.Filter size={12} /> فلتر</button>
            <button className="btn btn-sm btn-ghost"><Icons.Sort size={12} /> ترتيب</button>
            <button className="btn btn-sm btn-ghost"><Icons.Group size={12} /> تجميع</button>
            <div className="divider" />
            <button className="btn btn-sm btn-ghost btn-icon" onClick={() => onRefresh?.()}>
              <Icons.Refresh size={13} />
            </button>
            <button className="btn btn-sm btn-ghost btn-icon">
              <Icons.Settings size={13} />
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-check">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && bulkSelected.size > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="sortable" onClick={() => toggleSort('order_number')}>رقم الطلب <SortIcon col="order_number" /></th>
                  <th className="sortable" onClick={() => toggleSort('status')}>الحالة <SortIcon col="status" /></th>
                  <th className="sortable" onClick={() => toggleSort('customer_name')}>العميل <SortIcon col="customer_name" /></th>
                  <th>القطعة / الملاحظات</th>
                  <th className="sortable" onClick={() => toggleSort('created_at')}>التاريخ <SortIcon col="created_at" /></th>
                  <th>الجوال</th>
                  <th style={{ textAlign: 'left' }}>إجراء</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)' }}>
                      {status === 'all' && !search ? 'لا توجد طلبات بعد' : 'لا توجد طلبات تطابق هذا الفلتر'}
                    </td>
                  </tr>
                ) : (
                  orders.map((o, i) => {
                    const isSel = bulkSelected.has(o.id);
                    const isFoc = i === focusRow;
                    return (
                      <tr
                        key={o.id}
                        className={`${isSel ? 'selected' : ''} ${isFoc ? 'focused' : ''}`}
                        onClick={() => setSelected(o)}
                        onMouseEnter={() => setFocusRow(i)}
                      >
                        <td className="col-check" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSel} onChange={() => toggleBulk(o.id)} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PriorityDot priority={o.priority} />
                            <span className="stamp">{o.order_number}</span>
                          </div>
                        </td>
                        <td><StatusPill status={o.status} size="sm" /></td>
                        <td>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer_name}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{o.piece_type}</div>
                          {o.notes && <div className="subline">{o.notes.slice(0, 35)}</div>}
                        </td>
                        <td className="mono text-sm text-mute">{formatDate(o.created_at)}</td>
                        <td className="mono text-sm text-mute" style={{ direction: 'ltr' }}>{o.phone.slice(-9)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {isWorkshop && NEXT_STATUS[o.status] && (
                              <button className="btn btn-sm btn-ghost" onClick={() => changeStatus(o, NEXT_STATUS[o.status])}>
                                {NEXT_LABEL[o.status]}
                              </button>
                            )}
                            {!isWorkshop && o.status === 'ready_for_return' && (
                              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                                onClick={() => changeStatus(o, 'returned_to_shop')}>
                                تأكيد الوصول
                              </button>
                            )}
                            {o.customer_token && (
                              <button
                                className="btn btn-sm btn-ghost btn-icon"
                                onClick={e => copyTrackingLink(o, e)}
                                title="نسخ رابط المتابعة"
                                style={copiedId === o.id ? { color: 'var(--success)' } : {}}
                              >
                                {copiedId === o.id ? <Icons.Check size={12} /> : <Icons.Link size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={e => e.stopPropagation()}>
                            <Icons.Ellipsis size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>تنقّل: <span className="kbd">J</span> <span className="kbd">K</span></span>
            <span>تحديد: <span className="kbd">X</span></span>
            <span>فتح: <span className="kbd">↵</span></span>
            <span style={{ marginRight: 'auto', fontFamily: 'var(--font-mono)' }}>{orders.length} صف</span>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {bulkSelected.size > 0 && (
        <div style={{ position: 'sticky', bottom: 20, zIndex: 50, display: 'flex', justifyContent: 'center', margin: '20px 24px 0' }}>
          <div className="bulk-bar">
            <span className="count">{bulkSelected.size}</span>
            <span style={{ opacity: 0.7 }}>محدد</span>
            <div className="divider" />
            <button className="b-btn"><Icons.User size={12} /> تعيين</button>
            <button className="b-btn"><Icons.Sparkle size={12} /> الحالة</button>
            <button className="b-btn"><Icons.Printer size={12} /> طباعة</button>
            <button className="b-btn"><Icons.Bell size={12} /> إشعار</button>
            <div className="divider" />
            <button className="b-btn close" onClick={() => setBulkSelected(new Set())}>
              <Icons.X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Copy toast */}
      {copiedId && (
        <div className="toast-layer">
          <div className="toast">
            <span className="dot" />
            تم نسخ رابط المتابعة
          </div>
        </div>
      )}

      {/* Order detail drawer */}
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

function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      className={`cb${checked || indeterminate ? ' checked' : ''}`}
      onClick={e => { e.stopPropagation(); onChange(); }}
    >
      {checked && (
        <svg viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" /></svg>
      )}
      {indeterminate && !checked && (
        <svg viewBox="0 0 10 2"><line x1="1" y1="1" x2="9" y2="1" /></svg>
      )}
    </span>
  );
}
