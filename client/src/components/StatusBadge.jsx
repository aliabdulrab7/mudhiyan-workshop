const STATUS = {
  received:         { label: 'مستلمة',          bg: 'rgba(41, 128, 185, 0.10)',  fg: '#2980B9'  },
  pending_approval: { label: 'بانتظار الموافقة', bg: 'rgba(217, 119, 6, 0.10)',  fg: '#D97706'  },
  in_progress:      { label: 'قيد العمل',        bg: 'rgba(26, 110, 160, 0.10)',  fg: '#1A6EA0'  },
  ready:            { label: 'جاهزة',            bg: 'rgba(22, 163, 74, 0.10)',   fg: '#16A34A'  },
  delivered:        { label: 'تم التسليم',       bg: 'rgba(124, 58, 237, 0.10)', fg: '#7C3AED'  },
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
      border: `1px solid ${s.fg}22`,
      letterSpacing: '0.01em',
    }}>
      {s.label}
    </span>
  );
}

export { STATUS };
