import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../api/orders';
import OrderList from '../components/OrderList';

function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

const STAT_CARDS = [
  { key: 'received',    label: 'مستلمة',     icon: '◈', color: 'var(--status-received-fg)'  },
  { key: 'in_progress', label: 'قيد العمل',  icon: '⟳', color: 'var(--status-progress-fg)'  },
  { key: 'ready',       label: 'جاهزة',      icon: '✓', color: 'var(--status-ready-fg)'      },
  { key: 'delivered',   label: 'مُسلَّمة',   icon: '✦', color: 'var(--gold)'                  },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const isMobile = useMobile();
  const navigate = useNavigate();

  useEffect(() => {
    getStats().then(setStats).catch(console.error);
  }, [refresh]);

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          لوحة الطلبات
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div
          className={isMobile ? 'scroll-row' : ''}
          style={isMobile ? {
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '14px',
            marginBottom: '32px',
          }}
        >
          {STAT_CARDS.map(({ key, label, icon, color }) => (
            <div key={key} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              ...(isMobile ? { minWidth: '120px', flexShrink: 0 } : {}),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color, fontSize: '1rem' }}>{icon}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{label}</span>
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
            </div>
          ))}
        </div>
      )}

      <div className="gold-line" style={{ marginBottom: '24px' }} />

      <OrderList refresh={refresh} />

      {isMobile && (
        <button
          className="fab-new-order"
          onClick={() => navigate('/new')}
          aria-label="صيانة جديدة"
        >
          ✦
        </button>
      )}
    </div>
  );
}
