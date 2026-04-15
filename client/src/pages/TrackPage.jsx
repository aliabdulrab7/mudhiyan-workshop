import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTrackOrder, approveOrder, rejectOrder } from '../api/orders';
import SkeletonLoader from '../components/SkeletonLoader';

// Customer-facing progress steps (simplified from 9-stage internal workflow)
const STEPS = ['received', 'diagnosing', 'in_repair', 'ready_for_pickup', 'delivered'];

const STEP_LABELS = {
  received:         'استُلم',
  diagnosing:       'قيد الفحص',
  in_repair:        'قيد التنفيذ',
  ready_for_pickup: 'جاهز',
  delivered:        'سُلِّم',
};

const STEP_COLORS = {
  received:         '#2980B9',
  diagnosing:       '#D97706',
  in_repair:        '#1A6EA0',
  ready_for_pickup: '#16A34A',
  delivered:        '#7C3AED',
};

// Map all 9 backend statuses to a progress step position
const STATUS_TO_STEP = {
  received:         'received',
  diagnosing:       'diagnosing',
  waiting_approval: 'diagnosing',  // diagnosis done, awaiting customer
  approved:         'in_repair',
  rejected:         null,          // terminal — shown separately
  in_repair:        'in_repair',
  quality_check:    'in_repair',   // internal QC, customer sees "in repair"
  ready_for_pickup: 'ready_for_pickup',
  delivered:        'delivered',
  closed:           'delivered',
  cancelled:        null,          // terminal — shown separately
};

const STATUS_MESSAGES = {
  received:         'تم استلام قطعتك، سيتم تقييمها قريباً',
  diagnosing:       'جارٍ فحص قطعتك وتقييمها',
  waiting_approval: 'يرجى الموافقة على تكلفة الإصلاح أدناه',
  approved:         'تمت الموافقة، بدأ التنفيذ',
  in_repair:        'قطعتك قيد التنفيذ',
  quality_check:    'قطعتك قيد التنفيذ',
  ready_for_pickup: '✓ قطعتك جاهزة للاستلام!',
  delivered:        'تم التسليم، شكراً لثقتك',
  closed:           'تم التسليم، شكراً لثقتك',
  rejected:         'تم رفض الطلب',
  cancelled:        'تم إلغاء الطلب',
};

// Statuses that are still in-progress (keep auto-refreshing)
const ACTIVE_STATUSES = new Set([
  'received', 'diagnosing', 'waiting_approval', 'approved',
  'in_repair', 'quality_check',
]);

export default function TrackPage() {
  const { token } = useParams();
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [approved,    setApproved]    = useState(false);
  const [rejecting,   setRejecting]   = useState(false);
  const [rejected,    setRejected]    = useState(false);
  const [rejectError, setRejectError] = useState(null);

  useEffect(() => {
    let timeoutId;
    function fetchOrder() {
      getTrackOrder(token)
        .then(data => {
          setOrder(data);
          if (data && ACTIVE_STATUSES.has(data.status)) {
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
      setOrder(prev => ({ ...prev, status: 'in_repair' }));
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    setRejectError(null);
    try {
      await rejectOrder(token);
      setRejected(true);
      setOrder(prev => ({ ...prev, status: 'rejected' }));
    } catch (e) {
      console.error(e);
      setRejectError('حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setRejecting(false);
    }
  }

  if (loading) return <SkeletonLoader type="track" />;

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', padding: '20px' }}>
      <div style={{ textAlign: 'center', fontFamily: 'Almarai, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.2, color: '#2980B9' }}>◈</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#222222', marginBottom: '8px' }}>الطلب غير موجود</div>
        <div style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>تأكد من الرابط أو المسح مجدداً</div>
      </div>
    </div>
  );

  const stepKey    = STATUS_TO_STEP[order.status] ?? 'received';
  const activeColor = STEP_COLORS[stepKey] || '#2980B9';
  const currentIdx  = STEPS.indexOf(stepKey);
  const isTerminal  = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        minHeight: '100vh',
        background: '#F3F4F6',
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
      {/* Subtle background glow */}
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
              background: 'rgba(41,128,185,0.08)',
              border: '1px solid rgba(41,128,185,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '1.2rem',
              color: '#2980B9',
            }}
          >
            ◈
          </motion.div>
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #2980B9, #1A6EA0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '4px',
          }}>
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>إدارة صيانة المجوهرات</div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}
        >
          {/* Order number + piece type */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '6px' }}>رقم الطلب</div>
            <span className="order-stamp" style={{ fontSize: '0.88rem', padding: '5px 14px' }}>
              {order.tracking_number}
            </span>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '4px' }}>نوع القطعة</div>
            <div style={{ fontWeight: 600, color: '#222222' }}>{order.piece_type}</div>
          </div>

          {/* Progress tracker — hidden for terminal statuses */}
          {!isTerminal && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '14px' }}>مراحل الطلب</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {STEPS.map((step, i) => {
                  const completed = i < currentIdx;
                  const active    = i === currentIdx;
                  const stepColor = STEP_COLORS[step] || '#2980B9';
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
                            background: completed ? stepColor : '#E5E7EB',
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
                          background: completed ? stepColor : active ? `${stepColor}15` : '#F3F4F6',
                          border: active ? `2px solid ${stepColor}` : completed ? 'none' : '1px solid #E5E7EB',
                          color: completed ? '#FFFFFF' : active ? stepColor : '#9CA3AF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          ...(active ? { boxShadow: `0 0 12px ${stepColor}30` } : {}),
                        }}
                      >
                        {completed ? '✓' : i + 1}
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={{ display: 'flex', marginTop: '10px' }}>
                {STEPS.map((step, i) => (
                  <div key={step} style={{
                    flex: i === 0 ? '0 0 32px' : 1,
                    fontSize: '0.55rem',
                    color: step === stepKey ? (STEP_COLORS[step] || '#222222') : '#9CA3AF',
                    fontWeight: step === stepKey ? 700 : 400,
                    textAlign: i === 0 ? 'right' : i === STEPS.length - 1 ? 'left' : 'center',
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
          )}

          {/* Status message */}
          <motion.div
            key={order.status}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              background: order.status === 'ready_for_pickup' ? 'rgba(22,163,74,0.06)'
                        : order.status === 'cancelled'       ? 'rgba(107,114,128,0.06)'
                        : order.status === 'rejected'        ? 'rgba(220,38,38,0.06)'
                        : `${activeColor}08`,
              border: `1px solid ${
                order.status === 'ready_for_pickup' ? 'rgba(22,163,74,0.20)'
                : order.status === 'cancelled'      ? 'rgba(107,114,128,0.20)'
                : order.status === 'rejected'       ? 'rgba(220,38,38,0.20)'
                : `${activeColor}20`
              }`,
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: order.status === 'waiting_approval' ? '18px' : '0',
              color: order.status === 'ready_for_pickup' ? '#16A34A'
                   : order.status === 'cancelled'        ? '#6B7280'
                   : order.status === 'rejected'         ? '#DC2626'
                   : activeColor,
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            {STATUS_MESSAGES[order.status] ?? order.status_label}
          </motion.div>

          {/* Cost approval — only when waiting_approval and not yet acted */}
          {order.status === 'waiting_approval' && !approved && !rejected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(217,119,6,0.05)',
                border: '1px solid rgba(217,119,6,0.20)',
                borderRadius: '14px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#D97706', marginBottom: '6px' }}>رسوم الإصلاح</div>
              <div style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #D97706, #B45309)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '18px',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {order.estimated_cost} <span style={{ fontSize: '0.9rem' }}>ريال</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <motion.button
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, #D97706, #B45309)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    fontFamily: 'Almarai, sans-serif',
                    cursor: (approving || rejecting) ? 'not-allowed' : 'pointer',
                    opacity: (approving || rejecting) ? 0.6 : 1,
                    boxShadow: '0 4px 16px rgba(217,119,6,0.25)',
                  }}
                >
                  {approving ? '...' : 'أوافق على السعر'}
                </motion.button>
                <motion.button
                  onClick={handleReject}
                  disabled={approving || rejecting}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    fontFamily: 'Almarai, sans-serif',
                    cursor: (approving || rejecting) ? 'not-allowed' : 'pointer',
                    opacity: (approving || rejecting) ? 0.6 : 1,
                    boxShadow: '0 4px 16px rgba(220,38,38,0.25)',
                  }}
                >
                  {rejecting ? '...' : 'أرفض'}
                </motion.button>
              </div>
              {rejectError && (
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#DC2626', textAlign: 'center' }}>
                  {rejectError}
                </div>
              )}
            </motion.div>
          )}

          {approved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'rgba(22,163,74,0.06)',
                border: '1px solid rgba(22,163,74,0.20)',
                borderRadius: '12px',
                padding: '16px',
                color: '#16A34A',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              ✓ تمت الموافقة، جارٍ التنفيذ
            </motion.div>
          )}

          {rejected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'rgba(220,38,38,0.05)',
                border: '1px solid rgba(220,38,38,0.20)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#DC2626' }}>✕</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#DC2626', marginBottom: '6px' }}>
                تم رفض الطلب
              </div>
              <div style={{ fontSize: '0.85rem', color: '#EF4444', opacity: 0.8 }}>
                سيتواصل معك الفريق قريباً
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '28px', color: '#9CA3AF', fontSize: '0.68rem', opacity: 0.7 }}>
          هذه الصفحة للاستخدام الشخصي فقط
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
}
