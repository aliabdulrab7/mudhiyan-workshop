// End-to-end coverage for the bulk-scan feature (spec: docs/BULK-SCAN-SPEC.md).
//
// Preconditions: both dev servers running (npm run dev) and the dev DB at
// server/data/workshop.db is writable. Tests seed their own rows with the
// BR1-99999777-* / BR2-99999777-* prefix and clean up after themselves.
//
// Audio output itself is not asserted (Playwright can't reliably observe
// WebAudio). The audio util is trivial and manually ear-checked; here we
// only assert the mute-state persistence contract.

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const DB = '/Users/waled/Desktop/mudhiyan-workshop-qa-wf5/server/data/workshop.db';

function sql(q) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(q)}`, { encoding: 'utf8' }).trim();
}

function seedOrder(order_number, status, shop_id = 1) {
  sql(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number = '${order_number}');`);
  sql(`DELETE FROM orders WHERE order_number = '${order_number}';`);
  sql(
    `INSERT INTO orders (order_number, customer_name, phone, piece_type, shop_id, customer_token, status, created_at) ` +
    `VALUES ('${order_number}', 'E2E', '966500000000', 'خاتم', ${shop_id}, 'e2e-tk-${order_number}', '${status}', CURRENT_TIMESTAMP);`
  );
}

function cleanupPrefix(prefix) {
  sql(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '${prefix}%');`);
  sql(`DELETE FROM orders WHERE order_number LIKE '${prefix}%';`);
}

function bulkHistoryFor(order_number) {
  return sql(
    `SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id ` +
    `WHERE o.order_number = '${order_number}' AND h.notes LIKE 'bulk-scan %';`
  );
}

// Cache login results per-process so a full-suite run only hits /api/auth/login
// once per role. The server's express-rate-limit blocks 11+ logins per 15 min
// per IP — without caching we trip it after 2–3 full-suite runs.
const TOKEN_CACHE = new Map(); // key: `${username}:${password}` → { token, role, shop_id, username }

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

  await page.evaluate((creds) => {
    localStorage.clear();
    localStorage.setItem('token',    creds.token);
    localStorage.setItem('role',     creds.role);
    localStorage.setItem('username', creds.username);
    if (creds.shop_id != null) localStorage.setItem('shop_id', String(creds.shop_id));
  }, creds);
}

async function enterBulkAndPick(page, sessionTypeId) {
  await page.goto('/scan', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'تبديل إلى الوضع الدفعي' }).click();
  await page.locator(`[data-testid="bulk-scan__session-type__${sessionTypeId}"]`).click();
  await page.waitForSelector('[data-testid="bulk-scan__mode-strip__session-active"]');
}

async function scan(page, barcode) {
  await page.keyboard.type(barcode, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200); // honor 150ms post-scan lockout
}

async function waitForRow(page, stamp, expectedStatus, timeout = 4000) {
  const sel = `[data-testid="bulk-scan-list__row__${stamp}"]`;
  await page.waitForSelector(sel, { timeout });
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await page.locator(sel).getAttribute('data-row-status');
    if (s === expectedStatus) return;
    if (s && s !== 'pending' && s !== expectedStatus) {
      throw new Error(`row ${stamp} status=${s} expected=${expectedStatus}`);
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`row ${stamp} never reached status=${expectedStatus}`);
}

/* ───────────────── Workshop intake ───────────────── */

test.describe('bulk-scan — workshop intake', () => {
  const PREFIX = 'BR1-99999777-';
  const orders = [
    `${PREFIX}0001`,
    `${PREFIX}0002`,
    `${PREFIX}0003`,
  ];

  test.beforeEach(() => {
    cleanupPrefix(PREFIX);
    for (const o of orders) seedOrder(o, 'new');
  });
  test.afterEach(() => cleanupPrefix(PREFIX));

  test('3 new orders → received, summary counts, history rows tagged', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await enterBulkAndPick(page, 'intake_from_branches');

    for (const o of orders) {
      await scan(page, o);
      await waitForRow(page, o, 'success');
    }

    await expect(page.locator('[data-testid="bulk-scan__mode-strip__session-active"]')).toContainText('3 تمّ');
    await expect(page.locator('[data-testid="bulk-scan__mode-strip__session-active"]')).toContainText('0 مرفوض');

    await page.locator('[data-testid="bulk-scan__end-session-button"]').click();
    await page.waitForSelector('[data-testid="bulk-scan__mode-strip__summary"]');
    await expect(page.locator('[data-testid="bulk-scan__summary-headline"]')).toContainText('3 طلب تمّ معالجته');

    for (const o of orders) {
      expect(bulkHistoryFor(o)).toBe('1');
    }
  });
});

/* ───────────────── Workshop prepare-for-return ───────────────── */

test.describe('bulk-scan — workshop prepare for return', () => {
  const PREFIX = 'BR1-99999778-';
  const qc1 = `${PREFIX}0001`;
  const qc2 = `${PREFIX}0002`;
  const rej = `${PREFIX}0003`;

  test.beforeEach(() => {
    cleanupPrefix(PREFIX);
    seedOrder(qc1, 'quality_check');
    seedOrder(qc2, 'quality_check');
    seedOrder(rej, 'rejected');
  });
  test.afterEach(() => cleanupPrefix(PREFIX));

  test('2 quality_check + 1 rejected → ready_for_return all green', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await enterBulkAndPick(page, 'prepare_for_return');

    for (const o of [qc1, qc2, rej]) {
      await scan(page, o);
      await waitForRow(page, o, 'success');
    }

    await expect(page.locator('[data-testid="bulk-scan__mode-strip__session-active"]')).toContainText('3 تمّ');

    await page.locator('[data-testid="bulk-scan__end-session-button"]').click();
    await page.waitForSelector('[data-testid="bulk-scan__mode-strip__summary"]');
    await expect(page.locator('[data-testid="bulk-scan__summary-headline"]')).toContainText('3 طلب تمّ معالجته');

    for (const o of [qc1, qc2, rej]) {
      expect(bulkHistoryFor(o)).toBe('1');
      expect(sql(`SELECT status FROM orders WHERE order_number='${o}';`)).toBe('ready_for_return');
    }
  });
});

/* ───────────────── Shop-employee pickup ───────────────── */

test.describe('bulk-scan — shop pickup from workshop', () => {
  const PREFIX = 'BR1-99999779-';
  const a = `${PREFIX}0001`;
  const b = `${PREFIX}0002`;

  test.beforeEach(() => {
    cleanupPrefix(PREFIX);
    seedOrder(a, 'ready_for_return', 1);
    seedOrder(b, 'ready_for_return', 1);
  });
  test.afterEach(() => cleanupPrefix(PREFIX));

  test('2 own-shop ready_for_return → returned_to_shop', async ({ page }) => {
    await login(page, 'employee1', 'shop123');
    await enterBulkAndPick(page, 'pickup_from_workshop');

    for (const o of [a, b]) {
      await scan(page, o);
      await waitForRow(page, o, 'success');
    }

    await page.locator('[data-testid="bulk-scan__end-session-button"]').click();
    await page.waitForSelector('[data-testid="bulk-scan__mode-strip__summary"]');
    await expect(page.locator('[data-testid="bulk-scan__summary-headline"]')).toContainText('2 طلب تمّ معالجته');

    for (const o of [a, b]) {
      expect(bulkHistoryFor(o)).toBe('1');
      expect(sql(`SELECT status FROM orders WHERE order_number='${o}';`)).toBe('returned_to_shop');
    }
  });
});

/* ───────────────── Mute persistence ───────────────── */

test.describe('bulk-scan — mute toggle persistence', () => {
  test('toggle mute → reload → state survives', async ({ page }) => {
    await login(page, 'workshop', 'workshop123');
    await page.goto('/scan', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'تبديل إلى الوضع الدفعي' }).click();

    // default: not muted
    const muteBtn = page.locator('[data-testid="bulk-scan__mute-toggle"]').first();
    await expect(muteBtn).toHaveAttribute('data-muted', 'false');

    await muteBtn.click();
    await expect(muteBtn).toHaveAttribute('data-muted', 'true');

    const stored = await page.evaluate(() => localStorage.getItem('bulkScanMuted'));
    expect(stored).toBe('1');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'تبديل إلى الوضع الدفعي' }).click();
    const muteBtn2 = page.locator('[data-testid="bulk-scan__mute-toggle"]').first();
    await expect(muteBtn2).toHaveAttribute('data-muted', 'true');

    // clean up so we don't affect other tests
    await muteBtn2.click();
    await expect(muteBtn2).toHaveAttribute('data-muted', 'false');
  });
});
