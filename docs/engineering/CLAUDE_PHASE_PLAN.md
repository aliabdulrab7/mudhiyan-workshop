# CLAUDE_PHASE_PLAN.md

> **This document is the structured improvement roadmap for the Mudhiyan Workshop system.**
> Each phase builds on the previous. No phase may begin until its predecessor is validated.
> This document is updated as phases complete or requirements change.

---

## Project Status Summary

**As of 2026-04-16:**

The core system is production-capable. The following are operational:

- Full order lifecycle (new → closed) via a strict state machine
- Role-based access (workshop / shop_employee)
- Customer QR code tracking and cost approval
- Niimbot B21 Bluetooth label printing
- WhatsApp notification URL generation
- Multi-item orders with per-item cost tracking
- Audit trail for all status transitions
- JWT authentication
- Shop isolation (employees see only their shop's orders)
- Public customer tracking page
- Payment confirmation gate before delivery
- Order locking after delivery
- GitHub Actions CI/CD with daily database backup
- Integration test suite (Jest + Supertest)

**Known gaps that the phase plan addresses:**

- No server startup guard on missing `JWT_SECRET` in production
- Rate limiting is not implemented
- No input sanitization library
- Some routes do not fully validate all edge cases
- UI does not consistently hide all write actions on locked orders
- Performance under high order volume is untested
- No structured logging
- No monitoring or alerting

---

## Development Philosophy

**Phases are sequential.** Stability before features. Security before optimization. Correctness before performance.

**Each phase has a clear exit condition.** A phase is complete only when all its validation steps pass. Moving to the next phase without completing validation is not allowed.

**No phase introduces regressions.** Before any phase begins, run the full test suite. All tests must pass. After the phase completes, all tests must still pass.

**Documentation is part of every phase.** No phase is complete until the affected documentation has been updated.

**Small, reviewable changes.** Each task within a phase should produce a single logical change that can be understood and reviewed independently.

---

## Phase Structure

| Phase | Name                     | Focus                               | Status   |
|-------|--------------------------|-------------------------------------|----------|
| 1     | System Stabilization     | Correctness, gaps, guardrails       | Current  |
| 2     | Data Consistency         | Validation, integrity, audit        | Planned  |
| 3     | API Hardening            | Input validation, error contracts   | Planned  |
| 4     | UI Refinement            | Role enforcement, mobile, UX        | Planned  |
| 5     | Performance Optimization | Queries, load testing, indexing     | Planned  |
| 6     | Security Hardening       | Rate limiting, logging, pen testing | Planned  |
| 7     | Scalability              | Multi-process, migration readiness  | Planned  |

---

## Phase 1 — System Stabilization

### Objective
Ensure the existing system is correct, documented, and safe to develop against. Close known gaps before building new features.

### Scope
Backend logic, startup behavior, and existing route coverage. No new features.

### Tasks

**1.1 — Production startup guard**
Add a check in `server/index.js` that reads `JWT_SECRET` and refuses to start if `NODE_ENV === 'production'` and the secret equals `"dev-secret-change-in-production"`. Exit with a clear error message.

**1.2 — Locked order enforcement audit**
Review every `PUT` and `PATCH` endpoint in `server/routes/orders.js`. Confirm every one checks `order.locked_at` before proceeding. Add the check to any endpoint that is missing it.

**1.3 — Route barcode ordering test**
Add an integration test that confirms `GET /api/orders/barcode/BR1-20260416-0001` does not resolve to the `/:id` route handler.

**1.4 — Status enum validation**
Ensure the `status` query parameter in `GET /api/orders` is validated against the full allowed enum before being used in a SQL query. Add a test for an invalid status value.

**1.5 — Missing role guard audit**
Review every route in every router file. Confirm `requireAuth` and the appropriate `requireRole` are applied. Document any gap found and fix it.

**1.6 — Governance documents**
Create and commit `PROJECT_GUARDRAILS.md`, `CLAUDE_PROTOCOL.md`, `CLAUDE_PHASE_PLAN.md`, `ARCHITECTURE_DECISIONS.md`, and `SYSTEM_INVARIANTS.md`. (This task — in progress.)

**1.7 — CLAUDE_PLAYBOOK.md completeness review**
Read the playbook against the actual codebase. Identify any section that does not reflect current code. Update discrepancies.

### Risks
- The locked order audit may discover endpoints that have never enforced locking. Fixing them may affect UI flows that currently rely on the gap. Test after fixing.
- The startup guard may cause CI environments to fail if they do not set `JWT_SECRET`. Update CI workflow if needed.

### Validation Steps
- [ ] Server refuses to start in production with default JWT_SECRET
- [ ] All endpoints that modify orders reject writes when `locked_at` is set
- [ ] All routes have `requireAuth` applied
- [ ] All routes that need role restriction have `requireRole` applied
- [ ] `GET /api/orders?status=INVALID` returns 400
- [ ] Full test suite passes with no regressions
- [ ] All five governance documents exist and are committed

---

## Phase 2 — Data Consistency

### Objective
Ensure that all data entering the system is structurally valid before it reaches the database. Prevent bad data from silently persisting.

### Scope
Input validation on all write endpoints. Database constraint review. Phone number normalization.

### Tasks

**2.1 — Phone number normalization**
Standardize phone storage as `966XXXXXXXXX` (no `+`, no spaces, no dashes). Add a normalization function in a shared helper. Apply it in `POST /api/orders` and `PUT /api/orders/:id`. Add a test for phone input variants.

**2.2 — Cost validation**
Enforce that cost values are non-negative integers. Add validation to `PATCH /api/orders/:id/cost` and `POST /api/orders/:orderId/items/:itemId/cost`. Return 400 for negative or non-numeric values.

**2.3 — Required field validation for order creation**
In `POST /api/orders`, validate: `customer_name` is present and non-empty, `phone` matches the expected format, `items` is a non-empty array, each item has a non-empty `item_name`. Return 400 with a specific message for each missing field.

**2.4 — customer_token uniqueness guarantee**
Confirm the `customer_token` column has a UNIQUE constraint in the database. If not, add it via a migration. Add a test that confirms two orders cannot have the same token.

**2.5 — order_number uniqueness guarantee**
Confirm the `order_number` column has a UNIQUE constraint. Add a test that covers the concurrent creation scenario (two orders for the same shop on the same day).

**2.6 — Orphaned item_cost audit**
Add a `refreshOrderCost` call to `PATCH /api/orders/:id/cost` if not already present, to keep `orders.cost` in sync with the sum of item costs. Add a test that confirms `orders.cost` equals the sum of `order_items.final_cost` after any cost update.

### Risks
- Phone normalization may affect existing records stored in different formats. Run a one-time migration to normalize existing data.
- Adding UNIQUE constraints via migration may fail if duplicate data already exists. Check first with a query.

### Validation Steps
- [ ] Phone numbers stored in DB are always `966XXXXXXXXX` format
- [ ] Orders with empty `customer_name` are rejected at the API
- [ ] Orders with empty `items` array are rejected at the API
- [ ] `PATCH /api/orders/:id/cost` with negative value returns 400
- [ ] `orders.cost` equals sum of item costs after update
- [ ] `customer_token` UNIQUE constraint exists in schema
- [ ] Full test suite passes

---

## Phase 3 — API Hardening

### Objective
Standardize error responses, tighten input handling, and make the API contract predictable and explicit for all consumers.

### Scope
Route error handling, response format consistency, HTTP status code correctness.

### Tasks

**3.1 — Consistent error response format**
Audit all routes for consistency of the `{ error: "message" }` response format. Any route returning a plain string, an object without the `error` key, or an HTML error page must be corrected.

**3.2 — Global error handler**
Add a global Express error handler in `server/app.js` that catches any unhandled error, maps it via `errorToHttpStatus(err)`, and returns a consistent JSON response. No stack traces in production mode.

**3.3 — HTTP status code audit**
Review all routes against the status code table in `CLAUDE_PLAYBOOK.md`. Correct any route returning 200 for a creation (should be 201), 500 for a business rule violation (should be 422), or 400 for a permission error (should be 403).

**3.4 — Pagination contract**
Ensure all list endpoints return `{ success: true, data: [...], total: N }`. The `total` field must be the count of all matching records before pagination, not the count of returned records.

**3.5 — 404 for unknown resources**
Confirm that `GET /api/orders/:id` for a non-existent id returns 404, not 200 with null data or 500. Apply the same check to all single-resource endpoints.

**3.6 — Transition error clarity**
When `OrderService.transition()` throws an `InvalidTransitionError`, the HTTP response must clearly state the current status and the attempted status. Example: `"Cannot transition from 'in_repair' to 'delivered'"`.

**3.7 — Rate limiting on auth endpoint**
Add `express-rate-limit` to `POST /api/auth/login`. Limit to 10 attempts per 15-minute window per IP. Return 429 with a clear message on breach.

**3.8 — Rate limiting on track endpoints**
Apply a separate, more lenient rate limit to `GET /api/track/:token` and `POST /api/track/:token/approve|reject` (public endpoints). Limit to 60 requests per minute per IP.

### Risks
- The global error handler change may suppress errors that are currently visible in logs. Ensure structured logging is added simultaneously so nothing is silently swallowed.

### Validation Steps
- [ ] All error responses use `{ error: "..." }` format
- [ ] No stack traces returned in `NODE_ENV=production`
- [ ] List endpoints return `total` as count of all matching records
- [ ] Unknown order IDs return 404
- [ ] Invalid transitions return 409 with current and target status
- [ ] `POST /api/auth/login` rate-limited at 10/15min
- [ ] Full test suite passes

---

## Phase 4 — UI Refinement

### Objective
Enforce role-based rendering consistently, improve mobile experience, and close UX gaps that affect daily operations.

### Scope
React components, responsive layout, role-based visibility, locked order UI.

### Tasks

**4.1 — Locked order UI audit**
Review `OrderDetail.jsx` and `ScanResult.jsx`. Confirm that when `order.locked_at` is set, all action buttons (status transitions, cost entry, edit fields) are absent from the DOM. Fix any component that renders disabled buttons instead of hiding them.

**4.2 — Role button visibility audit**
Review the action panel in `OrderDetail.jsx`. For each button, confirm it is conditionally rendered only for the role that can use it. The table in `CLAUDE_PLAYBOOK.md` section 8 is the reference. Fix any button visible to the wrong role.

**4.3 — Status badge completeness**
Confirm `StatusBadge.jsx` has a defined color for every status in the state machine. Any unrecognized status must render a clearly visible fallback (e.g., gray with the raw status value) rather than silently showing nothing.

**4.4 — Mobile action panel**
Test the order detail action panel at 375px width. Confirm buttons are tap-sized (minimum 44px height), labels are legible, and no button is clipped or off-screen.

**4.5 — WhatsApp button behavior**
Confirm all `wa.me` links use `target="_blank" rel="noopener noreferrer"`. Add a visual indicator (arrow icon) that the link opens externally. Confirm the link does not navigate away from the current page.

**4.6 — Empty state for order list**
When `GET /api/orders` returns an empty array (no matching orders), render a meaningful empty state in `OrderList.jsx` rather than a blank area or broken layout.

**4.7 — Form validation feedback**
In `OrderForm.jsx`, add inline validation messages for empty required fields before submission. The form must not submit if `customer_name`, `phone`, or at least one `item_name` is empty.

**4.8 — Toast for all error states**
Every API call in the frontend that can fail must show a toast notification on failure. Review all `catch` blocks in components. Confirm no error is silently swallowed.

### Risks
- The locked order UI change may reveal that some flows rely on reading data from the disabled form fields. Audit the read path before removing the inputs.

### Validation Steps
- [ ] No action buttons visible on locked orders
- [ ] No action buttons visible to the wrong role
- [ ] StatusBadge renders all 12 statuses with correct colors
- [ ] All action buttons are tap-sized on 375px viewport
- [ ] All WhatsApp links open in new tab
- [ ] Empty order list renders a clear empty state
- [ ] OrderForm blocks submission on missing required fields
- [ ] All API errors show a toast notification

---

## Phase 5 — Performance Optimization

### Objective
Ensure the system performs acceptably under realistic production load. Identify and resolve slow queries and unnecessary re-renders.

### Scope
Database query patterns, index coverage, API response times, frontend re-render frequency.

### Tasks

**5.1 — Query audit with EXPLAIN QUERY PLAN**
For each query in `server/routes/orders.js`, run `EXPLAIN QUERY PLAN` on a database with 10,000+ order rows. Identify any full table scan. Add indexes as needed.

**5.2 — Audit index coverage**
Verify the following indexes exist in `db.js` and are being used by the query planner:
- `idx_orders_shop_status` on `(shop_id, status)`
- `idx_orders_status` on `(status)`
- `idx_orders_customer_token` on `(customer_token)`
- `idx_orders_order_number` on `(order_number)`
- `idx_history_order_id` on `order_status_history(order_id)`

**5.3 — N+1 query check**
Review `GET /api/orders` and `GET /api/orders/:id`. Confirm that order items, history, and comments are fetched in a fixed number of queries, not one query per item. Use `JOIN` or batch queries where applicable.

**5.4 — Pagination enforcement**
Confirm all list endpoints enforce a maximum `limit` of 500. Confirm that uncontrolled queries that could return all rows (e.g., stats queries) use `COUNT(*)` rather than fetching all rows into memory.

**5.5 — Frontend memo audit**
Review components that re-render on every dashboard poll (every 5–10 seconds). Apply `React.memo`, `useMemo`, or `useCallback` where a re-render is unnecessary. Do not apply these blindly — profile first.

**5.6 — Dashboard poll optimization**
Review `useApprovalNotifications.js`. Confirm it does not re-fetch the full order list on every poll. It should fetch only a count or a minimal payload.

**5.7 — Load test**
With 10,000 orders in the database, run a load test against:
- `GET /api/orders?status=in_repair` — target: < 200ms p95
- `POST /api/orders` — target: < 500ms p95
- `PATCH /api/orders/:id/status` — target: < 300ms p95

Document results. Fix any endpoint that does not meet the target.

### Risks
- Index additions require testing that they do not slow down write paths on large tables.
- Frontend memo changes can introduce stale-closure bugs if dependencies are incorrect.

### Validation Steps
- [ ] No full table scans on common queries with 10,000+ rows
- [ ] All five required indexes present and used by query planner
- [ ] `GET /api/orders/:id` fetches items in a single additional query
- [ ] All list endpoints enforce maximum page size
- [ ] Load test targets met for the three key endpoints
- [ ] Full test suite passes

---

## Phase 6 — Security Hardening

### Objective
Reduce the attack surface. Implement defense-in-depth for the most sensitive operations. Prepare the system for external exposure.

### Scope
Input sanitization, security headers, structured logging, dependency audit.

### Tasks

**6.1 — Security headers**
Add `helmet` to `server/app.js`. Enable CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy. Confirm CSP allows the Almarai Google Font CDN and the `wa.me` link target.

**6.2 — Input sanitization**
Add `validator.js` or equivalent. Sanitize `customer_name`, `notes`, and `workshop_comment` fields to strip HTML. Confirm no user-controlled string is rendered as raw HTML in the frontend (`dangerouslySetInnerHTML` must be absent).

**6.3 — JWT expiry and refresh review**
The current 7-day expiry has no refresh mechanism. Document the trade-off. If a shorter expiry is desired, implement a refresh endpoint. At minimum, add a client-side expiry check on page load that redirects to login if the token is expired.

**6.4 — Structured logging**
Add `pino` or equivalent structured logger. Log: every status transition (order_id, from, to, user, timestamp), every auth failure (ip, username, timestamp), every 4xx/5xx response. Logs must be JSON-formatted for production and human-readable for development.

**6.5 — Dependency vulnerability audit**
Run `npm audit` in both `server/` and `client/`. Fix or document any high-severity vulnerabilities. Add a `npm audit` step to the CI workflow to catch new vulnerabilities on each push.

**6.6 — SQL injection review**
Audit all SQL in `server/db.js` and `server/routes/`. Confirm every user-controlled value is passed as a bound parameter. There must be no string interpolation in SQL queries.

**6.7 — CORS configuration review**
Confirm the CORS whitelist in `server/app.js` does not allow unintended origins. The `192.168.x.x` LAN subnet pattern should be narrowed to the specific subnet in use if possible.

**6.8 — Secrets audit**
Scan the repository for accidentally committed secrets using `git log -p | grep -E "(JWT_SECRET|password|secret)"`. Document findings. Add a pre-commit hook that blocks commits containing common secret patterns.

### Risks
- CSP headers may break Google Fonts or the Web Bluetooth API in some browser configurations. Test in Chrome/Edge after applying.
- Structured logging changes must not log sensitive data (JWT tokens, password hashes, full customer phone numbers in non-production environments).

### Validation Steps
- [ ] `helmet` applied with CSP; fonts and links still work
- [ ] No `dangerouslySetInnerHTML` in the codebase
- [ ] `npm audit` returns zero high-severity findings
- [ ] All SQL uses bound parameters (no interpolation)
- [ ] Structured logs appear on every status transition
- [ ] Auth failures are logged with IP and username
- [ ] No secrets in git history

---

## Phase 7 — Scalability

### Objective
Prepare the system to handle growth: more shops, more orders per day, and potential migration off SQLite to a server-side database.

### Scope
Architecture review, database migration readiness, multi-process safety.

### Tasks

**7.1 — SQLite WAL mode confirmation**
Confirm WAL mode is enabled and functioning. Run a concurrent read/write test. Document the maximum concurrent write throughput.

**7.2 — Database abstraction layer design**
Evaluate whether a thin abstraction layer over the database calls (currently bare `better-sqlite3` statements in routes and `db.js`) would make a future migration to PostgreSQL tractable. If yes, define the interface and create an ADR. Do not implement prematurely — only if the migration path is confirmed.

**7.3 — createOrder concurrency test**
Write a test that fires 10 concurrent `POST /api/orders` requests for the same shop on the same day. Confirm no two orders receive the same `order_number`. This test documents and validates the atomic transaction.

**7.4 — Shop scaling review**
Confirm that adding a new shop (new row in `shops`, new `shop_employee` user) requires no code change. Document the operational procedure for onboarding a new shop.

**7.5 — Order archive strategy**
Design a strategy for archiving `closed` orders older than 12 months to prevent indefinite growth of the active orders table. Document the strategy. Do not implement until the business requires it.

**7.6 — Backup and recovery test**
Run a full restore from the GitHub Actions backup artifact. Confirm the restored database is functional. Document the recovery procedure in `DEPLOYMENT_AWS.md`.

**7.7 — Multi-region readiness assessment**
Assess what would be required to run the system in a second AWS region for redundancy. Document findings. This is an assessment only — no implementation.

### Risks
- SQLite does not support multiple writer processes. If the application is ever scaled to multiple EC2 instances, a migration to PostgreSQL or another client-server database is required. This must be an explicit decision (ADR) before it is attempted.

### Validation Steps
- [ ] 10 concurrent createOrder calls produce 10 unique order numbers
- [ ] Adding a new shop requires no code change
- [ ] Full restore from backup completes successfully
- [ ] Recovery procedure documented
- [ ] WAL mode confirmed and concurrent read/write test passing
- [ ] SQLite-to-PostgreSQL migration assessment documented if relevant
