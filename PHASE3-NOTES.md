# Phase 3 — Side notes

Things noticed during the settings-feature detour from Phase 3. Logged here so
we don't lose them, but explicitly out of scope until Phase 3 resumes at
primitive #6 (Chip).

## Untracked: `client/src/components/ui/Chip.jsx`

A `Chip.jsx` was started before Phase 3 was paused for the settings-feature
work. It's untracked (never committed) and not imported anywhere. Do not
delete — it's the starting point for primitive #6 when Phase 3 resumes. Pick
it up, finish/refactor against the established Phase 3 conventions, then
commit as the Chip primitive.

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

## bcrypt rounds = 10

`/api/auth/change-password` hashes with bcrypt rounds=10 (production) and
rounds=1 (test). Ten is the current Node bcrypt default but on the low side
for 2026 — argon2id or rounds=12 are the typical hardening targets. Not
changing now: rotation cost (every existing user would log in with an
old-format hash and we'd need a transparent rehash-on-login path) is bigger
than the marginal security gain for this app's threat model. Revisit if we
add SSO, expand the user base, or get a security review.
