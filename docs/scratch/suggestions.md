# Improvement Suggestions

> Companion to `diagnosis.md`. Ordered by priority — fix HIGH items first.

---

## Priority 1 — Fix Now (production-breaking)

---

### Fix H1: Restore shop employee delivery flow

**File:** `client/src/components/OrderDetail.jsx`

Three lines need to change from `'ready'` to `'ready_for_pickup'`:

```jsx
// Line 291 — actions panel visibility for non-workshop users
// BEFORE:
{(isWorkshop || order.status === 'ready') && (
// AFTER:
{(isWorkshop || order.status === 'ready_for_pickup') && (

// Line 309 — delivery button
// BEFORE:
{!isWorkshop && order.status === 'ready' && (
// AFTER:
{!isWorkshop && order.status === 'ready_for_pickup' && (

// Line 322 — WhatsApp "ready" notification button
// BEFORE:
{order.status === 'ready' && (
// AFTER:
{order.status === 'ready_for_pickup' && (
```

Note: Lines 78 and 420 already handle both `'ready'` and `'ready_for_pickup'` correctly — do not change those.

---

### Fix H2: WhatsApp approval link after cost save

**File:** `client/src/components/OrderDetail.jsx`  
**Line:** 109

```js
// BEFORE:
if (updated.status === 'pending_approval') {
// AFTER:
if (updated.status === 'waiting_approval') {
```

---

## Priority 2 — Fix Soon (data integrity)

---

### Fix M1: Wrap track approve/reject in a single atomic block

**File:** `server/routes/track.js`

Move the `order_items` and `orders` field updates inside `OrderService.transition()` as a post-commit hook, or use a `db.transaction()` wrapper that includes both the field updates and the FSM transition together:

```js
// Option A — simple, immediate fix: put all mutations in a transaction
const doApprove = db.transaction((orderId) => {
  db.prepare(`UPDATE order_items SET approval_status = 'approved' ...`).run(orderId);
  db.prepare(`UPDATE orders SET cost_status = 'APPROVED' ...`).run(orderId);
  return OrderService.transition(orderId, 'approved', user, opts);
});
const updated = doApprove(order.id);
```

This guarantees all three mutations succeed together or all roll back.

---

### Fix M2: Use `parseFloat` consistently for costs

**File:** `server/routes/orders.js`  
**Line:** 250

```js
// BEFORE:
const cost = parseInt(req.body.cost, 10);
// AFTER:
const cost = parseFloat(req.body.cost);
```

Also update the validation comment to note that fractional SAR is intentional.

---

## Priority 3 — Fix Before Next Release

---

### Fix M3: Enforce JWT_SECRET in production startup

**File:** `server/index.js` (or `server/app.js`)

Add a startup guard:

```js
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
```

Also rotate the production secret now if the default was ever used.

---

### Fix M4: Support multi-role guards

**File:** `server/middleware/auth.js`

Extend `requireRole` to accept an array:

```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'غير مسموح' });
    }
    next();
  };
}
```

Then replace manual inline role checks with explicit guards. Example:

```js
// BEFORE:
router.post('/:id/confirm-payment', requireAuth, (req, res) => {
  // manual shop_employee scope check inside body
// AFTER:
router.post('/:id/confirm-payment', requireRole('workshop', 'shop_employee'), (req, res) => {
```

---

## Priority 4 — Low Risk, Worth Cleaning Up

---

### Fix L1: Remove or implement `invoiced` status

**File:** `server/routes/orders.js`, `server/services/OrderService.js`

Either:
- **Remove**: Delete `'invoiced'` from `STATUS_SEQUENCE` in `orders.js` and from stats queries if it was never used in production.
- **Implement**: Add a `READY_FOR_PICKUP → INVOICED → DELIVERED` transition path in `OrderService.TRANSITIONS` if invoicing is a planned feature.

---

### Fix L2: Accurate audit log role for customer actions

**File:** `server/routes/track.js`  
**Lines:** 86, 125

```js
// BEFORE:
{ role: 'workshop', username: 'customer_qr' }
// AFTER:
{ role: 'customer', username: `customer:${req.params.token.slice(0, 8)}` }
```

No functional impact — this is purely for audit trail accuracy.

---

### Fix L4: Validate status before FSM in PATCH /status

**File:** `server/routes/orders.js`  
**After line 221**

```js
if (!ALLOWED_STATUSES.includes(status)) {
  return res.status(400).json({ error: 'حالة غير صالحة' });
}
```

This gives a clear 400 before reaching the FSM, instead of a confusing transition error message.

---

## Improvements (Non-blocking)

---

### I1: Add `name` field to technicians

**File:** `server/db.js`, `server/routes/technicians.js`

Currently technicians are identified only by `specialization`. Add a `name` field to the `technicians` table so order details can show "Assigned to: محمد العتيبي (ذهب)".

```sql
ALTER TABLE technicians ADD COLUMN name TEXT DEFAULT NULL;
```

---

### I2: Show repair description and cost per item on TrackPage

**File:** `client/src/pages/TrackPage.jsx`

The `GET /api/track/:token` response already returns `items[]` with `repair_description` and `estimated_cost` per item. The TrackPage does not render them. Adding an item list below the status card would give customers more transparency about what work is being done.

---

### I3: Persist payment method in `orders` table

**File:** `server/routes/orders.js`, `server/db.js`

`POST /api/orders/:id/confirm-payment` does not record which payment method was used (cash/card/transfer). The `OrderDetail.jsx` collects the method in local state but never sends it to the backend. Adding a `payment_method` column would enable financial reporting.

```sql
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL;
```

And update `POST /api/orders/:id/confirm-payment` to accept and store `{ payment_method }`.

---

### I4: Add `search` support on inventory and services pages

**Files:** `server/routes/inventory.js`, `client/src/pages/InventoryPage.jsx`

The inventory endpoint accepts a `search` query param but the frontend `InventoryPage` has no search input. As inventory grows, filtering by name becomes essential.

---

### I5: Pagination on order list

**File:** `server/routes/orders.js`, `client/src/pages/Dashboard.jsx`

`GET /api/orders` already supports `limit` and `offset` params (default limit: 50, max: 500). The frontend does not use them — it always requests the first page. For shops with many orders, old orders become invisible. Add "Load more" or pagination to the order list.

---

### I6: Add `cancelled_at` timestamp to orders

**File:** `server/db.js`

When an order is cancelled, only `status` changes. There is no dedicated `cancelled_at` timestamp. Reports can work around this using `order_status_history`, but a direct column would make cancellation reporting simpler.

---

### I7: WhatsApp "ready for pickup" notification is not sent automatically

**File:** `client/src/components/OrderDetail.jsx`  
**Line:** 384

When a workshop user advances to `quality_check → ready_for_pickup`, `setJustMarkedReady(true)` fires and the ReadyLabelCanvas auto-prints, but there is no automatic WhatsApp notification to the customer. The "إرسال رسالة الاستلام" button only appears for `order.status === 'ready'` (legacy status). Fix: show it also for `ready_for_pickup`, and consider making it fire automatically or at least making it more prominent.
