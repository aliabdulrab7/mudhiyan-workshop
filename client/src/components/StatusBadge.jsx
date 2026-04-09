const STATUS = {
  received:    { label: 'مستلمة',     bg: 'var(--status-received-bg)',  fg: 'var(--status-received-fg)'  },
  in_progress: { label: 'قيد العمل',  bg: 'var(--status-progress-bg)',  fg: 'var(--status-progress-fg)'  },
  ready:       { label: 'جاهزة',      bg: 'var(--status-ready-bg)',     fg: 'var(--status-ready-fg)'      },
  delivered:   { label: 'تم التسليم', bg: 'var(--status-delivered-bg)', fg: 'var(--status-delivered-fg)' },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.received;
  return (
    <span style={{
      background: s.bg,
      color: s.fg,
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '0.78rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export { STATUS };
