/**
 * WF-5 — Scheduler unit + integration tests
 *
 * computeTargetStatus() — pure unit, no DB or timers
 * runScheduler()        — integration via getNow stub (avoids Intl.DateTimeFormat/fake-timer friction)
 * POST /api/scheduler/run, GET /api/scheduler/status — HTTP shape
 * scheduler module      — start/stop lifecycle
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const ShiftService = require('../services/ShiftService');
const scheduler    = require('../scheduler');

// Controlled KSA time stubs — passed to runScheduler(getNow)
// 2026-05-04 is a Monday (Sun=0, Mon=1). KSA UTC+3.
const DOW_MONDAY = 1;
const KSA_MONDAY = '2026-05-04';
const NOW_WITHIN  = () => ({ currentTime: '09:00', todayDate: KSA_MONDAY, currentDay: DOW_MONDAY });
const NOW_OUTSIDE = () => ({ currentTime: '22:00', todayDate: KSA_MONDAY, currentDay: DOW_MONDAY });

let wsToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken = jwt.sign({ id: 600, role: 'workshop', username: 'ws-sched', shop_id: null }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

// ─────────────────────────────────────────────────────────────────────────────
// computeTargetStatus — pure unit (no DB, no clock)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTargetStatus()', () => {
  const activeShift = { active: 1, start_time: '08:00', end_time: '18:00' };

  it('off_shift tech within active shift → available', () => {
    expect(ShiftService.computeTargetStatus({ status: 'off_shift' }, activeShift, null, '09:00')).toBe('available');
  });

  it('available tech outside active shift → off_shift', () => {
    expect(ShiftService.computeTargetStatus({ status: 'available' }, activeShift, null, '22:00')).toBe('off_shift');
  });

  it('busy tech within shift → null (scheduler never touches busy)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'busy' }, activeShift, null, '09:00')).toBeNull();
  });

  it('busy tech outside shift → null', () => {
    expect(ShiftService.computeTargetStatus({ status: 'busy' }, activeShift, null, '22:00')).toBeNull();
  });

  it('available tech with no shift today → off_shift', () => {
    expect(ShiftService.computeTargetStatus({ status: 'available' }, null, null, '09:00')).toBe('off_shift');
  });

  it('off_shift tech with no shift today → null (already correct)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'off_shift' }, null, null, '09:00')).toBeNull();
  });

  it('leave beats shift — available with leave within shift hours → on_leave', () => {
    expect(ShiftService.computeTargetStatus({ status: 'available' }, activeShift, { leave_type: 'sick' }, '09:00')).toBe('on_leave');
  });

  it('leave beats shift — off_shift with leave → on_leave', () => {
    expect(ShiftService.computeTargetStatus({ status: 'off_shift' }, activeShift, { leave_type: 'day_off' }, '09:00')).toBe('on_leave');
  });

  it('already available within shift → null (no spurious write)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'available' }, activeShift, null, '09:00')).toBeNull();
  });

  it('already off_shift outside shift → null (no spurious write)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'off_shift' }, activeShift, null, '22:00')).toBeNull();
  });

  it('inactive shift treated as no shift — available becomes off_shift', () => {
    const inactive = { active: 0, start_time: '08:00', end_time: '18:00' };
    expect(ShiftService.computeTargetStatus({ status: 'available' }, inactive, null, '09:00')).toBe('off_shift');
  });

  it('start_time boundary is inclusive (exactly on start)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'off_shift' }, activeShift, null, '08:00')).toBe('available');
  });

  it('end_time boundary is exclusive (exactly on end)', () => {
    expect(ShiftService.computeTargetStatus({ status: 'available' }, activeShift, null, '18:00')).toBe('off_shift');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runScheduler() — integration with getNow stub
// ─────────────────────────────────────────────────────────────────────────────

describe('runScheduler()', () => {
  let techId;

  beforeEach(() => {
    db.prepare(`DELETE FROM technician_leaves`).run();
    db.prepare(`DELETE FROM technician_shifts`).run();
    db.prepare(`DELETE FROM technicians WHERE name LIKE 'sched-%'`).run();
    techId = db.prepare(
      `INSERT INTO technicians (name, status, active) VALUES ('sched-فني', 'off_shift', 1)`
    ).run().lastInsertRowid;
    // Monday shift 08:00–18:00
    db.prepare(
      `INSERT INTO technician_shifts (technician_id, day_of_week, start_time, end_time, active) VALUES (?,?,?,?,1)`
    ).run(techId, DOW_MONDAY, '08:00', '18:00');
  });

  it('off_shift tech within shift window → status becomes available', () => {
    const result = ShiftService.runScheduler(NOW_WITHIN);
    const change = result.changes.find(c => c.tech_id === techId);
    expect(change).toBeDefined();
    expect(change.from).toBe('off_shift');
    expect(change.to).toBe('available');
    expect(db.prepare('SELECT status FROM technicians WHERE id = ?').get(techId).status).toBe('available');
  });

  it('available tech outside shift window → status becomes off_shift', () => {
    db.prepare('UPDATE technicians SET status = ? WHERE id = ?').run('available', techId);
    const result = ShiftService.runScheduler(NOW_OUTSIDE);
    const change = result.changes.find(c => c.tech_id === techId);
    expect(change).toBeDefined();
    expect(change.from).toBe('available');
    expect(change.to).toBe('off_shift');
  });

  it('tech with leave today → status becomes on_leave regardless of shift', () => {
    db.prepare(
      `INSERT INTO technician_leaves (technician_id, leave_date, leave_type) VALUES (?,?,?)`
    ).run(techId, KSA_MONDAY, 'sick');
    const result = ShiftService.runScheduler(NOW_WITHIN);
    const change = result.changes.find(c => c.tech_id === techId);
    expect(change).toBeDefined();
    expect(change.to).toBe('on_leave');
  });

  it('busy tech is never touched by scheduler', () => {
    db.prepare('UPDATE technicians SET status = ? WHERE id = ?').run('busy', techId);
    ShiftService.runScheduler(NOW_WITHIN);
    expect(db.prepare('SELECT status FROM technicians WHERE id = ?').get(techId).status).toBe('busy');
  });

  it('idempotent — second runScheduler() at same time returns no change for same tech', () => {
    ShiftService.runScheduler(NOW_WITHIN); // off_shift → available
    const second = ShiftService.runScheduler(NOW_WITHIN);
    expect(second.changes.find(c => c.tech_id === techId)).toBeUndefined();
  });

  it('return shape has updated, skipped, changes array', () => {
    const result = ShiftService.runScheduler(NOW_WITHIN);
    expect(typeof result.updated).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('each change entry has tech_id, name, from, to', () => {
    const result = ShiftService.runScheduler(NOW_WITHIN);
    const change = result.changes.find(c => c.tech_id === techId);
    expect(change).toMatchObject({ tech_id: techId, name: 'sched-فني', from: 'off_shift', to: 'available' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scheduler/run — HTTP
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/scheduler/run', () => {
  it('200 with { updated, skipped, changes }', async () => {
    const res = await request(app).post('/api/scheduler/run').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('updated');
    expect(res.body).toHaveProperty('skipped');
    expect(Array.isArray(res.body.changes)).toBe(true);
  });

  it('403 for shop_employee', async () => {
    const shopToken = jwt.sign({ id: 601, role: 'shop_employee', username: 'shop-sched', shop_id: 1 }, JWT_SECRET);
    const res = await request(app).post('/api/scheduler/run').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scheduler/status — HTTP
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/scheduler/status', () => {
  it('200 with status snapshot shape', async () => {
    const res = await request(app).get('/api/scheduler/status').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('current_time');
    expect(res.body).toHaveProperty('current_day');
    expect(res.body).toHaveProperty('today_date');
    expect(Array.isArray(res.body.technicians)).toBe(true);
  });

  it('each tech entry has required fields', async () => {
    const res = await request(app).get('/api/scheduler/status').set(auth(wsToken));
    expect(res.status).toBe(200);
    for (const t of res.body.technicians) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('current_status');
      expect(t).toHaveProperty('shift_today');
      expect(t).toHaveProperty('leave_today');
      expect(t).toHaveProperty('would_change_to');
    }
  });

  it('403 for shop_employee', async () => {
    const shopToken = jwt.sign({ id: 602, role: 'shop_employee', username: 'shop-sched2', shop_id: 1 }, JWT_SECRET);
    const res = await request(app).get('/api/scheduler/status').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scheduler module — start / stop lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduler module', () => {
  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  it('stop() is safe when not started', () => {
    expect(() => scheduler.stop()).not.toThrow();
  });

  it('stop() is idempotent — calling twice does not throw', () => {
    expect(() => { scheduler.stop(); scheduler.stop(); }).not.toThrow();
  });

  it('start() + stop() cycle completes without error', () => {
    jest.useFakeTimers();
    expect(() => { scheduler.start(); scheduler.stop(); }).not.toThrow();
  });

  it('start() is idempotent — second call does not double the interval', () => {
    jest.useFakeTimers();
    scheduler.start();
    scheduler.start();
    expect(() => scheduler.stop()).not.toThrow();
  });

  it('interval does not fire before 60 s', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(ShiftService, 'runScheduler');
    scheduler.start();
    jest.advanceTimersByTime(59_000);
    expect(spy).not.toHaveBeenCalled();
    scheduler.stop();
    spy.mockRestore();
  });

  it('interval fires runScheduler after 60 s', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(ShiftService, 'runScheduler').mockReturnValue({ updated: 0, skipped: 0, changes: [] });
    scheduler.start();
    jest.advanceTimersByTime(60_000);
    expect(spy).toHaveBeenCalledTimes(1);
    scheduler.stop();
    spy.mockRestore();
  });
});
