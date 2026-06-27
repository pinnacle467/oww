#!/usr/bin/env bash
# One-click, hands-off deploy for Once Were Wild Travel.
#
#   ./deploy.sh            build + start everything
#   ./deploy.sh logs       follow logs
#   ./deploy.sh down       stop everything
#   ./deploy.sh ps         status
#   ./deploy.sh rebuild    clean rebuild (no cache)
#
# On first run it auto-creates .env and auto-generates strong secrets so you
# don't have to edit anything to get going. It also auto-detects whether you
# are using a local Mongo container or MongoDB Atlas.
set -euo pipefail
cd "$(dirname "$0")"

# --- pick docker compose v2 or v1 -------------------------------------------
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: Docker is not installed. Install it first:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

cmd="${1:-up}"
case "$cmd" in
  logs)    exec $DC logs -f --tail=100 ;;
  down)    exec $DC --profile localdb down ;;
  ps)      exec $DC --profile localdb ps ;;
  rebuild) $DC build --no-cache && cmd=up ;;
esac

gen() { openssl rand -hex 24 2>/dev/null || (head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40); }

# --- first run: create .env + fill in secrets -------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template."
fi

if grep -q 'please-change-me-to-a-long-random-string' .env; then
  sed -i.bak "s#please-change-me-to-a-long-random-string#$(gen)#" .env && rm -f .env.bak
  echo "Generated a strong JWT_SECRET."
fi

ADMIN_NOTE=""
if grep -q 'please-change-me-strong-password' .env; then
  NEWPW="$(gen)"
  sed -i.bak "s#please-change-me-strong-password#${NEWPW}#" .env && rm -f .env.bak
  ADMIN_NOTE="$NEWPW"
fi

# --- local Mongo vs Atlas ---------------------------------------------------
MURL="$(grep -E '^MONGO_URL=' .env | cut -d= -f2- || true)"
PROFILE=""
if echo "$MURL" | grep -qiE 'mongo:27017|localhost|127\.0\.0\.1'; then
  PROFILE="--profile localdb"
  echo "Using the bundled MongoDB container (local)."
else
  echo "Using an external MongoDB (Atlas) from MONGO_URL."
fi

# --- build + launch ---------------------------------------------------------
echo "Building and starting services..."
$DC $PROFILE up -d --build

ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2- || echo info@oncewerewild.com)"
SITE="$(grep -E '^SITE_ADDRESS=' .env | cut -d= -f2- || echo ':80')"

echo ""
echo "=================================================================="
echo "  Deployed."
if [ "$SITE" = ":80" ] || [ -z "$SITE" ]; then
  echo "  Site:  http://<your-server-ip>/"
  echo "  Admin: http://<your-server-ip>/admin"
  echo "  (Set SITE_ADDRESS=your-domain.com in .env + re-run for automatic HTTPS.)"
else
  echo "  Site:  https://${SITE}/        (Caddy is provisioning the TLS cert)"
  echo "  Admin: https://${SITE}/admin"
fi
echo "  Admin email: ${ADMIN_EMAIL}"
if [ -n "$ADMIN_NOTE" ]; then
  echo "  Admin password (generated, SAVE THIS): ${ADMIN_NOTE}"
  echo "  (also stored in .env as ADMIN_PASSWORD)"
fi
echo "=================================================================="
echo "  Logs: ./deploy.sh logs    Stop: ./deploy.sh down"
