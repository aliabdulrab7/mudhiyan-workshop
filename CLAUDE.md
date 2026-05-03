# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both server + client (from root)
npm run dev

# Server only (port 3737, --watch)
npm run dev --prefix server

# Client only (port 5173, exposed on LAN)
npm run dev --prefix client

# Build client for production
npm run build

# Server tests (Jest + supertest, in-memory SQLite)
npm test --prefix server

# Run a single test file
npm test --prefix server -- tests/orders.test.js

# Commit everything with a timestamped message and push
npm run ship          # wraps ship.sh

# Install all dependencies (root + server + client)
npm install && npm install --prefix server && npm install --prefix client
```

A `post-commit` hook at `.git/hooks/post-commit` auto-pushes every commit to `origin/master`. It's safe during `rebase`/`merge`/`cherry-pick` (it skips). Don't skip hooks (`--no-verify`) unless you have a specific reason.

## Architecture

Monorepo: `server/` (Express 5 + better-sqlite3) + `client/` (React 19 + Vite). Vite proxies `/api/*` to `http://localhost:3737`. UI is Arabic RTL (`dir="rtl"`).

### Authentication

JWT bearer tokens with role-based access. Two roles:

- `workshop` — repair technicians + admins. Global view across all shops.
- `shop_employee` — scoped to a single `shop_id`. All queries filter by `req.user.shop_id`.

`server/middleware/auth.js` exports `requireAuth` and `requireRole('workshop' | ['workshop','shop_employee'])`. In production, the server refuses to start if `JWT_SECRET` is unset or still `dev-secret-change-in-production` (see `index.js`).

### Server layering

**Routes → Service → DB.** Status transitions must go through `OrderService.transition()` — it's the single source of truth for which status changes are allowed and what side-effects they trigger. Do **not** mutate `orders.status` from a route or direct SQL.

- `server/services/OrderService.js` — state machine. The `TRANSITIONS` object is the registry of legal next-states; `validateBusinessRules()` enforces domain invariants (payment required, lock after delivery, etc.). Transition writes are atomic: re-read order, write audit log, UPDATE status, set `locked_at` if delivered — all in one `db.transaction`.
- `server/services/NotificationService.js` — WhatsApp/track-link side-effects. Registered into `OrderService` via `registerNotificationHook` in `app.js` so services don't import each other directly.
- `server/errors/index.js` — domain error classes (`InvalidTransitionError`, `PaymentRequiredError`, `OrderLockedError`, `PermissionError`, …). `errorToHttpStatus(err)` maps them to HTTP codes, used by the global error middleware at the end of `app.js`.
- `server/db.js` — SQLite init (`WAL` mode), schema-create-if-not-exists, additive column migrations (`ALTER TABLE ... ADD COLUMN` guarded by `columnExists()`). Exports `createOrder` — an atomic transaction that counts existing orders **for the branch** (prefix `BR{shopId}-`), generates the next number, and INSERTs in one step. Do **not** split this into separate count + insert calls.

### Order numbers

Format: `BR{shopId}-YYYYMMDD-NNNN` (e.g., `BR1-20260420-0022`). The counter is **continuous per branch**, not per-day — the `LIKE` prefix in `createOrder` matches all dates for the branch. If you see "date rolled over, counter reset to 0001", that's a bug.

### Status flow

```
new → received → inspection → waiting_approval → in_repair → quality_check
    → ready_for_return → returned_to_shop → delivered  (locked)

Terminal side-branches:  rejected, cancelled
```

`locked_at` is set on `delivered`. Locked orders reject all mutations with `OrderLockedError` (409).

### Urgency

`orders.is_urgent` (0/1). Set from the NewOrder form (`urgency: 'rush' | 'normal'`) and toggleable via `PUT /api/orders/:id`. The list query orders `(o.is_urgent = 1 AND o.locked_at IS NULL) DESC, o.created_at DESC` so rush orders float to the top of the workshop queue. Pill rendered as a red "مستعجل" badge next to the stamp on every surface (OrderList, OrderDetail, Dashboard, LabelCanvas).

### Client

- `api/orders.js` — fetch wrappers. `createOrder` must forward every field the server expects (previously silently dropped `urgency` during destructuring — watch for this pattern). `getConfig()` fetches LAN IP for QR URLs.
- `components/useLabelPrint.js` — Web Bluetooth hook using `@mmote/niimbluelib`. Must be triggered by a user gesture. Model id `B21`, `ImageEncoder.encodeCanvas` orientation `left`.
- `components/LabelCanvas.jsx` / `ReadyLabelCanvas.jsx` — share a pattern: draw in a fixed **400×240 base coordinate space**, then `fitCanvas()` applies a scale+translate transform to letterbox onto whatever real canvas pixel size the current label preset wants. Size presets range from 50×30 mm (Niimbot native) to A4, persisted in `localStorage`.
- `components/BarcodeScanner.jsx` — wraps `html5-qrcode` for desktop camera scanning (CODE128). Uses `useId()` for container id. **Do NOT wrap in React StrictMode** — double-mounting crashes the scanner.
- `pages/ScanPage.jsx` — dual-mode: reads `?code=` URL param (iPhone QR flow, no camera) OR uses camera scanner (desktop).
- `components/Layout.jsx` — sidebar on desktop, bottom tab bar on mobile, switched by CSS only (no JS toggle).

### Printing

Two paths, same canvas:

1. **Universal** — `handleUniversalPrint()` opens a new window with an inline HTML page containing `@page { size: {w}mm {h}mm; margin: 0 }`, injects the canvas as an image, and calls `window.print()`. Works with any OS-installed printer. Supports all size presets.
2. **Niimbot B21 (Bluetooth)** — only exposed when `sizeId === '50x30'` (the printer's native size). Requires Chrome/Edge on HTTPS or `localhost`.

### Key flows

1. **New order** → `POST /api/orders` (atomic `createOrder`) → success screen shows `LabelCanvas` → universal print OR Niimbot Bluetooth
2. **Status transition** → `PATCH /api/orders/:id/status` → `OrderService.transition()` → audit log + notification hook
3. **iPhone delivery** → scan QR on label with native camera → `/scan?code=BR...` → confirm → `wa.me` link opens with pre-filled Arabic message
4. **Desktop delivery** → `/scan` → camera reads CODE128 → same confirm flow

### Design system

"Premium Artisan Light" — CSS variables in `client/src/index.css`. Gold accent `#D4A843`, subtle shadows, white surfaces. Fonts: Almarai (Arabic UI) + JetBrains Mono (stamps, barcodes, phones). Surface-level interactive elements (`<Button>`, `<Input>`, `<Chip>`, `<Card>`, …) come from the primitive layer below — `index.css` only defines the design tokens, layout chrome (`.page-head`, `.drawer`, `.fab-new-order`, `.stat-card`, …), and `.field-label` for section headings. Do not add new `.className` rules to `index.css` for things a primitive can express.

### UI primitives (`client/src/components/ui/`)

After Phase 3+4: `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Chip`, `Alert`, `Card`, `FormField`, `SegmentedGroup`, `Dropdown`, `Dialog`. Each accepts a `testId` prop — no auto-emitted testids; the caller owns the namespace. `Button` and `Card` accept an `as` prop so callers can render as `NavLink` / `<a>` / `<button>` / `<section>` etc. without losing primitive styling.

- **`Button`** — variants: `primary`, `ghost`, `subtle`, `danger`, `gold`. Sizes: `sm` / `md` / `lg`. `loading` shows a spinner; `icon` slots a leading icon. Pass `as={NavLink} to="…"` for navigation links and `as="a" href="…"` for external links.
- **`Input`** / **`Select`** / **`Textarea`** — `size`, `invalid`, `dir` (auto-resolves to LTR for mono / numeric / email / tel inputs and RTL otherwise). `Input` is `forwardRef` so call sites can focus on mount.
- **`Checkbox`** — native input with indeterminate handling, optional `label`. Always pass `aria-label` when no visible label (the harness's a11y check fails if a checkbox is unlabelled).
- **`Chip`** — filter-toggle pill with `active` colorway and optional `count` slot (monospace).
- **`Alert`** — 4 structurally distinct variants (`danger` / `success` / `warning` / `info`) per CLEANUP-PLAN §2.1: each carries its own icon + title weight + body color, not just hue. Border uses `border-inline-start` so the 3px accent lands on the right edge in RTL.
- **`Card`** — surface container with `padding` presets and `variant` (`default` / `soft` / `raised`). `as="button"` renders a clickable card.
- **`FormField`** — composes around a single Input/Select/Textarea child. Auto-generates id + aria-describedby; pass `htmlFor` to override. Renders error/hint slots beneath the control.
- **`SegmentedGroup`** — mutually-exclusive button row with per-option `variant` (primary / success / danger). Used by NewOrder urgency and TrackPage decision rows. `testIdPrefix` emits `{prefix}__{value}` per slot.
- **`Dropdown`** — portal-rendered menu, `Section` / `Item` / `Separator` slots, click-outside via `pointerdown`, ESC-to-close with stack disambiguation, RTL-aware `align="start" | "end"`. `Dropdown.Item.onSelect` closes the menu.
- **`Dialog`** — portal-rendered modal with focus-trap, iOS scroll-lock (`position: fixed`), restore-focus-per-open, ESC-to-close. Backdrop `mousedown` closes; backdrop `preventDefault` so the cleanup's `trigger.focus()` isn't stomped by a focus-to-body. **HMR caveat:** the module-level `dialogStack` is preserved across hot reloads, so editing `Dialog.jsx` while a dialog is open can leave a stale stack entry — close the dialog before saving, or hard-refresh.

### Settings & user preferences

User-menu sits in the top bar (gear icon) and surfaces the user's settings + change-password + logout. Settings split by where the value belongs:

- **Server-side (operational, cross-device):** `default_label_preset`, `default_printer_mode` — in `user_settings`. Wrappers: `client/src/api/settings.js`. Provider: `SettingsProvider` (`client/src/contexts/SettingsContext.jsx`) — lazy-fetch on first menu open with retry-on-failure (failed GETs leave `status='error'` and the next `ensureLoaded()` retries; the failure is never permanently cached). Updates are optimistic with revert + toast on PATCH failure.
- **Client-side (per-device):** sound mute (`bulkScanMuted` in `localStorage`). Survives reload, doesn't sync across devices — by design (per-station preference, not per-account).

**Hide-not-disable rule.** Menu sections that aren't wired are hidden, not greyed-out. Disabled stubs in a brand-new menu confuse users; hiding is cleaner. Change-password lives in the dropdown; the workshop admin section is intentionally not in the user menu (admin links live in the sidebar).

**Force-relogin after password change is client-only.** `POST /api/auth/change-password` returns `{ ok: true, must_relogin: true }` on success and the client immediately replaces history with `/login` + clears local auth. JWTs minted before the change remain valid until natural expiry — the server does not maintain a token blacklist. Treat this as an availability tradeoff: an attacker who already exfiltrated a token before the change keeps it until expiry. If that becomes unacceptable, introduce a `password_changed_at` column + verify against `iat` in `requireAuth`.

**ChangePasswordDialog** (`client/src/components/ChangePasswordDialog.jsx`) — three `type="password"` inputs, client-side validation (current required, new ≥ 8 chars, new === confirm). On validation error, focus jumps to the first invalid field. Wrong current password (`401`) renders **inline** under the current-password field — not as a toast — because the user is mid-typing and may need to re-read the message. Success path is ordered: `200` → `navigate('/login', { replace: true, state: { reloginToast } })` → `setTimeout(clearAuth, 0)` → `LoginPage` reads `location.state.reloginToast` on mount and fires the toast.

### Database

Single SQLite file at `server/data/workshop.db` (git-ignored). Tests use `:memory:` (triggered by `NODE_ENV=test`). Phone stored as `966XXXXXXXXX` with no `+`; `wa.me` URLs use this format directly.

### Route ordering gotcha

In `server/routes/orders.js`, `GET /barcode/:value` must stay declared **before** `GET /:id` or Express will match `barcode` as an id. Same pattern applies to any new literal segment under `/orders` — for example `POST /bulk/technicians` is declared before `POST /:id/technicians`.

### Technician assignment

Three levels, all backed by `order_item_technicians` (M:M) but treated as 1-tech-per-item by the product. The replace-style write semantics enforce that.

- **Per item** — `POST /api/order-items/:id/technicians { technician_id }` (replace), `DELETE /api/order-items/:id/technicians` (unassign). UI: dropdown in the OrderDetail item row (workshop only).
- **Per order** — `POST /api/orders/:id/technicians { technician_id }`. Assigns to all items in one transaction. Returns `{ ok, items_updated }`. UI: trigger in the OrderDetail header. When items currently have multiple distinct techs, the dropdown opens an overwrite-confirm Dialog ("X من الأصناف معيَّنة حالياً لفنيين مختلفين") before applying.
- **Bulk** — `POST /api/orders/bulk/technicians { order_ids, technician_id }`. Per-order assignment for each, wrapped in one transaction so partial failures revert. Returns `{ ok, orders_updated, items_updated }`. UI: the "تعيين" button in the bulk-action toolbar opens a Dialog with a Select.

All three are workshop-only (`requireRole('workshop')`). Locked orders return 409. Reassigning the same tech is idempotent — no 409.

The technician roster is lazy-fetched once per session via `TechniciansContext` (mirrors `SettingsContext`'s pattern: failed fetches leave `status='error'` and the next `ensureLoaded()` retries).

`server/helpers/itemQueries.js` exposes `ITEMS_WITH_TECH_SQL` — every read of `order_items` goes through this so responses include `technician_id`, `technician_name` (= `technicians.name`), `technician_status`, `technician_username` for each item. The subquery picks `MAX(id)` per item so legacy multi-row data (from when the per-item endpoint was additive) doesn't multiply rows. The orders list endpoint also returns `technician_summary` per row: a single name when items are homogeneous, "متعدد" when they differ, or `NULL` when none assigned.

### Workforce (WF-1) — roles, specializations, technician CRUD

Path C is rebuilding the technician roster from a flat dropdown into real workforce management. WF-1 lays the schema + CRUD foundation; WF-2..6 layer on picker UX, workload visibility, status, schedules, and reporting.

**Schema (db.js):**
- `technicians`: gained `name` (replaces the old `specialization` text column — that column was load-bearing as the display name and is now dropped), plus `role_id` FK, `status` (`available`|`busy`|`off_shift`|`on_leave`), `phone`, `notes`, `active`. `user_id` stays nullable — technicians do NOT need a login.
- `roles`: workshop-configurable. 4 seeded defaults (`jeweler`, `polisher`, `appraiser`, `apprentice`). English keys + `display_label_ar`. Same shape as `repair_options` minus `item_type` since these are workshop-global, not per piece-type.
- `specializations`: same shape as `roles`. 12 seeded defaults (rings/chains/bracelets/earrings/watches/gold_work/silver_work/diamond_setting/gem_setting/engraving/polishing/repair_general).
- `technician_specializations`: M:M with `UNIQUE(technician_id, specialization_id)` so re-adding a spec is idempotent.
- `order_items.priority` (`urgent`|`standard`|`low`): schema only in WF-1, backfilled from `orders.is_urgent`. UI/sort/badges stay on `orders.is_urgent` until **WF-4** migrates them.

**Status enum is enforced at the service layer, NOT in the DB.** SQLite `ALTER TABLE … ADD COLUMN` cannot carry a `CHECK` constraint, so the `status` enum lives in `TechnicianService.STATUS_ENUM` and is validated on `update()` / `PATCH`. If you add a new status value, update both `TechnicianService` and the test enum.

**Service layer (`TechnicianService.js`):** mirrors `OrderService` — routes call the service, the service throws typed errors (`TechnicianHasAssignmentsError`, `RoleInUseError`, `SpecializationInUseError`, `DuplicateRoleError`, `DuplicateSpecializationError`, `ValidationError`), the global error middleware maps them. `softDelete()` blocks via `TechnicianHasAssignmentsError` when the tech has open assignments — "open" = items on orders where `locked_at IS NULL` AND `status NOT IN ('cancelled','rejected','closed','delivered')`.

**Workload counts are derived per-technician, NOT joined into ITEMS_WITH_TECH_SQL.** That helper still surfaces only single-row tech metadata (id, name, status, username) for item reads. Workload is a separate aggregate exposed via `GET /api/technicians?with=workload` that returns `active_count` + `urgent_count` per row in the list response. This avoids recomputing aggregates per item row.

**Endpoints (all workshop-only):**
- `GET /api/technicians?role_id=&status=&search=&active=&with=workload&limit=&offset=` — paginated `{ items, total, limit, offset }`. `limit` default 20, capped at 100. Search is `name LIKE '%q%' COLLATE NOCASE`. Each item carries top-3 specializations; full list is on detail.
- `GET /api/technicians/:id` — full detail + all specs + last 10 assignments + workload.
- `POST /api/technicians` `{ name (required), role_id?, phone?, notes?, specialization_ids? }` → 201 detail.
- `PATCH /api/technicians/:id` — subset of `{ name, role_id, phone, notes, status, active }`. Disallowed fields silently ignored.
- `DELETE /api/technicians/:id` — soft (`active=0`). 409 if open assignments exist.
- `POST /api/technicians/:id/specializations { specialization_id }` — idempotent via `INSERT OR IGNORE`.
- `DELETE /api/technicians/:id/specializations/:specializationId`.
- `GET|POST|PATCH|DELETE /api/roles` and `/api/specializations` — full CRUD. `value` is **not editable** on PATCH (silently ignored). DELETE is soft + blocks when referenced (`RoleInUseError` / `SpecializationInUseError`). 409 on duplicate `value`.

**WF-2 picker (backend complete, branch wf-2-backend):**

Two new endpoints, both `requireRole('workshop')`:

- `GET /api/technicians/picker` — lightweight payload for assignment picker UI. Params: `q` (name search, COLLATE NOCASE), `specialization_id` (INNER JOIN filter), `status` (default `'available'`; `'all'` = no status filter; any specific value = filter to that status), `limit` (default 30, max 100), `offset`. Response: `{ items, total }`. Sorted `active_count ASC, name ASC` (least-busy first). Inactive (`active=0`) techs excluded. **Must stay declared before `GET /:id` in technicians.js** to avoid Express matching the literal `picker` as an id.

- `GET /api/order-items/:id/suggested-technicians` — ranks active technicians by suitability for the given item. Params: `limit` (default 5, max 20). Response: `{ item_id, item_type, matched_specializations, suggestions[] }` where each suggestion carries `score`, `matched_specs`, `specializations`, `active_count`. Returns 404 if item not found.

**Scoring algorithm (v1):**
1. Specialization match: `+10` per spec key that appears in `ITEM_TYPE_SPEC_MAP[item.item_type]`
2. Status weight: `available +5`, `busy 0`, `off_shift -10`, `on_leave -20`
3. Workload penalty: `active_count × -1`
4. Tiebreaker: `name ASC` (localeCompare 'ar')

**`ITEM_TYPE_SPEC_MAP`** — **deprecated constant** (kept only for backwards-compat exports). The source of truth is now the `item_type_spec_map` DB table (WF-4). Do not add new entries to the constant; update the DB table instead.

**`_scoreAndRank(techs, matchedSpecValues)`** is exported as a pure function — testable in isolation without DB. `pickerQuery()` and `suggestForItem()` are the public service functions.

**WF-4 (BE) — priority migration + auto-assign + configurable spec map:**

- **`item_type_spec_map` table** — `id, item_type UNIQUE COLLATE NOCASE, spec_values TEXT (JSON array), updated_at, updated_by FK`. Seeded with 7 defaults from the old `ITEM_TYPE_SPEC_MAP` constant. `INSERT OR IGNORE` seed is idempotent. `getItemTypeSpecMap()` in `TechnicianService.js` reads this table with a **60-second TTL cache** (`_specMapCache` module-level variable, invalidated by `updateItemTypeSpecMap()`).

- **`updateItemTypeSpecMap(itemType, specValues, updatedBy)`** — upserts one row. Validates `specValues` against active specializations; throws `ValidationError` (422) on unknown value. Invalidates cache.

- **`autoAssign(orderItemId, { assignedBy })`** — runs `suggestForItem` with `limit:1`, atomically replaces the item's `order_item_technicians` row with the top-scored tech. Throws `NoSuitableTechnicianError` (422, "لا يوجد فني متاح") when zero active techs exist; throws `OrderLockedError` (409) on locked orders. Forward-compat: writes `assignment_method='auto'` to `assignment_history` if that table+column exist (analytics plan Phase 2 Group B) — silently skipped otherwise.

- **New endpoints (all `requireRole('workshop')`, declared before `/:id`):**
  - `GET /api/technicians/item-type-spec-map` → `{ map: [{ item_type, spec_values: string[], updated_at, updated_by_username }] }`
  - `PUT /api/technicians/item-type-spec-map/:itemType` (Arabic types must be URL-encoded by client) → 200 updated row | 422 unknown spec
  - `POST /api/order-items/:id/auto-assign` → 200 `{ technician, score, matched_specs }` | 422 no tech | 409 locked | 404 bad item. **Declared before `POST /:id/technicians`** to avoid Express collision.

- **`NoSuitableTechnicianError`** — `server/errors/index.js`, maps to HTTP 422.

**WF-6 cancelled** — superseded by `docs/specs/ANALYTICS-INSTRUMENTATION-PLAN.md`.

### WF-5 — Shift schedules + leave management + automated scheduler

**Schema (db.js):**
- `technician_shifts`: `(id, technician_id FK CASCADE, day_of_week CHECK(0–6), start_time, end_time, active DEFAULT 1; UNIQUE(technician_id, day_of_week))`. Soft-delete: `active=0`. Index on tech+day.
- `technician_leaves`: `(id, technician_id FK CASCADE, leave_date, leave_type DEFAULT 'day_off', notes, created_by FK, created_at; UNIQUE(technician_id, leave_date))`. Hard-delete. Index on tech+date.
- `leave_type` enum: `day_off | sick | vacation` — validated in `ShiftService`, not in DB schema.

**Service layer (`server/services/ShiftService.js`):**
- `getShifts(techId)` — returns `{ shifts, leaves }` for a tech; 404 if tech not found.
- `upsertShift(techId, dayOfWeek, startTime, endTime)` — validates 0–6, `HH:MM` format, start < end; `ON CONFLICT DO UPDATE`; returns full row.
- `deleteShift(techId, dayOfWeek)` — soft-delete (`active=0`); idempotent.
- `upsertLeave(techId, leaveDate, leaveType, notes, createdBy)` — validates `YYYY-MM-DD` and `leave_type` enum; `ON CONFLICT DO UPDATE`; `createdBy` degraded to null if user row not found (prevents FK violation).
- `deleteLeave(techId, leaveDate)` — hard-delete; idempotent.
- `getKSANow()` — returns `{ currentTime: 'HH:MM', todayDate: 'YYYY-MM-DD', currentDay: 0–6 }` using `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', ... }).formatToParts(new Date())`. **Never use `new Date().getHours()`** — always use `Intl` with `Asia/Riyadh` to avoid server TZ dependency.
- `computeTargetStatus(tech, shift, leave, currentTime)` — pure function (exported for unit tests). Leave beats shift. `busy` is never touched. Returns null if no change needed.
- `getSchedulerStatus(getNow?)` — snapshot of what scheduler would do right now. `getNow` defaults to `getKSANow`; pass a stub in tests.
- `runScheduler(getNow?)` — applies status changes for all active techs via `TechnicianService.changeStatus(techId, target, { reason: 'scheduler' })`. Returns `{ updated, skipped, changes }`. Idempotent. `getNow` defaults to `getKSANow`; pass a stub in tests.

**KSA timezone invariant:** both `getSchedulerStatus` and `runScheduler` accept an optional `getNow` parameter (signature: `() => { currentTime, todayDate, currentDay }`) for testability. Tests pass a stub instead of fake timers — `Intl.DateTimeFormat.prototype.formatToParts` reads V8-internal `[[DateValue]]` which fake timers don't reliably patch.

**Scheduler timer (`server/scheduler.js`):**
- `start()` / `stop()` — exports only; `start()` is idempotent, `_timer.unref()` allows clean process exit without SIGTERM.
- `index.js` guards the call: `if (process.env.NODE_ENV !== 'test') scheduler.start()` — Jest never starts the interval (avoids open-handle warnings).
- Interval fires `ShiftService.runScheduler()` every 60 s; errors are caught and logged, not re-thrown.

**Endpoints (all `requireRole('workshop')`):**
- `GET /api/technicians/:id/shifts` → `{ shifts, leaves }`. 404 if tech not found. 403 for `shop_employee`.
- `PUT /api/technicians/:id/shifts/:dayOfWeek` `{ start_time, end_time }` → 200 upserted row | 422 validation | 403.
- `DELETE /api/technicians/:id/shifts/:dayOfWeek` → 200 `{ ok: true }` (idempotent) | 403.
- `PUT /api/technicians/:id/leaves/:leaveDate` `{ leave_type?, notes? }` — `leave_type` defaults to `day_off` | 422 | 403.
- `DELETE /api/technicians/:id/leaves/:leaveDate` → 200 `{ ok: true }` (idempotent) | 403.
- `POST /api/scheduler/run` → `{ updated, skipped, changes }` (triggers scheduler immediately).
- `GET /api/scheduler/status` → `{ current_time, current_day, today_date, technicians: [{ id, name, current_status, shift_today, leave_today, would_change_to }] }`.

## QA / Test Protocol

When I say "run QA" or "heavy test", follow /docs/qa-protocol.md:

- Use Playwright MCP to exercise every user flow
- Check console, network, and logical consistency
- Output findings to QA-REPORT.md with severity ratings
- Never fix without showing the report first

The scripted harness lives at `tools/qa-audit/` (see `tools/qa-audit/README.md`).
Run it with `node tools/qa-audit/audit.mjs` (requires `npm install` once inside
`tools/qa-audit/`, and `npm run dev` already running at repo root). It writes
`QA-REPORT.md` at the repo root; screenshots land in
`tools/qa-audit/screenshots/`. Both outputs are gitignored — copy or quote
findings into commits/PRs rather than relying on the files persisting.

## QA Ground Rules (read before every QA run)

Treat findings from a new or changed QA harness with suspicion until the harness itself has produced at least one clean run against known-good code. The first pass of any harness is a harness-shakedown, not a product audit.

When diagnosing a "component X has/doesn't have feature Y" finding, first verify which file is actually imported by the route/parent, not just which file contains the feature. Grep the import chain or inspect the rendered DOM — reading a file is not the same as verifying it's the one being used.

Preconditions — abort the run if any fail:

- curl http://localhost:3737/api/auth/login with seeded creds
  returns 200 and a JWT for BOTH http and https origins.
- The string "Not allowed by CORS" appears nowhere in any
  page body or network error.

If a precondition fails, emit ONE finding:
"Setup failed: <which precondition> — aborting QA."
Do NOT continue and generate cascading findings.

When grouping findings:

- If a write endpoint (POST/PATCH/PUT/DELETE) returned 4xx/5xx,
  flag any downstream UI-state findings as "blocked by <endpoint>"
  instead of as independent issues.
- Dedupe: if the same issue appears on N pages, emit ONE finding.

Skip in automated QA (manual only, note in report):

- Niimbot B21 Bluetooth printing (Web Bluetooth unsupported in Playwright)
- Camera barcode scanning (html5-qrcode needs a real camera)
- WebAudio output (can't reliably assert a beep fired — unit-test the audio
  util's mute state instead, and ear-check manually)

Bulk-scan sessions produce N history rows per session; filter
`notes LIKE 'bulk-scan %'` to separate from single-scan transitions. The
shape is `bulk-scan · session:{uuid8} · type:{slug}` — the `session:` segment
groups all rows from one session together.

Run the bulk-scan e2e suite with `npm run test:e2e` (requires `npm run dev`
already running — the suite seeds against the live dev DB).

## Data handling

### Dashboard CSV export (`client/src/utils/exportOrdersCsv.js`)

- **What it includes:** `رقم الطلب, اسم العميل, الجوال, القطعة, الحالة, مستعجل,
  التكلفة, تاريخ الاستلام, الفرع`. Full customer name and full phone
  (`+966XXXXXXXXX`) are included — no masking, no truncation.
- **Why:** the CSV mirrors what the operator already sees on the Dashboard row.
  A two-tier privacy model (row visible, export masked) would be inconsistent
  and invite workarounds (screenshot, re-type). Keeping export == display also
  keeps the PII surface honest — anything we're uncomfortable dumping to a CSV
  shouldn't be on the row either.
- **Who sees it:** both roles. `workshop` sees all orders; `shop_employee` is
  server-scoped to their own `shop_id` by `GET /api/orders` (enforced in
  `server/routes/orders.js`), so the export for a shop_employee only ever
  contains their own shop's rows — no client-side role hiding is required.
- **What would change this:** if the product ever introduces real privacy
  classes (e.g., a "VIP" flag that suppresses on-screen phone), customer
  consent flows, or regulatory constraints on PII-on-disk, revisit this
  default. Likely landing: mask phone to `+966•••••XXXX` in the export for
  non-owner roles, and/or route export through a server endpoint that writes
  an audit row. Today there's no audit trail — a CSV leaves no fingerprint.

## RTL / Arabic UI Gotchas (learned during Mudhiyan build)

- **LTR content inside RTL layout**: identifiers that are
  ASCII (order numbers, barcodes, emails, URLs, IBAN) should
  be `dir="ltr"` on the input itself, even inside an
  `dir="rtl"` page. Otherwise the cursor and hyphens render
  in the wrong visual order.

- **Off-screen positioning uses `position: fixed` in RTL,
  not `left: -9999px`**. The latter shifts the viewport
  scroll origin in RTL writing mode. Hidden-focused inputs
  (barcode scanner pattern) should be
  `position: fixed; width: 1px; height: 1px; overflow: hidden`
  with no large negative offset.

- **Playwright text selectors on SVG-plus-text buttons are
  fragile in RTL**. Prefer `getByRole('button', { name: '...' })`
  over `:has-text()` or `hasText`. The accessible-name query
  reads the computed a11y name, which handles icon-plus-text
  concatenation correctly.
