# 🚀 Hızlı Başlangıç

## Tek Komutla Başlat

```bash
npm run start:all
```

Bu komut:

- ✅ Eski servisleri durdurur
- ✅ Backend'i başlatır (Port: 3001)
- ✅ Frontend'i başlatır (Port: 5174)
- ✅ Durumları kontrol eder ve rapor verir

## Otomatik Yeniden Başlatma (Opsiyonel)

Servisler çökerse otomatik yeniden başlatmak için:

```bash
bash ./watch-services.sh &
```

Bu, arka planda çalışır ve varsayılan olarak her 30 saniyede bir servisleri kontrol eder.

## Manuel Komutlar

### Servisleri Başlat

```bash
bash ./start-dev.sh
```

### Servisleri Durdur

```bash
npm run stop:all
```

### Logları İzle

```bash
# Backend
tail -f .runtime/backend.log

# Frontend
tail -f .runtime/frontend.log
```

## URL'ler

- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:3001
- **API Docs:** http://localhost:3001/api/docs

## Sorun Giderme

Eğer servisler başlamazsa:

1. Port'ların boş olduğundan emin olun:

```bash
lsof -i :3001
lsof -i :5174
```

2. Tüm servisleri temizleyin:

```bash
npm run stop:all
```

3. Yeniden başlatın:

```bash
npm run start:all
```
