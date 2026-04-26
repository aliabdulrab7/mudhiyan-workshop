import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { Icons } from '../components/icons';
import { useToast } from '../components/ToastProvider';
import Button from '../components/ui/Button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    const msg = location.state?.reloginToast;
    if (msg) {
      toast?.(msg, 'info');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, toast, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '340px', padding: '32px 28px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: 'var(--radius)',
            background: 'var(--primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Icons.Diamond size={20} stroke="#ffffff" sw={2} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            تسجيل الدخول إلى حسابك
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="field-label">اسم المستخدم</label>
            <input
              className="input mono"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              data-testid="login__username-input"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
          <div>
            <label className="field-label">كلمة المرور</label>
            <input
              className="input mono"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="login__password-input"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>

          {error && (
            <div style={{
              background: 'oklch(0.58 0.21 25 / 0.06)',
              border: '1px solid oklch(0.58 0.21 25 / 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px', color: 'var(--danger)', fontSize: 12.5,
            }}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            testId="login__submit-button"
            className="w-full justify-center mt-1"
            style={{ height: 38 }}
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}
