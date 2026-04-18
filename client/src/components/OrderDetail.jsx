import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateOrderStatus, updateCost, getComments, addComment, getOrderHistory, confirmPayment } from '../api/orders';
import { getRole } from '../api/auth';
import StatusPill from './StatusPill';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';
import ReadyLabelCanvas from './ReadyLabelCanvas';

// Workshop-triggered transitions (shop transitions handled via separate actions)
const NEXT_STATUS = {
  new:              'received',
  received:         'inspection',
  inspection:       'waiting_approval',
  waiting_approval: 'in_repair',
  approved:         'in_repair',
  in_repair:        'quality_check',
  quality_check:    'ready_for_return',
  // ready_for_return → returned_to_shop: shop employee only (separate action)
  // returned_to_shop → delivered: shop employee only with payment (separate action)
  delivered:        'closed',
};

const NEXT_LABEL = {
  new:              'استلام في الورشة',
  received:         'بدء الفحص',
  inspection:       'طلب موافقة العميل',
  waiting_approval: 'بدء الإصلاح',
  approved:         'بدء الإصلاح',
  in_repair:        'فحص الجودة',
  quality_check:    'جاهز للإرجاع',
  delivered:        'إغلاق الطلب',
};

export default function OrderDetail({ order: initial, onClose, onUpdated }) {
  const [order, setOrder]         = useState(initial);
  const [comments, setComments]   = useState([]);
  const [history, setHistory]     = useState([]);
  const [newComment, setNewComment] = useState('');
  const [cost, setCost]           = useState(String(initial.cost ?? 0));
  const [paymentMethod, setPaymentMethod]   = useState(null);
  const [savingCost, setSavingCost]         = useState(false);
  const [savingStatus, setSavingStatus]     = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingComment, setSavingComment]   = useState(false);
  const [justMarkedReady, setJustMarkedReady] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [savingCancel, setSavingCancel]         = useState(false);
  const [error, setError]         = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const commentsEndRef = useRef(null);
  const isWorkshop = getRole() === 'workshop';

  function copyTrackingLink() {
    navigator.clipboard.writeText(buildTrackingUrl(order.customer_token)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  useEffect(() => {
    loadComments();
    loadHistory();
  }, [order.id]);
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  async function loadComments() {
    try { setComments(await getComments(order.id)); }
    catch { /* non-critical */ }
  }

  async function loadHistory() {
    try { setHistory(await getOrderHistory(order.id)); }
    catch { /* non-critical */ }
  }

  function update(updated) {
    setOrder(updated);
    onUpdated?.(updated);
  }

  async function handleStatusAdvance() {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setSavingStatus(true);
    setError('');
    try {
      const updated = await updateOrderStatus(order.id, next);
      update(updated);
      loadHistory();
      if (updated.status === 'ready_for_return') setJustMarkedReady(true);
    }
    catch (e) { setError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleDelivery() {
    if (!paymentMethod) return;
    setSavingDelivery(true);
    setError('');
    try {
      await confirmPayment(order.id);
      const updated = await updateOrderStatus(order.id, 'delivered');
      update(updated);
      loadHistory();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingDelivery(false);
    }
  }

  async function handleSaveCost() {
    const c = parseInt(cost, 10);
    if (isNaN(c) || c < 0) { setError('أدخل مبلغاً صحيحاً'); return; }
    setSavingCost(true);
    setError('');
    try {
      const updated = await updateCost(order.id, c);
      update(updated);
      if (updated.status === 'waiting_approval') {
        window.open(buildApprovalWaUrl(updated.phone, updated.customer_name, updated.cost, buildTrackingUrl(updated.customer_token)), '_blank', 'noopener,noreferrer');
      }
    }
    catch (e) { setError(e.message); }
    finally { setSavingCost(false); }
  }

  async function handleConfirmReturnedToShop() {
    setSavingStatus(true);
    setError('');
    try {
      const updated = await updateOrderStatus(order.id, 'returned_to_shop');
      update(updated);
      loadHistory();
    } catch (e) { setError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleCancel() {
    setError('');
    setSavingCancel(true);
    try {
      const updated = await updateOrderStatus(order.id, 'cancelled');
      onUpdated?.(updated);
      onClose();
    } catch (e) {
      setError(e.message);
      setConfirmingCancel(false);
    } finally {
      setSavingCancel(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSavingComment(true);
    setError('');
    try {
      const c = await addComment(order.id, newComment.trim());
      setComments(prev => [...prev, c]);
      setNewComment('');
    } catch (e) { setError(e.message); }
    finally { setSavingComment(false); }
  }

  const dateStr = new Date(order.created_at).toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 300, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'min(480px, 100vw)',
          background: '#FFFFFF',
          boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
          zIndex: 301,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          borderLeft: '1px solid #E5E7EB',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '24px 28px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>تفاصيل الطلب</div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '1.05rem', fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.04em',
              }}>
                {order.order_number}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', cursor: 'pointer',
                lineHeight: 1, padding: '6px 10px', borderRadius: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.25)'; e.target.style.color = '#fff'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.15)'; e.target.style.color = 'rgba(255,255,255,0.8)'; }}
            >×</button>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <StatusPill status={order.status} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{dateStr}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
          {/* Order info */}
          <section style={{ padding: '24px 28px 0' }}>
            <InfoRow label="العميل" value={order.customer_name} bold />
            <InfoRow label="الجوال" value={'+' + order.phone} mono />
            {order.cost > 0 && <InfoRow label="التكلفة" value={`${order.cost} ريال`} bold />}

            {/* Copy tracking link */}
            {order.customer_token && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>رابط المتابعة</span>
                <button
                  onClick={copyTrackingLink}
                  style={{
                    background: linkCopied ? 'rgba(22,163,74,0.08)' : 'rgba(41,128,185,0.08)',
                    border: `1px solid ${linkCopied ? 'rgba(22,163,74,0.25)' : 'rgba(41,128,185,0.25)'}`,
                    color: linkCopied ? '#16A34A' : '#2980B9',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Almarai, sans-serif',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {linkCopied ? '✓ تم النسخ' : '⎘ نسخ الرابط'}
                </button>
              </div>
            )}

            {/* Items table */}
            {order.items && order.items.length > 0 ? (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  الأصناف
                </div>
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 48px 1.5fr 2fr',
                    padding: '8px 10px',
                    background: '#F9FAFB',
                    borderBottom: '1px solid #E5E7EB',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    gap: '10px',
                  }}>
                    <span>النوع</span>
                    <span style={{ textAlign: 'center' }}>العدد</span>
                    <span>عام</span>
                    <span>فني</span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={item.id ?? i} style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 48px 1.5fr 2fr',
                      padding: '10px 10px',
                      borderBottom: i < order.items.length - 1 ? '1px solid #F3F4F6' : 'none',
                      alignItems: 'start',
                      gap: '10px',
                      fontSize: '0.82rem',
                    }}>
                      <div>
                        <div style={{ color: 'var(--text)', fontWeight: 700 }}>{item.item_name || item.item_type}</div>
                        {(item.brand || item.model) && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.brand} {item.model}
                          </div>
                        )}
                        {item.serial_number && (
                          <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: '#2980B9' }}>
                            {item.serial_number}
                          </div>
                        )}
                      </div>
                      <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#2980B9', fontWeight: 700 }}>{item.quantity}</span>
                      <span style={{ color: item.notes ? 'var(--text-soft)' : 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {item.notes || '—'}
                      </span>
                      <span style={{ color: '#059669', fontSize: '0.78rem', fontWeight: 500 }}>
                        {item.workshop_comment || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="القطعة" value={order.piece_type} />
                {order.notes && <InfoRow label="ملاحظات" value={order.notes} />}
              </>
            )}
          </section>

          <Divider />

          {/* Locked order banner */}
          {order.locked_at && (
            <section style={{ padding: '0 28px 0' }}>
              <div style={{
                padding: '12px 16px',
                background: 'rgba(30,41,59,0.06)',
                border: '1px solid rgba(30,41,59,0.15)',
                borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', gap: '10px',
                fontSize: '0.85rem', color: '#1E293B',
              }}>
                <span style={{ fontSize: '1rem' }}>🔒</span>
                <span>هذا الطلب مغلق ولا يمكن تعديله</span>
              </div>
            </section>
          )}

          {/* Actions — hidden when order is locked */}
          {!order.locked_at && (isWorkshop || ['ready_for_return', 'returned_to_shop'].includes(order.status)) && (
            <section style={{ padding: '0 28px' }}>
              <SectionTitle>الإجراءات</SectionTitle>

              {/* Print labels button — all non-terminal statuses */}
              {!['cancelled', 'closed', 'delivered'].includes(order.status) && (
                <div style={{ marginBottom: '12px' }}>
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
                    onClick={() => window.open('/orders/' + order.id + '/label', '_blank', 'noopener,noreferrer')}
                  >
                    🖨 طباعة الملصقات
                  </button>
                </div>
              )}

              {/* Shop employee: WhatsApp notification + confirm received from workshop */}
              {!isWorkshop && order.status === 'ready_for_return' && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
                      onClick={() => window.open(buildReadyWaUrl(order.phone, order.customer_name, order.order_number), '_blank', 'noopener,noreferrer')}
                    >
                      📲 إرسال رسالة الاستلام (WhatsApp) ↗
                    </button>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      className="btn-gold"
                      style={{ width: '100%', justifyContent: 'center', minHeight: '44px', background: '#059669', borderColor: 'rgba(5,150,105,0.4)' }}
                      disabled={savingStatus}
                      onClick={handleConfirmReturnedToShop}
                    >
                      {savingStatus ? 'جاري التحديث...' : '✓ تأكيد وصول القطعة من الورشة'}
                    </button>
                  </div>
                </>
              )}

              {/* Shop employee: payment + delivery to customer */}
              {!isWorkshop && order.status === 'returned_to_shop' && (
                <div style={{ marginBottom: '20px', padding: '16px', background: '#FFFBF0', border: '1px solid rgba(212,168,67,0.3)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                    تأكيد الدفع والتسليم
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    طريقة الدفع
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {[
                      { value: 'cash', label: 'نقداً' },
                      { value: 'card', label: 'بطاقة' },
                      { value: 'transfer', label: 'تحويل' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentMethod(value)}
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          border: paymentMethod === value ? '2px solid #D4A843' : '1px solid #D1D5DB',
                          borderRadius: '8px',
                          background: paymentMethod === value ? 'rgba(212,168,67,0.1)' : '#FFFFFF',
                          color: paymentMethod === value ? '#92700A' : 'var(--text-soft)',
                          fontWeight: paymentMethod === value ? 700 : 400,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontFamily: 'Almarai, sans-serif',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-gold"
                    style={{ width: '100%', justifyContent: 'center', minHeight: '44px', opacity: paymentMethod ? 1 : 0.5 }}
                    disabled={!paymentMethod || savingDelivery}
                    onClick={handleDelivery}
                  >
                    {savingDelivery ? 'جاري التأكيد...' : '✓ تأكيد التسليم والدفع'}
                  </button>
                </div>
              )}

              {isWorkshop && (
                <>
                  {/* Auto-advance button — workshop transitions only */}
                  {NEXT_STATUS[order.status] && (
                    <div style={{ marginBottom: '16px' }}>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
                        disabled={savingStatus}
                        onClick={handleStatusAdvance}
                      >
                        {savingStatus ? 'جاري التحديث...' : `← ${NEXT_LABEL[order.status]}`}
                      </button>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      تكلفة الإصلاح (ريال)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input className="input-base" type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn-primary" onClick={handleSaveCost} disabled={savingCost} style={{ flexShrink: 0 }}>
                        {savingCost ? '...' : 'حفظ'}
                      </button>
                    </div>
                    {order.status === 'inspection' && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        تحديد التكلفة سينقل الطلب إلى "بانتظار الموافقة" تلقائياً
                      </div>
                    )}
                  </div>

                  {error && (
                    <div style={{ marginTop: '12px', color: '#DC2626', fontSize: '0.83rem', padding: '10px 14px', background: 'rgba(220,38,38,0.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(220,38,38,0.15)' }}>
                      {error}
                    </div>
                  )}

                  {order.status === 'ready_for_return' && (
                    <div style={{ marginTop: '24px' }}>
                      <SectionTitle>ملصق الجاهزية</SectionTitle>
                      <ReadyLabelCanvas order={order} autoPrint={justMarkedReady} />
                    </div>
                  )}

                  {!['delivered', 'closed', 'cancelled'].includes(order.status) && (
                    <>
                      <div style={{ margin: '20px 0 16px', height: '1px', background: '#F3F4F6' }} />
                      {!confirmingCancel ? (
                        <button
                          onClick={() => setConfirmingCancel(true)}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: '1px solid rgba(220,38,38,0.3)',
                            borderRadius: 'var(--radius)',
                            background: '#FFFFFF',
                            color: '#DC2626',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'Almarai, sans-serif',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
                        >
                          إلغاء الطلب
                        </button>
                      ) : (
                        <div style={{
                          padding: '14px 16px',
                          background: 'rgba(220,38,38,0.06)',
                          border: '1px solid rgba(220,38,38,0.2)',
                          borderRadius: 'var(--radius)',
                        }}>
                          <div style={{ fontSize: '0.85rem', color: '#DC2626', fontWeight: 600, marginBottom: '12px' }}>
                            هل أنت متأكد من إلغاء هذا الطلب؟
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleCancel}
                              disabled={savingCancel}
                              style={{
                                flex: 1,
                                padding: '9px 12px',
                                border: '1px solid rgba(220,38,38,0.4)',
                                borderRadius: 'var(--radius)',
                                background: '#DC2626',
                                color: '#FFFFFF',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'Almarai, sans-serif',
                              }}
                            >
                              {savingCancel ? 'جاري الإلغاء...' : 'نعم، إلغاء'}
                            </button>
                            <button
                              onClick={() => setConfirmingCancel(false)}
                              style={{
                                flex: 1,
                                padding: '9px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: 'var(--radius)',
                                background: '#FFFFFF',
                                color: 'var(--text-soft)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'Almarai, sans-serif',
                              }}
                            >
                              لا، تراجع
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
          )}

          <Divider />

          {/* Status History */}
          <section style={{ padding: '0 28px' }}>
            <SectionTitle>سجل العمليات</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? '#16A34A' : '#E5E7EB', marginTop: '6px' }} />
                    {i < history.length - 1 && <div style={{ width: '1px', flex: 1, background: '#F3F4F6' }} />}
                  </div>
                  <div style={{ paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <StatusPill status={h.to_status} size="sm" />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {new Date(h.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                      بواسطة: <span style={{ fontWeight: 600 }}>{h.changed_by}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(h.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Divider />

          {/* Comments */}
          <section style={{ padding: '0 28px' }}>
            <SectionTitle>التعليقات {comments.length > 0 && `(${comments.length})`}</SectionTitle>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {comments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  لا توجد تعليقات بعد
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={{
                    background: '#F9FAFB',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    borderRight: '3px solid rgba(41,128,185,0.20)',
                    border: '1px solid #E5E7EB',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2980B9', fontFamily: 'JetBrains Mono, monospace' }}>
                        {c.author}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6 }}>
                      {c.body}
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {isWorkshop && (
              <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  className="input-base"
                  rows={3}
                  placeholder="أضف تعليقاً..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '72px' }}
                />
                <button className="btn-ghost" type="submit" disabled={savingComment || !newComment.trim()}>
                  {savingComment ? 'جاري الإرسال...' : 'إضافة تعليق'}
                </button>
              </form>
            )}
          </section>
        </div>
      </motion.div>
    </>
  );
}

function InfoRow({ label, value, bold, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 400,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        fontSize: mono ? '0.82rem' : '0.9rem',
        color: 'var(--text)',
        textAlign: 'left',
        direction: mono ? 'ltr' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="gold-line" style={{ margin: '24px 0' }} />;
}
