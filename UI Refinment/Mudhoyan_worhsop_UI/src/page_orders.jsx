// Orders page: dense table with sort, filter, bulk actions
function OrdersPage({ lang, orders, filter, setFilter, onOpenOrder, selected, setSelected }) {
  const t = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [sort, setSort] = React.useState({ col: 'createdAt', dir: 'desc' });
  const [search, setSearch] = React.useState('');
  const [focusRow, setFocusRow] = React.useState(0);

  const counts = statusCounts(orders);

  const filters = [
    { key: 'all', label: lang === 'ar' ? 'الكل' : 'All', count: orders.length },
    { key: 'received', label: t.stats.received, count: counts.received },
    { key: 'inspection', label: t.stats.inspection, count: counts.inspection },
    { key: 'waiting_approval', label: t.stats.waiting, count: counts.waiting_approval },
    { key: 'in_repair', label: t.stats.repair, count: counts.in_repair },
    { key: 'quality_check', label: t.stats.quality, count: counts.quality_check },
    { key: 'ready_for_return', label: t.stats.ready, count: counts.ready_for_return },
    { key: 'delivered', label: t.stats.delivered, count: counts.delivered + counts.returned_to_shop },
  ];

  const filtered = React.useMemo(() => {
    let list = orders;
    if (filter !== 'all') {
      if (filter === 'delivered') list = list.filter(o => o.status === 'delivered' || o.status === 'returned_to_shop');
      else list = list.filter(o => o.status === filter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        o.order_number.toLowerCase().includes(s) ||
        o.customer.en.toLowerCase().includes(s) ||
        o.customer.ar.includes(search) ||
        o.customer.phone.includes(s)
      );
    }
    list = [...list].sort((a, b) => {
      const getVal = (o) => {
        if (sort.col === 'createdAt') return o.createdAt.getTime();
        if (sort.col === 'etaAt') return o.etaAt.getTime();
        if (sort.col === 'value') return o.value;
        if (sort.col === 'order_number') return o.order_number;
        if (sort.col === 'customer') return o.customer[lang];
        if (sort.col === 'status') return STATUS_ORDER.indexOf(o.status);
        return 0;
      };
      const av = getVal(a), bv = getVal(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [orders, filter, search, sort, lang]);

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  const allSelected = filtered.length > 0 && filtered.every(o => selected.includes(o.id));
  function toggleSelectAll() {
    if (allSelected) setSelected([]);
    else setSelected(filtered.map(o => o.id));
  }
  function setSortCol(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  }

  // keyboard j/k
  React.useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'j') { e.preventDefault(); setFocusRow(f => Math.min(filtered.length - 1, f + 1)); }
      if (e.key === 'k') { e.preventDefault(); setFocusRow(f => Math.max(0, f - 1)); }
      if (e.key === 'x' || e.key === ' ') {
        if (filtered[focusRow]) { e.preventDefault(); toggleSelect(filtered[focusRow].id); }
      }
      if (e.key === 'Enter') {
        if (filtered[focusRow]) { e.preventDefault(); onOpenOrder(filtered[focusRow]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, focusRow]);

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <span className="sort">⇅</span>;
    return <span className="sort" style={{ opacity: 0.9, color: 'var(--primary)' }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar.orders}</h1>
          <div className="page-sub">
            {filtered.length} {lang === 'ar' ? 'من' : 'of'} {orders.length} · {lang === 'ar' ? 'مُرتَّبة حسب' : 'sorted by'} {sort.col}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Icon.Download size={13}/> {t.actions.export}</button>
          <button className="btn btn-sm btn-primary"><Icon.Plus size={13}/> {t.actions.newOrder}</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}<span className="count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <Icon.Search size={13} stroke="var(--text-muted)"/>
            <input
              className="input"
              style={{ border: 'none', background: 'transparent', height: 26, maxWidth: 260 }}
              placeholder={lang === 'ar' ? 'بحث…' : 'Search by name, ID, phone…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-sm btn-ghost"><Icon.Filter size={13}/> {t.actions.filter}</button>
          <button className="btn btn-sm btn-ghost"><Icon.Group size={13}/> {t.actions.group}</button>
          <button className="btn btn-sm btn-ghost"><Icon.Sort size={13}/> {t.actions.sort}</button>
          <div className="divider"/>
          <button className="btn btn-sm btn-ghost btn-icon"><Icon.Refresh size={13}/></button>
          <button className="btn btn-sm btn-ghost btn-icon"><Icon.Settings size={13}/></button>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <colgroup>
            <col style={{ width: 36 }}/>
            <col style={{ width: 100 }}/>
            <col style={{ width: 110 }}/>
            <col style={{ width: 200 }}/>
            <col style={{ width: 180 }}/>
            <col style={{ width: 150 }}/>
            <col style={{ width: 140 }}/>
            <col style={{ width: 130 }}/>
            <col style={{ width: 100 }}/>
            <col style={{ width: 36 }}/>
          </colgroup>
          <thead>
            <tr>
              <th className="col-check"><Checkbox checked={allSelected} indeterminate={!allSelected && selected.length > 0} onChange={toggleSelectAll}/></th>
              <th className="sortable" onClick={() => setSortCol('order_number')}>{t.table.id} <SortIcon col="order_number"/></th>
              <th className="sortable" onClick={() => setSortCol('status')}>{t.table.status} <SortIcon col="status"/></th>
              <th className="sortable" onClick={() => setSortCol('customer')}>{t.table.customer} <SortIcon col="customer"/></th>
              <th>{t.table.piece}</th>
              <th>{t.table.branch}</th>
              <th>{t.table.technician}</th>
              <th className="sortable" onClick={() => setSortCol('etaAt')}>{t.table.eta} <SortIcon col="etaAt"/></th>
              <th className="sortable" onClick={() => setSortCol('value')} style={{ textAlign: 'right' }}>{t.table.value} <SortIcon col="value"/></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const isSel = selected.includes(o.id);
              const isFoc = i === focusRow;
              return (
                <tr key={o.id} className={`${isSel ? 'selected' : ''} ${isFoc ? 'focused' : ''}`} onClick={() => onOpenOrder(o)} onMouseEnter={() => setFocusRow(i)}>
                  <td className="col-check"><Checkbox checked={isSel} onChange={() => toggleSelect(o.id)}/></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PriorityDot priority={o.priority}/>
                      <span className="stamp">{o.order_number}</span>
                    </div>
                  </td>
                  <td><StatusPill status={o.status} dir={dir}/></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={o.customer.en} size={20}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer[lang]}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>+{o.customer.phone.slice(0,3)} {o.customer.phone.slice(3,5)} {o.customer.phone.slice(5,8)} {o.customer.phone.slice(8)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{o.piece[lang]} {o.quantity > 1 && <span className="mono text-xs text-mute">×{o.quantity}</span>}</div>
                    <div className="subline">{o.issue[lang]}</div>
                  </td>
                  <td className="text-mute">{o.branch[lang]}</td>
                  <td>
                    {o.technician ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={o.technician.en} size={18}/>
                        <span>{o.technician[lang]}</span>
                      </div>
                    ) : <span className="text-mute" style={{ fontStyle: 'italic' }}>{t.table.unassigned}</span>}
                  </td>
                  <td className="mono text-sm">{formatDate(o.etaAt, dir)} <span className="text-mute text-xs">· {relTime(o.etaAt, dir)}</span></td>
                  <td className="mono text-sm" style={{ textAlign: 'right' }}>{formatMoney(o.value, dir)}</td>
                  <td>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={e => e.stopPropagation()}><Icon.Ellipsis size={13}/></button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)' }}>
                {lang === 'ar' ? 'لا توجد نتائج' : 'No results'}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{lang === 'ar' ? 'تنقّل' : 'Navigate'}: <Kbd>J</Kbd> <Kbd>K</Kbd></span>
          <span>{lang === 'ar' ? 'حدّد' : 'Select'}: <Kbd>X</Kbd></span>
          <span>{lang === 'ar' ? 'افتح' : 'Open'}: <Kbd>↵</Kbd></span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{filtered.length} {lang === 'ar' ? 'صف' : 'rows'}</span>
        </div>
      </div>

      {selected.length > 0 && (
        <div style={{ position: 'sticky', bottom: 20, zIndex: 50, display: 'flex', justifyContent: 'center', margin: '20px 24px 24px' }}>
          <BulkBar count={selected.length} lang={lang} onClear={() => setSelected([])}/>
        </div>
      )}
    </div>
  );
}

function BulkBar({ count, lang, onClear }) {
  const t = I18N[lang];
  return (
    <div className="bulk-bar">
      <span className="count">{count}</span>
      <span style={{ opacity: 0.7 }}>{t.bulk.selected}</span>
      <span className="divider"/>
      <button className="b-btn"><Icon.User size={12}/> {t.actions.assign}</button>
      <button className="b-btn"><Icon.Sparkle size={12}/> {t.actions.changeStatus}</button>
      <button className="b-btn"><Icon.Printer size={12}/> {t.actions.printLabel}</button>
      <button className="b-btn"><Icon.Bell size={12}/> {t.actions.notify}</button>
      <span className="divider"/>
      <button className="b-btn close" onClick={onClear}><Icon.X size={12}/></button>
    </div>
  );
}

Object.assign(window, { OrdersPage });
