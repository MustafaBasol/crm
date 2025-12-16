#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Renkli output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║       🚀 Muhasabe v2 - Servis Başlatıcı 🚀           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Servisleri başlat
"$ROOT_DIR/start-all.sh"

echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Sistem hazır! Artık kodlama yapabilirsiniz! ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}📌 Kullanışlı Komutlar:${NC}"
echo "   🌐 Frontend: http://localhost:5174"
echo "   🔧 Backend:  http://localhost:3001"
echo "   📋 Loglar:   tail -f .runtime/backend.log"
echo "   📋 Loglar:   tail -f .runtime/frontend.log"
echo "   🛑 Durdur:   npm run stop:all"
echo ""

echo -e "${BLUE}💡 İpucu: Servisler çökerse otomatik yeniden başlatma için:${NC}"
echo -e "${YELLOW}   bash ./watch-services.sh &${NC}"
echo ""
