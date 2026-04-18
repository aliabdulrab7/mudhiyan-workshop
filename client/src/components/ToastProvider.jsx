import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastCtx = createContext(null);

export function useToast() {
  return useContext(ToastCtx);
}

const VARIANT_STYLES = {
  success: { icon: '✓', color: '#16A34A', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
  error:   { icon: '✕', color: '#DC2626', bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.25)' },
  info:    { icon: 'ℹ', color: '#2980B9', bg: 'rgba(41,128,185,0.10)', border: 'rgba(41,128,185,0.25)' },
};

function ToastItem({ id, text, variant = 'info', onDismiss }) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg"
      style={{
        background: 'var(--bg-raised)',
        border: `1px solid ${v.border}`,
        borderRight: `3px solid ${v.color}`,
        minWidth: '260px',
        maxWidth: 'min(420px, calc(100vw - 32px))',
      }}
    >
      <span
        className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ background: v.bg, color: v.color }}
      >
        {v.icon}
      </span>
      <span className="flex-1 text-sm font-medium text-text leading-snug">{text}</span>
      <button
        onClick={() => onDismiss(id)}
        className="text-text-faint hover:text-text transition-colors text-base leading-none flex-shrink-0 mt-0.5"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >×</button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, text, variant }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="fixed top-4 z-[400] flex flex-col gap-2 items-center"
        style={{ left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem {...t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
