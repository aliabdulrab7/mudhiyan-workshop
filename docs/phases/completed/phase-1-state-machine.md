# Phase 1 — State Machine Engine

> ⚠️ Do not proceed until tested and verified.
> ⚠️ All endpoints must be manually validated before moving forward.

---

## Purpose

Build the core workflow engine that controls all order status transitions.
This is the foundation every other phase depends on. Nothing else is built until this is solid.

---

## Requirements

### Valid States
```
RECEIVED
DIAGNOSING
WAITING_APPROVAL
APPROVED
REJECTED
IN_REPAIR
QUALITY_CHECK
READY_FOR_PICKUP
DELIVERED
CLOSED
CANCELLED
```

### Valid Transitions
```
RECEIVED          → DIAGNOSING
DIAGNOSING        → WAITING_APPROVAL  (only if estimated_cost > 0)
DIAGNOSING        → IN_REPAIR         (only if estimated_cost = 0)
WAITING_APPROVAL  → APPROVED
WAITING_APPROVAL  → REJECTED
APPROVED          → IN_REPAIR
REJECTED          → READY_FOR_PICKUP  (repair bypassed — only valid path)
IN_REPAIR         → QUALITY_CHECK
QUALITY_CHECK     → READY_FOR_PICKUP  (QC passed)
QUALITY_CHECK     → IN_REPAIR         (QC failed)
READY_FOR_PICKUP  → DELIVERED         (requires payment — enforced in Phase 2)
DELIVERED         → CLOSED            (workshop_admin only, manual)
ANY (pre-DELIVERED) → CANCELLED       (admin override only)
```

### Forbidden Transitions (hard-blocked)
```
RECEIVED          → IN_REPAIR         ✗
DIAGNOSING        → READY_FOR_PICKUP  ✗
WAITING_APPROVAL  → CLOSED            ✗
REJECTED          → IN_REPAIR         ✗
IN_REPAIR         → RECEIVED          ✗
DELIVERED         → IN_REPAIR         ✗
```

### Single Source Enforcement Rule (NO EXCEPTIONS)

ALL state transitions MUST pass through one function and one function only:

```
OrderService.transition(orderId, newStatus, userId, metadata)
```

No exceptions — this means:
- No repository-level `updateStatus()` method exists
- No direct SQL `UPDATE orders SET status = ...` anywhere in the codebase
- No admin bypass — even workshop_admin goes through this function
- No route handler sets status directly
- If a bypass is found during code review, it is a bug, not a shortcut

### Transition Registry (FSM Config)

The allowed transitions are defined as a single config object.
This is the only place transition rules live — no hardcoded if/else chains:

```js
const TRANSITIONS = {
  RECEIVED:         ["DIAGNOSING"],
  DIAGNOSING:       ["WAITING_APPROVAL", "IN_REPAIR"],
  WAITING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED:         ["IN_REPAIR"],
  REJECTED:         ["READY_FOR_PICKUP"],
  IN_REPAIR:        ["QUALITY_CHECK"],
  QUALITY_CHECK:    ["READY_FOR_PICKUP", "IN_REPAIR"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED:        ["CLOSED"],
};
```

`CANCELLED` is a global exit: allowed from any state except `DELIVERED` and `CLOSED`,
enforced as a special-case check inside `transition()`, not in the registry.

### Guard Rules (run in this order before every transition)

```
1. Validate transition is allowed by TRANSITIONS registry
      → if not found: throw InvalidTransitionError

2. Validate business rules:
      DIAGNOSING → WAITING_APPROVAL  requires estimated_cost > 0
      DIAGNOSING → IN_REPAIR         requires estimated_cost == 0
      DELIVERED                      requires invoice.status == PAID + payment record exists  ← Phase 2
      DELIVERED → CLOSED             requires caller role == workshop_admin
      ANY → CANCELLED                requires caller role == workshop_admin or branch_admin
      REJECTED                       must NEVER route to IN_REPAIR (enforced by registry)
      → if violated: throw BusinessRuleError with explicit message

3. Write audit log to order_status_history BEFORE updating order
      → if audit write fails: throw AuditWriteError, abort entire operation

4. Update orders.status
      → if update fails: throw StateUpdateError

5. If newStatus == DELIVERED: lock order
      → set order.locked_at = now()
      → all subsequent writes to order/items/invoice must check locked_at IS NULL
```

### No Silent Fail Rule (CRITICAL)

If a transition fails at any step:
- MUST throw an explicit typed error with a descriptive message
- MUST NOT fall back silently or return a default value
- MUST NOT partially update state (steps 3 and 4 must be atomic — same DB transaction)
- MUST NOT swallow errors in try/catch without re-throwing
- Caller (route handler) is responsible for mapping errors to HTTP status codes

```
InvalidTransitionError  → 400
BusinessRuleError       → 400 (with specific message)
PermissionError         → 403
AuditWriteError         → 500 (never silently ignored)
StateUpdateError        → 500
```

### Role Restrictions
- `DELIVERED → CLOSED` allowed only for `workshop_admin`
- `ANY → CANCELLED` allowed only for `workshop_admin` or `branch_admin` (pre-DELIVERED)
- Technicians cannot trigger `DELIVERED` or `CLOSED`

---

## Database Tables Required (this phase)

### orders
```
id, tracking_number, tracking_token, customer_id, branch_id,
status, created_by, order_date, delivered_at, closed_at,
notes, created_at, updated_at
```

### order_status_history
```
id, order_id, old_status, new_status, changed_by, notes, created_at
```

### order_items (minimal — for cost check)
```
id, order_id, estimated_cost, approval_status
```

### branches, users (minimal — for role check)
```
branches: id, name, code
users: id, role, branch_id
```

---

## Implementation Checklist

### Database
- [x] `orders` table exists with status field — added `locked_at` migration in `db.js`
- [x] `order_status_history` table exists — added `notes` column migration in `db.js`
- [x] `order_items` table exists (minimal cost field available via `orders.cost`)
- [x] `shops` (branches) and `users` tables exist with role field

### State Machine Service
- [x] Define `TRANSITIONS` registry as a single config object — `server/services/OrderService.js`
- [x] Implement `isValidTransition(currentStatus, newStatus)` — pure function, reads registry only
- [x] Define typed error classes — `server/errors/index.js`:
  `InvalidTransitionError`, `BusinessRuleViolationError`, `PaymentRequiredError`,
  `OrderLockedError`, `PermissionError`, `AuditWriteError`, `StateUpdateError`
- [x] Implement `OrderService.transition(orderId, newStatus, user, metadata)`
  - [x] Step 1: Load order, get current status
  - [x] Step 2: Check `isValidTransition()` — throws `InvalidTransitionError` if false
  - [x] Step 3: Run guard rules in order:
    - [x] Business rule: `DIAGNOSING → WAITING_APPROVAL` requires `cost > 0`
    - [x] Business rule: `DIAGNOSING → IN_REPAIR` requires `cost == 0`
    - [x] Business rule: `READY_FOR_PICKUP → DELIVERED` — payment hook registered (Phase 2 wires)
    - [x] Business rule: `DELIVERED → CLOSED` requires `role == workshop`
    - [x] Business rule: `ANY → CANCELLED` requires `workshop` or `shop_employee`
    - [x] All violations throw typed errors with explicit Arabic messages
  - [x] Step 4: DB transaction opened via `better-sqlite3` (`db.transaction()`)
  - [x] Step 5: Re-read order inside transaction (race-condition safe)
  - [x] Step 6: Insert `order_status_history` row — audit BEFORE state update
  - [x] Step 7: Update `orders.status` — throws `StateUpdateError` if no rows updated
  - [x] Step 8: If `newStatus == delivered`, set `order.locked_at = now()`
  - [x] Step 9: Transaction auto-rollbacks on any exception
  - [x] Step 10: Return updated order row
- [x] Confirmed: no `updateStatus()` method on any repository
- [x] Confirmed: no raw SQL status update outside this service
- [x] Confirmed: no admin bypass path

### API Endpoint
- [x] `PATCH /api/orders/:id/status` — calls `OrderService.transition()` only
- [x] Returns 400 with descriptive error on invalid/blocked transition
- [x] Returns 403 for permission violations
- [x] Returns 200 with updated order on success
- [x] `errorToHttpStatus()` maps all error types to correct HTTP codes

### Validation (36/36 tests passing)

**Forbidden transitions — all return 400:**
- [x] `RECEIVED → IN_REPAIR` → 400 `InvalidTransitionError`
- [x] `REJECTED → IN_REPAIR` → 400 `InvalidTransitionError`
- [x] `DELIVERED → IN_REPAIR` → 400 `InvalidTransitionError`
- [x] `WAITING_APPROVAL → CLOSED` → 400 `InvalidTransitionError`
- [x] `IN_REPAIR → RECEIVED` → 400 `InvalidTransitionError`

**Business rule guards:**
- [x] `DIAGNOSING → WAITING_APPROVAL` when `cost = 0` → 400 `BusinessRuleViolationError`
- [x] `DIAGNOSING → IN_REPAIR` when `cost > 0` → 400 `BusinessRuleViolationError`
- [x] `DELIVERED → CLOSED` when caller is `shop_employee` → 403 `PermissionError`
- [x] `REJECTED → IN_REPAIR` blocked by registry → 400 `InvalidTransitionError`

**Audit and atomicity:**
- [x] Every valid transition creates a row in `order_status_history`
- [x] Audit log written BEFORE `orders.status` update (same transaction)
- [x] Transaction rollback on any failure — confirmed by better-sqlite3 behavior

**No silent fail:**
- [x] All error paths throw typed named errors
- [x] `errorToHttpStatus()` maps error.name → HTTP code — no swallowed errors

**Lock:**
- [x] After `DELIVERED`, `order.locked_at` is set
- [x] `OrderLockedError` thrown on any subsequent transition attempt

**Idempotency:**
- [x] Second transition call returns 400 (order status no longer matches expected)

---

## Completed Tasks

- [x] `server/errors/index.js` — 7 typed error classes + `errorToHttpStatus()`
- [x] `server/services/OrderService.js` — TRANSITIONS registry, `isValidTransition()`, `transition()`, `registerPaymentValidator()`
- [x] `server/db.js` — `locked_at` migration on orders, `notes` migration on order_status_history
- [x] `server/routes/orders.js` — `PATCH /:id/status` and `PATCH /:id/cost` route through service
- [x] `server/routes/track.js` — `POST /:token/approve` and new `POST /:token/reject` route through service
- [x] 36/36 tests pass against in-memory DB

---

## Notes

- Payment enforcement for `READY_FOR_PICKUP → DELIVERED` is added in Phase 2.
  This phase only ensures the transition itself is structurally valid.
- Do not build UI in this phase.
- Do not build QR in this phase.
