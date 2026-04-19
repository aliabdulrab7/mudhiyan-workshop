import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../api/orders';
import LabelCanvas from '../components/LabelCanvas';
import { Icons } from '../components/icons';

const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'ساعة', 'أخرى'];
const newItem = () => ({ item_type: 'خاتم', quantity: 1, notes: '', workshop_comment: '' });

const STORAGE_KEY = 'new_order_draft';
function saveDraft(s) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {} }
function loadDraft() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; } }
function clearDraft() { try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {} }

// ── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ order, onNewOrder }) {
  const navigate = useNavigate();
  const trackUrl = `${window.location.protocol}//${window.location.host}/track/${order.customer_token}`;
  const waUrl = `https://wa.me/${order.phone}?text=${encodeURIComponent(
    `السلام عليكم ${order.customer_name}،\n\nتم استلام طلب الصيانة الخاص بك.\nنوع القطعة: ${order.piece_type}\nرقم الطلب: ${order.order_number}\n\nيمكنك متابعة حالة الطلب عبر الرابط:\n${trackUrl}`
  )}`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">تم إنشاء الطلب</h1>
          <div className="page-sub">{order.customer_name} · {order.piece_type}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={() => navigate('/')}>
            العودة للطلبات
          </button>
          <button className="btn btn-sm btn-primary" onClick={onNewOrder}>
            <Icons.Plus size={12} /> صيانة جديدة
          </button>
        </div>
      </div>

      <div className="form-wrap" style={{ maxWidth: 560 }}>
        {/* Success banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', marginBottom: 20,
          background: 'oklch(0.60 0.15 150 / 0.08)',
          border: '1px solid oklch(0.60 0.15 150 / 0.25)',
          borderRadius: 'var(--radius-sm)', borderRight: '3px solid var(--success)',
        }}>
          <Icons.Check size={16} stroke="var(--success)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--success)' }}>تم حفظ الصيانة</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>سيتلقى العميل إشعاراً تلقائياً</div>
          </div>
        </div>

        {/* Order number */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>رقم الطلب</div>
          <span className="stamp" style={{ fontSize: 16, padding: '4px 16px' }}>{order.order_number}</span>
        </div>

        <hr className="hr" />

        {/* Label */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label" style={{ marginBottom: 10 }}>معاينة الملصق</div>
          <LabelCanvas order={order} autoPrint={true} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 38 }}>
              <Icons.Phone size={13} /> إرسال إيصال الاستلام (WhatsApp) ↗
            </button>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/')}>
              العودة للطلبات
            </button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onNewOrder}>
              <Icons.Plus size={12} /> صيانة جديدة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main flat form ───────────────────────────────────────────────────────────
export default function NewOrder() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    const draft = loadDraft();
    return draft ?? { customerName: '', phoneDigits: '', items: [newItem()] };
  });
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);

  useEffect(() => {
    if (!createdOrder) saveDraft(form);
  }, [form, createdOrder]);

  // Keyboard shortcut: ⌘S to save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSubmit(); }
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form]);

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function updateItem(i, field, value) {
    setForm(prev => ({ ...prev, items: prev.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }));
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, newItem()] }));
  }

  function removeItem(i) {
    if (form.items.length === 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  }

  function validate() {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = 'يرجى إدخال اسم العميل';
    if (form.phoneDigits.length !== 9) errs.phone = 'يرجى إدخال 9 أرقام بعد رمز الدولة';
    form.items.forEach((it, i) => {
      if (!it.workshop_comment.trim()) errs[`item_${i}`] = 'الإصلاح المطلوب مطلوب';
    });
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true); setSubmitError('');
    try {
      const order = await createOrder({
        customer_name: form.customerName.trim(),
        phone:         '966' + form.phoneDigits,
        items:         form.items.map(r => ({
          item_name:        r.item_type,
          quantity:         Number(r.quantity) || 1,
          notes:            r.notes.trim(),
          workshop_comment: r.workshop_comment.trim(),
        })),
      });
      clearDraft();
      setCreatedOrder(order);
    } catch (err) {
      setSubmitError(err.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  }

  if (createdOrder) {
    return (
      <SuccessScreen
        order={createdOrder}
        onNewOrder={() => {
          setCreatedOrder(null);
          setForm({ customerName: '', phoneDigits: '', items: [newItem()] });
          setErrors({});
          setSubmitError('');
        }}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">صيانة جديدة</h1>
          <div className="page-sub">أنشئ طلب صيانة — سيُرسَل رقم تتبّع للعميل تلقائيًا</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={() => navigate('/')}>
            إلغاء <span className="kbd">esc</span>
          </button>
          <button className="btn btn-sm btn-primary" disabled={loading} onClick={handleSubmit}>
            <Icons.Check size={12} /> {loading ? 'جاري الحفظ...' : 'حفظ الطلب'}
            <span className="kbd" style={{ opacity: 0.7 }}>⌘S</span>
          </button>
        </div>
      </div>

      <div className="form-wrap">
        <div className="form-card">
          {/* Customer info */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div>
              <label className="field-label">اسم العميل</label>
              <input
                className="input"
                placeholder="محمد العتيبي"
                value={form.customerName}
                onChange={e => updateForm('customerName', e.target.value)}
                style={errors.customerName ? { borderColor: 'var(--danger)' } : {}}
                autoFocus
              />
              {errors.customerName && (
                <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4 }}>{errors.customerName}</div>
              )}
            </div>
            <div>
              <label className="field-label">رقم الجوال</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="input mono" style={{
                  width: 66, display: 'grid', placeItems: 'center',
                  background: 'var(--bg-soft)', color: 'var(--text-muted)', flexShrink: 0,
                }}>+966</span>
                <input
                  className="input mono"
                  placeholder="5XXXXXXXX"
                  inputMode="numeric"
                  value={form.phoneDigits}
                  onChange={e => updateForm('phoneDigits', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  style={errors.phone ? { borderColor: 'var(--danger)' } : {}}
                />
              </div>
              {errors.phone && (
                <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4 }}>{errors.phone}</div>
              )}
            </div>
          </div>

          {/* Items table */}
          <label className="field-label">الأصناف</label>
          <div className="items-table">
            <div className="items-thead">
              <span>النوع</span>
              <span style={{ textAlign: 'center' }}>عدد</span>
              <span>ملاحظات الاستلام</span>
              <span>الإصلاح المطلوب <span style={{ color: 'var(--danger)' }}>*</span></span>
              <span />
            </div>
            {form.items.map((row, i) => (
              <div key={i} className="items-row">
                <select
                  className="select"
                  value={row.item_type}
                  onChange={e => updateItem(i, 'item_type', e.target.value)}
                  style={{ height: 30 }}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="input mono"
                  style={{ textAlign: 'center', height: 30 }}
                  type="number" min="1" max="99"
                  value={row.quantity}
                  onChange={e => updateItem(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                />
                <input
                  className="input"
                  style={{ height: 30, borderColor: errors[`item_${i}`] ? 'var(--danger)' : undefined }}
                  placeholder="خدش طفيف، سلسلة تالفة…"
                  value={row.notes}
                  onChange={e => updateItem(i, 'notes', e.target.value)}
                />
                <input
                  className="input"
                  style={{ height: 30, borderColor: errors[`item_${i}`] ? 'var(--danger)' : undefined }}
                  placeholder="لحام، تلميع، إعادة تحجير…"
                  value={row.workshop_comment}
                  onChange={e => updateItem(i, 'workshop_comment', e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => removeItem(i)}
                  disabled={form.items.length === 1}
                  style={{ opacity: form.items.length === 1 ? 0.3 : 1 }}
                >
                  <Icons.X size={13} />
                </button>
              </div>
            ))}
            <button className="items-add" onClick={addItem}>
              <Icons.Plus size={12} /> &nbsp;إضافة صنف
            </button>
          </div>

          <hr className="hr" />

          {/* Info note */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'var(--bg-soft)', padding: 12, borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}>
            <Icons.Sparkle size={14} stroke="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              عند الحفظ: سيُرسَل رقم الطلب ورابط التتبّع عبر WhatsApp للعميل، وتُطبع ملصقات لكل صنف تلقائيًا.
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: 'oklch(0.58 0.21 25 / 0.06)',
              border: '1px solid oklch(0.58 0.21 25 / 0.2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 12.5,
            }}>
              {submitError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
