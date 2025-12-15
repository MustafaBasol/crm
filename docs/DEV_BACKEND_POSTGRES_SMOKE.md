# Backend + Postgres (Docker’sız) + CRM Smoke Test Rehberi

Bu doküman, Codespaces/devcontainer içinde **Docker kullanmadan** PostgreSQL + NestJS backend’i çalıştırma ve CRM uçlarını hızlıca doğrulama (smoke test) akışını özetler.

## Amaç

- PostgreSQL’i kullanıcı seviyesinde (user-level) çalıştırmak
- TypeORM migration’ları gerçek Postgres’e uygulamak
- Backend’i ayağa kaldırıp `/api/health` ile doğrulamak
- Auth (register/login) + CRM leads/contacts CRUD smoke testlerini tek komutla çalıştırmak

## Varsayılanlar

- Backend portu: `3001`
- API prefix: `/api`
- Postgres portu: `5543`
- DB adı: `moneyflow_dev`
- DB kullanıcısı: `moneyflow`

> Not: Bu değerler geliştirme ortamı içindir. Prod için kullanmayın.

## 1) Backend’i Çalıştırma (dev)

Backend `NODE_ENV=development` ile çalıştığında varsayılan port `3001`.

Örnek env:

- `NODE_ENV=development`
- `PORT=3001`
- `JWT_SECRET=...` (zorunlu)
- `EMAIL_VERIFICATION_REQUIRED=false` (smoke test için kolaylık)
- `DATABASE_HOST=127.0.0.1`
- `DATABASE_PORT=5543`
- `DATABASE_USER=moneyflow`
- `DATABASE_PASSWORD=...`
- `DATABASE_NAME=moneyflow_dev`

Backend ayağa kalkınca doğrulama:

- `GET http://127.0.0.1:3001/api/health` → JSON dönmeli.

## 2) Port Çakışması (EADDRINUSE) Troubleshooting

Hata: `listen EADDRINUSE: address already in use 0.0.0.0:3001`

Kontrol:

- `lsof -nP -iTCP:3001 -sTCP:LISTEN`

Çakışan süreçler genelde birden fazla `nest start --watch` instance’ı olduğunda oluşur.

## 3) Auth + CRM Smoke Test (Tek Komut)

Script:

- `backend/scripts/smoke-crm.sh`

Çalıştırma:

```bash
cd /workspaces/crm
backend/scripts/smoke-crm.sh
```

Ne yapar?

- `/api/health` kontrol eder
- `POST /api/auth/register` + `POST /api/auth/login`
- Token ile:
  - `POST/GET/PATCH/DELETE /api/crm/leads`
  - `POST/GET/PATCH/DELETE /api/crm/contacts`

Çıktılar:

- Varsayılan olarak `/workspaces/crm/.tmp/` altına JSON response’lar ve `smoke.token.txt` yazar.

Özelleştirme (opsiyonel env):

- `BASE_URL` (default `http://127.0.0.1:3001`)
- `API_PREFIX` (default `/api`)
- `TMP_DIR` (default `/workspaces/crm/.tmp`)
- `EMAIL`, `PASS` (register/login için)

Örnek:

```bash
BASE_URL=http://127.0.0.1:3001 API_PREFIX=/api backend/scripts/smoke-crm.sh
```

## 4) Notlar

- Stripe/Billing tarafındaki bazı modüller prod’da `STRIPE_SECRET_KEY` olmadan fail-fast davranabilir. Development ortamında crash etmemesi için “soft-fail” yaklaşımı uygulanmıştır.
- Migration’lar boş DB’de “relation does not exist” gibi zincir kırılmalarına karşı, başlangıç “core tables” migration’ı ile stabilize edilmiştir.
