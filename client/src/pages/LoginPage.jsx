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
      background: '#F3F4F6',
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
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          padding: '40px 32px 32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          position: 'relative',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2980B9, #1A6EA0)',
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
            color: '#222222',
            marginBottom: '4px',
          }}>
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>
            تسجيل الدخول إلى حسابك
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              fontSize: '0.82rem',
              color: focused === 'user' ? '#2980B9' : 'var(--text-secondary)',
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
              color: focused === 'pass' ? '#2980B9' : 'var(--text-secondary)',
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
                borderRadius: '10px',
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
