# Ultraplan Phase 1 — Repair Cost & Notes

## Status: Completed — 2026-04-17

---

## Purpose

Expose repair cost and item-level detail to customers on the tracking page, and fix two silent bugs that have existed since the Phase 6 state machine overhaul.

---

## Phase Summary

Customers previously had no visibility into what each item costs or what repair is being performed. The tracking page showed only a single lump-sum cost with no breakdown. Additionally, two bugs were silently suppressing correct behavior: the CostEditor WhatsApp link never fired, and item quantities were always saved as 1 regardless of what staff entered.

---

## Design Decisions

1. **No new database columns** — all required data (`item_name`, `quantity`, `repair_description`, `estimated_cost`) already existed in `order_items` and was already returned by `GET /api/track/:token`.

2. **`workshop_comment` remains hidden from customers** — it is internal technical notes for the workshop. `repair_description` is the customer-facing field, set during inspection.

3. **Items section is conditional** — only renders when `order.items` exists and has entries. Graceful for orders created before the items system was introduced.

4. **Approval breakdown is conditional** — per-item breakdown only shows when at least one item has `estimated_cost > 0`. Summary "total" row only shown when more than one item has a cost.

5. **Quantity clamped 1–99 on write** — prevents bad data if a non-numeric value or zero is sent from the form.

---

## Files Modified

| File | Change |
|------|--------|
| `client/src/components/CostEditor.jsx:17` | Fixed stale status check `pending_approval` → `waiting_approval`. WhatsApp link was silently broken. |
| `server/db.js:388` | Fixed quantity hardcode from `1` to `Math.min(99, Math.max(1, parseInt(item.quantity) \|\| 1))`. |
| `client/src/pages/TrackPage.jsx` | Added items section (item name, quantity, repair description, per-item cost). Enhanced approval section with per-item cost breakdown. |

---

## Code Implementation

### 1. CostEditor.jsx — status check fix

```diff
- if (updated.status === 'pending_approval') {
+ if (updated.status === 'waiting_approval') {
```

### 2. db.js — quantity fix

```diff
- 1,               // quantity (no longer tracked per-item)
+ Math.min(99, Math.max(1, parseInt(item.quantity, 10) || 1)), // quantity
```

### 3. TrackPage.jsx — items section

Added between `piece_type` display and progress tracker:
- Each item shows: `item_name` (with `× N` quantity badge if > 1), `repair_description` (muted, if set), `estimated_cost` (amber, if > 0)
- Items are styled as individual pill cards

### 4. TrackPage.jsx — per-item cost breakdown in approval

Added above the lump-sum total in the `waiting_approval` approval card:
- Per-item rows: item name + cost
- Summary "total" row (with divider) when more than one item has a cost
- Lump-sum total display retained below for visual weight

---

## Testing Steps

1. **Create order with 2+ items, different quantities** — verify quantities saved correctly in GET response (not all 1)
2. **Set per-item costs during inspection** — navigate to an order in `inspection` status, set costs
3. **Open tracking link while `waiting_approval`** — verify per-item breakdown and total visible
4. **Approve from tracking page** — verify transition to `in_repair`, items section still visible
5. **CostEditor WhatsApp fix** — set cost via ScanResult's CostEditor (scan page, `received` status order) → verify WhatsApp opens
6. **Build**: `npm run build --prefix client` — no errors
7. **Tests**: `npm test --prefix server` — 135/135 pass

---

## Verification Result

- `npm test --prefix server`: **135/135 passed**
- `npm run build --prefix client`: **clean build**
