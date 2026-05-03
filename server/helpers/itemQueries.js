/**
 * Shared SQL for reading order_items with their currently-assigned technician.
 *
 * The schema is M:M (order_item_technicians) but the product treats each item
 * as having at-most-one technician (POST .../technicians is replace-style).
 * Existing rows from before that change may have multiple assignments per
 * item; the subquery picks the most recent (MAX(id)) so this query always
 * returns exactly one row per item.
 *
 * Adds four nullable columns:
 *   technician_id       — id from technicians table, or NULL
 *   technician_name     — technicians.name (display name), or NULL
 *   technician_status   — technicians.status ('available'|'busy'|'off_shift'|'on_leave'), or NULL
 *   technician_username — joined via users, or NULL
 */
const ITEMS_WITH_TECH_SQL = `
  SELECT
    oi.*,
    oit.technician_id  AS technician_id,
    t.name             AS technician_name,
    t.status           AS technician_status,
    u.username         AS technician_username
  FROM order_items oi
  LEFT JOIN (
    SELECT order_item_id, MAX(id) AS oit_id
    FROM order_item_technicians
    GROUP BY order_item_id
  ) latest ON latest.order_item_id = oi.id
  LEFT JOIN order_item_technicians oit ON oit.id = latest.oit_id
  LEFT JOIN technicians t ON t.id = oit.technician_id
  LEFT JOIN users u ON u.id = t.user_id
  WHERE oi.order_id = ?
  ORDER BY oi.sort_order
`;

module.exports = { ITEMS_WITH_TECH_SQL };
