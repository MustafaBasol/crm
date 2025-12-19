# 🚀 TEK KOMUT - SORUN YOK!

## ⚡ Hızlı Başlatma

Codespace her açtığınızda SADECE bunu çalıştırın:

```bash
bash ./start-safe.sh
```

**O KADAR!** Başka hiçbir şey yapmayın.

## 🌐 Adresler

Uygulama başladıktan sonra:

- Frontend: http://localhost:5174
- Backend: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

## 👤 Giriş

```
Email: admin@test.com
Şifre: Test123456
```

## 🛑 Durdurmak İsterseniz

```bash
npm run stop:all
# veya
bash ./stop-dev.sh
```

## 🧪 CRM Smoke (Geliştirme)

Backend kapalıyken CRM smoke çalıştırmak için önerilen komutlar:

```bash
npm run smoke:crm:with-backend
npm run smoke:crm:authz:with-backend
```

Not: `npm run smoke:crm` backend ayakta değilse `curl` connection refused (exit 7) ile düşebilir.

## 💾 Yedek Almak İsterseniz

```bash
./quick-backup.sh
```

## ❓ Sorun mu Var?

1. Önce şunu deneyin: `./start-safe.sh`
2. Hala sorun varsa: Codespace'i yeniden başlatın
3. Hala sorun varsa: `./restore-backup.sh` ile son yedeği geri yükleyin

## 📋 VS Code'dan Başlatma

VS Code menüsünden:

1. **Terminal** → **Run Task**
2. **🚀 Uygulamayı Başlat** seçin

---

**ÖNEMLİ:** Codespace açılışında otomatik başlatma **varsayılan olarak kapalı**.
İsterseniz `AUTO_START=1` tanımlarsanız, container açılışında `start-safe.sh` tetiklenir.

**Son Güncelleme:** 27 Ekim 2025 ✅
