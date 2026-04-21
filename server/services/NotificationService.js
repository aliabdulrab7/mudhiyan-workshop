/**
 * NotificationService
 *
 * Builds notification payloads (WhatsApp links + messages).
 * Does NOT send autonomously — returns URLs for the frontend to open.
 *
 * Called as a post-commit side effect inside OrderService.transition().
 * Failure to notify NEVER rolls back a transition.
 *
 * Phone format: stored as 966XXXXXXXXX (no +). wa.me uses this directly.
 */

// ── Message builders ──────────────────────────────────────────────────────────

const MESSAGE_BUILDERS = {
  waiting_approval: (order) =>
    `مرحباً ${order.customer_name}،\n` +
    `طلب الإصلاح رقم ${order.order_number} جاهز للمراجعة.\n` +
    `تكلفة الإصلاح المقدرة: ${order.cost} ريال.\n` +
    `يرجى الموافقة أو الرفض عبر الرابط التالي:\n` +
    `https://mudhiyan.app/track/${order.customer_token}`,
};

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Build a wa.me URL for the given phone number and message.
 * Phone must be in 966XXXXXXXXX format (no +).
 */
function buildWhatsAppLink(phone, message) {
  // Strip leading + if present (defensive — should not be stored with +)
  const cleaned = String(phone).replace(/^\+/, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a notification payload for the given status event and order.
 *
 * @param {string} event  - Status value that triggered the notification
 *                          (e.g. 'waiting_approval')
 * @param {object} order  - Order row including customer_name, phone, order_number, cost
 * @returns {{ event, message, whatsapp_url } | null}
 */
function notify(event, order) {
  const builder = MESSAGE_BUILDERS[event];
  if (!builder) return null;

  // Phone is required for WhatsApp — skip gracefully if missing
  if (!order.phone) return null;

  const message = builder(order);
  return {
    event,
    message,
    whatsapp_url: buildWhatsAppLink(order.phone, message),
  };
}

module.exports = { notify, buildWhatsAppLink };
