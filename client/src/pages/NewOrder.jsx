import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import OrderForm from '../components/OrderForm';
import LabelCanvas from '../components/LabelCanvas';

export default function NewOrder() {
  const [createdOrder, setCreatedOrder] = useState(null);
  const navigate = useNavigate();

  const trackUrl = createdOrder ? `${window.location.protocol}//${window.location.host}/track/${createdOrder.customer_token}` : '';
  const receiptWaUrl = createdOrder ? `https://wa.me/${createdOrder.phone}?text=${encodeURIComponent(
    `السلام عليكم ${createdOrder.customer_name}،\n\nتم استلام طلب الصيانة الخاص بك.\nنوع القطعة: ${createdOrder.piece_type}\nرقم الطلب: ${createdOrder.order_number}\n\nيمكنك متابعة حالة الطلب عبر الرابط:\n${trackUrl}`
  )}` : '';

  if (createdOrder) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '560px', width: '100%' }}
      >
        {/* Success header */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          style={{
            background: 'var(--status-ready-bg)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: 'var(--status-ready-fg)', fontSize: '1.4rem' }}>✓</span>
          <div>
            <div style={{ color: 'var(--status-ready-fg)', fontWeight: 700 }}>تم حفظ الصيانة</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
              العميل: {createdOrder.customer_name} — {createdOrder.piece_type}
            </div>
          </div>
        </motion.div>

        {/* Order number stamp */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>رقم الطلب</div>
          <span className="order-stamp" style={{ fontSize: '1rem', padding: '6px 18px' }}>
            {createdOrder.order_number}
          </span>
        </div>

        <div className="gold-line" style={{ marginBottom: '24px' }} />

        {/* Label preview + print */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
            معاينة الملصق
          </div>
          <LabelCanvas order={createdOrder} autoPrint={true} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <a href={receiptWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button
              className="btn-gold"
              style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
            >
              📲 إرسال إيصال الاستلام (WhatsApp) ↗
            </button>
          </a>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              className="btn-ghost"
              onClick={() => navigate('/')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              ← العودة للطلبات
            </button>
            <button
              className="btn-primary"
              onClick={() => setCreatedOrder(null)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              ✦ صيانة جديدة
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '520px', width: '100%' }}
    >
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          صيانة جديدة
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          أدخل بيانات العميل والقطعة
        </div>
      </div>

      <div className="gold-line" style={{ marginBottom: '28px' }} />

      <OrderForm onSuccess={setCreatedOrder} />
    </motion.div>
  );
}
