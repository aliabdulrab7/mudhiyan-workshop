import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createOrder } from '../api/orders';
import LabelCanvas from '../components/LabelCanvas';
import { Icons } from '../components/icons';

// ── Constants ────────────────────────────────────────────
const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'ساعة', 'أخرى'];

const STEPS = [
  { id: 1, label: 'العميل' },
  { id: 2, label: 'القطع' },
  { id: 3, label: 'المراجعة' },
];

const newItem = () => ({ item_type: 'خاتم', quantity: 1, notes: '', workshop_comment: '' });

const STORAGE_KEY = 'new_order_draft';

// ── Helpers ──────────────────────────────────────────────
function saveDraft(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function loadDraft() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; }
}

function clearDraft() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ── Success screen ───────────────────────────────────────
function SuccessScreen({ order, onNewOrder }) {
  const navigate = useNavigate();
  const trackUrl = `${window.location.protocol}//${window.location.host}/track/${order.customer_token}`;
  const waUrl = `https://wa.me/${order.phone}?text=${encodeURIComponent(
    `السلام عليكم ${order.customer_name}،\n\nتم استلام طلب الصيانة الخاص بك.\nنوع القطعة: ${order.piece_type}\nرقم الطلب: ${order.order_number}\n\nيمكنك متابعة حالة الطلب عبر الرابط:\n${trackUrl}`
  )}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '560px', width: '100%' }}
    >
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-3.5 mb-6"
        style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.20)' }}>
        <span className="text-xl" style={{ color: '#16A34A' }}>✓</span>
        <div>
          <div className="font-bold text-sm" style={{ color: '#16A34A' }}>تم حفظ الصيانة</div>
          <div className="text-xs text-text-muted mt-0.5">
            {order.customer_name} — {order.piece_type}
          </div>
        </div>
      </div>

      {/* Order number */}
      <div className="text-center mb-6">
        <div className="text-xs text-text-muted mb-2">رقم الطلب</div>
        <span className="order-stamp text-[1rem] px-5 py-1.5">{order.order_number}</span>
      </div>

      <div className="gold-line mb-6" />

      {/* Label */}
      <div className="mb-6">
        <div className="text-sm text-text-soft mb-3">معاينة الملصق</div>
        <LabelCanvas order={order} autoPrint={true} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="no-underline">
          <button className="btn-gold w-full justify-center" style={{ minHeight: '44px' }}>
            📲 إرسال إيصال الاستلام (WhatsApp) ↗
          </button>
        </a>
        <div className="flex gap-2.5 mt-2">
          <button className="btn-ghost flex-1 justify-center" onClick={() => navigate('/')}>
            ← العودة للطلبات
          </button>
          <button className="btn-primary flex-1 justify-center" onClick={onNewOrder}>
            + صيانة جديدة
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Step indicator ───────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done    = s.id < current;
        const active  = s.id === current;
        return (
          <div key={s.id} className="flex items-center">
            {i > 0 && (
              <div className="w-12 h-px mx-1" style={{ background: done ? 'var(--primary)' : 'var(--border-strong)' }} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition-all"
                style={{
                  background: done ? 'var(--primary)' : active ? 'var(--bg-raised)' : 'var(--bg-soft)',
                  border: active ? '2px solid var(--primary)' : done ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
                  color: done ? '#fff' : active ? 'var(--primary)' : 'var(--text-faint)',
                  boxShadow: active ? '0 0 0 4px var(--primary-ring)' : 'none',
                }}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6.5 5,9 10,3.5" />
                  </svg>
                ) : s.id}
              </div>
              <span className="text-[10px] font-medium" style={{ color: active ? 'var(--primary)' : done ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Customer ─────────────────────────────────────
function StepCustomer({ data, onChange, errors }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block mb-2 text-sm font-medium text-text-soft">اسم العميل</label>
        <input
          className="input-base"
          type="text"
          placeholder="محمد العتيبي"
          value={data.customerName}
          onChange={e => onChange('customerName', e.target.value)}
          style={errors.customerName ? { borderColor: '#DC2626' } : {}}
          autoComplete="off"
          autoCapitalize="words"
          autoFocus
        />
        {errors.customerName && <p className="text-xs mt-1.5" style={{ color: '#DC2626' }}>{errors.customerName}</p>}
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-text-soft">رقم الجوال</label>
        <div className="flex gap-2 items-stretch">
          <span className="flex items-center px-3.5 rounded border font-mono text-sm flex-shrink-0"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--primary)' }}>
            +966
          </span>
          <input
            className="input-base font-mono"
            type="tel"
            inputMode="numeric"
            placeholder="5XXXXXXXX"
            value={data.phoneDigits}
            onChange={e => onChange('phoneDigits', e.target.value.replace(/\D/g, '').slice(0, 9))}
            style={{ letterSpacing: '0.08em', ...(errors.phone ? { borderColor: '#DC2626' } : {}) }}
          />
        </div>
        {errors.phone && <p className="text-xs mt-1.5" style={{ color: '#DC2626' }}>{errors.phone}</p>}
      </div>
    </div>
  );
}

// ── Step 2: Items ────────────────────────────────────────
function StepItems({ items, onChange, errors }) {
  function addItem() {
    onChange([...items, newItem()]);
  }

  function removeItem(i) {
    if (items.length === 1) return;
    onChange(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i, field, value) {
    onChange(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="bg-bg-soft rounded-lg border border-border p-4 flex flex-col gap-3 relative">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="absolute top-3 left-3 w-6 h-6 rounded grid place-items-center text-text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <Icons.X size={13} />
            </button>
          )}

          <div className="text-[10px] font-semibold text-text-faint uppercase tracking-wider mb-1">
            الصنف {i + 1}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 80px' }}>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">نوع القطعة</label>
              <select
                value={item.item_type}
                onChange={e => updateItem(i, 'item_type', e.target.value)}
                className="input-base"
                style={{ padding: '7px 10px', fontSize: '0.88rem' }}
              >
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">العدد</label>
              <input
                type="number"
                min="1"
                max="99"
                value={item.quantity}
                onChange={e => updateItem(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                className="input-base font-mono text-center"
                style={{ padding: '7px 6px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">ملاحظات العميل (اختياري)</label>
            <input
              type="text"
              placeholder="تفاصيل إضافية..."
              value={item.notes}
              onChange={e => updateItem(i, 'notes', e.target.value)}
              className="input-base"
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">الإصلاح المطلوب <span style={{ color: '#DC2626' }}>*</span></label>
            <textarea
              placeholder="اذكر الإصلاح المطلوب بوضوح..."
              value={item.workshop_comment}
              onChange={e => updateItem(i, 'workshop_comment', e.target.value)}
              className="input-base"
              style={{
                fontSize: '0.88rem',
                resize: 'vertical',
                minHeight: '60px',
                ...(errors[`item_comment_${i}`] ? { borderColor: '#DC2626' } : {}),
              }}
            />
            {errors[`item_comment_${i}`] && (
              <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors[`item_comment_${i}`]}</p>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="w-full py-2.5 rounded-lg text-sm transition-colors"
        style={{
          background: 'transparent',
          border: '1px dashed var(--border-strong)',
          color: 'var(--primary)',
          fontFamily: 'Almarai, sans-serif',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-soft)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent'; }}
      >
        + إضافة صنف آخر
      </button>
    </div>
  );
}

// ── Step 3: Review ───────────────────────────────────────
function StepReview({ customerName, phoneDigits, items }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Customer summary */}
      <div className="bg-bg-soft rounded-lg border border-border p-4">
        <div className="text-[10px] font-semibold text-text-faint uppercase tracking-wider mb-3">بيانات العميل</div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">الاسم</span>
            <span className="font-semibold text-text">{customerName || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">الجوال</span>
            <span className="font-mono text-text">+966 {phoneDigits || '—'}</span>
          </div>
        </div>
      </div>

      {/* Items summary */}
      <div className="bg-bg-soft rounded-lg border border-border p-4">
        <div className="text-[10px] font-semibold text-text-faint uppercase tracking-wider mb-3">
          الأصناف ({items.length})
        </div>
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 pb-3 border-b border-border-faint last:pb-0 last:border-0">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-text">{item.item_type}</span>
                {item.quantity > 1 && (
                  <span className="font-mono text-xs text-text-muted">× {item.quantity}</span>
                )}
              </div>
              {item.notes && <div className="text-xs text-text-muted">{item.notes}</div>}
              <div className="text-xs text-text-soft bg-bg-raised rounded px-2.5 py-1.5 border border-border">
                {item.workshop_comment || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main wizard component ────────────────────────────────
export default function NewOrder() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState(() => {
    const draft = loadDraft();
    return draft ?? {
      customerName: '',
      phoneDigits: '',
      items: [newItem()],
    };
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);

  // Persist draft on every form change
  useEffect(() => {
    if (!createdOrder) saveDraft(form);
  }, [form, createdOrder]);

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.customerName.trim()) errs.customerName = 'يرجى إدخال اسم العميل';
      if (form.phoneDigits.length !== 9) errs.phone = 'يرجى إدخال 9 أرقام بعد رمز الدولة';
    }
    if (s === 2) {
      form.items.forEach((it, i) => {
        if (!it.workshop_comment.trim()) errs[`item_comment_${i}`] = 'الإصلاح المطلوب مطلوب';
      });
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  }

  function goPrev() {
    setErrors({});
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    setLoading(true);
    setSubmitError('');
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

  // ── Success ──────────────────────────────────────────
  if (createdOrder) {
    return (
      <SuccessScreen
        order={createdOrder}
        onNewOrder={() => {
          setCreatedOrder(null);
          setStep(1);
          setForm({ customerName: '', phoneDigits: '', items: [newItem()] });
          setErrors({});
          setSubmitError('');
        }}
      />
    );
  }

  // ── Wizard ───────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ padding: 'clamp(16px, 4vw, 32px) clamp(14px, 4vw, 36px)', maxWidth: '540px', width: '100%' }}
    >
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text m-0 mb-1">صيانة جديدة</h1>
        <div className="text-xs text-text-muted">أدخل بيانات العميل والقطعة</div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="bg-bg-raised border border-border rounded-xl p-5 mb-5 shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            {step === 1 && (
              <StepCustomer
                data={form}
                onChange={updateForm}
                errors={errors}
              />
            )}
            {step === 2 && (
              <StepItems
                items={form.items}
                onChange={items => setForm(prev => ({ ...prev, items }))}
                errors={errors}
              />
            )}
            {step === 3 && (
              <StepReview
                customerName={form.customerName}
                phoneDigits={form.phoneDigits}
                items={form.items}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)', color: '#DC2626' }}>
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="btn-ghost flex-1 justify-center"
            disabled={loading}
          >
            → رجوع
          </button>
        )}
        {step < STEPS.length ? (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary flex-1 justify-center"
            style={{ minHeight: '44px' }}
          >
            التالي ←
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary flex-1 justify-center"
            disabled={loading}
            style={{ minHeight: '44px', fontSize: '1rem' }}
          >
            {loading ? 'جاري الحفظ...' : '✓ إنشاء الطلب'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
