import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';

export default function CommandPalette({ open, onClose, orders = [] }) {
  const navigate = useNavigate();
  const role = getRole();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(0);
  const inputRef = useRef(null);

  const go = (path) => { navigate(path); onClose(); };

  const commands = useMemo(() => {
    const isWorkshop = role === 'workshop';
    return [
      {
        group: 'انتقال',
        items: [
          { id: 'go:home',        label: 'الطلبات',      hint: 'G H', fn: () => go('/') },
          { id: 'go:new',         label: 'صيانة جديدة',  hint: 'N',   fn: () => go('/new') },
          { id: 'go:scan',        label: 'مسح الباركود', hint: 'G S', fn: () => go('/scan') },
          isWorkshop && { id: 'go:branches',    label: 'الفروع',    fn: () => go('/branches') },
          isWorkshop && { id: 'go:reports',     label: 'التقارير',  fn: () => go('/reports') },
          isWorkshop && { id: 'go:technicians', label: 'الفنيون',   fn: () => go('/technicians') },
          isWorkshop && { id: 'go:inventory',   label: 'المخزون',   fn: () => go('/inventory') },
          isWorkshop && { id: 'go:services',    label: 'الخدمات',   fn: () => go('/services') },
        ].filter(Boolean),
      },
      {
        group: 'الطلبات الأخيرة',
        items: orders.slice(0, 8).map(o => ({
          id: 'ord:' + o.id,
          label: `${o.order_number} — ${o.customer_name}`,
          hint: o.piece_type,
          fn: () => { navigate('/'); onClose(); },
        })),
      },
    ];
  }, [orders, role]);

  const flat = commands.flatMap(g => g.items.map(it => ({ ...it, group: g.group })));
  const filtered = q
    ? flat.filter(it => it.label.toLowerCase().includes(q.toLowerCase()) || it.hint?.toLowerCase().includes(q.toLowerCase()))
    : flat;

  const groups = filtered.reduce((acc, it) => {
    (acc[it.group] = acc[it.group] || []).push(it);
    return acc;
  }, {});

  useEffect(() => {
    if (open) { inputRef.current?.focus(); setQ(''); setFocus(0); }
  }, [open]);

  useEffect(() => { setFocus(0); }, [q]);

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(filtered.length - 1, f + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(f => Math.max(0, f - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[focus]?.fn(); }
    else if (e.key === 'Escape') { onClose(); }
  }

  if (!open) return null;

  let idx = -1;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(10,12,15,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[90vw] max-w-[560px] bg-bg-raised border border-border rounded-lg shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-border px-4">
          <svg className="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            ref={inputRef}
            className="flex-1 px-3 py-3.5 text-[15px] border-0 outline-none bg-transparent placeholder:text-text-muted"
            placeholder="اكتب للبحث أو التنقل…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            dir="rtl"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-soft border border-border rounded text-text-faint">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">لا توجد نتائج</div>
          ) : (
            Object.entries(groups).map(([g, items]) => (
              <div key={g}>
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-text-faint font-medium">
                  {g}
                </div>
                {items.map(it => {
                  idx += 1;
                  const isFocused = idx === focus;
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                        isFocused ? 'bg-[var(--primary-soft)] text-primary' : 'text-text hover:bg-bg-soft'
                      }`}
                      onClick={it.fn}
                      onMouseEnter={() => setFocus(flat.findIndex(x => x.id === it.id))}
                    >
                      <span className="flex-1">{it.label}</span>
                      {it.hint && (
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-soft border border-border rounded text-text-faint">
                          {it.hint}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex gap-4 px-4 py-2 border-t border-border text-[11px] text-text-faint">
          <span>↑↓ تنقل</span>
          <span>↵ اختيار</span>
          <span>esc إغلاق</span>
        </div>
      </div>
    </div>
  );
}
