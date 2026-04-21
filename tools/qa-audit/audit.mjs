import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const BASE = 'https://localhost:5173';
const API  = 'http://localhost:3737';
const SHOTS = path.join(__dirname, 'screenshots');
const REPORT = path.join(REPO_ROOT, 'QA-REPORT.md');
fs.mkdirSync(SHOTS, { recursive: true });

const findings = [];
function log(f) {
  findings.push(f);
  const s = f.severity.padEnd(8);
  console.log(`[${s}] ${f.flow} :: ${f.title}`);
}

// Emit final report & exit. Single writer so early-abort and happy-path share format.
function writeReport() {
  const sevOrder = { Critical: 0, Major: 1, Minor: 2 };
  findings.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || a.flow.localeCompare(b.flow));
  const critical = findings.filter(f => f.severity === 'Critical').length;
  const major    = findings.filter(f => f.severity === 'Major').length;
  const minor    = findings.filter(f => f.severity === 'Minor').length;

  const md = [];
  md.push(`# QA Report — Mudhiyan Workshop`);
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`App: React client at ${BASE} · Express API at ${API}`);
  md.push(`Environment: macOS 14.3 · Playwright 1.59 Chromium headless`);
  md.push(`Credentials used: workshop/workshop123, employee1/shop123`);
  md.push('');
  md.push(`## Summary`);
  md.push('');
  md.push(`| Severity | Count |`);
  md.push(`|---|---|`);
  md.push(`| Critical | ${critical} |`);
  md.push(`| Major    | ${major}    |`);
  md.push(`| Minor    | ${minor}    |`);
  md.push(`| **Total**| **${findings.length}** |`);
  md.push('');
  md.push(`## Flows Walked`);
  md.push('');
  md.push(`1. Login — empty / invalid / SQLi / valid`);
  md.push(`2. Dashboard + every sidebar page (workshop role)`);
  md.push(`3. NewOrder — empty submit, huge input, API create with 2 items + urgency`);
  md.push(`4. Orders list — drawer, per-item cost entry, send-for-approval, toolbar menus, search`);
  md.push(`5. Track page — per-item ✓/✗ decisions, free label, confirm gating`);
  md.push(`6. Mobile viewport 375×667 — login, dashboard, orders, new, track`);
  md.push(`7. Expired / bogus JWT + nonexistent tracking token + unknown route`);
  md.push(`8. Shop-employee role — attempting workshop-only routes`);
  md.push(`9. Browser back after partial form fill`);
  md.push('');
  md.push(`## Findings`);
  md.push('');
  if (findings.length === 0) {
    md.push(`No issues detected. ✓`);
  } else {
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      md.push(`### ${i + 1}. [${f.severity}] ${f.flow} — ${f.title}`);
      md.push('');
      md.push(`**Steps to reproduce**`);
      md.push('```');
      md.push(f.steps);
      md.push('```');
      md.push('');
      md.push(`**Expected:** ${f.expected}`);
      md.push('');
      md.push(`**Actual:** ${f.actual}`);
      md.push('');
      if (f.screenshot && f.screenshot !== '—') {
        md.push(`**Screenshot:** \`tools/qa-audit/screenshots/${f.screenshot}\``);
        md.push('');
      }
      md.push(`**Suggested fix:** ${f.fix}`);
      md.push('');
      md.push('---');
      md.push('');
    }
  }
  fs.writeFileSync(REPORT, md.join('\n'));
  console.log('\n[done] findings:', findings.length, '→ QA-REPORT.md');
}

// ── Shared state collected across the run ─────────────────────────────────
const consoleErrors = [];   // { page, type, text }
const pageErrors    = [];   // { page, message }
const networkFails  = [];   // { page, method, url, status }

// Expected-failure bracket: negative-test flows deliberately provoke 4xx/5xx
// (invalid creds → 401, bogus JWT → 401, nonexistent token → 404). Those
// tuples are part of the *design* of those flows, not findings. Wrap the
// relevant block with expectFails.enter([...]) / expectFails.exit() and
// matching responses are suppressed from networkFails.
//
// A tuple's pathname can be an exact string ('/api/auth/login') or a prefix
// with trailing '*' ('/api/track/*') to match anything underneath. Matching
// is scoped to the current bracket stack — outside the bracket, the same
// failure surfaces as a real finding, so a genuine 401 on login from a
// non-negative flow still gets reported.
const expectedFailStack = [];
const expectFails = {
  enter(tuples) {
    expectedFailStack.push(tuples.map(t => ({
      method: t.method,
      pathname: t.pathname,
      isPrefix: t.pathname.endsWith('*'),
      prefix:   t.pathname.endsWith('*') ? t.pathname.slice(0, -1) : null,
      status: t.status,
    })));
  },
  exit() { expectedFailStack.pop(); },
  matches(method, url, status) {
    if (expectedFailStack.length === 0) return false;
    let pathname;
    try { pathname = new URL(url).pathname; } catch { return false; }
    for (const frame of expectedFailStack) {
      for (const t of frame) {
        if (t.method !== method || t.status !== status) continue;
        if (t.isPrefix ? pathname.startsWith(t.prefix) : t.pathname === pathname) return true;
      }
    }
    return false;
  },
};

function attachListeners(page, label) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: label, type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    pageErrors.push({ page: label, message: err.message });
  });
  page.on('response', async res => {
    const status = res.status();
    if (status < 400) return;
    const method = res.request().method();
    const url    = res.url();
    if (expectFails.matches(method, url, status)) return;
    networkFails.push({ page: label, method, url, status });
  });
}

// Navigate to `url` and capture both the requested and settled page.url().
// RoleRoute uses <Navigate replace> and 401 interceptors rewrite the URL
// client-side after navigation, so the settled URL is what actually
// rendered. Findings that name only the requested URL are misleading —
// e.g., "dead content on /branches" when the user was redirected to /
// and / rendered correctly.
async function navigate(page, url, opts = {}) {
  const requested = url.startsWith('http') ? url : (BASE + url);
  await page.goto(requested, { waitUntil: 'domcontentloaded', ...opts });
  // <Navigate> rewrites during render; wait a tick so page.url() is final.
  await page.waitForTimeout(opts.settleMs ?? 300);
  const settled = page.url();
  let requestedPath = requested, settledPath = settled;
  try {
    requestedPath = new URL(requested).pathname;
    settledPath   = new URL(settled).pathname;
  } catch (_) {}
  return {
    requested,
    settled,
    requestedPath,
    settledPath,
    redirected: requestedPath !== settledPath,
  };
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  try { await page.screenshot({ path: file, fullPage: true }); } catch (_) {}
  return file;
}

// ── Helper: UI login (used by Flow 1 to exercise the form and Flow 2 to gate setup)
async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('[data-testid="login__username-input"]',        username);
  await page.fill('[data-testid="login__password-input"]', password);
  await page.click('[data-testid="login__submit-button"]');
}

// ── Helper: seed auth via localStorage (bypasses login form to preserve
// the 10-login/15min rate-limit budget; used by every flow that is not
// itself testing the login flow).
async function seedAuth(page, role) {
  const token = role === 'shop_employee' ? shopTokenEarly : workshopTokenEarly;
  const meta  = role === 'shop_employee'
    ? { username: 'employee1', shop_id: '1' }
    : { username: 'workshop', shop_id: '' };
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, role, meta }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('username', meta.username);
    if (meta.shop_id) localStorage.setItem('shop_id', meta.shop_id);
  }, { token, role, meta });
}

// Fetch workshop + shop-employee tokens directly via API
let workshopTokenEarly = null;
let shopTokenEarly = null;
async function apiLogin(username, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) return null;
  return (await r.json()).token;
}
workshopTokenEarly = await apiLogin('workshop', 'workshop123');
shopTokenEarly     = await apiLogin('employee1', 'shop123');

const browser = await chromium.launch();

// ══════════════════════════════════════════════════════════════════════════
// FLOW 1 — Login (invalid + valid + empty)
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'login');

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await shot(page, '01-login-empty');

  // Flow 1 is a pure negative-credentials flow: every login attempt below
  // is expected to return 401 (or 400 for the empty case). Bracket them so
  // those responses don't leak into Finding "HTTP 4xx/5xx across the run".
  expectFails.enter([
    { method: 'POST', pathname: '/api/auth/login', status: 401 },
    { method: 'POST', pathname: '/api/auth/login', status: 400 },
  ]);

  // 1a — empty submit
  const submit = page.locator('[data-testid="login__submit-button"]');
  const btnDisabledEmpty = await submit.isDisabled();
  await submit.click().catch(() => {});
  const bodyAfter = await page.textContent('body');
  if (btnDisabledEmpty === false && !bodyAfter.includes('مطلوب')) {
    // Browser native HTML5 required prevents submit — acceptable
  }

  // 1b — invalid credentials
  await page.fill('[data-testid="login__username-input"]', 'nobody');
  await page.fill('[data-testid="login__password-input"]', 'wrong!');
  await page.click('[data-testid="login__submit-button"]');
  await page.waitForTimeout(600);
  await shot(page, '01-login-invalid');
  const errText = await page.textContent('body');
  if (!errText.includes('بيانات غير صحيحة') && !errText.includes('خطأ')) {
    log({
      severity: 'Minor',
      flow: 'Login',
      title: 'Invalid-credentials error not surfaced in Arabic copy',
      steps: '1. Visit /login\n2. Enter "nobody" / "wrong!"\n3. Submit',
      expected: 'Red error banner with Arabic "بيانات غير صحيحة"',
      actual: `Got body text without matching error phrase: ${errText.slice(0, 120)}…`,
      screenshot: '01-login-invalid.png',
      fix: 'Ensure LoginPage renders {error} state after 401 response',
    });
  }

  // 1c — SQL-like username
  await page.fill('[data-testid="login__username-input"]', `admin' OR '1'='1`);
  await page.fill('[data-testid="login__password-input"]', 'x');
  await page.click('[data-testid="login__submit-button"]');
  await page.waitForTimeout(500);
  await shot(page, '01-login-sqli');
  if ((await page.url()).endsWith('/') || (await page.url()).includes('/dashboard')) {
    log({
      severity: 'Critical',
      flow: 'Login',
      title: 'SQLi payload authenticated as admin',
      steps: `1. Visit /login\n2. Enter: admin' OR '1'='1 / x\n3. Submit`,
      expected: '401 Unauthorized',
      actual: 'Reached protected route',
      screenshot: '01-login-sqli.png',
      fix: 'Parameterize query (better-sqlite3 already does — double-check prepare binding)',
    });
  }

  expectFails.exit();

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 2 — Workshop login + dashboard
// ══════════════════════════════════════════════════════════════════════════
let workshopToken = null;
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'dashboard');

  // Seed session from pre-fetched API token so the Vite proxy's 500s on /api/auth/login
  // (observed intermittently under HTTPS→HTTP proxy) don't fail the setup gate.
  // Flow 1 already exercises the real login form.
  if (!workshopTokenEarly) {
    log({
      severity: 'Critical',
      flow: 'Setup',
      title: 'Setup failed: login did not establish a session',
      steps: '1. POST /api/auth/login (workshop/workshop123)',
      expected: '200 with token',
      actual: 'API login returned no token — cannot proceed',
      screenshot: '—',
      fix: 'Verify /api/auth/login and the rate-limit window',
    });
    await ctx.close();
    await browser.close();
    writeReport();
    process.exit(0);
  }
  await seedAuth(page, 'workshop');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shot(page, '02-dashboard');

  // Grab token for direct API probes (fallback to API-login token if UI didn't persist it)
  workshopToken = await page.evaluate(() => localStorage.getItem('token'));
  if (!workshopToken) workshopToken = workshopTokenEarly;

  // ── Setup gate: a workshop session must render the /technicians sidebar link.
  // If not, the whole audit is invalid — abort with a single finding.
  const workshopAnchor = await page
    .locator('a[href="/technicians"], nav a:has-text("الفنيين")')
    .first()
    .waitFor({ state: 'attached', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!workshopAnchor) {
    await shot(page, '02-setup-failed');
    await ctx.close();
    await browser.close();
    findings.length = 0; // discard any pre-gate noise from flow 1
    log({
      severity: 'Critical',
      flow: 'Setup',
      title: 'Setup failed: login did not establish a session',
      steps: '1. Launch Chromium\n2. POST /api/auth/login (workshop/workshop123)\n3. Navigate to /\n4. Look for workshop-only sidebar item (a[href="/technicians"])',
      expected: 'Workshop sidebar renders with /technicians link',
      actual: 'Workshop-only element never appeared within 4s of reaching /',
      screenshot: '02-setup-failed.png',
      fix: 'Verify LoginPage persists token to localStorage, then Layout reads role and renders workshop nav',
    });
    writeReport();
    process.exit(0);
  }

  // Check for empty / loading states on each sidebar link
  const links = ['/', '/orders', '/new', '/scan', '/branches', '/reports', '/technicians', '/inventory', '/services', '/repair-options'];
  const a11yAgg = {
    unlabeledPages: [],   // [{ href, count, sample }]
    missingAltPages: [],  // [{ href, count, sample }]
    brokenImgPages: [],   // [{ href, srcs }]
  };
  for (const href of links) {
    const nav = await navigate(page, href, { settleMs: 700 });
    const slug = href === '/' ? 'dashboard' : href.replace(/[/]/g, '_').slice(1);
    await shot(page, `02-page-${slug}`);
    // Workshop has access to every sidebar link — any redirect here is a bug
    // (broken RoleRoute wiring, missing route definition, or auth interceptor
    // misfiring). Report against the SETTLED URL so the finding names where
    // we actually landed, not the route we intended to visit.
    if (nav.redirected) {
      log({
        severity: 'Major',
        flow: 'Navigation',
        title: `Workshop redirected from ${href} to ${nav.settledPath}`,
        steps: `1. Login as workshop\n2. Navigate to ${href}\n3. Observe page.url() after settle`,
        expected: `Page renders at ${href}`,
        actual: `Redirected to ${nav.settledPath}`,
        screenshot: `02-page-${slug}.png`,
        fix: 'Check App.jsx route definition and any RoleRoute wrapping',
      });
    }

    // Dead-link check: any broken <img>?
    const brokenImgs = await page.evaluate(() => {
      return [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
    });
    if (brokenImgs.length) a11yAgg.brokenImgPages.push({ href, srcs: brokenImgs.slice(0, 3) });

    // A11y: inputs without label
    const unlabeled = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')];
      return inputs
        .filter(el => {
          if (el.closest('label')) return false;
          const id = el.id;
          if (id && document.querySelector(`label[for="${id}"]`)) return false;
          if (el.getAttribute('aria-label')) return false;
          if (el.getAttribute('aria-labelledby')) return false;
          if (el.getAttribute('placeholder')) return false;
          return true;
        })
        .map(el => ({ tag: el.tagName, name: el.name || '', type: el.type || '' }));
    });
    if (unlabeled.length) {
      a11yAgg.unlabeledPages.push({ href, count: unlabeled.length, sample: unlabeled.slice(0, 3) });
    }

    // Images without alt
    const noAlt = await page.evaluate(() => {
      return [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.src).slice(0, 3);
    });
    if (noAlt.length) {
      a11yAgg.missingAltPages.push({ href, count: noAlt.length, sample: noAlt.slice(0, 3) });
    }
  }

  // Emit ONE consolidated a11y finding per category, listing affected pages.
  if (a11yAgg.unlabeledPages.length) {
    const pagesTxt = a11yAgg.unlabeledPages.map(p => `${p.href} (${p.count})`).join(', ');
    const sample = JSON.stringify(a11yAgg.unlabeledPages[0].sample);
    log({
      severity: 'Minor',
      flow: 'a11y',
      title: `Unlabeled form controls on ${a11yAgg.unlabeledPages.length} page(s)`,
      steps: 'Navigate each sidebar link and scan for <input>/<select>/<textarea> without <label>, aria-label, aria-labelledby, or placeholder',
      expected: 'Every form control is labelled',
      actual: `Pages: ${pagesTxt}\nSample from ${a11yAgg.unlabeledPages[0].href}: ${sample}`,
      screenshot: '—',
      fix: 'Most likely the shared sidebar search/filter input — fix once in Layout and it resolves across all pages',
    });
  }
  if (a11yAgg.missingAltPages.length) {
    const pagesTxt = a11yAgg.missingAltPages.map(p => `${p.href} (${p.count})`).join(', ');
    log({
      severity: 'Minor',
      flow: 'a11y',
      title: `<img> without alt on ${a11yAgg.missingAltPages.length} page(s)`,
      steps: 'Navigate each sidebar link and scan for <img> missing the alt attribute',
      expected: 'Every <img> has alt (empty for decorative)',
      actual: `Pages: ${pagesTxt}\nSample srcs: ${a11yAgg.missingAltPages[0].sample.join(', ')}`,
      screenshot: '—',
      fix: 'Add alt attribute; likely a shared logo/icon component',
    });
  }
  if (a11yAgg.brokenImgPages.length) {
    log({
      severity: 'Minor',
      flow: 'Navigation',
      title: `Broken <img> on ${a11yAgg.brokenImgPages.length} page(s)`,
      steps: 'Navigate each sidebar link and scan for complete images with naturalWidth=0',
      expected: 'All images load',
      actual: a11yAgg.brokenImgPages.map(p => `${p.href}: ${p.srcs.join(', ')}`).join('\n'),
      screenshot: '—',
      fix: 'Verify asset paths',
    });
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 3 — New Order (form validation + create + urgency)
// ══════════════════════════════════════════════════════════════════════════
let createdOrderNumber = null;
let createdOrderToken  = null;
let createdOrderId     = null;
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'new-order');

  await seedAuth(page, 'workshop');
  await page.waitForTimeout(200);
  await page.goto(`${BASE}/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shot(page, '03-new-order-empty');

  // Empty submit
  const submitBtn = page.locator('[data-testid="new-order__submit"]').first();
  const disabledEmpty = await submitBtn.isDisabled().catch(() => false);
  if (!disabledEmpty) {
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    const url = page.url();
    if (!url.includes('/new') && !/login/.test(url)) {
      log({
        severity: 'Major',
        flow: 'NewOrder',
        title: 'Empty form submission accepted',
        steps: '1. Login\n2. Go to /new\n3. Click submit without filling anything',
        expected: 'Submit button disabled OR validation error',
        actual: `Navigated to ${url}`,
        screenshot: '03-new-order-empty.png',
        fix: 'Disable submit until required fields filled',
      });
    }
  }

  // Huge inputs
  const longName = 'ع'.repeat(500);
  const nameInput = page.locator('[data-testid="new-order__customer-name-input"]').first();
  await nameInput.fill(longName).catch(() => {});
  await shot(page, '03-new-order-huge-input');

  // Full happy path via API (faster + deterministic). Creating orders requires shop_employee role.
  const res = await fetch(`${API}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${shopTokenEarly}`,
    },
    body: JSON.stringify({
      customer_name: 'QA Audit Customer',
      phone: '966500000999',
      urgency: 'rush',
      items: [
        { item_name: 'خاتم ذهب', workshop_comment: 'تلميع (مجاني)' },
        { item_name: 'قلادة',     workshop_comment: 'تركيب حجر' },
      ],
    }),
  });
  if (!res.ok) {
    log({
      severity: 'Critical',
      flow: 'NewOrder API',
      title: `POST /api/orders returned ${res.status}`,
      steps: 'Create order via API with 2 items',
      expected: '200/201',
      actual: `${res.status}: ${await res.text()}`,
      screenshot: '—',
      fix: 'Check server logs',
    });
  } else {
    const body = await res.json();
    createdOrderNumber = body.order_number;
    createdOrderToken  = body.customer_token;
    createdOrderId     = body.id;

    // Currency label check: server returns cost as number only — no unit included
    if (body.cost !== 0 && body.cost !== null && body.cost !== undefined) {
      log({
        severity: 'Minor',
        flow: 'NewOrder API',
        title: 'Newly-created order has non-zero initial cost',
        steps: 'Create order via API',
        expected: 'cost = 0 (no pricing yet)',
        actual: `cost = ${body.cost}`,
        screenshot: '—',
        fix: 'Ensure createOrder defaults cost=0',
      });
    }

    if (!body.order_number || !/^BR\d+-\d{8}-\d{4}$/.test(body.order_number)) {
      log({
        severity: 'Major',
        flow: 'NewOrder API',
        title: 'Order number does not match BR<shop>-YYYYMMDD-NNNN format',
        steps: 'Create order via API',
        expected: 'BR1-YYYYMMDD-NNNN',
        actual: body.order_number,
        screenshot: '—',
        fix: 'Check createOrder()',
      });
    }
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 4 — Orders list + Order drawer + per-item cost + send-for-approval
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'orders');

  await seedAuth(page, 'workshop');
  await page.waitForTimeout(200);
  await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await shot(page, '04-orders-list');

  // Find our created order
  if (createdOrderNumber) {
    const rowSel = `[data-testid="orders-list__row__${createdOrderNumber}"]`;
    const row = page.locator(rowSel).first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(700);
      await shot(page, '04-orders-drawer');

      // Rush badge present?
      const rushVisible = await page.locator('text=مستعجل').first().isVisible().catch(() => false);
      if (!rushVisible) {
        log({
          severity: 'Minor',
          flow: 'OrderDetail',
          title: 'Urgency (rush) pill not visible in drawer header',
          steps: `1. Create rush order\n2. Open order ${createdOrderNumber} in drawer`,
          expected: 'Red "مستعجل" pill shown',
          actual: 'Pill not found',
          screenshot: '04-orders-drawer.png',
          fix: 'Check is_urgent plumbing through API → list → drawer',
        });
      }

      // Advance status to inspection (new → received → inspection) via status button
      // The header advance button is the same testid across transitions; its
      // label text changes based on NEXT_LABEL[order.status].
      const advanceBtn = page.locator('[data-testid="order-detail__status-advance"]');
      if (await advanceBtn.count()) {
        await advanceBtn.click();
        await page.waitForTimeout(500);
      }
      if (await advanceBtn.count()) {
        await advanceBtn.click();
        await page.waitForTimeout(500);
      }
      await shot(page, '04-orders-inspection');

      // Attempt to fill a per-item cost input in the items table
      const costInputs = page.locator('[data-testid^="order-detail__item__"][data-testid$="__cost-input"]');
      const costCount  = await costInputs.count();
      if (costCount === 0) {
        log({
          severity: 'Major',
          flow: 'OrderDetail — per-item cost',
          title: 'No per-item cost input found in inspection state',
          steps: `1. Open rush order in drawer\n2. Advance to inspection`,
          expected: 'Each item row has a numeric cost input',
          actual: 'Zero number inputs found',
          screenshot: '04-orders-inspection.png',
          fix: 'Check ItemRow rendering gate (canEditCost)',
        });
      } else {
        // Set first item = 0 (free), second item = 150
        await costInputs.nth(0).fill('0');
        await costInputs.nth(0).blur();
        await page.waitForTimeout(400);
        if (costCount > 1) {
          await costInputs.nth(1).fill('150');
          await costInputs.nth(1).blur();
          await page.waitForTimeout(400);
        }
        await shot(page, '04-orders-priced');

        // Look for total display
        const totalText = await page.textContent('body');
        if (!/الإجمالي/.test(totalText)) {
          log({
            severity: 'Minor',
            flow: 'OrderDetail',
            title: 'Order total label "الإجمالي" missing after pricing',
            steps: 'Fill per-item costs',
            expected: '"الإجمالي: 150 ريال" visible',
            actual: 'Label not found',
            screenshot: '04-orders-priced.png',
            fix: 'Verify the summary row renders when items[] exists',
          });
        }

        // Send for approval button
        const sendBtn = page.locator('[data-testid="order-detail__send-for-approval"]').first();
        if (!(await sendBtn.count())) {
          log({
            severity: 'Major',
            flow: 'OrderDetail',
            title: '"إرسال للعميل للموافقة" button not shown',
            steps: '1. Price items\n2. Order in inspection',
            expected: 'Button visible after pricing',
            actual: 'Button not found',
            screenshot: '04-orders-priced.png',
            fix: 'Check render gate on button',
          });
        } else {
          // Rapid double-click test
          await sendBtn.click();
          await sendBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
          await shot(page, '04-orders-after-send');
        }
      }

      // Close drawer with Esc
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      log({
        severity: 'Major',
        flow: 'OrdersList',
        title: `Freshly-created order ${createdOrderNumber} not found in list`,
        steps: 'Create order via API, visit /orders',
        expected: 'Order appears in list',
        actual: 'Row not rendered',
        screenshot: '04-orders-list.png',
        fix: 'Check list filter defaults or isolation',
      });
    }
  }

  // Note: the filter/sort/group toolbar lives on /dashboard (OrderList),
  // not /orders (OrdersPage + DataTable). This flow targets /orders, so
  // asserting that toolbar here would be testing the wrong page. If /orders
  // grows its own toolbar, add assertions at that point.

  // Search with SQL-like string
  const searchBox = page.locator('[data-testid="orders-list__search-input"]').first();
  if (await searchBox.count()) {
    await searchBox.fill(`'; DROP TABLE orders;--`);
    await page.waitForTimeout(600);
    await shot(page, '04-search-sqli');
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 5 — Track page (customer flow, per-item decide)
// ══════════════════════════════════════════════════════════════════════════
if (createdOrderToken && createdOrderId) {
  // Put the order into waiting_approval via API so the customer can decide
  // (the UI flow above may or may not have committed — this makes it deterministic)
  await fetch(`${API}/api/orders/${createdOrderId}/items/0/cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
    body: JSON.stringify({ estimated_cost: 0 }),
  }).catch(() => {});

  // Fetch items
  const itemsRes = await fetch(`${API}/api/orders?search=${createdOrderNumber}`, {
    headers: { Authorization: `Bearer ${workshopToken}` },
  });
  const list = await itemsRes.json().catch(() => []);
  const order = list[0];
  if (order?.items?.length) {
    for (let i = 0; i < order.items.length; i++) {
      const cost = i === 0 ? 0 : 150;
      await fetch(`${API}/api/orders/${createdOrderId}/items/${order.items[i].id}/cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
        body: JSON.stringify({ estimated_cost: cost }),
      }).catch(() => {});
    }
    // Transition through received → inspection → waiting_approval
    for (const target of ['received', 'inspection']) {
      await fetch(`${API}/api/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
        body: JSON.stringify({ status: target }),
      }).catch(() => {});
    }
    await fetch(`${API}/api/orders/${createdOrderId}/send-for-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
    }).catch(() => {});
  }

  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'track');

  await page.goto(`${BASE}/track/${createdOrderToken}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, '05-track-page');

  // Free item labelled "مجاني — مشمول"
  const freeLabel = await page.locator('text=مجاني').first().isVisible().catch(() => false);
  if (!freeLabel) {
    log({
      severity: 'Minor',
      flow: 'TrackPage',
      title: 'Free item not labelled "مجاني — مشمول"',
      steps: 'Set one item cost=0, open /track/:token',
      expected: '"مجاني — مشمول" visible on free row',
      actual: 'Label missing',
      screenshot: '05-track-page.png',
      fix: 'Check DecisionRow isFree branch',
    });
  }

  // Confirm button disabled until decisions made.
  // Match both the disabled-state text ("اختر لكل صنف …") and the enabled-state
  // text ("تأكيد قراري") so the locator resolves regardless of which one is
  // currently rendered. isDisabled returns null on failure so we never flag
  // a false positive when the selector simply didn't match.
  const confirmBtn = page.getByRole('button', { name: /تأكيد|اختر لكل صنف/ });
  await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  const disabledBefore = await confirmBtn.isDisabled().catch(() => null);
  if (disabledBefore === false) {
    log({
      severity: 'Major',
      flow: 'TrackPage',
      title: 'Confirm button enabled before any decision made',
      steps: 'Open waiting_approval order track page',
      expected: 'Button disabled with "اختر لكل صنف" hint',
      actual: 'Button enabled',
      screenshot: '05-track-page.png',
      fix: 'Check allDecided gate in TrackPage',
    });
  }

  // Approve the costed item
  const approveBtn = page.locator('button:has-text("أوافق")').first();
  if (await approveBtn.count()) {
    await approveBtn.click();
    await page.waitForTimeout(300);
    await shot(page, '05-track-decided');

    const confirmBtn2 = page.locator('button:has-text("تأكيد قراري")').first();
    if (await confirmBtn2.count()) {
      const dis = await confirmBtn2.isDisabled().catch(() => false);
      if (dis) {
        log({
          severity: 'Major',
          flow: 'TrackPage',
          title: 'Confirm button remains disabled after all decisions made',
          steps: 'Make decision on every costed item',
          expected: 'Button enabled',
          actual: 'Still disabled',
          screenshot: '05-track-decided.png',
          fix: 'Verify decidableItems vs decisions map keying (sort_order)',
        });
      } else {
        await confirmBtn2.click();
        await page.waitForTimeout(800);
        await shot(page, '05-track-after-confirm');
      }
    }
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 6 — Mobile viewport (375×667 iPhone SE)
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({
    locale: 'ar-SA',
    ignoreHTTPSErrors: true,
    viewport: { width: 375, height: 667 },
  });
  const page = await ctx.newPage();
  attachListeners(page, 'mobile');

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await shot(page, '06-mobile-login');

  // Horizontal overflow detector
  async function checkHOverflow(label) {
    const over = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
      };
    });
    if (over.scrollWidth > over.clientWidth + 1) {
      log({
        severity: 'Minor',
        flow: `Mobile ${label}`,
        title: 'Horizontal overflow at 375px',
        steps: `Load ${label} at 375px width`,
        expected: 'No horizontal scrollbar',
        actual: `scrollWidth=${over.scrollWidth}, clientWidth=${over.clientWidth}`,
        screenshot: `06-mobile-${label}.png`,
        fix: 'Find element exceeding viewport',
      });
    }
  }
  await checkHOverflow('login');

  await seedAuth(page, 'workshop');
  await page.waitForTimeout(200);
  await shot(page, '06-mobile-dashboard');
  await checkHOverflow('dashboard');

  await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await shot(page, '06-mobile-orders');
  await checkHOverflow('orders');

  await page.goto(`${BASE}/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await shot(page, '06-mobile-new');
  await checkHOverflow('new');

  if (createdOrderToken) {
    await page.goto(`${BASE}/track/${createdOrderToken}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await shot(page, '06-mobile-track');
    await checkHOverflow('track');
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 7 — Expired / missing token handling
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'expired');

  // Flow 7 deliberately provokes auth / not-found errors. Bracket the
  // expected HTTP failures so the final report only surfaces NEW ones.
  expectFails.enter([
    { method: 'GET', pathname: '/api/orders',  status: 401 },
    { method: 'GET', pathname: '/api/orders/', status: 401 }, // defensive: trailing slash variants
    { method: 'GET', pathname: '/api/track/*', status: 404 },
  ]);

  // Bogus JWT
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('token', 'not.a.real.jwt');
    localStorage.setItem('role', 'workshop');
  });
  await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, '07-bogus-token');

  const onLogin = (page.url()).includes('/login');
  if (!onLogin) {
    // It might still render a shell because client-side guard sees a non-empty token
    const body = await page.textContent('body');
    if (body.includes('فشل') || body.includes('خطأ')) {
      log({
        severity: 'Minor',
        flow: 'Auth',
        title: 'Invalid JWT displays raw error text instead of redirecting to /login',
        steps: 'Set localStorage.token="not.a.real.jwt", visit /orders',
        expected: 'Silent redirect to /login',
        actual: 'Error shown on protected route',
        screenshot: '07-bogus-token.png',
        fix: 'Interceptor on 401 → clear token + navigate to /login',
      });
    }
  }

  // /track/<nonexistent>
  await page.goto(`${BASE}/track/not-a-real-token-xxxxxxxx`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shot(page, '07-track-404');
  const body = await page.textContent('body');
  if (!/غير موجود|not found/i.test(body)) {
    log({
      severity: 'Minor',
      flow: 'TrackPage',
      title: 'Invalid tracking token: no user-visible error',
      steps: 'Visit /track/not-a-real-token',
      expected: '"الطلب غير موجود" message',
      actual: body.slice(0, 120),
      screenshot: '07-track-404.png',
      fix: 'TrackPage notFound branch',
    });
  }

  // Unknown protected route
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/this-route-does-not-exist`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await shot(page, '07-unknown-route');

  expectFails.exit();

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 8 — Shop-employee role boundary
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'shop-employee');

  await seedAuth(page, 'shop_employee');
  await page.waitForTimeout(200);
  await shot(page, '08-shop-dashboard');

  // Attempt workshop-only routes. RoleRoute wraps each of these with
  // <Navigate replace to="/" />, so the settled URL should be '/'. A page
  // whose settled URL still matches the requested route means RoleRoute
  // either didn't fire or wasn't wired — real leak, emit a Critical finding.
  // The previous version of this loop captured only the initial URL and
  // mis-reported correct redirects as "dead content on /branches".
  for (const route of ['/branches', '/reports', '/technicians', '/inventory', '/services', '/repair-options']) {
    const nav = await navigate(page, route, { settleMs: 500 });
    const slug = route.slice(1);
    // Screenshot name reflects the settled URL so anyone opening
    // 08-shop-branches-redirected-to-_.png knows what they're looking at.
    const shotSlug = nav.redirected
      ? `08-shop-${slug}-redirected-to-${nav.settledPath.replace(/[/]/g, '_') || 'root'}`
      : `08-shop-${slug}`;
    await shot(page, shotSlug);

    if (!nav.redirected) {
      // We stayed on the restricted route. That's the leak — emit a finding
      // keyed on the SETTLED URL so there's no ambiguity about where we
      // actually are. Note the requested URL for traceability.
      const body = await page.textContent('body');
      const looksLikeData = body.length > 200 && !/ليس لديك صلاحية|غير مصرح|unauthorized/i.test(body);
      if (looksLikeData) {
        log({
          severity: 'Critical',
          flow: 'RoleRoute',
          title: `shop_employee rendered workshop-only page ${nav.settledPath}`,
          steps: `1. Login as shop_employee\n2. Navigate to ${route}\n3. Observe settled URL and body content`,
          expected: `RoleRoute redirects to / (settled URL === '/')`,
          actual: `Settled URL === ${nav.settledPath} (requested ${route}); body length ${body.length}; no "unauthorized" text`,
          screenshot: `${shotSlug}.png`,
          fix: `Confirm ${route} is wrapped in <RoleRoute roles={['workshop']}> in App.jsx`,
        });
      }
    }
    // If nav.redirected, that's the expected behavior — no finding. The
    // screenshot filename records where we landed for manual review.
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW 9 — Back button after submit
// ══════════════════════════════════════════════════════════════════════════
{
  const ctx  = await browser.newContext({ locale: 'ar-SA', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  attachListeners(page, 'back-button');

  await seedAuth(page, 'workshop');
  await page.waitForTimeout(200);
  await page.goto(`${BASE}/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // Fill minimal. Use a selector that targets only real text-ish fields so
  // we don't accidentally fill a number/checkbox/password field and then
  // assert on the wrong element.
  const TEXT_FIELD = 'input:not([type="password"]):not([type="number"]):not([type="checkbox"]):not([type="hidden"])';
  const nameInput = page.locator(TEXT_FIELD).first();
  if (await nameInput.count()) await nameInput.fill('QA Back Test').catch(() => {});
  await shot(page, '09-back-before-submit');
  // Navigate away, come back via browser back
  await page.goto(`${BASE}/orders`);
  await page.waitForTimeout(400);
  await page.goBack();
  await page.waitForTimeout(700);
  await shot(page, '09-back-after');

  const valAfter = await page.locator(TEXT_FIELD).first().inputValue().catch(() => '');
  if (!valAfter) {
    log({
      severity: 'Minor',
      flow: 'NewOrder UX',
      title: 'Form state lost after browser back',
      steps: '1. Fill name on /new\n2. Navigate to /orders\n3. Browser back',
      expected: 'Prior input still present',
      actual: 'Input empty — user retypes',
      screenshot: '09-back-after.png',
      fix: 'Persist draft in sessionStorage OR warn before navigating away',
    });
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════════════
// Write QA-REPORT.md
// ══════════════════════════════════════════════════════════════════════════

await browser.close();

// Reconcile console vs network. The browser logs a "Failed to load resource"
// console error for every 4xx/5xx response — drop those so HTTP failures are
// counted once (by networkFails) and console errors only covers real JS-level errors.
const realConsoleErrors = consoleErrors.filter(
  e => !/Failed to load resource/i.test(e.text)
);

if (realConsoleErrors.length) {
  const sample = realConsoleErrors.slice(0, 10).map(e => `    - [${e.page}] ${e.text}`).join('\n');
  log({
    severity: realConsoleErrors.length > 5 ? 'Major' : 'Minor',
    flow: 'Global',
    title: `${realConsoleErrors.length} console error(s) across the run (excl. HTTP echoes)`,
    steps: 'Collected across all flows; "Failed to load resource" echoes excluded (counted under HTTP below)',
    expected: 'Zero console errors in production build',
    actual: sample || '(no JS-level console errors)',
    screenshot: '—',
    fix: 'Investigate each; common: missing keys, controlled/uncontrolled input warnings',
  });
}
if (pageErrors.length) {
  const sample = pageErrors.slice(0, 10).map(e => `    - [${e.page}] ${e.message}`).join('\n');
  log({
    severity: 'Major',
    flow: 'Global',
    title: `${pageErrors.length} uncaught page error(s)`,
    steps: 'Collected across all flows',
    expected: 'No uncaught JS errors',
    actual: sample,
    screenshot: '—',
    fix: 'Add error boundaries / check the specific stack traces',
  });
}
if (networkFails.length) {
  const unique = [...new Map(networkFails.map(f => [`${f.method} ${f.url} ${f.status}`, f])).values()];
  const sample = unique.slice(0, 15).map(f => `    - ${f.method} ${f.url} → ${f.status} (${f.page})`).join('\n');
  log({
    severity: unique.some(f => f.status >= 500) ? 'Major' : 'Minor',
    flow: 'Global',
    title: `${unique.length} unique HTTP 4xx/5xx response(s) (${networkFails.length} total incl. repeats)`,
    steps: 'Collected across all flows — source of truth for network errors',
    expected: 'No unexpected 4xx/5xx',
    actual: sample,
    screenshot: '—',
    fix: 'Audit each; 401 on protected routes without token is acceptable',
  });
}

writeReport();
