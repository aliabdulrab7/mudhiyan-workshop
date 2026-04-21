import { useEffect, useId, useRef } from 'react';

const boxSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const iconSizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export default function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  id,
  size = 'md',
  invalid = false,
  disabled,
  testId,
  className = '',
  ...rest
}) {
  const generatedId = useId();
  const inputId = id ?? (label ? generatedId : undefined);
  const inputRef = useRef(null);

  // `indeterminate` is a DOM property, not an HTML attribute — React won't
  // reflect it through JSX, so set it imperatively after render.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const box = boxSizes[size];
  const icon = iconSizes[size];
  const borderCls = invalid ? 'border-[var(--danger)]' : 'border-border';

  const control = (
    <span className={`relative inline-grid place-items-center flex-shrink-0 ${box}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid ? 'true' : undefined}
        data-testid={testId}
        onChange={onChange ? (e) => onChange(e.target.checked, e) : undefined}
        className={`peer appearance-none w-full h-full rounded border ${borderCls} bg-bg-raised cursor-pointer transition-colors
          checked:bg-primary checked:border-primary
          indeterminate:bg-primary indeterminate:border-primary
          hover:border-primary
          focus-visible:outline-none focus-visible:shadow-focus
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border
          ${className}`}
        {...rest}
      />
      {/* Check glyph — hidden when indeterminate wins */}
      <svg
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute ${icon} stroke-white fill-none opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="2.5,6.5 5,9 9.5,3.5" />
      </svg>
      {/* Dash glyph — indeterminate */}
      <svg
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute ${icon} opacity-0 peer-indeterminate:opacity-100`}
        aria-hidden="true"
      >
        <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );

  if (!label) return control;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {control}
      <span className="text-sm text-text select-none">{label}</span>
    </label>
  );
}
