import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getRole } from '../api/auth';
import { getAllowedSessionTypes } from '../utils/bulkSessionTypes';
import { patchStatusByBarcode } from '../api/orders';
import { mapErrorToArabic, DUPLICATE_MSG } from '../utils/bulkScanErrors';
import BulkScanInput from './BulkScanInput';
import BulkScanList from './BulkScanList';

const BARCODE_RE = /^BR\d+-\d{8}-\d{4}$/;

function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export default function BulkScanSession({ onExitBulk }) {
  const role = getRole();
  const allowedTypes = useMemo(() => getAllowedSessionTypes(role), [role]);

  const [phase, setPhase]             = useState('mode_selected'); // 'mode_selected' | 'scanning' | 'ending' | 'summary'
  const [sessionType, setSessionType] = useState(null);
  const [sessionId, setSessionId]     = useState('');
  const [rows, setRows]               = useState([]);
  const [counters, setCounters]       = useState({ done: 0, rejected: 0 });
  const [inputFocused, setInputFocused] = useState(true);

  const acceptedSet = useRef(new Set());
  const containerRef = useRef(null);

  const pickType = useCallback((t) => {
    setSessionType(t);
    setSessionId(newSessionId());
    setRows([]);
    setCounters({ done: 0, rejected: 0 });
    acceptedSet.current = new Set();
    setPhase('scanning');
  }, []);

  const endSession = useCallback(() => {
    setPhase('summary');
  }, []);

  const newSession = useCallback(() => {
    setSessionType(null);
    setSessionId('');
    setRows([]);
    setCounters({ done: 0, rejected: 0 });
    acceptedSet.current = new Set();
    setPhase('mode_selected');
  }, []);

  const flashExistingRow = useCallback((stamp) => {
    setRows((prev) => prev.map((r) =>
      r.stamp === stamp ? { ...r, flashId: (r.flashId || 0) + 1 } : r
    ));
  }, []);

  const handleScan = useCallback(async (raw) => {
    const value = (raw || '').trim();
    if (!value || !sessionType) return;

    // Malformed
    if (!BARCODE_RE.test(value)) {
      const rowId = cryptoishId();
      setRows((prev) => [
        { id: rowId, stamp: value, status: 'error', reason: mapErrorToArabic({ kind: 'malformed' }, sessionType, role), time: new Date() },
        ...prev,
      ]);
      setCounters((c) => ({ ...c, rejected: c.rejected + 1 }));
      return;
    }

    // Duplicate
    if (acceptedSet.current.has(value)) {
      flashExistingRow(value);
      return;
    }

    // Optimistic pending row
    const rowId = cryptoishId();
    setRows((prev) => [
      { id: rowId, stamp: value, status: 'pending', reason: 'جاري المعالجة…', time: new Date() },
      ...prev,
    ]);

    try {
      await patchStatusByBarcode(value, {
        status:       sessionType.targetState,
        source:       'bulk_scan',
        session_id:   sessionId,
        session_type: sessionType.id,
      });
      acceptedSet.current.add(value);
      setRows((prev) => prev.map((r) =>
        r.id === rowId ? { ...r, status: 'success', reason: sessionType.successText } : r
      ));
      setCounters((c) => ({ ...c, done: c.done + 1 }));
    } catch (err) {
      const reason = mapErrorToArabic(err, sessionType, role);
      setRows((prev) => prev.map((r) =>
        r.id === rowId ? { ...r, status: 'error', reason } : r
      ));
      setCounters((c) => ({ ...c, rejected: c.rejected + 1 }));
    }
  }, [sessionType, sessionId, role, flashExistingRow]);

  return (
    <div ref={containerRef}>
      <ModeStrip
        phase={phase}
        sessionType={sessionType}
        counters={counters}
        onExitBulk={onExitBulk}
        onEndSession={endSession}
        onNewSession={newSession}
      />

      {phase === 'mode_selected' && (
        <SessionTypeSelector types={allowedTypes} onPick={pickType} />
      )}

      {phase === 'scanning' && (
        <ScanningSurface
          sessionType={sessionType}
          rows={rows}
          inputFocused={inputFocused}
          onScan={handleScan}
          onFocusChange={setInputFocused}
          containerRef={containerRef}
        />
      )}

      {phase === 'summary' && (
        <SummaryPlaceholder sessionType={sessionType} counters={counters} onNewSession={newSession} onExitBulk={onExitBulk} />
      )}
    </div>
  );
}

function cryptoishId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ───────────────── Mode strip ───────────────── */

function ModeStrip({ phase, sessionType, counters, onExitBulk, onEndSession, onNewSession }) {
  const base = {
    width:       '100%',
    minHeight:   56,
    padding:     '0 20px',
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'space-between',
    gap:         16,
    fontFamily:  'Almarai, sans-serif',
    fontWeight:  700,
    fontSize:    15,
    borderBottom: '1px solid var(--border)',
  };

  if (phase === 'mode_selected') {
    return (
      <div style={{ ...base, background: 'oklch(0.95 0.12 90)', color: 'oklch(0.30 0.09 80)' }}
           data-testid="mode-strip-bulk-no-session">
        <span />
        <span style={{ textAlign: 'center' }}>الوضع الدفعي — اختر نوع الجلسة</span>
        <button className="btn btn-sm" onClick={onExitBulk}>إلغاء الوضع الدفعي</button>
      </div>
    );
  }

  if (phase === 'scanning') {
    return (
      <div style={{ ...base, background: 'oklch(0.82 0.17 70)', color: 'oklch(0.22 0.08 60)' }}
           data-testid="mode-strip-session-active">
        <span />
        <span style={{ textAlign: 'center' }}>
          مسح دفعي · {sessionType?.label} · {counters.done} تمّ · {counters.rejected} مرفوض
        </span>
        <button className="btn btn-sm" onClick={onEndSession}>إنهاء الجلسة</button>
      </div>
    );
  }

  // summary
  return (
    <div style={{ ...base, background: 'oklch(0.88 0.14 150)', color: 'oklch(0.24 0.07 150)' }}
         data-testid="mode-strip-summary">
      <span />
      <span style={{ textAlign: 'center' }}>
        اكتملت الجلسة — {counters.done} طلب تمّ معالجته
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={onNewSession}>جلسة جديدة</button>
        <button className="btn btn-sm" onClick={onExitBulk}>الرجوع للوضع العادي</button>
      </span>
    </div>
  );
}

/* ───────────────── Session-type selector ───────────────── */

function SessionTypeSelector({ types, onPick }) {
  if (types.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        لا تتوفر جلسات دفعية لدورك الحالي.
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="card"
            style={{
              textAlign: 'right', padding: '18px 20px', minHeight: 80,
              border: '1px solid var(--border)', background: 'var(--bg-raised)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
            }}
            data-testid={`session-type-${t.id}`}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span className="chip mono">[{t.sourceStates.join(' | ')}]</span>
              <span>→</span>
              <span className="chip mono">[{t.targetState}]</span>
              <span>·</span>
              <span>{t.roleHint}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── Scanning surface ───────────────── */

function ScanningSurface({ sessionType, rows, inputFocused, onScan, onFocusChange, containerRef }) {
  return (
    <div style={{ padding: 24 }}>
      <BulkScanInput
        active={true}
        onScan={onScan}
        onFocusChange={onFocusChange}
        containerRef={containerRef}
      />

      <div className="card" style={{ padding: 0, position: 'relative' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sessionType?.label}</div>
          <ScanReadyBadge focused={inputFocused} />
        </div>

        <BulkScanList rows={rows} />
      </div>
    </div>
  );
}

function ScanReadyBadge({ focused }) {
  if (focused) {
    return (
      <span data-testid="scan-ready-badge" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12,
        color: 'var(--success)', background: 'oklch(0.56 0.13 150 / 0.10)',
        border: '1px solid oklch(0.56 0.13 150 / 0.28)',
        padding: '6px 12px', borderRadius: 999, fontWeight: 700,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--success)',
          animation: 'bulk-scan-pulse 1.4s ease-out infinite',
        }} />
        جاهز للمسح
        <style>{`
          @keyframes bulk-scan-pulse {
            0%   { box-shadow: 0 0 0 0 oklch(0.56 0.13 150 / 0.55); }
            70%  { box-shadow: 0 0 0 8px oklch(0.56 0.13 150 / 0); }
            100% { box-shadow: 0 0 0 0 oklch(0.56 0.13 150 / 0); }
          }
        `}</style>
      </span>
    );
  }

  return (
    <span data-testid="scan-paused-badge" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12,
      color: 'oklch(0.35 0.12 70)', background: 'oklch(0.92 0.13 80)',
      border: '1px solid oklch(0.82 0.17 70)',
      padding: '6px 12px', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.75 0.16 70)' }} />
      اضغط هنا لاستئناف المسح
    </span>
  );
}

/* ───────────────── Summary placeholder (step 3 — step 4 expands this) ───────────────── */

function SummaryPlaceholder({ sessionType, counters, onNewSession, onExitBulk }) {
  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>اكتملت الجلسة</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {sessionType?.label}
        </div>
        <div style={{ fontSize: 14, marginBottom: 24 }}>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{counters.done} تمّ</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 12px' }}>·</span>
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{counters.rejected} مرفوض</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={onNewSession}>جلسة جديدة</button>
          <button className="btn" onClick={onExitBulk}>الرجوع للوضع العادي</button>
        </div>
      </div>
    </div>
  );
}
