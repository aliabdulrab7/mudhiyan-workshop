const request = require('supertest');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let workshopToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Shop A')`).run();
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (2, 'Shop B')`).run();

  workshopToken = jwt.sign({ id: 10, role: 'workshop',      shop_id: null }, JWT_SECRET);
  shopToken     = jwt.sign({ id: 11, role: 'shop_employee', shop_id: 1    }, JWT_SECRET);
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

describe('Order scoping', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM orders`).run();
    // Order belonging to shop 1
    db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('WRK-TEST-0001','Ali','966500000001','خاتم',1, 'token-shop1')`).run();
    // Order belonging to shop 2
    db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('WRK-TEST-0002','Sara','966500000002','سوار',2,'token-shop2')`).run();
  });

  it('workshop sees all orders', async () => {
    const res = await request(app).get('/api/orders').set(auth(workshopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('shop_employee sees only own shop orders', async () => {
    const res = await request(app).get('/api/orders').set(auth(shopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].order_number).toBe('WRK-TEST-0001');
  });
});

describe('PATCH /api/orders/:id/cost', () => {
  let orderId;
  beforeEach(() => {
    db.prepare(`DELETE FROM orders`).run();
    const res = db.prepare(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES ('WRK-COST-0001','Ali','966500000001','خاتم',1,'token-cost','inspection')`).run();
    orderId = res.lastInsertRowid;
    // Add an item so refreshOrderCost has rows to sum
    db.prepare(`INSERT INTO order_items (order_id, item_name, item_type, sort_order) VALUES (?, 'خاتم ذهبي', 'ring', 1)`).run(orderId);
  });

  it('cost > 0 sets status to waiting_approval', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 50 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waiting_approval');
    expect(res.body.cost).toBe(50);
  });

  it('cost = 0 sets status to in_repair', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 0 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_repair');
  });

  it('shop_employee cannot set cost', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(shopToken))
      .send({ cost: 50 });
    expect(res.status).toBe(403);
  });
});
