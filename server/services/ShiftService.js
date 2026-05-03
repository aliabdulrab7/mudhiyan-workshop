/**
 * ShiftService — Shift schedules + leave management + automated scheduler.
 *
 * Mirrors TechnicianService layering: routes call the service, typed errors
 * bubble up to the global error handler. Completely separate from
 * TechnicianService — only calls TechnicianService.changeStatus() for status
 * transitions so the audit log is written correctly.
 *
 * KSA timezone (Asia/Riyadh) is explicit in runScheduler() — the workshop
 * operates in KSA local time. Do not rely on server TZ env variable.
 */

const { db } = require('../db');
const { ValidationError } = require('../errors');
const TechnicianService = require('./TechnicianService');

const LEAVE_TYPES = ['day_off', 'sick', 'vacation'];

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function notFound(name, id) {
  const err = new Error(`${name} ${id} not found`);
  err.name = 'NotFoundError';
  return err;
}

function requireTech(technicianId) {
  const tech = db.prepare('SELECT id FROM technicians WHERE id = ?').get(technicianId);
  if (!tech) throw notFound('Technician', technicianId);
  return tech;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shifts CRUD
// ─────────────────────────────────────────────────────────────────────────────

function getShifts(technicianId) {
  requireTech(technicianId);
  const shifts = db.prepare(`
    SELECT id, day_of_week, start_time, end_time, active
    FROM technician_shifts
    WHERE technician_id = ?
    ORDER BY day_of_week
  `).all(technicianId);
  const leaves = db.prepare(`
    SELECT id, leave_date, leave_type, notes
    FROM technician_leaves
    WHERE technician_id = ?
    ORDER BY leave_date
  `).all(technicianId);
  return { shifts, leaves };
}

function upsertShift(technicianId, dayOfWeek, startTime, endTime) {
  requireTech(technicianId);

  const day = parseInt(dayOfWeek, 10);
  if (!Number.isFinite(day) || day < 0 || day > 6) {
    throw new ValidationError('day_of_week يجب أن يكون بين 0 و 6');
  }
  if (!TIME_RE.test(startTime)) {
    throw new ValidationError('start_time يجب أن يكون بصيغة HH:MM');
  }
  if (!TIME_RE.test(endTime)) {
    throw new ValidationError('end_time يجب أن يكون بصيغة HH:MM');
  }
  if (startTime >= endTime) {
    throw new ValidationError('start_time يجب أن يكون قبل end_time');
  }

  db.prepare(`
    INSERT INTO technician_shifts (technician_id, day_of_week, start_time, end_time, active)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(technician_id, day_of_week) DO UPDATE SET
      start_time = excluded.start_time,
      end_time   = excluded.end_time,
      active     = 1
  `).run(technicianId, day, startTime, endTime);

  return db.prepare(
    'SELECT * FROM technician_shifts WHERE technician_id = ? AND day_of_week = ?'
  ).get(technicianId, day);
}

function deleteShift(technicianId, dayOfWeek) {
  requireTech(technicianId);
  const day = parseInt(dayOfWeek, 10);
  if (!Number.isFinite(day) || day < 0 || day > 6) {
    throw new ValidationError('day_of_week يجب أن يكون بين 0 و 6');
  }
  db.prepare(
    'UPDATE technician_shifts SET active = 0 WHERE technician_id = ? AND day_of_week = ?'
  ).run(technicianId, day);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaves CRUD
// ─────────────────────────────────────────────────────────────────────────────

function upsertLeave(technicianId, leaveDate, leaveType = 'day_off', notes = null, createdBy = null) {
  requireTech(technicianId);

  if (!DATE_RE.test(leaveDate)) {
    throw new ValidationError('leave_date يجب أن يكون بصيغة YYYY-MM-DD');
  }
  if (!LEAVE_TYPES.includes(leaveType)) {
    throw new ValidationError(`leave_type غير صحيح — القيم المقبولة: ${LEAVE_TYPES.join(', ')}`);
  }

  const safeCreatedBy = createdBy != null
    ? (db.prepare('SELECT 1 FROM users WHERE id = ?').get(createdBy) ? createdBy : null)
    : null;

  db.prepare(`
    INSERT INTO technician_leaves (technician_id, leave_date, leave_type, notes, created_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(technician_id, leave_date) DO UPDATE SET
      leave_type = excluded.leave_type,
      notes      = excluded.notes,
      created_by = excluded.created_by
  `).run(technicianId, leaveDate, leaveType, notes ?? null, safeCreatedBy);

  return db.prepare(
    'SELECT * FROM technician_leaves WHERE technician_id = ? AND leave_date = ?'
  ).get(technicianId, leaveDate);
}

function deleteLeave(technicianId, leaveDate) {
  requireTech(technicianId);
  if (!DATE_RE.test(leaveDate)) {
    throw new ValidationError('leave_date يجب أن يكون بصيغة YYYY-MM-DD');
  }
  db.prepare(
    'DELETE FROM technician_leaves WHERE technician_id = ? AND leave_date = ?'
  ).run(technicianId, leaveDate);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler helpers — KSA timezone (Asia/Riyadh) explicit throughout
// ─────────────────────────────────────────────────────────────────────────────

const KSA_LOCALE = 'en-CA'; // ISO-style date formatting

function getKSANow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);

  const get = type => parts.find(p => p.type === type)?.value ?? '';
  const hour   = get('hour').padStart(2, '0');
  const minute = get('minute').padStart(2, '0');
  const day    = get('day').padStart(2, '0');
  const month  = get('month').padStart(2, '0');
  const year   = get('year');

  const currentTime = `${hour}:${minute}`;
  const todayDate   = `${year}-${month}-${day}`;
  // getDay()-equivalent in KSA: use Intl weekday
  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh', weekday: 'short',
  }).format(now);
  const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentDay = DOW_MAP[dayOfWeek];

  return { currentTime, todayDate, currentDay };
}

function computeTargetStatus(tech, shift, leave, currentTime) {
  if (leave) return 'on_leave';
  if (shift && shift.active) {
    if (currentTime >= shift.start_time && currentTime < shift.end_time) {
      // Within shift — only promote off_shift → available; never touch busy/on_leave
      return tech.status === 'off_shift' ? 'available' : null;
    } else {
      // Outside shift — only demote available → off_shift; never touch busy/on_leave
      return tech.status === 'available' ? 'off_shift' : null;
    }
  }
  // No active shift today → should be off_shift
  return tech.status === 'available' ? 'off_shift' : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// getSchedulerStatus — snapshot of what the scheduler would do right now.
// ─────────────────────────────────────────────────────────────────────────────

function getSchedulerStatus(getNow = getKSANow) {
  const { currentTime, todayDate, currentDay } = getNow();

  const techs = db.prepare(`
    SELECT id, name, status FROM technicians WHERE active = 1
  `).all();

  const technicianSummaries = techs.map(tech => {
    const shift = db.prepare(`
      SELECT start_time, end_time, active FROM technician_shifts
      WHERE technician_id = ? AND day_of_week = ? AND active = 1
    `).get(tech.id, currentDay);

    const leave = db.prepare(`
      SELECT leave_type FROM technician_leaves
      WHERE technician_id = ? AND leave_date = ?
    `).get(tech.id, todayDate);

    const wouldChangeTo = computeTargetStatus(tech, shift, leave, currentTime);

    return {
      id:             tech.id,
      name:           tech.name,
      current_status: tech.status,
      shift_today:    shift ? { start_time: shift.start_time, end_time: shift.end_time } : null,
      leave_today:    leave ? { leave_type: leave.leave_type } : null,
      would_change_to: wouldChangeTo,
    };
  });

  return { current_time: currentTime, current_day: currentDay, today_date: todayDate, technicians: technicianSummaries };
}

// ─────────────────────────────────────────────────────────────────────────────
// runScheduler — apply status changes for all active techs.
// Safe to call repeatedly — idempotent when status already matches target.
// ─────────────────────────────────────────────────────────────────────────────

function runScheduler(getNow = getKSANow) {
  const { currentTime, todayDate, currentDay } = getNow();

  const techs = db.prepare(`
    SELECT id, name, status FROM technicians WHERE active = 1
  `).all();

  let updated = 0;
  let skipped = 0;
  const changes = [];

  for (const tech of techs) {
    const shift = db.prepare(`
      SELECT start_time, end_time, active FROM technician_shifts
      WHERE technician_id = ? AND day_of_week = ? AND active = 1
    `).get(tech.id, currentDay);

    const leave = db.prepare(`
      SELECT leave_type FROM technician_leaves
      WHERE technician_id = ? AND leave_date = ?
    `).get(tech.id, todayDate);

    const target = computeTargetStatus(tech, shift, leave, currentTime);
    if (!target || target === tech.status) {
      skipped++;
      continue;
    }

    TechnicianService.changeStatus(tech.id, target, { reason: 'scheduler' });
    changes.push({ tech_id: tech.id, name: tech.name, from: tech.status, to: target });
    updated++;
  }

  return { updated, skipped, changes };
}

module.exports = {
  getShifts,
  upsertShift,
  deleteShift,
  upsertLeave,
  deleteLeave,
  getSchedulerStatus,
  runScheduler,
  // Exposed for tests
  getKSANow,
  computeTargetStatus,
};
