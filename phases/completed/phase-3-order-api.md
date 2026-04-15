# Phase 3 — Order API (Full CRUD + Workflow)

> ⚠️ Do not proceed until tested and verified.
> ⚠️ All endpoints must be manually validated before moving forward.
> ⚠️ Phases 1 and 2 must be fully completed before starting this phase.

---

## Purpose

Build the full order management API: creation, retrieval, updates, item management,
technician assignment, diagnosis, services, photos, and inventory parts.
This phase wires together all data from previous phases into working endpoints.

---

## Requirements

### Order Creation
- Branch staff creates order with customer info + one or more items
- System generates tracking number: `BR{branch_id}-YYYYMMDD-XXXX`
  - Sequence is per-branch per-day (resets daily)
- System generates `tracking_token` — a secure random token (not the DB id)
- Initial status: `RECEIVED`
- System creates an unpaid invoice automatically on order creation

### Order Number Format
```
BR{branch_id}-YYYYMMDD-XXXX
Example: BR1-20260415-0003
```

### Item Types
```
ring | necklace | bracelet | earrings | set | other
```

### Diagnosis (Technician)
- Technician adds `repair_description` and `estimated_cost` to each item
- After diagnosis, order transitions:
  - `estimated_cost > 0` → `WAITING_APPROVAL`
  - `estimated_cost = 0` → `IN_REPAIR`
- Invoice total is updated from diagnosis

### Technician Assignment
- Technician is assigned per item (not per order)
- Multiple technicians can work on different items of the same order

### Photo Uploads
- Photos taken at intake (before repair) and after repair
- Photo types: `before_repair | after_repair | damage | delivery`
- Stored as file URLs

### Services
- Each item can have one or more services assigned (from services catalog)
- Service price can be overridden at assignment time

### Inventory Parts
- Technician records parts used during repair
- Each part deducts from `inventory_items.stock_qty`

### Access Control
- Branch admin: create orders, update items before DELIVERED
- Technician: add diagnosis, update repair details, assign parts and services
- Workshop admin: full access including delete (pre-work-started only)
- No one edits after DELIVERED (enforced from Phase 2)

---

## Database Tables Required (this phase — additions)

### customers
```
id, name, phone, email, created_at, updated_at
```

### order_items (full schema)
```
id, order_id, item_number, item_type, description, quantity,
ring_size_before, ring_size_after, bracelet_adjustment, necklace_adjustment,
estimated_cost, final_cost, repair_description,
approval_required, approval_status (pending | approved | rejected | skipped),
created_at, updated_at
```

### technicians
```
id, user_id, specialization, created_at
```

### order_item_technicians
```
id, order_item_id, technician_id, assigned_at, completed_at
```

### item_photos
```
id, order_item_id, photo_url, photo_type, uploaded_by, created_at
```

### services
```
id, name, description, default_price, created_at
```

### order_item_services
```
id, order_item_id, service_id, price, notes, created_at
```

### inventory_items
```
id, name, category, stock_qty, unit, cost_per_unit, created_at, updated_at
```

### repair_parts_used
```
id, order_item_id, inventory_item_id, quantity, created_at
```

### item_locations
```
id, order_item_id, location, updated_by, created_at
```
Location values: `BRANCH_SAFE | TRANSIT_TO_WORKSHOP | WORKSHOP_RECEIVED | TECHNICIAN_BENCH | QUALITY_CHECK | READY_SHELF | DELIVERED`

---

## Implementation Checklist

### Database
- [x] Create `customers` table
- [x] Create full `order_items` table (with Phase 3 columns)
- [x] Create `technicians` table
- [x] Create `order_item_technicians` table
- [x] Create `item_photos` table
- [x] Create `services` table
- [x] Create `order_item_services` table
- [x] Create `inventory_items` table
- [x] Create `repair_parts_used` table
- [x] Create `item_locations` table
- [x] Implement atomic order number generator (per-branch per-day sequence)
- [x] Implement secure `tracking_token` generator (`crypto.randomUUID()`)

### Customer Endpoints
- [x] `POST /api/customers` — create customer
- [x] `GET /api/customers` — list customers (with ?search filter)
- [x] `GET /api/customers/:id` — get customer
- [x] `PUT /api/customers/:id` — update customer

### Branch Endpoints
- [x] Branches handled via existing `shops` table — no separate branch router needed

### Order Endpoints
- [x] `POST /api/orders` — create order with items (atomic, uses `createOrder` transaction)
- [x] `GET /api/orders` — list orders with filters (`?status=&shop_id=`)
- [x] `GET /api/orders/:id` — get order with items
- [x] `PUT /api/orders/:id` — update order (blocked after DELIVERED via `locked_at`)
- [x] `DELETE /api/orders/:id` — delete order (restricted: workshop only)
- [x] `PATCH /api/orders/:id/status` — transition status (Phase 1 FSM engine)

### Order Item Endpoints
- [x] `PUT /api/order-items/:id` — update item details (locked_at guard)
- [x] `POST /api/order-items/:id/diagnosis` — add repair description + cost; triggers FSM transition
- [x] `POST /api/order-items/:id/photos` — add photo URL with type validation
- [x] `GET /api/order-items/:id/photos` — list photos
- [x] `POST /api/order-items/:id/services` — assign service with optional price override
- [x] `POST /api/order-items/:id/parts` — record parts used (atomic stock deduction)
- [x] `POST /api/order-items/:id/technicians` — assign technician (duplicate guard)

### Technician Endpoints
- [x] `POST /api/technicians` — create technician (workshop only)
- [x] `GET /api/technicians` — list technicians

### Services Endpoints
- [x] `POST /api/services` — create service (workshop only)
- [x] `GET /api/services` — list services
- [x] `PUT /api/services/:id` — update service (workshop only)

### Inventory Endpoints
- [x] `POST /api/inventory` — create inventory item (workshop only)
- [x] `GET /api/inventory` — list inventory (with ?category and ?search filters)
- [x] `PATCH /api/inventory/:id/stock` — update stock quantity (negative-stock guard)

### Validation
- [x] Diagnosis blocked if order not in `diagnosing` status
- [x] Part recording deducts stock atomically (db.transaction, no race condition)
- [x] Stock cannot go below 0
- [x] Photos endpoint validates `photo_type` enum
- [x] All write operations blocked after DELIVERED (`locked_at` check)

---

## Completed Tasks

- All database tables and migrations added to `server/db.js`
- All 5 new route files created and mounted in `server/app.js`
- `server/helpers/costHelpers.js` extracted and shared between routes
- 50/50 tests passing in `server/tests/phase3.test.js`

---

## Notes

- Tracking number sequence must be atomic (use DB-level counter or transaction with SELECT FOR UPDATE).
- `tracking_token` must be opaque — no DB ids exposed on public URLs.
- Diagnosis endpoint triggers `OrderService.transition()` — it does not set status directly.
- Do not build QR page or UI in this phase.
