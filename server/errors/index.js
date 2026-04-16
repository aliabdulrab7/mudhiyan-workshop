/**
 * Typed error classes for the OrderService state machine.
 *
 * Route handlers map these error names to HTTP status codes.
 * Never swallow these errors — always re-throw or respond explicitly.
 */

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

class BusinessRuleViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}

class PaymentRequiredError extends Error {
  constructor() {
    super('Payment is required before delivery can be confirmed');
    this.name = 'PaymentRequiredError';
  }
}

class OrderLockedError extends Error {
  constructor() {
    super('Order is locked after delivery — no further modifications allowed');
    this.name = 'OrderLockedError';
  }
}

class PermissionError extends Error {
  constructor(message) {
    super(message || 'Permission denied for this transition');
    this.name = 'PermissionError';
  }
}

class AuditWriteError extends Error {
  constructor(cause) {
    super(`Failed to write audit log: ${cause}`);
    this.name = 'AuditWriteError';
  }
}

class StateUpdateError extends Error {
  constructor(cause) {
    super(`Failed to update order status: ${cause}`);
    this.name = 'StateUpdateError';
  }
}

/**
 * Map a service error to an HTTP status code.
 * Used by route handlers — keeps HTTP logic out of the service.
 */
/**
 * Map a service error to an HTTP status code.
 * Used by route handlers — keeps HTTP logic out of the service.
 *
 * Status code rationale:
 *   409 Conflict       — state machine violations (wrong state, locked)
 *   422 Unprocessable  — business rule violations (payment required, rule breach)
 *   403 Forbidden      — permission denied
 *   404 Not Found      — resource does not exist
 *   500 Internal       — unexpected server errors
 */
function errorToHttpStatus(err) {
  switch (err.name) {
    case 'NotFoundError':              return 404;
    case 'InvalidTransitionError':     return 409; // 8.3: conflict state, not bad input
    case 'BusinessRuleViolationError': return 422; // 8.3: business rule violation
    case 'PaymentRequiredError':       return 422; // 8.3: business rule violation
    case 'OrderLockedError':           return 409; // conflict (locked)
    case 'PermissionError':            return 403;
    case 'AuditWriteError':            return 500;
    case 'StateUpdateError':           return 500;
    default:                           return 500;
  }
}

module.exports = {
  InvalidTransitionError,
  BusinessRuleViolationError,
  PaymentRequiredError,
  OrderLockedError,
  PermissionError,
  AuditWriteError,
  StateUpdateError,
  errorToHttpStatus,
};
