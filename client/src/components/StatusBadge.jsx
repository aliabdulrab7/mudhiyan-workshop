const STATUS = {
  received:         { label: 'مستلمة',          bg: 'rgba(56, 139, 253, 0.10)',  fg: '#58a6ff'  },
  pending_approval: { label: 'بانتظار الموافقة', bg: 'rgba(187, 128, 9, 0.12)',  fg: '#d29922'  },
  in_progress:      { label: 'قيد العمل',        bg: 'rgba(31, 111, 235, 0.10)',  fg: '#388bfd'  },
  ready:            { label: 'جاهزة',            bg: 'rgba(46, 160, 67, 0.12)',   fg: '#3fb950'  },
  delivered:        { label: 'تم التسليم',       bg: 'rgba(163, 113, 247, 0.12)', fg: '#a371f7'  },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.received;
  return (
    <span style={{
      background: s.bg,
      color: s.fg,
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      border: `1px solid ${s.fg}18`,
      letterSpacing: '0.01em',
    }}>
      {s.label}
    </span>
  );
}

export { STATUS };
