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
          minHeight: '100vh', background: '#F8F9FB', padding: '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start'
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px' }}>
          {/* Header Skeleton */}
          <div style={{ textAlign: 'center', marginBottom: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton" style={{ width: '140px', height: '24px', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ width: '100px', height: '14px', borderRadius: '4px' }}></div>
          </div>

          {/* Box Skeleton */}
          <div style={{
            background: '#FFFFFF', border: '1px solid rgba(201,151,58,0.15)', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 16px rgba(27,43,94,0.04)'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '60px', height: '12px', borderRadius: '4px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '120px', height: '28px', borderRadius: '6px' }}></div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div className="skeleton" style={{ width: '70px', height: '12px', borderRadius: '4px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '90px', height: '18px', borderRadius: '4px' }}></div>
            </div>

            {/* Dots Skeleton */}
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '80px', height: '12px', borderRadius: '4px', marginBottom: '16px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <React.Fragment key={i}>
                    {i > 1 && <div className="skeleton" style={{ flex: 1, height: '2px', background: '#E5E7EB' }}></div>}
                    <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}></div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Alert box skeleton */}
            <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: '8px' }}></div>
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
          display: 'flex', gap: '12px', marginBottom: '24px',
        } : {
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '28px',
        }}
      >
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--gold-border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '8px', ...(isMobile ? { minWidth: '110px', flexShrink: 0 } : {})
          }}>
            <div className="skeleton" style={{ width: '60px', height: '14px', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ width: '30px', height: '28px', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>
    );
  }

  // default type = 'list'
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--gold-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: '14px 16px', borderBottom: i < count - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none' }}>
          {isMobile ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <div className="skeleton" style={{ width: '120px', height: '20px', borderRadius: '4px' }}></div>
                 <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '12px' }}></div>
               </div>
               <div className="skeleton" style={{ width: '180px', height: '16px', borderRadius: '4px' }}></div>
               <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '4px' }}></div>
             </div>
          ) : (
             <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px 120px 130px 140px', gap: '16px', alignItems: 'center' }}>
               <div className="skeleton" style={{ width: '140px', height: '24px', borderRadius: '4px' }}></div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }}></div>
                 <div className="skeleton" style={{ width: '80px', height: '12px', borderRadius: '4px' }}></div>
               </div>
               <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '4px' }}></div>
               <div className="skeleton" style={{ width: '90px', height: '14px', borderRadius: '4px' }}></div>
               <div className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '12px' }}></div>
               <div className="skeleton" style={{ width: '70px', height: '28px', borderRadius: '6px' }}></div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
}
