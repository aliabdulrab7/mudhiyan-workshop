import { useState, useEffect } from 'react';
import { getRepairOptions, createRepairOption, updateRepairOption, deleteRepairOption } from '../api/repair-options';
import { Icons } from '../components/icons';

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
              <input
                className="input"
                placeholder="مثال: تغيير مقاس"
                value={newForm.value}
                onChange={e => setNewForm(f => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="field-label">نوع التفاصيل</label>
              <select
                className="select"
                aria-label="نوع التفاصيل"
                value={newForm.needs}
                onChange={e => setNewForm(f => ({ ...f, needs: e.target.value }))}
              >
                {NEEDS_OPTIONS.map(o => <option key={o.value || 'none'} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" style={{ height: 32 }}>
              <Icons.Plus size={12} /> إضافة
            </button>
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
                    <input
                      className="input"
                      style={{ height: 28 }}
                      value={editForm.value}
                      onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                      autoFocus
                    />
                    <select
                      className="select"
                      style={{ height: 28 }}
                      value={editForm.needs}
                      onChange={e => setEditForm(f => ({ ...f, needs: e.target.value }))}
                    >
                      {NEEDS_OPTIONS.map(o => <option key={o.value || 'none'} value={o.value}>{o.label}</option>)}
                    </select>
                    <span />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-primary" onClick={e => saveEdit(e, row.id)}>
                        <Icons.Check size={11} /> حفظ
                      </button>
                      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditingId(null)}>
                        إلغاء
                      </button>
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
                      >
                        <span style={{
                          position: 'absolute', top: 1, insetInlineStart: row.active ? 13 : 1,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#fff', transition: 'inset-inline-start 120ms',
                        }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-ghost" type="button" onClick={() => startEdit(row)}>
                        تعديل
                      </button>
                      <button
                        className="btn btn-sm btn-ghost btn-icon"
                        type="button"
                        onClick={() => remove(row)}
                        title="حذف"
                      >
                        <Icons.X size={12} />
                      </button>
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
