/**
 * WF-1b — Technicians CRUD endpoints.
 * Covers list (filters / pagination / search / with=workload), detail,
 * create, update, soft-delete (with TechnicianHasAssignmentsError),
 * specialization assign/unassign (idempotent).
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 200, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 201, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
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

function makeOrder({ status = 'inspection', locked = false } = {}) {
  const num = `WF1B-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  return db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, locked_at)
    VALUES (?, 'Test', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), ?, ?)
  `).run(num, status, locked ? new Date().toISOString() : null).lastInsertRowid;
}

function makeItem(orderId, { priority = 'standard' } = {}) {
  return db.prepare(`
    INSERT INTO order_items (order_id, item_type, item_name, quantity, priority)
    VALUES (?, 'ring', 'خاتم', 1, ?)
  `).run(orderId, priority).lastInsertRowid;
}

function getRoleId(value) {
  return db.prepare(`SELECT id FROM roles WHERE value = ?`).get(value).id;
}

function getSpecId(value) {
  return db.prepare(`SELECT id FROM specializations WHERE value = ?`).get(value).id;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/technicians', () => {
  it('returns paginated shape: { items, total, limit, offset }', async () => {
    db.prepare(`INSERT INTO technicians (name) VALUES ('A'), ('B'), ('C')`).run();
    const res = await request(app).get('/api/technicians').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, limit: 20, offset: 0 });
    expect(res.body.items.length).toBe(3);
    expect(res.body.items[0]).toHaveProperty('name');
    expect(res.body.items[0]).toHaveProperty('specializations_top3');
  });

  it('filters by role_id', async () => {
    const jewelerId   = getRoleId('jeweler');
    const polisherId  = getRoleId('polisher');
    db.prepare(`INSERT INTO technicians (name, role_id) VALUES ('A', ?)`).run(jewelerId);
    db.prepare(`INSERT INTO technicians (name, role_id) VALUES ('B', ?)`).run(polisherId);
    db.prepare(`INSERT INTO technicians (name, role_id) VALUES ('C', ?)`).run(jewelerId);

    const res = await request(app).get(`/api/technicians?role_id=${jewelerId}`).set(auth(wsToken));
    expect(res.body.total).toBe(2);
    expect(res.body.items.every(r => r.role_id === jewelerId)).toBe(true);
  });

  it('filters by status', async () => {
    db.prepare(`INSERT INTO technicians (name, status) VALUES ('Av', 'available')`).run();
    db.prepare(`INSERT INTO technicians (name, status) VALUES ('Bz', 'busy')`).run();
    db.prepare(`INSERT INTO technicians (name, status) VALUES ('Of', 'off_shift')`).run();

    const res = await request(app).get('/api/technicians?status=busy').set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Bz');
  });

  it('search is case-insensitive substring on name', async () => {
    db.prepare(`INSERT INTO technicians (name) VALUES ('علي'), ('Aali'), ('Other')`).run();
    const res = await request(app).get('/api/technicians?search=ali').set(auth(wsToken));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Aali');
  });

  it('paginates: limit + offset', async () => {
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO technicians (name) VALUES (?)`).run(`T${i}`);
    }
    const r1 = await request(app).get('/api/technicians?limit=2&offset=0').set(auth(wsToken));
    expect(r1.body.total).toBe(5);
    expect(r1.body.items.length).toBe(2);
    const r2 = await request(app).get('/api/technicians?limit=2&offset=4').set(auth(wsToken));
    expect(r2.body.items.length).toBe(1);
  });

  it('caps limit at 100', async () => {
    db.prepare(`INSERT INTO technicians (name) VALUES ('A')`).run();
    const res = await request(app).get('/api/technicians?limit=999').set(auth(wsToken));
    expect(res.body.limit).toBe(100);
  });

  it('with=workload returns active_count + urgent_count per row', async () => {
    const techId = db.prepare(`INSERT INTO technicians (name) VALUES ('Workload')`).run().lastInsertRowid;
    const orderId = makeOrder({ status: 'in_repair' });
    const i1 = makeItem(orderId, { priority: 'urgent' });
    const i2 = makeItem(orderId, { priority: 'standard' });
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`).run(i1, techId);
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`).run(i2, techId);

    const res = await request(app).get('/api/technicians?with=workload').set(auth(wsToken));
    const row = res.body.items.find(r => r.id === techId);
    expect(row.active_count).toBe(2);
    expect(row.urgent_count).toBe(1);
  });

  it('without with=workload, no workload fields on rows', async () => {
    db.prepare(`INSERT INTO technicians (name) VALUES ('NoWL')`).run();
    const res = await request(app).get('/api/technicians').set(auth(wsToken));
    expect(res.body.items[0]).not.toHaveProperty('active_count');
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).get('/api/technicians').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/technicians/:id', () => {
  it('returns full detail with specializations + recent_assignments + workload', async () => {
    const techId = db.prepare(`INSERT INTO technicians (name, role_id) VALUES ('Detail', ?)`)
      .run(getRoleId('jeweler')).lastInsertRowid;
    db.prepare(`INSERT INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`)
      .run(techId, getSpecId('gold_work'));

    const res = await request(app).get(`/api/technicians/${techId}`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Detail');
    expect(res.body.role_value).toBe('jeweler');
    expect(res.body.specializations.length).toBe(1);
    expect(res.body.specializations[0].value).toBe('gold_work');
    expect(res.body).toHaveProperty('recent_assignments');
    expect(res.body).toHaveProperty('active_count');
    expect(res.body).toHaveProperty('urgent_count');
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).get('/api/technicians/999999').set(auth(wsToken));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/technicians', () => {
  it('creates with required name only', async () => {
    const res = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'New Tech' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Tech');
    expect(res.body.status).toBe('available');
    expect(res.body.active).toBe(1);
    expect(res.body.specializations).toEqual([]);
  });

  it('creates with role + specialization_ids', async () => {
    const roleId = getRoleId('jeweler');
    const specA  = getSpecId('rings');
    const specB  = getSpecId('gold_work');
    const res = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'Full', role_id: roleId, specialization_ids: [specA, specB] });
    expect(res.status).toBe(201);
    expect(res.body.role_id).toBe(roleId);
    expect(res.body.specializations.map(s => s.value).sort()).toEqual(['gold_work', 'rings']);
  });

  it('missing name → 422', async () => {
    const res = await request(app).post('/api/technicians').set(auth(wsToken)).send({});
    expect(res.status).toBe(422);
  });

  it('blank name → 422', async () => {
    const res = await request(app).post('/api/technicians').set(auth(wsToken)).send({ name: '   ' });
    expect(res.status).toBe(422);
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).post('/api/technicians').set(auth(shopToken))
      .send({ name: 'Blocked' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/technicians/:id', () => {
  let id;
  beforeEach(async () => {
    const res = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'Patch Target' });
    id = res.body.id;
  });

  it('updates name', async () => {
    const res = await request(app).patch(`/api/technicians/${id}`).set(auth(wsToken))
      .send({ name: 'Renamed' });
    expect(res.body.name).toBe('Renamed');
  });

  it('updates status (valid value)', async () => {
    const res = await request(app).patch(`/api/technicians/${id}`).set(auth(wsToken))
      .send({ status: 'busy' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('busy');
  });

  it('rejects invalid status enum value → 422', async () => {
    const res = await request(app).patch(`/api/technicians/${id}`).set(auth(wsToken))
      .send({ status: 'on_holiday' });
    expect(res.status).toBe(422);
  });

  it('updates role_id', async () => {
    const polisherId = getRoleId('polisher');
    const res = await request(app).patch(`/api/technicians/${id}`).set(auth(wsToken))
      .send({ role_id: polisherId });
    expect(res.body.role_id).toBe(polisherId);
    expect(res.body.role_value).toBe('polisher');
  });

  it('disallowed fields silently ignored', async () => {
    const res = await request(app).patch(`/api/technicians/${id}`).set(auth(wsToken))
      .send({ id: 999, created_at: '1999-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).patch('/api/technicians/999999').set(auth(wsToken))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/technicians/:id (soft)', () => {
  it('soft-deletes when no open assignments', async () => {
    const created = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'Idle' });
    const res = await request(app).delete(`/api/technicians/${created.body.id}`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(0);
  });

  it('returns 409 TechnicianHasAssignmentsError when open work assigned', async () => {
    const created = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'Busy' });
    const techId = created.body.id;
    const orderId = makeOrder({ status: 'in_repair' });
    const itemId  = makeItem(orderId);
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`)
      .run(itemId, techId);

    const res = await request(app).delete(`/api/technicians/${techId}`).set(auth(wsToken));
    expect(res.status).toBe(409);
  });

  it('allows soft-delete when assignments are only on locked/cancelled orders', async () => {
    const created = await request(app).post('/api/technicians').set(auth(wsToken))
      .send({ name: 'Closed' });
    const techId = created.body.id;
    const orderId = makeOrder({ status: 'delivered', locked: true });
    const itemId  = makeItem(orderId);
    db.prepare(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`)
      .run(itemId, techId);

    const res = await request(app).delete(`/api/technicians/${techId}`).set(auth(wsToken));
    expect(res.status).toBe(200);
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).delete('/api/technicians/999999').set(auth(wsToken));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Specialization M:M endpoints', () => {
  let techId, specId;
  beforeEach(async () => {
    const t = await request(app).post('/api/technicians').set(auth(wsToken)).send({ name: 'SpecOps' });
    techId = t.body.id;
    specId = getSpecId('rings');
  });

  it('POST adds a specialization', async () => {
    const res = await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({ specialization_id: specId });
    expect(res.status).toBe(200);
    expect(res.body.specializations.map(s => s.value)).toEqual(['rings']);
  });

  it('POST is idempotent — adding the same spec twice does not error or duplicate', async () => {
    await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({ specialization_id: specId });
    const res = await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({ specialization_id: specId });
    expect(res.status).toBe(200);
    expect(res.body.specializations.length).toBe(1);
  });

  it('POST missing specialization_id → 400', async () => {
    const res = await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST non-existent technician → 404', async () => {
    const res = await request(app).post(`/api/technicians/999999/specializations`).set(auth(wsToken))
      .send({ specialization_id: specId });
    expect(res.status).toBe(404);
  });

  it('POST non-existent specialization → 404', async () => {
    const res = await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({ specialization_id: 999999 });
    expect(res.status).toBe(404);
  });

  it('DELETE removes a specialization', async () => {
    await request(app).post(`/api/technicians/${techId}/specializations`).set(auth(wsToken))
      .send({ specialization_id: specId });
    const res = await request(app).delete(`/api/technicians/${techId}/specializations/${specId}`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.specializations).toEqual([]);
  });

  it('DELETE on a non-linked spec is a no-op (no error)', async () => {
    const res = await request(app).delete(`/api/technicians/${techId}/specializations/${specId}`)
      .set(auth(wsToken));
    expect(res.status).toBe(200);
  });
});
