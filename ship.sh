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
# smoke test Fri Apr 17 00:31:18 +03 2026
