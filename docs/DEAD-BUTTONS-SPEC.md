# Dead-Button Specs

One-page design spec for every genuinely-dead button surfaced in `docs/QA-COVERAGE.md`.
No product code is modified in this pass — this document feeds a later implementation cycle.

## Step 0 — Enumeration

Dead buttons confirmed by source inspection (onClick handler genuinely absent).

| #   | Label (AR)                 | Icon             | Routes     | Roles         | Source                                 | Handler? | Notes                                                                                                                       |
| --- | -------------------------- | ---------------- | ---------- | ------------- | -------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1a  | تصدير (Export) — Dashboard | `Icons.Download` | `/`        | both roles    | `client/src/pages/Dashboard.jsx:76-78` | ❌ none  | Page-header action, sits alongside "تحديث". Most natural payload: the filtered orders table below.                          |
| 1b  | تصدير (Export) — Reports   | `Icons.Download` | `/reports` | workshop only | `client/src/pages/ReportsPage.jsx:52`  | ❌ none  | Page-header action. Most natural payload: aggregate status + branch summary (no orders table on this page).                 |
| 2   | إدخال يدوي (Manual Entry)  | `Icons.QR`       | `/scan`    | both roles    | `client/src/pages/ScanPage.jsx:80`     | ❌ none  | Sibling of "مسح آخر". Keyboard hint `<kbd>M</kbd> يدوي` already exists in the status bar, implying the feature was planned. |

### Excluded from the spec (verified NOT dead)

Harness false-negatives from the ≤20B DOM-delta heuristic documented in `docs/QA-COVERAGE.md`.

| Label                                           | Route                      | Source                  | Why it looked dead                                                                          | Actual handler                                         |
| ----------------------------------------------- | -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| مسح آخر                                         | `/scan`                    | `ScanPage.jsx:82`       | Reset on an already-reset scanner is a DOM no-op                                            | `onClick={resetScanner}` — works in the post-scan view |
| ✗ أرفض                                          | `/track/:token`            | `TrackPage.jsx:459-468` | Per-item reject flips a small CSS state (<20B)                                              | `onClick={() => onDecide('reject')}`                   |
| تسجيل الدخول                                    | `/login`                   | —                       | Empty form → button correctly disabled/no-op                                                | Real submit handler on filled form                     |
| الطلبات on workshop-only routes (shop_employee) | `/branches`, `/reports`, … | —                       | `<RoleRoute>` silently redirects shop_employee to `/`, sweep mislabelled Dashboard elements | Harness artifact, not a bug                            |
| Sidebar self-navigation                         | every route                | —                       | Clicking the current-page link is a no-op by design                                         | N/A                                                    |

---

## Step 1 — Per-button specs

### 1. تصدير (Export)

Splitting into **1a Dashboard-Export** and **1b Reports-Export**: the two buttons share a label + icon but have meaningfully different data sources (order rows vs aggregate counts), role scoping (both vs workshop-only), and user intent (transactional dump vs period summary). Collapsing them into one spec would hide decisions the human needs to make separately.

---

#### 1a. تصدير — Dashboard (`/`)

##### Current state

`Dashboard.jsx:76-78`. Renders `<button className="btn btn-sm"><Icons.Download size={12} /> تصدير</button>` in the page-header action row beside a working "تحديث" refresh button. No `onClick`, no handler, no disabled attr. Clicking does nothing — no toast, no navigation, no network call. Visible to both `workshop` and `shop_employee` roles. Dashboard's orders table (`OrderList`) respects two user-driven filters (`filterStatus`, `selectedBranch`) plus role scoping (shop_employee auto-filtered to `req.user.shop_id` on the server).

##### Inferred intent

Export the operator's current working view of orders — the list they're actively triaging. The placement (right next to "تحديث" and directly above the orders table) signals "act on what you see". For a workshop admin triaging rush jobs, this is the most frequent copy-paste/share operation (pasting into WhatsApp group, emailing branch managers, reconciling against paper).

##### Product questions for the human

1. **Format.** CSV, XLSX, PDF, printable HTML (native print dialog), or copy-to-clipboard? CSV is smallest lift and pastes cleanly into Google Sheets + Excel. XLSX preserves Arabic formatting and column widths. PDF is best for WhatsApp sharing. HTML-print reuses the existing label-print pattern and needs zero new deps.
2. **Scope.** Current filtered view (respect `filterStatus` + `selectedBranch`) or always-all? Current-view matches the visible rows; all-orders is more predictable but ignores the UI state the user just set up.
3. **PII.** Include full customer phone + name, or mask (e.g., `966•••••1234`, first name only)? Dashboard is visible to `shop_employee` — exporting full PII to a CSV that lands on a personal laptop is a soft data-leak vector. Today the on-screen row already shows these, so masking the export while the screen is unmasked is inconsistent.
4. **Filter interactions.** What about urgency, date range, search text? Dashboard has `is_urgent` as an implicit sort but no explicit filter — should export include the urgent flag as a column? Should there be a date-range picker before export, or does export always = "everything matching current filters"?
5. **Role scoping.** For `shop_employee`: export is already constrained to their `shop_id` on the server, so no extra work — but the button should probably be hidden entirely for shop_employee unless the product wants shop-level ops to have this tool. Worth asking.
6. **Filename.** `orders_YYYY-MM-DD.csv`? `BR{shopId}-orders-YYYY-MM-DD.csv` (scoped)? `orders-{status}-YYYY-MM-DD.csv` (filtered)? Filename is where "export provenance" lives — if the user opens three exports in the same folder, the filename is the only context.
7. **Empty state.** If the current filter yields zero rows, does the button disable, toast "لا توجد طلبات للتصدير", or produce a header-only CSV?

##### Recommended default behavior

- **Format: CSV (UTF-8 with BOM)** — single new dep (`papaparse` or none, CSV is trivial); opens cleanly in Excel with Arabic intact; pastes into Sheets without ceremony.
- **Scope: current filtered view** — `getOrders({ status: filterStatus, shop_id: selectedBranch })` re-fetched at click time to avoid stale client state.
- **PII: include full phone + name** — matches on-screen visibility; masking would require a PII-policy decision that's out of scope here. Document the decision in CLAUDE.md under "Data handling".
- **Columns: order_number, customer_name, phone, piece_type, status, is_urgent, cost, created_at, shop_name** — nine fields, matches what the row shows plus `shop_name` for multi-branch context.
- **Role: visible to both roles; server-side scoping already enforced for shop_employee** — no client-side hiding.
- **Filename:** `orders-{status or "all"}-{YYYY-MM-DD}.csv`.
- **Empty state: disable button when `orders.length === 0` with tooltip "لا توجد طلبات للتصدير"**.

##### Implementation sketch

- `client/src/utils/export.js` — new helper `ordersToCsv(orders) → Blob`. Escapes quotes, adds UTF-8 BOM (`\ufeff`) so Excel detects encoding.
- `client/src/pages/Dashboard.jsx` — add `handleExport` that re-calls `getOrders({ status, shop_id })`, pipes into `ordersToCsv`, triggers `URL.createObjectURL` + anchor click. Disable button when the rendered `OrderList` reports zero rows (needs `OrderList` to pass count up via `onCountChange`, or Dashboard re-fetches).
- No server changes — `GET /api/orders` already supports the filter params.
- Localize column headers in Arabic: `رقم الطلب, اسم العميل, الجوال, القطعة, الحالة, مستعجل, التكلفة, تاريخ الاستلام, الفرع`.

##### Out of scope / risks

- **XLSX or PDF formats** — bigger dep, different escaping rules.
- **Scheduled exports / email delivery.**
- **Audit log** of who exported what (could matter for PII policy — flag for follow-up).
- **Risk: silent PII leak.** An employee can click → CSV on disk → USB stick → gone. If the shop has any regulatory obligation around customer data, CSV export is the #1 exfil path. Mitigation if paranoid: workshop-only, or server-side export with audit row written.
- **Risk: filter drift.** If the server response doesn't match what's on screen (race between filter change and click), the CSV diverges from what the user expected. Re-fetch at click time, not reuse of client state.

##### Effort estimate

**S (4–8 hours).** New helper + click handler + empty-state disable + column header translations + manual QA of Arabic encoding in Excel on Windows + macOS. Would be XS if it were English-only with no PII question, but Arabic encoding + PII-policy conversation + disable-logic push it to S.

---

#### 1b. تصدير — Reports (`/reports`)

##### Current state

`ReportsPage.jsx:52`. Same `<button className="btn btn-sm"><Icons.Download size={12} /> تصدير</button>` in the page header. No handler. Workshop-only route (`<RoleRoute roles={["workshop"]}>` in `App.jsx:37`). The page itself renders two things: status-count stat cards (`getStats()` → `{new: 12, received: 3, ...}`) and a branch breakdown grid (`getBranchStats()` → `[{shop_id, shop_name, received, in_progress, ready, pending_approval}]`). There is no orders list on this page — export here means "the numbers shown", not "the rows".

##### Inferred intent

Period summary report. The typical user is a workshop owner or admin generating a weekly/monthly snapshot for their own records or for sharing with shop managers: "here's where orders are, and here's how each branch is loaded right now." Less frequent than Dashboard-Export, higher production value per export.

##### Product questions for the human

1. **Format.** CSV (two sheets worth crammed into one file is awkward), XLSX (cleanly handles two sections), PDF (best for print/share), or printable HTML? PDF reads like a proper report; CSV/XLSX lets the user paste into their own dashboard.
2. **Scope — period.** "Current state right now" (what the page shows) or "activity over a date range" (orders completed/created between dates X and Y)? The page currently shows **only** the right-now snapshot. Adding date-range export means adding a date-range picker to the page, or generating server-side with date params.
3. **What gets included.** Just the 8 status counts? Plus the 4 per-branch numbers for each shop? Plus totals row? Plus `pending_approval` alert count? The page shows a hierarchy (status summary → branch breakdown); export should mirror it.
4. **Role.** Workshop-only today via route. Does the product ever want shop_employee to export a report scoped to their own shop? (Not today — `/reports` is gated — but the question matters if/when Reports becomes role-shared.)
5. **Filename.** `report-YYYY-MM-DD.pdf`? `workshop-report-YYYY-MM-DD.xlsx`? Include owner name or workshop name from settings?
6. **Historical vs live.** Should the report include a timestamp header ("تقرير مُنشأ في {datetime}") and the generator's username? This is the kind of report that ends up attached to WhatsApp weeks later, and an undated PDF is painful.
7. **Empty state.** If there are zero orders across all statuses, does the button disable, or produce a "zeros everywhere" report?

##### Recommended default behavior

- **Format: printable HTML via native print dialog** (same pattern as universal label printing — no new dep, user can Save-as-PDF from the OS print dialog, or send to a real printer). Workshop owners already use macOS/Windows print-to-PDF daily.
- **Scope: right-now snapshot** (matches what the page displays). Add date-range later if the user asks.
- **Content: two sections** — (1) Status summary table (the 8 STAT_CARDS as a table), (2) Branch breakdown table (the branchStats grid as a table). Plus header with workshop name + generated-at timestamp + generator username.
- **Filename (for "Save as PDF"): `workshop-report-{YYYY-MM-DD}.pdf`** — browser uses the document title as the default filename hint; set `document.title` on the print window.
- **Empty state: button always enabled** — a zero-everywhere report is still a valid statement ("yes, we have nothing open").

##### Implementation sketch

- `client/src/utils/reportPrint.js` — new `openReportPrintWindow({ stats, branchStats, generatedAt, username })`. Opens `window.open('')`, writes a minimal HTML document with embedded CSS (@page size A4, RTL, Almarai font fallback to system), injects the two tables, calls `window.print()`. Same technique as `handleUniversalPrint` in `useLabelPrint.js`.
- `ReportsPage.jsx` — add `handleExport` wired to the button. Pulls `stats`, `branchStats` from existing state; fetches username from `auth.js::getRole`-adjacent helper (add `getUsername()` if missing).
- No server changes.
- Header content in Arabic: `ورشة مذهيّان — تقرير مُنشأ في {ar-SA-formatted datetime} — بواسطة {username}`.

##### Out of scope / risks

- **Date-range reports.** Genuinely useful, but requires a UI picker and new server params. Punt to a follow-up.
- **Charts in the export.** The sparkline + bar graphics on the page look nice but don't translate well to print without canvas-to-PNG conversion. Tables-only for V1.
- **Scheduled / emailed reports.**
- **Risk: print dialog quirks.** Arabic font fallbacks vary between browsers; Safari's print preview drops font-family hints in some `@page` contexts. Test on Chrome + Safari before calling it done.
- **Risk: header-only report with no orders.** If a workshop has genuinely zero orders, the report is 8 rows of zeros + "no branches" — informative but visually thin. Acceptable.

##### Effort estimate

**S (6–10 hours).** Print-window helper is non-trivial once — you're writing an HTML document with inline CSS, Arabic fonts, and RTL direction — but the pattern exists in the label-print code. The effort isn't the code; it's the cross-browser print-dialog testing + making the output not look amateurish. Add PDF download via a lib (`jspdf` + `html2canvas`) and it moves to M.

---

### 2. إدخال يدوي (Manual Entry)

##### Current state

`ScanPage.jsx:80`. `<button className="btn btn-sm"><Icons.QR size={13} /> إدخال يدوي</button>` in the page-header action row beside "مسح آخر". No `onClick`. Visible to both roles. A keyboard hint elsewhere on the page (`<span className="kbd">M</span> يدوي` at line 121) implies a planned `M` shortcut. The page's purpose is resolving a scanned value to an order via `getOrderByBarcode(value)` → `/api/orders/barcode/:value` → `GET /api/orders/:id`.

##### Inferred intent

Let the operator resolve an order **when camera scanning fails** — smudged label, broken camera, phone not at hand, staff handling a paper slip that was misprinted. Today, if the scanner can't read the barcode, there's no fallback. The operator has to go back to the orders list, search by customer name, and open the order manually. Manual Entry is the "type it in" escape hatch.

##### Product questions for the human

1. **What does the user type — order number, barcode value, customer name, phone number, or any-of-the-above search?** This is the single biggest ambiguity.
   - **Order number** (`BR1-20260420-0022`): the string printed on the label. Canonical identifier, always unique, operator sees it on the paper. Matches the existing `getOrderByBarcode` endpoint if the barcode value equals the order number (it does — `CODE128` encodes the order number).
   - **Barcode value**: identical to order number in this codebase, so same as above.
   - **Customer name**: Arabic free-text match; useful when the label is completely lost but the customer is standing there. Requires server-side search.
   - **Phone number**: `966XXXXXXXXX` format; useful when the customer gives their phone to look up their own order.
   - **Any-of-the-above**: one input that tries each in order (order-number prefix → phone → name). Fuzziest but most forgiving.
2. **Input UI.** Modal dialog, inline drawer, replace the camera card with an input, or a dropdown under the button? Modal breaks the two-column layout least; inline replacement gives a keyboard-focused flow.
3. **Submit behavior on multiple matches** (only relevant if "any-of-the-above"): show a list of matches, auto-pick first, or reject ambiguous input? A list is most correct but doubles the UI surface.
4. **Role.** Both roles today see the button. Should `shop_employee` search be scoped to their shop_id (today's `getOrders` already does this server-side), or are there cross-branch lookups where that restriction bites? Today all scan flows go through `getOrderByBarcode` which returns any order by number — making name/phone search cross-branch for shop_employee would be a regression from current scoping norms.
5. **Keyboard shortcut.** The page already declares `<kbd>M</kbd> يدوي` in the status bar. Wire the button's action to also fire on the `M` key? If yes, does `M` focus the input or toggle the input's visibility?
6. **On submit not found.** Same `/api/orders/barcode/:value` error shape? Or an enriched error suggesting "maybe try phone"?
7. **Validation.** Should the field reject whitespace-only input, or submit anyway and let the server 404?

##### Recommended default behavior

- **What the user types: order number only, for V1.** It's the canonical identifier on the label, reuses `getOrderByBarcode` verbatim (zero server work), and avoids opening the cross-branch scoping can of worms. Phone / name search is a follow-up feature that warrants its own design pass.
- **UI: inline input that replaces the camera card on click** — preserves the two-column layout (camera-or-input on the left, result on the right). Text input + submit button. Auto-focus on open.
- **Button toggles input visibility; `M` key same toggle; `Esc` closes back to camera mode.**
- **Submit: trim whitespace, reject empty, call `handleScan(value)` (same code path as the camera).** Reuses error handling, reuses "not found" toast, reuses the success flow.
- **Role: visible to both roles.** Server-side 404 for cross-shop lookups is acceptable; the input takes an order number, not a search query.
- **Placeholder: `BR1-20260420-0022`** — shows the format without needing separate help text.

##### Implementation sketch

- `client/src/pages/ScanPage.jsx` — add `manualMode` state. When true, render `<ManualEntryInput onSubmit={handleScan} onCancel={() => setManualMode(false)} />` inside the left card instead of `<BarcodeScanner>`. Button's `onClick={() => setManualMode(m => !m)}`. Add a `useEffect` keydown listener for `M` (toggle) and `Esc` (close) — mind the existing RTL-input gotchas.
- `ManualEntryInput.jsx` — new small component: label, text input, submit button, cancel link. `ref.focus()` on mount.
- No server changes. No new API.
- Reuse `handleScan` unchanged so the found/error/loading state machine stays intact.

##### Out of scope / risks

- **Search by name / phone / fuzzy any-of-the-above.** Separate feature. Document as a follow-up.
- **Barcode format validation.** Don't regex-match the order-number format on the client — if the format changes, validation breaks silently. Let the server 404 be the source of truth.
- **Risk: keyboard shortcut conflict.** `M` is a common key; if the user is typing in another focused input on the page (today there is none, but future additions) the shortcut could fire accidentally. Gate on `document.activeElement.tagName !== 'INPUT'`.
- **Risk: RTL input focus.** Arabic-aware input focus with auto-complete off — test on Safari/Firefox, not just Chrome.
- **Risk: reopening `manualMode` while `state === 'found'`.** Should switching to manual mode reset the scanner? Probably yes — mirror `resetScanner`'s behavior on open.

##### Effort estimate

**S (3–6 hours).** Small new component + toggle state + keyboard listener + focus management + RTL placeholder testing. Stays in the S band because no server changes and no data-model changes. Grows to M if product picks any-of-the-above search, which requires a new `/api/orders/search` endpoint with role scoping.

---

## Step 2 — Summary table

| #   | Button            | Route(s)   | Role(s)  | Effort | Recommended?       | One-line rationale                                                                                                     |
| --- | ----------------- | ---------- | -------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1a  | تصدير — Dashboard | `/`        | both     | S      | **Needs decision** | Useful daily, but PII-on-disk policy question should be answered first. Cheap to build once that's settled.            |
| 1b  | تصدير — Reports   | `/reports` | workshop | S      | **Ship**           | Clear win, no PII concern (aggregates only), reuses print-window pattern, workshop owners already want this.           |
| 2   | إدخال يدوي        | `/scan`    | both     | S      | **Ship**           | Real gap in the scan flow (no fallback when camera fails). Small surface, reuses existing endpoint, zero product risk. |

---

## Appendix — State-gated dead buttons (not covered by sweep)

Buttons found by source inspection, not by the coverage harness, because they live behind conditional renders the sweep couldn't reach.

### فتح الطلب — /scan (post-scan view)

- File: client/src/pages/ScanPage.jsx:147
- Rendered when: order && (after a successful barcode scan returns a result)
- Handler: onClick={() => {}} — explicit no-op stub
- Inferred intent: open the matched order, most likely navigate to /orders/:id or open the OrderDetail drawer
- Status: flagged only — not specced in this pass. Needs a separate decision on drawer-vs-navigate pattern, which is larger than a single button question.
