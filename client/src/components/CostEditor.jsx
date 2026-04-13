import { useState } from 'react';
import { updateCost } from '../api/orders';

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: 'rgba(201,151,58,0.06)',
      border: '1px solid var(--gold-border)',
      borderRadius: 'var(--radius)',
      padding: '14px',
      marginBottom: '16px',
    }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 600 }}>
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
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            بالريال السعودي — أدخل 0 للخدمة المجانية
          </div>
        </div>
        <button
          type="submit"
          className="btn-gold"
          disabled={loading || cost === ''}
          style={{ padding: '10px 16px', fontSize: '0.88rem', flexShrink: 0 }}
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
