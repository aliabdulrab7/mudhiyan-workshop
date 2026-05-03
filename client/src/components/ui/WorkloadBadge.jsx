const TIERS = [
  { min: 6, color: 'var(--danger)',  bg: 'oklch(0.55 0.18 25 / 0.08)',  border: 'oklch(0.55 0.18 25 / 0.25)' },
  { min: 3, color: 'var(--warning)', bg: 'oklch(0.66 0.14 75 / 0.08)',  border: 'oklch(0.66 0.14 75 / 0.25)' },
  { min: 0, color: 'var(--success)', bg: 'oklch(0.56 0.13 150 / 0.08)', border: 'oklch(0.56 0.13 150 / 0.25)' },
];

function tier(count) {
  return TIERS.find(t => count >= t.min);
}

// WorkloadBadge — color-coded numeric badge for technician active item count.
// 0-2 = green, 3-5 = yellow, 6+ = red. urgent dot shown when urgent > 0.
export default function WorkloadBadge({ count = 0, urgent = 0, className = '', testId }) {
  const { color, bg, border } = tier(count);
  return (
    <span
      data-testid={testId ?? `workload-badge--${count}`}
      className={`inline-flex items-center gap-1 font-mono font-semibold ${className}`}
      style={{
        fontSize: 11,
        height: 22,
        paddingInline: 6,
        borderRadius: 4,
        background: bg,
        color,
        border: `1px solid ${border}`,
        flexShrink: 0,
      }}
    >
      {count}
      {urgent > 0 && (
        <span
          aria-label={`${urgent} مستعجل`}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--danger)',
            flexShrink: 0,
          }}
        />
      )}
    </span>
  );
}
