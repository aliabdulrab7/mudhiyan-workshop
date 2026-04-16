# ship.sh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single `./ship.sh` command that stages all changes, commits with a timestamp, and pushes to `master` — triggering the existing GitHub Actions deploy pipeline to AWS.

**Architecture:** A self-contained bash script in the project root. It detects whether there is anything to commit, prints clear status at each step, and exits non-zero on any failure (`set -e`). One line is added to `package.json` so it is also runnable as `npm run ship`.

**Tech Stack:** Bash, Git

---

### Task 1: Create `ship.sh`

**Files:**
- Create: `ship.sh`

- [ ] **Step 1: Create the script**

Create `ship.sh` in the project root with the following content exactly:

```bash
#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/aliabdulrab7/mudhiyan-workshop/actions"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

echo "[ship] Checking for changes..."

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "[ship] Nothing to commit. Working tree clean."
  exit 0
fi

echo "[ship] Staging all changes..."
git add -A

echo "[ship] Committing: deploy: $TIMESTAMP"
git commit -m "deploy: $TIMESTAMP"

echo "[ship] Pushing to master..."
git push origin master

echo ""
echo "[ship] Done. Deploy running → $REPO_URL"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x ship.sh
```

- [ ] **Step 3: Verify the script is executable and well-formed**

```bash
bash -n ship.sh && echo "syntax OK"
ls -la ship.sh
```

Expected output:
```
syntax OK
-rwxr-xr-x  1 ...  ship.sh
```

- [ ] **Step 4: Commit the script**

```bash
git add ship.sh
git commit -m "feat: add ship.sh one-command deploy script"
```

---

### Task 2: Wire `npm run ship`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the ship script to package.json**

Open `package.json` and add `"ship"` to the `scripts` block:

```json
{
  "name": "mudhiyan-workshop",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "build": "npm run build --prefix client",
    "start": "npm run start --prefix server",
    "ship": "bash ship.sh"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

- [ ] **Step 2: Verify the npm script is recognised**

```bash
npm run --list | grep ship
```

Expected output contains:
```
ship
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add npm run ship alias"
```

---

### Task 3: Smoke Test

**Files:** none

- [ ] **Step 1: Confirm nothing-to-commit path works**

Make sure the working tree is clean (both previous tasks committed), then run:

```bash
./ship.sh
```

Expected output:
```
[ship] Checking for changes...
[ship] Nothing to commit. Working tree clean.
```

- [ ] **Step 2: Confirm the push path works**

Make a trivial change, then run the script:

```bash
echo "# tested $(date)" >> ship.sh
./ship.sh
```

Expected output:
```
[ship] Checking for changes...
[ship] Staging all changes...
[ship] Committing: deploy: 2026-04-17 HH:MM
[ship] Pushing to master...
[ship] Done. Deploy running → https://github.com/aliabdulrab7/mudhiyan-workshop/actions
```

- [ ] **Step 3: Confirm GitHub Actions triggered**

Open the Actions URL printed by the script and verify the `Deploy to AWS EC2` workflow started.

- [ ] **Step 4: Revert the test line added in Step 2**

```bash
git revert HEAD --no-edit
git push origin master
```

This confirms that reverting via ship is also clean.
