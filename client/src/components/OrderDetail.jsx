import { useState, useEffect, useRef } from 'react';
import { updateOrderStatus, updateCost, getComments, addComment } from '../api/orders';
import { getRole } from '../api/auth';
import StatusBadge, { STATUS } from './StatusBadge';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';

const NEXT_STATUS = {
  received:         'in_progress',
  pending_approval: 'in_progress',
  in_progress:      'ready',
  ready:            'delivered',
};

const NEXT_LABEL = {
  received:         'بدء الإصلاح',
  pending_approval: 'موافقة يدوية',
  in_progress:      'تعيين جاهزة',
  ready:            'تسليم',
};

export default function OrderDetail({ order: initial, onClose, onUpdated }) {
  const [order, setOrder]         = useState(initial);
  const [comments, setComments]   = useState([]);
  const [newComment, setNewComment] = useState('');
  const [cost, setCost]           = useState(String(initial.cost ?? 0));
  const [savingCost, setSavingCost]     = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [error, setError]         = useState('');
  const commentsEndRef = useRef(null);
  const isWorkshop = getRole() === 'workshop';

  useEffect(() => {
    loadComments();
  }, [order.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  async function loadComments() {
    try { setComments(await getComments(order.id)); }
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
      if (updated.status === 'ready') {
        window.open(buildReadyWaUrl(updated.phone, updated.customer_name, updated.order_number), '_blank', 'noopener,noreferrer');
      }
    }
    catch (e) { setError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleSaveCost() {
    const c = parseInt(cost, 10);
    if (isNaN(c) || c < 0) { setError('أدخل مبلغاً صحيحاً'); return; }
    setSavingCost(true);
    setError('');
    try {
      const updated = await updateCost(order.id, c);
      update(updated);
      if (updated.status === 'pending_approval') {
        window.open(buildApprovalWaUrl(updated.phone, updated.customer_name, updated.cost, buildTrackingUrl(updated.customer_token)), '_blank', 'noopener,noreferrer');
      }
    }
    catch (e) { setError(e.message); }
    finally { setSavingCost(false); }
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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 300, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 'min(480px, 100vw)',
        background: 'var(--bg-surface)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.18)',
        zIndex: 301,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--bg-sidebar)', color: '#fff',
          padding: '20px 24px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>تفاصيل الطلب</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>
                {order.order_number}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            >×</button>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{dateStr}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>

          {/* Order info */}
          <section style={{ padding: '20px 24px 0' }}>
            <InfoRow label="العميل"  value={order.customer_name} bold />
            <InfoRow label="القطعة"  value={order.piece_type} />
            <InfoRow label="الجوال"  value={'+' + order.phone} mono />
            {order.notes && <InfoRow label="ملاحظات" value={order.notes} />}
            {order.cost > 0 && <InfoRow label="التكلفة" value={`${order.cost} ريال`} bold />}
          </section>

          <Divider />

          {/* Status + Cost — workshop only */}
          {isWorkshop && (
            <section style={{ padding: '0 24px' }}>
              <SectionTitle>الإجراءات</SectionTitle>

              {/* Advance status */}
              {NEXT_STATUS[order.status] && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    className="btn-gold"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={savingStatus}
                    onClick={handleStatusAdvance}
                  >
                    {savingStatus ? 'جاري التحديث...' : `← ${NEXT_LABEL[order.status]}`}
                  </button>
                </div>
              )}

              {/* Cost editor */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  تكلفة الإصلاح (ريال)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-base"
                    type="number"
                    min="0"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleSaveCost}
                    disabled={savingCost}
                    style={{ flexShrink: 0 }}
                  >
                    {savingCost ? '...' : 'حفظ'}
                  </button>
                </div>
                {order.status === 'received' && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    تحديد التكلفة سينقل الطلب إلى "بانتظار الموافقة"
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginTop: '12px', color: '#DC2626', fontSize: '0.83rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius)' }}>
                  {error}
                </div>
              )}
            </section>
          )}

          <Divider />

          {/* Comments */}
          <section style={{ padding: '0 24px' }}>
            <SectionTitle>التعليقات {comments.length > 0 && `(${comments.length})`}</SectionTitle>

            {/* Comment list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {comments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  لا توجد تعليقات بعد
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    borderRight: '3px solid var(--gold-border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {c.author}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {c.body}
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Add comment — workshop only */}
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
      </div>
    </>
  );
}

function InfoRow({ label, value, bold, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--bg-elevated)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 400,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        fontSize: mono ? '0.82rem' : '0.9rem',
        color: 'var(--text-primary)',
        textAlign: 'left',
        direction: mono ? 'ltr' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="gold-line" style={{ margin: '20px 0' }} />;
}
