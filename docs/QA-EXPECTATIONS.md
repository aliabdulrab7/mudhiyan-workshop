# QA Expectations — Functional Correctness Baseline

## Known quirks flagged pre-test (do NOT lose)

- **`ready_for_pickup` WhatsApp message is dead code.** `server/services/NotificationService.js::MESSAGE_BUILDERS` defines a template for `ready_for_pickup`, but the current state machine (`OrderService.TRANSITIONS`) has no such status — the ready state is `ready_for_return`. No transition ever fires event `ready_for_pickup`, so the "طلبك جاهز للاستلام" message never sends. Either wire the builder to `ready_for_return` or delete the template. Surface in Step 4 report regardless of test results.

## Workflow specs

Each workflow below defines what "correct" looks like. Tests in later steps assert against these, both in the UI and against the SQLite DB. Sourced from `server/db.js`, `server/services/OrderService.js`, `server/services/NotificationService.js`, `server/routes/orders.js`, `server/routes/track.js`.

Seeded credentials (per `CLAUDE.md`):
- Workshop: `workshop` / `workshop123` — role `workshop`, shop_id NULL (global view)
- Shop employee: `employee1` / `shop123` — role `shop_employee`, shop_id = 1

DB file: `server/data/workshop.db` (WAL mode, better-sqlite3). Tests open read-only.

Status flow (from `OrderService.TRANSITIONS`):
```
new → received → inspection → (waiting_approval | in_repair)
waiting_approval → (approved | rejected)
approved → in_repair
rejected → (ready_for_return | waiting_approval)    ← re-quote loop
in_repair → (quality_check | waiting_approval)      ← re-quote loop
quality_check → (ready_for_return | in_repair)
ready_for_return → returned_to_shop → delivered → closed
cancelled: from any non-terminal state
```

Per-item approval columns (`order_items`): `estimated_cost REAL`, `approval_status TEXT DEFAULT 'pending'` ∈ {pending, approved, rejected, skipped}. Aggregate summary on `orders.cost_status` ∈ {NO_COST, PENDING_APPROVAL, APPROVED, REJECTED}.

Phone normalization: stored as `966XXXXXXXXX` (no `+`). `0XXXXXXXXXX` → `966XXXXXXXXX`, `5XXXXXXXX` → `9665XXXXXXXX`.

---

## Workflow 1 — Shop employee creates a new order

**Preconditions**
- Logged in as `employee1` (role `shop_employee`, `shop_id=1`).
- `shops.id=1` exists.
- `workshop.db` has N existing orders with `order_number LIKE 'BR1-%'` (branch sequence = N+1).

**Actions**
1. Navigate to `/new`.
2. Fill customer_name = "QA Customer", phone = "0500000001" (will normalize to `966500000001`).
3. Select urgency = "rush".
4. Add 2 items:
   - Item A: name="خاتم ذهب", workshop_comment="تلميع (مجاني)"
   - Item B: name="قلادة",    workshop_comment="تركيب حجر"
5. Submit.

**Expected DB state (immediately after submit)**
- `orders`: one new row with
  - `order_number = 'BR1-YYYYMMDD-{N+1:04d}'` (where `YYYYMMDD` = today, NOT reset on date change — it's a continuous per-branch counter)
  - `customer_name = 'QA Customer'`
  - `phone = '966500000001'`
  - `shop_id = 1`
  - `status = 'new'`
  - `is_urgent = 1`
  - `cost = 0`, `cost_status = 'NO_COST'`, `locked_at = NULL`, `payment_confirmed = 0`
  - `customer_token` matches UUIDv4 shape `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
  - `piece_type = 'خاتم ذهب، قلادة'` (comma-joined item names)
- `order_items`: exactly 2 rows for this `order_id`, `sort_order` = 0 and 1, `item_name` matches, `workshop_comment` matches, `estimated_cost = NULL`, `approval_status = 'pending'`.
- `order_status_history`: one row with `from_status = NULL`, `to_status = 'new'`, `changed_by = 'employee1'`.

**Expected UI state**
- Success screen renders with order_number stamp + label canvas.
- QR code embeds `${origin}/track/${customer_token}` (LabelCanvas line 79).
- CODE128 barcode below encodes the `order_number`.
- "مستعجل" red pill visible in success header (is_urgent=1).

**Expected side effects**
- Response body (201): full order including `items[]`.
- No WhatsApp notification on create (only fires on `waiting_approval` transition).
- No transition hook fires.

**Negative cases to assert**
- Workshop role (not shop_employee) → POST /api/orders returns 403.
- Missing phone → 400 "الاسم ورقم الجوال مطلوبان".
- `items: []` → 400 "يجب إضافة صنف واحد على الأقل".
- Item missing `workshop_comment` → 400 "تعليق الورشة مطلوب لكل صنف".

---

## Workflow 2 — Workshop sets per-item costs → sends for approval

**Preconditions**
- Workflow 1 order exists (`status = 'new'`).
- Logged in as `workshop`.

**Actions**
1. PATCH `/api/orders/:id/status` → `'received'` (workshop only; registry: new→received).
2. PATCH `/api/orders/:id/status` → `'inspection'`.
3. POST `/api/orders/:id/items/:itemA_id/cost` with `{ estimated_cost: 0 }`.
4. POST `/api/orders/:id/items/:itemB_id/cost` with `{ estimated_cost: 150 }`.
5. POST `/api/orders/:id/send-for-approval`.

**Expected DB state**
- `orders`:
  - `status = 'waiting_approval'` (because ≥1 item has estimated_cost > 0)
  - `cost = 150` (sum of items' estimated_cost; helper `refreshOrderCost`)
  - `cost_status = 'PENDING_APPROVAL'`
- `order_items`:
  - Item A: `estimated_cost = 0`, `approval_status = 'skipped'` (free items auto-skip — verify; if actual is `'pending'`, flag as ambiguity)
  - Item B: `estimated_cost = 150`, `approval_status = 'pending'`
- `order_status_history`: rows for new→received, received→inspection, inspection→waiting_approval.

**Expected side effects**
- Response from send-for-approval includes `_notification` with:
  - `event = 'waiting_approval'`
  - `whatsapp_url` starts with `https://wa.me/966500000001?text=`
  - Decoded `text` contains: customer_name, `طلب الإصلاح رقم BR1-…`, `تكلفة الإصلاح المقدرة: 150 ريال`, and `https://mudhiyan.app/track/{token}` (hardcoded prod host in NotificationService; dev link won't resolve locally — acceptable for this layer).

**Expected UI state (workshop)**
- Order row in `/orders` shows status pill "بانتظار الموافقة".
- OrderDetail drawer shows per-item cost inputs disabled or annotated "بانتظار الموافقة".

**Negative cases**
- Send-for-approval when all items have `estimated_cost = 0` and no non-zero exists → transitions `inspection → in_repair` instead (skips customer step).
- Send-for-approval with zero costs set → BusinessRuleViolationError ("لا يمكن طلب موافقة العميل بدون تحديد تكلفة لأي صنف").
- Shop employee calling send-for-approval → 403.

---

## Workflow 3 — Customer opens tracking link, partial approve

**Preconditions**
- Workflow 2 order exists (`status = 'waiting_approval'`).
- Customer token known. No login.

**Actions**
1. GET `/api/track/{token}` — inspect payload.
2. Navigate (in fresh browser context, no auth) to `/track/{token}`.
3. In UI: free item renders "مجاني — مشمول" (no decision buttons).
4. Costed item renders segmented ✓ / ✗ toggle.
5. Click ✗ (reject) on item B.
6. Click "تأكيد قراري" (Confirm).
7. Behind the scenes: POST `/api/track/{token}/decide` with `{ decisions: [{ sort_order: 1, decision: 'reject' }] }`.

**Expected API payload (step 1)**
- 200 JSON: `{ tracking_number, piece_type, status: 'waiting_approval', status_label: 'بانتظار موافقتك', estimated_cost: 150, cost_status: 'PENDING_APPROVAL', show_approval_buttons: true, items: [...] }`.
- `items[]` includes only public fields (`item_name, item_type, quantity, repair_description, estimated_cost, approval_status, sort_order`) — no internal `id`.

**Expected DB state (after Confirm)**
- Item A: `approval_status = 'skipped'` (or `'approved'` — confirm actual behavior).
- Item B: `approval_status = 'rejected'`.
- `orders.status = 'approved'` (at least one "workable" item exists — the free item counts per `applyDecisions` aggregate).
- `orders.cost_status = 'APPROVED'`.
- `order_status_history` row: `waiting_approval → approved`, `changed_by = 'customer_qr'`, notes mention "العميل وافق على 1 صنف، رفض 1" (exact counts may differ based on how skipped items are counted — verify).

**Expected UI state**
- Track page after submit shows "تم تسجيل قرارك" / "تمت الموافقة" (one of the post-submit variants).
- Confirm button gone / disabled.

**Expected side effects**
- Response includes `_notification` only if status transition builds a notification (`approved` has no entry in MESSAGE_BUILDERS → no WhatsApp link).

**Negative cases**
- Token not in DB → 404 "الطلب غير موجود".
- Order already past waiting_approval → 400 "الطلب لا يحتاج موافقة في هذه المرحلة".
- Decisions array missing an item that's still pending → 400 "يجب اتخاذ قرار لكل صنف معلق".
- Decision targets a sort_order that doesn't exist or isn't pending-costed → 400 "قرار غير صالح — صنف غير مؤهل للموافقة".

---

## Workflow 4 — Workshop advances approved order to in_repair

**Preconditions**
- Workflow 3 order exists (`status = 'approved'`).
- Logged in as `workshop`.

**Actions**
1. Open OrderDetail drawer.
2. Click "بدء الإصلاح" (or equivalent; transitions approved → in_repair).
3. Observe server call: PATCH `/api/orders/:id/status` with `status: 'in_repair'`.

**Expected DB state**
- `orders.status = 'in_repair'`.
- `order_status_history` row: `approved → in_repair`.
- `order_items` unchanged (Item B stays `rejected`, Item A stays `skipped`/`approved`).

**Expected UI state**
- Status pill changes to "قيد الإصلاح".
- Rejected Item B is visibly marked "مرفوض — متخطى" in the items table.

**Negative**
- Transitioning from `approved → waiting_approval` would fail (not in registry).

---

## Workflow 5 — Workshop marks ready → delivered

**Preconditions**
- Workflow 4 order exists (`status = 'in_repair'`).

**Actions (workshop)**
1. PATCH status → `quality_check`.
2. PATCH status → `ready_for_return`.

**Actions (shop employee — role change)**
3. Log out, log in as `employee1`.
4. PATCH status → `returned_to_shop` (registry + rule: shop_employee only).
5. Attempt PATCH status → `delivered` WITHOUT `payment_confirmed = 1` → expect **422 PaymentRequiredError** (per `errors/index.js::errorToHttpStatus` — business-rule violation, not 402/409).
6. POST `/api/orders/:id/confirm-payment` (shop_employee only) to set `payment_confirmed = 1`.
7. PATCH status → `delivered`.

**Expected DB state after step 7**
- `orders.status = 'delivered'`.
- `orders.locked_at` IS NOT NULL (set by `_executeTransition`).
- `orders.payment_confirmed = 1`.
- Further mutation attempts (e.g., PATCH status → closed by non-workshop, or any cost edit) → `OrderLockedError` (409).

**Expected side effects**
- No `ready_for_pickup` WhatsApp notification fires today (MESSAGE_BUILDERS keys waiting_approval + ready_for_pickup; current registry uses `ready_for_return`, not `ready_for_pickup` — mismatch, notification on ready never triggers). Flag as behavior-to-verify.

---

## Workflow 6 — Role enforcement: shop employee attempts workshop routes

**Preconditions**
- Logged in as `employee1`.

**Probes (expected response)**

| Route                            | Method | Expected                                      |
|----------------------------------|--------|-----------------------------------------------|
| GET /api/orders/branch-stats     | GET    | 403 (workshop only)                           |
| POST /api/orders/:id/items/:iid/cost | POST | 403                                          |
| POST /api/orders/:id/send-for-approval | POST | 403                                        |
| DELETE /api/orders/:id           | DELETE | 403                                          |
| POST /api/orders/:id/comments    | POST   | 403                                          |
| GET /technicians, /inventory, /services, /repair-options, /branches, /reports (client routes) | nav | RoleRoute redirects to `/` OR renders "ليس لديك صلاحية" |

---

## Workflow 7 — Role scoping: workshop sees all, employee sees only their shop

**Preconditions**
- Two orders exist: one with `shop_id = 1`, one with `shop_id ≠ 1` (create via direct DB seed if needed).

**Probes**
- GET `/api/orders` as workshop → returns both.
- GET `/api/orders` as employee1 (shop_id=1) → returns only the shop_id=1 order.
- GET `/api/orders/barcode/{other_shop_order_number}` as employee1 → 404 "الطلب غير موجود".
- GET `/api/orders/stats` as employee1 → counts only their shop's orders.

---

## Workflow 8 — Public track page with valid token (no login)

**Preconditions**
- Order exists with known `customer_token`.
- Fresh browser context, no auth cookies or localStorage.

**Actions**
1. Navigate to `/track/{token}`.

**Expected UI**
- Renders status label, items, costs. No app chrome (no sidebar/top nav — per customer-facing design).
- No login redirect.
- Approval buttons render iff `status = 'waiting_approval'` (from `show_approval_buttons`).

**Expected network**
- `GET /api/track/{token}` returns 200 with customer-safe payload.
- No `Authorization` header required.
- No calls to authenticated endpoints (no `/api/orders`, `/api/auth/me`, etc.).

**Expected rate limit**
- 60 req/min per IP (express-rate-limit). 61st request inside window → 429 "طلبات كثيرة، حاول بعد لحظة".

---

## Workflow 9 — Public track page with expired/bogus token

**Actions**
1. Navigate to `/track/00000000-0000-0000-0000-000000000000` (well-formed but unknown).
2. Navigate to `/track/not-a-real-token-xxxxxxxx` (malformed).

**Expected API (both)**
- `GET /api/track/{token}` → 404 `{ error: 'الطلب غير موجود' }`.

**Expected UI (both)**
- Track page renders an error state ("الطلب غير موجود" or equivalent) — not a blank screen, not a JS exception.
- Browser tab is not redirected to `/login` (track is public).

**No side effects**
- No DB writes.
- No Authorization-protected calls attempted.

---

## Cross-cutting invariants (asserted across all workflows)

- **Import-chain check:** for any "feature missing" finding, verify which component the route actually renders (e.g., `/orders` → `OrdersPage` → `DataTable`, not `OrderList`) before flagging. Lesson from prior harness pass.
- **Status source of truth:** every `orders.status` change must correspond to an `order_status_history` row with the matching `from_status → to_status` pair. No orphan status changes.
- **Lock enforcement:** once `locked_at IS NOT NULL`, any mutating API call returns 409 `OrderLockedError`.
- **CORS preconditions (per `CLAUDE.md` → QA Ground Rules):** both `http://localhost:5173` and `https://localhost:5173` must succeed against `/api/auth/login` before tests begin. Abort with one finding if either fails.
- **No console errors / uncaught exceptions** during any happy-path flow. `console.error` or window error → auto-flag.
