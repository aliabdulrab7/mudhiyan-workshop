import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../api/orders';
import { getRepairOptions } from '../api/repair-options';
import LabelCanvas from '../components/LabelCanvas';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Input from '../components/ui/Input';
import SegmentedGroup from '../components/ui/SegmentedGroup';
import Select from '../components/ui/Select';

const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'ساعة', 'أخرى'];
const COLOR_OPTIONS = ['أصفر', 'روز جولد', 'أبيض'];

const newRepair = () => ({ type: '', detail: '' });
const newItem   = () => ({ item_type: 'خاتم', quantity: 1, notes: '', repairs: [newRepair()] });

function migrateItem(it) {
  if (!it) return newItem();
  const base = {
    item_type: it.item_type || 'خاتم',
    quantity:  it.quantity  || 1,
    notes:     it.notes     || '',
  };
  if (Array.isArray(it.repairs)) {
    const rs = it.repairs
      .map(r => ({ type: r.type || '', detail: r.detail || '' }))
      .filter(r => r.type || r.detail);
    return { ...base, repairs: rs.length ? rs : [newRepair()] };
  }
  if (it.repair_type !== undefined) {
    return { ...base, repairs: [{ type: it.repair_type || '', detail: it.repair_detail || '' }] };
  }
  const wc = (it.workshop_comment || '').trim();
  return { ...base, repairs: [wc ? { type: 'أخرى', detail: wc } : newRepair()] };
}

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
          <Button size="sm" onClick={() => navigate('/')}>
            العودة للطلبات
          </Button>
          <Button variant="primary" size="sm" icon={<Icons.Plus size={12} />} onClick={onNewOrder}>
            صيانة جديدة
          </Button>
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
          <Button
            as="a"
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            icon={<Icons.Phone size={13} />}
            className="w-full justify-center no-underline"
            style={{ height: 38 }}
            testId="new-order__success__whatsapp"
          >
            إرسال إيصال الاستلام (WhatsApp) ↗
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button className="flex-1 justify-center" onClick={() => navigate('/')}>
              العودة للطلبات
            </Button>
            <Button variant="primary" icon={<Icons.Plus size={12} />} className="flex-1 justify-center" onClick={onNewOrder}>
              صيانة جديدة
            </Button>
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
    if (!draft) return { customerName: '', phoneDigits: '', urgency: 'normal', items: [newItem()] };
    return {
      customerName: draft.customerName || '',
      phoneDigits:  draft.phoneDigits  || '',
      urgency:      draft.urgency === 'rush' ? 'rush' : 'normal',
      items:        Array.isArray(draft.items) && draft.items.length ? draft.items.map(migrateItem) : [newItem()],
    };
  });
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);
  const [repairOpts, setRepairOpts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getRepairOptions()
      .then(data => { if (!cancelled) setRepairOpts(data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function optionsForType(itemType) {
    return repairOpts.filter(o => o.item_type === itemType && o.active);
  }

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

  function updateRepair(i, j, field, value) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, idx) => idx !== i ? it : {
        ...it,
        repairs: it.repairs.map((r, ri) => ri !== j ? r : { ...r, [field]: value }),
      }),
    }));
    setErrors(prev => { const n = { ...prev }; delete n[`item_${i}_repair_${j}`]; return n; });
  }

  function addRepair(i) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, idx) => idx !== i ? it : { ...it, repairs: [...it.repairs, newRepair()] }),
    }));
  }

  function removeRepair(i, j) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, idx) => {
        if (idx !== i) return it;
        const next = it.repairs.filter((_, ri) => ri !== j);
        return { ...it, repairs: next.length ? next : [newRepair()] };
      }),
    }));
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
      const opts = optionsForType(it.item_type);
      if (!it.repairs.length || it.repairs.every(r => !r.type)) {
        errs[`item_${i}_repair_0`] = 'اختر نوع الإصلاح';
        return;
      }
      it.repairs.forEach((r, j) => {
        if (!r.type) { errs[`item_${i}_repair_${j}`] = 'اختر نوع الإصلاح'; return; }
        const meta = opts.find(t => t.value === r.type);
        if (meta?.needs && !r.detail.trim()) {
          errs[`item_${i}_repair_${j}`] = 'أدخل تفاصيل الإصلاح';
        }
      });
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
        urgency:       form.urgency === 'rush' ? 'rush' : 'normal',
        items:         form.items.map(r => ({
          item_name:        r.item_type,
          quantity:         Number(r.quantity) || 1,
          notes:            r.notes.trim(),
          workshop_comment: r.repairs
            .filter(x => x.type)
            .map(x => x.detail.trim() ? `${x.type} — ${x.detail.trim()}` : x.type)
            .join('، '),
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
          setForm({ customerName: '', phoneDigits: '', urgency: 'normal', items: [newItem()] });
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
          <Button size="sm" onClick={() => navigate('/')}>
            إلغاء <span className="kbd">esc</span>
          </Button>
          <Button variant="primary" size="sm" loading={loading} icon={!loading ? <Icons.Check size={12} /> : null} onClick={handleSubmit} testId="new-order__submit">
            {loading ? 'جاري الحفظ...' : 'حفظ الطلب'}
            <span className="kbd" style={{ opacity: 0.7 }}>⌘S</span>
          </Button>
        </div>
      </div>

      <div className="form-wrap">
        <div className="form-card">
          {/* Customer info */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div>
              <label className="field-label">اسم العميل</label>
              <Input
                placeholder="محمد"
                value={form.customerName}
                onChange={e => updateForm('customerName', e.target.value)}
                invalid={!!errors.customerName}
                autoFocus
                testId="new-order__customer-name-input"
              />
              {errors.customerName && (
                <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4 }}>{errors.customerName}</div>
              )}
            </div>
            <div>
              <label className="field-label">رقم الجوال</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="font-mono" style={{
                  width: 66, height: 30, display: 'grid', placeItems: 'center',
                  background: 'var(--bg-soft)', color: 'var(--text-muted)', flexShrink: 0,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                }}>+966</span>
                <Input
                  mono
                  placeholder="5XXXXXXXX"
                  inputMode="numeric"
                  value={form.phoneDigits}
                  onChange={e => updateForm('phoneDigits', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  invalid={!!errors.phone}
                  testId="new-order__phone-input"
                />
              </div>
              {errors.phone && (
                <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4 }}>{errors.phone}</div>
              )}
            </div>
          </div>

          {/* Urgency */}
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">الأولوية</label>
            <SegmentedGroup
              value={form.urgency}
              onChange={(v) => updateForm('urgency', v)}
              options={[
                { value: 'normal', label: 'عادي' },
                { value: 'rush',   label: 'مستعجل', icon: Icons.Bell },
              ]}
              testIdPrefix="new-order__urgency"
              ariaLabel="الأولوية"
            />
          </div>

          {/* Items table */}
          <label className="field-label">الأصناف</label>
          <div className="items-table">
            <div className="items-thead">
              <span>النوع</span>
              <span style={{ textAlign: 'center' }}>عدد</span>
              <span>الإصلاح المطلوب <span style={{ color: 'var(--danger)' }}>*</span></span>
              <span>ملاحظات الاستلام</span>
              <span />
            </div>
            {form.items.map((row, i) => (
              <div key={i} className="items-row">
                <Select
                  aria-label="نوع الصنف"
                  value={row.item_type}
                  onChange={e => {
                    setForm(prev => ({
                      ...prev,
                      items: prev.items.map((it, idx) => idx !== i ? it : {
                        ...it, item_type: e.target.value, repairs: [newRepair()],
                      }),
                    }));
                  }}
                  options={ITEM_TYPES.map(t => ({ value: t, label: t }))}
                  testId={`new-order__item__${i}__type-select`}
                />
                <Input
                  mono
                  aria-label="الكمية"
                  className="!text-center"
                  type="number" min="1" max="99"
                  value={row.quantity}
                  onChange={e => updateItem(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                  testId={`new-order__item__${i}__count-input`}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {row.repairs.map((rep, j) => {
                    const opts = optionsForType(row.item_type);
                    const meta = opts.find(t => t.value === rep.type);
                    const errKey = `item_${i}_repair_${j}`;
                    const canRemove = row.repairs.length > 1;
                    return (
                      <div key={j} style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: row.repairs.length > 1 ? '6px 8px' : 0,
                        background: row.repairs.length > 1 ? 'var(--bg-soft)' : 'transparent',
                        border: row.repairs.length > 1 ? '1px solid var(--border-faint)' : 'none',
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Select
                            aria-label="نوع الإصلاح"
                            value={rep.type}
                            onChange={e => {
                              updateRepair(i, j, 'type', e.target.value);
                              updateRepair(i, j, 'detail', '');
                            }}
                            invalid={!!errors[errKey]}
                            placeholder={opts.length === 0 ? 'لا توجد خيارات — اضبطها من "خيارات الإصلاح"' : 'اختر نوع الإصلاح…'}
                            options={opts.map(t => ({ value: t.value, label: t.value }))}
                            style={{ flex: 1 }}
                            testId={`new-order__item__${i}__repair__${j}__type-select`}
                          />
                          {canRemove && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={<Icons.X size={11} />}
                              onClick={() => removeRepair(i, j)}
                              title="إزالة"
                              style={{ height: 30, width: 28, flexShrink: 0, padding: 0 }}
                              testId={`new-order__item__${i}__repair__${j}__remove`}
                            />
                          )}
                        </div>
                        {meta?.needs === 'size' && (
                          <Input mono size="sm"
                            placeholder="المقاس الجديد" inputMode="decimal"
                            value={rep.detail}
                            onChange={e => updateRepair(i, j, 'detail', e.target.value)}
                            testId={`new-order__item__${i}__repair__${j}__need__size`} />
                        )}
                        {meta?.needs === 'stone' && (
                          <Input size="sm"
                            placeholder="نوع الحجر / الموضع"
                            value={rep.detail}
                            onChange={e => updateRepair(i, j, 'detail', e.target.value)}
                            testId={`new-order__item__${i}__repair__${j}__need__stone`} />
                        )}
                        {meta?.needs === 'color' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {COLOR_OPTIONS.map(c => (
                              <Chip
                                key={c}
                                active={rep.detail === c}
                                onClick={() => updateRepair(i, j, 'detail', c)}
                                className="!flex-1 !justify-center"
                                testId={`new-order__item__${i}__repair__${j}__need__color__${c}`}
                              >
                                {c}
                              </Chip>
                            ))}
                          </div>
                        )}
                        {meta?.needs === 'text' && (
                          <Input size="sm"
                            placeholder="اكتب التفاصيل"
                            value={rep.detail}
                            onChange={e => updateRepair(i, j, 'detail', e.target.value)}
                            testId={`new-order__item__${i}__repair__${j}__need__text`} />
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addRepair(i)}
                    style={{
                      alignSelf: 'flex-start', padding: '4px 8px',
                      border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'transparent', color: 'var(--primary)',
                      fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                    data-testid={`new-order__item__${i}__add-repair`}
                  >
                    <Icons.Plus size={10} /> إضافة إصلاح
                  </button>
                </div>
                <Input
                  placeholder="خدش طفيف، سلسلة تالفة…"
                  value={row.notes}
                  onChange={e => updateItem(i, 'notes', e.target.value)}
                  testId={`new-order__item__${i}__notes-input`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icons.X size={13} />}
                  onClick={() => removeItem(i)}
                  disabled={form.items.length === 1}
                  style={{ opacity: form.items.length === 1 ? 0.3 : 1, padding: 0, width: 28 }}
                  testId={`new-order__item__${i}__remove`}
                />
              </div>
            ))}
            <button className="items-add" onClick={addItem} data-testid="new-order__add-item">
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
            <div style={{ marginTop: 14 }}>
              <Alert variant="danger">{submitError}</Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
