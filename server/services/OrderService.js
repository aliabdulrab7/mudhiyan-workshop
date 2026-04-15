/**
 * OrderService — State Machine Engine
 *
 * ALL order status transitions MUST go through OrderService.transition().
 * No exceptions: no repository updates, no direct SQL, no admin bypass.
 *
 * Architecture:
 *   transition(orderId, newStatus, user, metadata)
 *     ↓
 *   Guard 1: validateTransition()       — checks TRANSITIONS registry
 *     ↓
 *   Guard 2: validateBusinessRules()    — enforces domain rules
 *     ↓
 *   DB transaction (atomic):
 *     ↓ re-read order (race-condition safe)
 *     ↓ writeAuditLog()                 — audit BEFORE state change
 *     ↓ updateOrderStatus()             — single UPDATE
 *     ↓ lockIfDelivered()               — set locked_at
 */

const { db } = require('../db');
const {
  InvalidTransitionError,
  BusinessRuleViolationError,
  PaymentRequiredError,
  OrderLockedError,
  PermissionError,
  AuditWriteError,
  StateUpdateError,
} = require('../errors');

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS REGISTRY — single source of truth for allowed transitions.
// isValidTransition() reads ONLY from this object. No if/else chains elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITIONS = {
  received:         ['diagnosing'],
  diagnosing:       ['waiting_approval', 'in_repair'],
  waiting_approval: ['approved', 'rejected'],
  approved:         ['in_repair'],
  rejected:         ['ready_for_pickup'],
  in_repair:        ['quality_check'],
  quality_check:    ['ready_for_pickup', 'in_repair'],
  ready_for_pickup: ['delivered'],
  delivered:        ['closed'],
};

// CANCELLED is a global exit from any pre-delivered, pre-closed state.
// Handled as a special case inside transition() — not in the registry map
// because it originates from every state.
const UNCANCELLABLE = new Set(['delivered', 'closed', 'cancelled']);

/**
 * Pure function. Returns true if the transition is in the registry.
 * CANCELLED logic is handled here as a special case.
 */
function isValidTransition(from, to) {
  if (to === 'cancelled') {
    return !UNCANCELLABLE.has(from);
  }
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 1 — Transition validity
// ─────────────────────────────────────────────────────────────────────────────

function validateTransition(currentStatus, newStatus) {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new InvalidTransitionError(currentStatus, newStatus);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 2 — Business rules
// Runs after transition validity is confirmed.
// Each rule is self-contained — throw explicitly, never return false silently.
// ─────────────────────────────────────────────────────────────────────────────

function validateBusinessRules(order, newStatus, user) {
  // Rule: DIAGNOSING → WAITING_APPROVAL requires cost > 0
  if (order.status === 'diagnosing' && newStatus === 'waiting_approval') {
    if (!(order.cost > 0)) {
      throw new BusinessRuleViolationError(
        'لا يمكن طلب موافقة العميل بدون تحديد تكلفة الإصلاح'
      );
    }
  }

  // Rule: DIAGNOSING → IN_REPAIR requires cost == 0
  if (order.status === 'diagnosing' && newStatus === 'in_repair') {
    if (order.cost > 0) {
      throw new BusinessRuleViolationError(
        'التكلفة محددة — يجب الحصول على موافقة العميل أولاً'
      );
    }
  }

  // Rule: REJECTED must never reach IN_REPAIR
  // (Already blocked by registry, but explicit guard prevents future registry bugs)
  if (order.status === 'rejected' && newStatus === 'in_repair') {
    throw new BusinessRuleViolationError(
      'الطلبات المرفوضة لا يمكن إرسالها للإصلاح'
    );
  }

  // Rule: DELIVERED → CLOSED requires workshop role only
  if (order.status === 'delivered' && newStatus === 'closed') {
    if (user?.role !== 'workshop') {
      throw new PermissionError('إغلاق الطلب متاح للورشة فقط');
    }
  }

  // Rule: CANCELLED requires workshop or branch staff (not technician)
  if (newStatus === 'cancelled') {
    const allowed = ['workshop', 'shop_employee'];
    if (!allowed.includes(user?.role)) {
      throw new PermissionError('إلغاء الطلب غير مصرح لهذا الدور');
    }
  }

  // Rule: READY_FOR_PICKUP → DELIVERED requires payment confirmation
  // Phase 1: payment system not yet built — runs registered validator if present.
  // Phase 2 calls registerPaymentValidator() to inject the real check.
  if (order.status === 'ready_for_pickup' && newStatus === 'delivered') {
    runPaymentValidator(order);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT VALIDATOR — injectable hook (wired by Phase 2)
// Phase 1: no-op. Phase 2 registers the real check via registerPaymentValidator().
// ─────────────────────────────────────────────────────────────────────────────

let _paymentValidator = null;

function runPaymentValidator(order) {
  if (_paymentValidator) {
    _paymentValidator(order); // must throw PaymentRequiredError if not confirmed
  }
  // Phase 1 only: no payment check — Phase 2 registers the real validator
}

/**
 * Called at app startup (Phase 2) to register the payment confirmation check.
 * fn(order) must throw PaymentRequiredError if order.payment_confirmed != 1.
 */
function registerPaymentValidator(fn) {
  _paymentValidator = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HOOK — injectable side effect (wired by Phase 2)
// Fires AFTER the DB transaction commits. Failure never rolls back the transition.
// ─────────────────────────────────────────────────────────────────────────────

let _notificationHook = null;

function runNotificationHook(newStatus, order) {
  if (!_notificationHook) return null;
  try {
    return _notificationHook(newStatus, order);
  } catch (_) {
    // Notification failure is non-fatal — transition already committed
    return null;
  }
}

/**
 * Called at app startup (Phase 2) to register the notification handler.
 * fn(status, order) should return a notification payload or null.
 */
function registerNotificationHook(fn) {
  _notificationHook = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE TRANSACTION — atomic execution of audit + state update
// better-sqlite3 transactions auto-rollback on exception.
// Audit log is written BEFORE status update — both or neither.
// ─────────────────────────────────────────────────────────────────────────────

const _executeTransition = db.transaction((orderId, expectedStatus, newStatus, userId, notes) => {
  // Re-read inside transaction to guard against concurrent updates
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.name = 'NotFoundError';
    throw err;
  }

  // Re-check lock (could have changed between guard phase and transaction start)
  if (order.locked_at) {
    throw new OrderLockedError();
  }

  // Re-check status has not been changed by a concurrent request
  if (order.status !== expectedStatus) {
    throw new InvalidTransitionError(order.status, newStatus);
  }

  // Step: write audit log BEFORE updating status
  // If this INSERT fails, the whole transaction rolls back — no partial state.
  try {
    db.prepare(`
      INSERT INTO order_status_history
        (order_id, from_status, to_status, changed_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, order.status, newStatus, userId, notes ?? null);
  } catch (e) {
    throw new AuditWriteError(e.message);
  }

  // Step: update order status
  let result;
  try {
    result = db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newStatus, orderId);
  } catch (e) {
    throw new StateUpdateError(e.message);
  }

  if (result.changes === 0) {
    throw new StateUpdateError('No rows updated — order may have been deleted');
  }

  // Step: lock order if transitioning to DELIVERED
  if (newStatus === 'delivered') {
    db.prepare(`
      UPDATE orders SET locked_at = datetime('now','localtime') WHERE id = ?
    `).run(orderId);
  }

  // Return fresh order state
  return db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o
    LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(orderId);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transition an order to a new status.
 *
 * @param {number}        orderId   - The order's database ID
 * @param {string}        newStatus - Target status (lowercase)
 * @param {object|string} user      - Caller: { role, username } or username string
 * @param {object}        metadata  - Optional: { notes }
 * @returns {object} Updated order row with shop_name
 *
 * Throws:
 *   InvalidTransitionError       — transition not in registry
 *   BusinessRuleViolationError   — domain rule violated
 *   PaymentRequiredError         — payment not confirmed (Phase 2+)
 *   OrderLockedError             — order is locked after delivery
 *   PermissionError              — caller lacks required role
 *   AuditWriteError              — audit log insert failed (500)
 *   StateUpdateError             — status UPDATE failed (500)
 *   NotFoundError                — order does not exist
 */
function transition(orderId, newStatus, user, metadata = {}) {
  const notes  = metadata.notes ?? null;
  const userId = typeof user === 'string'
    ? user
    : (user?.username ?? user?.id ?? 'system');
  const userObj = typeof user === 'object' && user !== null
    ? user
    : { username: userId, role: null };

  // ── Pre-transaction guards (cheap — no DB write yet) ──────────────────────

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.name = 'NotFoundError';
    throw err;
  }

  if (order.locked_at) {
    throw new OrderLockedError();
  }

  validateTransition(order.status, newStatus);
  validateBusinessRules(order, newStatus, userObj);

  // ── Atomic execution ──────────────────────────────────────────────────────
  // Guards passed. Execute audit + status update in a single transaction.
  // If anything fails, better-sqlite3 auto-rolls back the entire transaction.

  const updatedOrder = _executeTransition(orderId, order.status, newStatus, userId, notes);

  // ── Post-commit side effects ───────────────────────────────────────────────
  // Transaction has committed. Fire notification hook — failure is non-fatal.
  const notification = runNotificationHook(newStatus, updatedOrder);
  if (notification) {
    updatedOrder._notification = notification;
  }

  return updatedOrder;
}

module.exports = {
  transition,
  isValidTransition,
  registerPaymentValidator,
  registerNotificationHook,
  TRANSITIONS,
};
