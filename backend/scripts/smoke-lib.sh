#!/usr/bin/env bash

# Shared helpers for smoke scripts.
# Intentionally does not set shell options (set -euo pipefail) because it is sourced.

smoke_resolve_backend_port() {
  local env_file="${BACKEND_ENV_FILE:-/workspaces/crm/backend/.env}"

  if [[ -n "${BACKEND_PORT:-}" ]]; then
    echo "${BACKEND_PORT}"
    return 0
  fi

  if [[ -f "$env_file" ]]; then
    local port
    port="$(grep -E '^\s*PORT\s*=' "$env_file" | tail -n 1 | sed -E 's/^\s*PORT\s*=\s*//; s/\s*$//; s/^"|"$//g; s/^\x27|\x27$//g')"
    if [[ "$port" =~ ^[0-9]+$ ]]; then
      echo "$port"
      return 0
    fi
  fi

  echo ""
}

smoke_resolve_base_url() {
  if [[ -n "${BACKEND_URL:-}" ]]; then
    echo "${BACKEND_URL}"
    return 0
  fi

  local port
  port="$(smoke_resolve_backend_port)"
  if [[ -n "$port" ]]; then
    echo "http://127.0.0.1:${port}"
    return 0
  fi

  # Last-resort health probes: prefer 3000, then 3001.
  if curl -sS --max-time 1 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:3000"
    return 0
  fi

  if curl -sS --max-time 1 "http://127.0.0.1:3001/api/health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:3001"
    return 0
  fi

  # Default fallback (keeps error messages stable)
  echo "http://127.0.0.1:3000"
}

smoke_ensure_base_url() {
  if [[ -z "${BASE_URL:-}" ]]; then
    BASE_URL="$(smoke_resolve_base_url)"
  fi
}
