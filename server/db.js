const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(dataDir, 'workshop.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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
`);

// ── Additive migrations (idempotent) ─────────────────────────────────────────

function columnExists(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === col);
}

if (!columnExists('orders', 'shop_id')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shop_id INTEGER REFERENCES shops(id)`);
}
if (!columnExists('orders', 'cost')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cost INTEGER NOT NULL DEFAULT 0`);
}
if (!columnExists('orders', 'customer_token')) {
  db.exec(`ALTER TABLE orders ADD COLUMN customer_token TEXT`);
  // Backfill existing rows with a unique random hex token
  db.exec(`UPDATE orders SET customer_token = lower(hex(randomblob(16))) WHERE customer_token IS NULL`);
}

// Create index on customer_token after the column is guaranteed to exist
db.exec(`CREATE INDEX IF NOT EXISTS idx_cust_tok ON orders(customer_token) WHERE customer_token IS NOT NULL`);

// ── Comments table ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS order_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_comments_order ON order_comments(order_id);
`);

// ── Order items table ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_type  TEXT NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    notes      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

// ── createOrder transaction ───────────────────────────────────────────────────

const createOrder = db.transaction((data) => {
  const today = new Date();
  const ymd   = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');

  const { next } = db.prepare(
    `SELECT COUNT(*) + 1 AS next FROM orders WHERE order_number LIKE ?`
  ).get(`WRK-${ymd}-%`);

  const order_number   = `WRK-${ymd}-${String(next).padStart(4, '0')}`;
  const customer_token = require('crypto').randomUUID();

  // Compute piece_type summary from items array if provided
  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
  const piece_type = items
    ? items.map(i => i.quantity > 1 ? `${i.item_type} ×${i.quantity}` : i.item_type).join('، ')
    : (data.piece_type || '');

  const result = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, shop_id, customer_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(order_number, data.customer_name, data.phone, piece_type, data.notes ?? '', data.shop_id ?? null, customer_token);

  const orderId = result.lastInsertRowid;

  // Insert individual items if provided
  if (items) {
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, item_type, quantity, notes, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    items.forEach((item, i) => {
      insertItem.run(orderId, item.item_type, item.quantity || 1, item.notes || '', i);
    });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order').all(orderId);
  return { ...order, items: orderItems };
});

module.exports = { db, createOrder };
