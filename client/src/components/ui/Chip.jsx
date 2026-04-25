// Chip — filter-toggle pill. Distinct from StatusPill (display-only order
// status) and Button (primary action). Active colorway flips bg + text + border;
// optional count slot renders monospace alongside the label.

const sizes = {
  sm: 'h-[18px] px-1.5 text-[9.5px] gap-1',
  md: 'h-[22px] px-2 text-[10.5px] gap-1.5',
  lg: 'h-7 px-2.5 text-xs gap-1.5',
};

export default function Chip({
  active = false,
  count,
  onClick,
  disabled,
  testId,
  type = 'button',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  const base = 'inline-flex items-center rounded-sm font-semibold uppercase tracking-[0.06em] whitespace-nowrap cursor-pointer transition-[background-color,border-color,color] duration-100 disabled:opacity-50 disabled:cursor-not-allowed';
  const colorway = active
    ? 'bg-primary border border-primary text-white'
    : 'bg-bg-raised border border-border text-text-muted hover:bg-bg-hover hover:text-text hover:border-border-strong';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      data-testid={testId}
      className={`${base} ${sizes[size]} ${colorway} ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {count != null && (
        <span className={`font-mono tracking-normal ${active ? 'text-white/85' : 'text-text-faint'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
