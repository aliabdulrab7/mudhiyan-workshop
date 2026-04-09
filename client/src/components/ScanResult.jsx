import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { updateOrderStatus } from '../api/orders';

function useMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

function buildWhatsAppUrl(phone, orderNumber, customerName) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `نود إعلامكم بأن قطعتكم جاهزة للاستلام.\n` +
    `رقم الطلب: ${orderNumber}\n\n` +
    `شكراً لثقتكم بنا 🏅`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function ScanResult({ order: initialOrder, onScanAgain, onOrderUpdated }) {
  const isMobile = useMobile();
  const [order, setOrder] = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);

  const waUrl = buildWhatsAppUrl(order.phone, order.order_number, order.customer_name);
  const canPromote = order.status === 'received' || order.status === 'in_progress';

  async function markReady() {
    setPromoting(true);
    try {
      const updated = await updateOrderStatus(order.id, 'ready');
      setOrder(updated);
      onOrderUpdated?.(updated);
    } catch (e) {
      console.error('Status update failed', e);
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--gold-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '28px',
      maxWidth: isMobile ? '100%' : '440px',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--status-ready-bg)',
          border: '1px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', color: 'var(--status-ready-fg)', flexShrink: 0,
        }}>
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>تم العثور على الطلب</div>
          <span className="order-stamp">{order.order_number}</span>
        </div>
      </div>

      <div className="gold-line" style={{ marginBottom: '18px' }} />

      {/* Order details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <Row label="العميل" value={order.customer_name} bold />
        <Row label="القطعة" value={order.piece_type} />
        <Row label="الجوال" value={'+' + order.phone} mono />
        <Row label="الحالة" value={<StatusBadge status={order.status} />} />
        {order.notes && <Row label="ملاحظات" value={order.notes} />}
      </div>

      {/* Confirm ready button */}
      {canPromote && (
        <div style={{
          background: 'rgba(201,168,76,0.08)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ marginBottom: '10px' }}>هل الصيانة جاهزة للاستلام؟</div>
          <button
            className="btn-gold"
            onClick={markReady}
            disabled={promoting}
            style={isMobile
              ? { width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: '1rem' }
              : { fontSize: '0.85rem', padding: '7px 16px' }
            }
          >
            {promoting ? '...' : '✓ تعيين جاهزة'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="scan-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <button className="btn-gold">
            <span>📲</span> فتح واتساب
          </button>
        </a>
        <button className="btn-ghost" onClick={onScanAgain}>
          ⌖ مسح آخر
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 400,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        fontSize: mono ? '0.82rem' : '0.92rem',
        color: 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  );
}
