import React from 'react';
import { motion } from 'framer-motion';

export default function SkeletonLoader({ type = 'list', count = 3, isMobile = true }) {
  if (type === 'track') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start'
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)' }}></div>
            <div className="skeleton" style={{ width: '140px', height: '24px' }}></div>
            <div className="skeleton" style={{ width: '100px', height: '14px' }}></div>
          </div>
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '120px', height: '28px' }}></div>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <div className="skeleton" style={{ width: '70px', height: '12px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '90px', height: '18px' }}></div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '16px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <React.Fragment key={i}>
                    {i > 1 && <div className="skeleton" style={{ flex: 1, height: '2px' }}></div>}
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-md)' }}></div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (type === 'stats') {
    return (
      <div
        className={isMobile ? 'scroll-row' : ''}
        style={isMobile ? {
          display: 'flex', gap: '10px', marginBottom: '24px',
        } : {
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '28px',
        }}
      >
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: '10px', ...(isMobile ? { minWidth: '120px', flexShrink: 0 } : {})
          }}>
            <div className="skeleton" style={{ width: '60px', height: '14px' }}></div>
            <div className="skeleton" style={{ width: '30px', height: '28px' }}></div>
          </div>
        ))}
      </div>
    );
  }

  // default type = 'list'
  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: '14px 18px', borderBottom: i < count - 1 ? '1px solid var(--border-faint)' : 'none' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ width: '120px', height: '20px' }}></div>
                <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '12px' }}></div>
              </div>
              <div className="skeleton" style={{ width: '180px', height: '16px' }}></div>
              <div className="skeleton" style={{ width: '60%', height: '12px' }}></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px 120px 130px 140px', gap: '16px', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: '140px', height: '24px' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
                <div className="skeleton" style={{ width: '80px', height: '12px' }}></div>
              </div>
              <div className="skeleton" style={{ width: '80px', height: '14px' }}></div>
              <div className="skeleton" style={{ width: '90px', height: '14px' }}></div>
              <div className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '12px' }}></div>
              <div className="skeleton" style={{ width: '70px', height: '28px' }}></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
