import { useEffect, useState } from 'react';
import { getRoles, createRole, updateRole, deleteRole } from '../api/roles';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Dialog from '../components/ui/Dialog';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function RolesPage() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newForm, setNewForm]     = useState({ value: '', display_label_ar: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState({ display_label_ar: '' });
  const [error, setError]         = useState('');
  const [confirmDel, setConfirmDel] = useState(null); // row | null
  const [deleting, setDeleting]   = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await getRoles()); }
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
      await createRole({
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
      await updateRole(id, { display_label_ar: editForm.display_label_ar.trim() });
      setEditingId(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function toggleActive(row) {
    setError('');
    try {
      await updateRole(row.id, { active: row.active ? 0 : 1 });
      await load();
    } catch (e) { setError(e.message); }
  }

  async function confirmDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    setError('');
    try {
      await deleteRole(confirmDel.id);
      setConfirmDel(null);
      await load();
    } catch (e) { setError(e.message); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">الأدوار</h1>
          <div className="page-sub">إدارة قائمة أدوار الفنيين — تظهر في صفحة الفني وتُستخدم في التصفية</div>
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
            إضافة دور جديد
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="القيمة (إنجليزي)" className="!flex-1 !basis-[180px]">
              <Input
                placeholder="e.g. senior_jeweler"
                value={newForm.value}
                onChange={(e) => setNewForm((f) => ({ ...f, value: e.target.value }))}
                dir="ltr"
                testId="roles__form__value-input"
              />
            </FormField>
            <FormField label="الاسم العربي" className="!flex-1 !basis-[200px]">
              <Input
                placeholder="مثال: صائغ كبير"
                value={newForm.display_label_ar}
                onChange={(e) => setNewForm((f) => ({ ...f, display_label_ar: e.target.value }))}
                testId="roles__form__label-input"
              />
            </FormField>
            <Button variant="primary" type="submit" icon={<Icons.Plus size={12} />} style={{ height: 32 }} testId="roles__form__submit">
              إضافة
            </Button>
          </form>
        </Card>

        {/* List */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <Card style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد أدوار — أضف الأول أعلاه
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
                      <Button variant="primary" size="sm" icon={<Icons.Check size={11} />} onClick={(e) => saveEdit(e, row.id)} testId={`roles__row__${row.id}__save`}>
                        حفظ
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => setEditingId(null)} testId={`roles__row__${row.id}__cancel`}>
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
                        data-testid={`roles__row__${row.id}__toggle-active`}
                      >
                        <span style={{
                          position: 'absolute', top: 1, insetInlineStart: row.active ? 13 : 1,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#fff', transition: 'inset-inline-start 120ms',
                        }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" type="button" onClick={() => startEdit(row)} testId={`roles__row__${row.id}__edit`}>
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        icon={<Icons.X size={12} />}
                        onClick={() => setConfirmDel(row)}
                        title="حذف"
                        testId={`roles__row__${row.id}__delete`}
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
        title="حذف دور"
        size="sm"
        testId="roles__delete-dialog"
      >
        <Dialog.Body>
          <div className="text-sm text-text">
            هل أنت متأكد من حذف الدور <strong>"{confirmDel?.display_label_ar || confirmDel?.value}"</strong>؟
          </div>
          <div className="text-xs text-text-faint mt-2">
            لن يؤثر هذا على الفنيين الذين تم تعيين هذا الدور لهم سابقاً، لكن لن يكون متاحاً للاختيار بعد الحذف.
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => setConfirmDel(null)} disabled={deleting} testId="roles__delete-dialog__cancel">
            إلغاء
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting} testId="roles__delete-dialog__confirm">
            حذف
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
