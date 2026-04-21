import { useRef, useEffect, useCallback } from 'react';

// Hidden but focused input. The keyboard-wedge scanner types the barcode into
// this input and fires Enter; onScan is called with the value and the input is
// cleared. 150ms post-scan lockout discards any keystroke that arrives during
// that window (spec § Input focus management item 6). Auto-refocus and
// click-anywhere-refocus are owned here; modal-exempt elements carry
// data-bulk-modal-exempt="true" on themselves or any ancestor.

const LOCKOUT_MS = 150;

function isModalExempt(el) {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.dataset?.bulkModalExempt === 'true') return true;
    cur = cur.parentElement;
  }
  return false;
}

export default function BulkScanInput({
  active,
  onScan,
  onFocusChange,   // (isFocused: boolean) => void — badge state
  containerRef,    // ref to the scrollable scan-page area for click-anywhere-refocus
}) {
  const inputRef  = useRef(null);
  const lockedRef = useRef(false);

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    // Don't steal focus away from modal-exempt elements.
    if (isModalExempt(document.activeElement)) return;
    if (document.activeElement !== el) el.focus();
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (lockedRef.current) {
      // Discard, don't buffer.
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const value = inputRef.current?.value || '';
    if (inputRef.current) inputRef.current.value = '';
    if (!value) return;

    lockedRef.current = true;
    setTimeout(() => { lockedRef.current = false; }, LOCKOUT_MS);

    onScan?.(value.trim());
  }, [onScan]);

  const handleBlur = useCallback(() => {
    onFocusChange?.(false);
    // Auto-refocus unless focus moved into a modal-exempt element.
    setTimeout(() => {
      if (!active) return;
      focusInput();
      if (document.activeElement === inputRef.current) onFocusChange?.(true);
    }, 0);
  }, [active, focusInput, onFocusChange]);

  const handleFocus = useCallback(() => {
    onFocusChange?.(true);
  }, [onFocusChange]);

  // Initial autofocus when scanning starts.
  useEffect(() => {
    if (active) {
      focusInput();
      if (document.activeElement === inputRef.current) onFocusChange?.(true);
    }
  }, [active, focusInput, onFocusChange]);

  // Click-anywhere-on-page refocus. Skip clicks into modal-exempt containers.
  useEffect(() => {
    if (!active) return;
    const container = containerRef?.current || document;
    function onMouseDown(e) {
      if (isModalExempt(e.target)) return;
      // Let the click resolve first, then refocus.
      setTimeout(focusInput, 0);
    }
    container.addEventListener('mousedown', onMouseDown);
    return () => container.removeEventListener('mousedown', onMouseDown);
  }, [active, containerRef, focusInput]);

  // Re-assert focus when the tab comes back (mobile browsers suspend focus).
  useEffect(() => {
    if (!active) return;
    function onVis() {
      if (document.visibilityState === 'visible') focusInput();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active, focusInput]);

  if (!active) return null;

  // Hidden-but-focused: opacity 0 + 1x1 + fixed positioning keeps it out of
  // layout flow without creating off-screen scroll overflow (important in RTL,
  // where a negative `left` can shift the scroll origin).
  return (
    <form onSubmit={handleSubmit} style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none', overflow: 'hidden' }}>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        onBlur={handleBlur}
        onFocus={handleFocus}
        aria-label="bulk scan input"
        data-testid="bulk-scan-hidden-input"
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          border: 0,
          padding: 0,
          margin: 0,
          pointerEvents: 'auto',
        }}
      />
    </form>
  );
}
