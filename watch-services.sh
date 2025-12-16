#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

BACKEND_PORT="${BACKEND_PORT:-${PORT:-3001}}"
FRONTEND_PORT="${FRONTEND_PORT:-${VITE_PORT:-5174}}"
CHECK_INTERVAL_SEC="${CHECK_INTERVAL_SEC:-30}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

backend_health() {
    curl -fsS --max-time 2 "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

frontend_health() {
    curl -fsS --max-time 2 "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1
}

echo -e "${GREEN}🔍 Servis izleme başlatıldı...${NC}"
echo -e "${YELLOW}Her ${CHECK_INTERVAL_SEC}s'de bir kontrol edilecek (backend=${BACKEND_PORT}, frontend=${FRONTEND_PORT}).${NC}\n"

while true; do
    if ! backend_health; then
        echo -e "${RED}❌ Backend çalışmıyor! Yeniden başlatılıyor...${NC}"
        bash "$ROOT_DIR/start-backend.sh" || true
    fi

    if ! frontend_health; then
        echo -e "${RED}❌ Frontend çalışmıyor! Yeniden başlatılıyor...${NC}"
        if [ -f "$RUNTIME_DIR/frontend.pid" ]; then
            FRONTEND_PID="$(cat "$RUNTIME_DIR/frontend.pid" 2>/dev/null || true)"
            if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
                kill "$FRONTEND_PID" 2>/dev/null || true
                sleep 1
                kill -9 "$FRONTEND_PID" 2>/dev/null || true
            fi
            rm -f "$RUNTIME_DIR/frontend.pid"
        fi

        (cd "$ROOT_DIR" && nohup npm run dev > "$RUNTIME_DIR/frontend.log" 2>&1 & echo $! > "$RUNTIME_DIR/frontend.pid") || true
    fi

    sleep "$CHECK_INTERVAL_SEC"
done
