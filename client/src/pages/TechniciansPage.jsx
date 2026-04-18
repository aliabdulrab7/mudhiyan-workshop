import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTechnicians, createTechnician } from '../api/technicians';
import { Icons } from '../components/icons';

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

  function handleShowForm() {
    setForm({ specialization: '' });
    setError('');
    setShowForm(true);
  }

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '28px', maxWidth: '700px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>الفنيون</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            إدارة فنيي الورشة وتخصصاتهم
          </p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={handleShowForm}>+ إضافة فني</button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
              إضافة فني جديد
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '8px' }}>
                  التخصص
                </label>
                <input
                  className="input-base"
                  value={form.specialization}
                  onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                  placeholder="مثال: تصليح ذهب، تركيب أحجار"
                  required
                />
              </div>

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn-primary" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? '...' : 'حفظ'}
                </button>
                <button className="btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ flex: 0.5, justifyContent: 'center' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error outside form */}
      {error && !showForm && (
        <div style={{ color: '#DC2626', fontSize: '0.88rem', padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Technicians list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>
      ) : technicians.length === 0 ? (
        <div style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '60px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          لا يوجد فنيون مسجلون
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AnimatePresence>
            {technicians.map((tech, idx) => (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-soft)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icons.User size={18} stroke="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.97rem' }}>
                    {tech.specialization}
                  </div>
                  {tech.username && (
                    <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      اسم المستخدم:{' '}
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>
                        {tech.username}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                    #{tech.id}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
