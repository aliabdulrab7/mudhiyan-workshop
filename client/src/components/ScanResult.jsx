import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatusBadge from './StatusBadge';
import CostEditor from './CostEditor';
import { updateOrderStatus } from '../api/orders';
import { getRole } from '../api/auth';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';
import ReadyLabelCanvas from './ReadyLabelCanvas';

function useMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

export default function ScanResult({ order: initialOrder, onScanAgain, onOrderUpdated }) {
  const isMobile   = useMobile();
  const [order, setOrder] = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);
  const [justMarkedReady, setJustMarkedReady] = useState(false);
  const [scanError, setScanError] = useState('');
  const isWorkshop = getRole() === 'workshop';

  function handleOrderUpdate(updated) {
    setOrder(updated);
    onOrderUpdated?.(updated);
  }

  const trackingUrl = buildTrackingUrl(order.customer_token);
  const approvalWaUrl = buildApprovalWaUrl(order.phone, order.customer_name, order.cost, trackingUrl);
  const readyWaUrl    = buildReadyWaUrl(order.phone, order.customer_name, order.order_number);

  async function markReady() {
    setPromoting(true);
    setScanError('');
    try {
      const updated = await updateOrderStatus(order.id, 'ready_for_return');
      handleOrderUpdate(updated);
      if (updated.status === 'ready_for_return') {
        setJustMarkedReady(true);
      }
    } catch (e) {
      setScanError(e.message || 'تعذّر تحديث الحالة');
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        ...cardStyle,
        background: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--gold-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
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

      {/* Cost editor — workshop + received only, not locked */}
      {isWorkshop && !order.locked_at && order.status === 'received' && (
        <CostEditor order={order} onUpdated={handleOrderUpdate} />
      )}

      {/* Approval wa.me — waiting_approval */}
      {!order.locked_at && order.status === 'waiting_approval' && (
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
            <button className="btn-gold" style={{ fontSize: '0.85rem', minHeight: '44px', padding: '8px 16px' }}>
              📲 أرسل رابط الموافقة ↗
            </button>
          </a>
        </div>
      )}

      {/* Mark ready — workshop + in_repair, not locked */}
      {isWorkshop && !order.locked_at && order.status === 'in_repair' && (
        <div style={{
          background: 'rgba(201,151,58,0.06)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            هل الصيانة جاهزة للإرجاع للفرع؟
          </div>
          <button
            className="btn-gold"
            onClick={markReady}
            disabled={promoting}
            style={isMobile
              ? { width: '100%', justifyContent: 'center', padding: '14px 0', fontSize: '1rem', minHeight: '44px' }
              : { fontSize: '0.85rem', padding: '8px 16px', minHeight: '44px' }
            }
          >
            {promoting ? '...' : '✓ تعيين جاهزة للإرجاع'}
          </button>
        </div>
      )}

      {/* Pickup wa.me — ready_for_return */}
      {!order.locked_at && order.status === 'ready_for_return' && (
        <div style={{
          background: 'rgba(6,95,70,0.06)',
          border: '1px solid rgba(6,95,70,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--status-ready-fg)', marginBottom: '10px', fontWeight: 600 }}>
            ✓ القطعة جاهزة — أبلغ الفرع بالاستلام
          </div>
          <a href={readyWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn-gold" style={{ fontSize: '0.85rem', padding: '8px 16px', width: '100%', justifyContent: 'center', minHeight: '44px' }}>
              📲 إرسال رسالة الاستلام (WhatsApp) ↗
            </button>
          </a>
        </div>
      )}

      {/* Ready Label — workshop + ready_for_return */}
      {isWorkshop && !order.locked_at && order.status === 'ready_for_return' && (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            ملصق الجاهزية (للطباعة والإرفاق بالقطعة)
          </div>
          <ReadyLabelCanvas order={order} autoPrint={justMarkedReady} />
        </div>
      )}

      {/* Error display */}
      {scanError && (
        <div style={{
          padding: '10px 14px', marginBottom: '12px',
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.20)',
          borderRadius: 'var(--radius)',
          color: '#DC2626', fontSize: '0.85rem',
        }}>
          {scanError}
        </div>
      )}

      {/* Scan again */}
      <div className="scan-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={onScanAgain}>
          ⌖ مسح آخر
        </button>
      </div>
    </motion.div>
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
