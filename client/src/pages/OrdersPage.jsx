import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrders, updateOrderStatus } from '../api/orders';
import DataTable from '../components/DataTable';
import StatusPill, { STATUS_META } from '../components/StatusPill';
import OrderDetail from '../components/OrderDetail';
import { Icons } from '../components/icons';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Input from '../components/ui/Input';

const ALL_STATUSES = Object.keys(STATUS_META).filter(s =>
  !['new', 'inspection', 'approved', 'quality_check', 'returned_to_shop', 'closed', 'cancelled',
    'diagnosing'].includes(s)
);

const MAIN_STATUSES = ['received', 'pending_approval', 'in_progress', 'ready', 'delivered'];

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}

const COLUMNS = [
  { key: 'order_number', label: 'رقم الطلب', mono: true, width: 140 },
  { key: 'status',       label: 'الحالة',     width: 150,
    render: row => <StatusPill status={row.status} size="sm" /> },
  { key: 'customer_name', label: 'العميل' },
  { key: 'piece_type',    label: 'القطعة' },
  { key: 'shop_name',     label: 'الفرع' },
  { key: 'created_at',    label: 'منذ', align: 'end', width: 60,
    render: row => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>{relTime(row.created_at)}</span> },
];

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState(searchParams.get('status') || 'all');
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const searchRef  = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback((q, s) => {
    setLoading(true);
    getOrders({ status: s === 'all' ? undefined : s, search: q || undefined })
      .then(data => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(search, filter); }, [filter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search, filter), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && status !== filter) setFilter(status);
  }, [searchParams]);

  function setFilterAndSync(s) {
    setFilter(s);
    setSearchParams(s === 'all' ? {} : { status: s });
    setSelected(new Set());
  }

  function handleRowClick(row) {
    setDetailId(row.id);
  }

  async function bulkStatus(newStatus) {
    await Promise.all([...selected].map(id => updateOrderStatus(id, newStatus)));
    setSelected(new Set());
    load(search, filter);
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const detailOrder = orders.find(o => o.id === detailId) || null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">الطلبات</h1>
          <div className="page-sub">{loading ? '…' : `${orders.length} طلب`}</div>
        </div>
        <div className="page-actions">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', right: 9, color: 'var(--text-faint)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <Input ref={searchRef} size="sm" style={{ paddingRight: 28, width: 200 }}
              placeholder="بحث… ⌘F"
              value={search}
              onChange={e => setSearch(e.target.value)}
              testId="orders-list__search-input"
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <Chip
            active={filter === 'all'}
            onClick={() => setFilterAndSync('all')}
            testId="orders-list__filter__all"
          >
            الكل
          </Chip>
          {MAIN_STATUSES.map(s => (
            <Chip
              key={s}
              active={filter === s}
              onClick={() => setFilterAndSync(s)}
              style={filter === s ? { borderColor: STATUS_META[s]?.color, background: STATUS_META[s]?.color, color: '#fff' } : {}}
              testId={`orders-list__filter__${s}`}
            >
              {STATUS_META[s]?.label || s}
            </Chip>
          ))}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bulk-bar">
            <span style={{ fontSize: 13, fontWeight: 500 }}>تم تحديد {selected.size}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => bulkStatus('in_progress')} testId="orders-list__bulk__advance-in-progress">→ قيد العمل</Button>
              <Button size="sm" onClick={() => bulkStatus('ready')} testId="orders-list__bulk__advance-ready">→ جاهزة</Button>
              <Button size="sm" onClick={() => bulkStatus('delivered')} testId="orders-list__bulk__advance-delivered">→ تم التسليم</Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} testId="orders-list__bulk__cancel">إلغاء</Button>
          </div>
        )}

        <DataTable
          columns={COLUMNS}
          rows={orders}
          selected={selected}
          onSelect={setSelected}
          getRowKey={r => r.id}
          getRowTestId={r => r.order_number}
          onRowClick={handleRowClick}
          testIdPrefix="orders-list"
        />
      </div>

      {detailId && (
        <OrderDetail
          order={detailOrder}
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onStatusChange={() => load(search, filter)}
        />
      )}
    </div>
  );
}
