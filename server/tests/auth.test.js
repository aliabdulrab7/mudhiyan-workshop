// server/tests/auth.test.js
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { JWT_SECRET } = require('../middleware/auth');

describe('requireAuth middleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });

  it('allows request with valid workshop token', async () => {
    const token = jwt.sign({ id: 1, role: 'workshop', shop_id: null }, JWT_SECRET);
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
