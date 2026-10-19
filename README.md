# UP+ Cafe POS — prototipe

Aplikasi web kasir sederhana untuk diuji secara lokal. Buka `index.html` di browser, atau gunakan VS Code Live Server agar alamat aplikasi konsisten. Tidak ada server/database atau integrasi pembayaran dalam prototipe ini.

Peringatan terpenting: banner aplikasi kini menegaskan bahwa ini hanya prototipe. Pembayaran QRIS/metode lain tidak diproses otomatis—status lunas harus diverifikasi staff. Sebelum dipakai untuk penjualan sungguhan, pindahkan penyimpanan ke backend/database persisten dengan autentikasi, audit, dan backup yang teruji.

## Struktur folder

```text
up-cafe-pos/
├── index.html       # Struktur halaman, form, tabel, tombol, dan dialog
├── css/
│   └── styles.css   # Warna, layout responsif, tabel, dialog, dan layout cetak
├── js/
│   └── app.js       # Data, keranjang, checkout, laporan, backup, dan event UI
└── README.md        # Panduan penggunaan dan batasan
```

`index.html` memanggil `css/styles.css` melalui `<link>` dan `js/app.js` melalui `<script defer>`. `defer` membuat browser memuat JavaScript setelah struktur HTML diparsing.

## Penjelasan kode dan alur

### `index.html`

- Elemen `<nav>` berisi tombol untuk berpindah antara kasir, riwayat, laporan, pengelolaan menu, dan backup.
- Setiap area aplikasi menggunakan `<section class="panel">`. JavaScript menampilkan satu panel sesuai tab yang dipilih.
- `#menuGrid`, `#cartItems`, `#historyRows`, dan `#reportRows` adalah wadah yang diisi ulang oleh JavaScript.
- Dialog checkout meminta persetujuan sebelum membuat transaksi. Dialog struk meminta pilihan lebar 58 mm atau 80 mm.
- Banner `role="alert"` di bagian atas mengingatkan staff bahwa data belum layak menjadi arsip produksi.

### `css/styles.css`

- Variabel warna di `:root` menjaga warna konsisten.
- `.pos-layout` memakai CSS Grid untuk menu dan keranjang. Media query pada 850 px dan 540 px mengubah layout untuk tablet dan layar kecil.
- `@media print` menyembunyikan seluruh halaman kecuali `#receipt`. Lebar struk dipilih JavaScript melalui properti `--paper-width`.
- CSS hanya menyiapkan tampilan cetak; browser tetap membuka dialog print. Driver, ukuran kertas, margin, dan printer perlu diatur serta diuji sendiri.

### `js/app.js`

- `STORAGE_KEY` bernilai `upCafePosDataV1`. `readData()` membaca `localStorage`; jika belum ada data, fungsi membuat menu contoh dan daftar transaksi kosong.
- `saveData()` menulis seluruh objek aplikasi sebagai JSON dalam satu key localStorage. Jika penyimpanan gagal, aplikasi menampilkan pesan dan tidak mengklaim berhasil menyimpan.
- Data memiliki bentuk ringkas:

  ```js
  {
    menus: [...],
    transactions: [...],
    sequence: 1
  }
  ```

- `renderMenus()`, `renderCart()`, `renderHistory()`, dan `renderReport()` menggambar ulang bagian layar berdasarkan data aktif. `escapeHtml()` membantu mencegah teks menu/pelanggan diperlakukan sebagai markup.
- Tombol menu menambah item ke `cart` (Map sementara). Tombol `+`/`−` mengubah jumlah. `totalCart()` mengalikan harga dengan jumlah dan menjumlahkannya.
- `openCheckout()` memeriksa keranjang dan uang tunai, lalu meminta konfirmasi. `completeCheckout()` membuat satu objek transaksi baru, menyimpan snapshot nama/harga item, nomor unik, total, waktu, metode, status pembayaran, dan informasi pembatalan. Tunai dicatat lunas; QRIS/metode lain dicatat menunggu verifikasi.
- `cancelTransaction()` mengubah status transaksi menjadi dibatalkan dan mencatat waktu/alasan—bukan menghapus transaksi. `markPaid()` hanya mencatat bahwa staff menyatakan pembayaran diterima; fungsi ini tidak menghubungi bank atau penyedia QRIS.
- `exportBackup()` mengunduh satu file JSON. `importBackup()` memvalidasi format lalu menggabungkan ID transaksi/menu yang belum ada; tidak membuat file per pelanggan.
- `printReceipt()` menyiapkan markup struk lalu memanggil `window.print()`. Tidak ada komunikasi printer langsung atau cetak senyap.

## Cara menjalankan dengan penyimpanan yang lebih konsisten

1. Buka folder aplikasi di VS Code.
2. Gunakan server statis lokal, misalnya ekstensi Live Server di VS Code, lalu buka `index.html` dengan ekstensi tersebut.
3. Gunakan alamat yang sama setiap kali (termasuk nama host dan port), browser/profil yang sama, dan jangan gunakan mode Incognito. Origin berbeda dapat memiliki penyimpanan berbeda.
4. Buat backup dari tab **Backup & Info** sebelum menghapus data browser, mengganti browser/perangkat, atau melakukan pembaruan penting.

### Bagaimana data disimpan?

Browser `localStorage` adalah penyimpanan key/value kecil di profil browser. Prototipe menyimpan satu JSON untuk daftar menu, nomor urut, dan array transaksi. Data bertahan setelah tab/browser ditutup pada profil/origin yang sama, tetapi **bukan** database server, bukan backup, dan tidak tersinkron otomatis.

Jika membuka file langsung dengan URL `file://`, perilaku penyimpanan untuk file lokal bergantung pada browser. Untuk uji yang lebih konsisten gunakan alamat lokal melalui Live Server. Mengubah protokol, host, port, browser, atau profil dapat membuat data yang tampak tersimpan di tempat lain. Browser juga dapat menghapus data situs, dan kegagalan perangkat dapat menghilangkannya. Karena itu ekspor JSON dan simpan salinannya di media/lokasi terpisah. Coba impor backup pada profil uji sebelum mengandalkan prosedur pemulihan.

## Memilih printer thermal yang cocok

Belum ada model printer yang bisa direkomendasikan tanpa mengetahui perangkat kasir Anda. Cocokkan **semua** hal berikut sebelum membeli:

1. **Perangkat dan sistem operasi**: misalnya laptop Windows 11, tablet Android, atau iPad/iOS. Cari driver resmi pabrikan untuk OS dan versinya.
2. **Cara sambung**: USB harus cocok dengan port/adapter; tablet memerlukan dukungan host/OTG yang sesuai. Untuk Bluetooth, pastikan tipe/profilnya didukung OS—dukungan Bluetooth klasik dan BLE tidak selalu sama. Printer jaringan harus mendukung jaringan dan konfigurasi yang tersedia.
3. **Driver dan browser**: untuk prototipe ini, cara termudah adalah printer dipasang di OS, terlihat sebagai printer yang tersedia, dan bisa mencetak halaman uji dari OS serta halaman web biasa di browser yang akan dipakai (mis. Chrome/Edge). Pasang driver resmi, lalu uji dialog print browser.
4. **Kertas dan bahasa printer**: pilih lebar thermal 58 mm atau 80 mm yang memang didukung model tersebut; cek lebar area cetak, jenis kertas, cutter bila diperlukan, dan dukungan ESC/POS bila aplikasi POS/driver mensyaratkannya. Pilihan lebar pada aplikasi hanya mengatur layout CSS—tidak otomatis mengubah ukuran kertas pada driver.
5. **Uji sebelum digunakan**: cetak halaman uji OS, kemudian struk sampel dari aplikasi; periksa lebar, margin, pemotongan, karakter Indonesia, dan hasil pada tingkat skala 100%. Simpan konfigurasi yang berhasil.

`window.print()` memakai fasilitas cetak browser/OS dan biasanya menampilkan dialog. Ini **bukan** koneksi langsung ke printer, bukan cetak tanpa dialog, dan tidak menjamin setiap printer kompatibel. Cetak otomatis/senyap biasanya memerlukan driver/kiosk yang dikonfigurasi atau aplikasi penghubung/SDK khusus dengan pertimbangan keamanan. Untuk memastikan model tertentu, catat model printer, OS/perangkat, versi browser, dan koneksi (USB/Bluetooth/Wi-Fi), lalu cocokkan ke dokumentasi resmi pabrikan.

## Peringatan terpenting

> **Jangan gunakan prototipe ini untuk transaksi pelanggan sungguhan atau sebagai satu-satunya catatan penjualan.** localStorage dapat terhapus/hilang, tidak memiliki kontrol akses dan backup terjadwal, serta tidak dibagikan ke perangkat kasir lain. Status QRIS/metode lain hanya catatan manual, bukan bukti uang diterima. Sebelum produksi, pindahkan data ke backend dengan database persisten, autentikasi staff, audit trail, backup/pemulihan teruji, dan integrasi pembayaran/printer yang sudah divalidasi.
