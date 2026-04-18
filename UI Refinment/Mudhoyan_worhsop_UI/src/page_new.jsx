// New order intake form
function NewOrderPage({ lang, onCancel, onSave }) {
  const t = I18N[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [customer, setCustomer] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [branch, setBranch] = React.useState(BRANCHES[0].id);
  const [items, setItems] = React.useState([
    { piece: 'Ring', qty: 1, notes: '', issue: '' }
  ]);

  function updateItem(i, k, v) {
    setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }
  function addItem() {
    setItems(arr => [...arr, { piece: 'Ring', qty: 1, notes: '', issue: '' }]);
  }
  function removeItem(i) {
    if (items.length === 1) return;
    setItems(arr => arr.filter((_, idx) => idx !== i));
  }

  const pieceOpts = PIECES.map(p => p[lang === 'ar' ? 'ar' : 'en']);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t.sidebar.newOrder}</h1>
          <div className="page-sub">{lang === 'ar' ? 'أنشئ طلب صيانة جديد — سيُرسَل رقم تتبّع للعميل تلقائيًا' : 'Create a new repair intake — customer gets a tracking link automatically'}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={onCancel}>{lang === 'ar' ? 'إلغاء' : 'Cancel'} <Kbd>esc</Kbd></button>
          <button className="btn btn-sm btn-primary" onClick={onSave}><Icon.Check size={12}/> {lang === 'ar' ? 'حفظ الطلب' : 'Save intake'} <Kbd>⌘</Kbd><Kbd>S</Kbd></button>
        </div>
      </div>

      <div className="form-wrap">
        <div className="form-card">
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div>
              <label className="field-label">{lang === 'ar' ? 'اسم العميل' : 'Customer name'}</label>
              <input className="input" placeholder={lang === 'ar' ? 'محمد العتيبي' : 'Mohammed Al-Otaibi'} value={customer} onChange={e => setCustomer(e.target.value)}/>
            </div>
            <div>
              <label className="field-label">{lang === 'ar' ? 'رقم الجوال' : 'Phone'}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="input mono" style={{ width: 66, display: 'grid', placeItems: 'center', background: 'var(--bg-soft)', color: 'var(--text-muted)', flexShrink: 0 }}>+966</span>
                <input className="input mono" placeholder="5XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}/>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">{lang === 'ar' ? 'الفرع المُستلِم' : 'Receiving branch'}</label>
            <select className="select" value={branch} onChange={e => setBranch(e.target.value)}>
              {BRANCHES.map(b => <option key={b.id} value={b.id}>{b[lang]}</option>)}
            </select>
          </div>

          <label className="field-label">{lang === 'ar' ? 'الأصناف' : 'Items'}</label>
          <div className="items-table">
            <div className="items-thead">
              <span>{lang === 'ar' ? 'النوع' : 'Piece'}</span>
              <span style={{ textAlign: 'center' }}>{lang === 'ar' ? 'عدد' : 'Qty'}</span>
              <span>{lang === 'ar' ? 'ملاحظات الاستلام' : 'Intake notes'}</span>
              <span>{lang === 'ar' ? 'الإصلاح المطلوب *' : 'Repair requested *'}</span>
              <span></span>
            </div>
            {items.map((row, i) => (
              <div key={i} className="items-row">
                <select className="select" value={row.piece} onChange={e => updateItem(i, 'piece', e.target.value)} style={{ height: 30 }}>
                  {pieceOpts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input className="input mono" style={{ textAlign: 'center', height: 30 }} type="number" min="1" value={row.qty} onChange={e => updateItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}/>
                <input className="input" style={{ height: 30 }} placeholder={lang === 'ar' ? 'خدش طفيف، سلسلة تالفة…' : 'light scratch, broken chain…'} value={row.notes} onChange={e => updateItem(i, 'notes', e.target.value)}/>
                <input className="input" style={{ height: 30 }} placeholder={lang === 'ar' ? 'لحام، تلميع، إعادة تحجير…' : 'solder, polish, reset stone…'} value={row.issue} onChange={e => updateItem(i, 'issue', e.target.value)}/>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(i)} disabled={items.length === 1} style={{ opacity: items.length === 1 ? 0.3 : 1 }}><Icon.X size={13}/></button>
              </div>
            ))}
            <button className="items-add" onClick={addItem}>
              <Icon.Plus size={12}/> &nbsp;{lang === 'ar' ? 'إضافة صنف' : 'Add item'}
            </button>
          </div>

          <hr className="hr"/>

          <div style={{ display: 'flex', gap: 10, alignItems: 'start', background: 'var(--bg-soft)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
            <Icon.Sparkle size={14} stroke="var(--primary)"/>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {lang === 'ar'
                ? <>عند الحفظ: سيُرسَل رقم الطلب ورابط التتبّع عبر WhatsApp للعميل، وتُطبع ملصقات لكل صنف تلقائيًا.</>
                : <>On save: customer receives order number + tracking link via WhatsApp, and a sticker is auto-printed for each item.</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewOrderPage });
