/**
 * WF-5 — Shift + leave endpoint integration tests
 *
 * GET /api/technicians/:id/shifts
 * PUT /api/technicians/:id/shifts/:dayOfWeek
 * DELETE /api/technicians/:id/shifts/:dayOfWeek
 * PUT /api/technicians/:id/leaves/:leaveDate
 * DELETE /api/technicians/:id/leaves/:leaveDate
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 500, role: 'workshop',      username: 'ws5',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 501, role: 'shop_employee', username: 'shop5', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

let techId;

function reset() {
  db.prepare(`DELETE FROM technician_leaves`).run();
  db.prepare(`DELETE FROM technician_shifts`).run();
  db.prepare(`DELETE FROM technicians WHERE name LIKE 'wf5-%'`).run();
  techId = db.prepare(
    `INSERT INTO technicians (name, status, active) VALUES ('wf5-فني', 'available', 1)`
  ).run().lastInsertRowid;
}

beforeEach(reset);

// ─────────────────────────────────────────────────────────────────────────────
// GET /shifts — baseline
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/:id/shifts', () => {
  it('returns { shifts: [], leaves: [] } for a new tech', async () => {
    const res = await request(app).get(`/api/technicians/${techId}/shifts`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ shifts: [], leaves: [] });
  });

  it('returns shifts and leaves after insert', async () => {
    db.prepare(
      `INSERT INTO technician_shifts (technician_id, day_of_week, start_time, end_time) VALUES (?,?,?,?)`
    ).run(techId, 0, '08:00', '17:00');
    db.prepare(
      `INSERT INTO technician_leaves (technician_id, leave_date, leave_type) VALUES (?,?,?)`
    ).run(techId, '2026-06-01', 'sick');

    const res = await request(app).get(`/api/technicians/${techId}/shifts`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.shifts.length).toBe(1);
    expect(res.body.shifts[0].day_of_week).toBe(0);
    expect(res.body.leaves.length).toBe(1);
    expect(res.body.leaves[0].leave_type).toBe('sick');
  });

  it('404 for unknown tech id', async () => {
    const res = await request(app).get('/api/technicians/999999/shifts').set(auth(wsToken));
    expect(res.status).toBe(404);
  });

  it('403 for shop_employee', async () => {
    const res = await request(app).get(`/api/technicians/${techId}/shifts`).set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /shifts/:dayOfWeek
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/technicians/:id/shifts/:dayOfWeek', () => {
  it('creates a new shift row', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/1`)
      .set(auth(wsToken))
      .send({ start_time: '09:00', end_time: '18:00' });
    expect(res.status).toBe(200);
    expect(res.body.day_of_week).toBe(1);
    expect(res.body.start_time).toBe('09:00');
    expect(res.body.end_time).toBe('18:00');
    expect(res.body.active).toBe(1);
  });

  it('upsert same day updates instead of erroring', async () => {
    await request(app)
      .put(`/api/technicians/${techId}/shifts/2`)
      .set(auth(wsToken))
      .send({ start_time: '08:00', end_time: '16:00' });

    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/2`)
      .set(auth(wsToken))
      .send({ start_time: '10:00', end_time: '20:00' });
    expect(res.status).toBe(200);
    expect(res.body.start_time).toBe('10:00');

    const count = db.prepare(
      `SELECT COUNT(*) AS n FROM technician_shifts WHERE technician_id = ? AND day_of_week = 2`
    ).get(techId).n;
    expect(count).toBe(1);
  });

  it('422 for day_of_week out of range', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/7`)
      .set(auth(wsToken))
      .send({ start_time: '09:00', end_time: '18:00' });
    expect(res.status).toBe(422);
  });

  it('422 for bad time format', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/3`)
      .set(auth(wsToken))
      .send({ start_time: '9:00', end_time: '18:00' });
    expect(res.status).toBe(422);
  });

  it('422 when start_time >= end_time', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/4`)
      .set(auth(wsToken))
      .send({ start_time: '18:00', end_time: '09:00' });
    expect(res.status).toBe(422);
  });

  it('403 for shop_employee', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/shifts/0`)
      .set(auth(shopToken))
      .send({ start_time: '09:00', end_time: '17:00' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /shifts/:dayOfWeek
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/technicians/:id/shifts/:dayOfWeek', () => {
  it('soft-deletes an existing shift (active=0)', async () => {
    db.prepare(
      `INSERT INTO technician_shifts (technician_id, day_of_week, start_time, end_time) VALUES (?,?,?,?)`
    ).run(techId, 3, '08:00', '17:00');

    const res = await request(app)
      .delete(`/api/technicians/${techId}/shifts/3`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = db.prepare(
      `SELECT active FROM technician_shifts WHERE technician_id = ? AND day_of_week = 3`
    ).get(techId);
    expect(row.active).toBe(0);
  });

  it('idempotent — deleting non-existent shift returns 200', async () => {
    const res = await request(app)
      .delete(`/api/technicians/${techId}/shifts/6`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('403 for shop_employee', async () => {
    const res = await request(app)
      .delete(`/api/technicians/${techId}/shifts/0`)
      .set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /leaves/:leaveDate
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/technicians/:id/leaves/:leaveDate', () => {
  it('creates a new leave row', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-06-15`)
      .set(auth(wsToken))
      .send({ leave_type: 'vacation', notes: 'عطلة رسمية' });
    expect(res.status).toBe(200);
    expect(res.body.leave_date).toBe('2026-06-15');
    expect(res.body.leave_type).toBe('vacation');
    expect(res.body.notes).toBe('عطلة رسمية');
  });

  it('upsert same date updates instead of erroring', async () => {
    await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-07-01`)
      .set(auth(wsToken))
      .send({ leave_type: 'sick' });

    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-07-01`)
      .set(auth(wsToken))
      .send({ leave_type: 'day_off' });
    expect(res.status).toBe(200);
    expect(res.body.leave_type).toBe('day_off');
  });

  it('422 for invalid date format', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/15-06-2026`)
      .set(auth(wsToken))
      .send({ leave_type: 'sick' });
    expect(res.status).toBe(422);
  });

  it('422 for invalid leave_type', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-06-20`)
      .set(auth(wsToken))
      .send({ leave_type: 'holiday' });
    expect(res.status).toBe(422);
  });

  it('defaults leave_type to day_off when omitted', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-08-01`)
      .set(auth(wsToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.leave_type).toBe('day_off');
  });

  it('403 for shop_employee', async () => {
    const res = await request(app)
      .put(`/api/technicians/${techId}/leaves/2026-06-10`)
      .set(auth(shopToken))
      .send({ leave_type: 'sick' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /leaves/:leaveDate
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/technicians/:id/leaves/:leaveDate', () => {
  it('hard-deletes an existing leave', async () => {
    db.prepare(
      `INSERT INTO technician_leaves (technician_id, leave_date, leave_type) VALUES (?,?,?)`
    ).run(techId, '2026-09-01', 'sick');

    const res = await request(app)
      .delete(`/api/technicians/${techId}/leaves/2026-09-01`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = db.prepare(
      `SELECT * FROM technician_leaves WHERE technician_id = ? AND leave_date = ?`
    ).get(techId, '2026-09-01');
    expect(row).toBeUndefined();
  });

  it('idempotent — deleting non-existent leave returns 200', async () => {
    const res = await request(app)
      .delete(`/api/technicians/${techId}/leaves/2099-12-31`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('403 for shop_employee', async () => {
    const res = await request(app)
      .delete(`/api/technicians/${techId}/leaves/2026-09-01`)
      .set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});
