const STATUS_META = {
  available: { color: 'var(--success)',    label: 'متاح' },
  busy:      { color: 'var(--warning)',    label: 'مشغول' },
  off_shift: { color: 'var(--text-faint)', label: 'خارج الدوام' },
  on_leave:  { color: 'var(--danger)',     label: 'في إجازة' },
};

// StatusIndicator — colored dot with optional Arabic label for technician status.
export default function StatusIndicator({ status, label = false, testId }) {
  const meta = STATUS_META[status] ?? { color: 'var(--text-faint)', label: status ?? '—' };
  return (
    <span
      data-testid={testId ?? `status-indicator--${status}`}
      className="inline-flex items-center gap-1"
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: meta.color,
          flexShrink: 0,
        }}
      />
      {label && (
        <span style={{ fontSize: 11.5, color: meta.color, fontWeight: 600, lineHeight: 1 }}>
          {meta.label}
        </span>
      )}
    </span>
  );
}
