import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Roll-your-own modal dialog. Portal + focus-trap + scroll-lock.
// iOS scroll-lock requires position:fixed (overflow:hidden alone doesn't
// stop iOS Safari). Trigger capture happens on every open transition, so
// nested Dialogs and re-opens restore focus to whatever was focused at
// the moment that instance opened.

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

function getFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

// Module-level stack so only the topmost open Dialog responds to ESC, even
// though every instance has its own window-capture listener.
const dialogStack = [];

export default function Dialog({
  open,
  onClose,
  title,
  size = 'md',
  testId,
  children,
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const items = getFocusable(dialogRef.current);
    (items[0] || dialogRef.current)?.focus();

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      triggerRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // ESC at window capture phase so we stop propagation before any
  // page-level window keydown listener (e.g. nav-on-ESC) sees it.
  // Only the topmost dialog in the stack reacts — nested dialogs share
  // window so we use the stack to disambiguate.
  useEffect(() => {
    if (!open) return;
    const id = {};
    dialogStack.push(id);
    function onWindowKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (dialogStack[dialogStack.length - 1] !== id) return;
      e.stopPropagation();
      onClose?.();
    }
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => {
      const idx = dialogStack.indexOf(id);
      if (idx >= 0) dialogStack.splice(idx, 1);
      window.removeEventListener('keydown', onWindowKeyDown, true);
    };
  }, [open, onClose]);

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const items = getFocusable(dialogRef.current);
    if (items.length === 0) {
      e.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const active = document.activeElement;
    const inside = dialogRef.current?.contains(active);
    if (!inside) {
      e.preventDefault();
      items[0].focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40"
      onMouseDown={(e) => {
        // preventDefault so the browser's click-on-non-focusable doesn't
        // shift focus to body and stomp the cleanup's trigger.focus().
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-testid={testId}
        onKeyDown={onKeyDown}
        className={`w-full ${SIZE_CLASS[size] || SIZE_CLASS.md} bg-bg-raised rounded-lg shadow-xl outline-none flex flex-col max-h-[calc(100vh-2rem)]`}
      >
        {title && (
          <div className="px-5 py-3 border-b border-border flex-shrink-0">
            <h2 id={titleId} className="text-base font-semibold text-text">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Body({ children }) {
  return <div className="px-5 py-4 overflow-y-auto flex-1 text-text">{children}</div>;
}

function Footer({ children }) {
  return (
    <div className="px-5 py-3 border-t border-border flex-shrink-0 flex items-center justify-end gap-2">
      {children}
    </div>
  );
}

Dialog.Body = Body;
Dialog.Footer = Footer;
