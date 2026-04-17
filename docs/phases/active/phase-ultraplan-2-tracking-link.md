# Ultraplan Phase 2 — Tracking Link Improvements

## Status: Completed — 2026-04-18

---

## Purpose

Give staff a one-tap way to copy a customer's tracking link from both the order detail panel and the order list. Previously, the only way to get a tracking link was through the WhatsApp button — there was no standalone copy action.

---

## Phase Summary

Added copy-to-clipboard buttons for the customer tracking URL in two places:

1. **OrderDetail panel** — a "⎘ نسخ الرابط" row in the order info section. Turns green with "✓ تم النسخ" for 2 seconds after clicking.
2. **OrderList** — a small "⎘" icon button in the action column of each row (both mobile cards and desktop table). A fixed-position dark toast ("✓ تم نسخ رابط المتابعة") appears at the bottom of the screen for 2 seconds after copying.

---

## Design Decisions

1. **`navigator.clipboard.writeText()`** — standard async clipboard API. No library needed.
2. **Inline feedback in OrderDetail** — button itself changes color/label, no overlay needed inside the panel.
3. **Fixed-position toast in OrderList** — the list has no natural enclosing panel for inline feedback; a bottom-of-screen toast is more visible and avoids layout shifts.
4. **`e.stopPropagation()` on copy buttons** — prevents the row click from opening OrderDetail when the copy icon is clicked.
5. **`customer_token` guard** — copy button only renders when `order.customer_token` is set, so legacy orders without tokens aren't affected.

---

## Files Modified

| File | Change |
|------|--------|
| `client/src/components/OrderDetail.jsx` | Added `linkCopied` state + `copyTrackingLink()` + copy button row in info section |
| `client/src/components/OrderList.jsx` | Added `copiedId` state + `copyTrackingLink()` + copy icon in each row + fixed toast overlay |

---

## Testing Steps

1. Open any order in the list → click the order row → OrderDetail slides open
2. Find "رابط المتابعة" row in the info section → click "⎘ نسخ الرابط"
3. Button turns green and shows "✓ تم النسخ" for 2 seconds
4. Paste the clipboard into a browser — confirm it's the correct `/track/TOKEN` URL
5. Close OrderDetail — in the list, find the "⎘" icon button in the row's action area
6. Click it — toast appears at bottom of screen: "✓ تم نسخ رابط المتابعة"
7. Paste clipboard — same URL
8. Verify clicking ⎘ does NOT open the OrderDetail panel (stopPropagation)

---

## Verification Result

- `npm test --prefix server`: **135/135 passed**
- `npm run build --prefix client`: **clean build**
