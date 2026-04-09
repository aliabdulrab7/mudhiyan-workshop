import { useState } from 'react';
import { createOrder } from '../api/orders';

const PIECE_TYPES = ['خاتم', 'سلسلة', 'أسورة', 'قرط', 'دبلة', 'ساعة', 'أخرى'];

export default function OrderForm({ onSuccess }) {
  const [form, setForm] = useState({
    customer_name: '',
    phone_digits: '',
    piece_type: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_name.trim()) return setError('يرجى إدخال اسم العميل');
    if (form.phone_digits.length !== 9) return setError('يرجى إدخال 9 أرقام بعد رمز الدولة');
    if (!form.piece_type) return setError('يرجى اختيار نوع القطعة');

    setLoading(true);
    try {
      const order = await createOrder({
        customer_name: form.customer_name.trim(),
        phone: '966' + form.phone_digits,
        piece_type: form.piece_type,
        notes: form.notes.trim(),
      });
      onSuccess(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Customer name */}
      <div>
        <label style={{ display: 'block', marginBottom: '7px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          اسم العميل
        </label>
        <input
          className="input-base"
          type="text"
          placeholder="محمد العتيبي"
          value={form.customer_name}
          onChange={e => set('customer_name', e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
        />
      </div>

      {/* Phone */}
      <div>
        <label style={{ display: 'block', marginBottom: '7px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          رقم الجوال
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
          <span style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--gold-border)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            color: 'var(--gold)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
          }}>+966</span>
          <input
            className="input-base"
            type="tel"
            inputMode="numeric"
            placeholder="5XXXXXXXX"
            value={form.phone_digits}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 9);
              set('phone_digits', val);
            }}
            style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}
          />
        </div>
      </div>

      {/* Piece type — tap chips */}
      <div>
        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          نوع القطعة
        </label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}>
          {PIECE_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('piece_type', t)}
              style={{
                background: form.piece_type === t ? 'rgba(201,168,76,0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${form.piece_type === t ? 'var(--gold)' : 'var(--gold-border)'}`,
                color: form.piece_type === t ? 'var(--gold)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius)',
                height: '52px',
                cursor: 'pointer',
                fontFamily: 'Almarai, sans-serif',
                fontSize: '0.92rem',
                fontWeight: form.piece_type === t ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={{ display: 'block', marginBottom: '7px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          ملاحظات <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>(اختياري)</span>
        </label>
        <textarea
          className="input-base"
          placeholder="وصف العطل أو تعليمات إضافية..."
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          color: '#FCA5A5',
          fontSize: '0.88rem',
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-gold"
        disabled={loading}
        style={{ marginTop: '4px', width: '100%', minHeight: '52px', fontSize: '1rem', justifyContent: 'center' }}
      >
        {loading ? 'جاري الحفظ...' : '✦ حفظ الصيانة'}
      </button>
    </form>
  );
}
