import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OrderForm from '../components/OrderForm';
import LabelCanvas from '../components/LabelCanvas';

export default function NewOrder() {
  const [createdOrder, setCreatedOrder] = useState(null);
  const navigate = useNavigate();

  if (createdOrder) {
    return (
      <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '560px', width: '100%' }}>
        {/* Success header */}
        <div style={{
          background: 'var(--status-ready-bg)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ color: 'var(--status-ready-fg)', fontSize: '1.4rem' }}>✓</span>
          <div>
            <div style={{ color: 'var(--status-ready-fg)', fontWeight: 700 }}>تم حفظ الصيانة</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
              العميل: {createdOrder.customer_name} — {createdOrder.piece_type}
            </div>
          </div>
        </div>

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
          <LabelCanvas order={createdOrder} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-ghost"
            onClick={() => navigate('/')}
          >
            ← العودة للطلبات
          </button>
          <button
            className="btn-gold"
            onClick={() => setCreatedOrder(null)}
          >
            ✦ صيانة جديدة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '520px', width: '100%' }}>
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
    </div>
  );
}
