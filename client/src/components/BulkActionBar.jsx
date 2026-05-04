import Button from './ui/Button';
import { Icons } from './icons';

// Floating action bar, shown when ≥1 rows are selected.
// Sits at the bottom of the list container (position: sticky).
export default function BulkActionBar({ selectedCount, onClear, onBulkArchive, loading = false }) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: 'var(--bg-raised)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexGrow: 1 }}>
        تم تحديد <strong style={{ color: 'var(--text)' }}>{selectedCount}</strong> عنصر
      </span>
      <Button
        variant="ghost"
        size="sm"
        icon={<Icons.X size={13} />}
        onClick={onClear}
        disabled={loading}
      >
        إلغاء التحديد
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={onBulkArchive}
        loading={loading}
        disabled={selectedCount === 0}
      >
        أرشفة المحدد
      </Button>
    </div>
  );
}
