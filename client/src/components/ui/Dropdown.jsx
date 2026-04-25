import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// Roll-your-own dropdown menu. Portal-rendered so it escapes overflow:hidden
// containers (sidebar, table cells). Trigger is wrapped in a thin inline-flex
// span — that span owns the trigger ref, the original trigger element is
// cloned and gets aria-haspopup/aria-expanded forwarded via ...rest.
//
// Click-outside uses pointerdown (works for touch on iOS, where a click that
// follows a touchstart on a different element is sometimes swallowed).

const DropdownContext = createContext(null);

const GAP_PX = 4;
const VIEWPORT_MARGIN = 8;

function isRtl() {
  return typeof document !== 'undefined' && document.dir === 'rtl';
}

function calcPosition(triggerRect, menuRect, align) {
  const rtl = isRtl();
  // Vertical: prefer below; flip up when there isn't room and there is room above.
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const flipUp = spaceBelow < menuRect.height + GAP_PX && spaceAbove > spaceBelow;
  const top = flipUp
    ? Math.max(VIEWPORT_MARGIN, triggerRect.top - menuRect.height - GAP_PX)
    : triggerRect.bottom + GAP_PX;

  // Horizontal: align="start" → menu starts at trigger's start edge.
  // In RTL, "start" is the right edge; in LTR, the left edge.
  let left;
  if (rtl) {
    left = align === 'start'
      ? triggerRect.right - menuRect.width
      : triggerRect.left;
  } else {
    left = align === 'start'
      ? triggerRect.left
      : triggerRect.right - menuRect.width;
  }
  // Clamp to viewport so menus near the edge don't get cut off.
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - menuRect.width - VIEWPORT_MARGIN),
  );

  return { top, left };
}

function getActivatableItems(menuEl) {
  if (!menuEl) return [];
  return Array.from(
    menuEl.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'),
  );
}

export default function Dropdown({
  trigger,
  align = 'start',
  open: controlledOpen,
  onOpenChange,
  testId,
  children,
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  const setOpen = useCallback(
    (next) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to the trigger button (the first focusable inside the wrapper).
    const btn = triggerRef.current?.querySelector('button, [role="button"]');
    btn?.focus();
  }, [setOpen]);

  // Position: measure once after open + after menu is in DOM.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    if (!triggerRef.current || !menuRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    setPos(calcPosition(t, m, align));
  }, [open, align]);

  // Reposition on scroll/resize while open.
  useEffect(() => {
    if (!open) return;
    function update() {
      if (!triggerRef.current || !menuRef.current) return;
      const t = triggerRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      setPos(calcPosition(t, m, align));
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align]);

  // Click-outside via pointerdown (touch-friendly on iOS).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen]);

  // Initial focus: first activatable item, after the menu is positioned.
  useEffect(() => {
    if (!open || !pos || !menuRef.current) return;
    const items = getActivatableItems(menuRef.current);
    items[0]?.focus();
  }, [open, pos]);

  function onMenuKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
      const items = getActivatableItems(menuRef.current);
      if (items.length === 0) return;
      const dir = e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
      const idx = items.indexOf(document.activeElement);
      const nextIdx =
        idx === -1
          ? dir > 0 ? 0 : items.length - 1
          : (idx + dir + items.length) % items.length;
      items[nextIdx].focus();
      e.preventDefault();
    }
    if (e.key === 'Home') {
      const items = getActivatableItems(menuRef.current);
      items[0]?.focus();
      e.preventDefault();
    }
    if (e.key === 'End') {
      const items = getActivatableItems(menuRef.current);
      items[items.length - 1]?.focus();
      e.preventDefault();
    }
  }

  function onTriggerKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
    }
  }

  const enhancedTrigger = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open ? 'true' : 'false',
  });

  const ctx = { close };

  return (
    <DropdownContext.Provider value={ctx}>
      <span
        ref={triggerRef}
        className="inline-flex"
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKeyDown}
      >
        {enhancedTrigger}
      </span>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          data-testid={testId}
          onKeyDown={onMenuKeyDown}
          style={{
            position: 'fixed',
            top: pos ? pos.top : 0,
            left: pos ? pos.left : 0,
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 1000,
          }}
          className="min-w-[200px] max-w-[320px] py-1 bg-bg-raised border border-border rounded shadow-lg outline-none"
        >
          {children}
        </div>,
        document.body,
      )}
    </DropdownContext.Provider>
  );
}

function Section({ title, children }) {
  return (
    <div role="group" aria-label={title}>
      {title && (
        <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-faint">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Item({ onSelect, icon, disabled = false, destructive = false, testId, children }) {
  const ctx = useContext(DropdownContext);
  const colorCls = disabled
    ? 'text-text-faint cursor-not-allowed'
    : destructive
      ? 'text-[var(--danger)] hover:bg-[oklch(0.55_0.18_25/0.08)]'
      : 'text-text hover:bg-bg-soft';
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-testid={testId}
      onClick={(e) => {
        if (disabled) return;
        onSelect?.(e);
        ctx?.close();
      }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start outline-none focus:bg-bg-soft transition-colors ${colorCls}`}
    >
      {icon && <span className="inline-flex w-4 h-4 items-center justify-center flex-shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

function Separator() {
  return <div role="separator" className="h-px bg-border my-1" />;
}

Dropdown.Section = Section;
Dropdown.Item = Item;
Dropdown.Separator = Separator;
