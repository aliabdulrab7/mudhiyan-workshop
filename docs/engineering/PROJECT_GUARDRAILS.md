# PROJECT_GUARDRAILS.md

> **Enforcement Level: Mandatory**
> These guardrails apply to all contributors, human or AI.
> A task that violates a guardrail must be stopped. The violation must be explained. A safe alternative must be proposed before proceeding.

---

## 1. Purpose of Guardrails

This document defines the hard safety boundaries of the Mudhiyan Workshop codebase.

The system manages real business operations involving physical goods, customer money, and repair commitments. Mistakes are not merely bugs — they can result in:

- Lost or misrouted jewelry orders
- Incorrect billing or unauthorized repair work
- Data loss from botched migrations
- Security breaches exposing customer phone numbers and order history
- Business disputes caused by missing audit records

These guardrails exist to prevent those outcomes. They are not suggestions. They are constraints.

---

## 2. What AI Is Allowed to Modify

The following areas may be modified freely within the engineering rules defined in `CLAUDE_PLAYBOOK.md`:

| Area | Allowed Operations |
|------|--------------------|
| React components (`client/src/components/`) | Add, edit, refactor UI components |
| React pages (`client/src/pages/`) | Add, edit page layouts and interactions |
| API wrapper layer (`client/src/api/`) | Add or update fetch wrapper functions |
| Express route handlers (`server/routes/`) | Add validation, update response formatting |
| NotificationService | Update message templates and WhatsApp URL builders |
| Helper functions (`server/helpers/`) | Add or update utility functions |
| Tests (`server/tests/`) | Add, update, or fix test cases |
| CSS and Tailwind styles | Modify visual appearance |
| Error messages | Update human-readable strings |
| Comments and documentation | Always allowed |

---

## 3. What AI Must Never Modify Without Confirmation

The following operations require an explicit human instruction and a documented justification before any change is made. If a task implicitly requires one of these changes, the AI must stop and surface the requirement to the human before proceeding.

**3.1 — State Machine Transitions**
Never add, remove, or change an entry in the `TRANSITIONS` registry in `server/services/OrderService.js` without:
- A clear product requirement stating why the workflow must change
- An update to the state machine section of `CLAUDE_PLAYBOOK.md`
- An update to `SYSTEM_INVARIANTS.md` if the invariant is affected
- A new ADR entry in `ARCHITECTURE_DECISIONS.md`

**3.2 — Authentication Middleware**
Never modify `server/middleware/auth.js` without:
- A stated security reason
- Review of every route that depends on it
- Confirmation that all role guards remain intact

**3.3 — Database Schema**
Never add, rename, or remove a column from any table without:
- An idempotent migration block in `db.js`
- A documented reason for the change
- Verification that existing data will not be corrupted

**3.4 — createOrder Transaction**
Never refactor or split the `createOrder` function in `db.js`. It is a single atomic transaction by design. Splitting it would introduce race conditions on order number generation.

**3.5 — Order Locking Logic**
Never modify the `locked_at` check or the logic that sets `locked_at` on delivery without a full security review. This is the primary data integrity guard for completed orders.

**3.6 — JWT Secret Handling**
Never log, expose in responses, or hardcode the `JWT_SECRET`. Never change the JWT signing or verification logic without a full auth review.

**3.7 — Role Assignment Logic**
Never modify the logic in `server/routes/auth.js` that reads `role` and `shop_id` from the database and embeds them in the JWT token.

**3.8 — Public Tracking Endpoints**
The `/api/track/:token` endpoints are intentionally unauthenticated. Never add authentication to them. Never make them return more data than the current schema (no internal notes, no cost breakdowns beyond what the customer needs to approve).

---

## 4. Risky Operations That Require Human Approval

The following operations must not be performed by an AI agent without an explicit, specific human instruction for that exact operation:

- Running `server/seed.js` against any database containing real orders
- Running `DELETE FROM orders` or any bulk delete on production data
- Running `ALTER TABLE` outside of the migration system in `db.js`
- Dropping any table
- Resetting or rotating the JWT secret (invalidates all active sessions)
- Changing the CORS whitelist in `server/app.js`
- Modifying `ecosystem.config.cjs` (PM2 production config)
- Modifying any GitHub Actions workflow file
- Deploying to production
- Modifying `server/db.js` schema definitions (the authoritative schema)
- Removing any test file

---

## 5. Code Areas Considered Critical

These files and modules require the highest level of caution. Any change to them must be reviewed against the full system before being applied.

| File | Why It Is Critical |
|------|-------------------|
| `server/services/OrderService.js` | Controls the entire order lifecycle; all business rules live here |
| `server/db.js` | Database schema, migrations, and the atomic createOrder transaction |
| `server/middleware/auth.js` | Authentication and role enforcement for all protected routes |
| `server/routes/orders.js` | Core API — most business operations pass through here |
| `server/routes/track.js` | Public endpoint — changes affect customer-facing behavior |
| `server/errors/index.js` | Error class definitions affect HTTP status codes system-wide |
| `client/src/api/auth.js` | Token storage and login flow |
| `client/src/components/useLabelPrint.js` | Bluetooth printer integration — breaking it stops physical printing |
| `client/src/components/LabelCanvas.jsx` | Label layout — changes affect physical labels already in circulation |

---

## 6. Database Safety Rules

**6.1** — Never write a raw SQL string containing user input. All user-controlled values must be passed as bound parameters to prepared statements.

**6.2** — Never drop a column or table that may contain historical data. Mark deprecated columns with a comment. Remove them only after confirming zero rows depend on them.

**6.3** — Every schema change must be an idempotent migration that checks for existence before altering. Pattern: check `PRAGMA table_info`, then `ALTER TABLE` only if the column is absent.

**6.4** — The `order_status_history` table is an immutable audit log. There must be no `UPDATE` or `DELETE` operations against it ever. Records are inserted once and never modified.

**6.5** — The `orders.order_number` column is unique and externally visible (printed on labels). Once assigned, it must never change.

**6.6** — The `orders.customer_token` column is a public-facing UUID. Once assigned, it must never change. Changing it would break QR codes already printed and in customers' hands.

**6.7** — Never bypass the `createOrder` transaction to insert an order. The transaction enforces sequential order number generation per shop per day. Bypassing it creates duplicate or invalid order numbers.

---

## 7. State Machine Protection

The state machine in `OrderService.js` is the authoritative controller of all order status changes.

**7.1** — No code outside `OrderService.js` may execute `UPDATE orders SET status = ...`. This includes routes, helpers, test fixtures that manipulate production paths, and any new service. The only exception is `seed.js` for test data setup.

**7.2** — Every call to `OrderService.transition()` will write an entry to `order_status_history`. This is non-negotiable. If an audit write fails, the entire transition must roll back.

**7.3** — The TRANSITIONS registry defines which status moves are legal. If a new feature requires a new status or a new transition path, the registry must be updated first, and the playbook must be updated before any code change.

**7.4** — Backwards transitions are forbidden by the TRANSITIONS registry with one exception: `quality_check → in_repair` (rework path). No other backwards transitions may be added without an ADR.

**7.5** — The `delivered` status is terminal for shop operations. Once an order reaches `delivered`, `locked_at` is set and no writes are permitted. This cannot be relaxed.

---

## 8. Production Safety Rules

**8.1** — The server must fail to start in production if `JWT_SECRET` equals the default development value `"dev-secret-change-in-production"`.

**8.2** — No debugging output, `console.log` calls, or stack traces may be returned in HTTP responses when `NODE_ENV === 'production'`.

**8.3** — The database file (`server/data/workshop.db`) must be backed up before any deployment. Deployments that skip backup are not permitted.

**8.4** — CORS must not be set to `*` (wildcard) under any circumstances. Origins are explicitly whitelisted.

**8.5** — All production secrets (`JWT_SECRET`, database credentials if migrated to a server DB) must be stored in environment variables or a secrets manager. Never in source code.

**8.6** — The production Nginx configuration must enforce HTTPS redirection. HTTP access to the application must redirect to HTTPS.

---

## Guardrail Violation Protocol

When a requested task would violate any guardrail in this document, the AI must:

1. **Stop** — do not implement the change
2. **Identify** — state exactly which guardrail is being violated and why
3. **Explain** — describe what harm could result from proceeding
4. **Propose** — offer a safe alternative approach that achieves the goal without violating the guardrail
5. **Await confirmation** — do not proceed until the human explicitly acknowledges the risk and approves

Example response when a guardrail is triggered:

> **Guardrail violation detected — Section 3.1 (State Machine Transitions)**
>
> The requested change would remove the `waiting_approval → rejected` transition from the TRANSITIONS registry. This would break the customer rejection flow: customers who reject a cost estimate via the QR code would be stuck with no valid next state.
>
> Before this can proceed, the following must be completed:
> - A product decision confirming the rejection flow is being removed
> - An update to CLAUDE_PLAYBOOK.md removing the rejection workflow
> - An ADR entry documenting the decision
>
> Would you like to proceed with those steps, or reconsider the approach?
