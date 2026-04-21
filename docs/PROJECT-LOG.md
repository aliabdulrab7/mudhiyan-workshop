# Project Log — Mudhiyan Workshop

Chronological record of what was built and why. Grouped into logical work
units; each cites representative commit SHAs and the date from `git log`.
See `FEATURE-INVENTORY.md` for the current capability map — this doc
doesn't re-describe features, only how they got here.

## Timeline

### 1. Initial codebase — `c7a9563` (2026-04-09)

Single-branch prototype: orders, barcode scan, Niimbot B21 print. No
auth, no per-branch scoping, no customer portal. Baseline for everything
below.

### 2. Auth + multi-tenant foundation — `debec62`, `0d80ac0`, `0eb00bd`, `04703d4`, `114291a`, `ea3355c` (2026-04-14)

JWT login, `shops` + `users` tables, `requireAuth` / `requireRole`, per-shop
scoping on every read, and the public customer-track endpoints. Why: one
workshop serves several branches; customers needed to approve quotes without
creating accounts.

### 3. Two-label printing + client auth — `6f78a50`, `7215c2e`, `b2a08ef`, `70ab0ef`, `86ebf67`, `a623b42` (2026-04-14)

Two labels per order (customer QR + shop CODE128), bearer token injected
into all API calls, `PrivateRoute`, first `CostEditor`. Labels became the
physical bridge between the branch counter and the workshop bench.

### 4. Deploy pipeline — `60e3e7e`, `35701cb`, `ec135fe`, `bce2c60`, `c71a9a5` (2026-04-14)

`PUBLIC_HOST` env var, GitHub Actions deploy, daily DB backup, switch to
AWS EC2. `c71a9a5` scrubbed a PEM key from history after an accidental
commit.

### 5. Order drawer + automated WhatsApp — `e082d0c`, `f3d651c`, `e3e2271`, `02f1270` (2026-04-14)

Cost editing, comments, WhatsApp link generation for approval and
ready-for-pickup, auto-print at status thresholds. Operators asked for
one place to set the quote and have the customer message build itself.

### 6. Label/printer iteration — `8b84e8b` through `0723555` (2026-04-14)

Multiple passes on Niimbot dimensions, orientation, and B21-vs-B21S
firmware. The SDK's print-task type is model-sensitive and had to be
learned by doing.

### 7. Multi-item orders + audit trail — `67e4f2b`, `4c72a9d`, `e358e7d`, `b584829` (2026-04-15)

One order can hold multiple items; labels list them; status history
backfilled. Customers routinely dropped off several pieces in one visit,
and single-piece orders were forcing fragile workarounds.

### 8. Admin pages scaffold — `e5b2b1b`, `157bb1e`, `ffee9b3`, `3961f73`, `174e8b0`, `e045379`, `2772692` (2026-04-15)

Technicians, Inventory, Services, Reports — all workshop-only, gated by
new `RoleRoute`. Shop owner wanted surfaces to manage staff and materials
that branch employees could not see.

### 9. Workflow rename to 9-stage — `907fcca`, `aa90444`, `57ed222`, `d938ff6` (2026-04-16)

Deprecated `diagnosing` / `ready_for_pickup` / `ready` / `in_progress` /
`pending_approval` in favor of the current 9-stage workflow. The old
names conflated workshop-internal and branch-facing halves of the flow;
the rename makes who-owns-what obvious.

### 10. Ship script + docs reorg — `71f7331`, `1b651e3`, `1c60636` (2026-04-17)

`ship.sh` wraps add + commit + push; `docs/` split into `engineering/`,
`plans/`, `specs/`, `superpowers/`. `npm run ship` made local → prod a
single command.

### 11. Phase 6/7/8 hardening — `da5365f`, `524a5e0`, `9f1aaae` (2026-04-17)

Phase 6: auth tightening, role guards, locked-order 409. Phase 7: phone
normalization + UNIQUE indexes + length guards. Phase 8: status codes +
rate limiting + global error handler. Driven by real users hitting
confusing 500s where 4xx was correct.

### 12. Phase 9 UI + design-system overhaul — `84c450e`, `44f4685`, `0b5f4b4`, `a21ac62`, `b49cc7a`, `3eac2a7`, `ca53e9b`, `8ad4445` (2026-04-17 → 2026-04-19)

Introduced `StatusPill`, `DataTable`, `CommandPalette`, SVG icons,
TrackPage 6-stage timeline, Dashboard cockpit, multi-step NewOrder
wizard, toast system. `8ad4445` dropped framer-motion and moved the
whole token vocabulary to oklch. Consolidated three overlapping theme
generations into one.

### 13. Orders dense view + industrial redesign — `b6fe1f6`, `fef9571`, `6cb9cc5` (2026-04-19 → 2026-04-20)

`/orders` as a dense table with bulk actions; spacing/typography
tightened; failing CI fixed in the same pass. Operators wanted a
high-density triage view distinct from the Dashboard.

### 14. Repair options + multi-repair per item — `21508a1`, `d9a0587`, `9d0a587` (2026-04-20)

Per-item-type repair dropdowns became workshop-configurable
(`repair_options` table with Arabic defaults seeded on first run); items
gained a `repairs[]` array so one ring could carry both "polish" and
"stone install". The hardcoded list was missing cases from the field.

### 15. Dynamic labels + universal printing — `f0f5c97`, `6416a3a` (2026-04-20)

Label size became a preset picker; universal print (browser dialog with
injected `@page`) covers every preset including A4. Branches without a
Niimbot needed to fall back to office laser printers.

### 16. Urgency + per-branch counter fix — `9109f2a`, `207fb9e`, `1cfc9a9`, `26376b4` (2026-04-20)

`9109f2a` fixed the order-number counter that had been resetting at
date boundaries — the `LIKE` prefix now matches the whole branch,
making the counter continuous. `is_urgent` added as an intake toggle;
urgent unlocked orders sort first.

### 17. Order-list toolbar + CLAUDE.md rewrite — `781a966`, `69b4fe1` (2026-04-20)

Filter/sort/group toolbar wired up; CLAUDE.md rewritten to match current
reality after accumulating notes from three redesigns.

### 18. Per-item cost + per-item customer approval — `d15ef0b` (2026-04-21)

Quote flow rebuilt: each item carries its own `estimated_cost` and
`approval_status`; customer decides item by item; order transitions on
"any workable" vs "all rejected". Added `in_repair|rejected →
waiting_approval` for re-quotes. The common case (one free polish + one
paid repair) had been forced into one bucket.

### 19. Dead-buttons wire-up sprint — `24cb145`, `f653a67`, `25f239a`, `612f87a`, `892397b`, `1625cb9`, `60637cd`, `5337eb8`, `f0be385`, `ddf54e0`, `6d91445`, `96f7b44` (2026-04-21)

One focused pass clearing items from `docs/DEAD-BUTTONS-SPEC.md`: Reports
`تصدير` → printable window; scan page manual-first with camera fallback;
bulk-scan feature in four steps (endpoint, toggle, pipeline, audio +
summary); auto-skip-free on send-for-approval; recompute order cost from
approved + skipped; per-item approval badges in the drawer; workshop-only
reads (`/stats`, `/branch-stats`) gated.

### 20. Post-ship cleanup — `426c7d0`, `0723630`, `a8c0750` (2026-04-21)

Dead `ready_for_pickup` references dropped; QA harness moved from
`/tmp/qa-audit/` into `tools/qa-audit/` with CWD-independent paths;
Dashboard CSV export shipped per spec 1a.

## Known gaps and parked items

- **Reports Export (spec 1b)** — specced in `docs/DEAD-BUTTONS-SPEC.md`,
  not shipped. The current `تصدير` opens a printable window (`24cb145`);
  CSV export of reports data remains open.
- **Safari/iOS audio ear-check for bulk-scan** — `bulkScanAudio.js` is
  unit-tested for mute state; actual beep output on iOS Safari is pending
  manual verification.
- **UI structural map** — parked design artifact, not resumed.
- **`ready` legacy status** — `server/routes/orders.js:19` carries a
  `TODO` flagging it as still present in `SUM(status IN (...))` unions
  on `/stats`; cleanup deferred until all production orders have moved
  past it.
- **ScanPage dead props** — `client/src/pages/ScanPage.jsx:6` notes
  `OrderDetail` still receives `orderId` + `onStatusChange` from
  `OrdersPage`; cleanup deferred to the next OrdersPage touch.

## Harness coverage state

`tools/qa-audit/` holds two Playwright Chromium harnesses targeting the
live dev server:

- **`audit.mjs`** — nine scripted flows (login variants, every sidebar
  page per role, new order, orders list drawer, track decisions, mobile
  viewport, expired/bogus JWT, role-leak attempt, browser back after
  partial fill). Latest clean run: **0 findings on 2026-04-21**
  (`QA-REPORT.md`, `2026-04-21T03:44:36Z`).
- **`coverage-sweep.mjs`** — dedupe-and-click every unique interactive
  element once, classify by observable effect. Latest sweep:
  **423 elements, 210 works, 21 dead, 0 errors, 192 unclear**. Remaining
  dead items are sidebar self-nav on role-locked pages and a couple of
  effectless buttons on public surfaces.

Out of automated scope: Niimbot B21 Bluetooth (Playwright can't expose
Web Bluetooth), camera barcode scan (needs a real camera device), and
WebAudio output assertion for bulk-scan beeps. Manual ear-check only.

## Things I noticed while writing this

The commit density on 2026-04-14 is extreme — 40+ commits covering auth,
deploy, theming, printing, and a dark→light→dark→light theme revision —
and it reads like three overlapping attempts. The 2026-04-17 "phase
6/7/8 hardening" wave is where the codebase stops feeling like a
prototype: separate commits for auth, data, and API concerns, each with
tests. "We started writing tests at phase 6" is the inflection point
worth calling out in any future retrospective.
