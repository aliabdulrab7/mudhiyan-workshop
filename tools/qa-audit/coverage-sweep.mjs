// Coverage sweep — enumerate interactive elements per route per role, click
// each unique one (deduped by label), record observable effect.
// Output: docs/QA-COVERAGE.md (relative to repo root)
//
// Classification:
//   works    — produced navigation, XHR, modal/drawer, or other DOM change
//   dead     — no observable effect
//   errors   — console.error, pageerror, or 5xx response
//   unclear  — skipped (destructive / form submit / needs context)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO_ROOT, 'docs', 'QA-COVERAGE.md');

const BASE = 'https://localhost:5173';
const API  = 'http://localhost:3737';

// ── Preconditions (per CLAUDE.md QA Ground Rules) ─────────────────────────────

async function apiLogin(u, p) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  });
  if (!r.ok) return null;
  return (await r.json()).token;
}

const workshopToken = await apiLogin('workshop', 'workshop123');
const shopToken     = await apiLogin('employee1', 'shop123');
if (!workshopToken || !shopToken) {
  console.error('[abort] precondition: login failed for seeded credentials');
  process.exit(1);
}

// Seed a known order for /track sweep (fresh each run)
const createRes = await fetch(`${API}/api/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${shopToken}`,
  },
  body: JSON.stringify({
    customer_name: 'QA Coverage Sweep',
    phone: '966500111222',
    urgency: 'normal',
    items: [
      { item_name: 'خاتم', workshop_comment: 'تلميع' },
      { item_name: 'حلق',  workshop_comment: 'تركيب حجر' },
    ],
  }),
});
const createdOrder = createRes.ok ? await createRes.json() : null;
if (!createdOrder) {
  console.error('[abort] precondition: could not seed order for /track sweep');
  process.exit(1);
}
// Drive it to waiting_approval so /track buttons exist
async function wPatch(path, body) {
  return fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
    body: JSON.stringify(body),
  });
}
async function wPost(path, body) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workshopToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}
await wPatch(`/api/orders/${createdOrder.id}/status`, { status: 'received' });
await wPatch(`/api/orders/${createdOrder.id}/status`, { status: 'inspection' });
for (let i = 0; i < createdOrder.items.length; i++) {
  await wPost(`/api/orders/${createdOrder.id}/items/${createdOrder.items[i].id}/cost`, {
    estimated_cost: i === 0 ? 0 : 150,
  });
}
await wPost(`/api/orders/${createdOrder.id}/send-for-approval`);

// ── Sweep infrastructure ──────────────────────────────────────────────────────

const rows = []; // { role, route, label, kind, result, status, notes }

// Elements we refuse to click — would break the session or destroy data
const DESTRUCTIVE = /تسجيل الخروج|خروج|حذف|delete|logout|log out/i;
// Submit-style buttons we skip during sweep (they're workflow-specific)
const FORM_SUBMIT = /حفظ|إنشاء|إرسال|submit|تأكيد قراري|تأكيد الدفع/i;

function labelOf(el, handle) {
  return handle.evaluate(n => {
    const aria = n.getAttribute('aria-label');
    const txt  = (n.innerText || n.textContent || '').trim();
    const title = n.getAttribute('title');
    return (aria || txt || title || `<${n.tagName.toLowerCase()}>`).replace(/\s+/g, ' ').slice(0, 60);
  });
}

async function seedAuth(ctx, role) {
  const token = role === 'shop_employee' ? shopToken : workshopToken;
  const meta = role === 'shop_employee'
    ? { username: 'employee1', shop_id: '1' }
    : { username: 'workshop', shop_id: '' };
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ t, r, m }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', r);
    localStorage.setItem('username', m.username);
    if (m.shop_id) localStorage.setItem('shop_id', m.shop_id);
  }, { t: token, r: role, m: meta });
  await page.close();
}

// Enumerate interactive element descriptors (NOT handles — handles go stale
// after the first click/nav). Each descriptor re-locates its element just
// before clicking.
async function enumerate(page) {
  const raw = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(
      'button, a[href], [role="button"], [role="menuitem"], input[type="submit"]'
    )];
    const seen = new Set();
    const out = [];
    for (const n of nodes) {
      const rect = n.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = window.getComputedStyle(n);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const aria = n.getAttribute('aria-label');
      const text = (n.innerText || n.textContent || '').trim();
      const title = n.getAttribute('title');
      const label = (aria || text || title || `<${n.tagName.toLowerCase()}>`).replace(/\s+/g, ' ').slice(0, 60);
      const tag = n.tagName.toLowerCase();
      const href = n.getAttribute('href');
      const enabled = !n.disabled && n.getAttribute('aria-disabled') !== 'true';
      const key = `${tag}|${label}|${href || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tag, label, href, enabled });
    }
    return out;
  });
  return raw;
}

// Re-locate an element by its descriptor. Returns a Playwright Locator.
function locatorFor(page, desc) {
  if (desc.href) {
    return page.locator(`${desc.tag}[href="${desc.href}"]`).first();
  }
  // Match by exact label text. Handles icon-prefixed buttons because the
  // label was captured from innerText/textContent already.
  return page.locator(desc.tag).filter({ hasText: desc.label }).first();
}

// Try clicking an element and classify the effect.
// `desc` is a serializable descriptor from enumerate(). We re-locate just
// before clicking so stale handles aren't an issue.
async function classifyClick(page, route, desc) {
  if (!desc.enabled) {
    return { status: 'unclear', result: 'disabled' };
  }
  if (DESTRUCTIVE.test(desc.label)) {
    return { status: 'unclear', result: 'destructive — not clicked' };
  }
  if (FORM_SUBMIT.test(desc.label)) {
    return { status: 'unclear', result: 'form-submit — skipped (needs filled form)' };
  }
  if (desc.tag === 'a' && desc.href && !desc.href.startsWith('/') && !desc.href.includes('localhost')) {
    return { status: 'works', result: `external link → ${desc.href}` };
  }

  const locator = locatorFor(page, desc);
  const found = await locator.count().catch(() => 0);
  if (found === 0) {
    return { status: 'unclear', result: 'element vanished before click' };
  }

  const beforeUrl = page.url();
  const beforeDom = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
  const xhrCalls = [];
  const pageErrs = [];
  const consoleErrs = [];
  const onResp = r => {
    const rt = r.request().resourceType();
    if (rt === 'xhr' || rt === 'fetch') {
      xhrCalls.push({ url: r.url(), status: r.status(), method: r.request().method() });
    }
  };
  const onPErr = e => pageErrs.push(e.message);
  const onCon = m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrs.push(m.text()); };
  page.on('response', onResp);
  page.on('pageerror', onPErr);
  page.on('console', onCon);

  let clickErr = null;
  try {
    await locator.click({ timeout: 1500 });
  } catch (e) {
    clickErr = e.message.split('\n')[0];
  }
  await page.waitForTimeout(400);

  const afterUrl = page.url();
  const afterDom = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);

  page.off('response', onResp);
  page.off('pageerror', onPErr);
  page.off('console', onCon);

  // Restore route so the next element on this route is still findable
  if (afterUrl !== beforeUrl && new URL(afterUrl).pathname !== route) {
    try { await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' }); } catch (_) {}
    await page.waitForTimeout(300);
  } else {
    // Close any menu/modal before next click
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }

  const has5xx = xhrCalls.some(c => c.status >= 500);
  if (pageErrs.length || consoleErrs.length || has5xx) {
    return {
      status: 'errors',
      result: has5xx
        ? `XHR 5xx: ${xhrCalls.filter(c => c.status >= 500)[0].url.replace(BASE, '').replace(API, '')}`
        : (pageErrs[0] || consoleErrs[0]).slice(0, 70),
    };
  }
  if (clickErr) {
    return { status: 'unclear', result: `click failed: ${clickErr.slice(0, 60)}` };
  }
  const nav = afterUrl !== beforeUrl;
  const xhr = xhrCalls.length > 0;
  const domDelta = Math.abs(afterDom - beforeDom);
  const dom = domDelta > 20;  // ignore minor whitespace jitter
  if (nav) return { status: 'works', result: `navigated → ${new URL(afterUrl).pathname}` };
  if (xhr) {
    const c = xhrCalls[0];
    return { status: 'works', result: `XHR ${c.method} ${new URL(c.url).pathname} → ${c.status}` };
  }
  if (dom) return { status: 'works', result: `DOM Δ ${domDelta}B` };
  return { status: 'dead', result: 'no observable effect' };
}

async function sweepRoute(ctx, role, route) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(3000);
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800); // let initial XHRs settle
  } catch (e) {
    rows.push({ role, route, label: '(page load)', kind: 'page', result: `goto failed: ${e.message}`, status: 'errors' });
    await page.close();
    return;
  }
  const elts = await enumerate(page);
  if (elts.length === 0) {
    rows.push({ role, route, label: '(no interactive elements)', kind: '-', result: '-', status: 'dead' });
  }
  for (const desc of elts) {
    const cls = await classifyClick(page, route, desc);
    rows.push({
      role, route,
      label: desc.label,
      kind: desc.tag + (desc.href ? ` href=${desc.href.slice(0, 40)}` : ''),
      result: cls.result,
      status: cls.status,
    });
  }
  await page.close();
}

// ── Route plan ────────────────────────────────────────────────────────────────

const WORKSHOP_ROUTES = [
  '/', '/new', '/scan', '/orders',
  '/branches', '/reports', '/technicians',
  '/inventory', '/services', '/repair-options',
];
const EMPLOYEE_ROUTES = [
  '/', '/new', '/scan', '/orders',
  // Workshop-only routes deliberately included to verify RoleRoute blocks them.
  '/branches', '/reports', '/technicians',
  '/inventory', '/services', '/repair-options',
];

// ── Run ───────────────────────────────────────────────────────────────────────

const browser = await chromium.launch();

// Public: /login
{
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'ar-SA' });
  await sweepRoute(ctx, 'public', '/login');
  await ctx.close();
}

// Public: /track/:token (customer view, valid token)
{
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'ar-SA' });
  await sweepRoute(ctx, 'public', `/track/${createdOrder.customer_token}`);
  await ctx.close();
}

// Workshop routes
{
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'ar-SA' });
  await seedAuth(ctx, 'workshop');
  for (const r of WORKSHOP_ROUTES) {
    await sweepRoute(ctx, 'workshop', r);
  }
  await ctx.close();
}

// Shop employee routes
{
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'ar-SA' });
  await seedAuth(ctx, 'shop_employee');
  for (const r of EMPLOYEE_ROUTES) {
    await sweepRoute(ctx, 'shop_employee', r);
  }
  await ctx.close();
}

await browser.close();

// ── Emit report ───────────────────────────────────────────────────────────────

function escape(s) { return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

const byRoute = new Map();
for (const r of rows) {
  const key = `${r.role} :: ${r.route}`;
  if (!byRoute.has(key)) byRoute.set(key, []);
  byRoute.get(key).push(r);
}

const md = [];
md.push(`# QA Coverage Sweep`);
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push(`Harness: Playwright Chromium headless, ignoreHTTPSErrors`);
md.push(`Strategy: click every unique interactive element once (deduped by label+tag+href). Classify by observable effect: navigation, XHR, DOM delta, console/page error.`);
md.push('');
md.push(`## Legend`);
md.push(`- **works** — produced navigation, XHR, or DOM change`);
md.push(`- **dead** — no observable effect`);
md.push(`- **errors** — console.error, pageerror, or 5xx XHR`);
md.push(`- **unclear** — skipped (destructive, form-submit needing context, disabled, or click timed out)`);
md.push('');

// Summary table
const counts = { works: 0, dead: 0, errors: 0, unclear: 0 };
for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
md.push(`## Summary`);
md.push(`| Status | Count |`);
md.push(`|---|---|`);
for (const k of ['works', 'dead', 'errors', 'unclear']) md.push(`| ${k} | ${counts[k] || 0} |`);
md.push(`| **Total** | **${rows.length}** |`);
md.push('');

// Notable dead — filter out sidebar self-nav (link href matches current route,
// which is expected no-op, not a real bug).
const notableDead = rows.filter(r => {
  if (r.status !== 'dead') return false;
  const isSelfNav = r.kind.startsWith('a ') && r.kind.includes(`href=${r.route}`);
  return !isSelfNav;
});
// Dedupe by label — same button on multiple routes is one item of interest
const deadByLabel = new Map();
for (const r of notableDead) {
  if (!deadByLabel.has(r.label)) deadByLabel.set(r.label, []);
  deadByLabel.get(r.label).push(`${r.role} ${r.route}`);
}

md.push(`## Notable dead elements (excluding sidebar self-nav)`);
md.push('');
if (deadByLabel.size === 0) {
  md.push('_None — every non-self-nav element produced an observable effect._');
} else {
  md.push(`| Element | Seen on | Count |`);
  md.push(`|---|---|---|`);
  for (const [label, places] of [...deadByLabel.entries()].sort((a, b) => b[1].length - a[1].length)) {
    md.push(`| ${escape(label)} | ${escape(places.slice(0, 3).join('; ') + (places.length > 3 ? `; +${places.length - 3} more` : ''))} | ${places.length} |`);
  }
}
md.push('');
md.push(`_Caveat: the "dead" classifier requires >20B DOM delta or a fetch/navigation. Buttons whose only effect is a small state flag (e.g., toggling \`aria-pressed\`) may register as dead — false negatives are possible here. Step 2 deep-checks will verify these case-by-case._`);
md.push('');

// Per-route tables
for (const [key, list] of byRoute) {
  md.push(`## ${key}`);
  md.push('');
  md.push(`| Element | Kind | Action on Click | Result | Status |`);
  md.push(`|---|---|---|---|---|`);
  for (const r of list) {
    md.push(`| ${escape(r.label)} | ${escape(r.kind)} | (click) | ${escape(r.result)} | ${r.status} |`);
  }
  md.push('');
}

fs.writeFileSync(OUT, md.join('\n'));
console.log(`[done] ${rows.length} elements swept; summary:`, counts);
