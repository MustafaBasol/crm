#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

echo "🚀 Muhasabe v2 - Codespace Geliştirme Ortamı Başlatılıyor..."
echo "=================================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

# Docker Compose komutu (v1: docker-compose, v2: docker compose)
COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

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

# .env yükle (varsa)
if [ -f ".env" ]; then
    echo -e "${BLUE}🔐 .env dosyası yükleniyor...${NC}"
    load_dotenv_file ".env"
else
    echo -e "${YELLOW}ℹ️  .env bulunamadı, varsayılan değerler kullanılacak (MAIL_PROVIDER=log).${NC}"
fi

# backend/.env yükle (varsa) — DB/JWT gibi backend ayarları için kritik
if [ -f "$BACKEND_DIR/.env" ]; then
    echo -e "${BLUE}🔐 backend/.env dosyası yükleniyor...${NC}"
    load_dotenv_file "$BACKEND_DIR/.env"
fi

# PORT'u erken belirle ki doğru port çakışmasını temizleyelim
export PORT=${PORT:-3001}

# Mevcut process'leri temizle
echo -e "${YELLOW}🧹 Mevcut process'ler temizleniyor...${NC}"
pkill -f "nest start|vite|dist/main|dist/src/main.js" 2>/dev/null || true
# Port dinleyen kalmış süreç varsa öldür
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}🔪 Port $PORT kullanan süreçler sonlandırılıyor: $PIDS${NC}"
        kill $PIDS 2>/dev/null || true
        sleep 1
        kill -9 $PIDS 2>/dev/null || true
    fi
fi
sleep 2

# Docker kontrol
echo -e "${BLUE}🐳 Docker servisleri kontrol ediliyor...${NC}"
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
    if ! docker ps | grep -q "moneyflow-db\|moneyflow-redis"; then
        echo -e "${YELLOW}⚠️  Docker servisleri başlatılıyor...${NC}"
        cd "$BACKEND_DIR"
        if [ -n "$COMPOSE_CMD" ]; then
            $COMPOSE_CMD up -d
        else
            echo -e "${YELLOW}ℹ️  Docker Compose yok; docker servisleri başlatılamadı.${NC}"
        fi
        sleep 5
    fi
else
    echo -e "${YELLOW}ℹ️  Docker yok/erişilemiyor; docker-compose adımı atlandı.${NC}"
fi

# Devcontainer local Postgres (127.0.0.1:5432) kullanılıyorsa cluster'ı ayakta tut.
# Not: container'da systemd yok; pg_ctlcluster ile yönetilir.
if [ "${ENSURE_POSTGRES:-1}" != "0" ] \
    && { [ "${DATABASE_HOST:-}" = "127.0.0.1" ] || [ "${DATABASE_HOST:-}" = "localhost" ]; } \
    && [ "${DATABASE_PORT:-}" = "5432" ] \
    && [ -f "$BACKEND_DIR/scripts/ensure-postgres.sh" ]; then
    echo -e "${BLUE}🐘 Local Postgres (5432) kontrol ediliyor...${NC}"
    bash "$BACKEND_DIR/scripts/ensure-postgres.sh"
fi

# Backend başlat
echo -e "${BLUE}🔧 Backend başlatılıyor (Port $PORT - development)...${NC}"
cd "$BACKEND_DIR"

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Backend dependencies yükleniyor...${NC}"
    npm install
fi

# Backend loglarını dosyaya yaz
export NODE_ENV=${NODE_ENV:-development}

# JWT: Dev ortamında .env yoksa backend'in çökmesini önle.
# Prod'da zaten env zorunlu; burada sadece local/dev için varsayılan veriyoruz.
if [ -z "${JWT_SECRET:-}" ]; then
    export JWT_SECRET="dev_only_change_me_32bytes_minimum_secret_key_123456"
fi
# DB seçimi:
# - Eğer DATABASE_HOST/DATABASE_URL/DATABASE_TYPE zaten set ise dokunma.
# - Eğer Docker veya local Postgres portu tespit edilirse Postgres env'lerini set et.
# - Aksi halde backend'in SQLite fallback'ını kullanabilmesi için DB_SQLITE=true set et.
if [ -z "${DATABASE_URL:-}" ] && [ -z "${DATABASE_HOST:-}" ] && [ -z "${DATABASE_TYPE:-}" ] && [ -z "${DB_SQLITE:-}" ]; then
    # Explicit DB env yoksa SQLite fallback kullan.
    # (Port dinliyor diye rastgele bir Postgres'e bağlanmaya çalışmak, rol/db mismatch yüzünden sık çöküyor.)
    export DB_SQLITE=true
    unset DATABASE_HOST DATABASE_PORT DATABASE_USER DATABASE_PASSWORD DATABASE_NAME
fi
export MAIL_PROVIDER=${MAIL_PROVIDER:-log}
export MAIL_FROM=${MAIL_FROM:-no-reply@example.com}
export MAILERSEND_API_KEY=${MAILERSEND_API_KEY:-}
export MAILERSEND_WEBHOOK_SECRET=${MAILERSEND_WEBHOOK_SECRET:-}

echo -e "${BLUE}📬 Mail provider: $MAIL_PROVIDER (from: $MAIL_FROM)${NC}"
if [ "$MAIL_PROVIDER" = "mailersend" ] && [ -z "$MAILERSEND_API_KEY" ]; then
    echo -e "${RED}❌ MAIL_PROVIDER=mailersend ancak MAILERSEND_API_KEY tanımlı değil. Gönderimler başarısız olacak.${NC}"
fi
if [ "${DB_SQLITE:-}" = "true" ]; then
    echo -e "${BLUE}🗄️  DB: SQLite (dev.db)${NC}"
else
    echo -e "${BLUE}🗄️  DB: $DATABASE_USER@$DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME${NC}"
fi
nohup npm run start:dev > "$RUNTIME_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$RUNTIME_DIR/backend.pid"

# Backend'in başlamasını bekle ve health check'i retry ile yap
echo -e "${YELLOW}⏳ Backend'in başlaması bekleniyor...${NC}"
ATTEMPTS=0
MAX_ATTEMPTS=15
until [ $ATTEMPTS -ge $MAX_ATTEMPTS ]
do
    STATUS_CODE=$(curl -s -o "$RUNTIME_DIR/health.json" -w "%{http_code}" "http://localhost:${PORT}/api/health" || echo 000)
    if [ "$STATUS_CODE" = "200" ] && grep -q '"appStatus"' "$RUNTIME_DIR/health.json"; then
        echo -e "${GREEN}✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)${NC}"
        break
    fi
    ATTEMPTS=$((ATTEMPTS+1))
    sleep 2
done

if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Backend başlatılamadı! (health check başarısız)${NC}"
    echo "--- Health response ($STATUS_CODE) ---"
    cat "$RUNTIME_DIR/health.json" 2>/dev/null || true
    exit 1
fi

# Frontend başlat
echo -e "${BLUE}🎨 Frontend başlatılıyor (Port 5174)...${NC}"
cd "$ROOT_DIR"

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Frontend dependencies yükleniyor...${NC}"
    npm install
fi

nohup npm run dev > "$RUNTIME_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$RUNTIME_DIR/frontend.pid"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Services:"
echo "  - Backend:  http://localhost:${PORT}"
echo "  - Frontend: http://localhost:5174"
echo "  - Swagger:  http://localhost:${PORT}/api/docs"
echo "  - pgAdmin:  http://localhost:5051"
echo ""
echo "📝 Logs:"
echo "  - Backend:  tail -f $RUNTIME_DIR/backend.log"
echo "  - Frontend: tail -f $RUNTIME_DIR/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  - kill $BACKEND_PID $FRONTEND_PID"
if [ -n "$COMPOSE_CMD" ]; then
    echo "  - $COMPOSE_CMD -f $BACKEND_DIR/docker-compose.yml down"
else
    echo "  - (docker compose) -f $BACKEND_DIR/docker-compose.yml down"
fi
