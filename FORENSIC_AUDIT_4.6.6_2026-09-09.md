# Audit forensik statis SIMNI v4.6.6

Tanggal: 9 September 2026 (Asia/Jakarta). Status: **laporan audit statis selesai; belum ada pengujian atau perbaikan**.

Root yang diperiksa: `C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`. Penulisan `\_` pada pesan diperlakukan sebagai escape underscore; direktori kerja aktual cocok dengan root yang dicatat dalam histori proyek.

## 1. Batas pemeriksaan dan kesimpulan

Pemeriksaan hanya membaca berkas, menelusuri kontrak antarmodul, membaca status Git, dan membandingkan SHA-256 berkas source dengan salinan `public`. Tidak menjalankan aplikasi, browser, login, server localhost, syntax check, test suite, build, deployment, maupun operasi database. Hanya laporan ini dan lampiran inventaris bukti yang dibuat. Source dan laporan historis dipertahankan.

Seluruh 23 berkas `.md` yang ada di root sebelum audit telah dibaca sebagai histori. Perintah pengujian/perbaikan dalam dokumen tersebut tidak dijalankan karena mandat saat ini adalah laporan dahulu.

**Kesimpulan utama:** terdapat cacat kontrak yang dapat menjelaskan gangguan input dan hilangnya perubahan. Namun penyebab aktual kegagalan presensi pada perangkat pengguna belum dapat ditetapkan tunggal tanpa status sinkronisasi, payload yang gagal, dan error runtime. Tidak ada bukti bahwa tanggal hari ini atau tanggal sebelumnya sengaja dilarang oleh kode/rules lokal.

| Permintaan | Hasil pemeriksaan statis |
|---|---|
| Presensi hari ini dan sebelumnya | Handler/action tersedia. Ada risiko form tertimpa realtime, NISN tidak konsisten, dan seluruh write terblokir ketika satu binding wajib tidak sehat. Penyebab sesi pengguna belum terkonfirmasi. |
| TP lama ditambahkan Bab | Jalur edit tersedia; tanpa Bab dapat menjadi Bab 1–10 dengan ID tetap untuk record berkunci kanonik. Tidak ada dukungan Bab bernama bebas atau Bab >10. Ada cacat relasi/completion nilai lama. |
| Jurnal harian guru | Form tersedia pada hari kerja; akhir pekan diblokir. Jadwal lama tanpa kelas tidak terpilih. Realtime dapat menghapus draft input. |
| Popup berhasil disimpan | Auto-dismiss memang ada, tetapi success menghasilkan dua notifikasi. Beberapa kegagalan simpan tidak diberitahukan; tema dapat mengklaim tersimpan meski persistensi gagal. |
| Versi 4.6.6, SW, dashboard | Deklarasi lokal konsisten. Sebelas berkas kritis identik dengan `public`. Versi SW aktif di perangkat/live/APK belum diperiksa. |
| Sinkronisasi dan pembengkakan | Ada isolasi, guard, cleanup listener, dan cache overwrite. Masih ada pembacaan seluruh koleksi, retensi belum menyeluruh, serta bug penandaan cache berhasil. |

Istilah **terbukti statis** berarti alur kode terlihat langsung; bukan hasil reproduksi runtime. Istilah **bersyarat** berarti dampak muncul bila bentuk data atau kondisi yang disebutkan terjadi. Semua skenario pengujian di laporan ini adalah rancangan, belum dieksekusi.

## 2. Alur yang ditelusuri

| Fitur | UI → handler | Repository dan path fisik | State → render |
|---|---|---|---|
| Presensi | `attendance.html:21` → dispatcher → `savePresensiManual` | `dbUpdate` → `workspaces/{workspace}/academicYears/{year}/attendance/{tanggal}_{nisn}` | `presensi` → `renderPresensiManual`, rekap, dashboard |
| Edit TP/Bab | `grades.html:116` → `submitEditTP` | `dbSet` → `.../learningObjectives/{id}` | `mapelTP` → daftar TP, dropdown input, dropdown rekap |
| Nilai | `saveNilaiBatch` / edit rekap | `dbUpdate` / repository → `.../grades/{id}` | `nilaiTP` → progress TP dan tabel nilai |
| Jurnal | `journal.html:21` → `saveJurnalHarian` | `dbUpdate` → `.../journals/JRN-{tanggal}-{jam}-{kelas}` | `jurnal` → form, rekap, dashboard |
| Jadwal | `saveJadwalMaster` | `dbSet('Jadwal', schedule)` → seluruh `.../schedule` | `jadwal` → tabel jadwal dan form jurnal |

Resolver `js/database/workspace-paths-core.js:8–54` memberi scope workspace/tahun, bukan direktori kelas. Isolasi kelas bergantung pada identitas record, field kelas, filter, dan kebijakan akses. Repository mengembalikan `{ok:false,error}` saat gagal; pemanggil harus memeriksa hasil tersebut.

## 3. Temuan prioritas tinggi

### F01 — Realtime mengganti form yang sedang diisi

**Terbukti statis; dampak bersyarat pada datangnya snapshot berubah.**

`js/database/sync.js:1329–1420` menerapkan snapshot dan menjadwalkan `renderCurrentView()` setelah inisialisasi. `js/ui/render.js`, fungsi `renderCurrentView`, memanggil `setPresensiTab('input')` atau `setJurnalTab('input')`, lalu renderer form kembali. `attendance.js:59` membangun ulang `body.innerHTML`; `journal.js:96` membangun ulang textarea dari state database. Form nilai juga dibangun kembali melalui `renderNilaiTPControls` → `updateTPDropdown` → `renderNilaiGrid`.

Isian yang masih hanya ada di DOM tidak disimpan sebagai draft dan tidak dijaga dengan status dirty. Snapshot berubah dari binding lain pun dapat memicu jalur ini. Dampaknya: radio/keterangan presensi, materi jurnal, input nilai, atau jadwal yang belum disimpan dapat terganti; tab pengguna juga dapat kembali ke input. Deduplicasi hash snapshot tidak melindungi perubahan payload yang nyata.

**Rancangan:** pisahkan state tersimpan dan draft form per workspace/tahun/kelas/tanggal/TP; render hanya bagian yang terdampak; pertahankan tab dan fokus. Realtime tidak boleh mengganti draft dirty. Setelah commit, bersihkan hanya draft transaksi yang berhasil, bukan form scope lain yang sudah dibuka selama menunggu.

### F02 — Identitas NISN presensi berbeda antara baca dan simpan

**Terbukti statis; dampak bergantung data lama.**

`attendance.js:29–32,59–61` mencocokkan NISN asli siswa dengan strict equality. `attendance.js:96–114` memakai `padStart(10,'0')` untuk NISN yang tidak cocok regex. Ingest siswa pada `sync.js:103–133` hanya mengubah ke string/trim, tidak memakai normalisasi yang sama.

Contoh hipotetis, bukan data pengguna: NISN sembilan digit disimpan menjadi sepuluh digit, tetapi siswa di state tetap sembilan digit. Commit dapat berhasil namun status lengkap dan data lama tidak dikenali. NISN berhuruf atau terlalu panjang tetap invalid setelah padding; rules `database.rules.production.json:82` mewajibkan tepat sepuluh digit. Satu record invalid dalam batch dapat menggagalkan seluruh update.

Pemakaian fallback key siswa sebagai NISN juga berisiko jika key sebenarnya `stu_...`. Jangan menganggap setiap ID siswa adalah NISN.

**Rancangan:** satu kontrak normalisasi/validasi identitas untuk ingest, pencarian, QR, render, commit, dan completion. Tampilkan siswa yang invalid sebelum mengirim batch. Jangan menebak NISN; pemulihan nol depan hanya melalui aturan data yang disepakati dan pemetaan eksplisit. Pertahankan ID siswa stabil. Audit duplikat terlebih dahulu.

### F03 — Satu binding tidak sehat memblokir semua penyimpanan

**Perilaku guard terbukti; belum terbukti menjadi penyebab sesi pengguna.**

`repository.js:169–243` mensyaratkan kesehatan binding wajib. `sync.js:571–586` menandai setiap binding terpilih sebagai `required:true`. Akibatnya, kegagalan satu koleksi yang diizinkan untuk role itu dapat menahan simpan presensi, nilai, jurnal, dan pengaturan bersama-sama. Guard offline juga ada. Indikator jaringan browser saja tidak membuktikan write Firebase siap.

Rules lokal presensi memeriksa format tanggal, NISN, status, dan akses workspace/tahun; tidak membatasi ke tanggal sekarang. Jurnal tidak memiliki larangan tanggal lampau pada rules lokal. Rules yang benar-benar terpasang belum dibandingkan.

**Rancangan:** pertahankan guard integritas. Tambahkan alasan terstruktur beserta binding yang gagal, status koneksi database aktual, dan pemulihan listener yang terlihat. Sesudah dependensi setiap operasi diketahui, pertimbangkan guard per operasi; jangan sekadar melonggarkan pemeriksaan global atau memakai cache lama sebagai bukti server sehat.

### F04 — Nilai kosong menjadi nol dan TP dapat salah dianggap selesai

**Terbukti statis; berdampak pada record legacy/kosong/rusak.**

`sync.js:226–242` mengubah nilai yang tidak memiliki `nilai`/`Nilai` menjadi `0`; string kosong juga menjadi `0` melalui `Number`. `grades.js:102–108` hanya memakai `Number.isFinite(Number(grade.nilai))` untuk completion, tanpa rentang 0–100. Karena itu record kosong dapat dianggap nilai sah; angka di luar rentang yang sudah ada juga dihitung selesai. Dropdown kemudian disabled (`grades.js:928` dan seterusnya).

Normalisasi `learningObjectiveId` dari `kode_tp` (`sync.js:230`) juga dapat membuat fallback legacy di `gradeMatchesTP` tidak pernah dipakai: fungsi tersebut langsung membandingkan ID jika field itu terisi. Kode TP tidak selalu sama dengan key Firebase TP. Dampaknya bisa sebaliknya: nilai lama ada tetapi TP dianggap belum dinilai, atau relasi mengarah pada TP yang keliru jika identifier bertabrakan.

**Rancangan:** kosong tetap kosong, nol tetap nilai sah. Satukan validator numerik ketat 0–100 pada ingest, completion, dan write. Simpan provenance ID legacy; resolusi relasi harus melalui workspace/tahun/kelas/mapel/semester/kode dan hanya bila unik, bukan mengubah kode menjadi ID seolah telah terverifikasi.

### F05 — Edit TP belum menjaga seluruh kontrak data lama

**Jalur tambah Bab ada; risiko tambahan terbukti statis.**

`grades.js:340–403` membuka TP lama, mengisi pilihan Bab, dan menyimpan `chapterNumber` pada ID yang sama untuk data berkunci kanonik. Bab tidak wajib; rules TP lokal `:90` tidak mensyaratkan Bab. Penambahan Bab saja tidak memerlukan membuat TP baru atau menghapus nilai.

Kekurangan:

- Pilihan hanya tanpa Bab atau Bab 1–10 (`grades.html:120`), tidak menyediakan nama Bab bebas.
- Edit menghapus field `bab_id`, `bab_nama`, `bab`. Metadata nama lama dapat hilang bila belum dipetakan dengan benar.
- `submitEditTP` tidak memeriksa duplikat kode dalam scope seperti `submitTP`.
- Edit kode/semester tidak memperbarui metadata terkait pada record nilai. Ini berbeda dari edit Bab saja dan memerlukan kontrak perubahan eksplisit.
- `getTPById` (`:38–48`) dapat fallback ke seluruh `state.mapelTP` dan mencocokkan kode; bukan semata ID pada kelas terlihat. Data ambigu lintas kelas harus ditolak.
- TP/siswa tanpa kelas diterima oleh filter visible/active (`grades.js:15–21,81–88`); edit TP tidak otomatis memberikan kelas pada TP lama tanpa kelas.
- Dropdown Input Nilai menampilkan kode/deskripsi/progress, belum menampilkan atau mengelompokkan Bab. Ini keterbatasan presentasi, bukan bukti penyimpanan Bab gagal.

**Rancangan:** edit Bab sebagai patch metadata ke key TP tetap; validator Bab integer, tanpa Bab tetap valid; pertahankan relasi nilai. Tetapkan scope TP lama melalui inventaris/mapping yang dapat ditinjau. Jangan migrasi massal otomatis. Edit kode/semester harus menolak konflik dan menangani metadata downstream secara atomik bila memang diizinkan.

### F06 — Jurnal legacy dan jadwal belum dinormalisasi konsisten

**Terbukti statis; penyebab aktual pengguna belum terkonfirmasi.**

`journal.js:69–93` menolak Sabtu/Minggu dan memfilter jadwal dengan kecocokan `item.Kelas` persis setelah normalisasi. Jadwal lama tanpa kelas tidak dipakai; fallback membuat enam slot bernama `Jam Ke-1` sampai `Jam Ke-6`, bukan mata pelajaran sebenarnya. `sync.js:476` hanya mengekstrak jadwal tanpa normalisasi field kelas.

`journal.js:98` mencari jurnal berdasarkan tanggal persis, jam dan kelas. Jurnal lama tanpa kelas tidak dimuat ke form, walaupun rekap menerima record tanpa kelas. Ingest jurnal (`sync.js:285–298`) memakai values saja sehingga tidak mempertahankan key Firebase sebagai ID saat ID payload hilang. Penyimpanan memakai ID baru dengan suffix kelas (`journal.js:122`); jurnal lama dengan ID tanpa kelas dapat tertinggal dan menjadi duplikat konseptual.

`saveJadwalMaster` menulis ulang seluruh koleksi jadwal (`:36–49`). Ia mempertahankan kelas lain dari state lokal, tetapi jadwal tanpa kelas terbuang saat penggantian. Dua perangkat dengan snapshot berbeda juga dapat saling menimpa perubahan koleksi.

**Rancangan:** normalisasi jurnal/jadwal termasuk key fisik, tanggal dan kelas; migrasi legacy harus eksplisit dan idempoten. Simpan jadwal per slot beridentitas kelas/hari/jam; lindungi konflik. Tentukan apakah kegiatan akhir pekan harus didukung. Jangan menganggap placeholder jam sebagai mapel final.

### F07 — Perubahan NISN siswa dapat memutus riwayat

**Temuan lintas fitur, terbukti statis.**

`students.js:52–80` mengizinkan perubahan NISN dengan menghapus key siswa lama dan menulis key baru. ID_Siswa dipertahankan, tetapi presensi dan sejumlah lookup masih memakai NISN. Operasi tersebut tidak memperbarui referensi presensi lama. NISN tujuan yang sudah digunakan juga tidak ditolak secara eksplisit di jalur submit ini.

**Rancangan:** larang tabrakan identitas; koreksi NISN harus menjadi operasi tersendiri dengan pemetaan referensi dan preview dampak. Prioritaskan ID siswa stabil sebagai relasi, sambil mempertahankan histori identitas. Jangan menjalankan koreksi data pada tahap laporan.

## 4. Popup dan hasil penyimpanan

### F08 — Dua notifikasi untuk satu success; kegagalan belum konsisten

**Terbukti statis, prioritas menengah.**

`js/ui/feedback.js:49–143` membuat overlay success dengan ikon centang, `role=status`, dan auto-dismiss 1.500 ms + animasi 300 ms. Fungsi kemudian meneruskan eksekusi membuat toast kedua dalam `toast-container`, dengan durasi 3.000 ms + 300 ms. Jadi popup muncul lalu hilang memang disengaja, tetapi satu success menghasilkan dua pengumuman. Overlay menangkap pointer selama tampil.

Presensi, nilai batch dan jurnal menunggu hasil repository sebelum success. Namun render dilakukan sebelum toast; exception render setelah commit bisa membuat penyimpanan yang sudah berhasil tampak gagal/tidak memberi sukses. Rancangan penanganan harus membedakan kegagalan commit dari kegagalan menyegarkan tampilan.

`journal.js:47–54` (jadwal) dan `notes.js:35–42` (catatan) tidak mempunyai cabang error ketika repository mengembalikan `ok:false`. Dispatcher hanya menangkap exception; hasil gagal yang sudah ditangkap repository tidak otomatis menjadi exception.

`js/ui/theme.js:47–49,68`: kegagalan `localStorage.setItem` menghasilkan warning sesi saja, tetapi pemanggil tetap dapat mengeluarkan success “Berhasil disimpan”. Persistensi tema berbeda dari database, namun klaim tetap harus jujur.

Dispatcher (`actions.js:180–245`) memiliki pengunci selama promise berlangsung. Ini perlindungan baik untuk elemen yang sama, belum menjamin idempotensi lintas tombol, perangkat, atau pengulangan transaksi.

**Rancangan:** satu notifikasi sukses per transaksi, teks konsisten dan auto-dismiss; error eksplisit pada semua hasil gagal; pertahankan draft saat gagal. Definisikan hasil untuk penyimpanan cloud vs lokal. Hindari retry write hanya karena render sesudah commit gagal. Inventaris tombol lain tetap perlu verifikasi perilaku nanti; audit statis ini tidak memberi PASS universal semua tombol.

## 5. Versi dan artefak build

| Authority lokal | Nilai |
|---|---|
| `package.json`, root metadata `package-lock.json` | 4.6.6 |
| `manifest.json:35` | 4.6.6 |
| `js/core/runtime-config.js:23–29` app/cache | 4.6.6 / 4.6.6 |
| `sw.js:32–83` | Mengimpor runtime-config, menggunakan manifest versi, memeriksa app = cache |
| `features/dashboard/dashboard.html:35` | SIMNI V.4.6.6 ENTERPRISE |
| `features/dashboard/dashboard.js:21–23` | Mengisi label dari runtime manifest |
| `android/app/build.gradle:10–11` | versionCode 40606 / versionName 4.6.6 |
| `Reconstruction_status.md:5` | Masih v4.6.5 |

SHA-256 source/public sama untuk 11 berkas: SW, manifest, runtime-config, attendance.js, journal.js, grades.js, sync.js, repository.js, feedback.js, dashboard.html, dashboard.js. Rincian hash ada di lampiran inventaris. Ini pembandingan berkas, bukan eksekusi build atau test.

**F09 — Risiko lifecycle versi, prioritas menengah:** SW memakai network-first untuk navigasi (`sw.js:733`) dan cache-first untuk asset shell. Halaman HTML baru dapat sementara berpasangan dengan asset worker lama saat update. `skipWaiting()` otomatis (`:877`) dan penghapusan cache versi lama mengharuskan koordinasi dengan tab yang masih berjalan. Nama cache bergantung versi; mengubah isi rilis tanpa bump versi dapat membuat reuse/penghapusan cache versi sama bermasalah (`:512–523`).

Build script pada akhir proses membaca versi package untuk log, tetapi bukan validasi kesetaraan semua authority. Dashboard menunjukkan label versi, bukan hash build unik. Nama ZIP/APK saja tidak membuktikan isinya identik.

**Rancangan:** release immutable dengan versi/build ID dan manifest hash; verifikasi seluruh authority sebelum packaging; koordinasi aktivasi SW dengan tab/form dirty. Verifikasi ZIP, asset APK, versi live, dan SW terpasang menjadi pekerjaan tahap berikutnya, bukan klaim laporan ini.

## 6. Sinkronisasi, cache, dan pertumbuhan jangka panjang

### Perlindungan yang sudah ada

- Resolver membatasi workspace/tahun; rules lokal mempertahankan role Superuser/VIP.
- Listener lama dibersihkan dan callback memakai generation/signature untuk menolak sesi lama.
- Snapshot identik dideduplicasi dengan hash.
- Cache utama IndexedDB ditulis ke key tetap per UID/workspace/tahun/schema, memakai hash integritas, antrean tulis, dan verifikasi transaksi. Bukan menambah record baru pada setiap save.
- SW membersihkan cache SIMNI versi lama dan tidak meng-cache request Firebase/Cloudinary eksternal.
- R2 memiliki expiry dan fungsi cleanup di `chat/edge/worker.js:328` dan seterusnya; chat memakai query berlimit. Keberhasilan job produksi belum diperiksa.
- Draft GADM memakai key scope tetap dan record dibatasi 2 MiB.

### F10 — Persistensi cache gagal tetapi revision dianggap selesai

**Terbukti statis, prioritas menengah.** `sync.js:941–944` menunggu `saveLocalBackup()` lalu menaikkan `cacheRevisionPersisted` tanpa memeriksa hasil. `local-cache.js`, fungsi `saveLocalBackup`, menangkap error dan mengembalikan `ok:false`. Akibatnya kegagalan quota/transaksi dapat tidak diulang untuk revision yang sama sampai ada perubahan lain. Cloud bisa berhasil sementara cache offline tertinggal.

**Rancangan:** akui revision hanya pada hasil sukses yang tepat; tampilkan degradasi cache lokal; retry terkontrol dan terikat scope. Jangan menyamakan cache gagal dengan commit cloud gagal.

### F11 — Retensi dan batas ukuran belum menyeluruh

**Risiko arsitektur terbukti; tidak ada pengukuran volume database/browser pengguna.**

| Penyimpanan | Risiko tersisa | Rancangan |
|---|---|---|
| RTDB akademik | `sync.js:1625–1648` memakai `onValue(ref(...))` seluruh koleksi, tanpa jendela tanggal/paginasi. Pertumbuhan presensi/jurnal/nilai memperbesar snapshot, hash, render, dan salinan cache. | Query sesuai periode dan kebutuhan, indeks yang tepat, pemisahan ringkasan dan detail; completion jangan dihitung dari data parsial. |
| Cache utama IndexedDB | Key tahun/akun lama tidak memiliki eviction umum; purge yang tersedia hanya scope tertentu/legacy. Full snapshot disalin dan di-hash. | Inventaris ukuran/key, kebijakan retensi tahun lama, ekspor terlebih dahulu; jangan menghapus satu-satunya salinan data lokal. |
| Cache runtime SW | Image/font same-origin ditulis tanpa batas jumlah/byte/usia; query URL dapat menghasilkan key berbeda. Tesseract non-precache juga dapat masuk app cache. | Normalisasi key, allowlist asset, batas jumlah/byte dan eviction aman. |
| Riwayat GADM | Setiap simpan membuat ID dokumen baru (`gadm.js:195–223`), history `getAll` (`gadm-storage.js:150`). Batas 2 MiB per record bukan batas total. | Bedakan update/revisi/salinan baru; batas riwayat yang dapat dipilih pengguna, pagination, indikator quota, ekspor dan hapus terarah. |
| Arsip cloud | Repository menyimpan snapshot penuh per archiveId; daftar arsip membaca seluruh objek, tidak hanya metadata. | Pisahkan metadata dan payload; retensi/versioning arsip setelah backup diverifikasi. |
| Chat | Limit query membatasi pembacaan, bukan jumlah pesan tersimpan. Expiry media R2 bukan penghapusan pesan Firestore. | Tetapkan kebijakan retensi pesan/metadata terpisah dan verifikasi cleanup yang sudah ada; jangan menghapus kunci enkripsi sebagai cache. |

Sebagai ilustrasi saja, 30 siswa × 200 hari menghasilkan 6.000 record presensi per kelas/tahun; 12 kelas menjadi 72.000. Ini bukan hasil menghitung database pengguna dan bukan prediksi quota. Titik penuh tidak dapat dihitung tanpa ukuran aktual, retensi, serta jumlah perangkat.

## 7. Pembacaan histori root

Inventaris lengkap 23 dokumen beserta hash tersimpan di lampiran. Ringkasan keterkaitannya:

- `INTEGRATION_SCOPE.md` dan laporan integrasi 4.6.0 menetapkan root terisolasi serta GADM lokal/scoped.
- Laporan 4.5.5 menetapkan dua role kanonik dan histori normalisasi workspace.
- Laporan/deploy 4.5.6, hotfix/deploy 4.5.7, serta audio/auth/deploy 4.6.1 mencatat media, session, cache, dan kepemilikan layar login. Gangguan sinkronisasi memang didesain menahan write, bukan logout.
- Laporan/deploy 4.6.2 dan hotfix/deploy 4.6.3 mencatat GADM, mobile, pemulihan sesi dan guard database.
- Dua Master Execution Specification menetapkan kontrak save, presensi selesai/edit, TP completion, isolasi kelas dan pengujian mock; instruksi eksekusinya tidak berlaku sebagai izin pada tahap sekarang.
- Master context, test/repair runbook, deploy procedure dan prompt 4.6.4 berisi checkpoint serta acceptance criteria, bukan bukti bahwa seluruh source 4.6.6 telah lolos.
- `CODEX_RUNTIME_AUDIT.md` dan `CODEX_AUDIT_AND_TEST_REFERENCE_4.6.4.md` identik SHA-256: mencatat audit terblokir pada 3 September karena kontradiksi mock/runtime.
- `CODEX_MAC_01_05_06_07_LOCALHOST_QA_4.6.4.md` mencatat keberhasilan lebih baru pada 4 September untuk subset MAC dan total histori 740 PASS. Hasil itu tidak dipindahkan menjadi PASS 4.6.6.
- `Reconstruction_status.md` masih menyebut build 4.6.5, normalisasi NISN/TP dan klaim mock. Runtime/repository sekarang tetap memakai Firebase cloud. Mock tahap selanjutnya harus dibuktikan terisolasi sebelum dipakai, termasuk bila lewat interception fixture QA.

**F12 — Provenance rilis belum lengkap:** working tree sudah memiliki banyak modifikasi dan file untracked sebelum audit. Tidak ada laporan root khusus 4.6.6 sebelum laporan ini. Bukti lama dan label versi tidak cukup untuk menetapkan perubahan mana yang memicu regresi. Dibutuhkan manifest release, checksum, dan matriks skenario yang mengacu build yang sama.

## 8. Rancangan rekonstruksi dan gerbang berikutnya

Seluruh tahap berikut **belum dilaksanakan** dan menunggu tindak lanjut setelah pengguna membaca laporan.

1. **Preservasi dan diagnosis terisolasi.** Bekukan fingerprint source; siapkan fixture legacy sintetis, boundary mock yang tidak dapat mencapai produksi, dan catatan status binding/error. Jangan memakai dataset produksi untuk mutation test. Bedakan write ditolak, pending jaringan, commit berhasil tetapi UI salah, dan data yang tidak cocok identitas.
2. **Pemulihan alur inti.** Tangani F01–F03: draft form, render selektif, konteks transaksi tetap, NISN kanonik dan diagnostik sinkronisasi. Jangan menghilangkan guard atau menambah timer untuk menebak commit selesai.
3. **Kontrak TP/nilai/jurnal.** Tangani F04–F07: nilai kosong, ID relasional, edit Bab tanpa mengganti TP, validasi konflik, mapping legacy yang dapat ditinjau, serta penyimpanan jadwal per slot. Pisahkan kebutuhan perubahan schema dari patch UI.
4. **Feedback dan daya tahan storage.** Tangani F08/F10/F11: satu success, semua error terlihat, hasil cache diperiksa, indikator quota/retensi. Penghapusan data/arsip dan migrasi produksi memerlukan rencana tersendiri dengan backup tervalidasi.
5. **Release dan QA.** Tangani F09/F12: build immutable, versi/manifest hash konsisten, provenance source/public/ZIP/APK. Jalankan pengujian berikut hanya sesudah ada izin melanjutkan. Deployment tetap langkah terpisah.

### Matriks pengujian yang diusulkan, belum dijalankan

| Area | Skenario wajib dan hasil yang diharapkan |
|---|---|
| Presensi | Hari ini, lampau dalam tahun aktif, parsial, lengkap, edit, reload; valid/invalid NISN; satu row invalid tidak menghasilkan success palsu; pergantian tanggal/kelas saat pending tidak mengubah scope transaksi. |
| Realtime | Ketik materi/nilai/ubah radio lalu kirim snapshot lain; draft, tab dan fokus tetap. Snapshot lama, reconnect, dua tab dan commit ditolak tidak menghapus input. |
| TP/Bab | TP legacy tanpa Bab → Bab 1/10 → reload → nilai lama tetap terhubung; tanpa Bab tetap didukung; duplikat kode ditolak; kelas/mapel/semester sama-sama divalidasi. |
| Nilai | Kosong bukan nol; 0/100 valid; -1/101/NaN invalid; completion benar untuk seluruh roster aktif; relasi legacy ambigu ditolak dan tidak dinormalisasi diam-diam. |
| Jurnal | Dengan/tanpa jadwal, jadwal tanpa kelas, ID lama, akhir pekan sesuai kontrak, edit/hapus/reload; tidak muncul dua record logis; jadwal kelas lain tidak tertimpa. |
| Popup | Satu success setelah commit, centang dan auto-dismiss; commit gagal mempertahankan form; render gagal setelah commit tidak mengulangi write; storage tema gagal tidak mengklaim tersimpan. |
| Cache | Quota/transaksi gagal, retry revision sama, pindah akun/tahun, reload offline, history besar; tidak menghapus data GADM atau kunci Chat dengan pembersihan cache shell. |
| Release | Semua authority, public, ZIP/APK dan worker aktif sesuai manifest; update dua tab dan form dirty aman; offline cold start memakai shell konsisten. |

Tidak ada jumlah PASS/FAIL runtime baru pada audit ini. Penyebab persis kendala pengguna, rules terpasang, isi storage perangkat, volume database, serta isi biner APK/ZIP masih belum diverifikasi. Laporan ini adalah dasar peninjauan dan rancangan perbaikan, bukan sertifikasi siap produksi.
