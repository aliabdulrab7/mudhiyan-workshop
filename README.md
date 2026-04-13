# مصنع المضيان — Workshop Management App

Jewelry repair shop management system. Handles order intake, status tracking, cost approval, customer notifications, and label printing via Niimbot B21 Bluetooth printer.

---

## Features

- **Order management** — create, track, and update repair orders
- **Role-based access** — workshop manager sees all orders; shop employees see only their shop's orders
- **Cost approval flow** — set repair cost → customer approves via tracking link → work begins
- **Customer tracking page** — public URL sent via QR code, no login required
- **WhatsApp notifications** — pre-filled Arabic messages for approval requests and pickup alerts
- **Two-label printing** — customer label (QR code) + shop label (barcode) via Niimbot B21 over Bluetooth
- **Mobile-friendly** — bottom tab bar on mobile, sidebar on desktop

---

## Status Flow

```
received → pending_approval → in_progress → ready → delivered
```

| Status | Meaning |
|--------|---------|
| `received` | Order created, awaiting cost assessment |
| `pending_approval` | Cost set, waiting for customer to approve |
| `in_progress` | Customer approved, repair underway |
| `ready` | Repair complete, ready for pickup |
| `delivered` | Customer collected the item |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v3 |
| Backend | Express.js + SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Printing | Niimbot B21 via Web Bluetooth (@mmote/niimbluelib) |
| QR / Barcode | qrcode + jsbarcode |
| Camera scan | html5-qrcode |
| Tests | Jest 29 + Supertest |

---

## Project Structure

```
mudhiyan-workshop/
├── server/
│   ├── app.js              # Express app (importable for tests)
│   ├── index.js            # Listen entry point
│   ├── db.js               # SQLite init, schema, createOrder transaction
│   ├── seed.js             # Create default users and shop
│   ├── middleware/
│   │   └── auth.js         # requireAuth / requireRole middleware
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/login
│   │   ├── orders.js       # CRUD + status + cost endpoints
│   │   └── track.js        # Public customer tracking endpoints
│   └── tests/
│       ├── auth.test.js
│       ├── orders.test.js
│       └── track.test.js
├── client/
│   └── src/
│       ├── api/
│       │   ├── auth.js     # Token storage, login(), clearAuth()
│       │   └── orders.js   # All API fetch wrappers
│       ├── components/
│       │   ├── Layout.jsx          # Sidebar + bottom tab bar
│       │   ├── PrivateRoute.jsx    # Redirects to /login if not authenticated
│       │   ├── OrderList.jsx       # Table (desktop) + cards (mobile)
│       │   ├── StatusBadge.jsx     # Colored status pill
│       │   ├── CostEditor.jsx      # Workshop: set repair cost
│       │   ├── ScanResult.jsx      # Scan result with role-aware actions
│       │   ├── LabelCanvas.jsx     # Two-canvas label preview + print
│       │   ├── BarcodeScanner.jsx  # Camera barcode scanner (desktop)
│       │   └── useLabelPrint.js    # Web Bluetooth hook for Niimbot B21
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── Dashboard.jsx
│       │   ├── NewOrderPage.jsx
│       │   ├── ScanPage.jsx
│       │   └── TrackPage.jsx       # Public customer tracking page
│       └── App.jsx
├── .github/
│   └── workflows/
│       ├── deploy.yml      # Auto-deploy to Droplet on push to master
│       └── backup.yml      # Daily SQLite backup as GitHub artifact
├── DEPLOYMENT.md
└── README.md
```

---

## Local Development

### Requirements

- Node.js 20+
- Chrome or Edge (for Bluetooth printing and camera scanning)

### Setup

```bash
# Install all dependencies
npm install
npm install --prefix server
npm install --prefix client

# Seed the database (first run only)
node server/seed.js

# Start both server + client
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3737`

### Default credentials

| Role | Username | Password |
|------|----------|----------|
| Workshop manager | `workshop` | `workshop123` |
| Shop employee | `employee1` | `shop123` |

### Run tests

```bash
cd server && npm test
```

17 tests across auth, orders, and track — all use an in-memory SQLite database.

---

## Environment Variables

Set these on the production server (in `ecosystem.config.cjs`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Express listen port | `3737` |
| `JWT_SECRET` | Secret for signing tokens | `dev-secret-change-in-production` |
| `PUBLIC_HOST` | Your domain — used for QR code URLs and CORS | *(unset = LAN mode)* |
| `NODE_ENV` | Set to `production` in prod | `development` |

---

## Key Constraints

- **Bluetooth printing** requires Chrome or Edge on HTTPS. Safari and Firefox are not supported.
- **BarcodeScanner** must not run inside React `StrictMode` — double-mounting crashes `html5-qrcode`.
- **`createOrder`** in `db.js` is an atomic transaction — do not split into separate generate + insert calls.
- **`GET /barcode/:value`** must be declared before `GET /:id` in the orders router to avoid route conflicts.
- **Database** (`server/data/workshop.db`) is git-ignored. Back it up before updating the server.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering:

- DigitalOcean Droplet setup
- GoDaddy DNS configuration
- Nginx reverse proxy
- SSL via Let's Encrypt (Certbot)
- PM2 process management
- GitHub Actions CI/CD
- Automated database backups
