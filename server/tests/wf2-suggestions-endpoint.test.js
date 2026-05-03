/**
 * WF-2 — GET /api/order-items/:id/suggested-technicians
 * Tests: scoring by specialization match, status weight, workload penalty,
 * 404 on missing item, tiebreaker determinism, auth enforcement.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const TechnicianService = require('../services/TechnicianService');

let wsToken, shopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
  wsToken   = jwt.sign({ id: 400, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 401, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
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

function makeTech({ name, status = 'available', active = 1 } = {}) {
  return db.prepare(
    `INSERT INTO technicians (name, status, active) VALUES (?, ?, ?)`
  ).run(name, status, active).lastInsertRowid;
}

function assignSpec(techId, specValue) {
  const specId = getSpecId(specValue);
  db.prepare(
    `INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`
  ).run(techId, specId);
}

function makeOrder(status = 'in_repair') {
  const num = `WF2S-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
    VALUES (?, 'Test', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), ?)
  `).run(num, status).lastInsertRowid;
}

function makeItem(orderId, itemType = 'خاتم') {
  return db.prepare(
    `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, ?, ?, 1)`
  ).run(orderId, itemType, itemType).lastInsertRowid;
}

function assignWork(techId, n = 1) {
  const orderId = makeOrder('in_repair');
  for (let i = 0; i < n; i++) {
    const itemId = makeItem(orderId);
    db.prepare(
      `INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`
    ).run(itemId, techId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — shape', () => {
  it('returns { item_id, item_type, matched_specializations, suggestions }', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');
    makeTech({ name: 'T' });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    expect(res.status).toBe(200);
    expect(res.body.item_id).toBe(itemId);
    expect(res.body.item_type).toBe('خاتم');
    expect(Array.isArray(res.body.matched_specializations)).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
  });

  it('each suggestion has id, name, status, active_count, score, matched_specs, specializations', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');
    const techId  = makeTech({ name: 'Ali' });
    assignSpec(techId, 'rings');

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const s = res.body.suggestions[0];
    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('name');
    expect(s).toHaveProperty('status');
    expect(s).toHaveProperty('active_count');
    expect(s).toHaveProperty('score');
    expect(s).toHaveProperty('matched_specs');
    expect(s).toHaveProperty('specializations');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — 404', () => {
  it('returns 404 for non-existent item id', async () => {
    const res = await request(app)
      .get('/api/order-items/999999/suggested-technicians')
      .set(auth(wsToken));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — specialization matching', () => {
  const MAPPED_TYPES = [
    ['خاتم', 'rings'],
    ['حلق',  'earrings'],
    ['قرط',  'earrings'],
    ['سوار', 'bracelets'],
    ['عقد',  'chains'],
    ['دبلة', 'rings'],
    ['ساعة', 'watches'],
  ];

  for (const [itemType, specValue] of MAPPED_TYPES) {
    it(`item_type="${itemType}" → matched_specializations includes "${specValue}"`, async () => {
      const orderId = makeOrder();
      const itemId  = makeItem(orderId, itemType);

      const res = await request(app)
        .get(`/api/order-items/${itemId}/suggested-technicians`)
        .set(auth(wsToken));

      expect(res.body.matched_specializations).toContain(specValue);
    });
  }

  it('item_type="أخرى" → empty matched_specializations', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    expect(res.body.matched_specializations).toEqual([]);
  });

  it('tech with matching spec scores higher than tech without', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'خاتم');

    const t1 = makeTech({ name: 'WithRings' });
    const t2 = makeTech({ name: 'NoRings' });
    assignSpec(t1, 'rings');

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const idx1 = res.body.suggestions.findIndex(s => s.id === t1);
    const idx2 = res.body.suggestions.findIndex(s => s.id === t2);
    expect(idx1).toBeLessThan(idx2);
    expect(res.body.suggestions[idx1].score).toBeGreaterThan(res.body.suggestions[idx2].score);
    expect(res.body.suggestions[idx1].matched_specs).toContain('rings');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — status weight', () => {
  it('available (+5) ranks above busy (0) with same workload and no spec match', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى'); // no spec mapping → pure status comparison

    const tAv = makeTech({ name: 'Avail', status: 'available' });
    const tBz = makeTech({ name: 'Busy',  status: 'busy' });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const scores = Object.fromEntries(res.body.suggestions.map(s => [s.id, s.score]));
    expect(scores[tAv]).toBeGreaterThan(scores[tBz]);
  });

  it('off_shift (-10) scores below busy (0)', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const tBz  = makeTech({ name: 'Busy', status: 'busy' });
    const tOff = makeTech({ name: 'Off',  status: 'off_shift' });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const scores = Object.fromEntries(res.body.suggestions.map(s => [s.id, s.score]));
    expect(scores[tBz]).toBeGreaterThan(scores[tOff]);
  });

  it('on_leave (-20) scores lowest of all statuses', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const tAv = makeTech({ name: 'Av',   status: 'available' });
    const tBz = makeTech({ name: 'Bz',   status: 'busy' });
    const tOf = makeTech({ name: 'Of',   status: 'off_shift' });
    const tLv = makeTech({ name: 'Leave',status: 'on_leave' });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians?limit=10`)
      .set(auth(wsToken));

    const byId = Object.fromEntries(res.body.suggestions.map(s => [s.id, s.score]));
    expect(byId[tAv]).toBeGreaterThan(byId[tBz]);
    expect(byId[tBz]).toBeGreaterThan(byId[tOf]);
    expect(byId[tOf]).toBeGreaterThan(byId[tLv]);
  });

  it('inactive (active=0) techs are excluded from suggestions', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const tActive   = makeTech({ name: 'Active',   active: 1 });
    const tInactive = makeTech({ name: 'Inactive', active: 0 });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const ids = res.body.suggestions.map(s => s.id);
    expect(ids).toContain(tActive);
    expect(ids).not.toContain(tInactive);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — workload penalty', () => {
  it('tech with more open assignments scores lower', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const tLight = makeTech({ name: 'Light' });
    const tHeavy = makeTech({ name: 'Heavy' });
    assignWork(tHeavy, 3); // -3 workload penalty vs 0

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const scores = Object.fromEntries(res.body.suggestions.map(s => [s.id, s.score]));
    expect(scores[tLight]).toBeGreaterThan(scores[tHeavy]);
  });

  it('workload from locked/terminal orders does not penalise', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');

    const techId = makeTech({ name: 'Delivered' });

    // Locked (delivered) assignment
    const lockedNum = `WF2S-LOCK-${Date.now()}`;
    const lockedId  = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, locked_at)
      VALUES (?, 'X', '966500000000', 'خاتم', 1, lower(hex(randomblob(8))), 'delivered', datetime('now'))
    `).run(lockedNum).lastInsertRowid;
    const lockedItem = db.prepare(
      `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, 'خاتم', 'خاتم', 1)`
    ).run(lockedId).lastInsertRowid;
    db.prepare(
      `INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)`
    ).run(lockedItem, techId);

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    const s = res.body.suggestions.find(x => x.id === techId);
    expect(s.active_count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — tiebreaker', () => {
  it('equal-score techs are sorted name ASC (deterministic)', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى'); // no spec → pure status score

    // All available, no workload → same score; should sort A → Z
    const names = ['Ziad', 'Ahmed', 'Mohammed', 'Bassam'];
    for (const name of names) makeTech({ name });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians?limit=10`)
      .set(auth(wsToken));

    const resultNames = res.body.suggestions.map(s => s.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(resultNames).toEqual(sortedNames);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — limit param', () => {
  it('default limit is 5', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');
    for (let i = 0; i < 8; i++) makeTech({ name: `T${i}` });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(wsToken));

    expect(res.body.suggestions.length).toBe(5);
  });

  it('limit param is respected up to max 20', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId, 'أخرى');
    for (let i = 0; i < 10; i++) makeTech({ name: `T${i}` });

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians?limit=8`)
      .set(auth(wsToken));

    expect(res.body.suggestions.length).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/order-items/:id/suggested-technicians — auth', () => {
  it('unauthenticated → 401', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId);

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`);
    expect(res.status).toBe(401);
  });

  it('shop_employee → 403', async () => {
    const orderId = makeOrder();
    const itemId  = makeItem(orderId);

    const res = await request(app)
      .get(`/api/order-items/${itemId}/suggested-technicians`)
      .set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TechnicianService._scoreAndRank — pure function', () => {
  it('spec match adds +10 per matched specialization', () => {
    const tech = {
      id: 1, name: 'A', status: 'available', active_count: 0,
      specializations: [{ value: 'rings' }, { value: 'gold_work' }],
    };
    const [result] = TechnicianService._scoreAndRank([tech], ['rings']);
    expect(result.score).toBe(10 + 5 + 0); // spec + available status + 0 workload
    expect(result.matched_specs).toEqual(['rings']);
  });

  it('workload penalty is active_count * -1', () => {
    const tech = {
      id: 1, name: 'A', status: 'available', active_count: 4,
      specializations: [],
    };
    const [result] = TechnicianService._scoreAndRank([tech], []);
    expect(result.score).toBe(5 - 4); // available + -4 workload
  });

  it('on_leave status gives -20 modifier', () => {
    const tech = {
      id: 1, name: 'A', status: 'on_leave', active_count: 0,
      specializations: [],
    };
    const [result] = TechnicianService._scoreAndRank([tech], []);
    expect(result.score).toBe(-20);
  });

  it('higher scoring tech appears first', () => {
    const t1 = { id: 1, name: 'A', status: 'on_leave',  active_count: 0, specializations: [] };
    const t2 = { id: 2, name: 'B', status: 'available', active_count: 0, specializations: [] };
    const ranked = TechnicianService._scoreAndRank([t1, t2], []);
    expect(ranked[0].id).toBe(2);
  });
});
