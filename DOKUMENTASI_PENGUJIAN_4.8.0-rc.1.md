# DOKUMENTASI PENGUJIAN KANDIDAT SIMNI 4.8.0-rc.1

Dokumen ini memuat catatan resmi seluruh proses pengujian, pembuktian keamanan, verifikasi kontrak multi-role, audit berkas, pengujian konkurensi melalui Worker asli, eksekusi CLI migrasi terisolasi, pengujian waktu sewa offline & pencabutan akses, otomasi browser, serta integrasi penuh frontend ke Worker lokal dan RTDB emulator untuk kandidat **SIMNI 4.8.0-rc.1**.

> [!WARNING]
> **STATUS KESIAPAN KESELURUHAN: BELUM SELESAI DIVERIFIKASI**  
> Status kesiapan rilis produksi belum dinyatakan selesai (belum 100% siap rilis) karena:
> 1. Pembuatan paket aplikasi Android APK (debug maupun release) berstatus **DITUNDA ATAS PERMINTAAN PENGGUNA**.
> 2. Skrip migrasi skema 4 dan aturan akses baru baru dibuktikan pada emulator terisolasi dan **belum dieksekusi pada database produksi**.
> 3. Penyebaran (deployment) Cloudflare Worker dan Firebase Hosting produksi ditahan hingga ada instruksi eksplisit pengguna.

---

## 1. Identitas Database Produksi & Pembuktian Teknis Isolasi Jaringan (Network Firewall Proof)

Sesuai konfigurasi otoritatif pada `.firebaserc`, `firebase.json`, dan `js/core/runtime-config.js`:
- **Project ID Produksi**: `admin-kelas-3a`
- **Database URL Produksi Asli**: `https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app`
- **Auth Domain Produksi**: `admin-kelas-3a.firebaseapp.com`
- **Cloudflare Worker Gateway**: `https://simni-assets-gateway.2ndgoal.workers.dev`

### Pembuktian Teknis & Batasan Klaim "0 Outbound Request" ke Database Produksi
Klaim ketiadaan mutasi produksi dibuktikan secara aktif melalui mekanisme **Network Firewall & Request Logging Interceptor** yang membungkus `globalThis.fetch` pada lapisan runtime pengujian Node.js:
1. **Network Logging & Blocking Hook**: Seluruh panggilan `fetch` keluar yang diinisiasi oleh runtime pengujian (termasuk skrip pengujian, Worker bridge, dan panggilan REST) dipantau dan dicatat secara granular (mencatat timestamp, URL target, method, status respons, ETag, dan host tujuan).
2. **Pemblokiran Aktif Domain Produksi**: Interceptor jaringan secara aktif melempar galat penolakan keras (*hard block error*) apabila mendeteksi koneksi keluar menuju `admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app`, `*.firebasedatabase.app`, atau `*.firebaseio.com`.
3. **Hasil Pencatatan Jaringan Nyata**:
   - Pada pengujian konkurensi Worker asli (`native-worker-concurrency-evidence.json`): Tercatat 13 HTTP request; **0 request ke domain produksi**.
   - Pada pengujian integrasi penuh pipeline (`full-integration-pipeline-evidence.json`): Tercatat 13 HTTP request; **0 request ke domain produksi**.
   - Seluruh mutasi data berjalan 100% pada **Firebase RTDB Emulator lokal port 9000**.
4. **Batasan Transparan Pemantauan Jaringan**:
   - Interceptor ini memantau dan memblokir panggilan `fetch` keluar pada runtime Node.js pengujian.
   - Interceptor ini **tidak memblokir seluruh interface jaringan di tingkat sistem operasi (OS-level network interface/kernel socket)** dan tidak mengaudit lalu lintas internal atau telemetri bawaan peramban Chromium/Puppeteer.
   - Oleh karena itu, klaim "0 outbound request" dinyatakan secara presisi dalam batasan runtime pengujian tersebut.
5. **Ketiadaan Deployment & Build APK**: Tidak ada eksekusi `firebase deploy`, `wrangler deploy`, maupun perintah Gradle Android.

---

## 2. Metadata Lingkungan Pengujian Staging

| Parameter | Keterangan / Nilai |
|---|---|
| **Waktu Pengujian Terakhir** | 16 September 2026, 15:50 WIB |
| **Lokasi Staging** | `multirole-staging-4.8.0-rc.1/` (terisolasi dari baseline) |
| **Versi Source Kandidat** | `4.8.0-rc.1` (43 berkas dari paket revisi) |
| **Build ID PWA Diuji** | `9d6d4795a536988f95c9f4160380bd70c3a185f41613e8d55385cd85d4fa6bd4` |
| **Total Aset PWA Terverifikasi** | 111 berkas (verifikasi hash SHA-256 via `verify-hosting.mjs`) |
| **Emulator Database** | Google Firebase Realtime Database Emulator v4.11.2 (Lokal, Port 9000) |
| **Local Worker Server** | Server HTTP Node.js lokal (`http://127.0.0.1:8787`) yang memanggil fungsi `worker.default.fetch(req, env)` asli dari `edge/worker.js` (bukan emulator runtime Cloudflare mandiri seperti Miniflare atau Workerd) |
| **Browser Testing Engine** | Puppeteer Chromium Headless (Automated Browser Testing) |

---

## 3. Klasifikasi Pengujian: Tes Integrasi Penuh vs Tes Modul / Kontrak

Untuk menjaga kejujuran dan ketepatan audit, laporan pengujian ini secara eksplisit membedakan antara **Tes Integrasi Nyata** (yang melibatkan komunikasi antar-komponen nyata) dan **Tes Modul / Kontrak** (yang menguji logika unit/modul tertentu dengan dependensi lingkungan yang dikendalikan).

### A. Kategori 1: Tes Integrasi Penuh (Full Integration Tests)

Pengujian pada kategori ini menghubungkan komponen sistem yang sebenarnya tanpa mock logika internal:

| No | Nama Test Suite | Cakupan Komponen Terhubung | Exit Code | Status | Lokasi Bukti Hasil (Path Relatif) |
|---|---|---|---|---|---|
| 1 | **Integrasi Penuh Pipeline: Frontend -> Worker -> RTDB** | Browser UI (`accounts.html`) -> Local Worker (`edge/worker.js:8787`) -> RTDB Emulator (`:9000`) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/full-integration-pipeline-evidence.json` |
| 2 | **Konkurensi Worker Asli & CAS Optimistic Locking** | Request HTTP Paralel -> Handler Transaksi Worker Asli (`edge/worker.js`) -> RTDB Emulator (`:9000`) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/native-worker-concurrency-evidence.json` |
| 3 | **CLI Migrasi Asli (6 Skenario)** | Node Subprocess -> `scripts/migrate-multirole.mjs` Asli -> RTDB Emulator (`:9000`) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/migration-cli-evidence.json` |
| 4 | **Aturan Keamanan RTDB Production (10 Uji)** | Evaluator Aturan Akses Firebase Database Emulator v4.11.2 (`firebase/database.rules.production.json`) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/rtdb-production-rules-evidence.json` |
| 5 | **Aturan RTDB Maintenance Freeze (4 Uji)** | Evaluator Pembekuan Tulis Firebase Database Emulator (`firebase/database.rules.multirole-maintenance.json`) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/rtdb-maintenance-rules-evidence.json` |

### B. Kategori 2: Tes Modul & Kontrak (Unit & Module Tests dengan Controlled Mock)

Pengujian pada kategori ini menguji kode aplikasi asli namun menggunakan lingkungan/waktu simulasi untuk memverifikasi cabang logika kritis (*edge cases*):

| No | Nama Test Suite | Dependensi Mock / Lingkungan Terkendali | Exit Code | Status | Lokasi Bukti Hasil (Path Relatif) |
|---|---|---|---|---|---|
| 6 | **Modul Akses Asli (`access-context.js`) & Revokasi** | Modul asli di browser Chromium dengan manipulasi jam (`Date.now`) dan mock Firebase listener | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/access-context-evidence.json` |
| 7 | **Browser UI: Reload Sesi Pendaftaran** | Halaman asli `register.html` pada browser Chromium dengan mock persistensi auth sesi pending | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/browser-workflow-evidence.json` |
| 8 | **Audit Sintaksis & Tipe (43 Berkas)** | Pemeriksaan sintaksis statis dan integritas tipe 43 berkas source revisi | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/candidate-audit-evidence.json` |
| 9 | **Regresi Kontrak Statis & CSP (269 Uji)** | Verifikasi statis kebijakan keamanan konten (`script-src`, CSP header) | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/static-contract-evidence.json` |
| 10 | **Kontrak Multi-Role (8 Skenario)** | Mocking kontrak logika multi-role level data model dan spesifikasi arsitektur | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/multirole-contract-evidence.json` |
| 11 | **Pembersihan Chat & Gateway (6 Uji)** | Uji regex dan verifikasi ketiadaan artefak modul obrolan lama | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/chat-removal-evidence.json` |
| 12 | **GADM Engine Kurikulum 2026 (13 Uji)** | Pengujian mesin perhitungan administrasi guru dan template | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/gadm-evidence.json` |
| 13 | **LPS/BLP Contract & Template Excel (52 Uji)** | Validasi skema workbook lembar penilaian siswa dan rapor | `0` | **LULUS** | `test-output/qa-4.8.0-rc.1/lps-evidence.json` |
| 14 | **Paket Android APK (Debug / Release)** | *Ditunda / Tidak Ada Eksekusi Gradle* | `-` | **DITUNDA ATAS PERMINTAAN PENGGUNA** | Dokumen ini Bagian 8 |

---

## 4. Rincian Bukti Tes Integrasi Penuh Terbaru

### A. Integrasi Penuh: Frontend -> Worker Lokal -> RTDB Emulator & Pembuktian Pencabutan Hak Akses Tulis
- **Berkas Penguji:** [`qa/test-full-integration-pipeline.mjs`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/qa/test-full-integration-pipeline.mjs)
- **Bukti JSON:** [`test-output/qa-4.8.0-rc.1/full-integration-pipeline-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/full-integration-pipeline-evidence.json)
- **Arsitektur Integrasi:**
  1. Frontend PWA berjalan pada `http://127.0.0.1:4200` dengan konfigurasi `simni-edge-url: http://127.0.0.1:8787`.
  2. Server HTTP Node.js lokal pada port 8787 menerima request dan memanggil langsung fungsi `worker.default.fetch(req, env)` asli dari `edge/worker.js`.
  3. Worker terhubung ke basis data RTDB Emulator lokal pada `http://127.0.0.1:9000`.
- **Hasil Verifikasi Alur Persetujuan & Persistensi Nyata:**
  1. Superuser membuka antarmuka Kelola Akun di browser Puppeteer, memilih permohonan Calon Guru B, dan menekan konfirmasi "Setujui & tetapkan".
  2. Layanan `registration-service.js` asli mengirim request HTTP POST nyata ke Worker lokal (`http://127.0.0.1:8787/v1/accounts/approve`).
  3. Worker memproses persetujuan melalui `controlTransaction` dan menuliskan hasilnya ke database emulator.
  4. Dialog modal tertutup otomatis, dan UI menerima umpan balik `"Perubahan berhasil disimpan."`
  5. **Pembuktian Persistensi Langsung pada RTDB Emulator:**  
     Query langsung ke emulator pada path `accessControl/slots/2026-2027/1B.json` dan `accessControl/assignments/2026-2027/uid_pending.json` membuktikan data telah tersimpan permanen:
     - `slots['2026-2027']['1B']`: `status: 'occupied'`, `assignedUid: 'uid_pending'`.
     - `assignments['2026-2027']['uid_pending']`: `status: 'active'`, `classId: '1B'`, `workspaceId: 'ws_kelas1b'`.
- **Pembuktian Pencabutan Akses Tulis (Koreksi Path & Perbandingan Pra vs Pasca Pencabutan):**
  1. **Path Rules Sesuai Skema:** Path yang diuji adalah struktur resmi rules tanpa segmen `/data/`:  
     `workspaces/ws_kelas1b/academicYears/2026-2027/students/student_test_revocation.json`
  2. **Pembuktian Pra-Pencabutan (Berhasil - 200 OK):**  
     Saat guru masih berstatus aktif dengan penugasan kelas 1B, penulisan data siswa (`ID_Siswa`, `NISN`, `Nama Lengkap`) menggunakan token autentikasi guru tersebut **BERHASIL 100% (HTTP 200 OK)**. Verifikasi read-back pada emulator membuktikan data tersimpan sempurna.
  3. **Eksekusi Pencabutan Akun:**  
     Superuser mencabut penugasan guru melalui Worker `/v1/accounts/unassign`. Profil guru berubah menjadi `status: 'unassigned'` dan slot penugasan dilepas.
  4. **Pembuktian Pasca-Pencabutan (Ditolak - 401 Permission Denied):**  
     Menggunakan **identitas token yang sama, path yang sama persis, dan payload yang sama**, operasi tulis yang dicoba kembali setelah pencabutan secara tegas **DITOLAK OLEH ATURAN KEAMANAN RTDB EMULATOR DENGAN HTTP 401: Permission denied**.
  5. **Integritas Data Ruang Kerja:**  
     Query langsung ke database membuktikan data lama pra-pencabutan tetap utuh dan tidak tertimpa/termodifikasi oleh upaya tulis pasca-pencabutan.
  6. **Penolakan Sesi Worker:**  
     Request guru yang dicabut ke endpoint Worker `/v1/session` secara tegas **DITOLAK DENGAN HTTP 403 Access Denied** (`Tidak ada penugasan aktif atau akun telah dicabut`).
  7. **Batasan Mekanisme Antrean Sinkronisasi:**  
     Pengujian ini menguji penulisan REST langsung dengan token autentikasi guru terhadap emulator RTDB untuk membuktikan penegakan izin baca/tulis sebelum vs sesudah pencabutan; mesin antrean sinkronisasi latar belakang klien (background client sync queue pada `access-context.js`) **tidak dijalankan** sebagai proses otomatis.

---

### B. Konkurensi melalui Transaksi Worker Asli, Pencatatan Nyata HTTP 412, & CAS Retry
- **Berkas Penguji:** [`qa/test-native-worker-concurrency.mjs`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/qa/test-native-worker-concurrency.mjs)
- **Bukti JSON:** [`test-output/qa-4.8.0-rc.1/native-worker-concurrency-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/native-worker-concurrency-evidence.json)
- **Metodologi Pengujian:** Tidak ada pendefinisian ulang atau penulisan fungsi `controlTransaction` di dalam skrip tes. Dua permintaan persetujuan HTTP paralel dikirim langsung ke `worker.default.fetch()` dari berkas asli `edge/worker.js`.
- **Hasil Nyata Eksekusi Worker Asli & Pencatatan Dinamis HTTP 412:**
  1. Worker memproses kedua request secara paralel memanggil `createIO(env).controlTransaction()`.
  2. Request pertama berhasil melakukan commit `PUT /accessControl.json` ke RTDB emulator dengan **HTTP 200 OK** (menaikkan revisi database dari 10 menjadi 11).
  3. **Pencatatan Dinamis HTTP 412:** Interceptor jaringan runtime Node mencatat bahwa request kedua yang mengirimkan penulisan dengan `if-match` ETag usang menerima respons **HTTP 412 Precondition Failed** nyata dari RTDB emulator:
     ```json
     {
       "method": "PUT",
       "url": "http://127.0.0.1:9000/accessControl.json",
       "status": 412,
       "statusText": "Precondition Failed"
     }
     ```
  4. Skrip pengujian memverifikasi kemunculan HTTP 412 secara dinamis dengan asersi:  
     `assert.ok(rtdb412Entries.length > 0, 'HTTP 412 Precondition Failed must be captured from RTDB emulator')`.  
     Nilai `casRetryExecutedInsideWorker` pada berkas bukti kini dievaluasi secara dinamis (`rtdb412Entries.length > 0`), bukan nilai statis.
  5. Respons 412 memicu penanganan internal Worker pada baris 221 (`if (response.status === 412) return { preconditionFailed: true };`), yang mengeksekusi iterasi berikutnya (attempt 1) dari loop transaksi.
  6. Saat membaca revisi terbaru (11), fungsi `mutate` asli SIMNI mendeteksi konflik revisi dan menolak dengan galat otoritatif:  
     `Error: "Data akun berubah. Muat ulang sebelum melanjutkan." (Code: accounts/stale, Status: 409)`.
  7. Worker mengembalikan respons **HTTP 409 Conflict** kepada pemohon kedua.
  8. Ketika pemohon yang ditolak memuat ulang form dan mencoba kembali dengan revisi terbaru (11), fungsi `assign()` asli SIMNI di dalam Worker menolak dengan:  
     `Error: "Kelas 1A sudah dimiliki guru lain." (Code: accounts/conflict, Status: 409)`.
  9. Read-back RTDB emulator membuktikan slot 1A dimiliki secara eksklusif oleh pemenang (Zero Dual Ownership).

---

### C. CLI Migrasi Asli (`scripts/migrate-multirole.mjs`)
- **Berkas Penguji:** [`qa/test-real-migration-cli.mjs`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/qa/test-real-migration-cli.mjs)
- **Bukti JSON:** [`test-output/qa-4.8.0-rc.1/migration-cli-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/migration-cli-evidence.json)
- **Hasil 6 Skenario Otoritatif:**
  1. *Dry-Run:* Plan hash SHA-256 dibuat; 0 mutasi database dikonfirmasi pada emulator. Exit code: `0`.
  2. *Apply:* Menerapkan skema 4 dengan verifikasi ETag kondisional; data 3A tersalin utuh. Exit code: `0`.
  3. *Idempotency Rerun:* Apply ulang menghasilkan `Rencana sudah diterapkan; tidak ada penulisan ulang`. Dry-run ulang menghasilkan `Schema 4 sudah ada`. Exit code: `0`.
  4. *Target Conflict:* Membatalkan migrasi saat `ws_superuser` berbeda dengan `ws_kelas3a`: `Target 3A berkonflik; tidak di-overwrite.` Exit code: `1`.
  5. *DB Mutation After Dry-Run:* Menolak menerapkan rencana saat baseline berubah: `Baseline berubah atau maintenance belum aktif. Buat rencana baru.` Exit code: `1`.
  6. *Open-Access:* Berhasil membuka akses authority (`maintenance = false`). Exit code: `0`.

---

## 5. Rincian Bukti Tes Modul & Kontrak yang Dipertahankan

1. **Modul Akses Asli (`js/auth/access-context.js`) & Revokasi Akses** ([`access-context-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/access-context-evidence.json)):
   - Sewa offline sah terbukti pada $T_0 + 2\text{ jam}$ (`source: 'offline-lease'`).
   - Deteksi pemutaran jam mundur (`Date.now() < verifiedAt`) langsung ditolak fail-closed.
   - Kedaluwarsa sewa $> 8\text{ jam}$ langsung ditolak fail-closed.
   - Saat listener server menerima event `disabled`, fungsi internal `invalidate()` menghapus sewa dari `localStorage`, mengosongkan konteks memori, mengunci layar, dan menolak seluruh akses fitur berikutnya.
2. **Reload Sesi Pendaftaran Otomatis** ([`browser-workflow-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/browser-workflow-evidence.json)):
   - Menjalankan `page.reload()` nyata pada browser Chromium; handler `onAuthStateChanged` memulihkan sesi dan menyembunyikan form tanpa klik tombol manual.
3. **Delapan Skenario Kontrak Multi-Role** ([`multirole-contract-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/multirole-contract-evidence.json)):
   - Seluruh kontrak multi-role (pencegahan akses pending, anti-kepemilikan ganda, proteksi superuser, izin granular, draf tahun ajaran, dan isolasi cache) terkonfirmasi lulus.
4. **Regresi Statis & Baseline** ([`static-contract-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/static-contract-evidence.json), [`gadm-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/gadm-evidence.json), [`lps-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/lps-evidence.json), [`chat-removal-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/chat-removal-evidence.json)):
   - 269/269 uji statis CSP, 13/13 uji GADM Kurikulum 2026, 52/52 uji LPS/BLP template Excel, dan 6/6 uji pembersihan chat lulus tanpa regresi.

---

## 6. Bukti Terpisah: Aturan Akses RTDB Emulator (Production & Maintenance)

### Aturan Produksi (`firebase/database.rules.production.json`)
Terdokumentasi pada [`test-output/qa-4.8.0-rc.1/rtdb-production-rules-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/rtdb-production-rules-evidence.json):
- Tamu tanpa token diblokir membaca/menulis data (401).
- Guru hanya dapat membaca dan menulis data pada ruang kerja kelasnya sendiri.
- Klien menulis langsung ke node otoritas `/accessControl` atau skema lama diblokir (401).

### Aturan Maintenance Freeze (`firebase/database.rules.multirole-maintenance.json`)
Terdokumentasi pada [`test-output/qa-4.8.0-rc.1/rtdb-maintenance-rules-evidence.json`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/test-output/qa-4.8.0-rc.1/rtdb-maintenance-rules-evidence.json):
- Seluruh operasi tulis oleh Superuser maupun Guru dibekukan total (401).
- Pembacaan meta oleh akun terautentikasi tetap diizinkan (200).

---

## 7. Daftar Bug yang Ditemukan & Diperbaiki

1. **Pelanggaran CSP pada Markup Kandidat**:
   - *Lokasi:* [`features/settings/settings.html`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/features/settings/settings.html)
   - *Masalah:* Atribut inline `onclick="openGrantedAcademicArchives()"` melanggar `script-src-attr 'none'`.
   - *Perbaikan:* Diubah menjadi event listener deklaratif `data-simni-action="openGrantedAcademicArchives"` dan didaftarkan pada `ALLOWED_ACTIONS` di [`js/ui/actions.js`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/js/ui/actions.js).
2. **Inkonsistensi Regex Tes Pembersihan Chat**:
   - *Lokasi:* [`qa/chat-removal-regression.mjs`](file:///C:/Users/Aretha%20Hafiza%20S/Downloads/SIMNI/SIMNI_GADM_INTEGRATION/multirole-staging-4.8.0-rc.1/qa/chat-removal-regression.mjs)
   - *Masalah:* Regex pengujian chat bentrok dengan endpoint autentikasi sesi multi-role `/v1/session`.
   - *Perbaikan:* Regex dispesifikasikan hanya untuk sub-sistem chat lama.

---

## 8. Identitas & Status Paket Android APK

Sesuai instruksi tertulis pengguna:
> *"Tunda pembuatan APK, termasuk debug maupun release. Jangan menjalankan Gradle, sinkronisasi aset Android, atau mengubah konfigurasi versi Android pada tahap ini... Pembuatan APK hanya dilanjutkan setelah saya memberikan instruksi baru."*

| Atribut Konfigurasi | Nilai pada Proyek Baseline | Target Rencana 4.8.0 | Status Verifikasi Tahap Ini |
|---|---|---|---|
| **applicationId** | `id.sch.simni.app` | `id.sch.simni.app` | Terkonfigurasi di `android/app/build.gradle` |
| **versionCode** | `40702` | `40800` (atau lebih tinggi) | Menunggu instruksi build baru |
| **versionName** | `"4.7.2"` | `"4.8.0-rc.1"` | Menunggu instruksi build baru |
| **Status Paket APK** | - | - | **DITUNDA ATAS PERMINTAAN PENGGUNA** |
| **Status Perintah Gradle** | - | - | **TIDAK DIJALANKAN (DITUNDA)** |

---

## 9. Kesimpulan Kesiapan Rilis

1. **Status Kesiapan:** **BELUM SELESAI DIVERIFIKASI**.
2. **Hasil Komponen Staging:** Seluruh pengujian integrasi penuh (Frontend -> Worker -> RTDB Emulator, konkurensi Worker asli, migrasi CLI asli) serta tes modul & aturan akses telah **100% LULUS di lingkungan staging**.
3. **Komponen yang Masih Terbuka:**
   - Pembuatan dan verifikasi paket APK Android final (masih ditunda atas instruksi pengguna).
   - Pelaksanaan migrasi skema database live pada `https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app` (menunggu persetujuan pengguna).
   - Deployment live PWA hosting dan Cloudflare Worker (menunggu persetujuan pengguna).
