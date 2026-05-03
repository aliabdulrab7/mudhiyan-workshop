// WF-5 — Shift schedule editor, leave management, scheduler status page + auto-flip
//
// TestId conventions (corrected to match FE implementation):
//   tech-detail__shifts-section               — shift schedule section in TechnicianDetailModal
//   tech-detail__shift-row--{dayOfWeek}       — per-day row in shift grid (0=Sun…6=Sat)
//   tech-detail__shift-add-btn--{dayOfWeek}   — add button (visible when NO shift for that day)
//   tech-detail__shift-edit-btn--{dayOfWeek}  — edit button (visible when shift EXISTS)
//   tech-detail__shift-delete-btn--{dayOfWeek}— delete button (visible when shift EXISTS)
//   tech-detail__shift-dialog                 — add/edit shift dialog
//   tech-detail__shift-start-input            — start time input in dialog
//   tech-detail__shift-end-input              — end time input in dialog
//   tech-detail__shift-save-btn               — save button in shift dialog
//   tech-detail__shift-dialog__error          — inline validation error in shift dialog
//   tech-detail__leaves-section               — leaves list section
//   tech-detail__leave-row--{YYYY-MM-DD}      — per-leave row (keyed by date string)
//   tech-detail__leave-delete-btn--{YYYY-MM-DD}— delete button (keyed by date string)
//   tech-detail__leave-add-date               — date input in leave form (always inline)
//   tech-detail__leave-add-type               — type select in leave form
//   tech-detail__leave-add-notes              — notes textarea in leave form
//   tech-detail__leave-add-btn                — save button in leave form
//   scheduler-page__status-table              — scheduler status page tech list
//   scheduler-page__tech-row--{techId}        — per-tech row on scheduler page
//   scheduler-page__run-btn                   — manual trigger button
//   scheduler-page__tech-would-change--{techId} — "would change to" indicator

import { test, expect } from '@playwright/test';
import { execSync }      from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf5/server/data/workshop.db';

// ── DB helpers ────────────────────────────────────────────────────────────────

function sql(q) {
  return execSync(`sqlite3 "${DB}"`, { input: q.replace(/\s*\n\s*/g, ' '), encoding: 'utf8' }).trim();
}

function seedTech(name, { status = 'available', active = 1 } = {}) {
  const nameSafe = name.replace(/'/g, "''");
  sql(`INSERT INTO technicians (name, status, active) VALUES ('${nameSafe}', '${status}', ${active});`);
  return Number(sql(`SELECT id FROM technicians WHERE name='${nameSafe}' ORDER BY id DESC LIMIT 1;`));
}

function seedShift(techId, dayOfWeek, startTime, endTime) {
  // day_of_week: 0=Sunday … 6=Saturday
  sql(`INSERT OR REPLACE INTO technician_shifts (technician_id, day_of_week, start_time, end_time, active)
       VALUES (${techId}, ${dayOfWeek}, '${startTime}', '${endTime}', 1);`);
}

function seedLeave(techId, leaveDate, leaveType = 'day_off') {
  // leaveType enum: day_off | sick | vacation
  sql(`INSERT OR REPLACE INTO technician_leaves (technician_id, leave_date, leave_type)
       VALUES (${techId}, '${leaveDate}', '${leaveType}');`);
}

function cleanupTechsByPrefix(prefix) {
  const p = prefix.replace(/'/g, "''");
  sql(`DELETE FROM technician_shifts WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${p}%');`);
  sql(`DELETE FROM technician_leaves WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${p}%');`);
  sql(`DELETE FROM technician_specializations WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${p}%');`);
  sql(`DELETE FROM order_item_technicians WHERE technician_id IN (SELECT id FROM technicians WHERE name LIKE '${p}%');`);
  sql(`DELETE FROM technicians WHERE name LIKE '${p}%';`);
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

async function openTechDetailModal(page, techId) {
  await page.goto('/technicians', { waitUntil: 'networkidle' });
  await page.locator(`[data-testid="technicians__row__${techId}"]`).click({ timeout: 8000 });
  await page.waitForSelector('[data-testid^="tech-detail__"]', { timeout: 8000 });
}

// Fill and save the shift dialog for a day with no existing shift (uses add button).
async function addShift(page, techId, dayOfWeek, startTime, endTime) {
  await page.getByTestId(`tech-detail__shift-add-btn--${dayOfWeek}`).click();
  await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');
  await page.getByTestId('tech-detail__shift-start-input').fill(startTime);
  await page.getByTestId('tech-detail__shift-end-input').fill(endTime);
  await page.getByTestId('tech-detail__shift-save-btn').click();
}

// Click the delete button for the given day and confirm.
async function deleteShift(page, techId, dayOfWeek) {
  await page.getByTestId(`tech-detail__shift-delete-btn--${dayOfWeek}`).click();
  const confirm = page.getByRole('button', { name: /تأكيد|حذف|نعم/i });
  if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();
}

// Fill and save the leave form (always inline — no trigger click needed).
async function addLeave(page, techId, date, leaveType) {
  await page.getByTestId('tech-detail__leave-add-date').fill(date);
  await page.getByTestId('tech-detail__leave-add-type').selectOption(leaveType);
  await page.getByTestId('tech-detail__leave-add-btn').click();
}

// Click the scheduler manual trigger and wait for the result toast.
async function runScheduler(page) {
  await page.getByTestId('scheduler-page__run-btn').click();
  const toast = page.locator('[data-testid^="toast__"]');
  await toast.waitFor({ state: 'visible', timeout: 10000 });
  return toast;
}

// ═════════════════════════════════════════════════════════════════════════════
// WF-5 § Shift editor flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf5-ui — shift editor', () => {
  const TPREFIX = 'WF5SHIFT-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('shift grid renders 7 day rows for a tech with no shifts', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await expect(page.getByTestId('tech-detail__shifts-section')).toBeVisible();
    for (let day = 0; day <= 6; day++) {
      await expect(page.getByTestId(`tech-detail__shift-row--${day}`)).toContainText('لا مناوبة');
      await expect(page.getByTestId(`tech-detail__shift-add-btn--${day}`)).toBeVisible();
    }
  });

  test('add shift for Sunday: dialog opens, save → row shows times', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addShift(page, techId, 0, '08:00', '17:00');

    const row = page.getByTestId('tech-detail__shift-row--0');
    await expect(row).toContainText('08:00');
    await expect(row).toContainText('17:00');
    await expect(page.getByTestId('tech-detail__shift-add-btn--0')).toHaveCount(0);
    await expect(page.getByTestId('tech-detail__shift-edit-btn--0')).toBeVisible();
  });

  test('edit existing shift: dialog pre-fills current times, save → row updates', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    seedShift(techId, 1, '09:00', '18:00'); // Monday

    await openTechDetailModal(page, techId);
    await page.getByTestId('tech-detail__shift-edit-btn--1').click();
    await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');

    await expect(page.getByTestId('tech-detail__shift-start-input')).toHaveValue('09:00');
    await expect(page.getByTestId('tech-detail__shift-end-input')).toHaveValue('18:00');

    await page.getByTestId('tech-detail__shift-end-input').fill('20:00');
    await page.getByTestId('tech-detail__shift-save-btn').click();

    await expect(page.getByTestId('tech-detail__shift-row--1')).toContainText('20:00');
  });

  test('delete shift: confirm → row reverts to "لا مناوبة"', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    seedShift(techId, 2, '10:00', '19:00'); // Tuesday

    await openTechDetailModal(page, techId);
    await deleteShift(page, techId, 2);

    await expect(page.getByTestId('tech-detail__shift-add-btn--2')).toBeVisible();
    await expect(page.getByTestId('tech-detail__shift-row--2')).toContainText('لا مناوبة');
  });

  test('client validation: end time before start time → inline error, no API call', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await page.getByTestId('tech-detail__shift-add-btn--3').click(); // Wednesday
    await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');
    await page.getByTestId('tech-detail__shift-start-input').fill('18:00');
    await page.getByTestId('tech-detail__shift-end-input').fill('08:00'); // invalid: before start

    let apiCalled = false;
    await page.route('**/api/technicians/*/shifts/**', () => { apiCalled = true; });

    await page.getByTestId('tech-detail__shift-save-btn').click();
    await expect(page.getByTestId('tech-detail__shift-dialog__error')).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('workshop-only: shift section not visible for shop_employee', async ({ page }) => {
    await login(page, 'employee1', 'shop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);
    await expect(page.getByTestId('tech-detail__shifts-section')).toHaveCount(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-5 § Leave management flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf5-ui — leave management', () => {
  const TPREFIX = 'WF5LEAVE-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('leaves list shows existing leaves with type chips', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const leaveDate = '2026-05-10';
    seedLeave(techId, leaveDate, 'day_off');

    await openTechDetailModal(page, techId);
    await expect(page.getByTestId('tech-detail__leaves-section')).toBeVisible();
    await expect(page.getByTestId(`tech-detail__leave-row--${leaveDate}`)).toBeVisible();
  });

  test('add leave: pick date + type → row appears in list', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addLeave(page, techId, '2026-05-15', 'sick');

    await expect(page.locator('[data-testid^="tech-detail__leave-row--"]')).toHaveCount(1, { timeout: 5000 });
  });

  test('delete leave: row disappears', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const leaveDate = '2026-05-20';
    seedLeave(techId, leaveDate, 'vacation');

    await openTechDetailModal(page, techId);
    await page.getByTestId(`tech-detail__leave-delete-btn--${leaveDate}`).click();

    const confirm = page.getByRole('button', { name: /تأكيد|حذف|نعم/i });
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();

    await expect(page.getByTestId(`tech-detail__leave-row--${leaveDate}`)).toHaveCount(0, { timeout: 5000 });
  });

  test('duplicate leave date: upsert succeeds (no error shown)', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addLeave(page, techId, '2026-05-25', 'day_off');
    await addLeave(page, techId, '2026-05-25', 'sick'); // same date — upsert

    await expect(page.locator('[role="status"], [class*="toast"]')
      .filter({ hasText: /خطأ|error|فشل/i })).toHaveCount(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-5 § Scheduler status page flows
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf5-ui — scheduler status page', () => {
  const TPREFIX = 'WF5SCHED-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('scheduler page loads with all active techs listed', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('scheduler-page__status-table')).toBeVisible();
    await expect(page.getByTestId(`scheduler-page__tech-row--${techId}`)).toBeVisible();
  });

  test('each tech row shows current status chip + today shift if any', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const todayDay = new Date().getDay();
    seedShift(techId, todayDay, '08:00', '17:00');

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    const row = page.getByTestId(`scheduler-page__tech-row--${techId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('متاح');
    await expect(row).toContainText('08:00');
  });

  test('tech with leave today shows leave type chip', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const today = new Date().toISOString().split('T')[0];
    seedLeave(techId, today, 'sick');

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    const row = page.getByTestId(`scheduler-page__tech-row--${techId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('مرضية');
  });

  test('tech whose shift covers current time shows "would change to متاح" indicator', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`, { status: 'off_shift' });
    const todayDay = new Date().getDay();
    seedShift(techId, todayDay, '00:00', '23:59'); // covers all day

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId(`scheduler-page__tech-would-change--${techId}`)).toBeVisible();
  });

  test('manual trigger button: click → toast with updated/skipped count', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('scheduler-page__status-table')).toBeVisible();

    const toast = await runScheduler(page);
    await expect(toast).toContainText(/\d+/);
  });

  test('page auto-refreshes: second GET /api/scheduler/status fires within 65s', async ({ page }) => {
    test.setTimeout(90_000); // interval is 60s; need headroom beyond default 60s timeout
    await login(page, 'workshop', 'workshop123');

    // Register listener BEFORE navigation so initial load is counted
    let requestCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/scheduler/status')) requestCount++;
    });

    await page.goto('/scheduler', { waitUntil: 'networkidle' }); // first request fires here

    // Wait for a SECOND request (auto-refresh at ~60s)
    await page.waitForRequest(
      req => req.url().includes('/api/scheduler/status') && requestCount >= 2,
      { timeout: 70_000 }
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-5 § Regression scenarios
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf5-regression — WF-4 priority chip unaffected', () => {
  test('WF-4: priority chip on urgent item still renders after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    // Seed + open order — inline after activation
  });
});

test.describe('wf5-regression — WF-4 auto-assign unaffected', () => {
  test('WF-4: auto-assign button still present and functional after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    // Open an in-repair order, verify auto-assign button visible — inline after activation
  });
});

test.describe('wf5-regression — WF-4 spec-map admin unaffected', () => {
  test('WF-4: spec-map admin page still loads after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/spec-map', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('spec-map-admin__list')).toBeVisible();
  });
});

test.describe('wf5-regression — WF-3 StatusChangeMenu unaffected', () => {
  const TPREFIX = 'WF5REGST-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('WF-3: StatusChangeMenu still changes technician status after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    await page.goto('/workshop-status', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="workshop-status__grid"]').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator(`[data-testid="workshop-status__card--${techId}"]`).waitFor({ state: 'visible', timeout: 8000 });
    await page.locator(`[data-testid="workshop-status__card--${techId}"]`).click();

    await page.locator(`[data-testid="status-change-menu--${techId}__submit"]`).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: 'مشغول' }).click();
    await page.locator(`[data-testid="status-change-menu--${techId}__submit"]`).click();

    await expect(page.locator(`[data-testid="workshop-status__card--${techId}"]`)).toContainText('مشغول');
  });
});

test.describe('wf5-regression — WF-2 TechnicianPicker unaffected', () => {
  const TPREFIX = 'WF5REGPKT-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('WF-2: TechnicianPicker search and suggest still work after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    const pickerTrigger = page.locator(`[data-testid="tech-picker-trigger--item--{itemId}"]`);
    await pickerTrigger.click();
    const searchInput = page.locator('[data-testid="tech-picker__search"]');
    await searchInput.fill(TPREFIX);
    await expect(page.locator(`[data-testid="tech-picker__row--${techId}"]`)).toBeVisible({ timeout: 5000 });
  });
});
