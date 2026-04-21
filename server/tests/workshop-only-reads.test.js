/**
 * Workshop-only GET gates (Item 1b)
 *
 * The three admin-surface read endpoints below are gated to role=workshop.
 * They're only consumed by workshop-only pages in the client
 * (TechniciansPage / ServicesPage / InventoryPage, all under RoleRoute).
 *
 * /api/repair-options GET is intentionally NOT gated: shop_employee needs
 * it at /new intake to populate the repair-type dropdown. That's the
 * regression guard at the bottom of this file — exactly the case that
 * almost shipped incorrectly.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { JWT_SECRET } = require('../middleware/auth');

let wsToken, shopToken;

beforeAll(() => {
  wsToken   = jwt.sign({ id: 1, role: 'workshop',      username: 'ws',   shop_id: null }, JWT_SECRET);
  shopToken = jwt.sign({ id: 2, role: 'shop_employee', username: 'shop', shop_id: 1    }, JWT_SECRET);
});

function auth(tok) { return { Authorization: `Bearer ${tok}` }; }

describe('Workshop-only GET endpoints — shop_employee gets 403', () => {
  it.each([
    ['/api/technicians'],
    ['/api/services'],
    ['/api/inventory'],
  ])('GET %s — shop_employee → 403', async (path) => {
    const res = await request(app).get(path).set(auth(shopToken));
    expect(res.status).toBe(403);
  });

  it.each([
    ['/api/technicians'],
    ['/api/services'],
    ['/api/inventory'],
  ])('GET %s — workshop → 200', async (path) => {
    const res = await request(app).get(path).set(auth(wsToken));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/repair-options — stays open to both roles', () => {
  // Regression guard: if someone gates this to workshop-only, /new intake
  // silently breaks for shop_employee — their repair-type dropdown goes
  // empty and they can't submit an order.
  it('shop_employee → 200 (needed by /new intake)', async () => {
    const res = await request(app).get('/api/repair-options').set(auth(shopToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('workshop → 200', async () => {
    const res = await request(app).get('/api/repair-options').set(auth(wsToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
