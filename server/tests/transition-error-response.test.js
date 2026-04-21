const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const { db }  = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

let workshopToken;

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Shop A')`).run();
  workshopToken = jwt.sign({ id: 10, role: 'workshop', shop_id: null, username: 'workshop' }, JWT_SECRET);
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }

describe('InvalidTransitionError response body', () => {
  it('returns current_status in details when the transition is rejected', async () => {
    db.prepare(`DELETE FROM orders WHERE order_number = 'ERR-TRANS-001'`).run();
    const info = db.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
       VALUES ('ERR-TRANS-001','Err','966500000001','خاتم',1,'tk-err','in_repair')`
    ).run();
    const orderId = info.lastInsertRowid;

    // Attempt an illegal transition (in_repair → received is not in TRANSITIONS registry)
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set(auth(workshopToken))
      .send({ status: 'received' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.details).toBeTruthy();
    expect(res.body.details.current_status).toBe('in_repair');
    expect(res.body.from).toBe('in_repair');
    expect(res.body.to).toBe('received');
  });

  it('by-barcode path also returns current_status for InvalidTransitionError', async () => {
    db.prepare(`DELETE FROM orders WHERE order_number = 'ERR-TRANS-002'`).run();
    db.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
       VALUES ('ERR-TRANS-002','Err','966500000002','خاتم',1,'tk-err-2','delivered')`
    ).run();

    const res = await request(app)
      .patch(`/api/orders/by-barcode/ERR-TRANS-002/status`)
      .set(auth(workshopToken))
      .send({
        status: 'received',
        source: 'bulk_scan',
        session_id: 'aaaa1111',
        session_type: 'intake_from_branches',
      });

    // delivered is locked → OrderLockedError (409) wins over InvalidTransition;
    // verify the order is correctly defended. Then use an unlocked-but-wrong-state order.
    expect([409, 423]).toContain(res.status); // OrderLockedError maps to 409 per errorToHttpStatus

    // Now a non-locked invalid-transition case via barcode
    db.prepare(`DELETE FROM orders WHERE order_number = 'ERR-TRANS-003'`).run();
    db.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status)
       VALUES ('ERR-TRANS-003','Err','966500000003','خاتم',1,'tk-err-3','inspection')`
    ).run();

    const res2 = await request(app)
      .patch(`/api/orders/by-barcode/ERR-TRANS-003/status`)
      .set(auth(workshopToken))
      .send({
        status: 'received',
        source: 'bulk_scan',
        session_id: 'aaaa1111',
        session_type: 'intake_from_branches',
      });
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('INVALID_TRANSITION');
    expect(res2.body.details.current_status).toBe('inspection');
  });
});
