const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'workshop.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number  TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    phone         TEXT NOT NULL,
    piece_type    TEXT NOT NULL,
    notes         TEXT DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'received',
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_created ON orders(created_at DESC);
`);

// Fix #1: atomic createOrder transaction — count + generate number + INSERT in one step
// eliminates the race condition where two concurrent requests could get the same order number
const createOrder = db.transaction((data) => {
  const today = new Date();
  const ymd = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');

  const row = db.prepare(
    `SELECT COUNT(*) + 1 AS next FROM orders WHERE order_number LIKE ?`
  ).get(`WRK-${ymd}-%`);

  const order_number = `WRK-${ymd}-${String(row.next).padStart(4, '0')}`;

  const result = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(order_number, data.customer_name, data.phone, data.piece_type, data.notes);

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
});

module.exports = { db, createOrder };
