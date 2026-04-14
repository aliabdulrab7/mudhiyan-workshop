const STATUS = {
  received:         { label: 'مستلمة',          bg: 'rgba(99,102,241,0.12)',  fg: '#818CF8'  },
  pending_approval: { label: 'بانتظار الموافقة', bg: 'rgba(245,158,11,0.12)', fg: '#FBBF24'  },
  in_progress:      { label: 'قيد العمل',        bg: 'rgba(59,130,246,0.12)', fg: '#60A5FA'  },
  ready:            { label: 'جاهزة',            bg: 'rgba(52,211,153,0.12)', fg: '#34D399'  },
  delivered:        { label: 'تم التسليم',       bg: 'rgba(167,139,250,0.12)', fg: '#A78BFA' },
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
