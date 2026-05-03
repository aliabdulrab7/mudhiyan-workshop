/**
 * WF-4 — GET /api/technicians/item-type-spec-map
 *         PUT /api/technicians/item-type-spec-map/:itemType
 *
 * Tests: seeded map shape, upsert, unknown-spec validation, cache invalidation
 * (suggestForItem sees updated map after PUT), URL encoding, auth enforcement.
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
  wsToken   = jwt.sign({ id: 400, role: 'workshop',      username: 'ws4',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 401, role: 'shop_employee', username: 'shop4', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

function resetMap() {
  db.prepare(`DELETE FROM item_type_spec_map`).run();
  db.prepare(`
    INSERT OR IGNORE INTO item_type_spec_map (item_type, spec_values) VALUES
    ('خاتم', '["rings"]'), ('حلق', '["earrings"]'), ('ساعة', '["watches"]')
  `).run();
  TechnicianService._invalidateSpecMapCache?.() ?? (TechnicianService.getItemTypeSpecMap && TechnicianService.getItemTypeSpecMap());
}

beforeEach(() => {
  resetMap();
  // Always invalidate the cache so each test reads fresh from DB
  if (TechnicianService._invalidateSpecMapCache) TechnicianService._invalidateSpecMapCache();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/technicians/item-type-spec-map
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/technicians/item-type-spec-map', () => {
  it('returns { map } array with correct shape', async () => {
    const res = await request(app)
      .get('/api/technicians/item-type-spec-map')
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('map');
    expect(Array.isArray(res.body.map)).toBe(true);
    const khatim = res.body.map.find(r => r.item_type === 'خاتم');
    expect(khatim).toBeDefined();
    expect(khatim.spec_values).toEqual(['rings']);
    expect(khatim).toHaveProperty('updated_at');
    expect(khatim).toHaveProperty('updated_by_username');
  });

  it('returns all seeded rows', async () => {
    const res = await request(app)
      .get('/api/technicians/item-type-spec-map')
      .set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.map.length).toBeGreaterThanOrEqual(3);
  });

  it('403 for shop_employee', async () => {
    const res = await request(app)
      .get('/api/technicians/item-type-spec-map')
      .set(auth(shopToken));
    expect(res.status).toBe(403);
  });

  it('401 without auth', async () => {
    const res = await request(app).get('/api/technicians/item-type-spec-map');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/technicians/item-type-spec-map/:itemType
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/technicians/item-type-spec-map/:itemType', () => {
  it('updates an existing row and GET returns new value', async () => {
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%AE%D8%A7%D8%AA%D9%85') // خاتم
      .set(auth(wsToken))
      .send({ spec_values: ['rings', 'diamond_setting'] });
    expect(put.status).toBe(200);
    expect(put.body.spec_values).toEqual(['rings', 'diamond_setting']);

    const get = await request(app)
      .get('/api/technicians/item-type-spec-map')
      .set(auth(wsToken));
    const row = get.body.map.find(r => r.item_type === 'خاتم');
    expect(row.spec_values).toEqual(['rings', 'diamond_setting']);
  });

  it('creates a new row for an item type not yet in the map', async () => {
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D9%82%D8%B1%D8%B7') // قرط
      .set(auth(wsToken))
      .send({ spec_values: ['earrings'] });
    expect(put.status).toBe(200);
    expect(put.body.item_type).toBe('قرط');
    expect(put.body.spec_values).toEqual(['earrings']);
  });

  it('sets an empty array (clears specializations for a type)', async () => {
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%AE%D8%A7%D8%AA%D9%85') // خاتم
      .set(auth(wsToken))
      .send({ spec_values: [] });
    expect(put.status).toBe(200);
    expect(put.body.spec_values).toEqual([]);
  });

  it('422 for unknown spec value', async () => {
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%AE%D8%A7%D8%AA%D9%85')
      .set(auth(wsToken))
      .send({ spec_values: ['nonexistent_spec_xyz'] });
    expect(put.status).toBe(422);
    expect(put.body.error).toMatch(/غير معروف/);
  });

  it('403 for shop_employee', async () => {
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%AE%D8%A7%D8%AA%D9%85')
      .set(auth(shopToken))
      .send({ spec_values: ['rings'] });
    expect(put.status).toBe(403);
  });

  it('URL-decodes Arabic item type from percent-encoded path', async () => {
    // ساعة = %D8%B3%D8%A7%D8%B9%D8%A9
    const put = await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%B3%D8%A7%D8%B9%D8%A9')
      .set(auth(wsToken))
      .send({ spec_values: ['watches', 'repair_general'] });
    expect(put.status).toBe(200);
    expect(put.body.item_type).toBe('ساعة');
    expect(put.body.spec_values).toContain('watches');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cache invalidation — suggestForItem sees updated map after PUT
// ─────────────────────────────────────────────────────────────────────────────

describe('Cache invalidation', () => {
  function makeTech(name, status = 'available', specValues = []) {
    const id = db.prepare(
      `INSERT INTO technicians (name, status, active) VALUES (?, ?, 1)`
    ).run(name, status).lastInsertRowid;
    for (const v of specValues) {
      const specId = db.prepare(`SELECT id FROM specializations WHERE value = ?`).get(v)?.id;
      if (specId) db.prepare(
        `INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`
      ).run(id, specId);
    }
    return id;
  }

  function makeItem(type = 'خاتم') {
    const orderId = db.prepare(`
      INSERT INTO orders (order_number, customer_name, phone, piece_type, customer_token, status)
      VALUES (?, 'Test', '966500000000', ?, lower(hex(randomblob(8))), 'in_repair')
    `).run(`WF4SM-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, type).lastInsertRowid;
    return db.prepare(
      `INSERT INTO order_items (order_id, item_type, item_name, quantity) VALUES (?, ?, ?, 1)`
    ).run(orderId, type, type).lastInsertRowid;
  }

  beforeEach(() => {
    db.prepare(`DELETE FROM order_item_technicians`).run();
    db.prepare(`DELETE FROM technician_specializations`).run();
    db.prepare(`DELETE FROM technicians`).run();
    db.prepare(`DELETE FROM order_items`).run();
    db.prepare(`DELETE FROM orders`).run();
    resetMap();
  });

  it('suggestForItem uses updated spec map after PUT flushes cache', async () => {
    // Tech with 'earrings' spec
    const techId = makeTech('فني', 'available', ['earrings']);
    // Item type خاتم currently maps to ['rings'] — tech has no ring spec, score = 0+5-0=5
    const itemId = makeItem('خاتم');

    const before = TechnicianService.suggestForItem(itemId, { limit: 5 });
    expect(before.suggestions[0].matched_specs).toEqual([]);

    // Update map so خاتم → ['earrings']
    await request(app)
      .put('/api/technicians/item-type-spec-map/%D8%AE%D8%A7%D8%AA%D9%85')
      .set(auth(wsToken))
      .send({ spec_values: ['earrings'] });

    const after = TechnicianService.suggestForItem(itemId, { limit: 5 });
    expect(after.suggestions[0].matched_specs).toEqual(['earrings']);
    expect(after.suggestions[0].score).toBeGreaterThan(before.suggestions[0].score);
  });
});
