#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/backend/scripts/smoke-lib.sh"

API_PREFIX="${API_PREFIX:-/api}"
BASE_URL="$(smoke_resolve_base_url)"
HEALTH_URL="$BASE_URL$API_PREFIX/health"

STARTED_BY_WRAPPER=0
WAS_RUNNING_BEFORE_WRAPPER=0

cleanup() {
  if [[ "$STARTED_BY_WRAPPER" == "1" ]]; then
    bash "$ROOT_DIR/stop-backend.sh" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if curl -sS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
  WAS_RUNNING_BEFORE_WRAPPER=1
else
  STARTED_BY_WRAPPER=1
  bash "$ROOT_DIR/start-backend.sh" >/dev/null
  BASE_URL="$(smoke_resolve_base_url)"
  HEALTH_URL="$BASE_URL$API_PREFIX/health"
fi

# If backend is already running, it may be serving an older build.
# Probe a newly-added guarded route: it should return 401 (no auth), not 404.
PROBE_URL="$BASE_URL$API_PREFIX/notifications"
PROBE_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "$PROBE_URL" 2>/dev/null || echo 000)"
if [[ "$WAS_RUNNING_BEFORE_WRAPPER" == "1" && "$PROBE_CODE" == "404" ]]; then
  echo "ℹ️  Backend çalışıyor ama $PROBE_URL 404 dönüyor; stale build olabilir. Restart ediliyor..." >&2
  bash "$ROOT_DIR/stop-backend.sh" >/dev/null 2>&1 || true
  bash "$ROOT_DIR/start-backend.sh" >/dev/null
  BASE_URL="$(smoke_resolve_base_url)"
  HEALTH_URL="$BASE_URL$API_PREFIX/health"
fi

# Enable optional member flow by default for broader coverage (authz + notifications).
export ENABLE_MEMBER_FLOW="${ENABLE_MEMBER_FLOW:-1}"

bash "$ROOT_DIR/backend/scripts/smoke-crm.sh"
