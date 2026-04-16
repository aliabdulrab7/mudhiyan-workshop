/**
 * Phase 8 — API Hardening Tests
 *
 * Covers:
 *   8.2 — Global error handler
 *   8.3 — HTTP status code corrections (InvalidTransition→409, BusinessRule→422, PaymentRequired→422)
 *   8.5 — 404 for unknown single resources
 *   8.6 — Transition error includes from/to fields
 *   8.7 — Rate limiter present on login (headers verified)
 *   8.8 — Rate limiter present on track endpoints (headers verified)
 */

const request    = require('supertest');
const jwt        = require('jsonwebtoken');
const app        = require('../app');
const { db }     = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let workshopToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Shop A')`).run();
  workshopToken = jwt.sign({ id: 30, role: 'workshop',      shop_id: null, username: 'ws' }, JWT_SECRET);
  shopToken     = jwt.sign({ id: 31, role: 'shop_employee', shop_id: 1,    username: 'sh' }, JWT_SECRET);
});

beforeEach(() => {
  db.prepare('DELETE FROM order_status_history').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

// ── 8.3 — HTTP Status Code Corrections ───────────────────────────────────────

describe('8.3 — HTTP status code corrections', () => {
  it('InvalidTransitionError → 409 (not 400)', async () => {
    // Insert order in 'in_repair' status; try to jump to 'delivered' (invalid)
    const o = db.prepare(`INSERT INTO orders
      (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('P8-TRANS-001','Ali','966501234567','خاتم',1,'tok-p8-001','in_repair')`).run();
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, 'received', 'in_repair', 'test')`).run(o.lastInsertRowid);

    const res = await request(app)
      .patch(`/api/orders/${o.lastInsertRowid}/status`)
      .set(auth(workshopToken))
      .send({ status: 'delivered' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('BusinessRuleViolationError → 422', async () => {
    // A locked order throws OrderLockedError (409), not BusinessRuleViolationError.
    // BusinessRuleViolationError fires when cost_status is wrong or other business rules.
    // We verify errorToHttpStatus maps it correctly via a unit check.
    const { errorToHttpStatus, BusinessRuleViolationError } = require('../errors');
    const err = new BusinessRuleViolationError('test rule');
    expect(errorToHttpStatus(err)).toBe(422);
  });

  it('PaymentRequiredError → 422 (not 400)', async () => {
    // Insert order in returned_to_shop with payment_confirmed = 0
    const o = db.prepare(`INSERT INTO orders
      (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, payment_confirmed)
      VALUES ('P8-PAY-001','Ali','966501234567','خاتم',1,'tok-p8-pay','returned_to_shop',0)`).run();
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, 'received', 'returned_to_shop', 'test')`).run(o.lastInsertRowid);

    const res = await request(app)
      .patch(`/api/orders/${o.lastInsertRowid}/status`)
      .set(auth(shopToken))
      .send({ status: 'delivered' });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
  });

  it('OrderLockedError → 409', async () => {
    const { errorToHttpStatus, OrderLockedError } = require('../errors');
    expect(errorToHttpStatus(new OrderLockedError())).toBe(409);
  });

  it('PermissionError → 403', async () => {
    const { errorToHttpStatus, PermissionError } = require('../errors');
    expect(errorToHttpStatus(new PermissionError())).toBe(403);
  });
});

// ── 8.6 — Transition Error Clarity ───────────────────────────────────────────

describe('8.6 — Transition error includes from and to fields', () => {
  it('invalid transition response contains from and to', async () => {
    const o = db.prepare(`INSERT INTO orders
      (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('P8-ERR-001','Ali','966501234567','خاتم',1,'tok-p8-err','in_repair')`).run();
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
      VALUES (?, 'received', 'in_repair', 'test')`).run(o.lastInsertRowid);

    const res = await request(app)
      .patch(`/api/orders/${o.lastInsertRowid}/status`)
      .set(auth(workshopToken))
      .send({ status: 'delivered' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('from', 'in_repair');
    expect(res.body).toHaveProperty('to', 'delivered');
    expect(res.body).toHaveProperty('error');
  });
});

// ── 8.5 — 404 for Unknown Resources ──────────────────────────────────────────

describe('8.5 — 404 for unknown resources', () => {
  it('GET /api/orders/:id returns 404 for missing order', async () => {
    const res = await request(app)
      .get('/api/orders/999999')
      .set(auth(workshopToken));
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/orders/barcode/:value returns 404 for unknown barcode', async () => {
    const res = await request(app)
      .get('/api/orders/barcode/NONEXISTENT-ORDER')
      .set(auth(workshopToken));
    expect(res.status).toBe(404);
  });

  it('GET /api/track/:token returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/track/00000000-dead-beef-dead-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /api/customers/:id returns 404 for unknown customer', async () => {
    const res = await request(app)
      .get('/api/customers/999999')
      .set(auth(workshopToken));
    expect(res.status).toBe(404);
  });

  it('PATCH /api/orders/:id/status returns 404 for missing order (workshop)', async () => {
    const res = await request(app)
      .patch('/api/orders/999999/status')
      .set(auth(workshopToken))
      .send({ status: 'received' });
    // OrderService will throw NotFoundError → 404
    expect(res.status).toBe(404);
  });
});

// ── 8.7 — Rate Limiter Headers on Login ──────────────────────────────────────

describe('8.7 — Rate limiter headers on login endpoint', () => {
  it('POST /api/auth/login response includes rate limit headers', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'wrong' });

    // RateLimit-Limit header proves the limiter is active
    expect(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']
    ).toBeDefined();
  });
});

// ── 8.8 — Rate Limiter Headers on Track Endpoints ────────────────────────────

describe('8.8 — Rate limiter on track endpoints', () => {
  it('GET /api/track/:token response includes rate limit headers', async () => {
    const res = await request(app).get('/api/track/any-token');
    expect(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']
    ).toBeDefined();
  });
});

// ── 8.2 — Global Error Handler ────────────────────────────────────────────────

describe('8.2 — Global error handler', () => {
  it('unauthenticated request returns { error } not HTML', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
  });

  it('unknown route returns JSON (not HTML Express 404 page)', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    // Express returns 404 but it should not be HTML
    expect(res.headers['content-type']).not.toMatch(/html/);
  });
});
