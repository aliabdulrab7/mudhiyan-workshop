# Phase 6 — System Stabilization

> ⚠️ Do not proceed until Phases 1–5 are fully completed and verified.
> ⚠️ This phase fixes correctness and safety gaps. No new features.
> ⚠️ All validation steps must pass before Phase 7 begins.

---

## Purpose

The system is production-capable but carries known safety gaps from the initial build.
This phase closes every gap that could cause security, data integrity, or operational failure in production.

**Correctness before new features. Security before optimization.**

---

## Status: Active

---

## Issues Identified (Diagnosis 2026-04-16)

The following defects were confirmed against the live codebase:

| ID  | Severity | Description |
|-----|----------|-------------|
| C1  | Critical | Production startup guard missing — server starts with default JWT secret |
| C2  | Critical | `cancelled` status exists in OrderService but is not documented in playbook, invariants, or ADRs |
| C3  | Critical | `orders` table CREATE TABLE has `DEFAULT 'received'` — should be `DEFAULT 'new'` (INV-01 violation) |
| H3  | High | `GET /api/orders/:id/history` has no shop isolation — shop_employee can read any shop's history |
| H4  | High | `requireRole()` only accepts a single string — does not support arrays as shown in playbook |
| M1  | Medium | `POST /api/orders/:id/confirm-payment` allows workshop role (ADR-013 requires shop_employee only) |
| M2  | Medium | `PUT /api/order-items/:id` has no role guard — any authenticated user can edit workshop fields |
| M3  | Medium | `POST /api/order-items/:id/photos` has no role guard |
| M5  | Low | `PATCH /api/orders/:id/status` has duplicate `requireAuth` (redundant, not a security gap) |

---

## Tasks

### 6.1 — Production Startup Guard

Add a check in `server/index.js` that reads `JWT_SECRET` and refuses to start if:
- `NODE_ENV === 'production'` AND
- `JWT_SECRET === 'dev-secret-change-in-production'`

Exit with code 1 and a clear English error message before `app.listen()` is called.

**File:** `server/index.js`

```js
if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production')) {
  console.error('[FATAL] JWT_SECRET is not set or is using the default development value. Server will not start in production.');
  process.exit(1);
}
```

### 6.2 — Fix `orders` Table Default Status

The `CREATE TABLE orders` in `db.js` has `DEFAULT 'received'`. Change it to `DEFAULT 'new'` to match INV-01.

**File:** `server/db.js`

Note: This only affects new databases. The `createOrder` function always inserts `status = 'new'` explicitly, so live behavior is already correct. The DEFAULT fix keeps the schema honest.

### 6.3 — Document or Formalize `cancelled` Status

The `cancelled` status is implemented in `OrderService.js` but absent from all governance documents. One of two outcomes is required:

**Option A (Recommended) — Document it formally:**
- Add `cancelled` to the status list in `CLAUDE_PLAYBOOK.md` section 3
- Add the transition rule (`any pre-delivered state → cancelled`) to the TRANSITIONS table in the playbook
- Add a new invariant in `SYSTEM_INVARIANTS.md` covering who can cancel and when
- Add a new ADR (`ADR-015`) documenting the decision

**Option B — Remove it:**
- Remove the `UNCANCELLABLE` set and `cancelled` branch from `isValidTransition()`
- Remove the `cancelled` business rule from `validateBusinessRules()`
- Remove `cancelled` from `STATUS_LABELS` in `track.js`
- Confirm no orders in the database have `status = 'cancelled'` before removing

A decision must be made and confirmed by a human before this task is marked complete.

### 6.4 — History Endpoint Shop Isolation

Add shop isolation to `GET /api/orders/:id/history` in `server/routes/orders.js`.

Before returning history, confirm the order belongs to the requesting user's shop if `role === 'shop_employee'`.

```js
router.get('/:id/history', (req, res) => {
  const isWorkshop = req.user.role === 'workshop';
  const order = isWorkshop
    ? db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id)
    : db.prepare('SELECT id FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  const history = db.prepare(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(history);
});
```

### 6.5 — `requireRole` Array Support

Update `server/middleware/auth.js` to accept either a string or an array of roles:

```js
function requireRole(role) {
  const allowed = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: 'غير مسموح' });
    }
    next();
  };
}
```

### 6.6 — `confirm-payment` Role Restriction

`POST /api/orders/:id/confirm-payment` must be restricted to `shop_employee` per ADR-013.

Add `requireRole('shop_employee')` to the route:

```js
router.post('/:id/confirm-payment', requireRole('shop_employee'), (req, res) => { ... });
```

Remove the manual `role === 'shop_employee'` inline scope check once the middleware handles it — but keep the `shop_id` scoping check.

### 6.7 — Order Items Role Guards

Add `requireRole('workshop')` to write routes that should be workshop-only:

- `PUT /api/order-items/:id` — editing `repair_description`, `workshop_comment` etc.
- `POST /api/order-items/:id/photos` — only workshop should upload repair photos

Review `GET /api/order-items/:id/photos` — confirm whether shop_employee needs read access.

### 6.8 — Remove Duplicate `requireAuth`

`PATCH /api/orders/:id/status` at line 220 calls `requireAuth` redundantly. Remove it — the `router.use(requireAuth)` at the top of the file already covers it.

### 6.9 — Locked Order Status Code Fix

`orderItems.js:checkLocked()` and locked-order guards in `orders.js` return `403`. Per the playbook, a locked order write should return `409 Conflict`. Update:

```js
if (order.locked_at) return res.status(409).json({ error: 'الطلب مغلق بعد التسليم' });
```

Update `errorToHttpStatus` in `server/errors/index.js`:
```js
case 'OrderLockedError': return 409;
```

### 6.10 — CLAUDE_PLAYBOOK.md Completeness Review

Audit the playbook against the current codebase and update any section that does not reflect reality:

- Add `cancelled` status to section 3 (if Option A chosen in task 6.3)
- Add missing tables to section 6 database schema: `customers`, `technicians`, `order_item_technicians`, `item_photos`, `services`, `order_item_services`, `inventory_items`, `repair_parts_used`, `item_locations`
- Update `final_cost` in `order_items` schema (currently `DEFAULT NULL`, playbook shows `DEFAULT 0`)
- Update change history section 13 with a 2026-04-16 entry for all Phase 6 changes

---

## Implementation Checklist

### Critical Fixes
- [ ] 6.1 — Production startup guard added to `server/index.js`
- [ ] 6.2 — `orders` CREATE TABLE DEFAULT changed to `'new'`
- [ ] 6.3 — `cancelled` status formally documented (Option A) OR removed (Option B) — human decision required

### Security & Role Enforcement
- [ ] 6.4 — History endpoint has shop isolation for shop_employee
- [ ] 6.5 — `requireRole()` supports string or array
- [ ] 6.6 — `confirm-payment` restricted to `shop_employee`
- [ ] 6.7 — Order items write routes have `requireRole('workshop')`
- [ ] 6.8 — Duplicate `requireAuth` removed from status patch route

### Status Codes
- [ ] 6.9 — `OrderLockedError` maps to 409 everywhere

### Documentation
- [ ] 6.10 — `CLAUDE_PLAYBOOK.md` updated to match current codebase
- [ ] ADR-015 added (if cancelled is documented formally)
- [ ] Change history entry added to `CLAUDE_PLAYBOOK.md`

---

## Validation Steps (Phase Exit Criteria)

All of the following must be true before Phase 7 begins:

- [ ] Server refuses to start in production with default `JWT_SECRET`
- [ ] `GET /api/orders/:id/history` returns 404 for a shop_employee requesting another shop's order
- [ ] `POST /api/orders/:id/confirm-payment` returns 403 for a workshop user
- [ ] `PUT /api/order-items/:id` returns 403 for a shop_employee
- [ ] Attempting to modify a locked order returns 409 (not 403)
- [ ] `cancelled` is either fully documented in playbook + invariants + ADR, or fully removed from codebase
- [ ] `orders` table schema shows `DEFAULT 'new'`
- [ ] Full test suite passes with no regressions
- [ ] `CLAUDE_PLAYBOOK.md` section 6 lists all database tables that actually exist

---

## Notes

- Task 6.3 requires a human decision before implementation. Do not choose Option A or B autonomously.
- Task 6.9 (status code fix) is a breaking change if any client code checks for `403` on locked orders. Audit the frontend before applying.
- The `requireRole` array support (6.5) is backward compatible — existing single-string calls still work.
- Do not add features, refactor unrelated code, or improve test coverage in this phase. This phase is corrective only.
