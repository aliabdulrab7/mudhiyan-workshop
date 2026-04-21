import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getToken } from '../api/auth';
import LabelCanvas from '../components/LabelCanvas';
import ReadyLabelCanvas from '../components/ReadyLabelCanvas';

function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

export default function LabelPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError('');
      try {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/orders/${id}`, { headers });
        if (!res.ok) throw new Error('الطلب غير موجود');
        const data = await res.json();
        setOrder(data);
      } catch (e) {
        setError(e.message || 'فشل تحميل الطلب');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: 'clamp(16px, 4vw, 40px)',
      fontFamily: 'Almarai, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '32px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate('/')}
          className="btn-ghost"
          style={{ padding: '8px 14px', fontSize: '0.88rem' }}
          data-testid="label-print__back"
        >
          ← رجوع
        </button>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--text)',
          }}>
            طباعة الملصقات
          </h1>
          {order && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {order.order_number}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '40px 0', textAlign: 'center' }}>
          جاري تحميل الطلب...
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 'var(--radius)',
          color: '#DC2626',
          fontSize: '0.88rem',
        }}>
          {error}
        </div>
      )}

      {order && (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '24px',
          alignItems: isMobile ? 'stretch' : 'flex-start',
        }}>
          {/* Label 1 — Customer tracking label */}
          <div style={{
            flex: 1,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '20px',
            }}>
              ملصق العميل
            </div>
            <LabelCanvas order={order} />
          </div>

          {/* Label 2 — Workshop internal label */}
          <div style={{
            flex: 1,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '20px',
            }}>
              ملصق الورشة
            </div>
            <ReadyLabelCanvas order={order} />
          </div>
        </div>
      )}
    </div>
  );
}
