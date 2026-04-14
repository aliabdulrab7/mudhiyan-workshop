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

# Manual AWS Deployment
# Follow steps in DEPLOYMENT_AWS.md
```

No test suite in this codebase.

## Architecture

Monorepo: `server/` (Express + SQLite) + `client/` (React + Vite). Vite proxies `/api/*` to `http://localhost:3737`. No authentication — all routes are public.

### Server (`server/`)

- `db.js` — SQLite init via `better-sqlite3`, schema created on startup. Exports `createOrder` — an atomic transaction that counts today's orders, generates `WRK-YYYYMMDD-NNNN`, and INSERTs in one step (prevents race conditions). Do **not** split this into separate generate + insert calls.
- `routes/orders.js` — 6 endpoints. `GET /barcode/:value` must stay declared before `GET /:id` to avoid route conflict. `limit` is clamped to 1–500; `status` query param is validated against the allowed enum before querying.
- `index.js` — binds on `0.0.0.0`, CORS restricted to `http://` localhost/127.0.0.1/192.168.x.x origins only, exposes `/api/config` returning LAN IP (used by label QR code generation).

### Client (`client/src/`)

- `api/orders.js` — all fetch wrappers including `getConfig()` which fetches LAN IP for QR URLs.
- `components/LabelCanvas.jsx` — renders a 400×240px canvas (50mm×30mm @ 203 DPI for Niimbot B21/B21S). Simplified layout: Serial, Name, Barcode only. Uses 40px safety padding for B21S hardware compatibility.
- `components/useLabelPrint.js` — Web Bluetooth hook using `@mmote/niimbluelib`. Must be triggered by user gesture. Uses model id `B21` + `ImageEncoder.encodeCanvas` with orientation `left`.
- `components/BarcodeScanner.jsx` — wraps `html5-qrcode` for desktop camera scanning (CODE128). Uses `useId()` for the container element id to avoid duplicate-mount conflicts. Do NOT wrap in React `StrictMode` — double-mounting crashes the scanner.
- `pages/ScanPage.jsx` — dual-mode: reads `?code=` URL param (iPhone QR scan flow, no camera needed) OR uses camera scanner (desktop).
- `components/Layout.jsx` — sidebar on desktop (hidden via CSS), bottom tab bar on mobile (shown via CSS). No JS toggle needed.
- `components/OrderList.jsx` — contains an inline `useMobile()` hook (`window.innerWidth < 768`). Renders a card layout on mobile and a 6-column grid table on desktop.

### Key flows

1. **New order** → `POST /api/orders` (atomic `createOrder` transaction) → success screen shows `LabelCanvas` → connect Niimbot B21 via Bluetooth → print
2. **iPhone delivery** → scan QR on label with native camera → opens `/scan?code=WRK-...` → shows order details → tap confirm → WhatsApp `wa.me` link opens with pre-filled Arabic message
3. **Desktop delivery** → `/scan` page → camera reads CODE128 → same confirm flow

### Design system

"Premium Artisan Light" — CSS variables in `src/index.css`. Key attributes: White backgrounds, subtle shadows, and gold accents (`#D4A843`). Key classes: `.order-stamp` (JetBrains Mono badge), `.order-row`, `.btn-gold`, `.btn-ghost`. Fonts: Almarai (Arabic UI) + JetBrains Mono. UI is Arabic RTL (`dir="rtl"` on `<html>`).

### Database

Single `orders` table in `server/data/workshop.db` (git-ignored). Status flow: `received → in_progress → ready → delivered`. Phone stored as `966XXXXXXXXX` (no `+`); `wa.me` URLs use this format directly.

### Printing constraint

Web Bluetooth (`@mmote/niimbluelib`) only works in Chrome or Edge on HTTPS or `localhost`. The iPhone QR flow avoids this — it opens the scan page via URL param and never needs camera permissions on mobile.
