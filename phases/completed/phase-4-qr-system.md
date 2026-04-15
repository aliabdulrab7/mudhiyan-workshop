# Phase 4 — QR Tracking System

> ⚠️ Do not proceed until tested and verified.
> ⚠️ All endpoints must be manually validated before moving forward.
> ⚠️ Phases 1, 2, and 3 must be fully completed before starting this phase.

---

## Purpose

Build the public-facing customer QR tracking system.
Customers scan a QR code on their label and can:
- View their order status
- Approve or reject repair (when status is WAITING_APPROVAL)

No authentication is required for these endpoints.
Internal database IDs must never be exposed.

---

## Requirements

### Public Tracking Page
- URL format: `/track/{tracking_token}`
- `tracking_token` is a secure random string generated at order creation
- Must NOT expose `order.id` or any internal integer ID
- Page shows:
  - Order number (tracking_number)
  - Item list with descriptions
  - Current status (human-readable)
  - Repair description (if available)
  - Estimated cost (if applicable)
  - Approval buttons (only when status = WAITING_APPROVAL)

### Approval / Rejection Flow
- `POST /track/:token/approve` — only valid when `status = WAITING_APPROVAL`
  - Triggers `OrderService.transition(WAITING_APPROVAL → APPROVED)`
- `POST /track/:token/reject` — only valid when `status = WAITING_APPROVAL`
  - Triggers `OrderService.transition(WAITING_APPROVAL → REJECTED)`
- Both endpoints are public (no auth) but token-gated
- After approve: workflow continues to IN_REPAIR
- After reject: workflow moves to READY_FOR_PICKUP (no repair performed)
- If status is not WAITING_APPROVAL when called → 400 error

### QR Label Content
Two QR codes printed per order at creation:
1. **Customer QR** → `https://{domain}/track/{tracking_token}`
2. **Workshop QR** → internal use (can use tracking_number or internal URL)

### Security Rules
- `/track/:token` is read-only for anyone without auth
- Approve/reject actions are write but token-gated (no auth required)
- Token must be long enough to be unguessable (min 16 chars, random)
- No brute-force: token space must be large (use UUID or crypto-random)

---

## Implementation Checklist

### Token Generation (verify from Phase 3)
- [x] `customer_token` generated via `crypto.randomUUID()` inside `createOrder` transaction
- [x] Token is not derived from order ID or date (UUID is random)
- [x] Token is 36 chars (UUID format) — well above 16 char minimum

### API Endpoints (no auth)
- [x] `GET /api/track/:token` — public order status page data
  - [x] Returns `tracking_number`, `status`, `status_label`, `items[]`, `estimated_cost`, `cost_status`
  - [x] Returns `show_approval_buttons: true` only when status = `waiting_approval`
  - [x] Returns 404 if token not found
  - [x] Never returns internal `id`, `order_id`, `phone`, `notes`, or `customer_token`
- [x] `POST /api/track/:token/approve`
  - [x] Explicit guard: `order.status !== 'waiting_approval'` → 400
  - [x] Calls `OrderService.transition(orderId, 'approved', system_user, notes)`
  - [x] Returns updated `status` + `status_label`
- [x] `POST /api/track/:token/reject`
  - [x] Explicit guard: `order.status !== 'waiting_approval'` → 400
  - [x] Calls `OrderService.transition(orderId, 'rejected', system_user, notes)`
  - [x] Returns updated `status` + `status_label`

### QR Code Generation
- [x] `customer_token` returned in order creation response — frontend builds QR URL from it
- [x] QR URL format: `https://{domain}/track/{customer_token}` (constructed client-side in LabelCanvas)
- [x] Workshop QR: uses `order_number` / barcode (existing label flow, finalised in Phase 5)

### Validation
- [x] `GET /track/:token` with invalid token → 404
- [x] `POST /track/:token/approve` when status is not `waiting_approval` → 400
- [x] `POST /track/:token/reject` when status is not `waiting_approval` → 400
- [x] `POST /track/:token/approve` twice → second call returns 400 (idempotent)
- [x] Confirmed: no internal IDs in any `/track/` response
- [x] Confirmed: `rejected` → `ready_for_pickup` is the only valid next transition (not `in_repair`)

### Status Display Labels (Arabic)
- [x] All 11 states have Arabic labels in `STATUS_LABELS` map in `routes/track.js`

---

## Completed Tasks

- Upgraded `GET /api/track/:token` to return `items[]`, `status_label`, `tracking_number`, `estimated_cost`
- Added explicit `waiting_approval` guard to approve and reject endpoints
- Added `STATUS_LABELS` map covering all 11 FSM states
- 27/27 tests passing in `server/tests/phase4.test.js`

---

## Notes

- The `system_user` for approve/reject transitions (no auth context) should be a designated system account or a `null` user with a recorded note.
- Notification triggers (WhatsApp/SMS) for WAITING_APPROVAL and READY_FOR_PICKUP are side effects inside `OrderService.transition()` — defined in spec, wired up here if notification service is ready.
- Do not build the full UI in this phase — just the API endpoints.
- QR image rendering for labels will be finalized in Phase 5.
