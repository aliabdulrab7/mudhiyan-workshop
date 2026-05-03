import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRole } from '../api/auth';
import { getSchedulerStatus, runScheduler } from '../api/scheduler';
import { useToast } from '../components/ToastProvider';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import StatusIndicator from '../components/ui/StatusIndicator';

const STATUS_OPTIONS_AR = {
  available: 'متاح',
  busy:      'مشغول',
  off_shift: 'خارج الدوام',
  on_leave:  'في إجازة',
};

export default function SchedulerPage() {
  const navigate = useNavigate();
  const toast = useToast();

  // Redirect shop_employee at the page level.
  useEffect(() => {
    if (getRole() !== 'workshop') navigate('/', { replace: true });
  }, [navigate]);

  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [running, setRunning]         = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getSchedulerStatus();
      setTechnicians(data.technicians ?? []);
      setError('');
    } catch (e) {
      setError(e.message || 'فشل تحميل حالة الجدولة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleRun() {
    setRunning(true);
    try {
      const result = await runScheduler();
      toast?.(`تم التحديث: ${result.updated ?? 0} فني · تخطي: ${result.skipped ?? 0}`, 'success');
      await load();
    } catch (e) {
      toast?.(e.message || 'فشل تشغيل الجدولة', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">الجدولة التلقائية</h1>
          <div className="page-sub">
            {loading ? '…' : `${technicians.length} فني`}
          </div>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            loading={running}
            onClick={handleRun}
            testId="scheduler-page__run-btn"
          >
            تشغيل الآن
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {error && <Alert variant="danger" style={{ marginBottom: 16 }}>{error}</Alert>}

        {!loading && (
          <div
            data-testid="scheduler-page__status-table"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 140px 140px 160px',
                gap: 8,
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-raised)',
              }}
            >
              {['الفني', 'الحالة الحالية', 'المناوبة', 'الإجازة', 'سيتغير إلى'].map((h) => (
                <span key={h} style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  {h}
                </span>
              ))}
            </div>

            {technicians.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                لا يوجد فنيون
              </div>
            ) : (
              technicians.map((t) => (
                <div
                  key={t.id}
                  data-testid={`scheduler-page__tech-row--${t.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 140px 140px 160px',
                    gap: 8,
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                  }}
                >
                  {/* Name */}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</span>

                  {/* Current status */}
                  <span data-testid={`scheduler-page__tech-current-status--${t.id}`}>
                    <StatusIndicator status={t.status} label />
                  </span>

                  {/* Shift */}
                  <span
                    data-testid={`scheduler-page__tech-shift--${t.id}`}
                    style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    dir="ltr"
                  >
                    {t.shift ? `${t.shift.start_time} – ${t.shift.end_time}` : '—'}
                  </span>

                  {/* Leave */}
                  <span
                    data-testid={`scheduler-page__tech-leave--${t.id}`}
                    style={{ fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    {t.leave
                      ? new Date(t.leave.leave_date + 'T00:00:00').toLocaleDateString('ar-SA')
                      : '—'}
                  </span>

                  {/* Would change to */}
                  <span
                    data-testid={`scheduler-page__tech-would-change--${t.id}`}
                    style={{ fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    {t.would_change_to ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>←</span>
                        <StatusIndicator status={t.would_change_to} label />
                      </span>
                    ) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
