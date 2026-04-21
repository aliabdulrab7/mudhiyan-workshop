const sizes = {
  sm: 'h-6 text-xs px-2',
  md: 'h-[30px] text-[13px] px-2.5',
  lg: 'h-9 text-sm px-3',
};

// Explicit dir wins. `auto` resolves against type/mono: numeric/email/tel/mono
// render LTR even in an RTL page; everything else defaults to RTL (the app's
// primary direction).
function resolveDir(dir, type, mono) {
  if (dir === 'rtl' || dir === 'ltr') return dir;
  if (type === 'tel' || type === 'number' || type === 'email') return 'ltr';
  if (mono) return 'ltr';
  return 'rtl';
}

export default function Input({
  type = 'text',
  size = 'md',
  invalid = false,
  dir = 'auto',
  mono = false,
  testId,
  className = '',
  style,
  ...rest
}) {
  const resolvedDir = resolveDir(dir, type, mono);
  const base = 'w-full rounded border bg-bg-raised text-text transition-[border-color,box-shadow] duration-100 outline-none placeholder:text-text-faint disabled:opacity-50 disabled:cursor-not-allowed';
  const focus = 'focus:border-[var(--border-focus)] focus:shadow-focus';
  const invalidCls = invalid
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_2px_oklch(0.55_0.18_25/0.28)]'
    : 'border-border';
  const monoCls = mono ? 'font-mono' : '';
  const textAlign = resolvedDir === 'ltr' ? 'text-left' : 'text-right';

  return (
    <input
      type={type}
      dir={resolvedDir}
      aria-invalid={invalid ? 'true' : undefined}
      data-testid={testId}
      style={style}
      className={`${base} ${focus} ${sizes[size]} ${invalidCls} ${monoCls} ${textAlign} ${className}`}
      {...rest}
    />
  );
}
