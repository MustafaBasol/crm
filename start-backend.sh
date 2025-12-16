#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
BACKEND_DIR="$ROOT_DIR/backend"
mkdir -p "$RUNTIME_DIR"

echo "🚀 Backend başlatılıyor (yalnızca backend)"
cd "$BACKEND_DIR"

# .env dosyasını erken yükle (dotenv öncesi), böylece script default'ları .env'i ezmez
if [ -f ./.env ]; then
  echo "📄 .env yükleniyor (backend/.env)"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Çakışan süreç/port temizliği
echo "🧹 Çakışan süreçler/portlar temizleniyor..."
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -t -i:3001 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "   🔪 Port 3001 kullanan süreçler sonlandırılıyor: $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 1
    kill -9 $PIDS 2>/dev/null || true
  fi
fi
pkill -f "nest start|dist/main|node dist/main|ts-node .*main" 2>/dev/null || true
sleep 1

# Docker servislerini opsiyonel olarak ayağa kaldır
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  if ! docker ps | grep -q "moneyflow-db\|moneyflow-redis"; then
    echo "🐳 Docker servisleri başlatılıyor..."
    docker-compose up -d
    echo "⏳ Veritabanı için kısa bekleme..."; sleep 6
  fi
else
  echo "ℹ️ Docker yok/erişilemiyor; docker-compose adımı atlandı."
fi

# Bağımlılıklar
if [ ! -d node_modules ]; then
  echo "📦 npm install (backend)"
  npm install
fi

export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
export DATABASE_HOST=${DATABASE_HOST:-localhost}
export DATABASE_PORT=${DATABASE_PORT:-5433}
export DATABASE_USER=${DATABASE_USER:-moneyflow}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-moneyflow123}
export DATABASE_NAME=${DATABASE_NAME:-moneyflow_dev}
# E-posta değişkenlerini .env'den gelen değerler varsa koru; yoksa varsayılan ver
export MAIL_PROVIDER=${MAIL_PROVIDER:-log}
export MAIL_FROM=${MAIL_FROM:-no-reply@example.com}
export MAILERSEND_API_KEY=${MAILERSEND_API_KEY:-}
export MAILERSEND_WEBHOOK_SECRET=${MAILERSEND_WEBHOOK_SECRET:-}

echo "✉️  Email config: provider=$MAIL_PROVIDER from=$MAIL_FROM"
if [ "$MAIL_PROVIDER" = "mailersend" ] && [ -z "$MAILERSEND_API_KEY" ]; then
  echo "⚠️ MAIL_PROVIDER=mailersend ancak MAILERSEND_API_KEY tanımlı değil"
fi

# Çalıştır ve logları arkaplana al
echo "🔧 nest start --watch (port $PORT)"
nohup npm run start:dev > "$RUNTIME_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$RUNTIME_DIR/backend.pid"

# Health check
ATT=0; MAX=20
until [ $ATT -ge $MAX ]; do
  CODE=$(curl -s -o "$RUNTIME_DIR/health.json" -w "%{http_code}" "http://localhost:${PORT}/api/health" || echo 000)
  if [ "$CODE" = "200" ]; then
    echo "✅ Backend ayakta (PID=$BACKEND_PID, PORT=$PORT)"
    echo "ℹ️  Loglar: tail -f $RUNTIME_DIR/backend.log"
    exit 0
  fi
  ATT=$((ATT+1)); sleep 2
done

echo "❌ Health check başarısız. Logları kontrol edin: tail -n 200 $RUNTIME_DIR/backend.log"
exit 1
