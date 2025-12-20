# CRM — “Nice to Have” (Temel CRM sonrası)

Bu doküman, bu repo’daki **temel CRM** (Faz 0–4) tamamlandıktan sonra, ürünü “çok iyi olur” seviyesine taşıyacak geliştirmeleri **kategoriler** halinde toplar.

Hedef: günlük kullanımda daha az sürtünme, daha iyi görünürlük, daha güçlü güvenlik/uyum, daha hızlı ekip operasyonu.

## 1) Raporlama & Analitik

- Funnel raporları: Lead → Contact → Opportunity → Won/Lost dönüşüm oranları, aşama bazlı geçiş süreleri.
- Pipeline sağlık metrikleri:
  - Stage age (aşamaya göre bekleme süresi)
  - Stale deals (X gündür güncellenmeyen)
  - Win rate (owner/team/stage bazlı)
- Tahminleme (Forecast): beklenen kapanış tarihine ve olasılığa göre weighted forecast.
- Aktivite metrikleri: kullanıcı/ekip bazında günlük/haftalık activity/task hacmi.
- “Audit-friendly export”: raporların CSV export’u + export event telemetrisi.

## 2) Otomasyon & İş Akışları

- Kurallı otomasyon (basit):
  - Stage değişince otomatik görev oluşturma
    - Durum: Uygulandı (backend rule engine + stage move tetiklemesi)
    - API: `GET/POST/PATCH /api/crm/automation/stage-task-rules`
    - Doğrulama: `backend/scripts/smoke-crm.sh` (Postgres ile) “opportunity move triggers automation task” adımı
  - Deal won olunca follow-up checklist
  - Stale deal için hatırlatma
    - Durum: Uygulandı (staleDays + optional stage filtresi + cooldown ile dedupe)
    - API: `GET/POST/PATCH /api/crm/automation/stale-deal-rules`, `POST /api/crm/automation/run/stale-deals`
    - Doğrulama: `backend/scripts/smoke-crm.sh` (Postgres ile) “automation (stale deal reminder creates task)” adımı
- Sıralı görev akışları (sequence-lite):
  - “3 gün sonra ara, 7 gün sonra e-posta gönder” gibi zincirler.
- SLA ve görev eskalasyonu: due date aşımı → owner + manager bilgilendirme.

## 3) Bildirimler & Hatırlatmalar

- In-app bildirim merkezi (CRM odaklı): assigned tasks, mention, stage change.
- E-posta / push bildirim tercihleri (tenant scoped) ve “quiet hours”.
- Calendar entegrasyonu (ICS export): task due date veya activity için ICS oluşturma.

## 4) Arama Deneyimi

- Global search: müşteri/kişi/deal/aktivite/görev tek arama kutusu.
- Gelişmiş filtreler:
  - Çoklu kriter (owner, stage, amount range, updatedAt range)
  - Kaydedilmiş filtreler (Saved views)
- Full-text arama (DB destekli): PostgreSQL `tsvector` ile title/notes araması.

## 5) Yetkilendirme (RBAC) & Veri Erişimi

- Daha esnek rol matrisi:
  - “team member stage move” gibi kuralları tenant bazında yapılandırabilme.
  - Alan bazlı izinler (ör. amount alanını sadece admin görebilsin).
- Visibility modelinin genişletilmesi:
  - “private/shared/public” opportunity
  - “team” tanımları ve varsayılan paylaşım politikaları.
- Audit trail zenginleştirme:
  - Kim, neyi, ne zaman değiştirdi (field-level diff)
  - Export/print/quote-share gibi aksiyonların loglanması.

## 6) Veri Kalitesi & Operasyonel Güvenlik

- Duplicate detection (müşteri/kişi): e-posta/telefon/domain bazlı olası duplicate önerileri.
- Import iyileştirmeleri:
  - Dry-run, hata raporu, satır bazlı validasyon
  - Mapping şablonları
- Soft-delete + geri alma (undo): kritik entity’lerde geri alma penceresi.
- Retention/purge politika seçenekleri (tenant bazlı).

## 7) UX / Üretkenlik

- Klavye kısayolları ve hızlı komut paleti (create lead/task, search, navigate).
- Inline editing (liste üzerinden hızlı güncelleme).
- Bulk actions: çoklu seçip stage change / owner change / tag ekleme.
- Kanban kalite:
  - Drag & drop + optimistic UI
  - WIP limit göstergeleri
- “Next best action” paneli: yaklaşan due tasks + stale deals.

## 8) Entegrasyonlar

- E-posta entegrasyonu (IMAP/Google/Microsoft): e-postayı activity olarak bağlama.
- Telefon/VoIP entegrasyonu: çağrı loglarını activity olarak ekleme.
- Slack/Teams entegrasyonu: belirli event’leri kanala bildirme.
- Webhook/outbox pattern:
  - CRM event’leri için webhook
  - Güvenli imza + retry.

## 9) Performans & Ölçeklenebilirlik

- Liste endpointleri için indeks audit:
  - `updatedAt`, `ownerId`, `stageId`, `accountId` gibi alanlarda doğru index.
- N+1 sorgu tespiti ve giderimi (TypeORM ilişkiler).
- Caching (dikkatli): read-heavy listelerde kısa TTL.
- Pagination standardizasyonu:
  - Cursor pagination (çok büyük dataset’ler için)
  - Stabil tie-break garanti.

## 10) Test & DevEx

- Playwright E2E (kritik CRM akışları):
  - Lead→Opportunity→Quote→Won
  - Authz negatif senaryolar
- Daha hızlı smoke:
  - Daha küçük “smoke:crm:quick” (yalnızca 2–3 kritik akış)
- Seed data / demo tenant: lokal geliştirmede tek komutla örnek veri.
- Observability:
  - Request id + structured logging standardı
  - Basit tracing (opsiyonel)

## 11) Güvenlik (Nice-to-have)

- Rate limit’lerin CRM özel uçları için gözden geçirilmesi (özellikle search/list uçları).
- PII maskeleme seçenekleri (loglarda / export’ta).
- Güvenli paylaşım linkleri (quote gibi): kısa TTL + revocation.

## Önerilen öncelik sırası (genel)

1. Raporlama (pipeline sağlık) + saved views
2. Otomasyon (stale deal + stage based task)
3. Global search + gelişmiş filtre
4. RBAC esnekliği + audit trail
5. Entegrasyonlar (calendar/ICS en düşük sürtünme)

Not: Bu liste bir “yol haritası” değil; ürün ihtiyacına göre seçilecek geliştirme havuzudur.
