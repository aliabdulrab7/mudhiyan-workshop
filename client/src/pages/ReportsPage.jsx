import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStats, getBranchStats } from '../api/orders';
import SkeletonLoader from '../components/SkeletonLoader';

function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

const ALL_STAT_CARDS = [
  { key: 'received',         label: 'مستلمة في الورشة',     icon: '◈', color: '#2980B9', gradient: 'linear-gradient(135deg, rgba(41,128,185,0.06), rgba(41,128,185,0.01))' },
  { key: 'inspection',       label: 'قيد الفحص',             icon: '⚲', color: '#7C3AED', gradient: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.01))' },
  { key: 'waiting_approval', label: 'بانتظار الموافقة',       icon: '⏳', color: '#D97706', gradient: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(217,119,6,0.01))' },
  { key: 'in_repair',        label: 'قيد الإصلاح',            icon: '⟳', color: '#1A6EA0', gradient: 'linear-gradient(135deg, rgba(26,110,160,0.06), rgba(26,110,160,0.01))' },
  { key: 'quality_check',    label: 'فحص الجودة',             icon: '✓', color: '#6B7280', gradient: 'linear-gradient(135deg, rgba(107,114,128,0.06), rgba(107,114,128,0.01))' },
  { key: 'ready_for_return', label: 'جاهزة للإرجاع',         icon: '✦', color: '#16A34A', gradient: 'linear-gradient(135deg, rgba(22,163,74,0.06), rgba(22,163,74,0.01))' },
  { key: 'returned_to_shop', label: 'وصلت للفرع',             icon: '◎', color: '#059669', gradient: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(5,150,105,0.01))' },
  { key: 'delivered',        label: 'مُسلَّمة',                icon: '✔', color: '#1E293B', gradient: 'linear-gradient(135deg, rgba(30,41,59,0.06), rgba(30,41,59,0.01))' },
  { key: 'closed',           label: 'مغلقة',                 icon: '⊗', color: '#64748B', gradient: 'linear-gradient(135deg, rgba(100,116,139,0.06), rgba(100,116,139,0.01))' },
];

export default function ReportsPage() {
  const [stats, setStats]           = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const isMobile = useMobile();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [s, branches] = await Promise.all([
          getStats().catch(() => null),
          getBranchStats().catch(() => []),
        ]);
        setStats(s);
        setBranchStats(branches);
      } catch (e) {
        setError('فشل تحميل البيانات');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const pendingApprovalCount = stats?.waiting_approval ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', direction: 'rtl' }}
    >
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
          التقارير
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '6px' }}>
          ملخص حالة الطلبات وتوزيع الفروع
        </div>
      </div>

      {/* Pending approvals alert banner */}
      {pendingApprovalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: 'rgba(217,119,6,0.05)',
            border: '1px solid rgba(217,119,6,0.25)',
            borderRight: '3px solid #D97706',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>⏳</span>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#92400E' }}>
              طلبات بانتظار موافقة العميل
            </span>
          </div>
          <span style={{
            background: 'rgba(217,119,6,0.15)',
            color: '#D97706',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 800,
            fontSize: '1.1rem',
            padding: '4px 14px',
            borderRadius: '20px',
            border: '1px solid rgba(217,119,6,0.30)',
          }}>
            {pendingApprovalCount}
          </span>
        </motion.div>
      )}

      {/* Section: Order status totals */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '12px',
        }}>
          ملخص الطلبات
        </div>

        {loading ? (
          <SkeletonLoader type="stats" isMobile={isMobile} />
        ) : error ? (
          <div style={{
            color: '#DC2626',
            fontSize: '0.85rem',
            padding: '16px',
            background: 'rgba(220,38,38,0.04)',
            border: '1px solid rgba(220,38,38,0.15)',
            borderRadius: '8px',
          }}>
            {error}
          </div>
        ) : stats ? (
          <div style={isMobile ? {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '10px',
          }}>
            {ALL_STAT_CARDS.map(({ key, label, icon, color, gradient }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'right',
                  boxShadow: 'var(--shadow-sm)',
                  ...(isMobile ? { minWidth: '120px', flex: '1 0 120px' } : {}),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }}/>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</span>
                </div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1,
                }}>
                  {stats[key] ?? 0}
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="gold-line" style={{ marginBottom: '28px' }} />

      {/* Section: Branch breakdown */}
      <div>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '12px',
        }}>
          توزيع الفروع
        </div>

        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '10px',
          }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{
                height: '90px',
                background: '#F3F4F6',
                borderRadius: '8px',
                animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        ) : branchStats.length === 0 ? (
          <div style={{
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            padding: '16px',
            background: '#F9FAFB',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            textAlign: 'center',
          }}>
            لا توجد بيانات فروع
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '10px',
          }}>
            {branchStats.map((branch, i) => (
              <BranchReportCard key={branch.shop_id} branch={branch} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function BranchReportCard({ branch, index }) {
  const activeCount = (branch.received ?? 0) + (branch.pending_approval ?? 0) + (branch.in_progress ?? 0) + (branch.ready ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'right',
      }}
    >
      {/* Branch name + ready badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.90rem', color: '#222222' }}>
          {branch.shop_name}
        </span>
        {branch.ready > 0 && (
          <span style={{
            background: 'rgba(22,163,74,0.10)',
            color: '#16A34A',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '0.68rem',
            fontWeight: 700,
            border: '1px solid rgba(22,163,74,0.25)',
          }}>
            {branch.ready} جاهز
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: '10px' }}>
        <span style={{ color: '#2980B9', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>◈</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{branch.received ?? 0}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>مستلمة</span>
        </span>
        <span style={{ color: '#1A6EA0', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⟳</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{branch.in_progress ?? 0}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>قيد الإصلاح</span>
        </span>
        <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✦</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{branch.ready ?? 0}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>جاهزة</span>
        </span>
        {(branch.pending_approval ?? 0) > 0 && (
          <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⏳</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{branch.pending_approval}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>موافقة</span>
          </span>
        )}
      </div>

      {/* Total active */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        paddingTop: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>إجمالي النشطة</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 800,
          fontSize: '1.1rem',
          color: activeCount > 0 ? '#2980B9' : 'var(--text-muted)',
        }}>
          {activeCount}
        </span>
      </div>
    </motion.div>
  );
}
