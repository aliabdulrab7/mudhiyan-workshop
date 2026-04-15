# Phase 5 — UI Flow

> ⚠️ Do not proceed until tested and verified.
> ⚠️ All endpoints must be manually validated before moving forward.
> ⚠️ Phases 1, 2, 3, and 4 must be fully completed before starting this phase.

---

## Purpose

Build the full user interface for all roles.
This phase consumes the APIs built in phases 1–4.
UI must match the design system: Arabic RTL, Almarai font, gold accents (#D4A843), white backgrounds.

---

## Requirements

### Design System
- Language: Arabic (RTL, `dir="rtl"`)
- Fonts: Almarai (Arabic UI) + JetBrains Mono (order numbers/codes)
- Theme: "Premium Artisan Light" — white backgrounds, subtle shadows, gold accents
- Key color: `#D4A843` (gold)
- Key classes: `.order-stamp`, `.btn-gold`, `.btn-ghost`
- Mobile-first layout with bottom tab bar on mobile, sidebar on desktop
- No JS toggle for sidebar — CSS only

### Role-Based Views

#### Branch Admin Views
- Login page
- Dashboard: active orders, pending pickups, today's intake
- New order form: customer info + add multiple items
- Order detail view: status, items, timeline
- Print label page: Customer QR + Workshop QR (two copies)
- Pickup / payment page: collect payment + confirm delivery

#### Technician Views
- Login page
- My assigned orders list
- Order detail: item info, diagnosis form
- Diagnosis form: repair description + estimated cost
- Repair progress update
- Quality check pass/fail action

#### Workshop Admin Views
- All of the above
- Full order list with filters (branch, status, date)
- Close order action (DELIVERED → CLOSED)
- Cancel order action
- Reports dashboard
- Technician management
- Inventory management
- Services catalog management

#### Customer View (public — no login)
- `/track/{tracking_token}` — order status page
  - Shows: order number, items, current status, repair description, estimated cost
  - WAITING_APPROVAL: shows Approve / Reject buttons prominently
  - Post-approval: shows confirmation message
  - Arabic language, mobile-optimized

---

## Screen Inventory

### Auth
- [x] Login page (all roles)

### Branch Admin
- [x] Dashboard
- [x] New order form (multi-item)
- [x] Order list (filterable)
- [x] Order detail page (with status timeline)
- [x] Label print page (two QR labels)
- [x] Pickup + payment screen

### Technician
- [ ] Assigned orders list — **BLOCKED: no technician role in DB**
- [ ] Order detail (technician view) — **BLOCKED**
- [ ] Diagnosis form — **BLOCKED**
- [ ] Quality check screen — **BLOCKED**

### Workshop Admin
- [x] Full order list
- [x] Reports dashboard
- [x] Technician management
- [x] Inventory management
- [x] Services management
- [x] Close order / cancel order actions

### Customer (public)
- [x] `/track/:token` status page
- [x] Approve / Reject UI (WAITING_APPROVAL only)
- [x] Confirmation screen post-action

---

## Implementation Checklist

### Foundation
- [x] Auth flow: login → JWT stored → role-based routing
- [x] Route guards: role-based page access
- [x] API client: all fetch wrappers with auth headers
- [x] RTL layout base (Arabic, Almarai font loaded)
- [x] Design system CSS variables in place
- [x] Mobile / desktop layout (bottom tabs + sidebar)

### Branch Admin Screens
- [x] Dashboard — active order counts, today's intake
- [x] New order form
  - [x] Add multiple items (item type, description, quantity, notes)
  - [x] Submit → POST /orders
  - [x] On success: redirect to label print page
- [x] Order list with filters
- [x] Order detail with status history timeline
- [x] Label print page
  - [x] Customer QR code rendered
  - [x] Workshop QR code rendered
  - [x] Print two copies (Niimbot B21 or standard print)
- [x] Pickup screen
  - [x] Select payment method (cash / card / transfer)
  - [x] POST /orders/:id/confirm-payment
  - [x] On success: POST /orders/:id/status { DELIVERED }

### Technician Screens
- [ ] Assigned orders list — **BLOCKED: requires technician role in DB schema**
- [ ] Order detail (technician view) — **BLOCKED**
- [ ] Diagnosis form — **BLOCKED** (endpoint requires workshop role)
- [ ] Quality check screen — **BLOCKED**

### Workshop Admin Screens
- [x] Full order list with all filters
- [x] Reports dashboard (totals, pending approvals)
- [x] Close order button (DELIVERED → CLOSED, admin only)
- [x] Cancel order button (pre-DELIVERED, admin only)
- [x] Technician management (CRUD)
- [x] Inventory management (CRUD + stock updates)
- [x] Services catalog (CRUD)

### Customer Tracking Page
- [x] `GET /track/:token` data loaded
- [x] Status displayed in Arabic with human-readable label
- [x] Estimated cost shown (if applicable)
- [x] Approve / Reject buttons shown only when WAITING_APPROVAL
- [x] Approve → POST /track/:token/approve → confirmation shown
- [x] Reject → POST /track/:token/reject → confirmation shown
- [x] Mobile-optimized, no login required

### Validation
- [x] New order form: at least one item required
- [x] Pickup screen: payment method must be selected before confirming
- [x] All forms show Arabic error messages
- [x] All status labels shown in Arabic
- [x] Role-based route guard blocks wrong-role access
- [x] Approve/Reject on customer page only visible when WAITING_APPROVAL

---

## Completed Tasks

### Completed (2026-04-16)

- [x] Customer TrackPage: added reject button alongside approve button (WAITING_APPROVAL)
- [x] API client wrappers: `client/src/api/technicians.js`, `inventory.js`, `services.js`, `orderItems.js`
- [x] TechniciansPage (`/technicians`) — workshop admin: list + add technicians
- [x] InventoryPage (`/inventory`) — workshop admin: list + add + stock adjust
- [x] ServicesPage (`/services`) — workshop admin: list + add + inline edit
- [x] ReportsPage (`/reports`) — workshop admin: status totals + branch breakdown + pending approvals alert
- [x] App.jsx + Layout.jsx: all new routes and workshop-only nav items wired

### Known Gap — Technician Role Views

The DB schema enforces `role IN ('workshop', 'shop_employee')` — there is no `technician` login role.
The `/api/order-items/:id/diagnosis` endpoint also requires `workshop` role.
Standalone technician login views (assigned orders list, diagnosis form, quality check screen) **cannot be built** without a backend change to add a `technician` role. This must be addressed in a future backend phase before resuming technician UI.

---

## Notes

- This phase consumes all APIs from Phases 1–4. No new backend logic should be added here.
- If a backend gap is discovered during UI build, stop, fix the backend, then return to UI.
- Niimbot B21 printing uses Web Bluetooth — only works in Chrome/Edge on HTTPS or localhost.
- iPhone QR scan flow opens `/track/:token` directly — no camera permissions needed on mobile.
- WhatsApp notification links use `wa.me/966XXXXXXXXX` format (no `+`).
