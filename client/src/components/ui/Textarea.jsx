const sizes = {
  sm: 'text-xs px-2 py-1.5',
  md: 'text-[13px] px-2.5 py-2',
  lg: 'text-sm px-3 py-2.5',
};

// Textarea has no type/mono gating like Input — `auto` resolves to rtl
// (the app's primary direction for free-form Arabic content).
function resolveDir(dir) {
  if (dir === 'rtl' || dir === 'ltr') return dir;
  return 'rtl';
}

export default function Textarea({
  size = 'md',
  invalid = false,
  dir = 'auto',
  testId,
  className = '',
  style,
  ...rest
}) {
  const resolvedDir = resolveDir(dir);
  const base = 'w-full rounded border bg-bg-raised text-text transition-[border-color,box-shadow] duration-100 outline-none placeholder:text-text-faint disabled:opacity-50 disabled:cursor-not-allowed leading-[1.5] resize-y';
  const focus = 'focus:border-[var(--border-focus)] focus:shadow-focus';
  const invalidCls = invalid
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_2px_oklch(0.55_0.18_25/0.28)]'
    : 'border-border';
  const textAlign = resolvedDir === 'ltr' ? 'text-left' : 'text-right';

  return (
    <textarea
      dir={resolvedDir}
      aria-invalid={invalid ? 'true' : undefined}
      data-testid={testId}
      style={style}
      className={`${base} ${focus} ${sizes[size]} ${invalidCls} ${textAlign} ${className}`}
      {...rest}
    />
  );
}
