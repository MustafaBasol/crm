# Pipeline Odaklı Sales CRM Dönüşüm Yol Haritası

## Durum (2025-12-15)

- ✅ Faz 0: Analiz/tasarım ve navigasyon yaklaşımı netleşti (hash + `currentPage`).
- ✅ Faz 2 (MVP Frontend): Pipeline board çalışıyor, deal oluşturma var, deal detay ekranı eklendi.
- ✅ Aktivite–Deal ilişkisi (Faz 3’e köprü): Aktiviteler `opportunityId` ile deal’e bağlanabiliyor ve deal detay ekranında deal’e özel listeleniyor.
- ✅ Faz 3 (Timeline/Tasks): Deal detail içinde aktiviteler timeline + görev listesi (CRUD) gösteriliyor.
- ✅ Faz 3 (Timeline/Tasks): Customer detay modalında (Account=Customer) aktiviteler timeline + görev listesi (CRUD) gösteriliyor.
- ⏳ Faz 1 (MVP Backend): CRM Activities + Tasks CRUD NestJS/TypeORM tarafına taşındı (Tasks tarafında `accountId` desteği + migration eklendi); kalan CRM uçları için mock → NestJS geçişi devam ediyor.

Not (dev yönlendirme): Frontend geliştirmede varsayılan olarak `/api` isteklerini **Vite proxy ile `http://localhost:3001` (NestJS)** adresine yollar. Mock API server (`backend-mock.cjs`) artık varsayılan olarak **3002** portunda çalışır (`MOCK_PORT=3002`), böylece NestJS ile port çakışması olmaz.

Not (Docker yoksa): NestJS/Postgres kalkmayan ortamlarda mock’u geçici olarak `MOCK_PORT=3001` ile çalıştırıp UI’ı test edebilirsiniz.

Bu repo bugün ağırlıklı olarak **ön muhasebe / pre‑accounting** (müşteriler, teklifler, satış kayıtları, faturalar, giderler, banka hesapları, raporlar) üzerine kurulu.

Hedefimiz: **mevcut yapıyı (multi‑tenant, auth, audit, plan limits, modül organizasyonu, frontend navigasyon yaklaşımı) koruyarak** bunu bir **Sales CRM (pipeline odaklı)** sisteme dönüştürmek.

Bu doküman iki şeyi yapar:

1. Bugünkü yapının “CRM’e yakın” kısımlarını özetler.
2. Pipeline CRM için **olmazsa olmaz** bileşenleri ve bunların **aşamalı (MVP → genişleme)** teslim planını çıkarır.

---

## 1) Mevcut Durum (Kısa Envanter)

### Backend (NestJS + TypeORM)

- Multi‑tenant çekirdek: `tenants`, `organizations`, `users`, `auth`
- Güvenlik/altyapı: rate limit, CSRF middleware, audit interceptor/logs, email doğrulama, 2FA
- İş modülleri: `customers`, `quotes`, `sales`, `invoices`, `expenses`, `products`, `bank-accounts`, `billing`, `site-settings`

Not: Mevcut `sales` modülü **pipeline CRM** değil; daha çok **“satış fişi / işlem kaydı”** (saleNumber, items, totals, invoiceId vb.). Pipeline CRM’de beklenen “deal/opportunity + stage + owner + next step” gibi kavramlar yok.

### Frontend (React + Vite)

- Uygulama routing’i React Router yerine büyük ölçüde **`currentPage` + hash sync** yaklaşımıyla yönetiliyor.
- Mevcut listeler/modal yoğun akış: müşteri, ürün, teklif, satış, fatura, gider vb.

Bu iki tespit önemli: CRM UI’ını eklerken “yeni bir router mimarisi” icat etmek yerine mevcut `currentPage` yaklaşımına uyum sağlamak daha düşük risk.

---

## 2) Sales CRM (Pipeline) — Olmazsa Olmazlar

Pipeline CRM için “minimum” ama gerçek bir satış operasyonunu taşıyacak çekirdek set:

### A) Veri modeli (çekirdek)

- **Account (Şirket/Müşteri)**
  - Karar: **Account = Customer**.
  - Yani CRM tarafında “accountId” kavramı teknik olarak `customers.id` olacak.
  - CRM’e özel alanlar gerekiyorsa iki seçenek var:
    - `customers` tablosuna CRM alanları eklemek (en hızlı, ama domain karışımı riski var)
    - `crm_customer_profile` gibi 1‑1 ek tablo açmak (domain ayrımı daha temiz)
- **Contact (Kişi)**: bir account altında birden çok kişi, e‑posta/telefon/ünvan.
- **Pipeline**: örn. “Inbound”, “Enterprise”, “Renewal”.
- **Stage**: pipeline’a bağlı, sıralı kolonlar (Lead → Qualified → Proposal → Negotiation → Won/Lost).
- **Deal/Opportunity**:
  - `amount`, `currency`, `expectedCloseDate`, `stageId`, `ownerUserId`, `accountId`, `primaryContactId`, `status` (open/won/lost)
  - “stage değişimi” birincil aksiyon.

### B) Operasyonel kayıtlar

- **Activity / Timeline**: arama, e‑posta, toplantı, not; kimin ne zaman yaptığını kayıt altına al.
- **Task**: takip işleri (due date, assignee, status).
- **Note**: serbest not (deal/account/contact seviyesinde).

### C) Erişim kontrolü

- Mevcut kullanıcı rolleri (`UserRole`) + organization member rolleri üzerinden:
  - Deal sahibi (owner) + tenant admin
  - Takım görünürlüğü (aynı tenant/organization)

### D) Temel UX

- Pipeline board (Kanban): kolonlar stage, kartlar deal.
- Deal detay sayfası: temel alanlar + timeline + task.
- Account / Contact listeleri: arama, ilişkilendirme.

---

## 3) Dönüşüm Stratejisi (Yapıyı Koru)

### Backend isimlendirme ve modül stratejisi

- Mevcut `sales` modülünü **yeniden adlandırmadan** bırak.
- Pipeline CRM için yeni bir alan aç:
  - Örn. `backend/src/crm/` altında alt modüller: `crm-pipelines`, `crm-deals`, `crm-accounts`, `crm-contacts`, `crm-activities`, `crm-tasks`.
- Her entity’de standartlar:
  - `tenantId` zorunlu, `createdAt/updatedAt`.
  - Attribution: `createdById/Name`, `updatedById/Name` (repo genelinde zaten var).
  - Tenant isolation: repository sorgularında `tenantId` her zaman filtre.

### Frontend stratejisi

- `App.tsx` içindeki `currentPage` yaklaşımını bozmadan yeni sayfalar:
  - `crm-pipeline`, `crm-deals`, `crm-accounts`, `crm-contacts` gibi sayfa anahtarları.
- Sidebar’a CRM menü grubu eklemek.

---

## 4) Yol Haritası (Aşamalı)

Aşamalar “çalışan ürün” odaklıdır; her aşama sonunda sistem kullanılabilir kalır.

### Faz 0 — Analiz ve tasarım (1–2 gün)

- Var olan domain’leri haritala: `customers`, `quotes`, `sales`, `invoices` bağları.
- CRM domain sınırlarını netleştir:
  - Account/Contact/Deal ilişkileri
  - Quote → Sale/Invoice dönüşüm noktaları
- “MVP pipeline” kapsamını kilitle:
  - Tek pipeline mı, çoklu pipeline mı?
  - Won/Lost nasıl kapanacak?

Çıktı:

- Veri modeli şeması
- Endpoint listesi
- UI ekran listesi

### Faz 1 — CRM çekirdek backend (MVP) (3–7 gün)

- Entities + modüller:
  - `CrmPipeline`, `CrmStage`, `CrmDeal`, `CrmAccount`, `CrmContact`
- Deal stage geçişi:
  - `POST /crm/deals/:id/move` (stageId)
  - Sıra ve validasyon (stage aynı pipeline’da mı?)
- Listeleme/board endpoint’i:
  - `GET /crm/pipelines/:id/board` (stages + deals)
- Tenant isolation + audit integration

Kabul kriteri:

- API ile pipeline/stage/deal yaratılabiliyor.
- Deal stage değişimi audit’e düşüyor.

### Faz 2 — CRM çekirdek frontend (MVP) (3–7 gün)

- Pipeline Board ekranı
- Deal create/edit modal veya sayfa
- Deal detay ekranı (en azından temel alanlar)
- Account/Contact minimum listeleri

Kabul kriteri:

- Kullanıcı UI’dan deal oluşturup sürükle‑bırak veya “Move” ile stage değiştirebiliyor.

### Faz 3 — Timeline / Tasks (operasyon) (3–7 gün)

- `CrmActivity` ve `CrmTask`:
  - Deal/Account/Contact’a bağlanabilir (polymorphic ilişki veya ayrı FK seti)
  - Atama (assigneeUserId), due date
- UI:
  - Deal detail içinde timeline + task list
  - (MVP) Customer detay modalında (Account=Customer) aktiviteler timeline + yeni aktivite ekleme

Kabul kriteri:

- Deal üzerinde “next step” yönetilebiliyor.

### Faz 4 — Quote/Invoice entegrasyonu (yüksek değer) (3–10 gün)

Amaç: Mevcut “teklif → satış → fatura” zincirini pipeline CRM’e bağlamak.

- Deal → Quote bağlantısı:
  - `dealId` alanını `Quote`’a eklemek (veya join table)
- Quote kabul edildiğinde:
  - Deal stage otomatik “Won” veya “Closed” olabilir (konfigüre edilebilir)
- Deal ekranından “Create Quote” aksiyonu

Kabul kriteri:

- Deal’den teklif oluşturulabiliyor ve durumlar senkron.

### Faz 5 — Raporlama ve satış metrikleri (3–10 gün)

- Pipeline forecast: açık deal toplamı (stage ağırlıklı)
- Win rate, cycle time, conversion
- Owner bazlı performans

---

## 5) Veri Modeli Taslağı (Öneri)

> İsimler örnektir; repo standardına göre netleşir.

- `crm_pipelines`:
  - `id`, `tenantId`, `name`, `isDefault`, `createdAt`, `updatedAt`
- `crm_stages`:
  - `id`, `tenantId`, `pipelineId`, `name`, `order`, `isClosedWon`, `isClosedLost`
- `crm_accounts`:
- **Account = Customer**: bu repo’da account verisi `customers` tablosunda tutulur.
- (Opsiyonel) `crm_customer_profile`:
  - `id`, `tenantId`, `customerId (unique)`, `website`, `industry`, `tags(jsonb)`, `createdAt`, `updatedAt`
- `crm_contacts`:
  - `id`, `tenantId`, `accountId`, `firstName`, `lastName`, `email`, `phone`, `title`
- `crm_deals`:
  - `id`, `tenantId`, `pipelineId`, `stageId`, `accountId(=customers.id)`, `primaryContactId?`,
  - `ownerUserId`, `name`, `amount`, `currency`, `expectedCloseDate`, `status(open/won/lost)`,
  - `wonAt?`, `lostAt?`, `lostReason?`, `createdAt`, `updatedAt`
- `crm_activities`:
  - `id`, `tenantId`, `entityType(deal/account/contact)`, `entityId`,
  - `type(call/email/meeting/note)`, `body`, `occurredAt`, `createdById`
  - Not (mevcut implementasyon): `opportunityId?` ve `accountId?(=customers.id)` nullable FK alanlarıyla ilerliyor (polymorphic yerine).
- `crm_tasks`:
  - `id`, `tenantId`, `entityType`, `entityId`, `title`, `status`, `dueAt`, `assigneeUserId`

---

## 6) Güvenlik ve Tenant İzolasyonu

- Her endpoint `JwtAuthGuard` ile korunmalı.
- Her sorgu `tenantId` ile scope’lanmalı.
- Rol kontrolleri:
  - Tenant admin her şeyi görür.
  - Normal user: kendi sahip olduğu deal’leri görür (opsiyonel: org içi görünürlük).

---

## 7) Plan Limitleri / Paketleme

Repo’da plan limitleri altyapısı var. CRM için önerilen limitler:

- `maxDeals`, `maxPipelines`, `maxContacts`, `maxAccounts`
- (Opsiyonel) `maxActivitiesPerMonth` gibi kullanım bazlı limit

---

## 8) Test Stratejisi (Minimum)

- Service unit testleri:
  - Deal stage move validasyonları
  - Tenant isolation (başka tenant’ın kaydı asla dönmemeli)
- E2E (en az):
  - Pipeline oluştur → stage ekle → deal oluştur → stage değiştir

---

## 9) Açık Kararlar (Netleştirme Listesi)

Bu dönüşümde hız için 3 kritik karar gerekiyor:

1. **Account = Customer** (kilitlendi)
2. Opportunity görünürlüğü: **Opportunity sahibi + takım** (kilitlendi; her Opportunity için takım yönetimi olmalı)
3. **Tek pipeline** (şimdilik) (kilitlendi)

Bu 3 kararı kilitledikten sonra Faz 1–2 çok hızlı ilerler.
