# Rekonstruksi UI/UX SIMNI 4.6.8

Revisi berdasarkan 12 temuan `UIUX_FORENSIC_AUDIT_4.6.7_2026-09-10.md`. Build sebelumnya dan bukti audit tetap dipertahankan di `test-output/uiux-4.6.7`; salinan baseline source hosting ada di `test-output/uiux-reconstruction/baseline`.

## Audit source sebelum uji runtime

Checkpoint: 10 September 2026, sebelum build/pengujian revisi.

- UX-01: renderer mengakses `aspect.options.map`, sesuai kontrak aspek; tidak mengubah isi laporan atau database.
- UX-02: pembuka Pengaturan memakai API `renderSIMNISettingsActionState` aktual, menghapus pemanggilan fungsi usang. Identitas tetap diisi renderer identitas yang sudah ada.
- UX-03: margin negatif GADM dilepas; toolbar hasil menjadi grid dua kolom `minmax(0,1fr)` di ponsel; konten tombol membungkus.
- UX-04: lifecycle dialog/drawer bersama menyimpan trigger, mengatur fokus/Tab/Escape dan inert sibling, lalu mengembalikan state sebelumnya. Preview LPS dan pemilih GADM terhubung ke lifecycle ini.
- UX-05: label field statis/dinamis diperbaiki; seed menjadi hidden; kelompok administrasi GADM tidak lagi radio yang berisi button. Warna primer tema dan kontras Chat/LPS diperkuat.
- UX-06: badge dashboard berupa status koneksi, tanpa tombol sukses palsu. Chat menyebut sesi aktif dan status offline, tanpa mengklaim tersinkron hanya karena sesi tersedia.
- UX-07: lifecycle loading membatalkan timer lama memakai generation, delay tampil 120 ms dan minimum tampil 300 ms; timer lama tidak boleh menutup operasi baru.
- UX-08: sukses memakai snackbar kecil dengan tutup dan status simpan tetap di view. Error/warning tidak hilang otomatis. Queue dibatasi empat, pesan identik dideduplikasi.
- UX-09: vendor scanner/XLSX/ExcelJS/PDF/ZIP dimuat pada entry point pemakaian, Promise loader dideduplikasi. Asset tetap ada pada release cache offline. QRCode ringan masih umum untuk profil siswa.
- UX-10: handler lokal LPS melewati elemen yang dimiliki dispatcher deklaratif sehingga satu elemen hanya memiliki satu pemilik action.
- UX-11: tombol panggilan Chat yang belum tersedia disembunyikan; toolbar riwayat/tindakan pesan mendapat styling yang konsisten.
- UX-12: target kontrol 44 px, radio/checkbox minimum 24 px, outline focus-visible, serta reduced-motion global.

Audit pemanggil vendor memeriksa entry point ekspor PDF/Excel, impor siswa/TP, scanner, dan DOCX. PDF GADM diberi guard Promise sebelum lazy load untuk mencegah dua ekspor selama pustaka dimuat. Build 4.6.8 diselaraskan pada package/lock/runtime/manifest/dashboard/index/Pengaturan; versi SW mengambil authority runtime. Belum deploy, APK/ZIP lama tidak diganti.

## Hasil audit ulang dan pengujian mock

**Revisi inti untuk 12 akar temuan telah diterapkan. Seluruh rancangan menuju UX 9/10 belum selesai atau terbukti.** Angka 92 pada audit awal adalah jumlah butir yang ditinjau, bukan 92 butir yang sekarang dinyatakan lulus. Status historis tidak ditimpa agar perbandingan sebelum/sesudah tetap dapat ditelusuri.

| Kelompok verifikasi | Hasil | Bukti |
|---|---|---|
| Regresi akademik: presensi, TP lama/Bab, nilai, jurnal, draf, isolasi kelas dan batas data | 24 PASS, 0 FAIL | [Hasil akademik](test-output/academic-4.6.8/results.json) |
| Alur UI/UX semua modul, 10 view × 4 lebar, tema, keyboard, offline, LPS/BLP dan Chat | 53 PASS, 0 FAIL | [Matriks rekonstruksi](test-output/uiux-4.6.8/reconstruction-results.json) |
| Pemeriksaan tambahan Pengaturan/GADM dan unduhan ekspor | 14 PASS, 0 FAIL | [Verifikasi tambahan](test-output/uiux-4.6.8/final/results.json) |
| Reflow teks 200% pada 320 px, masuk ulang Pengaturan menjaga field belum disimpan | 12 PASS, 0 FAIL | [Reflow](test-output/uiux-4.6.8/reflow/results.json) |
| Artefak final | 115 hash cocok; 60 JS lolos parse; 0 mock ikut hosting | [Integritas final](test-output/uiux-4.6.8/final-artifact-audit.json) |

Matriks utama memindai **52 keadaan dengan axe tanpa pelanggaran otomatis**. Ini mencakup modal siswa, preview LPS/BLP terisi, hasil GADM, enam tema dashboard terang, dashboard gelap, serta Chat sesudah skenario kirim/gagal. Bukan sertifikasi seluruh WCAG, seluruh tombol/cabang, atau semua kombinasi tema dan fitur. Pemeriksaan geometri 200% memakai perubahan root font-size dalam Chromium; bukan pengganti pengujian browser zoom 400%, keyboard virtual, atau perangkat fisik.

Semua suite di tabel menggunakan boundary login/database/jaringan mock di localhost. Tidak ada request eksternal yang tercatat atau exception browser tak terduga pada run lulus. Suite akademik memiliki satu error guard kapasitas yang memang diharapkan. Label “fitur dikecualikan” di suite akademik hanya berlaku pada suite tersebut; **GADM, LPS/BLP, dan Chat tetap diuji dalam suite UI/UX**.

Perubahan terakhir setelah matriks 53 PASS hanya menambahkan wrapping pada header builder GADM. Perubahan tersebut diverifikasi oleh run reflow terakhir dan audit artefak. Suite akademik dan ekspor tidak diulang setelah perubahan CSS/label yang tidak mengubah kontrak data/ekspor. ID build di masing-masing JSON dipertahankan; hasil dari beberapa checkpoint tidak dipresentasikan seolah satu eksekusi pada satu hash.

### Temuan yang sempat terlewat dan telah diperbaiki

- Unggah logo Pengaturan: label aksesibel belum ada dan native file input melebar pada 320 px. Diperbaiki dengan label serta grid dua baris yang dapat menyusut; empat lebar lulus uji ulang.
- Keterangan langkah GADM pada tablet/desktop: kontras teks terlalu rendah. Warna diperbaiki dan dipindai ulang pada empat lebar.
- Reflow 200%: baris unduh template Siswa mencapai 420 px, tanggal Jurnal 373 px, dan mode GADM 359 px pada viewport 320. Kontrol kini membungkus, parent input dapat menyusut, tab Jurnal tidak menjadi deretan huruf vertikal, dan header mobile dapat bertambah baris. Sepuluh view lulus geometri ulang pada 320 px.
- Audit kode terakhir menghapus optional call `renderProfileUI` yang tidak memiliki implementasi. Pengaturan menggunakan action-state API aktual; pengisian identitas tetap dikelola lifecycle yang sudah ada, sehingga masuk ulang tidak menimpa field yang sedang diedit. Teks profil “Memuat…” pada screenshot fixture berasal dari penggantian modul Auth; login/profil produksi tidak diklaim telah diuji.
- Iterasi awal mendapati snackbar menghalangi klik simpan di bawahnya dan lifecycle dialog menutup selector GADM saat pertama dipasang. Keduanya diperbaiki sebelum run lulus. Kegagalan percobaan tersimpan dalam `attempt-*.json`; tidak dihapus dari histori.

Unduhan **GADM PDF/Word/Excel serta LPS dan BLP Excel** ditunggu sampai browser melaporkan `completed`, lalu disalin menjadi bukti. PDF berawalan `%PDF`, XLSX berawalan `PK`, dan seluruhnya berukuran lebih dari 500 byte. Tombol PDF kembali aktif setelah ekspor. Ini membuktikan jalur pemuatan pustaka dan unduhan berfungsi, bukan fidelity setiap halaman/sel atau hasil cetak fisik. Contoh tampilan: [GADM mobile](test-output/uiux-4.6.8/final/gadm-390.png), [Pengaturan](test-output/uiux-4.6.8/final/settings-320.png), [Jurnal teks besar](test-output/uiux-4.6.8/reflow/jurnal.png).

## Yang belum tuntas dan tidak boleh dianggap lulus

| Bagian | Status nyata / pekerjaan berikutnya |
|---|---|
| Bootstrap benar-benar hanya shell/dashboard | Lima vendor berat sudah ditunda, tetapi runtime fitur umum masih dimuat berurutan saat login. Pemisahan runtime per fitur, profiling perangkat rendah, dan anggaran JS awal masih perlu dikerjakan. |
| Paket offline sangat kecil | Precache final berisi 101 path, total **7.442.624 byte** tanpa kompresi. Lazy loading mengurangi biaya parsing awal, tidak menghapus biaya unduh precache. Pemisahan paket offline shell/fitur/media serta indikator pemakaian penyimpanan belum direkonstruksi pada tahap ini. |
| Kecepatan dan kelancaran terukur | Run laboratorium utama mencatat login fixture sekitar 1.001 ms, LCP 4.608 ms, CLS 0, serta long task 71 dan 59 ms sebelum axe. Angka ini dipengaruhi host/fixture dan bukan data p75 pengguna. Target LCP 2,5 detik, INP, p95 transisi, baterai dan memori belum terbukti. |
| LPS/BLP form panjang | Preview, label, event dan ukuran kontrol direvisi. Rancangan pemecahan form ke beberapa bagian dengan indikator kelengkapan belum diterapkan sebagai alur baru. |
| Microcopy dan status lengkap | Status koneksi palsu sudah dihapus; waktu simpan ada. Waktu sinkronisasi terakhir yang persisten, pembedaan seluruh status layanan/antrean, dan pemetaan semua error teknis menjadi langkah pemulihan belum lengkap. |
| Dialog dan aksesibilitas menyeluruh | Dialog utama, fokus, Escape dan reduced-motion diuji. Seluruh varian modal, pembesaran 400%, keyboard virtual, screen reader, tema gelap tiap fitur dan perangkat fisik masih perlu verifikasi. |
| GADM seluruh keluaran | Modul Ajar dan jalur ekspor utama diuji. Semua jenis dokumen, paging riwayat, variasi dokumen panjang, DOCX helper, dan fidelity cetak seluruh halaman belum disertifikasi pada revisi ini. |
| Chat seluruh kemampuan | Teks terenkripsi, kegagalan kirim, draf, status offline dan penyembunyian panggilan diuji. Media sukses, mikrofon, push background, pemulihan kunci, autentikasi asli, dan integrasi produksi belum diverifikasi. Tindakan pesan diberi styling; penyederhanaan lengkap menjadi menu baru belum diterapkan. |
| Ketahanan jangka panjang | Guard volume/cache akademik lulus simulasi. Quota sistem penuh, eviction browser, pembaruan SW lintas beberapa versi/dua tab/rollback dan soak jangka panjang belum dibuktikan. |
| UX 9/10 atau 10/10 | Belum dapat dinyatakan. Perlu menutup pekerjaan source di atas, pengukuran perangkat acuan, review aksesibilitas manual, dan uji tugas dengan guru memakai rubrik audit awal. |

Ukuran lima vendor yang ditunda berjumlah **3.318.630 byte** mentah, sekitar **994.484 byte gzip** menurut kompresi lokal. Ini adalah pengurangan pustaka yang perlu dieksekusi saat dashboard baru dibuka, bukan penghematan seluruh paket offline atau jaminan waktu muat tertentu. Batas cache runtime 64 item/16 MiB/7 hari tetap ada; angka tersebut bukan batas total semua CacheStorage, IndexedDB, OCR atau database cloud.

Prioritas selanjutnya: selesaikan pemisahan runtime dan ukur dampaknya; lengkapi status sinkronisasi/error serta alur LPS; lalu jalankan penerimaan perangkat nyata, aksesibilitas manual, siklus pembaruan SW dan uji guru. Jangan menaikkan skor hanya berdasarkan jumlah test otomatis.

## Build akhir dan serah hasil

- Versi package, lock, runtime aplikasi, runtime cache dan manifest: **4.6.8**. Dashboard/index/Pengaturan diselaraskan oleh pemeriksaan build; SW memakai authority versi runtime.
- Build ID akhir: `52ff3dfe811450d64e90c49d38f142d63764b105fbf5cd14ea2dbb5e0bd44f7e`.
- Semua 115 hash sesuai manifest. Source dan public sesuai setelah memperhitungkan dua metadata Chat yang memang disisipkan build ke HTML. Tidak ada fixture mock atau source Worker yang ikut hosting.
- Source dan `public/` telah diperbarui lokal. **Belum deploy**, tidak menulis database produksi, dan APK/ZIP versi lama tidak dibangun ulang.
