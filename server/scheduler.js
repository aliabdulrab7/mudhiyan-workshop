/**
 * Automated shift scheduler — runs every 60 seconds to flip technician
 * statuses based on their shift schedule and leave records.
 *
 * `_timer.unref()` means the interval does not prevent the Node.js process
 * from exiting cleanly — no SIGTERM needed if the server is stopped.
 *
 * In NODE_ENV=test this module still exports start/stop, but index.js guards
 * the call so Jest never starts the interval (avoids open handles + fake-timer
 * interference). Tests that need runScheduler() call it directly on ShiftService.
 */

const ShiftService = require('./services/ShiftService');

const INTERVAL_MS = 60_000;
let _timer = null;

function start() {
  if (_timer) return;
  _timer = setInterval(() => {
    try {
      ShiftService.runScheduler();
    } catch (err) {
      console.error('[scheduler] runScheduler error:', err.message);
    }
  }, INTERVAL_MS);
  _timer.unref();
  console.log('[scheduler] started (60s interval)');
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { start, stop };
