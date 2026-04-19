import React from 'react';

export default function SkeletonLoader({ type = 'list', count = 3 }) {
  if (type === 'track') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: 'var(--radius)' }} />
            <div className="skeleton" style={{ width: '140px', height: '24px' }} />
            <div className="skeleton" style={{ width: '100px', height: '14px' }} />
          </div>
          <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '120px', height: '28px' }} />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <div className="skeleton" style={{ width: '70px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '90px', height: '18px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '16px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <React.Fragment key={i}>
                    {i > 1 && <div className="skeleton" style={{ flex: 1, height: '2px' }} />}
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-sm)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'stats') {
    return (
      <div className="grid-stats">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="stat-card card">
            <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '10px' }} />
            <div className="skeleton" style={{ width: '30px', height: '24px' }} />
          </div>
        ))}
      </div>
    );
  }

  // default type = 'list'
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: '10px 14px', borderBottom: i < count - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 36, height: 18 }} />
          <div className="skeleton" style={{ width: 70, height: 18, borderRadius: 99 }} />
          <div className="skeleton" style={{ width: 100, height: 14 }} />
          <div className="skeleton" style={{ flex: 1, height: 14 }} />
          <div className="skeleton" style={{ width: 80, height: 14 }} />
          <div className="skeleton" style={{ width: 60, height: 26, borderRadius: 'var(--radius-sm)' }} />
        </div>
      ))}
    </div>
  );
}
