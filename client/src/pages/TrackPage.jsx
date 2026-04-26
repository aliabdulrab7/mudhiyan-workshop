import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getTrackOrder, submitDecisions } from '../api/orders';
import SkeletonLoader from '../components/SkeletonLoader';
import { Icons } from '../components/icons';
import SegmentedGroup from '../components/ui/SegmentedGroup';

// 6-stage customer-facing timeline
const STAGES = [
  { key: 'received',         label: 'استُلم' },
  { key: 'inspection',       label: 'الفحص' },
  { key: 'in_repair',        label: 'التنفيذ' },
  { key: 'quality_check',    label: 'الجودة' },
  { key: 'ready_for_return', label: 'جاهز' },
  { key: 'delivered',        label: 'سُلِّم' },
];

const STATUS_TO_STAGE = {
  new:              'received',
  received:         'received',
  inspection:       'inspection',
  waiting_approval: 'inspection',
  approved:         'in_repair',
  rejected:         null,
  in_repair:        'in_repair',
  quality_check:    'quality_check',
  ready_for_return: 'ready_for_return',
  returned_to_shop: 'ready_for_return',
  delivered:        'delivered',
  closed:           'delivered',
  cancelled:        null,
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
  returned_to_shop: 'قطعتك جاهزة للاستلام من الفرع',
  delivered:        'تم التسليم، شكراً لثقتك',
  closed:           'تم التسليم، شكراً لثقتك',
  rejected:         'تم رفض الطلب',
  cancelled:        'تم إلغاء الطلب',
};

const ACTIVE_STATUSES = new Set([
  'new', 'received', 'inspection', 'waiting_approval', 'approved',
  'in_repair', 'quality_check', 'ready_for_return',
]);

export default function TrackPage() {
  const { token } = useParams();
  const [order,      setOrder]    = useState(null);
  const [loading,    setLoading]  = useState(true);
  const [notFound,   setNotFound] = useState(false);
  const [decisions,  setDecisions] = useState({}); // { [sort_order]: 'approve' | 'reject' }
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(null); // 'approved' | 'rejected' | 'mixed'
  const [submitError, setSubmitError] = useState(null);

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

  // Pending+costed items that need a customer decision
  const decidableItems = useMemo(
    () => (order?.items ?? []).filter(it => it.approval_status === 'pending' && it.estimated_cost > 0),
    [order]
  );
  const hasDecidable = decidableItems.length > 0;
  const allDecided = hasDecidable && decidableItems.every(it => decisions[it.sort_order]);

  async function handleSubmitDecisions() {
    if (!allDecided) return;
    setSubmitting(true); setSubmitError(null);
    const payload = decidableItems.map(it => ({
      sort_order: it.sort_order,
      decision:   decisions[it.sort_order],
    }));
    try {
      const result = await submitDecisions(token, payload);
      const hasReject = payload.some(d => d.decision === 'reject');
      const hasApprove = payload.some(d => d.decision === 'approve');
      setSubmitted(result.status === 'rejected' ? 'rejected'
        : hasReject && hasApprove ? 'mixed'
        : 'approved');
      setOrder(prev => ({ ...prev, status: result.status }));
    } catch (e) {
      setSubmitError(e.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }} dir="rtl">
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>جارٍ التحميل…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font-ui)' }} dir="rtl">
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icons.Diamond size={20} stroke="var(--primary)" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>الطلب غير موجود</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>تأكد من الرابط أو المسح مجدداً</div>
        </div>
      </div>
    );
  }

  const stageKey   = STATUS_TO_STAGE[order.status] ?? 'received';
  const currentIdx = STAGES.findIndex(s => s.key === stageKey);
  const isTerminal = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-ui)' }} dir="rtl">
      <div className="track-shell">

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="track-mark" style={{ margin: '0 auto 12px' }}>
            <Icons.Diamond size={16} stroke="#fff" sw={2} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>مجوهرات سليمان المضيان</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>إدارة صيانة المجوهرات</div>
        </div>

        {/* Main card */}
        <div className="track-card">
          {/* Order hero */}
          <div className="track-hero">
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>رقم الطلب</div>
              <span className="stamp" style={{ fontSize: 14, padding: '3px 10px' }}>{order.tracking_number}</span>
            </div>
            {order.piece_type && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>نوع القطعة</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{order.piece_type}</div>
              </div>
            )}
          </div>

          <hr className="hr" />

          {/* 6-stage progress */}
          {!isTerminal && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>بدأ</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {order.eta
                    ? `متوقّع: ${new Date(order.eta).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}`
                    : 'قيد التنفيذ'}
                </span>
              </div>

              {/* Stage dots */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {STAGES.map((stage, i) => {
                  const done    = i < currentIdx;
                  const current = i === currentIdx;
                  return (
                    <React.Fragment key={stage.key}>
                      {i > 0 && (
                        <div style={{ flex: 1, height: 2, background: done ? 'var(--primary)' : 'var(--border-strong)', margin: '0 2px' }} />
                      )}
                      <div style={{
                        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                        display: 'grid', placeItems: 'center',
                        background: done ? 'var(--primary)' : current ? 'var(--bg-raised)' : 'var(--bg-soft)',
                        border: `2px solid ${done || current ? 'var(--primary)' : 'var(--border-strong)'}`,
                        boxShadow: current ? '0 0 0 4px var(--primary-ring)' : 'none',
                      }}>
                        {done && <Icons.Check size={11} stroke="#fff" sw={3} />}
                        {current && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Stage labels */}
              <div style={{ display: 'flex', marginTop: 6 }}>
                {STAGES.map((stage, i) => (
                  <div key={stage.key} style={{
                    flex: i === 0 || i === STAGES.length - 1 ? '0 0 22px' : 1,
                    textAlign: 'center', fontSize: 10,
                    color: i === currentIdx ? 'var(--primary)' : 'var(--text-faint)',
                    fontWeight: i === currentIdx ? 700 : 400,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    {stage.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status message */}
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 20,
            fontSize: 13, fontWeight: 500,
            background: order.status === 'returned_to_shop' ? 'oklch(0.60 0.15 150 / 0.08)'
                      : order.status === 'cancelled'        ? 'var(--bg-soft)'
                      : order.status === 'rejected'         ? 'oklch(0.58 0.21 25 / 0.06)'
                      : 'var(--primary-soft)',
            border: `1px solid ${
              order.status === 'returned_to_shop' ? 'oklch(0.60 0.15 150 / 0.25)'
              : order.status === 'cancelled'      ? 'var(--border)'
              : order.status === 'rejected'       ? 'oklch(0.58 0.21 25 / 0.2)'
              : 'var(--primary-ring)'
            }`,
            color: order.status === 'returned_to_shop' ? 'var(--success)'
                 : order.status === 'cancelled'        ? 'var(--text-muted)'
                 : order.status === 'rejected'         ? 'var(--danger)'
                 : 'var(--primary)',
          }}>
            {STATUS_MESSAGES[order.status] ?? order.status_label}
          </div>

          {/* Item breakdown — hidden during the waiting_approval decision flow (items render inside decision panel) */}
          {order.items && order.items.length > 0 && !(order.status === 'waiting_approval' && !submitted) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                الأصناف
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                    background: 'var(--bg-soft)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {item.item_name}
                        {item.quantity > 1 && <span className="mono text-xs text-mute" style={{ marginRight: 4 }}>× {item.quantity}</span>}
                      </div>
                      {item.repair_description && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.repair_description}</div>
                      )}
                    </div>
                    {item.estimated_cost > 0 && (
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-waiting)', flexShrink: 0 }}>
                        {item.estimated_cost} ر.س
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-item approval panel */}
          {order.status === 'waiting_approval' && !submitted && (
            <div style={{
              padding: 20, borderRadius: 'var(--radius)',
              background: 'oklch(0.68 0.15 70 / 0.06)',
              border: '1px solid oklch(0.68 0.15 70 / 0.25)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-waiting)', marginBottom: 4 }}>
                تسعيرة الإصلاح
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                اختر لكل صنف: موافقة أو رفض
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {(order.items ?? []).map(item => (
                  <DecisionRow
                    key={item.sort_order}
                    item={item}
                    decision={decisions[item.sort_order]}
                    onDecide={(d) => setDecisions(prev => ({ ...prev, [item.sort_order]: d }))}
                  />
                ))}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 12, borderTop: '1px solid oklch(0.68 0.15 70 / 0.2)',
                marginBottom: 14,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>الإجمالي</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--status-waiting)' }}>
                  {order.estimated_cost} <span style={{ fontSize: 12, fontWeight: 400 }}>ريال</span>
                </span>
              </div>

              <button
                onClick={handleSubmitDecisions}
                disabled={!allDecided || submitting}
                data-testid="track__confirm"
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 'var(--radius)',
                  background: allDecided ? 'var(--status-waiting)' : 'var(--bg-soft)',
                  color: allDecided ? '#fff' : 'var(--text-faint)',
                  border: allDecided ? 'none' : '1px solid var(--border)',
                  fontWeight: 700, fontSize: 14, cursor: allDecided ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-ui)', opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting
                  ? '...'
                  : allDecided
                    ? 'تأكيد قراري'
                    : !hasDecidable
                      ? 'لا توجد أصناف بحاجة لقرار'
                      : `اختر لكل صنف (${decidableItems.length - Object.keys(decisions).length} متبقية)`}
              </button>
              {submitError && <div style={{ marginTop: 10, fontSize: 12, textAlign: 'center', color: 'var(--danger)' }}>{submitError}</div>}
            </div>
          )}

          {submitted === 'approved' && (
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius)', textAlign: 'center',
              background: 'oklch(0.60 0.15 150 / 0.08)', border: '1px solid oklch(0.60 0.15 150 / 0.25)',
              color: 'var(--success)', fontWeight: 600, fontSize: 13, marginBottom: 20,
            }}>
              <Icons.Check size={14} stroke="var(--success)" /> تمت الموافقة، جارٍ التنفيذ
            </div>
          )}

          {submitted === 'mixed' && (
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius)', textAlign: 'center',
              background: 'oklch(0.60 0.15 150 / 0.06)', border: '1px solid oklch(0.60 0.15 150 / 0.2)',
              color: 'var(--success)', fontWeight: 600, fontSize: 13, marginBottom: 20,
            }}>
              <Icons.Check size={14} stroke="var(--success)" /> تم تسجيل قرارك — سنعمل على الأصناف الموافق عليها فقط
            </div>
          )}

          {submitted === 'rejected' && (
            <div style={{
              padding: '20px 16px', borderRadius: 'var(--radius)', textAlign: 'center',
              background: 'oklch(0.58 0.21 25 / 0.05)', border: '1px solid oklch(0.58 0.21 25 / 0.2)', marginBottom: 20,
            }}>
              <div style={{ fontSize: 22, color: 'var(--danger)', marginBottom: 8 }}>✕</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--danger)', marginBottom: 6 }}>تم رفض الطلب</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>سيتواصل معك الفريق قريباً</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-faint)' }}>
          يُحدَّث تلقائيًا · لا يتطلب إنشاء حساب
        </div>
      </div>
    </div>
  );
}

function DecisionRow({ item, decision, onDecide }) {
  const isFree     = item.estimated_cost === 0 || item.estimated_cost == null;
  const isApproved = item.approval_status === 'approved';
  const isRejected = item.approval_status === 'rejected';
  const isDecidable = item.approval_status === 'pending' && item.estimated_cost > 0;

  const title = (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>
        {item.item_name}
        {item.quantity > 1 && <span className="mono text-xs text-mute" style={{ marginRight: 4 }}>× {item.quantity}</span>}
      </div>
      {item.repair_description && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.repair_description}</div>
      )}
    </div>
  );

  if (isFree || item.approval_status === 'skipped') {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        background: 'var(--bg-soft)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '10px 12px',
      }}>
        {title}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          مجاني — مشمول
        </span>
      </div>
    );
  }

  if (isApproved || isRejected) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        background: 'var(--bg-soft)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '10px 12px', opacity: 0.75,
      }}>
        <div style={{ flex: 1 }}>
          {title}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            قرار سابق: {isApproved ? 'موافق' : 'مرفوض'}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
          {item.estimated_cost} ر.س
        </span>
      </div>
    );
  }

  if (!isDecidable) return null;

  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        {title}
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-waiting)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {item.estimated_cost} ر.س
        </span>
      </div>
      <SegmentedGroup
        value={decision}
        onChange={onDecide}
        options={[
          { value: 'approve', label: '✓ أوافق', variant: 'success' },
          { value: 'reject',  label: '✗ أرفض',  variant: 'danger'  },
        ]}
        testIdPrefix={`track__item__${item.sort_order}`}
        ariaLabel="القرار"
      />
    </div>
  );
}
