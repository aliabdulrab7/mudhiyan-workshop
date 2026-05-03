import React, { useState, useEffect, useMemo } from 'react';
import { getOrders, updateOrderStatus, bulkAssignTechnician } from '../api/orders';
import StatusPill, { PriorityDot, Avatar } from './StatusPill';
import OrderDetail from './OrderDetail';
import { getRole } from '../api/auth';
import { buildTrackingUrl } from '../utils/whatsapp';
import SkeletonLoader from './SkeletonLoader';
import { Icons } from './icons';
import Alert from './ui/Alert';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import Chip from './ui/Chip';
import Dialog from './ui/Dialog';
import Input from './ui/Input';
import TechnicianPicker from './ui/TechnicianPicker';
import StatusIndicator from './ui/StatusIndicator';
import WorkloadBadge from './ui/WorkloadBadge';
import { useTechnicians } from '../contexts/TechniciansContext';
import { useToast } from './ToastProvider';

const FILTER_DEFS = [
  { value: 'all',              label: 'الكل',             statusKeys: null },
  { value: 'received',         label: 'مستلمة',           statusKeys: ['received'] },
  { value: 'inspection',       label: 'قيد الفحص',        statusKeys: ['inspection'] },
  { value: 'waiting_approval', label: 'بانتظار الموافقة', statusKeys: ['waiting_approval'] },
  { value: 'in_repair',        label: 'قيد الإصلاح',      statusKeys: ['in_repair'] },
  { value: 'quality_check',    label: 'فحص الجودة',       statusKeys: ['quality_check'] },
  { value: 'ready_for_return', label: 'جاهزة للإرجاع',    statusKeys: ['ready_for_return'] },
  { value: 'returned_to_shop', label: 'وصلت للفرع',       statusKeys: ['returned_to_shop'] },
  { value: 'delivered',        label: 'تم التسليم',        statusKeys: ['delivered'] },
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

export default function OrderList({ refresh, defaultStatus = 'all', onRefresh, shopId = null, onDisplayCount }) {
  const [orders, setOrders]       = useState([]);
  const [allOrders, setAllOrders] = useState([]);
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
  const [menu, setMenu]           = useState(null); // 'sort' | 'filter' | 'group' | null
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [withPhoneOnly, setWithPhoneOnly] = useState(false);
  const [groupBy, setGroupBy]     = useState('none'); // 'none' | 'status' | 'date'
  const isWorkshop = getRole() === 'workshop';
  const toast = useToast();
  const techCtx = useTechnicians();
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignTechId, setBulkAssignTechId] = useState(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  function openBulkAssign() {
    setBulkAssignTechId(null);
    setBulkAssignOpen(true);
  }

  async function submitBulkAssign() {
    if (!bulkAssignTechId) return;
    const orderIds = [...bulkSelected];
    setBulkAssigning(true);
    try {
      const res = await bulkAssignTechnician(orderIds, bulkAssignTechId);
      toast?.(`تم تعيين الفني لـ ${res.orders_updated} طلب`, 'success');
      setBulkAssignOpen(false);
      setBulkSelected(new Set());
      onRefresh?.();
    } catch (e) {
      toast?.(e.message || 'فشل التعيين الجماعي', 'error');
    } finally {
      setBulkAssigning(false);
    }
  }

  // Counts for filter chips — computed from the full unfiltered list
  const counts = useMemo(() => {
    const c = {};
    for (const o of allOrders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [allOrders]);

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

  // Lazily load workload data for StatusIndicator + WorkloadBadge in the tech column.
  useEffect(() => {
    if (isWorkshop) Promise.resolve(techCtx?.ensureWorkload?.()).catch(() => {});
  }, [isWorkshop]);

  // Fetch all orders once (no filter) for accurate status counts in chips
  useEffect(() => {
    getOrders({ shop_id: shopId }).then(setAllOrders).catch(() => {});
  }, [refresh, shopId]);

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

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="sort">⇅</span>;
    return <span className="sort" style={{ opacity: 0.9, color: 'var(--primary)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      setMenu(null);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  // Filter + sort pipeline (client-side refinement on top of server results)
  const displayOrders = useMemo(() => {
    let list = orders;
    if (urgentOnly)    list = list.filter(o => o.is_urgent);
    if (withPhoneOnly) list = list.filter(o => o.phone);
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    };
    return [...list].sort(cmp);
  }, [orders, urgentOnly, withPhoneOnly, sortCol, sortDir]);

  // Group rows for rendering
  const orderGroups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '__all', label: null, rows: displayOrders }];
    const statusLabels = FILTER_DEFS.reduce((m, f) => {
      if (f.statusKeys) f.statusKeys.forEach(k => { m[k] = f.label; });
      return m;
    }, {});
    const groups = new Map();
    for (const o of displayOrders) {
      const key = groupBy === 'status' ? o.status : formatDate(o.created_at);
      const label = groupBy === 'status' ? (statusLabels[o.status] || o.status) : key;
      if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
      groups.get(key).rows.push(o);
    }
    return Array.from(groups.values());
  }, [displayOrders, groupBy]);

  const activeExtraFilters = (urgentOnly ? 1 : 0) + (withPhoneOnly ? 1 : 0);

  useEffect(() => { onDisplayCount?.(displayOrders.length); }, [displayOrders.length, onDisplayCount]);

  // Keyboard j/k navigation
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'j') { e.preventDefault(); setFocusRow(f => Math.min(displayOrders.length - 1, f + 1)); }
      if (e.key === 'k') { e.preventDefault(); setFocusRow(f => Math.max(0, f - 1)); }
      if (e.key === 'x' || e.key === ' ') {
        if (displayOrders[focusRow]) { e.preventDefault(); toggleBulk(displayOrders[focusRow].id); }
      }
      if (e.key === 'Enter') {
        if (displayOrders[focusRow]) { e.preventDefault(); setSelected(displayOrders[focusRow]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [displayOrders, focusRow]);

  return (
    <div>
      {/* Filter chips */}
      <div style={{ padding: '0 24px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTER_DEFS.map(f => {
          const chipCount = f.statusKeys === null
            ? allOrders.length
            : f.statusKeys.reduce((s, k) => s + (counts[k] || 0), 0);
          return (
            <Chip
              key={f.value}
              active={status === f.value}
              count={chipCount > 0 ? chipCount : undefined}
              onClick={() => setStatus(f.value)}
              testId={`order-list__filter__${f.value}`}
            >
              {f.label}
            </Chip>
          );
        })}
      </div>

      {/* Error */}
      {listError && (
        <div style={{ margin: '0 24px 10px' }}>
          <Alert variant="danger">{listError}</Alert>
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
            <Input
              size="sm"
              style={{ border: 'none', background: 'transparent', maxWidth: 280 }}
              placeholder="بحث باسم العميل أو رقم الطلب…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              testId="order-list__search-input"
            />
            <div style={{ flex: 1 }} />

            <MenuButton
              open={menu === 'filter'}
              onToggle={e => { e.stopPropagation(); setMenu(m => m === 'filter' ? null : 'filter'); }}
              label={<><Icons.Filter size={12} /> فلتر{activeExtraFilters ? <span className="count" style={{ marginInlineStart: 4 }}>{activeExtraFilters}</span> : null}</>}
              active={activeExtraFilters > 0}
            >
              <MenuCheck label="المستعجلة فقط" checked={urgentOnly} onChange={() => setUrgentOnly(v => !v)} />
              <MenuCheck label="التي تحتوي على رقم هاتف" checked={withPhoneOnly} onChange={() => setWithPhoneOnly(v => !v)} />
              {activeExtraFilters > 0 && (
                <button className="menu-item reset" onClick={() => { setUrgentOnly(false); setWithPhoneOnly(false); }}>
                  مسح الفلاتر
                </button>
              )}
            </MenuButton>

            <MenuButton
              open={menu === 'sort'}
              onToggle={e => { e.stopPropagation(); setMenu(m => m === 'sort' ? null : 'sort'); }}
              label={<><Icons.Sort size={12} /> ترتيب</>}
              active={sortCol !== 'created_at' || sortDir !== 'desc'}
            >
              {[
                { col: 'created_at',   label: 'التاريخ' },
                { col: 'order_number', label: 'رقم الطلب' },
                { col: 'customer_name',label: 'العميل' },
                { col: 'status',       label: 'الحالة' },
              ].map(o => (
                <MenuRadio
                  key={o.col}
                  label={o.label}
                  checked={sortCol === o.col}
                  onChange={() => setSortCol(o.col)}
                />
              ))}
              <div className="menu-sep" />
              <MenuRadio label="تنازلي ↓" checked={sortDir === 'desc'} onChange={() => setSortDir('desc')} />
              <MenuRadio label="تصاعدي ↑" checked={sortDir === 'asc'}  onChange={() => setSortDir('asc')} />
            </MenuButton>

            <MenuButton
              open={menu === 'group'}
              onToggle={e => { e.stopPropagation(); setMenu(m => m === 'group' ? null : 'group'); }}
              label={<><Icons.Group size={12} /> تجميع</>}
              active={groupBy !== 'none'}
            >
              <MenuRadio label="بدون" checked={groupBy === 'none'}   onChange={() => setGroupBy('none')} />
              <MenuRadio label="حسب الحالة"  checked={groupBy === 'status'} onChange={() => setGroupBy('status')} />
              <MenuRadio label="حسب التاريخ" checked={groupBy === 'date'}   onChange={() => setGroupBy('date')} />
            </MenuButton>
            <div className="divider" />
            <Button
              variant="ghost"
              size="sm"
              icon={<Icons.Refresh size={13} />}
              onClick={() => onRefresh?.()}
              testId="order-list__toolbar__refresh"
              className="!px-1.5"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Icons.Settings size={13} />}
              className="!px-1.5"
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 210 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-check">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && bulkSelected.size > 0}
                      onChange={toggleAll}
                      aria-label="تحديد الكل"
                      testId="order-list__select-all"
                    />
                  </th>
                  <th className="sortable" onClick={() => toggleSort('order_number')}>رقم الطلب <SortIcon col="order_number" /></th>
                  <th className="sortable" onClick={() => toggleSort('status')}>الحالة <SortIcon col="status" /></th>
                  <th className="sortable" onClick={() => toggleSort('customer_name')}>العميل <SortIcon col="customer_name" /></th>
                  <th>القطعة / الملاحظات</th>
                  <th className="sortable" onClick={() => toggleSort('created_at')}>التاريخ <SortIcon col="created_at" /></th>
                  <th style={{ textAlign: 'left' }}>إجراء</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)' }}>
                      {status === 'all' && !search && !activeExtraFilters ? 'لا توجد طلبات بعد' : 'لا توجد طلبات تطابق هذا الفلتر'}
                    </td>
                  </tr>
                ) : (
                  orderGroups.flatMap(g => [
                    ...(g.label ? [(
                      <tr key={`grp-${g.key}`} className="group-head">
                        <td colSpan={8} style={{
                          background: 'var(--bg-muted, #F9FAFB)', color: 'var(--text-muted)',
                          fontSize: 11.5, fontWeight: 600, padding: '6px 14px',
                          borderTop: '1px solid var(--border)', letterSpacing: 0.2,
                        }}>
                          {g.label} <span style={{ opacity: 0.6, marginInlineStart: 6 }}>({g.rows.length})</span>
                        </td>
                      </tr>
                    )] : []),
                    ...g.rows.map((o) => {
                    const isSel = bulkSelected.has(o.id);
                    const globalIdx = displayOrders.indexOf(o);
                    const isFoc = globalIdx === focusRow;
                    return (
                      <tr
                        key={o.id}
                        className={`${isSel ? 'selected' : ''} ${isFoc ? 'focused' : ''}`}
                        onClick={() => setSelected(o)}
                        onMouseEnter={() => setFocusRow(globalIdx)}
                        data-testid={`order-list__row__${o.order_number}`}
                      >
                        <td className="col-check" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSel} onChange={() => toggleBulk(o.id)} aria-label={`تحديد الطلب ${o.order_number}`} testId={`order-list__row__${o.order_number}__select`} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PriorityDot priority={o.priority} />
                            <span className="stamp">{o.order_number}</span>
                            {o.is_urgent ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                padding: '1px 6px', borderRadius: 3,
                                background: 'var(--danger)', color: '#fff',
                                letterSpacing: 0.3,
                                whiteSpace: 'nowrap', flexShrink: 0,
                              }}>مستعجل</span>
                            ) : null}
                          </div>
                        </td>
                        <td><StatusPill status={o.status} size="sm" /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={o.customer_name} size={20} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name}</div>
                              {o.phone && <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', direction: 'ltr', textAlign: 'left' }}>+{o.phone.slice(0,3)} {o.phone.slice(3)}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500 }}>{o.piece_type}</span>
                            {isWorkshop && (() => {
                              const wl = o.technician_summary && o.technician_summary !== 'متعدد'
                                ? techCtx?.workloadByName?.get(o.technician_summary) ?? null
                                : null;
                              return (
                                <span
                                  data-testid={`order-list__row__${o.order_number}__technician`}
                                  title={o.technician_summary ? `الفني: ${o.technician_summary}` : 'لم يُعيَّن فني'}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 10.5, lineHeight: 1.2,
                                    padding: '1px 6px', borderRadius: 3,
                                    background: o.technician_summary ? 'var(--bg-soft)' : 'transparent',
                                    border: o.technician_summary ? '1px solid var(--border)' : '1px dashed var(--border)',
                                    color: o.technician_summary ? 'var(--text-soft)' : 'var(--text-faint)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {wl ? <StatusIndicator status={wl.status} /> : <Icons.User size={9} />}
                                  {o.technician_summary || '—'}
                                  {wl?.active_count != null && (
                                    <WorkloadBadge count={wl.active_count} urgent={wl.urgent_count ?? 0} />
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                          {o.notes && <div className="subline">{o.notes.slice(0, 35)}</div>}
                        </td>
                        <td className="mono text-sm text-mute">{formatDate(o.created_at)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {isWorkshop && NEXT_STATUS[o.status] && (
                              <Button variant="ghost" size="sm" onClick={() => changeStatus(o, NEXT_STATUS[o.status])}
                                testId={`order-list__row__${o.order_number}__advance`}>
                                {NEXT_LABEL[o.status]}
                              </Button>
                            )}
                            {!isWorkshop && o.status === 'ready_for_return' && (
                              <Button variant="ghost" size="sm" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                                onClick={() => changeStatus(o, 'returned_to_shop')}
                                testId={`order-list__row__${o.order_number}__confirm-returned`}>
                                تأكيد الوصول
                              </Button>
                            )}
                            {o.customer_token && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={copiedId === o.id ? <Icons.Check size={12} /> : <Icons.Link size={12} />}
                                onClick={e => copyTrackingLink(o, e)}
                                title="نسخ رابط المتابعة"
                                style={copiedId === o.id ? { color: 'var(--success)' } : {}}
                                testId={`order-list__row__${o.order_number}__copy-tracking-link`}
                                className="!px-1.5"
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icons.Ellipsis size={13} />}
                            onClick={e => e.stopPropagation()}
                            className="!px-1.5"
                          />
                        </td>
                      </tr>
                    );
                  }),
                  ])
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>تنقّل: <span className="kbd">J</span> <span className="kbd">K</span></span>
            <span>تحديد: <span className="kbd">X</span></span>
            <span>فتح: <span className="kbd">↵</span></span>
            <span style={{ marginRight: 'auto', fontFamily: 'var(--font-mono)' }}>{displayOrders.length} صف</span>
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
            {isWorkshop && (
              <button
                className="b-btn"
                data-testid="orders-list__bulk__assign-button"
                onClick={openBulkAssign}
              >
                <Icons.User size={12} /> تعيين
              </button>
            )}
            <button className="b-btn" data-testid="order-list__bulk__status"><Icons.Sparkle size={12} /> الحالة</button>
            <button className="b-btn" data-testid="order-list__bulk__print"><Icons.Printer size={12} /> طباعة</button>
            <button className="b-btn" data-testid="order-list__bulk__notify"><Icons.Bell size={12} /> إشعار</button>
            <div className="divider" />
            <button className="b-btn close" onClick={() => setBulkSelected(new Set())} data-testid="order-list__bulk__close">
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

      <Dialog
        open={bulkAssignOpen}
        onClose={() => !bulkAssigning && setBulkAssignOpen(false)}
        title={`تعيين الفني لـ ${bulkSelected.size} طلب`}
        size="sm"
        testId="orders-list__bulk__assign-dialog"
      >
        <Dialog.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>
              سيتم تعيين الفني لكل أصناف الطلبات المحددة. أي تعيين قائم سيتم استبداله.
            </div>
            <TechnicianPicker
              value={bulkAssignTechId}
              onChange={(id) => setBulkAssignTechId(id)}
              placeholder="اختر فنياً"
              zIndex={1200}
              testId="orders-list__bulk__assign-dialog__technician-select"
            />
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            size="sm"
            onClick={() => setBulkAssignOpen(false)}
            disabled={bulkAssigning}
            testId="orders-list__bulk__assign-dialog__cancel"
          >
            إلغاء
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!bulkAssignTechId}
            loading={bulkAssigning}
            onClick={submitBulkAssign}
            testId="orders-list__bulk__assign-dialog__confirm"
          >
            {bulkAssigning ? 'جاري التعيين...' : 'تأكيد التعيين'}
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}

function MenuButton({ open, onToggle, label, active, children }) {
  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        style={active ? { color: 'var(--primary)' } : undefined}
      >
        {label}
      </Button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', insetInlineEnd: 0,
          minWidth: 200, zIndex: 60,
          background: 'var(--surface, #fff)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm, 6px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          padding: 4,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

const MENU_ITEM_STYLE = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '7px 10px', fontSize: 12.5,
  border: 0, background: 'transparent', cursor: 'pointer',
  borderRadius: 4, textAlign: 'start', color: 'var(--text)',
};

function MenuCheck({ label, checked, onChange }) {
  return (
    <button type="button" className="menu-item" style={MENU_ITEM_STYLE} onClick={onChange}>
      <span style={{
        width: 14, height: 14, border: '1px solid var(--border)', borderRadius: 3,
        background: checked ? 'var(--primary)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.6" fill="none"/></svg>}
      </span>
      {label}
    </button>
  );
}

function MenuRadio({ label, checked, onChange }) {
  return (
    <button type="button" className="menu-item" style={{
      ...MENU_ITEM_STYLE,
      background: checked ? 'var(--bg-muted, #F3F4F6)' : 'transparent',
      fontWeight: checked ? 600 : 400,
    }} onClick={onChange}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        border: '1px solid var(--border)',
        background: checked ? 'var(--primary)' : 'transparent',
        boxShadow: checked ? 'inset 0 0 0 2px var(--surface, #fff)' : 'none',
        flexShrink: 0,
      }} />
      {label}
    </button>
  );
}
