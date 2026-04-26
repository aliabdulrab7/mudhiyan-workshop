// SegmentedGroup — pair (or short list) of mutually-exclusive buttons with
// shared borders. Active option fills with its variant's color; inactive
// options render as ghosts in the same color so users see the spectrum
// before clicking. Per-option variant lets approve/reject (success/danger)
// share the same component as urgency normal/rush (primary).

const VARIANTS = {
  primary: {
    activeBg: 'var(--primary)',
    activeFg: '#fff',
    activeBorder: 'var(--primary)',
    idleFg: 'var(--text-muted)',
    idleBorder: 'var(--border)',
  },
  success: {
    activeBg: 'var(--success)',
    activeFg: '#fff',
    activeBorder: 'var(--success)',
    idleFg: 'var(--success)',
    idleBorder: 'oklch(0.60 0.15 150 / 0.3)',
  },
  danger: {
    activeBg: 'var(--danger)',
    activeFg: '#fff',
    activeBorder: 'var(--danger)',
    idleFg: 'var(--danger)',
    idleBorder: 'oklch(0.58 0.21 25 / 0.3)',
  },
};

const SIZES = {
  sm: { height: 28, fontSize: 11.5 },
  md: { height: 32, fontSize: 12 },
  lg: { height: 36, fontSize: 13 },
};

export default function SegmentedGroup({
  value,
  onChange,
  options,
  variant = 'primary',
  size = 'md',
  testIdPrefix,
  className = '',
  ariaLabel,
}) {
  const sz = SIZES[size] || SIZES.md;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-1.5 ${className}`}
    >
      {options.map((opt) => {
        const v = VARIANTS[opt.variant || variant] || VARIANTS.primary;
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange?.(opt.value)}
            data-testid={testIdPrefix ? `${testIdPrefix}__${opt.value}` : undefined}
            style={{
              flex: 1,
              height: sz.height,
              fontSize: sz.fontSize,
              borderRadius: 'var(--radius-sm)',
              background: active ? v.activeBg : 'transparent',
              color: active ? v.activeFg : v.idleFg,
              border: `1px solid ${active ? v.activeBorder : v.idleBorder}`,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background 0.1s, border-color 0.1s, color 0.1s',
            }}
          >
            {Icon && <Icon size={12} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
