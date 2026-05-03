/**
 * WF-4 — POST /api/order-items/:id/auto-assign
 *         TechnicianService._scoreAndRank (pure unit tests)
 *
 * Tests: happy path assignment, score fallback, zero-tech 422, locked 409,
 * not-found 404, auth enforcement, DB write, pure-function scoring.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const TechnicianService = require('../services/TechnicianService');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 410, role: 'workshop',      username: 'ws4b',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 411, role: 'shop_employee', username: 'shop4b', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

function reset() {
  db.prepare(`DELETE FROM order_item_technicians`).run();
  db.prepare(`DELETE FROM technician_specializations`).run();
  db.prepare(`DELETE FROM technicians`).run();
  db.prepare(`DELETE FROM order_items`).run();
  db.prepare(`DELETE FROM orders`).run();
}

beforeEach(reset);

function makeTech({ name, status = 'available', active = 1, specValues = [] } = {}) {
  const id = db.prepare(
    `INSERT INTO technicians (name, status, active) VALUES (?, ?, ?)`
  ).run(name, status, active).lastInsertRowid;
  for (const v of specValues) {
    const specId = db.prepare(`SELECT id FROM specializations WHERE value = ?`).get(v)?.id;
    if (specId) db.prepare(
      `INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`
    ).run(id, specId);
  }
  return id;
}

function makeOrder({ status = 'in_repair', locked = false } = {}) {
  const num = `WF4AA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const lockedAt = locked ? datetime() : null;
  return db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, customer_token, status, locked_at)
    VALUES (?, 'Test', '966500000000', 'خاتم', lower(hex(randomblob(8))), ?, ?)
  `).run(num, status, lockedAt).lastInsertRowid;
}

function datetime() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function makeItem(orderId, itemType = 'خاتم') {
  return db.prepare(
    `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, ?, ?, 1)`
  ).run(orderId, itemType, itemType).lastInsertRowid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/order-items/:id/auto-assign — happy path', () => {
  it('assigns the highest-scoring available tech and returns { technician, score, matched_specs }', async () => {
    const techId = makeTech({ name: 'أحمد', status: 'available', specValues: ['rings'] });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('technician');
    expect(res.body.technician.id).toBe(techId);
    expect(res.body).toHaveProperty('score');
    expect(res.body).toHaveProperty('matched_specs');
    expect(Array.isArray(res.body.matched_specs)).toBe(true);
  });

  it('writes the assignment to order_item_technicians', async () => {
    const techId  = makeTech({ name: 'خالد', status: 'available', specValues: ['rings'] });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    await request(app).post(`/api/order-items/${itemId}/auto-assign`).set(auth(wsToken));

    const row = db.prepare(
      `SELECT * FROM order_item_technicians WHERE order_item_id = ?`
    ).get(itemId);
    expect(row).toBeDefined();
    expect(row.technician_id).toBe(techId);
  });

  it('picks the best tech when multiple are available (spec match wins)', async () => {
    const noSpec  = makeTech({ name: 'فني١', status: 'available', specValues: [] });
    const hasSpec = makeTech({ name: 'فني٢', status: 'available', specValues: ['rings'] });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(200);
    expect(res.body.technician.id).toBe(hasSpec);
    expect(res.body.matched_specs).toContain('rings');
  });

  it('falls back to status+workload scoring when no tech has matching spec (not 422)', async () => {
    makeTech({ name: 'عام', status: 'available', specValues: [] });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(200);
    expect(res.body.matched_specs).toEqual([]);
  });

  it('replaces a previous assignment (idempotent assign-to-best)', async () => {
    const oldTech = makeTech({ name: 'قديم', status: 'off_shift', specValues: [] });
    const newTech = makeTech({ name: 'جديد', status: 'available', specValues: ['rings'] });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    // Pre-assign old tech
    db.prepare(
      `INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`
    ).run(itemId, oldTech);

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(200);
    expect(res.body.technician.id).toBe(newTech);
    const rows = db.prepare(
      `SELECT * FROM order_item_technicians WHERE order_item_id = ?`
    ).all(itemId);
    expect(rows.length).toBe(1);
    expect(rows[0].technician_id).toBe(newTech);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error cases
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/order-items/:id/auto-assign — error cases', () => {
  it('422 when zero active techs exist', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/فني/);
  });

  it('422 when only inactive techs exist', async () => {
    makeTech({ name: 'غير نشط', status: 'available', active: 0 });
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(422);
  });

  it('409 when order is locked', async () => {
    makeTech({ name: 'فني', status: 'available' });
    const orderId = makeOrder({ locked: true });
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(wsToken));

    expect(res.status).toBe(409);
  });

  it('404 for unknown item id', async () => {
    const res = await request(app)
      .post('/api/order-items/999999/auto-assign')
      .set(auth(wsToken));
    expect(res.status).toBe(404);
  });

  it('403 for shop_employee', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`)
      .set(auth(shopToken));
    expect(res.status).toBe(403);
  });

  it('401 without auth', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const res = await request(app)
      .post(`/api/order-items/${itemId}/auto-assign`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure-function unit tests for _scoreAndRank
// ─────────────────────────────────────────────────────────────────────────────

describe('TechnicianService._scoreAndRank — pure function', () => {
  const { _scoreAndRank } = TechnicianService;

  function tech(id, name, status, active_count, specValues = []) {
    return { id, name, status, active_count, specializations: specValues.map(v => ({ value: v })) };
  }

  it('empty tech list returns empty array', () => {
    expect(_scoreAndRank([], ['rings'])).toEqual([]);
  });

  it('spec match adds +10 per matched spec', () => {
    const techs = [tech(1, 'أ', 'available', 0, ['rings'])];
    const [t] = _scoreAndRank(techs, ['rings']);
    expect(t.score).toBe(10 + 5); // 10 spec + 5 available
    expect(t.matched_specs).toEqual(['rings']);
  });

  it('no spec match: score is purely status + workload', () => {
    const techs = [tech(1, 'أ', 'available', 0, ['earrings'])];
    const [t] = _scoreAndRank(techs, ['rings']);
    expect(t.score).toBe(5); // 0 spec + 5 available - 0 workload
    expect(t.matched_specs).toEqual([]);
  });

  it('status weights: available > busy > off_shift > on_leave', () => {
    const techs = [
      tech(1, 'أ', 'on_leave',  0),
      tech(2, 'ب', 'off_shift', 0),
      tech(3, 'ج', 'busy',      0),
      tech(4, 'د', 'available', 0),
    ];
    const ranked = _scoreAndRank(techs, []);
    expect(ranked.map(t => t.id)).toEqual([4, 3, 2, 1]);
  });

  it('workload penalty: -1 per active item', () => {
    const techs = [
      tech(1, 'أ', 'available', 3),
      tech(2, 'ب', 'available', 0),
    ];
    const ranked = _scoreAndRank(techs, []);
    expect(ranked[0].id).toBe(2);
    expect(ranked[1].score).toBe(5 - 3); // available=5, workload=-3
  });

  it('tiebreaker is name ASC (Arabic locale)', () => {
    const techs = [
      tech(1, 'ياسر', 'available', 0),
      tech(2, 'أحمد', 'available', 0),
    ];
    const ranked = _scoreAndRank(techs, []);
    expect(ranked[0].id).toBe(2); // أحمد before ياسر
  });

  it('multiple spec matches: +10 per match', () => {
    const techs = [tech(1, 'أ', 'available', 0, ['rings', 'diamond_setting', 'engraving'])];
    const [t] = _scoreAndRank(techs, ['rings', 'diamond_setting']);
    expect(t.score).toBe(20 + 5); // 2 spec matches × 10 + available
    expect(t.matched_specs.sort()).toEqual(['diamond_setting', 'rings'].sort());
  });
});
