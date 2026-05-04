import { useState, useEffect } from 'react';
import { getStats, getBranchStats, getOrders } from '../api/orders';
import { listTechnicians } from '../api/technicians';
import { getUsername } from '../api/auth';
import SkeletonLoader from '../components/SkeletonLoader';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { openReportPrintWindow } from '../utils/reportPrint';

const WORKSHOP_NAME = 'المضيان';

const STAT_CARDS = [
  { key: 'received',         label: 'مستلمة في الورشة',   color: 'var(--status-received)' },
  { key: 'inspection',       label: 'قيد الفحص',           color: 'var(--status-inspection)' },
  { key: 'waiting_approval', label: 'بانتظار الموافقة',    color: 'var(--status-waiting)' },
  { key: 'in_repair',        label: 'قيد الإصلاح',         color: 'var(--status-repair)' },
  { key: 'quality_check',    label: 'فحص الجودة',          color: 'var(--status-quality)' },
  { key: 'ready_for_return', label: 'جاهزة للإرجاع',      color: 'var(--status-ready)' },
  { key: 'returned_to_shop', label: 'وصلت للفرع',          color: 'var(--status-delivered)' },
  { key: 'delivered',        label: 'مُسلَّمة',             color: 'var(--status-closed)' },
];

const STATUS_AR = {
  new: 'جديد', received: 'مستلمة', inspection: 'فحص',
  waiting_approval: 'انتظار موافقة', in_repair: 'إصلاح',
  quality_check: 'فحص الجودة', ready_for_return: 'جاهز للإرجاع',
  returned_to_shop: 'وصل للفرع', delivered: 'مُسلَّم',
  rejected: 'مرفوض', cancelled: 'ملغي',
};

const STATUS_COLORS = {
  new: '#6B7280', received: '#3B82F6', inspection: '#8B5CF6',
  waiting_approval: '#F59E0B', in_repair: '#F97316', quality_check: '#06B6D4',
  ready_for_return: '#10B981', returned_to_shop: '#84CC16',
  delivered: '#22C55E', rejected: '#EF4444', cancelled: '#9CA3AF',
};

const TECH_STATUS_COLOR = {
  available: 'var(--success)', busy: '#F97316',
  off_shift: 'var(--text-faint)', on_leave: '#3B82F6',
};

const TERMINAL = new Set(['delivered', 'rejected', 'cancelled']);

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

function SectionLabel({ children }) {
  return (
    <div style={{ marginBottom: 10, marginTop: 24, fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {children}
    </div>
  );
}

function MiniStat({ label, value, accent, sub }) {
  return (
    <div className="stat-card" style={{ cursor: 'default', flex: 1 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 26, color: accent || 'var(--text)' }}>{value}</div>
      {sub != null && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function RowSkeleton({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 36, borderRadius: 'var(--radius-sm)' }} />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [stats, setStats]             = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // New widget data
  const [allOrders, setAllOrders]     = useState([]);
  const [techs, setTechs]             = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError]     = useState(null);

  useEffect(() => { document.title = 'التقارير | مضيان'; }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const [s, branches] = await Promise.all([
          getStats().catch(() => null),
          getBranchStats().catch(() => []),
        ]);
        setStats(s);
        setBranchStats(branches);
      } catch {
        setError('فشل تحميل البيانات');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function loadLive() {
      setLiveLoading(true); setLiveError(null);
      try {
        const [ordersRaw, techsRaw] = await Promise.all([
          getOrders({ limit: 500 }).catch(() => []),
          listTechnicians({ active: '1', limit: 100, withWorkload: true }).catch(() => ({ items: [] })),
        ]);
        const orders = Array.isArray(ordersRaw) ? ordersRaw : (ordersRaw.orders ?? ordersRaw.items ?? []);
        setAllOrders(orders);
        setTechs(techsRaw.items ?? []);
      } catch {
        setLiveError('فشل تحميل البيانات الحية');
      } finally {
        setLiveLoading(false);
      }
    }
    loadLive();
  }, []);

  const pendingCount = stats?.waiting_approval ?? 0;

  // Derived values for new widgets
  const todayStr = toDateStr(new Date());

  const receivedToday = allOrders.filter(o => o.created_at?.startsWith(todayStr)).length;
  const inProgress    = allOrders.filter(o => !TERMINAL.has(o.status) && !o.locked_at).length;
  const deliveredToday = allOrders.filter(o =>
    o.status === 'delivered' && (o.locked_at ?? o.updated_at ?? '').startsWith(todayStr)
  ).length;

  const urgentOpen  = allOrders.filter(o => o.is_urgent && !o.locked_at && !TERMINAL.has(o.status)).length;
  const totalOpen   = allOrders.filter(o => !o.locked_at && !TERMINAL.has(o.status)).length;
  const normalOpen  = totalOpen - urgentOpen;
  const urgentPct   = totalOpen > 0 ? Math.round((urgentOpen / totalOpen) * 100) : 0;

  const statusCountsFromStats = STAT_CARDS
    .map(c => ({ ...c, count: stats?.[c.key] ?? 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const sortedTechs = [...techs].sort((a, b) => (b.active_count ?? 0) - (a.active_count ?? 0));
  const maxActive = sortedTechs.reduce((m, t) => Math.max(m, t.active_count ?? 0), 1);

  const recentOrders = [...allOrders]
    .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0) - new Date(a.updated_at ?? a.created_at ?? 0))
    .slice(0, 10);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">التقارير</h1>
          <div className="page-sub">ملخص حالة الطلبات وتوزيع الفروع</div>
        </div>
        <div className="page-actions">
          <Button
            size="sm"
            icon={<Icons.Download size={12} />}
            onClick={() => openReportPrintWindow({
              stats,
              branchStats,
              generatedAt: new Date(),
              username: getUsername(),
              workshopName: WORKSHOP_NAME,
            })}
            testId="reports__export"
          >
            تصدير
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Pending approval alert */}
        {pendingCount > 0 && (
          <div style={{
            background: 'oklch(0.80 0.12 80 / 0.08)',
            border: '1px solid oklch(0.80 0.12 80 / 0.25)',
            borderRight: '3px solid oklch(0.75 0.15 80)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: 'oklch(0.55 0.15 80)' }}>
              <Icons.Clock size={14} stroke="oklch(0.75 0.15 80)" />
              طلبات بانتظار موافقة العميل
            </div>
            <span className="mono" style={{
              fontWeight: 800, fontSize: 14, padding: '2px 10px', borderRadius: 999,
              background: 'oklch(0.80 0.12 80 / 0.15)', color: 'oklch(0.60 0.15 80)',
              border: '1px solid oklch(0.80 0.12 80 / 0.3)',
            }}>
              {pendingCount}
            </span>
          </div>
        )}

        {/* ── Existing: Status stat grid ── */}
        <SectionLabel>ملخص الطلبات</SectionLabel>

        {loading ? (
          <SkeletonLoader type="stats" />
        ) : error ? (
          <div style={{ marginBottom: 20 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : stats && (
          <div className="grid-stats" style={{ marginBottom: 28 }}>
            {STAT_CARDS.map(({ key, label, color }) => (
              <div key={key} className="stat-card card">
                <div className="stat-label">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {label}
                </div>
                <div className="stat-value" style={{ color }}>{stats[key] ?? 0}</div>
              </div>
            ))}
          </div>
        )}

        <hr className="hr" />

        {/* ── Existing: Branch breakdown ── */}
        <SectionLabel>توزيع الفروع</SectionLabel>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius)' }} />
            ))}
          </div>
        ) : branchStats.length === 0 ? (
          <Card style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد بيانات فروع
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {branchStats.map(branch => {
              const active = (branch.received ?? 0) + (branch.pending_approval ?? 0) + (branch.in_progress ?? 0) + (branch.ready ?? 0);
              return (
                <Card key={branch.shop_id} style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{branch.shop_name}</span>
                    {branch.ready > 0 && (
                      <span style={{
                        background: 'oklch(0.60 0.15 150 / 0.10)', color: 'var(--success)',
                        borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                        border: '1px solid oklch(0.60 0.15 150 / 0.25)',
                      }}>
                        {branch.ready} جاهز
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, marginBottom: 10 }}>
                    <span style={{ color: 'var(--status-received)' }}>
                      <span className="mono" style={{ fontWeight: 700 }}>{branch.received ?? 0}</span> مستلمة
                    </span>
                    <span style={{ color: 'var(--status-repair)' }}>
                      <span className="mono" style={{ fontWeight: 700 }}>{branch.in_progress ?? 0}</span> إصلاح
                    </span>
                    <span style={{ color: 'var(--status-ready)' }}>
                      <span className="mono" style={{ fontWeight: 700 }}>{branch.ready ?? 0}</span> جاهزة
                    </span>
                    {(branch.pending_approval ?? 0) > 0 && (
                      <span style={{ color: 'var(--status-waiting)' }}>
                        <span className="mono" style={{ fontWeight: 700 }}>{branch.pending_approval}</span> موافقة
                      </span>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>إجمالي النشطة</span>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 15, color: active > 0 ? 'var(--primary)' : 'var(--text-faint)' }}>
                      {active}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <hr className="hr" style={{ marginTop: 24 }} />

        {/* ── Widget 1: Today's Throughput ── */}
        <SectionLabel>الإنتاج اليوم</SectionLabel>

        {liveLoading ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 72, borderRadius: 'var(--radius-sm)' }} />)}
          </div>
        ) : liveError ? (
          <Alert variant="danger">{liveError}</Alert>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <MiniStat label="مستلمة اليوم" value={receivedToday} accent="var(--status-received)" />
            <MiniStat label="قيد التنفيذ" value={inProgress} accent="var(--status-repair)" />
            <MiniStat label="منجزة اليوم" value={deliveredToday} accent="var(--success)" />
          </div>
        )}

        {/* ── Widget 2: Status Distribution ── */}
        <SectionLabel>توزيع الحالات (مفتوحة)</SectionLabel>

        {loading ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[120, 100, 140, 90, 110].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 24, width: w, borderRadius: 20 }} />
            ))}
          </div>
        ) : statusCountsFromStats.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>لا توجد طلبات مفتوحة</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {statusCountsFromStats.map(({ key, label, color, count }) => (
              <div key={key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 8px', borderRadius: 999,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                fontSize: 12,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Widget 3: Tech Workload ── */}
        <SectionLabel>أعباء الفنيين</SectionLabel>

        {liveLoading ? (
          <RowSkeleton count={4} />
        ) : sortedTechs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>لا يوجد فنيون نشطون</div>
        ) : (
          <Card style={{ padding: '4px 0' }}>
            {sortedTechs.map((tech, i) => {
              const pct = maxActive > 0 ? Math.round(((tech.active_count ?? 0) / maxActive) * 100) : 0;
              return (
                <div key={tech.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: TECH_STATUS_COLOR[tech.status] ?? 'var(--text-faint)',
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 600, minWidth: 90 }}>{tech.name}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-soft)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: pct > 70 ? 'var(--danger)' : pct > 40 ? '#F97316' : 'var(--primary)',
                      borderRadius: 3, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 18, textAlign: 'center' }}>
                    {tech.active_count ?? 0}
                  </span>
                  {(tech.urgent_count ?? 0) > 0 && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                      background: 'oklch(0.58 0.21 25 / 0.10)', color: 'var(--danger)',
                      border: '1px solid oklch(0.58 0.21 25 / 0.25)',
                    }}>
                      {tech.urgent_count} مستعجل
                    </span>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {/* ── Widget 4: Urgency Breakdown ── */}
        <SectionLabel>تصنيف الأولوية (مفتوحة)</SectionLabel>

        {liveLoading ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 72, borderRadius: 'var(--radius-sm)' }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <MiniStat
              label="طلبات مستعجلة"
              value={urgentOpen}
              accent="var(--danger)"
              sub={totalOpen > 0 ? `${urgentPct}٪ من الإجمالي` : undefined}
            />
            <MiniStat
              label="طلبات عادية"
              value={normalOpen}
              accent="var(--text)"
              sub={totalOpen > 0 ? `${100 - urgentPct}٪ من الإجمالي` : undefined}
            />
          </div>
        )}

        {/* ── Widget 5: Recent Activity ── */}
        <SectionLabel>آخر النشاطات</SectionLabel>

        {liveLoading ? (
          <RowSkeleton count={5} />
        ) : recentOrders.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>لا توجد طلبات</div>
        ) : (
          <Card style={{ padding: '4px 0' }}>
            {recentOrders.map((order, i) => {
              const statusColor = STATUS_COLORS[order.status] ?? '#9CA3AF';
              const timestamp   = order.updated_at ?? order.created_at;
              return (
                <div key={order.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <span className="mono" style={{
                    fontSize: 11.5, fontWeight: 700, color: 'var(--primary)',
                    background: 'var(--primary-soft)', padding: '2px 7px', borderRadius: 4,
                    flexShrink: 0,
                  }}>
                    {order.order_number}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    background: `${statusColor}18`, color: statusColor,
                    border: `1px solid ${statusColor}35`, flexShrink: 0,
                  }}>
                    {STATUS_AR[order.status] ?? order.status}
                  </span>
                  {order.is_urgent ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                      background: 'oklch(0.58 0.21 25 / 0.10)', color: 'var(--danger)',
                      border: '1px solid oklch(0.58 0.21 25 / 0.20)', flexShrink: 0,
                    }}>
                      مستعجل
                    </span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                    {timeAgo(timestamp)}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
