# Instrumentation Audit — Mudhiyan Workshop

**Generated:** 2026-05-04  
**Phase:** Analytics Plan Phase 1  
**Purpose:** Document exactly what data the system currently captures, where the gaps are, and which gaps matter for the four analytics goals.

---

## Analytics Goals (reference)

| ID | Goal | Key Questions |
|----|------|--------------|
| G1 | Bottleneck identification | Which status stages hold orders longest? Where is the queue deepest? |
| G2 | Tech performance | Items/time per tech, completion rates, reassignment rates |
| G3 | Workload forecasting | Intake patterns by day, time, branch |
| G4 | Branch / customer behavior | Urgency mix, rejection rates, customer engagement |

---

## 1. Schema Snapshot

### Tables relevant to analytics

| Table | Purpose | Analytics Relevance |
|-------|---------|-------------------|
| `orders` | Core order record | G1 G3 G4 — status, created_at, shop_id, is_urgent |
| `order_items` | Per-item details | G2 — item_type, priority, estimated_cost, approval_status |
| `order_status_history` | Order-level audit log | G1 G4 — every status transition with timestamp |
| `order_item_technicians` | Current tech assignment | G2 — assigned_at, completed_at (**never written**) |
| `technicians` | Technician roster | G2 — status, active |
| `technician_status_log` | Tech status changes | G2 — full audit with changed_by (user_id), reason |
| `technician_shifts` | Weekly schedule | G2 — used by scheduler |
| `technician_leaves` | Leave records | G2 — leave_type per date |
| `shops` | Branch registry | G4 — no operational metadata yet |
| `customers` | Optional customer record | G4 — linked via orders.customer_id (nullable) |
| `assignment_history` | **DOES NOT EXIST** | G2 — forward-compat stub in autoAssign, never created |

### Tables not relevant to analytics

`user_settings`, `item_photos`, `order_comments`, `services`, `order_item_services`, `inventory_items`, `repair_parts_used`, `item_locations`, `repair_options`, `item_type_spec_map`, `roles`, `specializations`, `technician_specializations`

---

## 2. What Is Captured Well

### Order-level state transitions (G1 ✓)

`order_status_history` records every transition through `OrderService.transition()`.

**Confirmed columns:** `order_id`, `from_status`, `to_status`, `changed_by` (TEXT username), `notes`, `created_at`

**What this gives us:**
- Time-in-state: subtract consecutive rows per order → dwell time per stage
- Queue depth: count orders in each `to_status` at any point in time
- Transition frequency: group by `from_status → to_status`

All transitions are atomic (audit log written before status update). No transitions bypass the service layer.

### Technician status history (G2 ✓)

`technician_status_log` (added WF-3) records every status change.

**Columns:** `technician_id`, `from_status`, `to_status`, `changed_by` (INTEGER user_id FK, nullable), `reason`, `changed_at`

**Indexes:** on `technician_id`, on `changed_at`, on `(changed_at, to_status)`

This is the richest audit table in the system. It captures scheduler-driven changes, manual overrides, and reason text — all three together.

### Intake signal (G3 ✓)

`orders.created_at` + `orders.shop_id` → intake volume by branch, by day. No gaps here.

`orders.is_urgent` → urgency mix per branch, per period.

### Assignment timestamps (G2, partial)

`order_item_technicians.assigned_at` is always written on assignment. Provides "when was this item assigned" for every current assignment.

---

## 3. Gaps — Critical

### GAP-1: `assignment_history` table does not exist

**Impact:** G2 (high)

Every reassignment overwrites the previous row in `order_item_technicians` with no trace. You cannot tell:
- How many times an item was reassigned before completion
- Whether the assignment was manual, auto, or bulk
- Who made each assignment decision

`TechnicianService.autoAssign()` already contains forward-compatible code that will write `assignment_method='auto'` when the table exists — it silently skips today.

**Required:** Create the table. Extend manual assignment routes to also write a row.

**Priority:** Must-have for G2.

---

### GAP-2: `order_item_technicians.completed_at` is never written

**Impact:** G2 (high)

The column exists in the schema (`completed_at TEXT DEFAULT NULL`) but no route, service, or background job ever sets it. It is a ghost column.

Without a completion event, you cannot measure:
- Time-on-item per technician
- Per-tech turnaround (you can only proxy it via order-level status transitions, which conflate all items and all idle time)

**Required:** Either (a) write `completed_at` on an explicit "mark complete" action, or (b) replace with `item_status_history` table (per Phase 2 Group C). Option (b) is more flexible.

**Priority:** Must-have for G2.

---

### GAP-3: No customer engagement logging on `GET /api/track/:token`

**Impact:** G4 (medium)

The track endpoint is read-only with zero DB writes. You cannot know:
- What % of customers open the approval link
- How quickly they act after receiving it
- Whether they viewed but did not decide (abandoned approval)

**Required:** Create `track_visits` table; log one row per GET (customer_token, visited_at, user_agent_class bucket).

**Privacy constraint:** Store only bucketed user-agent class (`mobile_safari`, `mobile_chrome`, `desktop`, `other`). No IPs. No full user-agents.

**Priority:** Nice-to-have for G4. Low implementation cost (~1 hour).

---

### GAP-4: No `branch_id` / `shop_id` on `order_status_history`

**Impact:** G1 G4 (low–medium)

Branch context is on `orders.shop_id`, not replicated into history rows. Branch-scoped bottleneck queries require a JOIN through `orders`.

This is not a blocking gap — the JOIN is cheap for SQLite at current data volumes. Denormalize only if query performance becomes a problem.

**Required:** Add `(changed_at, to_status)` index (already specified in Phase 2 Group A) to make time-range bottleneck queries fast without the branch denormalization.

**Priority:** Index is must-have. Column denormalization is optional/deferred.

---

### GAP-5: `order_status_history.changed_by` is TEXT, not a user_id FK

**Impact:** G1 (low)

`changed_by` stores the username string (or synthetic labels like `'customer_qr'`, `'system_backfill'`). This allows synthetic actors but breaks foreign-key joins.

Querying "who transitions orders most often" requires string matching on `users.username` rather than an integer FK join. At current data volume, this is not a performance problem. If the username ever changes (which it currently cannot via the UI), history rows would become orphaned.

**Required:** No schema change needed now. Document the join pattern: `JOIN users ON users.username = order_status_history.changed_by`. A future analytics view can abstract this.

**Priority:** Low / informational.

---

### GAP-6: No `transition_reason` column on `order_status_history`

**Impact:** G1 (low)

The `notes` column carries contextual reason text for some transitions (send-for-approval, customer decisions, bulk-scan). But it's unstructured, mixed with human notes, and not queryable as a fact.

Phase 2 Group A calls for a `transition_reason TEXT NULL` column. The value of this depends on whether the UI ever provides a reason prompt — currently it does not for most transitions.

**Required per Phase 2 Group A:** Add the column. Don't build the prompt UI unless there are specific transitions where reason is worth capturing (reassignment is more valuable — see Group B).

**Priority:** Low for G1. Do not block Phase 2 on this.

---

### GAP-7: No branch operational metadata

**Impact:** G4 (medium)

`shops` table has only `id`, `name`, `created_at`. No flags for branch type (`intake_only`, `full_service`, `walk_in_only`).

Without this, branch-level analytics cannot segment "branch X gets more rejections because it's an intake-only branch that processes complex multi-item orders" vs. "branch X gets more rejections because its staff under-prices repairs."

**Required:** `ALTER TABLE shops ADD COLUMN type TEXT DEFAULT 'full_service'` + two boolean flags. Low effort.

**Priority:** Nice-to-have for G4. Do not block Phase 2 on this.

---

## 4. Cross-Reference: Goals vs. Data

| Goal | Available Today | Missing / Needed |
|------|----------------|-----------------|
| **G1 Bottleneck** | `order_status_history` → dwell time per stage ✓ | Index on `(changed_at, to_status)` (GAP-4) |
| **G2 Tech perf** | `technician_status_log` ✓ | `assignment_history` table (GAP-1), item completion event (GAP-2) |
| **G3 Forecasting** | `orders.created_at` + `shop_id` ✓ | Nothing blocking — data exists |
| **G4 Branch/customer** | `orders.shop_id` + `is_urgent` + `approval_status` ✓ | Customer engagement logging (GAP-3), branch metadata (GAP-7) |

**G1 and G3 can be meaningfully queried today.** G2 needs GAP-1 and GAP-2 resolved before per-tech analytics have integrity. G4 is partially queryable (urgency mix, rejection rates) but customer engagement and branch segmentation need the two smaller gaps filled.

---

## 5. Phase 2 Work Order

Ordered by priority. Each group is one commit.

### Group A — order_status_history hardening (2 hrs)
- Add index: `CREATE INDEX IF NOT EXISTS idx_status_hist_at_status ON order_status_history(changed_at, to_status)`
- Add column: `ALTER TABLE order_status_history ADD COLUMN transition_reason TEXT NULL` (guarded by `columnExists()`)
- Add column: `ALTER TABLE order_status_history ADD COLUMN branch_id INTEGER NULL REFERENCES shops(id)` — populate via trigger or in-query JOIN; optional, decide after testing query perf
- Tests: verify index is used in EXPLAIN QUERY PLAN for time-range queries

### Group B — assignment_history (3 hrs)
- Create table:
  ```sql
  CREATE TABLE IF NOT EXISTS assignment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    previous_technician_id INTEGER REFERENCES technicians(id),
    technician_id INTEGER REFERENCES technicians(id),
    assignment_method TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto' | 'bulk'
    assigned_by INTEGER REFERENCES users(id),
    reassignment_reason TEXT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_assignment_hist_item ON assignment_history(order_item_id);
  CREATE INDEX idx_assignment_hist_tech ON assignment_history(technician_id);
  CREATE INDEX idx_assignment_hist_at ON assignment_history(assigned_at);
  ```
- Wire into: manual per-item assign, per-order assign, bulk assign, auto-assign (already has forward-compat stub)
- Add `reassignment_reason` prompt to the per-item reassignment UI (dropdown: off shift / wrong specialization / rebalancing / sick / manager preference / other)
- Seed `server/data/reassignment-reasons.json` for configurability
- Tests: all four assignment paths write correct rows; method field correct per path

### Group C — item completion event (2 hrs)
- Write `order_item_technicians.completed_at` on explicit completion, OR replace with `item_status_history` table
- Recommendation: write `completed_at` first (1-line change per assignment route) to get signal immediately; add `item_status_history` in a follow-up if richer history is needed
- New endpoint: `POST /api/order-items/:id/mark-complete` — sets `completed_at = CURRENT_TIMESTAMP` on the current assignment row; idempotent; workshop-only
- UI affordance: "mark complete" button on each item row in OrderDetail (workshop view only)
- Tests: endpoint sets completed_at; idempotent; locked orders return 409

### Group D — branch metadata (1 hr)
- `ALTER TABLE shops ADD COLUMN type TEXT NOT NULL DEFAULT 'full_service'`
- `ALTER TABLE shops ADD COLUMN intake_only INTEGER NOT NULL DEFAULT 0`
- `ALTER TABLE shops ADD COLUMN walk_in_only INTEGER NOT NULL DEFAULT 0`
- Update BranchesPage form with these fields
- Tests: schema migration idempotent; PATCH updates flags

### Group E — customer engagement (1 hr)
- Create table:
  ```sql
  CREATE TABLE IF NOT EXISTS track_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_token TEXT NOT NULL,
    visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_agent_class TEXT -- 'mobile_safari' | 'mobile_chrome' | 'desktop' | 'other'
  );
  CREATE INDEX idx_track_visits_token ON track_visits(customer_token);
  CREATE INDEX idx_track_visits_at ON track_visits(visited_at);
  ```
- Hook into `GET /api/track/:token`: INSERT one row after successful order lookup (fire-and-forget; don't block response on write failure)
- UA classification: check `User-Agent` header for Safari/Chrome/mobile signals; bucket to 4 classes
- Tests: visit is logged on GET; unknown token returns 404 without logging; UA bucketing correct for each class

---

## 6. Phase 3 Preview (Live Status Board)

No gaps in data needed for Phase 3. The status board uses:
- `orders` + `order_status_history` → orders-by-status counts and oldest item ages (**available today**)
- `technicians` with workload query → active tech list (**available today**)
- Derived alerts (stuck orders, busy-tech-no-items) → computed in the endpoint (**available today**)

Phase 3 can begin immediately after Phase 2 or in parallel with Groups D and E.

---

## 7. What NOT to Instrument

Per the plan's privacy guidance:

- **No per-minute tech activity logging.** `technician_status_log` gives shift-level granularity. That's enough and appropriate.
- **No full user-agent storage.** Bucket to 4 classes only (Group E).
- **No customer IP logging.** `track_visits` captures only token + timestamp + UA class.
- **No cost-change audit trail.** `order_items.estimated_cost` changes are operational, not analytical. A disputed-cost flow is a product question, not an analytics one.

---

*End of Phase 1 Audit. This document is the work order for Phase 2.*
