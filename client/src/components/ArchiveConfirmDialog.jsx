import { useEffect, useState } from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Icons } from './icons';

// Fetches ref-count when open, shows dependency warning, lets user confirm.
// Archive is never blocked — the count is advisory only.
export default function ArchiveConfirmDialog({
  open,
  onClose,
  onConfirm,
  entityLabel = 'العنصر',
  fetchRefCount,  // async () → { reference_count, referencing_tables }
  confirming = false,
}) {
  const [loading, setLoading]   = useState(false);
  const [refData, setRefData]   = useState(null);
  const [fetchErr, setFetchErr] = useState('');

  useEffect(() => {
    if (!open) { setRefData(null); setFetchErr(''); return; }
    setLoading(true);
    setRefData(null);
    setFetchErr('');
    fetchRefCount()
      .then(setRefData)
      .catch((e) => setFetchErr(e.message || 'فشل جلب بيانات التبعيات'))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = refData?.reference_count ?? 0;
  const tables = refData?.referencing_tables ?? [];

  return (
    <Dialog
      open={open}
      onClose={() => !confirming && onClose()}
      title={`أرشفة ${entityLabel}`}
      size="sm"
    >
      <Dialog.Body>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: 13 }}>
            <Icons.Refresh size={14} className="animate-spin" />
            جاري التحقق من التبعيات...
          </div>
        ) : fetchErr ? (
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{fetchErr}</div>
        ) : count > 0 ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              <Icons.Warn size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                هذا {entityLabel} مرتبط بـ <strong>{count}</strong> {count === 1 ? 'عنصر' : 'عناصر'}. سيُخفى من القوائم لكن لن تُحذف البيانات المرتبطة به.
              </p>
            </div>
            {tables.length > 0 && (
              <ul style={{ margin: '0 0 0 4px', padding: 0, listStyle: 'none', fontSize: 12, color: 'var(--text-muted)' }}>
                {tables.map((t) => (
                  <li key={t.table} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{t.table}</span>
                    <span>{t.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
            سيُخفى {entityLabel} من القوائم الافتراضية ويمكن استعادته لاحقاً.
          </p>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose} disabled={confirming || loading}>
          إلغاء
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          loading={confirming}
          disabled={loading || !!fetchErr}
        >
          أرشفة
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
