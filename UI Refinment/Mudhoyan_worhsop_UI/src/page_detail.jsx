// Order detail drawer
function OrderDetail({ order, onClose, lang, onUpdate }) {
  const t = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [editingNote, setEditingNote] = React.useState(false);
  const [note, setNote] = React.useState(order.workshop_notes[lang]);
  const [editingTech, setEditingTech] = React.useState(false);
  const [tech, setTech] = React.useState(order.technician);
  const [status, setStatus] = React.useState(order.status);

  const timeline = [...order.history];
  const future = STATUS_ORDER.slice(STATUS_ORDER.indexOf(status) + 1, STATUS_ORDER.indexOf(status) + 3);

  React.useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !editingNote && !editingTech) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingNote, editingTech]);

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-head">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon.X size={14}/></button>
          <span className="stamp" style={{ fontSize: 12 }}>{order.order_number}</span>
          <StatusPill status={status} dir={dir}/>
          {order.priority === 'rush' && (
            <span className="pill" style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklch, var(--danger) 30%, var(--border))', background: 'color-mix(in oklch, var(--danger) 8%, white)' }}>
              <Icon.Bolt size={10}/> {lang === 'ar' ? 'عاجل' : 'Rush'}
            </span>
          )}
          <div style={{ flex: 1 }}/>
          {nextStatus && (
            <button className="btn btn-sm btn-primary" onClick={() => { setStatus(nextStatus); onUpdate({ ...order, status: nextStatus }); }}>
              <Icon.Check size={12}/> {I18N[lang].status[nextStatus]} <Kbd>S</Kbd>
            </button>
          )}
          <button className="btn btn-sm"><Icon.Printer size={12}/> {t.actions.printLabel}</button>
          <button className="btn btn-ghost btn-icon btn-sm"><Icon.Ellipsis size={14}/></button>
        </div>

        <div className="drawer-body">
          <div className="detail-section">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <Avatar name={order.customer.en} size={36}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customer[lang]}</div>
                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>+{order.customer.phone.slice(0,3)} {order.customer.phone.slice(3,5)} {order.customer.phone.slice(5,8)} {order.customer.phone.slice(8)}</div>
              </div>
              <button className="btn btn-sm"><Icon.Phone size={12}/> WhatsApp</button>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-label">{lang === 'ar' ? 'البيانات' : 'Properties'}</div>
            <div className="kv-grid">
              <div className="kv-key">{t.detail.piece}</div>
              <div className="kv-val"><Icon.Diamond size={12} stroke="var(--text-muted)"/> &nbsp;{order.piece[lang]} {order.quantity > 1 && <span className="mono text-mute text-xs">&nbsp;×{order.quantity}</span>}</div>

              <div className="kv-key">{t.detail.branch}</div>
              <div className="kv-val">{order.branch[lang]}</div>

              <div className="kv-key">{t.detail.technician}</div>
              <div className="kv-val">
                {!editingTech ? (
                  <div className="inline-edit" onClick={() => setEditingTech(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tech ? <><Avatar name={tech.en} size={18}/> <span>{tech[lang]}</span><span className="text-mute text-xs">· {tech.skill}</span></> : <span className="text-mute">{t.table.unassigned}</span>}
                  </div>
                ) : (
                  <select className="select" style={{ height: 26, fontSize: 12.5 }} autoFocus value={tech?.id || ''}
                    onBlur={() => setEditingTech(false)}
                    onChange={e => { const found = TECHNICIANS.find(x => x.id === e.target.value); setTech(found); setEditingTech(false); }}>
                    <option value="">{t.table.unassigned}</option>
                    {TECHNICIANS.map(x => <option key={x.id} value={x.id}>{x[lang]} — {x.skill}</option>)}
                  </select>
                )}
              </div>

              <div className="kv-key">{t.detail.intakeAt}</div>
              <div className="kv-val mono text-sm">{order.createdAt.toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' })}</div>

              <div className="kv-key">{t.detail.eta}</div>
              <div className="kv-val mono text-sm">{formatDate(order.etaAt, dir)} <span className="text-mute">· {relTime(order.etaAt, dir)}</span></div>

              <div className="kv-key">{t.detail.value}</div>
              <div className="kv-val mono">{formatMoney(order.value, dir)}</div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-label">{t.detail.notes}</div>
            <div style={{ padding: 10, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5 }}>
              {lang === 'ar' ? order.notes_ar : order.notes}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-label">{t.detail.workshopNotes}</div>
            {!editingNote ? (
              <div className="inline-edit" style={{ padding: 10, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, minHeight: 60 }}
                   onClick={() => setEditingNote(true)}>
                {note} <span className="text-mute text-xs">· {lang === 'ar' ? 'انقر للتعديل' : 'click to edit'}</span>
              </div>
            ) : (
              <textarea autoFocus className="textarea" rows={3} value={note} onChange={e => setNote(e.target.value)} onBlur={() => setEditingNote(false)}/>
            )}
          </div>

          <div className="detail-section">
            <div className="detail-section-label">{t.detail.services}</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {order.services.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: i < order.services.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12.5 }}>
                  <span>{lang === 'ar' ? s.name_ar : s.name_en}</span>
                  <span className="mono text-mute" style={{ marginLeft: 'auto' }}>{formatMoney(s.price, dir)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 12.5, fontWeight: 600 }}>
                <span>{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="mono" style={{ marginLeft: 'auto' }}>{formatMoney(order.services.reduce((s, x) => s + x.price, 0), dir)}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-label">{t.detail.history}</div>
            <div className="timeline">
              {timeline.map((h, i) => (
                <div key={i} className="tl-item">
                  <span className={`tl-dot ${i === timeline.length - 1 ? 'current' : 'done'}`}/>
                  <div className="tl-title">{I18N[lang].status[h.status]}</div>
                  <div className="tl-meta mono">{h.at.toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })} · {h.who}</div>
                </div>
              ))}
              {future.map((s, i) => (
                <div key={'f'+i} className="tl-item" style={{ opacity: 0.4 }}>
                  <span className="tl-dot"/>
                  <div className="tl-title">{I18N[lang].status[s]}</div>
                  <div className="tl-meta">{lang === 'ar' ? 'متوقعة' : 'upcoming'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 20, display: 'flex', gap: 12 }}>
            <span><Kbd>esc</Kbd> {lang === 'ar' ? 'إغلاق' : 'close'}</span>
            <span><Kbd>S</Kbd> {lang === 'ar' ? 'تقدّم الحالة' : 'advance status'}</span>
            <span><Kbd>E</Kbd> {lang === 'ar' ? 'تعديل' : 'edit note'}</span>
            <span><Kbd>P</Kbd> {lang === 'ar' ? 'طباعة' : 'print'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { OrderDetail });
