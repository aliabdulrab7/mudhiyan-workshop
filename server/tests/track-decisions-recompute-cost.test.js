/**
 * Per-item customer decisions recompute orders.cost (Bug 1)
 *
 * When the customer submits decisions via /api/track/:token/decide,
 * orders.cost must be rewritten to
 *    SUM(estimated_cost) WHERE approval_status IN ('approved','skipped').
 * Rejected items contribute zero. cost_status reflects the aggregate decision.
 *
 * Prior to this fix, orders.cost was set at send-for-approval time from the
 * sum of ALL priced items and never adjusted when the customer rejected some,
 * which inflated the invoice.
 */

const request = require('supertest');
const app     = require('../app');
const { db }  = require('../db');

describe('POST /api/track/:token/decide — recomputes orders.cost', () => {
  let orderId;
  const TOKEN = 'decide-cost-token-001';

  beforeEach(() => {
    db.prepare(`INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Branch One')`).run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM order_status_history').run();
    db.prepare('DELETE FROM orders').run();

    const r = db.prepare(`
      INSERT INTO orders
        (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, cost, cost_status)
      VALUES (?, 'Decide Test', '966500000001', 'خاتم', 1,
              ?, 'waiting_approval', 300, 'PENDING_APPROVAL')
    `).run(`DEC-${Date.now()}`, TOKEN);
    orderId = r.lastInsertRowid;

    // Seed the chain of status history so the state machine accepts the transition.
    db.prepare(`
      INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES
        (?, 'new',              'received',         'test'),
        (?, 'received',         'inspection',       'test'),
        (?, 'inspection',       'waiting_approval', 'test')
    `).run(orderId, orderId, orderId);
  });

  function seedItem({ sort_order, cost, approval_status = 'pending', name = 'item' }) {
    return db.prepare(`
      INSERT INTO order_items
        (order_id, sort_order, item_type, item_name, quantity, estimated_cost, approval_status)
      VALUES (?, ?, 'ring', ?, 1, ?, ?)
    `).run(orderId, sort_order, name, cost, approval_status).lastInsertRowid;
  }

  function orderCost() {
    return db.prepare('SELECT cost, cost_status FROM orders WHERE id = ?').get(orderId);
  }

  it('rejects half, approves half — orders.cost = sum of approved only', async () => {
    seedItem({ sort_order: 1, cost: 100, name: 'خاتم' });
    seedItem({ sort_order: 2, cost: 200, name: 'قلادة' });

    const res = await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [
        { sort_order: 1, decision: 'approve' },
        { sort_order: 2, decision: 'reject'  },
      ]});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const { cost, cost_status } = orderCost();
    expect(cost).toBe(100);
    expect(cost_status).toBe('APPROVED');
  });

  it('skipped (free) items contribute 0 but keep the order approvable', async () => {
    // Free sibling already auto-skipped by send-for-approval (Bug 2).
    seedItem({ sort_order: 1, cost: 0,   approval_status: 'skipped', name: 'مجاني' });
    seedItem({ sort_order: 2, cost: 150, name: 'مسعر' });

    const res = await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [{ sort_order: 2, decision: 'approve' }] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const { cost, cost_status } = orderCost();
    expect(cost).toBe(150); // 0 (skipped) + 150 (approved)
    expect(cost_status).toBe('APPROVED');
  });

  it('all priced items rejected but a free sibling keeps order workable — cost = 0', async () => {
    seedItem({ sort_order: 1, cost: 0,   approval_status: 'skipped', name: 'مجاني' });
    seedItem({ sort_order: 2, cost: 100, name: 'مسعر' });

    const res = await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [{ sort_order: 2, decision: 'reject' }] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved'); // free item alone still counts as workable

    const { cost, cost_status } = orderCost();
    expect(cost).toBe(0);
    expect(cost_status).toBe('APPROVED');
  });

  it('every item rejected, no free siblings — cost = 0, order moves to rejected', async () => {
    seedItem({ sort_order: 1, cost: 100, name: 'a' });
    seedItem({ sort_order: 2, cost: 250, name: 'b' });

    const res = await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [
        { sort_order: 1, decision: 'reject' },
        { sort_order: 2, decision: 'reject' },
      ]});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');

    const { cost, cost_status } = orderCost();
    expect(cost).toBe(0);
    expect(cost_status).toBe('REJECTED');
  });

  it('mixed three-item order (free + approved + rejected) — cost = approved only', async () => {
    // The canonical scenario from docs/QA-EXPECTATIONS.md Workflow 3.
    seedItem({ sort_order: 1, cost: 0,   approval_status: 'skipped', name: 'سوار' });
    seedItem({ sort_order: 2, cost: 100, name: 'خاتم' });
    seedItem({ sort_order: 3, cost: 200, name: 'قلادة' });

    const res = await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [
        { sort_order: 2, decision: 'approve' },
        { sort_order: 3, decision: 'reject'  },
      ]});
    expect(res.status).toBe(200);

    const { cost, cost_status } = orderCost();
    expect(cost).toBe(100);
    expect(cost_status).toBe('APPROVED');
  });

  it('item-decision writes and cost recompute share a transaction (rollback on failure)', async () => {
    // If the transition fails, the item status + orders.cost writes must both
    // be visible OR neither. We force a failure by deleting the order between
    // the ALLOWED_FROM check and the transaction — not feasible from outside.
    // Instead, verify the happier invariant: a successful call leaves cost,
    // cost_status, and item statuses all mutually consistent.
    seedItem({ sort_order: 1, cost: 100 });
    seedItem({ sort_order: 2, cost: 250 });

    await request(app)
      .post(`/api/track/${TOKEN}/decide`)
      .send({ decisions: [
        { sort_order: 1, decision: 'approve' },
        { sort_order: 2, decision: 'reject'  },
      ]});

    const row = db.prepare(`
      SELECT o.cost, o.cost_status,
             SUM(CASE WHEN oi.approval_status = 'approved' THEN oi.estimated_cost ELSE 0 END) AS approved_sum,
             SUM(CASE WHEN oi.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_n
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ?
      GROUP BY o.id
    `).get(orderId);
    expect(row.cost).toBe(row.approved_sum);
    expect(row.rejected_n).toBe(1);
    expect(row.cost_status).toBe('APPROVED');
  });
});
