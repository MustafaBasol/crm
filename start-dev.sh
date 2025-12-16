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

# .env yükle (varsa)
if [ -f ".env" ]; then
    echo -e "${BLUE}🔐 .env dosyası yükleniyor...${NC}"
    set -a
    . ./.env
    set +a
else
    echo -e "${YELLOW}ℹ️  .env bulunamadı, varsayılan değerler kullanılacak (MAIL_PROVIDER=log).${NC}"
fi

# backend/.env yükle (varsa) — DB/JWT gibi backend ayarları için kritik
if [ -f "$BACKEND_DIR/.env" ]; then
    echo -e "${BLUE}🔐 backend/.env dosyası yükleniyor...${NC}"
    set -a
    . "$BACKEND_DIR/.env"
    set +a
fi

# Mevcut process'leri temizle
echo -e "${YELLOW}🧹 Mevcut process'ler temizleniyor...${NC}"
pkill -f "nest start|vite|dist/main|dist/src/main.js" 2>/dev/null || true
# Port 3001 dinleyen kalmış süreç varsa öldür
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -t -i:3001 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}🔪 Port 3001 kullanan süreçler sonlandırılıyor: $PIDS${NC}"
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
        docker-compose up -d
        sleep 5
    fi
else
    echo -e "${YELLOW}ℹ️  Docker yok/erişilemiyor; docker-compose adımı atlandı.${NC}"
fi

# Backend başlat
echo -e "${BLUE}🔧 Backend başlatılıyor (Port 3001 - development)...${NC}"
cd "$BACKEND_DIR"

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Backend dependencies yükleniyor...${NC}"
    npm install
fi

# Backend loglarını dosyaya yaz
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
# DB default'ları: sadece hiçbir yerde set edilmediyse seç
if [ -z "${DATABASE_HOST:-}" ]; then export DATABASE_HOST=localhost; fi
if [ -z "${DATABASE_PORT:-}" ]; then
    if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^moneyflow-db$'; then
        export DATABASE_PORT=5433
    elif command -v lsof >/dev/null 2>&1 && lsof -iTCP:5543 -sTCP:LISTEN >/dev/null 2>&1; then
        export DATABASE_PORT=5543
    else
        export DATABASE_PORT=5432
    fi
fi
if [ -z "${DATABASE_USER:-}" ]; then export DATABASE_USER=moneyflow; fi
if [ -z "${DATABASE_PASSWORD:-}" ]; then export DATABASE_PASSWORD=moneyflow123; fi
if [ -z "${DATABASE_NAME:-}" ]; then export DATABASE_NAME=moneyflow_dev; fi
export MAIL_PROVIDER=${MAIL_PROVIDER:-log}
export MAIL_FROM=${MAIL_FROM:-no-reply@example.com}
export MAILERSEND_API_KEY=${MAILERSEND_API_KEY:-}
export MAILERSEND_WEBHOOK_SECRET=${MAILERSEND_WEBHOOK_SECRET:-}

echo -e "${BLUE}📬 Mail provider: $MAIL_PROVIDER (from: $MAIL_FROM)${NC}"
if [ "$MAIL_PROVIDER" = "mailersend" ] && [ -z "$MAILERSEND_API_KEY" ]; then
    echo -e "${RED}❌ MAIL_PROVIDER=mailersend ancak MAILERSEND_API_KEY tanımlı değil. Gönderimler başarısız olacak.${NC}"
fi
echo -e "${BLUE}🗄️  DB: $DATABASE_USER@$DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME${NC}"
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
echo "  - Backend:  http://localhost:3001"
echo "  - Frontend: http://localhost:5174"
echo "  - Swagger:  http://localhost:3001/api/docs"
echo "  - pgAdmin:  http://localhost:5051"
echo ""
echo "📝 Logs:"
echo "  - Backend:  tail -f $RUNTIME_DIR/backend.log"
echo "  - Frontend: tail -f $RUNTIME_DIR/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  - kill $BACKEND_PID $FRONTEND_PID"
echo "  - docker-compose -f $BACKEND_DIR/docker-compose.yml down"
