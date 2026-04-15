import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getInventory, createInventoryItem, adjustInventoryStock } from '../api/inventory';

export default function InventoryPage() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [adjusting, setAdjusting]   = useState({}); // { [id]: true }
  const [form, setForm]             = useState({
    name: '',
    category: '',
    stock_qty: 0,
    unit: 'قطعة',
    cost_per_unit: 0,
  });

  async function load() {
    setLoading(true);
    try { setItems(await getInventory()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleShowForm() {
    setForm({ name: '', category: '', stock_qty: 0, unit: 'قطعة', cost_per_unit: 0 });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createInventoryItem({
        name: form.name,
        category: form.category || undefined,
        stock_qty: Number(form.stock_qty),
        unit: form.unit,
        cost_per_unit: Number(form.cost_per_unit),
      });
      setShowForm(false);
      setForm({ name: '', category: '', stock_qty: 0, unit: 'قطعة', cost_per_unit: 0 });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjust(id, delta) {
    setAdjusting(a => ({ ...a, [id]: true }));
    try {
      await adjustInventoryStock(id, delta);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdjusting(a => ({ ...a, [id]: false }));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '28px', maxWidth: '800px', direction: 'rtl' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>المخزون</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            إدارة مواد وكميات المخزون
          </p>
        </div>
        {!showForm && (
          <button className="btn-gold" onClick={handleShowForm}>✦ إضافة مادة</button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>
              إضافة مادة جديدة
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  اسم المادة <span style={{ color: 'var(--gold)' }}>*</span>
                </label>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: ذهب عيار 18"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  الفئة <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>(اختياري)</span>
                </label>
                <input
                  className="input-base"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="مثال: معادن، أحجار"
                />
              </div>

              {/* Qty + Unit + Price row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    الكمية
                  </label>
                  <input
                    className="input-base"
                    type="number"
                    min="0"
                    value={form.stock_qty}
                    onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))}
                    style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    الوحدة
                  </label>
                  <input
                    className="input-base"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="قطعة"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    سعر الوحدة (ريال)
                  </label>
                  <input
                    className="input-base"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_per_unit}
                    onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                    style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn-gold" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? '...' : '✦ حفظ'}
                </button>
                <button className="btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ flex: 0.5, justifyContent: 'center' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error outside form */}
      {error && !showForm && (
        <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Inventory list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          لا يوجد مواد في المخزون
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr 1fr 100px',
            gap: '8px',
            padding: '8px 20px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: '6px',
          }}>
            <span>المادة</span>
            <span>الفئة</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>الكمية</span>
            <span>الوحدة</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>السعر</span>
            <span style={{ textAlign: 'center' }}>تعديل</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.2fr 0.8fr 1fr 100px',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Name */}
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.97rem' }}>
                    {item.name}
                  </div>

                  {/* Category */}
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {item.category || '—'}
                  </div>

                  {/* Stock qty */}
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: item.stock_qty <= 0 ? '#F87171' : 'var(--text-primary)',
                  }}>
                    {item.stock_qty}
                  </div>

                  {/* Unit */}
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    {item.unit}
                  </div>

                  {/* Cost per unit */}
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: 'var(--gold)' }}>
                    {Number(item.cost_per_unit).toFixed(2)}
                  </div>

                  {/* Adjust +/- */}
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={adjusting[item.id]}
                      onClick={() => handleAdjust(item.id, -1)}
                      style={{
                        width: '30px', height: '30px',
                        border: '1px solid var(--gold-border)',
                        borderRadius: '6px',
                        background: 'rgba(201,151,58,0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      −
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={adjusting[item.id]}
                      onClick={() => handleAdjust(item.id, 1)}
                      style={{
                        width: '30px', height: '30px',
                        border: '1px solid var(--gold-border)',
                        borderRadius: '6px',
                        background: 'rgba(201,151,58,0.08)',
                        color: 'var(--gold)',
                        fontSize: '1rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      +
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}
