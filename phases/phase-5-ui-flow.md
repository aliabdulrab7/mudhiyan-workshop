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
- [ ] Login page (all roles)

### Branch Admin
- [ ] Dashboard
- [ ] New order form (multi-item)
- [ ] Order list (filterable)
- [ ] Order detail page (with status timeline)
- [ ] Label print page (two QR labels)
- [ ] Pickup + payment screen

### Technician
- [ ] Assigned orders list
- [ ] Order detail (technician view)
- [ ] Diagnosis form
- [ ] Quality check screen

### Workshop Admin
- [ ] Full order list
- [ ] Reports dashboard
- [ ] Technician management
- [ ] Inventory management
- [ ] Services management
- [ ] Close order / cancel order actions

### Customer (public)
- [ ] `/track/:token` status page
- [ ] Approve / Reject UI (WAITING_APPROVAL only)
- [ ] Confirmation screen post-action

---

## Implementation Checklist

### Foundation
- [ ] Auth flow: login → JWT stored → role-based routing
- [ ] Route guards: role-based page access
- [ ] API client: all fetch wrappers with auth headers
- [ ] RTL layout base (Arabic, Almarai font loaded)
- [ ] Design system CSS variables in place
- [ ] Mobile / desktop layout (bottom tabs + sidebar)

### Branch Admin Screens
- [ ] Dashboard — active order counts, today's intake
- [ ] New order form
  - [ ] Customer search or quick create
  - [ ] Add multiple items (item type, description, quantity, notes)
  - [ ] Submit → POST /orders
  - [ ] On success: redirect to label print page
- [ ] Order list with filters
- [ ] Order detail with status history timeline
- [ ] Label print page
  - [ ] Customer QR code rendered
  - [ ] Workshop QR code rendered
  - [ ] Print two copies (Niimbot B21 or standard print)
- [ ] Pickup screen
  - [ ] Show invoice total
  - [ ] Select payment method (cash / card / transfer)
  - [ ] POST /invoices/:id/pay
  - [ ] On success: POST /orders/:id/status { DELIVERED }

### Technician Screens
- [ ] Assigned orders list (only orders assigned to this technician)
- [ ] Order detail (technician view — no financial data)
- [ ] Diagnosis form: repair description + estimated cost
  - [ ] POST /order-items/:id/diagnosis
  - [ ] Auto-triggers status transition
- [ ] Quality check screen: pass → READY_FOR_PICKUP, fail → IN_REPAIR

### Workshop Admin Screens
- [ ] Full order list with all filters
- [ ] Reports dashboard (totals, revenue, pending approvals)
- [ ] Close order button (DELIVERED → CLOSED, admin only)
- [ ] Cancel order button (pre-DELIVERED, admin only)
- [ ] Technician management (CRUD)
- [ ] Inventory management (CRUD + stock updates)
- [ ] Services catalog (CRUD)

### Customer Tracking Page
- [ ] `GET /track/:token` data loaded
- [ ] Status displayed in Arabic with human-readable label
- [ ] Item list shown
- [ ] Estimated cost shown (if applicable)
- [ ] Approve / Reject buttons shown only when WAITING_APPROVAL
- [ ] Approve → POST /track/:token/approve → confirmation shown
- [ ] Reject → POST /track/:token/reject → confirmation shown
- [ ] Mobile-optimized, no login required

### Validation
- [ ] New order form: at least one item required
- [ ] Diagnosis form: cost field must be a number ≥ 0
- [ ] Pickup screen: payment method must be selected before confirming
- [ ] All forms show Arabic error messages
- [ ] All status labels shown in Arabic
- [ ] Role-based route guard blocks wrong-role access
- [ ] Label print page tested on Niimbot B21 (or equivalent)
- [ ] Customer tracking page tested on mobile (iPhone Safari)
- [ ] Approve/Reject on customer page only visible when WAITING_APPROVAL

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
