import { useState, useEffect } from 'react';
import { getInventory, createInventoryItem, adjustInventoryStock } from '../api/inventory';
import { Icons } from '../components/icons';

export default function InventoryPage() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [adjusting, setAdjusting]   = useState({});
  const [form, setForm]             = useState({ name: '', category: '', stock_qty: 0, unit: 'قطعة', cost_per_unit: 0 });

  async function load() {
    setLoading(true);
    try { setItems(await getInventory()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError('');
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
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  async function handleAdjust(id, delta) {
    setAdjusting(a => ({ ...a, [id]: true }));
    try { await adjustInventoryStock(id, delta); await load(); }
    catch (e) { setError(e.message); }
    finally { setAdjusting(a => ({ ...a, [id]: false })); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">المخزون</h1>
          <div className="page-sub">إدارة مواد وكميات المخزون</div>
        </div>
        <div className="page-actions">
          {!showForm && (
            <button className="btn btn-sm btn-primary"
              onClick={() => { setForm({ name: '', category: '', stock_qty: 0, unit: 'قطعة', cost_per_unit: 0 }); setError(''); setShowForm(true); }}
              data-testid="inventory__add-button">
              <Icons.Plus size={12} /> إضافة مادة
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Create form */}
        {showForm && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 16, maxWidth: 680 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>إضافة مادة جديدة</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">اسم المادة <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: ذهب عيار 18" required autoFocus
                  data-testid="inventory__form__name-input" />
              </div>
              <div>
                <label className="field-label">الفئة <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>(اختياري)</span></label>
                <input className="input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="مثال: معادن، أحجار"
                  data-testid="inventory__form__category-input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">الكمية</label>
                  <input className="input mono" type="number" min="0" value={form.stock_qty}
                    onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))}
                    style={{ direction: 'ltr', textAlign: 'left' }}
                    data-testid="inventory__form__qty-input" />
                </div>
                <div>
                  <label className="field-label">الوحدة</label>
                  <input className="input" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="قطعة"
                    data-testid="inventory__form__unit-input" />
                </div>
                <div>
                  <label className="field-label">سعر الوحدة (ريال)</label>
                  <input className="input mono" type="number" min="0" step="0.01" value={form.cost_per_unit}
                    onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                    style={{ direction: 'ltr', textAlign: 'left' }}
                    data-testid="inventory__form__cost-input" />
                </div>
              </div>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 12, padding: '8px 12px', background: 'oklch(0.58 0.21 25 / 0.06)', border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius-sm)' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }} data-testid="inventory__form__submit">
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }} data-testid="inventory__form__cancel">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error */}
        {error && !showForm && (
          <div style={{ color: 'var(--danger)', fontSize: 12.5, padding: '10px 14px', background: 'oklch(0.58 0.21 25 / 0.06)', border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا يوجد مواد في المخزون
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المادة</th>
                  <th>الفئة</th>
                  <th>الكمية</th>
                  <th>الوحدة</th>
                  <th>سعر الوحدة</th>
                  <th style={{ textAlign: 'center' }}>تعديل</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.category || '—'}</td>
                    <td>
                      <span className="mono" style={{
                        fontWeight: 700, fontSize: 14,
                        color: item.stock_qty <= 0 ? 'var(--danger)' : 'var(--text)',
                      }}>
                        {item.stock_qty}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.unit}</td>
                    <td className="mono" style={{ color: 'var(--primary)' }}>{Number(item.cost_per_unit).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={adjusting[item.id]}
                          onClick={() => handleAdjust(item.id, -1)}
                          style={{ width: 28, padding: 0, justifyContent: 'center', fontFamily: 'var(--font-mono)' }}
                          data-testid={`inventory__row__${item.id}__decrease`}
                        >−</button>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={adjusting[item.id]}
                          onClick={() => handleAdjust(item.id, 1)}
                          style={{ width: 28, padding: 0, justifyContent: 'center', fontFamily: 'var(--font-mono)' }}
                          data-testid={`inventory__row__${item.id}__increase`}
                        >+</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
