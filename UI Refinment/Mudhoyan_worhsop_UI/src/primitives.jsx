// Shared primitives: StatusPill, Checkbox, Avatar, Kbd, PriorityDot

function StatusPill({ status, dir = 'ltr', size = 'md' }) {
  const meta = STATUS_META[status] || STATUS_META.received;
  const label = I18N[dir === 'rtl' ? 'ar' : 'en'].status[status] || status;
  return (
    <span className="pill" style={{ color: meta.color, borderColor: `color-mix(in oklch, ${meta.color} 30%, var(--border))`, background: `color-mix(in oklch, ${meta.color} 9%, var(--bg-raised))` }}>
      <span className="dot" style={{ background: meta.color }} />
      {label}
    </span>
  );
}

function Checkbox({ checked, indeterminate, onChange, onClick }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      className={`cb ${checked ? 'checked' : ''} ${indeterminate ? 'indeterminate' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!checked); onClick && onClick(e); }}
    >
      {checked && !indeterminate && (
        <svg viewBox="0 0 12 12"><polyline points="2.5,6.5 5,9 9.5,3.5"/></svg>
      )}
      {indeterminate && (
        <svg viewBox="0 0 12 12"><line x1="3" y1="6" x2="9" y2="6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
      )}
    </span>
  );
}

function Avatar({ name, size = 20, color }) {
  const initials = name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      display: 'inline-grid', placeItems: 'center',
      background: color || `oklch(0.92 0.04 ${hue})`,
      color: color ? '#fff' : `oklch(0.35 0.1 ${hue})`,
      fontSize: size * 0.42, fontWeight: 600,
      fontFamily: 'var(--font-ui)',
      flexShrink: 0,
    }}>{initials || '?'}</span>
  );
}

function Kbd({ children }) { return <span className="kbd">{children}</span>; }

function PriorityDot({ priority }) {
  if (priority === 'rush') return <span style={{ color: 'var(--danger)', fontSize: 10 }}>●</span>;
  if (priority === 'low')  return <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>○</span>;
  return <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>·</span>;
}

function Sparkline({ data, color = 'var(--primary)', height = 28 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      <polyline points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity="0.08"/>
    </svg>
  );
}

Object.assign(window, { StatusPill, Checkbox, Avatar, Kbd, PriorityDot, Sparkline });
