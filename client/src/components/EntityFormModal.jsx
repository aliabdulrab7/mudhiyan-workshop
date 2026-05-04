import { useEffect, useRef, useState } from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import FormField from './ui/FormField';
import Input from './ui/Input';
import Select from './ui/Select';
import Alert from './ui/Alert';

// Schema-driven create/edit modal.
//
// fields: [{ key, label, type='text'|'select', required, placeholder, dir, options: [{ value, label }], hint }]
// initialValues: { [key]: value } — empty {} for create, populated row for edit.
// onSubmit(values) → Promise — caller handles API call + refetch + onClose.
export default function EntityFormModal({
  open,
  onClose,
  onSubmit,
  title,
  fields = [],
  initialValues = {},
  submitLabel = 'حفظ',
  error = '',
  loading = false,
}) {
  const [values, setValues] = useState({});
  const firstRef = useRef(null);

  // Reset form whenever the modal opens (or initialValues change).
  useEffect(() => {
    if (!open) return;
    const init = {};
    for (const f of fields) {
      init[f.key] = initialValues[f.key] ?? '';
    }
    setValues(init);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, val) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} title={title} size="sm">
      <form onSubmit={handleSubmit}>
        <Dialog.Body>
          {error && (
            <div style={{ marginBottom: 14 }}>
              <Alert variant="danger">{error}</Alert>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fields.map((f, i) => (
              <FormField key={f.key} label={f.label} required={f.required} hint={f.hint}>
                {f.type === 'select' ? (
                  <Select
                    value={values[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  >
                    {!f.required && <option value="">— اختر —</option>}
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    ref={i === 0 ? firstRef : undefined}
                    value={values[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    dir={f.dir ?? 'auto'}
                    disabled={f.disabled}
                  />
                )}
              </FormField>
            ))}
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  );
}
