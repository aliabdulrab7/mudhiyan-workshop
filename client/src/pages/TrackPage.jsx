import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTrackOrder, approveOrder } from '../api/orders';
import SkeletonLoader from '../components/SkeletonLoader';

const STEPS_ALL = ['received', 'pending_approval', 'in_progress', 'ready', 'delivered'];
const STEPS_NO_APPROVAL = ['received', 'in_progress', 'ready', 'delivered'];

const STEP_LABELS = {
  received:         'استُلم',
  pending_approval: 'بانتظار الموافقة',
  in_progress:      'قيد التنفيذ',
  ready:            'جاهز',
  delivered:        'سُلِّم',
};

const STEP_COLORS = {
  received: '#818CF8',
  pending_approval: '#FBBF24',
  in_progress: '#60A5FA',
  ready: '#34D399',
  delivered: '#A78BFA',
};

const STATUS_MESSAGES = {
  received:         'تم استلام قطعتك، سيتم تقييمها قريباً',
  pending_approval: 'يرجى الموافقة على تكلفة الإصلاح أدناه',
  in_progress:      'قطعتك قيد التنفيذ',
  ready:            '✓ قطعتك جاهزة للاستلام!',
  delivered:        'تم التسليم، شكراً لثقتك',
};

export default function TrackPage() {
  const { token } = useParams();
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved,  setApproved]  = useState(false);

  useEffect(() => {
    let timeoutId;
    function fetchOrder() {
      getTrackOrder(token)
        .then(data => {
          setOrder(data);
          if (data && ['received', 'pending_approval', 'in_progress'].includes(data.status)) {
            timeoutId = setTimeout(fetchOrder, 10000);
          }
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }
    fetchOrder();
    return () => clearTimeout(timeoutId);
  }, [token]);

  async function handleApprove() {
    setApproving(true);
    try {
      await approveOrder(token);
      setApproved(true);
      setOrder(prev => ({ ...prev, status: 'in_progress' }));
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <SkeletonLoader type="track" />;

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B0F1A', padding: '20px' }}>
      <div style={{ textAlign: 'center', fontFamily: 'Almarai, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.2, color: 'var(--gold)' }}>◈</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>الطلب غير موجود</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>تأكد من الرابط أو المسح مجدداً</div>
      </div>
    </div>
  );

  const activeColor = STEP_COLORS[order.status] || '#D4A843';
  const usePendingStep = order.status === 'pending_approval' ||
    STEPS_ALL.indexOf(order.status) > STEPS_ALL.indexOf('pending_approval');
  const steps = usePendingStep ? STEPS_ALL : STEPS_NO_APPROVAL;
  const currentIdx = steps.indexOf(order.status);

  return (
    <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        minHeight: '100vh',
        background: '#0B0F1A',
        fontFamily: 'Almarai, sans-serif',
        direction: 'rtl',
        padding: '24px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow tied to current status */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        right: '50%',
        transform: 'translateX(50%)',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${activeColor}08 0%, transparent 60%)`,
        pointerEvents: 'none',
        filter: 'blur(60px)',
      }} />

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(212,168,67,0.08)',
              border: '1px solid rgba(212,168,67,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '1.2rem',
              color: 'var(--gold)',
            }}
          >
            ◈
          </motion.div>
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '4px',
          }}>
            مصنع المضيان
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>إدارة صيانة المجوهرات</div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            background: 'rgba(17,24,42,0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
          }}
        >
          {/* Order number + piece type */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>رقم الطلب</div>
            <span className="order-stamp" style={{ fontSize: '0.88rem', padding: '5px 14px' }}>
              {order.order_number}
            </span>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>نوع القطعة</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.piece_type}</div>
          </div>

          {/* Progress tracker */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px' }}>مراحل الطلب</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {steps.map((step, i) => {
                const completed = i < currentIdx;
                const active    = i === currentIdx;
                const stepColor = STEP_COLORS[step] || '#D4A843';
                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        style={{
                          flex: 1,
                          height: '2px',
                          background: completed ? stepColor : 'rgba(255,255,255,0.06)',
                          transformOrigin: 'right',
                        }}
                      />
                    )}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 200 }}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: completed ? stepColor : active ? `${stepColor}20` : 'rgba(255,255,255,0.04)',
                        border: active ? `2px solid ${stepColor}` : completed ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        color: (completed || active) ? (completed ? '#0B0F1A' : stepColor) : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        ...(active ? { boxShadow: `0 0 16px ${stepColor}20` } : {}),
                      }}
                    >
                      {completed ? '✓' : i + 1}
                    </motion.div>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ display: 'flex', marginTop: '10px' }}>
              {steps.map((step, i) => (
                <div key={step} style={{
                  flex: i === 0 ? '0 0 32px' : 1,
                  fontSize: '0.55rem',
                  color: step === order.status ? (STEP_COLORS[step] || 'var(--text-primary)') : 'var(--text-muted)',
                  fontWeight: step === order.status ? 700 : 400,
                  textAlign: i === 0 ? 'right' : i === steps.length - 1 ? 'left' : 'center',
                  marginLeft: i > 0 ? '-14px' : 0,
                  marginRight: i > 0 ? '-14px' : 0,
                  paddingLeft: i > 0 ? '14px' : 0,
                  paddingRight: i > 0 ? '14px' : 0,
                }}>
                  {STEP_LABELS[step]}
                </div>
              ))}
            </div>
          </div>

          {/* Status message */}
          <motion.div
            key={order.status}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              background: order.status === 'ready' ? 'rgba(52,211,153,0.08)' : `${activeColor}08`,
              border: `1px solid ${order.status === 'ready' ? 'rgba(52,211,153,0.15)' : `${activeColor}15`}`,
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: order.status === 'pending_approval' ? '18px' : '0',
              color: order.status === 'ready' ? '#34D399' : activeColor,
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            {STATUS_MESSAGES[order.status]}
          </motion.div>

          {/* Cost approval */}
          {order.status === 'pending_approval' && !approved && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: '14px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#FBBF24', marginBottom: '6px' }}>رسوم الإصلاح</div>
              <div style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '18px',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {order.cost} <span style={{ fontSize: '0.9rem' }}>ريال</span>
              </div>
              <motion.button
                onClick={handleApprove}
                disabled={approving}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: 'linear-gradient(135deg, #FBBF24, #D97706)',
                  color: '#0B0F1A',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: 'Almarai, sans-serif',
                  cursor: approving ? 'not-allowed' : 'pointer',
                  opacity: approving ? 0.6 : 1,
                  boxShadow: '0 4px 20px rgba(245,158,11,0.2)',
                }}
              >
                {approving ? '...' : 'أوافق على السعر'}
              </motion.button>
            </motion.div>
          )}

          {approved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.15)',
                borderRadius: '12px',
                padding: '16px',
                color: '#34D399',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              ✓ تمت الموافقة، جارٍ التنفيذ
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '28px', color: 'var(--text-muted)', fontSize: '0.68rem', opacity: 0.6 }}>
          هذه الصفحة للاستخدام الشخصي فقط
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
}
