import { useState, useEffect } from 'react';
import { getBranches, createBranch, deleteBranch } from '../api/admin';

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

  // Auto-suggest next branch code when name is empty
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
    <div style={{ padding: '28px', maxWidth: '700px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>إدارة الفروع</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            كل فرع يحصل على حساب دخول مستقل
          </p>
        </div>
        {!showForm && (
          <button className="btn-gold" onClick={handleShowForm}>+ فرع جديد</button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
            إنشاء فرع جديد
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                كلمة المرور
              </label>
              <input
                className="input-base"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="6 أحرف على الأقل"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{ color: '#DC2626', fontSize: '0.85rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-gold" type="submit" disabled={submitting}>
                {submitting ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
              </button>
              <button className="btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error outside form */}
      {error && !showForm && (
        <div style={{ color: '#DC2626', fontSize: '0.85rem', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Branches list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>جاري التحميل...</div>
      ) : branches.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}>
          لا توجد فروع بعد — أنشئ أول فرع
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {branches.map(branch => (
            <div key={branch.id} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Branch icon */}
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: 'rgba(201,151,58,0.1)',
                  border: '1px solid var(--gold-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', color: 'var(--gold)', flexShrink: 0,
                }}>
                  ⊛
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {branch.name}
                  </div>
                  {branch.username && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
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
                style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)', flexShrink: 0 }}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
