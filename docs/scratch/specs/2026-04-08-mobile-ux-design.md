# Mobile UX Improvement Design
**Date:** 2026-04-08
**Status:** Approved

## Context

Mudhiyan Workshop app is used on mobile by:
- **Shop owner** — standing, one hand on paper, one on phone; enters new orders at counter
- **Delivery person** — scans QR codes on labels to confirm delivery

Current mobile pain points span all three flows: navigation, new order entry, and order list management.

## Goals

- Navigation in one thumb tap (no hamburger menu)
- New order entry as fast as possible one-handed
- Order list actions reachable with large touch targets
- Scan/delivery confirmation with big, clear buttons

## Architecture

No new routes, no new API endpoints. All changes are **client-side only** (`client/src/`). Desktop experience is unchanged.

---

## 1. Navigation — Bottom Tab Bar

**File:** `client/src/components/Layout.jsx` + `client/src/index.css`

Replace the mobile hamburger + sidebar pattern with a **fixed bottom tab bar** on screens `< 768px`.

- 3 tabs: `◈ الطلبات` · `✦ صيانة جديدة` · `⌖ مسح`
- Height: 64px, fixed to bottom, full width
- Active tab: gold icon + label, gold top border
- Inactive: muted color
- Main content gets `padding-bottom: 72px` on mobile to clear the tab bar
- Mobile top bar and hamburger button are removed (replaced by bottom nav)
- Desktop sidebar is **unchanged**

---

## 2. Dashboard

**File:** `client/src/pages/Dashboard.jsx` + `client/src/components/OrderList.jsx`

### Stats row
- On mobile: horizontally scrollable single row (`overflow-x: auto`, no wrapping)
- Each stat card: min-width 120px, compact padding

### Filter chips
- Height: 40px (up from ~28px) for easier tap
- Row is horizontally scrollable on mobile (no wrapping)

### Order cards (mobile)
- Status-change button replaces `btn-ghost-sm` with a full-width taller button (min 44px)
- Card padding increased slightly for easier tap targets

### FAB (Floating Action Button)
- Gold `+` circle button, fixed position, bottom-right
- Sits 72px above bottom (above tab bar)
- Navigates to `/new`
- Visible only on mobile, only on Dashboard page

---

## 3. New Order Form

**File:** `client/src/components/OrderForm.jsx`

### Piece type — tap chips
- Replace `<select>` with a 3-column grid of tap chip buttons
- Each chip: minimum 52px tall, full label, gold border when selected
- 7 types: خاتم · سلسلة · أسورة · قرط · دبلة · ساعة · أخرى

### Phone field
- Add `inputmode="numeric"` → opens numeric keyboard instantly on mobile
- No other change to validation logic

### Customer name field
- Add `autocapitalize="words"` for faster typing

### Submit button
- Full width (`width: 100%`)
- Height: 56px on mobile
- Already `btn-gold`, just needs size increase

---

## 4. Scan Result (Mobile)

**File:** `client/src/components/ScanResult.jsx`

On mobile (`< 768px`):
- "تعيين جاهزة" and "فتح واتساب" buttons: full-width, stacked vertically, 52px tall each
- Order detail text: slightly larger for readability
- Container: full-width, no max-width constraint on mobile

---

## Out of Scope

- No backend changes
- No new routes
- No swipe gestures (deferred — adds complexity)
- No PWA/offline support
- Desktop layout: zero changes
