# Jejak Resit (PWA)

Aplikasi untuk menjejak jumlah belanja di setiap kedai daripada gambar resit. Boleh dipasang pada Android dan iOS dari pelayar, tanpa kedai aplikasi.

## 1. Letak di pelayan HTTPS

Pemasangan memerlukan alamat `https://`. Membuka `index.html` terus dari fail tidak akan menawarkan pemasangan. Pilih satu yang percuma:

- **Netlify Drop**: buka app.netlify.com/drop, seret folder ini ke halaman itu.
- **Cloudflare Pages**: Create project, Direct Upload, muat naik folder ini.
- **GitHub Pages**: letak semua fail ini dalam repositori, kemudian Settings, Pages, pilih cabang `main`.

Aplikasi boleh diletak di sub-folder (contoh `nama.github.io/jejak-resit/`) kerana semua laluan adalah relatif.

## 2. Pasang pada telefon

**Android (Chrome):** buka alamat itu. Ketik butang **Pasang** dalam aplikasi, atau menu tiga titik, kemudian **Pasang aplikasi**.

**iPhone dan iPad (Safari sahaja):** buka alamat itu, ketik butang **Kongsi**, kemudian **Tambah ke Skrin Utama**.

## Cara data dikendalikan

- Resit disimpan dalam peranti (IndexedDB). Tiada pelayan, tiada akaun, dan data tidak dikongsi antara peranti.
- Menyahpasang aplikasi atau memadam data pelayar memadam resit. Guna **Sandaran** dalam bahagian "Data anda" untuk menyimpan fail JSON, dan **Pulihkan** untuk memulangkannya (juga untuk berpindah telefon). **Eksport CSV** untuk Excel atau Sheets.
- Bacaan resit menggunakan Tesseract.js dalam pelayar. Kali pertama ia memuat turun enjin dan data bahasa (beberapa MB), jadi perlu internet. Selepas itu ia disimpan oleh pelayar. Bacaan teks tidak sempurna, jadi semak nama kedai dan jumlah sebelum simpan. Tanpa internet, isi secara manual.
- Selepas lawatan pertama, aplikasi dibuka tanpa internet.

## Kemas kini

Selepas menukar fail, naikkan nombor `VERSION` di `sw.js` (contoh `jejak-resit-v2`) supaya peranti mengambil versi baharu.

## Kedai aplikasi

Fail ini ialah PWA, bukan pakej Play Store atau App Store. Untuk menerbitkan di kedai, bungkus alamat PWA anda dengan PWABuilder (Android) atau Capacitor (iOS dan Android). Itu memerlukan akaun pembangun berbayar dan Xcode untuk iOS.
