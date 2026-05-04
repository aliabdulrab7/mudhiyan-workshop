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

const REFRESH_MS = 60_000;

const STATUS_META = [
  { value: 'available', label: 'متاح',         color: 'var(--success)' },
  { value: 'busy',      label: 'مشغول',        color: 'var(--warning)' },
  { value: 'off_shift', label: 'خارج الدوام', color: 'var(--text-faint)' },
  { value: 'on_leave',  label: 'في إجازة',     color: 'var(--danger)' },
];

function TechCard({ tech, onClick }) {
  return (
    <Card
      as="button"
      padding="md"
      variant="raised"
      onClick={onClick}
      data-testid={`control-tower__card--${tech.id}`}
      className="w-full text-start transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={tech.name}>
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

      <div style={{ marginBottom: (tech.specializations?.length || tech.current_item) ? 8 : 0 }}>
        <StatusIndicator status={tech.status} label />
      </div>

      {tech.specializations?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tech.current_item ? 8 : 0 }}>
          {tech.specializations.map((s) => (
            <span key={s.id} style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 3,
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}>
              {s.display_label_ar || s.value}
            </span>
          ))}
        </div>
      )}

      {tech.current_item && (
        <div style={{
          fontSize: 11, color: 'var(--text-faint)',
          display: 'flex', alignItems: 'center', gap: 4,
          paddingTop: 8, borderTop: '1px solid var(--border)',
        }}>
          <Icons.Bolt size={10} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {tech.current_item.item_name || '—'}
          </span>
          <span className="font-mono" style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-muted)' }} dir="ltr">
            {tech.current_item.order_number}
          </span>
        </div>
      )}
    </Card>
  );
}

function StatBadge({ label, count, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginInlineStart: 2 }}>{count}</span>
    </div>
  );
}

export default function ControlTowerPage() {
  const [techs, setTechs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [selectedTech, setSelectedTech] = useState(null);
  const [saving, setSaving]             = useState(false);
  const inFlight                        = useRef(false);
  const toast                           = useToast();

  useEffect(() => { document.title = 'Control Tower | مضيان'; }, []);

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
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function handleStatusChange(newStatus, reason) {
    if (!selectedTech) return;
    const prevTechs = techs;
    const techName  = selectedTech.name;
    setTechs((ts) => ts.map((t) => t.id === selectedTech.id ? { ...t, status: newStatus } : t));
    setSelectedTech(null);
    setSaving(true);
    try {
      await changeStatus(selectedTech.id, newStatus, reason);
      toast?.(`تم تغيير حالة ${techName}`, 'success');
      load();
    } catch (e) {
      setTechs(prevTechs);
      toast?.(e.message || 'فشل تغيير الحالة', 'error');
    } finally {
      setSaving(false);
    }
  }

  const statusCounts = STATUS_META.map((s) => ({
    ...s,
    count: techs.filter((t) => t.status === s.value).length,
  }));

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Control Tower</h1>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>جاري الحفظ...</span>}
          <Button variant="ghost" size="sm" icon={<Icons.Refresh size={13} />} onClick={load}
            disabled={loading} testId="control-tower__refresh">
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

        {/* Status summary bar */}
        {techs.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {statusCounts.map((s) => (
              <StatBadge key={s.value} label={s.label} count={s.count} color={s.color} />
            ))}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              marginInlineStart: 'auto',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>الإجمالي</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{techs.length}</span>
            </div>
          </div>
        )}

        {/* Tech grid */}
        {loading && techs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            جاري التحميل...
          </div>
        ) : !loading && techs.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا يوجد فنيون نشطون
          </div>
        ) : (
          <div data-testid="control-tower__grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {techs.map((tech) => (
              <TechCard key={tech.id} tech={tech} onClick={() => setSelectedTech(tech)} />
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
