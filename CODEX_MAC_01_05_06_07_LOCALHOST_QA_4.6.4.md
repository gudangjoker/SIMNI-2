# Laporan Audit dan Regresi Localhost MAC-01, MAC-05, MAC-06, dan MAC-07

**Build:** SIMNI v4.6.4  
**Tanggal uji:** 4 September 2026  
**Pelaksana:** Codex  
**Status akhir:** PASS  
**Kegagalan:** 0  
**Deploy:** Tidak dilakukan

## Batas dan Isolasi Pengujian

- Source yang diuji: `C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`.
- Seluruh regresi langsung dijalankan pada satu origin `http://127.0.0.1:4500`.
- Seluruh MAC diuji dalam satu sesi mock Superuser dan satu database IndexedDB yang sama.
- Mode mock bersifat localhost-only dan tidak menghubungi Firebase produksi.
- Sesi, data, dan tampilan dimuat ulang di origin yang sama untuk membuktikan persistensi dan sinkronisasi antarmuka.

## MAC-01 — Popup Simpan dan Rekonsiliasi Tampilan

**Status: PASS**

- Tambah siswa `Damar Uji MAC` berhasil disimpan.
- Popup `Berhasil disimpan.` tampil dengan `role="status"`, ikon centang, lalu hilang otomatis.
- Siswa baru langsung muncul tanpa navigasi manual.
- Catatan `Catatan regresi MAC-01 tersimpan.` berhasil disimpan.
- Popup keberhasilan Catatan Guru tampil dengan kontrak yang sama.
- Catatan langsung muncul pada Rekap dan tetap ada setelah reload penuh.
- Siswa baru tetap ada setelah reload penuh.

Koreksi sumber yang terverifikasi:

- `js/ui/feedback.js`: notifikasi sukses memakai container resmi, live-region aksesibel, dan ikon centang konsisten.
- `features/students/students.js` serta `features/notes/notes.js`: state dan tampilan direkonsiliasi setelah write berhasil.

## MAC-05 — Siklus Presensi Selesai dan Edit

**Status: PASS**

- Presensi disimpan untuk seluruh delapan siswa aktif kelas 3A.
- Setelah simpan, tabel hilang dan diganti status `Presensi sudah dilakukan`.
- Tombol utama berubah menjadi `Edit Kehadiran`.
- Tombol edit membuka kembali tabel dan berubah menjadi `Simpan Perubahan`.
- Status uji awal tersimpan: Alya Hadir, Bima Sakit, Citra Izin, Damar Alpa.
- Damar diubah menjadi Sakit; perubahan tetap tersimpan setelah reload.
- Siswa hasil impor yang belum diubah memperoleh nilai default Hadir secara konsisten.
- Tidak ada siswa kelas 3B atau 4A di tabel presensi kelas aktif.

## MAC-06 — LPS/BLP, Semantik Input, Persistensi, dan ExcelJS

**Status: PASS**

### UI dan penyimpanan

- Dropdown siswa LPS/BLP hanya memuat delapan siswa kelas aktif 3A.
- Siswa kelas 3B dan 4A tidak muncul.
- LPS memakai input sesuai kontrak: ceklis untuk aspek ceklis, dropdown A–D untuk skala A–D, dan teks untuk aspek naratif.
- Nilai LPS siswa `Damar Uji MAC` tersimpan dan pulih setelah reload: nilai `C`, ceklis aktif, deskripsi `Deskripsi regresi MAC-06.`.
- Nilai BLP siswa yang sama tersimpan dan pulih setelah reload: Murojaah `Murojaah lancar MAC-06`, nilai `B`, dan ceklis aktif.
- Simpan Draft menampilkan popup keberhasilan dengan ikon centang.

### Workbook aktual

- Ekspor memakai `ExcelJS 4.4.0` yang exact-pinned.
- LPS aktual: 174.689 byte, SHA-256 `5F87ED4F38C44178BF132D70E9B2B018E980F2F391C60163142CB4003F3C2BCA`.
- BLP aktual: 161.004 byte, SHA-256 `426AF6C251041A0992FC7B42BEC7DF396E7720B7796D8D0DC76F8161E224F586`.
- Masing-masing workbook berisi tepat delapan sheet siswa aktif.
- Tidak ada sheet master/template yang tertinggal.
- Nama sheet unik dan mengikuti nama siswa.
- Anchor nama siswa dan NISN terisi pada setiap sheet.
- Data contoh/dummy pada template telah dibersihkan.
- Layout, style, merge, gambar/logo, page setup, margin, header/footer, view, property, dan fingerprint sel seluruh sheet identik dengan workbook contoh.
- Nilai hasil uji berada pada anchor template yang benar, termasuk `O18=C`, deskripsi LPS, ceklis LPS, serta teks Murojaah BLP pada `O25`.
- Verifikasi workbook aktual: **72 PASS, 0 FAIL**.

Koreksi sumber yang terverifikasi:

- `features/lps/lps.js`: daftar siswa dibatasi ke kelas aktif; ekspor membuat satu duplikasi presisi template per siswa tanpa menimpa struktur template.
- `features/lps/lps-core.js`: tipe input dan pemetaan aspek LPS/BLP mengikuti struktur workbook contoh.
- `qa/generated-workbook-layout-verification.mjs`: pemeriksa reusable untuk workbook aktual terhadap template asli.

## MAC-07 — Impor Siswa Satu Kelas dan Banyak Kelas

**Status: PASS**

- Template satu kelas menampilkan preview `1 baru`, `1 duplikat`, dan `2 ditolak`, lalu commit berhasil.
- Template banyak kelas memproses dua belas kelas dan menampilkan preview `9 baru`, `0 duplikat`, dan `4 ditolak`, lalu commit berhasil.
- Data aktif kelas 3A memuat `Eka Import`, `Siswa 3A Satu`, `Siswa 3A Dua`, dan `Siswa 3A Tiga`.
- Data impor tetap ada setelah reload penuh.
- Data kelas 3B dan 4A tidak bocor ke daftar siswa aktif, LPS/BLP, maupun presensi.
- Data siswa yang sudah ada tidak tertimpa oleh baris duplikat.

## Gerbang Regresi Efek Domino

Seluruh gerbang dijalankan langsung dengan Node karena shim `npm` pada host tidak tersedia. Kondisi shim host tidak memengaruhi runtime atau paket aplikasi.

| Gerbang | Hasil |
|---|---:|
| Runtime sandbox | 167 PASS |
| Chat query | 12 PASS |
| Chat audio | 17 PASS |
| Security contract | 75 PASS |
| GADM engine | 13 PASS |
| LPS/BLP contract | 40 PASS |
| Excel template | 10 PASS |
| Static/build contract | 226 PASS |
| E2E UI/PWA | 59 PASS |
| GADM mobile workflow | 49 PASS |
| Workbook aktual LPS/BLP | 72 PASS |
| **Total** | **740 PASS, 0 FAIL** |

Validasi efek domino mencakup dua-role policy, isolasi workspace/tahun/kelas, auth lifecycle, reload offline Service Worker, Chat, GADM, CSP, Firebase Rules, PWA assets, dan deterministic hosting build.

## Kesimpulan

- **MAC-01 sukses.**
- **MAC-05 sukses.**
- **MAC-06 sukses.**
- **MAC-07 sukses.**

Keempat MAC lulus regresi langsung dalam satu sesi localhost yang sama dan lulus seluruh gerbang efek domino dengan total **740 PASS, 0 FAIL**.
