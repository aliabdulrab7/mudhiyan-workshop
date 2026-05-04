/**
 * Phase 5 — Regression & lifecycle tests for the nav/CRUD refactor.
 *
 * Covers gaps not addressed by crud-archive.test.js or the WF-1 suites:
 *  1. Full create → archive → hard-delete lifecycle (roles, specializations)
 *  2. Ref-count drops to 0 when the referencing technician is archived
 *     (verifies the archived_at IS NULL filter in roleRefCount / specRefCount)
 *  3. Idempotent archive (archive twice → 200 both times)
 *  4. Idempotent restore (restore a never-archived entity → 200, no-op)
 *  5. Hard-delete of an archived entity with no active-tech refs → 200
 *  6. Hard-delete of an archived entity still blocked when active-tech refs exist
 *  7. Repair-options GET with item_type + include_archived combined query
 *  8. GET /api/technicians?include_archived=true includes archived page pagination
 *     (service-level list() path, not just the raw count)
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let ws;
beforeAll(() => {
  ws = jwt.sign({ id: 300, role: 'workshop', username: 'p5tester', shop_id: null }, JWT_SECRET);
});
function auth() { return { Authorization: `Bearer ${ws}` }; }

// ─── helpers ──────────────────────────────────────────────────────────────────

async function createRole(suffix = Date.now()) {
  const res = await request(app).post('/api/roles').set(auth())
    .send({ value: `p5_role_${suffix}`, display_label_ar: `دور اختبار ${suffix}` });
  expect(res.status).toBe(201);
  return res.body;
}

async function createSpec(suffix = Date.now()) {
  const res = await request(app).post('/api/specializations').set(auth())
    .send({ value: `p5_spec_${suffix}`, display_label_ar: `تخصص اختبار ${suffix}` });
  expect(res.status).toBe(201);
  return res.body;
}

async function createRepairOpt(suffix = Date.now()) {
  const res = await request(app).post('/api/repair-options').set(auth())
    .send({ item_type: 'ring', value: `p5_fix_${suffix}`, needs: null });
  expect(res.status).toBe(201);
  return res.body;
}

// ─── 1. Full lifecycle: create → archive → hard-delete ────────────────────────

describe('Full lifecycle — Roles', () => {
  it('create → visible in default GET → archive → excluded → hard-delete → gone', async () => {
    const role = await createRole();

    // 1a. Appears in default list
    let list = await request(app).get('/api/roles').set(auth());
    expect(list.body.items.map((r) => r.id)).toContain(role.id);

    // 1b. Archive it
    const archived = await request(app).post(`/api/roles/${role.id}/archive`).set(auth());
    expect(archived.status).toBe(200);
    expect(archived.body.archived_at).not.toBeNull();

    // 1c. Excluded from default, present in include_archived
    list = await request(app).get('/api/roles').set(auth());
    expect(list.body.items.map((r) => r.id)).not.toContain(role.id);

    list = await request(app).get('/api/roles?include_archived=true').set(auth());
    expect(list.body.items.map((r) => r.id)).toContain(role.id);

    // 1d. Hard-delete succeeds (no active refs)
    const del = await request(app).delete(`/api/roles/${role.id}`).set(auth());
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // 1e. Gone from include_archived too
    list = await request(app).get('/api/roles?include_archived=true').set(auth());
    expect(list.body.items.map((r) => r.id)).not.toContain(role.id);
  });
});

describe('Full lifecycle — Specializations', () => {
  it('create → archive → hard-delete → gone', async () => {
    const spec = await createSpec();

    const archived = await request(app).post(`/api/specializations/${spec.id}/archive`).set(auth());
    expect(archived.status).toBe(200);

    const del = await request(app).delete(`/api/specializations/${spec.id}`).set(auth());
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const gone = db.prepare(`SELECT id FROM specializations WHERE id = ?`).get(spec.id);
    expect(gone).toBeUndefined();
  });
});

// ─── 2. Ref-count drops when referencing tech is archived ─────────────────────

describe('Ref-count excludes archived technicians', () => {
  let roleId, techId;

  beforeEach(async () => {
    const r = await createRole();
    roleId = r.id;
    techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('P5RefTech', ?, 1)`
    ).run(roleId).lastInsertRowid;
  });

  afterEach(() => {
    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
    db.prepare(`DELETE FROM roles WHERE id = ?`).run(roleId);
  });

  it('ref-count is 1 when tech is active', async () => {
    const res = await request(app).get(`/api/roles/${roleId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(1);
  });

  it('ref-count drops to 0 after the referencing tech is archived', async () => {
    // Archive the technician
    await request(app).post(`/api/technicians/${techId}/archive`).set(auth());

    const res = await request(app).get(`/api/roles/${roleId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(0);
    expect(res.body.referencing_tables).toEqual([]);
  });

  it('role can be hard-deleted once the only referencing tech is archived', async () => {
    // Before archiving tech: delete is blocked
    let del = await request(app).delete(`/api/roles/${roleId}`).set(auth());
    expect(del.status).toBe(409);

    // Archive the tech → ref-count drops to 0
    await request(app).post(`/api/technicians/${techId}/archive`).set(auth());

    // Now delete succeeds
    del = await request(app).delete(`/api/roles/${roleId}`).set(auth());
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    roleId = null; // skip afterEach cleanup — already deleted
  });
});

describe('Ref-count excludes archived technicians — Specializations', () => {
  let specId, techId;

  beforeEach(async () => {
    const s = await createSpec();
    specId = s.id;
    techId = db.prepare(`INSERT INTO technicians (name, active) VALUES ('P5SpecRef', 1)`).run().lastInsertRowid;
    db.prepare(`INSERT INTO technician_specializations (technician_id, specialization_id) VALUES (?, ?)`)
      .run(techId, specId);
  });

  afterEach(() => {
    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
    if (specId) db.prepare(`DELETE FROM specializations WHERE id = ?`).run(specId);
  });

  it('ref-count drops to 0 after the referencing tech is archived', async () => {
    let res = await request(app).get(`/api/specializations/${specId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(1);

    await request(app).post(`/api/technicians/${techId}/archive`).set(auth());

    res = await request(app).get(`/api/specializations/${specId}/ref-count`).set(auth());
    expect(res.body.reference_count).toBe(0);
  });
});

// ─── 3. Idempotent archive (archive twice) ────────────────────────────────────

describe('Idempotent archive', () => {
  let roleId;

  beforeEach(async () => { roleId = (await createRole()).id; });
  afterEach(() => { db.prepare(`DELETE FROM roles WHERE id = ?`).run(roleId); });

  it('archiving an already-archived role returns 200', async () => {
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    const res = await request(app).post(`/api/roles/${roleId}/archive`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).not.toBeNull();
    expect(res.body.active).toBe(0);
  });
});

// ─── 4. Idempotent restore (restore a never-archived entity) ─────────────────

describe('Idempotent restore', () => {
  let specId;

  beforeEach(async () => { specId = (await createSpec()).id; });
  afterEach(() => { db.prepare(`DELETE FROM specializations WHERE id = ?`).run(specId); });

  it('restoring a fresh (never-archived) specialization returns 200', async () => {
    const res = await request(app).post(`/api/specializations/${specId}/restore`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
  });

  it('archive → restore → restore again is idempotent', async () => {
    await request(app).post(`/api/specializations/${specId}/archive`).set(auth());
    await request(app).post(`/api/specializations/${specId}/restore`).set(auth());
    const res = await request(app).post(`/api/specializations/${specId}/restore`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeNull();
    expect(res.body.active).toBe(1);
  });
});

// ─── 5 & 6. Hard-delete of archived entity ───────────────────────────────────

describe('Hard-delete of archived role', () => {
  let roleId;

  beforeEach(async () => { roleId = (await createRole()).id; });

  it('archived role with no refs can be hard-deleted → 200 + ok:true', async () => {
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());

    const del = await request(app).delete(`/api/roles/${roleId}`).set(auth());
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const gone = db.prepare(`SELECT id FROM roles WHERE id = ?`).get(roleId);
    expect(gone).toBeUndefined();
    roleId = null;
  });

  it('archived role still blocked (409) when active techs still reference it', async () => {
    const techId = db.prepare(
      `INSERT INTO technicians (name, role_id, active) VALUES ('ActiveRef', ?, 1)`
    ).run(roleId).lastInsertRowid;

    // Archive the role (allowed even with active refs)
    await request(app).post(`/api/roles/${roleId}/archive`).set(auth());

    // Hard-delete still blocked because tech is active
    const del = await request(app).delete(`/api/roles/${roleId}`).set(auth());
    expect(del.status).toBe(409);
    expect(del.body.reference_count).toBe(1);

    db.prepare(`DELETE FROM technicians WHERE id = ?`).run(techId);
    db.prepare(`DELETE FROM roles WHERE id = ?`).run(roleId);
    roleId = null;
  });
});

// ─── 7. Repair-options combined item_type + include_archived ─────────────────

describe('Repair-options — item_type + include_archived combined', () => {
  let optId;

  beforeEach(async () => {
    optId = (await createRepairOpt()).id;
  });

  afterEach(() => {
    if (optId) db.prepare(`DELETE FROM repair_options WHERE id = ?`).run(optId);
  });

  it('default GET with item_type excludes archived option', async () => {
    await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());

    const res = await request(app).get('/api/repair-options?item_type=ring').set(auth());
    expect(res.body.map((r) => r.id)).not.toContain(optId);
  });

  it('GET with item_type + include_archived=true shows archived option', async () => {
    await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());

    const res = await request(app).get('/api/repair-options?item_type=ring&include_archived=true').set(auth());
    expect(res.body.map((r) => r.id)).toContain(optId);
  });

  it('GET active-only with item_type excludes inactive (active=0) rows', async () => {
    // Repair options GET active-only filters on `active = 1 AND archived_at IS NULL`.
    // An archived option has active=0, so it must be absent even for its own item_type.
    await request(app).post(`/api/repair-options/${optId}/archive`).set(auth());

    const res = await request(app).get('/api/repair-options?item_type=ring').set(auth());
    const found = res.body.find((r) => r.id === optId);
    expect(found).toBeUndefined();
  });
});

// ─── 8. Technicians GET include_archived — service-level pagination ───────────

describe('GET /api/technicians?include_archived — pagination path', () => {
  const techIds = [];

  beforeAll(async () => {
    // Create 3 archived technicians.
    for (let i = 0; i < 3; i++) {
      const id = db.prepare(
        `INSERT INTO technicians (name, active) VALUES ('P5ArchivedTech${i}', 1)`
      ).run().lastInsertRowid;
      await request(app).post(`/api/technicians/${id}/archive`).set(auth());
      techIds.push(id);
    }
  });

  afterAll(() => {
    techIds.forEach((id) => db.prepare(`DELETE FROM technicians WHERE id = ?`).run(id));
  });

  it('default list excludes all 3 archived techs', async () => {
    const res = await request(app).get('/api/technicians?limit=100').set(auth());
    const ids = res.body.items.map((t) => t.id);
    techIds.forEach((id) => expect(ids).not.toContain(id));
  });

  it('include_archived=true includes all 3 archived techs', async () => {
    const res = await request(app).get('/api/technicians?include_archived=true&limit=100').set(auth());
    const ids = res.body.items.map((t) => t.id);
    techIds.forEach((id) => expect(ids).toContain(id));
  });

  it('total count increases with include_archived=true', async () => {
    const base     = await request(app).get('/api/technicians?limit=1').set(auth());
    const withArch = await request(app).get('/api/technicians?include_archived=true&limit=1').set(auth());
    // With archived=true, total should be at least 3 more than default.
    expect(withArch.body.total).toBeGreaterThanOrEqual(base.body.total + 3);
  });
});
