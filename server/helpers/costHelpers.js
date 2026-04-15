/**
 * Cost helpers — shared between routes/orders.js and routes/orderItems.js.
 * All functions write directly to DB (no service layer — cost is data, not state).
 * Status transitions triggered by callers via OrderService.transition().
 */

const { db } = require('../db');

/**
 * Set cost fields on a single order_item row.
 */
function syncItemCost(itemId, cost) {
  db.prepare(`
    UPDATE order_items
    SET estimated_cost    = ?,
        approval_required = ?,
        approval_status   = ?,
        updated_at        = datetime('now','localtime')
    WHERE id = ?
  `).run(
    cost > 0 ? cost : null,
    cost > 0 ? 1 : 0,
    cost > 0 ? 'pending' : 'skipped',
    itemId
  );
}

/**
 * Set the same cost fields on ALL items for an order (order-level assignment).
 */
function syncAllItemCosts(orderId, cost) {
  db.prepare(`
    UPDATE order_items
    SET estimated_cost    = ?,
        approval_required = ?,
        approval_status   = ?,
        updated_at        = datetime('now','localtime')
    WHERE order_id = ?
  `).run(
    cost > 0 ? cost : null,
    cost > 0 ? 1 : 0,
    cost > 0 ? 'pending' : 'skipped',
    orderId
  );
}

/**
 * Recalculate orders.cost from sum of item estimated_costs, update cost_status.
 * Returns the new total.
 */
function refreshOrderCost(orderId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost), 0) AS total
    FROM order_items
    WHERE order_id = ? AND estimated_cost IS NOT NULL
  `).get(orderId);

  const total      = row.total || 0;
  const costStatus = total > 0 ? 'PENDING_APPROVAL' : 'NO_COST';

  db.prepare(`
    UPDATE orders
    SET cost = ?, cost_status = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(total, costStatus, orderId);

  return total;
}

module.exports = { syncItemCost, syncAllItemCosts, refreshOrderCost };
