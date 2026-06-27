#!/usr/bin/env bash
# safe-pull.sh
# Resolves the standard Once Were Wild "git pull" conflict on Bluehost where
# locally-uploaded files in backend/uploads/ collide with the incoming snapshot.
#
# Strategy:
#   1. Stash any local code edits (e.g. frontend/package.json)
#   2. Atomically move backend/uploads/ aside to a timestamped backup
#   3. Discard any tracked-file dirtiness, then pull
#   4. Re-layer the backup ON TOP of the pulled tree with `cp -rn` (no-clobber)
#      so files that EXIST in the pull are kept as git wrote them, and files
#      that only existed locally (admin-uploaded directly on prod) are restored.
#
# Uses only mv + cp + git (no external sync tools) so it works on minimal Ubuntu / Debian.
#
# Run from the repo root:
#   cd /var/www/oncewerewild && bash scripts/safe-pull.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/oww-uploads-backup-$TS"

echo "==> safe-pull start ($TS)"
echo "    repo:   $REPO_ROOT"
echo "    backup: $BACKUP"

# ---- 1. Stash local code edits (NOT uploads). Best-effort. ----
if git diff --quiet -- frontend/package.json 2>/dev/null; then
  :
else
  echo "==> Stashing local frontend/package.json edit..."
  git stash push -u -m "safe-pull-$TS" -- frontend/package.json 2>/dev/null || true
fi
if [ -f frontend/yarn.lock ] && ! git diff --quiet -- frontend/yarn.lock 2>/dev/null; then
  echo "==> Stashing local frontend/yarn.lock edit..."
  git stash push -u -m "safe-pull-$TS-lock" -- frontend/yarn.lock 2>/dev/null || true
fi

# ---- 2. Move uploads/ aside (atomic mv, NOT delete) ----
if [ -d backend/uploads ]; then
  echo "==> Moving backend/uploads -> $BACKUP ..."
  mkdir -p "$(dirname "$BACKUP")"
  mv backend/uploads "$BACKUP"
fi

# ---- 3. Reset tracked-file dirtiness, then pull ----
echo "==> Discarding tracked-file changes..."
git checkout -- . 2>/dev/null || true

echo "==> Pulling origin/main..."
git pull --no-rebase origin main

# ---- 4. Layer the backup on top of the pulled tree ----
if [ -d "$BACKUP" ]; then
  echo "==> Restoring live-only uploads (git's versions always win)..."
  mkdir -p backend/uploads
  # cp -rn means: recursive + no-clobber. Files git just wrote stay untouched;
  # files that only existed in the backup get copied back into place.
  cp -rn "$BACKUP"/. backend/uploads/ 2>/dev/null || true
  echo "    backup kept at $BACKUP (delete manually once you verify the site is OK)"
fi

echo "==> safe-pull done."
echo "    Next step: ./deploy.sh"
echo "    Your stashed code edits (if any) are in: git stash list"
