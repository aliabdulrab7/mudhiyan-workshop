#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/aliabdulrab7/mudhiyan-workshop/actions"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

echo "[ship] Checking for changes..."

CLEAN_TREE=false
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  CLEAN_TREE=true
fi

if [ "$CLEAN_TREE" = false ]; then
  echo "[ship] Staging all changes..."
  git add -A

  echo "[ship] Committing: deploy: $TIMESTAMP"
  git commit -m "deploy: $TIMESTAMP"
fi

# Always push — even if the tree was clean, there may be unpushed commits
UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" = "0" ] && [ "$CLEAN_TREE" = true ]; then
  echo "[ship] Nothing to commit and nothing to push. Already up to date."
  exit 0
fi

echo "[ship] Pushing to master..."
git push origin HEAD:master

echo ""
echo "[ship] Done. Deploy running → $REPO_URL"
