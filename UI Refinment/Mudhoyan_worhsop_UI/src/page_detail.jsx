// Order detail drawer
function OrderDetail({ order, onClose, lang, onUpdate }) {
  const t = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [editingNote, setEditingNote] = React.useState(false);
  const [note, setNote] = React.useState(order.workshop_notes[lang]);
  const [editingTech, setEditingTech] = React.useState(false);
  const [tech, setTech] = React.useState(order.technician);
  const [status, setStatus] = React.useState(order.status);
  const [printFlash, setPrintFlash] = React.useState(false);
  const noteRef = React.useRef();

  // Keep note in sync when switching orders or language
  React.useEffect(() => {
    setNote(order.workshop_notes[lang]);
    setStatus(order.status);
    setTech(order.technician);
  }, [order.id, lang]);

  // Next status per state machine
  const nextStatus = NEXT_STATUS[status] || null;

  // Build timeline: completed history + upcoming states
  const timeline = order.history.length
    ? order.history
    : [{ status: order.status, at: order.createdAt, who: 'System' }];

  // 2 upcoming states for the "future" preview
  function getFutureStates(curStatus, count) {
    const result = [];
    let cur = NEXT_STATUS[curStatus];
    while (cur && result.length < count) {
      result.push(cur);
      cur = NEXT_STATUS[cur];
    }
    return result;
  }
  const future = status === 'waiting_approval'
    ? ['approved', 'in_repair']           // show expected happy-path
    : getFutureStates(status, 2);

  function advanceStatus() {
    if (!nextStatus) return;
    const updated = { ...order, status: nextStatus };
    setStatus(nextStatus);
    onUpdate(updated);
  }

  function handlePrint() {
    setPrintFlash(true);
    setTimeout(() => setPrintFlash(false), 1200);
    // In production this would trigger Bluetooth print
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

      if (e.key === 'Escape') {
        if (editingNote) { setEditingNote(false); return; }
        if (editingTech) { setEditingTech(false); return; }
        onClose();
        return;
      }

      if (inField) return;

      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        advanceStatus();
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setEditingNote(true);
        setTimeout(() => noteRef.current?.focus(), 50);
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrint();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingNote, editingTech, nextStatus, status, order]);

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
            <button className="btn btn-sm btn-primary" onClick={advanceStatus}>
              <Icon.Check size={12}/> {I18N[lang].status[nextStatus]} <Kbd>S</Kbd>
            </button>
          )}
          {status === 'waiting_approval' && (
            <span className="pill" style={{ color: 'var(--status-waiting)', borderColor: 'color-mix(in oklch, var(--status-waiting) 30%, var(--border))', background: 'color-mix(in oklch, var(--status-waiting) 9%, white)' }}>
              <Icon.Clock size={11}/> {lang === 'ar' ? 'بانتظار العميل' : 'Awaiting customer'}
            </span>
          )}
          <button
            className="btn btn-sm"
            style={printFlash ? { background: 'var(--status-ready)', color: '#fff', borderColor: 'var(--status-ready)' } : {}}
            onClick={handlePrint}
          >
            <Icon.Printer size={12}/> {printFlash ? (lang === 'ar' ? 'جارٍ الطباعة…' : 'Printing…') : t.actions.printLabel} <Kbd>P</Kbd>
          </button>
          <button className="btn btn-ghost btn-icon btn-sm"><Icon.Ellipsis size={14}/></button>
        </div>

        <div className="drawer-body">
          {/* Customer */}
          <div className="detail-section">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <Avatar name={order.customer.en} size={36}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customer[lang]}</div>
                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  +{order.customer.phone.slice(0,3)} {order.customer.phone.slice(3,5)} {order.customer.phone.slice(5,8)} {order.customer.phone.slice(8)}
                </div>
              </div>
              <a
                href={`https://wa.me/${order.customer.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <Icon.Phone size={12}/> WhatsApp <Icon.Arrow size={10}/>
              </a>
            </div>
          </div>

          {/* Properties */}
          <div className="detail-section">
            <div className="detail-section-label">{lang === 'ar' ? 'البيانات' : 'Properties'}</div>
            <div className="kv-grid">
              <div className="kv-key">{t.detail.piece}</div>
              <div className="kv-val">
                <Icon.Diamond size={12} stroke="var(--text-muted)"/> &nbsp;{order.piece[lang]}
                {order.quantity > 1 && <span className="mono text-mute text-xs">&nbsp;×{order.quantity}</span>}
              </div>

              <div className="kv-key">{t.detail.branch}</div>
              <div className="kv-val">{order.branch[lang]}</div>

              <div className="kv-key">{t.detail.technician}</div>
              <div className="kv-val">
                {!editingTech ? (
                  <div className="inline-edit" onClick={() => setEditingTech(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tech
                      ? <><Avatar name={tech.en} size={18}/> <span>{tech[lang]}</span><span className="text-mute text-xs">· {tech.skill}</span></>
                      : <span className="text-mute">{t.table.unassigned}</span>
                    }
                  </div>
                ) : (
                  <select className="select" style={{ height: 26, fontSize: 12.5 }} autoFocus value={tech?.id || ''}
                    onBlur={() => setEditingTech(false)}
                    onChange={e => { const found = TECHNICIANS.find(x => x.id === e.target.value); setTech(found || null); setEditingTech(false); }}>
                    <option value="">{t.table.unassigned}</option>
                    {TECHNICIANS.map(x => <option key={x.id} value={x.id}>{x[lang]} — {x.skill}</option>)}
                  </select>
                )}
              </div>

              <div className="kv-key">{t.detail.intakeAt}</div>
              <div className="kv-val mono text-sm">
                {order.createdAt.toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>

              <div className="kv-key">{t.detail.eta}</div>
              <div className="kv-val mono text-sm">
                {formatDate(order.etaAt, dir)} <span className="text-mute">· {relTime(order.etaAt, dir)}</span>
              </div>

              <div className="kv-key">{t.detail.value}</div>
              <div className="kv-val mono">{formatMoney(order.value, dir)}</div>
            </div>
          </div>

          {/* Intake notes */}
          <div className="detail-section">
            <div className="detail-section-label">{t.detail.notes}</div>
            <div style={{ padding: 10, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5 }}>
              {lang === 'ar' ? order.notes_ar : order.notes}
            </div>
          </div>

          {/* Workshop notes — inline editable */}
          <div className="detail-section">
            <div className="detail-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t.detail.workshopNotes}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400 }}><Kbd>E</Kbd> {lang === 'ar' ? 'تعديل' : 'edit'}</span>
            </div>
            {!editingNote ? (
              <div
                className="inline-edit"
                style={{ padding: 10, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, minHeight: 60, cursor: 'text' }}
                onClick={() => { setEditingNote(true); setTimeout(() => noteRef.current?.focus(), 50); }}
              >
                {note} <span className="text-mute text-xs">· {lang === 'ar' ? 'انقر للتعديل' : 'click to edit'}</span>
              </div>
            ) : (
              <textarea
                ref={noteRef}
                autoFocus
                className="textarea"
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={() => setEditingNote(false)}
              />
            )}
          </div>

          {/* Services / costs */}
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
                <span className="mono" style={{ marginLeft: 'auto' }}>
                  {formatMoney(order.services.reduce((acc, x) => acc + x.price, 0), dir)}
                </span>
              </div>
            </div>
          </div>

          {/* Approval status banner */}
          {status === 'waiting_approval' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'start', background: 'color-mix(in oklch, var(--status-waiting) 9%, white)', padding: 12, borderRadius: 6, border: '1px solid color-mix(in oklch, var(--status-waiting) 25%, var(--border))', marginBottom: 20 }}>
              <Icon.Clock size={14} stroke="var(--status-waiting)"/>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ar'
                  ? 'بانتظار موافقة العميل على التسعير عبر رابط QR'
                  : 'Waiting for customer to approve the quote via QR tracking link'}
              </div>
            </div>
          )}
          {status === 'approved' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'start', background: 'color-mix(in oklch, var(--status-approved) 9%, white)', padding: 12, borderRadius: 6, border: '1px solid color-mix(in oklch, var(--status-approved) 25%, var(--border))', marginBottom: 20 }}>
              <Icon.Check size={14} stroke="var(--status-approved)"/>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'وافق العميل على التسعير — يمكن بدء الإصلاح' : 'Customer approved the quote — repair can begin'}
              </div>
            </div>
          )}
          {status === 'rejected' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'start', background: 'color-mix(in oklch, var(--status-rejected) 9%, white)', padding: 12, borderRadius: 6, border: '1px solid color-mix(in oklch, var(--status-rejected) 25%, var(--border))', marginBottom: 20 }}>
              <Icon.Warn size={14} stroke="var(--status-rejected)"/>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'رفض العميل التسعير — يجب إعادة القطعة للفرع دون إصلاح' : 'Customer rejected the quote — item must be returned to branch unrepaired'}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="detail-section">
            <div className="detail-section-label">{t.detail.history}</div>
            <div className="timeline">
              {timeline.map((h, i) => (
                <div key={i} className="tl-item">
                  <span className={`tl-dot ${i === timeline.length - 1 ? 'current' : 'done'}`}/>
                  <div className="tl-title">{I18N[lang].status[h.status] || h.status}</div>
                  <div className="tl-meta mono">
                    {h.at.toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })} · {h.who}
                  </div>
                </div>
              ))}
              {future.map((s, i) => (
                <div key={'f'+i} className="tl-item" style={{ opacity: 0.4 }}>
                  <span className="tl-dot"/>
                  <div className="tl-title">{I18N[lang].status[s] || s}</div>
                  <div className="tl-meta">{lang === 'ar' ? 'متوقعة' : 'upcoming'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard hint */}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span><Kbd>esc</Kbd> {lang === 'ar' ? 'إغلاق' : 'close'}</span>
            {nextStatus && <span><Kbd>S</Kbd> {lang === 'ar' ? 'تقدّم الحالة' : 'advance status'}</span>}
            <span><Kbd>E</Kbd> {lang === 'ar' ? 'تعديل الملاحظة' : 'edit note'}</span>
            <span><Kbd>P</Kbd> {lang === 'ar' ? 'طباعة' : 'print'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { OrderDetail });
