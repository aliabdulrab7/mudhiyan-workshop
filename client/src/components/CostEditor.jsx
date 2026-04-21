import { useState } from 'react';
import { updateCost } from '../api/orders';
import { buildApprovalWaUrl, buildTrackingUrl } from '../utils/whatsapp';

export default function CostEditor({ order, onUpdated }) {
  const [cost, setCost]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const updated = await updateCost(order.id, parseInt(cost, 10));
      onUpdated(updated);
      if (updated.status === 'waiting_approval') {
        window.open(buildApprovalWaUrl(updated.phone, updated.customer_name, updated.cost, buildTrackingUrl(updated.customer_token)), '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: 'var(--primary-soft)',
      border: '1px solid var(--border)',
      borderRight: '3px solid var(--primary)',
      borderRadius: 'var(--radius)',
      padding: '14px',
      marginBottom: '16px',
    }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '10px', fontWeight: 600 }}>
        تحديد تكلفة الإصلاح
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            className="input-base"
            type="number"
            min="0"
            placeholder="0 (مجاني)"
            value={cost}
            onChange={e => setCost(e.target.value)}
            required
            style={{ direction: 'ltr', textAlign: 'left' }}
            data-testid="cost-editor__input"
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            بالريال السعودي — أدخل 0 للخدمة المجانية
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || cost === ''}
          style={{ padding: '10px 16px', fontSize: '0.88rem', flexShrink: 0 }}
          data-testid="cost-editor__submit"
        >
          {loading ? '...' : 'تأكيد'}
        </button>
      </form>
      {error && (
        <div style={{ color: '#DC2626', fontSize: '0.82rem', marginTop: '8px' }}>{error}</div>
      )}
    </div>
  );
}
