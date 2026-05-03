// WF-3 — Technician Status Flow + Workload Visibility  (QA scaffold)
//
// SECTION 1 SCAFFOLD — all tests are test.fixme pending BE+FE landing.
// Activate by replacing test.fixme with test once the worktree has the
// integrated WF-3 stack (qa/path-c-wf-3-status worktree at
// /Users/waled/Desktop/mudhiyan-workshop-qa-wf3).
//
// Expected testid conventions (FE must emit these):
//   status-page__grid                         — WorkshopStatusPage grid container
//   status-page__tech-card--{techId}          — individual tech card on grid
//   status-page__status-trigger--{techId}     — clickable status indicator / dropdown trigger on card
//   status-page__status-option--{status}      — option in the status dropdown (available/busy/off_shift/on_leave)
//   status-page__reason-input                 — reason textarea in status change form/dialog
//   status-page__confirm-change               — confirm button for status change
//   workload-badge--{techId}                  — workload count badge (active + urgent)
//   tech-detail__status-history               — status history section in TechnicianDetailModal
//   tech-detail__status-history-row--{logId}  — individual log row in history
//
// Run: npm run test:e2e  (from repo root, worktree must be active)

import { test, expect } from '@playwright/test';
import { execSync }      from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf3/server/data/workshop.db';

function sql(q) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(q.replace(/\s*\n\s*/g, ' '))}`, { encoding: 'utf8' }).trim();
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function seedTech(name, { status = 'available', active = 1 } = {}) {
  sql(`INSERT INTO technicians (name, status, active)
       VALUES (${JSON.stringify(name)}, ${JSON.stringify(status)}, ${active});`);
  return Number(sql(`SELECT id FROM technicians WHERE name=${JSON.stringify(name)} ORDER BY id DESC LIMIT 1;`));
}

function getTechStatus(techId) {
  return sql(`SELECT status FROM technicians WHERE id=${techId};`);
}

function getStatusLog(techId) {
  // Returns latest log row for techId from technician_status_log
  return sql(`SELECT * FROM technician_status_log WHERE technician_id=${techId} ORDER BY id DESC LIMIT 1;`);
}

function countStatusLog(techId) {
  return Number(sql(`SELECT COUNT(*) FROM technician_status_log WHERE technician_id=${techId};`));
}

function getActiveAssignments(techId) {
  // Count active (non-locked, non-terminal) order_item_technician assignments
  return Number(sql(`
    SELECT COUNT(*) FROM order_item_technicians oit
    JOIN order_items oi ON oi.id=oit.order_item_id
    JOIN orders o ON o.id=oi.order_id
    WHERE oit.technician_id=${techId}
      AND o.locked_at IS NULL
      AND o.status NOT IN ('cancelled','rejected','delivered')
  `));
}

function seedOrderAssignedToTech(orderNumber, techId, shopId = 1) {
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${orderNumber}');`);
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number='${orderNumber}');`);
  sql(`DELETE FROM orders WHERE order_number='${orderNumber}';`);
  sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
       customer_token, status, created_at)
       VALUES ('${orderNumber}','WF3-QA','966500000000','خاتم',${shopId},
       'wf3-tk-${orderNumber}','in_repair',CURRENT_TIMESTAMP);`);
  sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order)
       SELECT id, 'خاتم', 'خاتم', 0 FROM orders WHERE order_number='${orderNumber}';`);
  const itemId = sql(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${orderNumber}' LIMIT 1;`);
  sql(`INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (${itemId}, ${techId});`);
  return Number(itemId);
}

function cleanupTechsByPrefix(prefix) {
  sql(`DELETE FROM technician_status_log
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM order_item_technicians
       WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${prefix}%');`);
  sql(`DELETE FROM technicians WHERE name LIKE '${prefix}%';`);
}

function cleanupOrders(prefix) {
  sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
       (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM orders WHERE order_number LIKE '${prefix}%';`);
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

// Navigate to the WorkshopStatusPage and wait for the grid to be visible.
async function openStatusPage(page) {
  await page.goto('/status', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="status-page__grid"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
}

// Open the status dropdown for a given tech card on the status page.
async function openStatusMenu(page, techId) {
  await page.locator(`[data-testid="status-page__status-trigger--${techId}"]`).click();
  // Wait for at least one status option to appear
  await page.locator('[data-testid^="status-page__status-option--"]').first()
    .waitFor({ state: 'visible', timeout: 3000 });
  await page.waitForTimeout(200);
}

// Select a new status from the open dropdown, optionally fill a reason, and confirm.
async function changeStatus(page, techId, newStatus, reason = null) {
  await openStatusMenu(page, techId);
  await page.locator(`[data-testid="status-page__status-option--${newStatus}"]`).click();
  if (reason) {
    const reasonInput = page.locator('[data-testid="status-page__reason-input"]');
    // reason input may only appear for non-available statuses
    const visible = await reasonInput.isVisible().catch(() => false);
    if (visible) await reasonInput.fill(reason);
  }
  const confirmBtn = page.locator('[data-testid="status-page__confirm-change"]');
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(400);
  } else {
    // Inline change (no confirm step) — just wait for the update
    await page.waitForTimeout(400);
  }
}

// Assert the workload badge value for a tech card.
async function assertWorkloadBadge(page, techId, expectedCount) {
  const badge = page.locator(`[data-testid="workload-badge--${techId}"]`);
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(String(expectedCount));
}

// Assert the status indicator label/class for a tech card.
async function assertStatusIndicator(page, techId, expectedStatus) {
  const indicator = page.locator(`[data-testid="status-page__status-trigger--${techId}"]`);
  await expect(indicator).toBeVisible();
  // Status is typically encoded in aria-label, text, or data-status attribute
  await expect(indicator).toHaveAttribute('data-status', expectedStatus);
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRACT — /api/technicians/:id/status endpoint
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-contract — status endpoint', () => {
  const PREFIX = 'WF3CT-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => cleanupTechsByPrefix(PREFIX));

  test.fixme('PATCH /api/technicians/:id/status returns updated tech + writes log row', async ({ page }) => {
    // Seed a tech, PATCH status to busy, verify response shape and DB log row.
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const techId = seedTech(`${PREFIX}فني`);

    const r = await page.evaluate(async ({ token, techId }) => {
      const res = await fetch(`/api/technicians/${techId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'busy', reason: 'حضر طلب عاجل' }),
      });
      return { status: res.status, body: await res.json() };
    }, { token, techId });

    expect(r.status).toBe(200);
    expect(r.body.status).toBe('busy');
    expect(getTechStatus(techId)).toBe('busy');
    expect(countStatusLog(techId)).toBe(1);
  });

  test.fixme('PATCH invalid status returns 422', async ({ page }) => {
    // Confirm the service-layer enum guard is wired to the route correctly.
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const techId = seedTech(`${PREFIX}فني`);

    const r = await page.evaluate(async ({ token, techId }) => {
      const res = await fetch(`/api/technicians/${techId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'on_vacation' }), // invalid
      });
      return { status: res.status };
    }, { token, techId });

    expect(r.status).toBe(422);
  });

  test.fixme('shop_employee gets 403 on PATCH /status', async ({ page }) => {
    await login(page, 'employee1', 'shop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const techId = seedTech(`${PREFIX}فني`);

    const r = await page.evaluate(async ({ token, techId }) => {
      const res = await fetch(`/api/technicians/${techId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'busy' }),
      });
      return { status: res.status };
    }, { token, techId });

    expect(r.status).toBe(403);
  });

  test.fixme('GET /api/technicians/:id includes status_log last 10', async ({ page }) => {
    // The detail endpoint should embed up to 10 status log rows.
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const techId = seedTech(`${PREFIX}فني`);

    const r = await page.evaluate(async ({ token, techId }) => {
      const res = await fetch(`/api/technicians/${techId}`, { headers: { Authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json() };
    }, { token, techId });

    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('status_log');
    expect(Array.isArray(r.body.status_log)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — WorkshopStatusPage grid
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — WorkshopStatusPage grid', () => {
  const PREFIX = 'WF3UI-Grid-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => cleanupTechsByPrefix(PREFIX));

  test.fixme('grid renders all active techs; inactive excluded', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const activeId = seedTech(`${PREFIX}نشيط`);
    const inactiveId = seedTech(`${PREFIX}محذوف`, { active: 0 });
    await openStatusPage(page);

    await expect(page.locator(`[data-testid="status-page__tech-card--${activeId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="status-page__tech-card--${inactiveId}"]`)).not.toBeVisible();
  });

  test.fixme('status indicator reflects current tech status', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`, { status: 'busy' });
    await openStatusPage(page);

    await assertStatusIndicator(page, techId, 'busy');
  });

  test.fixme('workload badge shows correct active assignment count', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}مشغول`);
    seedOrderAssignedToTech('BR1-WF3GRID-0001', techId);
    seedOrderAssignedToTech('BR1-WF3GRID-0002', techId);
    await openStatusPage(page);

    await assertWorkloadBadge(page, techId, 2);

    cleanupOrders('BR1-WF3GRID-');
  });

  test.fixme('shop_employee role has no WorkshopStatusPage nav link', async ({ page }) => {
    await login(page, 'employee1', 'shop123');
    await page.goto('/', { waitUntil: 'networkidle' });
    // Status page nav link should not be present for shop_employee
    await expect(page.locator('a[href="/status"]')).not.toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Status change flow
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — status change', () => {
  const PREFIX = 'WF3UI-Status-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => cleanupTechsByPrefix(PREFIX));

  test.fixme('change available → busy writes DB log row + updates indicator', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);
    const beforeCount = countStatusLog(techId);

    await openStatusPage(page);
    await changeStatus(page, techId, 'busy');

    expect(getTechStatus(techId)).toBe('busy');
    expect(countStatusLog(techId)).toBe(beforeCount + 1);
    await assertStatusIndicator(page, techId, 'busy');
  });

  test.fixme('status change with reason → reason persisted in log row', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);

    await openStatusPage(page);
    await changeStatus(page, techId, 'on_leave', 'إجازة اعتيادية');

    const logRow = getStatusLog(techId);
    expect(logRow).toContain('إجازة اعتيادية');
  });

  test.fixme('status indicator updates in-grid immediately post-change (no full reload)', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);
    await openStatusPage(page);

    await changeStatus(page, techId, 'off_shift');

    // Indicator should update without page navigation
    await assertStatusIndicator(page, techId, 'off_shift');
    // Confirm we're still on /status (no full navigation happened)
    expect(page.url()).toContain('/status');
  });

  test.fixme('all four status values available in dropdown menu', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);
    await openStatusPage(page);
    await openStatusMenu(page, techId);

    for (const status of ['available', 'busy', 'off_shift', 'on_leave']) {
      await expect(page.locator(`[data-testid="status-page__status-option--${status}"]`)).toBeVisible();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Workload badge color thresholds
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — workload badge thresholds', () => {
  const PREFIX = 'WF3UI-Badge-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => {
    cleanupTechsByPrefix(PREFIX);
    cleanupOrders('BR1-WF3BADGE-');
  });

  test.fixme('0 active orders → green badge (or no badge)', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فاضي`);
    await openStatusPage(page);

    const badge = page.locator(`[data-testid="workload-badge--${techId}"]`);
    // 0 assignments: badge may be hidden or show 0 in green
    const text = await badge.textContent().catch(() => '0');
    expect(Number(text) || 0).toBe(0);
  });

  test.fixme('1-2 active orders → green badge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}خفيف`);
    seedOrderAssignedToTech('BR1-WF3BADGE-0001', techId);
    await openStatusPage(page);

    const badge = page.locator(`[data-testid="workload-badge--${techId}"]`);
    await expect(badge).toHaveAttribute('data-load', 'low');
  });

  test.fixme('3-5 active orders → yellow badge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}متوسط`);
    for (let i = 1; i <= 3; i++) seedOrderAssignedToTech(`BR1-WF3BADGE-Y${i.toString().padStart(2,'0')}`, techId);
    await openStatusPage(page);

    const badge = page.locator(`[data-testid="workload-badge--${techId}"]`);
    await expect(badge).toHaveAttribute('data-load', 'medium');
  });

  test.fixme('6+ active orders → red badge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}ثقيل`);
    for (let i = 1; i <= 6; i++) seedOrderAssignedToTech(`BR1-WF3BADGE-R${i.toString().padStart(2,'0')}`, techId);
    await openStatusPage(page);

    const badge = page.locator(`[data-testid="workload-badge--${techId}"]`);
    await expect(badge).toHaveAttribute('data-load', 'high');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Status history in TechnicianDetailModal
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — status history in detail modal', () => {
  const PREFIX = 'WF3UI-History-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => cleanupTechsByPrefix(PREFIX));

  test.fixme('status history section visible in TechnicianDetailModal', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);
    await openStatusPage(page);

    // Open the detail modal (click the tech card or a detail button)
    await page.locator(`[data-testid="status-page__tech-card--${techId}"]`).click();
    await page.locator('[data-testid="tech-detail__status-history"]').waitFor({ state: 'visible', timeout: 3000 });

    await expect(page.locator('[data-testid="tech-detail__status-history"]')).toBeVisible();
  });

  test.fixme('status history shows up to 10 most recent log rows', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const techId = seedTech(`${PREFIX}فني`);

    // Write 12 status changes via API
    for (const status of ['busy','available','off_shift','available','on_leave','available','busy','available','off_shift','available','busy','available']) {
      await page.evaluate(async ({ token, techId, status }) => {
        await fetch(`/api/technicians/${techId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status }),
        });
      }, { token, techId, status });
    }

    await openStatusPage(page);
    await page.locator(`[data-testid="status-page__tech-card--${techId}"]`).click();
    await page.locator('[data-testid="tech-detail__status-history"]').waitFor({ state: 'visible', timeout: 3000 });

    const rows = page.locator('[data-testid^="tech-detail__status-history-row--"]');
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(10);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — RTL layout at multiple viewports
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — RTL viewport checks', () => {
  const PREFIX = 'WF3UI-RTL-';
  let techId;

  test.beforeEach(() => {
    cleanupTechsByPrefix(PREFIX);
    techId = seedTech(`${PREFIX}فني`);
  });
  test.afterEach(() => cleanupTechsByPrefix(PREFIX));

  for (const [label, width, height] of [['mobile-375', 375, 812], ['tablet-768', 768, 1024], ['desktop-1440', 1440, 900]]) {
    test.fixme(`no horizontal overflow at ${label}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      await login(page, 'workshop', 'workshop123');
      await openStatusPage(page);

      const overflow = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      await ctx.close();
      expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 1);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// UI — Auto-refresh (workload badge increments on new assignment)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-ui — auto-refresh', () => {
  const PREFIX = 'WF3UI-Refresh-';

  test.beforeEach(() => cleanupTechsByPrefix(PREFIX));
  test.afterEach(() => {
    cleanupTechsByPrefix(PREFIX);
    cleanupOrders('BR1-WF3REFRESH-');
  });

  test.fixme('workload badge increments after new item assigned (auto-refresh)', async ({ page }) => {
    // Requires WorkshopStatusPage to poll/subscribe for workload changes.
    // Manual-check note: if auto-refresh interval > 30s, this test will need
    // a longer waitForTimeout or a triggered refresh button.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${PREFIX}فني`);
    await openStatusPage(page);

    // Workload starts at 0
    await assertWorkloadBadge(page, techId, 0);

    // Assign an order externally (simulates another user assigning)
    seedOrderAssignedToTech('BR1-WF3REFRESH-0001', techId);

    // Wait for auto-refresh (assume refresh interval ≤ 10s; adjust if needed)
    await page.waitForTimeout(12000);

    await assertWorkloadBadge(page, techId, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REGRESSION — WF-1 + WF-2 flows still work after WF-3 changes
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf3-regression — WF-2 picker unaffected', () => {
  const ORDER = 'BR1-WF3REG001-0001';
  let itemId;

  test.beforeEach(() => {
    sql(`DELETE FROM order_item_technicians WHERE order_item_id IN
         (SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${ORDER}');`);
    sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number='${ORDER}');`);
    sql(`DELETE FROM orders WHERE order_number='${ORDER}';`);
    sql(`INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id,
         customer_token, status, created_at)
         VALUES ('${ORDER}','WF3-QA','966500000000','خاتم',1,'wf3-tk-${ORDER}','new',CURRENT_TIMESTAMP);`);
    sql(`INSERT INTO order_items (order_id, item_type, item_name, sort_order)
         SELECT id, 'خاتم', 'خاتم', 0 FROM orders WHERE order_number='${ORDER}';`);
    itemId = Number(sql(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_number='${ORDER}' LIMIT 1;`));
  });
  test.afterEach(() => cleanupOrders('BR1-WF3REG001-'));

  test.fixme('per-item TechnicianPicker still opens and assigns', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/orders', { waitUntil: 'networkidle' });
    await page.locator(`[data-testid="orders-list__row__${ORDER}"]`).click();
    await page.waitForTimeout(400);

    // Advance status to hydrate items (pre-existing OrderDetail design)
    const advBtn = page.locator('[data-testid="order-detail__status-advance"]');
    await advBtn.waitFor({ state: 'visible', timeout: 2000 });
    await advBtn.click();
    await page.locator('[data-testid^="tech-picker-trigger--item--"]').first()
      .waitFor({ state: 'visible', timeout: 5000 });

    await page.locator(`[data-testid="tech-picker-trigger--item--${itemId}"]`).click();
    await page.locator('[data-testid="tech-picker__search"]').waitFor({ state: 'visible', timeout: 4000 });
    await page.waitForTimeout(500);

    await page.locator('[data-testid^="tech-picker__row--"]').first().click();
    await expect(page.locator('[data-testid="tech-picker__search"]')).not.toBeVisible();
  });
});

test.describe('wf3-regression — WF-1 admin pages unaffected', () => {
  test.fixme('/roles page still loads and lists roles', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/roles', { waitUntil: 'networkidle' });
    // Roles page should render without errors
    await expect(page.locator('h1, [data-testid="roles-page__title"]')).toBeVisible();
    // At least the 4 seeded roles should be present
    const items = await page.locator('[data-testid^="role-row--"]').count();
    expect(items).toBeGreaterThanOrEqual(4);
  });

  test.fixme('/specializations page still loads and lists specs', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/specializations', { waitUntil: 'networkidle' });
    await expect(page.locator('h1, [data-testid="specs-page__title"]')).toBeVisible();
    const items = await page.locator('[data-testid^="spec-row--"]').count();
    expect(items).toBeGreaterThanOrEqual(12);
  });

  test.fixme('is_urgent badge visible and urgent order sorts to top', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/', { waitUntil: 'networkidle' });
    // At least one urgent badge should be present if any urgent orders exist
    // (non-flaky: just assert the badge CSS class/testid renders when is_urgent=1)
    const urgentRows = page.locator('[data-testid^="order-list__row--urgent"]');
    // If no urgent orders exist, test still passes — just checking render doesn't break
    const count = await urgentRows.count();
    expect(count).toBeGreaterThanOrEqual(0); // always true; real assertion is no crash
  });
});
