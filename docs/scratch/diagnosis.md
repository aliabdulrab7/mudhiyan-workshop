# Codebase Diagnosis Report

> Generated: 2026-04-16  
> Scope: Full codebase — server + client  
> Method: Static code analysis, API contract verification, state machine trace

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 High   | 2     |
| 🟠 Medium | 4     |
| 🟡 Low    | 5     |
| **Total** | **11** |

---

## 🔴 HIGH — Bugs that break production flows

---

### H1 — Shop employee delivery flow is completely broken

**File:** `client/src/components/OrderDetail.jsx`  
**Lines:** 291, 309, 322, 327  

The entire "Actions" panel for branch employees (shop_employee role) is conditionally rendered with:

```jsx
{(isWorkshop || order.status === 'ready') && (
```

The legacy status `'ready'` is never set by the current 9-stage workflow. New orders transition to `'ready_for_pickup'`. Since `isWorkshop` is false for branch employees and `order.status` is never `'ready'`, branch employees see **no action buttons** on any active order — including the delivery confirmation button.

Downstream effects on same condition:
- Line 309: `!isWorkshop && order.status === 'ready'` — delivery button never renders
- Line 322: `order.status === 'ready'` — WhatsApp "جاهز للاستلام" notification button never renders
- Branch employees are effectively locked out of the delivery step

**Impact:** Branch employees cannot complete order delivery. Every order must be closed by workshop admin.

---

### H2 — WhatsApp approval link never opens after cost is saved

**File:** `client/src/components/OrderDetail.jsx`  
**Line:** 109  

```js
if (updated.status === 'pending_approval') {
  window.open(buildApprovalWaUrl(...), '_blank', 'noopener,noreferrer');
}
```

The server returns `status: 'waiting_approval'` (9-stage workflow). The condition checks for `'pending_approval'` (legacy). This condition is always false — the WhatsApp link to the customer is never opened after the workshop user saves the cost.

**Impact:** Workshop staff must manually send the approval link. The built-in WhatsApp trigger is dead.

---

## 🟠 MEDIUM — Issues that degrade reliability or correctness

---

### M1 — Pre-transition DB mutations create inconsistent state on failure

**File:** `server/routes/track.js`  
**Lines:** 69–88 (approve), 109–129 (reject)

Both `POST /api/track/:token/approve` and `POST /api/track/:token/reject` update `order_items.approval_status` and `orders.cost_status` **before** calling `OrderService.transition()`. If `transition()` fails (e.g., concurrent status change by another user), the DB ends up in an inconsistent state:

```
order_items.approval_status = 'approved'
orders.cost_status           = 'APPROVED'
orders.status                = 'waiting_approval'  ← unchanged, transition failed
```

The order looks approved in item/cost fields but the FSM state didn't advance.

**Impact:** Silent data inconsistency. Orphaned approval states with no way to recover except manual DB edit.

---

### M2 — Order-level cost endpoint silently drops decimal precision

**File:** `server/routes/orders.js`  
**Line:** 250

```js
const cost = parseInt(req.body.cost, 10);
```

`PATCH /api/orders/:id/cost` uses `parseInt`, which truncates decimals silently. A cost of `99.5 SAR` becomes `99`. The per-item cost endpoint (`POST /api/orders/:orderId/items/:itemId/cost`, line 302) correctly uses `parseFloat`.

**Impact:** Decimal repair costs are silently under-charged. No error is thrown, so neither staff nor customer is aware.

---

### M3 — Fallback JWT secret with no production guard

**File:** `server/middleware/auth.js`  
**Line:** 3

```js
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
```

If `JWT_SECRET` is not set in the production environment, the server starts without error using the hardcoded default. Any attacker with access to the source code can forge any JWT token (including `role: 'workshop'`) and gain full admin access.

**Impact:** Full authentication bypass if `JWT_SECRET` env var is missing in production.

---

### M4 — `requireRole` only accepts a single role, cannot express multi-role guards

**File:** `server/middleware/auth.js`  
**Line:** 20

```js
if (req.user?.role !== role) {
```

The `requireRole` middleware accepts one role and uses strict equality. There is no way to write `requireRole('workshop', 'shop_employee')`. As a result, some routes that should be accessible to both roles (e.g., `confirm-payment`) use only `requireAuth` without any role check, or routes require full `workshop` access that should allow `shop_employee` too.

**Impact:** Access control is coarser than intended. Workarounds exist (manual checks in route bodies) but are inconsistently applied.

---

## 🟡 LOW — Code quality and minor issues

---

### L1 — `invoiced` status is unreachable

**File:** `server/routes/orders.js`  
**Line:** 13

`STATUS_SEQUENCE` includes `'invoiced'` but `OrderService.TRANSITIONS` has no path to or from `invoiced`. The status can be queried and filtered by name but can never be reached through the state machine. The stats query on line 40 counts it. It is a dead state.

---

### L2 — Customer approve/reject audit log records role as `'workshop'`

**File:** `server/routes/track.js`  
**Lines:** 86–87, 125–126

```js
{ role: 'workshop', username: 'customer_qr' }
```

Customer-initiated transitions are logged with `role: 'workshop'`. The audit trail in `order_status_history.changed_by` will show `customer_qr` but the role field in any future audit query filtering by role will misattribute customer actions to the workshop role.

---

### L3 — Branch employee actions section condition excludes `'ready_for_pickup'`

**File:** `client/src/components/OrderDetail.jsx`  
**Line:** 291 (see H1 above)

Even if H1 is fixed, the condition `order.status === 'ready'` in the outer panel gate should be `order.status === 'ready_for_pickup'` to match the current workflow. This is a code-cleanliness issue once H1 is fixed.

---

### L4 — `PATCH /api/orders/:id/status` accepts any string before FSM validation

**File:** `server/routes/orders.js`  
**Line:** 219

```js
if (!status) return res.status(400).json({ error: 'الحالة مطلوبة' });
```

The endpoint only checks that `status` is not empty. It does not validate it against `ALLOWED_STATUSES` before calling `OrderService.transition()`. Invalid values reach the FSM and return a generic transition error rather than a clear 400 validation error.

---

### L5 — `customer_token` format is inconsistent for migrated rows

**File:** `server/db.js`  
**Line:** 63

```sql
hex(randomblob(16))  -- produces 32-char hex string
```

New orders created via `createOrder()` use `crypto.randomUUID()` (36-char UUID, line 334). Migrated rows from the backfill on line 63 use a 32-char hex string. Both formats are valid as opaque tokens (the tracking page does not validate format), but any future code that assumes UUID format will break on migrated tokens.

---

## Environment Verification

| Check | Status |
|-------|--------|
| `JWT_SECRET` enforced non-default in prod | ❌ No guard |
| All state transitions go through `OrderService.transition()` | ✅ |
| Order locked after DELIVERED | ✅ |
| Public track endpoint exposes no internal IDs | ✅ |
| Role-based route guards on all write endpoints | ✅ (with M4 caveat) |
| Atomic transaction for order creation | ✅ |
| Audit log written before status update | ✅ |
| Frontend status names match backend | ✅ (fixed 2026-04-16) |
| Track page `piece_type` in response | ✅ (fixed 2026-04-16) |

---

## Files Most Affected

| File | Issues |
|------|--------|
| `client/src/components/OrderDetail.jsx` | H1, H2, L3 |
| `server/routes/track.js` | M1, L2 |
| `server/routes/orders.js` | M2, L1, L4 |
| `server/middleware/auth.js` | M3, M4 |
| `server/db.js` | L5 |
