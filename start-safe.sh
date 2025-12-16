#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RUNTIME_DIR="$ROOT_DIR/.runtime"

BACKEND_PORT="${BACKEND_PORT:-${PORT:-3001}}"
FRONTEND_PORT="${FRONTEND_PORT:-${VITE_PORT:-5174}}"
API_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/api/health"

mkdir -p "$RUNTIME_DIR"

LOCK_FILE="$RUNTIME_DIR/start-safe.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "ℹ️ start-safe.sh zaten çalışıyor (lock: $LOCK_FILE). Çıkılıyor."
    exit 0
fi

echo "🚀 Uygulama başlatılıyor (safe mode)..."
echo "- Backend port:  $BACKEND_PORT"
echo "- Frontend port: $FRONTEND_PORT"

have_docker() {
    command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1
}

if have_docker; then
    if docker ps --format '{{.Names}}' | grep -q '^moneyflow-db$'; then
        echo "✅ Docker DB çalışıyor (moneyflow-db)"
    else
        echo "ℹ️ Docker var ama moneyflow-db container'ı yok/kapalı. (Gerekliyse backend/docker-compose.yml ile başlatın.)"
    fi
else
    echo "ℹ️ Docker yok/erişilemiyor; DB otomatik başlatılmayacak."
fi

start_backend() {
    local pid_file="$RUNTIME_DIR/backend.pid"
    if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "✅ Backend zaten dinliyor (port $BACKEND_PORT)"
        return 0
    fi

    if [ -f "$pid_file" ]; then
        local old_pid
        old_pid="$(cat "$pid_file" 2>/dev/null || true)"
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            echo "✅ Backend zaten çalışıyor (PID: $old_pid)"
            return 0
        fi
    fi

    echo "🔧 Backend başlatılıyor..."
    cd "$BACKEND_DIR"
    nohup npm run start:dev > "$RUNTIME_DIR/backend.log" 2>&1 &
    echo $! > "$pid_file"
}

start_frontend() {
    local pid_file="$RUNTIME_DIR/frontend.pid"
    if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "✅ Frontend zaten dinliyor (port $FRONTEND_PORT)"
        return 0
    fi

    if [ -f "$pid_file" ]; then
        local old_pid
        old_pid="$(cat "$pid_file" 2>/dev/null || true)"
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            echo "✅ Frontend zaten çalışıyor (PID: $old_pid)"
            return 0
        fi
    fi

    echo "🎨 Frontend başlatılıyor..."
    cd "$ROOT_DIR"
    nohup npm run dev > "$RUNTIME_DIR/frontend.log" 2>&1 &
    echo $! > "$pid_file"
}

start_backend
start_frontend

echo "⏳ Backend health kontrolü: $API_HEALTH_URL"
ATT=0; MAX=20
until [ $ATT -ge $MAX ]; do
    CODE=$(curl -sS -o "$RUNTIME_DIR/health.json" -w "%{http_code}" "$API_HEALTH_URL" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ]; then
        echo "✅ Backend ayakta"
        break
    fi
    ATT=$((ATT+1)); sleep 2
done

echo "\n🌐 URL'ler:"
if [ -n "${CODESPACE_NAME:-}" ]; then
    echo "- Frontend: https://${CODESPACE_NAME}-${FRONTEND_PORT}.app.github.dev"
    echo "- Backend:  https://${CODESPACE_NAME}-${BACKEND_PORT}.app.github.dev"
    echo "- Swagger:  https://${CODESPACE_NAME}-${BACKEND_PORT}.app.github.dev/api/docs"
else
    echo "- Frontend: http://localhost:${FRONTEND_PORT}"
    echo "- Backend:  http://localhost:${BACKEND_PORT}"
    echo "- Swagger:  http://localhost:${BACKEND_PORT}/api/docs"
fi

echo "\n📝 Loglar:"
echo "- Backend:  tail -f $RUNTIME_DIR/backend.log"
echo "- Frontend: tail -f $RUNTIME_DIR/frontend.log"

echo "\n🛑 Durdurmak için: ./stop-dev.sh"
