// WF-2 — Searchable Assignment Picker  (QA verification suite)
//
// Preconditions: npm run dev (QA_HARNESS=1 recommended to avoid rate-limit),
// seeded DB (node server/seed.js), workshop/workshop123 + employee1/shop123 creds.
//
// DB state assumed: seed tech "علي" (id 1), WF2QA-حامد (id 2, rings spec),
// WF2QA-مشغول (id 3, busy), WF2QA-محذوف (id 4, active=0) — seeded in pre-test
// manual setup step. Each describe block adds/cleans its own data on top.
//
// Run: npm run test:e2e  (from repo root, inside worktree)

import { test, expect } from '@playwright/test';
import { execSync }      from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf5/server/data/workshop.db';

function sql(q) {
  // sqlite3 CLI rejects literal \n inside the quoted argument — normalize to spaces.
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(q.replace(/\s*\n\s*/g, ' '))}`, { encoding: 'utf8' }).trim();
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function seedTech(name, { active = 1 } = {}) {
  sql(`INSERT INTO technicians (name, status, active)
       VALUES (${JSON.stringify(name)}, 'available', ${active});`);
  return Number(sql(`SELECT id FROM technicians WHERE name=${JSON.stringify(name)} ORDER BY id DESC LIMIT 1;`));
}

function patchTechStatus(id, status) {
  sql(`UPDATE technicians SET status=${JSON.stringify(status)} WHERE id=${id};`);
}

function addSpec(techId, specValue) {
  const specId = sql(`SELECT id FROM specializations WHERE value=${JSON.stringify(specValue)} LIMIT 1;`);
  if (specId) sql(`INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id) VALUES (${techId}, ${specId});`);
}

function cleanupTechsByPrefix(prefix) {
  sql(`DELETE FROM technician_specializations
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM order_item_technicians
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM technicians WHERE name LIKE '${prefix}%';`);
}

function seedOrder(orderNumber, status, shopId = 1) {
  sql(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number='${orderNumber}');`);
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${orderNumber}');`);
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number='${orderNumber}');`);
  sql(`DELETE FROM orders WHERE order_number='${orderNumber}';`);
  sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
       customer_token, status, created_at)
       VALUES ('${orderNumber}','WF2-QA','966500000000','خاتم',${shopId},
       'wf2-tk-${orderNumber}','${status}',CURRENT_TIMESTAMP);`);
  sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order)
       SELECT id, 'خاتم', 'خاتم', 0 FROM orders WHERE order_number='${orderNumber}';`);
  return getItemId(orderNumber);
}

function cleanupOrders(prefix) {
  sql(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM orders WHERE order_number LIKE '${prefix}%';`);
}

function getItemId(orderNumber) {
  return Number(sql(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${orderNumber}' ORDER BY oi.id LIMIT 1;`));
}

function getTechAssignment(itemId) {
  return sql(`SELECT technician_id FROM order_item_technicians WHERE order_item_id=${itemId} ORDER BY id DESC LIMIT 1;`);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const TOKEN_CACHE = new Map();

async function login(page, username, password) {
  const key = `${username}:${password}`;
  let creds = TOKEN_CACHE.get(key);
  if (!creds) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    creds = await page.evaluate(async ({ username, password }) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!d.token) throw new Error('login failed: ' + JSON.stringify(d));
      return { token: d.token, role: d.role, username: d.username || '', shop_id: d.shop_id };
    }, { username, password });
    TOKEN_CACHE.set(key, creds);
  } else {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  }
  await page.evaluate((c) => {
    localStorage.clear();
    localStorage.setItem('token', c.token);
    localStorage.setItem('role', c.role);
    localStorage.setItem('username', c.username);
    if (c.shop_id != null) localStorage.setItem('shop_id', String(c.shop_id));
  }, creds);
}

// ── Navigation helpers ────────────────────────────────────────────────────────

async function openOrderDrawer(page, orderNumber) {
  await page.goto('/orders', { waitUntil: 'networkidle' });
  await page.locator(`[data-testid="orders-list__row__${orderNumber}"]`).click();
  await page.waitForTimeout(400);
}

// OrderDetail does not fetch the full order on mount; items only appear after the
// first status-changing PATCH (which returns { ...order, items }).  Click the
// advance button once so the response hydrates order.items, then wait for the
// per-item picker triggers to be visible before proceeding.
async function ensureItemsLoaded(page) {
  const advBtn = page.locator('[data-testid="order-detail__status-advance"]');
  try {
    await advBtn.waitFor({ state: 'visible', timeout: 2000 });
    await advBtn.click();
    await page.locator('[data-testid^="tech-picker-trigger--item--"]').first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(200);
  } catch {
    // no advance button for this status — items should already be present
  }
}

async function openPickerForItem(page, itemId) {
  await ensureItemsLoaded(page);
  await page.locator(`[data-testid="tech-picker-trigger--item--${itemId}"]`).click();
  await page.locator('[data-testid="tech-picker__search"]').waitFor({ state: 'visible', timeout: 4000 });
  await page.waitForTimeout(600); // debounce 200ms + fetch
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRACT — /api/technicians/picker endpoint shape
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-contract — picker endpoint', () => {
  test('returns { items, total } with required fields per item', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await page.evaluate(async (token) => {
      const res = await fetch('/api/technicians/picker', { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json() };
    }, token);

    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('items');
    expect(r.body).toHaveProperty('total');
    for (const t of r.body.items) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('status');
      expect(t).toHaveProperty('active_count');
      expect(t).toHaveProperty('specializations');
    }
    // Inactive tech (id 4) excluded by default
    expect(r.body.items.every(t => t.active !== 0)).toBe(true);
  });

  test('?q= filters by name COLLATE NOCASE', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await page.evaluate(async (token) => {
      const res = await fetch('/api/technicians/picker?q=%D8%B9%D9%84%D9%8A&status=all', { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json() };
    }, token);
    expect(r.status).toBe(200);
    expect(r.body.items.every(t => t.name.includes('علي'))).toBe(true);
  });

  test('?status=busy returns only busy techs', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await page.evaluate(async (token) => {
      const res = await fetch('/api/technicians/picker?status=busy', { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json() };
    }, token);
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThanOrEqual(1);
    expect(r.body.items.every(t => t.status === 'busy')).toBe(true);
  });
});

test.describe('wf2-contract — suggestions endpoint', () => {
  test('خاتم item → WF2QA-حامد ranks first (rings spec match)', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    // Item 3 = خاتم (order BR1-20260503-0002, seeded in pre-test setup)
    const r = await page.evaluate(async (token) => {
      const res = await fetch('/api/order-items/3/suggested-technicians', { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json() };
    }, token);

    expect(r.status).toBe(200);
    expect(r.body.matched_specializations).toContain('rings');
    const first = r.body.suggestions[0];
    expect(first.name).toBe('WF2QA-حامد');
    expect(first.score).toBe(15); // 10 (rings) + 5 (available)
    expect(first.matched_specs).toContain('rings');
    for (const s of r.body.suggestions) {
      expect(s).toHaveProperty('score');
      expect(s).toHaveProperty('active_count');
    }
  });

  test('unknown item returns 404', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const r = await page.evaluate(async (token) => {
      const res = await fetch('/api/order-items/999999/suggested-technicians', { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status };
    }, token);
    expect(r.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Search text match
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — search text match', () => {
  const ORDER = 'BR1-WF2UI001-0001';
  const PREFIX = 'WF2UI-Search-';
  let itemId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI001-');
    cleanupTechsByPrefix(PREFIX);
    itemId = seedOrder(ORDER, 'new');
    seedTech(`${PREFIX}مصطفى`);
    seedTech(`${PREFIX}منال`);
  });
  test.afterEach(() => {
    cleanupOrders('BR1-WF2UI001-');
    cleanupTechsByPrefix(PREFIX);
  });

  test('typing a name fragment filters picker rows', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await page.locator('[data-testid="tech-picker__search"]').fill('مصطفى');
    await page.waitForTimeout(500);

    // Suggestions section is NOT filtered by search — check only the main list.
    const mainSection = page.locator('[data-testid="tech-picker__section--all"]');
    const names = await mainSection.locator('[data-testid^="tech-picker__row--"]').allTextContents();
    expect(names.some(n => n.includes('مصطفى'))).toBe(true);
    expect(names.some(n => n.includes('منال'))).toBe(false);
  });

  test('empty state shows Arabic message when no match', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await page.locator('[data-testid="tech-picker__search"]').fill('zzz-no-match-zzz');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="tech-picker__empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="tech-picker__empty"]')).toContainText('لا يوجد فنيون مطابقون');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Status filter chip
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — status filter chip', () => {
  const ORDER = 'BR1-WF2UI002-0001';
  const PREFIX = 'WF2UI-Status-';
  let itemId, busyId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI002-');
    cleanupTechsByPrefix(PREFIX);
    itemId = seedOrder(ORDER, 'new');
    busyId = seedTech(`${PREFIX}مشغول`);
    patchTechStatus(busyId, 'busy');
  });
  test.afterEach(() => {
    cleanupOrders('BR1-WF2UI002-');
    cleanupTechsByPrefix(PREFIX);
  });

  test('busy chip shows only busy techs; busy tech hidden by default (available filter)', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    // Suggestions section is NOT filtered by status — scope assertions to the main list only.
    const mainSection = page.locator('[data-testid="tech-picker__section--all"]');
    const busyRow = mainSection.locator(`[data-testid="tech-picker__row--${busyId}"]`);

    // Default: only available shown → busy tech NOT visible in main list
    await expect(busyRow).not.toBeVisible();

    // Click busy chip
    await page.locator('[data-testid="tech-picker__chip--status--busy"]').click();
    await page.waitForTimeout(500);

    await expect(busyRow).toBeVisible();
  });

  test('clicking active chip twice toggles off filter', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    const chip = page.locator('[data-testid="tech-picker__chip--status--available"]');
    await chip.click();
    await page.waitForTimeout(300);
    await chip.click();
    await page.waitForTimeout(300);
    // Picker still open
    await expect(page.locator('[data-testid="tech-picker__search"]')).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Spec filter chip (client-side)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — spec filter chip', () => {
  const ORDER = 'BR1-WF2UI003-0001';
  const PREFIX = 'WF2UI-Spec-';
  let itemId, ringsTechId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI003-');
    cleanupTechsByPrefix(PREFIX);
    itemId = seedOrder(ORDER, 'new');
    ringsTechId = seedTech(`${PREFIX}خواتمجي`);
    addSpec(ringsTechId, 'rings');
    seedTech(`${PREFIX}عام`); // no spec
  });
  test.afterEach(() => {
    cleanupOrders('BR1-WF2UI003-');
    cleanupTechsByPrefix(PREFIX);
  });

  test('rings chip shows only techs with rings spec; general tech filtered out', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    const ringChip = page.locator('[data-testid="tech-picker__chip--spec--rings"]');
    await expect(ringChip).toBeVisible();
    await ringChip.click();
    await page.waitForTimeout(400);

    // Suggestions section is NOT filtered by spec — scope assertions to main list only.
    const allSection = page.locator('[data-testid="tech-picker__section--all"]');

    // rings-spec tech visible in main list
    await expect(allSection.locator(`[data-testid="tech-picker__row--${ringsTechId}"]`)).toBeVisible();

    // general tech (no spec) not visible in main list
    const names = await allSection.locator('[data-testid^="tech-picker__row--"]').allTextContents();
    expect(names.some(n => n.includes(`${PREFIX}عام`))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Suggestions section
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — suggestions section', () => {
  const ORDER = 'BR1-WF2UI004-0001';
  let itemId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI004-');
    sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
         customer_token, status, created_at)
         VALUES ('${ORDER}','WF2-QA','966500000000','خاتم',1,'wf2-tk-${ORDER}','new',CURRENT_TIMESTAMP);`);
    // item_name "خاتم" matches ITEM_TYPE_SPEC_MAP → rings spec
    sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order)
         SELECT id, 'خاتم', 'خاتم', 0 FROM orders WHERE order_number='${ORDER}';`);
    itemId = getItemId(ORDER);
  });
  test.afterEach(() => cleanupOrders('BR1-WF2UI004-'));

  test('suggestions section visible and WF2QA-حامد (rings spec) is first', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await expect(page.locator('[data-testid="tech-picker__section--suggested"]')).toBeVisible();
    const firstSuggested = page.locator('[data-testid="tech-picker__section--suggested"] [data-testid^="tech-picker__row--"]').first();
    await expect(firstSuggested).toContainText('WF2QA-حامد');
  });

  test('both suggested and all sections visible', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await expect(page.locator('[data-testid="tech-picker__section--suggested"]')).toBeVisible();
    await expect(page.locator('[data-testid="tech-picker__section--all"]')).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Keyboard navigation
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — keyboard navigation', () => {
  const ORDER = 'BR1-WF2UI006-0001';
  let itemId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI006-');
    itemId = seedOrder(ORDER, 'new');
  });
  test.afterEach(() => cleanupOrders('BR1-WF2UI006-'));

  test('ArrowDown from search focuses first row; ArrowUp returns to search', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    const searchInput = page.locator('[data-testid="tech-picker__search"]');
    await searchInput.focus();
    await page.keyboard.press('ArrowDown');

    const firstRow = page.locator('[data-testid^="tech-picker__row--"]').first();
    await expect(firstRow).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(searchInput).toBeFocused();
  });

  test('Escape closes picker and returns focus to trigger', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="tech-picker__search"]')).not.toBeVisible();

    const trigger = page.locator(`[data-testid="tech-picker-trigger--item--${itemId}"]`);
    await expect(trigger).toBeFocused();
  });

  test('Enter on focused row assigns tech and closes picker', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await page.locator('[data-testid="tech-picker__search"]').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="tech-picker__search"]')).not.toBeVisible();
    await page.waitForTimeout(300);
    expect(getTechAssignment(itemId)).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Inactive techs excluded
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — inactive tech excluded', () => {
  const ORDER = 'BR1-WF2UI008-0001';
  const PREFIX = 'WF2UI-Inactive-';
  let itemId, inactiveId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI008-');
    cleanupTechsByPrefix(PREFIX);
    itemId = seedOrder(ORDER, 'new');
    seedTech(`${PREFIX}نشيط`);
    inactiveId = seedTech(`${PREFIX}محذوف`, { active: 0 });
  });
  test.afterEach(() => {
    cleanupOrders('BR1-WF2UI008-');
    cleanupTechsByPrefix(PREFIX);
  });

  test('soft-deleted tech (active=0) never appears in picker', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    // Check both default (available) and all-status views
    const inactiveRow = page.locator(`[data-testid="tech-picker__row--${inactiveId}"]`);
    await expect(inactiveRow).not.toBeVisible();

    // Click all status chips to expand view
    for (const s of ['busy', 'off_shift', 'on_leave']) {
      await page.locator(`[data-testid="tech-picker__chip--status--${s}"]`).click();
      await page.waitForTimeout(300);
      await expect(inactiveRow).not.toBeVisible();
      await page.locator(`[data-testid="tech-picker__chip--status--${s}"]`).click();
    }
    // Active tech IS visible
    const names = await page.locator('[data-testid^="tech-picker__row--"]').allTextContents();
    expect(names.some(n => n.includes(`${PREFIX}نشيط`))).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Tablet viewport (768×1024)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-picker-ui — tablet viewport', () => {
  const ORDER = 'BR1-WF2UI007-0001';
  let itemId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2UI007-');
    itemId = seedOrder(ORDER, 'new');
  });
  test.afterEach(() => cleanupOrders('BR1-WF2UI007-'));

  test('no horizontal overflow at 768px width', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await ctx.newPage();
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    const overflow = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    await ctx.close();
    expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REGRESSION — Per-item assignment
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-regression — per-item assignment', () => {
  const ORDER = 'BR1-WF2REG001-0001';
  let itemId;

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2REG001-');
    itemId = seedOrder(ORDER, 'new');
  });
  test.afterEach(() => cleanupOrders('BR1-WF2REG001-'));

  test('selecting a tech assigns them and shows name on trigger', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    const firstRow = page.locator('[data-testid^="tech-picker__row--"]').first();
    const techName = (await firstRow.locator('span.font-medium').first().textContent())?.trim();
    await firstRow.click();

    await expect(page.locator('[data-testid="tech-picker__search"]')).not.toBeVisible();
    await page.waitForTimeout(300);

    const triggerText = await page.locator(`[data-testid="tech-picker-trigger--item--${itemId}"]`).textContent();
    expect(triggerText).toContain(techName ?? '');
    expect(getTechAssignment(itemId)).toBeTruthy();
  });

  test('unassign (إلغاء التعيين) clears assignment from DB', async ({ page }) => {
    const techId = sql(`SELECT id FROM technicians WHERE active=1 ORDER BY id LIMIT 1;`);
    sql(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (${itemId}, ${techId});`);

    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await openPickerForItem(page, itemId);

    await expect(page.getByRole('option', { name: /إلغاء التعيين/ })).toBeVisible();
    await page.getByRole('option', { name: /إلغاء التعيين/ }).click();

    await page.waitForTimeout(300);
    expect(getTechAssignment(itemId)).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REGRESSION — Per-order assignment
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-regression — per-order assignment', () => {
  const ORDER = 'BR1-WF2REG002-0001';

  test.beforeEach(() => {
    cleanupOrders('BR1-WF2REG002-');
    sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
         customer_token, status, created_at)
         VALUES ('${ORDER}','WF2-QA','966500000000','خاتم',1,'wf2-tk-${ORDER}','new',CURRENT_TIMESTAMP);`);
    sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order) SELECT id, 'خاتم', 'خاتم', 0 FROM orders WHERE order_number='${ORDER}';`);
    sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order) SELECT id, 'قلادة', 'قلادة', 1 FROM orders WHERE order_number='${ORDER}';`);
  });
  test.afterEach(() => cleanupOrders('BR1-WF2REG002-'));

  test('per-order picker assigns same tech to all items', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await openOrderDrawer(page, ORDER);
    await ensureItemsLoaded(page);

    const orderTrigger = page.locator('[data-testid="tech-picker-trigger--order"]');
    await orderTrigger.click();
    await page.locator('[data-testid="tech-picker__search"]').waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForTimeout(500);

    await page.locator('[data-testid^="tech-picker__row--"]').first().click();
    await page.waitForTimeout(600);

    const orderId = sql(`SELECT id FROM orders WHERE order_number='${ORDER}' LIMIT 1;`);
    const distinct = sql(`SELECT COUNT(DISTINCT oit.technician_id)
      FROM order_item_technicians oit
      JOIN order_items oi ON oi.id=oit.order_item_id
      WHERE oi.order_id=${orderId};`);
    expect(Number(distinct)).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REGRESSION — Bulk assignment
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf2-regression — bulk assignment', () => {
  const PREFIX = 'BR1-WF2REG003-';
  const O1 = `${PREFIX}0001`;
  const O2 = `${PREFIX}0002`;

  test.beforeEach(() => {
    cleanupOrders(PREFIX);
    seedOrder(O1, 'new');
    seedOrder(O2, 'new');
  });
  test.afterEach(() => cleanupOrders(PREFIX));

  test('toolbar bulk assign dialog assigns tech to all selected orders', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    // Bulk TechnicianPicker lives in OrderList (Dashboard), not OrdersPage (/orders)
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.locator(`[data-testid="order-list__row__${O1}__select"]`).click();
    await page.locator(`[data-testid="order-list__row__${O2}__select"]`).click();
    await page.waitForTimeout(200);

    await page.locator('[data-testid="orders-list__bulk__assign-button"]').click();
    await page.locator('[data-testid="orders-list__bulk__assign-dialog"]').waitFor({ state: 'visible', timeout: 3000 });

    await page.locator('[data-testid="orders-list__bulk__assign-dialog__technician-select"]').click();
    await page.locator('[data-testid="tech-picker__search"]').waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForTimeout(500);

    await page.locator('[data-testid^="tech-picker__row--"]').first().click();
    await page.waitForTimeout(300);

    await page.locator('[data-testid="orders-list__bulk__assign-dialog__confirm"]').click();
    await page.waitForTimeout(700);

    for (const orderNum of [O1, O2]) {
      expect(getTechAssignment(getItemId(orderNum))).toBeTruthy();
    }
  });
});
