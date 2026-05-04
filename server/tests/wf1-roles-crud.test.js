/**
 * WF-1b — Roles CRUD endpoints.
 * Covers GET / POST / PATCH / DELETE plus DuplicateRoleError, RoleInUseError,
 * 403 gating, soft-delete semantics. value is intentionally not editable.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  wsToken   = jwt.sign({ id: 100, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 101, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

function resetCustomRoles() {
  // Keep the 4 seeded defaults; remove anything else added by tests.
  db.prepare(`
    DELETE FROM roles WHERE value NOT IN ('jeweler', 'polisher', 'appraiser', 'apprentice')
  `).run();
  // Reactivate seeded roles in case a prior test soft-deleted one.
  db.prepare(`UPDATE roles SET active = 1 WHERE value IN ('jeweler','polisher','appraiser','apprentice')`).run();
  // Detach any test technicians from these roles.
  db.prepare(`UPDATE technicians SET role_id = NULL WHERE role_id IN (SELECT id FROM roles)`).run();
}

beforeEach(() => { resetCustomRoles(); });

describe('GET /api/roles', () => {
  it('workshop sees seeded defaults', async () => {
    const res = await request(app).get('/api/roles').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(4);
    const values = res.body.items.map(r => r.value);
    expect(values).toEqual(expect.arrayContaining(['jeweler', 'polisher', 'appraiser', 'apprentice']));
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).get('/api/roles').set(auth(shopToken));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/roles', () => {
  it('creates a custom role', async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ value: 'engraver', display_label_ar: 'حفّار' });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe('engraver');
    expect(res.body.display_label_ar).toBe('حفّار');
    expect(res.body.active).toBe(1);
  });

  it('duplicate value → 409 DuplicateRoleError', async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ value: 'jeweler', display_label_ar: 'مكرر' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/jeweler/);
  });

  it('missing value → 422 ValidationError', async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ display_label_ar: 'بدون قيمة' });
    expect(res.status).toBe(422);
  });

  it('missing display_label_ar → 422 ValidationError', async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ value: 'no_label' });
    expect(res.status).toBe(422);
  });

  it('shop_employee → 403', async () => {
    const res = await request(app).post('/api/roles').set(auth(shopToken))
      .send({ value: 'whatever', display_label_ar: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/roles/:id', () => {
  let id;
  beforeEach(async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ value: 'patch_test', display_label_ar: 'اختبار' });
    id = res.body.id;
  });

  it('updates display_label_ar', async () => {
    const res = await request(app).patch(`/api/roles/${id}`).set(auth(wsToken))
      .send({ display_label_ar: 'اختبار محدث' });
    expect(res.status).toBe(200);
    expect(res.body.display_label_ar).toBe('اختبار محدث');
  });

  it('updates sort_order', async () => {
    const res = await request(app).patch(`/api/roles/${id}`).set(auth(wsToken))
      .send({ sort_order: 99 });
    expect(res.status).toBe(200);
    expect(res.body.sort_order).toBe(99);
  });

  it('value is NOT editable — silently ignored', async () => {
    const res = await request(app).patch(`/api/roles/${id}`).set(auth(wsToken))
      .send({ value: 'ignored_change' });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe('patch_test');
  });

  it('blank display_label_ar → 422', async () => {
    const res = await request(app).patch(`/api/roles/${id}`).set(auth(wsToken))
      .send({ display_label_ar: '   ' });
    expect(res.status).toBe(422);
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).patch('/api/roles/999999').set(auth(wsToken))
      .send({ display_label_ar: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/roles/:id', () => {
  let unusedId;
  beforeEach(async () => {
    const res = await request(app).post('/api/roles').set(auth(wsToken))
      .send({ value: 'delete_me', display_label_ar: 'احذف' });
    unusedId = res.body.id;
  });

  it('hard-deletes when no technician references the role', async () => {
    const res = await request(app).delete(`/api/roles/${unusedId}`).set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Row must be gone
    const gone = db.prepare(`SELECT id FROM roles WHERE id = ?`).get(unusedId);
    expect(gone).toBeUndefined();
  });

  it('returns 409 RoleInUseError when an active technician references it', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('Used', ?, 1)`
    ).run(unusedId).lastInsertRowid;

    const res = await request(app).delete(`/api/roles/${unusedId}`).set(auth(wsToken));
    expect(res.status).toBe(409);

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });

  it('non-existent id → 404', async () => {
    const res = await request(app).delete('/api/roles/999999').set(auth(wsToken));
    expect(res.status).toBe(404);
  });
});
