import { useEffect, useState } from 'react';
import {
  createTechnician,
  getTechnician,
  updateTechnician,
  addTechnicianSpecialization,
  removeTechnicianSpecialization,
  getStatusHistory,
} from '../api/technicians';
import StatusIndicator from './ui/StatusIndicator';
import { getRoles } from '../api/roles';
import { getSpecializations } from '../api/specializations';
import Alert from './ui/Alert';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import Chip from './ui/Chip';
import Dialog from './ui/Dialog';
import FormField from './ui/FormField';
import Input from './ui/Input';
import Select from './ui/Select';
import Textarea from './ui/Textarea';
import { STATUS_META } from './StatusPill';

const STATUS_OPTIONS = [
  { value: 'available', label: 'متاح' },
  { value: 'busy',      label: 'مشغول' },
  { value: 'off_shift', label: 'خارج الدوام' },
  { value: 'on_leave',  label: 'في إجازة' },
];
const TECH_STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

function emptyForm() {
  return { name: '', role_id: '', phone: '', notes: '', status: 'available', active: 1 };
}

// Fields the edit-mode optimistic helper applies locally before PATCH.
const PATCHABLE_FIELDS = ['name', 'role_id', 'phone', 'notes', 'status', 'active'];

export default function TechnicianDetailModal({
  open,
  mode, // 'create' | 'edit'
  techId,
  onClose,
  onSaved, // called with the saved tech after create or edit
}) {
  const isEdit = mode === 'edit';

  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [tech, setTech]           = useState(null); // server-truth full record
  const [form, setForm]           = useState(emptyForm());
  const [roles, setRoles]         = useState([]);
  const [allSpecs, setAllSpecs]   = useState([]);
  const [techSpecIds, setTechSpecIds] = useState(new Set());
  const [statusHistory, setStatusHistory] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setLoading(true);

    async function load() {
      try {
        const [rolesData, specsData] = await Promise.all([
          getRoles().catch(() => []),
          getSpecializations().catch(() => []),
        ]);
        if (cancelled) return;
        setRoles(Array.isArray(rolesData) ? rolesData.filter((r) => r.active !== 0) : []);
        setAllSpecs(Array.isArray(specsData) ? specsData.filter((s) => s.active !== 0) : []);

        if (isEdit && techId) {
          const [t, histData] = await Promise.all([
            getTechnician(techId),
            getStatusHistory(techId, { limit: 10 }).catch(() => ({ history: [] })),
          ]);
          if (cancelled) return;
          setTech(t);
          setStatusHistory(histData.history ?? []);
          setForm({
            name:    t.name ?? '',
            role_id: t.role_id == null ? '' : String(t.role_id),
            phone:   t.phone ?? '',
            notes:   t.notes ?? '',
            status:  t.status ?? 'available',
            active:  t.active == null ? 1 : t.active,
          });
          setTechSpecIds(new Set((t.specializations ?? []).map((s) => s.id)));
        } else {
          setTech(null);
          setForm(emptyForm());
          setTechSpecIds(new Set());
          setStatusHistory([]);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'فشل تحميل بيانات الفني');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, isEdit, techId]);

  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  // Edit-mode: optimistic per-field PATCH. Mirrors SettingsContext.updateSetting.
  async function patchField(name, value) {
    if (!isEdit || !tech) return;
    if (!PATCHABLE_FIELDS.includes(name)) return;
    const prev = form[name];
    if (prev === value) return;
    field(name, value);
    setError('');
    try {
      const body = { [name]: name === 'role_id' ? (value === '' ? null : Number(value)) : value };
      const updated = await updateTechnician(tech.id, body);
      setTech((t) => ({ ...(t || {}), ...updated }));
    } catch (e) {
      field(name, prev);
      setError(e.message || 'فشل حفظ التعديل');
    }
  }

  async function toggleSpec(specId) {
    if (!isEdit || !tech) return;
    const has = techSpecIds.has(specId);
    const next = new Set(techSpecIds);
    if (has) next.delete(specId); else next.add(specId);
    setTechSpecIds(next);
    setError('');
    try {
      if (has) await removeTechnicianSpecialization(tech.id, specId);
      else     await addTechnicianSpecialization(tech.id, specId);
    } catch (e) {
      // Revert
      const revert = new Set(next);
      if (has) revert.add(specId); else revert.delete(specId);
      setTechSpecIds(revert);
      setError(e.message || 'فشل تحديث التخصصات');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('الاسم مطلوب'); return; }
    setSaving(true);
    setError('');
    try {
      // Server-accepted POST fields: name, role_id, phone, notes, specialization_ids.
      // status defaults to 'available' and active to 1 server-side.
      const body = {
        name:               form.name.trim(),
        role_id:            form.role_id === '' ? null : Number(form.role_id),
        phone:              form.phone || null,
        notes:              form.notes || null,
        specialization_ids: Array.from(techSpecIds),
      };
      let created = await createTechnician(body);
      // Server's POST contract only accepts the body fields above (status defaults
      // 'available', active defaults 1). Persist any user-changed values via PATCH.
      const overrides = {};
      if (form.status && form.status !== 'available') overrides.status = form.status;
      if (form.active !== 1) overrides.active = form.active ? 1 : 0;
      if (Object.keys(overrides).length > 0) {
        created = await updateTechnician(created.id, overrides);
      }
      onSaved?.(created);
      onClose?.();
    } catch (e) {
      setError(e.message || 'فشل إنشاء الفني');
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (saving) return;
    onClose?.();
  }

  const title = isEdit ? `تعديل الفني` : 'إضافة فني جديد';
  const recentAssignments = tech?.recent_assignments ?? [];
  const activeItemsCount  = tech?.active_count ?? 0;

  return (
    <Dialog open={open} onClose={close} title={title} size="lg" testId="tech-modal">
      <Dialog.Body>
        {loading ? (
          <div className="text-text-muted text-sm text-center py-8">جاري التحميل...</div>
        ) : (
          <form
            id="tech-create-form"
            onSubmit={isEdit ? (e) => e.preventDefault() : handleCreate}
            className="flex flex-col gap-4"
          >
            {error && <Alert variant="danger">{error}</Alert>}

            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="الاسم" required>
                <Input
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                  onBlur={(e) => isEdit && patchField('name', e.target.value)}
                  placeholder="اسم الفني"
                  autoFocus
                  testId="tech-modal__name-input"
                />
              </FormField>
              <FormField label="الدور">
                <Select
                  value={form.role_id}
                  onChange={(e) => {
                    field('role_id', e.target.value);
                    if (isEdit) patchField('role_id', e.target.value);
                  }}
                  options={[
                    { value: '', label: 'بدون دور' },
                    ...roles.map((r) => ({ value: String(r.id), label: r.display_label_ar || r.value })),
                  ]}
                  testId="tech-modal__role-select"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="الجوال">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => field('phone', e.target.value)}
                  onBlur={(e) => isEdit && patchField('phone', e.target.value)}
                  placeholder="9665XXXXXXXX"
                  testId="tech-modal__phone-input"
                />
              </FormField>
              <FormField label="الحالة">
                <Select
                  value={form.status}
                  onChange={(e) => {
                    field('status', e.target.value);
                    if (isEdit) patchField('status', e.target.value);
                  }}
                  options={STATUS_OPTIONS}
                  testId="tech-modal__status-select"
                />
              </FormField>
            </div>

            <FormField label="ملاحظات">
              <Textarea
                value={form.notes}
                onChange={(e) => field('notes', e.target.value)}
                onBlur={(e) => isEdit && patchField('notes', e.target.value)}
                rows={2}
                placeholder="ملاحظات اختيارية"
                testId="tech-modal__notes-textarea"
              />
            </FormField>

            <div>
              <Checkbox
                checked={Boolean(form.active)}
                aria-label="فعّال"
                label="فعّال"
                onChange={(checked) => {
                  field('active', checked ? 1 : 0);
                  if (isEdit) patchField('active', checked ? 1 : 0);
                }}
                testId="tech-modal__active-checkbox"
              />
            </div>

            {/* Specializations */}
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
                التخصصات
              </div>
              {allSpecs.length === 0 ? (
                <div className="text-xs text-text-faint">
                  لم يتم تعريف أي تخصصات بعد — أضفها من صفحة "التخصصات".
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allSpecs.map((s) => {
                    const on = techSpecIds.has(s.id);
                    return (
                      <Chip
                        key={s.id}
                        active={on}
                        onClick={() => {
                          if (isEdit) {
                            toggleSpec(s.id);
                          } else {
                            const next = new Set(techSpecIds);
                            if (on) next.delete(s.id); else next.add(s.id);
                            setTechSpecIds(next);
                          }
                        }}
                        testId={`tech-modal__spec__${s.value}`}
                      >
                        {s.display_label_ar || s.value}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Read-only: workload & recent assignments — edit mode only */}
            {isEdit && tech && (
              <div className="border-t border-border pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                    قطع نشطة معيَّنة
                  </div>
                  <div className="font-mono text-sm text-text">
                    {activeItemsCount}
                  </div>
                </div>

                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1.5">
                    آخر التعيينات
                  </div>
                  {recentAssignments.length === 0 ? (
                    <div className="text-xs text-text-faint">لا تعيينات حديثة</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {recentAssignments.slice(0, 10).map((a, idx) => (
                        <div
                          key={a.id ?? idx}
                          className="flex items-center justify-between text-xs text-text-muted py-1 border-b border-border last:border-0"
                        >
                          <span className="font-mono" dir="ltr">{a.order_number || `#${a.order_id}`}</span>
                          <span>{a.item_name || a.item_type || '—'}</span>
                          <span className="text-text-faint">
                            {STATUS_META[a.status]?.label ?? a.status ?? ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status-change history */}
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1.5">
                    آخر تغييرات الحالة
                  </div>
                  {statusHistory.length === 0 ? (
                    <div className="text-xs text-text-faint">لا تغييرات حالة مسجّلة</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {statusHistory.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-0.5 py-1.5 border-b border-border last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
                            {/* from → to */}
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <StatusIndicator status={h.from_status} label />
                              <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>←</span>
                              <StatusIndicator status={h.to_status} label />
                            </span>
                            {/* who + when */}
                            <span className="text-text-faint text-[10.5px] shrink-0">
                              {h.changed_by_username ?? 'نظام'}
                              {' · '}
                              {new Date(h.changed_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {h.reason && (
                            <div className="text-[11px] text-text-faint" style={{ paddingInlineStart: 2 }}>
                              {h.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button
          variant="ghost"
          onClick={close}
          disabled={saving}
          testId="tech-modal__cancel"
        >
          {isEdit ? 'إغلاق' : 'إلغاء'}
        </Button>
        {!isEdit && (
          <Button
            variant="primary"
            type="submit"
            form="tech-create-form"
            loading={saving}
            disabled={loading}
            testId="tech-modal__submit"
          >
            حفظ
          </Button>
        )}
      </Dialog.Footer>
    </Dialog>
  );
}
