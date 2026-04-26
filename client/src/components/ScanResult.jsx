import React, { useState } from 'react';
import StatusPill from './StatusPill';
import { updateCost, updateOrderStatus } from '../api/orders';
import { getRole } from '../api/auth';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';
import ReadyLabelCanvas from './ReadyLabelCanvas';
import { Icons } from './icons';
import Button from './ui/Button';

export default function ScanResult({ order: initialOrder, onScanAgain, onOrderUpdated }) {
  const [order, setOrder]         = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);
  const [justMarkedReady, setJustMarkedReady] = useState(false);
  const [scanError, setScanError] = useState('');
  const [cost, setCost]           = useState('');
  const [costSaving, setCostSaving] = useState(false);
  const [costError, setCostError] = useState('');
  const isWorkshop = getRole() === 'workshop';

  function handleOrderUpdate(updated) {
    setOrder(updated);
    onOrderUpdated?.(updated);
  }

  async function handleCostSubmit(e) {
    e.preventDefault();
    setCostSaving(true);
    setCostError('');
    try {
      const updated = await updateCost(order.id, parseInt(cost, 10));
      handleOrderUpdate(updated);
      if (updated.status === 'waiting_approval') {
        window.open(
          buildApprovalWaUrl(updated.phone, updated.customer_name, updated.cost, buildTrackingUrl(updated.customer_token)),
          '_blank', 'noopener,noreferrer',
        );
      }
    } catch (err) {
      setCostError(err.message);
    } finally {
      setCostSaving(false);
    }
  }

  const trackingUrl   = buildTrackingUrl(order.customer_token);
  const approvalWaUrl = buildApprovalWaUrl(order.phone, order.customer_name, order.cost, trackingUrl);
  const readyWaUrl    = buildReadyWaUrl(order.phone, order.customer_name, order.order_number);

  async function markReady() {
    setPromoting(true);
    setScanError('');
    try {
      const updated = await updateOrderStatus(order.id, 'ready_for_return');
      handleOrderUpdate(updated);
      if (updated.status === 'ready_for_return') setJustMarkedReady(true);
    } catch (e) {
      setScanError(e.message || 'تعذّر تحديث الحالة');
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div style={{ padding: '14px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'oklch(0.60 0.15 150 / 0.12)',
          border: '1px solid oklch(0.60 0.15 150 / 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.Check size={14} stroke="var(--success)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>تم العثور على الطلب</div>
          <span className="stamp" style={{ fontSize: 11 }}>{order.order_number}</span>
        </div>
        <div style={{ marginRight: 'auto' }}>
          <StatusPill status={order.status} size="sm" />
        </div>
      </div>

      {/* KV grid */}
      <div className="kv-grid" style={{ marginBottom: 16 }}>
        <span className="k">العميل</span>
        <span className="v" style={{ fontWeight: 600 }}>{order.customer_name}</span>

        <span className="k">القطعة</span>
        <span className="v">{order.piece_type}</span>

        <span className="k">الجوال</span>
        <span className="v mono" style={{ direction: 'ltr', textAlign: 'right' }}>+{order.phone}</span>

        {order.cost > 0 && <>
          <span className="k">التكلفة</span>
          <span className="v" style={{ fontWeight: 600 }}>{order.cost} ريال</span>
        </>}

        {order.notes && <>
          <span className="k">ملاحظات</span>
          <span className="v">{order.notes}</span>
        </>}
      </div>

      {/* Cost editor — workshop + received, not locked */}
      {isWorkshop && !order.locked_at && order.status === 'received' && (
        <div style={{
          background: 'var(--primary-soft)',
          border: '1px solid var(--border)',
          borderRight: '3px solid var(--primary)',
          borderRadius: 'var(--radius)',
          padding: '14px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '10px', fontWeight: 600 }}>
            تحديد تكلفة الإصلاح
          </div>
          <form onSubmit={handleCostSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                className="input-base"
                type="number"
                min="0"
                placeholder="0 (مجاني)"
                value={cost}
                onChange={e => setCost(e.target.value)}
                required
                style={{ direction: 'ltr', textAlign: 'left' }}
                data-testid="cost-editor__input"
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                بالريال السعودي — أدخل 0 للخدمة المجانية
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={costSaving}
              disabled={cost === ''}
              style={{ padding: '10px 16px', fontSize: '0.88rem', flexShrink: 0 }}
              testId="cost-editor__submit"
            >
              {costSaving ? '...' : 'تأكيد'}
            </Button>
          </form>
          {costError && (
            <div style={{ color: '#DC2626', fontSize: '0.82rem', marginTop: '8px' }}>{costError}</div>
          )}
        </div>
      )}

      {/* Approval link — waiting_approval */}
      {!order.locked_at && order.status === 'waiting_approval' && (
        <div style={{
          background: 'oklch(0.80 0.12 80 / 0.08)',
          border: '1px solid oklch(0.80 0.12 80 / 0.25)',
          borderRight: '3px solid oklch(0.75 0.15 80)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            أرسل رابط الموافقة للعميل ({order.cost} ريال)
          </div>
          <Button
            as="a"
            href={approvalWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            icon={<Icons.Phone size={13} />}
            className="w-full justify-center no-underline"
            testId="scan-result__approval-link"
          >
            إرسال رابط الموافقة ↗
          </Button>
        </div>
      )}

      {/* Mark ready — workshop + in_repair, not locked */}
      {isWorkshop && !order.locked_at && order.status === 'in_repair' && (
        <div style={{
          background: 'var(--primary-soft)',
          border: '1px solid oklch(0.55 0.19 270 / 0.2)',
          borderRight: '3px solid var(--primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            هل الصيانة جاهزة للإرجاع للفرع؟
          </div>
          <Button
            variant="primary"
            onClick={markReady}
            loading={promoting}
            icon={!promoting ? <Icons.Check size={12} /> : null}
            className="w-full justify-center"
            testId="scan-result__mark-ready"
          >
            {promoting ? 'جاري...' : 'تعيين جاهزة للإرجاع'}
          </Button>
        </div>
      )}

      {/* Pickup wa.me — ready_for_return */}
      {!order.locked_at && order.status === 'ready_for_return' && (
        <div style={{
          background: 'oklch(0.60 0.15 150 / 0.06)',
          border: '1px solid oklch(0.60 0.15 150 / 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
            القطعة جاهزة — أبلغ الفرع بالاستلام
          </div>
          <Button
            as="a"
            href={readyWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            icon={<Icons.Phone size={13} />}
            className="w-full justify-center no-underline"
            testId="scan-result__ready-link"
          >
            إرسال رسالة الاستلام (WhatsApp) ↗
          </Button>
        </div>
      )}

      {/* Ready label — workshop + ready_for_return */}
      {isWorkshop && !order.locked_at && order.status === 'ready_for_return' && (
        <div style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            ملصق الجاهزية
          </div>
          <ReadyLabelCanvas order={order} autoPrint={justMarkedReady} />
        </div>
      )}

      {/* Error */}
      {scanError && (
        <div style={{
          padding: '10px 14px', marginBottom: 12,
          background: 'oklch(0.58 0.21 25 / 0.06)',
          border: '1px solid oklch(0.58 0.21 25 / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger)', fontSize: 12.5,
        }}>
          {scanError}
        </div>
      )}

      {/* Scan again */}
      <Button
        variant="ghost"
        size="sm"
        icon={<Icons.Refresh size={12} />}
        onClick={onScanAgain}
        className="w-full justify-center"
        testId="scan-result__scan-again"
      >
        مسح آخر
      </Button>
    </div>
  );
}
