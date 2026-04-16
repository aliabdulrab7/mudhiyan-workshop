# Phase 7 — Data Consistency

> ⚠️ Do not proceed until Phase 6 is fully completed and validated.
> ⚠️ Phone normalization migration may affect existing records. Check data before running.
> ⚠️ Adding UNIQUE constraints may fail if duplicate data already exists. Audit first.

---

## Purpose

Ensure that all data entering the system is structurally valid before it reaches the database.
Prevent bad data from silently persisting and causing downstream business errors.

This phase adds input validation on all write endpoints, reviews database constraints, and normalizes phone number storage.

---

## Status: Planned

---

## Tasks

### 7.1 — Phone Number Normalization

**Standard format:** `966XXXXXXXXX` (no `+`, no spaces, no dashes, 12 digits)

Steps:
1. Add a `normalizePhone(raw)` helper in `server/helpers/phoneHelper.js` that:
   - Strips `+`, spaces, and dashes
   - If the number starts with `0`, replaces the leading `0` with `966`
   - If the number starts with `5` (9 digits), prepends `966`
   - Returns the normalized string or throws a `ValidationError` if unrecognizable
2. Apply `normalizePhone` in `POST /api/orders` and `PUT /api/orders/:id` before any DB write
3. Run a one-time migration in `db.js` to normalize all existing phone records that are non-standard

**Test cases:**
- `+966501234567` → `966501234567`
- `0501234567` → `966501234567`
- `501234567` → `966501234567`
- `966501234567` → `966501234567` (no change)
- `abc` → ValidationError (400)

### 7.2 — Cost Value Validation

Enforce that cost values are non-negative integers (no floats, no negatives):

- `PATCH /api/orders/:id/cost`: validate `parseInt(cost, 10) >= 0` — already done for the order-level endpoint; confirm it returns 400, not 500
- `POST /api/orders/:orderId/items/:itemId/cost`: validate `parseFloat(estimated_cost) >= 0`
- `POST /api/order-items/:id/diagnosis`: validate `parseFloat(estimated_cost) >= 0`

Add test for each: negative value → 400 with `{ error: "..." }`.

### 7.3 — Required Field Validation for Order Creation

`POST /api/orders` currently validates `customer_name` and `phone`. Harden:

- `customer_name`: present, non-empty after trim, max 100 chars ✅ (already done)
- `phone`: present, non-empty, passes `normalizePhone` ← new in 7.1
- `items`: non-empty array ✅ (already done)
- Each item: `item_name` non-empty after trim ✅ (already done)
- Each item: `workshop_comment` non-empty after trim ✅ (already done)

Return 400 with a specific field name in the error message for each missing or invalid field.

Add integration tests covering each validation path.

### 7.4 — `customer_token` Uniqueness Constraint

Confirm the `customer_token` column has a `UNIQUE` constraint in the database.

Current state: `db.js` has a partial index `idx_cust_tok ON orders(customer_token) WHERE customer_token IS NOT NULL` — this is NOT a uniqueness constraint.

Steps:
1. Check whether the UNIQUE constraint exists: `PRAGMA table_info(orders)` does not show it
2. Add an idempotent migration to add the constraint via table rebuild or verify via query
3. Since SQLite does not support `ALTER TABLE ... ADD UNIQUE`, this requires creating a unique index:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_token ON orders(customer_token)
   WHERE customer_token IS NOT NULL;
   ```
4. Before adding: run a query to confirm no duplicate `customer_token` values exist
5. Add a test: confirm two orders cannot have the same token

### 7.5 — `order_number` Uniqueness Guarantee

Confirm the `order_number` UNIQUE constraint is enforced and tested under concurrent creation.

The UNIQUE constraint exists via `order_number TEXT NOT NULL UNIQUE` in the CREATE TABLE. Verify:
1. `PRAGMA table_info(orders)` shows the column as unique
2. Add a test that fires 10 concurrent `POST /api/orders` requests for the same shop on the same day and confirms all 10 produce unique `order_number` values

### 7.6 — Orphaned Item Cost Audit

Confirm that `orders.cost` always equals the sum of `order_items.estimated_cost` after any cost update.

Steps:
1. Review `refreshOrderCost()` in `server/helpers/costHelpers.js` — confirm it sums `estimated_cost` (not `final_cost`) for the order total
2. Confirm `PATCH /api/orders/:id/cost` and `POST /api/orders/:orderId/items/:itemId/cost` both call `refreshOrderCost` after any item update
3. Add a test: create order with 3 items, set costs individually, confirm `orders.cost === sum of item costs`
4. Add a test: update one item cost and confirm `orders.cost` updates accordingly

### 7.7 — Input Length and Type Guards

Review all write endpoints for missing length limits or type checks:

- `notes` field on orders: max 2000 characters
- `workshop_comment` on items: max 1000 characters
- `customer_name`: max 100 chars ✅ already enforced
- Integer fields (`quantity`, `sort_order`): `parseInt(..., 10)` with NaN check
- Status filter in `GET /api/orders`: already validated against `ALLOWED_STATUSES` ✅

Add 400 responses for oversized inputs with a clear Arabic error message.

---

## Implementation Checklist

### Phone Normalization
- [ ] `server/helpers/phoneHelper.js` — `normalizePhone()` function created
- [ ] `POST /api/orders` — phone normalized before insert
- [ ] `PUT /api/orders/:id` — phone normalized before update
- [ ] Existing DB records normalized via migration in `db.js`
- [ ] Tests cover all phone format variants

### Cost Validation
- [ ] All cost endpoints validate non-negative number
- [ ] Test: negative cost → 400

### Order Creation Validation
- [ ] All required fields validated with specific error messages
- [ ] Tests cover each missing field case

### Uniqueness Constraints
- [ ] `UNIQUE INDEX` on `customer_token` added to `db.js`
- [ ] Pre-migration check: no duplicate tokens in DB
- [ ] Test: duplicate token rejected at DB level
- [ ] Test: 10 concurrent order creations produce 10 unique order numbers

### Cost Sync
- [ ] `refreshOrderCost` called after all item cost updates
- [ ] Test: `orders.cost` equals sum of item costs
- [ ] Test: individual item update syncs order total

### Length Guards
- [ ] `notes` max 2000 chars enforced
- [ ] `workshop_comment` max 1000 chars enforced

---

## Validation Steps (Phase Exit Criteria)

- [ ] Phone numbers stored in DB are always `966XXXXXXXXX` format
- [ ] Orders with empty `customer_name` are rejected at the API with 400
- [ ] Orders with empty `items` array are rejected at the API with 400
- [ ] `PATCH /api/orders/:id/cost` with negative value returns 400
- [ ] `orders.cost` equals the sum of item `estimated_cost` values after any cost update
- [ ] `customer_token` UNIQUE index exists in schema
- [ ] 10 concurrent order creations for the same shop produce 10 unique order numbers
- [ ] Full test suite passes with no regressions

---

## Risks

- Phone normalization migration may affect existing records stored in different formats. Run a count query first: `SELECT COUNT(*) FROM orders WHERE phone NOT GLOB '966[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`
- Adding a UNIQUE index may fail if duplicate `customer_token` values already exist. Check first: `SELECT customer_token, COUNT(*) FROM orders GROUP BY customer_token HAVING COUNT(*) > 1`
