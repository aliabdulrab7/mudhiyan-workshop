// server/tests/track.test.js
const request = require('supertest');
const app  = require('../app');
const { db } = require('../db');

let orderId;
const TEST_TOKEN = 'test-customer-token-abc123';

beforeEach(() => {
  db.prepare(`DELETE FROM orders`).run();
  const res = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, status, customer_token, cost)
    VALUES ('WRK-TRK-0001','Ali','966500000001','خاتم','some notes','received', ?, 0)
  `).run(TEST_TOKEN);
  orderId = res.lastInsertRowid;
});

describe('GET /api/track/:token', () => {
  it('returns public order fields', async () => {
    const res = await request(app).get(`/api/track/${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tracking_number', 'WRK-TRK-0001');
    expect(res.body).toHaveProperty('status', 'received');
    expect(res.body).toHaveProperty('estimated_cost', 0);
  });

  it('does NOT expose phone or notes', async () => {
    const res = await request(app).get(`/api/track/${TEST_TOKEN}`);
    expect(res.body).not.toHaveProperty('phone');
    expect(res.body).not.toHaveProperty('notes');
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/track/unknown-token-xyz');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/track/:token/approve', () => {
  beforeEach(() => {
    db.prepare(`UPDATE orders SET status = 'pending_approval', cost = 50 WHERE id = ?`).run(orderId);
  });

  it('moves pending_approval to in_progress', async () => {
    const res = await request(app).post(`/api/track/${TEST_TOKEN}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 400 if order is not pending_approval', async () => {
    db.prepare(`UPDATE orders SET status = 'in_progress' WHERE id = ?`).run(orderId);
    const res = await request(app).post(`/api/track/${TEST_TOKEN}/approve`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown token', async () => {
    const res = await request(app).post('/api/track/bad-token/approve');
    expect(res.status).toBe(404);
  });
});
