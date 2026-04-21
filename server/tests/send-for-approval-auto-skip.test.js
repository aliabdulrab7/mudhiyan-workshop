/**
 * send-for-approval — auto-skip free items (Bug 2)
 *
 * Contract: when workshop clicks "إرسال للعميل للموافقة", any order_item still
 * in 'pending' with estimated_cost IS NULL OR = 0 is flipped to 'skipped'
 * atomically with the status transition. Free items never reach the customer
 * and must not contribute to orders.cost (see refreshOrderCost / Bug 1).
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken = jwt.sign({ id: 20, role: 'workshop', username: 'ws_user', shop_id: null }, JWT_SECRET);
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

describe('POST /api/orders/:id/send-for-approval — auto-skip free items', () => {
  let orderId;

  beforeEach(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM order_status_history').run();
    db.prepare('DELETE FROM orders').run();

    const orderNum = `SKIP-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const r = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES (?, 'Auto-Skip Test', '966501112223', 'خاتم', 1, lower(hex(randomblob(8))), 'inspection')
    `).run(orderNum);
    orderId = r.lastInsertRowid;
    db.prepare(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
       VALUES (?, 'received', 'inspection', 'test')`
    ).run(orderId);
  });

  function seedItem({ cost, approval_status = 'pending', name = 'item' }) {
    return db.prepare(`
      INSERT INTO order_items (order_id, item_type, item_name, quantity, estimated_cost, approval_status)
      VALUES (?, 'ring', ?, 1, ?, ?)
    `).run(orderId, name, cost, approval_status).lastInsertRowid;
  }

  it('flips free items (cost = 0) to skipped; keeps priced items pending', async () => {
    const free1 = seedItem({ cost: 0,   name: 'سوار مجاني' });
    const paid1 = seedItem({ cost: 100, name: 'خاتم' });
    const paid2 = seedItem({ cost: 200, name: 'قلادة' });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waiting_approval');

    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.approval_status]));
    expect(byId[free1]).toBe('skipped');
    expect(byId[paid1]).toBe('pending');
    expect(byId[paid2]).toBe('pending');
  });

  it('flips items with NULL estimated_cost to skipped when at least one item is priced', async () => {
    // NULL items block inspection-send when there are ZERO priced items,
    // but when a priced sibling exists the endpoint proceeds — and unpriced
    // items should also be auto-skipped per spec.
    const nul  = seedItem({ cost: null, name: 'غير مسعر' });
    const paid = seedItem({ cost: 150, name: 'مسعر' });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waiting_approval');

    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.approval_status]));
    expect(byId[nul]).toBe('skipped');
    expect(byId[paid]).toBe('pending');
  });

  it('is a no-op when no free items exist', async () => {
    seedItem({ cost: 100 });
    seedItem({ cost: 250 });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waiting_approval');

    const rows = db.prepare(
      'SELECT approval_status FROM order_items WHERE order_id = ? ORDER BY id'
    ).all(orderId);
    expect(rows.map((r) => r.approval_status)).toEqual(['pending', 'pending']);
  });

  it('preserves prior per-item decisions on re-send (WHERE clause excludes non-pending)', async () => {
    // Data-shape test, not a full re-quote lifecycle test. We seed items with
    // pre-set approval_status values (approved/skipped/rejected) to verify the
    // UPDATE's WHERE clause targets ONLY pending rows. The order is jumped to
    // in_repair via raw SQL — this does NOT exercise the actual PATCH-item-cost
    // endpoint that would flip a rejected item back to pending in a real re-quote.
    const approvedPrev = seedItem({ cost: 100, approval_status: 'approved' });
    const skippedPrev  = seedItem({ cost: 0,   approval_status: 'skipped'  });
    const rejectedPrev = seedItem({ cost: 75,  approval_status: 'rejected' });
    const newFree      = seedItem({ cost: 0,   approval_status: 'pending'  });
    const newPriced    = seedItem({ cost: 50,  approval_status: 'pending'  });

    // Requires at least one pending item with cost > 0 (business rule for
    // in_repair → waiting_approval). newPriced satisfies this.
    db.prepare(`UPDATE orders SET status = 'in_repair' WHERE id = ?`).run(orderId);
    db.prepare(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
       VALUES (?, 'inspection', 'in_repair', 'test')`
    ).run(orderId);

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waiting_approval');

    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.approval_status]));
    expect(byId[approvedPrev]).toBe('approved');
    expect(byId[skippedPrev]).toBe('skipped');
    expect(byId[rejectedPrev]).toBe('rejected');
    expect(byId[newFree]).toBe('skipped');   // auto-skipped
    expect(byId[newPriced]).toBe('pending'); // customer will decide
  });

  it('all-free fast path: items flip to skipped and order goes to in_repair', async () => {
    seedItem({ cost: 0 });
    seedItem({ cost: 0 });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_repair');

    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    expect(rows.map((r) => r.approval_status)).toEqual(['skipped', 'skipped']);
  });

  it('rolls back the auto-skip if the transition fails', async () => {
    // Put the order in a status the endpoint rejects, so the route short-circuits
    // before opening the transaction. Items must remain untouched.
    db.prepare(`UPDATE orders SET status = 'new' WHERE id = ?`).run(orderId);
    const free = seedItem({ cost: 0 });
    const paid = seedItem({ cost: 100 });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(400);

    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.approval_status]));
    expect(byId[free]).toBe('pending');
    expect(byId[paid]).toBe('pending');
  });

  it('second send-for-approval from waiting_approval errors and leaves items unchanged', async () => {
    // True round-trip idempotency: call send-for-approval twice without
    // otherwise advancing the state machine. Documents current behavior —
    // does NOT change it to fit the test.
    seedItem({ cost: 0,   name: 'free'   });
    seedItem({ cost: 100, name: 'paid-a' });
    seedItem({ cost: 200, name: 'paid-b' });

    // First call: inspection → waiting_approval, free flips to skipped.
    const first = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('waiting_approval');

    const afterFirst = db.prepare(
      'SELECT approval_status FROM order_items WHERE order_id = ? ORDER BY id'
    ).all(orderId).map((r) => r.approval_status);
    expect(afterFirst).toEqual(['skipped', 'pending', 'pending']);

    // Second call from waiting_approval. ALLOWED_FROM is {inspection, in_repair,
    // rejected}, so the route returns 400 before the transaction opens.
    const second = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('لا يمكن إرسال الطلب للموافقة في هذه المرحلة');

    // Order status unchanged, items unchanged.
    const orderRow = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(orderRow.status).toBe('waiting_approval');

    const afterSecond = db.prepare(
      'SELECT approval_status FROM order_items WHERE order_id = ? ORDER BY id'
    ).all(orderId).map((r) => r.approval_status);
    expect(afterSecond).toEqual(afterFirst);
  });
});
