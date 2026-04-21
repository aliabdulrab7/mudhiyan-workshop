const sizes = {
  sm: 'h-6 text-xs px-2',
  md: 'h-[30px] text-[13px] px-2.5',
  lg: 'h-9 text-sm px-3',
};

export default function Select({
  options,
  placeholder,
  size = 'md',
  invalid = false,
  testId,
  className = '',
  style,
  children,
  ...rest
}) {
  if (import.meta.env.DEV && options != null && children != null) {
    console.warn('[Select] both `options` and `children` were passed; `options` wins. Pick one.');
  }

  const base = 'w-full rounded border bg-bg-raised text-text transition-[border-color,box-shadow] duration-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  const focus = 'focus:border-[var(--border-focus)] focus:shadow-focus';
  const invalidCls = invalid
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_2px_oklch(0.55_0.18_25/0.28)]'
    : 'border-border';

  return (
    <select
      dir="rtl"
      aria-invalid={invalid ? 'true' : undefined}
      data-testid={testId}
      style={style}
      className={`${base} ${focus} ${sizes[size]} ${invalidCls} text-right ${className}`}
      {...rest}
    >
      {placeholder != null && (
        <option value="" disabled>{placeholder}</option>
      )}
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))
        : children}
    </select>
  );
}
