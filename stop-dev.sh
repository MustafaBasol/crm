#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

BACKEND_PORT="${BACKEND_PORT:-${PORT:-3001}}"
FRONTEND_PORT="${FRONTEND_PORT:-${VITE_PORT:-5174}}"

mkdir -p "$RUNTIME_DIR"

stop_pid() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    rm -f "$pid_file"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "🛑 $name durduruluyor (PID: $pid)"
    kill "$pid" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "⚠️  $name SIGTERM ile kapanmadı; SIGKILL gönderiliyor (PID: $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

kill_port_listeners() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "🧹 Port $port dinleyen süreçler kapatılıyor: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  fi
}

echo "🛑 Servisler durduruluyor..."

# Olası legacy izleyiciler
pkill -f "watch-services\.sh" 2>/dev/null || true
pkill -f "keep-backend-alive\.sh" 2>/dev/null || true
pkill -f "start-backend-stable\.sh" 2>/dev/null || true
pkill -f "start-stable\.sh" 2>/dev/null || true

stop_pid "Backend" "$RUNTIME_DIR/backend.pid"
stop_pid "Frontend" "$RUNTIME_DIR/frontend.pid"

# Fallback: port dinleyenleri temizle
kill_port_listeners "$BACKEND_PORT"
kill_port_listeners "$FRONTEND_PORT"

# Son çare: kalmış olabilecek süreçleri temizle
pkill -f "nest start" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "✅ Durduruldu."
