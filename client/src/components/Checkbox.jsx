export default function Checkbox({ checked, indeterminate, onChange, onClick, testId }) {
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      data-testid={testId}
      className={[
        'inline-grid place-items-center w-4 h-4 rounded border cursor-pointer flex-shrink-0 transition-colors',
        checked || indeterminate
          ? 'bg-primary border-primary'
          : 'bg-bg-raised border-border hover:border-primary',
      ].join(' ')}
      onClick={e => {
        e.stopPropagation();
        onChange?.(!checked);
        onClick?.(e);
      }}
    >
      {checked && !indeterminate && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 stroke-white fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,6.5 5,9 9.5,3.5" />
        </svg>
      )}
      {indeterminate && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
          <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
