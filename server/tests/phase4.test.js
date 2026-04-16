/**
 * Phase 4 Test Suite — QR Tracking System
 *
 * Covers: GET /api/track/:token, POST .../approve, POST .../reject
 * All endpoints are public (no auth).
 */

const request = require('supertest');
const app  = require('../app');
const { db } = require('../db');

const TOKEN_ACTIVE   = 'phase4-token-active-abc123';
const TOKEN_WAITING  = 'phase4-token-waiting-abc456';
const TOKEN_REJECTED = 'phase4-token-rejected-abc789';
const TOKEN_DELIVERED = 'phase4-token-delivered-abc000';

let orderActiveId, orderWaitingId, orderRejectedId, orderDeliveredId;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Test Branch')`).run();
});

beforeEach(() => {
  // Clean up dependent tables first
  db.prepare('DELETE FROM order_status_history').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();

  // Order in 'received' status
  orderActiveId = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, cost)
    VALUES ('P4-ACTIVE-001', 'Khalid', '966500000001', 'خاتم', 1, ?, 'received', 0)
  `).run(TOKEN_ACTIVE).lastInsertRowid;
  db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, NULL, 'received', 'test')`).run(orderActiveId);

  // Order in 'waiting_approval' status with items
  orderWaitingId = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, cost, cost_status)
    VALUES ('P4-WAIT-001', 'Sara', '966500000002', 'سوار', 1, ?, 'waiting_approval', 200, 'PENDING_APPROVAL')
  `).run(TOKEN_WAITING).lastInsertRowid;
  db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'diagnosing', 'waiting_approval', 'test')`).run(orderWaitingId);
  // Add item to waiting order
  db.prepare(`
    INSERT INTO order_items (order_id, item_type, item_name, quantity, notes, workshop_comment, estimated_cost, repair_description, approval_status)
    VALUES (?, 'ring', 'خاتم ذهب', 1, '', '', 200, 'تغيير الحجم من 16 إلى 18', 'pending')
  `).run(orderWaitingId);

  // Order already in 'rejected' status (for idempotency test)
  orderRejectedId = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, cost)
    VALUES ('P4-REJ-001', 'Nora', '966500000003', 'قلادة', 1, ?, 'rejected', 150)
  `).run(TOKEN_REJECTED).lastInsertRowid;
  db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'waiting_approval', 'rejected', 'test')`).run(orderRejectedId);

  // Order in 'delivered' status (locked)
  orderDeliveredId = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, cost, locked_at)
    VALUES ('P4-DEL-001', 'Faisal', '966500000004', 'خاتم', 1, ?, 'delivered', 300, datetime('now','localtime'))
  `).run(TOKEN_DELIVERED).lastInsertRowid;
  db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'ready_for_pickup', 'delivered', 'test')`).run(orderDeliveredId);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/track/:token
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/track/:token', () => {
  it('returns tracking_number, status, status_label, items, cost', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_ACTIVE}`);
    expect(res.status).toBe(200);
    expect(res.body.tracking_number).toBe('P4-ACTIVE-001');
    expect(res.body.status).toBe('received');
    expect(res.body.status_label).toBe('استُلم في الورشة');
    expect(res.body.estimated_cost).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.created_at).toBeDefined();
  });

  it('returns items with repair_description and estimated_cost', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_WAITING}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].repair_description).toBe('تغيير الحجم من 16 إلى 18');
    expect(res.body.items[0].estimated_cost).toBe(200);
    expect(res.body.items[0].item_name).toBe('خاتم ذهب');
  });

  it('does NOT expose internal id or order_id in items', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_WAITING}`);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).not.toHaveProperty('id');
    expect(res.body.items[0]).not.toHaveProperty('order_id');
  });

  it('does NOT expose phone or notes', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_ACTIVE}`);
    expect(res.body).not.toHaveProperty('phone');
    expect(res.body).not.toHaveProperty('notes');
  });

  it('does NOT expose internal order id', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_ACTIVE}`);
    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('customer_token');
  });

  it('show_approval_buttons is true only when status = waiting_approval', async () => {
    const waiting  = await request(app).get(`/api/track/${TOKEN_WAITING}`);
    const received = await request(app).get(`/api/track/${TOKEN_ACTIVE}`);
    expect(waiting.body.show_approval_buttons).toBe(true);
    expect(received.body.show_approval_buttons).toBe(false);
  });

  it('returns correct status_label for waiting_approval', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_WAITING}`);
    expect(res.body.status_label).toBe('بانتظار موافقتك');
  });

  it('returns correct status_label for rejected', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_REJECTED}`);
    expect(res.body.status_label).toBe('تم الرفض');
  });

  it('returns correct status_label for delivered', async () => {
    const res = await request(app).get(`/api/track/${TOKEN_DELIVERED}`);
    expect(res.body.status_label).toBe('تم التسليم');
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/track/totally-unknown-token-xyz');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/track/:token/approve
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/track/:token/approve', () => {
  it('approves a waiting_approval order — transitions to approved', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_WAITING}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.status_label).toBe('تمت الموافقة');
  });

  it('sets item approval_status to approved', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/approve`);
    const item = db.prepare('SELECT approval_status FROM order_items WHERE order_id = ?').get(orderWaitingId);
    expect(item.approval_status).toBe('approved');
  });

  it('sets order cost_status to APPROVED', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/approve`);
    const order = db.prepare('SELECT cost_status FROM orders WHERE id = ?').get(orderWaitingId);
    expect(order.cost_status).toBe('APPROVED');
  });

  it('returns 400 when order is not in waiting_approval (received)', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_ACTIVE}/approve`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when order is already rejected (idempotent double-action)', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_REJECTED}/approve`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when order is delivered (locked)', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_DELIVERED}/approve`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).post('/api/track/bad-token-xyz/approve');
    expect(res.status).toBe(404);
  });

  it('second approve call returns 400 (already transitioned)', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/approve`);
    const res = await request(app).post(`/api/track/${TOKEN_WAITING}/approve`);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/track/:token/reject
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/track/:token/reject', () => {
  it('rejects a waiting_approval order — transitions to rejected', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.status_label).toBe('تم الرفض');
  });

  it('sets item approval_status to rejected', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    const item = db.prepare('SELECT approval_status FROM order_items WHERE order_id = ?').get(orderWaitingId);
    expect(item.approval_status).toBe('rejected');
  });

  it('sets order cost_status to REJECTED', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    const order = db.prepare('SELECT cost_status FROM orders WHERE id = ?').get(orderWaitingId);
    expect(order.cost_status).toBe('REJECTED');
  });

  it('REJECTED → next state is ready_for_pickup (not in_repair)', async () => {
    // After reject, order should be in rejected. Next valid transition is ready_for_pickup.
    await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderWaitingId);
    expect(order.status).toBe('rejected');

    // Verify the FSM allows rejected → ready_for_return (renamed from ready_for_pickup)
    const { isValidTransition } = require('../services/OrderService');
    expect(isValidTransition('rejected', 'ready_for_return')).toBe(true);
    expect(isValidTransition('rejected', 'in_repair')).toBe(false);
  });

  it('returns 400 when order is not in waiting_approval', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_ACTIVE}/reject`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when order is already rejected', async () => {
    const res = await request(app).post(`/api/track/${TOKEN_REJECTED}/reject`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).post('/api/track/bad-token-xyz/reject');
    expect(res.status).toBe(404);
  });

  it('second reject call returns 400 (already transitioned)', async () => {
    await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    const res = await request(app).post(`/api/track/${TOKEN_WAITING}/reject`);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Token security properties
// ═══════════════════════════════════════════════════════════════════════════════

describe('Token security', () => {
  it('customer_token is generated as UUID (at least 32 chars)', () => {
    const order = db.prepare('SELECT customer_token FROM orders WHERE id = ?').get(orderActiveId);
    // TOKEN_ACTIVE is a test override; check a freshly-created order via createOrder
    const { createOrder } = require('../db');
    const fresh = createOrder({
      customer_name: 'Token Test',
      phone:         '966500000099',
      shop_id:       1,
      items:         [{ item_name: 'ring', item_type: 'ring' }],
    });
    expect(fresh.customer_token).toBeDefined();
    expect(fresh.customer_token.length).toBeGreaterThanOrEqual(32);
    // Token must not equal the order id or order number
    expect(fresh.customer_token).not.toBe(String(fresh.id));
    expect(fresh.customer_token).not.toBe(fresh.order_number);
  });
});
