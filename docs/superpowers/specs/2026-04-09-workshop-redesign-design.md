# Mudhiyan Workshop — Full Redesign Spec
**Date:** 2026-04-09
**Status:** Approved

---

## Overview

A full redesign of the Mudhiyan workshop management app. The system serves a central jewelry repair workshop that receives items from multiple jewelry shops. Each shop has employees who register orders; the workshop updates status and sets costs; customers track their items and approve costs via a public link — no login required.

---

## 1. User Roles & Access

### Roles
| Role | Count | Description |
|------|-------|-------------|
| `workshop` | 1 | Central repair workshop — sees all orders from all shops, sets cost, updates status |
| `shop_employee` | Up to 12 per shop | Registers orders, views own shop's orders only, prints labels |
| Customer | N/A | No login — accesses order status via unique tracking link |

### Access Matrix
| Action | Workshop | Shop Employee |
|--------|----------|---------------|
| View all orders (all shops) | ✓ | ✗ |
| View own shop's orders | ✓ | ✓ |
| Create order | ✗ | ✓ |
| Set cost | ✓ | ✗ |
| Update status | ✓ | ✗ |
| Print labels | ✓ | ✓ |
| Customer tracking page | public | public |

---

## 2. Database Schema

### New tables

```sql
CREATE TABLE shops (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id       INTEGER REFERENCES shops(id),  -- NULL for workshop user
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('workshop', 'shop_employee')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

### Modified `orders` table
New columns added via migration:
```sql
ALTER TABLE orders ADD COLUMN shop_id       INTEGER REFERENCES shops(id);
ALTER TABLE orders ADD COLUMN cost          INTEGER NOT NULL DEFAULT 0;  -- in SAR, whole amounts only (e.g. 50 = 50 SAR)
ALTER TABLE orders ADD COLUMN customer_token TEXT NOT NULL DEFAULT '';   -- UUID, generated on insert
```

Updated status enum: `received | pending_approval | in_progress | ready | delivered`

### Status flow
```
received
  ↓  (workshop sets cost after inspection)
  ├─ cost = 0 → in_progress   (skip approval)
  └─ cost > 0 → pending_approval
                  ↓  (customer taps "أوافق")
               in_progress
                  ↓
               ready
                  ↓
               delivered
```

---

## 3. Backend API

### Authentication
- `POST /api/auth/login` — `{ username, password }` → `{ token, role, shop_id }`
- JWT signed with `JWT_SECRET` env var, 7-day expiry
- All internal endpoints require `Authorization: Bearer <token>` header
- Public endpoints: `GET /api/track/:token`, `POST /api/track/:token/approve`

### Orders endpoints (modified/new)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/orders` | shop_employee | Create order. Generates `customer_token` (UUID). Sets `shop_id` from JWT. |
| `GET` | `/api/orders` | any logged in | Workshop sees all; shop_employee sees own shop only (enforced server-side). |
| `GET` | `/api/orders/:id` | any logged in | Same scoping rules. |
| `GET` | `/api/orders/barcode/:value` | any logged in | Lookup by order_number. |
| `PATCH` | `/api/orders/:id/status` | workshop | Update status. |
| `PATCH` | `/api/orders/:id/cost` | workshop | Set cost. If cost > 0 → status = `pending_approval`. If cost = 0 → status = `in_progress`. |
| `GET` | `/api/track/:token` | public | Returns: `order_number`, `piece_type`, `status`, `cost`, `created_at`. Never exposes phone/notes. |
| `POST` | `/api/track/:token/approve` | public | Validates token, moves `pending_approval` → `in_progress`. No order ID needed. |
| `GET` | `/api/stats` | any logged in | Workshop sees all-shop stats; shop_employee sees own shop. |

### Seed script
`server/seed.js` — creates initial workshop user + example shop + shop employee. Run once on setup.

---

## 4. Frontend — Internal App

### Design System (full replacement)
Replace "Luxury Artisan Dark" with light mode:

```css
--bg-base:       #F8F9FB;   /* page background */
--bg-surface:    #FFFFFF;   /* cards */
--bg-sidebar:    #1B2B5E;   /* navy sidebar */
--primary:       #1B2B5E;   /* navy — buttons, headings */
--accent:        #C9973A;   /* gold — badges, borders, highlights */
--text-primary:  #111827;
--text-secondary:#4B5563;
--text-muted:    #9CA3AF;
--gold-border:   rgba(201,151,58,0.3);
--radius:        8px;
--radius-lg:     12px;
```

Sidebar background: navy (`#1B2B5E`). Active nav item: gold text + left gold border. All buttons: navy fill with white text; ghost buttons: navy border + text.

### Route protection
Wrap all internal routes in `<PrivateRoute>` — redirects to `/login` if no valid JWT in localStorage.

### Pages & Components

**`/login`** — standalone page (no sidebar). Username + password form. On success stores JWT + role + shop_id in localStorage, redirects to `/`.

**`Dashboard`** — stats cards updated to include `pending_approval` count. Workshop sees all-shop breakdown; shop_employee sees own shop.

**`OrderList`** — filter tabs: `الكل | استُلم | بانتظار الموافقة | قيد التنفيذ | جاهز | سُلِّم`. Workshop shows shop filter dropdown. Card layout on mobile, table on desktop (unchanged).

**`NewOrder`** (shop_employee only) — unchanged flow, but now attaches `shop_id` from JWT automatically.

**`CostEditor`** (new component) — shown in order detail when status is `received` and user is `workshop`. Simple SAR input + "تحديد السعر" button. On submit calls `PATCH /api/orders/:id/cost`. On success shows the appropriate wa.me button.

**wa.me buttons** (in order detail / ScanResult):
- Status `pending_approval` → "أرسل رابط الموافقة" — pre-filled message: `مرحباً [name]، قطعتك جاهزة للتقييم. الرسوم: [cost] ريال. للموافقة: [tracking URL]`
- Status `ready` → "أبلغ العميل بالاستلام" — pre-filled message: `مرحباً [name]، قطعتك جاهزة للاستلام من المحل. رقم الطلب: [order_number]`

---

## 5. Customer Tracking Page (`/track/:token`)

### Layout
No sidebar, no navbar. Centered card, max-width 480px, mobile-first. Header shows shop logo/name + tagline.

### Content
1. Order number badge (gold, JetBrains Mono)
2. Piece type
3. Progress tracker — horizontal steps:
   `استُلم → بانتظار الموافقة → قيد التنفيذ → جاهز → سُلِّم`
   Active step: navy fill. Completed: gold checkmark. `pending_approval` step only shown when relevant.
4. Status message (Arabic, per state — see below)
5. Cost approval section (only when `pending_approval`)

### Status messages
| Status | Message |
|--------|---------|
| `received` | تم استلام قطعتك، سيتم تقييمها قريباً |
| `pending_approval` | يرجى الموافقة على تكلفة الإصلاح أدناه |
| `in_progress` | قطعتك قيد التنفيذ |
| `ready` | ✓ قطعتك جاهزة للاستلام! |
| `delivered` | تم التسليم، شكراً لثقتك |

### Cost approval UI (pending_approval only)
```
┌─────────────────────────────────┐
│  رسوم الإصلاح                   │
│  ٥٠ ريال سعودي                  │
│                                 │
│  [ أوافق على السعر ]            │  ← navy button, gold text
└─────────────────────────────────┘
```
On tap → `POST /api/track/:token/approve`. Button replaced with "✓ تمت الموافقة، جارٍ التنفيذ".

### API endpoint for this page
`GET /api/track/:token` — if token not found → 404 page ("الطلب غير موجود").

---

## 6. Label Printing (Niimbot B21)

### Two labels per order
Both labels are 320×240px (40mm×30mm @ 203 DPI).

**Customer label:**
- QR code → `http://[LAN-IP]:5173/track/:customer_token`
- Order number (JetBrains Mono, large)
- Customer name + piece type
- Small text: "امسح للمتابعة والموافقة"

**Shop label:**
- CODE128 barcode of `order_number`
- Order number + customer name + piece type + date
- No QR (internal use only)

### Print flow
`useLabelPrint.js` updated to accept an array of canvases and print them sequentially in one Bluetooth session. `LabelCanvas.jsx` renders both canvases side by side (hidden off-screen); the print button triggers both.

If customer label QR resolves to localhost → show red warning on customer canvas (same existing behavior).

---

## 7. Non-Goals (MVP)

- No OTP / phone verification for customer approval
- No email notifications
- No WhatsApp Business API (wa.me one-click only)
- No shop self-registration UI (accounts created via seed script)
- No password reset flow
- No multi-language support beyond Arabic

---

## 8. Implementation Strategy

Deploy parallel agents — all work streams are independent after the DB migration is done:

| Agent | Work stream |
|-------|-------------|
| Agent 1 | DB migrations + seed script + auth endpoints (`/api/auth/login`, JWT middleware) |
| Agent 2 | Order endpoints update (scoping, cost, approve, track) |
| Agent 3 | Design system replacement (CSS variables, light mode, navy+gold) + Layout/sidebar update |
| Agent 4 | Frontend auth (login page, PrivateRoute, JWT storage) + role-based UI |
| Agent 5 | CostEditor + wa.me buttons + pending_approval flow (internal) |
| Agent 6 | Customer tracking page `/track/:token` |
| Agent 7 | Two-label printing (LabelCanvas + useLabelPrint update) |

Agents 1 & 2 should complete first as they establish the API contract. Agents 3–7 can run in parallel after that.
