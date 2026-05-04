import { useState, useEffect, useRef, useCallback } from 'react';
import { getTechniciansPicker } from '../api/technicians';
import { getOrderByBarcode, bulkAssignTechnician } from '../api/orders';
import { beepSuccess, buzzError, primeAudio } from '../utils/bulkScanAudio';
import BulkScanInput from '../components/BulkScanInput';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Icons } from '../components/icons';
import { useToast } from '../components/ToastProvider';

const STATUS_DOT = {
  available: 'var(--success)',
  busy:      'oklch(0.65 0.13 60)',
  off_shift: 'var(--text-faint)',
  on_leave:  'var(--danger)',
};

const STATUS_LABEL = {
  available: 'متاح',
  busy:      'مشغول',
  off_shift: 'خارج الدوام',
  on_leave:  'في إجازة',
};

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || '?')[0].toUpperCase();
}

function WorkloadBar({ activeCount }) {
  const pct   = Math.min(100, (activeCount || 0) * 10);
  const heavy = (activeCount || 0) >= 7;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-soft)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: heavy ? 'var(--danger)' : 'var(--success)',
          borderRadius: 3,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
        {activeCount || 0} طلب نشط
      </span>
    </div>
  );
}

function TechCard({ tech, onSelect }) {
  const pct   = Math.min(100, (tech.active_count || 0) * 10);
  const heavy = (tech.active_count || 0) >= 7;
  return (
    <div
      onClick={() => onSelect(tech)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: '#fff',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
        color: 'var(--text)',
      }}>
        {getInitials(tech.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{tech.name}</span>
          <span style={{ fontSize: 10, color: STATUS_DOT[tech.status] || 'var(--text-faint)' }}>
            ● {STATUS_LABEL[tech.status] || tech.status}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
          {tech.role_name || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--bg-soft)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: heavy ? 'var(--danger)' : 'oklch(0.6 0.14 150)',
              borderRadius: 2,
            }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
            {tech.active_count || 0}/10
          </span>
        </div>
      </div>
      <Icons.ChevLeft size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
    </div>
  );
}

function ScanEntry({ entry }) {
  const time = entry.scannedAt
    ? entry.scannedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const iconEl = entry.status === 'loading'
    ? <Icons.Refresh size={14} style={{ color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
    : entry.status === 'ok'
      ? <Icons.Check size={14} style={{ color: 'var(--success)' }} />
      : <Icons.X size={14} style={{ color: 'var(--danger)' }} />;

  const rowBg = entry.status === 'ok'
    ? 'oklch(0.98 0.02 150)'
    : entry.status === 'err' || entry.status === 'dupe'
      ? 'oklch(0.98 0.02 25)'
      : '#fff';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      borderBottom: '1px solid var(--border)',
      background: rowBg,
    }}>
      <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {time}
      </span>
      <span style={{ flexShrink: 0 }}>{iconEl}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--text-faint)',
            direction: 'ltr', textAlign: 'start',
          }}>
            {entry.barcode}
          </span>
          {entry.orderNum && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
              {entry.orderNum}
            </span>
          )}
        </div>
        {entry.customerName && (
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 1 }}>
            {entry.customerName}
          </div>
        )}
        {entry.errorMsg && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 1 }}>
            {entry.errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BulkAssignPage() {
  const toast = useToast();
  const containerRef = useRef(null);

  const [phase, setPhase]               = useState('pick');
  const [techSearch, setTechSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techs, setTechs]               = useState([]);
  const [techsLoading, setTechsLoading] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [entries, setEntries]           = useState([]);
  const [scanFocused, setScanFocused]   = useState(false);
  const [committing, setCommitting]     = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  const processingRef    = useRef(new Set()); // barcodes in-flight
  const scannedIdsRef    = useRef(new Set()); // order IDs added to session

  useEffect(() => { document.title = 'تعيين جماعي | مضيان'; }, []);

  useEffect(() => {
    if (phase !== 'pick') return;
    let alive = true;
    setTechsLoading(true);
    getTechniciansPicker({ q: techSearch || undefined, status: statusFilter, limit: 50 })
      .then(data => {
        if (!alive) return;
        setTechs(Array.isArray(data) ? data : (data.items ?? []));
      })
      .catch(() => {})
      .finally(() => { if (alive) setTechsLoading(false); });
    return () => { alive = false; };
  }, [techSearch, statusFilter, phase]);

  function selectTech(tech) {
    primeAudio();
    setSelectedTech(tech);
    setEntries([]);
    setCommitResult(null);
    processingRef.current.clear();
    scannedIdsRef.current.clear();
    setPhase('scan');
  }

  function changeTech() {
    setPhase('pick');
  }

  const handleScan = useCallback(async (barcode) => {
    if (processingRef.current.has(barcode)) return;
    processingRef.current.add(barcode);

    const rowId     = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
    const scannedAt = new Date();

    setEntries(prev => [{
      id: rowId, barcode, status: 'loading',
      orderId: null, orderNum: null, customerName: null, errorMsg: null, scannedAt,
    }, ...prev]);

    try {
      const order = await getOrderByBarcode(barcode);

      if (scannedIdsRef.current.has(order.id)) {
        setEntries(prev => prev.map(r => r.id !== rowId ? r : {
          ...r, status: 'dupe',
          orderId: order.id, orderNum: order.order_number, customerName: order.customer_name,
          errorMsg: 'مسوح مسبقاً',
        }));
        buzzError();
      } else {
        scannedIdsRef.current.add(order.id);
        setEntries(prev => prev.map(r => r.id !== rowId ? r : {
          ...r, status: 'ok',
          orderId: order.id, orderNum: order.order_number, customerName: order.customer_name,
        }));
        beepSuccess();
      }
    } catch (e) {
      setEntries(prev => prev.map(r => r.id !== rowId ? r : {
        ...r, status: 'err',
        errorMsg: e.message || 'طلب غير موجود',
      }));
      buzzError();
    } finally {
      processingRef.current.delete(barcode);
    }
  }, []);

  async function handleCommit() {
    const orderIds = entries.filter(e => e.status === 'ok').map(e => e.orderId);
    if (orderIds.length === 0) return;
    setCommitting(true);
    try {
      const result = await bulkAssignTechnician(orderIds, selectedTech.id);
      setCommitResult({ ok: true, ordersUpdated: result.orders_updated, itemsUpdated: result.items_updated });
      setPhase('done');
    } catch (e) {
      toast(e.message || 'فشل التعيين الجماعي', 'error');
    } finally {
      setCommitting(false);
    }
  }

  function newSession() {
    setEntries([]);
    setCommitResult(null);
    processingRef.current.clear();
    scannedIdsRef.current.clear();
    setPhase('scan');
  }

  const okCount  = entries.filter(e => e.status === 'ok').length;
  const errCount = entries.filter(e => e.status === 'err' || e.status === 'dupe').length;
  const total    = entries.length;

  /* ── Phase: pick technician ─────────────────────── */
  if (phase === 'pick') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>تعيين جماعي للفني</h1>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
            اختر فنياً ثم امسح باركودات الطلبات لتعيينها دفعة واحدة
          </p>
        </div>

        {/* Search + status filter */}
        <div style={{ marginBottom: 12 }}>
          <Input
            value={techSearch}
            onChange={e => setTechSearch(e.target.value)}
            placeholder="بحث بالاسم…"
            size="sm"
          />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { v: 'all',       label: 'الكل' },
            { v: 'available', label: 'متاح' },
            { v: 'busy',      label: 'مشغول' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: statusFilter === f.v ? 'var(--text)' : '#fff',
                color:      statusFilter === f.v ? '#fff' : 'var(--text)',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tech list */}
        <div style={{
          border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff',
        }}>
          {techsLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              جاري التحميل…
            </div>
          )}
          {!techsLoading && techs.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              لا يوجد فنيون
            </div>
          )}
          {!techsLoading && techs.map(tech => (
            <TechCard key={tech.id} tech={tech} onSelect={selectTech} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Phase: done ─────────────────────────────────── */
  if (phase === 'done') {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'oklch(0.95 0.08 150)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Icons.Check size={28} style={{ color: 'var(--success)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>تم التعيين بنجاح</h2>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '0 0 24px' }}>
          تم تعيين {commitResult?.ordersUpdated ?? okCount} طلب
          ({commitResult?.itemsUpdated ?? '—'} صنف)
          للفني <strong>{selectedTech?.name}</strong>
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="primary" onClick={newSession}>
            جلسة جديدة — نفس الفني
          </Button>
          <Button variant="ghost" onClick={changeTech}>
            تغيير الفني
          </Button>
        </div>
      </div>
    );
  }

  /* ── Phase: scan ─────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <BulkScanInput
        active={phase === 'scan'}
        onScan={handleScan}
        onFocusChange={setScanFocused}
        containerRef={containerRef}
      />

      {/* ── Left: selected tech ── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderInlineEnd: '1px solid var(--border)',
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        overflow: 'auto',
      }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            الفني المعيَّن
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--bg-soft)', border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0, color: 'var(--text)',
            }}>
              {getInitials(selectedTech?.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedTech?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                {selectedTech?.role_name || '—'}
              </div>
              <div style={{ fontSize: 10, color: STATUS_DOT[selectedTech?.status], marginTop: 1 }}>
                ● {STATUS_LABEL[selectedTech?.status] || selectedTech?.status}
              </div>
            </div>
          </div>
          <WorkloadBar activeCount={selectedTech?.active_count} />
        </div>
        <div style={{ padding: 12 }}>
          <Button variant="ghost" size="sm" onClick={changeTech} style={{ width: '100%' }}>
            تغيير الفني
          </Button>
        </div>

        {/* Session summary in left panel */}
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            ملخص الجلسة
          </div>
          <StatRow label="إجمالي المسح" value={total} />
          <StatRow label="سيُعيَّن" value={okCount} valueColor="var(--success)" />
          <StatRow label="مشاكل" value={errCount} valueColor={errCount > 0 ? 'var(--danger)' : undefined} />
        </div>

        {/* Commit button */}
        <div style={{ padding: '0 12px 14px', marginTop: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleCommit}
            loading={committing}
            disabled={okCount === 0 || committing}
            style={{ width: '100%' }}
          >
            تعيين {okCount > 0 ? okCount : ''} طلب
          </Button>
          {okCount === 0 && total > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 6 }}>
              لا توجد طلبات صالحة للتعيين
            </div>
          )}
        </div>
      </div>

      {/* ── Center: scan area + log ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Scan target */}
        <div style={{
          margin: 12,
          borderRadius: 8,
          background: 'oklch(0.14 0.01 250)',
          minHeight: 110,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, flexShrink: 0,
        }}>
          <Icons.QR size={32} stroke="oklch(0.35 0.01 250)" />
          <div style={{
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: scanFocused ? 'oklch(0.68 0.18 150)' : 'oklch(0.45 0.01 250)',
            transition: 'color 0.2s',
          }}>
            {scanFocused ? '● ready — scan barcode' : '○ click here to focus'}
          </div>
        </div>

        {/* Scan log */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
          {entries.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              لا توجد عمليات مسح بعد
            </div>
          )}
          {entries.map(entry => (
            <ScanEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: valueColor || 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}
