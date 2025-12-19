# CRM → NestJS Backend Migration (Phase 1)

Bu doküman, CRM ekranlarının mock backend yerine NestJS backend üzerinden çalışması için gereken minimum (MVP) kapsamı ve repo içindeki mevcut durumun haritasını verir.

## Hedef

- Frontend CRM ekranları, tek bir kaynak olarak NestJS API’ını (`/api/crm/...`) kullanmalı.
- Yetki/visibility kuralları backend’de enforce edilmeli.
- Smoke/e2e ile temel akışlar regresyona karşı korunmalı.

## Mevcut Durum (Repo)

### Backend (NestJS)

CRM uçları tek controller altında:

- Controller: [backend/src/crm/crm.controller.ts](backend/src/crm/crm.controller.ts)
- Service: [backend/src/crm/crm.service.ts](backend/src/crm/crm.service.ts)
- Entities: [backend/src/crm/entities](backend/src/crm/entities)

Uçlar (özet):

- Leads: `GET/POST/PATCH/DELETE /crm/leads`
- Contacts: `GET/POST/PATCH/DELETE /crm/contacts` (+ `accountId` query)
- Pipeline bootstrap: `POST /crm/pipeline/bootstrap`
- Board (opsiyonel/legacy): `GET /crm/board` (stages+opportunities tek payload)
- Stages-only: `GET /crm/stages`
- Opportunities:
  - `POST /crm/opportunities`
  - `GET /crm/opportunities` (pagination + filtre: `q`, `stageId`, `accountId`, `status`, `limit`, `offset`)
  - `PATCH /crm/opportunities/:id`
  - `POST /crm/opportunities/:id/team`
  - `POST /crm/opportunities/:id/move`
  - `GET /crm/opportunities/:id` (visibility scoped)
- Activities: `GET/POST/PATCH/DELETE /crm/activities` (+ `opportunityId/accountId/contactId` query)
- Tasks: `GET/POST/PATCH/DELETE /crm/tasks` (+ `opportunityId/accountId` query)

Not: Activity ilişkilendirmesi artık DTO seviyesinde “en fazla bir ilişki” kuralını enforce eder (opportunityId/accountId/contactId).

### Frontend

API wrapper’lar:

- [src/api/crm.ts](src/api/crm.ts) (board + opportunity)
- [src/api/crm-leads.ts](src/api/crm-leads.ts)
- [src/api/crm-contacts.ts](src/api/crm-contacts.ts)
- [src/api/crm-activities.ts](src/api/crm-activities.ts)
- [src/api/crm-tasks.ts](src/api/crm-tasks.ts)

API base:

- Dev’de `API_BASE_URL` default olarak `/api` (Vite proxy) kullanır.
- Tanım: [src/api/client.ts](src/api/client.ts)

## Phase 1 Checklist (MVP)

1. Backend ayakta + smoke yeşil

- `npm run start:backend`
- `npm run smoke:crm`
- `npm run smoke:crm:authz`

2. CRM ekranları için minimum veri yüzeyi

- Board + pipeline stages (pipeline/board)
- Deal detail: opportunity CRUD + team + move (gerekirse `GET /crm/opportunities/:id`)
- Activities: deal/contact/account scoped list + create/edit/delete
- Tasks: deal/account scoped list + create/edit/delete

3. Yetki kuralları

- Stage move politika kararı: team member **asla** stage move yapamaz (owner/admin/ORG ADMIN/OWNER izinli)
- Visibility: non-admin kullanıcılar yalnız owner/team olduğu opportunity’leri, bunlara bağlı account/contact/activities/tasks üzerinden görebilmeli.

4. Test kapsaması

- Smoke: CRM CRUD + activities accountId/contactId + tasks + authz
- (Opsiyonel) E2E: stage-move authz (zaten mevcut)

## Phase 2 (Sonraki)

- Deal detail için board yerine daha ince-grained endpoint’ler (stages-only + `GET /crm/opportunities/:id`) ✅
- Opportunities list pagination/search (UI tarafında pipeline/board ayrıştırması için altyapı)
- CRM list ekranları: server-side filtre/sort/pagination
- Audit / activity feed zenginleştirme (actor, entity snapshot, comments)
