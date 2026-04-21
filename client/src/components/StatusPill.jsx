// StatusPill — oklch status colors + shared primitives
// Exports: StatusPill (default), Avatar, Kbd, Sparkline, PriorityDot, STATUS_META

export const STATUS_META = {
  new:               { color: 'oklch(0.50 0.01 260)', label: 'جديد' },
  received:          { color: 'oklch(0.60 0.14 240)', label: 'مستلمة' },
  inspection:        { color: 'oklch(0.55 0.16 295)', label: 'قيد الفحص' },
  waiting_approval:  { color: 'oklch(0.68 0.15 70)',  label: 'بانتظار الموافقة' },
  approved:          { color: 'oklch(0.60 0.15 150)', label: 'تمت الموافقة' },
  rejected:          { color: 'oklch(0.58 0.21 25)',  label: 'مرفوضة' },
  in_repair:         { color: 'oklch(0.60 0.13 220)', label: 'قيد الإصلاح' },
  quality_check:     { color: 'oklch(0.55 0.08 260)', label: 'فحص الجودة' },
  ready_for_return:  { color: 'oklch(0.60 0.15 150)', label: 'جاهزة للإرجاع' },
  returned_to_shop:  { color: 'oklch(0.55 0.12 170)', label: 'وصلت للفرع' },
  delivered:         { color: 'oklch(0.55 0.12 170)', label: 'تم التسليم' },
  closed:            { color: 'oklch(0.50 0.01 260)', label: 'مغلقة' },
  cancelled:         { color: 'oklch(0.58 0.21 25)',  label: 'ملغاة' },
  // legacy aliases
  diagnosing:        { color: 'oklch(0.55 0.16 295)', label: 'قيد الفحص' },
  pending_approval:  { color: 'oklch(0.68 0.15 70)',  label: 'بانتظار الموافقة' },
  in_progress:       { color: 'oklch(0.60 0.13 220)', label: 'قيد العمل' },
  ready:             { color: 'oklch(0.60 0.15 150)', label: 'جاهزة' },
};

const FALLBACK = { color: 'oklch(0.50 0.01 260)', label: '—' };

export default function StatusPill({ status, size = 'md' }) {
  const meta = STATUS_META[status] ?? FALLBACK;
  const height = size === 'sm' ? 18 : 20;
  const fontSize = size === 'sm' ? 11 : 11.5;
  const padding = size === 'sm' ? '0 6px' : '0 8px';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height, padding, borderRadius: 999,
        fontSize, fontWeight: 500, whiteSpace: 'nowrap',
        color: meta.color,
        border: `1px solid color-mix(in oklch, ${meta.color} 30%, var(--border))`,
        background: `color-mix(in oklch, ${meta.color} 9%, var(--bg-raised))`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

// ── Avatar — colored initials circle ──
function nameToHue(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 37) % 360;
  return h;
}

export function Avatar({ name = '', size = 24 }) {
  const hue = nameToHue(name);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span style={{
      display: 'inline-grid', placeItems: 'center',
      width: size, height: size, borderRadius: '50%',
      background: `oklch(0.75 0.12 ${hue})`,
      color: '#fff', fontSize: Math.max(9, size * 0.42),
      fontWeight: 600, flexShrink: 0,
      fontFamily: 'var(--font-mono)',
    }}>
      {initial}
    </span>
  );
}

// ── Kbd — keyboard shortcut badge ──
export function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

// ── Sparkline — mini SVG polyline ──
export function Sparkline({ data = [], color = 'var(--primary)', className = 'spark' }) {
  if (!data.length) return <div className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── PriorityDot ──
export function PriorityDot({ priority }) {
  if (!priority || priority === 'normal') return null;
  const color = priority === 'rush' ? 'var(--danger)' : 'var(--warning)';
  return (
    <span
      title={priority === 'rush' ? 'عاجل' : 'أولوية'}
      style={{
        display: 'inline-block', width: 7, height: 7,
        borderRadius: '50%', background: color, flexShrink: 0,
      }}
    />
  );
}
