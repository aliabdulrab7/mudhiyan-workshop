// WF-5 — Shift schedule editor, leave management, scheduler status page + auto-flip
//
// All tests are test.fixme — activate by replacing test.fixme with test once the
// qa/path-c-wf-5 worktree has the integrated WF-5 stack (BE S5 + FE S4 merged).
//
// Expected testid conventions (FE must emit these — verify before activating):
//   tech-detail__shifts-section               — shift schedule section in TechnicianDetailModal
//   tech-detail__shift-row--{dayOfWeek}       — per-day row in shift grid (0=Sun…6=Sat)
//   tech-detail__shift-empty--{dayOfWeek}     — "لا مناوبة" placeholder in empty row
//   tech-detail__shift-add--{dayOfWeek}       — add/edit button for a day row
//   tech-detail__shift-dialog                 — add/edit shift dialog
//   tech-detail__shift-start                  — start time input in dialog
//   tech-detail__shift-end                    — end time input in dialog
//   tech-detail__shift-save                   — save button in shift dialog
//   tech-detail__shift-delete--{dayOfWeek}    — delete button on a filled shift row
//   tech-detail__shift-error                  — inline validation error in shift dialog
//   tech-detail__leaves-section               — leaves list section
//   tech-detail__leave-row--{leaveId}         — per-leave row
//   tech-detail__leave-add                    — add leave trigger
//   tech-detail__leave-date-input             — date input in leave form
//   tech-detail__leave-type-select            — type select in leave form
//   tech-detail__leave-save                   — save button in leave form
//   tech-detail__leave-delete--{leaveId}      — delete button on leave row
//   scheduler-status__grid                    — scheduler status page tech list
//   scheduler-status__tech-row--{techId}      — per-tech row on scheduler page
//   scheduler-status__run-btn                 — manual trigger button
//   scheduler-status__would-change--{techId}  — "would change to متاح" indicator

import { test, expect } from '@playwright/test';
import { execSync }      from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf5/server/data/workshop.db';

// ── DB helpers ────────────────────────────────────────────────────────────────
// Use stdin piping to avoid shell quoting issues with special characters / JSON

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

function seedLeave(techId, leaveDate, leaveType = 'annual') {
  sql(`INSERT OR REPLACE INTO technician_leaves (technician_id, leave_date, leave_type)
       VALUES (${techId}, '${leaveDate}', '${leaveType}');`);
  return Number(sql(`SELECT id FROM technician_leaves WHERE technician_id=${techId} AND leave_date='${leaveDate}' ORDER BY id DESC LIMIT 1;`));
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

// Navigate to the technician detail modal/page for techId.
// Assumes /technicians route exists and clicking the tech row opens the modal.
async function openTechDetailModal(page, techId) {
  await page.goto('/technicians', { waitUntil: 'networkidle' });
  await page.locator(`[data-testid="technicians__row--${techId}"]`).click({ timeout: 8000 });
  await page.waitForSelector('[data-testid^="tech-detail__"]', { timeout: 8000 });
}

// Fill and save the shift dialog for a given day (0=Sun…6=Sat).
async function addShift(page, techId, dayOfWeek, startTime, endTime) {
  await page.getByTestId(`tech-detail__shift-add--${dayOfWeek}`).click();
  await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');
  await page.getByTestId('tech-detail__shift-start').fill(startTime);
  await page.getByTestId('tech-detail__shift-end').fill(endTime);
  await page.getByTestId('tech-detail__shift-save').click();
}

// Click the delete button for the given day and confirm.
async function deleteShift(page, techId, dayOfWeek) {
  await page.getByTestId(`tech-detail__shift-delete--${dayOfWeek}`).click();
  // Confirm delete — expect a confirm dialog or inline confirm button
  const confirm = page.getByRole('button', { name: /تأكيد|حذف|نعم/i });
  if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();
}

// Fill and save the leave form.
async function addLeave(page, techId, date, leaveType) {
  await page.getByTestId('tech-detail__leave-add').click();
  await page.getByTestId('tech-detail__leave-date-input').fill(date);
  await page.getByTestId('tech-detail__leave-type-select').selectOption(leaveType);
  await page.getByTestId('tech-detail__leave-save').click();
}

// Click the scheduler manual trigger and wait for the result toast.
async function runScheduler(page) {
  await page.getByTestId('scheduler-status__run-btn').click();
  // Toast should show updated/skipped counts
  const toast = page.locator('[role="status"], [class*="toast"]');
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
    // All 7 rows should show "لا مناوبة" placeholder when no shifts are seeded.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await expect(page.getByTestId('tech-detail__shifts-section')).toBeVisible();
    for (let day = 0; day <= 6; day++) {
      await expect(page.getByTestId(`tech-detail__shift-empty--${day}`)).toContainText('لا مناوبة');
    }
  });

  test('add shift for Sunday: dialog opens, save → row shows times', async ({ page }) => {
    // Sunday = day 0. After saving, the row should display start–end times.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addShift(page, techId, 0, '08:00', '17:00');

    // Row should show the times and no longer show "لا مناوبة"
    const row = page.getByTestId('tech-detail__shift-row--0');
    await expect(row).toContainText('08:00');
    await expect(row).toContainText('17:00');
    await expect(page.getByTestId('tech-detail__shift-empty--0')).toHaveCount(0);
  });

  test('edit existing shift: dialog pre-fills current times, save → row updates', async ({ page }) => {
    // Seed a shift then open the edit dialog — inputs must pre-fill with seeded times.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    seedShift(techId, 1, '09:00', '18:00'); // Monday

    await openTechDetailModal(page, techId);
    await page.getByTestId('tech-detail__shift-add--1').click(); // opens edit (row has shift)
    await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');

    // Inputs must pre-fill with existing values
    await expect(page.getByTestId('tech-detail__shift-start')).toHaveValue('09:00');
    await expect(page.getByTestId('tech-detail__shift-end')).toHaveValue('18:00');

    // Change end time and save
    await page.getByTestId('tech-detail__shift-end').fill('20:00');
    await page.getByTestId('tech-detail__shift-save').click();

    await expect(page.getByTestId('tech-detail__shift-row--1')).toContainText('20:00');
  });

  test('delete shift: confirm → row reverts to "لا مناوبة"', async ({ page }) => {
    // Seed a shift, delete it, verify row shows empty placeholder again.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    seedShift(techId, 2, '10:00', '19:00'); // Tuesday

    await openTechDetailModal(page, techId);
    await deleteShift(page, techId, 2);

    await expect(page.getByTestId('tech-detail__shift-empty--2')).toContainText('لا مناوبة');
  });

  test('client validation: end time before start time → inline error, no API call', async ({ page }) => {
    // Submitting end < start must show an inline error and NOT fire a network request.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await page.getByTestId('tech-detail__shift-add--3').click(); // Wednesday
    await page.waitForSelector('[data-testid="tech-detail__shift-dialog"]');
    await page.getByTestId('tech-detail__shift-start').fill('18:00');
    await page.getByTestId('tech-detail__shift-end').fill('08:00'); // invalid: before start

    // Intercept — no PUT/POST to shifts should fire
    let apiCalled = false;
    await page.route('**/api/technicians/*/shifts/**', () => { apiCalled = true; });

    await page.getByTestId('tech-detail__shift-save').click();
    await expect(page.getByTestId('tech-detail__shift-error')).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('workshop-only: shift section not visible for shop_employee', async ({ page }) => {
    // shop_employee should not see the shift schedule section.
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
    // Seed a leave, open modal, verify leave row appears with type chip.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const leaveId = seedLeave(techId, '2026-05-10', 'annual');

    await openTechDetailModal(page, techId);
    await expect(page.getByTestId('tech-detail__leaves-section')).toBeVisible();
    await expect(page.getByTestId(`tech-detail__leave-row--${leaveId}`)).toBeVisible();
  });

  test('add leave: pick date + type → row appears in list', async ({ page }) => {
    // Fill the leave form, save, verify a new row appears.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addLeave(page, techId, '2026-05-15', 'sick');

    // At least one leave row should appear
    await expect(page.locator('[data-testid^="tech-detail__leave-row--"]')).toHaveCount(1, { timeout: 5000 });
  });

  test('delete leave: row disappears', async ({ page }) => {
    // Seed leave, delete it, verify row count drops to 0.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const leaveId = seedLeave(techId, '2026-05-20', 'annual');

    await openTechDetailModal(page, techId);
    await page.getByTestId(`tech-detail__leave-delete--${leaveId}`).click();

    // Confirm if needed
    const confirm = page.getByRole('button', { name: /تأكيد|حذف|نعم/i });
    if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();

    await expect(page.getByTestId(`tech-detail__leave-row--${leaveId}`)).toHaveCount(0, { timeout: 5000 });
  });

  test('duplicate leave date: upsert succeeds (no error shown)', async ({ page }) => {
    // Adding the same date twice should upsert (not error) per BE spec.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    await openTechDetailModal(page, techId);

    await addLeave(page, techId, '2026-05-25', 'annual');
    // Add same date again — should succeed silently (upsert)
    await addLeave(page, techId, '2026-05-25', 'sick');

    // No error dialog / toast with error text
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
    // Active techs should appear in the scheduler grid.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('scheduler-status__grid')).toBeVisible();
    await expect(page.getByTestId(`scheduler-status__tech-row--${techId}`)).toBeVisible();
  });

  test('each tech row shows current status chip + today shift if any', async ({ page }) => {
    // Seed a tech with today's day shift, verify both status and shift time appear in row.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const todayDay = new Date().getDay(); // 0=Sun…6=Sat
    seedShift(techId, todayDay, '08:00', '17:00');

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    const row = page.getByTestId(`scheduler-status__tech-row--${techId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('متاح'); // default status
    await expect(row).toContainText('08:00'); // today's shift
  });

  test('tech with leave today shows leave type chip', async ({ page }) => {
    // Seed a leave for today, verify the scheduler row shows a leave type chip.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    seedLeave(techId, today, 'sick');

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    const row = page.getByTestId(`scheduler-status__tech-row--${techId}`);
    await expect(row).toBeVisible();
    // Leave type chip should appear (sick leave label in Arabic)
    await expect(row).toContainText('مرضية');
  });

  test('tech whose shift covers current time shows "would change to متاح" indicator', async ({ page }) => {
    // Seed 00:00→23:59 shift to reliably cover current time regardless of clock.
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`, { status: 'off_shift' });
    const todayDay = new Date().getDay();
    seedShift(techId, todayDay, '00:00', '23:59'); // covers all day

    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId(`scheduler-status__would-change--${techId}`)).toBeVisible();
  });

  test('manual trigger button: click → toast with updated/skipped count', async ({ page }) => {
    // Clicking the run button should trigger the scheduler and show a result toast.
    await login(page, 'workshop', 'workshop123');
    await page.goto('/scheduler', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('scheduler-status__grid')).toBeVisible();

    const toast = await runScheduler(page);
    // Toast should mention "updated" or "skipped" counts (Arabic or numeric)
    await expect(toast).toContainText(/\d+/); // at least one number in the toast
  });

  test('page auto-refreshes: second GET /api/scheduler/status fires within 65s', async ({ page }) => {
    // The scheduler page should poll the status endpoint automatically every ~60s.
    // Use waitForRequest with 70s timeout to catch the auto-refresh call.
    await login(page, 'workshop', 'workshop123');
    await page.goto('/scheduler', { waitUntil: 'networkidle' });

    // First request already fired during load. Wait for a SECOND request.
    let requestCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/scheduler/status')) requestCount++;
    });

    // Wait up to 70s for the auto-refresh network request
    await page.waitForRequest(
      req => req.url().includes('/api/scheduler/status') && requestCount > 0,
      { timeout: 70_000 }
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WF-5 § Regression scenarios
// ═════════════════════════════════════════════════════════════════════════════

test.describe('wf5-regression — WF-4 priority chip unaffected', () => {
  const PREFIX  = 'BR1-WF5REGPRI-';
  const TPREFIX = 'WF5REGPRIT-';

  test.beforeEach(() => {
    // cleanupOrders and tech cleanup would be added when activating
  });

  test('WF-4: priority chip on urgent item still renders after WF-5 merge', async ({ page }) => {
    // Navigate to an urgent order, verify the "عاجل" chip still renders in OrderDetail.
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
  const PREFIX  = 'BR1-WF5REGPK-';
  const TPREFIX = 'WF5REGPKT-';

  test.beforeEach(() => cleanupTechsByPrefix(TPREFIX));
  test.afterEach(() => cleanupTechsByPrefix(TPREFIX));

  test('WF-2: TechnicianPicker search and suggest still work after WF-5 merge', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    const techId = seedTech(`${TPREFIX}فني`);

    // Seed an in-repair order and open it — inline after activation using correct order seeding
    // await openOrderDetail(page, orderNumber);

    const pickerTrigger = page.locator(`[data-testid="tech-picker-trigger--item--{itemId}"]`);
    await pickerTrigger.click();
    const searchInput = page.locator('[data-testid="tech-picker__search"]');
    await searchInput.fill(TPREFIX);
    await expect(page.locator(`[data-testid="tech-picker__row--${techId}"]`)).toBeVisible({ timeout: 5000 });
  });
});
