# Comptario Muhasebe v2

Modern, güvenli ve ölçeklenebilir (multi-tenant) muhasebe ve finans yönetim sistemi.

Güncel ve detaylı kurulum/dokümantasyon: [README_CLEAN.md](./README_CLEAN.md)

## 🚀 Hızlı Başlangıç

```bash
./start-safe.sh
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Swagger: `http://localhost:3000/api`

## 🧑‍💻 Codespaces / Geliştirme

```bash
./start-dev-new.sh
```

## 💾 Yedekleme

```bash
./quick-backup.sh
```

- Yedekler: `/workspaces/crm/backups`
- Geri yükleme: `./restore-backup.sh /workspaces/crm/backups/<dosya>.sql`

## 📚 Ek Kılavuzlar

- Basit başlatma: [BASLATMA.md](./BASLATMA.md)
- Doküman indeksi: [DOCS_INDEX.md](./DOCS_INDEX.md)

## 🧪 CRM Smoke (Geliştirme)

- Önerilen (backend kapalıysa otomatik başlatır):
	- `npm run smoke:crm:with-backend`
	- `npm run smoke:crm:authz:with-backend`
- Not: `npm run smoke:crm` / `npm run smoke:crm:authz` komutları backend ayakta değilse `curl` connection refused (exit 7) ile düşebilir.
