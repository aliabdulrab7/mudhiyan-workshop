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
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background ambient effects */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,152,48,0.07) 0%, transparent 60%)',
        pointerEvents: 'none',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        left: '-10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 60%)',
        pointerEvents: 'none',
        filter: 'blur(40px)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(196,152,48,0.20)',
          borderRadius: '20px',
          padding: '48px 36px 40px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(196,152,48,0.04) inset, 0 0 80px rgba(196,152,48,0.04)',
          position: 'relative',
        }}
      >
        {/* Gold accent line at top */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: '20%',
          left: '20%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
          borderRadius: '0 0 4px 4px',
          opacity: 0.6,
        }} />

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Logo mark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.04))',
              border: '1px solid rgba(212,168,67,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '1.6rem',
              color: 'var(--gold)',
            }}
          >
            ◈
          </motion.div>
          <div style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '6px',
          }}>
            مصنع المضيان
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', letterSpacing: '0.02em' }}>
            إدارة صيانة المجوهرات
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
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
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
                <span style={{ animation: 'pulse-gold 1s infinite', display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#1A2035' }} />
                جاري الدخول
              </span>
            ) : 'تسجيل الدخول'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
