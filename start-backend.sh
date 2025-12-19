#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
BACKEND_DIR="$ROOT_DIR/backend"
mkdir -p "$RUNTIME_DIR"

echo "🚀 Backend başlatılıyor (yalnızca backend)"
cd "$BACKEND_DIR"

# .env dosyasını bash olarak "source" etme: .env bash-syntax garantisi vermez (örn. MAIL_FROM içinde '<' ve boşluk).
# Bunun yerine satır-satır KEY=VALUE parse edip export et.
load_dotenv_file() {
  local file="$1"

  while IFS= read -r line || [ -n "$line" ]; do
    # CRLF uyumu
    line="${line%$'\r'}"

    # Yorum/boş satırları atla
    case "$line" in
      '' ) continue ;;
      \#* ) continue ;;
    esac

    # KEY=VALUE olmayan satırları atla
    case "$line" in
      [A-Za-z_]*=*)
        local key="${line%%=*}"
        local val="${line#*=}"
        export "$key=$val"
        ;;
    esac
  done < "$file"
}

# .env dosyasını erken yükle (dotenv öncesi), böylece script default'ları .env'i ezmez
if [ -f ./.env ]; then
  echo "📄 .env yükleniyor (backend/.env)"
  load_dotenv_file ./.env
fi

# PORT'u erken belirle ki doğru port çakışmasını temizleyelim
export PORT=${PORT:-3001}

# Devcontainer local Postgres (127.0.0.1:5432) kullanılıyorsa cluster'ı ayakta tut.
# Not: container'da systemd yok; pg_ctlcluster ile yönetilir.
if [ "${ENSURE_POSTGRES:-1}" != "0" ] \
  && { [ "${DATABASE_HOST:-}" = "127.0.0.1" ] || [ "${DATABASE_HOST:-}" = "localhost" ]; } \
  && [ "${DATABASE_PORT:-}" = "5432" ] \
  && [ -f "$BACKEND_DIR/scripts/ensure-postgres.sh" ]; then
  echo "🐘 Local Postgres (5432) kontrol ediliyor..."
  bash "$BACKEND_DIR/scripts/ensure-postgres.sh"
fi

# Çakışan süreç/port temizliği
echo "🧹 Çakışan süreçler/portlar temizleniyor..."
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "   🔪 Port $PORT kullanan süreçler sonlandırılıyor: $PIDS"
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
    if command -v docker-compose >/dev/null 2>&1; then
      docker-compose up -d
    elif docker compose version >/dev/null 2>&1; then
      docker compose up -d
    else
      echo "ℹ️ docker compose yok; docker servisleri atlandı."
    fi
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
