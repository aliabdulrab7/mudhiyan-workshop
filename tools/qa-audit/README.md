# qa-audit

Playwright-based QA harness. Walks the app end-to-end across both roles and
emits `QA-REPORT.md` at the repo root.

## Setup

```bash
cd tools/qa-audit
npm install
```

## Run

Requires `npm run dev` already running at repo root (client on :5173, API on :3737)
and seeded credentials `workshop/workshop123` + `employee1/shop123`.

```bash
cd tools/qa-audit
npm run audit          # writes QA-REPORT.md at repo root
npm run coverage       # writes docs/QA-COVERAGE.md
```

Screenshots land in `tools/qa-audit/screenshots/` (gitignored).

## Ground rules

See the "QA / Test Protocol" and "QA Ground Rules" sections in the root
`CLAUDE.md` before interpreting findings.
