import { useState, useEffect, useRef } from 'react';
import {
  getBranches, createBranch, deleteBranch, patchBranchName, patchBranchPassword, getBranchSummary,
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
import { useToast } from '../components/ToastProvider';

const PencilIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const KeyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    <circle cx="7.5" cy="15.5" r="5.5"/>
    <path d="M21 2 13.4 9.57"/>
    <path d="M15.5 6.5 17 8"/>
    <path d="m19 4 1 1"/>
  </svg>
);

const STATUS_LABELS = {
  new: 'جديد', received: 'مستلم', inspection: 'فحص',
  waiting_approval: 'انتظار موافقة', in_repair: 'إصلاح',
  quality_check: 'جودة', ready_for_return: 'جاهز', returned_to_shop: 'بالفرع',
  delivered: 'تم التسليم', rejected: 'مرفوض', cancelled: 'ملغي',
};

const STATUS_COLORS = {
  new: '#6B7280', received: '#3B82F6', inspection: '#8B5CF6',
  waiting_approval: '#F59E0B', in_repair: '#F97316', quality_check: '#06B6D4',
  ready_for_return: '#10B981', returned_to_shop: '#84CC16',
  delivered: '#22C55E', rejected: '#EF4444', cancelled: '#9CA3AF',
};

function SummaryShimmer() {
  return (
    <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 52, flex: 1, borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[90, 130, 100, 120, 95].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 22, width: w, borderRadius: 20 }} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-soft)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

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
  const push = useToast();
  const currentUserId = getCurrentUserId();

  // ── Users state ──────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError]     = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm]         = useState({ username: '', password: '' });
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [pwdDialog, setPwdDialog]       = useState({ open: false, userId: null, value: '', submitting: false, error: '' });
  const editInputRef                    = useRef(null);

  // ── Branches state ───────────────────────────────────────────
  const [branches, setBranches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm]             = useState({ name: '', username: '', password: '' });

  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [editError, setEditError]   = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editRef = useRef(null);

  const [pwDialog, setPwDialog]     = useState({ open: false, branchId: null, branchName: '' });
  const [pwPassword, setPwPassword] = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSaving, setPwSaving]     = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [summaries, setSummaries]   = useState({});

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

  useEffect(() => { document.title = 'الفروع | مضيان'; }, []);
  useEffect(() => { loadUsers(); loadBranches(); }, []);
  useEffect(() => { if (editingId !== null) editRef.current?.focus(); }, [editingId]);
  useEffect(() => { if (editingUser) editInputRef.current?.focus(); }, [editingUser]);

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

  async function handleSaveUserEdit() {
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

  async function handleResetUserPassword() {
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
    try {
      await deleteBranch(id);
      if (expandedId === id) setExpandedId(null);
      await loadBranches();
    } catch (e) { setError(e.message); }
  }

  function startEdit(branch) {
    setEditingId(branch.id);
    setEditName(branch.name);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id) {
    if (!editName.trim()) { setEditError('الاسم مطلوب'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await patchBranchName(id, editName.trim());
      setBranches(bs => bs.map(b => b.id === id ? { ...b, name: editName.trim() } : b));
      setEditingId(null);
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  function openPwDialog(branch) {
    setPwDialog({ open: true, branchId: branch.id, branchName: branch.name });
    setPwPassword('');
    setPwError('');
  }

  function closePwDialog() {
    setPwDialog({ open: false, branchId: null, branchName: '' });
    setPwError('');
  }

  async function handlePwSave() {
    if (pwPassword.length < 8) {
      setPwError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    setPwSaving(true);
    setPwError('');
    try {
      await patchBranchPassword(pwDialog.branchId, pwPassword);
      closePwDialog();
      push('تم تغيير كلمة المرور', 'success');
    } catch (e) {
      setPwError(e.message);
    } finally {
      setPwSaving(false);
    }
  }

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (summaries[id]?.data || summaries[id]?.loading) return;
    setSummaries(s => ({ ...s, [id]: { loading: true, data: null, error: null } }));
    try {
      const data = await getBranchSummary(id);
      setSummaries(s => ({ ...s, [id]: { loading: false, data, error: null } }));
    } catch (e) {
      setSummaries(s => ({ ...s, [id]: { loading: false, data: null, error: e.message } }));
    }
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

          {showUserForm && (
            <Card style={{ padding: '16px 20px', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>إضافة مستخدم ورشة</div>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="اسم المستخدم">
                    <Input mono value={userForm.username}
                      onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="admin2" required testId="users__form__username" />
                  </FormField>
                  <FormField label="كلمة المرور">
                    <Input mono type="password" value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="8 أحرف+" required minLength={8} testId="users__form__password" />
                  </FormField>
                </div>
                {usersError && <Alert variant="danger">{usersError}</Alert>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" type="submit" loading={userSubmitting}
                    className="flex-1 justify-center" testId="users__form__submit">
                    {userSubmitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                  </Button>
                  <Button variant="ghost" type="button"
                    onClick={() => { setShowUserForm(false); setUsersError(''); }}
                    testId="users__form__cancel">
                    إلغاء
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {usersError && !showUserForm && (
            <div style={{ marginBottom: 10 }}>
              <Alert variant="danger">{usersError}</Alert>
            </div>
          )}

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
                          if (e.key === 'Enter')  handleSaveUserEdit();
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
                      <Button variant="primary" size="sm" onClick={handleSaveUserEdit}
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
                      placeholder="br1" required testId="branches__form__username-input" />
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
                  <Button variant="primary" type="submit" loading={submitting}
                    className="flex-1 justify-center" testId="branches__form__submit">
                    {submitting ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
                  </Button>
                  <Button variant="ghost" type="button"
                    onClick={() => { setShowForm(false); setError(''); }}
                    testId="branches__form__cancel">
                    إلغاء
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {error && !showForm && (
            <div style={{ marginBottom: 12 }}>
              <Alert variant="danger">{error}</Alert>
            </div>
          )}

          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>جاري التحميل...</div>
          ) : branches.length === 0 ? (
            <Card style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              لا توجد فروع بعد — أنشئ أول فرع
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {branches.map(branch => {
                const isEditing  = editingId === branch.id;
                const isExpanded = expandedId === branch.id;
                const summary    = summaries[branch.id];

                return (
                  <Card key={branch.id} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        background: 'var(--primary-soft)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Branch size={16} stroke="var(--primary)" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Input
                              ref={editRef}
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(branch.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              size="sm"
                              invalid={!!editError}
                              testId={`branches__row__${branch.id}__edit-input`}
                              style={{ flex: 1 }}
                            />
                            <Button variant="primary" size="sm" loading={editSaving}
                              onClick={() => saveEdit(branch.id)} aria-label="حفظ"
                              testId={`branches__row__${branch.id}__edit-save`}>
                              <Icons.Check size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEdit} aria-label="إلغاء"
                              testId={`branches__row__${branch.id}__edit-cancel`}>
                              <Icons.X size={13} />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {branch.name}
                            </div>
                            {branch.username && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                مستخدم: <span className="mono" style={{ color: 'var(--primary)' }}>{branch.username}</span>
                              </div>
                            )}
                          </>
                        )}
                        {isEditing && editError && (
                          <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>{editError}</div>
                        )}
                      </div>

                      {!isEditing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(branch)}
                            aria-label="تعديل اسم الفرع"
                            testId={`branches__row__${branch.id}__edit-btn`}>
                            <PencilIcon size={14} />
                          </Button>

                          <Dropdown
                            align="end"
                            trigger={
                              <Button variant="ghost" size="sm" aria-label="خيارات إضافية"
                                testId={`branches__row__${branch.id}__menu-btn`}>
                                <Icons.Ellipsis size={14} />
                              </Button>
                            }
                          >
                            <Dropdown.Item icon={<KeyIcon size={14} />}
                              onSelect={() => openPwDialog(branch)}
                              testId={`branches__row__${branch.id}__reset-pw`}>
                              إعادة تعيين كلمة المرور
                            </Dropdown.Item>
                            <Dropdown.Separator />
                            <Dropdown.Item destructive
                              onSelect={() => handleDelete(branch.id, branch.name)}
                              testId={`branches__row__${branch.id}__delete`}>
                              حذف الفرع
                            </Dropdown.Item>
                          </Dropdown>

                          <Button variant="ghost" size="sm"
                            onClick={() => toggleExpand(branch.id)}
                            aria-label={isExpanded ? 'إخفاء الملخص' : 'عرض الملخص'}
                            testId={`branches__row__${branch.id}__expand`}
                            style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                            <Icons.ChevDown size={14} />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      summary?.loading ? (
                        <SummaryShimmer />
                      ) : summary?.error ? (
                        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                          <Alert variant="danger">{summary.error}</Alert>
                        </div>
                      ) : summary?.data ? (
                        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <StatCard label="إجمالي الطلبات" value={summary.data.total ?? 0} />
                            <StatCard label="طلبات مفتوحة" value={summary.data.open ?? 0} accent="var(--primary)" />
                            <StatCard label="اليوم" value={summary.data.today ?? 0} accent="var(--success)" />
                          </div>

                          {summary.data.last_orders?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>آخر الطلبات</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {summary.data.last_orders.map(o => (
                                  <span key={o.order_number} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '3px 8px', borderRadius: 20,
                                    background: 'var(--bg-soft)', border: '1px solid var(--border)',
                                    fontSize: 11.5,
                                  }}>
                                    <span className="mono" style={{ color: 'var(--text)', fontSize: 11 }}>{o.order_number}</span>
                                    <span style={{
                                      padding: '1px 6px', borderRadius: 20, fontSize: 10.5,
                                      background: `${STATUS_COLORS[o.status] ?? '#9CA3AF'}22`,
                                      color: STATUS_COLORS[o.status] ?? '#9CA3AF',
                                      fontWeight: 600,
                                    }}>
                                      {STATUS_LABELS[o.status] ?? o.status}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <a href="/orders"
                            style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', alignSelf: 'flex-start' }}>
                            عرض جميع الطلبات ←
                          </a>
                        </div>
                      ) : null
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Branch password reset dialog */}
      <Dialog
        open={pwDialog.open}
        onClose={closePwDialog}
        title="إعادة تعيين كلمة المرور"
        size="sm"
        testId="branches__pw-dialog"
      >
        <Dialog.Body>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            فرع: <strong style={{ color: 'var(--text)' }}>{pwDialog.branchName}</strong>
          </div>
          <FormField label="كلمة المرور الجديدة">
            <Input
              type="password"
              value={pwPassword}
              onChange={e => { setPwPassword(e.target.value); setPwError(''); }}
              placeholder="كلمة المرور الجديدة"
              onKeyDown={e => e.key === 'Enter' && handlePwSave()}
              invalid={!!pwError}
              testId="branches__pw-dialog__input"
            />
          </FormField>
          {pwError && (
            <div style={{ marginTop: 8 }}>
              <Alert variant="danger">{pwError}</Alert>
            </div>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={closePwDialog} testId="branches__pw-dialog__cancel">
            إلغاء
          </Button>
          <Button variant="primary" loading={pwSaving} onClick={handlePwSave}
            testId="branches__pw-dialog__save">
            حفظ
          </Button>
        </Dialog.Footer>
      </Dialog>

      {/* User password dialog */}
      <Dialog
        open={pwdDialog.open}
        onClose={() => setPwdDialog(d => ({ ...d, open: false, error: '' }))}
        title="تغيير كلمة المرور"
        size="sm"
        testId="users__pwd-dialog"
      >
        <Dialog.Body>
          <FormField label="كلمة المرور الجديدة">
            <Input
              mono
              type="password"
              value={pwdDialog.value}
              onChange={e => setPwdDialog(d => ({ ...d, value: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && pwdDialog.value.length >= 8) handleResetUserPassword(); }}
              placeholder="8 أحرف على الأقل"
              minLength={8}
              testId="users__pwd-dialog__input"
            />
          </FormField>
          {pwdDialog.error && (
            <div style={{ marginTop: 8 }}>
              <Alert variant="danger">{pwdDialog.error}</Alert>
            </div>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost"
            onClick={() => setPwdDialog(d => ({ ...d, open: false, error: '' }))}
            testId="users__pwd-dialog__cancel">
            إلغاء
          </Button>
          <Button variant="primary" onClick={handleResetUserPassword} loading={pwdDialog.submitting}
            disabled={pwdDialog.value.length < 8} testId="users__pwd-dialog__submit">
            تغيير كلمة المرور
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
