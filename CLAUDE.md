# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both server + client (from root)
npm run dev

# Server only (port 3737, --watch)
npm run dev --prefix server

# Client only (port 5173, exposed on LAN)
npm run dev --prefix client

# Build client for production
npm run build

# Server tests (Jest + supertest, in-memory SQLite)
npm test --prefix server

# Run a single test file
npm test --prefix server -- tests/orders.test.js

# Commit everything with a timestamped message and push
npm run ship          # wraps ship.sh

# Install all dependencies (root + server + client)
npm install && npm install --prefix server && npm install --prefix client
```

A `post-commit` hook at `.git/hooks/post-commit` auto-pushes every commit to `origin/master`. It's safe during `rebase`/`merge`/`cherry-pick` (it skips). Don't skip hooks (`--no-verify`) unless you have a specific reason.

## Architecture

Monorepo: `server/` (Express 5 + better-sqlite3) + `client/` (React 19 + Vite). Vite proxies `/api/*` to `http://localhost:3737`. UI is Arabic RTL (`dir="rtl"`).

### Authentication

JWT bearer tokens with role-based access. Two roles:

- `workshop` — repair technicians + admins. Global view across all shops.
- `shop_employee` — scoped to a single `shop_id`. All queries filter by `req.user.shop_id`.

`server/middleware/auth.js` exports `requireAuth` and `requireRole('workshop' | ['workshop','shop_employee'])`. In production, the server refuses to start if `JWT_SECRET` is unset or still `dev-secret-change-in-production` (see `index.js`).

### Server layering

**Routes → Service → DB.** Status transitions must go through `OrderService.transition()` — it's the single source of truth for which status changes are allowed and what side-effects they trigger. Do **not** mutate `orders.status` from a route or direct SQL.

- `server/services/OrderService.js` — state machine. The `TRANSITIONS` object is the registry of legal next-states; `validateBusinessRules()` enforces domain invariants (payment required, lock after delivery, etc.). Transition writes are atomic: re-read order, write audit log, UPDATE status, set `locked_at` if delivered — all in one `db.transaction`.
- `server/services/NotificationService.js` — WhatsApp/track-link side-effects. Registered into `OrderService` via `registerNotificationHook` in `app.js` so services don't import each other directly.
- `server/errors/index.js` — domain error classes (`InvalidTransitionError`, `PaymentRequiredError`, `OrderLockedError`, `PermissionError`, …). `errorToHttpStatus(err)` maps them to HTTP codes, used by the global error middleware at the end of `app.js`.
- `server/db.js` — SQLite init (`WAL` mode), schema-create-if-not-exists, additive column migrations (`ALTER TABLE ... ADD COLUMN` guarded by `columnExists()`). Exports `createOrder` — an atomic transaction that counts existing orders **for the branch** (prefix `BR{shopId}-`), generates the next number, and INSERTs in one step. Do **not** split this into separate count + insert calls.

### Order numbers

Format: `BR{shopId}-YYYYMMDD-NNNN` (e.g., `BR1-20260420-0022`). The counter is **continuous per branch**, not per-day — the `LIKE` prefix in `createOrder` matches all dates for the branch. If you see "date rolled over, counter reset to 0001", that's a bug.

### Status flow

```
new → received → inspection → waiting_approval → in_repair → quality_check
    → ready_for_return → returned_to_shop → delivered  (locked)

Terminal side-branches:  rejected, cancelled
```

`locked_at` is set on `delivered`. Locked orders reject all mutations with `OrderLockedError` (409).

### Urgency

`orders.is_urgent` (0/1). Set from the NewOrder form (`urgency: 'rush' | 'normal'`) and toggleable via `PUT /api/orders/:id`. The list query orders `(o.is_urgent = 1 AND o.locked_at IS NULL) DESC, o.created_at DESC` so rush orders float to the top of the workshop queue. Pill rendered as a red "مستعجل" badge next to the stamp on every surface (OrderList, OrderDetail, Dashboard, LabelCanvas).

### Client

- `api/orders.js` — fetch wrappers. `createOrder` must forward every field the server expects (previously silently dropped `urgency` during destructuring — watch for this pattern). `getConfig()` fetches LAN IP for QR URLs.
- `components/useLabelPrint.js` — Web Bluetooth hook using `@mmote/niimbluelib`. Must be triggered by a user gesture. Model id `B21`, `ImageEncoder.encodeCanvas` orientation `left`.
- `components/LabelCanvas.jsx` / `ReadyLabelCanvas.jsx` — share a pattern: draw in a fixed **400×240 base coordinate space**, then `fitCanvas()` applies a scale+translate transform to letterbox onto whatever real canvas pixel size the current label preset wants. Size presets range from 50×30 mm (Niimbot native) to A4, persisted in `localStorage`.
- `components/BarcodeScanner.jsx` — wraps `html5-qrcode` for desktop camera scanning (CODE128). Uses `useId()` for container id. **Do NOT wrap in React StrictMode** — double-mounting crashes the scanner.
- `pages/ScanPage.jsx` — dual-mode: reads `?code=` URL param (iPhone QR flow, no camera) OR uses camera scanner (desktop).
- `components/Layout.jsx` — sidebar on desktop, bottom tab bar on mobile, switched by CSS only (no JS toggle).

### Printing

Two paths, same canvas:

1. **Universal** — `handleUniversalPrint()` opens a new window with an inline HTML page containing `@page { size: {w}mm {h}mm; margin: 0 }`, injects the canvas as an image, and calls `window.print()`. Works with any OS-installed printer. Supports all size presets.
2. **Niimbot B21 (Bluetooth)** — only exposed when `sizeId === '50x30'` (the printer's native size). Requires Chrome/Edge on HTTPS or `localhost`.

### Key flows

1. **New order** → `POST /api/orders` (atomic `createOrder`) → success screen shows `LabelCanvas` → universal print OR Niimbot Bluetooth
2. **Status transition** → `PATCH /api/orders/:id/status` → `OrderService.transition()` → audit log + notification hook
3. **iPhone delivery** → scan QR on label with native camera → `/scan?code=BR...` → confirm → `wa.me` link opens with pre-filled Arabic message
4. **Desktop delivery** → `/scan` → camera reads CODE128 → same confirm flow

### Design system

"Premium Artisan Light" — CSS variables in `client/src/index.css`. Gold accent `#D4A843`, subtle shadows, white surfaces. Fonts: Almarai (Arabic UI) + JetBrains Mono (stamps, barcodes, phones). Key classes: `.stamp`, `.btn-gold`, `.btn-ghost`, `.chip`, `.order-row`.

### Database

Single SQLite file at `server/data/workshop.db` (git-ignored). Tests use `:memory:` (triggered by `NODE_ENV=test`). Phone stored as `966XXXXXXXXX` with no `+`; `wa.me` URLs use this format directly.

### Route ordering gotcha

In `server/routes/orders.js`, `GET /barcode/:value` must stay declared **before** `GET /:id` or Express will match `barcode` as an id. Same pattern applies to any new literal segment under `/orders`.
