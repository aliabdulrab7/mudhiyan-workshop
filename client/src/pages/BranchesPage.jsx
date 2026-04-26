import { useState, useEffect } from 'react';
import { getBranches, createBranch, deleteBranch } from '../api/admin';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function BranchesPage() {
  const [branches, setBranches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm]             = useState({ name: '', username: '', password: '' });

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
    try { await deleteBranch(id); await load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">إدارة الفروع</h1>
          <div className="page-sub">كل فرع يحصل على حساب دخول مستقل</div>
        </div>
        <div className="page-actions">
          {!showForm && (
            <Button
              variant="primary"
              size="sm"
              icon={<Icons.Plus size={12} />}
              onClick={handleShowForm}
              testId="branches__add-button"
            >
              فرع جديد
            </Button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 680 }}>
        {/* Create form */}
        {showForm && (
          <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>إنشاء فرع جديد</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="اسم الفرع">
                <Input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: فرع الرياض" required
                  testId="branches__form__name-input" />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="اسم المستخدم">
                  <Input mono value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="br1" required
                    testId="branches__form__username-input" />
                </FormField>
                <FormField label="كلمة المرور">
                  <Input mono type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="6 أحرف+" required minLength={6}
                    testId="branches__form__password-input" />
                </FormField>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="primary"
                  type="submit"
                  loading={submitting}
                  className="flex-1 justify-center"
                  testId="branches__form__submit"
                >
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  testId="branches__form__cancel"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Error outside form */}
        {error && !showForm && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {/* Branches list */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
        ) : branches.length === 0 ? (
          <Card style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            لا توجد فروع بعد — أنشئ أول فرع
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {branches.map(branch => (
              <Card key={branch.id} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-soft)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icons.Branch size={16} stroke="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{branch.name}</div>
                  {branch.username && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      مستخدم: <span className="mono" style={{ color: 'var(--primary)' }}>{branch.username}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(branch.id, branch.name)}
                  testId={`branches__row__${branch.id}__delete`}
                >
                  حذف
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
