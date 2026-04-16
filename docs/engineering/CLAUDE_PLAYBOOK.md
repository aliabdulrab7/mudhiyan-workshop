# MUDHIYAN WORKSHOP — ENGINEERING PLAYBOOK

> **This document is the single source of truth for the Mudhiyan Workshop system.**
> Every engineer, AI assistant, or automated agent working on this codebase must read and follow it.
> Every time the system changes, this document must be updated to reflect reality.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Order State Machine](#3-order-state-machine)
4. [Engineering Rules](#4-engineering-rules)
5. [API Standards](#5-api-standards)
6. [Database Standards](#6-database-standards)
7. [Security Standards](#7-security-standards)
8. [UI Design Standards](#8-ui-design-standards)
9. [Feature Development Process](#9-feature-development-process)
10. [Feature Removal Process](#10-feature-removal-process)
11. [Code Quality Rules](#11-code-quality-rules)
12. [Deployment Rules](#12-deployment-rules)
13. [Change History](#13-change-history)

---

## 1. PROJECT OVERVIEW

### What the System Does

Mudhiyan Workshop is a **jewelry repair order management system** for a business that operates across multiple physical shops and a central workshop.

The system manages the complete lifecycle of a repair order: from the moment a customer drops off a piece of jewelry at a shop, through diagnosis, cost approval, repair, quality check, and final delivery back to the customer.

### The Business Problem It Solves

Before this system, the workflow between shop and workshop was manual — no consistent tracking, no audit trail, no way for the customer to know the status of their order. Pieces would get lost, costs would be disputed, and the shop had no visibility into what the workshop was doing.

This system solves that by:
- Assigning a unique serial number and printed label to every order
- Enforcing a strict sequential workflow via a state machine
- Requiring customer approval before any paid repair work begins
- Providing a public tracking page so customers can follow their order and approve costs by scanning a QR code
- Sending WhatsApp notifications to customers at key milestones
- Preventing any modifications after delivery to protect integrity

### Actors in the System

**Shop Employee (`shop_employee` role)**
- Works at a physical jewelry shop
- Receives items from customers and creates new orders
- Prints labels for incoming orders
- Confirms when workshop items are physically received back at the shop
- Delivers repaired items to customers and confirms payment
- Can only see orders belonging to their own shop

**Workshop Technician (`workshop` role)**
- Works at the central repair workshop
- Receives orders from all shops
- Diagnoses items and sets repair costs
- Manages the repair process (in_repair, quality_check)
- Marks orders ready for return when repair is complete
- Has visibility across all shops

**Customer**
- Has no login to the system
- Receives a QR code on their label when they drop off an item
- Can scan the QR code to view their order status and estimated cost
- Approves or rejects the repair cost directly from their phone (no account required)
- Receives WhatsApp notifications at key steps

### The Repair Workflow (End to End)

```
Shop creates order
      ↓
Workshop receives order
      ↓
Workshop inspects and sets cost
      ↓
    [cost > 0]                [cost = 0]
Customer approves / rejects   Skip to in_repair
      ↓ approved
Workshop repairs
      ↓
Workshop quality checks
      ↓
Workshop marks ready for return
      ↓
Shop confirms receipt from workshop
      ↓
Shop confirms delivery to customer (requires payment confirmation)
      ↓
Workshop closes the order
```

---

## 2. SYSTEM ARCHITECTURE

### Overview

Mudhiyan Workshop is a **monorepo** containing two independently runnable applications:

| Layer    | Location    | Technology                          |
|----------|-------------|-------------------------------------|
| Frontend | `client/`   | React 19, Vite, Tailwind CSS, RTL   |
| Backend  | `server/`   | Express.js, SQLite (better-sqlite3) |
| Database | `server/data/workshop.db` | SQLite file       |

There is **no external database server**. SQLite runs in-process with the Express server.

### Frontend (`client/`)

The frontend is a **single-page application (SPA)** built with React 19 and React Router 7.

Responsibilities:
- Render all UI for shop employees and workshop staff
- Communicate with the backend exclusively via the `/api/*` endpoints
- Store the JWT token and user role in `localStorage`
- Render label canvases and communicate with the Niimbot B21 Bluetooth printer
- Provide a public customer tracking page (no auth required)

Key directories:
```
client/src/
  api/          All API fetch wrappers (no fetch calls outside this folder)
  components/   Reusable components
  pages/        Route-level page components
  hooks/        Custom React hooks
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3737`. In production, Nginx handles this proxy.

### Backend (`server/`)

The backend is a **Node.js Express server** that exposes a REST API.

Responsibilities:
- Authenticate users via JWT
- Enforce role-based access on every route
- Execute all business logic through the `OrderService` state machine
- Persist all data to SQLite
- Expose `GET /api/config` so the frontend can get the correct LAN/hostname for QR URL generation

Key directories:
```
server/
  routes/       Express routers — validation and delegation only
  services/     Business logic (OrderService, NotificationService)
  middleware/   Auth verification and role guards
  errors/       Typed error classes
  helpers/      Shared utility functions
  tests/        Jest integration tests
  db.js         Database init, schema, migrations, createOrder transaction
  app.js        Express app setup, CORS, route mounting
  index.js      Server startup, port binding
  seed.js       One-time data seeding script
```

### Database

SQLite is the database. It runs inside the server process using `better-sqlite3` (synchronous API).

The database file lives at `server/data/workshop.db` and is **git-ignored**. Never commit the database file.

WAL mode is enabled for better concurrent read performance.

The schema is defined and migrated on every server startup in `server/db.js`. Migrations are idempotent — adding a column checks if it exists before running `ALTER TABLE`.

### Authentication

Authentication is JWT-based. There is no session table.

- Login: `POST /api/auth/login` returns a signed JWT (7-day expiry)
- The JWT payload contains: `{ id, role, shop_id, username }`
- Every protected route requires `Authorization: Bearer <token>`
- `server/middleware/auth.js` exposes `requireAuth` (verifies JWT) and `requireRole(role)` (checks role field)

There is no refresh token mechanism. After 7 days the user must log in again.

### State Machine

The entire order lifecycle is controlled by a **state machine** in `server/services/OrderService.js`.

The state machine has three layers of defense:
1. **Transition validity** — is this move allowed by the TRANSITIONS registry?
2. **Business rules** — are the pre-conditions satisfied (correct role, cost set, payment confirmed)?
3. **Atomic database write** — the audit log entry and the status update succeed or fail together

No code outside `OrderService` is allowed to change `orders.status`.

---

## 3. ORDER STATE MACHINE

### Status List

| Status               | Description                                                    |
|----------------------|----------------------------------------------------------------|
| `new`                | Order created by shop, not yet received at workshop            |
| `received`           | Workshop has physically received the order                     |
| `inspection`         | Workshop is diagnosing the item                                |
| `waiting_approval`   | Workshop set a cost > 0, waiting for customer to approve       |
| `approved`           | Customer approved the cost via QR code                         |
| `rejected`           | Customer rejected the cost; item returned unrepaired           |
| `in_repair`          | Repair work is actively in progress                            |
| `quality_check`      | Workshop is inspecting completed repair before return          |
| `ready_for_return`   | Workshop has finished; item ready to be shipped back to shop   |
| `returned_to_shop`   | Shop has physically received the item back from workshop       |
| `delivered`          | Shop has delivered the item to the customer                    |
| `closed`             | Order has been archived by workshop                            |

### Valid Transitions

```
new               → received
received          → inspection
inspection        → waiting_approval   (requires cost > 0)
inspection        → in_repair          (requires cost = 0)
waiting_approval  → approved           (customer action via /track)
waiting_approval  → rejected           (customer action via /track)
approved          → in_repair
rejected          → ready_for_return
in_repair         → quality_check
quality_check     → ready_for_return
quality_check     → in_repair          (rework required)
ready_for_return  → returned_to_shop   (shop_employee only)
returned_to_shop  → delivered          (shop_employee only, payment_confirmed required)
delivered         → closed             (workshop only)
```

These transitions are the **single source of truth**. They are encoded in the `TRANSITIONS` registry in `server/services/OrderService.js`. Any change to workflow must be made there first.

### Per-Status Detail

**`new`**
- Triggered by: shop_employee via `POST /api/orders`
- Pre-conditions: none
- System actions: generate order_number, generate customer_token UUID, create order_items, print label canvas available

**`received`**
- Triggered by: workshop user
- Pre-conditions: workshop role only
- System actions: write audit log entry

**`inspection`**
- Triggered by: workshop user
- Pre-conditions: order must be `received`
- System actions: write audit log entry

**`waiting_approval`**
- Triggered by: workshop user via `PATCH /api/orders/:id/cost`
- Pre-conditions: cost must be greater than 0; workshop role only
- System actions: write audit log, generate WhatsApp notification payload with tracking QR URL

**`approved`**
- Triggered by: customer via `POST /api/track/:token/approve` (no auth required)
- Pre-conditions: order must be in `waiting_approval`
- System actions: set all order_items.approval_status = 'approved', write audit log, generate notification for workshop

**`rejected`**
- Triggered by: customer via `POST /api/track/:token/reject` (no auth required)
- Pre-conditions: order must be in `waiting_approval`
- System actions: set all order_items.approval_status = 'rejected', write audit log

**`in_repair`**
- Triggered by: workshop user
- Pre-conditions: order must be `approved` or `inspection` with cost = 0
- System actions: write audit log

**`quality_check`**
- Triggered by: workshop user
- Pre-conditions: order must be `in_repair`
- System actions: write audit log

**`ready_for_return`**
- Triggered by: workshop user
- Pre-conditions: order must be `quality_check` or `rejected`
- System actions: write audit log, generate WhatsApp notification payload (ready for pickup)

**`returned_to_shop`**
- Triggered by: **shop_employee only**
- Pre-conditions: shop_employee role; order must be `ready_for_return`
- System actions: write audit log

**`delivered`**
- Triggered by: **shop_employee only**
- Pre-conditions: shop_employee role; `payment_confirmed = 1` required; order must be `returned_to_shop`
- System actions: write audit log, set `locked_at` timestamp — order becomes permanently read-only
- Note: **Only the shop can mark delivered. The workshop cannot do this.**

**`closed`**
- Triggered by: workshop user
- Pre-conditions: workshop role; order must be `delivered`
- System actions: write audit log

### Order Locking

When an order transitions to `delivered`, the `locked_at` column is set to the current UTC timestamp.

All write endpoints (`PUT /api/orders/:id`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/cost`, etc.) must check `if (order.locked_at)` and return a 409 Conflict before proceeding.

Locked orders are permanently read-only. There is no unlock mechanism.

---

## 4. ENGINEERING RULES

These rules are **mandatory**. They exist to prevent the system from becoming inconsistent. Do not work around them.

**Rule 1: Status transitions happen only in OrderService**
`orders.status` must never be updated with a raw SQL statement outside of `server/services/OrderService.js`. Not in routes. Not in helpers. Not in tests (except using the service). OrderService is the only entry point.

**Rule 2: Routes contain no business logic**
Express route handlers must only: authenticate, validate input, call a service or database helper, and return a response. Any logic that involves understanding what an order *is* or what it *should do* belongs in a service.

**Rule 3: Every status transition writes to order_status_history**
The audit trail is not optional. The OrderService transaction atomically writes to `order_status_history` on every transition. If the audit write fails, the entire transaction rolls back.

**Rule 4: Role enforcement exists on every protected route**
Every route that touches order data must call `requireAuth` and the appropriate `requireRole`. There are no exceptions. A route missing role enforcement is a security bug.

**Rule 5: Input validation happens before business logic**
Routes validate input (required fields, allowed values, numeric ranges) before calling services. Services may enforce business rules but must not parse or sanitize raw HTTP input.

**Rule 6: createOrder is atomic and must not be split**
The `createOrder` function in `db.js` generates the order number, inserts the order, and inserts all items in one transaction. It must never be refactored into separate generate + insert calls.

**Rule 7: Shop employees only see their own shop's data**
All queries against the `orders` table for `shop_employee` users must include `WHERE shop_id = req.user.shop_id`. Workshop users see all shops.

**Rule 8: Locked orders reject all writes**
Any endpoint that modifies an order must check `order.locked_at` before proceeding. If it is set, return HTTP 409 with `{ error: "Order is locked" }`.

**Rule 9: The TRANSITIONS registry is the single source of truth for workflow**
If a product requirement changes the workflow, the first change must be to the `TRANSITIONS` registry. No ad-hoc status changes are permitted anywhere.

**Rule 10: No direct SQL outside of db.js for schema operations**
Table creation, column additions, and index creation belong only in `db.js`. Routes and services use prepared statements via the `db` export but never issue DDL statements.

---

## 5. API STANDARDS

### Naming Conventions

| Pattern                          | Example                              |
|----------------------------------|--------------------------------------|
| Resource collection              | `GET /api/orders`                    |
| Single resource                  | `GET /api/orders/:id`                |
| Sub-resource collection          | `GET /api/orders/:id/comments`       |
| Sub-resource item                | `GET /api/orders/:id/comments/:cid`  |
| Action on resource               | `POST /api/orders/:id/confirm-payment` |
| Lookup by alternate key          | `GET /api/orders/barcode/:value`     |

Route segments use kebab-case. No underscores in URLs.

**Important**: `GET /api/orders/barcode/:value` must be declared **before** `GET /api/orders/:id` in the router file. Express matches routes top-to-bottom. If `:id` is declared first, the string `"barcode"` is captured as the id.

### Success Response Format

All successful responses return HTTP 2xx and a JSON body.

For single objects:
```json
{
  "success": true,
  "data": { ... }
}
```

For collections:
```json
{
  "success": true,
  "data": [ ... ],
  "total": 42
}
```

For actions with no meaningful return value:
```json
{
  "success": true
}
```

Responses may include optional fields such as `_notification` (for WhatsApp payload after a state transition):
```json
{
  "success": true,
  "data": { ... },
  "_notification": {
    "event": "waiting_approval",
    "whatsapp_url": "https://wa.me/966..."
  }
}
```

### Error Response Format

All errors return the appropriate HTTP status code and:
```json
{
  "error": "Human-readable message in English or Arabic"
}
```

Never return stack traces or internal error details in production.

### HTTP Status Codes

| Status | When to use                                              |
|--------|----------------------------------------------------------|
| 200    | Successful GET, PATCH, PUT, DELETE                       |
| 201    | Successful POST that created a resource                  |
| 400    | Invalid input, missing required fields, bad enum value   |
| 401    | Missing or invalid JWT                                   |
| 403    | Valid JWT but insufficient role or wrong shop            |
| 404    | Resource not found                                       |
| 409    | Conflict — order is locked, or invalid state transition  |
| 422    | Business rule violation (e.g. cost required, payment required) |
| 500    | Unexpected server error                                  |

The `server/errors/index.js` module provides `errorToHttpStatus(err)` that maps typed error instances to the correct status code. Use it in route error handlers.

### Authentication Header

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

Public endpoints (login, track) do not require this header.

### Query Parameters

Listing endpoints accept:
- `status` — filter by order status (validated against enum before querying)
- `search` — text search across customer_name, order_number, phone
- `limit` — clamped to 1–500 (default 50)
- `offset` — for pagination (default 0)
- `shop_id` — workshop users may filter by specific shop

---

## 6. DATABASE STANDARDS

### Table Naming

- Tables use `snake_case` plural nouns: `orders`, `order_items`, `order_status_history`
- Junction tables name both entities: `order_item_technicians`, `order_item_services`
- No prefixes or Hungarian notation

### Core Tables

**`orders`** — One row per repair order
```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
order_number      TEXT UNIQUE NOT NULL          -- BR{shopId}-{YYYYMMDD}-{seq}
customer_name     TEXT NOT NULL
phone             TEXT NOT NULL                 -- stored as 966XXXXXXXXX (no +)
piece_type        TEXT                          -- legacy summary field
notes             TEXT
status            TEXT DEFAULT 'new'            -- see state machine
cost              INTEGER DEFAULT 0             -- sum of item costs in SAR
cost_status       TEXT DEFAULT 'NO_COST'        -- NO_COST | PENDING_APPROVAL | APPROVED | REJECTED
customer_token    TEXT UNIQUE                   -- UUID for public tracking
payment_confirmed INTEGER DEFAULT 0             -- 1 = confirmed, required before delivered
locked_at         TEXT                          -- ISO timestamp, set on delivered
is_urgent         INTEGER DEFAULT 0
shop_id           INTEGER REFERENCES shops(id)
customer_id       INTEGER REFERENCES customers(id)
created_at        TEXT DEFAULT (datetime('now'))
updated_at        TEXT DEFAULT (datetime('now'))
```

**`order_items`** — One row per piece within an order
```sql
id                   INTEGER PRIMARY KEY AUTOINCREMENT
order_id             INTEGER REFERENCES orders(id) ON DELETE CASCADE
item_name            TEXT NOT NULL
quantity             INTEGER DEFAULT 1
repair_description   TEXT
estimated_cost       REAL DEFAULT NULL
final_cost           REAL DEFAULT NULL
approval_required    INTEGER DEFAULT 0
approval_status      TEXT DEFAULT 'pending'    -- pending | approved | rejected | skipped
workshop_comment     TEXT
ring_size_before     TEXT
ring_size_after      TEXT
bracelet_adjustment  TEXT
necklace_adjustment  TEXT
sort_order           INTEGER DEFAULT 0
created_at           TEXT DEFAULT (datetime('now'))
updated_at           TEXT DEFAULT (datetime('now'))
```

**`order_status_history`** — Immutable audit trail, never deleted
```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
order_id     INTEGER REFERENCES orders(id)
from_status  TEXT
to_status    TEXT NOT NULL
changed_by   TEXT NOT NULL    -- username of the actor
notes        TEXT             -- optional reason or comment
created_at   TEXT DEFAULT (datetime('now'))
```

**`users`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
username      TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL              -- bcrypt
role          TEXT NOT NULL              -- workshop | shop_employee
shop_id       INTEGER REFERENCES shops(id)   -- NULL for workshop users
created_at    TEXT DEFAULT (datetime('now'))
```

**`shops`**
```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
name       TEXT NOT NULL
created_at TEXT DEFAULT (datetime('now'))
```

**`order_comments`**
```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE
author     TEXT NOT NULL
body       TEXT NOT NULL
created_at TEXT DEFAULT (datetime('now','localtime'))
```

**`customers`**
```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
name       TEXT NOT NULL
phone      TEXT NOT NULL
email      TEXT DEFAULT NULL
created_at TEXT DEFAULT (datetime('now','localtime'))
updated_at TEXT DEFAULT (datetime('now','localtime'))
```

**`technicians`**
```sql
id             INTEGER PRIMARY KEY AUTOINCREMENT
user_id        INTEGER REFERENCES users(id)
specialization TEXT DEFAULT NULL
created_at     TEXT DEFAULT (datetime('now','localtime'))
```

**`order_item_technicians`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
technician_id INTEGER NOT NULL REFERENCES technicians(id)
assigned_at   TEXT DEFAULT (datetime('now','localtime'))
completed_at  TEXT DEFAULT NULL
```

**`item_photos`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
photo_url     TEXT NOT NULL
photo_type    TEXT DEFAULT 'before_repair'   -- before_repair | after_repair | damage | delivery
uploaded_by   TEXT DEFAULT NULL
created_at    TEXT DEFAULT (datetime('now','localtime'))
```

**`services`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
name          TEXT NOT NULL
description   TEXT DEFAULT NULL
default_price REAL DEFAULT 0
created_at    TEXT DEFAULT (datetime('now','localtime'))
```

**`order_item_services`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
service_id    INTEGER NOT NULL REFERENCES services(id)
price         REAL NOT NULL
notes         TEXT DEFAULT NULL
created_at    TEXT DEFAULT (datetime('now','localtime'))
```

**`inventory_items`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
name          TEXT NOT NULL
category      TEXT DEFAULT NULL
stock_qty     REAL DEFAULT 0
unit          TEXT DEFAULT 'piece'
cost_per_unit REAL DEFAULT 0
created_at    TEXT DEFAULT (datetime('now','localtime'))
updated_at    TEXT DEFAULT (datetime('now','localtime'))
```

**`repair_parts_used`**
```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
order_item_id     INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id)
quantity          REAL NOT NULL
created_at        TEXT DEFAULT (datetime('now','localtime'))
```

**`item_locations`**
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
location      TEXT NOT NULL
updated_by    TEXT DEFAULT NULL
created_at    TEXT DEFAULT (datetime('now','localtime'))
```

### Status Field

The `orders.status` column stores the string name of the current state. Default is `'new'`.

Valid values: `new`, `received`, `inspection`, `waiting_approval`, `approved`, `rejected`, `in_repair`, `quality_check`, `ready_for_return`, `returned_to_shop`, `delivered`, `closed`

The column has no database-level CHECK constraint. Enforcement is done entirely in OrderService. Adding a CHECK constraint is safe and recommended for future hardening.

### Timestamp Conventions

- All timestamps stored as `TEXT` in ISO 8601 format: `2026-04-16T10:30:00.000Z`
- Use `datetime('now')` as column default for SQLite
- `updated_at` must be manually updated in every UPDATE statement
- `locked_at` is NULL until the order is delivered; once set it never changes

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_token ON orders(customer_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_history_order_id ON order_status_history(order_id);
```

The composite index `(shop_id, status)` supports the most common query pattern: shop employees filtering their orders by status.

### Migrations

New columns are added via idempotent migration blocks at the bottom of `db.js`:
```javascript
// Migration: add is_urgent to orders
const columns = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
if (!columns.includes('is_urgent')) {
  db.exec("ALTER TABLE orders ADD COLUMN is_urgent INTEGER DEFAULT 0");
}
```

Migrations run on every server startup. They must be safe to run multiple times.

---

## 7. SECURITY STANDARDS

### JWT Authentication

- Signing algorithm: HS256 (default for `jsonwebtoken`)
- Token expiry: 7 days
- Payload: `{ id, role, shop_id, username, iat, exp }`
- Secret: read from `JWT_SECRET` environment variable
- **Production requirement**: `JWT_SECRET` must be set and must not be the default development value. The server should refuse to start if `JWT_SECRET` is missing in production.

### Role-Based Access

Every protected route must apply both `requireAuth` and the appropriate role guard.

```javascript
router.post('/', requireAuth, requireRole('shop_employee'), handler);
router.patch('/:id/status', requireAuth, requireRole(['workshop', 'shop_employee']), handler);
```

Role hierarchy:
- `workshop` — can perform workshop-side transitions and view all shops
- `shop_employee` — can perform shop-side transitions and view only their shop

There is no superuser role in the current system. Admin operations are performed directly via seed script or database access.

### Shop Isolation

Shop employee queries must always be scoped to `req.user.shop_id`. This is enforced in the route handler, not the middleware. Whenever a `shop_employee` user lists, creates, or modifies orders, their `shop_id` must be applied.

### Input Validation

- All required fields must be checked before any database operation
- The `status` query parameter must be validated against the allowed enum before being used in a SQL query
- `limit` must be clamped to 1–500
- Phone numbers are stored without the leading `+` (e.g., `966501234567`)
- Cost values must be non-negative integers

### Rate Limiting

Rate limiting is not currently implemented at the application layer. In production, it should be applied at the Nginx level or via an Express middleware (`express-rate-limit`) on the auth and track endpoints to prevent brute-force attacks.

### CORS

CORS is restricted to:
- `http://localhost:*`
- `http://127.0.0.1:*`
- `http://192.168.x.x:*` (LAN subnet)
- The domain set in `PUBLIC_HOST`

The CORS whitelist is defined in `server/app.js`. When deploying a new domain, update `PUBLIC_HOST`.

### Production Requirements

Before a production deployment is considered valid:

1. `JWT_SECRET` must be set to a long random string (minimum 32 characters)
2. `NODE_ENV=production` must be set
3. `PUBLIC_HOST` must be set to the HTTPS domain
4. HTTPS must be terminated by Nginx with a valid certificate
5. The database file must be excluded from all backups that go to public storage
6. Logs must not contain JWT tokens or password hashes

---

## 8. UI DESIGN STANDARDS

### Design System

The design system is called **"Premium Artisan Light"**. It is defined in `client/src/index.css` as CSS variables.

Core attributes:
- White backgrounds with subtle elevation shadows
- Gold accent color: `#D4A843`
- RTL layout (`dir="rtl"` on `<html>`, `text-align: right`)
- Arabic font: Almarai (loaded via Google Fonts)
- Monospace font: JetBrains Mono (for order serial numbers and codes)

### Dashboard Layout

The dashboard (`Dashboard.jsx`) uses a **stat card + action list** structure:

1. Top row: stat cards showing counts per active status
2. Middle row (workshop only): branch breakdown table
3. Bottom row: action lists for orders requiring attention (received, waiting_approval)

Stat cards are non-interactive on click for now. Clicking a stat card does not navigate.

### Order Detail Layout

The order detail modal (`OrderDetail.jsx`) is a full-height right-side drawer on desktop, full-screen on mobile. Sections from top to bottom:

1. Header: order_number badge + status badge + close button
2. Customer info: name, phone, WhatsApp link
3. Items list: item_name, repair_description, cost
4. Action panel: role-aware buttons for the current status
5. Cost entry (workshop only, shown when in inspection)
6. Comments section
7. Status history (audit trail)

### Action Panels

Buttons in the action panel must follow these rules:

- The primary action (advance to next status) uses `.btn-gold` (gold background)
- Secondary or destructive actions use `.btn-ghost` (outlined)
- Buttons are right-aligned (RTL)
- Only show buttons that the current user's role can trigger
- If the order is locked (`locked_at` is set), all action buttons must be hidden

### Status Badges

Status badges are rendered by `StatusBadge.jsx`. Each status has a defined color:

| Status               | Color      |
|----------------------|------------|
| `new`                | Gray       |
| `received`           | Blue       |
| `inspection`         | Purple     |
| `waiting_approval`   | Orange     |
| `approved`           | Green      |
| `rejected`           | Red        |
| `in_repair`          | Indigo     |
| `quality_check`      | Teal       |
| `ready_for_return`   | Emerald    |
| `returned_to_shop`   | Cyan       |
| `delivered`          | Green dark |
| `closed`             | Gray dark  |

Do not invent new badge colors. If a new status is added, add it to the StatusBadge color map.

### Role-Based Button Visibility

| Button / Action              | Visible to        |
|------------------------------|-------------------|
| Set cost / advance to approval | workshop        |
| Advance in_repair / quality_check | workshop     |
| Confirm received at shop     | shop_employee     |
| Confirm payment + deliver    | shop_employee     |
| Close order                  | workshop          |
| Delete order                 | workshop (received only) |
| Print label                  | both              |
| Send WhatsApp notification   | both              |

If the user's role does not match, the button must not render at all — not be disabled, but absent.

### Mobile vs. Desktop

The sidebar is **visible only on desktop** via CSS (`@media (min-width: 768px)`). On mobile, the bottom tab bar renders instead. This is controlled entirely by CSS. There is no JavaScript toggle.

OrderList renders a card layout on mobile and a table on desktop. The breakpoint is 768px, detected via an inline `useMobile()` hook in OrderList.

### Arabic RTL

All visible text in the UI is Arabic. `<html dir="rtl">` is set in `index.html`. Tailwind's RTL utilities (`rtl:*`) are available but CSS variables and `text-align: right` handle most cases. Do not add `direction: ltr` to any element unless it contains Latin-only content (order numbers, barcodes).

---

## 9. FEATURE DEVELOPMENT PROCESS

When adding a new feature to this system, follow these steps in order. Do not skip steps.

**Step 1: Update this Playbook**
Before writing any code, update the relevant sections of this playbook to describe how the feature will work. This forces clear thinking before implementation and ensures the playbook stays current.

**Step 2: Update the Database (if needed)**
If the feature requires new columns or tables, add the migration to `db.js`. Migrations must be idempotent. If a new status is introduced, update the state machine documentation in this playbook and the TRANSITIONS registry in OrderService.

**Step 3: Update Services**
All new business logic goes into a service file. If the feature involves order status changes, the logic goes into `OrderService`. If it involves notifications, it goes into `NotificationService`. Do not put business logic in routes.

**Step 4: Update Routes**
Add or modify Express route handlers. Routes must call `requireAuth` and `requireRole`. Routes validate input and delegate to services. Routes must not contain business logic.

**Step 5: Update the Frontend**
Add or modify React components and API wrapper functions. All API calls go through `client/src/api/*.js`. New status values require updates to `StatusBadge.jsx` and any role-based button logic in `OrderDetail.jsx` or `ScanResult.jsx`.

**Step 6: Update Tests**
Add test cases in `server/tests/`. Tests use in-memory SQLite. Cover the new happy path and at least one failure case (invalid transition, missing field, wrong role).

### Business Logic Belongs in Services

If you find yourself writing an `if` statement in a route handler that makes a decision about what the system *should do*, stop. Move that logic to a service.

Route handlers answer: "Is this request valid? Who is asking? What did they send?"
Services answer: "Given this context, what should happen?"

---

## 10. FEATURE REMOVAL PROCESS

Removing a feature requires as much care as adding one.

**Step 1: Confirm the Feature Is Unused**
Check that no active orders depend on the feature's status or data. If the feature has a database column, verify no rows use it. Run `git grep` to confirm no other code references it.

**Step 2: Remove the UI**
Remove the relevant components, pages, and buttons. Ensure no broken imports remain.

**Step 3: Remove the Routes**
Delete or comment out the route handlers. Remove the route from the router file. Remove associated input validation.

**Step 4: Remove the Service Logic**
Remove the service method or the relevant code block. If the service file becomes empty, delete it.

**Step 5: Migrate the Database (if needed)**
SQLite does not support `DROP COLUMN` cleanly in all versions. Options:
- Leave the column in place with a deprecation comment in `db.js`
- Recreate the table without the column if hygiene is critical

If a status is removed from the state machine, ensure no orders exist with that status before removing it from TRANSITIONS.

**Step 6: Update This Playbook**
Remove all references to the feature from this document. Update the status list, transition table, and any relevant sections.

---

## 11. CODE QUALITY RULES

### No Silent Type Casting

Do not rely on JavaScript's implicit type coercion where a wrong type would produce a wrong result.

Bad:
```javascript
const cost = req.body.cost;  // could be "150" or 150
db.prepare('UPDATE orders SET cost = ?').run(cost);
```

Good:
```javascript
const cost = parseInt(req.body.cost, 10);
if (isNaN(cost) || cost < 0) return res.status(400).json({ error: 'Invalid cost' });
```

### No Magic Numbers

Named constants instead of bare numbers.

Bad:
```javascript
if (limit > 500) limit = 500;
```

Good:
```javascript
const MAX_PAGE_SIZE = 500;
if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
```

### No Direct SQL in Routes

Route handlers must not contain SQL statements. All database access goes through prepared statements in `db.js` helper functions, or through service methods.

### Services Handle Business Logic

If a function makes a decision about what the system *should do*, it belongs in a service. If it only reads or writes data, it can be a db helper. Routes do neither.

### Routes Validate and Delegate

A route handler has exactly two responsibilities:
1. Validate the incoming request (authentication, authorization, input)
2. Delegate to a service or database helper and return the result

### No Hardcoded Credentials

There are no usernames, passwords, JWT secrets, or phone numbers hardcoded in source files. All sensitive values come from environment variables or the database.

### Error Classes for Business Errors

Use the typed error classes in `server/errors/index.js` for all business errors:
- `InvalidTransitionError` — attempted an illegal state machine move
- `BusinessRuleViolationError` — pre-condition not met (e.g., cost not set)
- `PaymentRequiredError` — payment not confirmed before delivery
- `OrderLockedError` — attempted write on a locked order
- `PermissionError` — role does not allow this action

These classes allow `errorToHttpStatus(err)` to map to the correct HTTP status code consistently.

### Function Size

Functions should do one thing. If a function needs a comment at the top explaining what it does, consider whether it should be split into smaller named functions.

---

## 12. DEPLOYMENT RULES

### Environment Variables

| Variable       | Required in prod | Default (dev only)              | Purpose                              |
|----------------|------------------|---------------------------------|--------------------------------------|
| `PORT`         | No               | `3737`                          | Express listening port               |
| `NODE_ENV`     | Yes              | `development`                   | Enables/disables production behavior |
| `JWT_SECRET`   | Yes              | `dev-secret-change-in-production` | JWT signing key                    |
| `PUBLIC_HOST`  | Yes              | (none)                          | HTTPS domain for QR URLs and CORS    |

**The server must refuse to start** if `NODE_ENV === 'production'` and `JWT_SECRET` is the default development value.

### Database Configuration

- Location: `server/data/workshop.db`
- This file is git-ignored and must never be committed
- WAL mode is enabled by `db.js` on startup
- Create a daily backup via cron or GitHub Actions before any deployment
- Never run `server/seed.js` in production unless intentionally resetting the database

### Production Stack

```
Client browser
    → Nginx (HTTPS, port 443)
       → Static files (client/dist/)
       → Proxy /api/* to localhost:3737
           → Express server (PM2, port 3737)
               → SQLite (server/data/workshop.db)
```

### Server Startup Checks

On startup, the server must verify:
1. `JWT_SECRET` is set and not the development default (in production)
2. The `server/data/` directory exists and is writable
3. Database initialization and migrations complete without error
4. All routes are registered

If any of these checks fail, the server must exit with a non-zero code and a clear error message. It must not silently continue in a broken state.

### PM2 Configuration

Process management is via PM2. The configuration file is `ecosystem.config.cjs`. Key settings:
- `instances: 1` — SQLite does not support multi-process writes
- `watch: false` in production
- `env_production.JWT_SECRET` must be set to the real secret
- `env_production.NODE_ENV = "production"`

### Nginx Configuration

Nginx handles:
- HTTPS termination (port 443)
- Serving the static React build (`client/dist/`)
- Proxying `/api/*` to `http://localhost:3737`
- Redirecting HTTP to HTTPS

See `DEPLOYMENT_AWS.md` for the full Nginx config template.

### CI/CD

GitHub Actions handles automatic deployment on push to `master`. The workflow:
1. SSH into the EC2 instance
2. Pull latest code
3. Run `npm install` for server
4. Build the client (`npm run build --prefix client`)
5. Reload PM2 (`pm2 reload ecosystem.config.cjs`)

A separate backup workflow runs daily and saves a compressed snapshot of `workshop.db` to GitHub Actions artifacts.

### Bluetooth Printing Constraint

Web Bluetooth (`@mmote/niimbluelib`) only works in **Chrome or Edge** on **HTTPS or localhost**. Safari and Firefox are not supported. The iPhone QR flow intentionally avoids Bluetooth — customers only ever see the public tracking page, which requires no special browser.

---

## 13. CHANGE HISTORY

This section is an append-only log. Every significant change to the system must be recorded here with the date and a brief description.

---

```
2026-04-17
Phase 7 — Data Consistency applied.
7.1: Phone normalization: normalizePhone() helper enforces 966XXXXXXXXX format on all write paths.
     Existing DB records normalized via idempotent migration in db.js.
7.2: Cost validation confirmed on all three cost endpoints (PATCH /cost, POST /items/:id/cost, POST /diagnosis).
7.3: Required field validation hardened in POST /api/orders (phone, name, items, workshop_comment).
7.4: UNIQUE INDEX on orders.customer_token (INV-12 now enforced at DB level).
7.5: 10-concurrent-order test confirms order_number uniqueness under load (INV-11).
7.6: orders.cost sync validated — confirmed equal to SUM(order_items.estimated_cost) after any update.
7.7: Length guards added: notes max 2000 chars, workshop_comment max 1000 chars.
     Test suite: 26 new tests, 120 total passing.
Stale test fixes: diagnosing→inspection in test fixtures; 403→409 on locked order; ready_for_pickup→ready_for_return; status_label for received.
```

---

```
2026-04-17
Phase 6 — System Stabilization applied.
6.1: Production startup guard: server exits on default JWT_SECRET in production.
6.2: orders.CREATE TABLE DEFAULT changed from 'received' to 'new' (INV-01 alignment).
6.4: GET /api/orders/:id/history now enforces shop isolation for shop_employee role.
6.5: requireRole() now accepts string or array of roles (backward compatible).
6.6: POST /api/orders/:id/confirm-payment restricted to shop_employee (ADR-013).
6.7: PUT /api/order-items/:id and POST /api/order-items/:id/photos restricted to workshop.
6.8: Removed duplicate requireAuth from PATCH /api/orders/:id/status.
6.9: OrderLockedError and all locked-order guards now return 409 Conflict (not 403).
6.10: CLAUDE_PLAYBOOK.md updated: all database tables documented, final_cost DEFAULT corrected.
```

---

```
2026-04-16
Initial system established.
Full order lifecycle management from new to closed.
Role-based access: workshop and shop_employee.
Order state machine with 12 statuses implemented in OrderService.
Customer QR code tracking via /track/:token (public, no login).
Cost approval workflow: customer approves/rejects via phone.
WhatsApp notification payloads generated by NotificationService.
Niimbot B21 Bluetooth label printing via Web Bluetooth API.
LabelCanvas renders customer label (QR) and workshop label (barcode).
JWT authentication with 7-day expiry.
Shop isolation: employees see only their own shop's orders.
Order locking after delivered status (locked_at field).
Audit trail: all status changes written to order_status_history.
Multi-item orders: each order can have multiple order_items.
Payment confirmation required before delivered transition.
Dashboard with stat cards and branch breakdown.
Public customer tracking page (TrackPage.jsx).
Atomic createOrder transaction preventing race conditions on order_number.
Idempotent database migrations in db.js.
CI/CD via GitHub Actions to AWS EC2.
Daily SQLite backup via GitHub Actions artifacts.
```

---

*End of CLAUDE_PLAYBOOK.md*
*Last updated: 2026-04-16*
*Maintained by: Engineering team — update this document with every system change.*
