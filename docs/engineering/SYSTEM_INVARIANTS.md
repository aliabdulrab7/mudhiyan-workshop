# SYSTEM_INVARIANTS.md

> **Invariants are non-negotiable truths about the system.**
> They are not preferences or guidelines. They are the properties that the system must always satisfy, regardless of what feature is being added or changed.
> A request that would violate an invariant must be stopped. The violation must be explained. A safe alternative must be proposed.

---

## Invariant Index

| ID     | Title                                           | Enforcement Location |
|--------|-------------------------------------------------|----------------------|
| INV-01 | Orders must start with status `new`            | `server/db.js` (column default) |
| INV-02 | Orders cannot skip workflow steps              | `server/services/OrderService.js` |
| INV-03 | Every status change must create a history record | `server/services/OrderService.js` |
| INV-04 | Only the shop can mark an order delivered       | `server/services/OrderService.js` |
| INV-05 | Delivery requires payment confirmation          | `server/services/OrderService.js` |
| INV-06 | Delivered orders are permanently locked         | `server/services/OrderService.js` + all write routes |
| INV-07 | Business logic exists only in services          | Architecture — enforced by code review |
| INV-08 | All protected routes must enforce authentication | `server/middleware/auth.js` + code review |
| INV-09 | Shop employees see only their own shop's orders | All routes + `server/middleware/auth.js` |
| INV-10 | Every order must belong to a shop               | `server/db.js` (NOT NULL on `shop_id`) |
| INV-11 | Order numbers are unique and immutable          | `server/db.js` (UNIQUE constraint) |
| INV-12 | Customer tokens are unique and immutable        | `server/db.js` (UNIQUE constraint) |
| INV-13 | The audit trail is insert-only                  | `server/db.js` + no DELETE/UPDATE on history table |
| INV-14 | UI must not expose unauthorized actions         | `client/src/components/` — role-based rendering |
| INV-15 | Cost approval is required before paid repair    | `server/services/OrderService.js` |

---

## INV-01 — Orders Must Start with Status `new`

**Description:**
Every order, when created, must have the status `new`. No order may be created in any other status.

**Why it exists:**
`new` is the entry point to the state machine. An order with any other initial status would have bypassed the machine's entry guard and may be in an inconsistent state with no audit history.

**Enforcement location:**
`server/db.js` — the `orders.status` column has `DEFAULT 'new'`. The `createOrder` function does not accept a `status` parameter. The `POST /api/orders` route does not allow the caller to specify a starting status.

**What would violate this invariant:**
- Adding a `status` field to the `POST /api/orders` request body
- Changing the column default to any value other than `'new'`
- Creating an order through a code path that bypasses `createOrder`

---

## INV-02 — Orders Cannot Skip Workflow Steps

**Description:**
An order must pass through every state in the defined sequence. No transition is permitted that skips intermediate states. For example, an order cannot jump from `received` directly to `in_repair` without passing through `inspection`.

**Why it exists:**
Each intermediate state represents a real-world action: physical receipt, diagnostic inspection, cost communication, customer consent. Skipping states would mean bypassing business commitments and eliminating audit records for those actions.

**Enforcement location:**
`server/services/OrderService.js` — the `TRANSITIONS` registry defines only valid adjacent moves. The `transition()` function checks that `newStatus` is in `TRANSITIONS[currentStatus]` before proceeding. There is no override parameter.

**What would violate this invariant:**
- Adding a transition that jumps more than one step (e.g., `received → in_repair`)
- Adding a "fast path" parameter to `OrderService.transition()` that bypasses the TRANSITIONS registry
- Setting `orders.status` directly via SQL outside of `OrderService`

---

## INV-03 — Every Status Change Must Create a History Record

**Description:**
Every time `orders.status` changes, a record must be inserted into `order_status_history` with the `order_id`, `from_status`, `to_status`, `changed_by` (username), and `created_at`. The history insert and the status update must succeed or fail together.

**Why it exists:**
The audit trail is the system's memory. Disputes, errors, and accountability all depend on being able to reconstruct exactly when each status occurred and who triggered it.

**Enforcement location:**
`server/services/OrderService.js` — the status update and history insert are inside a single `better-sqlite3` transaction. If either fails, both roll back. There is no code path in `OrderService` that updates status without writing history.

**What would violate this invariant:**
- Updating `orders.status` via a SQL statement outside of `OrderService`
- Removing the history insert from the `OrderService` transaction
- Making the history insert optional (conditional or try/catch with swallow)
- Committing the status update before confirming the history insert succeeded

---

## INV-04 — Only the Shop Can Mark an Order Delivered

**Description:**
The transition `returned_to_shop → delivered` may only be triggered by a user with `role = 'shop_employee'`. Workshop users cannot mark orders delivered, even if they have physical access to the order.

**Why it exists:**
Delivery represents the shop's confirmation that the repaired item has been physically handed to the customer and payment has been received. This is a shop-side action. If the workshop could mark orders delivered, it could bypass the payment confirmation requirement and close orders without the shop's knowledge.

**Enforcement location:**
`server/services/OrderService.js` — the `validateBusinessRules()` function checks `if (newStatus === 'delivered' && user.role !== 'shop_employee') throw PermissionError`. The `PATCH /api/orders/:id/status` route is not sufficient on its own — the role check is also in the service layer to prevent bypass.

**What would violate this invariant:**
- Removing the role check for the `delivered` transition
- Adding a second code path to mark delivered (e.g., an admin endpoint) that does not enforce the role check
- Changing the `requireRole` on the delivery endpoint to allow `workshop`

---

## INV-05 — Delivery Requires Payment Confirmation

**Description:**
The transition `returned_to_shop → delivered` may only proceed if `orders.payment_confirmed = 1`. The `payment_confirmed` flag is set via `POST /api/orders/:id/confirm-payment`, which is restricted to `shop_employee`.

**Why it exists:**
Payment must be received before the item is handed to the customer. If delivery could be marked without payment confirmation, the shop could close orders for unpaid repairs, removing the system's ability to track outstanding payments.

**Enforcement location:**
`server/services/OrderService.js` — the `validateBusinessRules()` function checks `if (newStatus === 'delivered' && !order.payment_confirmed) throw PaymentRequiredError`.

**What would violate this invariant:**
- Removing the `payment_confirmed` check from the delivery transition
- Setting `payment_confirmed` automatically without a shop employee action
- Adding a bypass parameter to `confirm-payment` that allows workshop users to confirm payment

---

## INV-06 — Delivered Orders Are Permanently Locked

**Description:**
Once an order transitions to `delivered`, the `locked_at` column is set to the current UTC timestamp. After this point, no field on the order may be modified through any API endpoint. This includes: customer name, phone, notes, cost, status, and items.

**Why it exists:**
A delivered order represents a completed and paid transaction. Any modification after delivery could be used to alter the business record, dispute a cost, or manipulate the audit trail.

**Enforcement location:**
`server/services/OrderService.js` — sets `locked_at` during the delivered transition. All write endpoints in `server/routes/orders.js` — every `PUT` and `PATCH` handler must check `if (order.locked_at)` and return HTTP 409 before performing any operation.

**What would violate this invariant:**
- Removing or bypassing the `locked_at` check in any write endpoint
- Adding an "unlock" endpoint
- Adding a superuser role that can modify locked orders
- Modifying the `locked_at` column after it is set

---

## INV-07 — Business Logic Exists Only in Services

**Description:**
Any code that decides what the system *should do* — transitions, cost calculations, role enforcement beyond authentication, notification triggers — must live in service files under `server/services/`. Route handlers must not contain business decisions.

**Why it exists:**
When business logic is in routes, it cannot be tested independently, it is duplicated when multiple endpoints need the same logic, and it is invisible to security review. Services create a single, testable, auditable location for all decisions.

**Enforcement location:**
Architecture convention — enforced by code review and the protocol in `CLAUDE_PROTOCOL.md`.

**What would violate this invariant:**
- Adding an `if` statement to a route handler that decides whether a transition should proceed
- Calculating cost or order totals inside a route handler
- Sending a notification directly from a route instead of delegating to `NotificationService`

---

## INV-08 — All Protected Routes Must Enforce Authentication

**Description:**
Every route that accesses, creates, or modifies order data must apply `requireAuth` middleware. Additionally, every such route must apply `requireRole` with the appropriate allowed roles. There are no authenticated routes without a role check.

**Why it exists:**
Authentication without role enforcement allows any valid user to perform any action. In a system where `shop_employee` and `workshop` users have fundamentally different permissions, a role-free authenticated route is a security gap.

**Enforcement location:**
`server/middleware/auth.js` provides `requireAuth` and `requireRole`. Every route handler must apply both. Enforced by the route audit in Phase 1 of `CLAUDE_PHASE_PLAN.md` and ongoing code review.

**Exceptions:**
- `POST /api/auth/login` — no auth required (it issues the token)
- `GET /api/track/:token`, `POST /api/track/:token/approve`, `POST /api/track/:token/reject` — intentionally public (see ADR-010)
- `GET /api/config` — returns only server IP and port, no sensitive data
- `GET /api/health` — liveness check

**What would violate this invariant:**
- Adding a new route without `requireAuth`
- Adding a new route with `requireAuth` but without `requireRole`
- Creating a "convenience" endpoint that bypasses auth for internal use

---

## INV-09 — Shop Employees See Only Their Own Shop's Orders

**Description:**
All queries for orders performed by a user with `role = 'shop_employee'` must include a `WHERE shop_id = req.user.shop_id` filter. A shop employee must never be able to access, list, or modify an order belonging to a different shop.

**Why it exists:**
Shops may be competing businesses or separate franchise locations. Cross-shop data visibility would be a confidentiality breach and could allow order manipulation between shops.

**Enforcement location:**
Enforced in every route handler that queries the `orders` table. The `shop_id` check is applied in `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, and all other order modification routes.

**What would violate this invariant:**
- A route that queries orders without filtering on `shop_id` for `shop_employee` users
- An endpoint that accepts `shop_id` as a parameter and does not validate it against `req.user.shop_id`
- A new admin or reporting endpoint that exposes all orders to shop employees

---

## INV-10 — Every Order Must Belong to a Shop

**Description:**
The `orders.shop_id` column is NOT NULL. Every order must reference a valid shop. There are no "workshop-only" or "system" orders with a null shop.

**Why it exists:**
Shop isolation (`INV-09`) and order number generation (`BR{shopId}-{date}-{seq}`) both depend on every order having a known shop. A null shop_id would break both.

**Enforcement location:**
`server/db.js` — the `orders` table schema defines `shop_id INTEGER NOT NULL REFERENCES shops(id)`. The `createOrder` function requires `shop_id` as a parameter.

**What would violate this invariant:**
- Removing the NOT NULL constraint from `shop_id`
- Creating an order through a code path that allows `shop_id = null`
- Adding a "virtual" or "test" shop mechanism that uses null shop_id

---

## INV-11 — Order Numbers Are Unique and Immutable

**Description:**
`orders.order_number` is UNIQUE. Once assigned, it never changes. Order numbers are printed on physical labels and used by customers and staff to identify orders. A duplicate or changed order number causes physical tracking failures.

**Why it exists:**
Order numbers are externally visible identifiers. They appear on printed labels that exist in the physical world. If they are changed or duplicated, the physical label becomes inconsistent with the database record.

**Enforcement location:**
`server/db.js` — UNIQUE constraint on `orders.order_number`. The `createOrder` atomic transaction prevents race conditions during generation. There is no `PUT /api/orders/:id` operation that accepts an `order_number` field.

**What would violate this invariant:**
- Removing the UNIQUE constraint
- Adding an endpoint that allows updating `order_number`
- Generating order numbers outside of the `createOrder` transaction

---

## INV-12 — Customer Tokens Are Unique and Immutable

**Description:**
`orders.customer_token` is a UUID assigned once at order creation. It is UNIQUE. It never changes. The token is encoded in the QR code on the customer's label. If the token changes, all printed QR codes for that order become invalid.

**Why it exists:**
The customer token is printed in the physical world. Once a label is printed and given to the customer, the QR code on that label represents a permanent link to their order. Changing the token would break that link.

**Enforcement location:**
`server/db.js` — UNIQUE constraint on `orders.customer_token`. The `createOrder` function generates the token using `crypto.randomUUID()`. There is no API endpoint that updates `customer_token`.

**What would violate this invariant:**
- Adding an endpoint that regenerates or changes the `customer_token`
- Removing the UNIQUE constraint
- Allowing `customer_token` to be specified by the caller in `POST /api/orders`

---

## INV-13 — The Audit Trail Is Insert-Only

**Description:**
Records in `order_status_history` are written once and never modified or deleted. There are no `UPDATE` or `DELETE` operations against this table.

**Why it exists:**
The audit trail's value is its trustworthiness. If records can be modified or deleted, the trail can be falsified. This would undermine its purpose for dispute resolution, accountability, and business integrity.

**Enforcement location:**
`server/services/OrderService.js` — only INSERTs to `order_status_history`. There are no routes that expose history modification. Enforced by code review and the absence of any `DELETE` or `UPDATE` statement targeting this table in the codebase.

**What would violate this invariant:**
- Adding a route that deletes history records (e.g., "undo last transition")
- Adding an admin endpoint that allows modifying `changed_by` or timestamps in history
- Implementing an "archiving" process that deletes old history records

---

## INV-14 — The UI Must Not Expose Unauthorized Actions

**Description:**
In the frontend, any button, form, or interactive element that triggers an action the current user's role cannot perform must be absent from the DOM. Rendering a disabled button is not sufficient.

**Why it exists:**
Disabled buttons can be re-enabled via browser developer tools. A motivated user could trigger an action the system shows but does not enforce purely on the frontend. The server enforces roles independently — but a visible disabled button creates confusion and a false impression of capability.

Additionally, hidden actions reduce cognitive load: shop employees should not see workshop-only buttons, even if those buttons would be rejected server-side.

**Enforcement location:**
`client/src/components/OrderDetail.jsx`, `client/src/components/ScanResult.jsx` — conditional rendering based on `user.role`. `client/src/components/OrderList.jsx` — role-based action columns.

**What would violate this invariant:**
- Rendering an action button as `disabled` instead of not rendering it at all
- Adding a new action button without a role check
- Showing action panels on locked orders (orders with `locked_at` set)

---

## INV-15 — Cost Approval Is Required Before Paid Repair Work

**Description:**
If a repair has a cost greater than zero, the customer must explicitly approve the cost via the QR code tracking page before the order transitions to `in_repair`. The system must not allow repair work to begin on a paid order without the customer's digital approval record.

**Why it exists:**
This is a customer consent requirement. Starting paid repair work without explicit consent is a commercial and legal risk. The approval creates an audit record that protects both the business and the customer.

**Enforcement location:**
`server/services/OrderService.js` — the `inspection → in_repair` transition throws `BusinessRuleViolationError` if `orders.cost > 0`. The only way to proceed to `in_repair` with a non-zero cost is to go through `waiting_approval → approved → in_repair`. The `inspection → in_repair` direct path is only valid when cost is zero.

**What would violate this invariant:**
- Allowing `inspection → in_repair` when cost > 0
- Adding a "skip approval" parameter to the transition endpoint
- Allowing the workshop to approve on behalf of the customer

---

## Invariant Enforcement Policy

When a requested task, feature, or code change would violate any invariant in this document, the response must follow this protocol:

### Step 1 — Stop Implementation

Do not write any code that implements the violating change. Stop at the planning stage.

### Step 2 — Explain the Violation

Clearly state:
- Which invariant (by ID and title) would be violated
- How exactly the requested change violates it
- What the downstream consequence of the violation would be

Example:
> **INV-03 violated — Every Status Change Must Create a History Record**
>
> The proposed change adds a direct SQL update to `orders.status` in the `/api/orders/:id/fast-close` route. This bypasses `OrderService.transition()`, meaning no record would be written to `order_status_history`. The order would show a status change in the current record with no trace of when it happened or who triggered it. This breaks the audit trail for all fast-closed orders.

### Step 3 — Propose a Safe Alternative

Offer an approach that achieves the same business goal without violating the invariant.

Example:
> **Safe alternative:** Add a new `closed` transition to the `TRANSITIONS` registry with appropriate role guards. Call `OrderService.transition(id, 'closed', user)` from the route handler. This produces the same outcome (order is closed) while preserving the audit trail and enforcing role rules.

### Step 4 — Await Confirmation

Do not proceed until the human explicitly acknowledges the constraint and approves either the safe alternative or provides a new direction.

There is no case where an invariant violation is acceptable as a "temporary" or "expedient" solution. Invariants are absolute.
