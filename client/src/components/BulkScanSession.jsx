import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getRole } from '../api/auth';
import { getAllowedSessionTypes } from '../utils/bulkSessionTypes';
import { patchStatusByBarcode } from '../api/orders';
import { mapErrorToArabic } from '../utils/bulkScanErrors';
import {
  beepSuccess,
  buzzError,
  isMuted as audioIsMuted,
  setMuted as audioSetMuted,
  primeAudio,
} from '../utils/bulkScanAudio';
import BulkScanInput from './BulkScanInput';
import BulkScanList from './BulkScanList';

const BARCODE_RE = /^BR\d+-\d{8}-\d{4}$/;
const ENDING_TIMEOUT_MS = 10_000;

function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function cryptoishId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function BulkScanSession({ onExitBulk }) {
  const role = getRole();
  const allowedTypes = useMemo(() => getAllowedSessionTypes(role), [role]);

  const [phase, setPhase]             = useState('mode_selected'); // mode_selected | scanning | ending | summary
  const [sessionType, setSessionType] = useState(null);
  const [sessionId, setSessionId]     = useState('');
  const [rows, setRows]               = useState([]);
  const [counters, setCounters]       = useState({ done: 0, rejected: 0 });
  const [inputFocused, setInputFocused] = useState(true);
  const [muted, setMutedState]        = useState(audioIsMuted());

  const acceptedSet = useRef(new Set());
  const containerRef = useRef(null);
  const endingTimerRef = useRef(null);

  const pickType = useCallback((t) => {
    primeAudio(); // warm the AudioContext inside this user gesture
    setSessionType(t);
    setSessionId(newSessionId());
    setRows([]);
    setCounters({ done: 0, rejected: 0 });
    acceptedSet.current = new Set();
    setPhase('scanning');
  }, []);

  const endSession = useCallback(() => {
    setPhase('ending');
  }, []);

  const newSession = useCallback(() => {
    // Same session type prefilled per spec.
    setRows([]);
    setCounters({ done: 0, rejected: 0 });
    acceptedSet.current = new Set();
    setSessionId(newSessionId());
    setPhase('scanning');
  }, []);

  const flashExistingRow = useCallback((stamp) => {
    setRows((prev) => prev.map((r) =>
      r.stamp === stamp ? { ...r, flashId: (r.flashId || 0) + 1 } : r
    ));
    buzzError();
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    audioSetMuted(next);
    setMutedState(next);
  }, [muted]);

  const handleScan = useCallback(async (raw) => {
    const value = (raw || '').trim();
    if (!value || !sessionType) return;
    if (phase !== 'scanning') return; // ignore stray keystrokes during ending/summary

    // Malformed
    if (!BARCODE_RE.test(value)) {
      const rowId = cryptoishId();
      setRows((prev) => [
        { id: rowId, stamp: value, status: 'error', reason: mapErrorToArabic({ kind: 'malformed' }, sessionType, role), time: new Date() },
        ...prev,
      ]);
      setCounters((c) => ({ ...c, rejected: c.rejected + 1 }));
      buzzError();
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
      beepSuccess();
    } catch (err) {
      const reason = mapErrorToArabic(err, sessionType, role);
      setRows((prev) => prev.map((r) =>
        r.id === rowId ? { ...r, status: 'error', reason } : r
      ));
      setCounters((c) => ({ ...c, rejected: c.rejected + 1 }));
      buzzError();
    }
  }, [phase, sessionType, sessionId, role, flashExistingRow]);

  // Ending → summary logic.
  // When `ending` is entered: if no pending rows, snap straight to summary.
  // Otherwise wait up to ENDING_TIMEOUT_MS for all pending to resolve. On
  // timeout, force-mark any still-pending rows as 'unresolved' (red border,
  // taxonomy-style message) and count them toward `rejected` so the operator
  // knows to verify manually.
  useEffect(() => {
    if (phase !== 'ending') return;

    const pendingCount = rows.filter((r) => r.status === 'pending').length;
    if (pendingCount === 0) {
      setPhase('summary');
      return;
    }

    endingTimerRef.current = setTimeout(() => {
      setRows((prev) => {
        let forced = 0;
        const next = prev.map((r) => {
          if (r.status === 'pending') {
            forced += 1;
            return { ...r, status: 'error', reason: 'غير مؤكد — راجع السجل' };
          }
          return r;
        });
        if (forced > 0) {
          setCounters((c) => ({ ...c, rejected: c.rejected + forced }));
        }
        return next;
      });
      setPhase('summary');
    }, ENDING_TIMEOUT_MS);

    return () => {
      if (endingTimerRef.current) {
        clearTimeout(endingTimerRef.current);
        endingTimerRef.current = null;
      }
    };
  }, [phase, rows]);

  return (
    <div ref={containerRef}>
      <ModeStrip
        phase={phase}
        sessionType={sessionType}
        counters={counters}
        muted={muted}
        onExitBulk={onExitBulk}
        onEndSession={endSession}
        onNewSession={newSession}
        onToggleMute={toggleMute}
      />

      {phase === 'mode_selected' && (
        <SessionTypeSelector types={allowedTypes} onPick={pickType} />
      )}

      {(phase === 'scanning' || phase === 'ending') && (
        <ScanningSurface
          sessionType={sessionType}
          rows={rows}
          inputFocused={inputFocused}
          onScan={handleScan}
          onFocusChange={setInputFocused}
          containerRef={containerRef}
          phase={phase}
        />
      )}

      {phase === 'summary' && (
        <SummaryCard
          sessionType={sessionType}
          counters={counters}
          rows={rows}
          onNewSession={newSession}
          onExitBulk={onExitBulk}
        />
      )}
    </div>
  );
}

/* ───────────────── Mode strip ───────────────── */

function ModeStrip({ phase, sessionType, counters, muted, onExitBulk, onEndSession, onNewSession, onToggleMute }) {
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

  const muteButton = (
    <MuteToggle muted={muted} onClick={onToggleMute} />
  );

  if (phase === 'mode_selected') {
    return (
      <div style={{ ...base, background: 'oklch(0.95 0.12 90)', color: 'oklch(0.30 0.09 80)' }}
           data-testid="mode-strip-bulk-no-session">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {muteButton}
        </div>
        <span style={{ textAlign: 'center' }}>الوضع الدفعي — اختر نوع الجلسة</span>
        <button className="btn btn-sm" onClick={onExitBulk}>إلغاء الوضع الدفعي</button>
      </div>
    );
  }

  if (phase === 'scanning') {
    return (
      <div style={{ ...base, background: 'oklch(0.82 0.17 70)', color: 'oklch(0.22 0.08 60)' }}
           data-testid="mode-strip-session-active">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {muteButton}
        </div>
        <span style={{ textAlign: 'center' }}>
          مسح دفعي · {sessionType?.label} · {counters.done} تمّ · {counters.rejected} مرفوض
        </span>
        <button className="btn btn-sm" onClick={onEndSession} data-testid="btn-end-session">إنهاء الجلسة</button>
      </div>
    );
  }

  if (phase === 'ending') {
    return (
      <div style={{ ...base, background: 'oklch(0.82 0.17 70)', color: 'oklch(0.22 0.08 60)' }}
           data-testid="mode-strip-ending">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {muteButton}
        </div>
        <span style={{ textAlign: 'center' }}>
          بانتظار إنهاء الطلبات المعلّقة…
        </span>
        <span style={{ minWidth: 80 }} />
      </div>
    );
  }

  // summary
  return (
    <div style={{ ...base, background: 'oklch(0.88 0.14 150)', color: 'oklch(0.24 0.07 150)' }}
         data-testid="mode-strip-summary">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {muteButton}
      </div>
      <span style={{ textAlign: 'center' }}>
        اكتملت الجلسة — {counters.done} طلب تمّ معالجته{counters.rejected > 0 ? ` · ${counters.rejected} مرفوض` : ''}
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={onNewSession} data-testid="btn-new-session">جلسة جديدة</button>
        <button className="btn btn-sm" onClick={onExitBulk} data-testid="btn-exit-bulk">الرجوع للوضع العادي</button>
      </span>
    </div>
  );
}

function MuteToggle({ muted, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
      title={muted ? 'الصوت مكتوم' : 'الصوت مفعّل'}
      data-testid="mute-toggle"
      data-muted={muted ? 'true' : 'false'}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: '1px solid currentColor',
        borderRadius: 999,
        width: 36,
        height: 36,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'inherit',
        opacity: muted ? 0.6 : 1,
      }}
    >
      {muted ? <VolumeXIcon /> : <Volume2Icon />}
    </button>
  );
}

function Volume2Icon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeXIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
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

function ScanningSurface({ sessionType, rows, inputFocused, onScan, onFocusChange, containerRef, phase }) {
  return (
    <div style={{ padding: 24 }}>
      <BulkScanInput
        active={phase === 'scanning'}
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
          {phase === 'scanning'
            ? <ScanReadyBadge focused={inputFocused} />
            : <EndingBadge />}
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

function EndingBadge() {
  return (
    <span data-testid="ending-badge" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12,
      color: 'oklch(0.35 0.12 70)', background: 'oklch(0.92 0.13 80)',
      border: '1px solid oklch(0.82 0.17 70)',
      padding: '6px 12px', borderRadius: 999, fontWeight: 700,
    }}>
      جاري الإنهاء…
    </span>
  );
}

/* ───────────────── Summary card ───────────────── */

function SummaryCard({ sessionType, counters, rows, onNewSession, onExitBulk }) {
  const headline =
    counters.rejected > 0
      ? `اكتملت الجلسة — ${counters.done} طلب تمّ معالجته · ${counters.rejected} مرفوض`
      : `اكتملت الجلسة — ${counters.done} طلب تمّ معالجته`;

  return (
    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
      <div
        className="card"
        data-testid="summary-card"
        style={{ width: '100%', maxWidth: 720, padding: 0, overflow: 'hidden' }}
      >
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'oklch(0.96 0.06 150)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
            {sessionType?.label}
          </div>
          <div
            data-testid="summary-headline"
            style={{ fontSize: 17, fontWeight: 800, color: 'oklch(0.28 0.09 150)' }}
          >
            {headline}
          </div>
        </div>

        <div style={{ padding: 0 }}>
          <BulkScanList rows={rows} />
        </div>

        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button className="btn btn-primary" onClick={onNewSession} data-testid="btn-new-session-card">
            جلسة جديدة
          </button>
          <button className="btn" onClick={onExitBulk} data-testid="btn-exit-bulk-card">
            الرجوع للوضع العادي
          </button>
        </div>
      </div>
    </div>
  );
}
