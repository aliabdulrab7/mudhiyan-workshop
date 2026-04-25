// server/tests/settings.test.js
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const app     = require('../app');
const { JWT_SECRET } = require('../middleware/auth');
const { db } = require('../db');

let userId;
let token;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Test Shop')`).run();
  const hash = bcrypt.hashSync('current-pass', 1);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, shop_id)
    VALUES ('settings-user', ?, 'shop_employee', 1)
  `).run(hash);
  userId = result.lastInsertRowid;
  token = jwt.sign({ id: userId, role: 'shop_employee', shop_id: 1 }, JWT_SECRET);
});

afterAll(() => {
  db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

describe('GET /api/auth/me/settings', () => {
  it('creates default row when none exists and returns NULL fields', async () => {
    db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);

    const res = await request(app)
      .get('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      default_label_preset: null,
      default_printer_mode: null,
    });
    const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    expect(row).toBeTruthy();
  });

  it('returns existing row without creating a duplicate', async () => {
    db.prepare(
      `UPDATE user_settings SET default_label_preset = '80x50', default_printer_mode = 'universal' WHERE user_id = ?`
    ).run(userId);

    const res = await request(app)
      .get('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      default_label_preset: '80x50',
      default_printer_mode: 'universal',
    });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/auth/me/settings');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me/settings', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
  });

  it('updates valid fields', async () => {
    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_label_preset: 'a4', default_printer_mode: 'niimbot' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      default_label_preset: 'a4',
      default_printer_mode: 'niimbot',
    });
  });

  it('accepts a partial update without touching other fields', async () => {
    await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_label_preset: '50x30', default_printer_mode: 'universal' });

    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_printer_mode: 'niimbot' });

    expect(res.status).toBe(200);
    expect(res.body.default_label_preset).toBe('50x30');
    expect(res.body.default_printer_mode).toBe('niimbot');
  });

  it('accepts null to clear a preference', async () => {
    await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_label_preset: 'a4' });

    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_label_preset: null });

    expect(res.status).toBe(200);
    expect(res.body.default_label_preset).toBeNull();
  });

  it('rejects unknown fields with 400', async () => {
    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ favourite_color: 'gold' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/favourite_color/);
  });

  it('validates printer_mode enum', async () => {
    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_printer_mode: 'thermal' });

    expect(res.status).toBe(400);
  });

  it('validates label_preset enum', async () => {
    const res = await request(app)
      .patch('/api/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ default_label_preset: '999x999' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/auth/me/settings')
      .send({ default_label_preset: 'a4' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    const hash = bcrypt.hashSync('current-pass', 1);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  });

  it('rejects with 401 when current password is wrong', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'wrong-pass', new_password: 'newpassword123' });

    expect(res.status).toBe(401);
  });

  it('updates hash when current password is correct', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'current-pass', new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, must_relogin: true });

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    expect(bcrypt.compareSync('newpassword123', row.password_hash)).toBe(true);
    expect(bcrypt.compareSync('current-pass', row.password_hash)).toBe(false);
  });

  it('rejects new password shorter than 8 chars with 400', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'current-pass', new_password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'current-pass' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ current_password: 'current-pass', new_password: 'newpassword123' });

    expect(res.status).toBe(401);
  });
});
