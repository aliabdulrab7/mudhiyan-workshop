import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';
import { Icons } from './icons';

function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

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
          { id: 'go:home',        label: 'الطلبات',      icon: <Icons.Orders size={14}/>,      hint: 'G H', fn: () => go('/') },
          { id: 'go:new',         label: 'صيانة جديدة',  icon: <Icons.Plus size={14}/>,        hint: 'N',   fn: () => go('/new') },
          { id: 'go:scan',        label: 'مسح الباركود', icon: <Icons.Scan size={14}/>,        hint: 'G S', fn: () => go('/scan') },
          isWorkshop && { id: 'go:branches',    label: 'الفروع',    icon: <Icons.Branch size={14}/>,    fn: () => go('/branches') },
          isWorkshop && { id: 'go:reports',     label: 'التقارير',  icon: <Icons.Chart size={14}/>,     fn: () => go('/reports') },
          isWorkshop && { id: 'go:technicians', label: 'الفنيون',   icon: <Icons.User size={14}/>,      fn: () => go('/technicians') },
          isWorkshop && { id: 'go:inventory',   label: 'المخزون',   icon: <Icons.Box size={14}/>,       fn: () => go('/inventory') },
          isWorkshop && { id: 'go:services',    label: 'الخدمات',   icon: <Icons.Tag size={14}/>,       fn: () => go('/services') },
        ].filter(Boolean),
      },
      {
        group: 'الطلبات الأخيرة',
        items: orders.slice(0, 8).map(o => ({
          id: 'ord:' + o.id,
          label: `${o.order_number} — ${o.customer_name}`,
          icon: <Icons.Diamond size={14}/>,
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
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="اكتب للبحث أو التنقل…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="palette-list">
          {filtered.length === 0 && (
            <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              لا توجد نتائج
            </div>
          )}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g}>
              <div className="palette-group">{g}</div>
              {items.map(it => {
                idx += 1;
                const isFocused = idx === focus;
                return (
                  <div
                    key={it.id}
                    className={`palette-item${isFocused ? ' focused' : ''}`}
                    onClick={it.fn}
                    onMouseEnter={() => setFocus(flat.findIndex(x => x.id === it.id))}
                  >
                    <span className="icon">{it.icon}</span>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.hint && <span className="tail"><Kbd>{it.hint}</Kbd></span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 12 }}>
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> تنقل</span>
          <span><Kbd>↵</Kbd> اختيار</span>
          <span><Kbd>esc</Kbd> إغلاق</span>
        </div>
      </div>
    </div>
  );
}
