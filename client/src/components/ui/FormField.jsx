import { Children, cloneElement, isValidElement, useId } from 'react';

// FormField — label + control + (optional) error/hint. Composes around an
// Input / Select / Textarea child. The child's id is auto-generated and
// linked to the label so click-to-focus works without callers managing ids.
//
// Caller still owns the control's value/onChange. FormField is layout +
// label, not state.

export default function FormField({
  label,
  required = false,
  error,
  hint,
  htmlFor,
  className = '',
  children,
}) {
  const generatedId = useId();
  const inputId = htmlFor ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  // Inject id + aria-* into a single child input/select/textarea unless the
  // caller already set them. Multi-child or non-element children pass through.
  const onlyChild = Children.count(children) === 1 ? Children.only(children) : null;
  const decoratedChild = isValidElement(onlyChild)
    ? cloneElement(onlyChild, {
        id: onlyChild.props.id ?? inputId,
        'aria-invalid': onlyChild.props['aria-invalid'] ?? (error ? 'true' : undefined),
        'aria-describedby': onlyChild.props['aria-describedby'] ?? ([errorId, hintId].filter(Boolean).join(' ') || undefined),
        invalid: onlyChild.props.invalid ?? Boolean(error),
      })
    : children;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted"
        >
          {label}
          {required && <span className="text-[var(--danger)] mr-1">*</span>}
        </label>
      )}
      {decoratedChild}
      {error && (
        <p id={errorId} className="text-xs text-[var(--danger)] m-0">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-faint m-0">
          {hint}
        </p>
      )}
    </div>
  );
}
