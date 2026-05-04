import { useState, useEffect, useRef } from 'react';
import {
  getBranches, createBranch, deleteBranch,
  getUsers, createUser, patchUser, patchUserPassword,
} from '../api/admin';
import { Icons } from '../components/icons';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Dialog from '../components/ui/Dialog';
import Dropdown from '../components/ui/Dropdown';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

function getCurrentUserId() {
  try {
    return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id;
  } catch { return null; }
}

const AVATAR_COLORS = ['#D4A843', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function UserAvatar({ username }) {
  const idx = username ? username.charCodeAt(0) % AVATAR_COLORS.length : 0;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0,
      background: AVATAR_COLORS[idx], display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14,
      fontFamily: 'var(--font-mono)',
    }}>
      {(username || '?')[0].toUpperCase()}
    </div>
  );
}

export default function BranchesPage() {
  const currentUserId = getCurrentUserId();

  // ── Users state ──────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError]     = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm]         = useState({ username: '', password: '' });
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [editingUser, setEditingUser]   = useState(null); // { id, value }
  const [pwdDialog, setPwdDialog]       = useState({ open: false, userId: null, value: '', submitting: false, error: '' });
  const editInputRef                    = useRef(null);

  // ── Branches state ───────────────────────────────────────────
  const [branches, setBranches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm]             = useState({ name: '', username: '', password: '' });

  // ── Data loading ─────────────────────────────────────────────
  async function loadUsers() {
    setUsersLoading(true);
    try { setUsers(await getUsers()); }
    catch (e) { setUsersError(e.message); }
    finally { setUsersLoading(false); }
  }

  async function loadBranches() {
    setLoading(true);
    try { setBranches(await getBranches()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); loadBranches(); }, []);

  useEffect(() => {
    if (editingUser) editInputRef.current?.focus();
  }, [editingUser]);

  // ── User handlers ─────────────────────────────────────────────
  function handleShowUserForm() {
    setUserForm({ username: '', password: '' });
    setUsersError('');
    setShowUserForm(true);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setUserSubmitting(true);
    setUsersError('');
    try {
      await createUser(userForm);
      setShowUserForm(false);
      setUserForm({ username: '', password: '' });
      await loadUsers();
    } catch (e) {
      setUsersError(e.message);
    } finally {
      setUserSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setUsersError('');
    try {
      await patchUser(editingUser.id, { username: editingUser.value });
      setEditingUser(null);
      await loadUsers();
    } catch (e) {
      setUsersError(e.message);
      setEditingUser(null);
    }
  }

  async function handleToggleActive(user) {
    setUsersError('');
    try {
      await patchUser(user.id, { active: user.active ? 0 : 1 });
      await loadUsers();
    } catch (e) {
      setUsersError(e.message);
    }
  }

  async function handleResetPassword() {
    if (!pwdDialog.userId || pwdDialog.value.length < 8) return;
    setPwdDialog(d => ({ ...d, submitting: true, error: '' }));
    try {
      await patchUserPassword(pwdDialog.userId, pwdDialog.value);
      setPwdDialog({ open: false, userId: null, value: '', submitting: false, error: '' });
    } catch (e) {
      setPwdDialog(d => ({ ...d, submitting: false, error: e.message }));
    }
  }

  // ── Branch handlers ───────────────────────────────────────────
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
      await loadBranches();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`هل تريد حذف فرع "${name}"؟ سيتم حذف المستخدم المرتبط به أيضاً.`)) return;
    try { await deleteBranch(id); await loadBranches(); }
    catch (e) { setError(e.message); }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">إدارة الفروع</h1>
          <div className="page-sub">مستخدمو الورشة والفروع المرتبطة بها</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 680 }}>

        {/* ════════ WORKSHOP USERS ════════ */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="field-label" style={{ margin: 0 }}>مستخدمو الورشة</div>
            {!showUserForm && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icons.Plus size={12} />}
                onClick={handleShowUserForm}
                testId="users__add-button"
              >
                إضافة مستخدم
              </Button>
            )}
          </div>

          {/* Add user form */}
          {showUserForm && (
            <Card style={{ padding: '16px 20px', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>إضافة مستخدم ورشة</div>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="اسم المستخدم">
                    <Input
                      mono
                      value={userForm.username}
                      onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="admin2"
                      required
                      testId="users__form__username"
                    />
                  </FormField>
                  <FormField label="كلمة المرور">
                    <Input
                      mono
                      type="password"
                      value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="8 أحرف+"
                      required
                      minLength={8}
                      testId="users__form__password"
                    />
                  </FormField>
                </div>
                {usersError && <Alert variant="danger">{usersError}</Alert>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="primary"
                    type="submit"
                    loading={userSubmitting}
                    className="flex-1 justify-center"
                    testId="users__form__submit"
                  >
                    {userSubmitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => { setShowUserForm(false); setUsersError(''); }}
                    testId="users__form__cancel"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Error outside form */}
          {usersError && !showUserForm && (
            <div style={{ marginBottom: 10 }}>
              <Alert variant="danger">{usersError}</Alert>
            </div>
          )}

          {/* Users list */}
          {usersLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>جاري التحميل...</div>
          ) : users.length === 0 ? (
            <Card style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              لا يوجد مستخدمون للورشة
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {users.map(user => (
                <Card key={user.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <UserAvatar username={user.username} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingUser?.id === user.id ? (
                      <Input
                        ref={editInputRef}
                        mono
                        value={editingUser.value}
                        onChange={e => setEditingUser(u => ({ ...u, value: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  handleSaveEdit();
                          if (e.key === 'Escape') setEditingUser(null);
                        }}
                        size="sm"
                        testId={`users__row__${user.id}__edit-input`}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{user.username}</span>
                        {user.id === currentUserId && (
                          <span style={{
                            fontSize: 10, color: 'var(--primary)',
                            background: 'var(--primary-soft)', border: '1px solid var(--border)',
                            borderRadius: 4, padding: '1px 6px',
                          }}>أنت</span>
                        )}
                        {!user.active && (
                          <span style={{
                            fontSize: 10, color: 'var(--text-muted)',
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            borderRadius: 4, padding: '1px 6px',
                          }}>معطّل</span>
                        )}
                      </div>
                    )}
                  </div>

                  {editingUser?.id === user.id ? (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <Button variant="primary" size="sm" onClick={handleSaveEdit}
                        testId={`users__row__${user.id}__save`}>حفظ</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}
                        testId={`users__row__${user.id}__cancel`}>إلغاء</Button>
                    </div>
                  ) : (
                    <Dropdown
                      align="end"
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Icons.Ellipsis size={14} />}
                          aria-label="خيارات المستخدم"
                          testId={`users__row__${user.id}__menu`}
                        />
                      }
                    >
                      <Dropdown.Item
                        onSelect={() => setEditingUser({ id: user.id, value: user.username })}
                        testId={`users__row__${user.id}__edit`}
                      >
                        تعديل اسم المستخدم
                      </Dropdown.Item>
                      <Dropdown.Item
                        onSelect={() => setPwdDialog({ open: true, userId: user.id, value: '', submitting: false, error: '' })}
                        testId={`users__row__${user.id}__pwd`}
                      >
                        تغيير كلمة المرور
                      </Dropdown.Item>
                      {user.id !== currentUserId && (
                        <>
                          <Dropdown.Separator />
                          <Dropdown.Item
                            destructive={!!user.active}
                            onSelect={() => handleToggleActive(user)}
                            testId={`users__row__${user.id}__toggle`}
                          >
                            {user.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                          </Dropdown.Item>
                        </>
                      )}
                    </Dropdown>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ════════ BRANCHES ════════ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="field-label" style={{ margin: 0 }}>الفروع</div>
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

          {/* Create form */}
          {showForm && (
            <Card style={{ padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>إنشاء فرع جديد</div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FormField label="اسم الفرع">
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="مثال: فرع الرياض"
                    required
                    testId="branches__form__name-input"
                  />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="اسم المستخدم">
                    <Input
                      mono
                      value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="br1"
                      required
                      testId="branches__form__username-input"
                    />
                  </FormField>
                  <FormField label="كلمة المرور">
                    <Input
                      mono
                      type="password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="6 أحرف+"
                      required
                      minLength={6}
                      testId="branches__form__password-input"
                    />
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

      {/* ════════ PASSWORD RESET DIALOG ════════ */}
      <Dialog
        open={pwdDialog.open}
        onClose={() => setPwdDialog(d => ({ ...d, open: false, error: '' }))}
        title="تغيير كلمة المرور"
        size="sm"
        testId="users__pwd-dialog"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="كلمة المرور الجديدة">
            <Input
              mono
              type="password"
              value={pwdDialog.value}
              onChange={e => setPwdDialog(d => ({ ...d, value: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && pwdDialog.value.length >= 8) handleResetPassword(); }}
              placeholder="8 أحرف على الأقل"
              minLength={8}
              testId="users__pwd-dialog__input"
            />
          </FormField>
          {pwdDialog.error && <Alert variant="danger">{pwdDialog.error}</Alert>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setPwdDialog(d => ({ ...d, open: false, error: '' }))}
              testId="users__pwd-dialog__cancel"
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleResetPassword}
              loading={pwdDialog.submitting}
              disabled={pwdDialog.value.length < 8}
              testId="users__pwd-dialog__submit"
            >
              تغيير كلمة المرور
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
