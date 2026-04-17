# Phase 9 — UI Refinement

> ⚠️ Do not proceed until Phase 8 is fully completed and validated.
> ⚠️ Response format changes from Phase 8 must be applied before testing this phase.
> ⚠️ Test every screen at 375px width (mobile) before marking complete.

---

## Purpose

Enforce role-based rendering consistently, close UX gaps in daily operations, and ensure the mobile-first design works correctly for all staff roles.

This phase produces no new backend features — it aligns the frontend with the rules documented in `SYSTEM_INVARIANTS.md` (INV-14) and `CLAUDE_PLAYBOOK.md` section 8.

---

## Status: Completed — 2026-04-17 (9.9 deferred — optional, not confirmed by team)

---

## Tasks

### 9.1 — Locked Order UI Audit

An order with `locked_at` set is permanently read-only. The UI must not render any write controls.

Review `OrderDetail.jsx` and `ScanResult.jsx`:
- All action buttons (status transitions, cost entry, edit fields) must be **absent from the DOM** when `order.locked_at` is set
- Do not use `disabled` — remove from DOM entirely
- The action panel container itself should not render

**Invariant reference:** INV-06, CLAUDE_PLAYBOOK.md section 8 "Action Panels"

Check:
- Status transition buttons
- Cost entry form
- Edit customer name / phone
- Add comment input
- Confirm payment button

### 9.2 — Role Button Visibility Audit

Every action button must be conditionally rendered based on `user.role`. Reference table from `CLAUDE_PLAYBOOK.md` section 8:

| Button / Action | Visible to |
|----------------|------------|
| Set cost / advance to approval | workshop |
| Advance in_repair / quality_check | workshop |
| Confirm received at shop | shop_employee |
| Confirm payment + deliver | shop_employee |
| Close order | workshop |
| Delete order | workshop (received status only) |
| Print label | both |
| Send WhatsApp notification | both |

Any button visible to the wrong role must be removed from the DOM (not disabled).

**Invariant reference:** INV-14

### 9.3 — Status Badge Completeness

`StatusBadge.jsx` must have a defined color for every status in the state machine.

Current statuses requiring a badge color:
`new`, `received`, `inspection`, `waiting_approval`, `approved`, `rejected`, `in_repair`, `quality_check`, `ready_for_return`, `returned_to_shop`, `delivered`, `closed`

If `cancelled` was kept in Phase 6 (Option A), it also requires a badge color.

Any unrecognized status must render a clearly visible fallback (e.g., gray with the raw status string), not silently render nothing.

Add a test or visual audit confirming all statuses render a badge.

### 9.4 — Mobile Action Panel

Test the order detail action panel at 375px viewport width:
- All buttons must be tap-sized: minimum 44px height
- All button labels must be fully visible (no clipping, no overflow)
- No button is off-screen or requires horizontal scrolling
- The action panel stacks vertically on mobile

Use Tailwind responsive utilities. No hardcoded pixel widths.

### 9.5 — WhatsApp Button Behavior

Confirm all `wa.me` links:
- Use `target="_blank" rel="noopener noreferrer"`
- Do not navigate away from the current page
- Have a visual indicator (external link icon) indicating they open in a new tab

Search the codebase: `grep -rn "wa.me" client/src/` — check every occurrence.

### 9.6 — Empty State for Order List

When `GET /api/orders` returns an empty array, `OrderList.jsx` must render a meaningful empty state:
- A clear Arabic message explaining no orders match the current filter
- Optionally: a call-to-action (e.g., "إنشاء طلب جديد" for shop_employee)
- Not: a blank area, a broken layout, or an invisible list

Implement for both the main order list and filtered views (by status, by search).

### 9.7 — Form Validation Feedback

`OrderForm.jsx` must block submission and show inline validation messages when:
- `customer_name` is empty
- `phone` is empty or not a valid Saudi phone number
- No items have been added (items array is empty)
- Any item's `item_name` is empty
- Any item's `workshop_comment` is empty

Requirements:
- Validation runs on submit (not on every keystroke)
- Error messages appear inline next to the relevant field
- Form does not call the API if validation fails
- Error messages are in Arabic

### 9.8 — Toast for All Error States

Every API call that can fail must show a toast notification to the user on failure. No error may be silently swallowed.

Audit all `catch` blocks in:
- `client/src/api/orders.js`
- `client/src/pages/`
- `client/src/components/`

For each `catch` block:
- Confirm there is a toast, alert, or visible error message shown to the user
- Remove any `catch` block that only logs to console without user feedback

If a toast system (`react-hot-toast`, `sonner`, or equivalent) is not already installed, add one.

### 9.9 — Dashboard Stat Card Navigation

Stat cards on the Dashboard currently do nothing when clicked. Consider whether clicking a stat card should filter the order list to that status.

This is a UX improvement task — only implement if confirmed desirable by the team. Mark as optional until confirmed.

---

## Implementation Checklist

### Locked Orders
- [ ] 9.1 — All action buttons absent from DOM when `locked_at` is set
- [ ] 9.1 — Verified in `OrderDetail.jsx` and `ScanResult.jsx`

### Role Visibility
- [ ] 9.2 — Each button in the action panel renders only for correct role
- [ ] 9.2 — No workshop-only button visible to shop_employee and vice versa

### Status Badges
- [ ] 9.3 — All 12 statuses (+ cancelled if applicable) have defined badge colors
- [ ] 9.3 — Unknown status renders a visible fallback badge

### Mobile
- [ ] 9.4 — Action panel tested at 375px — all buttons tap-sized and visible

### WhatsApp Links
- [ ] 9.5 — All `wa.me` links have `target="_blank" rel="noopener noreferrer"`
- [ ] 9.5 — External link indicator present on all WhatsApp buttons

### Empty States
- [ ] 9.6 — Empty order list shows Arabic empty-state message
- [ ] 9.6 — Works for filtered and unfiltered views

### Form Validation
- [ ] 9.7 — `OrderForm.jsx` validates all required fields before submission
- [ ] 9.7 — Inline Arabic error messages appear per field

### Error Toasts
- [ ] 9.8 — Toast system installed (if not already present)
- [ ] 9.8 — All `catch` blocks show user-visible error feedback
- [ ] 9.8 — No silent error swallowing in API calls

---

## Validation Steps (Phase Exit Criteria)

- [ ] No action buttons visible on locked orders (DOM inspection at `locked_at != null`)
- [ ] No action buttons visible to the wrong role (tested with both role tokens)
- [ ] `StatusBadge` renders all statuses correctly (visual check)
- [ ] All action buttons are tap-sized (≥ 44px height) at 375px viewport
- [ ] All WhatsApp links open in a new tab
- [ ] Empty order list renders a clear Arabic empty state
- [ ] `OrderForm` blocks submission on missing required fields
- [ ] All API errors produce a visible toast notification
- [ ] Full test suite passes with no regressions

---

## Notes

- This phase consumes the API envelope changes from Phase 8. If Phase 8 is not done, the frontend response unwrapping will break. Do Phase 8 first.
- The locked order UI change (9.1) requires reading `locked_at` from the API response. Confirm the field is included in `GET /api/orders/:id` response.
- For the form validation (9.7), do not install a heavy form library (Formik, react-hook-form) for this alone. A simple local state approach is sufficient unless the team prefers otherwise.
- Role-based rendering uses `user.role` from `localStorage`. Confirm the token is being decoded correctly before testing.
