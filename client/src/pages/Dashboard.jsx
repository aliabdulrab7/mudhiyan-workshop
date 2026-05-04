import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getOrders, getBranchStats } from '../api/orders';
import { getRole } from '../api/auth';
import OrderList from '../components/OrderList';
import StatusPill, { Sparkline } from '../components/StatusPill';
import { useApprovalNotifications } from '../hooks/useApprovalNotifications';
import SkeletonLoader from '../components/SkeletonLoader';
import { Icons } from '../components/icons';
import { useToast } from '../components/ToastProvider';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { downloadOrdersCsv } from '../utils/exportOrdersCsv';

const STAT_CARDS = [
  { key: 'new',              label: 'جديد',              color: 'var(--status-closed)',   spark: [2,3,2,4,3,4,3] },
  { key: 'received',         label: 'مستلمة',            color: 'var(--status-received)', spark: [3,4,2,5,6,4,7] },
  { key: 'inspection',       label: 'قيد الفحص',          color: 'var(--status-inspection)', spark: [2,3,3,4,2,3,2] },
  { key: 'waiting_approval', label: 'بانتظار الموافقة',   color: 'var(--status-waiting)', spark: [1,2,2,3,2,2,2] },
  { key: 'in_repair',        label: 'قيد الإصلاح',        color: 'var(--status-repair)',  spark: [4,5,4,5,4,4,4] },
  { key: 'quality_check',    label: 'فحص الجودة',         color: 'var(--status-quality)', spark: [1,2,1,2,2,2,2] },
  { key: 'ready_for_return', label: 'جاهزة للإرجاع',      color: 'var(--status-ready)',   spark: [2,2,3,3,3,3,3] },
  { key: 'returned_to_shop', label: 'وصلت للفرع',         color: 'var(--status-delivered)', spark: [1,1,2,2,2,2,2] },
];

export default function Dashboard() {
  const [stats, setStats]               = useState(null);
  const [actionOrders, setActionOrders] = useState({ received: [], pending: [], rejected: [] });
  const [branchStats, setBranchStats]   = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [refresh, setRefresh]           = useState(0);
  const [listCount, setListCount]       = useState(0);
  const [exporting, setExporting]       = useState(false);
  const navigate   = useNavigate();
  const isWorkshop = getRole() === 'workshop';
  const toast      = useToast();

  async function handleExport() {
    if (exporting || listCount === 0) return;
    setExporting(true);
    try {
      const orders = await getOrders({ status: filterStatus, shop_id: selectedBranch });
      if (orders.length === 0) {
        toast('لا توجد طلبات للتصدير', 'info');
        return;
      }
      const name = downloadOrdersCsv(orders, { status: filterStatus });
      toast(`تم تصدير ${orders.length} طلب — ${name}`, 'success');
    } catch {
      toast('فشل التصدير', 'error');
    } finally {
      setExporting(false);
    }
  }

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

  useEffect(() => { document.title = 'لوحة التحكم | مضيان'; }, []);

  useEffect(() => { loadData(); }, [refresh]);

  const handleApproved = useCallback((order) => {
    toast(`وافق ${order.customer_name} على ${order.order_number}`, 'success');
    setRefresh(r => r + 1);
  }, [toast]);

  useApprovalNotifications(handleApproved);

  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const branchMax = Math.max(...branchStats.map(b =>
    (b.received || 0) + (b.in_progress || 0) + (b.ready || 0) + (b.pending_approval || 0)
  ), 1);

  return (
    <div>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">لوحة الطلبات</h1>
          <div className="page-sub">{dateStr}</div>
        </div>
        <div className="page-actions">
          <Button size="sm" icon={<Icons.Refresh size={12} />} onClick={() => setRefresh(r => r + 1)} testId="dashboard__refresh">
            تحديث
          </Button>
          <Button
            size="sm"
            icon={<Icons.Download size={12} />}
            onClick={handleExport}
            disabled={listCount === 0 || exporting}
            title={listCount === 0 ? 'لا توجد طلبات للتصدير' : undefined}
            testId="dashboard__export"
          >
            تصدير
          </Button>
        </div>
      </div>

      <div className="dash">
        {/* Stat cards */}
        {stats ? (
          <div className="grid-stats">
            {STAT_CARDS.map(({ key, label, color, spark }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                className={`stat-card card${filterStatus === key ? ' active' : ''}`}
                style={filterStatus === key ? { borderColor: color, background: `color-mix(in oklch, ${color} 9%, var(--bg-raised))` } : {}}
                data-testid={`dashboard__stat__${key}`}
              >
                <div className="stat-label">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {label}
                </div>
                <div className="stat-value" style={{ color }}>{stats[key] ?? 0}</div>
                <Sparkline data={spark} color={color} />
              </button>
            ))}
          </div>
        ) : (
          <SkeletonLoader type="stats" />
        )}

        {/* Action panels — workshop only */}
        {isWorkshop && (
          <div className="grid-two">
            <ActionPanel
              icon={<Icons.Inbox size={14} />}
              title="تنتظر التقييم"
              count={actionOrders.received.length}
              color="var(--status-received)"
              emptyText="لا توجد طلبات جديدة"
              orders={actionOrders.received}
              active={filterStatus === 'received'}
              onFilterClick={() => setFilterStatus(filterStatus === 'received' ? 'all' : 'received')}
              testId="dashboard__action__received"
            />
            <ActionPanel
              icon={<Icons.Clock size={14} />}
              title="بانتظار موافقة العميل"
              count={actionOrders.pending.length}
              color="var(--status-waiting)"
              emptyText="لا شيء معلّق"
              orders={actionOrders.pending}
              active={filterStatus === 'waiting_approval'}
              onFilterClick={() => setFilterStatus(filterStatus === 'waiting_approval' ? 'all' : 'waiting_approval')}
              highlight={actionOrders.pending.length > 0}
              testId="dashboard__action__waiting-approval"
            />
          </div>
        )}

        {/* Rejected alert */}
        {isWorkshop && actionOrders.rejected.length > 0 && (
          <Card style={{ borderTop: '2px solid var(--danger)' }}>
            <div className="sec-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Warn size={14} stroke="var(--danger)" />
                <span className="sec-title" style={{ color: 'var(--danger)' }}>طلبات مرفوضة — يجب إعادتها للفرع</span>
                <span className="mono" style={{
                  fontSize: 11, padding: '1px 7px', borderRadius: 999,
                  color: 'var(--danger)',
                  background: 'oklch(0.58 0.21 25 / 0.1)',
                  border: '1px solid oklch(0.58 0.21 25 / 0.2)',
                }}>
                  {actionOrders.rejected.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterStatus('rejected')}
                style={{ color: 'var(--danger)' }}
              >
                عرض الكل
              </Button>
            </div>
            {actionOrders.rejected.slice(0, 3).map(o => (
              <div key={o.id} className="mini-row">
                <span className="stamp" style={{ fontSize: 11 }}>{o.order_number}</span>
                {o.is_urgent ? <span title="مستعجل" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', flexShrink: 0 }} /> : null}
                <span style={{ fontWeight: 500, flex: 1 }}>{o.customer_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{o.piece_type}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Branch load — workshop only */}
        {isWorkshop && branchStats.length > 0 && (
          <Card>
            <div className="sec-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Branch size={13} />
                <span className="sec-title">الفروع</span>
              </div>
              {selectedBranch && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedBranch(null)}>
                  عرض الكل
                </Button>
              )}
            </div>
            <div style={{ padding: '8px 14px' }}>
              {branchStats.map(branch => {
                const total = (branch.received || 0) + (branch.in_progress || 0) + (branch.ready || 0) + (branch.pending_approval || 0);
                const ready = branch.ready || 0;
                const isActive = selectedBranch === branch.shop_id;
                return (
                  <div
                    key={branch.shop_id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 36px',
                      alignItems: 'center', gap: 10, padding: '6px 4px',
                      borderRadius: 4, cursor: 'pointer',
                      background: isActive ? 'var(--primary-soft)' : 'transparent',
                    }}
                    onClick={() => setSelectedBranch(isActive ? null : branch.shop_id)}
                  >
                    <span style={{ fontSize: 12.5 }}>{branch.shop_name}</span>
                    <div style={{ height: 8, background: 'var(--bg-soft)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${(total / branchMax) * 100}%`, background: 'var(--primary)', borderRadius: 4 }} />
                      {ready > 0 && (
                        <div style={{ position: 'absolute', inset: 0, width: `${(ready / branchMax) * 100}%`, background: 'var(--status-ready)', borderRadius: 4 }} />
                      )}
                    </div>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'left' }}>{total}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Orders table */}
        <div style={{ marginTop: 4 }}>
          <OrderList
            key={`${filterStatus}-${selectedBranch}`}
            defaultStatus={filterStatus}
            shopId={selectedBranch}
            refresh={refresh}
            onRefresh={() => setRefresh(r => r + 1)}
            onDisplayCount={setListCount}
          />
        </div>
      </div>

      {/* Mobile FAB */}
      <button className="fab-new-order" onClick={() => navigate('/new')} aria-label="صيانة جديدة" data-testid="dashboard__fab-new-order">
        +
      </button>
    </div>
  );
}

function ActionPanel({ icon, title, count, color, emptyText, orders, active, onFilterClick, highlight, testId }) {
  return (
    <Card
      onClick={onFilterClick}
      testId={testId}
      style={{
        cursor: 'pointer',
        borderTopWidth: highlight && count > 0 ? 2 : 1,
        borderTopColor: highlight && count > 0 ? color : 'var(--border)',
        outline: active ? `2px solid ${color}` : 'none',
        outlineOffset: -1,
      }}
    >
      <div className="sec-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color }}>{icon}</span>
          <span className="sec-title">{title}</span>
        </div>
        <span className="mono" style={{
          fontSize: 11.5, padding: '1px 8px', borderRadius: 999,
          color, background: `color-mix(in oklch, ${color} 9%, var(--bg-raised))`,
          border: `1px solid color-mix(in oklch, ${color} 20%, var(--border))`,
        }}>{count}</span>
      </div>
      {count === 0 ? (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
          {emptyText}
        </div>
      ) : (
        orders.slice(0, 4).map(o => (
          <div key={o.id} className="mini-row" onClick={e => e.stopPropagation()}>
            <span className="stamp" style={{ fontSize: 11 }}>{o.order_number}</span>
            <span className="name">{o.customer_name}</span>
            <span className="meta">{o.piece_type}</span>
          </div>
        ))
      )}
      {count > 4 && (
        <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center' }}>
          +{count - 4} أخرى
        </div>
      )}
    </Card>
  );
}
