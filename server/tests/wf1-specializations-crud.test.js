/**
 * WF-1b — Specializations CRUD endpoints.
 * Mirrors roles tests; DELETE blocks via SpecializationInUseError when any
 * row in technician_specializations references it.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  wsToken   = jwt.sign({ id: 110, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 111, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

const SEEDED_VALUES = [
  'rings', 'chains', 'bracelets', 'earrings', 'watches',
  'gold_work', 'silver_work', 'diamond_setting', 'gem_setting',
  'engraving', 'polishing', 'repair_general',
];

function resetCustomSpecs() {
  db.prepare(
    `DELETE FROM specializations WHERE value NOT IN (${SEEDED_VALUES.map(() => '?').join(',')})`
  ).run(...SEEDED_VALUES);
  db.prepare(
    `UPDATE specializations SET active = 1 WHERE value IN (${SEEDED_VALUES.map(() => '?').join(',')})`
  ).run(...SEEDED_VALUES);
  db.prepare(`DELETE FROM technician_specializations`).run();
}

beforeEach(() => { resetCustomSpecs(); });

describe('GET /api/specializations', () => {
  it('workshop sees 12 seeded defaults', async () => {
    const res = await request(app).get('/api/specializations').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(12);
    const values = res.body.items.map(r => r.value);
    expect(values).toEqual(expect.arrayContaining(SEEDED_VALUES));
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).get('/api/specializations').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/specializations', () => {
  it('creates a custom specialization', async () => {
    const res = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ value: 'enamel_work', display_label_ar: 'أعمال المينا' });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe('enamel_work');
  });

  it('duplicate value → 409 DuplicateSpecializationError', async () => {
    const res = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ value: 'rings', display_label_ar: 'مكرر' });
    expect(res.status).toBe(409);
  });

  it('missing fields → 422', async () => {
    const r1 = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ display_label_ar: 'بدون' });
    expect(r1.status).toBe(422);
    const r2 = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ value: 'no_label_spec' });
    expect(r2.status).toBe(422);
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).post('/api/specializations').set(auth(shopToken))
      .send({ value: 'x', display_label_ar: 'y' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/specializations/:id', () => {
  let id;
  beforeEach(async () => {
    const res = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ value: 'patch_spec', display_label_ar: 'اختبار' });
    id = res.body.id;
  });

  it('value is not editable', async () => {
    const res = await request(app).patch(`/api/specializations/${id}`).set(auth(wsToken))
      .send({ value: 'ignored', display_label_ar: 'محدث' });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe('patch_spec');
    expect(res.body.display_label_ar).toBe('محدث');
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).patch('/api/specializations/999999').set(auth(wsToken))
      .send({ display_label_ar: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/specializations/:id', () => {
  let unusedId;
  beforeEach(async () => {
    const res = await request(app).post('/api/specializations').set(auth(wsToken))
      .send({ value: 'delete_me_spec', display_label_ar: 'احذف' });
    unusedId = res.body.id;
  });

  it('soft-deletes when no technician references it', async () => {
    const res = await request(app).delete(`/api/specializations/${unusedId}`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(0);
  });

  it('returns 409 SpecializationInUseError when a technician_specializations row exists', async () => {
    const techId = db.prepare(`INSERT INTO technicians (name, active) VALUES ('SpecUser', 1)`)
      .run().lastInsertRowid;
    db.prepare(`
      INSERT INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)
    `).run(techId, unusedId);

    const res = await request(app).delete(`/api/specializations/${unusedId}`).set(auth(wsToken));
    expect(res.status).toBe(409);

    db.prepare(`DELETE FROM technician_specializations WHERE technician_id = ?`).run(techId);
    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).delete('/api/specializations/999999').set(auth(wsToken));
    expect(res.status).toBe(404);
  });
});
