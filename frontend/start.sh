#!/usr/bin/env bash
#
# Resilient frontend launcher used by `yarn start` (what supervisor runs on
# port 3000). The production server (`server.js`) serves the pre-built React
# bundle in ./build. That folder is a GENERATED artifact and is wiped whenever
# the container/preview environment restarts, which previously left the
# frontend in a permanent 502 (server.js hard-exits when build/ is missing).
#
# This wrapper guarantees the frontend ALWAYS comes up:
#   1. installs node_modules if they were wiped,
#   2. (re)builds the bundle if build/index.html is missing,
#   3. serves the built bundle via server.js,
#   4. falls back to the CRA dev server if a build can't be produced,
#      so the site is never fully down.
#
set -uo pipefail
cd "$(dirname "$0")"

log() { echo "[start] $*"; }

# 1. Dependencies — only if missing (normally persists across restarts).
if [ ! -d node_modules ] || [ ! -d node_modules/express ]; then
  log "node_modules missing — running yarn install..."
  yarn install --frozen-lockfile || yarn install || log "yarn install failed"
fi

# 2. Build — only if missing. Generated artifact, wiped on env restart.
if [ ! -f build/index.html ]; then
  log "build/ missing — running yarn build (this takes ~30s)..."
  if yarn build; then
    log "build complete."
  else
    log "build FAILED — will fall back to dev server."
  fi
fi

# 3. Serve the built bundle (preferred, fast, production parity).
if [ -f build/index.html ]; then
  log "serving production build via server.js"
  exec node server.js
fi

# 4. Last-resort safety net: never leave the site down.
log "no build available — starting CRA dev server as fallback"
exec yarn dev
