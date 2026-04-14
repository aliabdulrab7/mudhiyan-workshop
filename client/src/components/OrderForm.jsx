import { useState } from 'react';
import { createOrder } from '../api/orders';

const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'أخرى'];

const newRow = () => ({ item_type: 'خاتم', quantity: 1, notes: '' });

export default function OrderForm({ onSuccess }) {
  const [customerName, setCustomerName] = useState('');
  const [phoneDigits,  setPhoneDigits]  = useState('');
  const [items,        setItems]        = useState([newRow()]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  function addRow() {
    setItems(prev => [...prev, newRow()]);
  }

  function removeRow(i) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i, field, value) {
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim())         return setError('يرجى إدخال اسم العميل');
    if (phoneDigits.length !== 9)     return setError('يرجى إدخال 9 أرقام بعد رمز الدولة');
    if (items.length === 0)           return setError('يرجى إضافة صنف واحد على الأقل');

    setLoading(true);
    try {
      const order = await createOrder({
        customer_name: customerName.trim(),
        phone:         '966' + phoneDigits,
        items:         items.map(r => ({
          item_type: r.item_type,
          quantity:  Number(r.quantity) || 1,
          notes:     r.notes.trim(),
        })),
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
          value={customerName}
          onChange={e => { setCustomerName(e.target.value); setError(''); }}
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
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 'var(--radius)',
            padding: '8px 14px',
            color: '#58a6ff',
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
            value={phoneDigits}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 9);
              setPhoneDigits(val);
              setError('');
            }}
            style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}
          />
        </div>
      </div>

      {/* Items table */}
      <div>
        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          الأصناف
        </label>

        <div style={{ border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 72px 1fr 32px',
            padding: '8px 10px',
            background: '#0d1117',
            borderBottom: '1px solid #30363d',
            fontSize: '0.70rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            gap: '6px',
          }}>
            <span>النوع</span>
            <span style={{ textAlign: 'center' }}>العدد</span>
            <span>تعليق</span>
            <span />
          </div>

          {/* Rows */}
          {items.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 72px 1fr 32px',
                padding: '6px 8px',
                borderBottom: i < items.length - 1 ? '1px solid #21262d' : 'none',
                alignItems: 'center',
                gap: '6px',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}
            >
              {/* Type */}
              <select
                value={row.item_type}
                onChange={e => updateRow(i, 'item_type', e.target.value)}
                className="input-base"
                style={{ padding: '6px 10px', fontSize: '0.88rem' }}
              >
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Quantity */}
              <input
                type="number"
                min="1"
                max="99"
                value={row.quantity}
                onChange={e => updateRow(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                className="input-base"
                style={{ padding: '6px 6px', textAlign: 'center', fontSize: '0.88rem' }}
              />

              {/* Notes */}
              <input
                type="text"
                placeholder="تعليق..."
                value={row.notes}
                onChange={e => updateRow(i, 'notes', e.target.value)}
                className="input-base"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />

              {/* Delete row */}
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={items.length === 1}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: items.length === 1 ? '#21262d' : '#6e7681',
                  cursor: items.length === 1 ? 'default' : 'pointer',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => { if (items.length > 1) e.currentTarget.style.color = '#f85149'; }}
                onMouseLeave={e => { e.currentTarget.style.color = items.length === 1 ? '#21262d' : '#6e7681'; }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        <button
          type="button"
          onClick={addRow}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px dashed #30363d',
            borderRadius: '6px',
            padding: '8px',
            color: '#58a6ff',
            fontSize: '0.85rem',
            fontFamily: 'Almarai, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#58a6ff'; e.currentTarget.style.background = 'rgba(88,166,255,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.background = 'transparent'; }}
        >
          + إضافة صنف
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(248,81,73,0.10)',
          border: '1px solid rgba(248,81,73,0.25)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          color: '#f85149',
          fontSize: '0.88rem',
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-gold"
        disabled={loading}
        style={{ marginTop: '4px', width: '100%', minHeight: '48px', fontSize: '1rem', justifyContent: 'center' }}
      >
        {loading ? 'جاري الحفظ...' : '✓ حفظ الصيانة'}
      </button>
    </form>
  );
}
