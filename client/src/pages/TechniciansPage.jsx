import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTechnicians, createTechnician } from '../api/technicians';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>الفنيون</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            إدارة فنيي الورشة وتخصصاتهم
          </p>
        </div>
        {!showForm && (
          <button className="btn-gold" onClick={handleShowForm}>✦ إضافة فني</button>
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
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>
              إضافة فني جديد
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
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
                <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn-gold" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? '...' : '✦ حفظ'}
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
        <div style={{ color: '#FCA5A5', fontSize: '0.88rem', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Technicians list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>
      ) : technicians.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          لا يوجد فنيون مسجلون
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AnimatePresence>
            {technicians.map((tech, idx) => (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--gold-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {/* Technician icon */}
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: 'rgba(201,151,58,0.1)',
                    border: '1px solid var(--gold-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', color: 'var(--gold)', flexShrink: 0,
                  }}>
                    ✦
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                      {tech.specialization}
                    </div>
                    {tech.username && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        اسم المستخدم:{' '}
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)' }}>
                          {tech.username}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                      #{tech.id}
                    </div>
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
