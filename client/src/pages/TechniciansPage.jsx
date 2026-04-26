import { useState, useEffect } from 'react';
import { getTechnicians, createTechnician } from '../api/technicians';
import { Icons } from '../components/icons';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState({ specialization: '' });

  async function load() {
    setLoading(true);
    try { setTechnicians(await getTechnicians()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createTechnician({ specialization: form.specialization });
      setShowForm(false);
      setForm({ specialization: '' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">الفنيون</h1>
          <div className="page-sub">إدارة فنيي الورشة وتخصصاتهم</div>
        </div>
        <div className="page-actions">
          {!showForm && (
            <Button
              variant="primary"
              size="sm"
              icon={<Icons.Plus size={12} />}
              onClick={() => { setForm({ specialization: '' }); setError(''); setShowForm(true); }}
              testId="technicians__add-button"
            >
              إضافة فني
            </Button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 680 }}>
        {/* Create form */}
        {showForm && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>إضافة فني جديد</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">التخصص</label>
                <Input value={form.specialization}
                  onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                  placeholder="مثال: تصليح ذهب، تركيب أحجار" required autoFocus
                  testId="technicians__form__specialization-input" />
              </div>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 12, padding: '8px 12px', background: 'oklch(0.58 0.21 25 / 0.06)', border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius-sm)' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="primary"
                  type="submit"
                  loading={submitting}
                  className="flex-1 justify-center"
                  testId="technicians__form__submit"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  testId="technicians__form__cancel"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Error outside form */}
        {error && !showForm && (
          <div style={{ color: 'var(--danger)', fontSize: 12.5, padding: '10px 14px', background: 'oklch(0.58 0.21 25 / 0.06)', border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Technicians list */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : technicians.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا يوجد فنيون مسجلون
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {technicians.map(tech => (
              <div key={tech.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-soft)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icons.User size={16} stroke="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{tech.specialization}</div>
                  {tech.username && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      <span className="mono" style={{ color: 'var(--text-faint)' }}>#{tech.id}</span>
                      {' · '}{tech.username}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
