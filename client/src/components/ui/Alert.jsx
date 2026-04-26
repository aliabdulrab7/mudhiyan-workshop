import { Icons } from '../icons.jsx';

// Alert — banner-style notice with structurally distinguishable variants
// per CLEANUP-PLAN §2.1. Each variant carries its own icon + body color +
// title weight, not just hue. Border uses CSS logical properties so it
// lands on the right edge in RTL without per-locale branching.

const VARIANT_META = {
  danger: {
    icon: Icons.X,
    color: 'var(--danger)',
    bg:    'oklch(0.55 0.18 25 / 0.06)',
    titleWeight: 600,
  },
  success: {
    icon: Icons.Check,
    color: 'var(--success)',
    bg:    'oklch(0.56 0.13 150 / 0.06)',
    titleWeight: 600,
  },
  warning: {
    icon: Icons.Warn,
    color: 'var(--warning)',
    bg:    'oklch(0.66 0.14 75 / 0.08)',
    titleWeight: 600,
  },
  info: {
    icon: Icons.Sparkle,
    color: 'var(--primary)',
    bg:    'var(--primary-soft)',
    titleWeight: 500,
  },
};

export default function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  testId,
  className = '',
}) {
  const meta = VARIANT_META[variant] || VARIANT_META.info;
  const Icon = meta.icon;

  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      data-testid={testId}
      className={`flex items-start gap-3 rounded-sm px-3 py-2.5 text-[13px] leading-snug ${className}`}
      style={{
        background: meta.bg,
        border: `1px solid ${meta.color}`,
        borderInlineStartWidth: 3,
        color: meta.color,
      }}
    >
      <Icon size={16} stroke={meta.color} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && (
          <div style={{ fontWeight: meta.titleWeight, color: meta.color }}>{title}</div>
        )}
        {children && (
          <div className={title ? 'mt-0.5 font-normal text-text' : 'font-normal text-text'}>
            {children}
          </div>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق"
          className="flex-shrink-0 -m-1 p-1 rounded hover:bg-black/5 transition-colors"
          style={{ color: meta.color }}
        >
          <Icons.X size={14} stroke="currentColor" />
        </button>
      )}
    </div>
  );
}
