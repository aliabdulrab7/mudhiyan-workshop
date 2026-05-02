/**
 * Technician assignment — per-order + bulk endpoints.
 *
 * Covers POST /api/orders/:id/technicians and POST /api/orders/bulk/technicians.
 * The per-item endpoint is exercised by phase3.test.js.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 30, role: 'workshop',      username: 'ws_user',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 31, role: 'shop_employee', username: 'shop_user', shop_id: 1    }, JWT_SECRET);
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

let nextSeq = 0;
function makeOrder({ status = 'inspection', locked = false } = {}) {
  nextSeq += 1;
  const num = `TA-${Date.now()}-${nextSeq}`;
  const r = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, locked_at)
    VALUES (?, 'Test', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), ?, ?)
  `).run(num, status, locked ? new Date().toISOString() : null);
  return r.lastInsertRowid;
}

function makeItem(orderId) {
  return db.prepare(`
    INSERT INTO order_items (order_id, item_type, item_name, quantity, notes, workshop_comment)
    VALUES (?, 'ring', 'خاتم ذهب', 1, '', '')
  `).run(orderId).lastInsertRowid;
}

function reset() {
  db.prepare('DELETE FROM order_item_technicians').run();
  db.prepare('DELETE FROM technicians').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM order_status_history').run();
  db.prepare('DELETE FROM orders').run();
}

function countAssignmentsForOrder(orderId) {
  return db.prepare(`
    SELECT COUNT(*) AS n
    FROM order_item_technicians oit
    JOIN order_items oi ON oi.id = oit.order_item_id
    WHERE oi.order_id = ?
  `).get(orderId).n;
}

// ── Per-order ────────────────────────────────────────────────────────────────

describe('POST /api/orders/:id/technicians', () => {
  let orderId, techId, techIdAlt;

  beforeEach(() => {
    reset();
    orderId    = makeOrder();
    makeItem(orderId);
    makeItem(orderId);
    makeItem(orderId);
    techId     = db.prepare(`INSERT INTO technicians (specialization) VALUES ('ذهب')`).run().lastInsertRowid;
    techIdAlt  = db.prepare(`INSERT INTO technicians (specialization) VALUES ('فضة')`).run().lastInsertRowid;
  });

  it('assigns the technician to all items in the order', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items_updated: 3 });

    const rows = db.prepare(`
      SELECT DISTINCT technician_id FROM order_item_technicians oit
      JOIN order_items oi ON oi.id = oit.order_item_id
      WHERE oi.order_id = ?
    `).all(orderId);
    expect(rows).toEqual([{ technician_id: techId }]);
    expect(countAssignmentsForOrder(orderId)).toBe(3);
  });

  it('overwrites prior heterogeneous assignments', async () => {
    const items = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(orderId);
    db.prepare('INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)')
      .run(items[0].id, techId);
    db.prepare('INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)')
      .run(items[1].id, techIdAlt);

    const res = await request(app)
      .post(`/api/orders/${orderId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techIdAlt });
    expect(res.status).toBe(200);

    const rows = db.prepare(`
      SELECT DISTINCT technician_id FROM order_item_technicians oit
      JOIN order_items oi ON oi.id = oit.order_item_id
      WHERE oi.order_id = ?
    `).all(orderId);
    expect(rows).toEqual([{ technician_id: techIdAlt }]);
  });

  it('is idempotent — re-assigning the same tech leaves one row per item', async () => {
    await request(app).post(`/api/orders/${orderId}/technicians`)
      .set(auth(wsToken)).send({ technician_id: techId });
    await request(app).post(`/api/orders/${orderId}/technicians`)
      .set(auth(wsToken)).send({ technician_id: techId });

    expect(countAssignmentsForOrder(orderId)).toBe(3);
  });

  it('returns 400 when the order has zero items', async () => {
    const empty = makeOrder();
    const res = await request(app)
      .post(`/api/orders/${empty}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the order does not exist', async () => {
    const res = await request(app)
      .post(`/api/orders/9999999/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the technician does not exist', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: 9999999 });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the order is locked', async () => {
    const lockedId = makeOrder({ locked: true });
    makeItem(lockedId);
    const res = await request(app)
      .post(`/api/orders/${lockedId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(409);
  });

  it('rejects shop_employee', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/technicians`)
      .set(auth(shopToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(403);
  });
});

// ── Bulk ─────────────────────────────────────────────────────────────────────

describe('POST /api/orders/bulk/technicians', () => {
  let orderIds, techId;

  beforeEach(() => {
    reset();
    orderIds = [makeOrder(), makeOrder(), makeOrder()];
    for (const id of orderIds) { makeItem(id); makeItem(id); }
    techId = db.prepare(`INSERT INTO technicians (specialization) VALUES ('ذهب')`).run().lastInsertRowid;
  });

  it('assigns the tech to every item across every order', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: orderIds, technician_id: techId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, orders_updated: 3, items_updated: 6 });

    for (const id of orderIds) {
      expect(countAssignmentsForOrder(id)).toBe(2);
    }
  });

  it('rolls back the entire batch when one order is missing', async () => {
    const ids = [orderIds[0], 9999999, orderIds[1]];
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: ids, technician_id: techId });
    expect(res.status).toBe(404);

    // First order in the list should have NO assignments — proves rollback
    expect(countAssignmentsForOrder(orderIds[0])).toBe(0);
    expect(countAssignmentsForOrder(orderIds[1])).toBe(0);
  });

  it('rolls back when one of the orders is locked', async () => {
    const lockedId = makeOrder({ locked: true });
    makeItem(lockedId);
    const ids = [orderIds[0], lockedId, orderIds[1]];

    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: ids, technician_id: techId });
    expect(res.status).toBe(409);

    expect(countAssignmentsForOrder(orderIds[0])).toBe(0);
    expect(countAssignmentsForOrder(lockedId)).toBe(0);
    expect(countAssignmentsForOrder(orderIds[1])).toBe(0);
  });

  it('returns 400 for empty order_ids', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: [], technician_id: techId });
    expect(res.status).toBe(400);
  });

  it('returns 400 when technician_id is missing', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: orderIds });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the technician does not exist', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(wsToken))
      .send({ order_ids: orderIds, technician_id: 9999999 });
    expect(res.status).toBe(404);
  });

  it('rejects shop_employee', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/technicians')
      .set(auth(shopToken))
      .send({ order_ids: orderIds, technician_id: techId });
    expect(res.status).toBe(403);
  });
});
