import { useEffect } from 'react';

export default function Toast({ notifications, onDismiss }) {
  if (!notifications.length) return null;

  return (
    <div style={{
      position: 'fixed', top: '16px', right: '50%', transform: 'translateX(50%)',
      zIndex: 500, display: 'flex', flexDirection: 'column', gap: '8px',
      width: 'min(400px, calc(100vw - 32px))',
    }}>
      {notifications.map(n => (
        <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ notification, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(notification.id), 6000);
    return () => clearTimeout(t);
  }, [notification.id]);

  return (
    <div style={{
      background: 'var(--primary)',
      color: '#fff',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 18px',
      boxShadow: '0 8px 32px rgba(27,43,94,0.35)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      borderRight: '4px solid var(--gold)',
      animation: 'toastIn 0.3s ease',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'rgba(201,151,58,0.2)',
        border: '1px solid var(--gold-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', flexShrink: 0,
      }}>
        ✓
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '2px' }}>
          موافقة عميل جديدة
        </div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>
          وافق <strong style={{ color: '#fff' }}>{notification.customer_name}</strong> على{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)' }}>
            {notification.order_number}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
          fontSize: '1.1rem', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
