import { useState, useEffect } from 'react';
import { getStats, getBranchStats } from '../api/orders';
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

export default function ReportsPage() {
  const [stats, setStats]           = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

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

  const pendingCount = stats?.waiting_approval ?? 0;

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

        {/* Stat cards */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          ملخص الطلبات
        </div>

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

        {/* Branch breakdown */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 20 }}>
          توزيع الفروع
        </div>

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
                        background: 'oklch(0.60 0.15 150 / 0.10)',
                        color: 'var(--success)',
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
      </div>
    </div>
  );
}
