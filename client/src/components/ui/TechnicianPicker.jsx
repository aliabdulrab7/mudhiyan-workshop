import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTechniciansPicker, getSuggestedTechnicians } from '../../api/technicians';
import { getSpecializations } from '../../api/specializations';
import { Icons } from '../icons';
import StatusIndicator from './StatusIndicator';
import WorkloadBadge from './WorkloadBadge';

const STATUS_OPTIONS = [
  { value: 'available', label: 'متاح' },
  { value: 'busy',      label: 'مشغول' },
  { value: 'off_shift', label: 'خارج الدوام' },
  { value: 'on_leave',  label: 'في إجازة' },
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

const GAP_PX = 4;
const VM = 8; // viewport margin

function calcPos(triggerRect, panelWidth, panelHeight) {
  const rtl = document.dir === 'rtl';
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const flipUp = spaceBelow < panelHeight + GAP_PX && triggerRect.top > spaceBelow;
  const top = flipUp
    ? Math.max(VM, triggerRect.top - panelHeight - GAP_PX)
    : triggerRect.bottom + GAP_PX;
  let left = rtl ? triggerRect.right - panelWidth : triggerRect.left;
  left = Math.max(VM, Math.min(left, window.innerWidth - panelWidth - VM));
  return { top, left };
}

// TechRow renders a single technician option in the picker panel.
function TechRow({ tech, selected, onSelect, onKeyDown, testId }) {
  const specs = (tech.specializations_top3 || tech.specializations || []).slice(0, 3);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={testId}
      onClick={() => onSelect(tech)}
      onKeyDown={onKeyDown}
      className="w-full flex items-start gap-2 px-3 py-2 text-start outline-none hover:bg-bg-soft focus:bg-bg-soft transition-colors"
    >
      <span style={{ flexShrink: 0, marginTop: 4 }}>
        <StatusIndicator status={tech.status} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-[12.5px] text-text truncate">
            {tech.name || `#${tech.id}`}
          </span>
          {tech.role_display_label_ar && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.05em] px-1 py-0.5 rounded-sm"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border)' }}
            >
              {tech.role_display_label_ar}
            </span>
          )}
          {selected && (
            <Icons.Check size={11} style={{ color: 'var(--primary)', marginInlineStart: 'auto', flexShrink: 0 }} />
          )}
        </div>
        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {specs.map(s => (
              <span
                key={s.id}
                className="text-[10px] px-1 py-0.5 rounded-sm"
                style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {s.display_label_ar || s.value}
              </span>
            ))}
          </div>
        )}
      </div>
      {tech.active_count != null && (
        <WorkloadBadge
          count={tech.active_count}
          urgent={tech.urgent_count ?? 0}
          className="self-center"
        />
      )}
    </button>
  );
}

/**
 * TechnicianPicker — searchable, filterable technician selector.
 *
 * Props:
 *   value          number | null     Selected technician id
 *   onChange       fn(id | null)     Selection/clear callback
 *   label          string | null     Trigger display text (overrides internal name lookup)
 *   itemId         number?           When provided, fetches a "suggested" section
 *   excludeStatus  string[]?         Statuses to hide from the list
 *   allowClear     boolean           Shows "إلغاء التعيين" option when value is set
 *   disabled       boolean           Disables the trigger button
 *   placeholder    string            Trigger text when nothing is selected
 *   testId         string            data-testid for the trigger button (caller-namespaced)
 *
 * Testids (panel internals — shared names safe because only one panel is open at a time):
 *   tech-picker__search
 *   tech-picker__chip--status--{value}
 *   tech-picker__chip--spec--{value}
 *   tech-picker__section--suggested
 *   tech-picker__section--all
 *   tech-picker__row--{techId}
 *   tech-picker__empty
 */
export default function TechnicianPicker({
  value = null,
  onChange,
  label,
  itemId,
  excludeStatus,
  allowClear = false,
  disabled = false,
  placeholder = 'اختر فنياً',
  zIndex = 1000,
  testId,
}) {
  const [open, setOpen]               = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [specFilter, setSpecFilter]   = useState(''); // specialization id (string)
  const [items, setItems]             = useState([]);
  const [suggested, setSuggested]     = useState([]);
  const [specs, setSpecs]             = useState([]); // top-5 for filter chips, cached
  const [resolvedName, setResolvedName] = useState(null); // tech name resolved from loaded items
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [pos, setPos]                 = useState(null);

  const triggerRef = useRef(null);
  const panelRef   = useRef(null);
  const searchRef  = useRef(null);

  // Debounce search 200ms.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch technicians when open / filters change.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getTechniciansPicker({ q: search || undefined, status: statusFilter || undefined, limit: 50 });
        if (cancelled) return;
        let list = data.items ?? [];
        if (excludeStatus?.length) list = list.filter(t => !excludeStatus.includes(t.status));
        // Spec filter is client-side until /api/technicians/picker supports specialization_id.
        if (specFilter) {
          list = list.filter(t =>
            (t.specializations_top3 || t.specializations || []).some(s => String(s.id) === specFilter),
          );
        }
        setItems(list);
      } catch (e) {
        if (!cancelled) setError(e.message || 'فشل تحميل الفنيين');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, search, statusFilter, specFilter, excludeStatus]);

  // Fetch suggested techs once per open when itemId provided.
  useEffect(() => {
    if (!open || !itemId) return;
    let cancelled = false;
    getSuggestedTechnicians(itemId, { limit: 5 })
      .then(data => { if (!cancelled) setSuggested(data.suggestions ?? []); })
      .catch(() => { if (!cancelled) setSuggested([]); });
    return () => { cancelled = true; };
  }, [open, itemId]);

  // Fetch top-5 specs for filter chips once per session (re-fetches if cleared on unmount).
  useEffect(() => {
    if (!open || specs.length > 0) return;
    getSpecializations()
      .then(data => setSpecs((Array.isArray(data) ? data : []).filter(s => s.active !== 0).slice(0, 5)))
      .catch(() => {});
  }, [open, specs.length]);

  // Resolve tech display name from loaded items (for trigger label fallback).
  useEffect(() => {
    if (value == null) { setResolvedName(null); return; }
    const found = items.find(t => t.id === value) ?? suggested.find(t => t.id === value);
    if (found) setResolvedName(found.name || `#${found.id}`);
    // If not found in current load, keep existing resolvedName — avoid flash to #id.
  }, [value, items, suggested]);

  // Panel positioning — recompute after items load (panel height changes).
  const reposition = useCallback(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const p = panelRef.current.getBoundingClientRect();
    setPos(calcPos(t, p.width, p.height));
  }, [open]);

  useLayoutEffect(() => { reposition(); }, [open, items, suggested, reposition]);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [open, reposition]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Focus search on open; reset transient state on close.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 20);
      return () => clearTimeout(t);
    } else {
      setSearchInput('');
      setSearch('');
      setStatusFilter('');
      setSpecFilter('');
      setItems([]);
      setSuggested([]);
      setError('');
    }
  }, [open]);

  function closePicker() {
    setOpen(false);
    triggerRef.current?.querySelector('button,[role="button"]')?.focus();
  }

  function handleSelect(tech) {
    onChange?.(tech.id, tech); // second arg is the full tech object for optimistic updates
    closePicker();
  }

  function handleClear() {
    onChange?.(null, null);
    setResolvedName(null);
    closePicker();
  }

  // Keyboard navigation within the panel list.
  function onRowKeyDown(e, tech) {
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(tech); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const rows = Array.from(panelRef.current?.querySelectorAll('[role="option"]') ?? []);
      const idx = rows.indexOf(e.currentTarget);
      if (e.key === 'ArrowUp') {
        if (idx <= 0) searchRef.current?.focus();
        else rows[idx - 1]?.focus();
      } else {
        if (idx < rows.length - 1) rows[idx + 1]?.focus();
      }
    }
  }

  function onClearKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleClear(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = Array.from(panelRef.current?.querySelectorAll('[role="option"]') ?? []);
      rows[rows.length - 1]?.focus();
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = panelRef.current?.querySelector('[role="option"]');
      first?.focus();
    }
  }

  function onPanelKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); }
  }

  const triggerLabel = label ?? resolvedName ?? (value != null ? `#${value}` : null) ?? placeholder;
  const hasValue = value != null;

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <button
          type="button"
          data-testid={testId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open ? 'true' : 'false'}
          onClick={() => !disabled && setOpen(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 8px',
            background: hasValue ? 'var(--primary-soft)' : 'var(--bg-soft)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11.5,
            color: hasValue ? 'var(--text)' : 'var(--text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={hasValue ? `الفني: ${triggerLabel}` : placeholder}
        >
          <Icons.User size={11} aria-hidden="true" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
        </button>
      </span>

      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          aria-label="اختر فنياً"
          data-testid="tech-picker"
          onKeyDown={onPanelKeyDown}
          style={{
            position: 'fixed',
            top: pos ? pos.top : 0,
            left: pos ? pos.left : 0,
            visibility: pos ? 'visible' : 'hidden',
            zIndex,
            width: `min(340px, calc(100vw - ${VM * 2}px))`,
          }}
          className="bg-bg-raised border border-border rounded shadow-lg outline-none flex flex-col"
        >
          {/* Search */}
          <div className="px-2 pt-2 pb-1.5 border-b border-border">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded"
              style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}
            >
              <Icons.Search size={12} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="ابحث بالاسم..."
                data-testid="tech-picker__search"
                autoComplete="off"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 12.5, color: 'var(--text)', padding: 0, minWidth: 0,
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); searchRef.current?.focus(); }}
                  style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  tabIndex={-1}
                  aria-label="مسح البحث"
                >
                  <Icons.X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="px-2 py-1.5 border-b border-border flex flex-wrap gap-1">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                type="button"
                data-testid={`tech-picker__chip--status--${s.value}`}
                onClick={() => setStatusFilter(f => f === s.value ? '' : s.value)}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px',
                  borderRadius: 4, border: '1px solid',
                  cursor: 'pointer', transition: 'all 120ms',
                  background: statusFilter === s.value ? 'var(--primary)' : 'var(--bg-soft)',
                  color:      statusFilter === s.value ? '#fff'           : 'var(--text-muted)',
                  borderColor: statusFilter === s.value ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {s.label}
              </button>
            ))}
            {specs.map(sp => (
              <button
                key={sp.id}
                type="button"
                data-testid={`tech-picker__chip--spec--${sp.value}`}
                onClick={() => setSpecFilter(f => f === String(sp.id) ? '' : String(sp.id))}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px',
                  borderRadius: 4, border: '1px solid',
                  cursor: 'pointer', transition: 'all 120ms',
                  background: specFilter === String(sp.id) ? 'var(--primary)' : 'var(--bg-soft)',
                  color:      specFilter === String(sp.id) ? '#fff'            : 'var(--text-muted)',
                  borderColor: specFilter === String(sp.id) ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {sp.display_label_ar || sp.value}
              </button>
            ))}
          </div>

          {/* List area — CSS scroll; virtualization can layer on when roster grows past ~100 */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {loading && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 12px' }}>
                جاري التحميل...
              </div>
            )}

            {!loading && error && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '10px 12px' }}>{error}</div>
            )}

            {!loading && !error && (
              <>
                {/* Suggested section */}
                {suggested.length > 0 && (
                  <div data-testid="tech-picker__section--suggested">
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
                      مقترح لهذا الصنف
                    </div>
                    {suggested.map(t => (
                      <TechRow
                        key={t.id}
                        tech={t}
                        selected={t.id === value}
                        onSelect={handleSelect}
                        onKeyDown={e => onRowKeyDown(e, t)}
                        testId={`tech-picker__row--${t.id}`}
                      />
                    ))}
                    {items.length > 0 && <div role="separator" style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
                  </div>
                )}

                {/* Full list */}
                <div data-testid="tech-picker__section--all">
                  {items.length === 0 ? (
                    <div
                      data-testid="tech-picker__empty"
                      style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '20px 12px' }}
                    >
                      لا يوجد فنيون مطابقون
                    </div>
                  ) : (
                    items.map(t => (
                      <TechRow
                        key={t.id}
                        tech={t}
                        selected={t.id === value}
                        onSelect={handleSelect}
                        onKeyDown={e => onRowKeyDown(e, t)}
                        testId={`tech-picker__row--${t.id}`}
                      />
                    ))
                  )}
                </div>

                {/* Unassign option */}
                {allowClear && hasValue && (
                  <>
                    <div role="separator" style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button
                      type="button"
                      role="option"
                      onClick={handleClear}
                      onKeyDown={onClearKeyDown}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-start outline-none transition-colors"
                      style={{ fontSize: 12.5, color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.55 0.18 25 / 0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onFocus={e => e.currentTarget.style.background = 'oklch(0.55 0.18 25 / 0.08)'}
                      onBlur={e => e.currentTarget.style.background = 'none'}
                    >
                      <Icons.X size={12} aria-hidden="true" />
                      إلغاء التعيين
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
