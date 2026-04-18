function Topbar({ page, lang, setLang, onOpenPalette, onOpenTweaks, onNewOrder }) {
  const t = I18N[lang];
  const crumb = t.crumbs[page] || '';
  const parts = crumb.split(' · ');
  return (
    <div className="topbar">
      <div className="topbar-crumbs">
        <span>{t.brand}</span>
        <span className="sep">/</span>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === parts.length - 1 ? 'current' : ''}>{p}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="topbar-search" onClick={onOpenPalette}>
        <Icon.Search size={14} />
        <span>{t.search}</span>
        <span className="hint"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </div>

      <div className="topbar-actions">
        <button className="btn btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} title="Language">
          <Icon.Globe size={13}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{lang === 'en' ? 'AR' : 'EN'}</span>
        </button>
        <button className="btn btn-icon btn-sm" title="Notifications"><Icon.Bell size={14}/></button>
        <button className="btn btn-sm btn-primary" onClick={onNewOrder}>
          <Icon.Plus size={13}/> {t.actions.newOrder}
          <Kbd>N</Kbd>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Topbar });
