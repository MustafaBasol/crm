# CRM Smoke Troubleshooting

Bu doküman, CRM smoke testlerini çalıştırırken en sık görülen sorunları ve hızlı çözümleri içerir.

## Önerilen komutlar

Backend ayakta değilse otomatik başlatıp bitince kapatan wrapper’lar:

```bash
npm run smoke:crm:with-backend
npm run smoke:crm:authz:with-backend
```

Doğrudan smoke scriptleri (backend ayakta olmalı):

```bash
npm run smoke:crm
npm run smoke:crm:authz
```

## Sık hatalar

### 1) `curl: (7) Failed to connect ...` / exit code 7

**Belirti**: `npm run smoke:crm` çalıştırınca connection refused ve `exit 7`.

**Neden**: Backend çalışmıyor ya da beklenen portta dinlemiyor.

**Çözüm**:

- En kolay: `npm run smoke:crm:with-backend`
- Alternatif: backend’i başlatıp sonra smoke çalıştır:

```bash
./start-backend.sh
npm run smoke:crm
```

Backend’i durdurmak için:

```bash
./stop-backend.sh
```

### 2) Health check geçmiyor (`/api/health`)

Wrapper’lar ve `start-backend.sh` health check olarak şu endpoint’i kullanır:

- `http://localhost:$PORT/api/health`

**Kontrol**:

```bash
curl -i http://localhost:3001/api/health
```

Not: Port default olarak `start-backend.sh` içinde `PORT=${PORT:-3001}` şeklinde belirlenir. `backend/.env` içindeki `PORT` varsa o da etkili olabilir.

### 3) Port çakışması (backend başlıyor ama hemen düşüyor)

**Belirti**: `start-backend.sh` loglarında “EADDRINUSE” veya port kullanım hatası.

**Çözüm**:

- `./stop-backend.sh` (PID + port listener temizliği yapar)
- Sonra tekrar `./start-backend.sh`

### 4) Log/PID nerede?

`start-backend.sh` arka planda çalıştırır ve aşağıdaki dosyaları kullanır:

- PID: `.runtime/backend.pid`
- Log: `.runtime/backend.log`

Hızlı log bakışı:

```bash
tail -n 200 .runtime/backend.log
```

### 5) Base URL / API prefix farklıysa

Smoke scriptleri `backend/scripts/smoke-lib.sh` üzerinden base URL ve API prefix çözer.

İleri kullanım:

- `API_PREFIX` env var ile değiştirilebilir (varsayılan genelde `/api`).
- Backend farklı host/port’ta ise base URL’i scriptin beklediği şekilde ayarlayın.

## İlgili dosyalar

- Wrapper: `smoke-crm-with-backend.sh`, `smoke-crm-authz-with-backend.sh`
- Backend start/stop: `start-backend.sh`, `stop-backend.sh`
- Smoke scriptleri: `backend/scripts/smoke-crm.sh`, `backend/scripts/smoke-crm-authz.sh`
