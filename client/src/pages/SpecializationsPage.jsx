import { useEffect, useState } from 'react';
import { getSpecializations, createSpecialization, updateSpecialization, deleteSpecialization } from '../api/specializations';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Dialog from '../components/ui/Dialog';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function SpecializationsPage() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newForm, setNewForm]     = useState({ value: '', display_label_ar: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState({ display_label_ar: '' });
  const [error, setError]         = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting, setDeleting]   = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await getSpecializations()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!newForm.value.trim() || !newForm.display_label_ar.trim()) {
      setError('القيمة والاسم العربي مطلوبان');
      return;
    }
    try {
      await createSpecialization({
        value:            newForm.value.trim(),
        display_label_ar: newForm.display_label_ar.trim(),
      });
      setNewForm({ value: '', display_label_ar: '' });
      await load();
    } catch (e) { setError(e.message); }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditForm({ display_label_ar: row.display_label_ar || '' });
    setError('');
  }

  async function saveEdit(e, id) {
    e.preventDefault();
    setError('');
    try {
      await updateSpecialization(id, { display_label_ar: editForm.display_label_ar.trim() });
      setEditingId(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function toggleActive(row) {
    setError('');
    try {
      await updateSpecialization(row.id, { active: row.active ? 0 : 1 });
      await load();
    } catch (e) { setError(e.message); }
  }

  async function confirmDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    setError('');
    try {
      await deleteSpecialization(confirmDel.id);
      setConfirmDel(null);
      await load();
    } catch (e) { setError(e.message); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">التخصصات</h1>
          <div className="page-sub">إدارة قائمة تخصصات الفنيين — تُستخدم في تعيين القطع تلقائياً للفني المناسب</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {error && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {/* Add form */}
        <Card style={{ padding: '14px 18px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--text-muted)' }}>
            إضافة تخصص جديد
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="القيمة (إنجليزي)" className="!flex-1 !basis-[180px]">
              <Input
                placeholder="e.g. stone_setting"
                value={newForm.value}
                onChange={(e) => setNewForm((f) => ({ ...f, value: e.target.value }))}
                dir="ltr"
                testId="specializations__form__value-input"
              />
            </FormField>
            <FormField label="الاسم العربي" className="!flex-1 !basis-[200px]">
              <Input
                placeholder="مثال: تركيب أحجار"
                value={newForm.display_label_ar}
                onChange={(e) => setNewForm((f) => ({ ...f, display_label_ar: e.target.value }))}
                testId="specializations__form__label-input"
              />
            </FormField>
            <Button variant="primary" type="submit" icon={<Icons.Plus size={12} />} style={{ height: 32 }} testId="specializations__form__submit">
              إضافة
            </Button>
          </form>
        </Card>

        {/* List */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <Card style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد تخصصات — أضف الأول أعلاه
          </Card>
        ) : (
          <div className="items-table">
            <div className="items-thead" style={{ gridTemplateColumns: '1fr 1.5fr 80px 120px' }}>
              <span>القيمة</span>
              <span>الاسم العربي</span>
              <span style={{ textAlign: 'center' }}>نشط</span>
              <span />
            </div>
            {rows.map((row) => (
              <div key={row.id} className="items-row" style={{ gridTemplateColumns: '1fr 1.5fr 80px 120px', alignItems: 'center' }}>
                {editingId === row.id ? (
                  <>
                    <span className="font-mono text-[12px] text-text-faint" dir="ltr">{row.value}</span>
                    <Input
                      size="sm"
                      value={editForm.display_label_ar}
                      onChange={(e) => setEditForm((f) => ({ ...f, display_label_ar: e.target.value }))}
                      autoFocus
                    />
                    <span />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" icon={<Icons.Check size={11} />} onClick={(e) => saveEdit(e, row.id)} testId={`specializations__row__${row.id}__save`}>
                        حفظ
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => setEditingId(null)} testId={`specializations__row__${row.id}__cancel`}>
                        إلغاء
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[12px]" dir="ltr" style={{ color: row.active ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                      {row.value}
                    </span>
                    <span style={{ fontSize: 13, color: row.active ? 'var(--text)' : 'var(--text-faint)' }}>
                      {row.display_label_ar || '—'}
                    </span>
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
                        data-testid={`specializations__row__${row.id}__toggle-active`}
                      >
                        <span style={{
                          position: 'absolute', top: 1, insetInlineStart: row.active ? 13 : 1,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#fff', transition: 'inset-inline-start 120ms',
                        }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" type="button" onClick={() => startEdit(row)} testId={`specializations__row__${row.id}__edit`}>
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        icon={<Icons.X size={12} />}
                        onClick={() => setConfirmDel(row)}
                        title="حذف"
                        testId={`specializations__row__${row.id}__delete`}
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

      <Dialog
        open={!!confirmDel}
        onClose={() => !deleting && setConfirmDel(null)}
        title="حذف تخصص"
        size="sm"
        testId="specializations__delete-dialog"
      >
        <Dialog.Body>
          <div className="text-sm text-text">
            هل أنت متأكد من حذف التخصص <strong>"{confirmDel?.display_label_ar || confirmDel?.value}"</strong>؟
          </div>
          <div className="text-xs text-text-faint mt-2">
            سيتم إزالة هذا التخصص من جميع الفنيين الذين تم تعيينه لهم.
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => setConfirmDel(null)} disabled={deleting} testId="specializations__delete-dialog__cancel">
            إلغاء
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting} testId="specializations__delete-dialog__confirm">
            حذف
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
