# ARCHITECTURE_DECISIONS.md

> **This document records every significant architectural decision made in the Mudhiyan Workshop system.**
> Each decision is an ADR (Architecture Decision Record). ADRs are immutable history — they are never deleted, only superseded.
> Any future change to the architecture must add a new ADR. It must reference the ADR it supersedes if applicable.
> ADRs explain *why* the system is built the way it is, so future engineers do not accidentally undo intentional design choices.

---

## ADR Template

```
## ADR-XXX — Title

**Status:** Accepted | Superseded by ADR-XXX | Deprecated

**Date:** YYYY-MM-DD

### Context
What situation or problem prompted this decision?

### Decision
What was decided?

### Consequences
What becomes easier? What becomes harder? What constraints does this create?
```

---

## ADR-001 — Monorepo Structure

**Status:** Accepted

**Date:** 2026-01-01 (estimated project start)

### Context
The system requires a React frontend and an Express backend. They need to be deployable together but developed and built independently. The team is small — one or two people.

### Decision
Use a flat monorepo with two subdirectories: `client/` and `server/`. A root `package.json` uses `concurrently` to run both in development. The client is built separately for production (`npm run build --prefix client`). Vite in development proxies `/api/*` to the Express server. Nginx handles the proxy in production.

### Consequences
- Simple to operate: one repository, one deployment target, one git history
- No independent versioning of client and server
- Both must be deployed together; there is no independent rollout of just the frontend
- Scales well for a small team; would require restructuring for independent deployment at larger scale

---

## ADR-002 — SQLite as the Database

**Status:** Accepted

**Date:** 2026-01-01 (estimated project start)

### Context
The system needs a persistent relational database. The deployment target is a single EC2 instance. The team has no dedicated DBA. The volume is moderate: a few hundred orders per day across a handful of shops.

### Decision
Use SQLite via `better-sqlite3`. The database file lives at `server/data/workshop.db`. WAL mode is enabled for better concurrent reads. Schema is defined and migrated in `server/db.js` on server startup.

### Consequences
- Zero infrastructure overhead: no database server to manage, monitor, or pay for
- `better-sqlite3` is synchronous: all database calls are blocking but fast for typical SQLite workloads
- Backups are a single file copy (handled by GitHub Actions daily)
- **Constraint:** Only one writer process at a time. The application must run as a single PM2 instance. If horizontal scaling is ever required, a migration to PostgreSQL or similar is necessary
- Schema changes require file modifications and server restarts, not DDL scripts on a running server

---

## ADR-003 — Service Layer Architecture

**Status:** Accepted

**Date:** 2026-02-01 (estimated)

### Context
Early iterations of the system had business logic scattered across route handlers. This made it difficult to test, audit, and extend the order lifecycle logic.

### Decision
Introduce a formal service layer. All business logic that involves decisions about what the system should do belongs in service files under `server/services/`. Routes are responsible only for: parsing the request, calling authentication and role middleware, delegating to a service or database helper, and returning the HTTP response. Services have no knowledge of HTTP.

### Consequences
- Business logic is testable without HTTP overhead
- Routes are short and easy to audit for security
- Adding a new feature requires deciding where the logic belongs (service vs. helper vs. route)
- **Constraint:** Developers must resist the temptation to put business logic in routes. Code review must enforce the boundary

---

## ADR-004 — Centralized Order State Machine

**Status:** Accepted

**Date:** 2026-02-01 (estimated)

### Context
The order lifecycle involves 12 statuses and complex transition rules that vary by role, cost value, payment status, and customer action. Without centralization, these rules were duplicated across routes and became inconsistent.

### Decision
All order status transitions are handled exclusively by `server/services/OrderService.js`. The `TRANSITIONS` registry defines all valid moves. The `transition(orderId, newStatus, user, metadata)` function enforces validity, business rules, and atomically writes both the status update and the audit log in a single SQLite transaction.

No code outside `OrderService.js` may execute `UPDATE orders SET status = ...`.

### Consequences
- Single source of truth for all workflow rules
- Every transition is audited automatically — impossible to make a status change without an audit record
- Easy to extend: add a new status by updating the TRANSITIONS registry and adding any business rule to `validateBusinessRules()`
- **Constraint:** Any workflow change requires updating OrderService, the playbook, and potentially invariants and ADRs. This is intentional overhead to prevent undocumented workflow changes
- Adding a new status creates a migration requirement (status badge, UI labels, test coverage)

---

## ADR-005 — Role-Based Access with Two Roles

**Status:** Accepted

**Date:** 2026-02-01 (estimated)

### Context
The business has two types of users: shop employees at physical shops and technicians/staff at the central workshop. Their permissions are fundamentally different: shop employees can create orders and handle delivery, but must not perform repairs. Workshop staff perform repairs but must not mark orders delivered (to prevent bypassing payment confirmation).

### Decision
Implement two roles: `workshop` and `shop_employee`. Role is stored in the JWT payload and enforced via `requireRole` middleware on every protected route. Shop employees are additionally scoped to their `shop_id` — they cannot see or modify orders belonging to other shops.

### Consequences
- Simple, auditable role model with no complex permissions matrix
- Every route's authorization is readable in a single `requireRole` call
- **Constraint:** Adding a new role requires updating the middleware, all relevant route guards, the JWT payload, and the seeding logic. It must be treated as a major change
- There is no admin superuser role. Operations that require admin access (creating shops, resetting passwords) are performed via the seed script or direct database access

---

## ADR-006 — JWT Authentication with localStorage

**Status:** Accepted

**Date:** 2026-02-01 (estimated)

### Context
The system needs to authenticate users across sessions. Options considered: session cookies with server-side session store, JWT in httpOnly cookies, JWT in localStorage.

### Decision
Use JWT tokens stored in the browser's `localStorage`. Token expiry is 7 days. The JWT payload contains `{ id, role, shop_id, username }`. The server is stateless — no session table.

### Consequences
- Server is fully stateless: scales horizontally without a shared session store (relevant if SQLite is later replaced)
- No server-side token revocation: a compromised token is valid until expiry
- `localStorage` is accessible to JavaScript and therefore vulnerable to XSS attacks. This is mitigated by the absence of `dangerouslySetInnerHTML` and a strong CSP
- **Risk acknowledged:** If a higher security requirement emerges (e.g., immediate revocation of compromised tokens), this decision should be superseded with an httpOnly cookie + refresh token architecture

---

## ADR-007 — Atomic createOrder Transaction

**Status:** Accepted

**Date:** 2026-02-01 (estimated)

### Context
Order numbers follow the format `BR{shopId}-{YYYYMMDD}-{seq}` where `seq` is a daily sequential counter per shop. If the counter read and the order insert are separate operations, two concurrent requests could read the same counter value and generate duplicate order numbers.

### Decision
The entire createOrder operation — reading today's order count, generating the order number, inserting the order, and inserting all order items — is wrapped in a single `better-sqlite3` transaction. The transaction is defined in `db.js` as an exported function `createOrder`. This function must never be split.

### Consequences
- Order number generation is race-condition safe under SQLite's serialized writer model
- The transaction guarantees all-or-nothing: if item insertion fails, the entire order is rolled back
- **Constraint:** The `createOrder` function in `db.js` is a critical section. It must not be split, refactored into multiple calls, or bypassed by any new code path

---

## ADR-008 — Order Locking After Delivery

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
Once an order is delivered, it represents a completed commercial transaction. Any modification after delivery could be used to dispute the record, alter costs, or manipulate the audit trail.

### Decision
When an order transitions to `delivered`, `OrderService` sets the `locked_at` column to the current UTC timestamp. All write endpoints (`PUT`, `PATCH`) check `if (order.locked_at)` and return HTTP 409 before performing any operation. There is no unlock mechanism.

### Consequences
- Delivered orders are permanent and tamper-evident
- The audit trail for a delivered order can be trusted as immutable
- **Constraint:** There is no mechanism to correct a delivered order. If a mistake is discovered after delivery, a new order must be created to represent the corrective action. This is a deliberate business rule, not a technical limitation

---

## ADR-009 — Immutable Audit Trail

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
The business needs to resolve disputes about when a status changed, who changed it, and what the order state was at any point. Without an audit trail, these disputes cannot be resolved.

### Decision
Every status transition must write a record to `order_status_history`. The write is inside the same SQLite transaction as the status update. If the history insert fails, the entire transition rolls back. There are no `UPDATE` or `DELETE` operations against `order_status_history`. Records in this table are insert-only.

### Consequences
- Every order has a complete, trustworthy history of all status changes
- History records are written even for transitions that seem obvious or automatic
- **Constraint:** Any code that changes `orders.status` must go through `OrderService.transition()`. Direct SQL updates to `orders.status` outside of this function violate this invariant and must not exist

---

## ADR-010 — Customer Tracking via QR Code Without Authentication

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
Customers need to track their order and approve or reject a repair cost estimate. Requiring customers to create an account is a significant friction point and adds complexity to a user population that may interact with the system only once.

### Decision
Each order is assigned a `customer_token` (UUID) at creation time. This token is encoded in a QR code printed on the label. The `/api/track/:token` and `/track/:token` routes are fully public — no authentication required. The customer sees only the fields necessary for tracking and approval. The token provides security through obscurity: a UUID is practically unguessable.

### Consequences
- Customers can track orders and approve costs from their phone with zero account creation friction
- No personal data is required from the customer other than what is already on the order
- **Risk acknowledged:** The customer token is printed on the label. If the label is lost or the QR code is photographed by a third party, that person could view the order status and approve/reject the cost. This risk is considered acceptable for a jewelry repair shop context
- **Constraint:** The `/api/track/:token` response must never include sensitive internal data (workshop comments, technician assignments, internal notes). It must be reviewed every time the order data model changes

---

## ADR-011 — WhatsApp as the Notification Channel

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
Customers need to be notified when their order requires approval and when it is ready for pickup. Options considered: SMS (Twilio), email, push notifications, WhatsApp.

### Decision
WhatsApp is used as the notification channel via the `wa.me` deep link format. The server generates the WhatsApp URL with a pre-filled Arabic message. The shop employee clicks the link, which opens WhatsApp with the message pre-composed. The employee sends it manually. No server-to-customer communication happens automatically.

### Consequences
- Zero infrastructure cost: no SMS or email service required
- Works on any device the shop employee has WhatsApp installed on
- Arabic messages are pre-filled, reducing the chance of miscommunication
- **Constraint:** Notifications are not automatic. A shop employee must actively click the WhatsApp button. If the employee forgets, the customer is not notified
- The system has no delivery confirmation: it cannot know if the WhatsApp message was sent or read

---

## ADR-012 — Niimbot B21 Bluetooth Label Printing

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
Each order requires a physical label for tracking. Options considered: generic receipt printer, web printing, dedicated label software, Bluetooth label printer.

### Decision
Use the Niimbot B21 thermal label printer via the Web Bluetooth API in Chrome/Edge. The `@mmote/niimbluelib` library handles the Bluetooth protocol. Labels are rendered as HTML5 canvas elements (`LabelCanvas.jsx`) and encoded to 1-bit bitmaps for transmission.

Label dimensions: 5cm × 3cm (400×240px at 203 DPI).

### Consequences
- Labels print directly from the browser with no server involvement
- No print driver installation required
- Works on any desktop with Chrome/Edge and Bluetooth
- **Constraint:** Web Bluetooth requires HTTPS or localhost, and is only supported in Chrome and Edge. Safari and Firefox are not supported. This is a hard browser requirement for the printing feature
- **Constraint:** The customer label includes the `customer_token` QR code. If the label format changes, existing printed labels still work because the token is stored in the database

---

## ADR-013 — Payment Confirmation Gate Before Delivery

**Status:** Accepted

**Date:** 2026-03-01 (estimated)

### Context
The `returned_to_shop → delivered` transition represents the moment the shop confirms payment has been received and the item has been handed to the customer. Without an explicit payment confirmation step, shop employees could mark orders delivered before collecting payment.

### Decision
Add a `payment_confirmed` boolean column to `orders`. The `returned_to_shop → delivered` transition in `OrderService` throws `PaymentRequiredError` if `payment_confirmed = 0`. A separate endpoint `POST /api/orders/:id/confirm-payment` sets `payment_confirmed = 1` and is restricted to `shop_employee` role.

### Consequences
- Payment collection is enforced by the system before delivery is allowed
- There is an explicit audit record of when payment was confirmed
- **Constraint:** This adds an extra step for the shop employee. It cannot be bypassed by the workshop staff. Only the shop can confirm payment and only the shop can mark delivered
- There is no integration with a payment processor. "Payment confirmed" means the employee has clicked the button, not that an electronic payment was processed

---

## ADR-014 — Documentation-Driven Development

**Status:** Accepted

**Date:** 2026-04-16

### Context
AI-assisted development on a system with complex business rules and a state machine creates a risk of changes that are locally correct but globally inconsistent. Without a governance framework, the documentation drifts from the code, the state machine gets modified without updating invariants, and future contributors (human or AI) make decisions based on stale documentation.

### Decision
Establish a documentation-driven development practice. Five governance documents are created and maintained:
- `CLAUDE_PLAYBOOK.md` — single source of truth for system design
- `PROJECT_GUARDRAILS.md` — safety boundaries
- `CLAUDE_PROTOCOL.md` — AI operating rules
- `CLAUDE_PHASE_PLAN.md` — development roadmap
- `ARCHITECTURE_DECISIONS.md` — this file
- `SYSTEM_INVARIANTS.md` — non-violable truths

Every significant change to the system must update the relevant documents. Documentation is part of the definition of done. Any architecture change must produce a new ADR.

### Consequences
- Future contributors have a complete picture of the system's intent
- AI assistants can verify their changes against documented invariants before committing
- Documentation overhead adds time to each change
- **Constraint:** Documentation must be kept current. Stale documentation is worse than no documentation, because it creates false confidence. The change history section of `CLAUDE_PLAYBOOK.md` is an append-only log

---

## Adding a New ADR

When making an architectural decision, add a new ADR entry using the template at the top of this file. Increment the ADR number sequentially.

An ADR is required when:
- A new library is adopted for a critical system function
- The state machine is changed (new status, new transition, removed transition)
- The authentication or authorization model changes
- The database technology or schema design pattern changes
- A new external integration is added (new notification channel, new printer, new payment provider)
- A previous ADR is reversed or superseded
- A significant trade-off is made that future engineers might question

An ADR is not required for:
- Bug fixes that do not change design
- UI styling changes
- Adding new fields to an existing table (covered by migrations)
- Routine feature additions that follow existing patterns
