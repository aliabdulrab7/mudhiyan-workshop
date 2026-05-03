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
    status         TEXT NOT NULL DEFAULT 'new',
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_status    ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_created   ON orders(created_at DESC);
`);

// ── User settings ────────────────────────────────────────────────────────────
// One-to-one with users.id. Holds operational preferences that follow the
// user across devices. Per-device toggles (e.g. "sound on scan") live in
// localStorage, NOT here — anything in this table is server-authoritative.
// Rows are created lazily on first GET; users created without a settings row
// behave identically to users with an all-NULL row (= "use app defaults").
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_label_preset TEXT,
    default_printer_mode TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
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

// 7.4 — UNIQUE constraint on customer_token (INV-12: tokens are unique and immutable)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_token ON orders(customer_token) WHERE customer_token IS NOT NULL`);

// 7.1 — Phone normalization migration: bring existing records to 966XXXXXXXXX format
// 0XXXXXXXXX (10 digits) → 966XXXXXXXXX
db.exec(`UPDATE orders SET phone = '966' || SUBSTR(phone, 2) WHERE phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`);
// 5XXXXXXXX (9 digits) → 966XXXXXXXXX
db.exec(`UPDATE orders SET phone = '966' || phone WHERE phone GLOB '5[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`);

// locked_at: set when order reaches DELIVERED — blocks all subsequent writes
if (!columnExists('orders', 'locked_at')) {
  db.exec(`ALTER TABLE orders ADD COLUMN locked_at TEXT DEFAULT NULL`);
}

// ── Phase 2 migrations ────────────────────────────────────────────────────────

// orders: payment_confirmed — boolean gate before DELIVERED (set by staff at pickup)
if (!columnExists('orders', 'payment_confirmed')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_confirmed INTEGER NOT NULL DEFAULT 0`);
}

// orders: cost_status — summary of approval state (NO_COST | PENDING_APPROVAL | APPROVED | REJECTED)
if (!columnExists('orders', 'cost_status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cost_status TEXT NOT NULL DEFAULT 'NO_COST'`);
}

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

// Phase 2: per-item cost and approval tracking
if (!columnExists('order_items', 'estimated_cost')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN estimated_cost REAL DEFAULT NULL`);
}
if (!columnExists('order_items', 'approval_required')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN approval_required INTEGER NOT NULL DEFAULT 0`);
}
if (!columnExists('order_items', 'approval_status')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending'`);
}

// ── Status history table ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS order_status_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  TEXT,
    notes       TEXT DEFAULT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_status_hist ON order_status_history(order_id);
`);

// notes column: added in Phase 1 — existing rows default to NULL
if (!columnExists('order_status_history', 'notes')) {
  db.exec(`ALTER TABLE order_status_history ADD COLUMN notes TEXT DEFAULT NULL`);
}

// ── Workflow status rename migrations (idempotent) ────────────────────────────
// Rename old status names to new workflow names. Safe to run on every startup.
db.exec(`
  UPDATE orders SET status = 'inspection'     WHERE status = 'diagnosing';
  UPDATE orders SET status = 'ready_for_return' WHERE status = 'ready_for_pickup';
  UPDATE order_status_history SET to_status   = 'inspection'     WHERE to_status   = 'diagnosing';
  UPDATE order_status_history SET from_status = 'inspection'     WHERE from_status = 'diagnosing';
  UPDATE order_status_history SET to_status   = 'ready_for_return' WHERE to_status   = 'ready_for_pickup';
  UPDATE order_status_history SET from_status = 'ready_for_return' WHERE from_status = 'ready_for_pickup';
`);

// ── Phase 3 migrations: order_items new columns ───────────────────────────────
if (!columnExists('order_items', 'repair_description')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN repair_description TEXT DEFAULT NULL`);
}
if (!columnExists('order_items', 'final_cost')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN final_cost REAL DEFAULT NULL`);
}
if (!columnExists('order_items', 'ring_size_before')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN ring_size_before TEXT DEFAULT NULL`);
}
if (!columnExists('order_items', 'ring_size_after')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN ring_size_after TEXT DEFAULT NULL`);
}
if (!columnExists('order_items', 'bracelet_adjustment')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN bracelet_adjustment TEXT DEFAULT NULL`);
}
if (!columnExists('order_items', 'necklace_adjustment')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN necklace_adjustment TEXT DEFAULT NULL`);
}
if (!columnExists('order_items', 'updated_at')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN updated_at TEXT DEFAULT NULL`);
}

// ── Phase 3 new tables ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    email      TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
`);

// customer_id on orders: optional FK to customers table
if (!columnExists('orders', 'customer_id')) {
  db.exec(`ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id)`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS technicians (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER REFERENCES users(id),
    specialization TEXT DEFAULT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_item_technicians (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    technician_id INTEGER NOT NULL REFERENCES technicians(id),
    assigned_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    completed_at  TEXT DEFAULT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_oit_item ON order_item_technicians(order_item_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS item_photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    photo_url     TEXT NOT NULL,
    photo_type    TEXT NOT NULL DEFAULT 'before_repair',
    uploaded_by   TEXT DEFAULT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_photos_item ON item_photos(order_item_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT NULL,
    default_price REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_item_services (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    service_id    INTEGER NOT NULL REFERENCES services(id),
    price         REAL NOT NULL,
    notes         TEXT DEFAULT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_ois_item ON order_item_services(order_item_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT NULL,
    stock_qty     REAL NOT NULL DEFAULT 0,
    unit          TEXT NOT NULL DEFAULT 'piece',
    cost_per_unit REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS repair_parts_used (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id     INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    quantity          REAL NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_parts_item ON repair_parts_used(order_item_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS item_locations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    location      TEXT NOT NULL,
    updated_by    TEXT DEFAULT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_loc_item ON item_locations(order_item_id);
`);

// ── Repair options (workshop-configurable per item type) ─────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS repair_options (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type  TEXT NOT NULL,
    value      TEXT NOT NULL,
    needs      TEXT DEFAULT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_repair_opts_type ON repair_options(item_type, sort_order);
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_repair_opt_value ON repair_options(item_type, value);
`);

// First-run seed: only populate defaults if the table is empty. Preserves workshop edits across restarts.
const repairOptsCount = db.prepare('SELECT COUNT(*) AS n FROM repair_options').get().n;
if (repairOptsCount === 0) {
  const DEFAULTS = {
    'خاتم':  [['لحام', null], ['تلميع', null], ['تغيير مقاس', 'size'], ['تركيب حجر', 'stone'], ['تغيير اللون', 'color'], ['تنظيف', null], ['أخرى', 'text']],
    'حلق':   [['لحام', null], ['تلميع', null], ['تركيب حجر', 'stone'], ['تغيير اللون', 'color'], ['تنظيف', null], ['أخرى', 'text']],
    'سوار':  [['لحام', null], ['تلميع', null], ['تغيير مقاس', 'size'], ['تركيب حجر', 'stone'], ['تغيير اللون', 'color'], ['إصلاح قفل', null], ['إصلاح سلسلة', null], ['تنظيف', null], ['أخرى', 'text']],
    'عقد':   [['لحام', null], ['تلميع', null], ['تركيب حجر', 'stone'], ['تغيير اللون', 'color'], ['إصلاح قفل', null], ['إصلاح سلسلة', null], ['تنظيف', null], ['أخرى', 'text']],
    'دبلة':  [['لحام', null], ['تلميع', null], ['تغيير مقاس', 'size'], ['تغيير اللون', 'color'], ['تنظيف', null], ['أخرى', 'text']],
    'ساعة':  [['تلميع', null], ['تغيير اللون', 'color'], ['تنظيف', null], ['أخرى', 'text']],
    'أخرى':  [['لحام', null], ['تلميع', null], ['تنظيف', null], ['أخرى', 'text']],
  };
  const insertOpt = db.prepare(
    `INSERT INTO repair_options (item_type, value, needs, sort_order) VALUES (?, ?, ?, ?)`
  );
  const seed = db.transaction(() => {
    for (const [item_type, opts] of Object.entries(DEFAULTS)) {
      opts.forEach(([value, needs], i) => insertOpt.run(item_type, value, needs, i));
    }
  });
  seed();
  console.log(`✓ Seeded repair_options with ${Object.values(DEFAULTS).flat().length} defaults`);
}

// ── WF-1: Workforce management foundation ────────────────────────────────────
// Roles + specializations are workshop-configurable lists with seeded defaults
// (mirrors the repair_options pattern, minus item_type since these are
// workshop-global, not per piece-type). English keys + Arabic display labels.

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    value            TEXT NOT NULL UNIQUE,
    display_label_ar TEXT NOT NULL,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS specializations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    value            TEXT NOT NULL UNIQUE,
    display_label_ar TEXT NOT NULL,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS technician_specializations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    technician_id     INTEGER NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    specialization_id INTEGER NOT NULL REFERENCES specializations(id),
    created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(technician_id, specialization_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tech_specs_tech ON technician_specializations(technician_id);
`);

// First-run seed for roles (preserved across restarts via "if empty" guard)
const rolesCount = db.prepare('SELECT COUNT(*) AS n FROM roles').get().n;
if (rolesCount === 0) {
  const insertRole = db.prepare(
    `INSERT INTO roles (value, display_label_ar, sort_order) VALUES (?, ?, ?)`
  );
  const seedRoles = db.transaction(() => {
    [
      ['jeweler',    'جوهرجي'],
      ['polisher',   'ملمّع'],
      ['appraiser',  'مثمّن'],
      ['apprentice', 'متدرب'],
    ].forEach(([value, label], i) => insertRole.run(value, label, i));
  });
  seedRoles();
  console.log('✓ Seeded roles with 4 defaults');
}

// First-run seed for specializations
const specsCount = db.prepare('SELECT COUNT(*) AS n FROM specializations').get().n;
if (specsCount === 0) {
  const insertSpec = db.prepare(
    `INSERT INTO specializations (value, display_label_ar, sort_order) VALUES (?, ?, ?)`
  );
  const seedSpecs = db.transaction(() => {
    [
      ['rings',           'خواتم'],
      ['chains',          'سلاسل'],
      ['bracelets',       'أساور'],
      ['earrings',        'أقراط'],
      ['watches',         'ساعات'],
      ['gold_work',       'أعمال ذهب'],
      ['silver_work',     'أعمال فضة'],
      ['diamond_setting', 'تركيب الماس'],
      ['gem_setting',     'تركيب الأحجار'],
      ['engraving',       'نقش'],
      ['polishing',       'تلميع'],
      ['repair_general',  'إصلاح عام'],
    ].forEach(([value, label], i) => insertSpec.run(value, label, i));
  });
  seedSpecs();
  console.log('✓ Seeded specializations with 12 defaults');
}

// Technicians schema migration: rename specialization → name + add operational
// columns. Deterministic, no per-row branching: ALL existing specialization
// values move into name, with users.username as a fallback only when name is
// blank AND the row has a user_id. ALTER ADD COLUMN can't carry CHECK
// constraints, so status is enforced at the application/service layer
// ('available' | 'busy' | 'off_shift' | 'on_leave').
if (!columnExists('technicians', 'name')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN name TEXT NOT NULL DEFAULT ''`);
}
if (columnExists('technicians', 'specialization')) {
  db.exec(`UPDATE technicians SET name = specialization WHERE specialization IS NOT NULL AND name = ''`);
  db.exec(`UPDATE technicians SET name = (SELECT username FROM users WHERE id = technicians.user_id) WHERE name = '' AND user_id IS NOT NULL`);
  db.exec(`ALTER TABLE technicians DROP COLUMN specialization`);
}
if (!columnExists('technicians', 'role_id')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN role_id INTEGER REFERENCES roles(id)`);
}
if (!columnExists('technicians', 'status')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN status TEXT NOT NULL DEFAULT 'available'`);
}
if (!columnExists('technicians', 'phone')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN phone TEXT`);
}
if (!columnExists('technicians', 'notes')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN notes TEXT`);
}
if (!columnExists('technicians', 'active')) {
  db.exec(`ALTER TABLE technicians ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
}

// Per-item priority (schema only; UI/sort migration deferred to WF-4).
// Backfilled from the existing orders.is_urgent flag so per-item rows on
// urgent orders inherit the urgent priority. orders.is_urgent stays
// authoritative for the UI/sort/badges until WF-4 migrates them.
if (!columnExists('order_items', 'priority')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN priority TEXT NOT NULL DEFAULT 'standard'`);
  db.exec(`UPDATE order_items SET priority = 'urgent' WHERE order_id IN (SELECT id FROM orders WHERE is_urgent = 1)`);
}

// ── WF-3: Technician status audit log ────────────────────────────────────────
// Captures every status change for a technician. `reason` and the compound
// (changed_at, to_status) index are forward-compatible with the analytics
// instrumentation plan (Phase 2 Group A/B) so no backfill is needed later.
// No existing rows to backfill — log starts at WF-3 deploy.
db.exec(`
  CREATE TABLE IF NOT EXISTS technician_status_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    from_status   TEXT,
    to_status     TEXT NOT NULL,
    changed_by    INTEGER REFERENCES users(id),
    reason        TEXT,
    changed_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_status_log_tech     ON technician_status_log(technician_id);
  CREATE INDEX IF NOT EXISTS idx_status_log_at       ON technician_status_log(changed_at);
  CREATE INDEX IF NOT EXISTS idx_status_log_at_status ON technician_status_log(changed_at, to_status);
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
  const today   = new Date();
  const ymd     = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const branchId = data.shop_id ?? 0;
  const prefix   = `BR${branchId}-${ymd}-`;

  // Per-branch continuous sequence — counter does NOT reset on date change.
  // Atomic inside transaction (race-condition safe).
  const { next } = db.prepare(
    `SELECT COUNT(*) + 1 AS next FROM orders WHERE order_number LIKE ?`
  ).get(`BR${branchId}-%`);

  const order_number   = `${prefix}${String(next).padStart(4, '0')}`;
  const customer_token = require('crypto').randomUUID();

  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;

  // piece_type summary uses item_name (with item_type as fallback for legacy)
  const piece_type = items
    ? items.map(i => (i.item_name || i.item_type || '').trim()).filter(Boolean).join('، ')
    : (data.piece_type || '');

  const result = db.prepare(`
    INSERT INTO orders (order_number, customer_name, phone, piece_type, notes, shop_id, customer_token, status, is_urgent)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)
  `).run(order_number, data.customer_name, data.phone, piece_type, data.notes ?? '', data.shop_id ?? null, customer_token, data.is_urgent ? 1 : 0);

  const orderId = result.lastInsertRowid;

  // Record initial status in history
  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (?, NULL, 'new', ?)
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
        Math.min(99, Math.max(1, parseInt(item.quantity, 10) || 1)), // quantity
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
