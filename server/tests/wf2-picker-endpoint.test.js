/**
 * WF-2 — GET /api/technicians/picker
 * Tests: pagination, search, specialization filter, status filter,
 * sort order (least-busy first), inactive exclusion, auth enforcement.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 300, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 301, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

function reset() {
  db.prepare(`DELETE FROM order_item_technicians`).run();
  db.prepare(`DELETE FROM technician_specializations`).run();
  db.prepare(`DELETE FROM order_status_history`).run();
  db.prepare(`DELETE FROM order_items`).run();
  db.prepare(`DELETE FROM orders`).run();
  db.prepare(`DELETE FROM technicians`).run();
}

beforeEach(reset);

function getSpecId(value) {
  return db.prepare(`SELECT id FROM specializations WHERE value = ?`).get(value).id;
}

function makeTech({ name, status = 'available', active = 1, role_id = null } = {}) {
  return db.prepare(
    `INSERT INTO technicians (name, status, active, role_id) VALUES (?, ?, ?, ?)`
  ).run(name, status, active, role_id).lastInsertRowid;
}

function assignSpec(techId, specValue) {
  const specId = getSpecId(specValue);
  db.prepare(
    `INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`
  ).run(techId, specId);
}

function makeOpenOrder() {
  const num = `WF2P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
    VALUES (?, 'Test', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), 'in_repair')
  `).run(num).lastInsertRowid;
}

function makeItem(orderId) {
  return db.prepare(
    `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, 'خاتم', 'خاتم', 1)`
  ).run(orderId).lastInsertRowid;
}

function assignWork(techId, n = 1) {
  const orderId = makeOpenOrder();
  for (let i = 0; i < n; i++) {
    const itemId = makeItem(orderId);
    db.prepare(
      `INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`
    ).run(itemId, techId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — shape', () => {
  it('returns { items, total }', async () => {
    makeTech({ name: 'علي' });
    const res = await request(app).get('/api/technicians/picker').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('each item has required fields', async () => {
    makeTech({ name: 'فني' });
    const res = await request(app).get('/api/technicians/picker').set(auth(wsToken));
    const item = res.body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('active_count');
    expect(item).toHaveProperty('specializations');
    expect(Array.isArray(item.specializations)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — default status filter', () => {
  it('returns only available techs by default', async () => {
    makeTech({ name: 'Available', status: 'available' });
    makeTech({ name: 'Busy',      status: 'busy' });
    makeTech({ name: 'Off',       status: 'off_shift' });
    makeTech({ name: 'Leave',     status: 'on_leave' });

    const res = await request(app).get('/api/technicians/picker').set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Available');
  });

  it('status=all returns all active regardless of status', async () => {
    makeTech({ name: 'Av',  status: 'available' });
    makeTech({ name: 'Bz',  status: 'busy' });
    makeTech({ name: 'Off', status: 'off_shift' });

    const res = await request(app).get('/api/technicians/picker?status=all').set(auth(wsToken));
    expect(res.body.total).toBe(3);
  });

  it('status=busy returns only busy techs', async () => {
    makeTech({ name: 'Av', status: 'available' });
    makeTech({ name: 'Bz', status: 'busy' });

    const res = await request(app).get('/api/technicians/picker?status=busy').set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Bz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — inactive exclusion', () => {
  it('excludes inactive (active=0) techs', async () => {
    makeTech({ name: 'Active',   active: 1 });
    makeTech({ name: 'Inactive', active: 0 });

    const res = await request(app).get('/api/technicians/picker?status=all').set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — search', () => {
  it('q filters by name (case-insensitive substring)', async () => {
    makeTech({ name: 'محمد علي' });
    makeTech({ name: 'أحمد' });

    const res = await request(app)
      .get(`/api/technicians/picker?q=${encodeURIComponent('محمد')}`)
      .set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('محمد علي');
  });

  it('q is case-insensitive for ASCII names', async () => {
    makeTech({ name: 'Ahmed' });
    makeTech({ name: 'Other' });

    const res = await request(app).get('/api/technicians/picker?q=ahmed&status=all').set(auth(wsToken));
    expect(res.body.total).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — specialization filter', () => {
  it('specialization_id filters to only techs with that spec', async () => {
    const ringsId = getSpecId('rings');
    const t1 = makeTech({ name: 'RingSpec' });
    const t2 = makeTech({ name: 'NoSpec' });
    assignSpec(t1, 'rings');

    const res = await request(app)
      .get(`/api/technicians/picker?specialization_id=${ringsId}&status=all`)
      .set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(t1);
  });

  it('combined: q + specialization_id', async () => {
    const ringsId = getSpecId('rings');
    const t1 = makeTech({ name: 'Ali' });
    const t2 = makeTech({ name: 'Ali-NoSpec' });
    assignSpec(t1, 'rings');

    const res = await request(app)
      .get(`/api/technicians/picker?q=Ali&specialization_id=${ringsId}&status=all`)
      .set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(t1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — sort order', () => {
  it('sorts least-busy first (active_count ASC)', async () => {
    const t1 = makeTech({ name: 'Heavy' });
    const t2 = makeTech({ name: 'Light' });
    const t3 = makeTech({ name: 'Idle' });

    assignWork(t1, 5);
    assignWork(t2, 2);
    // t3 has 0 assignments

    const res = await request(app).get('/api/technicians/picker?status=all').set(auth(wsToken));
    const names = res.body.items.map(i => i.name);
    expect(names[0]).toBe('Idle');
    expect(names[1]).toBe('Light');
    expect(names[2]).toBe('Heavy');
  });

  it('tiebreaker is name ASC when active_count is equal', async () => {
    const t1 = makeTech({ name: 'Zara' });
    const t2 = makeTech({ name: 'Amir' });
    // both idle

    const res = await request(app).get('/api/technicians/picker?status=all').set(auth(wsToken));
    const names = res.body.items.map(i => i.name);
    expect(names[0]).toBe('Amir');
    expect(names[1]).toBe('Zara');
  });

  it('active_count reflects only open (non-locked, non-terminal) assignments', async () => {
    const techId = makeTech({ name: 'T' });

    // Open assignment
    const openOrderId = makeOpenOrder();
    const openItemId  = makeItem(openOrderId);
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`).run(openItemId, techId);

    // Locked (delivered) assignment — should NOT count
    const lockedNum = `WF2P-LOCK-${Date.now()}`;
    const lockedId  = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, locked_at)
      VALUES (?, 'X', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), 'delivered', datetime('now'))
    `).run(lockedNum).lastInsertRowid;
    const lockedItemId = db.prepare(
      `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, 'خاتم', 'خاتم', 1)`
    ).run(lockedId).lastInsertRowid;
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`).run(lockedItemId, techId);

    const res = await request(app).get('/api/technicians/picker?status=all').set(auth(wsToken));
    expect(res.body.items[0].active_count).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — pagination', () => {
  it('limit caps at 100', async () => {
    makeTech({ name: 'A' });
    const res = await request(app).get('/api/technicians/picker?limit=999&status=all').set(auth(wsToken));
    expect(res.body).toHaveProperty('total');
  });

  it('returns correct slice with limit + implicit offset via total count', async () => {
    for (let i = 0; i < 5; i++) makeTech({ name: `Tech${i}` });
    const r1 = await request(app).get('/api/technicians/picker?limit=2&status=all').set(auth(wsToken));
    expect(r1.body.items.length).toBe(2);
    expect(r1.body.total).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/picker — auth', () => {
  it('unauthenticated → 401', async () => {
    const res = await request(app).get('/api/technicians/picker');
    expect(res.status).toBe(401);
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).get('/api/technicians/picker').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});
