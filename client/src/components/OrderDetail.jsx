import { useState, useEffect, useRef } from 'react';
import { updateOrderStatus, updateItemCost, sendForApproval, getComments, addComment, getOrderHistory, confirmPayment, setOrderUrgent } from '../api/orders';
import { getRole } from '../api/auth';
import StatusPill from './StatusPill';
import { Icons } from './icons';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';
import ReadyLabelCanvas from './ReadyLabelCanvas';

// Status advance buttons — omit transitions that require explicit workflow:
//   inspection → waiting_approval: use "Send for Approval" button (per-item cost)
//   waiting_approval → approved:  customer decides via tracking page
const NEXT_STATUS = {
  new:              'received',
  received:         'inspection',
  approved:         'in_repair',
  in_repair:        'quality_check',
  quality_check:    'ready_for_return',
  delivered:        'closed',
};

const NEXT_LABEL = {
  new:              'استلام في الورشة',
  received:         'بدء الفحص',
  approved:         'بدء الإصلاح',
  in_repair:        'فحص الجودة',
  quality_check:    'جاهز للإرجاع',
  delivered:        'إغلاق الطلب',
};

export default function OrderDetail({ order: initial, onClose, onUpdated }) {
  const [order, setOrder]           = useState(initial);
  const [comments, setComments]     = useState([]);
  const [history, setHistory]       = useState([]);
  const [newComment, setNewComment]  = useState('');
  const [paymentMethod, setPaymentMethod]     = useState(null);
  const [savingItemId, setSavingItemId]       = useState(null);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [savingStatus, setSavingStatus]       = useState(false);
  const [savingDelivery, setSavingDelivery]   = useState(false);
  const [savingComment, setSavingComment]     = useState(false);
  const [justMarkedReady, setJustMarkedReady] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [savingCancel, setSavingCancel]         = useState(false);
  const [error, setError]           = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const commentsEndRef = useRef(null);
  const isWorkshop = getRole() === 'workshop';

  function copyTrackingLink() {
    navigator.clipboard.writeText(buildTrackingUrl(order.customer_token)).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  useEffect(() => { loadComments(); loadHistory(); }, [order.id]);
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function loadComments() {
    try { setComments(await getComments(order.id)); } catch { /* non-critical */ }
  }
  async function loadHistory() {
    try { setHistory(await getOrderHistory(order.id)); } catch { /* non-critical */ }
  }
  function update(updated) { setOrder(updated); onUpdated?.(updated); }

  async function handleToggleUrgent() {
    try {
      const updated = await setOrderUrgent(order.id, !order.is_urgent);
      update(updated);
    } catch (e) { setError(e.message); }
  }

  async function handleStatusAdvance() {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setSavingStatus(true); setError('');
    try {
      const updated = await updateOrderStatus(order.id, next);
      update(updated); loadHistory();
      if (updated.status === 'ready_for_return') setJustMarkedReady(true);
    } catch (e) { setError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleDelivery() {
    if (!paymentMethod) return;
    setSavingDelivery(true); setError('');
    try {
      await confirmPayment(order.id);
      const updated = await updateOrderStatus(order.id, 'delivered');
      update(updated); loadHistory(); onClose();
    } catch (e) { setError(e.message); }
    finally { setSavingDelivery(false); }
  }

  async function handleSaveItemCost(itemId, raw) {
    const c = parseInt(raw, 10);
    if (isNaN(c) || c < 0) { setError('أدخل مبلغاً صحيحاً'); return; }
    setSavingItemId(itemId); setError('');
    try {
      const updated = await updateItemCost(order.id, itemId, c);
      update(updated);
    } catch (e) { setError(e.message); }
    finally { setSavingItemId(null); }
  }

  async function handleSendForApproval() {
    setSendingApproval(true); setError('');
    try {
      const updated = await sendForApproval(order.id);
      update(updated); loadHistory();
      if (updated.status === 'waiting_approval') {
        window.open(buildApprovalWaUrl(updated.phone, updated.customer_name, updated.cost, buildTrackingUrl(updated.customer_token)), '_blank', 'noopener,noreferrer');
      }
    } catch (e) { setError(e.message); }
    finally { setSendingApproval(false); }
  }

  async function handleConfirmReturnedToShop() {
    setSavingStatus(true); setError('');
    try {
      const updated = await updateOrderStatus(order.id, 'returned_to_shop');
      update(updated); loadHistory();
    } catch (e) { setError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleCancel() {
    setError(''); setSavingCancel(true);
    try {
      const updated = await updateOrderStatus(order.id, 'cancelled');
      onUpdated?.(updated); onClose();
    } catch (e) { setError(e.message); setConfirmingCancel(false); }
    finally { setSavingCancel(false); }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSavingComment(true); setError('');
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
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        {/* Header */}
        <div className="drawer-head">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} data-testid="order-detail__close">
            <Icons.X size={14} />
          </button>
          <span className="stamp" style={{ fontSize: 12 }}>{order.order_number}</span>
          {isWorkshop ? (
            <button
              type="button"
              onClick={handleToggleUrgent}
              data-testid="order-detail__urgent-toggle"
              title={order.is_urgent ? 'إلغاء الأولوية' : 'تعليم كمستعجل'}
              style={{
                cursor: 'pointer', border: 0,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                padding: '2px 7px', borderRadius: 3,
                background: order.is_urgent ? 'var(--danger)' : 'transparent',
                color: order.is_urgent ? '#fff' : 'var(--text-muted)',
                boxShadow: order.is_urgent ? 'none' : 'inset 0 0 0 1px var(--border)',
              }}
            >
              {order.is_urgent ? 'مستعجل' : 'عادي'}
            </button>
          ) : order.is_urgent ? (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 3,
              background: 'var(--danger)', color: '#fff',
              letterSpacing: 0.3,
            }}>مستعجل</span>
          ) : null}
          <StatusPill status={order.status} />
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{dateStr}</span>
          <div style={{ flex: 1 }} />
          {NEXT_STATUS[order.status] && isWorkshop && (
            <button className="btn btn-sm btn-primary" disabled={savingStatus} onClick={handleStatusAdvance} data-testid="order-detail__status-advance">
              <Icons.Check size={12} />
              {savingStatus ? '...' : NEXT_LABEL[order.status]}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => window.open('/orders/' + order.id + '/label', '_blank', 'noopener,noreferrer')} data-testid="order-detail__label-print-link">
            <Icons.Printer size={12} /> طباعة
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          {/* Customer info */}
          <div className="detail-section">
            <div className="detail-section-label">بيانات العميل</div>
            <div className="kv-grid">
              <div className="kv-key">الاسم</div>
              <div className="kv-val" style={{ fontWeight: 600 }}>{order.customer_name}</div>
              <div className="kv-key">الجوال</div>
              <div className="kv-val mono" style={{ direction: 'ltr', justifyContent: 'flex-end' }}>+{order.phone}</div>
              {order.cost > 0 && <>
                <div className="kv-key">التكلفة</div>
                <div className="kv-val mono">{order.cost} ريال</div>
              </>}
              {order.customer_token && (
                <>
                  <div className="kv-key">رابط المتابعة</div>
                  <div className="kv-val">
                    <button
                      className={`btn btn-sm${linkCopied ? '' : ''}`}
                      onClick={copyTrackingLink}
                      data-testid="order-detail__copy-tracking-link"
                      style={linkCopied ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}}
                    >
                      {linkCopied ? <><Icons.Check size={11} /> تم النسخ</> : <><Icons.Link size={11} /> نسخ الرابط</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="detail-section">
            <div className="detail-section-label">الأصناف</div>
            {order.items && order.items.length > 0 ? (
              <div className="card" style={{ overflowX: 'auto' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 44px 1.2fr 100px 120px',
                  minWidth: 500,
                  padding: '7px 12px', background: 'var(--bg-soft)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.04em', gap: 10,
                }}>
                  <span>النوع</span>
                  <span style={{ textAlign: 'center' }}>العدد</span>
                  <span>ملاحظات</span>
                  <span>التكلفة</span>
                  <span>الحالة</span>
                </div>
                {order.items.map((item, i) => (
                  <ItemRow
                    key={item.id ?? i}
                    item={item}
                    isWorkshop={isWorkshop}
                    canEditCost={isWorkshop && !order.locked_at && ['inspection', 'in_repair', 'rejected', 'waiting_approval'].includes(order.status)}
                    saving={savingItemId === item.id}
                    onSave={(c) => handleSaveItemCost(item.id, c)}
                    isLast={i === order.items.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="kv-grid">
                <div className="kv-key">القطعة</div>
                <div className="kv-val">{order.piece_type}</div>
                {order.notes && <>
                  <div className="kv-key">ملاحظات</div>
                  <div className="kv-val text-sm" style={{ color: 'var(--text-soft)' }}>{order.notes}</div>
                </>}
              </div>
            )}
            {isWorkshop && order.items && order.items.length > 0 && (
              <div style={{
                marginTop: 10, display: 'flex', gap: 12, alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap',
              }}>
                <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  الإجمالي: <strong style={{ color: 'var(--text)', fontSize: 14 }}>{order.cost ?? 0}</strong> ريال
                </div>
                {!order.locked_at && ['inspection', 'in_repair', 'rejected'].includes(order.status) && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={sendingApproval}
                    onClick={handleSendForApproval}
                    data-testid="order-detail__send-for-approval"
                    title="إرسال التسعيرة للعميل عبر واتساب"
                  >
                    <Icons.Phone size={12} />
                    {sendingApproval ? 'جاري الإرسال...' : 'إرسال للعميل للموافقة'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Locked banner */}
          {order.locked_at && (
            <div className="detail-section">
              <div style={{
                padding: '12px 14px', background: 'var(--bg-soft)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontSize: 12.5, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icons.Archive size={13} />
                هذا الطلب مغلق ولا يمكن تعديله
              </div>
            </div>
          )}

          {/* Actions */}
          {!order.locked_at && (isWorkshop || ['ready_for_return', 'returned_to_shop'].includes(order.status)) && (
            <div className="detail-section">
              <div className="detail-section-label">الإجراءات</div>

              {/* Shop employee: WhatsApp + confirm received */}
              {!isWorkshop && order.status === 'ready_for_return' && (
                <>
                  <button
                    className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, height: 36 }}
                    onClick={() => window.open(buildReadyWaUrl(order.phone, order.customer_name, order.order_number), '_blank', 'noopener,noreferrer')}
                    data-testid="order-detail__whatsapp-ready"
                  >
                    <Icons.Phone size={13} /> إرسال رسالة الاستلام (WhatsApp) ↗
                  </button>
                  <button
                    className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 36 }}
                    disabled={savingStatus} onClick={handleConfirmReturnedToShop}
                    data-testid="order-detail__confirm-returned-to-shop"
                  >
                    <Icons.Check size={13} /> {savingStatus ? 'جاري التحديث...' : 'تأكيد وصول القطعة من الورشة'}
                  </button>
                </>
              )}

              {/* Shop employee: payment + delivery */}
              {!isWorkshop && order.status === 'returned_to_shop' && (
                <div style={{
                  padding: 16, background: 'var(--bg-soft)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                }}>
                  <div className="detail-section-label" style={{ marginBottom: 12 }}>تأكيد الدفع والتسليم</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>طريقة الدفع</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {[{ value: 'cash', label: 'نقداً' }, { value: 'card', label: 'بطاقة' }, { value: 'transfer', label: 'تحويل' }].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentMethod(value)}
                        className={`btn btn-sm${paymentMethod === value ? ' btn-primary' : ''}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                        data-testid={`order-detail__payment__${value}`}
                      >{label}</button>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 36, opacity: paymentMethod ? 1 : 0.5 }}
                    disabled={!paymentMethod || savingDelivery} onClick={handleDelivery}
                    data-testid="order-detail__confirm-delivery"
                  >
                    <Icons.Check size={13} /> {savingDelivery ? 'جاري التأكيد...' : 'تأكيد التسليم والدفع'}
                  </button>
                </div>
              )}

              {/* Workshop actions */}
              {isWorkshop && (
                <>
                  {NEXT_STATUS[order.status] && (
                    <button
                      className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 36, marginBottom: 12 }}
                      disabled={savingStatus} onClick={handleStatusAdvance}
                      data-testid="order-detail__status-advance__actions"
                    >
                      <Icons.Check size={13} /> {savingStatus ? 'جاري التحديث...' : NEXT_LABEL[order.status]}
                    </button>
                  )}

                  {error && (
                    <div style={{
                      padding: '10px 14px', background: 'oklch(0.58 0.21 25 / 0.06)',
                      border: '1px solid oklch(0.58 0.21 25 / 0.2)',
                      borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: 12.5, marginBottom: 12,
                    }}>
                      {error}
                    </div>
                  )}

                  {order.status === 'ready_for_return' && (
                    <div style={{ marginTop: 16 }}>
                      <div className="detail-section-label">ملصق الجاهزية</div>
                      <ReadyLabelCanvas order={order} autoPrint={justMarkedReady} />
                    </div>
                  )}

                  {!['delivered', 'closed', 'cancelled'].includes(order.status) && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      {!confirmingCancel ? (
                        <button
                          onClick={() => setConfirmingCancel(true)}
                          className="btn btn-sm btn-danger"
                          style={{ width: '100%', justifyContent: 'center', height: 32, borderColor: 'oklch(0.58 0.21 25 / 0.3)', color: 'var(--danger)' }}
                          data-testid="order-detail__cancel-button"
                        >
                          إلغاء الطلب
                        </button>
                      ) : (
                        <div style={{
                          padding: 14, background: 'oklch(0.58 0.21 25 / 0.05)',
                          border: '1px solid oklch(0.58 0.21 25 / 0.2)', borderRadius: 'var(--radius)',
                        }}>
                          <div style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, marginBottom: 10 }}>
                            هل أنت متأكد من إلغاء هذا الطلب؟
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={handleCancel} disabled={savingCancel}
                              className="btn btn-sm"
                              style={{ flex: 1, justifyContent: 'center', background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
                              data-testid="order-detail__cancel-confirm"
                            >
                              {savingCancel ? 'جاري الإلغاء...' : 'نعم، إلغاء'}
                            </button>
                            <button
                              onClick={() => setConfirmingCancel(false)}
                              className="btn btn-sm"
                              style={{ flex: 1, justifyContent: 'center' }}
                              data-testid="order-detail__cancel-deny"
                            >
                              لا، تراجع
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Status History */}
          <div className="detail-section">
            <div className="detail-section-label">سجل العمليات</div>
            <div className="timeline">
              {history.map((h, i) => (
                <div key={h.id} className="tl-item">
                  <span className={`tl-dot ${i === 0 ? 'current' : 'done'}`} />
                  <div className="tl-title">
                    <StatusPill status={h.to_status} size="sm" />
                  </div>
                  <div className="tl-meta mono">
                    {new Date(h.created_at).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    &nbsp;· {h.changed_by}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="detail-section">
            <div className="detail-section-label">التعليقات {comments.length > 0 && `(${comments.length})`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {comments.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 12.5, fontStyle: 'italic' }}>لا توجد تعليقات بعد</div>
              ) : comments.map(c => (
                <div key={c.id} style={{
                  background: 'var(--bg-soft)', borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  borderRight: '3px solid var(--primary-ring)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>{c.author}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {new Date(c.created_at).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{c.body}</div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {isWorkshop && (
              <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="أضف تعليقاً..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  data-testid="order-detail__comment__textarea"
                />
                <button className="btn btn-sm" type="submit" disabled={savingComment || !newComment.trim()} data-testid="order-detail__comment__submit">
                  {savingComment ? 'جاري الإرسال...' : 'إضافة تعليق'}
                </button>
              </form>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 10, marginTop: 8 }}>
            <span><span className="kbd">esc</span> إغلاق</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Per-item approval_status badges — workshop drawer only. The customer's
// track page has its own display; we don't want to leak these back there.
// 'pending' renders no badge (normal pre-approval state).
const APPROVAL_BADGE = {
  approved: { label: 'موافق عليه',    icon: 'check', bg: 'oklch(0.7 0.15 145 / 0.12)', fg: 'var(--success)' },
  rejected: { label: 'مرفوض',         icon: 'x',     bg: 'oklch(0.58 0.21 25 / 0.1)',  fg: 'var(--danger)'  },
  skipped:  { label: 'مجاني — مشمول', icon: null,    bg: 'var(--bg-soft)',             fg: 'var(--text-muted)' },
};

function ItemRow({ item, isWorkshop, canEditCost, saving, onSave, isLast }) {
  const initial = item.estimated_cost == null ? '' : String(item.estimated_cost);
  const [draft, setDraft] = useState(initial);
  useEffect(() => { setDraft(initial); }, [initial]);

  const commit = () => {
    if (draft === initial) return;
    if (draft === '') return;
    onSave(draft);
  };

  const badge      = isWorkshop ? (APPROVAL_BADGE[item.approval_status] || null) : null;
  const isRejected = item.approval_status === 'rejected';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.2fr 44px 1.2fr 100px 120px',
      minWidth: 500,
      padding: '10px 12px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      alignItems: 'center', gap: 10, fontSize: 12.5,
      // Rejected items stay visible — technician needs to see them — but the
      // row is clearly muted so they're not mistaken for active work.
      background: isRejected ? 'oklch(0.58 0.21 25 / 0.04)' : undefined,
      opacity:    isRejected ? 0.82 : 1,
    }}>
      <div>
        <div style={{ fontWeight: 600 }}>{item.item_name || item.item_type}</div>
        {item.serial_number && <div className="mono text-xs text-mute">{item.serial_number}</div>}
      </div>
      <span className="mono" style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 600 }}>{item.quantity}</span>
      <span style={{ color: item.notes ? 'var(--text-soft)' : 'var(--text-faint)', fontSize: 12 }}>{item.notes || '—'}</span>
      <div>
        {canEditCost ? (
          <input
            className="input"
            type="number"
            min="0"
            value={draft}
            placeholder="0"
            disabled={saving}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            style={{ width: '100%', height: 28, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
            data-testid={item.id ? `order-detail__item__${item.id}__cost-input` : undefined}
          />
        ) : (
          <span
            className="mono"
            // dir=ltr so the strikethrough draws left-to-right across the
            // digits consistently in both Chrome and Safari under an RTL
            // parent. Without this the line can render visually reversed.
            dir="ltr"
            style={{
              fontSize: 12.5,
              display: 'inline-block',
              textDecoration: isRejected ? 'line-through' : 'none',
              textDecorationColor: isRejected ? 'var(--danger)' : undefined,
              color: isRejected ? 'var(--text-muted)' : undefined,
            }}
          >
            {item.estimated_cost == null ? '—' : `${item.estimated_cost} ريال`}
          </span>
        )}
      </div>
      <div>
        {badge && (
          <span
            data-testid={item.id ? `order-detail__item__${item.id}__approval-badge` : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10.5, fontWeight: 600,
              padding: '2px 8px', borderRadius: 3,
              background: badge.bg, color: badge.fg,
              whiteSpace: 'nowrap',
            }}
          >
            {badge.icon === 'check' && <Icons.Check size={10} />}
            {badge.icon === 'x'     && <Icons.X     size={10} />}
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
