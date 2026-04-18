import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBranches, createBranch, deleteBranch } from '../api/admin';
import { Icons } from '../components/icons';

export default function BranchesPage() {
  const [branches, setBranches]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [form, setForm]           = useState({ name: '', username: '', password: '' });

  async function load() {
    setLoading(true);
    try { setBranches(await getBranches()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleShowForm() {
    const next = `BR${branches.length + 1}`;
    setForm({ name: next, username: next.toLowerCase(), password: '' });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createBranch(form);
      setShowForm(false);
      setForm({ name: '', username: '', password: '' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`هل تريد حذف فرع "${name}"؟ سيتم حذف المستخدم المرتبط به أيضاً.`)) return;
    try {
      await deleteBranch(id);
      await load();
    } catch (e) {
      setError(e.message);
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
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>إدارة الفروع</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            كل فرع يحصل على حساب دخول مستقل
          </p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={handleShowForm}>+ فرع جديد</button>
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
              إنشاء فرع جديد
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '8px' }}>
                  اسم الفرع
                </label>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: BR1 أو فرع الرياض"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '8px' }}>
                    اسم المستخدم
                  </label>
                  <input
                    className="input-base"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="br1"
                    required
                    style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '8px' }}>
                    كلمة المرور
                  </label>
                  <input
                    className="input-base"
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="6 أحرف+"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.88rem', padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button className="btn-primary" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? '...' : 'إنشاء الفرع'}
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

      {/* Branches list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>
      ) : branches.length === 0 ? (
        <div style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '60px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          لا توجد فروع بعد — أنشئ أول فرع
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AnimatePresence>
            {branches.map((branch, idx) => (
              <motion.div
                key={branch.id}
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
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-soft)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icons.Branch size={18} stroke="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.97rem' }}>
                      {branch.name}
                    </div>
                    {branch.username && (
                      <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        مستخدم:{' '}
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>
                          {branch.username}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="btn-ghost-sm"
                  onClick={() => handleDelete(branch.id, branch.name)}
                  style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.25)', padding: '6px 16px' }}
                >
                  حذف
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
