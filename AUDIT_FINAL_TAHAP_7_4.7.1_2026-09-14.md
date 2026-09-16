# Audit final Tahap 7 dan pemisahan Chat — SIMNI 4.7.1

Tanggal penyerahan: 14 September 2026. Pengujian dan rekonstruksi berlangsung pada 13–14 September 2026. Waktu UTC setiap eksekusi disimpan dalam bukti.

**Penghapusan Chat dari source dan Hosting selesai. Regresi kandidat final lulus 17/17 suite. Gerbang rilis penuh: BELUM LULUS, karena S02, S05 dan S07 masih terbuka.** Hasil pengujian yang lulus tidak menghapus temuan tersebut.

## Identitas hasil

- Versi kandidat lokal: **4.7.1**; package, lock, manifest, runtime, authority cache SW, dashboard dan pengaturan selaras.
- Build ID: `29a1603ee28862e23862268bdc7f2d452fdfea2882feb07298bdeaf3f58fc96f`.
- Hosting: **103 berkas**, seluruh checksum sesuai manifest; source dan public cocok setelah normalisasi metadata deployment yang memang disuntikkan build.
- Total aset Hosting: **13.011.261 byte mentah**. Ini bukan ukuran JavaScript yang langsung dieksekusi saat membuka dashboard.
- Dibanding snapshot pengambilalihan 4.7.0, **15 aset khusus Chat dilepas**, berjumlah **854.315 byte** atau sekitar **834 KiB** sebelum kompresi.
- Ringkasan dan checksum bukti: [final-evidence.json](test-output/tahap7-final/final-evidence.json). Hasil runner: [cumulative-results.json](test-output/tahap7-final/cumulative-results.json).

Tidak ada deployment, perubahan akun produksi, pengiriman pesan/push, penghapusan database cloud, ataupun penerbitan APK. APK/ZIP lama di root tetap merupakan artefak historis, bukan hasil kandidat ini.

## Perubahan Chat

| Bagian | Hasil |
|---|---|
| Navigasi desktop dan drawer mobile | Menu, tautan dan badge Chat dihapus. |
| Otorisasi | Fitur Chat tidak lagi tersedia untuk Superuser maupun VIP. |
| Autentikasi | Listener notifikasi dan derivasi/pembersihan kunci Chat dilepas dari login, logout dan perubahan kredensial. |
| Source klien | Folder `chat/`, `chat-notifications.js`, `chat-unlock.js` dan bridge `firebase-messaging-sw.js` dihapus dari source aktif. |
| SW dan vendor Hosting | Precache Chat serta handler push/notificationclick dilepas; SDK Firestore dan Messaging tidak lagi disalin ke Hosting. |
| Firebase deployment | Konfigurasi Firestore Chat dilepas dari `firebase.json` dan konfigurasi emulator kandidat. |
| Backup dan inventaris | Chat tidak lagi ditawarkan sebagai subsistem SIMNI. Format inti backup akademik dan data pengguna tidak dihapus. |
| QA | Tes khusus Chat lama diarsipkan; runner aktif menguji ketiadaan Chat dan kelangsungan fungsi SIMNI. |

Source sebelum penghapusan disimpan di `test-output/chat-separation-source/`, di luar Hosting dan diabaikan Git. Riwayat Markdown dan baseline pengujian tetap dipertahankan sebagai bukti historis, bukan source Chat aktif.

### Layanan dokumen yang sebelumnya berada di folder Chat

Cloudinary SIMNI memakai layanan yang sama dengan backend Chat lama. Karena itu fungsi penandatanganan unggah dan penghapusan aset dipertahankan sebagai **`edge/worker.js`**, dengan konfigurasi calon Worker baru **`simni-assets-gateway`**. Route keanggotaan, media Chat, push, Firestore, R2 dan cron pembersihan Chat tidak ada pada source Worker ini.

Konfigurasi klien sekarang bernama `SIMNI_EDGE_URL` / `simni-edge-url`. Default masih menunjuk layanan lama yang sudah menyediakan route Cloudinary. Nama host tersebut mengandung kata `chat`; **SIMNI hanya memanggil route Cloudinary**, bukan API Chat. Mengganti alamat menjadi Worker baru yang belum tersedia akan memutus unggah dokumen, sehingga perubahan endpoint cloud tidak dilakukan diam-diam. Lihat [edge/README.md](edge/README.md).

## Rekonstruksi dan koreksi yang selesai

1. **Draf persisten:** feedback sukses penyimpanan lokal menunggu `transaction.oncomplete`; abort/error tidak dianggap berhasil. Hidrasi draf ditunggu, scope sesi diperhatikan, dan ketikan baru selama commit tidak ikut dinyatakan selesai. Ruang feedback dibuat stabil agar kemunculannya tidak menggeser sasaran klik.
2. **Lifecycle SW:** install tidak lagi otomatis melakukan `skipWaiting`; tab lama tetap memakai cache versi lamanya. Aset offline yang kurang ditambahkan dan navigasi app-shell memakai cache release yang sesuai. Uji upgrade/rollback memakai SW serta IndexedDB nyata pada localhost.
3. **Modal yang memblokir interaksi:** penerapan izin sebelumnya membuka kembali overlay modal LPS yang seharusnya tertutup. `applyFeatureVisibility` kini mempertahankan visibilitas dialog/view milik lifecycle fitur, sehingga navigasi tidak meninggalkan overlay transparan yang menelan klik.
4. **Navigasi:** pergantian halaman menunggu hidrasi draf dan memeriksa urutan navigasi, lalu melepas view lama setelah target siap.
5. **Validasi LPS:** placeholder rules diganti persyaratan payload legacy, template, laporan dan revisi; fixture template asli yang diedit guru, draft/final, dan revisi bertingkat diterima emulator. Payload rusak yang diuji ditolak. Ini bukan klaim bahwa seluruh variasi data historis yang tidak tersedia sudah diuji.
6. **GADM:** dependensi ES module tidak lagi dimuat sebagai script klasik sebelum diimpor lagi. Tiga error sintaks yang sebelumnya tidak menggagalkan uji UI/UX dihilangkan. Pengujian pemilihan dokumen kini membuka picker sebelum mengeklik pilihan.
7. **UI siswa dan BLP:** toolbar siswa ditata ulang untuk ponsel; latar tombol Unduh yang hilang diperjelas. Label DRAFT di pratinjau BLP terbaca dan tidak menutupi isi. Watermark cetak tetap memakai tata letak sebelumnya.
8. **Jalur cadangan login:** impor platform pada `js/core/shell.js` diperbaiki menjadi relatif ke lokasi file yang benar.
9. **Bukti dan rilis:** runner berhenti saat gagal, menyimpan stdout/stderr dan checksum, serta memeriksa manifest sebelum/sesudah suite. QA statis tidak lagi membangun atau memodifikasi public. Hook pra-deploy sekarang memverifikasi artefak dengan `scripts/verify-hosting.mjs`, bukan membangun ulang setelah persetujuan.

Kegagalan antara, termasuk kontras watermark dan error pemuatan GADM, tidak dihitung sebagai keberhasilan kandidat final. Bukti percobaan sebelumnya tersimpan di `test-output/tahap7-attempts/` dan berkas `*-before-*-fix`.

## Hasil pengujian kandidat final

| Lingkup | Hasil aktual |
|---|---|
| Runner kumulatif | **17/17 suite PASS**, satu build ID, tanpa mutasi Hosting selama suite. |
| Penghapusan Chat | **6/6 PASS**: source/output hilang, izin ditolak, menu/auth/SW bersih, impor/precache tersambung, backend aset dan backup tetap sesuai. |
| Akademik | **24/24 PASS**: presensi hari ini/historis, gagal/sukses/double-submit, scope draf, jurnal legacy/konflik, TP legacy ditambah Bab, nilai, koneksi putus, reload dan VIP. |
| GADM mobile | **49/49 PASS** pada harness browser terisolasi; log tersedia dalam hasil runner. |
| UI/UX | **53/53 PASS**, termasuk state dialog, fokus, feedback, loading, offline, 320/390/768/1366 px, tema dan ketiadaan exception/request eksternal. |
| Reflow | **12/12 PASS**, termasuk teks 200% pada lebar 320 px. |
| SW dan draf | **8/8 PASS**, termasuk update lintas tab, IDB benar-benar abort, reload, ketikan saat commit, isolasi akun dan rollback baseline lokal. |
| Workflow LPS/BLP | **15/15 PASS**, unduhan nyata melalui browser, template editable, penambahan/penghapusan bagian dan ekspor offline. |
| Fidelity XLSX | **27/27 PASS**: struktur/layout, style, aset native, isian dan perubahan guru; semua bagian workbook offline BLP cocok dengan hasil online pasangannya. File acuan root tidak diubah. |
| Rules RTDB | **19/19 pemeriksaan PASS**, emulator project `demo-simni-tahap7`. Diagnosis S05 dilaporkan terpisah sebagai temuan terbuka. |
| Worker aset | **10/10 PASS** memakai token yang ditandatangani kunci sementara dan respons fetch lokal; unggah/cleanup sah diterima, origin/token/peran/scope/payload salah ditolak, route Chat tidak tersedia. |

Folder bukti yang masih bernama `academic-4.6.8` dan `uiux-4.6.8` adalah nama direktori historis harness. Identitas hasil ditentukan oleh manifest dan catatan runner, bukan nama folder. Hasil reflow ditautkan melalui checksum log runner dan checksum berkas hasil, karena payload reflow sendiri belum memiliki field buildId.

## Temuan yang belum selesai

### S02 — Tinggi: kapasitas listener operasional masih dapat menghentikan penyimpanan

`js/database/sync.js` masih menggunakan batas **20.000 record / 16 MiB**, dengan query `limitToFirst(MAX_BINDING_RECORDS + 1)`. Snapshot yang melampaui batas membuat binding gagal. `assertWritableState()` pada repository menahan penulisan ketika binding wajib belum sehat.

Penolakan data parsial bekerja dan telah diuji; **pemulihan operasional pada dataset besar belum diselesaikan**. Pagination backup tidak menggantikan listener yang menentukan kesiapan fitur.

Perbaikan berikutnya: ubah pembacaan fitur menjadi scope tanggal/kelas/periode yang diperlukan, paginasi sejarah secara terpisah, lalu ikat kesiapan tulis pada data yang relevan. Uji dataset melewati batas tanpa menaikkan limit atau menghilangkan guard sebagai jalan pintas.

### S05 — Tinggi: log committed belum membuktikan operasi dilakukan server

`dbRecordAuthoritativeAudit()` membentuk `status: 'committed'` di klien lalu menulis dan membaca balik log. Rules memvalidasi penulis serta bentuk record, tetapi tidak mengikat log dengan pelaksanaan reset/restore/arsip.

**Direproduksi di emulator:** klien sintetis berwenang menulis log `annual_reset` committed tanpa menjalankan reset; catatan pada tahun tersebut masih ada. Lihat `rules-emulator.json`, bagian `openFindings`. Ini bukan akses terbuka bagi semua pengguna, melainkan batas keandalan bukti audit.

Perbaikan berikutnya: operasi administratif dan pencatatan hasilnya dimiliki jalur server yang tepercaya, dengan operation ID, penanganan retry/idempotensi dan hasil yang diverifikasi. Bila tetap berupa catatan klien, label dan klaimnya harus mencerminkan hal itu.

### S07 — Tinggi untuk offline: pembersihan cache tidak sesuai label aman; batas runtime hilang

`purgeSafeCaches()` pada `js/database/local-cache.js` mengiterasi **seluruh** `caches.keys()` lalu menghapus setiap cache. Tidak ada filter yang membatasi penghapusan ke runtime SIMNI.

**Direproduksi dengan objek Cache API sintetis:** `simni-app-4.7.1`, `simni-runtime-4.7.1`, dan `unrelated-app-cache` semuanya dihapus. Bukti: [cache-gap.json](test-output/tahap7-final/cache-gap.json). Ini menghapus Cache Storage, bukan bukti penghapusan IndexedDB pengguna; dampaknya adalah kehilangan aset yang diperlukan untuk membuka aplikasi offline.

Selain itu, `staleWhileRevalidateRuntimeAsset()` pada `sw.js` masih melakukan `cache.put` tanpa batas jumlah, byte atau umur otomatis. Batas 64 item / 16 MiB / 7 hari yang disebut laporan historis 4.6.9 tidak tampak pada kandidat sekarang. Tombol pembersihan manual tidak menggantikan batas tersebut.

Perbaikan berikutnya, berurutan:

1. Batasi purge pada nama runtime SIMNI yang memang boleh dibersihkan; pertahankan app-shell aktif, cache versi yang masih digunakan tab dan cache aplikasi lain.
2. Pulihkan pembatasan entry/byte/umur pada runtime cache, tanpa menyentuh cache akademik, draf, GADM atau data Chat yang telah dipisah.
3. Uji purge dengan app-shell aktif, cache asing, tab lama, kondisi offline dan kegagalan quota; buktikan pembukaan ulang tetap bekerja.

## Checklist cakupan dan batas penilaian

- [x] Navigasi, menu, scope peran, jalur import dan pemuatan fitur diperiksa.
- [x] Tombol/dialog, fokus keyboard, Escape, feedback gagal/sukses, loading, ukuran layar dan pembesaran teks diuji pada state yang disebut di atas.
- [x] Aksesibilitas otomatis pada state sampel lulus; hasil ini tidak menggantikan uji pembaca layar dan evaluasi pengguna.
- [x] Draf, konflik, reload, pergantian versi dan rollback baseline lokal diperiksa.
- [x] Template dan hasil unduhan LPS/BLP diperiksa terhadap acuan root.
- [x] Build, source/public, scope Hosting, penyisihan mock dan bukti per-suite diperiksa.
- [x] Batas kapasitas dan pembersihan storage diaudit; temuan terbuka dipisahkan dari tes yang lulus.
- [ ] Baseline **live 4.6.9** lengkap belum tersedia. Uji upgrade/rollback menggunakan snapshot **4.7.0 lokal terverifikasi**, bukan bukti upgrade dari deployment live 4.6.9.
- [ ] Perangkat fisik, kamera QR nyata, APK baru, cloud live, penerimaan guru dan soak jangka panjang belum diverifikasi.
- [ ] Predikat UX 9/10 atau 10/10 dan “super ringan” tidak dinyatakan terbukti. Pada satu run headless, pengukuran startup mencatat LCP sekitar 4,5 detik dan CLS 0; ini bukan benchmark lapangan yang terkendali. Paket Hosting tetap sekitar 12,4 MiB mentah, dengan vendor berat dimuat saat diperlukan.

## Penyerahan dan urutan tindak lanjut

Pemisahan Chat dan koreksi kandidat di atas selesai. Audit final diserahkan dengan **tiga temuan terbuka**, sehingga tidak ada klaim Tahap 7 telah mendapat persetujuan rilis penuh.

Urutan berikutnya yang disarankan: **S07 purge dan batas cache → S02 pembacaan operasional → S05 audit server → audit ulang perubahan → regresi pada kandidat baru → keputusan rilis**. Kerjakan satu perubahan perilaku per checkpoint agar asal regresi dapat dilacak. Tidak perlu membangun ulang seluruh arsitektur.

Runbook kandidat: [DEPLOYMENT_RUNBOOK_4.7.1.md](DEPLOYMENT_RUNBOOK_4.7.1.md). Runbook 4.7.0 sudah diberi penanda historis. Jangan menggunakan rollback yang mengembalikan Chat tanpa keputusan eksplisit, karena baseline lama masih memuat modul tersebut.
