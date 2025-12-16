#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

BACKEND_PORT="${BACKEND_PORT:-${PORT:-3001}}"
CHECK_INTERVAL_SEC="${CHECK_INTERVAL_SEC:-30}"

echo "🔄 Backend keep-alive başlatıldı (port=${BACKEND_PORT}, interval=${CHECK_INTERVAL_SEC}s)"

backend_health() {
    curl -fsS --max-time 2 "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

while true; do
    if backend_health; then
        echo "✅ Backend çalışıyor ($(date))"
        sleep "$CHECK_INTERVAL_SEC"
        continue
    fi

    echo "❌ Backend down! Yeniden başlatılıyor..."
    bash "$ROOT_DIR/start-backend.sh" || true

    sleep "$CHECK_INTERVAL_SEC"
done