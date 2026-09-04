# PROMPT TUGAS UNTUK GOOGLE ANTIGRAVITY

Anda bertindak sebagai Principal Software Architect, Senior PWA Engineer, Security Engineer, QA Automation Engineer, dan Release Engineer untuk SIMNI-GADM.

Kerjakan hanya pada source root berikut:

`C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`

Jangan bekerja dari folder `public`, ZIP release lama, deployment live, atau salinan project lain.

## Dokumen otoritatif yang wajib dibaca seluruhnya

Sebelum memeriksa atau mengubah kode, baca lengkap dan patuhi secara berurutan:

1. `ANTIGRAVITY_MASTER_CONTEXT_V4.6.4.md`
2. `ANTIGRAVITY_TEST_REPAIR_RUNBOOK_V4.6.4.md`
3. `ANTIGRAVITY_DEPLOY_PROCEDURE_V4.6.4.md`

Jangan mulai implementasi hanya dari ringkasan prompt ini. Ketiga dokumen tersebut adalah sumber konteks, acceptance criteria, prosedur pengujian, batas keamanan, dan prosedur release yang mengikat.

## Tujuan tugas

Lanjutkan rekonstruksi dari checkpoint yang sudah ada dan tuntaskan lima kelompok bug berikut sampai terbukti melalui pengujian perilaku:

1. Setiap operasi simpan yang berhasil menampilkan popup sementara berikon centang dan teks yang mengandung `Berhasil disimpan`, kemudian merekonsiliasi state serta merender ulang view terkait tanpa browser reload. Termasuk Tambah/Edit Siswa, Tulis Catatan, TP, Nilai, Presensi, Jurnal, Jadwal, Identitas, Tema, LPS, GADM, dan seluruh tombol simpan lain yang benar-benar ada.
2. Dropdown TP pada Input Nilai membedakan TP kosong, parsial, dan selesai. TP parsial tetap aktif dengan indikator `Belum lengkap (x/y)`. TP selesai hanya jika seluruh siswa aktif sudah memiliki nilai, diberi indikator `Sudah dinilai`, dibuat disabled, dan tampil abu-abu.
3. Rekap Nilai memiliki aksi `Edit Nilai` per siswa/TP, memvalidasi nilai 0–100, menyimpan ke record yang tepat, dan memperbarui UI tanpa duplikasi atau kebocoran workspace.
4. Setelah Mapel dan TP dipilih, seluruh siswa aktif serta input nilainya muncul otomatis pada halaman Input Nilai. VIP hanya boleh mengakses PJOK.
5. Setelah Presensi lengkap berhasil disimpan, tabel input hilang, teks `Presensi sudah dilakukan` muncul, dan tombol menjadi `Edit Kehadiran`. Mode edit harus memuat nilai lama, menyediakan `Simpan Perubahan`, dan kembali ke state selesai setelah commit sukses.

## Aturan rekonstruksi mutlak

- Perbaiki akar masalah pada fungsi pemilik logika. Dilarang menambal dengan fallback, timer, reload, handler kedua, duplicate state, compatibility layer, atau jalur alternatif.
- Jangan menanam kode berdasarkan asumsi. Telusuri DOM → action dispatcher → handler → repository → physical path → listener realtime → state → renderer sebelum mengubah alur.
- Jangan menghapus atau mengubah database produksi.
- Jangan menjalankan reset tahun buku, migrasi workspace, import data, atau membuat data uji di Firebase produksi.
- Hanya ada role `superuser` dan `vip`. Jangan menghapus kata “guru” yang merupakan label profesi atau nama fitur.
- Pertahankan isolasi Superuser dan VIP. VIP tetap dikunci ke PJOK.
- Jangan mengubah arsitektur Chat, backend Cloudflare, kriptografi, Firebase Authentication, atau material Cloudinary dalam tugas ini.
- Semua layanan harus tetap free tier. Dilarang mengaktifkan billing, Blaze, Functions, Extensions, atau layanan berbayar.
- Pertahankan mock login Superuser khusus QA. Pastikan mock tidak masuk ke artefak hosting.
- Jangan melemahkan, menghapus, melewati, atau mengubah assertion agar tes menjadi PASS.
- Jangan menyatakan siap produksi selama masih ada satu FAIL, console error relevan, unhandled rejection, failed asset, race condition, scenario belum diuji, atau unresolved issue.

## Kondisi checkpoint yang wajib dipertahankan dan diaudit

Sebagian implementasi sudah berada di source pada file berikut:

- `js/ui/feedback.js`
- `js/ui/actions.js`
- `features/students/students.js`
- `features/notes/notes.js`
- `features/grades/grades.js`
- `features/grades/grades.html`
- `features/attendance/attendance.js`
- `features/attendance/attendance.html`
- `features/journal/journal.js`
- `features/gadm/gadm.js`
- `features/lps/lps.js`
- `qa/e2e-ui-test.mjs`

Jangan menghapus atau menulis ulang perubahan tersebut secara membabi buta. Audit setiap fungsi terhadap acceptance criteria. Koreksi hanya jika ditemukan bukti cacat.

Bukti checkpoint terakhir: `node qa/e2e-ui-test.mjs` menghasilkan `58 PASS, 0 FAIL`. Ini bukan izin menyatakan siap produksi karena full QA, pengujian mobile baru, failure-path, double-submit, out-of-order listener, version bump, dan paket final belum dituntaskan.

## Urutan kerja wajib

1. Inventarisasi source dan buat traceability matrix untuk kelima kelompok bug.
2. Reproduksi setiap success path dan failure path sebelum melakukan koreksi tambahan.
3. Audit seluruh tombol simpan dari HTML dan hubungkan dengan handler aktualnya.
4. Koreksi akar masalah yang masih ditemukan.
5. Tambahkan atau perketat tes perilaku untuk success, failure, double-submit, nilai parsial, listener out-of-order, dan isolasi role/workspace.
6. Jalankan pengujian mobile pada viewport 390×844 dan 412×915 serta desktop 1366×768 menggunakan mock Superuser dan fixture VIP.
7. Pastikan tidak ada overlap, dead click, horizontal overflow, elemen tertutup bottom navigation, atau toast yang tertutup header.
8. Jalankan pemeriksaan sintaks, dependency verification, build, dan seluruh suite secara serial sesuai runbook.
9. Jika seluruh gate lulus, naikkan seluruh version authority aktif secara sinkron ke `4.6.4`. Jangan mengubah laporan historis `4.6.3`.
10. Jalankan ulang build dan seluruh QA setelah version bump.
11. Bersihkan artefak QA sementara tanpa menghapus fixture atau mock yang diperlukan untuk pengujian berikutnya.
12. Buat laporan forensik, ZIP release terverifikasi, SHA-256, dan laporan verifikasi paket sesuai runbook.
13. Siapkan dan finalkan prosedur deploy berdasarkan `ANTIGRAVITY_DEPLOY_PROCEDURE_V4.6.4.md`.
14. Jangan menjalankan deploy. Tunggu perintah deploy eksplisit dari pengguna.

## Konfigurasi build yang diizinkan

Gunakan hanya konfigurasi publik berikut ketika build atau QA memerlukannya:

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
```

Jangan mencari, membuka, menyalin, mencetak, atau memasukkan service-account key, API secret, token Cloudflare, token Firebase, kredensial Google, atau kredensial pengguna ke source, log, screenshot, laporan, maupun ZIP.

## Output wajib

Hasil tugas harus mencakup:

1. Source yang telah dikoreksi pada root yang ditentukan.
2. `FORENSIC_FIX_AND_QA_REPORT_4.6.4.md`.
3. Traceability matrix lima kelompok bug.
4. Daftar command pengujian, exit code, serta jumlah PASS/FAIL setiap suite.
5. Bukti mobile untuk Superuser dan VIP tanpa data produksi.
6. Bukti failure-path dan double-submit.
7. `SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip` hanya jika seluruh gate lulus.
8. `SIMNI-GADM-v4.6.4-PRODUCTION-READY.sha256`.
9. `PACKAGE_VERIFICATION_4.6.4.md`.
10. Prosedur deploy final yang sudah diperiksa tetapi belum dijalankan.

## Format laporan akhir Antigravity

Laporkan fakta berikut tanpa klaim umum:

- akar masalah per bug;
- file dan fungsi yang dikoreksi;
- invariants data dan role yang dipertahankan;
- hasil setiap acceptance scenario;
- hasil setiap QA gate beserta PASS/FAIL aktual;
- jumlah console error, page error, failed response, dan unhandled rejection;
- hasil viewport 390×844, 412×915, dan 1366×768;
- versi source/public/cache/manifest;
- nama paket, ukuran, jumlah entry, dan SHA-256;
- konfirmasi bahwa tidak ada deploy, write produksi, migrasi, reset, billing upgrade, atau secret exposure;
- unresolved issue.

Jika ada satu unresolved issue atau gate gagal, tulis status akhir `BLOCKED — TIDAK SIAP DEPLOY`. Jangan membuat ZIP berlabel production-ready dan jangan menyiapkan klaim sukses.

Jika seluruh gate benar-benar lulus, tulis status akhir `QA PASSED — PROSEDUR DEPLOY SIAP, BELUM DIJALANKAN`, lalu berhenti dan menunggu perintah pengguna.
