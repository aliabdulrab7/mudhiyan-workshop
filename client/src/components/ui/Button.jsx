const variants = {
  primary: 'bg-primary text-white border border-[var(--primary-hover)] hover:bg-[var(--primary-hover)] hover:shadow-[0_0_0_3px_var(--primary-ring)] active:bg-primary',
  ghost:   'bg-bg-raised text-text-soft border border-border hover:border-primary hover:text-primary hover:bg-[var(--primary-soft)]',
  subtle:  'bg-transparent text-text-muted border border-transparent hover:bg-bg-soft hover:text-text',
  danger:  'bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[oklch(0.55_0.18_25/0.10)] hover:shadow-[0_0_0_3px_oklch(0.55_0.18_25/0.20)] active:bg-[oklch(0.55_0.18_25/0.16)]',
  gold:    'bg-primary text-white border border-primary uppercase tracking-wider hover:bg-[var(--primary-hover)] hover:shadow-[0_0_0_3px_var(--primary-ring)] active:bg-primary',
};

const sizes = {
  sm: 'text-xs px-2.5 py-1 gap-1 rounded',
  md: 'text-sm px-4 py-2 gap-1.5 rounded',
  lg: 'text-[15px] px-5 py-2.5 gap-2 rounded-md',
};

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  loading = false,
  disabled,
  testId,
  type = 'button',
  as: Tag = 'button',
  children,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;
  // Native <button> needs `type` + `disabled`; non-button tags shouldn't get them.
  const tagProps = Tag === 'button'
    ? { type, disabled: isDisabled, 'aria-busy': loading ? 'true' : undefined }
    : { 'aria-disabled': isDisabled ? 'true' : undefined };
  return (
    <Tag
      {...tagProps}
      data-testid={testId}
      className={`inline-flex items-center justify-center font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </Tag>
  );
}
