// Bulk-scan audio: one short tone per scan outcome. Two design constraints
// drive the shape of this module:
//
//   1. Autoplay policy. Safari + iOS Safari require the first AudioContext to
//      be created (or resumed) inside a user gesture. We therefore don't
//      create the context at module load — ensureContext() is called on the
//      first session-start click, which is a gesture.
//
//   2. Tab suspension. When the user backgrounds the tab, the AudioContext is
//      suspended by the browser. A visibilitychange listener resumes it so
//      the first beep after returning isn't silently dropped.
//
// Mute state is persisted in localStorage. We deliberately *don't* fire beeps
// when muted — ensureContext() short-circuits — so a muted user never pays
// the autoplay cost on first session start.

const LS_KEY = 'bulkScanMuted';

let ctx    = null;
let muted  = readMutedFromStorage();
let visibilityHooked = false;

function readMutedFromStorage() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMutedToStorage(v) {
  try {
    localStorage.setItem(LS_KEY, v ? '1' : '0');
  } catch {
    /* ignore quota / disabled storage */
  }
}

function hookVisibilityOnce() {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  });
}

// Lazy singleton. Only called from a user-gesture path (session start click
// or mute toggle) so the autoplay policy is satisfied.
function ensureContext() {
  if (muted) return null;
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    hookVisibilityOnce();
    return ctx;
  } catch {
    return null;
  }
}

// Internal: play a single-oscillator tone with a quick gain envelope so the
// tone doesn't click on start/stop.
function tone({ type, freq, durationMs, gain }) {
  const c = ensureContext();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type            = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.005);
  g.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function beepSuccess() {
  tone({ type: 'sine', freq: 800, durationMs: 80, gain: 0.18 });
}

export function buzzError() {
  tone({ type: 'sawtooth', freq: 200, durationMs: 200, gain: 0.22 });
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = Boolean(v);
  writeMutedToStorage(muted);
  // If unmuting, take the opportunity to warm the context in the same gesture.
  if (!muted) ensureContext();
}

// Exposed for the session-start click so we can create/resume the context
// inside the gesture even before the first scan resolves.
export function primeAudio() {
  ensureContext();
}
