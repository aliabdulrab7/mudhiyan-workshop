# Feature Inventory — Mudhiyan Workshop

Snapshot of what the app does right now, grouped by who can do it. No history
here — see `PROJECT-LOG.md` for the timeline. Each bullet cites the primary
source file; if a capability spans server + client, both are listed.

## Roles

Two authenticated roles, one unauthenticated surface.

- **workshop** — repair technicians + shop admin. Global view across every
  branch. Owns the state machine, the repair queue, and all catalog/config
  surfaces. Source: `server/middleware/auth.js`, `server/db.js` (users.role
  CHECK IN `'workshop' | 'shop_employee'`).
- **shop_employee** — branch intake/pickup staff. Scoped to a single `shop_id`
  server-side on every read, so the role cannot see or mutate other branches'
  orders. Source: `server/routes/orders.js` (every query appends
  `AND shop_id = ?` for this role).
- **customer** — unauthenticated. Holds only a per-order `customer_token`
  (UUID, immutable, `UNIQUE` index) embedded in a QR/WhatsApp link. Source:
  `server/routes/track.js`.

## Shared capabilities (both authenticated roles)

- **JWT login** — `POST /api/auth/login` with username + password, returns a
  7-day token carrying `{id, role, shop_id, username}`. Rate-limited to 10
  attempts per 15 min per IP. Source: `server/routes/auth.js`.
- **Orders list** with search / status filter / urgency pinning.
  `shop_employee` is auto-scoped by server. Urgent unlocked orders float to
  the top. Source: `server/routes/orders.js` `GET /`,
  `client/src/components/OrderList.jsx`, `client/src/pages/Dashboard.jsx`.
- **Dense Orders page** — `/orders`, table view with status chips, bulk
  status actions, ⌘F search, row drawer. Source:
  `client/src/pages/OrdersPage.jsx`, `client/src/components/DataTable.jsx`.
- **Barcode scan lookup** — `GET /api/orders/barcode/:value` resolves a
  scanned stamp to an order. Used by camera scan and manual entry.
  Source: `server/routes/orders.js`, `client/src/pages/ScanPage.jsx`.
- **Scan page dual-mode** — manual keyboard entry is the default; camera
  scanner (html5-qrcode, CODE128) is the fallback on desktop; iPhone QR flow
  populates `?code=` from the URL and skips the scanner. Source:
  `client/src/pages/ScanPage.jsx`, `client/src/components/BarcodeScanner.jsx`,
  `client/src/components/ManualEntryInput.jsx`.
- **Bulk-scan session** — three hard-coded workflows (intake from branches,
  prepare for return, pickup from workshop), each role-gated. Scans optimistic,
  debounced, error taxonomy, audio cues, end-session summary. Session markers
  thread into `order_status_history.notes` as
  `bulk-scan · session:<uuid8> · type:<slug>`. Source:
  `client/src/components/BulkScanSession.jsx`,
  `client/src/utils/bulkSessionTypes.js`, `server/routes/orders.js`
  `PATCH /by-barcode/:barcode/status`.
- **Order drawer** — read/add comments, view status history, advance status,
  mark urgency, trigger WhatsApp (approval + ready), confirm payment,
  cancel. Source: `client/src/components/OrderDetail.jsx`,
  `server/routes/orders.js` `GET /:id/history`, `/comments`, `/status`,
  `PUT /:id` (urgency, customer fields).
- **Label printing** — universal path (any OS printer, inline window with
  `@page` size) + Niimbot B21 Bluetooth path (when `sizeId === '50x30'`).
  Canvases drawn in a 400×240 base coordinate space and letterbox-scaled.
  Source: `client/src/components/LabelCanvas.jsx`,
  `client/src/components/ReadyLabelCanvas.jsx`,
  `client/src/components/useLabelPrint.js`,
  `client/src/pages/LabelPrintPage.jsx`.
- **Dashboard CSV export** — re-fetches at click time with current
  `{status, shop_id}` filter; UTF-8 BOM, Arabic headers, phone exported as
  `+966XXXXXXXXX`. Filename `orders-{status}-{YYYY-MM-DD}.csv` in Asia/Riyadh.
  Source: `client/src/utils/exportOrdersCsv.js`,
  `client/src/pages/Dashboard.jsx`.
- **Command palette** — ⌘K opens a route+order fuzzy search overlay. Source:
  `client/src/components/CommandPalette.jsx`.
- **Layout shell** — sidebar on desktop, bottom tab bar on mobile (CSS-only
  switch). Source: `client/src/components/Layout.jsx`.

## Workshop-only capabilities

- **Branch admin** — create / list / delete shops + their employees in one
  POST. Source: `server/routes/admin.js`,
  `client/src/pages/BranchesPage.jsx`.
- **Reports page** — status counts + per-branch breakdown + printable report
  window. Source: `client/src/pages/ReportsPage.jsx`,
  `client/src/utils/reportPrint.js`, `server/routes/orders.js`
  `GET /stats`, `GET /branch-stats`.
- **Per-item quote** — `POST /api/orders/:id/items/:itemId/cost` writes
  `estimated_cost` + flips `approval_status` to `pending` (or `skipped` for
  free items). No status change — quote is saved separately from the
  "send for approval" action. Source: `server/routes/orders.js`,
  `server/helpers/costHelpers.js`, `client/src/components/OrderDetail.jsx`.
- **Send for approval** — `POST /api/orders/:id/send-for-approval` auto-skips
  all free items, then transitions `inspection|in_repair|rejected →
  waiting_approval`. All-free orders fast-path straight to `in_repair` from
  `inspection`. Source: `server/routes/orders.js`,
  `server/services/OrderService.js` (rules for the new transitions).
- **Item detail edit** — repair_description, ring_size_before/after,
  bracelet/necklace adjustment, brand, model, serial. Length guards at
  1000 / 2000 chars. Source: `server/routes/orderItems.js` `PUT /:id`.
- **Technician assignment** — assign a technician to an item; prevents
  duplicate assignment. Source: `server/routes/orderItems.js`
  `POST /:id/technicians`, `server/routes/technicians.js`,
  `client/src/pages/TechniciansPage.jsx`.
- **Inventory + parts** — stock-qty CRUD, `POST /parts` deducts stock
  atomically (checks + decrements in one transaction). Source:
  `server/routes/inventory.js`, `server/routes/orderItems.js`
  `POST /:id/parts`, `client/src/pages/InventoryPage.jsx`.
- **Services catalog** — named repair services with default prices, attached
  to items. Source: `server/routes/services.js`,
  `server/routes/orderItems.js` `POST /:id/services`,
  `client/src/pages/ServicesPage.jsx`.
- **Repair options editor** — configurable per item type (ring / earring /
  necklace / etc.), seeded on first run, preserved across restarts.
  Source: `server/routes/repair-options.js`,
  `client/src/pages/RepairOptionsPage.jsx`, `server/db.js` seed block.
- **Order delete** — allowed only while status is `received`. Source:
  `server/routes/orders.js` `DELETE /:id`.
- **Cost override on the whole order** — legacy `PATCH /:id/cost`
  (paints the same cost on every item). Kept for back-compat; per-item
  endpoint is the new path.

## Shop-employee-only capabilities

- **Intake a new order** — `POST /api/orders` with customer, phone, items,
  urgency. Order number `BR{shopId}-YYYYMMDD-NNNN` is generated atomically
  with a continuous per-branch counter (does not reset at midnight). Source:
  `server/db.js` `createOrder`, `server/routes/orders.js` `POST /`,
  `client/src/pages/NewOrder.jsx`, `client/src/components/OrderForm.jsx`.
- **Payment confirmation** — `POST /api/orders/:id/confirm-payment` sets
  `payment_confirmed=1` when the order is in `returned_to_shop`. Required
  before the role can transition to `delivered` (enforced by
  `registerPaymentValidator` in `server/app.js`). Source:
  `server/routes/orders.js`, `client/src/components/OrderDetail.jsx`.
- **Transitions that are branch-owned**
  - `ready_for_return → returned_to_shop` — confirms the piece arrived
    back at the branch.
  - `returned_to_shop → delivered` — hands over to the customer. Locks the
    order (`locked_at` set; all subsequent writes 409).
  - Source of the role gating: `server/services/OrderService.js`
    `validateBusinessRules`.

## Customer (no login) capabilities

- **View order timeline** — `GET /api/track/:token` returns a
  customer-safe projection (tracking number, piece type, status, items,
  estimated cost) — no internal IDs. Rate-limited 60/min per IP. Source:
  `server/routes/track.js`, `client/src/pages/TrackPage.jsx`.
- **Six-stage timeline UI** — visual collapse of the 10-status server state
  machine into 6 customer-facing stages. Auto-refreshes every 10s while the
  order is in an active state. Source: `client/src/pages/TrackPage.jsx`
  (`STAGES`, `STATUS_TO_STAGE`).
- **Per-item approve / reject** — `POST /api/track/:token/decide` with
  `{ decisions: [{ sort_order, decision }] }`. Free items render as "مجاني —
  مشمول" and carry no buttons. The submit button gates on all costed-pending
  items having a decision. Recomputes `orders.cost` from approved + skipped
  items only (rejected items contribute nothing). Source:
  `server/routes/track.js` `applyDecisions`,
  `client/src/pages/TrackPage.jsx` `DecisionRow`.
- **Legacy approve / reject shims** — `POST /api/track/:token/approve`
  and `/reject` still accept batch decisions for older clients.

## Integrations

- **WhatsApp via `wa.me`** — approval links and ready-for-pickup links
  built client-side. Phone stored as `966XXXXXXXXX` with no `+` and passed
  through directly. Source: `client/src/utils/whatsapp.js`,
  `server/services/NotificationService.js` (server-side payload builder).
  No Business API integration — messages open in the operator's WhatsApp app.
- **Niimbot B21 Bluetooth printer** — `@mmote/niimbluelib`, Web Bluetooth,
  user-gesture initiated. Requires Chrome/Edge on HTTPS or localhost.
  Source: `client/src/components/useLabelPrint.js`.
- **Universal OS printers** — browser print dialog via inline window with
  injected `@page { size: {w}mm {h}mm; margin: 0 }`. Works for A4, 50×30mm,
  and every preset in between. Source: `LabelCanvas.jsx` + `ReadyLabelCanvas.jsx`.
- **html5-qrcode** — desktop camera barcode scan (CODE128). Source:
  `client/src/components/BarcodeScanner.jsx`.

## Data model at a glance

SQLite at `server/data/workshop.db` (WAL). Schema lives in `server/db.js`;
all migrations are additive and guarded by `columnExists()`. Tables:

- `shops` — branches.
- `users` — `role ∈ {workshop, shop_employee}`, `shop_id` nullable (workshop
  users have none).
- `orders` — `order_number` UNIQUE, `customer_token` UNIQUE, `status`,
  `cost`, `cost_status`, `is_urgent`, `payment_confirmed`, `locked_at`,
  `customer_id` (optional FK).
- `order_items` — per-item repair: `item_name`, `repair_description`,
  `estimated_cost`, `approval_required`, `approval_status`
  (`pending | approved | rejected | skipped`), `final_cost`, plus the
  jewelry-specific fields (`ring_size_before/after`,
  `bracelet_adjustment`, `necklace_adjustment`).
- `order_status_history` — append-only audit log, one row per transition.
  `notes` is the bulk-scan session marker when applicable.
- `order_comments` — free-text notes attached to an order.
- `customers` — optional canonical customer record (denormalized on orders).
- `technicians`, `order_item_technicians` — assignment join table.
- `services`, `order_item_services` — priced catalog entries attached to items.
- `inventory_items`, `repair_parts_used` — stock + consumption ledger.
- `item_photos`, `item_locations` — optional per-item metadata.
- `repair_options` — per-item-type dropdown values for intake; seeded with
  Arabic defaults on first empty read.

## Configuration surface

- `JWT_SECRET` — required in production. Server refuses to boot with the
  default `dev-secret-change-in-production`. Source: `server/index.js`.
- `PUBLIC_HOST` — production-only CORS allow-list + the hostname returned
  by `/api/config` for QR-URL generation. When unset, dev CORS permits
  `localhost`, `127.0.0.1`, and `192.168.*`. Source: `server/app.js`.
- `NODE_ENV=test` — switches the SQLite path to `:memory:` and loosens rate
  limits to 1000/window for Jest. Source: `server/db.js`,
  `server/routes/auth.js`, `server/routes/track.js`.
- Dev proxy — Vite proxies `/api/*` to `http://localhost:3737`. Client runs
  on 5173; server on 3737. Source: `client/vite.config.js`.

## Things I noticed while writing this

The customer tracking page consumes items by `sort_order`, never by `id` —
that's a quiet privacy contract that's not enforced anywhere in types. Every
new field added to the track payload in `server/routes/track.js` needs to
stay ID-free; if someone copies from the workshop list query by reflex, it
would leak internal row IDs and (more importantly) break the implicit
"customers never see our keyspace" rule. Worth a one-line comment at the
top of that route's SELECT.
