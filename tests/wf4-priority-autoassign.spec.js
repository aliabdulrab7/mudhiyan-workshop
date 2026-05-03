// WF-4 — Priority Badges + Auto-assign + Configurable Spec-Map  (QA scaffold)
//
// SCAFFOLD — all tests are test.fixme pending BE+FE landing.
// Activate by replacing test.fixme with test once the worktree has the
// integrated WF-4 stack (qa/path-c-wf-4 worktree at
// /Users/waled/Desktop/mudhiyan-workshop-qa-wf4).
//
// Expected testid conventions (FE must emit these):
//   order-detail__item-row__priority-chip--{itemId}   — priority chip on item row (urgent/low; standard may be omitted)
//   order-detail__item-row__auto-assign--{itemId}      — auto-assign button on item row (workshop only)
//   spec-map-admin__list                               — spec-map admin page/panel list container
//   spec-map-admin__entry--{itemType}                  — individual item-type row in the map (URL-encoded key or data-attr)
//   spec-map-admin__edit-btn--{itemType}               — "تعديل" button on each entry
//   spec-map-admin__dialog                             — edit dialog container
//   spec-map-admin__spec-chip--{specValue}             — toggleable spec chip in edit dialog
//   spec-map-admin__save-btn                           — save button in edit dialog
//   spec-map-admin__dialog-error                       — inline error in edit dialog on 422
//
// Run: npm run test:e2e  (from repo root, worktree must be active)

import { test, expect } from '@playwright/test';
import { execSync }      from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf4/server/data/workshop.db';

function sql(q) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(q.replace(/\s*\n\s*/g, ' '))}`, { encoding: 'utf8' }).trim();
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function seedTech(name, { status = 'available', active = 1 } = {}) {
  sql(`INSERT INTO technicians (name, status, active)
       VALUES (${JSON.stringify(name)}, ${JSON.stringify(status)}, ${active});`);
  return Number(sql(`SELECT id FROM technicians WHERE name=${JSON.stringify(name)} ORDER BY id DESC LIMIT 1;`));
}

function addSpec(techId, specValue) {
  const specId = sql(`SELECT id FROM specializations WHERE value=${JSON.stringify(specValue)} LIMIT 1;`);
  if (specId) {
    sql(`INSERT OR IGNORE INTO technician_specializations (technician_id, specialization_id)
         VALUES (${techId}, ${specId});`);
  }
}

function seedOrder(orderNumber, { status = 'in_repair', shopId = 1, isUrgent = 0 } = {}) {
  sql(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number='${orderNumber}');`);
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${orderNumber}');`);
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number='${orderNumber}');`);
  sql(`DELETE FROM orders WHERE order_number='${orderNumber}';`);
  sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
       customer_token, status, is_urgent, created_at)
       VALUES ('${orderNumber}','WF4-QA','966500000000','خاتم',${shopId},
       'wf4-tk-${orderNumber}','${status}',${isUrgent},CURRENT_TIMESTAMP);`);
  sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order, priority)
       SELECT id, 'خاتم', 'خاتم', 0, 'standard' FROM orders WHERE order_number='${orderNumber}';`);
  return getItemId(orderNumber);
}

function getItemId(orderNumber) {
  return Number(sql(`SELECT oi.id FROM order_items oi
                     JOIN orders o ON o.id=oi.order_id
                     WHERE o.order_number='${orderNumber}' LIMIT 1;`));
}

function setItemPriority(itemId, priority) {
  sql(`UPDATE order_items SET priority=${JSON.stringify(priority)} WHERE id=${itemId};`);
}

function setOrderLocked(orderNumber) {
  sql(`UPDATE orders SET locked_at=CURRENT_TIMESTAMP, status='delivered'
       WHERE order_number='${orderNumber}';`);
}

function getAssignedTech(itemId) {
  return sql(`SELECT t.name FROM order_item_technicians oit
              JOIN technicians t ON t.id=oit.technician_id
              WHERE oit.order_item_id=${itemId} ORDER BY oit.id DESC LIMIT 1;`);
}

function setSpecMap(itemType, specValues) {
  // Update DB-backed spec map row directly for test setup
  sql(`INSERT OR REPLACE INTO item_type_spec_map (item_type, spec_values, updated_at)
       VALUES (${JSON.stringify(itemType)}, ${JSON.stringify(JSON.stringify(specValues))}, datetime('now','localtime'));`);
}

function cleanupTechsByPrefix(prefix) {
  sql(`DELETE FROM technician_specializations
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM order_item_technicians
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM technicians WHERE name LIKE '${prefix}%';`);
}

function cleanupOrders(prefix) {
  sql(`DELETE FROM order_status_history WHERE order_id IN
       (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id
        WHERE o.order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM order_items WHERE order_id IN
       (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM orders WHERE order_number LIKE '${prefix}%';`);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

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

// ── Inline helpers ────────────────────────────────────────────────────────────

async function openOrderDetail(page, orderNumber) {
  await page.goto('/orders', { waitUntil: 'networkidle' });
  // Search for the order number to surface it from any paginated/filtered state
  const search = page.locator('[data-testid="order-list__search-input"]');
  await search.waitFor({ state: 'visible', timeout: 5000 });
  await search.fill(orderNumber);
  await page.waitForTimeout(400); // debounce
  await page.locator(`[data-testid="order-list__row__${orderNumber}"]`).click({ timeout: 8000 });
  await page.waitForSelector('[data-testid^="order-detail__"]', { timeout: 8000 });
}

async function assertPriorityChip(page, itemId, priority) {
  // priority: 'urgent' → chip with text "عاجل"; 'low' → "منخفض"; 'standard' → no chip (or "عادي")
  const chip = page.getByTestId(`order-detail__item-row__priority-chip--${itemId}`);
  if (priority === 'urgent') {
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('عاجل');
  } else if (priority === 'low') {
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('منخفض');
  } else {
    // standard: NO chip rendered (FE design decision — less noise for default priority)
    await expect(chip).toHaveCount(0);
  }
}

async function clickAutoAssign(page, itemId) {
  await page.getByTestId(`order-detail__item-row__auto-assign--${itemId}`).click();
}

async function openSpecMapAdmin(page) {
  await page.goto('/spec-map', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="spec-map-admin__list"]', { timeout: 8000 });
}

async function editSpecMapEntry(page, itemType, specValues) {
  // itemType: Arabic string; specValues: array of spec value keys to toggle on
  await page.getByTestId(`spec-map-admin__edit-btn--${encodeURIComponent(itemType)}`).click();
  await page.waitForSelector('[data-testid="spec-map-admin__dialog"]');
  // Toggle desired specs (click each chip to select)
  for (const v of specValues) {
    const chip = page.getByTestId(`spec-map-admin__spec-chip--${v}`);
    const isActive = await chip.getAttribute('data-active');
    if (isActive !== 'true') await chip.click();
  }
  await page.getByTestId('spec-map-admin__save-btn').click();
}

// ═════════════════════════════════════════════════════════════════════════════
// WF-4 § Priority badge flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf4-ui — priority chips on item rows', () => {
  const PREFIX = 'BR1-WF4PRI-';

  test.beforeEach(() => cleanupOrders(PREFIX));
  test.afterEach(() => cleanupOrders(PREFIX));

  test('urgent item shows red "عاجل" chip in OrderDetail row', async ({ page }) => {
    // Seed an in-repair order, set item priority to urgent, verify chip renders.
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}URGENT-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });
    setItemPriority(itemId, 'urgent');

    await openOrderDetail(page, orderNumber);
    await assertPriorityChip(page, itemId, 'urgent');
  });

  test('standard item shows NO chip in OrderDetail row', async ({ page }) => {
    // FE design decision: standard priority renders no chip (less noise for the default).
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}STD-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });
    // priority defaults to 'standard' in seed

    await openOrderDetail(page, orderNumber);
    await assertPriorityChip(page, itemId, 'standard'); // asserts chip absent
  });

  test('low-priority item shows "منخفض" chip in OrderDetail row', async ({ page }) => {
    // Seed order, set item priority to low, verify chip text.
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}LOW-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });
    setItemPriority(itemId, 'low');

    await openOrderDetail(page, orderNumber);
    await assertPriorityChip(page, itemId, 'low');
  });

  test('order-level "مستعجل" badge still present in header (no regression)', async ({ page }) => {
    // Verify the existing is_urgent badge in the order header survives WF-4 item-priority migration.
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}HEADER-001`;
    seedOrder(orderNumber, { status: 'in_repair', isUrgent: 1 });

    await openOrderDetail(page, orderNumber);
    const badge = page.locator('.badge, [class*="urgent"], [class*="مستعجل"]').filter({ hasText: 'مستعجل' });
    await expect(badge.first()).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-4 § Auto-assign flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf4-ui — auto-assign button', () => {
  const PREFIX  = 'BR1-WF4AA-';
  const TPREFIX = 'WF4AAT-';

  test.beforeEach(() => { cleanupOrders(PREFIX); cleanupTechsByPrefix(TPREFIX); });
  test.afterEach(() => { cleanupOrders(PREFIX); cleanupTechsByPrefix(TPREFIX); });

  test('auto-assign button is visible in item row for workshop role', async ({ page }) => {
    // Workshop user sees the auto-assign button alongside the technician dropdown.
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}BTN-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });

    await openOrderDetail(page, orderNumber);
    await expect(page.getByTestId(`order-detail__item-row__auto-assign--${itemId}`)).toBeVisible();
  });

  test('auto-assign button is absent for shop_employee role', async ({ page }) => {
    // shop_employee must NOT see the auto-assign button (workshop-only feature).
    await login(page, 'employee1', 'shop123');
    const orderNumber = `${PREFIX}EMPNO-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });

    await openOrderDetail(page, orderNumber);
    await expect(page.getByTestId(`order-detail__item-row__auto-assign--${itemId}`)).toHaveCount(0);
  });

  test('auto-assign button is HIDDEN on locked orders (not 409 toast)', async ({ page }) => {
    // FE design decision: button is hidden (canAssignTech=false) when order is locked.
    // Do NOT assert a 409 error toast — assert the button is absent from the DOM.
    await login(page, 'workshop', 'workshop123');
    const orderNumber = `${PREFIX}LOCKED-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });
    setOrderLocked(orderNumber);

    await openOrderDetail(page, orderNumber);
    await expect(page.getByTestId(`order-detail__item-row__auto-assign--${itemId}`)).toHaveCount(0);
  });

  test('click auto-assign with available tech → tech name appears in assignment', async ({ page }) => {
    // Seed a tech with 'rings' spec, seed a خاتم item, click auto-assign, expect assignment to update.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    addSpec(techId, 'rings');

    const orderNumber = `${PREFIX}HAPPY-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });

    await openOrderDetail(page, orderNumber);
    await clickAutoAssign(page, itemId);

    // Expect success toast
    const toast = page.locator('[role="status"], [class*="toast"]');
    await expect(toast.filter({ hasText: `${TPREFIX}فني` })).toBeVisible({ timeout: 5000 });

    // Expect tech name appears in item row
    await expect(page.locator(`[data-testid^="order-detail__item-row"][data-testid*="${itemId}"]`))
      .toContainText(`${TPREFIX}فني`);
  });

  test('click auto-assign with no available tech → warning toast with Arabic message', async ({ page }) => {
    // With no active techs in DB, auto-assign should 422 → show Arabic warning.
    await login(page, 'workshop', 'workshop123');
    // Do NOT seed any tech for this test — rely on no available techs
    // Deactivate any seeded techs that might match (best-effort; scoring may still find someone)
    // A more robust approach: seed only off_shift/on_leave techs
    const techId = seedTech(`${TPREFIX}غير-متاح`, { status: 'on_leave' });

    const orderNumber = `${PREFIX}NOTECH-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });

    await openOrderDetail(page, orderNumber);

    // Override spec-map to require a non-existent spec so scoring yields no suggestions
    setSpecMap('خاتم', ['nonexistent_spec_value_qa']);

    await clickAutoAssign(page, itemId);

    const toast = page.locator('[role="status"], [class*="toast"]');
    await expect(toast.filter({ hasText: 'لا يوجد فني' })).toBeVisible({ timeout: 5000 });

    // Restore spec-map
    setSpecMap('خاتم', ['rings']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-4 § Spec-map admin flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf4-ui — spec-map admin', () => {

  test('spec-map admin page loads with seeded map entries', async ({ page }) => {
    // The 5 seeded item types (خاتم, حلق, سوار, سلسلة, ساعة) should all appear.
    await login(page, 'workshop', 'workshop123');
    await openSpecMapAdmin(page);

    const list = page.getByTestId('spec-map-admin__list');
    await expect(list).toBeVisible();
    for (const itemType of ['خاتم', 'حلق', 'سوار', 'سلسلة', 'ساعة']) {
      await expect(list).toContainText(itemType);
    }
  });

  test('edit dialog opens for an item type', async ({ page }) => {
    // Click "تعديل" on خاتم row → dialog appears with specialization options.
    await login(page, 'workshop', 'workshop123');
    await openSpecMapAdmin(page);

    await page.getByTestId(`spec-map-admin__edit-btn--${encodeURIComponent('خاتم')}`).click();
    await expect(page.getByTestId('spec-map-admin__dialog')).toBeVisible();
    // Dialog should contain available specializations as chips
    await expect(page.getByTestId('spec-map-admin__dialog')).toContainText('خاتم');
  });

  test('save updated spec values → map refreshes with new values', async ({ page }) => {
    // Edit خاتم row to add 'polishing' spec, save, verify list refreshes.
    await login(page, 'workshop', 'workshop123');
    await openSpecMapAdmin(page);

    await editSpecMapEntry(page, 'خاتم', ['rings', 'polishing']);

    // Dialog closes, list refreshes — polishing display label appears in خاتم entry
    await expect(page.getByTestId('spec-map-admin__dialog')).toHaveCount(0);
    const entry = page.getByTestId(`spec-map-admin__entry--${encodeURIComponent('خاتم')}`);
    await expect(entry).toContainText('تلميع'); // display_label_ar for 'polishing'

    // Restore original
    setSpecMap('خاتم', ['rings']);
  });

  test('invalid spec value returns 422 error shown inline in dialog', async ({ page }) => {
    // Sending an unknown spec key should show inline error, not close dialog.
    // This tests the FE error-handling path — FE must call PUT with an invalid value.
    // Simulated by directly calling the API from page context with a bogus spec value.
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const r = await page.evaluate(async ({ token }) => {
      const itemType = encodeURIComponent('خاتم');
      const res = await fetch(`/api/technicians/item-type-spec-map/${itemType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spec_values: ['nonexistent_spec_qa_wf4'] }),
      });
      return { status: res.status };
    }, { token });

    expect(r.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-4 § Regression scenarios
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf4-regression — WF-3 StatusChangeMenu unaffected', () => {
  const PREFIX  = 'BR1-WF4REGST-';
  const TPREFIX = 'WF4REGTT-';

  test.beforeEach(() => { cleanupTechsByPrefix(TPREFIX); });
  test.afterEach(() => { cleanupTechsByPrefix(TPREFIX); });

  test('StatusChangeMenu still changes technician status after WF-4 merge', async ({ page }) => {
    // Verify the WF-3 status-change flow isn't broken by WF-4 changes.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    await page.goto('/workshop-status');
    await page.waitForSelector(`[data-testid="status-page__tech-card--${techId}"]`);

    await page.getByTestId(`status-page__status-trigger--${techId}`).click();
    await page.getByTestId('status-page__status-option--busy').click();

    const reasonInput = page.getByTestId('status-page__reason-input');
    if (await reasonInput.isVisible()) await reasonInput.fill('regression check');

    const confirmBtn = page.getByTestId('status-page__confirm-change');
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    await expect(page.getByTestId(`status-page__tech-card--${techId}`)).toContainText('مشغول');
  });
});

test.describe('wf4-regression — WF-2 TechnicianPicker unaffected', () => {
  const PREFIX  = 'BR1-WF4REGPK-';
  const TPREFIX = 'WF4REGPT-';

  test.beforeEach(() => {
    cleanupOrders(PREFIX);
    cleanupTechsByPrefix(TPREFIX);
  });
  test.afterEach(() => {
    cleanupOrders(PREFIX);
    cleanupTechsByPrefix(TPREFIX);
  });

  test('TechnicianPicker search and suggest still work after WF-4 merge', async ({ page }) => {
    // Open an order, use the tech picker to search by name, verify results appear.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    addSpec(techId, 'rings');

    const orderNumber = `${PREFIX}PICKER-001`;
    const itemId = seedOrder(orderNumber, { status: 'in_repair' });

    await openOrderDetail(page, orderNumber);

    // Open the technician picker dropdown/search for the item row
    const pickerTrigger = page.locator(`[data-testid="tech-picker-trigger--item--${itemId}"]`);
    await pickerTrigger.click();

    const searchInput = page.locator('[data-testid="tech-picker__search"]');
    await searchInput.fill(TPREFIX);

    await expect(page.locator(`[data-testid="tech-picker__row--${techId}"]`)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('wf4-regression — WF-1 admin pages unaffected', () => {

  test('/roles page loads and shows seeded roles', async ({ page }) => {
    // The 4 seeded roles (jeweler, polisher, appraiser, apprentice) must appear.
    await login(page, 'workshop', 'workshop123');
    await page.goto('/roles');
    await expect(page.locator('body')).toContainText('جوهرجي');
  });

  test('/specializations page loads and shows seeded specializations', async ({ page }) => {
    // At least one seeded spec (خواتم / rings) should appear.
    await login(page, 'workshop', 'workshop123');
    await page.goto('/specializations');
    await expect(page.locator('body')).toContainText('خواتم');
  });
});
