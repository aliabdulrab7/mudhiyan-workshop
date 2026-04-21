# Bulk-scan sessions on /scan

Status: **Spec** — no code yet. Awaiting human review before build.
Last updated: 2026-04-21

## Decisions already made

- **Lives as a toggle on `/scan`**, not a new route. The existing single-scan UI (manual-first + optional camera, per commits `25f239a` + `612f87a`) stays untouched when the bulk toggle is off.
- **Three session types**, each locked to one target state plus a whitelist of accepted source states. Never free-form "change any order to any status":
  1. **Intake from branches** · workshop only · `new` → `received`
  2. **Prepare for return** · workshop only · `quality_check` OR `rejected` → `ready_for_return`
  3. **Pickup from workshop** · shop_employee only · `ready_for_return` → `returned_to_shop`
- **Strict source-state enforcement.** An order not in an expected source state is rejected loudly in the running list — never auto-advanced through intermediate states.
- **Three feedback channels, non-overlapping roles:**
  - **Audio** — per-scan success beep / error buzz. Workflow channel: tells the operator whether to pick up the next piece or look at the screen.
  - **Running list** — per-row result with reason. Evidence channel: the operator's paper trail.
  - **Toast** — session-level events only (session started, session ended, N orders processed). Not per-scan.
- **Session ends** via explicit "إنهاء الجلسة" button (primary). Auto-end on navigating away from `/scan` or closing the tab (safety net, not the expected path).
- **Duplicate scan inside the same session**: non-blocking error, session continues. Specific UX — see § Duplicate behavior below.
- **Input hardware: USB/Bluetooth keyboard-wedge scanner** (confirmed 2026-04-21). The barcode arrives as a stream of typed key events terminated by Enter. No camera flow in bulk mode.
- **API: one-at-a-time PATCH** for V1 (see § API & server changes for the tradeoff).
- **Audit via notes threading** — no new schema columns. See § Audit trail.

## Inferred intent & non-goals

Bulk-scan exists because three recurring workshop workflows involve transitioning a stack of orders through exactly the same state change in rapid succession: the morning intake from branches, end-of-day handoff to the shop for pickup, and the shop's confirmation when the pieces arrive. Today each of these is done one-at-a-time via the normal scan-drawer flow — scan, wait for drawer, find the action button, click, close, next. The action is always the same for every order in the batch; the per-order round-trip through a modal is pure friction.

The feature is **not** a generic status-override tool. It does not let an operator freely pick any source → target combo; the three session types are hard-coded and each is gated on role. It does **not** bypass the approval workflow — no bulk session touches `waiting_approval`, `approved`, or `rejected` as a *target*; those flow decisions stay in the drawer where they belong. It is also **not** for single-order use — if the operator scans once and walks away, that's fine, but nothing about the UX is optimized for that case; it will feel heavier than the normal single-scan flow, which is the point of the mode switch.

Finally: bulk-scan is **workshop-floor ergonomics**, not a reporting feature. Running lists are ephemeral (no server persistence beyond the audit log); the summary screen is for the operator's own confidence, not for later querying. If the business later wants "show me all bulk sessions from Tuesday," that's a separate reporting feature that reads from `order_status_history.notes` — called out in § Audit trail.

## User flow — walked through for each session type

### Session type 1: Intake from branches (workshop)

Morning. A courier bag of 18 jewelry items from two branches lands on the workshop counter. Each piece has a label with the order barcode printed at the branch when the order was created (status `new`).

1. Operator walks to the scan station, opens `/scan`, toggles **"مسح دفعي"** on.
2. Session-type selector appears. Operator picks **"استلام من الفرع"**. The mode header switches to a prominent yellow strip at the top: `مسح دفعي · استلام من الفرع · 0 تمّ`. A "جاهز للمسح" badge pulses on the right edge of the scan input. Audio test-chirp plays once (so they know sound is on and working).
3. Operator picks up the first piece, triggers the wedge scanner. A `beep` (~800Hz, 80ms) sounds within ~200ms and a row appears in the running list: `BR1-20260421-0003 · استلام ناجح · 01:14:22`. Counter bumps to 1.
4. Second piece — same motion. Beep, row. Operator glances at the screen to confirm the counter; their eyes can stay on the pile.
5. Fifth piece: `buzz` (lower, 200Hz, 200ms) and a red row: `BR2-20260421-0019 · الطلب في حالة 'in_repair' وليس 'new' · تجاوز`. This was probably a piece the courier accidentally grabbed on their way out; it's already been processed. The operator sets it aside physically.
6. Piece 11 is a re-scan by accident — the operator already scanned it and set it down, then picked it up again. The row at position 3 briefly flashes red, a buzz sounds, no new row appears. The counter doesn't move.
7. Done with the bag. Operator clicks **"إنهاء الجلسة"**. Summary screen: "**16 تم · 1 مرفوض · 1 مكرر**" with the full list. Toast confirms. They click "جديد" to start another session or toggle bulk off.

### Session type 2: Prepare for return (workshop)

End of the repair day. Technicians have marked 12 pieces `quality_check` (passed QA) and 2 pieces `rejected` (customer refused the quote and the piece is being returned untouched). All 14 need to become `ready_for_return` so the branch can send someone to pick them up.

1. Operator opens `/scan` → bulk on → picks **"تجهيز للإرجاع"**.
2. Scan the 14 pieces. Each emits a success beep; rows fill the list.
3. One piece scans red: `BR3-20260420-0007 · الطلب في حالة 'in_repair' — لم يكتمل الفحص`. This piece wasn't actually through QC yet; operator pulls it out of the stack and sets it back on the QA bench.
4. Finish: click "إنهاء الجلسة". 13 tم, 1 rejected.

### Session type 3: Pickup from workshop (shop_employee)

The branch employee arrives at the workshop to collect pieces ready for their shop. They open `/scan` on the workshop's shared tablet (logged in as `employee1`), toggle bulk, pick **"استلام من الورشة"**.

1. They scan each piece as the workshop hands it over. Each beep is both a confirmation for them and an audible acknowledgement to the workshop that the transfer is recorded.
2. One piece scans red: `BR1-20260418-0005 · هذا الطلب لفرع آخر — لا يمكنك استلامه`. The shop_employee sees it belongs to a different branch; they hand it back.
3. End session. Summary: 8 tم, 1 rejected (wrong branch). The shop_employee leaves with the 8 pieces.

## UI spec

### The single/bulk mode switch

A **mode header** at the very top of the `/scan` content area, above the current "مسح الباركود" title. Not a tiny toggle — a full-width strip, ~56px tall, with distinct color per mode:

- **Single mode** (default): white/neutral strip. Small right-aligned button: `تبديل إلى الوضع الدفعي`.
- **Bulk mode, no session active**: yellow strip (oklch ~0.95 0.12 90). Full-width centered: `الوضع الدفعي — اختر نوع الجلسة`. Right-aligned: `إلغاء الوضع الدفعي`.
- **Bulk mode, session active**: amber strip (oklch ~0.82 0.17 70). Centered: `مسح دفعي · {session type label} · {N} تمّ · {M} مرفوض`. Right-aligned: `إنهاء الجلسة`.
- **Bulk mode, session ended (summary view)**: green strip (oklch ~0.88 0.14 150). `اكتملت الجلسة — {N} طلب تمّ معالجته`. Right-aligned: `جلسة جديدة` + `الرجوع للوضع العادي`.

Rationale: a wrong-mode scan advances a real order's state. The operator must know at a glance which mode is live. A color-coded strip visible from across the room is the right weight. A small header-right toggle like the one the manual-entry button used pre-revision is **too quiet** for this feature and will cause mis-scans.

### Session-type selector (bulk on, no session)

Center of the page, card with three large buttons stacked vertically (each ~80px tall). Each button shows title + source-state chip + target-state chip + role hint:

```
┌─────────────────────────────────────────┐
│  استلام من الفرع                         │
│  [new] → [received] · ورشة فقط           │
├─────────────────────────────────────────┤
│  تجهيز للإرجاع                          │
│  [quality_check | rejected] → [ready]    │
│  · ورشة فقط                              │
├─────────────────────────────────────────┤
│  استلام من الورشة                        │
│  [ready_for_return] → [returned]         │
│  · فرع فقط                               │
└─────────────────────────────────────────┘
```

Role-inappropriate buttons are **hidden** (not disabled) — a shop_employee sees only session 3. Rationale: disabled buttons invite "can I do this?" questions and social friction; invisible buttons don't.

### In-session UI

Layout, tablet-width or wider (≥768px):

```
┌───── Mode strip (amber, full-width, 56px) ─────────┐
│  مسح دفعي · استلام من الفرع · 5 تمّ · 1 مرفوض │ إنهاء الجلسة │
└────────────────────────────────────────────────────┘

┌── Scan ready indicator (right-edge of input) ──┐
│  [ ● جاهز للمسح ]    أو    [ ⚠ الجلسة متوقفة ] │
└────────────────────────────────────────────────┘

┌───── Running list (vertically expanding) ──────────┐
│ ✓  BR1-20260421-0003   استلام ناجح     01:14:22    │
│ ✓  BR1-20260421-0008   استلام ناجح     01:14:28    │
│ ✗  BR2-20260421-0019   الحالة in_repair  01:14:33  │
│ ✓  BR1-20260421-0021   استلام ناجح     01:14:39    │
│ ↻  BR1-20260421-0003   مكرر — تم تجاهله  (flashes red on row 1) │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

The input itself is **hidden** (`opacity: 0; position: absolute; width: 1px; height: 1px`) but has `autoFocus` and is the permanent focus target — see § Input focus management below. The operator never sees a text cursor. What they see is the **"جاهز للمسح" badge**: a pulsing green dot + Arabic label at a fixed position (top-right of the list card) that says the session is listening. When the input loses focus (modal opened, operator tabbed away), the badge changes to amber and reads "اضغط هنا لاستئناف المسح" — click that badge and focus returns.

Counters live in the mode strip, not duplicated in the list card. The list itself scrolls internally once it exceeds ~400px; newest entry is at the top (newest-first), so the operator's eyes don't have to follow a moving bottom edge during a fast run. Each row has a color left-border (green / red / amber for duplicate).

### Mobile viewport (<768px)

Workshop staff do sometimes operate off a shared iPad or a phone. Constraints:

- Mode strip: same, but may wrap counters to a second line.
- Running list: becomes the dominant viewport element, list rows collapse to single-line `{stamp} · {icon} · {time}` with the error reason revealed via tap.
- Session-type selector: the three cards stack with 100% width and slightly smaller targets (~72px each).
- Scanner wedge reality: Bluetooth HID keyboard scanners still work when paired to a tablet/phone — the hidden input pattern is unchanged.
- The "جاهز للمسح" badge needs to remain visible without scroll — sticky-position it.

### Empty / loading / error states

- **Empty running list (no scans yet)**: centered placeholder "لم يتم مسح أي طلب بعد — ابدأ المسح". Keeps the list card from looking broken on first session open.
- **Per-row loading** (scan accepted, PATCH in flight): row appears immediately with a grey spinner icon, placeholder text "جاري المعالجة…". Resolves to success/error in place. Typical round-trip is <200ms on LAN so this is rarely seen, but must not pop in late.
- **Global error** (server unreachable for >5 seconds on a pending scan): mode strip turns red, banner overlays: `فقد الاتصال بالخادم — حاول مجدداً خلال ثوانٍ`. Pending rows show the network error reason. Session is **not** auto-ended; operator decides.
- **Server 5xx** on a single scan: that row shows `خطأ مؤقت — أعد المسح`. Session continues.

### Arabic copy, every new string

| Key                      | Arabic                                        |
|--------------------------|-----------------------------------------------|
| Toggle to bulk           | `تبديل إلى الوضع الدفعي`                       |
| Cancel bulk mode         | `إلغاء الوضع الدفعي`                            |
| Bulk header (no session) | `الوضع الدفعي — اختر نوع الجلسة`                |
| Session type 1           | `استلام من الفرع`                              |
| Session type 2           | `تجهيز للإرجاع`                               |
| Session type 3           | `استلام من الورشة`                             |
| Session-type hint — workshop only | `ورشة فقط`                          |
| Session-type hint — shop only     | `فرع فقط`                          |
| End session              | `إنهاء الجلسة`                                 |
| New session              | `جلسة جديدة`                                   |
| Back to normal mode      | `الرجوع للوضع العادي`                          |
| Scan-ready badge         | `جاهز للمسح`                                   |
| Scan-paused badge        | `اضغط هنا لاستئناف المسح`                      |
| Empty list placeholder   | `لم يتم مسح أي طلب بعد — ابدأ المسح`            |
| Row status — success     | `استلام ناجح` / `تم التجهيز` / `تم التحويل للفرع` (depends on session type) |
| Row status — in-flight   | `جاري المعالجة…`                              |
| Row status — duplicate   | `مكرر — تم تجاهله`                             |
| Counters — done / rejected | `تمّ` / `مرفوض`                              |
| Summary header           | `اكتملت الجلسة — {N} طلب تمّ معالجته`          |
| Mute toggle (on)         | `كتم الصوت`                                    |
| Mute toggle (off)        | `تفعيل الصوت`                                  |
| Connection lost banner   | `فقد الاتصال بالخادم — حاول مجدداً خلال ثوانٍ` |

Error-specific strings are in § Error taxonomy below.

## State machine (session-level, client-side)

```
     ┌──────┐   toggle on      ┌────────────────┐  pick type
     │ idle │─────────────────▶│ mode_selected  │──────────────┐
     └──────┘                  └────────────────┘              │
        ▲                              │                       ▼
        │                              │ toggle off /     ┌──────────┐
        │                              ▼ cancel           │ scanning │
        │                           ┌──────┐              └────┬─────┘
        │    "الرجوع للوضع العادي"  │ idle │                   │
        │◀──────────────────────────┴──────┘                   │
        │                                                       │ click
        │                                        toggle off /   │ إنهاء
        │                                       close tab       │
        │                                         (auto-end)    ▼
        │                                                  ┌────────┐
        │                                                  │ ending │
        │                                                  └───┬────┘
        │                                                      │ last
        │                                                      │ PATCH
        │                                                      │ settles
        │                                                      ▼
        │                                                  ┌─────────┐
        └──────────────────────────────────────────────────┤ summary │
             "جلسة جديدة" (back to mode_selected, same type)└─────────┘
```

| State | Can scan? | Keyboard input listens? | UI shown |
|-------|-----------|------------------------|----------|
| `idle`          | no  | no  | Normal /scan, mode-strip "Single" |
| `mode_selected` | no  | no  | Session-type selector |
| `scanning`      | yes | yes | Running list + amber strip |
| `ending`        | no  | no  | "جاري إنهاء الجلسة…" overlay until last PATCH resolves |
| `summary`       | no  | no  | Summary card, green strip |

Error branch: network-lost or 5xx during `scanning` stays in `scanning` — per-row error, session continues. Auth-lost (401) forces transition to `idle` with a session-aborted toast.

## API & server changes

**Decision: option (a) — one-at-a-time per-order transition, one HTTP request per scan.** No new bulk endpoint that accepts an array.

**Justification:**
- Server is already correct per-order. `OrderService.transition` enforces role, source-state, lock, and notification side-effects atomically. Every bulk invariant we need is already there.
- Each transition writes its own `order_status_history` row naturally. No batch-audit bookkeeping.
- Partial failures become per-row error reasons the operator can physically sort pieces against. A bulk endpoint's "5 succeeded, 3 failed" response needs equivalent per-item status in the response body anyway — we'd be rebuilding the existing per-order semantics on top of a transaction that can't cleanly half-commit.
- Zero batch-level server work. Revisit if round-trip time becomes a problem at scale (unlikely on LAN for workshops with tens of orders/day).

**Tradeoff we accept:** if the operator loses internet mid-session, some orders were transitioned and others were not, with **no atomic undo**. The running list is the source of truth for the operator — each row reflects what actually happened, per scan. If a partial session needs recovery, the workshop's existing per-order detail view + status history is the remediation path, not a bulk-session rollback. This is consistent with how the single-scan flow already works and does not regress any guarantee the workshop already relies on.

**Server changes required:**

1. A new route **`PATCH /api/orders/by-barcode/:barcode/status`** that mirrors the existing `PATCH /:id/status` in every respect except the identifier — it looks the order up by `order_number` instead of numeric id. This collapses what would otherwise be a `GET /barcode/:value` + `PATCH /:id/status` pair into a single round-trip per scan.
2. Both PATCH routes accept three new optional body fields (`source`, `session_id`, `session_type`) and thread them into the history row's `notes` when `source === 'bulk_scan'`.
3. The error body for `InvalidTransitionError` gains a `code: 'INVALID_TRANSITION'` discriminator and a `details.current_status` field so the client can name the actual state in the Arabic error row without a separate GET.

Contract:

```
PATCH /api/orders/by-barcode/:barcode/status         ← new (bulk path)
PATCH /api/orders/:id/status                         ← existing (single-scan path)

body: {
  status:       <target state>,
  notes:        <operator free-text, optional, existing>,
  source:       'bulk_scan' | undefined,     // new, optional
  session_id:   'a1b2c3d4' | undefined,      // new, optional, 8-char client UUID slice
  session_type: 'intake_from_branches' | 'prepare_for_return' | 'pickup_from_workshop' | undefined
}

invalid-transition error body:
{
  error:   "لا يمكن الانتقال من 'in_repair' إلى 'received'",
  code:    "INVALID_TRANSITION",
  details: { current_status: "in_repair" }
}
```

When `source === 'bulk_scan'` and both other fields are present, the route layer rewrites `notes` before passing to `OrderService.transition`:

```js
const bulkNote = `bulk-scan · session:${session_id} · type:${session_type}`;
const combinedNotes = notes ? `${bulkNote} · ${notes}` : bulkNote;
```

If `source` is absent, behavior is byte-for-byte the same as today on the existing `:id/status` endpoint. This is additive and backward-compatible — single-scan clients never set these fields. The by-barcode route is new and only used by bulk.

**Client-side per-scan flow:**
1. Operator triggers wedge → hidden input's value becomes `BR1-20260421-0003\n` → submit on Enter.
2. Client validates format (`^BR\d+-\d{8}-\d{4}$`), rejects obvious garbage locally.
3. `PATCH /api/orders/by-barcode/:barcode/status` with target state + the three bulk fields. Single round-trip.
4. Success → green row. Invalid-transition error → red row, interpolating `details.current_status` from the error body into the Arabic message. Other errors → red row per § Error taxonomy.
5. Apply 150ms input lockout (see § Input focus management).
6. Play success/error tone.

## Audit trail

Every bulk-scan transition writes an `order_status_history` row *through the same code path* as single-scan (`OrderService.transition` → `INSERT INTO order_status_history`). The only difference is the `notes` column content.

- **`changed_by`**: the authenticated username. Not suffixed — `"workshop"`, not `"workshop/bulk"`. This keeps the column purpose "who did this" rather than mixing who + how.
- **`notes`** format for bulk rows: `bulk-scan · session:{uuid8} · type:{session_type_slug}`. Optional operator free-text (rare — we don't surface a notes field in bulk UI) concatenates with `· {text}`.
- **`session_id`**: client-generated UUIDv4 truncated to the first 8 chars. Good enough for "find all rows from the same session" grouping in SQL; no security/uniqueness guarantees needed (the server never trusts it, just echoes it).
- **Distinguishing from single-scan history in reports**: filter `notes LIKE 'bulk-scan %'`. The marker is always at position 0 of the string, so a simple `LIKE` or `startsWith` works. `session:` and `type:` tags make "all intake batches by workshop-user this week" a trivial SQL query without a schema migration.

Example row after an intake bulk scan by user `workshop`:

```
id  order_id  from_status  to_status  changed_by  notes                                                        created_at
15  42        new          received   workshop    bulk-scan · session:a1b2c3d4 · type:intake_from_branches     2026-04-21 08:14:22
```

If the business later wants a "bulk-session browser" UI, it reads these rows — no migration, no new table. That's a separate feature, explicitly out of scope here.

## Audio feedback

**Implementation: WebAudio API `OscillatorNode` + `GainNode` envelope.** No audio assets, no network, no user-gesture prompts beyond the initial session-start click (which satisfies the browser's autoplay policy for the rest of the session). Single shared `AudioContext` created lazily on the first `"ابدأ الجلسة"` click.

Two tones:

```js
// Success — crisp, pleasant, non-intrusive
function beepSuccess() {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
  gain.gain.linearRampToValueAtTime(0, t + 0.08);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

// Error — low, slightly buzzy, unambiguous
function buzzError() {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.22, t + 0.01);
  gain.gain.linearRampToValueAtTime(0, t + 0.2);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.21);
}
```

**Mute toggle:** a small speaker-icon button in the mode strip (bulk only), right-side. Click toggles muted state, persisted to `localStorage.bulkScanMuted = '1' | '0'`. Default is unmuted. When muted, both `beepSuccess` and `buzzError` early-return. Toggle persists across sessions and across page reloads.

The mute toggle is visible in `mode_selected`, `scanning`, `ending`, and `summary` states. Not in `idle` (no bulk context).

## Error taxonomy

Every rejection the running list might show. One single-line Arabic string per case — the exact copy the operator sees.

| Condition | Arabic row text |
|---|---|
| Order not found (barcode doesn't resolve) | `لم يُعثر على طلب بهذا الرقم` |
| Wrong source state — intake (not `new`) | `الطلب في حالة '{actualStatus}' — لا يمكن استلامه من الفرع` |
| Wrong source state — prepare (not `quality_check` or `rejected`) | `الطلب في حالة '{actualStatus}' — لم يكتمل الفحص` |
| Wrong source state — pickup (not `ready_for_return`) | `الطلب في حالة '{actualStatus}' — غير جاهز للاستلام` |
| Order locked (delivered) | `الطلب مغلق بعد التسليم` |
| Order belongs to a different shop (shop_employee only) | `هذا الطلب لفرع آخر — لا يمكنك استلامه` |
| Duplicate in this session | `مكرر — تم تجاهله` (flashes original row red, no new row) |
| Network error | `خطأ في الاتصال — أعد المسح` |
| Server 5xx | `خطأ مؤقت — أعد المسح` |
| Permission error (shouldn't happen — session type already gated, but defense-in-depth) | `لا تملك صلاحية لهذا الإجراء` |
| Malformed scan (regex fail) | `الرمز غير صالح — تجاوز` |

Actual status is interpolated from `details.current_status` in the invalid-transition error response body, using the same Arabic status-label map already in `client/src/constants/statuses.js` (verify at build time — path assumed).

## Duplicate behavior

This is worth its own subsection because it's subtle. The keyboard-wedge has a physical trigger that can bounce or the operator can pick up the same piece twice. The spec is:

- Client keeps a `Set<orderNumber>` of scans already accepted this session.
- When an incoming scan's order_number is already in the set:
  - **Do not** add a new row.
  - Find the existing row and apply a red-flash CSS animation (250ms fade in/out).
  - Play `buzzError`.
  - Do not change any counter.
- When a scan is **not** a duplicate and resolves to an error, it *does* get its own row — duplicates are specifically the same-order-twice case, not any repeated error.

Without this, a stuck trigger fills the list with 30 rows of the same piece and obscures the real scans.

## Input focus management (load-bearing)

The whole UX rests on the hidden input always being focused when the session is `scanning` and never focused otherwise. Rules:

1. **Hidden-but-focused input.** A `<input>` with `aria-hidden="false"` (screen readers ignore it anyway due to empty label), `tabIndex={-1}`, `style={{ position: 'absolute', opacity: 0, width: 1, height: 1, left: -9999 }}`. `autoFocus` on session start. The wedge-emitted keystrokes flow into this input; Enter fires `onSubmit`.
2. **Auto-refocus on blur.** `onBlur` handler schedules a `setTimeout(..., 0)` to re-focus, *unless* the new `document.activeElement` is (a) a button inside the bulk UI (end-session, mute, new-session) or (b) a form field inside a confirmation modal.
3. **Click-anywhere-refocus.** A `mousedown` handler on the scan-page container re-focuses the hidden input, *unless* the click target or an ancestor matches the same (a)/(b) exemption above.
4. **Visible listening indicator.** The `"جاهز للمسح"` badge — pulsing green dot — is the operator's affordance. When the hidden input loses focus and can't auto-refocus (the operator is typing in a modal), the badge turns amber and says `"اضغط هنا لاستئناف المسح"`. Clicking it is equivalent to closing the modal + refocusing.
5. **Typing in a different field.** While the end-session confirm modal is open, wedge scans during that window would otherwise be typed into the modal. The auto-refocus rule (2) explicitly opts out when focus is in the modal — the operator gets to type/click through it. When the modal closes, focus returns via `onClose` → refocus.
6. **Post-scan lockout (NOT debounce).** Wedge scanners fire discrete Enter-terminated messages, so classical debounce is wrong. What we need is a *lockout*: after a scan is accepted (the handler fires), set `inputLocked = true`, `setTimeout(() => setInputLocked(false), 150)`. During lockout, incoming keystrokes into the hidden input are discarded (not buffered — discarded). 150ms is imperceptible to humans and well under any wedge's throughput ceiling. Purpose: prevents the scanner's physical trigger-bounce or the operator's quick second press from racing the render cycle of the prior scan's result row.

## Edge cases & risks

1. **Back-to-back scans inside the 150ms lockout.** Lockout discards, does not queue. The operator sees no row for the dropped scan and no beep. Acceptable — 150ms is far below the time it takes a human to move from one piece to the next.
2. **Mid-session session-type change.** Not allowed. The session-type chip in the amber strip is display-only; there's no UI path to change it while `scanning`. If the operator picks the wrong type, they must end the session and start a new one. Rejected items in the first session stay as audit-log rows and are scanned again — nothing to clean up.
3. **Operator's role changes mid-session (token refresh, admin flipped them).** First PATCH after the role change returns `403`. Row shows "لا تملك صلاحية لهذا الإجراء". If that persists for two scans in a row, we surface a session-level toast "انتهت صلاحية الجلسة — سجّل دخول مجدداً" and transition to `idle`. Detection: two consecutive 401/403s from the PATCH endpoint.
4. **Camera mode + bulk toggle.** Not a supported combination — **out of scope due to decode latency**. html5-qrcode's decode loop plus the re-scan cooldown it requires to avoid re-reading the same label make per-scan cycle time too long for a batch workflow. When the user toggles bulk on, if they were in camera mode we force-switch to wedge and stash the camera-mode flag in component state; on bulk off, we restore it. In effect: bulk mode is always wedge-only.
5. **PATCH fails server-side because the order state changed between sessions (e.g. locked after delivery by a concurrent user).** Row shows the specific error from the server (locked / invalid transition / etc.) — including the actual `current_status` for invalid-transition cases. The PATCH is the authoritative point of failure; there's no client-side pre-check to race against it.
6. **Tab closed mid-session.** No server-side cleanup needed — bulk-session state is purely client-side. Orders already PATCHed are audit-logged and permanent. The only loss is the running list itself, which is never persisted. **No `beforeunload` confirm** — tab close discards the running list silently. Operators relying on the list as evidence must end the session explicitly via the button and read the summary.
7. **Mobile browser backgrounds the tab.** `AudioContext` gets suspended; subsequent beeps won't play until it's resumed. On `visibilitychange === 'visible'` we call `audioCtx.resume()`. Focus on the hidden input may also have been lost — the refocus-on-click rule (3) restores it when the operator taps.
8. **Wedge scanner configured with different suffix (e.g. Tab instead of Enter).** Not supported in V1. Spec assumes Enter-terminated. If this comes up in the field, configure the scanner — don't add client-side flexibility that makes the input handler fragile.
9. **Barcode that's structurally valid (`BR...`) but from a different system** (e.g. a sticker from a supplier). PATCH returns 404, row shows "لم يُعثر على طلب بهذا الرقم". Normal error path, no special handling.

## Implementation sketch

- **New**: `client/src/components/BulkScanSession.jsx` — state machine container. Owns the `idle | mode_selected | scanning | ending | summary` state, the running list array, counters, session_id, and the hidden input + focus rules. Renders all bulk UI.
- **New**: `client/src/components/BulkScanInput.jsx` — the hidden-input + focus-management primitive. Takes `onScan(value)` callback and an `active` prop. Not bulk-specific — could be reused later.
- **New**: `client/src/components/BulkScanList.jsx` — running list presentational component. Takes a rows array, renders with icons + color borders + duplicate-flash animation.
- **New**: `client/src/utils/bulkScanAudio.js` — the two tone functions + mute toggle + `localStorage` persistence. Singleton `AudioContext`.
- **New**: `client/src/utils/bulkSessionTypes.js` — the three session types as constants: target state, source-state whitelist, role requirement, session_type slug, Arabic label.
- **Edit**: `client/src/pages/ScanPage.jsx` — add `bulkMode` state + mode strip + conditional render of `BulkScanSession`. When `bulkMode`, the existing single-scan UI (manual input, camera, drawer) fully unmounts.
- **Edit**: `client/src/api/orders.js` — extend `updateStatus` wrapper to accept optional `source/session_id/session_type`; pass through to the PATCH body.
- **Edit**: `server/routes/orders.js` (`PATCH /:id/status`) — accept the three new optional body fields; when `source === 'bulk_scan'`, rewrite `notes` into the `bulk-scan · session:X · type:Y` prefix format before calling `OrderService.transition`. No other server changes. No new endpoint. No migration.
- **Tests**: `server/tests/bulk-scan-notes.test.js` — unit test confirming the notes-rewrite logic and that single-scan PATCH (no `source`) is byte-identical before/after. **No** server state-machine tests needed — the transitions themselves are unchanged.

## Effort estimate

**Medium — ~3 days of focused work** for V1, not a day-one shippable "XS." Size justification:

- Server change is genuinely small (new by-barcode route + notes rewrite + error-response extension, ~60 lines + two test files).
- The state machine, focus management, duplicate flash, audio with mute, error taxonomy, and mode-strip visual weight are each independently small but collectively real. Audio + mute alone is ~2 hours including the localStorage persistence and the autoplay-gesture handling. Focus management is another 2–3 hours including the typing-in-modal exemption and the click-to-refocus rule.
- RTL + Arabic copy for every new string is done inline via the tables in this spec — no separate localization pass needed, but translation review is a nontrivial step if anyone's reviewing it for tone.
- Manual QA alone (three session types × two roles × error taxonomy × mobile) is half a day if taken seriously.
- Playwright coverage sweep at the end is another couple of hours.
- Safari-specific audio verification adds real time — the WebAudio autoplay policy and AudioContext-resume behavior differ enough from Chromium that it's effectively a separate test pass.

Don't sandbag this one. Features like this routinely hit unexpected scope on the exact items listed.

## Open questions for the human

1. **Session-id echo in the success response body.** Do we want the `PATCH` response to include the session_id so the client can sanity-check it matches? Spec currently says no — server just passes it into notes and moves on. Changing this is trivial but I don't see the value today.
2. **Audio autoplay gesture.** The spec assumes the session-start click satisfies the browser's autoplay policy. If a shop uses a PWA/kiosk setup where the scan station auto-loads `/scan` and the operator never clicks, the first beep will be silent until they click anywhere. Low risk but mentioning in case there's a kiosk deployment I don't know about.
3. **Should the summary screen be printable?** The running list is ephemeral — if the operator wants a record of "I received 17 pieces at 08:14 from branch 1," they currently must screenshot or read from `order_status_history`. Out of scope for V1, but worth an explicit "no" so we don't get asked post-ship.
4. **Bulk-scan history browser** — out of scope; is that OK? `order_status_history.notes` supports it trivially but no UI is proposed. The 3-party audit trail through existing per-order detail views covers the critical path.

### Resolved (recorded here for traceability)

- Session-type-2 Arabic label: **`تجهيز للإرجاع`** (confirmed 2026-04-21).
- Combined single-call scan: PATCH by-barcode, no pre-GET. (Confirmed.)
- Tab-close behavior: **no `beforeunload` confirm** — running list is discarded silently. (Confirmed.)
- Camera + bulk: **out of scope due to decode latency**, not roadmap. (Confirmed.)
- Two-tab concurrent sessions: **out of scope**, no detection attempted. (Confirmed.)

---

# Step 2 — Build order

4 steps, each independently shippable. The first step gets a green light on the whole server story before any client UI exists, so a product mistake in the UI doesn't cost a server rollback.

1. **Server PATCH extension + audit-trail threading, behind no UI.** Extend `PATCH /api/orders/:id/status` to accept `source`/`session_id`/`session_type`, rewrite `notes` when `source === 'bulk_scan'`. New test file asserts the notes format and confirms single-scan PATCH (no new fields) is unchanged. Ship. You can confirm by calling curl directly against `/api/orders/:id/status` with a bulk body and reading `SELECT notes FROM order_status_history WHERE order_id = X`.

2. **Bulk mode toggle + mode strip + session-type selector + role gating, no scanning yet.** The top-of-page mode strip renders in single and bulk states. Session-type selector shows the right buttons per role. Toggling back and forth is clean. No hidden input yet — clicking a session-type button transitions to `scanning` and shows an empty running list with the "جاهز للمسح" badge as a placeholder. This is a visual review — can the operator understand what mode they're in from across the room?

3. **Hidden input + scan flow + running list + error taxonomy (no audio yet).** Wire the actual scan → resolve → PATCH → row pipeline. All error states populate correctly with proper Arabic strings. Duplicate flash works. 150ms lockout works. Focus management works (hidden-focused, auto-refocus, modal exemption, click-anywhere). This is the biggest step by wall-clock; worth ~40% of total effort. Manually QA all three session types both roles here.

4. **Audio + mute + session end + summary screen + Playwright coverage + doc update.** The two tones + mute persistence. End-session flow with `ending` overlay until last PATCH resolves. Summary screen with counts and the full list. Playwright script covering happy-path session for each type × each role. Update `docs/QA-COVERAGE.md` and `docs/BULK-SCAN-SPEC.md` itself (strike-through resolved open questions, add commit SHAs). This is the shippable-to-production step.

Stop here. Awaiting human review before any implementation code is written.
