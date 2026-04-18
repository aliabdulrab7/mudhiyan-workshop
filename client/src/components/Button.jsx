const variants = {
  primary: 'bg-primary text-white border border-[var(--primary-hover)] hover:bg-[var(--primary-hover)] hover:shadow-[0_0_0_3px_var(--primary-ring)] active:bg-primary',
  ghost:   'bg-bg-raised text-text-soft border border-border hover:border-primary hover:text-primary hover:bg-[var(--primary-soft)]',
  subtle:  'bg-transparent text-text-muted border border-transparent hover:bg-bg-soft hover:text-text',
};

const sizes = {
  sm: 'text-xs px-2.5 py-1 gap-1 rounded',
  md: 'text-sm px-4 py-2 gap-1.5 rounded',
  lg: 'text-[15px] px-5 py-2.5 gap-2 rounded-md',
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
