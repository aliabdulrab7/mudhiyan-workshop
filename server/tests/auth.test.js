// server/tests/auth.test.js
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { JWT_SECRET } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

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

describe('POST /api/auth/login', () => {
  beforeAll(() => {
    // Seed a test user directly into the in-memory DB
    db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Test Shop')`).run();
    const hash = bcrypt.hashSync('pass123', 1); // rounds=1 for speed in tests
    db.prepare(`
      INSERT OR IGNORE INTO users (username, password_hash, role, shop_id)
      VALUES ('testuser', ?, 'shop_employee', 1)
    `).run(hash);
  });

  it('returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('shop_employee');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser' });
    expect(res.status).toBe(400);
  });
});
