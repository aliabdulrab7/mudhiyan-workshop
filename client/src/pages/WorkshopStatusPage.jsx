import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkloadSummary, changeStatus } from '../api/technicians';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import StatusIndicator from '../components/ui/StatusIndicator';
import WorkloadBadge from '../components/ui/WorkloadBadge';
import StatusChangeMenu from '../components/StatusChangeMenu';
import { Icons } from '../components/icons';
import { useToast } from '../components/ToastProvider';

const REFRESH_INTERVAL_MS = 60_000;

function TechCard({ tech, onClick }) {
  return (
    <Card
      as="button"
      padding="md"
      variant="raised"
      onClick={onClick}
      data-testid={`workshop-status__card--${tech.id}`}
      className="w-full text-start transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      style={{ cursor: 'pointer' }}
    >
      {/* Name row + workload */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={tech.name}
          >
            {tech.name}
          </div>
          {tech.role_display_label_ar && (
            <span style={{
              display: 'inline-block', marginTop: 3,
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              padding: '1px 6px', borderRadius: 3,
              background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border)',
            }}>
              {tech.role_display_label_ar}
            </span>
          )}
        </div>
        <WorkloadBadge count={tech.active_count} urgent={tech.urgent_count ?? 0} />
      </div>

      {/* Status */}
      <div style={{ marginBottom: tech.current_item ? 8 : 0 }}>
        <StatusIndicator status={tech.status} label />
      </div>

      {/* Current item */}
      {tech.current_item && (
        <div
          style={{
            fontSize: 11, color: 'var(--text-faint)',
            display: 'flex', alignItems: 'center', gap: 4,
            paddingTop: 8, borderTop: '1px solid var(--border-faint)',
          }}
        >
          <Icons.Bolt size={10} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {tech.current_item.item_name || '—'}
          </span>
          <span
            className="font-mono"
            style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-muted)' }}
            dir="ltr"
          >
            {tech.current_item.order_number}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function WorkshopStatusPage() {
  const [techs, setTechs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [selectedTech, setSelectedTech] = useState(null);
  const [saving, setSaving]             = useState(false);
  const inFlight                        = useRef(false);
  const toast                           = useToast();

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await getWorkloadSummary({ active_only: true });
      setTechs(data.technicians ?? []);
      setError('');
    } catch (e) {
      setError(e.message || 'فشل تحميل بيانات الورشة');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s — inFlight guard prevents storms.
  useEffect(() => {
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function handleStatusChange(newStatus, reason) {
    if (!selectedTech) return;
    const prevTechs = techs;
    const techName  = selectedTech.name;
    // Optimistic update
    setTechs(ts => ts.map(t => t.id === selectedTech.id ? { ...t, status: newStatus } : t));
    setSelectedTech(null);
    setSaving(true);
    try {
      await changeStatus(selectedTech.id, newStatus, reason);
      toast?.(`تم تغيير حالة ${techName}`, 'success');
      load(); // refetch for authoritative state + updated current_item
    } catch (e) {
      setTechs(prevTechs);
      toast?.(e.message || 'فشل تغيير الحالة', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">حالة الورشة</h1>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>جاري الحفظ...</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Icons.Refresh size={13} />}
            onClick={load}
            disabled={loading}
            testId="workshop-status__refresh"
          >
            تحديث
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {error && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {loading && techs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            جاري التحميل...
          </div>
        ) : !loading && techs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا يوجد فنيون نشطون
          </div>
        ) : (
          <div
            data-testid="workshop-status__grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"
          >
            {techs.map(tech => (
              <TechCard
                key={tech.id}
                tech={tech}
                onClick={() => setSelectedTech(tech)}
              />
            ))}
          </div>
        )}
      </div>

      <StatusChangeMenu
        technician={selectedTech}
        open={!!selectedTech}
        onClose={() => setSelectedTech(null)}
        onChange={handleStatusChange}
      />
    </div>
  );
}
