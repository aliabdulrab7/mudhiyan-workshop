import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { login } from '../api/auth';

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
      background: '#0d1117',
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
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '40px 32px 32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 8px 32px rgba(1,4,9,0.6)',
          position: 'relative',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: '#238636',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '1.4rem',
            color: '#ffffff',
          }}>
            ◈
          </div>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#e6edf3',
            marginBottom: '4px',
          }}>
            مصنع المضيان
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>
            تسجيل الدخول إلى حسابك
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              fontSize: '0.82rem',
              color: focused === 'user' ? 'var(--gold)' : 'var(--text-secondary)',
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
              color: focused === 'pass' ? 'var(--gold)' : 'var(--text-secondary)',
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
                background: 'rgba(248,81,73,0.10)',
                border: '1px solid rgba(248,81,73,0.25)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#f85149',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className="btn-gold"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 0',
              fontSize: '1.05rem',
              marginTop: '4px',
              borderRadius: '12px',
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
