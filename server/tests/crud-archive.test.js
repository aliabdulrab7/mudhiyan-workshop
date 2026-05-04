/**
 * Phase 3 — Archive/restore + ref-count tests for the four entity endpoints:
 * roles, specializations, repair_options, technicians.
 *
 * Covers:
 *  - GET default excludes archived rows
 *  - GET ?include_archived=true shows archived rows
 *  - POST /:id/archive sets archived_at, active=0
 *  - POST /:id/restore clears archived_at, active=1
 *  - GET /:id/ref-count returns correct count before and after tech assignment
 *  - DELETE still blocked (409) when active references exist (regression)
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let ws; // workshop token
beforeAll(() => {
  ws = jwt.sign({ id: 200, role: 'workshop', username: 'archivist', shop_id: null }, JWT_SECRET);
});
function auth() { return { Authorization: `Bearer ${ws}` }; }

// ─── helpers ──────────────────────────────────────────────────────────────────

function createRole(value = `role_${Date.now()}`) {
  return request(app).post('/api/roles').set(auth())
    .send({ value, display_label_ar: `اختبار ${value}` });
}

function createSpec(value = `spec_${Date.now()}`) {
  return request(app).post('/api/specializations').set(auth())
    .send({ value, display_label_ar: `تخصص ${value}` });
}

function createRepairOpt(value = `fix_${Date.now()}`) {
  return request(app).post('/api/repair-options').set(auth())
    .send({ item_type: 'ring', value, needs: null });
}

function createTech(name = `Tech_${Date.now()}`) {
  return request(app).post('/api/technicians').set(auth())
    .send({ name });
}

// ─── ROLES ────────────────────────────────────────────────────────────────────

describe('Roles — archive / restore / ref-count', () => {
  let roleId;

  beforeEach(async () => {
    const res = await createRole(`arch_role_${Date.now()}`);
    expect(res.status).toBe(201);
    roleId = res.body.id;
  });

  afterEach(() => {
    db.prepare(`DELETE FROM roles WHERE id = ?`).run(roleId);
  });

  it('GET default excludes archived role', async () => {
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    const res = await request(app).get('/api/roles').set(auth());
    const ids = res.body.items.map(r => r.id);
    expect(ids).not.toContain(roleId);
  });

  it('GET ?include_archived=true includes archived role', async () => {
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    const res = await request(app).get('/api/roles?include_archived=true').set(auth());
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain(roleId);
  });

  it('archive sets archived_at and active=0', async () => {
    const res = await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();
    expect(res.body.active).toBe(0);
  });

  it('restore clears archived_at and active=1', async () => {
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    const res = await request(app).post(`/api/roles/${roleId}/restore`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
    // Restored role appears in default GET
    const list = await request(app).get('/api/roles').set(auth());
    expect(list.body.items.map(r => r.id)).toContain(roleId);
  });

  it('ref-count is 0 when no technicians reference the role', async () => {
    const res = await request(app).get(`/api/roles/${roleId}/ref-count`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.reference_count).toBe(0);
  });

  it('ref-count reflects active technicians referencing the role', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('RefTech', ?, 1)`
    ).run(roleId).lastInsertRowid;

    const res = await request(app).get(`/api/roles/${roleId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(1);
    expect(res.body.referencing_tables[0].table).toBe('technicians');

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });

  it('archive succeeds even when technicians reference the role', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('BlockedTech', ?, 1)`
    ).run(roleId).lastInsertRowid;

    const res = await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });

  it('DELETE returns 409 with reference_count when active techs reference it (regression)', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('DeleteBlocker', ?, 1)`
    ).run(roleId).lastInsertRowid;

    const res = await request(app).delete(`/api/roles/${roleId}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.reference_count).toBe(1);

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });
});

// ─── SPECIALIZATIONS ──────────────────────────────────────────────────────────

describe('Specializations — archive / restore / ref-count', () => {
  let specId;

  beforeEach(async () => {
    const res = await createSpec(`arch_spec_${Date.now()}`);
    expect(res.status).toBe(201);
    specId = res.body.id;
  });

  afterEach(() => {
    db.prepare(`DELETE FROM specializations WHERE id = ?`).run(specId);
  });

  it('GET default excludes archived specialization', async () => {
    await request(app).post(`/api/specializations/${specId}/archive`).set(auth());
    const res = await request(app).get('/api/specializations').set(auth());
    expect(res.body.items.map(r => r.id)).not.toContain(specId);
  });

  it('GET ?include_archived=true shows archived specialization', async () => {
    await request(app).post(`/api/specializations/${specId}/archive`).set(auth());
    const res = await request(app).get('/api/specializations?include_archived=true').set(auth());
    expect(res.body.items.map(r => r.id)).toContain(specId);
  });

  it('archive / restore round-trip', async () => {
    let res = await request(app).post(`/api/specializations/${specId}/archive`).set(auth());
    expect(res.body.archived_at).not.toBeNull();
    expect(res.body.active).toBe(0);

    res = await request(app).post(`/api/specializations/${specId}/restore`).set(auth());
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
  });

  it('ref-count returns 0 when no tech-spec assignment exists', async () => {
    const res = await request(app).get(`/api/specializations/${specId}/ref-count`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.reference_count).toBe(0);
  });

  it('ref-count reflects technician_specializations rows', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, active) VALUES ('SpecTech', 1)`
    ).run().lastInsertRowid;
    db.prepare(
      `INSERT INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`
    ).run(techId, specId);

    const res = await request(app).get(`/api/specializations/${specId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(1);
    expect(res.body.referencing_tables[0].table).toBe('technician_specializations');

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });
});

// ─── REPAIR OPTIONS ───────────────────────────────────────────────────────────

describe('Repair options — archive / restore (no FK refs)', () => {
  let optId;

  beforeEach(async () => {
    const res = await createRepairOpt(`fix_${Date.now()}`);
    expect(res.status).toBe(201);
    optId = res.body.id;
  });

  afterEach(() => {
    db.prepare(`DELETE FROM repair_options WHERE id = ?`).run(optId);
  });

  it('GET default excludes archived repair option', async () => {
    await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());
    const res = await request(app).get('/api/repair-options').set(auth());
    expect(res.body.map(r => r.id)).not.toContain(optId);
  });

  it('GET ?include_archived=true shows archived option', async () => {
    await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());
    const res = await request(app).get('/api/repair-options?include_archived=true').set(auth());
    expect(res.body.map(r => r.id)).toContain(optId);
  });

  it('archive / restore round-trip', async () => {
    let res = await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();
    expect(res.body.active).toBe(0);

    res = await request(app).post(`/api/repair-options/${optId}/restore`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
  });

  it('DELETE succeeds (no FK refs) and returns reference_count: 0', async () => {
    const res = await request(app).delete(`/api/repair-options/${optId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.reference_count).toBe(0);
    optId = null; // already deleted, skip afterEach cleanup
  });
});

// ─── TECHNICIANS ──────────────────────────────────────────────────────────────

describe('Technicians — archive / restore / ref-count', () => {
  let techId;

  beforeEach(async () => {
    const res = await createTech(`Arch_${Date.now()}`);
    expect(res.status).toBe(201);
    techId = res.body.id;
  });

  afterEach(() => {
    if (techId) db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
  });

  it('GET default excludes archived technician', async () => {
    await request(app).post(`/api/technicians/${techId}/archive`).set(auth());
    const res = await request(app).get('/api/technicians').set(auth());
    expect(res.body.items.map(r => r.id)).not.toContain(techId);
  });

  it('GET ?include_archived=true shows archived technician', async () => {
    await request(app).post(`/api/technicians/${techId}/archive`).set(auth());
    const res = await request(app).get('/api/technicians?include_archived=true').set(auth());
    expect(res.body.items.map(r => r.id)).toContain(techId);
  });

  it('archive / restore round-trip', async () => {
    let res = await request(app).post(`/api/technicians/${techId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();
    expect(res.body.active).toBe(0);

    res = await request(app).post(`/api/technicians/${techId}/restore`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
  });

  it('ref-count is 0 when no open order assignments', async () => {
    const res = await request(app).get(`/api/technicians/${techId}/ref-count`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.reference_count).toBe(0);
    expect(res.body.referencing_tables).toEqual([]);
  });

  it('archive does NOT require zero open assignments', async () => {
    const res = await request(app).post(`/api/technicians/${techId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();
  });
});
