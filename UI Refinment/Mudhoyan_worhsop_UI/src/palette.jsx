function CommandPalette({ open, onClose, lang, setPage, orders }) {
  const t = I18N[lang];
  const [q, setQ] = React.useState('');
  const [focus, setFocus] = React.useState(0);
  const inputRef = React.useRef();

  const commands = React.useMemo(() => [
    { group: t.paletteGroups.jump, items: [
      { id: 'go:dashboard', label: t.sidebar.dashboard, icon: <Icon.Dashboard/>, hint: 'G D', fn: () => setPage('dashboard') },
      { id: 'go:orders', label: t.sidebar.orders, icon: <Icon.Orders/>, hint: 'G O', fn: () => setPage('orders') },
      { id: 'go:new', label: t.sidebar.newOrder, icon: <Icon.Plus/>, hint: 'N', fn: () => setPage('new') },
      { id: 'go:scan', label: t.sidebar.scan, icon: <Icon.Scan/>, hint: 'G S', fn: () => setPage('scan') },
      { id: 'go:label', label: t.sidebar.label, icon: <Icon.Printer/>, hint: 'G L', fn: () => setPage('label') },
      { id: 'go:track', label: t.sidebar.track, icon: <Icon.Link/>, hint: 'G T', fn: () => setPage('track') },
    ]},
    { group: t.paletteGroups.actions, items: [
      { id: 'act:bulk-assign', label: t.actions.assign + '…', icon: <Icon.User/>, fn: () => {} },
      { id: 'act:bulk-status', label: t.actions.changeStatus + '…', icon: <Icon.Sparkle/>, fn: () => {} },
      { id: 'act:print', label: t.actions.printLabel, icon: <Icon.Printer/>, hint: 'P', fn: () => setPage('label') },
      { id: 'act:export', label: t.actions.export + ' CSV', icon: <Icon.Download/>, fn: () => {} },
    ]},
    { group: t.paletteGroups.orders, items: orders.slice(0, 5).map(o => ({
      id: 'ord:' + o.id,
      label: `${o.order_number} — ${o.customer[lang]}`,
      icon: <Icon.Diamond/>,
      hint: o.piece[lang],
      fn: () => setPage('orders'),
    }))}
  ], [lang, orders]);

  const flat = commands.flatMap(g => g.items.map(it => ({ ...it, group: g.group })));
  const filtered = q
    ? flat.filter(it => it.label.toLowerCase().includes(q.toLowerCase()))
    : flat;

  const groups = filtered.reduce((acc, it) => {
    (acc[it.group] = acc[it.group] || []).push(it);
    return acc;
  }, {});

  React.useEffect(() => { if (open) { inputRef.current?.focus(); setQ(''); setFocus(0); } }, [open]);
  React.useEffect(() => { setFocus(0); }, [q]);

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(filtered.length - 1, f + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(f => Math.max(0, f - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[focus]?.fn(); onClose(); }
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
          placeholder={t.paletteHint}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="palette-list">
          {Object.keys(groups).length === 0 && (
            <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              No results
            </div>
          )}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g}>
              <div className="palette-group">{g}</div>
              {items.map(it => {
                idx += 1;
                const isFocus = idx === focus;
                return (
                  <div key={it.id}
                    className={`palette-item ${isFocus ? 'focused' : ''}`}
                    onClick={() => { it.fn(); onClose(); }}
                    onMouseEnter={() => setFocus(flat.indexOf(flat.find(x => x.id === it.id)))}
                  >
                    <span className="icon">{it.icon}</span>
                    <span>{it.label}</span>
                    {it.hint && <span className="tail"><Kbd>{it.hint}</Kbd></span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 12 }}>
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> select</span>
          <span><Kbd>esc</Kbd> close</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
