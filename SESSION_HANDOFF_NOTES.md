# Dev Session Notes (2025-11-24)

# Dev Session Notes (2025-12-19)

## Handoff (Doğrulama + smoke authz fix) — 2025-12-19

Amaç: CRM paging değişiklikleri sonrası yerel doğrulama yapmak ve smoke authz senaryosunu yeni paged response sözleşmesine uyarlamak.

### Son durum

- `npm run build` → PASS
- `cd backend && npm run build` → PASS
- Backend health: `GET /api/health` → 200 OK (port genelde `backend/.env` içindeki `PORT`, pratikte 3000)
- `npm run smoke:crm` → `== OK ==`
- `npm run smoke:crm:authz` → `== OK ==`

Ek not (yeniden doğrulama — 2025-12-19):

- Health: `http://127.0.0.1:3000/api/health` → `{"appStatus":"ok","dbStatus":"ok",...}`
- Backend `nohup` ile başlatıldıysa PID: `.tmp/backend.pid`, log: `.tmp/backend.log`

Faz 2 adımı (küçük ama yüksek değer — 2025-12-19):

- CRM list uçlarına opsiyonel `q` search eklendi:
  - `GET /api/crm/activities?...&q=...`
  - `GET /api/crm/tasks?...&q=...`
- Doğrulama: `npm run smoke:crm` ve `npm run smoke:crm:authz` → `== OK ==`

### Yapılan değişiklik

- Authz smoke script’i `GET /api/crm/contacts?accountId=...` çağrısında artık **paged response** döndüğü için assertion güncellendi:
  - Önce: `Array.isArray(j) && j.some(...)`
  - Sonra: `Array.isArray(j.items) && j.items.some(...)`

İlgili dosya:

- `backend/scripts/smoke-crm-authz.sh`

İlgili commit:

- ae2ca91 — `test(smoke): fix authz contacts paging assertion`

### Yeni sohbette hızlı devam

1. Branch:

- `git switch chore/dev-stabilize-backend-smoke`

2. Backend + smoke doğrulama:

- `npm run start:backend`
- `npm run smoke:crm`
- `npm run smoke:crm:authz`

Not: Bu oturumda backend `nohup` ile başlatıldıysa PID `.tmp/backend.pid` içinde olabilir.

## Handoff (CRM: Leads list sorting) — 2025-12-19

Amaç: CRM Leads listesinde server-side sorting (`sortBy`/`sortDir`) + UI sort select + smoke regresyonu.

### Yapılan değişiklik

- Backend: `GET /api/crm/leads` artık `sortBy` + `sortDir` destekliyor.
  - Whitelist: `updatedAt | createdAt | name`
  - Default: `updatedAt desc`
  - Stabilite: tie-break `updatedAt DESC`
  - `name` için TypeORM güvenli pattern: `addSelect(LOWER(...))` + alias üzerinden `orderBy`
- Frontend: Leads list UI’ya sort select eklendi; state sessionStorage’da tutuluyor (`crm.leads.pageState.v1`).
  - Sort değişince pagination `offset` resetleniyor.
- Smoke: Leads sorting regresyonu eklendi (`sortBy=name&sortDir=asc` ile ilk kayıt “A …” assert).

### İlgili dosyalar

- [backend/src/crm/crm.controller.ts](backend/src/crm/crm.controller.ts)
- [backend/src/crm/crm.service.ts](backend/src/crm/crm.service.ts)
- [src/api/crm-leads.ts](src/api/crm-leads.ts)
- [src/components/crm/CrmLeadsPage.tsx](src/components/crm/CrmLeadsPage.tsx)
- [backend/scripts/smoke-crm.sh](backend/scripts/smoke-crm.sh)

### Doğrulama

- Frontend: `npm run lint && npm run build`
- Backend: `npm run lint:backend && npm run build:backend && npm run test:backend`
- Smoke:
  - `npm run start:backend`
  - `npm run smoke:crm`
  - `npm run smoke:crm:authz`

Not: `npm run smoke:crm` backend ayakta değilse `curl` connection refused ile (exit code 7) düşebilir; önce `npm run start:backend` çalıştır.

# Dev Session Notes (2025-12-18)

## Handoff (CRM: create-from-quote response enrichment) — 2025-12-18

Amaç: Quote → Sale/Invoice dönüşümünde (idempotent create-from-quote) response’ların list/detail ile tutarlı olması.

### Yapılan değişiklik

- `POST /api/sales/from-quote/:quoteId` dönüşüne `sourceQuoteNumber` + `sourceOpportunityId` eklendi.
- `POST /api/invoices/from-quote/:quoteId` dönüşüne aynı alanlar eklendi (idempotent existing + race fallback path’leri dahil).
- CRM smoke test kapsamı genişletildi:
  - Quote create response’undan `quoteNumber` alınıp create-from-quote response’larında doğrulanıyor.

### Doğrulama

- Backend unit test: `cd backend && npm test` → PASS
- CRM smoke: `cd backend && ./scripts/smoke-crm.sh` → `== OK ==`

İlgili commit:

- 5f6467f — fix(crm): enrich from-quote responses

## Handoff (CRM: Activities deep-link + filtre standardizasyonu) — 2025-12-18

Amaç: Müşteri detayından Activities’e hızlı geçiş (customer scope) + Activities listesinin filtre/boş durum davranışını standartlaştırmak.

### Yapılan değişiklik

- Customer → Activities deep-link eklendi: `#crm-activities:<customerId>`
  - Hash routing + render desteği: `AppImpl`
  - Customer modal Quick Actions: “Activities” butonu
- Contact → Activities deep-link eklendi: `#crm-activities-contact:<contactId>`
  - Contacts listesinden “Activities” aksiyonu ile geçiş
- Deal → Activities deep-link eklendi: `#crm-activities-opp:<opportunityId>`
  - Opportunities listesinden “Activities” aksiyonu ile geçiş
  - Pipeline board kartından “Activities” aksiyonu ile geçiş
- Activities filtre UX’i standardize edildi:
  - Status filtresi (all/open/completed) hem global listede hem scoped timeline’da çalışıyor.
  - Filtre uygulanmışken sonuç yoksa `common.noResults` gösteriliyor; hiç kayıt yoksa `crm.activities.empty`.

### Doğrulama

- Frontend eslint (hedefli):
  - `npx eslint src/AppImpl.tsx src/components/Header.tsx src/components/CustomerViewModal.tsx src/components/crm/CrmActivitiesPage.tsx`
- Frontend build: `npm run build` → PASS

## Handoff (CRM: Tasks deep-link + noResults standardizasyonu) — 2025-12-18

Amaç: Müşteri detayından Tasks sayfasına hızlı geçiş (customer scope) + status filtre uygulandığında boş sonuç durumunu standardize etmek.

### Yapılan değişiklik

- Customer → Tasks deep-link eklendi: `#crm-tasks:<customerId>`
  - Hash routing + render desteği: `AppImpl`
  - Customer modal Quick Actions: “Tasks” butonu
- Deal → Tasks deep-link eklendi: `#crm-tasks-opp:<opportunityId>`
  - Hash routing + render desteği: `AppImpl`
- Global CRM Tasks sayfası eklendi: `#crm-tasks`
  - Sidebar menüsüne eklendi (CRM alanı)
  - Backend `GET /api/crm/tasks` artık filter olmadan da list dönebiliyor (admin: tüm tenant; non-admin: görünür opp/account kapsamı)
- Contacts → Tasks quick-link eklendi (account scope): Contacts listesinden ilgili müşterinin task’larına geçiş.
- Tasks filtre UX’i standardize edildi:
  - Filtre uygulanmışken sonuç yoksa `common.noResults` gösteriliyor; hiç kayıt yoksa `crm.tasks.empty`.

### Doğrulama

- Frontend eslint (hedefli):
  - `npx eslint src/AppImpl.tsx src/components/Header.tsx src/components/CustomerViewModal.tsx src/components/crm/CrmTasksPage.tsx`
- Backend build: `cd backend && npm run build`
- Frontend build: `npm run build`

# Dev Session Notes (2025-12-15)

## Handoff (CRM authz: opportunity stage move) — 2025-12-16

Bu sohbet sıfırlanırsa, en güncel güvenlik kararı ve doğrulaması burada.

### Son durum (yeşil doğrulamalar)

- Backend build başarılı: `cd backend && npm run build`
- Backend Jest testleri başarılı: `cd backend && npm test -- --runInBand`
- CRM stage-move authz e2e testi eklendi ve PASS: `cd backend && ./test/run-e2e.sh crm-opportunity-move-authz.e2e-spec.ts`
- E2E kapsamı genişletildi:
  - org `ADMIN` kullanıcısı `OWNER` rolüne promote edilince stage move hâlâ izinli (OWNER yolu doğrulanıyor)
  - org rolü `MEMBER` olsa bile opportunity **owner** olan kullanıcı stage move yapabiliyor
- E2E DB için env (Postgres auth hatası alırsan):
  - `cp backend/.env.test.example backend/.env.test`
  - Postgres’u nasıl çalıştırdığına göre `TEST_DATABASE_PORT` ayarla:
    - `cd backend && docker compose up -d postgres` → genelde `5433`
    - repo root `docker compose up -d postgres` → genelde `5543`
    - (Docker yoksa) Dev container içindeki local Postgres → `5432` (cluster: 17/main)
  - Eğer “DROP/CREATE DATABASE” yetkisi hatası alırsan admin override kullan:
    - `TEST_DATABASE_ADMIN_USER=node`
    - `TEST_DATABASE_ADMIN_PASSWORD=moneyflow123`
- CRM smoke (admin-only) başarılı: `backend/scripts/smoke-crm.sh`
- CRM smoke (member-flow + upgrade) başarılı:

  - `ENABLE_MEMBER_FLOW=1 ENABLE_SMOKE_UPGRADE=1 backend/scripts/smoke-crm.sh`

- E2E/SMOKE çıktısı için log gürültüsü azaltıldı:
  - `ProductsService` ve `OrganizationsService` içindeki bazı `console.log` çağrıları `Logger`/`debug` seviyesine alındı ve testte susturuldu.
  - `InvoicesService` (KDV hesaplama debug logları), `ExpensesService.update` ve `SubprocessorsController` içindeki `console.*` çağrıları da aynı şekilde testte susturuldu.

Not: repo root’ta `npm test` script’i yok; test için backend içinde çalıştır.

Not: [backend/test/run-e2e.sh](backend/test/run-e2e.sh) `.env` dosyasını source etmez (bash-uyumlu değil). `.env.test` mevcutsa yükler; ancak komutta `TEST_DATABASE_*` değişkenleri verilirse bunlar önceliklidir.

### Yapılan değişiklik (kural netleştirme)

- Opportunity stage taşıma (`POST /api/crm/opportunities/:id/move`) artık **rol bazlı**:
  - İzinli: tenant admin (user.role), opportunity owner, veya (current org içinde) organization `ADMIN/OWNER`.
  - Team member erişimi (okuma/board görünürlüğü) devam eder; ancak **team member olmak stage move yetkisi vermez**.
  - Karar: **team member stage move asla**. Normal `MEMBER` için stage move **403 Forbidden**.
  - Not: organization `ADMIN/OWNER` için opportunity team üyeliği zorunlu değil.

İlgili commit:

- f05e148 — Restrict opportunity stage move to owner/admin

İlgili dosyalar:

- [backend/src/crm/crm.service.ts](backend/src/crm/crm.service.ts)
- [backend/scripts/smoke-crm.sh](backend/scripts/smoke-crm.sh)
- [backend/test/crm-opportunity-move-authz.e2e-spec.ts](backend/test/crm-opportunity-move-authz.e2e-spec.ts)

### E2E altyapısı (bu oturumda yapılanlar)

- Jest e2e’lerde `JWT_SECRET` zorunluluğu:
  - `./test/run-e2e.sh` artık testler için varsayılan `JWT_SECRET` set ediyor (AuthModule “default-secret” kabul etmiyor).
  - Örnek env’e de eklendi: [backend/.env.test.example](backend/.env.test.example)
- Jest teardown sonrası TypeORM “import after environment has been torn down” hatası:
  - Test modunda TypeORM’un glob ile entity/migration import etmesi devre dışı bırakıldı (Jest teardown ile yarışmasın diye).
  - Değişiklik: [backend/src/app.module.ts](backend/src/app.module.ts)
- E2E migration FK hatası (şema drift):
  - `product_categories.parentId` kolonu e2e DB’de `varchar` oluştuğu için FK migration’ı patlıyordu; entity `uuid` ile hizalandı.
  - Değişiklik: [backend/src/products/entities/product-category.entity.ts](backend/src/products/entities/product-category.entity.ts)

### Smoke kapsamı (regresyon yakalama)

- Member-flow aktifken:
  - Member `POST /crm/opportunities/:id/move` → **403**
  - Owner aynı move payload’ı ile → **200/201**
  - (Opsiyonel) `MEMBER_ROLE=ADMIN` ile org-admin member `POST /crm/opportunities/:id/move` → **200/201**

### Yeni sohbette devam (kalan işler)

1. Yetki politikası (ürün kararı): **team member stage move asla**. İzin sadece: tenant admin, opportunity owner, veya current org `ADMIN/OWNER`.
2. CRM authz yüzeyi büyüdükçe smoke’ı küçük parçalara ayırmayı değerlendir (örn. `smoke-crm-authz.sh`), ama şimdilik tek dosya yeterli.

Not: Artık authz odaklı daha kısa smoke mevcut: `npm run smoke:crm:authz` (script: `backend/scripts/smoke-crm-authz.sh`).

## Handoff (Backend + Postgres + CRM Smoke) — 2025-12-15

Bu sohbet sıfırlanırsa hızlıca devam etmek için önce şunlara bak:

- Rehber: [docs/DEV_BACKEND_POSTGRES_SMOKE.md](docs/DEV_BACKEND_POSTGRES_SMOKE.md)
- Tek komut smoke test: [backend/scripts/smoke-crm.sh](backend/scripts/smoke-crm.sh)
- NPM script: `npm run smoke:crm` (root)
- Authz odaklı NPM script: `npm run smoke:crm:authz`

### Çalışır durum (son doğrulama)

- Backend portu `backend/.env` içindeki `PORT` değişkenine göre çalışır (pratikte genelde **3000** veya **3001**). `npm run start:backend` bu değeri dikkate alır.
- `GET /api/health` JSON dönüyor.
- Auth smoke: `POST /api/auth/register` + `POST /api/auth/login` başarıyla token üretiyor.
- CRM smoke: token ile leads/contacts için create→list→update→delete uçları başarıyla çalışıyor.

### Hızlı devam komutları

1. Backend ayakta mı?

- Önce 3000 dene, değilse 3001:
  - `curl -sS http://127.0.0.1:3000/api/health`
  - `curl -sS http://127.0.0.1:3001/api/health`

2. CRM smoke test (backend ayaktayken):

- `npm run smoke:crm`

3. Port çakışması (EADDRINUSE) varsa:

- İlgili port hangisiyse onu kontrol et (örn. 3000/3001):
  - `lsof -nP -iTCP:3000 -sTCP:LISTEN`
  - `lsof -nP -iTCP:3001 -sTCP:LISTEN`
- Birden fazla `nest start --watch` instance’ı çalışıyorsa fazlasını kapat.

### Notlar / Bilinen tuzaklar

- `JWT_SECRET` olmadan backend boot etmiyor (dev’de bile gerekli).
- Stripe/Billing tarafı prod’da `STRIPE_SECRET_KEY` olmadan fail-fast olabilir; dev’de crash etmemesi için soft-fail yaklaşımı var.
- Smoke script çıktıları ve token dosyaları `/workspaces/crm/.tmp/` altına yazılıyor.
- `npm run start:backend` port temizliğini sabit bir port üzerinden yapmaz; `.env`’deki `PORT` ile aynı portu temizleyip başlatır (EADDRINUSE flakiness’i azaltır).
- Devcontainer local Postgres (cluster: `17/main`, port `5432`) “down” olursa DB bağlantısı patlamasın diye:
  - `start-backend.sh` ve `start-dev.sh` otomatik `backend/scripts/ensure-postgres.sh` çalıştırır.
  - Script `systemctl` kullanmaz (container’da systemd yok); `sudo -n pg_ctlcluster ...` ile cluster’ı başlatır.
  - İstersen dev akışında kapat: `ENSURE_POSTGRES=0 npm run start:backend`
- Smoke script’ler (`npm run smoke:crm`, `npm run smoke:crm:authz`) artık **port sabitlemez**:
  - `BASE_URL` set edilmediyse önce `backend/.env` içindeki `PORT` okunur.
  - `PORT` yoksa health probe ile `3000` → `3001` denenir.
  - Override: `BASE_URL=http://127.0.0.1:XXXX` veya `BACKEND_URL=...`.
  - (İleri kullanım) `BACKEND_ENV_FILE=...` veya `BACKEND_PORT=...`.

## Biten işler (CRM)

- Deal detay ekranı eklendi: `#crm-deal:<id>` hash rotası ile açılıyor.
- Pipeline board kartından deal adına tıklayınca deal detay ekranına gidiyor.
- Deal detay ekranında güncellenebilir alanlar: ad, müşteri (accountId), tutar, para birimi, beklenen kapanış tarihi; ayrıca stage değişimi ve takım (team) yönetimi.
- Aktiviteler deal’e bağlandı:
  - Mock API tarafında activity modeline `opportunityId` eklendi.
  - `GET /api/crm/activities?opportunityId=...` filtrelemesi eklendi.
  - Deal detay ekranında sadece o deal’e bağlı aktiviteler listeleniyor; yeni eklenen aktiviteler otomatik olarak o deal’e `opportunityId` ile bağlanıyor.
- Hash routing ve başlık:
  - `AppImpl` hash sync `crm-deal:` için genişletildi.
  - Header title `crm.dealDetail.title` ile i18n.
- i18n: `crm.dealDetail.*` ve `crm.activities.subtitleForDeal` anahtarları EN/TR/FR/DE eklendi.

## Doğrulamalar

- `npm run lint` temiz.
- `npm run build` başarılı (sadece Vite chunk uyarıları).

## Yeni sohbette devam (net yapılacaklar)

1. ✅ Deal detay ekranındaki aktiviteleri “timeline” gibi göstermek (tarih alanına göre sıralama + open/completed filtresi/etiketi).

- Uygulama: [src/components/crm/CrmActivitiesPage.tsx](src/components/crm/CrmActivitiesPage.tsx)
- Deal detail entegrasyonu: [src/components/crm/CrmDealDetailPage.tsx](src/components/crm/CrmDealDetailPage.tsx)

2. ✅ `CrmActivity` ilişki tasarımı netleştirildi (single relation rule): activity **yalnızca bir** hedefe bağlanır: `opportunityId` **veya** `accountId` **veya** `contactId`.

- Kural (list/create/update): [backend/src/crm/crm.service.ts](backend/src/crm/crm.service.ts)
- API yüzeyi: [backend/src/crm/crm.controller.ts](backend/src/crm/crm.controller.ts)
- DB kolon + index: [backend/src/migrations/1770300000000-EnsureCrmActivitiesAndAddContactId.ts](backend/src/migrations/1770300000000-EnsureCrmActivitiesAndAddContactId.ts)
- Smoke doğrulama: [backend/scripts/smoke-crm.sh](backend/scripts/smoke-crm.sh)

3. Bu MVP akışını mock backend’den NestJS backend’e taşıma planı (Faz 1): **bugün bitirilecek** (backend parity + smoke yeşil).

### Faz 1 hedefi (MVP parity)

- Frontend CRM ekranlarının ihtiyaç duyduğu endpoint seti NestJS backend’de mevcut ve smoke ile doğrulanmış olacak.
- Minimum doğrulamalar (hepsi PASS):
  - `npm run build:backend`
  - `npm run lint:backend`
  - `npm run start:backend` + `npm run smoke:crm`
  - `npm run smoke:crm:authz`

### Faz 1 kapsam (API yüzeyi)

- Pipeline/Staging
  - `POST /api/crm/pipeline/bootstrap`
  - `GET /api/crm/stages`
  - (opsiyonel) `GET /api/crm/board` (var; board UI için)
- Opportunities
  - `POST /api/crm/opportunities`
  - `GET /api/crm/opportunities` (pagination + filter)
  - `GET /api/crm/opportunities/:id`
  - `PATCH /api/crm/opportunities/:id`
  - `POST /api/crm/opportunities/:id/team`
  - `POST /api/crm/opportunities/:id/move` (authz: tenant admin / org ADMIN|OWNER / opp owner)
  - `GET /api/crm/opportunities/:id/sales`
  - `GET /api/crm/opportunities/:id/invoices`
- Leads
  - `GET/POST/PATCH/DELETE /api/crm/leads`
- Contacts
  - `GET/POST/PATCH/DELETE /api/crm/contacts` (+ `accountId` filter)
- Activities
  - `GET/POST/PATCH/DELETE /api/crm/activities` (+ `opportunityId|accountId|contactId` filter)
  - Kural: **single relation** (yalnızca bir filter/id alanı)
- Tasks
  - `GET/POST/PATCH/DELETE /api/crm/tasks` (+ `opportunityId|accountId` filter)

### Faz 1 done checklist (sıra)

1. Backend build/lint yeşil: `npm run build:backend` + `npm run lint:backend`
2. Backend ayakta ve health OK: `npm run start:backend` + `GET /api/health`
3. CRM smoke yeşil: `npm run smoke:crm`
4. Authz smoke yeşil: `npm run smoke:crm:authz`
5. Çıktılar/komutlar bu dokümana eklenir (bugün: timestamp + kısa özet)

### Faz 1 doğrulama (2025-12-18)

- Backend: `npm run start:backend` (PORT: 3000)
- Health: `curl -sS http://127.0.0.1:3000/api/health` → 200 OK
- CRM smoke: `npm run smoke:crm` → `== OK ==`
  - Not: Login `EMAIL_NOT_VERIFIED` nedeniyle register token fallback ile ilerliyor (beklenen).
- Authz smoke: `npm run smoke:crm:authz` → `== OK ==`

## Biten işler

- `src/App.tsx` içindeki legacy runtime `sales` göç efekti tamamen kaldırıldı; tenant scoped cache yazımı artık yalnızca `persistSalesState`/`writeTenantScopedArray` üzerinden gerçekleşiyor ve render sırasında gereksiz localStorage taramaları yapılmıyor.
- Tek seferlik tarayıcı yardımcısı `legacy-sales-migrator.html` eklendi; bu araç legacy `sales`/`sales_cache` anahtarlarını tenant scoped anahtarlara taşıyıp isteğe bağlı olarak eski global anahtarları siliyor. Operasyon akışı `MIGRATIONS.md` içine adım adım belgelendi.
- Bildirim hidrasyon helper'ı (`normalizeStoredNotifications`) ve silme uyarısı modalı tiplenerek `any` kullanımları azaltıldı; API'den gelen `relatedItems` listeleri normalize edilip `DeleteWarningRelatedItem` tipine dönüştürülüyor, böylece `App.tsx` lint borcu birkaç uyarı daha azaldı.
- `handleImportCustomers` ve `handleImportProducts` tüm `console.log`/`console.info` çağrılarını `logger.info`/`logger.debug` telemetrilerine taşıdı; CSV/Excel ayrımları, satır sayısı uyarıları, backend persist denemeleri ve başarısız kayıt raporları structured log olarak izleniyor. Her iki import akışındaki `rows` dizisi `const` yapılarak `prefer-const` uyarıları kapatıldı.
- Bildirim paneli (tıklama, kalıcı/persistent flag), `addNotification`, `currentPage` debug efekti, satış silme, ürün/pf katagori upsert'ları ve gider/fatura cache güncellemeleri `logger` ile instrument edildi; `App.tsx` içindeki tüm `console.log`/`console.info` çağrıları temizlendi ve ilgili telemetri event'leri `app.*` isimleriyle merkezi hale getirildi.
- Fatura oluşturma/güncelleme/silme, otomatik satış oluşturma, veri export helper'ı ve bank/notification import yolları `logger` kullanacak şekilde yeniden yazıldı; `console.warn` dışında kalan tüm console çağrıları sökülerek `no-console` lint uyarıları ~35 adet azaltıldı.
- `tenantScopedId` artık `useMemo` ile tek noktada hesaplanıyor ve tüm storage/migration/persistence efektleri bu referansı paylaşıyor; `resolveTenantScopedId`'in tekrar tekrar çağrılması engellendi, hook dependency array'leri sadeleşti ve render dalgalanmaları azaldı.
- Satış cache'ini yeniden yazan efekt `salesHasDataRef` kullandığı için `sales` state'ine bağımlı değil; tenant değiştirme ve cross-tab sync esnasında gereksiz eslint uyarıları kapanırken veri sızıntısı riski düşürüldü.
- Banka hesapları cache yenilemesinde kalan `console.warn` çağrısı `logger.warn('app.cache.bankAccounts.refreshFailed')` telemetrisiyle değiştirildi; hatalar artık structured log üzerinden izleniyor ve `no-console` uyarıları azaldı.
- Sales persistence, migration listener'ları ve hidrasyon callback'leri `tenantScopedId` memo'sunu kullanacak şekilde güncellendi; storage event zinciri tenant değişiminde stabil kaldı ve `react-hooks/exhaustive-deps` uyarıları temizlendi.
- Cross-tab storage event efekti `tenantScopedSalesId` ile memoize edildi; `react-hooks/exhaustive-deps` uyarısı kapandı ve dinleyici artık tenant değiştikçe doğru kimliği izliyor.
- Offline cache hidrasyonu sırasında kullanılan tüm `console.log`/`console.error` çağrıları `logger.info` / `logger.error` telemetrilerine taşındı; satış, müşteri, tedarikçi, ürün, fatura ve gider cache yüklemeleri structured log ile izleniyor.
- Bildirim temizleme efekti ve hash tabanlı yönlendirme helper'ı `logger` kullanacak şekilde yeniden yazıldı; gereksiz `console.log` kalabalığı temizlenirken hash navigasyonu için merkezi `logger.debug('app.hashRouting.*')` telemetrileri eklendi.
- Tenant değişiminde satış cache'ini yeniden yazan redundant efekt söküldü; `persistSalesState` zaten tenant scoped storage'ı güncellediğinden çift yazım/flush kaynaklı gereksiz React Hooks uyarıları ortadan kalktı.
- `openSaleModal` / `closeSaleModal` çevresindeki debug `console.log` çağrıları `logger.debug` telemetrilerine taşındı; tenant/event handler bloğundaki `no-console` uyarıları temizlendi ve modal yeniden-açma akışı daha okunur hale geldi.
- `src/App.tsx` içindeki tüm `setSales(...)` çağrıları `persistSalesState` helper'ına taşındı; otomatik satış oluşturma, manuel satış CRUD, fatura/satış eşlemesi, teklif→satış dönüşümleri ve import/logout işlemleri artık tek yoldan cache yazıyor. Cross-tab event'leri sadece helper tarafından tetiklendiği için tenant scoped storage tutarlılığı sağlandı.
- Logout akışı `runWithSalesPersistenceSuppressed` + `persistSalesState([])` ile storage'ı boş listeyle ezmeden UI state'ini temizliyor; manuel flag yönetimi kaldırıldı.
- Satış silme, fatura iade/iptal, otomatik satış-link güncellemeleri ve accepted quote sync'i helper'a geçirildi; redundant `writeTenantScopedArray` çağrıları sökülerek tek noktadan hata log'lama (`logger.warn('app.sales.cacheWriteFailed', ...)`) korunmuş oldu.
- `handleImportData` sales kolu da helper'ı kullanıyor; dışarıdan içe aktarılan satışlar tenant cache'iyle anında hizalanıyor.
- Banka/lokal cache hidrasyon efekti yeniden düzenlenerek `bankAccounts` state'ine doğrudan bağımlılık kaldırıldı (`bankAccountsRef` + `fallbackBankList`), `persistSalesState`/`runWithSalesPersistenceSuppressed` bağımlılıklarına sahip olacak şekilde dependency array güncellendi ve React Hooks uyarısı giderildi.
- Tenant değişiminde state temizleyen efektin dependency array'i `isAuthenticated` + `persistSalesState` ile tamamlandı; bu sayede lint uyarısı kapanırken satış temizliği helper yolundan çıkmıyor.
- Cache yüklemesi sonrası tetiklenen tenant reset efektinde eksik kalan `isAuthenticated`/`persistSalesState` bağımlılıkları yeniden eklendi; React Hooks uyarısı tekrar ortaya çıktığında aynı gün içinde kapatıldı.
- Ödeme/gider/düşük stok bildirimlerini tetikleyen efektin dependency array'i `addNotification` ve `tOr` ile genişletildi; interval yalnızca gerçekten ihtiyaç olduğunda yeniden kuruluyor ve lint uyarısı kapandı.
- Teklif (quote) bildirim efekti `addNotification`, `tOr` ve `tenant` referanslarını izleyerek tenant scoped cache değişimlerinde yeniden çalışıyor; eksik dependency uyarısı kapandı ve reminder'lar dil değişikliklerinde doğru şekilde güncelleniyor.
- 2FA hatırlatıcısı + modal efektinde kullanılan tüm `authUser` alanları türetilmiş değişkenlere taşındı; dependency array'i `tenant?.id` yerine türetilmiş `tenantId` referansı ile sadeleşti ve `authUser` eksikliği uyarısı kapandı.
- `addNotification` callback'i artık tenant scoped kimliği `useMemo` ile hesaplayıp `authUserId` ile birlikte izliyor; pref okuma helper'ı `tenantScopedIdForNotifications`/`authUserId` üzerinden çalıştığı için React Hooks uyarısı giderildi.
- Sales cache senkronizasyon efekti `tenant` referansını da izleyerek `react-hooks/exhaustive-deps` uyarısını ortadan kaldırdı; cross-tab güncellemeler yalnızca tenant değiştiğinde yeniden tetikleniyor.
- Global invoice/quote/sale event köprü efekti `openInvoiceModal`, `handleDownloadInvoice`, `openSaleModal` fonksiyonlarının `useCallback` ile sabitlenmesi sayesinde artık stable dependency'lerle çalışıyor.
- `openInvoiceModal`, `openSaleModal` ve `handleDownloadInvoice` fonksiyonları `useCallback` ile sarıldı; event listener'lar her render'da yeniden bağlanmak zorunda kalmıyor ve lint'in "dependency değişiyor" uyarıları kapandı.
- Dashboard `metrics` `useMemo`su sadece kullanılan bağımlılıkları (özellikle `formatCurrency`) izliyor; gereksiz `customers` bağımlılığı kaldırıldı ve lint uyarısı temizlendi.

## Doğrulamalar

- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 408 warning (konsole temizliği + import logger refaktörleri sonrası `no-console` uyarıları 36 adet azaldı; kalan borç `no-explicit-any` ve `no-empty`).
- `npx eslint src/App.tsx` (24 Kas 2025, 2x) → 445 warning (`tenantScopedId` memo + `salesHasDataRef` sayesinde hedeflenen `react-hooks/exhaustive-deps` uyarıları kapandı; kalanlar çoğunlukla `no-console`/`no-explicit-any`).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 444 warning (banka cache logger geçişi sonrası tek `no-console` uyarısı daha temizlendi; toplam uyarı sayısı 23 Kas 2025'e göre 75 azaldı).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 519 warning (3 adet React Hooks uyarısı kapandı; kalan uyarılar beklenen `no-explicit-any`, `no-console`, eksik dependency vb. borçlar).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 511 warning (2FA/reminder/addNotification düzenlemeleri sayesinde 8 hook uyarısı daha kapandı; kalanlar ağırlıklı olarak `no-explicit-any` + ileri seviye hook bağımlılıkları).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 507 warning (sales cache + event köprüsü + dashboard metrics düzeltmeleriyle 4 hook uyarısı daha kapandı; kalanların büyük çoğunluğu `any`/`no-console`).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 498 warning (`openSaleModal`/`closeSaleModal` logger geçişi sonrası 7 `no-console` uyarısı kapandı; sıradaki hedef 1077. satırdaki tenant cache hidrasyon efekti ve çevresindeki hook eksikleri).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 467 warning (cross-tab storage efekti dependency fix'i ve 1239-1950 arasındaki cache/notification/hash handler logger geçişleriyle 31 `no-console` uyarısı daha temizlendi).
- `npx eslint src/App.tsx` (24 Kas 2025, 1x) → 498 warning (`openSaleModal`/`closeSaleModal` logger geçişi sonrası 7 `no-console` uyarısı kapandı; sıradaki hedef 1077. satırdaki tenant cache hidrasyon efekti ve çevresindeki hook eksikleri).

## Notlar

- Sales state artık yalnızca `persistSalesState` üzerinden değişiyor; yeni kod eklerken storage event'lerinin gereksiz tetiklenmemesi için `runWithSalesPersistenceSuppressed` sarmalayıcısı kullanılmalı (örn. legacy cache hidrasyonları/tenant switch).
- `ReportsPage`/`SalesList` tarafında hâlâ doğrudan cache okuyan/parallel state tutan parçalar var; ileriki oturumda bu bileşenler yeni helper akışına geçirilmeli.

# Dev Session Notes (2025-11-23)

## Biten işler

# Dev Session Notes (2025-12-17)

## Handoff (Dev stabilize: backend port + Postgres ensure + CRM smoke) — 2025-12-17

Bu sohbet sıfırlanırsa devam noktası burası.

### Son durum (yeşil doğrulamalar)

- `npm run lint` PASS
- `npm run start:backend` ile backend kalkıyor, `GET /api/health` 200 dönüyor
- `npm run smoke:crm` PASS
- `npm run smoke:crm:authz` PASS

### Git durumu (devam etmek için)

- Çalışma branch’i: `chore/dev-stabilize-backend-smoke`
- Bu branch’teki commit’ler:
  - `0344427` — dev stabilizasyonu (port auto-detect, Postgres ensure, docs/handoff güncellemeleri)
  - `a83bd09` — smoke kapsamı genişletme (CRM tasks CRUD + accountId activity)

Devam etmek için:

1. Branch’e geç:

- `git switch chore/dev-stabilize-backend-smoke`

2. Backend + smoke hızlı doğrulama:

- `npm run start:backend`
- `npm run smoke:crm`
- `npm run smoke:crm:authz`

3. PR’a gitmek istersen:

- `git push -u origin chore/dev-stabilize-backend-smoke`
- GitHub UI’dan `main`’e PR aç

### Neler değişti? (özet)

- Backend portu/URL sabitleme kaldırıldı: smoke script’leri `backend/.env` içindeki `PORT`’u okuyor; yoksa health probe ile `3000 → 3001` deniyor.
- Devcontainer local Postgres `5432` cluster “down” olursa otomatik ayağa kaldırma eklendi:
  - `backend/scripts/ensure-postgres.sh`
  - `start-backend.sh` ve `start-dev.sh` içinden çağrılır
  - Kapatma override: `ENSURE_POSTGRES=0 npm run start:backend`
- Smoke kapsamı genişledi:

  - Activity `accountId` filter/create/delete kapsandı (CustomerViewModal path)
  - CRM tasks CRUD (create/list filter by opportunityId/patch/delete) kapsandı

- `ExpenseList`, `SimpleSalesPage` ve `ArchivePage` paginasyon/saklanan görünüm ayarları `safeLocalStorage` helper'larına geçirildi; page-size whitelist'leri tek yerden yönetiliyor ve hatalı değerler `logger` ile raporlanıyor.
- `SettingsPage` içindeki billing/portal bekleme bayrakları artık doğrudan `safeLocalStorage` API'sini kullanıyor; custom `window.localStorage` sarmalayıcısı kaldırıldı.
- `ReportsPage` quote cache hidrasyonunda `listLocalStorageKeys()` helper'ı kullanılarak `window.localStorage` erişimleri merkezi hale getirildi; `src/utils/localStorageSafe.ts` bu amaçla yeni anahtar enumerator sağlıyor.
- `AuthContext` bozuk cache temizliği `listLocalStorageKeys()` üzerinden ilerliyor; `logger`/`adminAuthStorage` artık `safeLocalStorage` + yeni `safeSessionStorage` yardımcılarını kullanıyor, böylece doğrudan `window.localStorage` erişimleri tamamen helper katmanına taşındı.
- Tenant scoped storage helper seti `src/utils/localStorageSafe.ts` ile stabilize edildi; eski `safeLocalStorage` erişimleri kademeli olarak helper'lara taşındı.
- `LanguageContext` ve `CurrencyContext` tarafında tenant bazlı tercih cache'i helper API'leri üzerinden yönetiliyor.
- `src/App.tsx` içindeki bildirim hidrasyonu tenant kimliğine göre yeniden yazıldı; `normalizeStoredNotifications` + `hydrateNotifications` akışı cross-tenant leak'i çözdü.
- Genel tarama ile kalan global/localStorage kullanımları listelendi; sadece bilinçli (auth bootstrap, legacy sales migration vs.) dokunuşlar bırakıldı.
- `NotificationPreferencesContext` tenant scoped helper'lara geçirildi; `readTenantScopedObject`/`writeTenantScopedObject` ile cache izole edildi ve sadece legacy global anahtardan okuma fall-back olarak tutuldu.
- `CurrencyContext` ve `LanguageContext` global `safeLocalStorage.setItem` yazımlarından arındırıldı; yalnızca tenant scoped anahtarlar güncelleniyor, global anahtarlar sadece okuma fallback'i olarak kaldı.
- `src/utils/localStorageSafe.ts` içine `readLegacySalesCaches` + `clearLegacySalesCaches` eklendi ve `App.tsx`'deki göç efekti bu helper'lara taşındı.
- Legacy auth/tenant/user anahtarları için `readLegacyAuthToken` / `writeLegacyAuthToken` / `readLegacyTenantId` / `writeLegacyTenantId` / `readLegacyUserProfile` helper'ları açıldı ve `src/App.tsx` üzerindeki bootstrap path'i bu helper'ları kullanacak şekilde güncellendi.
- AuthContext ve `src/api/client.ts` token yönetimi yeni helper setine geçirildi; kullanıcı/tenant cache yazımı da `writeLegacyUserProfile` / `writeLegacyTenantProfile` üzerinden merkezileştirildi.
- `clearLegacySessionCaches` helper'ı eklendi; AuthContext `clearCorruptedData` ve `authService.logout()` bu yardımı kullanarak token/user/tenant anahtarlarını ortak bir yoldan temizliyor.
- API client içindeki ardışık 401 çıkışı da `clearLegacySessionCaches` kullanıyor; böylece logout/token temizliği tek kaynaktan ilerliyor.
- `AuditLogComponent` ve `TenantConsolePage` kullanıcı tokenı/tenant cache'i için `readLegacyAuthToken` + `readLegacyTenantProfile` helper'larına geçirildi; admin araçları da aynı kaynağı kullanıyor.
- `SettingsPage` içindeki plan/organization/backup akışları `readLegacyAuthToken` + `readLegacyTenantId` + `writeLegacyUserProfile` kullanacak şekilde güncellendi; localStorage'ya doğrudan erişen `safeStorageJson` kaldırıldı.
- `InviteForm`, `CustomerHistoryModal`, `InvoiceFromSaleModal`, `CustomerHistoryPage`, `QuotesPage`, `ReportsPage`, `QuoteCreateModal`, `QuoteTemplatesManager`, `PublicQuotePage`, `utils/quoteTemplates.ts` ve `utils/pdfGenerator.ts` tenant/auth cache erişimlerini `readLegacyTenantId`/`readLegacyUserProfile` + `safeLocalStorage` helper seti üzerinden çalışacak şekilde temizlendi; quote ve invoice PDF üretimindeki localStorage erişimleri de aynı helper'lara bağlandı.
- `CustomerViewModal` içerisindeki dil belirleme yardımcıları `safeLocalStorage` kullanacak şekilde güncellendi; artık `window.localStorage` erişim hataları modalı düşürmüyor ve tenant/dil seçimi merkezi helper seti üzerinden okunuyor.
- `InvoiceViewModal` da `i18nextLng` tercihini `safeLocalStorage` üzerinden okuyor; SSR sırasında localStorage erişimi patlamıyor ve dil fallback'i i18n state'iyle hizalı.
- `ProductList` dil seçimi + sayfa boyutu cache'i `safeLocalStorage` üzerinden okunup yazılıyor; SSR guard'ları ortak helper'a taşındı ve page size ayarı tek kaynaktan yönetiliyor.
- `ProductViewModal` modalı da dil tercihlerini `safeLocalStorage` üzerinden okuyor; SSR guard'ı helper'a devredildi ve modal render'ı window erişiminden bağımsız.
- `BankList` sayfa boyutu tercihlerini `safeLocalStorage` üzerinden okuyor/yazıyor; global window guard'ı helper seviyesinde çözülerek tablo SSR-safe hale getirildi.
- `CustomerList` dil tespiti + `customers_pageSize` cache'i `safeLocalStorage` ile okunup yazılıyor; page-size validasyonu ortak helper'a taşındı ve SSR guard'ları kaldırıldı.
- `SupplierList` ve `InvoiceList` sayfa boyutu + kaydedilmiş görünüm hidrasyonları `safeLocalStorage` + tipli validator'lara taşındı; `SavedViewsBar` artık `Partial<...ViewState>` kullanıyor ve SSR sırasında window erişimi yapılmıyor.
- `GeneralLedger` tablo paginasyonu `safeLocalStorage` üzerinden okunup yazılıyor; page size whitelist'i ve setter'ı helper'a taşındı.
- `debug-env` helper'ı TypeScript'e taşındı; `safeLocalStorage` kullanıp `window.__enableEnvDebug`/`__disableEnvDebug` üzerinden güvenli toggle sağlıyor, artık direkt `window.localStorage` önerilmiyor.
- `src/utils/logger.ts` açıklamaları yeni debug helper'ına referans veriyor; verbose log aç/kapat yönergeleri helper'a yönlendirildi.
- `AuditLogComponent` fetch akışı `logger` üzerinden raporluyor, `useCallback` ile bağımlılıklar tamamlandı ve `diff` tipleri `Record<string, unknown>` olarak sıkılaştırıldı; component artık eslint'in `no-console` ve `no-explicit-any` uyarılarını üretmiyor.
- `OrganizationMembersPage` tamamen `logger` kullanıyor, data yükleyicisi `useCallback` ile sabitlendi, billing-success event'i SSR güvenli hale getirildi ve pending invite yenilemesi `async/await` akışına taşındı; ESLint'in `no-console` ve `no-empty` uyarıları sıfırlandı.
- `SaleModal` içindeki tüm konsol çağrıları `logger` üzerinden raporlanırken form state'i `SaleFormState` + `buildSaleFormState` helper'larıyla tiplenip sanitize edildi; müşteri/ürün dropdownları `useMemo` ile optimize edildi, locale bazlı tutar gösterimleri i18n dilini kullanıyor ve tüm input setter'ları `sanitizeQuantity`/`sanitizeUnitPrice` üzerinden güvenli hale getirildi.
- `InvoiceModal` yeniden tiplenerek `InvoicePayload` / `InvoiceLineItem` yapıları oluşturuldu, `logger` entegrasyonu ile konsol çağrıları söküldü ve stok kontrolleri `getAvailableStock` helper'ı üzerinden çalışıyor; ayrıca `mapReturnItemsFromOriginal` ile `return` faturaları negatif kalemlerle otomatik yükleniyor.
- `CustomerHistoryPage` yeniden yazılarak tüm `any` kullanımları tipli modellere taşındı, konsol çağrıları `logger` ile değiştirildi, CSV/PDF eylemleri SSR-safe hale getirildi ve `InvoiceViewModal`/`SaleViewModal` state'leri gerçek tiplerle çalışıyor; bu sayfa artık `no-console`, `no-empty` ve `no-explicit-any` uyarıları üretmiyor.
- `CustomerModal` ve `CustomerViewModal` domain tipleriyle güncellendi; `any` kullanımları kaldırıldı, çeviri helper'ları `useTranslation`/`safeLocalStorage` kombinasyonuna taşındı ve `onSave` artık `Partial<Customer>` bekleyerek `App` içerisindeki `upsertCustomer` akışıyla birebir hizalandı.
- `CustomerHistoryModal` satış/teklif filtreleri normalize edilerek memoize edildi, tarih/tutar biçimleyicileri güvence altına alındı ve quote cache okuması case-insensitive hale getirildi; `CustomerList` domain tipleriyle hizalanıp CSV şablon indirme akışı SSR guard'ı ve `logger` telemetry'si ile güçlendirildi.
- `SupplierHistoryModal` gider kayıtları için paylaşılan tipleri kullanıyor, tarih/tutar formatter'ları güvenli hale getirildi ve boş veriler için varsayılanlar eklenirken, `SupplierList` artık API modelleriyle hizalı, eksik alanlarda (isim/e-posta/kategori) kullanıcıya anlamlı fallback metinleri gösteriliyor ve liste filtreleri boş değerleri patlatmıyor.
- `ExpenseList` ardından `ExpenseViewModal` da API `Expense` modelini kullanacak şekilde yeniden tiplenip tüm `any` kalıntıları temizlendi; dil/para formatlayıcıları `safeLocalStorage` + `i18n` ile hizalandı, tedarikçi alanları union-safe guard'larla render ediliyor ve durum rozetleri `normalizeStatusKey` üzerinden tek kaynaktan yönetiliyor.
- `ExpenseList` artık filtrelenmiş verileri CSV olarak dışa aktarabiliyor; header butonu Excel dostu BOM ile `Blob` üretip `logger` üzerinden telemetri bırakıyor, locale bazlı tarih/tutar formatı korunuyor ve tedarikçi/kategori label'ları mevcut helper'larla hizalı.
- `ExpenseModal` tekil gider formu API modeline bağlandı; form state'i tiplenip tedarikçi araması locale-safe filtrelere taşındı, miktar doğrulaması `parseFloat` + virgül düzeltmesiyle sertleştirildi ve kaydetme payload'ı `date/expenseDate` ikilisini otomatik eşleyip null supplier ID'leri netleştiriyor.
- `RecentTransactions` bileşeni faturalar/giderler/satışlar/teklifler için API modellerine bağlandı; `UnifiedTransaction` yapısı `any` kullanımını bitirirken tarih/tutar formatter'ları SSR-safe hale getirildi, quote para birimi guard'ları eklendi ve tablo satırları controlled badge/icon helper'larıyla render ediliyor.
- `ReportsPage` gider sekmesine CSV export eklendi; paid giderler logger guard'lı handler ile BOM'lu `Blob` üzerinden dışa aktarılıyor, tarih/tutar/supplier helper'ları locale-safe hale getirildi ve çökme riskli `new Date(undefined)` çağrıları korumaya alındı.
- `SaleViewModal` locale-aware formatter'larla güncellendi; audit metadata `(sale as any)` cast'leri kaldırıldı, ürün satırları `SaleItem` tipleriyle render ediliyor ve çoklu/tekil ürün toplamları ortak helper'lar üzerinden hesaplanarak currency çıktıları i18n diline göre biçimleniyor.
- `SimpleSalesPage` domain tipleriyle yeniden yazıldı; `SaleWithMetadata` + `InvoiceWithRelations` alias'ları sayesinde state'lerdeki tüm `any` kullanımları temizlendi, tüm console log'lar `logger` telemetrilerine taşındı, filtrelenmiş satışlar için BOM'lu CSV export + yeni buton eklendi ve fatura oluşturma modalına `Loader2` animasyonlu yükleme durumu ile buton disable akışı geldi.
- `SaleViewModal` locale-aware formatter'larla güncellendi; audit metadata `(sale as any)` cast'leri kaldırıldı, ürün satırları `SaleItem` tipleriyle render ediliyor ve çoklu/tekil ürün toplamları ortak helper'lar üzerinden hesaplanarak currency çıktıları i18n diline göre biçimleniyor.
- `ExistingSaleSelectionModal` satış/domain tipleriyle hizalandı; invoice filtreleri `Set` tabanlı hale getirildi, locale bazlı tarih formatlayıcıları `safeLocalStorage` + `i18n` ile çalışıyor, tutar gösterimleri `toNumberSafe` ile sanitize edilip `logger` telemetrisiyle zenginleştirildi ve arama filtresi `normalizeText` kullanarak diakritik-insensitive hale getirildi.
- `InvoiceFromSaleModal` artık domain tiplerini kullanıyor; satış kalemleri ve fatura payload'ı tiplenip `any` bağımlılığı kaldırıldı, tarih/para formatter'ı locale-aware hale geldi, stok uyarıları & kaydetme akışı `logger` telemetrisiyle raporlanıyor ve KDV/ara toplam hesaplamaları `toNumberSafe` ile sanitize edilerek tek kaynaktan hesaplanıyor.
- `App.tsx` üzerindeki `handleCreateInvoiceFromSale` akışı `InvoiceDraftPayload` tipini kullanacak şekilde yeniden yazıldı; müşteri çözümleme/line item senaryoları `logger` telemetrisiyle raporlanıyor, backend payload'ı `BackendInvoicePayload` ile tiplenip tüm tutarlar `toNumberSafe` üzerinden normalize ediliyor ve cache yazımları hata verdiğinde uyarı log'ları bırakılıyor.
- `SimpleSalesPage` entegrasyonu artık `logger` destekli `handleSimpleSalesPageUpdate` üzerinden ilerliyor; aynı helper tenant scoped cache'leri güncel tutuyor ve `GeneralLedger`'ın `onSalesUpdate` prop'u da bu paylaşılan `persistSalesState` fonksiyonuna taşındı.

## Kalan işler ve nasıl ilerleyeceğim

1. **Legacy global storage temizliği**

   - `sales` migrasyonu ve login bootstrap'inde kalan `safeLocalStorage` erişimlerini tara.
   - Gerçekten gerekiyorsa helper'lara sar; değilse feature flag kaldırıp kodu sök.
   - Temizlik sonrası migrations dokümantasyonunu (`MIGRATIONS.md`) güncelle.
   - İnceleme notları (24 Kas 2025):
   - `src/App.tsx` içindeki **legacy sales migration** efekti tamamen kaldırıldı; bundan sonra sadece `legacy-sales-migrator.html` üzerinden manuel taşıma yapılacak.
     - App + AuthContext + API client katmanları legacy helper'lara taşındı; sırada Admin UI/Settings gibi doğrudan `safeLocalStorage`'a dokunan kalan bileşenleri incelemek ve gerekirse aynı migrator mantığını paylaşmak var.
   - ✅ `CurrencyContext` / `LanguageContext` yazma tarafı temizlendi; takipte sadece tenant scoped anahtarlar kalıyor.

2. **Lint borcunu erit**

   - `npx eslint src/App.tsx` çıktılarını grupla (any, empty block, react-hooks, no-console).
   - Önce `react-hooks/exhaustive-deps` uyarılarını düzelt (dependency arraylerini sabitle veya `useRef`/callback patternine geç).
   - Ardından `any` tiplerini domain model tipleriyle değiştir; gerekirse `types/` altında paylaşılan arayüz aç.
   - Boş blokları kaldır ya da TODO yorumuyla doldur; gereksiz `console.log`ları `logger` ile değiştir.
   - `no-console` borcu `App.tsx` özelinde sıfırlandı; yeni hedef `200-700` bandındaki `any` ağırlıklı i18n helper'ları ve `no-empty` blokları tipleyip doldurarak uyarı sayısını 350 altına çekmek (örn. `normalizeStoredNotifications`, `tOr` parametre tipleri, boş `catch` blokları).
   - Satış tarafında sıradaki adım `SalesList` bileşenini yeni tip/helper'larla hizalamak: logger telemetrisi ekle, CSV/export parity'sini koru ve kalan `any` kullanımlarını domain modellerine taşı; `SaleViewModal`, `SimpleSalesPage` ve `ExistingSaleSelectionModal` tamamlandı.
   - `ReportsPage` gelir/quote kartlarında kalan `any` alanları temizleyip CSV/PDF aksiyonlarını tek helper setine taşı; `SaleModal` sonrası hedef olarak dashboard widget'larında da aynı export telemetry'sini paylaş.
   - (24 Kas 2025) `npx eslint src/App.tsx` çalıştırıldı; beklenen legacy uyarılar 507 seviyesine indi ve yeni dependency/durum değişiklikleri ekstra uyarı üretmedi.

3. **Test/regresyon katmanı**

   - Tenant switch senaryosu için manuel script: iki farklı tenant ile giriş yap, bildirim ekranını takip et.
   - Storage helper refactor'ı için smoke test: dil/para birimi ayarlarını değiştirip refresh et.
   - Otomasyon gerekiyorsa Playwright senaryosu taslağı çıkar (henüz yoksa `tests/e2e/` altında yeni dosya aç).

4. **Tip ve util sertleştirme**

   - `src/utils/localStorageSafe.ts` içine `TenantScopedReadOptions` vb. için JSDoc ekle (kendi referansın için yeterli).
   - `pickIdentifier` ve `sanitizeString` kullanımını paylaşan util'leri başka alanlarda da kullan (ör. auth parse eden yerler).
   - Uzun vadede `zod` veya benzeri runtime validator entegre etmeyi değerlendir.

5. **Dokümantasyon güncellemesi**
   - Bu dosyayı yeni oturumda açıp checklist olarak kullan.
   - İşler bittiğinde ilgili `README_CLEAN.md` veya spesifik özellik dokümanlarını (ör. `NOTIFICATION_PREFS.md` yoksa oluştur) güncelle.

# Dev Session Notes (2025-12-18)

## Handoff (CRM: quote→sale/invoice izlenebilirliği + linked docs + CI E2E fix) — 2025-12-18

Bu sohbet sıfırlanırsa devam noktası burası.

### Son durum

- Branch: `chore/dev-stabilize-backend-smoke`
- Son commit’ler:
  - `5f6467f` — `fix(crm): enrich from-quote responses`
    - Sale/Invoice `createFromQuote` response’larına `sourceQuoteNumber` + `sourceOpportunityId` eklendi.
  - `9dd41c1` — `fix(crm): include sourceOpportunityId in linked docs`
    - CRM opportunity linked sales/invoices endpoint’leri `sourceOpportunityId` döndürüyor (smoke assert’leri eklendi).
  - `45aec19` — `test(e2e): assert health endpoint JSON`
    - Backend E2E’de `/health` artık JSON döndüğü için test güncellendi (CI fail mailini kesmesi gereken fix).

### Hızlı doğrulama

- Backend: `npm run start:backend`
- CRM smoke: `npm run smoke:crm`

Not: `backend npm run test:e2e` yerel DB port/şifre ayarına duyarlı. CI tarafında workflow Postgres’ı `localhost:5432` ile ayağa kaldırıyor.

### CI / Mail

- Push sonrası gelen mail “push bildirimi” değil; GitHub Actions `Backend E2E` workflow’u fail olursa mail geliyor.
- `45aec19` sonrası `Backend E2E / e2e` job’ı yeşil olmalı.

### Sıradaki geliştirme (CRM)

- ✅ Frontend’de Opportunity/Deal ekranına “Linked Docs” paneli eklendi:
  - Opportunity’ye bağlı sales/invoices listeleri backend CRM endpoint’lerinden çekiliyor.
  - Satıra tıklayınca ilgili modal deep-link/hash ile açılıyor (`sales-edit` / `invoices-edit`).
- ✅ Opportunities list pagination/search eklendi (UI’da `GET /api/crm/opportunities` ile server-side sayfalama + arama).

  - Doğrulama (2025-12-18): `npm run lint` PASS, `npm run build` PASS

- ✅ Opportunities listesinde müşteri (account) filtresi eklendi (UI select + `accountId` parametresi).

  - i18n: TR/EN/FR/DE `crm.opportunities.filters.account` + `crm.opportunities.filters.allAccounts`
  - Doğrulama (2025-12-18): `npm run lint` PASS, `npm run build` PASS (Vite chunk uyarıları mevcut)

- ✅ Leads ve Contacts listelerine arama eklendi; Contacts sayfasına müşteri filtresi eklendi.

  - Leads/Contacts: client-side arama (`common.search`)
  - Contacts: server-side `accountId` filtresi (`listCrmContacts({ accountId })`)
  - i18n: TR/EN/FR/DE `common.noResults` + Lead/Contact subtitle metinleri güncellendi
  - Doğrulama (2025-12-18): `npx eslint src/components/crm/CrmLeadsPage.tsx src/components/crm/CrmContactsPage.tsx` PASS, `npm run build` PASS

- ✅ CRM liste UX iyileştirmeleri (kalite):

  - Leads/Contacts/Opportunities: arama/filtre state'i sayfadan çıkıp dönünce korunuyor (sessionStorage).
  - Contacts: müşteri adı tıklanınca `customer-history:<accountId>` ile hızlı geçiş.
  - Opportunities: filtre aktifken boş sonuçta `common.noResults`, filtre yokken `empty` mesajı.
  - Doğrulama (2025-12-18): `npx eslint src/components/crm/CrmLeadsPage.tsx src/components/crm/CrmContactsPage.tsx src/components/crm/CrmOpportunitiesPage.tsx` PASS, `npm run build` PASS

- ✅ Customers → CRM Contacts deep-link eklendi.

  - Hash rota: `#crm-contacts:<customerId>` (App routing + hash sync)
  - Customer modal Quick Action ile tek tıkla geçiş
  - Contacts sayfası `initialAccountId` ile otomatik müşteri filtresi

- ✅ Customers → CRM Opportunities deep-link eklendi.
  - Hash rota: `#crm-opportunities:<customerId>` (App routing + hash sync)
  - Customer modal Quick Action ile tek tıkla geçiş
  - Opportunities sayfası `initialAccountId` ile otomatik müşteri filtresi
