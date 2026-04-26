# Phase 3 — Side notes

Things noticed during the settings-feature detour from Phase 3 plus the
autonomous Phase 3 run. Logged here so we don't lose them, but explicitly
out of scope unless they are regressions caused by the run itself.

## Run setup — rate-limit harness bypass shipped (commit `20d9fc5`)

Pre-run audit baseline returned 2 findings caused by the Playwright harness
exhausting the 10/15min login limiter (~3-4 login attempts per audit run).
Added `QA_HARNESS=1` env opt-in in `server/routes/auth.js` so the audit can
run repeatedly without tripping the limiter. Production behavior unchanged
unless the env var is set. Anticipated by stop condition #7 of the run brief.

## Migration 2 split — Button commit exceeded 800 lines

The original work order called for one Button migration commit covering ~80
call sites across 18 files. Diff totalled 836 lines, tripping stop condition
#4. Split into 2a (components, 10 files) and 2b (pages, 11 files) by surface
category — both well under the threshold, semantics identical to a single
commit. The Button.jsx primitive itself gained an `as` prop (NavLink + anchor
support) in 2a; that change is a thin polymorphism extension, not a new
primitive — kept it in scope.

## Migration 9 — Dashboard FAB + stat-card buttons not migrated

Dashboard.jsx has two interactive surfaces that *look* button-shaped but use
bespoke CSS classes (`.fab-new-order` and `.stat-card`) rather than the `.btn`
family. Out of scope for the Button migration: their CSS lives in `index.css`
under those class names and isn't part of Phase 5's deletion target. If the
design ever wants those to converge with `<Button>`, that's a separate ticket.

## Migration 11 — BulkScanSession session-type picker stays bespoke

The work order listed BulkScanSession session-type as a SegmentedGroup target.
Reality: it's a vertical stack of full-width clickable cards with nested
content (label + chips + role-hint), not a row of equal-width segments. Already
migrated to `<Card as="button">` in the Card commit. Forcing it through
SegmentedGroup would mean losing the per-card layout. Leaving as-is per the
"migrate only if the API fits cleanly" guidance in CLEANUP-PLAN §3.3.

## Inline-styled chip duplicates in BulkScanSession

The session-type cards each render two decorative pill spans (source/target
state) that previously used `className="chip mono"`. These are display-only
labels, not interactive chips, so they don't fit the `<Chip>` primitive (which
is a `<button>`). Replaced with inline-styled spans during the Chip migration
— two duplicated long Tailwind class strings. If a `<Pill>` display-only
primitive ever lands, these are the obvious first migration target.

## Migration 12 — BulkScanSession summary stays bespoke

The work order listed the BulkScanSession summary as a Dialog migration target.
Reality: it's not a modal — it's the terminal phase of the bulk-scan state
machine ("the session is over, here's what happened"). Forcing it through
Dialog adds dismiss-on-outside-click + ESC, both of which the user shouldn't
trigger without picking "new session" / "exit". Leaving the inline `<Card>`
shape (now using the Card primitive after migration #9). Same scope-fit
guardrail as the BulkScanSession session-type picker.

## Standalone `field-label` callsites

Three `<label className="field-label">` and one `<div className="field-label">`
are section labels (NewOrder "الأولوية" / "الأصناف" / preview heading), not
input labels. They survive the FormField migration and need the `.field-label`
CSS class to keep their typography. **Phase 5 must keep `.field-label` in
index.css** — deleting it breaks these section headings. Same applies to
PrintPanel's "الطابعة" / "معاينة" labels.

## `default_label_preset` enum coupling

The Phase A backend hardcodes the label-preset enum:

    LABEL_PRESET_ENUM = ['50x30', '57x32', '80x50', '100x50', '100x100', 'a4']

The client lists the same values in `LABEL_SIZES` (LabelCanvas / printing
flows). Today these two lists are kept in sync by hand. If we ever add or
rename a size, both ends must change together or PATCH /me/settings will
reject the new value with 400. Acceptable for now (the list is static and
small), but worth revisiting if presets become user-configurable — likely
landing: serve presets from a single GET /api/label-presets and let the
PATCH validator reuse the list.

## Dialog dialogStack — HMR-only caveat

The Dialog primitive uses a module-level `dialogStack` array so only the
topmost open Dialog responds to ESC when several are nested. This is the
correct shape for production: each instance pushes on open, pops on close
cleanup. During Vite HMR in dev, a hot-reloaded Dialog may leave a stale
entry in the stack (the old instance's cleanup didn't run before the new
module replaced it), which can manifest as ESC only being honored by the
last-mounted instance. If this surfaces during Phase D wiring, the fix is
HMR-only — full reload clears it; no production behavior change.

## bcrypt rounds = 10

`/api/auth/change-password` hashes with bcrypt rounds=10 (production) and
rounds=1 (test). Ten is the current Node bcrypt default but on the low side
for 2026 — argon2id or rounds=12 are the typical hardening targets. Not
changing now: rotation cost (every existing user would log in with an
old-format hash and we'd need a transparent rehash-on-login path) is bigger
than the marginal security gain for this app's threat model. Revisit if we
add SSO, expand the user base, or get a security review.

## Technician assignment UX gap — RESOLVED

Pre-feature state: per-item endpoint existed but was additive (multiple
techs per item with 409 on duplicate) and unused by any UI; the bulk-bar
"تعيين" button rendered as a styled no-op; no per-order or bulk endpoints.

Resolved in this branch:

- Per-item endpoint flipped to replace-style (idempotent), DELETE added
  for unassign. Source of truth for the "1 tech per item" semantic — the
  schema is still M:M but the writes guarantee a single row per item
  (commit `31eb639`).
- New per-order + bulk endpoints, both transactional with full rollback
  on partial failure (commit `31eb639`).
- Per-item Dropdown in OrderDetail item rows (commit `f676536`).
- Per-order Dropdown in OrderDetail header with overwrite-confirm Dialog
  for heterogeneous → homogeneous reassignment (commit `f87cd51`).
- Bulk-bar "تعيين" button wired to a dialog → bulk endpoint (commit
  `dce4ac1`).
- OrderList rows now show the assigned technician (or "متعدد" / "—") +
  CLAUDE.md updated with the 3-level model.

Technician roster is fetched once per session via `TechniciansContext`
(mirrors `SettingsContext`). Schema is unchanged — still `order_item_technicians`.
