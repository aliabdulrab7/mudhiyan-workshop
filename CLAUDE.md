# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both server + client (from root)
npm run dev

# Server only (port 3737)
npm run dev --prefix server

# Client only (port 5173, exposed on LAN)
npm run dev --prefix client

# Build client for production
npm run build

# Install all dependencies
npm install && npm install --prefix server && npm install --prefix client
```

## Architecture

Monorepo: `server/` (Express + SQLite) + `client/` (React + Vite). Vite proxies `/api/*` to `http://localhost:3737`.

### Server (`server/`)
- `db.js` — SQLite init via `better-sqlite3`, schema migration on startup. Exports `createOrder` — an atomic transaction that counts today's orders, generates `WRK-YYYYMMDD-NNNN`, and INSERTs in one step (prevents race conditions). Do **not** split this into separate generate + insert calls.
- `routes/orders.js` — 6 endpoints. `GET /barcode/:value` must stay declared before `GET /:id` to avoid route conflict. `limit` is clamped to 1–500; `status` query param is validated against the allowed enum before querying.
- `index.js` — binds on `0.0.0.0`, CORS restricted to localhost/127.0.0.1/192.168.x.x origins, exposes `/api/config` returning LAN IP (used by label QR code generation).

### Client (`client/src/`)
- `api/orders.js` — all fetch wrappers including `getConfig()` which fetches LAN IP for QR URLs.
- `components/LabelCanvas.jsx` — renders a 320×240px canvas (40mm×30mm @ 203 DPI for Niimbot B21). Fetches LAN IP from `/api/config`, draws label, then generates a QR code via `qrcode` pointing to `http://[LAN-IP]:5173/scan?code=[order_number]`. Shows a red warning on the canvas if IP resolves to localhost (QR would be unusable on iPhone).
- `components/useLabelPrint.js` — Web Bluetooth hook using `@mmote/niimbluelib`. Must be triggered by user gesture. Captures `clientRef.current` into a local `client` variable before any `await` — do not use `clientRef.current` inside `finally`. Uses `B21_V1` print task + `ImageEncoder.encodeCanvas`.
- `components/BarcodeScanner.jsx` — wraps `html5-qrcode` for desktop camera scanning (CODE128). Uses `useId()` for the container element id to avoid duplicate-mount conflicts on hot reload.
- `pages/ScanPage.jsx` — dual-mode: reads `?code=` URL param (iPhone QR scan flow, no camera needed) OR uses camera scanner (desktop). Does **not** auto-promote order status on scan — user must click "تعيين جاهزة" in `ScanResult`.
- `components/Layout.jsx` — responsive sidebar: fixed overlay on mobile (<768px) with hamburger toggle, normal sidebar on desktop. Uses `sidebarOpen` state + CSS classes `.sidebar`, `.sidebar.open`, `.mobile-topbar`, `.sidebar-overlay` defined in `index.css`.
- `components/OrderList.jsx` — renders a card layout on mobile (`useMobile()` hook, <768px) and a 6-column table on desktop.

### Key flows
1. **New order** → `POST /api/orders` (atomic `createOrder` transaction) → success screen shows `LabelCanvas` → connect Niimbot B21 via Bluetooth → print
2. **iPhone delivery** → scan QR on label with native camera → opens `/scan?code=WRK-...` → shows order details → tap "تعيين جاهزة" to confirm → WhatsApp `wa.me` link opens with pre-filled Arabic message
3. **Desktop delivery** → `/scan` page → camera reads CODE128 → same confirm flow

### Design system
"Luxury Artisan Dark" — CSS variables in `src/index.css`. Key classes: `.order-stamp` (JetBrains Mono gold badge for order numbers), `.order-row` (gold right-border hover), `.btn-gold`, `.btn-ghost`, `.input-base`. Fonts: Almarai (Arabic UI) + JetBrains Mono (order numbers/phone). All UI is Arabic RTL (`dir="rtl"` on `<html>`).

### Database
Single `orders` table in `server/data/workshop.db` (git-ignored). Status flow: `received → in_progress → ready → delivered`. Phone stored as `966XXXXXXXXX` (no `+`); `wa.me` URLs use this format directly.

### Printing constraint
Web Bluetooth (`@mmote/niimbluelib`) only works in Chrome or Edge on HTTPS or `localhost`. The iPhone QR flow avoids this — it opens the scan page via URL param and never needs camera permissions on mobile.
