// Card — surface container. Thin wrapper over the legacy `.card` class:
// raised background, hairline border, small radius. The win is owning the
// padding presets and variant in one place so call sites stop hand-rolling
// `<div className="card" style={{ padding: '20px 24px' }}>`.

const PADDINGS = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'px-6 py-5',
};

const VARIANTS = {
  default: 'bg-bg-raised border border-border',
  soft:    'bg-bg-soft border border-border',
  raised:  'bg-bg-raised border border-border-strong shadow-sm',
};

export default function Card({
  padding = 'none',
  variant = 'default',
  as: Tag = 'div',
  className = '',
  testId,
  children,
  ...rest
}) {
  return (
    <Tag
      data-testid={testId}
      className={`rounded-sm overflow-hidden ${VARIANTS[variant] || VARIANTS.default} ${PADDINGS[padding] || ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
