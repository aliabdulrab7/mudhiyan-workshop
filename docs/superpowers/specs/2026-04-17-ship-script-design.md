# Design: One-Command Deploy (`ship.sh`)

**Date:** 2026-04-17  
**Status:** Approved

---

## Problem

The GitHub Actions `deploy.yml` already handles the full deploy pipeline (tests → build → AWS EC2 → PM2 reload) on every push to `master`. The missing piece is a single local command that stages, commits, and pushes without requiring multiple git steps.

---

## Solution

A bash script `ship.sh` in the project root. Running `./ship.sh` or `npm run ship` does:

1. Detect whether there is anything to commit — exit cleanly if nothing has changed
2. `git add -A` — stage all changes
3. `git commit -m "deploy: YYYY-MM-DD HH:MM"` — auto-generated timestamp message
4. `git push origin master` — triggers GitHub Actions
5. Print a link to the Actions run so the deploy can be monitored

`set -e` is set at the top so any failure stops the script immediately. No partial or silent failures.

---

## Files Changed

| File | Change |
|------|--------|
| `ship.sh` | New file — the deploy script |
| `package.json` (root) | Add `"ship": "bash ship.sh"` to scripts |

**No changes to:**
- `.github/workflows/deploy.yml` — already correct
- `.github/workflows/backup.yml` — out of scope
- `.gitignore` — already excludes `workshop.db`, `.env`, `node_modules`

---

## Script Behaviour

```
./ship.sh
```

```
[ship] Checking for changes...
[ship] Staging all changes...
[ship] Committing: deploy: 2026-04-17 14:32
[ship] Pushing to master...
[ship] Done. Deploy running → https://github.com/aliabdulrab7/mudhiyan-workshop/actions
```

**No changes case:**
```
[ship] Nothing to commit. Working tree clean.
```

**Push failure case:**
```
[ship] Push failed. Check your network or GitHub credentials.
(non-zero exit — script stops here)
```

---

## Full Existing Deploy Pipeline (unchanged)

```
./ship.sh
  └─→ git push origin master
        └─→ GitHub Actions: deploy.yml
              ├─ Run backend tests (Jest)
              ├─ Add GitHub runner IP to AWS Security Group
              ├─ SSH into EC2
              │    ├─ git pull origin master
              │    ├─ npm install --prefix client
              │    ├─ npm run build --prefix client
              │    └─ pm2 restart mudhiyan
              ├─ Health check: GET /api/health
              └─ Remove GitHub runner IP from AWS Security Group
```

Total time from `./ship.sh` to live on AWS: ~2–3 minutes.

---

## Constraints

- `git add -A` is safe because `.gitignore` already excludes all sensitive and generated files (`workshop.db`, `.env`, `client/dist`, `node_modules`)
- The script assumes the current branch is `master`. If on another branch, `git push origin master` will push the correct branch.
- Commit messages are intentionally minimal (timestamp only). Semantic commit messages are still encouraged for feature work via `/commit`; `ship.sh` is for quick iterations.
