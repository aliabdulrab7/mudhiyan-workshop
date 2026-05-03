import { useEffect, useState } from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import Textarea from './ui/Textarea';
import StatusIndicator from './ui/StatusIndicator';

const STATUS_OPTIONS = [
  { value: 'available', label: 'متاح' },
  { value: 'busy',      label: 'مشغول' },
  { value: 'off_shift', label: 'خارج الدوام' },
  { value: 'on_leave',  label: 'في إجازة' },
];

// StatusChangeMenu — Dialog for changing a technician's status with optional reason.
// Props:
//   technician  { id, name, status }   The technician being edited
//   onChange    fn(newStatus, reason)   Called on confirm; reason is '' if blank
//   open        boolean
//   onClose     fn()
export default function StatusChangeMenu({ technician, onChange, open, onClose }) {
  const [selected, setSelected] = useState(technician?.status ?? 'available');
  const [reason, setReason] = useState('');

  // Reset to current tech status each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(technician?.status ?? 'available');
      setReason('');
    }
  }, [open, technician?.status]);

  function handleSubmit() {
    onChange?.(selected, reason.trim());
    onClose?.();
  }

  const unchanged = selected === technician?.status;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`تغيير حالة: ${technician?.name ?? '—'}`}
      size="sm"
      testId={`status-change-menu--${technician?.id}`}
    >
      <Dialog.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Status buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STATUS_OPTIONS.map(opt => {
              const active = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelected(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                    background: active ? 'var(--primary-soft)' : 'var(--bg-soft)',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    color: active ? 'var(--primary)' : 'var(--text)',
                    textAlign: 'start',
                  }}
                  aria-pressed={active}
                >
                  <StatusIndicator status={opt.value} />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Reason */}
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="السبب (اختياري)"
            rows={3}
            size="sm"
            dir="rtl"
            testId={`status-change-menu--${technician?.id}__reason`}
          />
        </div>
      </Dialog.Body>

      <Dialog.Footer>
        <Button size="sm" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={unchanged}
          onClick={handleSubmit}
          testId={`status-change-menu--${technician?.id}__submit`}
        >
          حفظ الحالة
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
