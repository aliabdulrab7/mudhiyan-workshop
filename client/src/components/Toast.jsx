import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Toast({ notifications, onDismiss }) {
  if (!notifications.length) return null;

  return (
    <div style={{
      position: 'fixed', top: '16px', right: '50%', transform: 'translateX(50%)',
      zIndex: 500, display: 'flex', flexDirection: 'column', gap: '10px',
      width: 'min(420px, calc(100vw - 32px))',
    }}>
      <AnimatePresence>
        {notifications.map(n => (
          <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ notification, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(notification.id), 6000);
    return () => clearTimeout(t);
  }, [notification.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        background: 'rgba(17,24,42,0.9)',
        backdropFilter: 'blur(24px)',
        color: '#fff',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        borderRight: '3px solid var(--gold)',
      }}
    >
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px',
        background: 'rgba(212,168,67,0.12)',
        border: '1px solid rgba(212,168,67,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', flexShrink: 0, color: 'var(--gold)',
      }}>
        ✓
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '3px' }}>
          موافقة عميل جديدة
        </div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
          وافق <strong style={{ color: '#fff' }}>{notification.customer_name}</strong> على{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)' }}>
            {notification.order_number}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)',
          fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
        onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
      >×</button>
    </motion.div>
  );
}
