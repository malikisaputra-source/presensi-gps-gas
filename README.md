# Presensi GPS + Selfie (Google Apps Script)

Aplikasi absensi karyawan yang jalan di Google Apps Script. Karyawan buka link dari HP, ambil selfie, lalu tekan **Absen Masuk** atau **Absen Pulang**. Server mengecek apakah posisinya masih dalam radius kantor, mencatat jam ke Google Sheets, dan menyimpan fotonya ke Google Drive.

Gratis, tanpa hosting, tanpa database, tanpa API key peta.

## Fitur
- Login karyawan pakai **ID + PIN** (dikelola di sheet `Karyawan`).
- **Geofence di server**: jarak dihitung dengan rumus haversine di `Code.gs`, jadi tidak bisa diakali dari browser. Akurasi GPS yang terlalu buruk juga ditolak.
- **Selfie** lewat kamera depan (getUserMedia), diberi cap waktu, dikompres ±50 KB, lalu disimpan ke folder Drive.
- **Anti absen ganda**: masuk & pulang masing-masing sekali per hari; pulang hanya bisa setelah masuk. Ada `LockService` supaya klik dobel tidak tercatat dua kali.
- **Status otomatis**: Tepat Waktu / Telat (+ menit) / Pulang / Pulang Cepat, sesuai jam & toleransi di sheet `Pengaturan`.
- **Peta** Leaflet + OpenStreetMap: lingkaran radius kantor dan titik posisi karyawan.
- **Admin** (`?page=admin`): rekap harian (siapa sudah/belum hadir, link foto) dan bulanan (jumlah hadir, telat, total menit telat), ekspor CSV, cetak.
- **`setup()`** membuat semua sheet, contoh data, dan folder foto otomatis.

## Langkah deploy (detail untuk pemula)

### 1. Siapkan Google Sheet
1. Buka [sheets.new](https://sheets.new) dengan akun Google kantor/pribadi. Beri nama, misal **Presensi Karyawan**.
2. Menu **Ekstensi → Apps Script**. Tab baru editor skrip akan terbuka.

### 2. Tempel kode
1. Di editor, hapus isi `Code.gs` bawaan, lalu tempel seluruh isi berkas `Code.gs` dari paket ini.
2. Klik tombol **+** di samping *Berkas* → **HTML** → beri nama `index` (tanpa `.html`). Tempel isi `index.html`.
3. Ulangi: buat berkas HTML bernama `admin`, tempel isi `admin.html`.
4. Klik ikon disket (**Simpan proyek**).

> `demo.html` **tidak perlu** ditempel. Itu hanya halaman pratinjau statis.

### 3. Jalankan setup
1. Di toolbar atas, pilih fungsi **setup** pada dropdown, lalu klik **Jalankan**.
2. Muncul *Otorisasi diperlukan* → **Tinjau izin** → pilih akunmu.
3. Jika muncul "Google belum memverifikasi aplikasi ini", klik **Lanjutan → Buka (nama proyek) (tidak aman)**. Ini wajar karena skripnya milikmu sendiri.
4. Klik **Izinkan**. Kembali ke Google Sheet: sudah ada sheet `Karyawan`, `Presensi`, dan `Pengaturan`, serta folder **Foto Presensi - …** di Google Drive.

### 4. Isi pengaturan
Di sheet **Pengaturan** (kolom *Nilai*):
| Kunci | Contoh | Penjelasan |
|---|---|---|
| `nama_kantor` | Kantor Pusat | Tampil di aplikasi |
| `lat_kantor`, `lng_kantor` | -6.917464 / 107.619123 | Buka Google Maps, klik kanan titik kantor, klik angka koordinat untuk menyalin |
| `radius_meter` | 100 | Jarak maksimal. Di gedung tinggi/dalam ruangan pakai 100–200 m |
| `akurasi_maks` | 150 | GPS lebih buruk dari ini ditolak |
| `jam_masuk`, `toleransi_menit` | 08:00 / 10 | Lewat 08:10 = Telat (menit dihitung dari 08:00) |
| `jam_pulang` | 17:00 | Absen pulang sebelum ini = Pulang Cepat |
| `wajib_foto` | ya | `tidak` kalau tidak butuh selfie |
| `kunci_admin` | (ganti!) | Sandi halaman admin |

Di sheet **Karyawan**: isi `ID`, `Nama`, `Jabatan`, `PIN`, `Aktif` (`ya`/`tidak`). Hapus dua baris contoh.

Zona waktu: di Apps Script buka **Setelan proyek (ikon gerigi) → Zona waktu → (GMT+07:00) Jakarta** (atau sesuai lokasimu).

### 5. Deploy sebagai Web App
1. Klik **Terapkan (Deploy) → Deployment baru**.
2. Ikon gerigi di *Pilih jenis* → **Aplikasi web**.
3. *Jalankan sebagai*: **Saya**. *Yang memiliki akses*: **Siapa saja** (karyawan tidak perlu login Google; keamanan pakai ID + PIN).
4. Klik **Terapkan**, salin **URL aplikasi web** (berakhiran `/exec`).
5. Bagikan URL ke karyawan. Sarankan mereka *Tambahkan ke layar utama* di Chrome HP.
6. Halaman admin: URL yang sama + `?page=admin`, misal `https://script.google.com/macros/s/XXXX/exec?page=admin`.

### 6. Setelah mengubah kode
Setiap edit kode harus **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan**. URL tetap sama.

## Tips & pemecahan masalah
- **Lokasi/kamera tidak muncul**: pastikan membuka URL `/exec` lewat Chrome/Safari (bukan browser dalam aplikasi WA/IG), dan izin lokasi + kamera diizinkan.
- **Selalu "di luar radius"**: cek koordinat kantor (latitude Indonesia umumnya negatif) dan perbesar radius.
- **Akurasi buruk di dalam ruangan**: minta karyawan menyalakan Wi-Fi + GPS mode akurasi tinggi, atau naikkan `akurasi_maks`.
- **Kuota**: akun Gmail gratis cukup untuk puluhan karyawan per hari. Foto ±50 KB, 1 GB Drive ≈ 20.000 foto.
- GPS palsu (fake GPS) tidak bisa 100% dicegah oleh aplikasi web mana pun; selfie + cap waktu membantu verifikasi manual.

## Struktur folder
```
presensi-gps-gas/
├── Code.gs      # server: doGet, setup(), validasi radius, simpan Sheet & Drive, rekap
├── index.html   # halaman karyawan: login, peta, kamera, tombol absen
├── admin.html   # halaman admin: rekap harian/bulanan, ekspor CSV
├── demo.html    # pratinjau statis dengan data contoh (tidak dipakai di Apps Script)
├── meta.json, LICENSE, README.md, ss.png
```

## Ubah brand & warna
- Warna ada di blok `:root` paling atas `index.html` dan `admin.html` (`--navy`, `--lime`, dst).
- Huruf "P" di logo: cari `<i>P</i>` dan ganti dengan inisial perusahaanmu.
- Nama kantor diambil dari sheet `Pengaturan`.

## Lisensi
MIT — bebas dipakai dan dimodifikasi, asal menyertakan berkas LICENSE.

---
Dibuat oleh **Maliki Studio** — [malikisaputra.biz.id](https://malikisaputra.biz.id), follow TikTok/IG **@malikisaputra**
