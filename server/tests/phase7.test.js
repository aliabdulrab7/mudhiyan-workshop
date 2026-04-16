/**
 * Phase 7 — Data Consistency Tests
 *
 * Covers:
 *   7.1 — Phone normalization
 *   7.2 — Cost value validation
 *   7.3 — Required field validation for order creation
 *   7.4 — customer_token uniqueness constraint
 *   7.5 — order_number uniqueness under concurrent creation
 *   7.6 — orders.cost stays in sync with sum of item costs
 *   7.7 — Input length guards
 */

const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const app          = require('../app');
const { db }       = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { normalizePhone } = require('../helpers/phoneHelper');

let shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Test Shop')`).run();
  shopToken = jwt.sign({ id: 20, role: 'shop_employee', shop_id: 1, username: 'tester' }, JWT_SECRET);
});

beforeEach(() => {
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

function makeOrder(overrides = {}) {
  return {
    customer_name: 'Ali',
    phone: '966501234567',
    items: [{ item_name: 'خاتم', workshop_comment: 'كسر في الجانب' }],
    ...overrides,
  };
}

// ── 7.1 — Phone normalization unit tests ─────────────────────────────────────

describe('normalizePhone()', () => {
  it('+966501234567 → 966501234567', () => {
    expect(normalizePhone('+966501234567')).toBe('966501234567');
  });
  it('00966501234567 → 966501234567', () => {
    expect(normalizePhone('00966501234567')).toBe('966501234567');
  });
  it('0501234567 → 966501234567', () => {
    expect(normalizePhone('0501234567')).toBe('966501234567');
  });
  it('501234567 → 966501234567', () => {
    expect(normalizePhone('501234567')).toBe('966501234567');
  });
  it('966501234567 → 966501234567 (no change)', () => {
    expect(normalizePhone('966501234567')).toBe('966501234567');
  });
  it('strips spaces and dashes', () => {
    expect(normalizePhone('+966 50-123-4567')).toBe('966501234567');
  });
  it('invalid input throws', () => {
    expect(() => normalizePhone('abc')).toThrow();
    expect(() => normalizePhone('')).toThrow();
    expect(() => normalizePhone('123')).toThrow();
  });
});

// ── 7.1 — Phone normalization via POST /api/orders ───────────────────────────

describe('POST /api/orders — phone normalization', () => {
  it('accepts 0501234567 and stores as 966501234567', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ phone: '0501234567' }));
    expect(res.status).toBe(201);
    expect(res.body.phone).toBe('966501234567');
  });

  it('accepts +966501234567 and stores as 966501234567', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ phone: '+966501234567' }));
    expect(res.status).toBe(201);
    expect(res.body.phone).toBe('966501234567');
  });

  it('rejects invalid phone with 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ phone: 'notaphone' }));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ── 7.2 — Cost validation ─────────────────────────────────────────────────────

describe('Cost validation', () => {
  let orderId;
  beforeEach(() => {
    const workshopToken = jwt.sign({ id: 21, role: 'workshop', shop_id: null, username: 'tech' }, JWT_SECRET);
    // Create order then get its id
    const o = db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('COST-TEST-001','Ali','966501234567','خاتم',1,'tok-cost-001','inspection')`).run();
    orderId = o.lastInsertRowid;
    db.prepare(`INSERT INTO order_items (order_id, item_name, item_type, sort_order) VALUES (?, 'خاتم', 'ring', 0)`).run(orderId);
    // store token for use in tests
    orderId = o.lastInsertRowid;
    this._workshopToken = workshopToken;
  });

  it('PATCH /cost rejects negative cost with 400', async () => {
    const workshopToken = jwt.sign({ id: 21, role: 'workshop', shop_id: null, username: 'tech' }, JWT_SECRET);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: -10 });
    expect(res.status).toBe(400);
  });

  it('PATCH /cost rejects non-numeric cost with 400', async () => {
    const workshopToken = jwt.sign({ id: 21, role: 'workshop', shop_id: null, username: 'tech' }, JWT_SECRET);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 'abc' });
    expect(res.status).toBe(400);
  });
});

// ── 7.3 — Required field validation ──────────────────────────────────────────

describe('POST /api/orders — required field validation', () => {
  it('rejects missing customer_name', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ customer_name: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing phone', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ phone: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ items: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects item with empty item_name', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ items: [{ item_name: '', workshop_comment: 'test' }] }));
    expect(res.status).toBe(400);
  });

  it('rejects item with empty workshop_comment', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ items: [{ item_name: 'خاتم', workshop_comment: '' }] }));
    expect(res.status).toBe(400);
  });
});

// ── 7.4 — customer_token uniqueness ──────────────────────────────────────────

describe('customer_token uniqueness (INV-12)', () => {
  it('database rejects duplicate customer_token', () => {
    db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('UNIQ-001','Ali','966501234567','خاتم',1,'same-token')`).run();
    expect(() => {
      db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
        VALUES ('UNIQ-002','Sara','966501234568','سوار',1,'same-token')`).run();
    }).toThrow();
  });

  it('two POST /api/orders calls produce different customer_tokens', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/orders').set(auth(shopToken)).send(makeOrder()),
      request(app).post('/api/orders').set(auth(shopToken)).send(makeOrder()),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.customer_token).not.toBe(r2.body.customer_token);
  });
});

// ── 7.5 — order_number uniqueness under concurrent creation (INV-11) ──────────

describe('Concurrent order creation — order_number uniqueness', () => {
  it('10 concurrent POST /api/orders produce 10 unique order numbers', async () => {
    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/api/orders').set(auth(shopToken)).send(makeOrder())
    );
    const results = await Promise.all(requests);

    const statuses = results.map(r => r.status);
    expect(statuses.every(s => s === 201)).toBe(true);

    const numbers = results.map(r => r.body.order_number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(10);
  }, 15000);
});

// ── 7.6 — orders.cost syncs with sum of item estimated_costs ─────────────────

describe('Cost sync (orders.cost === sum of item costs)', () => {
  let workshopToken;
  beforeEach(() => {
    workshopToken = jwt.sign({ id: 22, role: 'workshop', shop_id: null, username: 'tech2' }, JWT_SECRET);
  });

  it('orders.cost equals sum of item costs after order-level cost set', async () => {
    // Insert order in inspection state with one item
    const o = db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('SYNC-001','Ali','966501234567','خاتم',1,'tok-sync-001','inspection')`).run();
    const orderId = o.lastInsertRowid;
    db.prepare(`INSERT INTO order_items (order_id, item_name, item_type, sort_order) VALUES (?, 'خاتم', 'ring', 0)`).run(orderId);

    // PATCH /cost sets cost on all items then refreshes order total
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 150 });
    expect(res.status).toBe(200);

    // orders.cost must equal the sum of item estimated_costs
    const order = db.prepare('SELECT cost FROM orders WHERE id = ?').get(orderId);
    const itemSum = db.prepare(`SELECT COALESCE(SUM(estimated_cost), 0) AS s FROM order_items WHERE order_id = ?`).get(orderId).s;
    expect(order.cost).toBe(itemSum);
    expect(order.cost).toBe(150);
  });

  it('updating one item cost recalculates order total', async () => {
    const o = db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('SYNC-002','Ali','966501234567','خاتم',1,'tok-sync-002','inspection')`).run();
    const orderId = o.lastInsertRowid;
    const i1 = db.prepare(`INSERT INTO order_items (order_id, item_name, item_type, sort_order) VALUES (?, 'خاتم', 'ring', 0)`).run(orderId);

    // Set initial cost
    await request(app)
      .post(`/api/orders/${orderId}/items/${i1.lastInsertRowid}/cost`)
      .set(auth(workshopToken))
      .send({ estimated_cost: 200 });

    const order = db.prepare('SELECT cost FROM orders WHERE id = ?').get(orderId);
    expect(order.cost).toBe(200);
  });
});

// ── 7.7 — Input length guards ─────────────────────────────────────────────────

describe('Input length guards', () => {
  it('rejects notes > 2000 chars on order creation', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ notes: 'أ'.repeat(2001) }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ملاحظات/);
  });

  it('accepts notes exactly 2000 chars', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({ notes: 'أ'.repeat(2000) }));
    expect(res.status).toBe(201);
  });

  it('rejects workshop_comment > 1000 chars on order creation', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({
        items: [{ item_name: 'خاتم', workshop_comment: 'أ'.repeat(1001) }],
      }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/تعليق/);
  });

  it('accepts workshop_comment exactly 1000 chars', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(shopToken))
      .send(makeOrder({
        items: [{ item_name: 'خاتم', workshop_comment: 'أ'.repeat(1000) }],
      }));
    expect(res.status).toBe(201);
  });
});
