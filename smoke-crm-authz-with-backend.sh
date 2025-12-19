#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/backend/scripts/smoke-lib.sh"

API_PREFIX="${API_PREFIX:-/api}"
BASE_URL="$(smoke_resolve_base_url)"
HEALTH_URL="$BASE_URL$API_PREFIX/health"

STARTED_BY_WRAPPER=0

cleanup() {
  if [[ "$STARTED_BY_WRAPPER" == "1" ]]; then
    bash "$ROOT_DIR/stop-backend.sh" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! curl -sS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
  STARTED_BY_WRAPPER=1
  bash "$ROOT_DIR/start-backend.sh" >/dev/null
fi

bash "$ROOT_DIR/backend/scripts/smoke-crm-authz.sh"
