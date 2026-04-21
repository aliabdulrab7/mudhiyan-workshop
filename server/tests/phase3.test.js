/**
 * Phase 3 Test Suite — Order API (Full CRUD + Workflow)
 *
 * Covers: customers, services, technicians, inventory, order-items
 * (diagnosis, photos, services assignment, parts, technician assignment)
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// ── Shared tokens ─────────────────────────────────────────────────────────────

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 20, role: 'workshop',      username: 'ws_user',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 21, role: 'shop_employee', username: 'shop_user', shop_id: 1    }, JWT_SECRET);
});

function auth(token) { return { Authorization: `Bearer ${token}` }; }

function makeOrder(overrides = {}) {
  const num  = overrides.order_number || `P3-TEST-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const name = overrides.customer_name || 'Ahmed Test';
  return db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
    VALUES (?, ?, '966500000001', 'خاتم', 1, lower(hex(randomblob(8))))
  `).run(num, name);
}

function makeItem(orderId, overrides = {}) {
  return db.prepare(`
    INSERT INTO order_items (order_id, item_type, item_name, quantity, notes, workshop_comment)
    VALUES (?, 'ring', 'خاتم ذهب', 1, '', '')
  `).run(orderId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/customers', () => {
  beforeEach(() => { db.prepare('DELETE FROM customers').run(); });

  it('creates a customer with valid data', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth(wsToken))
      .send({ name: 'خالد العمري', phone: '966501234567' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('خالد العمري');
    expect(res.body.phone).toBe('966501234567');
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth(wsToken))
      .send({ phone: '966501234567' });
    expect(res.status).toBe(400);
  });

  it('rejects missing phone', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth(wsToken))
      .send({ name: 'خالد' });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({ name: 'test', phone: '966500000000' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/customers', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM customers').run();
    db.prepare(`INSERT INTO customers (name, phone) VALUES ('Ali', '966500000001')`).run();
    db.prepare(`INSERT INTO customers (name, phone) VALUES ('Sara', '966500000002')`).run();
  });

  it('lists all customers', async () => {
    const res = await request(app).get('/api/customers').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('supports ?search filter', async () => {
    const res = await request(app).get('/api/customers?search=Ali').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Ali');
  });
});

describe('PUT /api/customers/:id', () => {
  let custId;
  beforeEach(() => {
    db.prepare('DELETE FROM customers').run();
    custId = db.prepare(`INSERT INTO customers (name, phone) VALUES ('old name', '966500000001')`).run().lastInsertRowid;
  });

  it('updates customer name', async () => {
    const res = await request(app)
      .put(`/api/customers/${custId}`)
      .set(auth(wsToken))
      .send({ name: 'new name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('new name');
  });

  it('returns 404 for unknown customer', async () => {
    const res = await request(app)
      .put('/api/customers/99999')
      .set(auth(wsToken))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/services', () => {
  beforeEach(() => { db.prepare('DELETE FROM services').run(); });

  it('workshop can create service', async () => {
    const res = await request(app)
      .post('/api/services')
      .set(auth(wsToken))
      .send({ name: 'تلميع', default_price: 50 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('تلميع');
    expect(res.body.default_price).toBe(50);
  });

  it('shop_employee cannot create service', async () => {
    const res = await request(app)
      .post('/api/services')
      .set(auth(shopToken))
      .send({ name: 'تلميع', default_price: 50 });
    expect(res.status).toBe(403);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/services')
      .set(auth(wsToken))
      .send({ default_price: 50 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/services', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM services').run();
    db.prepare(`INSERT INTO services (name, default_price) VALUES ('تلميع', 50)`).run();
    db.prepare(`INSERT INTO services (name, default_price) VALUES ('تغيير بطارية', 30)`).run();
  });

  it('lists all services', async () => {
    const res = await request(app).get('/api/services').set(auth(shopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('PUT /api/services/:id', () => {
  let svcId;
  beforeEach(() => {
    db.prepare('DELETE FROM services').run();
    svcId = db.prepare(`INSERT INTO services (name, default_price) VALUES ('قديم', 10)`).run().lastInsertRowid;
  });

  it('workshop can update service price', async () => {
    const res = await request(app)
      .put(`/api/services/${svcId}`)
      .set(auth(wsToken))
      .send({ default_price: 75 });
    expect(res.status).toBe(200);
    expect(res.body.default_price).toBe(75);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TECHNICIANS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/technicians', () => {
  beforeEach(() => { db.prepare('DELETE FROM technicians').run(); });

  it('workshop can create technician', async () => {
    const res = await request(app)
      .post('/api/technicians')
      .set(auth(wsToken))
      .send({ specialization: 'ذهب وفضة' });
    expect(res.status).toBe(201);
    expect(res.body.specialization).toBe('ذهب وفضة');
  });

  it('shop_employee cannot create technician', async () => {
    const res = await request(app)
      .post('/api/technicians')
      .set(auth(shopToken))
      .send({ specialization: 'ساعات' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/technicians', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM technicians').run();
    db.prepare(`INSERT INTO technicians (specialization) VALUES ('ذهب')`).run();
    db.prepare(`INSERT INTO technicians (specialization) VALUES ('فضة')`).run();
  });

  it('lists all technicians', async () => {
    const res = await request(app).get('/api/technicians').set(auth(shopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/inventory', () => {
  beforeEach(() => { db.prepare('DELETE FROM inventory_items').run(); });

  it('workshop can create inventory item', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set(auth(wsToken))
      .send({ name: 'بطارية', stock_qty: 10, unit: 'حبة', cost_per_unit: 5 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('بطارية');
    expect(res.body.stock_qty).toBe(10);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set(auth(wsToken))
      .send({ stock_qty: 5 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/inventory/:id/stock', () => {
  let invId;
  beforeEach(() => {
    db.prepare('DELETE FROM inventory_items').run();
    invId = db.prepare(`INSERT INTO inventory_items (name, stock_qty, unit) VALUES ('بطارية', 10, 'حبة')`).run().lastInsertRowid;
  });

  it('increases stock with positive change', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${invId}/stock`)
      .set(auth(wsToken))
      .send({ quantity_change: 5 });
    expect(res.status).toBe(200);
    expect(res.body.stock_qty).toBe(15);
  });

  it('decreases stock with negative change', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${invId}/stock`)
      .set(auth(wsToken))
      .send({ quantity_change: -3 });
    expect(res.status).toBe(200);
    expect(res.body.stock_qty).toBe(7);
  });

  it('rejects change that would make stock negative', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${invId}/stock`)
      .set(auth(wsToken))
      .send({ quantity_change: -20 });
    expect(res.status).toBe(400);
  });

  it('rejects non-numeric quantity_change', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${invId}/stock`)
      .set(auth(wsToken))
      .send({ quantity_change: 'abc' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ORDER ITEMS — PUT (update fields)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/order-items/:id', () => {
  let orderId, itemId;
  beforeEach(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-OI-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
  });

  it('updates item fields', async () => {
    const res = await request(app)
      .put(`/api/order-items/${itemId}`)
      .set(auth(wsToken))
      .send({ brand: 'Cartier', ring_size_before: '16' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('Cartier');
    expect(res.body.ring_size_before).toBe('16');
  });

  it('returns 400 when no valid fields provided', async () => {
    const res = await request(app)
      .put(`/api/order-items/${itemId}`)
      .set(auth(wsToken))
      .send({ unknown_field: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown item', async () => {
    const res = await request(app)
      .put('/api/order-items/99999')
      .set(auth(wsToken))
      .send({ brand: 'x' });
    expect(res.status).toBe(404);
  });

  it('blocks update on locked order', async () => {
    db.prepare(`UPDATE orders SET locked_at = datetime('now','localtime') WHERE id = ?`).run(orderId);
    const res = await request(app)
      .put(`/api/order-items/${itemId}`)
      .set(auth(wsToken))
      .send({ brand: 'blocked' });
    expect(res.status).toBe(409); // phase 6: locked orders return 409
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ORDER ITEMS — PHOTOS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/order-items/:id/photos', () => {
  let orderId, itemId;
  beforeEach(() => {
    db.prepare('DELETE FROM item_photos').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-PH-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
  });

  it('adds a before_repair photo', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/photos`)
      .set(auth(wsToken))
      .send({ photo_url: 'https://cdn.example.com/photo1.jpg', photo_type: 'before_repair' });
    expect(res.status).toBe(201);
    expect(res.body.photo_type).toBe('before_repair');
    expect(res.body.photo_url).toBe('https://cdn.example.com/photo1.jpg');
  });

  it('rejects invalid photo_type', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/photos`)
      .set(auth(wsToken))
      .send({ photo_url: 'https://cdn.example.com/x.jpg', photo_type: 'invalid_type' });
    expect(res.status).toBe(400);
  });

  it('rejects missing photo_url', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/photos`)
      .set(auth(wsToken))
      .send({ photo_type: 'before_repair' });
    expect(res.status).toBe(400);
  });

  it('all four photo_type values are accepted', async () => {
    for (const type of ['before_repair', 'after_repair', 'damage', 'delivery']) {
      const res = await request(app)
        .post(`/api/order-items/${itemId}/photos`)
        .set(auth(wsToken))
        .send({ photo_url: `https://cdn.example.com/${type}.jpg`, photo_type: type });
      expect(res.status).toBe(201);
    }
  });
});

describe('GET /api/order-items/:id/photos', () => {
  let orderId, itemId;
  beforeEach(() => {
    db.prepare('DELETE FROM item_photos').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-GPH-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
    db.prepare(`INSERT INTO item_photos (order_item_id, photo_url, photo_type, uploaded_by) VALUES (?, 'https://x.com/a.jpg', 'before_repair', 'tester')`).run(itemId);
    db.prepare(`INSERT INTO item_photos (order_item_id, photo_url, photo_type, uploaded_by) VALUES (?, 'https://x.com/b.jpg', 'after_repair', 'tester')`).run(itemId);
  });

  it('lists photos for item', async () => {
    const res = await request(app)
      .get(`/api/order-items/${itemId}/photos`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ORDER ITEMS — SERVICES ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/order-items/:id/services', () => {
  let orderId, itemId, svcId;
  beforeEach(() => {
    db.prepare('DELETE FROM order_item_services').run();
    db.prepare('DELETE FROM services').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-SVC-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
    svcId   = db.prepare(`INSERT INTO services (name, default_price) VALUES ('تلميع', 80)`).run().lastInsertRowid;
  });

  it('assigns service with default price', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(wsToken))
      .send({ service_id: svcId });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(80);
    expect(res.body.service_name).toBe('تلميع');
  });

  it('allows overriding price', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(wsToken))
      .send({ service_id: svcId, price: 60 });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(60);
  });

  it('rejects missing service_id', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(wsToken))
      .send({ price: 50 });
    expect(res.status).toBe(400);
  });

  it('rejects negative price', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(wsToken))
      .send({ service_id: svcId, price: -10 });
    expect(res.status).toBe(400);
  });

  it('rejects non-existent service_id', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(wsToken))
      .send({ service_id: 99999 });
    expect(res.status).toBe(404);
  });

  it('shop_employee cannot assign service', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/services`)
      .set(auth(shopToken))
      .send({ service_id: svcId });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ORDER ITEMS — PARTS (deducts stock atomically)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/order-items/:id/parts', () => {
  let orderId, itemId, invId;
  beforeEach(() => {
    db.prepare('DELETE FROM repair_parts_used').run();
    db.prepare('DELETE FROM inventory_items').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-PT-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
    invId   = db.prepare(`INSERT INTO inventory_items (name, stock_qty, unit) VALUES ('سبيكة ذهب', 5, 'جرام')`).run().lastInsertRowid;
  });

  it('records parts used and deducts stock', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/parts`)
      .set(auth(wsToken))
      .send({ inventory_item_id: invId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(2);
    expect(res.body.part_name).toBe('سبيكة ذهب');

    const inv = db.prepare('SELECT stock_qty FROM inventory_items WHERE id = ?').get(invId);
    expect(inv.stock_qty).toBe(3); // 5 - 2
  });

  it('rejects quantity exceeding available stock', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/parts`)
      .set(auth(wsToken))
      .send({ inventory_item_id: invId, quantity: 10 });
    expect(res.status).toBe(400);

    // Stock must not have changed
    const inv = db.prepare('SELECT stock_qty FROM inventory_items WHERE id = ?').get(invId);
    expect(inv.stock_qty).toBe(5);
  });

  it('rejects zero or negative quantity', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/parts`)
      .set(auth(wsToken))
      .send({ inventory_item_id: invId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects missing inventory_item_id', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/parts`)
      .set(auth(wsToken))
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects non-existent inventory_item_id', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/parts`)
      .set(auth(wsToken))
      .send({ inventory_item_id: 99999, quantity: 1 });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ORDER ITEMS — TECHNICIAN ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/order-items/:id/technicians', () => {
  let orderId, itemId, techId;
  beforeEach(() => {
    db.prepare('DELETE FROM order_item_technicians').run();
    db.prepare('DELETE FROM technicians').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    orderId = makeOrder({ order_number: `P3-TK-${Date.now()}` }).lastInsertRowid;
    itemId  = makeItem(orderId).lastInsertRowid;
    techId  = db.prepare(`INSERT INTO technicians (specialization) VALUES ('ذهب')`).run().lastInsertRowid;
  });

  it('assigns technician to item', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(201);
    expect(res.body.technician_id).toBe(techId);
  });

  it('prevents duplicate assignment', async () => {
    await request(app)
      .post(`/api/order-items/${itemId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });

    const res = await request(app)
      .post(`/api/order-items/${itemId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: techId });
    expect(res.status).toBe(409);
  });

  it('rejects non-existent technician', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/technicians`)
      .set(auth(wsToken))
      .send({ technician_id: 99999 });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ORDER ITEMS — DIAGNOSIS (triggers FSM transition)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/order-items/:id/diagnosis', () => {
  let orderId, itemId;

  beforeEach(() => {
    db.prepare('DELETE FROM repair_parts_used').run();
    db.prepare('DELETE FROM order_item_services').run();
    db.prepare('DELETE FROM order_item_technicians').run();
    db.prepare('DELETE FROM item_photos').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM order_status_history').run();
    db.prepare('DELETE FROM orders').run();

    // Create order in diagnosing state
    const orderNum = `P3-DX-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
    const r = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES (?, 'Ahmed', '966501112222', 'خاتم', 1, lower(hex(randomblob(8))), 'inspection')
    `).run(orderNum);
    orderId = r.lastInsertRowid;
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'received', 'inspection', 'test')`).run(orderId);

    itemId = db.prepare(`
      INSERT INTO order_items (order_id, item_type, item_name, quantity, notes, workshop_comment)
      VALUES (?, 'ring', 'خاتم ذهب', 1, '', '')
    `).run(orderId).lastInsertRowid;
  });

  it('diagnosis with cost > 0 writes cost; order stays in inspection until workshop sends for approval', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/diagnosis`)
      .set(auth(wsToken))
      .send({ repair_description: 'تغيير حجم', estimated_cost: 150 });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('inspection');
    expect(res.body.order.cost).toBe(150);

    const sent = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe('waiting_approval');
  });

  it('diagnosis with cost = 0 writes cost; send-for-approval fast-paths to in_repair', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/diagnosis`)
      .set(auth(wsToken))
      .send({ repair_description: 'تلميع مجاني', estimated_cost: 0 });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('inspection');

    const sent = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe('in_repair');
  });

  it('rejects diagnosis when order not in diagnosing status', async () => {
    db.prepare(`UPDATE orders SET status = 'received' WHERE id = ?`).run(orderId);
    const res = await request(app)
      .post(`/api/order-items/${itemId}/diagnosis`)
      .set(auth(wsToken))
      .send({ repair_description: 'test', estimated_cost: 100 });
    expect(res.status).toBe(400);
  });

  it('rejects negative estimated_cost', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/diagnosis`)
      .set(auth(wsToken))
      .send({ repair_description: 'test', estimated_cost: -50 });
    expect(res.status).toBe(400);
  });

  it('shop_employee cannot submit diagnosis', async () => {
    const res = await request(app)
      .post(`/api/order-items/${itemId}/diagnosis`)
      .set(auth(shopToken))
      .send({ repair_description: 'test', estimated_cost: 100 });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. SEND-FOR-APPROVAL — AUTO-SKIP FREE ITEMS (Bug 2)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Contract: when workshop clicks "إرسال للعميل للموافقة", any order_item still
// in 'pending' with estimated_cost IS NULL OR = 0 must be flipped to 'skipped'
// atomically with the status transition. Free items don't reach the customer.

describe('POST /api/orders/:id/send-for-approval — auto-skip free items', () => {
  let orderId;

  beforeEach(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM order_status_history').run();
    db.prepare('DELETE FROM orders').run();

    const orderNum = `P3-SKIP-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
    const r = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
      VALUES (?, 'Auto-Skip Test', '966501112223', 'خاتم', 1, lower(hex(randomblob(8))), 'inspection')
    `).run(orderNum);
    orderId = r.lastInsertRowid;
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'received', 'inspection', 'test')`).run(orderId);
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
    // NULL items block inspection-send normally, but only when there are ZERO priced
    // items. When a priced sibling exists, the endpoint proceeds and NULL items
    // should also be auto-skipped per spec.
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
    const a = seedItem({ cost: 100 });
    const b = seedItem({ cost: 250 });

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

  it('does not touch items already in approved/rejected/skipped (idempotent)', async () => {
    // Simulate a re-quote scenario: one item was approved previously, one was
    // skipped previously, one was rejected previously (has a new cost now to
    // justify re-quote), and one new pending free item.
    const approvedPrev = seedItem({ cost: 100, approval_status: 'approved' });
    const skippedPrev  = seedItem({ cost: 0,   approval_status: 'skipped'  });
    const rejectedPrev = seedItem({ cost: 75,  approval_status: 'rejected' });
    const newFree      = seedItem({ cost: 0,   approval_status: 'pending'  });
    const newPriced    = seedItem({ cost: 50,  approval_status: 'pending'  });

    // Push order to in_repair so send-for-approval treats this as a re-quote.
    // (Requires at least one pending item with cost > 0 to pass the business rule.)
    db.prepare(`UPDATE orders SET status = 'in_repair' WHERE id = ?`).run(orderId);
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'inspection', 'in_repair', 'test')`).run(orderId);

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
    const f1 = seedItem({ cost: 0 });
    const f2 = seedItem({ cost: 0 });

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
    // Force the transition to fail by putting the order in a status the
    // endpoint rejects. Items must remain untouched.
    db.prepare(`UPDATE orders SET status = 'new' WHERE id = ?`).run(orderId);
    const free = seedItem({ cost: 0 });
    const paid = seedItem({ cost: 100 });

    const res = await request(app)
      .post(`/api/orders/${orderId}/send-for-approval`)
      .set(auth(wsToken));
    expect(res.status).toBe(400);

    // The endpoint short-circuits before the transaction, so nothing was written.
    // This assertion also guards against a future refactor that moves the UPDATE
    // above the ALLOWED_FROM check — in that case we'd still expect rollback.
    const rows = db.prepare(
      'SELECT id, approval_status FROM order_items WHERE order_id = ?'
    ).all(orderId);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.approval_status]));
    expect(byId[free]).toBe('pending');
    expect(byId[paid]).toBe('pending');
  });
});
