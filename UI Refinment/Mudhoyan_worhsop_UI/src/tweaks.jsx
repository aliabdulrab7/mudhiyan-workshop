// Tweaks panel — in-prototype controls
function TweaksPanel({ open, onClose, tweaks, setTweaks }) {
  if (!open) return null;
  const accents = [
    { k: 'indigo', c: 'oklch(0.55 0.19 270)' },
    { k: 'teal',   c: 'oklch(0.58 0.13 195)' },
    { k: 'rose',   c: 'oklch(0.62 0.17 15)' },
    { k: 'amber',  c: 'oklch(0.68 0.15 70)' },
    { k: 'forest', c: 'oklch(0.50 0.12 155)' },
    { k: 'slate',  c: 'oklch(0.30 0.02 260)' },
  ];
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Tweaks</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon.X size={13}/></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <label>Accent color</label>
          <div className="swatch-row">
            {accents.map(a => (
              <span key={a.k} className={`swatch ${tweaks.accent === a.k ? 'on' : ''}`}
                    style={{ background: a.c }}
                    onClick={() => setTweaks({ ...tweaks, accent: a.k, accentColor: a.c })}/>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Density · row height {tweaks.rowH}px</label>
          <input type="range" min="28" max="44" step="2" value={tweaks.rowH} onChange={e => setTweaks({ ...tweaks, rowH: +e.target.value })}/>
        </div>
        <div className="tweak-row">
          <label>Sidebar width {tweaks.sidebarW}px</label>
          <input type="range" min="180" max="280" step="4" value={tweaks.sidebarW} onChange={e => setTweaks({ ...tweaks, sidebarW: +e.target.value })}/>
        </div>
        <div className="tweak-row">
          <label>
            <input type="checkbox" checked={tweaks.monoIds} onChange={e => setTweaks({ ...tweaks, monoIds: e.target.checked })}/>
            &nbsp;Monospace order IDs
          </label>
        </div>
        <div className="tweak-row">
          <label>
            <input type="checkbox" checked={tweaks.zebra} onChange={e => setTweaks({ ...tweaks, zebra: e.target.checked })}/>
            &nbsp;Zebra-stripe rows
          </label>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel });
