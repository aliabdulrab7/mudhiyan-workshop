const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let workshopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Shop A')`).run();
  workshopToken = jwt.sign({ id: 10, role: 'workshop', shop_id: null, username: 'workshop' }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

function seedOrder(order_number, status) {
  db.prepare(`DELETE FROM orders WHERE order_number = ?`).run(order_number);
  const result = db.prepare(
    `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(order_number, 'Bulk QA', '966500000777', 'خاتم', 1, `tk-${order_number}`, status);
  return result.lastInsertRowid;
}

function latestNotesFor(orderId) {
  return db.prepare(
    `SELECT notes FROM order_status_history WHERE order_id = ? ORDER BY id DESC LIMIT 1`
  ).get(orderId)?.notes ?? null;
}

describe('bulk-scan notes threading', () => {

  it('(a) single-scan PATCH with no source field — notes column is unchanged byte-for-byte', async () => {
    const orderId = seedOrder('BULK-SINGLE-001', 'new');
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth(workshopToken))
      .send({ status: 'received' });
    expect(res.status).toBe(200);
    expect(latestNotesFor(orderId)).toBeNull();

    // Explicit notes passthrough also unchanged
    const orderId2 = seedOrder('BULK-SINGLE-002', 'new');
    const res2 = await request(app)
      .patch(`/api/orders/${orderId2}/status`)
      .set(auth(workshopToken))
      .send({ status: 'received', notes: 'operator comment' });
    expect(res2.status).toBe(200);
    expect(latestNotesFor(orderId2)).toBe('operator comment');
  });

  it('(b) bulk PATCH with all three fields — notes prefixed correctly, no double-prefix on second call', async () => {
    const orderId = seedOrder('BULK-MULTI-001', 'new');
    const res = await request(app)
      .patch(`/api/orders/by-barcode/BULK-MULTI-001/status`)
      .set(auth(workshopToken))
      .send({
        status: 'received',
        source: 'bulk_scan',
        session_id: 'a1b2c3d4',
        session_type: 'intake_from_branches',
      });
    expect(res.status).toBe(200);
    expect(latestNotesFor(orderId))
      .toBe('bulk-scan · session:a1b2c3d4 · type:intake_from_branches');

    // Second bulk transition on same order (received → inspection) — still single-prefix
    const res2 = await request(app)
      .patch(`/api/orders/by-barcode/BULK-MULTI-001/status`)
      .set(auth(workshopToken))
      .send({
        status: 'inspection',
        source: 'bulk_scan',
        session_id: 'a1b2c3d4',
        session_type: 'intake_from_branches',
      });
    expect(res2.status).toBe(200);
    const latest = latestNotesFor(orderId);
    expect(latest).toBe('bulk-scan · session:a1b2c3d4 · type:intake_from_branches');
    // Sanity: the prefix appears exactly once
    expect(latest.match(/bulk-scan/g)?.length).toBe(1);

    // Bulk with an explicit notes field — combines, not replaces
    const orderId3 = seedOrder('BULK-MULTI-003', 'new');
    const res3 = await request(app)
      .patch(`/api/orders/by-barcode/BULK-MULTI-003/status`)
      .set(auth(workshopToken))
      .send({
        status: 'received',
        source: 'bulk_scan',
        session_id: 'ffff0000',
        session_type: 'intake_from_branches',
        notes: 'hand comment',
      });
    expect(res3.status).toBe(200);
    expect(latestNotesFor(orderId3))
      .toBe('bulk-scan · session:ffff0000 · type:intake_from_branches · hand comment');
  });

  it('(c) bulk PATCH with source but missing session_id or session_type — 400', async () => {
    const orderId = seedOrder('BULK-BAD-001', 'new');

    // Missing session_id
    const res1 = await request(app)
      .patch(`/api/orders/by-barcode/BULK-BAD-001/status`)
      .set(auth(workshopToken))
      .send({ status: 'received', source: 'bulk_scan', session_type: 'intake_from_branches' });
    expect(res1.status).toBe(400);

    // Missing session_type
    const res2 = await request(app)
      .patch(`/api/orders/by-barcode/BULK-BAD-001/status`)
      .set(auth(workshopToken))
      .send({ status: 'received', source: 'bulk_scan', session_id: 'a1b2c3d4' });
    expect(res2.status).toBe(400);

    // Source is not 'bulk_scan'
    const res3 = await request(app)
      .patch(`/api/orders/by-barcode/BULK-BAD-001/status`)
      .set(auth(workshopToken))
      .send({ status: 'received', source: 'manual', session_id: 'x', session_type: 'y' });
    expect(res3.status).toBe(400);

    // Confirm none of the above actually transitioned the order
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('new');
    expect(latestNotesFor(orderId)).toBeNull();
  });

  it('by-barcode path resolves by order_number and transitions', async () => {
    const orderId = seedOrder('BULK-RESOLVE-001', 'new');
    const res = await request(app)
      .patch(`/api/orders/by-barcode/BULK-RESOLVE-001/status`)
      .set(auth(workshopToken))
      .send({ status: 'received' }); // even without bulk fields, the route works
    expect(res.status).toBe(200);
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('received');
  });

  it('by-barcode path returns 404 when barcode does not resolve', async () => {
    const res = await request(app)
      .patch(`/api/orders/by-barcode/DOES-NOT-EXIST/status`)
      .set(auth(workshopToken))
      .send({ status: 'received' });
    expect(res.status).toBe(404);
  });
});
