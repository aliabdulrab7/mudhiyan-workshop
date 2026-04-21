// Running list for bulk-scan sessions. Rows are newest-first. A duplicate scan
// doesn't add a row — the existing row's `flashId` ticks and the CSS animation
// plays a red pulse. Pending rows show a grey spinner glyph, success green,
// error red, per spec § UI spec / In-session UI.

const ROW_COLORS = {
  success: {
    left:  'var(--success)',
    bg:    'oklch(0.56 0.13 150 / 0.06)',
    text:  'var(--text)',
    icon:  '✓',
  },
  error: {
    left:  'var(--danger)',
    bg:    'oklch(0.58 0.21 25 / 0.06)',
    text:  'var(--danger)',
    icon:  '✗',
  },
  pending: {
    left:  'var(--text-muted)',
    bg:    'var(--bg-soft)',
    text:  'var(--text-muted)',
    icon:  '…',
  },
};

function formatTime(t) {
  const d = t instanceof Date ? t : new Date(t);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function BulkScanList({ rows }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
        لم يتم مسح أي طلب بعد — ابدأ المسح
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          maxHeight: 480,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid="bulk-scan-list"
      >
        {rows.map((r) => {
          const variant = ROW_COLORS[r.status] || ROW_COLORS.pending;
          return (
            <div
              key={`${r.id}-${r.flashId || 0}`}
              data-flash-id={r.flashId || 0}
              data-testid={`bulk-row-${r.stamp}`}
              data-row-status={r.status}
              className={r.flashId ? 'bulk-row-flash' : ''}
              style={{
                display:        'grid',
                gridTemplateColumns: '28px 1fr auto auto',
                gap:            12,
                padding:        '10px 14px',
                borderBottom:   '1px solid var(--border-faint)',
                borderRight:    `3px solid ${variant.left}`,
                background:     variant.bg,
                fontSize:       13,
                alignItems:     'center',
              }}
            >
              <span style={{ fontWeight: 700, color: variant.left, fontSize: 16, textAlign: 'center' }}>
                {variant.icon}
              </span>
              <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>
                {r.stamp}
              </span>
              <span style={{ color: variant.text, fontWeight: r.status === 'error' ? 700 : 500 }}>
                {r.reason}
              </span>
              <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                {formatTime(r.time)}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes bulk-row-flash {
          0%   { background: oklch(0.58 0.21 25 / 0.30); }
          100% { background: transparent; }
        }
        .bulk-row-flash {
          animation: bulk-row-flash 250ms ease-out;
        }
      `}</style>
    </>
  );
}
