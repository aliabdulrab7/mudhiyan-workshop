import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastCtx = createContext(null);

export function useToast() {
  return useContext(ToastCtx);
}

const VARIANT = {
  success: { color: 'var(--success)', bg: 'oklch(0.60 0.15 150 / 0.10)', border: 'oklch(0.60 0.15 150 / 0.25)', icon: '✓' },
  error:   { color: 'var(--danger)',  bg: 'oklch(0.58 0.21 25 / 0.10)',   border: 'oklch(0.58 0.21 25 / 0.25)',  icon: '✕' },
  info:    { color: 'var(--primary)', bg: 'var(--primary-soft)',            border: 'oklch(0.55 0.19 270 / 0.25)', icon: 'ℹ' },
};

function ToastItem({ id, text, variant = 'info', onDismiss }) {
  const v = VARIANT[variant] ?? VARIANT.info;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 4000);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: 'var(--bg-raised)',
      border: `1px solid ${v.border}`,
      borderRight: `3px solid ${v.color}`,
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      minWidth: '240px',
      maxWidth: 'min(400px, calc(100vw - 32px))',
      boxShadow: 'var(--shadow-md)',
      animation: 'fade 0.2s ease',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: v.bg, color: v.color,
        display: 'grid', placeItems: 'center',
        fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
      }}>
        {v.icon}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.45 }}>{text}</span>
      <button
        onClick={() => onDismiss(id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, lineHeight: 1, padding: 0, marginTop: 1 }}
      >×</button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, text, variant }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
