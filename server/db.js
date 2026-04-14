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
  db.exec(`UPDATE orders SET customer_token = lower(hex(randomblob(16))) WHERE customer_token IS NULL`);
}
if (!columnExists('orders', 'is_urgent')) {
  db.exec(`ALTER TABLE orders ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0`);
}

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

// New item detail columns (additive — legacy columns kept for compat)
if (!columnExists('order_items', 'item_name')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN item_name TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE order_items SET item_name = item_type WHERE item_name = ''`);
}
if (!columnExists('order_items', 'brand')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN brand TEXT NOT NULL DEFAULT ''`);
}
if (!columnExists('order_items', 'model')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN model TEXT NOT NULL DEFAULT ''`);
}
if (!columnExists('order_items', 'serial_number')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN serial_number TEXT NOT NULL DEFAULT ''`);
}
if (!columnExists('order_items', 'workshop_comment')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN workshop_comment TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE order_items SET workshop_comment = notes WHERE workshop_comment = ''`);
}

// ── Status history table ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS order_status_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_status_hist ON order_status_history(order_id);
`);

// Backfill: Ensure all orders have at least one record in order_items
db.exec(`
  INSERT INTO order_items (order_id, item_type, item_name, quantity, notes, workshop_comment)
  SELECT id, piece_type, piece_type, 1, notes, notes
  FROM orders o
  WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
`);

// Backfill: Ensure all orders have at least a 'received' record in status history
db.exec(`
  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at)
  SELECT id, NULL, 'received', 'system_backfill', created_at
  FROM orders o
  WHERE NOT EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.to_status = 'received')
`);

// Backfill: Record current status in history if it's beyond 'received'
db.exec(`
  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at)
  SELECT id, 'received', status, 'system_backfill', updated_at
  FROM orders o
  WHERE status != 'received'
    AND NOT EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.to_status = o.status)
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

  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;

  // piece_type summary uses item_name (with item_type as fallback for legacy)
  const piece_type = items
    ? items.map(i => (i.item_name || i.item_type || '').trim()).filter(Boolean).join('، ')
    : (data.piece_type || '');

  const result = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, shop_id, customer_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(order_number, data.customer_name, data.phone, piece_type, data.notes ?? '', data.shop_id ?? null, customer_token);

  const orderId = result.lastInsertRowid;

  // Record initial status in history
  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (?, NULL, 'received', ?)
  `).run(orderId, data.created_by || 'system');

  if (items) {
    const insertItem = db.prepare(`
      INSERT INTO order_items
        (order_id, item_type, quantity, notes, sort_order, item_name, brand, model, serial_number, workshop_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((item, i) => {
      const itemName       = (item.item_name || item.item_type || '').trim();
      const workshopComment = (item.workshop_comment || item.notes || '').trim();
      insertItem.run(
        orderId,
        itemName,        // item_type (legacy compat)
        1,               // quantity (no longer tracked per-item)
        workshopComment, // notes (legacy compat)
        i,
        itemName,
        (item.brand  || '').trim(),
        (item.model  || '').trim(),
        (item.serial_number || '').trim(),
        workshopComment,
      );
    });
  }

  const order = db.prepare(`
    SELECT o.*, COALESCE(s.name, '') AS shop_name
    FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
    WHERE o.id = ?
  `).get(orderId);
  const orderItems = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order'
  ).all(orderId);

  return { ...order, items: orderItems };
});

module.exports = { db, createOrder };
