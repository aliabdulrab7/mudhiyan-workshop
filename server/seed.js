// server/seed.js — run once: node seed.js
const bcrypt = require('bcryptjs');
const { db } = require('./db');

console.log('Seeding database...\n');

// Workshop user
try {
  const hash = bcrypt.hashSync('workshop123', 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, 'workshop', NULL)
  `).run('workshop', hash);
  console.log('✓ Workshop user — username: workshop  password: workshop123');
} catch {
  console.log('⚠ Workshop user already exists (skipped)');
}

// Example shop
let shopId;
try {
  const res = db.prepare(`INSERT INTO shops (name) VALUES (?)`).run('محل المجوهرات الأول');
  shopId = res.lastInsertRowid;
  console.log(`✓ Shop created — id: ${shopId}  name: محل المجوهرات الأول`);
} catch {
  shopId = db.prepare('SELECT id FROM shops LIMIT 1').get()?.id;
  console.log(`⚠ Shop already exists — id: ${shopId} (skipped)`);
}

// Shop employee
if (shopId) {
  try {
    const hash = bcrypt.hashSync('shop123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, 'shop_employee', ?)
    `).run('employee1', hash, shopId);
    console.log('✓ Shop employee — username: employee1  password: shop123');
  } catch {
    console.log('⚠ Shop employee already exists (skipped)');
  }
}

// Default technician (WF-1b) — keeps fresh DBs aligned with dev expectations
try {
  const existing = db.prepare(`SELECT id FROM technicians WHERE name = ?`).get('علي');
  if (existing) {
    console.log(`⚠ Default technician "علي" already exists (id: ${existing.id}, skipped)`);
  } else {
    const jeweler = db.prepare(`SELECT id FROM roles WHERE value = ?`).get('jeweler');
    const goldWork = db.prepare(`SELECT id FROM specializations WHERE value = ?`).get('gold_work');
    const techRes = db.prepare(`
      INSERT INTO technicians (name, role_id, status, active) VALUES (?, ?, 'available', 1)
    `).run('علي', jeweler?.id ?? null);
    if (goldWork) {
      db.prepare(`
        INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id)
        VALUES (?, ?)
      `).run(techRes.lastInsertRowid, goldWork.id);
    }
    console.log(`✓ Default technician — name: علي  role: jeweler  spec: gold_work`);
  }
} catch (e) {
  console.log('⚠ Default technician seed failed:', e.message);
}

console.log('\n✅ Seed complete. Run this once per fresh database.');
process.exit(0);
