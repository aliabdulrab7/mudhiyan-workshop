# Mudhiyan Workshop Full Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT auth with multi-shop roles, cost-approval workflow, customer tracking page, two-label Niimbot printing, and replace the dark UI with a light-mode navy+gold design.

**Architecture:** Backend splits into `app.js` (Express config) + `index.js` (listen only) for testability. New route files handle auth and public tracking. SQLite schema gains `shops`, `users`, and three new order columns. React frontend gains login, route guards, customer page, and a fully replaced CSS design system.

**Tech Stack:** Node.js + Express + better-sqlite3 + jsonwebtoken + bcryptjs | React 19 + Vite + React Router 7 + Tailwind CSS v3 | Jest + supertest (backend tests) | @mmote/niimbluelib (Bluetooth) | jsbarcode + qrcode

**Spec:** `docs/superpowers/specs/2026-04-09-workshop-redesign-design.md`

---

## File Map

### Backend — New

- `server/app.js` — Express app config, mounts all routes, exported for testing
- `server/middleware/auth.js` — `requireAuth`, `requireRole` JWT middleware
- `server/routes/auth.js` — `POST /api/auth/login`
- `server/routes/track.js` — `GET /api/track/:token`, `POST /api/track/:token/approve`
- `server/seed.js` — one-time setup script: workshop user + 1 shop + 1 employee
- `server/tests/auth.test.js` — login endpoint tests
- `server/tests/track.test.js` — track + approve endpoint tests
- `server/tests/orders.test.js` — scoping + cost endpoint tests

### Backend — Modified

- `server/db.js` — create shops/users tables, alter orders (shop_id, cost, customer_token), update `createOrder`
- `server/routes/orders.js` — auth middleware, role scoping, cost endpoint, `pending_approval` status
- `server/index.js` — delegate to `app.js`, call `listen()`
- `server/package.json` — add jsonwebtoken, bcryptjs; add jest + supertest as devDependencies

### Frontend — New

- `client/src/api/auth.js` — localStorage helpers: `getToken`, `getRole`, `getShopId`, `isLoggedIn`, `saveAuth`, `clearAuth`, `login`
- `client/src/components/PrivateRoute.jsx` — redirects to `/login` if no token
- `client/src/pages/LoginPage.jsx` — username + password form
- `client/src/pages/TrackPage.jsx` — public customer tracking + cost approval page
- `client/src/components/CostEditor.jsx` — workshop sets cost on `received` orders

### Frontend — Modified

- `client/src/index.css` — replace all CSS variables with light-mode navy+gold; update component classes
- `client/src/components/Layout.jsx` — navy sidebar, logout button, username display
- `client/src/components/StatusBadge.jsx` — add `pending_approval`
- `client/src/api/orders.js` — add auth headers to all requests; add `updateCost`, `getTrackOrder`, `approveOrder`
- `client/src/App.jsx` — add `/login` + `/track/:token` public routes; wrap existing routes in `PrivateRoute`
- `client/src/pages/Dashboard.jsx` — add `pending_approval` stat card
- `client/src/components/OrderList.jsx` — add `pending_approval` filter tab; role-gate status buttons; update `nextStatus` map
- `client/src/components/ScanResult.jsx` — add `CostEditor` (workshop+received), approval wa.me button (pending_approval), pickup wa.me button (ready); remove old universal wa.me button
- `client/src/components/LabelCanvas.jsx` — render two canvases: customer label (QR → `/track/:token`) + shop label (CODE128 barcode)
- `client/src/components/useLabelPrint.js` — add `printAll(canvases[])` function

---

## Wave 1 — Backend (run Tasks 1–9 sequentially)

---

### Task 1: Install dependencies + test setup

**Files:**

- Modify: `server/package.json`
- Create: `server/app.js`
- Modify: `server/index.js`
- Create: `server/jest.config.js`

- [ ] **Step 1: Install production + dev dependencies**

```bash
cd server
npm install jsonwebtoken bcryptjs
npm install --save-dev jest supertest
```

- [ ] **Step 2: Add test script to server/package.json**

Replace `server/package.json` with:

```json
{
  "name": "mudhiyan-workshop-server",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js",
    "test": "NODE_ENV=test jest --runInBand"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^12.8.0",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

- [ ] **Step 3: Create server/jest.config.js**

```js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
};
```

- [ ] **Step 4: Create server/app.js (extract Express config from index.js)**

```js
const express = require("express");
const cors = require("cors");
const os = require("os");

const ordersRouter = require("./routes/orders");
const authRouter = require("./routes/auth");
const trackRouter = require("./routes/track");

const app = express();

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        )
      ) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(express.json());

app.get("/api/config", (_req, res) => res.json({ ip: getLanIP(), port: 5173 }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/track", trackRouter);

module.exports = app;
```

- [ ] **Step 5: Replace server/index.js**

```js
const app = require("./app");
const PORT = process.env.PORT || 3737;

app.listen(PORT, "0.0.0.0", () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  let lan = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        lan = net.address;
        break;
      }
    }
  }
  console.log(
    `✅ Server running on http://localhost:${PORT} (LAN: ${lan}:${PORT})`,
  );
});
```

- [ ] **Step 6: Create stub route files (will be replaced in Tasks 4 and 7)**

`server/routes/auth.js` (stub):

```js
const express = require("express");
module.exports = express.Router();
```

`server/routes/track.js` (stub):

```js
const express = require("express");
module.exports = express.Router();
```

- [ ] **Step 7: Verify server still starts**

```bash
cd server && npm run dev
```

Expected: `✅ Server running on http://localhost:3737`

- [ ] **Step 8: Verify health endpoint**

```bash
curl http://localhost:3737/api/health
```

Expected: `{"ok":true}`

- [ ] **Step 8: Commit**

```bash
cd server
git add package.json app.js index.js jest.config.js
git commit -m "feat: split app.js from index.js, add jwt/bcryptjs/jest deps"
```

---

### Task 2: DB schema migration

**Files:**

- Modify: `server/db.js`

- [ ] **Step 1: Update server/db.js with new tables and column migration**

Replace the entire `server/db.js` with:

```js
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath =
  process.env.NODE_ENV === "test"
    ? ":memory:"
    : path.join(dataDir, "workshop.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// ── Core tables ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id       INTEGER REFERENCES shops(id),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('workshop','shop_employee')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number   TEXT NOT NULL UNIQUE,
    customer_name  TEXT NOT NULL,
    phone          TEXT NOT NULL,
    piece_type     TEXT NOT NULL,
    notes          TEXT DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'received',
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_status    ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_created   ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cust_tok  ON orders(customer_token) WHERE customer_token IS NOT NULL;
`);

// ── Additive migrations (idempotent) ─────────────────────────────────────────

function columnExists(table, col) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((r) => r.name === col);
}

if (!columnExists("orders", "shop_id")) {
  db.exec(`ALTER TABLE orders ADD COLUMN shop_id INTEGER REFERENCES shops(id)`);
}
if (!columnExists("orders", "cost")) {
  db.exec(`ALTER TABLE orders ADD COLUMN cost INTEGER NOT NULL DEFAULT 0`);
}
if (!columnExists("orders", "customer_token")) {
  db.exec(`ALTER TABLE orders ADD COLUMN customer_token TEXT`);
  // Backfill existing rows with a unique random hex token
  db.exec(
    `UPDATE orders SET customer_token = lower(hex(randomblob(16))) WHERE customer_token IS NULL`,
  );
}

// ── createOrder transaction ───────────────────────────────────────────────────

const createOrder = db.transaction((data) => {
  const today = new Date();
  const ymd =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const { next } = db
    .prepare(
      `SELECT COUNT(*) + 1 AS next FROM orders WHERE order_number LIKE ?`,
    )
    .get(`WRK-${ymd}-%`);

  const order_number = `WRK-${ymd}-${String(next).padStart(4, "0")}`;
  const customer_token = require("crypto").randomUUID();

  const result = db
    .prepare(
      `
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, shop_id, customer_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      order_number,
      data.customer_name,
      data.phone,
      data.piece_type,
      data.notes,
      data.shop_id ?? null,
      customer_token,
    );

  return db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(result.lastInsertRowid);
});

module.exports = { db, createOrder };
```

- [ ] **Step 2: Verify migration runs without error**

```bash
cd server && node -e "require('./db'); console.log('DB OK')"
```

Expected: `DB OK`

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add shops/users tables, cost/customer_token columns to orders"
```

---

### Task 3: JWT auth middleware

**Files:**

- Create: `server/middleware/auth.js`

- [ ] **Step 1: Create middleware directory and auth.js**

```bash
mkdir -p server/middleware
```

```js
// server/middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "غير مصرح" });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "الجلسة منتهية" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
```

- [ ] **Step 2: Create tests/auth.test.js**

```bash
mkdir -p server/tests
```

```js
// server/tests/auth.test.js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const { JWT_SECRET } = require("../middleware/auth");

describe("requireAuth middleware", () => {
  it("returns 401 when no Authorization header", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(401);
  });

  it("allows request with valid workshop token", async () => {
    const token = jwt.sign(
      { id: 1, role: "workshop", shop_id: null },
      JWT_SECRET,
    );
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run tests (expect them to fail — auth routes not wired yet)**

```bash
cd server && npm test -- tests/auth.test.js
```

Expected: 2 pass (401 tests), 1 fail (`/api/orders` still unprotected at this point). That's fine — orders route gets updated in Task 7.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/auth.js server/tests/auth.test.js
git commit -m "feat: add JWT requireAuth/requireRole middleware + tests"
```

---

### Task 4: Login endpoint

**Files:**

- Create: `server/routes/auth.js`

- [ ] **Step 1: Create server/routes/auth.js**

```js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "بيانات غير صحيحة" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      shop_id: user.shop_id,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({
    token,
    role: user.role,
    shop_id: user.shop_id,
    username: user.username,
  });
});

module.exports = router;
```

- [ ] **Step 2: Extend auth tests with login tests**

Append to `server/tests/auth.test.js`:

```js
const bcrypt = require("bcryptjs");
const { db } = require("../db");

describe("POST /api/auth/login", () => {
  beforeAll(() => {
    // Seed a test user directly into the in-memory DB
    db.prepare(
      `INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Test Shop')`,
    ).run();
    const hash = bcrypt.hashSync("pass123", 1); // rounds=1 for speed in tests
    db.prepare(
      `
      INSERT OR IGNORE INTO users (username, password_hash, role, shop_id)
      VALUES ('testuser', ?, 'shop_employee', 1)
    `,
    ).run(hash);
  });

  it("returns token on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "pass123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.role).toBe("shop_employee");
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run auth tests**

```bash
cd server && npm test -- tests/auth.test.js
```

Expected: all login tests pass

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js server/tests/auth.test.js
git commit -m "feat: add POST /api/auth/login endpoint + tests"
```

---

### Task 5: Seed script

**Files:**

- Create: `server/seed.js`

- [ ] **Step 1: Create server/seed.js**

```js
// server/seed.js — run once: node seed.js
const bcrypt = require("bcryptjs");
const { db } = require("./db");

console.log("Seeding database...\n");

// Workshop user
try {
  const hash = bcrypt.hashSync("workshop123", 10);
  db.prepare(
    `
    INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, 'workshop', NULL)
  `,
  ).run("workshop", hash);
  console.log("✓ Workshop user — username: workshop  password: workshop123");
} catch {
  console.log("⚠ Workshop user already exists (skipped)");
}

// Example shop
let shopId;
try {
  const res = db
    .prepare(`INSERT INTO shops (name) VALUES (?)`)
    .run("محل المجوهرات الأول");
  shopId = res.lastInsertRowid;
  console.log(`✓ Shop created — id: ${shopId}  name: محل المجوهرات الأول`);
} catch {
  shopId = db.prepare("SELECT id FROM shops LIMIT 1").get()?.id;
  console.log(`⚠ Shop already exists — id: ${shopId} (skipped)`);
}

// Shop employee
if (shopId) {
  try {
    const hash = bcrypt.hashSync("shop123", 10);
    db.prepare(
      `
      INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, 'shop_employee', ?)
    `,
    ).run("employee1", hash, shopId);
    console.log("✓ Shop employee — username: employee1  password: shop123");
  } catch {
    console.log("⚠ Shop employee already exists (skipped)");
  }
}

console.log("\n✅ Seed complete. Run this once per fresh database.");
process.exit(0);
```

- [ ] **Step 2: Run seed**

```bash
cd server && node seed.js
```

Expected output:

```
✓ Workshop user — username: workshop  password: workshop123
✓ Shop created — id: 1  name: محل المجوهرات الأول
✓ Shop employee — username: employee1  password: shop123
✅ Seed complete.
```

- [ ] **Step 3: Commit**

```bash
git add server/seed.js
git commit -m "feat: add database seed script with workshop user and example shop"
```

---

### Task 6: Update orders routes (auth + scoping + cost + pending_approval)

**Files:**

- Modify: `server/routes/orders.js`

- [ ] **Step 1: Write failing test for cost endpoint and scoping**

Create `server/tests/orders.test.js`:

```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../app");
const { db } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

let workshopToken, shopToken;

beforeAll(() => {
  db.prepare(
    `INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Shop A')`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO shops (id, name) VALUES (2, 'Shop B')`,
  ).run();

  workshopToken = jwt.sign(
    { id: 10, role: "workshop", shop_id: null },
    JWT_SECRET,
  );
  shopToken = jwt.sign(
    { id: 11, role: "shop_employee", shop_id: 1 },
    JWT_SECRET,
  );
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe("Order scoping", () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM orders`).run();
    // Order belonging to shop 1
    db.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('WRK-TEST-0001','Ali','966500000001','خاتم',1, 'token-shop1')`,
    ).run();
    // Order belonging to shop 2
    db.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('WRK-TEST-0002','Sara','966500000002','سوار',2,'token-shop2')`,
    ).run();
  });

  it("workshop sees all orders", async () => {
    const res = await request(app).get("/api/orders").set(auth(workshopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("shop_employee sees only own shop orders", async () => {
    const res = await request(app).get("/api/orders").set(auth(shopToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].order_number).toBe("WRK-TEST-0001");
  });
});

describe("PATCH /api/orders/:id/cost", () => {
  let orderId;
  beforeEach(() => {
    db.prepare(`DELETE FROM orders`).run();
    const res = db
      .prepare(
        `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token)
      VALUES ('WRK-COST-0001','Ali','966500000001','خاتم',1,'token-cost')`,
      )
      .run();
    orderId = res.lastInsertRowid;
  });

  it("cost > 0 sets status to pending_approval", async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 50 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending_approval");
    expect(res.body.cost).toBe(50);
  });

  it("cost = 0 sets status to in_progress", async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(workshopToken))
      .send({ cost: 0 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it("shop_employee cannot set cost", async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/cost`)
      .set(auth(shopToken))
      .send({ cost: 50 });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests (expect failures — orders route not updated yet)**

```bash
cd server && npm test -- tests/orders.test.js 2>&1 | tail -5
```

Expected: multiple failures

- [ ] **Step 3: Replace server/routes/orders.js**

```js
const express = require("express");
const { db, createOrder } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const ALLOWED_STATUSES = [
  "received",
  "pending_approval",
  "in_progress",
  "ready",
  "delivered",
];

// All order routes require auth
router.use(requireAuth);

// GET /api/orders/stats
router.get("/stats", (req, res) => {
  const isWorkshop = req.user.role === "workshop";
  const where = isWorkshop ? "" : "WHERE shop_id = ?";
  const params = isWorkshop ? [] : [req.user.shop_id];

  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total,
      SUM(status = 'received')          AS received,
      SUM(status = 'pending_approval')  AS pending_approval,
      SUM(status = 'in_progress')       AS in_progress,
      SUM(status = 'ready')             AS ready,
      SUM(status = 'delivered')         AS delivered
    FROM orders ${where}
  `,
    )
    .get(...params);
  res.json(row);
});

// GET /api/orders/barcode/:value — must be before /:id
router.get("/barcode/:value", (req, res) => {
  const isWorkshop = req.user.role === "workshop";
  const order = isWorkshop
    ? db
        .prepare("SELECT * FROM orders WHERE order_number = ?")
        .get(req.params.value)
    : db
        .prepare("SELECT * FROM orders WHERE order_number = ? AND shop_id = ?")
        .get(req.params.value, req.user.shop_id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  res.json(order);
});

// GET /api/orders
router.get("/", (req, res) => {
  const { status, search, limit, offset } = req.query;
  const isWorkshop = req.user.role === "workshop";

  if (status && status !== "all" && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "حالة غير صالحة" });
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let query = "SELECT * FROM orders WHERE 1=1";
  const params = [];

  if (!isWorkshop) {
    query += " AND shop_id = ?";
    params.push(req.user.shop_id);
  }
  if (status && status !== "all") {
    query += " AND status = ?";
    params.push(status);
  }
  if (search) {
    query +=
      " AND (customer_name LIKE ? OR order_number LIKE ? OR phone LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(safeLimit, safeOffset);

  res.json(db.prepare(query).all(...params));
});

// GET /api/orders/:id
router.get("/:id", (req, res) => {
  const isWorkshop = req.user.role === "workshop";
  const order = isWorkshop
    ? db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id)
    : db
        .prepare("SELECT * FROM orders WHERE id = ? AND shop_id = ?")
        .get(req.params.id, req.user.shop_id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  res.json(order);
});

// POST /api/orders — shop_employee only
router.post("/", requireRole("shop_employee"), (req, res) => {
  const { customer_name, phone, piece_type, notes = "" } = req.body;
  if (!customer_name || !phone || !piece_type) {
    return res
      .status(400)
      .json({ error: "الاسم ورقم الجوال ونوع القطعة مطلوبة" });
  }
  if (customer_name.trim().length > 100)
    return res.status(400).json({ error: "الاسم طويل جداً" });
  if (notes.trim().length > 1000)
    return res.status(400).json({ error: "الملاحظات طويلة جداً" });

  try {
    const created = createOrder({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      piece_type: piece_type.trim(),
      notes: notes.trim(),
      shop_id: req.user.shop_id,
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "فشل إنشاء الطلب" });
  }
});

// PATCH /api/orders/:id/status — workshop only
router.patch("/:id/status", requireRole("workshop"), (req, res) => {
  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "حالة غير صالحة" });
  }
  const result = db
    .prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    )
    .run(status, req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "الطلب غير موجود" });
  res.json(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id));
});

// PATCH /api/orders/:id/cost — workshop only
router.patch("/:id/cost", requireRole("workshop"), (req, res) => {
  const cost = parseInt(req.body.cost, 10);
  if (isNaN(cost) || cost < 0)
    return res.status(400).json({ error: "تكلفة غير صالحة" });

  const order = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(req.params.id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  if (order.status !== "received") {
    return res
      .status(400)
      .json({ error: "يمكن تحديد السعر فقط عند استلام الطلب" });
  }

  const newStatus = cost > 0 ? "pending_approval" : "in_progress";
  db.prepare(
    `UPDATE orders SET cost = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
  ).run(cost, newStatus, req.params.id);

  res.json(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id));
});

module.exports = router;
```

- [ ] **Step 4: Run orders tests**

```bash
cd server && npm test -- tests/orders.test.js
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/routes/orders.js server/tests/orders.test.js
git commit -m "feat: add auth scoping, cost endpoint, pending_approval to orders routes"
```

---

### Task 7: Track routes (public customer endpoints)

**Files:**

- Create: `server/routes/track.js`
- Create: `server/tests/track.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/track.test.js
const request = require("supertest");
const app = require("../app");
const { db } = require("../db");

let orderId;
const TEST_TOKEN = "test-customer-token-abc123";

beforeEach(() => {
  db.prepare(`DELETE FROM orders`).run();
  const res = db
    .prepare(
      `
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, status, customer_token, cost)
    VALUES ('WRK-TRK-0001','Ali','966500000001','خاتم','some notes','received', ?, 0)
  `,
    )
    .run(TEST_TOKEN);
  orderId = res.lastInsertRowid;
});

describe("GET /api/track/:token", () => {
  it("returns public order fields", async () => {
    const res = await request(app).get(`/api/track/${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("order_number", "WRK-TRK-0001");
    expect(res.body).toHaveProperty("status", "received");
    expect(res.body).toHaveProperty("cost", 0);
  });

  it("does NOT expose phone or notes", async () => {
    const res = await request(app).get(`/api/track/${TEST_TOKEN}`);
    expect(res.body).not.toHaveProperty("phone");
    expect(res.body).not.toHaveProperty("notes");
  });

  it("returns 404 for unknown token", async () => {
    const res = await request(app).get("/api/track/unknown-token-xyz");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/track/:token/approve", () => {
  beforeEach(() => {
    db.prepare(
      `UPDATE orders SET status = 'pending_approval', cost = 50 WHERE id = ?`,
    ).run(orderId);
  });

  it("moves pending_approval to in_progress", async () => {
    const res = await request(app).post(`/api/track/${TEST_TOKEN}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it("returns 400 if order is not pending_approval", async () => {
    db.prepare(`UPDATE orders SET status = 'in_progress' WHERE id = ?`).run(
      orderId,
    );
    const res = await request(app).post(`/api/track/${TEST_TOKEN}/approve`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown token", async () => {
    const res = await request(app).post("/api/track/bad-token/approve");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests (expect failures)**

```bash
cd server && npm test -- tests/track.test.js 2>&1 | tail -5
```

Expected: failures (route file doesn't exist yet)

- [ ] **Step 3: Create server/routes/track.js**

```js
const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /api/track/:token — public, returns limited fields only
router.get("/:token", (req, res) => {
  const order = db
    .prepare(
      `
    SELECT order_number, piece_type, status, cost, created_at
    FROM orders WHERE customer_token = ?
  `,
    )
    .get(req.params.token);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  res.json(order);
});

// POST /api/track/:token/approve — public customer approval
router.post("/:token/approve", (req, res) => {
  const order = db
    .prepare("SELECT id, status FROM orders WHERE customer_token = ?")
    .get(req.params.token);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  if (order.status !== "pending_approval") {
    return res.status(400).json({ error: "الطلب لا يحتاج إلى موافقة" });
  }
  db.prepare(
    `UPDATE orders SET status = 'in_progress', updated_at = datetime('now','localtime') WHERE id = ?`,
  ).run(order.id);
  res.json({ status: "in_progress" });
});

module.exports = router;
```

- [ ] **Step 4: Run all backend tests**

```bash
cd server && npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/routes/track.js server/tests/track.test.js
git commit -m "feat: add public track endpoints (GET /track/:token, POST /track/:token/approve)"
```

---

## Wave 2 — Frontend (Tasks 8–19 can run in parallel)

> All frontend tasks run from `client/` and are independent of each other unless noted.

---

### Task 8: CSS design system — light mode navy+gold

**Files:**

- Modify: `client/src/index.css`

- [ ] **Step 1: Replace the `:root` variables block (lines 5–26)**

Find the entire `:root { ... }` block and replace it with:

```css
:root {
  --bg-primary: #f8f9fb;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f4f8;
  --bg-sidebar: #1b2b5e;
  --primary: #1b2b5e;
  --gold: #c9973a;
  --gold-bright: #e8b84b;
  --gold-muted: #8b6620;
  --gold-border: rgba(201, 151, 58, 0.25);
  --text-primary: #111827;
  --text-secondary: #374151;
  --text-muted: #9ca3af;
  --status-received-bg: #eef2ff;
  --status-received-fg: #3730a3;
  --status-pending-bg: #fffbeb;
  --status-pending-fg: #92400e;
  --status-progress-bg: #eff6ff;
  --status-progress-fg: #1d4ed8;
  --status-ready-bg: #ecfdf5;
  --status-ready-fg: #065f46;
  --status-delivered-bg: #f0fdf4;
  --status-delivered-fg: #166534;
  --radius: 8px;
  --radius-lg: 12px;
}
```

- [ ] **Step 2: Update body background and scrollbar**

Replace:

```css
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: "Almarai", sans-serif;
  direction: rtl;
  text-align: right;
  -webkit-font-smoothing: antialiased;
  padding-bottom: env(safe-area-inset-bottom);
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--gold-muted);
  border-radius: 3px;
}
```

With the same block (no change needed — variables handle it).

- [ ] **Step 3: Update .order-stamp to light-mode style**

Replace:

```css
.order-stamp {
  font-family: "JetBrains Mono", monospace;
  background: linear-gradient(135deg, #1a1408, #2a2010);
  border: 1px solid var(--gold-border);
  border-radius: 6px;
  padding: 3px 10px;
  color: var(--gold-bright);
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  display: inline-block;
}
```

With:

```css
.order-stamp {
  font-family: "JetBrains Mono", monospace;
  background: #eef2ff;
  border: 1px solid rgba(27, 43, 94, 0.15);
  border-radius: 6px;
  padding: 3px 10px;
  color: #1b2b5e;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  display: inline-block;
}
```

- [ ] **Step 4: Update .order-row hover**

Replace:

```css
.order-row:hover {
  background: var(--bg-elevated);
  border-right-color: var(--gold);
}
```

With:

```css
.order-row:hover {
  background: #f8f9fb;
  border-right-color: var(--gold);
}
```

- [ ] **Step 5: Update .input-base for light mode**

Replace:

```css
.input-base {
  background: var(--bg-elevated);
  border: 1px solid var(--gold-border);
  border-radius: var(--radius);
  color: var(--text-primary);
  padding: 10px 14px;
  width: 100%;
  font-family: "Almarai", sans-serif;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  outline: none;
}
.input-base:focus {
  border-color: var(--gold);
}
.input-base::placeholder {
  color: var(--text-muted);
}
```

With:

```css
.input-base {
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: var(--radius);
  color: var(--text-primary);
  padding: 10px 14px;
  width: 100%;
  font-family: "Almarai", sans-serif;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  outline: none;
}
.input-base:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(27, 43, 94, 0.08);
}
.input-base::placeholder {
  color: var(--text-muted);
}
```

- [ ] **Step 6: Update .btn-gold**

Replace:

```css
.btn-gold {
  background: linear-gradient(135deg, var(--gold), var(--gold-muted));
  color: #16120D;
```

With:

```css
.btn-gold {
  background: linear-gradient(135deg, var(--gold), var(--gold-muted));
  color: #FFFFFF;
```

- [ ] **Step 7: Update .btn-ghost and .btn-ghost-sm for light mode**

Replace:

```css
.btn-ghost {
  background: transparent;
  border: 1px solid var(--gold-border);
  color: var(--text-secondary);
  font-family: "Almarai", sans-serif;
  font-size: 0.9rem;
  border-radius: var(--radius);
  padding: 9px 18px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-ghost:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.btn-ghost-sm {
  background: transparent;
  border: 1px solid var(--gold-border);
  color: var(--text-muted);
  font-family: "Almarai", sans-serif;
  font-size: 0.78rem;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}
.btn-ghost-sm:hover {
  border-color: var(--gold);
  color: var(--gold);
}
```

With:

```css
.btn-ghost {
  background: transparent;
  border: 1px solid #d1d5db;
  color: var(--text-secondary);
  font-family: "Almarai", sans-serif;
  font-size: 0.9rem;
  border-radius: var(--radius);
  padding: 9px 18px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-ghost:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-ghost-sm {
  background: transparent;
  border: 1px solid #d1d5db;
  color: var(--text-muted);
  font-family: "Almarai", sans-serif;
  font-size: 0.78rem;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}
.btn-ghost-sm:hover {
  border-color: var(--primary);
  color: var(--primary);
}
```

- [ ] **Step 8: Update select dropdown arrow color in select.input-base**

Replace the arrow SVG fill from `%238B7335` to `%231B2B5E`:

```css
select.input-base {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231B2B5E' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: left 12px center;
  padding-left: 32px;
}
select.input-base option {
  background: #ffffff;
}
```

- [ ] **Step 9: Update mobile bottom tab bar and FAB colors**

Replace:

```css
.bottom-tab-bar {
  display: flex;
  position: fixed;
  bottom: 0;
  right: 0;
  left: 0;
  height: calc(64px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg-surface);
  border-top: 1px solid var(--gold-border);
  z-index: 200;
}
```

With (same, `var(--bg-surface)` is now `#FFFFFF` — no change needed there, but update tab-item colors):

Replace:

```css
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 8px 0;
  color: var(--text-muted);
  text-decoration: none;
  font-family: "Almarai", sans-serif;
  font-size: 0.72rem;
  border-top: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s;
  gap: 3px;
}

.tab-item.active {
  color: var(--gold);
  border-top-color: var(--gold);
}
```

With same (no change needed — `var(--gold)` and `var(--text-muted)` handle it).

Replace FAB color:

```css
  .fab-new-order {
    ...
    background: linear-gradient(135deg, var(--gold), var(--gold-muted));
    color: #16120D;
```

With:

```css
  .fab-new-order {
    ...
    background: linear-gradient(135deg, var(--gold), var(--gold-muted));
    color: #FFFFFF;
```

- [ ] **Step 10: Add .btn-primary class (navy fill button)**

Append to the buttons section in index.css:

```css
.btn-primary {
  background: var(--primary);
  color: #ffffff;
  font-family: "Almarai", sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  border-radius: var(--radius);
  padding: 10px 22px;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary:hover {
  opacity: 0.9;
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 11: Verify visually — run dev server and check the app**

```bash
npm run dev
```

Open `http://localhost:5173` — background should be light, no dark backgrounds.

- [ ] **Step 12: Commit**

```bash
git add client/src/index.css
git commit -m "feat: replace dark CSS design system with light-mode navy+gold theme"
```

---

### Task 9: Layout — navy sidebar + logout button

**Files:**

- Modify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Replace Layout.jsx**

```jsx
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getRole } from "../api/auth";

const nav = [
  { to: "/", icon: "◈", label: "الطلبات" },
  { to: "/new", icon: "✦", label: "صيانة جديدة", roles: ["shop_employee"] },
  { to: "/scan", icon: "⌖", label: "مسح" },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const role = getRole();

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const visibleNav = nav.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <div
      className="main-layout"
      style={{ display: "flex", height: "100%", minHeight: "100vh" }}
    >
      {/* Sidebar — desktop */}
      <aside
        className="sidebar"
        style={{
          width: "220px",
          minWidth: "220px",
          background: "var(--bg-sidebar)",
          display: "flex",
          flexDirection: "column",
          padding: "0",
        }}
      >
        <div style={{ padding: "28px 20px 20px" }}>
          <div
            style={{
              fontFamily: "Almarai, sans-serif",
              fontWeight: 800,
              fontSize: "1.15rem",
              color: "var(--gold)",
              letterSpacing: "0.02em",
              lineHeight: 1.3,
            }}
          >
            مجوهرات سليمان المضيان
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "0.72rem",
              marginTop: "3px",
            }}
          >
            إدارة صيانة المجوهرات
          </div>
        </div>

        <div className="gold-line" style={{ margin: "0 16px" }} />

        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {visibleNav.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                marginBottom: "4px",
                color: isActive ? "var(--gold)" : "rgba(255,255,255,0.65)",
                background: isActive ? "rgba(201,151,58,0.12)" : "transparent",
                borderRight: isActive
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 700 : 400,
                transition: "all 0.15s",
              })}
            >
              <span style={{ fontSize: "1rem", opacity: 0.85 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontFamily: "Almarai, sans-serif",
              cursor: "pointer",
              textAlign: "right",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#fff";
              e.target.style.borderColor = "rgba(255,255,255,0.35)";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "rgba(255,255,255,0.5)";
              e.target.style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            تسجيل الخروج ←
          </button>
          <div
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: "0.65rem",
              marginTop: "8px",
            }}
          >
            يتطلب Chrome أو Edge للطباعة
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}
      >
        {children}
      </main>

      {/* Bottom tab bar — mobile */}
      <nav className="bottom-tab-bar">
        {visibleNav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}
          >
            <span className="tab-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: navy sidebar, logout button, role-based nav visibility"
```

---

### Task 10: StatusBadge — add pending_approval

**Files:**

- Modify: `client/src/components/StatusBadge.jsx`

- [ ] **Step 1: Update STATUS map in StatusBadge.jsx**

Replace the entire file:

```jsx
const STATUS = {
  received: {
    label: "مستلمة",
    bg: "var(--status-received-bg)",
    fg: "var(--status-received-fg)",
  },
  pending_approval: {
    label: "بانتظار الموافقة",
    bg: "var(--status-pending-bg)",
    fg: "var(--status-pending-fg)",
  },
  in_progress: {
    label: "قيد العمل",
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
  },
  ready: {
    label: "جاهزة",
    bg: "var(--status-ready-bg)",
    fg: "var(--status-ready-fg)",
  },
  delivered: {
    label: "تم التسليم",
    bg: "var(--status-delivered-bg)",
    fg: "var(--status-delivered-fg)",
  },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.received;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "0.78rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export { STATUS };
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/StatusBadge.jsx
git commit -m "feat: add pending_approval to StatusBadge"
```

---

### Task 11: Frontend auth utilities + update API headers

**Files:**

- Create: `client/src/api/auth.js`
- Modify: `client/src/api/orders.js`

- [ ] **Step 1: Create client/src/api/auth.js**

```js
export function getToken() {
  return localStorage.getItem("token");
}
export function getRole() {
  return localStorage.getItem("role");
}
export function getShopId() {
  return localStorage.getItem("shop_id");
}
export function isLoggedIn() {
  return !!getToken();
}

export function saveAuth({ token, role, shop_id, username }) {
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
  localStorage.setItem("username", username || "");
  if (shop_id != null) localStorage.setItem("shop_id", String(shop_id));
}

export function clearAuth() {
  ["token", "role", "shop_id", "username"].forEach((k) =>
    localStorage.removeItem(k),
  );
}

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "خطأ في تسجيل الدخول");
  }
  const data = await res.json();
  saveAuth(data);
  return data;
}
```

- [ ] **Step 2: Replace client/src/api/orders.js**

```js
import { getToken } from "./auth";

const BASE = "/api/orders";

function authHeaders() {
  const token = getToken();
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) return { ip: "localhost", port: 5173 };
  return res.json();
}

export async function getOrders({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("فشل تحميل الطلبات");
  return res.json();
}

export async function getStats() {
  const res = await fetch("/api/orders/stats", { headers: authHeaders() });
  if (!res.ok) throw new Error("فشل تحميل الإحصائيات");
  return res.json();
}

export async function createOrder(data) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "فشل إنشاء الطلب");
  }
  return res.json();
}

export async function getOrderByBarcode(value) {
  const res = await fetch(`${BASE}/barcode/${encodeURIComponent(value)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("الطلب غير موجود");
  return res.json();
}

export async function updateOrderStatus(id, status) {
  const res = await fetch(`${BASE}/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("فشل تحديث الحالة");
  return res.json();
}

export async function updateCost(id, cost) {
  const res = await fetch(`${BASE}/${id}/cost`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ cost }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "فشل تحديث التكلفة");
  }
  return res.json();
}

export async function getTrackOrder(token) {
  const res = await fetch(`/api/track/${token}`);
  if (!res.ok) throw new Error("الطلب غير موجود");
  return res.json();
}

export async function approveOrder(token) {
  const res = await fetch(`/api/track/${token}/approve`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "فشل الموافقة");
  }
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/auth.js client/src/api/orders.js
git commit -m "feat: add auth utilities, inject Bearer token into all API calls"
```

---

### Task 12: PrivateRoute + LoginPage

**Files:**

- Create: `client/src/components/PrivateRoute.jsx`
- Create: `client/src/pages/LoginPage.jsx`

- [ ] **Step 1: Create client/src/components/PrivateRoute.jsx**

```jsx
import { Navigate } from "react-router-dom";
import { isLoggedIn } from "../api/auth";

export default function PrivateRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}
```

- [ ] **Step 2: Create client/src/pages/LoginPage.jsx**

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius-lg)",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "360px",
          boxShadow: "0 4px 24px rgba(27,43,94,0.08)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--primary)",
              marginBottom: "4px",
            }}
          >
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "6px",
              }}
            >
              اسم المستخدم
            </label>
            <input
              className="input-base"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{ direction: "ltr", textAlign: "left" }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "6px",
              }}
            >
              كلمة المرور
            </label>
            <input
              className="input-base"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ direction: "ltr", textAlign: "left" }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "var(--radius)",
                padding: "10px 14px",
                color: "#DC2626",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "12px 0",
              fontSize: "1rem",
              marginTop: "8px",
            }}
          >
            {loading ? "..." : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PrivateRoute.jsx client/src/pages/LoginPage.jsx
git commit -m "feat: add PrivateRoute guard and LoginPage"
```

---

### Task 13: App.jsx — add public routes + PrivateRoute wrapping

**Files:**

- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace App.jsx**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import ScanPage from "./pages/ScanPage";
import LoginPage from "./pages/LoginPage";
import TrackPage from "./pages/TrackPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/track/:token" element={<TrackPage />} />

        {/* Protected */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/new" element={<NewOrder />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify app redirects to /login when not authenticated**

Open `http://localhost:5173` in browser — should redirect to `/login`.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add /login and /track/:token public routes, protect internal routes"
```

---

### Task 14: Dashboard — add pending_approval stat card

**Files:**

- Modify: `client/src/pages/Dashboard.jsx`

- [ ] **Step 1: Update STAT_CARDS array in Dashboard.jsx**

Replace:

```js
const STAT_CARDS = [
  {
    key: "received",
    label: "مستلمة",
    icon: "◈",
    color: "var(--status-received-fg)",
  },
  {
    key: "in_progress",
    label: "قيد العمل",
    icon: "⟳",
    color: "var(--status-progress-fg)",
  },
  { key: "ready", label: "جاهزة", icon: "✓", color: "var(--status-ready-fg)" },
  { key: "delivered", label: "مُسلَّمة", icon: "✦", color: "var(--gold)" },
];
```

With:

```js
const STAT_CARDS = [
  {
    key: "received",
    label: "مستلمة",
    icon: "◈",
    color: "var(--status-received-fg)",
  },
  {
    key: "pending_approval",
    label: "بانتظار الموافقة",
    icon: "⏳",
    color: "var(--status-pending-fg)",
  },
  {
    key: "in_progress",
    label: "قيد العمل",
    icon: "⟳",
    color: "var(--status-progress-fg)",
  },
  { key: "ready", label: "جاهزة", icon: "✓", color: "var(--status-ready-fg)" },
  { key: "delivered", label: "مُسلَّمة", icon: "✦", color: "var(--gold)" },
];
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat: add pending_approval stat card to Dashboard"
```

---

### Task 15: OrderList — pending_approval filter + role-gated status buttons

**Files:**

- Modify: `client/src/components/OrderList.jsx`

- [ ] **Step 1: Update FILTERS and nextStatus maps, add role check**

At the top of OrderList.jsx, add the import:

```js
import { getRole } from "../api/auth";
```

Replace the FILTERS array:

```js
const FILTERS = [
  { value: "all", label: "الكل" },
  { value: "received", label: "مستلمة" },
  { value: "pending_approval", label: "بانتظار الموافقة" },
  { value: "in_progress", label: "قيد العمل" },
  { value: "ready", label: "جاهزة" },
  { value: "delivered", label: "تم التسليم" },
];
```

Inside the `OrderList` component function, after the existing hooks, add:

```js
const isWorkshop = getRole() === "workshop";
```

Replace the nextStatus/nextLabel maps:

```js
const nextStatus = {
  in_progress: "ready",
  ready: "delivered",
};

const nextLabel = {
  in_progress: "تعيين جاهزة",
  ready: "تسليم",
};
```

- [ ] **Step 2: Gate status buttons behind isWorkshop**

In both the mobile card view and desktop table view, wrap the status button in `{isWorkshop && nextStatus[order.status] && (`:

Mobile card view — replace:

```jsx
<div style={{ display: "flex", gap: "6px" }}>
  {nextStatus[order.status] && (
    <button
      className={isMobile ? "btn-ghost mobile-status-btn" : "btn-ghost-sm"}
      onClick={() => changeStatus(order.id, nextStatus[order.status])}
    >
      {nextLabel[order.status]}
    </button>
  )}
  {order.status === "delivered" && (
    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>✓</span>
  )}
</div>
```

With:

```jsx
<div style={{ display: "flex", gap: "6px" }}>
  {isWorkshop && nextStatus[order.status] && (
    <button
      className={isMobile ? "btn-ghost mobile-status-btn" : "btn-ghost-sm"}
      onClick={() => changeStatus(order.id, nextStatus[order.status])}
    >
      {nextLabel[order.status]}
    </button>
  )}
  {order.status === "delivered" && (
    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>✓</span>
  )}
</div>
```

Apply the same `isWorkshop &&` gate in the desktop table view's action column.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/OrderList.jsx
git commit -m "feat: add pending_approval filter, role-gate status buttons in OrderList"
```

---

### Task 16: CostEditor component

**Files:**

- Create: `client/src/components/CostEditor.jsx`

- [ ] **Step 1: Create client/src/components/CostEditor.jsx**

```jsx
import { useState } from "react";
import { updateCost } from "../api/orders";

export default function CostEditor({ order, onUpdated }) {
  const [cost, setCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const updated = await updateCost(order.id, parseInt(cost, 10));
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "rgba(201,151,58,0.06)",
        border: "1px solid var(--gold-border)",
        borderRadius: "var(--radius)",
        padding: "14px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          marginBottom: "10px",
          fontWeight: 600,
        }}
      >
        تحديد تكلفة الإصلاح
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}
      >
        <div style={{ flex: 1 }}>
          <input
            className="input-base"
            type="number"
            min="0"
            placeholder="0 (مجاني)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
            style={{ direction: "ltr", textAlign: "left" }}
          />
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            بالريال السعودي — أدخل 0 للخدمة المجانية
          </div>
        </div>
        <button
          type="submit"
          className="btn-gold"
          disabled={loading || cost === ""}
          style={{ padding: "10px 16px", fontSize: "0.88rem", flexShrink: 0 }}
        >
          {loading ? "..." : "تأكيد"}
        </button>
      </form>
      {error && (
        <div
          style={{ color: "#DC2626", fontSize: "0.82rem", marginTop: "8px" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/CostEditor.jsx
git commit -m "feat: add CostEditor component for workshop to set repair cost"
```

---

### Task 17: ScanResult — role-aware actions + wa.me buttons

**Files:**

- Modify: `client/src/components/ScanResult.jsx`

- [ ] **Step 1: Replace ScanResult.jsx**

```jsx
import React, { useState } from "react";
import StatusBadge from "./StatusBadge";
import CostEditor from "./CostEditor";
import { updateOrderStatus } from "../api/orders";
import { getRole } from "../api/auth";

function useMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function buildApprovalWaUrl(phone, customerName, cost, trackingUrl) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `تم تقييم قطعتك وتكلفة الإصلاح: ${cost} ريال.\n` +
    `للموافقة على السعر والمتابعة:\n${trackingUrl}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildReadyWaUrl(phone, customerName, orderNumber) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `نود إعلامكم بأن قطعتكم جاهزة للاستلام.\n` +
    `رقم الطلب: ${orderNumber}\n\n` +
    `شكراً لثقتكم بنا 🏅`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function ScanResult({
  order: initialOrder,
  onScanAgain,
  onOrderUpdated,
}) {
  const isMobile = useMobile();
  const [order, setOrder] = useState(initialOrder);
  const [promoting, setPromoting] = useState(false);
  const isWorkshop = getRole() === "workshop";

  function handleOrderUpdate(updated) {
    setOrder(updated);
    onOrderUpdated?.(updated);
  }

  const trackingUrl = `${window.location.protocol}//${window.location.host}/track/${order.customer_token}`;
  const approvalWaUrl = buildApprovalWaUrl(
    order.phone,
    order.customer_name,
    order.cost,
    trackingUrl,
  );
  const readyWaUrl = buildReadyWaUrl(
    order.phone,
    order.customer_name,
    order.order_number,
  );

  async function markReady() {
    setPromoting(true);
    try {
      handleOrderUpdate(await updateOrderStatus(order.id, "ready"));
    } catch (e) {
      console.error(e);
    } finally {
      setPromoting(false);
    }
  }

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--gold-border)",
    borderRadius: "var(--radius-lg)",
    padding: "28px",
    maxWidth: isMobile ? "100%" : "440px",
    width: "100%",
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "var(--status-ready-bg)",
            border: "1px solid rgba(6,95,70,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            color: "var(--status-ready-fg)",
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
            تم العثور على الطلب
          </div>
          <span className="order-stamp">{order.order_number}</span>
        </div>
      </div>

      <div className="gold-line" style={{ marginBottom: "18px" }} />

      {/* Order details */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <Row label="العميل" value={order.customer_name} bold />
        <Row label="القطعة" value={order.piece_type} />
        <Row label="الجوال" value={"+" + order.phone} mono />
        <Row label="الحالة" value={<StatusBadge status={order.status} />} />
        {order.cost > 0 && (
          <Row label="التكلفة" value={`${order.cost} ريال`} bold />
        )}
        {order.notes && <Row label="ملاحظات" value={order.notes} />}
      </div>

      {/* Cost editor — workshop + received only */}
      {isWorkshop && order.status === "received" && (
        <CostEditor order={order} onUpdated={handleOrderUpdate} />
      )}

      {/* Approval wa.me — pending_approval */}
      {order.status === "pending_approval" && (
        <div
          style={{
            background: "rgba(201,151,58,0.06)",
            border: "1px solid var(--gold-border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              marginBottom: "10px",
            }}
          >
            أرسل رابط الموافقة للعميل ({order.cost} ريال)
          </div>
          <a
            href={approvalWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <button
              className="btn-gold"
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
            >
              📲 أرسل رابط الموافقة
            </button>
          </a>
        </div>
      )}

      {/* Mark ready — workshop + in_progress */}
      {isWorkshop && order.status === "in_progress" && (
        <div
          style={{
            background: "rgba(201,151,58,0.06)",
            border: "1px solid var(--gold-border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              marginBottom: "10px",
            }}
          >
            هل الصيانة جاهزة للاستلام؟
          </div>
          <button
            className="btn-gold"
            onClick={markReady}
            disabled={promoting}
            style={
              isMobile
                ? {
                    width: "100%",
                    justifyContent: "center",
                    padding: "14px 0",
                    fontSize: "1rem",
                  }
                : { fontSize: "0.85rem", padding: "8px 16px" }
            }
          >
            {promoting ? "..." : "✓ تعيين جاهزة"}
          </button>
        </div>
      )}

      {/* Pickup wa.me — ready */}
      {order.status === "ready" && (
        <div
          style={{
            background: "rgba(6,95,70,0.06)",
            border: "1px solid rgba(6,95,70,0.2)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--status-ready-fg)",
              marginBottom: "10px",
              fontWeight: 600,
            }}
          >
            ✓ القطعة جاهزة — أبلغ العميل
          </div>
          <a
            href={readyWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <button
              className="btn-gold"
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
            >
              📲 أبلغ العميل بالاستلام
            </button>
          </a>
        </div>
      )}

      {/* Scan again */}
      <div
        className="scan-actions"
        style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
      >
        <button className="btn-ghost" onClick={onScanAgain}>
          ⌖ مسح آخر
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
        {label}
      </span>
      <span
        style={{
          fontWeight: bold ? 700 : 400,
          fontFamily: mono ? "JetBrains Mono, monospace" : "inherit",
          fontSize: mono ? "0.82rem" : "0.92rem",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ScanResult.jsx
git commit -m "feat: role-aware ScanResult with CostEditor, approval/pickup wa.me buttons"
```

---

### Task 18: Customer tracking page

**Files:**

- Create: `client/src/pages/TrackPage.jsx`

- [ ] **Step 1: Create client/src/pages/TrackPage.jsx**

```jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getTrackOrder, approveOrder } from "../api/orders";

const STEPS_ALL = [
  "received",
  "pending_approval",
  "in_progress",
  "ready",
  "delivered",
];
const STEPS_NO_APPROVAL = ["received", "in_progress", "ready", "delivered"];

const STEP_LABELS = {
  received: "استُلم",
  pending_approval: "بانتظار الموافقة",
  in_progress: "قيد التنفيذ",
  ready: "جاهز",
  delivered: "سُلِّم",
};

const STATUS_MESSAGES = {
  received: "تم استلام قطعتك، سيتم تقييمها قريباً",
  pending_approval: "يرجى الموافقة على تكلفة الإصلاح أدناه",
  in_progress: "قطعتك قيد التنفيذ",
  ready: "✓ قطعتك جاهزة للاستلام!",
  delivered: "تم التسليم، شكراً لثقتك",
};

export default function TrackPage() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    getTrackOrder(token)
      .then(setOrder)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setApproving(true);
    try {
      await approveOrder(token);
      setApproved(true);
      setOrder((prev) => ({ ...prev, status: "in_progress" }));
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F9FB",
        }}
      >
        <div style={{ color: "#9CA3AF", fontFamily: "Almarai, sans-serif" }}>
          جاري التحميل...
        </div>
      </div>
    );

  if (notFound)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F9FB",
          padding: "20px",
        }}
      >
        <div style={{ textAlign: "center", fontFamily: "Almarai, sans-serif" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px", opacity: 0.3 }}>
            ◈
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "#111827",
              marginBottom: "8px",
            }}
          >
            الطلب غير موجود
          </div>
          <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>
            تأكد من الرابط أو المسح مجدداً
          </div>
        </div>
      </div>
    );

  const usePendingStep =
    order.status === "pending_approval" ||
    STEPS_ALL.indexOf(order.status) > STEPS_ALL.indexOf("pending_approval");
  const steps = usePendingStep ? STEPS_ALL : STEPS_NO_APPROVAL;
  const currentIdx = steps.indexOf(order.status);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F9FB",
        fontFamily: "Almarai, sans-serif",
        direction: "rtl",
        padding: "24px 16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              color: "#1B2B5E",
              marginBottom: "4px",
            }}
          >
            مجوهرات سليمان المضيان
          </div>
          <div style={{ color: "#9CA3AF", fontSize: "0.78rem" }}>
            إدارة صيانة المجوهرات
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(201,151,58,0.25)",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 16px rgba(27,43,94,0.06)",
          }}
        >
          {/* Order number + piece type */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#9CA3AF",
                marginBottom: "6px",
              }}
            >
              رقم الطلب
            </div>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                background: "#EEF2FF",
                border: "1px solid rgba(27,43,94,0.15)",
                borderRadius: "6px",
                padding: "4px 12px",
                color: "#1B2B5E",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              {order.order_number}
            </span>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#9CA3AF",
                marginBottom: "4px",
              }}
            >
              نوع القطعة
            </div>
            <div style={{ fontWeight: 600, color: "#111827" }}>
              {order.piece_type}
            </div>
          </div>

          {/* Progress tracker */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#9CA3AF",
                marginBottom: "12px",
              }}
            >
              مراحل الطلب
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {steps.map((step, i) => {
                const completed = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <div
                        style={{
                          flex: 1,
                          height: "2px",
                          background: completed ? "#C9973A" : "#E5E7EB",
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: completed
                          ? "#C9973A"
                          : active
                            ? "#1B2B5E"
                            : "#E5E7EB",
                        color: completed || active ? "#FFFFFF" : "#9CA3AF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >
                      {completed ? "✓" : i + 1}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ display: "flex", marginTop: "8px" }}>
              {steps.map((step, i) => (
                <div
                  key={step}
                  style={{
                    flex: i === 0 ? "0 0 28px" : 1,
                    fontSize: "0.58rem",
                    color: step === order.status ? "#1B2B5E" : "#9CA3AF",
                    fontWeight: step === order.status ? 700 : 400,
                    textAlign:
                      i === 0
                        ? "right"
                        : i === steps.length - 1
                          ? "left"
                          : "center",
                    marginLeft: i > 0 ? "-14px" : 0,
                    marginRight: i > 0 ? "-14px" : 0,
                    paddingLeft: i > 0 ? "14px" : 0,
                    paddingRight: i > 0 ? "14px" : 0,
                  }}
                >
                  {STEP_LABELS[step]}
                </div>
              ))}
            </div>
          </div>

          {/* Status message */}
          <div
            style={{
              background:
                order.status === "ready"
                  ? "rgba(6,95,70,0.06)"
                  : "rgba(27,43,94,0.04)",
              border: `1px solid ${order.status === "ready" ? "rgba(6,95,70,0.2)" : "rgba(27,43,94,0.1)"}`,
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: order.status === "pending_approval" ? "16px" : "0",
              color: order.status === "ready" ? "#065F46" : "#1B2B5E",
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            {STATUS_MESSAGES[order.status]}
          </div>

          {/* Cost approval */}
          {order.status === "pending_approval" && !approved && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid rgba(201,151,58,0.35)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "#92400E",
                  marginBottom: "4px",
                }}
              >
                رسوم الإصلاح
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "#1B2B5E",
                  marginBottom: "16px",
                }}
              >
                {order.cost} ريال سعودي
              </div>
              <button
                onClick={handleApprove}
                disabled={approving}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  background: "#1B2B5E",
                  color: "#C9973A",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  fontFamily: "Almarai, sans-serif",
                  cursor: approving ? "not-allowed" : "pointer",
                  opacity: approving ? 0.7 : 1,
                  letterSpacing: "0.02em",
                }}
              >
                {approving ? "..." : "أوافق على السعر"}
              </button>
            </div>
          )}

          {approved && (
            <div
              style={{
                background: "#ECFDF5",
                border: "1px solid rgba(6,95,70,0.2)",
                borderRadius: "8px",
                padding: "14px",
                color: "#065F46",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              ✓ تمت الموافقة، جارٍ التنفيذ
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "24px",
            color: "#9CA3AF",
            fontSize: "0.72rem",
          }}
        >
          هذه الصفحة للاستخدام الشخصي فقط
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/TrackPage.jsx
git commit -m "feat: add public customer tracking page with cost approval"
```

---

### Task 19: Two-label printing (LabelCanvas + useLabelPrint)

**Files:**

- Modify: `client/src/components/LabelCanvas.jsx`
- Modify: `client/src/components/useLabelPrint.js`

- [ ] **Step 1: Update useLabelPrint.js to add printAll()**

Replace `useLabelPrint.js`:

```js
import { useState, useRef } from "react";
import { NiimbotBluetoothClient, ImageEncoder } from "@mmote/niimbluelib";

export default function useLabelPrint() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState("");
  const clientRef = useRef(null);

  async function connect() {
    setError("");
    try {
      const client = new NiimbotBluetoothClient();
      await client.connect();
      client.on("disconnect", () => {
        setIsConnected(false);
        clientRef.current = null;
      });
      await client.fetchPrinterInfo();
      clientRef.current = client;
      setIsConnected(true);
    } catch (e) {
      setError(e.message || "فشل الاتصال بالطابعة");
    }
  }

  async function disconnect() {
    try {
      if (clientRef.current) await clientRef.current.disconnect();
    } catch (e) {
      console.error("Disconnect error", e);
    } finally {
      clientRef.current = null;
      setIsConnected(false);
    }
  }

  // Print a single canvas (kept for backward compatibility)
  async function print(canvas) {
    return printAll([canvas]);
  }

  // Print multiple canvases sequentially in one Bluetooth session
  async function printAll(canvases) {
    const client = clientRef.current;
    if (!client) {
      setError("غير متصل بالطابعة");
      return;
    }

    setIsPrinting(true);
    setError("");

    try {
      const printTask = client.abstraction.newPrintTask("B21_V1", {
        totalPages: canvases.length,
        density: 3,
      });
      await printTask.printInit();

      for (const canvas of canvases) {
        const encoded = ImageEncoder.encodeCanvas(canvas, "left");
        await printTask.printPage(encoded, 1);
        await printTask.waitForPageFinished();
      }

      await printTask.waitForFinished();
    } catch (e) {
      setError(e.message || "فشل الطباعة");
    } finally {
      try {
        await client.abstraction?.printEnd();
      } catch (_) {}
      setIsPrinting(false);
    }
  }

  return {
    connect,
    disconnect,
    print,
    printAll,
    isConnected,
    isPrinting,
    error,
  };
}
```

- [ ] **Step 2: Replace LabelCanvas.jsx with two-canvas version**

```jsx
import { useRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import useLabelPrint from "./useLabelPrint";
import { getConfig } from "../api/orders";

// B21: 40mm × 30mm @ 203 DPI = 320 × 240 px
const W = 320;
const H = 240;

// ── Customer label — QR code points to /track/:customer_token ────────────────
async function drawCustomerLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#CCCCCC";
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header
  ctx.fillStyle = "#1B2B5E";
  ctx.fillRect(2, 2, W - 4, 34);
  ctx.fillStyle = "#C9973A";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("مجوهرات سليمان المضيان", W - 10, 23);

  // Order number
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 52);

  // Customer + piece
  ctx.font = "bold 12px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.fillText(order.customer_name, W - 10, 72);
  ctx.font = "10px Almarai, Arial";
  ctx.fillStyle = "#555555";
  ctx.fillText(order.piece_type, W - 10, 88);

  // QR code
  try {
    const { ip, port } = await getConfig();
    if (ip === "localhost" || ip === "127.0.0.1") {
      ctx.font = "bold 9px Arial";
      ctx.fillStyle = "#CC0000";
      ctx.textAlign = "center";
      ctx.direction = "ltr";
      ctx.fillText("QR unavailable — check network", W / 2, 170);
      return;
    }

    const trackUrl = `http://${ip}:${port}/track/${order.customer_token}`;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, trackUrl, {
      width: 110,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
    ctx.drawImage(qrCanvas, W - 120, 100);

    // Scan instruction
    ctx.font = "9px Almarai, Arial";
    ctx.fillStyle = "#888888";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText("امسح للمتابعة والموافقة", W - 10, 98);
  } catch (e) {
    console.error("Customer label QR failed", e);
  }
}

// ── Shop label — CODE128 barcode for internal scanning ───────────────────────
function drawShopLabel(canvas, order) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#CCCCCC";
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header
  ctx.fillStyle = "#1B2B5E";
  ctx.fillRect(2, 2, W - 4, 34);
  ctx.fillStyle = "#C9973A";
  ctx.font = "bold 13px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("نسخة الورشة", W - 10, 23);

  // Order number
  ctx.fillStyle = "#111111";
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(order.order_number, W / 2, 52);

  // Customer + piece + date
  ctx.font = "bold 12px Almarai, Arial";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.fillText(order.customer_name, W - 10, 72);
  ctx.font = "10px Almarai, Arial";
  ctx.fillStyle = "#555555";
  const dateStr = new Date(order.created_at).toLocaleDateString("ar-SA");
  ctx.fillText(`${order.piece_type} — ${dateStr}`, W - 10, 88);

  // CODE128 barcode
  try {
    const barcodeCanvas = document.createElement("canvas");
    JsBarcode(barcodeCanvas, order.order_number, {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: false,
      margin: 4,
      background: "#FFFFFF",
      lineColor: "#000000",
    });
    const bx = Math.max(2, Math.floor((W - barcodeCanvas.width) / 2));
    ctx.drawImage(barcodeCanvas, bx, 100);
  } catch (e) {
    console.error("Barcode draw failed", e);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#CC0000";
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText("Barcode error", W / 2, 160);
  }
}

export default function LabelCanvas({ order }) {
  const customerRef = useRef(null);
  const shopRef = useRef(null);
  const [ready, setReady] = useState(false);
  const {
    connect,
    printAll,
    disconnect,
    isConnected,
    isPrinting,
    error: btError,
  } = useLabelPrint();

  useEffect(() => {
    if (!order || !customerRef.current || !shopRef.current) return;
    setReady(false);
    Promise.all([
      drawCustomerLabel(customerRef.current, order),
      Promise.resolve(drawShopLabel(shopRef.current, order)),
    ])
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Label draw failed", err);
        setReady(true);
      });
  }, [order]);

  const bluetoothAvailable =
    typeof navigator !== "undefined" && !!navigator.bluetooth;

  return (
    <div>
      {/* Two label previews side by side */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        {[
          { ref: customerRef, title: "ملصق العميل" },
          { ref: shopRef, title: "ملصق الورشة" },
        ].map(({ ref, title }) => (
          <div key={title}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginBottom: "6px",
                textAlign: "center",
              }}
            >
              {title}
            </div>
            <div
              style={{
                border: "1px solid var(--gold-border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                display: "inline-block",
                background: "#fff",
                boxShadow: "0 2px 12px rgba(27,43,94,0.1)",
                opacity: ready ? 1 : 0.5,
                transition: "opacity 0.3s",
              }}
            >
              <canvas
                ref={ref}
                style={{ display: "block", maxWidth: "160px" }}
              />
            </div>
          </div>
        ))}
      </div>

      {!ready && (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            marginBottom: "10px",
          }}
        >
          ⟳ جاري توليد الملصقات...
        </div>
      )}

      {/* Print controls */}
      {!bluetoothAvailable ? (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            color: "#DC2626",
            fontSize: "0.83rem",
          }}
        >
          ⚠ طابعة Niimbot تتطلب Chrome أو Edge مع دعم Bluetooth
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {!isConnected ? (
            <button className="btn-ghost" onClick={connect}>
              ⌘ اتصال بالطابعة
            </button>
          ) : (
            <>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--status-ready-fg)",
                  fontSize: "0.83rem",
                }}
              >
                <span
                  className="pulse-gold"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--status-ready-fg)",
                    display: "inline-block",
                  }}
                />
                متصل
              </span>
              <button
                className="btn-gold"
                disabled={isPrinting || !ready}
                onClick={() => printAll([customerRef.current, shopRef.current])}
              >
                {isPrinting ? "جاري الطباعة..." : "⎙ طباعة الملصقين"}
              </button>
              <button className="btn-ghost-sm" onClick={disconnect}>
                قطع الاتصال
              </button>
            </>
          )}
        </div>
      )}

      {btError && (
        <div
          style={{
            marginTop: "10px",
            color: "#DC2626",
            fontSize: "0.82rem",
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "var(--radius)",
          }}
        >
          {btError}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/LabelCanvas.jsx client/src/components/useLabelPrint.js
git commit -m "feat: two-label printing — customer QR label + shop CODE128 label"
```

---

## Final Integration Check

- [ ] **Run all backend tests**

```bash
cd server && npm test
```

Expected: all pass

- [ ] **Start both server + client**

```bash
cd .. && npm run dev
```

- [ ] **Seed the database (if fresh)**

```bash
cd server && node seed.js
```

- [ ] **End-to-end smoke test**

1. Open `http://localhost:5173` → should redirect to `/login`
2. Login as `workshop` / `workshop123` → should land on Dashboard
3. Login as `employee1` / `shop123` → create a new order → verify label preview shows two canvases
4. Log back in as `workshop` → find the order → set cost (e.g. 50) → verify status becomes `pending_approval`
5. Open the tracking URL shown in ScanResult → verify TrackPage loads with approval button
6. Click "أوافق على السعر" → verify status changes to `in_progress`
7. As workshop → mark order as `ready` → verify pickup wa.me button appears
8. As `workshop` → connect Niimbot B21 → print → two labels should print

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete workshop redesign — auth, cost approval, customer tracking, two-label printing, light-mode UI"
```
