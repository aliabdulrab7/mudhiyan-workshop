# Phase 10 — Performance Optimization

> ⚠️ Do not proceed until Phase 9 is fully completed and validated.
> ⚠️ Profile before optimizing. Do not apply React.memo or useMemo blindly.
> ⚠️ Index additions must be tested against write performance on large tables.

---

## Purpose

Ensure the system performs acceptably under realistic production load.
Identify and resolve slow queries and unnecessary re-renders before the order volume grows.

This phase is data-driven: every change must be backed by a measurement (EXPLAIN QUERY PLAN, timer, or load test result).

---

## Status: Planned

---

## Issues Identified (Diagnosis 2026-04-16)

| ID | Severity | Description |
|----|----------|-------------|
| H2 | High | Missing composite index `idx_orders_shop_status ON orders(shop_id, status)` — most common query pattern has no compound index |

---

## Tasks

### 10.1 — Add Missing Composite Index

Add the critical composite index that was identified in the diagnosis:

```js
// server/db.js — add to the index section
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);
  CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
`);
```

Note: `idx_orders_order_number` may already exist implicitly via the UNIQUE constraint. Check before adding.

The documented required indexes (from playbook section 6) and their current state:

| Documented Name | Actual Name in db.js | Status |
|----------------|---------------------|--------|
| `idx_orders_shop_status` | — | ❌ Missing |
| `idx_orders_status` | `idx_status` | ✅ Exists (different name) |
| `idx_orders_customer_token` | `idx_cust_tok` (partial) | ✅ Exists |
| `idx_orders_order_number` | via UNIQUE constraint | ✅ Implicit |
| `idx_history_order_id` | `idx_status_hist` | ✅ Exists |

### 10.2 — Query Audit with EXPLAIN QUERY PLAN

For each major query in `server/routes/orders.js`, run `EXPLAIN QUERY PLAN` on a database with 10,000+ order rows.

Queries to audit:
1. `GET /api/orders` (list with filters)
2. `GET /api/orders/:id`
3. `GET /api/orders/stats`
4. `GET /api/orders/branch-stats`
5. `PATCH /api/orders/:id/status` (the pre-check SELECT)
6. `GET /api/orders/:id/history`

For each, verify the output shows `SEARCH` (index scan), not `SCAN` (full table scan).

Document results in this file under a "Query Audit Results" section.

### 10.3 — N+1 Query Check

Review `GET /api/orders` and `GET /api/orders/:id`:

**Current behavior:**
- `GET /api/orders` uses a subquery `GROUP_CONCAT` for `items_summary` — this is a single query ✅
- `GET /api/orders/:id` runs 2 queries: order + items — acceptable ✅
- `GET /api/orders/:id/history` is a separate endpoint — acceptable ✅

Check `GET /api/order-items/:id` routes — confirm no query-per-technician or query-per-photo patterns.

If N+1 patterns are found, resolve with `JOIN` or batch queries. Document the fix.

### 10.4 — Pagination Enforcement

Confirm all list endpoints enforce a maximum `limit` of 500:

- `GET /api/orders` — clamps at 500 ✅ (line 99 in orders.js)
- `GET /api/customers` — review
- `GET /api/technicians` — review
- `GET /api/services` — review
- `GET /api/inventory` — review

Add clamping to any list endpoint that is missing it.

Confirm that stats queries (`COUNT(*)`) do not load all rows into memory — they must use SQL aggregates, not in-process array counting.

### 10.5 — Frontend Poll Optimization

Review `useApprovalNotifications.js` or equivalent dashboard polling hook:

- Confirm it does not re-fetch the full order list on every poll
- It should fetch only a count or a minimal payload (e.g., `GET /api/orders/stats`)
- Poll interval should be no more frequent than every 10 seconds

If the dashboard polls the full order list every few seconds, replace with a stats-only poll.

### 10.6 — React Component Memo Audit

Identify components that re-render on every dashboard poll unnecessarily:

Profile target components:
- `OrderList.jsx` — re-renders on every order list refresh
- `StatusBadge.jsx` — pure component, apply `React.memo`
- `Dashboard.jsx` — check what triggers re-renders

Apply `React.memo` only to components that:
1. Receive the same props across renders
2. Are confirmed to re-render unnecessarily by profiling

Do not apply `React.memo` blindly — incorrect dependency arrays cause stale-closure bugs.

### 10.7 — Load Test

With 10,000 orders in the database (use the seed script), run a load test against:

| Endpoint | Method | Target p95 |
|----------|--------|-----------|
| `GET /api/orders?status=in_repair` | GET | < 200ms |
| `POST /api/orders` | POST | < 500ms |
| `PATCH /api/orders/:id/status` | PATCH | < 300ms |

**Tool:** `autocannon`, `k6`, or `wrk`

Document actual p95 results. Fix any endpoint that does not meet the target.

---

## Implementation Checklist

### Indexes
- [ ] 10.1 — `idx_orders_shop_status` index added to `db.js`
- [ ] 10.1 — All five required indexes confirmed present and named

### Query Analysis
- [ ] 10.2 — EXPLAIN QUERY PLAN run on all 6 major queries
- [ ] 10.2 — No full table scans on common queries with 10,000+ rows
- [ ] Results documented below

### N+1
- [ ] 10.3 — `GET /api/orders` confirmed: no N+1 patterns
- [ ] 10.3 — `GET /api/orders/:id` confirmed: items fetched in fixed number of queries

### Pagination
- [ ] 10.4 — All list endpoints enforce max page size of 500
- [ ] 10.4 — Stats queries use SQL aggregates, not in-process counting

### Frontend
- [ ] 10.5 — Dashboard polling fetches minimal payload (stats only)
- [ ] 10.6 — `React.memo` applied where verified beneficial
- [ ] 10.6 — No stale-closure bugs introduced

### Load Test
- [ ] 10.7 — Load test run with 10,000 orders
- [ ] 10.7 — All three endpoints meet p95 targets

---

## Query Audit Results

_Fill in after running EXPLAIN QUERY PLAN:_

| Query | Plan | Notes |
|-------|------|-------|
| `GET /api/orders` (shop filter + status) | — | — |
| `GET /api/orders/:id` | — | — |
| `GET /api/orders/stats` | — | — |
| `GET /api/orders/branch-stats` | — | — |
| `GET /api/orders/:id/history` | — | — |

---

## Validation Steps (Phase Exit Criteria)

- [ ] No full table scans on common queries with 10,000+ rows
- [ ] All five required indexes present and used by query planner
- [ ] `GET /api/orders/:id` fetches items in a single additional query
- [ ] All list endpoints enforce maximum page size
- [ ] Dashboard poll payload ≤ stats summary (not full order list)
- [ ] Load test p95 targets met for all three key endpoints
- [ ] Full test suite passes with no regressions

---

## Risks

- The composite index (10.1) may slightly slow down `INSERT` and `UPDATE` operations on the `orders` table. Measure write performance before and after on a large dataset.
- React `memo` and `useCallback` changes can introduce stale-closure bugs if dependency arrays are incorrect. Profile first, apply cautiously, test thoroughly.
- Load testing with 10,000 rows requires running the seed script against a temporary database. Never run against production data.
