import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getTrackOrder, approveOrder } from '../api/orders';

const STEPS_ALL = ['received', 'pending_approval', 'in_progress', 'ready', 'delivered'];
const STEPS_NO_APPROVAL = ['received', 'in_progress', 'ready', 'delivered'];

const STEP_LABELS = {
  received:         'استُلم',
  pending_approval: 'بانتظار الموافقة',
  in_progress:      'قيد التنفيذ',
  ready:            'جاهز',
  delivered:        'سُلِّم',
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
          // Keep polling if not in terminal states
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FB' }}>
      <div style={{ color: '#9CA3AF', fontFamily: 'Almarai, sans-serif' }}>جاري التحميل...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FB', padding: '20px' }}>
      <div style={{ textAlign: 'center', fontFamily: 'Almarai, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>◈</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827', marginBottom: '8px' }}>الطلب غير موجود</div>
        <div style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>تأكد من الرابط أو المسح مجدداً</div>
      </div>
    </div>
  );

  const usePendingStep = order.status === 'pending_approval' ||
    STEPS_ALL.indexOf(order.status) > STEPS_ALL.indexOf('pending_approval');
  const steps = usePendingStep ? STEPS_ALL : STEPS_NO_APPROVAL;
  const currentIdx = steps.indexOf(order.status);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F9FB',
      fontFamily: 'Almarai, sans-serif',
      direction: 'rtl',
      padding: '24px 16px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1B2B5E', marginBottom: '4px' }}>
            مصنع المضيان
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>إدارة صيانة المجوهرات</div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid rgba(201,151,58,0.25)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 16px rgba(27,43,94,0.06)',
        }}>

          {/* Order number + piece type */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '6px' }}>رقم الطلب</div>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              background: '#EEF2FF',
              border: '1px solid rgba(27,43,94,0.15)',
              borderRadius: '6px',
              padding: '4px 12px',
              color: '#1B2B5E',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}>
              {order.order_number}
            </span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '4px' }}>نوع القطعة</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{order.piece_type}</div>
          </div>

          {/* Progress tracker */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '12px' }}>مراحل الطلب</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {steps.map((step, i) => {
                const completed = i < currentIdx;
                const active    = i === currentIdx;
                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <div style={{ flex: 1, height: '2px', background: completed ? '#C9973A' : '#E5E7EB' }} />
                    )}
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: completed ? '#C9973A' : active ? '#1B2B5E' : '#E5E7EB',
                      color: (completed || active) ? '#FFFFFF' : '#9CA3AF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {completed ? '✓' : i + 1}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ display: 'flex', marginTop: '8px' }}>
              {steps.map((step, i) => (
                <div key={step} style={{
                  flex: i === 0 ? '0 0 28px' : 1,
                  fontSize: '0.58rem',
                  color: step === order.status ? '#1B2B5E' : '#9CA3AF',
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
          <div style={{
            background: order.status === 'ready' ? 'rgba(6,95,70,0.06)' : 'rgba(27,43,94,0.04)',
            border: `1px solid ${order.status === 'ready' ? 'rgba(6,95,70,0.2)' : 'rgba(27,43,94,0.1)'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: order.status === 'pending_approval' ? '16px' : '0',
            color: order.status === 'ready' ? '#065F46' : '#1B2B5E',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}>
            {STATUS_MESSAGES[order.status]}
          </div>

          {/* Cost approval */}
          {order.status === 'pending_approval' && !approved && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid rgba(201,151,58,0.35)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '0.82rem', color: '#92400E', marginBottom: '4px' }}>رسوم الإصلاح</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1B2B5E', marginBottom: '16px' }}>
                {order.cost} ريال سعودي
              </div>
              <button
                onClick={handleApprove}
                disabled={approving}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: '#1B2B5E',
                  color: '#C9973A',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: 'Almarai, sans-serif',
                  cursor: approving ? 'not-allowed' : 'pointer',
                  opacity: approving ? 0.7 : 1,
                  letterSpacing: '0.02em',
                }}
              >
                {approving ? '...' : 'أوافق على السعر'}
              </button>
            </div>
          )}

          {approved && (
            <div style={{
              background: '#ECFDF5',
              border: '1px solid rgba(6,95,70,0.2)',
              borderRadius: '8px',
              padding: '14px',
              color: '#065F46',
              textAlign: 'center',
              fontWeight: 600,
            }}>
              ✓ تمت الموافقة، جارٍ التنفيذ
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#9CA3AF', fontSize: '0.72rem' }}>
          هذه الصفحة للاستخدام الشخصي فقط
        </div>
      </div>
    </div>
  );
}
