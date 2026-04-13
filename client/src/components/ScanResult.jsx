import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import CostEditor from './CostEditor';
import { updateOrderStatus } from '../api/orders';
import { getRole } from '../api/auth';

function useMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

function buildApprovalWaUrl(phone, customerName, cost, trackingUrl) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `تم تقييم قطعتك وتكلفة الإصلاح: ${cost} ريال.\n` +
    `للموافقة على السعر والمتابعة:\n${trackingUrl}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildReadyWaUrl(phone, customerName, orderNumber) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `نود إعلامكم بأن قطعتكم جاهزة للاستلام.\n` +
    `رقم الطلب: ${orderNumber}\n\n` +
    `شكراً لثقتكم بنا 🏅`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function ScanResult({ order: initialOrder, onScanAgain, onOrderUpdated }) {
  const isMobile   = useMobile();
  const [order, setOrder] = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);
  const isWorkshop = getRole() === 'workshop';

  function handleOrderUpdate(updated) {
    setOrder(updated);
    onOrderUpdated?.(updated);
  }

  const trackingUrl = `${window.location.protocol}//${window.location.host}/track/${order.customer_token}`;
  const approvalWaUrl = buildApprovalWaUrl(order.phone, order.customer_name, order.cost, trackingUrl);
  const readyWaUrl    = buildReadyWaUrl(order.phone, order.customer_name, order.order_number);

  async function markReady() {
    setPromoting(true);
    try {
      handleOrderUpdate(await updateOrderStatus(order.id, 'ready'));
    } catch (e) {
      console.error(e);
    } finally {
      setPromoting(false);
    }
  }

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--gold-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    maxWidth: isMobile ? '100%' : '440px',
    width: '100%',
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--status-ready-bg)',
          border: '1px solid rgba(6,95,70,0.2)',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <Row label="العميل" value={order.customer_name} bold />
        <Row label="القطعة" value={order.piece_type} />
        <Row label="الجوال" value={'+' + order.phone} mono />
        <Row label="الحالة" value={<StatusBadge status={order.status} />} />
        {order.cost > 0 && <Row label="التكلفة" value={`${order.cost} ريال`} bold />}
        {order.notes && <Row label="ملاحظات" value={order.notes} />}
      </div>

      {/* Cost editor — workshop + received only */}
      {isWorkshop && order.status === 'received' && (
        <CostEditor order={order} onUpdated={handleOrderUpdate} />
      )}

      {/* Approval wa.me — pending_approval */}
      {order.status === 'pending_approval' && (
        <div style={{
          background: 'rgba(201,151,58,0.06)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            أرسل رابط الموافقة للعميل ({order.cost} ريال)
          </div>
          <a href={approvalWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn-gold" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
              📲 أرسل رابط الموافقة
            </button>
          </a>
        </div>
      )}

      {/* Mark ready — workshop + in_progress */}
      {isWorkshop && order.status === 'in_progress' && (
        <div style={{
          background: 'rgba(201,151,58,0.06)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            هل الصيانة جاهزة للاستلام؟
          </div>
          <button
            className="btn-gold"
            onClick={markReady}
            disabled={promoting}
            style={isMobile
              ? { width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: '1rem' }
              : { fontSize: '0.85rem', padding: '8px 16px' }
            }
          >
            {promoting ? '...' : '✓ تعيين جاهزة'}
          </button>
        </div>
      )}

      {/* Pickup wa.me — ready */}
      {order.status === 'ready' && (
        <div style={{
          background: 'rgba(6,95,70,0.06)',
          border: '1px solid rgba(6,95,70,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--status-ready-fg)', marginBottom: '10px', fontWeight: 600 }}>
            ✓ القطعة جاهزة — أبلغ العميل
          </div>
          <a href={readyWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn-gold" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
              📲 أبلغ العميل بالاستلام
            </button>
          </a>
        </div>
      )}

      {/* Scan again */}
      <div className="scan-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
