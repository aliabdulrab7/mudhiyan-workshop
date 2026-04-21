# Cleanup Plan — Stable Selectors + Reusable Primitives

Planning document for a four-phase cleanup targeting two structural weaknesses
in `client/src/`:

- **Problem 1 — no stable selectors.** The Playwright harness matches by
  visible text. Text is bilingual (Arabic label + optional English alias),
  cosmetic, and moves between releases. Every renamed copy is a harness
  regression.
- **Problem 2 — no primitive layer.** `.btn / .input / .chip / .card / .page-head`
  etc. live as CSS utility classes in `index.css` (860 lines). Consumers
  hand-compose class strings, often mixed with inline styles and ad-hoc
  oklch literals. A `Button.jsx` primitive exists but is used in ~2 places;
  the rest of the codebase writes `<button className="btn btn-primary">`.

Five phases, reviewed in order:

| # | Phase | Output |
|---|-------|--------|
| 1 | Plan (this doc) | `docs/CLEANUP-PLAN.md` |
| 2 | Attach stable testids | one commit per surface (or small batch) + harness update in same commit |
| 3 | Build primitives | `client/src/components/ui/*.jsx` |
| 4 | Migrate call sites | one commit per primitive |
| 5 | Legacy cleanup | remove legacy CSS classes from `index.css`; delete `OrderForm.jsx`; inline + delete `CostEditor.jsx` |

**Canonical ordering rationale.** Testids land first so the Playwright
harness has stable selectors to verify Phase 4's per-primitive migration
commits. Text-match assertions are brittle precisely because we're
refactoring the JSX — writing `data-testid` onto raw `<button className="btn
btn-primary">…</button>` in Phase 2 is a pure additive diff that survives
unchanged through Phase 4 (primitives accept `testId` as a pass-through prop).

---

## 1. Interactive-element inventory

Convention:

```
{surface-slug}__{element-role}__{specifier}
```

- `surface-slug` — page slug for page-owned elements, component slug for
  shared components. Exactly one level.
- `element-role` — what it does (`submit`, `cancel`, `row`, `filter`,
  `nav`, `tab`, `stat-card`, `search-input`, …). Single-hyphen within level.
- `specifier` — optional disambiguator (`order-number`, `status-key`,
  `item-id`, `branch-id`, …). Single-hyphen within level.
- Separator between levels: **double underscore** `__`.
- Dynamic suffixes documented as `{placeholder}` — never literal braces in
  the rendered DOM.
- Shared components (Layout, OrderList, OrderDetail, DataTable, CostEditor,
  CommandPalette, PrintPanel, Bulk*, Label*, ScanResult, ManualEntryInput,
  Toast) use the **component slug** rather than the hosting page slug. This
  keeps a shared component's testids stable as pages embed it.
- Primitives (`Button`, `Input`, `Checkbox`, `StatusPill`, `DataTable`)
  accept a `testIdPrefix` / `testId` prop and **do not emit testids on their
  own**; the caller owns the namespace.

### 1.1 Counts

- **37 `.jsx` files** in `client/src/`.
- **10 non-interactive** (no buttons/inputs/selects/textareas/onClick
  elements): `App.jsx`, `main.jsx`, `PrivateRoute.jsx`, `RoleRoute.jsx`,
  `icons.jsx`, `ToastProvider.jsx` (render-only), `SkeletonLoader.jsx`,
  `StatusPill.jsx` (display pill), `Button.jsx` (primitive, no concrete
  element), `Checkbox.jsx` (primitive).
- **1 dead** (no imports): `OrderForm.jsx` — remove in Phase 2.
- **26 surfaces** carry interactive elements.
- **~180 interactive-element slots** across those 26 surfaces. "Slot" here
  counts one generator site per `.map(...)` (e.g. `DataTable` per-row emits
  one slot, not one per visible row).
- **Existing testids: 19**, all under `client/src/components/Bulk*` +
  `ScanPage.jsx` — see §1.3 for rename targets.

### 1.2 Surface inventory

> **Format:** each surface is one block: slug, file, count, proposed
> testids. `(per row)` / `(per item)` / `(per repair)` marks generator
> sites. Representative line numbers cited for disambiguation; not an
> exhaustive line-accurate table.

#### `dashboard` — `pages/Dashboard.jsx` · ~12 slots
- `dashboard__stat-card__{key}` — STAT_CARDS map × 8 (keys: `new`,
  `received`, `inspection`, `waiting_approval`, `in_repair`,
  `quality_check`, `ready_for_return`, `delivered`)
- `dashboard__export-csv-button` — `handleExport` call site
- `dashboard__fab__new-order` — floating action button
- `dashboard__action__tweet`, `dashboard__action__pending`,
  `dashboard__action__rejected` — ActionPanel buttons
- embedded `OrderList` inherits `order-list__*`

#### `login` — `pages/LoginPage.jsx` · 3 slots
- `login__username-input`, `login__password-input`, `login__submit-button`

#### `orders-list` — `pages/OrdersPage.jsx` · 11 static + DataTable slots
- `orders-list__search-input`
- `orders-list__filter__all`, `orders-list__filter__{status}` (× 5 MAIN_STATUSES)
- `orders-list__bulk__advance-in-progress`,
  `orders-list__bulk__advance-ready`,
  `orders-list__bulk__advance-delivered`,
  `orders-list__bulk__cancel`
- DataTable (see §1.2 primitives) receives `testIdPrefix="orders-list"` and
  `getRowTestId={r => r.order_number}` → emits
  `orders-list__row__{order_number}`, `orders-list__row__{order_number}__select`,
  `orders-list__select-all`.
  Row specifier is `order_number` (stamp-style, e.g. `BR1-20260420-0022`)
  rather than numeric DB id — harness-friendly (orders are created via API
  which returns `order_number`) and human-readable in traces.

#### `new-order` — `pages/NewOrder.jsx` · ~10 static + 6+ per-row generators
- `new-order__customer-name-input`, `new-order__phone-input`,
  `new-order__urgency__normal`, `new-order__urgency__rush`,
  `new-order__notes-textarea`, `new-order__submit`, `new-order__add-item`
- `new-order__item__{idx}__type-select`,
  `new-order__item__{idx}__count-input`,
  `new-order__item__{idx}__add-repair`,
  `new-order__item__{idx}__remove`,
  `new-order__item__{idx}__repair__{ridx}__type-select`,
  `new-order__item__{idx}__repair__{ridx}__need__{field}` where `field ∈
  {size, stone, color, text}`
- success screen: `new-order__success__whatsapp`, LabelCanvas child testids

#### `track` — `pages/TrackPage.jsx` · 1 static + 2 per-item
- `track__confirm-decisions`
- `track__decision__{item_id}__approve`,
  `track__decision__{item_id}__reject`

#### `reports` — `pages/ReportsPage.jsx` · ~3 static + 1 per-branch
- `reports__export-button`, `reports__pending-link`,
  `reports__period__{slug}` (if a period selector is wired; verify during
  Phase 4)
- `reports__branch-card__{id}` (per row)

#### `scan` — `pages/ScanPage.jsx` · ~3 slots
- `scan__mode-strip__single` **(already exists — keep)**,
  `scan__mode-strip__bulk` (add)
- embedded `ManualEntryInput` → `manual-entry__*`, `BulkScanSession` →
  `bulk-scan__*`, `ScanResult` → `scan-result__*`

#### `branches` — `pages/BranchesPage.jsx` · ~6 static + 2 per-row
- `branches__add-button`, `branches__form__name-input` (+ other fields),
  `branches__form__submit`, `branches__form__cancel`
- `branches__row__{id}__edit`, `branches__row__{id}__delete`

#### `technicians` — `pages/TechniciansPage.jsx` · ~7 static + 1 per-row
- `technicians__add-button`, `technicians__form__name-input`,
  `technicians__form__phone-input`, `technicians__form__role-select`,
  `technicians__form__submit`, `technicians__form__cancel`
- `technicians__row__{id}__edit`

#### `services` — `pages/ServicesPage.jsx` · ~7 static + 3 per-row
- `services__add-button`, `services__form__name-input`,
  `services__form__price-input`, `services__form__submit`,
  `services__form__cancel`
- `services__row__{id}__edit`, `services__row__{id}__save`,
  `services__row__{id}__cancel` (inline edit)

#### `inventory` — `pages/InventoryPage.jsx` · ~6 static + 2 per-row
- `inventory__add-button`, `inventory__form__name-input`,
  `inventory__form__qty-input`, `inventory__form__submit`,
  `inventory__form__cancel`
- `inventory__row__{id}__increase`, `inventory__row__{id}__decrease`

#### `repair-options` — `pages/RepairOptionsPage.jsx` · ~6 static + 2 per-row
- `repair-options__tab__{item-type}` (chip tabs),
  `repair-options__add-button`, `repair-options__form__name-input`,
  `repair-options__form__submit`, `repair-options__form__cancel`
- `repair-options__row__{id}__toggle-active`,
  `repair-options__row__{id}__edit`

#### `label-print` — `pages/LabelPrintPage.jsx` · 1 static + children
- `label-print__back-button`
- `LabelCanvas` → `label-canvas__*`,
  `ReadyLabelCanvas` → `ready-label-canvas__*`

#### `layout` — `components/Layout.jsx` · ~16 slots
- `layout__nav__{slug}` (sidebar nav items, role-gated — 7)
- `layout__tab__{slug}` (mobile bottom tabs — 5)
- `layout__topbar__search-button`,
  `layout__topbar__action__{slug}` (3 icon buttons),
  `layout__topbar__logout`
- `layout__brand-mark` (if made clickable; currently passive)

#### `order-list` — `components/OrderList.jsx` · ~20 static + 3 per-row
- `order-list__filter__{key}` (FILTER_DEFS × 9)
- `order-list__sort__{column}` (sortable headers × 6)
- `order-list__select-all`
- `order-list__bulk__{action}` (3 bulk actions)
- `order-list__bulk__cancel`
- `order-list__row__{id}`, `order-list__row__{id}__select`,
  `order-list__row__{id}__menu`
- menu items: `order-list__row__{id}__menu__{action}` (copy, print, open,
  …)

#### `order-detail` — `components/OrderDetail.jsx` · ~7 static + per-item
- `order-detail__close`, `order-detail__status-advance`,
  `order-detail__cancel-button`, `order-detail__cancel-confirm`,
  `order-detail__cancel-deny`, `order-detail__send-for-approval`,
  `order-detail__comment__textarea`, `order-detail__comment__submit`,
  `order-detail__whatsapp-ready`, `order-detail__label-print-link`
- per-item: `order-detail__item__{item_id}__cost-input`,
  `order-detail__item__{item_id}__approval-badge`

#### `cost-editor` — `components/CostEditor.jsx` · 2 slots
- `cost-editor__cost-input`, `cost-editor__submit`
- **Note:** single caller (`ScanResult`); consider inlining in Phase 2.

#### `command-palette` — `components/CommandPalette.jsx` · 1 static + per-result
- `command-palette__search-input`
- `command-palette__result__{slug}` (per result)

#### `print-panel` — `components/PrintPanel.jsx` · 2 slots
- `print-panel__printer-select`, `print-panel__test-print-button`

#### `bulk-scan` — `components/BulkScanSession.jsx` · ~10 slots **(renames)**
See §1.3 for old-name → new-name table.

#### `bulk-scan-list` — `components/BulkScanList.jsx` · 1 static + per-row
- `bulk-scan-list` (container — keep)
- `bulk-scan-list__row__{stamp}` (rename from `bulk-row-{stamp}`)

#### `bulk-scan-input` — `components/BulkScanInput.jsx` · 1 slot
- `bulk-scan-input__hidden-input` (rename from `bulk-scan-hidden-input`)

#### `scan-result` — `components/ScanResult.jsx` · 4 slots
- `scan-result__mark-ready`, `scan-result__approval-whatsapp`,
  `scan-result__ready-whatsapp`, `scan-result__scan-again`

#### `manual-entry` — `components/ManualEntryInput.jsx` · 2 slots
- `manual-entry__input`, `manual-entry__submit`

#### `barcode-scanner` — `components/BarcodeScanner.jsx` · 0 (library-owned DOM)
- `html5-qrcode` injects its own controls; we cannot reliably attach
  testids. Note in Phase 4: harness already skips camera flows.

#### `label-canvas` — `components/LabelCanvas.jsx` · 7 slots
- `label-canvas__size-select`, `label-canvas__print-universal`,
  `label-canvas__niimbot-bluetooth-connect`,
  `label-canvas__niimbot-serial-connect`,
  `label-canvas__niimbot-print`, `label-canvas__niimbot-stop`,
  `label-canvas__niimbot-disconnect`

#### `ready-label-canvas` — `components/ReadyLabelCanvas.jsx` · 6 slots
- same set, `ready-label-canvas__*` prefix, minus the distinct stop button

#### `data-table` — `components/DataTable.jsx` · 3 emit sites, caller-prefixed
- `{prefix}__select-all`, `{prefix}__row__{key}`,
  `{prefix}__row__{key}__select` — emitted only when the parent passes
  `testIdPrefix`.

#### `toast` — `components/ToastProvider.jsx` · 1 per-toast
- `toast__item__{variant}`, `toast__dismiss`

### 1.3 Existing-testid reconciliation

Harness already reads these. Rename in Phase 4 **and** update
`tools/qa-audit/` + `server/tests/e2e/` in the same commit.

| File                           | Current                              | Proposed                                    |
|--------------------------------|--------------------------------------|---------------------------------------------|
| `pages/ScanPage.jsx:132`       | `mode-strip-single`                  | `scan__mode-strip__single`                  |
| `components/BulkScanSession.jsx:243` | `mode-strip-bulk-no-session`   | `bulk-scan__mode-strip__no-session`         |
| `components/BulkScanSession.jsx:256` | `mode-strip-session-active`    | `bulk-scan__mode-strip__session-active`     |
| `components/BulkScanSession.jsx:263` | `btn-end-session`              | `bulk-scan__end-session-button`             |
| `components/BulkScanSession.jsx:271` | `mode-strip-ending`            | `bulk-scan__mode-strip__ending`             |
| `components/BulkScanSession.jsx:286` | `mode-strip-summary`           | `bulk-scan__mode-strip__summary`            |
| `components/BulkScanSession.jsx:294` | `btn-new-session`              | `bulk-scan__new-session-button`             |
| `components/BulkScanSession.jsx:295` | `btn-exit-bulk`                | `bulk-scan__exit-button`                    |
| `components/BulkScanSession.jsx:308` | `mute-toggle`                  | `bulk-scan__mute-toggle`                    |
| `components/BulkScanSession.jsx:374` | `session-type-{id}`            | `bulk-scan__session-type__{id}`             |
| `components/BulkScanSession.jsx:423` | `scan-ready-badge`             | `bulk-scan__scan-ready-badge`               |
| `components/BulkScanSession.jsx:446` | `scan-paused-badge`            | `bulk-scan__scan-paused-badge`              |
| `components/BulkScanSession.jsx:460` | `ending-badge`                 | `bulk-scan__ending-badge`                   |
| `components/BulkScanSession.jsx:483` | `summary-card`                 | `bulk-scan__summary-card`                   |
| `components/BulkScanSession.jsx:495` | `summary-headline`             | `bulk-scan__summary-headline`               |
| `components/BulkScanSession.jsx:513` | `btn-new-session-card`         | `bulk-scan__summary__new-session-button`    |
| `components/BulkScanSession.jsx:516` | `btn-exit-bulk-card`           | `bulk-scan__summary__exit-button`           |
| `components/BulkScanList.jsx:50`     | `bulk-scan-list`               | `bulk-scan-list` (keep)                     |
| `components/BulkScanList.jsx:58`     | `bulk-row-{stamp}`             | `bulk-scan-list__row__{stamp}`              |
| `components/BulkScanInput.jsx:118`   | `bulk-scan-hidden-input`       | `bulk-scan-input__hidden-input`             |

**~180 interactive-element slots found across 26 surfaces.** 19 existing
testids reconciled above; 161 new testids to attach in Phase 4.

---

## 2. Repeated-pattern audit

Patterns repeating **3 or more times** with a concrete JSX call site. Usage
counts are grep-approximate — exact counts settle during Phase 2.

### Extract as primitive

| Primitive        | Current shape                                | Approx. uses | Top call sites                                                                                                     | Proposed API                                                                                                                                                   |
|------------------|----------------------------------------------|--------------|--------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Button**       | `<button className="btn btn-primary">…</button>` (+ `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-icon`, `.btn-gold` legacy) | 200+         | `OrdersPage` bulk bar, `OrderDetail` action rows, every admin-page form, `NewOrder` wizard, `TrackPage` decisions, `ScanResult`, `LabelCanvas` | `<Button variant="primary\|ghost\|subtle\|danger\|gold" size="sm\|md\|lg" icon={<...>} loading disabled testId>` — existing `Button.jsx` already has the skeleton; expand variants + adopt. |
| **Input**        | `<input className="input">` + `<input className="input mono">` (+ `.input-base` legacy) | 30+          | `LoginPage`, `NewOrder`, `OrderDetail` per-item cost, admin pages, `ManualEntryInput`                              | `<Input type value onChange dir="rtl\|ltr\|auto" mono prefix suffix error size testId>` — `dir="auto"` defaults to `ltr` for `mono`/numeric per RTL gotchas in CLAUDE.md.            |
| **Select**       | `<select className="select">…</select>`      | 15+          | `NewOrder` item type, `LabelCanvas` size picker, `ReadyLabelCanvas` size, `TechniciansPage` role, `PrintPanel` printer | `<Select value onChange options={[{value,label}]} placeholder size testId>` — slot children allowed for custom `<option>` groups.                            |
| **Textarea**     | `<textarea className="textarea">` + inline-styled free textareas | 8+           | `NewOrder` notes, `OrderDetail` comment, admin pages                                                               | `<Textarea rows value onChange error size testId>` — consistent with Input API.                                                                                |
| **Checkbox**     | `<Checkbox>` primitive exists; `OrderList.jsx` uses local `.cb`-class copy at L491-507 | 5+           | `DataTable`, `OrderList` (duplicate), `OrdersPage` bulk                                                            | Keep existing `Checkbox.jsx`. Delete local copy in `OrderList`.                                                                                                |
| **Chip**         | `<button className="chip">` + `.chip.chip-active` + `.count` span inside | 40+          | `OrdersPage` filters, `OrderList` filters, `NewOrder` urgency, `NewOrder` repair colors, `RepairOptionsPage` tabs | `<Chip active count onClick testId>children</Chip>` — handles the active colorway and optional count badge.                                                    |
| **Alert**        | inline `<div style={{ background:'oklch(…/0.06)', border:'1px solid oklch(…/0.2)', borderRight:'3px solid …', …}}>` (danger/success/warning/info) | 15+          | `LoginPage`, `NewOrder`, `OrderDetail`, `TrackPage`, `ScanResult`, `Dashboard` rejected alert, `PrintPanel`, `ReportsPage` pending | `<Alert variant="danger\|success\|warning\|info" title children dismissible>` — see §2.1 for structural requirements per variant. |
| **FormField**    | `<label className="field-label">…</label><input className="input">` + optional `<p className="error">…</p>` | 20+          | Every admin-page form, `LoginPage`, `NewOrder`                                                                     | `<FormField label error required><Input .../></FormField>` — composes over Input/Select/Textarea.                                                              |
| **SegmentedGroup** | two-or-three `<button>` pair with shared borders, active colorway | 5            | `NewOrder` urgency (normal/rush), `TrackPage` DecisionRow (approve/reject), `BulkScanSession` session-type selector, `Dashboard` period (if present) | `<SegmentedGroup value onChange options={[{value,label,icon,variant}]} testIdPrefix>` — uses Button under the hood.                                          |
| **Card**         | `<div className="card">` + `<div className="card stat-card">` + `<div className="card track-card">` | 25+          | Every admin page, `Dashboard` stat grid, `TrackPage`, `ReportsPage`, `PrintPanel`                                  | `<Card padding="sm\|md\|lg" variant="default\|soft\|raised">` — thin wrapper; the win is eliminating raw `div.card` strings and owning hover/focus states.    |
| **Dialog**       | inline cancel-confirm panel in `OrderDetail` + `CommandPalette` modal shell + `BulkScanSession` summary card + `window.confirm` in Branches/RepairOptions | 3–4          | `OrderDetail.jsx` cancel flow, `CommandPalette.jsx`, `BulkScanSession.jsx` summary, admin `window.confirm` replacements (optional) | `<Dialog open onClose title footer children>` — headless, focus-trap, ESC-to-close. Behavior change risk: replacing `window.confirm` touches user interaction timing. |

### 2.1 Alert — structural requirements per variant

**Rule:** Alert variants must be structurally distinguishable, not just
color-coded. Users stop seeing variants that differ only by hue; an Alert
without a glyph or weight cue becomes visual noise.

Minimum per variant:

| Variant   | Border (logical)                              | Icon                         | Title weight | Body color      |
|-----------|-----------------------------------------------|------------------------------|--------------|-----------------|
| `danger`  | `border-inline-start: 3px solid var(--danger)` (renders on the right edge in RTL) | `Icons.X` or stop glyph      | 600          | `var(--danger)` |
| `success` | `border-inline-start: 3px solid var(--success)` | `Icons.Check`                | 600          | `var(--success)` |
| `warning` | `border-inline-start: 3px solid var(--warning)` | `Icons.Warn` (triangle/!)    | 600          | `var(--warning)` |
| `info`    | `border-inline-start: 3px solid var(--primary)` | `Icons.Sparkle` or info `i`  | 500          | `var(--primary)` |

- **Use CSS logical properties** (`border-inline-start`, `padding-inline`,
  `margin-inline-end`) — the border visually lands on the right edge in
  RTL without per-locale branching. No raw `border-left` / `border-right`.
- Icon is **required**, not optional. Primitive signature: `<Alert variant
  title children dismissible>` — icon is picked from variant, not passed in.
- Title is bold; body is regular weight. Dismissible adds an `×` button
  mapped to `toast__dismiss` pattern.

### Observed but NOT extracted (<3 uses or divergent semantics)

- **Drawer** — 1 use (`OrderDetail`). Leave as-is; migrate contents only.
- **Timeline** — 1 use (`TrackPage`). Already well-factored CSS.
- **Stamp / OrderStamp** — display-only monospace span. Use `className="stamp"`
  as-is; no primitive needed.
- **PrintPreview** — 2 uses (`LabelCanvas`, `ReadyLabelCanvas`), but
  tightly coupled to canvas-refs + Niimbot print hook. Keep separate.
- **CRUD admin-page shell** — 5 uses (Branches, Technicians, Services,
  Inventory, RepairOptions) but fields and actions differ enough that
  extracting a shell component adds coupling more than it removes repetition.
  Document pattern, don't abstract.
- **EmptyState** — 8 uses of "centered muted text in a card." 3+ uses would
  justify extraction, but the existing CSS (`.card` + text styling) is
  close enough. Extract only if the Phase 3 migration reveals a consistent
  "no-data" panel shape.
- **PageHead** — 10 uses of `<div class="page-head">…</div>`. Same call —
  already well-factored as a CSS class pattern. Don't wrap; maybe add
  `<PageHead title sub actions>` if grep-replaceability is wanted. Defer
  decision to Phase 3.
- **Toolbar** — only in `OrderList` and `OrdersPage`. Each is custom
  enough. Skip.

### Primitives existing vs to build

- **Already in `components/`:** `Button.jsx` (underused), `Checkbox.jsx`
  (used only in DataTable), `StatusPill.jsx` (well-adopted — keep as-is),
  `DataTable.jsx` (used only in OrdersPage — keep as-is, add `testIdPrefix`
  prop).
- **To build in Phase 2:** `Input`, `Select`, `Textarea`, `Chip`, `Alert`,
  `FormField`, `SegmentedGroup`, `Card`, `Dialog`. Nine new files, sitting
  in a new `client/src/components/ui/` directory to keep the primitive
  layer discoverable.
- **To expand:** `Button.jsx` — add `danger`, `gold`, `subtle` variants +
  `loading` state + `testId` prop.
- **To reconcile:** local `Checkbox` in `OrderList.jsx` L491–507 — delete,
  adopt primitive.
- **To delete:** `OrderForm.jsx` (dead). Optionally `CostEditor.jsx`
  (single caller, inline into `ScanResult.jsx`).

---

## 3. Phase execution plans

### 3.1 Phase 2 — testid attachment

Canonical order runs testids first. All commits are pure additive diffs
(no visual/behavioral change). Each commit updates `tools/qa-audit/` (and
`server/tests/e2e/` if applicable) in the same commit, then runs
`node tools/qa-audit/audit.mjs` clean before push.

**Commit sequence (8 commits total):**

1. **`login` surface** — `LoginPage.jsx` (3 testids) + harness updates
   where login flow is referenced. Expect: `audit.mjs` 0 findings.
2. **`orders-list` surface** — `OrdersPage.jsx` (11 static testids) +
   `DataTable.jsx` `testIdPrefix` plumbing (caller-scoped emission) +
   harness migration of orders-list flows.
3. **`order-detail` surface** — `OrderDetail.jsx` drawer (~10 static + 2
   per-item) + harness migration of drawer flows.
4. **`new-order` surface** — `NewOrder.jsx` (~10 static + item/repair
   generators) + harness migration of new-order flow.

After these four, **report to reviewer** before continuing.

5. **Admin pages batch** — `BranchesPage`, `TechniciansPage`,
   `ServicesPage`, `InventoryPage`, `RepairOptionsPage`. Batched because
   the harness doesn't reference these yet by text; pure additive.
6. **Shared components batch** — `Layout`, `OrderList`, `CommandPalette`,
   `ScanResult`, `ManualEntryInput`, `PrintPanel`, `LabelCanvas`,
   `ReadyLabelCanvas`, `ToastProvider`, `CostEditor`. Batched.
7. **Remaining surfaces** — `Dashboard`, `TrackPage`, `ReportsPage`,
   `ScanPage` (add new testids alongside existing `mode-strip-single`),
   `LabelPrintPage`. Batched.
8. **Rename commit** — rename the 19 existing testids per §1.3 in JSX +
   `tools/qa-audit/audit.mjs` + `server/tests/e2e/*.test.js` in one
   commit. Run `npm run test:e2e` and `node tools/qa-audit/audit.mjs`
   green before push.

**After Phase 2:** stop and wait for reviewer approval before Phase 3.

### 3.2 Phase 3 — primitive build order

Honors dependencies. Each primitive ships in its own commit with unit
tests where non-trivial. Each primitive lives at
`client/src/components/ui/{Name}.jsx`. `ui/` is the canonical home;
anything there is harness-stable, tested, and documented in CLAUDE.md.

1. **Button** (expand existing) — no dependencies.
2. **Input** — no dependencies.
3. **Select** — no dependencies.
4. **Textarea** — no dependencies.
5. **Checkbox** — already exists; expand API (`testId`) and ship in this
   slot for consistency.
6. **Chip** — no dependencies.
7. **Alert** — no dependencies. Must meet §2.1 structural requirements.
8. **Card** — no dependencies.
9. **FormField** — depends on Input, Select, Textarea.
10. **SegmentedGroup** — depends on Button.
11. **Dialog** — depends on Button. Roll-your-own: focus-trap + ESC +
    backdrop-click, using RTL logical-property conventions from
    CLAUDE.md. Target ~80 LOC. **Escalation trigger:** if implementation
    exceeds 150 LOC or surfaces multiple accessibility edge cases
    (e.g. nested focus traps, iOS VoiceOver quirks), stop and escalate
    before pulling in `@radix-ui/react-dialog`.

### 3.3 Phase 4 — migration strategy

One primitive at a time. Per primitive:

1. `grep` for the legacy class string (`btn btn-primary`, `className="input"`,
   etc.). Count call sites; commit the count to the PR description.
2. Replace JSX call site by call site. Prefer Edit tool over Write.
3. Keep `data-testid` on the new primitive via `testId` prop — the
   attribute string is unchanged.
4. **Run `node tools/qa-audit/audit.mjs`** after every file's worth of
   changes. Expect 0 new findings. Any finding fails the migration.
5. **Run `npm test --prefix server`** — shouldn't be affected but catches
   any route/UI mismatch.
6. Commit with a message body citing the file count and primitive name.
7. Move to the next primitive.

**Per-primitive grep targets** (approximate, will refine during execution):

| Primitive   | Grep                                                          |
|-------------|---------------------------------------------------------------|
| Button      | `className="btn\|btn-primary\|btn-ghost\|btn-danger\|btn-sm\|btn-icon\|btn-gold"` |
| Input       | `className="input\|input-base\|input mono"`                   |
| Select      | `className="select"`                                          |
| Textarea    | `className="textarea"`                                        |
| Chip        | `className="chip"`                                            |
| Alert       | inline `oklch(0.58 0.21 25` / `oklch(0.60 0.15 150` literals  |
| Card        | `className="card"`                                            |
| FormField   | `className="field-label"` — replace label+input pair together |
| Dialog      | hand-rolled `window.confirm`, backdrop+panel inline styles    |
| Segmented   | `NewOrder` urgency pair, `TrackPage` DecisionRow, session-type |

**Don't migrate — leave alone:**
- **`TrackPage.jsx` DecisionRow buttons** — bespoke segmented pill. Migrate
  to `SegmentedGroup` only if the API fits cleanly; if not, leave as-is
  and document the exception. Track page is public-facing + high-test —
  not the place for scope creep.
- **`BarcodeScanner.jsx`** — library-owned DOM; do not modify.
- **Canvas drawing code** in `LabelCanvas` / `ReadyLabelCanvas` — the
  chrome (selects, buttons) migrates; the `<canvas>` and its draw code
  stays untouched.

**Commit cadence:** one commit per primitive migration, running harness
+ tests before each push. Never batch two primitives into one commit.
This cadence is non-negotiable per Risk #11 — it's the mechanism that
keeps reviewer throughput matched to migration throughput.

### 3.4 Phase 5 — legacy cleanup

One final commit (two at most) after all primitive migrations land:

- **Delete legacy CSS** from `client/src/index.css`: `.btn*` class
  family, `.input-base`, `.chip` rules if now dead, `.field-label` if
  now dead, `.card` if now dead. Grep first — any surviving consumers
  block this commit.
- **Delete `client/src/components/OrderForm.jsx`** — dead, no imports.
- **Inline `CostEditor.jsx` into `ScanResult.jsx`** and delete. Single
  caller; drops the last `.input-base` + naked `.btn-primary` legacy
  usage. This is one atomic commit alongside the OrderForm deletion,
  labeled "legacy cleanup."
- Run `audit.mjs` + `npm test --prefix server` + `npm run test:e2e`
  green before push.

### 3.5 Explicit non-goals

- **`window.confirm` → Dialog conversion** — out of scope. `window.confirm`
  in `BranchesPage` and `RepairOptionsPage` stays in place. Revisit in a
  separate UX track.
- **New design tokens / color palette changes** — this cleanup is
  structural. Color/typography decisions belong to a separate design pass.
- **Tailwind vs. CSS-class consolidation** — primitives will use Tailwind,
  and the CLAUDE.md rule "no new `.className` strings in `index.css`"
  lands with Phase 3. But we are **not** migrating existing CSS class
  definitions to Tailwind. The legacy class definitions survive in
  `index.css` until Phase 5 deletes the ones that are fully unused.
- **`PageHead` primitive** — not extracted. `.page-head` stays as a CSS
  class; CLAUDE.md documents: *use the `.page-head` class directly; do
  not wrap in a component.*

---

## 4. Risk register

Ten risks, each with one-line mitigation.

| # | Risk                                                                                                                                  | Mitigation                                                                                                                                                                       |
|---|---------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Two Button systems coexist** (JSX `Button.jsx` primitive + `.btn.*` CSS classes). Migration period has both.                        | Ship primitive expansion in Phase 2 as additive. Phase 3 migrates call sites. Only the final "remove legacy classes" commit touches `index.css` — keep it isolated.              |
| 2 | **`OrderList.jsx` local `Checkbox`** on `.cb` class collides with primitive.                                                          | Delete in same commit as Checkbox consolidation. One grep target: `className="cb"`.                                                                                              |
| 3 | **Bulk-scan existing testid convention** differs from `{slug}__{role}__{specifier}`. E2E suite reads current names.                   | Phase 4 renames JSX + harness + e2e in one commit (§1.3). Run `npm run test:e2e` before push.                                                                                    |
| 4 | **RTL-specific inline `left:` / `right:`** inside primitives would break Arabic layout.                                              | Primitives use logical properties (`padding-inline-start`, `margin-inline-end`) or CSS variables. No raw directional offsets inside `ui/`. Review checklist item for each PR.    |
| 5 | **Inline oklch literals less greppable** than CSS classes during migration.                                                            | Phase 2 Alert primitive owns the four banner colorways; Phase 3 migration collapses every inline `oklch(0.58 0.21 25 / 0.06)` background onto `<Alert variant="danger">`.        |
| 6 | **`window.confirm` → Dialog** is a behavior change (synchronous → async).                                                             | Keep `window.confirm` in place in Phase 3; add Dialog only where the design requires it. Scope-creep guard: do not substitute without an explicit UX reason.                     |
| 7 | **Three styling layers** (Tailwind + `index.css` utility classes + inline styles) without a clear rule for which to use when.         | Document in CLAUDE.md after Phase 2 lands: *primitives use Tailwind, one-offs use inline styles, no new `.className` strings added to `index.css`*. Enforce via code review.     |
| 8 | **Harness breakage mid-migration** (primitive renames `btn` → `<Button>`; `getByRole` still matches, but brittle text-only checks break). | Run `audit.mjs` after every commit. Swap ordering so testids land first (§3.2) — the harness relies on stable selectors, not text, during the refactor.                           |
| 9 | **Similar-looking, semantically-different** components (StatusPill vs Badge vs Chip vs Pill).                                         | Name by role, not appearance. StatusPill = order status (keep). Chip = filter-toggle (new). Badge = neutral count/flag (defer — only extract if Phase 3 finds 3+ uses).           |
| 10 | **CostEditor is dead-weight** (`.input-base` legacy class, single caller, pre-design-system).                                         | Inline into `ScanResult.jsx` in the Phase 5 "legacy cleanup" commit alongside `OrderForm.jsx` deletion. Zero remaining `.input-base` users after this.                              |
| 11 | **Migration fatigue across 20+ commits**. Rubber-stamp review makes the commit-per-primitive cadence pointless and hides regressions. | Reviewer (Ali) reads every diff, not rubber-stamps. If commit velocity rises without matching review time, that's the signal to pause. Primitive-level commit cadence is non-negotiable. |

---

## 5. Estimated time per phase

Rough effort, focused working time (not wall-clock). Each phase ends at a
review gate where the user approves before the next begins.

| Phase                                | Est. effort | Notes                                                                                                                                                     |
|--------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Phase 1** — plan (this doc)        | ~3 h        | Done on approval of the v2 doc.                                                                                                                           |
| **Phase 2** — testid attachment      | ~6 h        | 161 new testids across 26 surfaces + 19 renames + harness + e2e updates. 8 commits per §3.1. Verify each with `audit.mjs` clean.                         |
| **Phase 3** — build primitives       | ~4 h        | 9 new files + 1 expansion. Each ~25 min (skeleton + variants + test + export). Total including boilerplate and CLAUDE.md update.                          |
| **Phase 4** — migrate call sites     | ~12 h       | 11 primitives × ~1 h each (grep, replace, harness, commit, push). Button alone is ~3 h (200+ call sites). Alert, Chip, FormField each ~1 h.                |
| **Phase 5** — legacy cleanup         | ~2 h        | Delete legacy `.btn*` / `.input-base` / `.field-label` / etc. from `index.css`. Delete `OrderForm.jsx`. Inline + delete `CostEditor.jsx`. Update CLAUDE.md. |
| **Total**                            | **~27 h**   | ≈ 7 focused sessions of 4 h. Review gates add wall-clock lag; expect 2–3 calendar weeks end-to-end at current cadence.                                    |

**Time until conversation can resume with confidence each phase is done:**

- **Phase 1:** immediately after this doc is approved.
- **Phase 2 (testids):** after the final rename commit pushes with harness
  + e2e green, and `tools/qa-audit/QA-REPORT.md` shows 0 findings
  referencing only new testid names.
- **Phase 3 (primitives):** after 10-primitive commit series pushes green
  and `npm test --prefix server` stays green.
- **Phase 4 (migrate):** after the final per-primitive migration commit
  pushes with `audit.mjs` 0-findings and all tests green.
- **Phase 5 (legacy cleanup):** when `grep -r "\.btn\b\|\.input-base" client/src`
  returns zero matches and `index.css` has lost its legacy class
  definitions.

---

## 6. Decisions (resolved)

Reviewer decisions captured here for future lookup. Decision date:
2026-04-21.

1. **Phase reorder** — approved. Canonical order: plan → testids →
   primitives → migrate → legacy cleanup. See §3.
2. **`CostEditor.jsx`** — inline into `ScanResult.jsx` and delete. Done
   in the Phase 5 legacy-cleanup commit alongside `OrderForm.jsx`
   deletion.
3. **Dialog implementation** — roll our own (~80 LOC target; focus-trap,
   ESC, backdrop-click, RTL logical properties). Escalation trigger:
   stop and escalate before pulling `@radix-ui/react-dialog` if the
   implementation exceeds 150 LOC or multiple accessibility edge cases
   surface.
4. **`PageHead`** — not extracted. Document in CLAUDE.md: *use the
   `.page-head` class directly; do not wrap in a component.*
5. **`window.confirm` replacement** — explicit non-goal (§3.5). Not
   replaced during this cleanup.
6. **Alert structural requirements** — variants must differ by border +
   icon + weight, not just color. See §2.1.
7. **Phase 2 commit structure** — §3.1: 4 critical-surface commits
   (login, orders-list, order-detail, new-order) reported individually,
   then 3 batched commits (admin / shared / remaining), then 1 rename
   commit. Report after each of the 4 criticals; single summary at end
   of Phase 2.
