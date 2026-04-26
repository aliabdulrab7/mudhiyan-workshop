import { useState, useEffect } from 'react';
import { getRepairOptions, createRepairOption, updateRepairOption, deleteRepairOption } from '../api/repair-options';
import { Icons } from '../components/icons';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const ITEM_TYPES = ['خاتم', 'حلق', 'سوار', 'عقد', 'دبلة', 'ساعة', 'أخرى'];

const NEEDS_OPTIONS = [
  { value: '',      label: 'بدون تفاصيل' },
  { value: 'size',  label: 'مقاس (رقم)' },
  { value: 'stone', label: 'تفاصيل الحجر (نص)' },
  { value: 'color', label: 'لون (أصفر/روز/أبيض)' },
  { value: 'text',  label: 'نص حر' },
];

function needsLabel(needs) {
  return NEEDS_OPTIONS.find(o => (o.value || null) === (needs || null))?.label ?? '—';
}

export default function RepairOptionsPage() {
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeType, setActiveType] = useState(ITEM_TYPES[0]);
  const [newForm, setNewForm]       = useState({ value: '', needs: '' });
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({ value: '', needs: '' });
  const [error, setError]           = useState('');

  async function load() {
    setLoading(true);
    try { setRows(await getRepairOptions()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const visible = rows.filter(r => r.item_type === activeType);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!newForm.value.trim()) { setError('اسم الإصلاح مطلوب'); return; }
    try {
      await createRepairOption({
        item_type: activeType,
        value:     newForm.value.trim(),
        needs:     newForm.needs || null,
      });
      setNewForm({ value: '', needs: '' });
      await load();
    } catch (e) { setError(e.message); }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditForm({ value: row.value, needs: row.needs || '' });
    setError('');
  }

  async function saveEdit(e, id) {
    e.preventDefault();
    setError('');
    try {
      await updateRepairOption(id, {
        value: editForm.value.trim(),
        needs: editForm.needs || null,
      });
      setEditingId(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function toggleActive(row) {
    setError('');
    try {
      await updateRepairOption(row.id, { active: row.active ? 0 : 1 });
      await load();
    } catch (e) { setError(e.message); }
  }

  async function remove(row) {
    if (!window.confirm(`حذف "${row.value}" من قائمة ${row.item_type}؟`)) return;
    setError('');
    try { await deleteRepairOption(row.id); await load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">خيارات الإصلاح</h1>
          <div className="page-sub">إدارة قوائم الإصلاح لكل نوع قطعة — تُستخدم في نموذج الصيانة الجديدة</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Item-type tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
          {ITEM_TYPES.map(t => (
            <button
              key={t}
              type="button"
              className={'chip' + (t === activeType ? ' active' : '')}
              onClick={() => { setActiveType(t); setEditingId(null); setNewForm({ value: '', needs: '' }); setError(''); }}
              data-testid={`repair-options__tab__${t}`}
            >
              {t}
              <span style={{ marginInlineStart: 6, opacity: 0.6, fontSize: 10 }}>
                {rows.filter(r => r.item_type === t).length}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            color: 'var(--danger)', fontSize: 12.5, padding: '10px 14px',
            background: 'oklch(0.58 0.21 25 / 0.06)',
            border: '1px solid oklch(0.58 0.21 25 / 0.2)',
            borderRadius: 'var(--radius-sm)', marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Add form */}
        <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--text-muted)' }}>
            إضافة خيار إلى قائمة <span style={{ color: 'var(--text)' }}>{activeType}</span>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="field-label">اسم الإصلاح</label>
              <Input
                placeholder="مثال: تغيير مقاس"
                value={newForm.value}
                onChange={e => setNewForm(f => ({ ...f, value: e.target.value }))}
                testId="repair-options__form__name-input"
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="field-label">نوع التفاصيل</label>
              <Select
                aria-label="نوع التفاصيل"
                value={newForm.needs}
                onChange={e => setNewForm(f => ({ ...f, needs: e.target.value }))}
                options={NEEDS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                testId="repair-options__form__needs-select"
              />
            </div>
            <Button variant="primary" type="submit" icon={<Icons.Plus size={12} />} style={{ height: 32 }} testId="repair-options__form__submit">
              إضافة
            </Button>
          </form>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد خيارات لهذا النوع — أضف الأول أعلاه
          </div>
        ) : (
          <div className="items-table">
            <div className="items-thead" style={{ gridTemplateColumns: '1.5fr 1.2fr 80px 120px' }}>
              <span>الإصلاح</span>
              <span>نوع التفاصيل</span>
              <span style={{ textAlign: 'center' }}>نشط</span>
              <span />
            </div>
            {visible.map(row => (
              <div key={row.id} className="items-row" style={{ gridTemplateColumns: '1.5fr 1.2fr 80px 120px', alignItems: 'center' }}>
                {editingId === row.id ? (
                  <>
                    <Input
                      size="sm"
                      value={editForm.value}
                      onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                      autoFocus
                    />
                    <Select
                      size="sm"
                      value={editForm.needs}
                      onChange={e => setEditForm(f => ({ ...f, needs: e.target.value }))}
                      options={NEEDS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    />
                    <span />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" icon={<Icons.Check size={11} />} onClick={e => saveEdit(e, row.id)} testId={`repair-options__row__${row.id}__save`}>
                        حفظ
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => setEditingId(null)} testId={`repair-options__row__${row.id}__cancel`}>
                        إلغاء
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: row.active ? 'var(--text)' : 'var(--text-faint)' }}>
                      {row.value}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{needsLabel(row.needs)}</span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        title={row.active ? 'إيقاف' : 'تفعيل'}
                        style={{
                          width: 28, height: 16, borderRadius: 8, position: 'relative',
                          border: '1px solid var(--border)',
                          background: row.active ? 'var(--primary)' : 'var(--bg-soft)',
                          cursor: 'pointer',
                        }}
                        data-testid={`repair-options__row__${row.id}__toggle-active`}
                      >
                        <span style={{
                          position: 'absolute', top: 1, insetInlineStart: row.active ? 13 : 1,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#fff', transition: 'inset-inline-start 120ms',
                        }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" type="button" onClick={() => startEdit(row)} testId={`repair-options__row__${row.id}__edit`}>
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        icon={<Icons.X size={12} />}
                        onClick={() => remove(row)}
                        title="حذف"
                        testId={`repair-options__row__${row.id}__delete`}
                        className="!px-1.5"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
