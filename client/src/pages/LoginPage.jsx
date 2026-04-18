import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { login } from '../api/auth';
import { Icons } from '../components/icons';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const navigate = useNavigate();

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
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '40px 32px 32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Icons.Diamond size={22} stroke="#ffffff" sw={2} />
          </div>
          <div style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '4px',
          }}>
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem' }}>
            تسجيل الدخول إلى حسابك
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              fontSize: '0.82rem',
              color: focused === 'user' ? 'var(--primary)' : 'var(--text-soft)',
              display: 'block',
              marginBottom: '8px',
              transition: 'color 0.2s',
            }}>
              اسم المستخدم
            </label>
            <input
              className="input-base"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onFocus={() => setFocused('user')}
              onBlur={() => setFocused(null)}
              required
              autoComplete="username"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
          <div>
            <label style={{
              fontSize: '0.82rem',
              color: focused === 'pass' ? 'var(--primary)' : 'var(--text-soft)',
              display: 'block',
              marginBottom: '8px',
              transition: 'color 0.2s',
            }}>
              كلمة المرور
            </label>
            <input
              className="input-base"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              required
              autoComplete="current-password"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(220,38,38,0.06)',
                border: '1px solid rgba(220,38,38,0.20)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                color: '#DC2626',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className="btn-primary"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 0',
              fontSize: '1rem',
              marginTop: '4px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'pulse-gold 1s infinite', display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />
                جاري الدخول
              </span>
            ) : 'تسجيل الدخول'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
