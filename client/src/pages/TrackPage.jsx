import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTrackOrder, approveOrder, rejectOrder } from '../api/orders';
import SkeletonLoader from '../components/SkeletonLoader';
import { Icons } from '../components/icons';

// 6-stage customer-facing timeline
const STAGES = [
  { key: 'received',         label: 'استُلم' },
  { key: 'inspection',       label: 'الفحص' },
  { key: 'in_repair',        label: 'التنفيذ' },
  { key: 'quality_check',    label: 'الجودة' },
  { key: 'ready_for_return', label: 'جاهز' },
  { key: 'delivered',        label: 'سُلِّم' },
];

// Map all backend statuses to a customer-facing stage
const STATUS_TO_STAGE = {
  new:              'received',
  received:         'received',
  inspection:       'inspection',
  waiting_approval: 'inspection',     // inspection done, awaiting customer
  approved:         'in_repair',
  rejected:         null,             // terminal
  in_repair:        'in_repair',
  quality_check:    'quality_check',
  ready_for_return: 'ready_for_return',
  returned_to_shop: 'ready_for_return', // at branch, still "ready" from customer view
  delivered:        'delivered',
  closed:           'delivered',
  cancelled:        null,             // terminal
};

const STATUS_MESSAGES = {
  new:              'تم إنشاء طلب الصيانة، سيتم استلامه في الورشة قريباً',
  received:         'تم استلام قطعتك في الورشة، سيتم فحصها قريباً',
  inspection:       'جارٍ فحص قطعتك وتقييمها',
  waiting_approval: 'يرجى الموافقة على تكلفة الإصلاح أدناه',
  approved:         'تمت الموافقة، بدأ التنفيذ',
  in_repair:        'قطعتك قيد التنفيذ',
  quality_check:    'قطعتك قيد فحص الجودة النهائي',
  ready_for_return: 'قطعتك جاهزة وفي طريقها للفرع',
  returned_to_shop: '✓ قطعتك جاهزة للاستلام من الفرع!',
  delivered:        'تم التسليم، شكراً لثقتك',
  closed:           'تم التسليم، شكراً لثقتك',
  rejected:         'تم رفض الطلب',
  cancelled:        'تم إلغاء الطلب',
};

// Statuses that keep auto-refreshing
const ACTIVE_STATUSES = new Set([
  'new', 'received', 'inspection', 'waiting_approval', 'approved',
  'in_repair', 'quality_check', 'ready_for_return',
]);

const PRIMARY = '#2980B9';

export default function TrackPage() {
  const { token } = useParams();
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [approving,  setApproving]  = useState(false);
  const [approved,   setApproved]   = useState(false);
  const [rejecting,  setRejecting]  = useState(false);
  const [rejected,   setRejected]   = useState(false);
  const [rejectError,setRejectError] = useState(null);

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
    <div className="min-h-screen flex items-center justify-center bg-bg p-5" dir="rtl" style={{ fontFamily: 'Almarai, sans-serif' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary-ring)] grid place-items-center mx-auto mb-4">
          <Icons.Diamond size={20} stroke={PRIMARY} />
        </div>
        <div className="font-bold text-lg text-text mb-2">الطلب غير موجود</div>
        <div className="text-text-muted text-sm">تأكد من الرابط أو المسح مجدداً</div>
      </div>
    </div>
  );

  const stageKey    = STATUS_TO_STAGE[order.status] ?? 'received';
  const currentIdx  = STAGES.findIndex(s => s.key === stageKey);
  const isTerminal  = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <div className="min-h-screen bg-bg flex justify-center items-start py-6 px-4" dir="rtl" style={{ fontFamily: 'Almarai, sans-serif' }}>
      <div className="w-full" style={{ maxWidth: '480px' }}>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl grid place-items-center mx-auto mb-3" style={{ background: 'var(--primary)', }}>
            <Icons.Diamond size={16} stroke="#fff" sw={2} />
          </div>
          <div className="font-bold text-lg text-text mb-1">مجوهرات سليمان المضيان</div>
          <div className="text-xs text-text-faint">إدارة صيانة المجوهرات</div>
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-bg-raised border border-border rounded-2xl shadow-md overflow-hidden"
        >
          {/* Order header */}
          <div className="px-6 pt-6 pb-5 border-b border-border">
            <div className="text-[10px] text-text-faint uppercase tracking-wider mb-2">رقم الطلب</div>
            <span className="order-stamp text-[0.88rem] px-3.5 py-1.5">{order.tracking_number}</span>
            {order.piece_type && (
              <div className="mt-3">
                <div className="text-[10px] text-text-faint uppercase tracking-wider mb-1">نوع القطعة</div>
                <div className="font-semibold text-text text-sm">{order.piece_type}</div>
              </div>
            )}
          </div>

          {/* 6-stage timeline */}
          {!isTerminal && (
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-start mb-1">
                {/* RTL: start label on right (first item), end label on left (last item) */}
                <span className="text-[10px] text-text-faint flex-1 text-right">بدأ</span>
                <span className="text-[10px] text-text-faint flex-1 text-left">
                  {order.eta ? `متوقّع: ${new Date(order.eta).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}` : 'قيد التنفيذ'}
                </span>
              </div>

              {/* Stage dots + connectors */}
              <div className="flex items-center">
                {STAGES.map((stage, i) => {
                  const done    = i < currentIdx;
                  const current = i === currentIdx;
                  return (
                    <React.Fragment key={stage.key}>
                      {i > 0 && (
                        <div className="flex-1 h-0.5 mx-0.5" style={{ background: done ? PRIMARY : 'var(--border-strong)' }} />
                      )}
                      <div
                        className="flex-shrink-0 grid place-items-center"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: done ? PRIMARY : current ? '#fff' : 'var(--bg-soft)',
                          border: done
                            ? `2px solid ${PRIMARY}`
                            : current
                              ? `2px solid ${PRIMARY}`
                              : '2px solid var(--border-strong)',
                          boxShadow: current ? `0 0 0 4px var(--primary-ring)` : 'none',
                        }}
                      >
                        {done && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6.5 5,9 10,3.5" />
                          </svg>
                        )}
                        {current && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: PRIMARY }} />
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Stage labels */}
              <div className="flex mt-1.5">
                {STAGES.map((stage, i) => (
                  <div
                    key={stage.key}
                    className="text-center"
                    style={{
                      flex: i === 0 || i === STAGES.length - 1 ? '0 0 20px' : 1,
                      fontSize: '0.56rem',
                      color: i === currentIdx ? PRIMARY : 'var(--text-faint)',
                      fontWeight: i === currentIdx ? 700 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {stage.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status message */}
          <div className="px-6 py-4">
            <motion.div
              key={order.status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: order.status === 'returned_to_shop' ? 'rgba(22,163,74,0.06)'
                          : order.status === 'cancelled'        ? 'rgba(107,114,128,0.06)'
                          : order.status === 'rejected'         ? 'rgba(220,38,38,0.06)'
                          : 'var(--primary-soft)',
                border: `1px solid ${
                  order.status === 'returned_to_shop' ? 'rgba(22,163,74,0.20)'
                  : order.status === 'cancelled'      ? 'rgba(107,114,128,0.20)'
                  : order.status === 'rejected'       ? 'rgba(220,38,38,0.20)'
                  : 'var(--primary-ring)'
                }`,
                color: order.status === 'returned_to_shop' ? '#16A34A'
                     : order.status === 'cancelled'        ? '#6B7280'
                     : order.status === 'rejected'         ? '#DC2626'
                     : PRIMARY,
              }}
            >
              {STATUS_MESSAGES[order.status] ?? order.status_label}
            </motion.div>
          </div>

          {/* Item breakdown */}
          {order.items && order.items.length > 0 && (
            <div className="px-6 pb-5 border-t border-border pt-4">
              <div className="text-[10px] text-text-faint uppercase tracking-wider mb-3">الأصناف</div>
              <div className="flex flex-col gap-2">
                {order.items.map((item, i) => (
                  <div key={i} className="bg-bg-soft border border-border rounded-lg px-4 py-3 flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text text-sm">
                        {item.item_name}
                        {item.quantity > 1 && (
                          <span className="text-text-muted font-normal text-xs mr-1">× {item.quantity}</span>
                        )}
                      </div>
                      {item.repair_description && (
                        <div className="text-text-muted text-xs mt-0.5">{item.repair_description}</div>
                      )}
                    </div>
                    {item.estimated_cost > 0 && (
                      <div className="font-mono text-xs font-bold flex-shrink-0" style={{ color: '#D97706' }}>
                        {item.estimated_cost} ر.س
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost approval panel */}
          {order.status === 'waiting_approval' && !approved && !rejected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mb-6 rounded-xl p-5"
              style={{ background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.20)' }}
            >
              <div className="text-xs font-medium mb-3" style={{ color: '#D97706' }}>رسوم الإصلاح</div>

              {/* Per-item breakdown */}
              {order.items && order.items.some(it => it.estimated_cost > 0) && (
                <div className="mb-3 flex flex-col gap-1.5">
                  {order.items.filter(it => it.estimated_cost > 0).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span style={{ color: '#92400E' }}>
                        {item.item_name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
                      </span>
                      <span className="font-mono font-semibold" style={{ color: '#D97706' }}>
                        {item.estimated_cost} ر.س
                      </span>
                    </div>
                  ))}
                  {order.items.filter(it => it.estimated_cost > 0).length > 1 && (
                    <div className="flex justify-between items-center text-xs pt-1.5 border-t" style={{ borderColor: 'rgba(217,119,6,0.20)', color: 'var(--text-muted)' }}>
                      <span>المجموع</span>
                      <span className="font-mono font-bold" style={{ color: '#B45309' }}>{order.estimated_cost} ر.س</span>
                    </div>
                  )}
                </div>
              )}

              <div className="font-mono text-3xl font-bold mb-5" style={{ color: '#D97706' }}>
                {order.estimated_cost} <span className="text-base font-normal">ريال</span>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  className="flex-1 py-3.5 rounded-xl text-white font-bold text-[0.95rem] transition-opacity disabled:opacity-50"
                  style={{ background: '#D97706', fontFamily: 'Almarai, sans-serif' }}
                >
                  {approving ? '...' : 'أوافق على السعر'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={approving || rejecting}
                  className="flex-1 py-3.5 rounded-xl text-white font-bold text-[0.95rem] transition-opacity disabled:opacity-50"
                  style={{ background: '#DC2626', fontFamily: 'Almarai, sans-serif' }}
                >
                  {rejecting ? '...' : 'أرفض'}
                </button>
              </div>
              {rejectError && (
                <div className="mt-2.5 text-xs text-center" style={{ color: '#DC2626' }}>{rejectError}</div>
              )}
            </motion.div>
          )}

          {approved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-6 mb-6 rounded-xl p-4 text-center font-semibold text-sm"
              style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.20)', color: '#16A34A' }}
            >
              ✓ تمت الموافقة، جارٍ التنفيذ
            </motion.div>
          )}

          {rejected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-6 mb-6 rounded-xl p-5 text-center"
              style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.20)' }}
            >
              <div className="text-2xl mb-2" style={{ color: '#DC2626' }}>✕</div>
              <div className="font-bold text-base mb-1.5" style={{ color: '#DC2626' }}>تم رفض الطلب</div>
              <div className="text-sm" style={{ color: '#EF4444', opacity: 0.8 }}>سيتواصل معك الفريق قريباً</div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6 text-[11px] text-text-faint opacity-70">
          يُحدَّث تلقائيًا · لا يتطلب إنشاء حساب
        </div>
      </div>
    </div>
  );
}
