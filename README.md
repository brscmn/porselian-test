# Porselian Etsy Listing Automation

Bu paket, Porselian tas tozu dekorasyon urunleri icin Etsy listeleme metinleri uretir.

## Ne uretir?

- Etsy SEO basligi
- Etsy aciklamasi
- 13 Etsy tag
- kategori onerisi
- materyal bilgisi
- bakim notu
- fotograf cekim kontrol listesi

## Kullanim

1. `data/products.csv` dosyasina urunlerini ekle.
2. Asagidaki komutu calistir:

```bash
node scripts/generate_etsy_listings.mjs
```

3. Ciktilar `data/etsy_listings.csv` ve `data/etsy_listings.json` olarak olusur.

## GitHub Actions

Repo GitHub'a yuklendiginde `Generate Etsy Listings` workflow'u manuel olarak calistirilabilir.
Workflow, `data/products.csv` dosyasini okuyup Etsy ciktilarini artifact olarak verir.

## Urun CSV kolonlari

- `sku`: urun kodu
- `product_name_tr`: Turkce urun adi
- `product_type`: vase, candle_holder, tray, bowl, wall_decor, bookend, incense_holder
- `color`: ana renk
- `style`: minimalist, modern, scandi, boho, rustic gibi
- `dimensions`: olcu bilgisi
- `set_count`: set adedi
- `keywords`: virgul ile ek anahtar kelimeler
- `notes`: ozel notlar
