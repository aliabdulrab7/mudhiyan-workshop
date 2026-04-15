# Phase 2 — Cost & Approval Module (Lightweight)

> ⚠️ Do not proceed until Phase 1 is fully completed and verified.
> ⚠️ Do not proceed until tested and verified.
> ⚠️ All endpoints must be manually validated before moving forward.
> ⚠️ This phase does NOT implement a financial system.
> ⚠️ This phase ONLY handles cost estimation + customer approval + pickup payment validation logic.

---

## Purpose

This module feeds data into the Phase 1 state machine:

- `estimated_cost` → triggers approval flow
- `approval_status` → controls workflow transition
- Payment confirmation → simple gate before DELIVERED (manual shop payment only)

❌ No invoices table  
❌ No payments table  
❌ No accounting system  
❌ No VAT or financial reporting  

---

## Requirements

---

### 1. Cost Rules

- `estimated_cost` is set per `order_item` during DIAGNOSING phase by technician
- After cost is set:

```
IF estimated_cost > 0:
    → order status = WAITING_APPROVAL

IF estimated_cost = 0:
    → skip approval → IN_REPAIR directly
```

- Cost is stored on `order_items.estimated_cost`
- Order-level summary field `orders.cost` remains as a display helper (updated when any item cost changes)

---

### 2. Approval Rules

- Customer approval only applicable when `order.status = WAITING_APPROVAL`
- Customer actions are triggered via QR tracking page:

```
APPROVE → WAITING_APPROVAL → APPROVED → IN_REPAIR
REJECT  → WAITING_APPROVAL → REJECTED → READY_FOR_PICKUP
```

- REJECTED = repair skipped entirely, item returned as-is
- REJECTED must NEVER transition to IN_REPAIR (enforced by Phase 1 registry)
- `order_items.approval_status` updated on each customer action:
  - `pending` → `approved` or `rejected`
  - `skipped` when `estimated_cost = 0`

---

### 3. Notification Rules

System MUST trigger a notification event when:
- Status becomes `WAITING_APPROVAL` → send cost approval request to customer
- Status becomes `READY_FOR_PICKUP` → notify customer item is ready

Notification channels:
- WhatsApp (primary) — `wa.me/966XXXXXXXXX` format (no `+`)
- SMS fallback

Implementation approach:
- Notifications are triggered as side effects inside `OrderService.transition()`
- Route handlers do NOT call notification functions directly
- A `NotificationService.notify(event, order)` is called after successful transition
- Phase 1's `registerPaymentValidator()` pattern is the model — same injectable hook

---

### 4. Pickup Payment Rule

Payment is collected manually at the shop counter.
System only validates that staff has confirmed payment before allowing DELIVERED.

```
Staff opens order (READY_FOR_PICKUP)
  → Staff collects payment physically
  → Staff calls POST /orders/:id/confirm-payment
  → System sets order.payment_confirmed = true
  → Staff calls PATCH /orders/:id/status { "status": "delivered" }
  → OrderService validates payment_confirmed = true
  → If NOT confirmed → 400 PaymentRequiredError
  → If confirmed → DELIVERED transition proceeds
```

No invoices. No payment records. No accounting. Just a boolean gate.

---

### 5. Delivery Gate (extends Phase 1)

Phase 1's `registerPaymentValidator()` hook is wired here.

The payment validator registered in Phase 2:

```js
OrderService.registerPaymentValidator((order) => {
  if (!order.payment_confirmed) {
    throw new PaymentRequiredError();
  }
});
```

This enforces: `READY_FOR_PICKUP → DELIVERED` requires `payment_confirmed = true`.

---

### 6. Lock Rules (unchanged from Phase 1)

Once `DELIVERED`:
- `order` is fully read-only
- `order_items` cannot be edited
- Only `CLOSED` transition allowed (workshop_admin only, manual)

---

### 7. Data Fields — Additions in This Phase

#### order_items additions:
```
estimated_cost      NUMBER | NULL    — set during DIAGNOSING
approval_required   BOOLEAN          — true if estimated_cost > 0
approval_status     TEXT             — pending | approved | rejected | skipped
```

#### orders additions:
```
payment_confirmed   BOOLEAN          — set by staff at pickup (default false)
cost_status         TEXT             — NO_COST | PENDING_APPROVAL | APPROVED | REJECTED
```

---

## Database Changes

### order_items — add columns:
```
estimated_cost    REAL DEFAULT NULL
approval_required INTEGER DEFAULT 0   (SQLite boolean)
approval_status   TEXT DEFAULT 'pending'
```

### orders — add columns:
```
payment_confirmed  INTEGER DEFAULT 0   (SQLite boolean)
cost_status        TEXT DEFAULT 'NO_COST'
```

---

## Implementation Checklist

### Database Migrations
- [x] Add `estimated_cost` column to `order_items` (REAL DEFAULT NULL)
- [x] Add `approval_required` column to `order_items` (INTEGER DEFAULT 0)
- [x] Add `approval_status` column to `order_items` (TEXT DEFAULT 'pending')
- [x] Add `payment_confirmed` column to `orders` (INTEGER DEFAULT 0)
- [x] Add `cost_status` column to `orders` (TEXT DEFAULT 'NO_COST')

### Cost Engine
- [x] `POST /api/orders/:orderId/items/:itemId/cost` — set item cost + trigger transition (workshop only)
  - [x] Updates `order_items.estimated_cost`
  - [x] Sets `approval_required = 1` if cost > 0, else `0`
  - [x] Recalculates `orders.cost` from sum of all item costs via `refreshOrderCost()`
  - [x] Sets `order_items.approval_status = skipped` if cost = 0
  - [x] Updates `orders.cost_status` accordingly
  - [x] Triggers `OrderService.transition()` to `waiting_approval` or `in_repair`
  - [x] Returns 400 if order not in `diagnosing`
- [x] `PATCH /api/orders/:id/cost` (backward compat) — updated to sync item fields via `syncItemCosts()` + `refreshOrderCost()`

### Approval Flow
- [x] `POST /api/track/:token/approve` — sets `approval_status = approved` on all pending items, `cost_status = APPROVED`, calls `OrderService.transition()`
- [x] `POST /api/track/:token/reject` — sets `approval_status = rejected` on all pending items, `cost_status = REJECTED`, calls `OrderService.transition()`
- [x] Both return `_notification` payload in response when hook fires

### Notification Service
- [x] `server/services/NotificationService.js` created
  - [x] `buildWhatsAppLink(phone, message)` — strips leading +, returns `wa.me` URL
  - [x] `notify(event, order)` — returns `{ event, message, whatsapp_url }` or `null`
  - [x] `waiting_approval` builder: includes order number, cost, approval link
  - [x] `ready_for_pickup` builder: includes order number, pickup notice
  - [x] Returns null for unknown events or missing phone — never throws
- [x] `OrderService.registerNotificationHook()` injectable added
- [x] Notification fires post-commit in `transition()` — failure is non-fatal
- [x] Hook registered in `server/app.js` at startup
- [x] `_notification` attached to returned order when hook fires

### Pickup Payment Validation
- [x] `POST /api/orders/:id/confirm-payment` endpoint added
  - [x] Returns 400 if order not `READY_FOR_PICKUP`
  - [x] Returns 403 if order locked
  - [x] Returns 403 if `shop_employee` accessing other shop's order
  - [x] Sets `payment_confirmed = 1`
- [x] `OrderService.registerPaymentValidator()` wired in `server/app.js`
  - [x] Validator checks `order.payment_confirmed == 1`
  - [x] Throws `PaymentRequiredError` if not confirmed

### Validation (26/26 tests passing)
- [x] Cost endpoint blocked if order not in `diagnosing` → 400
- [x] `DELIVERED` blocked when `payment_confirmed = 0` → 400 `PaymentRequiredError`
- [x] `DELIVERED` allowed when `payment_confirmed = 1` → locked_at set
- [x] `confirm-payment` blocked if not `READY_FOR_PICKUP` → 400
- [x] `confirm-payment` blocked if locked → 403
- [x] `REJECTED` bypasses repair — Phase 1 registry enforces (no duplicated check)
- [x] All transitions go through `OrderService.transition()` — no exceptions

---

## Completed Tasks

- [x] `server/db.js` — 5 new columns across `orders` and `order_items`
- [x] `server/services/NotificationService.js` — wa.me builder, event-based notify()
- [x] `server/services/OrderService.js` — `registerNotificationHook()` + post-commit fire
- [x] `server/routes/orders.js` — item cost endpoint, confirm-payment, PATCH cost sync
- [x] `server/routes/track.js` — approve/reject set item-level fields + return notification
- [x] `server/app.js` — payment validator + notification hook registered at startup
- [x] 26/26 tests pass against in-memory DB

---

## Notes

- No invoices, no payments table, no accounting. Payment is a physical action confirmed by a boolean.
- `NotificationService` returns WhatsApp links — it does NOT autonomously send messages.
- `wa.me` format: `https://wa.me/966XXXXXXXXX?text=...` — phone stored without `+`.
- Phase 3 (Order API) adds full `order_items` CRUD. This phase only adds the cost + approval fields.
- Notification hook failure must not affect state machine — fire-and-forget after commit.
- Do not build UI in this phase.
