#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

mkdir -p "$RUNTIME_DIR"

resolve_backend_port() {
  local env_file="$ROOT_DIR/backend/.env"
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

  echo "${PORT:-3000}"
}

stop_pid() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "🛑 Backend durduruluyor (PID: $pid)"
    kill "$pid" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "⚠️  Backend SIGTERM ile kapanmadı; SIGKILL gönderiliyor (PID: $pid)"
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
  if [[ -n "$pids" ]]; then
    echo "🧹 Port $port dinleyen süreçler kapatılıyor: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  fi
}

BACKEND_PORT="$(resolve_backend_port)"

stop_pid "$RUNTIME_DIR/backend.pid"
kill_port_listeners "$BACKEND_PORT"

# Son çare: kalmış olabilecek süreçleri temizle
pkill -f "nest start" 2>/dev/null || true
pkill -f "dist/main" 2>/dev/null || true

echo "✅ Backend durduruldu."
