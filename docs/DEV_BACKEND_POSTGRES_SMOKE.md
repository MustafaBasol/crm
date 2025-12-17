# Backend + Postgres (Docker’sız) + CRM Smoke Test Rehberi

Bu doküman, Codespaces/devcontainer içinde **Docker kullanmadan** PostgreSQL + NestJS backend’i çalıştırma ve CRM uçlarını hızlıca doğrulama (smoke test) akışını özetler.

## Amaç

- PostgreSQL’i kullanıcı seviyesinde (user-level) çalıştırmak
- TypeORM migration’ları gerçek Postgres’e uygulamak
- Backend’i ayağa kaldırıp `/api/health` ile doğrulamak
- Auth (register/login) + CRM leads/contacts CRUD smoke testlerini tek komutla çalıştırmak

## Varsayılanlar

- Backend portu: `backend/.env` içindeki `PORT` (pratikte genelde `3000` veya `3001`)
- API prefix: `/api`
- Postgres portu (devcontainer local cluster): `5432` (cluster: `17/main`)
- DB adı: `moneyflow_dev`
- DB kullanıcısı: `moneyflow`

Alternatifler:

- Repo root `docker compose up -d postgres` kullanıyorsan genelde host port: `5543`
- `backend/docker-compose.yml` üzerinden ayağa kaldırırsan genelde host port: `5433`

> Not: Bu değerler geliştirme ortamı içindir. Prod için kullanmayın.

## 1) Backend’i Çalıştırma (dev)

Backend’in portu `.env` içindeki `PORT` ile belirlenir (sık görülen: `3000`/`3001`).

Örnek env:

- `NODE_ENV=development`
- `PORT=3001`
- `JWT_SECRET=...` (zorunlu)
- `EMAIL_VERIFICATION_REQUIRED=false` (smoke test için kolaylık)
- `DATABASE_HOST=127.0.0.1`
- `DATABASE_PORT=5432`
- `DATABASE_USER=moneyflow`
- `DATABASE_PASSWORD=...`
- `DATABASE_NAME=moneyflow_dev`

Backend ayağa kalkınca doğrulama:

- `GET http://127.0.0.1:<PORT>/api/health` → JSON dönmeli.

## 1.1) Postgres cluster (devcontainer) yönetimi

Bu devcontainer’da `systemd` çalışmadığı için `systemctl` yerine `pg_ctlcluster` kullanılmalı.

Durum:

- `sudo -n pg_lsclusters`

Başlat / restart:

- `sudo -n pg_ctlcluster 17 main start`
- `sudo -n pg_ctlcluster 17 main restart`

Log:

- `sudo -n tail -n 200 /var/log/postgresql/postgresql-17-main.log`

Kolaylaştırıcı script:

- `backend/scripts/ensure-postgres.sh`

Not: Repo root `npm run start:backend` akışı, `DATABASE_HOST=127.0.0.1` ve `DATABASE_PORT=5432` ise bu script’i otomatik çalıştırır.

## 2) Port Çakışması (EADDRINUSE) Troubleshooting

Hata: `listen EADDRINUSE: address already in use 0.0.0.0:<PORT>`

Kontrol:

- `lsof -nP -iTCP:<PORT> -sTCP:LISTEN`

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

> Önemli: Bu klasör (ve genel olarak `.tmp/`, `.pgdata/`, `.pgsocket/`, `.runtime/`, `.runtime-local/`) **lokal runtime verisidir** ve repoya commit edilmemelidir.
> Postgres cluster’ını repo içine (ör. `.runtime/pgdata` veya `.pgdata`) kurmak, dosya izinleri/IO sorunları ve **data corruption** gibi problemlerle dev akışını kırabilir.
> pgdata’yı mutlaka repo dışı bir dizinde tutun (örn. `$HOME/.local/share/crm/pgdata` veya `/tmp/crm-pgdata`).

Özelleştirme (opsiyonel env):

- `BASE_URL` (set edilmezse otomatik çözülür: önce `backend/.env` içindeki `PORT`, yoksa `3000` → `3001` health probe)
- `BACKEND_URL` (BASE_URL yerine direkt override)
- `BACKEND_PORT` (backend portunu zorla)
- `BACKEND_ENV_FILE` (varsayılan: `/workspaces/crm/backend/.env`)
- `API_PREFIX` (default `/api`)
- `TMP_DIR` (default `/workspaces/crm/.tmp`)
- `EMAIL`, `PASS` (register/login için)

Örnek:

```bash
BASE_URL=http://127.0.0.1:3000 API_PREFIX=/api backend/scripts/smoke-crm.sh
```

## 4) Notlar

- Stripe/Billing tarafındaki bazı modüller prod’da `STRIPE_SECRET_KEY` olmadan fail-fast davranabilir. Development ortamında crash etmemesi için “soft-fail” yaklaşımı uygulanmıştır.
- Migration’lar boş DB’de “relation does not exist” gibi zincir kırılmalarına karşı, başlangıç “core tables” migration’ı ile stabilize edilmiştir.

## 5) Repo kirlenmesi (git status) hızlı çözüm

Eğer geçmişte yanlışlıkla repo içine pgdata veya smoke çıktıları yazıldıysa, bir kereye mahsus aşağıdaki komutlarla index’ten çıkarabilirsiniz:

```bash
cd /workspaces/crm
git rm -r --cached --ignore-unmatch .runtime .runtime-local .pgdata .pgsocket .tmp
```
