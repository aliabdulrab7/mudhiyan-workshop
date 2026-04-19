import React, { useState } from 'react';
import StatusPill from './StatusPill';
import CostEditor from './CostEditor';
import { updateOrderStatus } from '../api/orders';
import { getRole } from '../api/auth';
import { buildApprovalWaUrl, buildReadyWaUrl, buildTrackingUrl } from '../utils/whatsapp';
import ReadyLabelCanvas from './ReadyLabelCanvas';
import { Icons } from './icons';

export default function ScanResult({ order: initialOrder, onScanAgain, onOrderUpdated }) {
  const [order, setOrder]         = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);
  const [justMarkedReady, setJustMarkedReady] = useState(false);
  const [scanError, setScanError] = useState('');
  const isWorkshop = getRole() === 'workshop';

  function handleOrderUpdate(updated) {
    setOrder(updated);
    onOrderUpdated?.(updated);
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
        <CostEditor order={order} onUpdated={handleOrderUpdate} />
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
          <a href={approvalWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Icons.Phone size={13} /> إرسال رابط الموافقة ↗
            </button>
          </a>
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
          <button
            className="btn btn-primary"
            onClick={markReady}
            disabled={promoting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Icons.Check size={12} /> {promoting ? 'جاري...' : 'تعيين جاهزة للإرجاع'}
          </button>
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
          <a href={readyWaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Icons.Phone size={13} /> إرسال رسالة الاستلام (WhatsApp) ↗
            </button>
          </a>
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
      <button className="btn btn-sm btn-ghost" onClick={onScanAgain} style={{ width: '100%', justifyContent: 'center' }}>
        <Icons.Refresh size={12} /> مسح آخر
      </button>
    </div>
  );
}
