# Laporan Audit Baseline & Pengujian Lokal Terisolasi — Tahap 0 SIMNI

Tanggal: 12 September 2026, Asia/Jakarta  
Metode: Audit statis, verifikasi kriptografis berkas `public`, analisis source code, dan eksekusi test runner lokal terisolasi tanpa koneksi jaringan luar (0 remote egress).  
Ruang Lingkup: **Tahap 0 — Baseline, Peta Dampak dan Kontrak**. Tidak ada modifikasi pada source aplikasi (`js/`, `features/`, `chat/`, `sw.js`, `index.html`).

---

## 1. Status Working Tree & Rekonsiliasi Versi

### A. Git Working Tree & Commit HEAD
- **Commit HEAD**: `5b0f6431ba85d62aaaf717a58748cb9bc2c91ed2` (`CHORE: exclude generated and local files from Git`, 4 September 2026).
- **Versi pada HEAD**: `4.6.4` (dikonfirmasi dari `git show HEAD:package.json`).
- **Versi Aktif di Working Tree**: `4.6.9` pada `package.json`, `manifest.json`, `js/core/runtime-config.js` (`appVersion: '4.6.9'`, `cacheVersion: '4.6.9'`), serta `public/build-manifest.json`.
- **Penyebab Working Tree Berstatus Modified (`M`)**:
  Perkembangan pasca-4.6.4 (audit 4.6.6, rekonstruksi 4.6.7, rekonstruksi UI/UX 4.6.8, dan rekonstruksi template LPS/BLP 4.6.9) dilakukan langsung pada working tree lokal dan di-compile ke `public/` tanpa membuat commit git intermediate. Sesuai instruksi: **working tree tidak di-reset atau di-clean**, karena working tree 4.6.9 memuat revisi fungsional yang valid.

### B. Integritas Build Public 4.6.9
- **Build ID Historis**: `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`.
- **Verifikasi Kriptografis Disk**:
  - Seluruh **117 berkas** di dalam direktori `public/` dibaca dan dihitung nilai SHA-256 secara independen.
  - Hasil pencocokan terhadap `public/build-manifest.json`:
    - Mismatched files: **0**
    - Missing files on disk: **0**
    - Extra untracked files in public: **0**
    - Computed Root Build ID: `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1` (**IDENTIK 100%**).
- **Sinkronisasi Root Source terhadap Public**:
  - Sebanyak **84 berkas source** di root (`manifest.json`, `sw.js`, `firebase-messaging-sw.js`, `tailwind-offline.css`, `icons/`, `features/`, `js/`, `chat/css/`, `chat/js/`) dibandingkan byte-by-byte dengan pasangannya di `public/`.
  - Hasil: **0 perbedaan (diffs = 0)**. Root source dan `public/` berada dalam status sinkron penuh pada build 4.6.9.

---

## 2. Hasil Baseline Pengujian Lokal Terisolasi

Setiap test runner dibaca dan dianalisis perilakunya sebelum dijalankan. Seluruh pengujian dijalankan pada loopback `127.0.0.1` tanpa akses internet (isolated).

| Test Suite | File Runner | Hasil Aktual | Kategori & Catatan |
|---|---|---|---|
| **Runtime Sandbox Test** | `qa/runtime-sandbox-test.js` | **167 PASS, 0 FAIL** | **PASS** — Core access policy, backup envelope SHA-256 round-trip, role matrix, SW precache contract, simulated CRUD. Berjalan murni di Node.js. |
| **Chat Query Regression** | `qa/chat-query-regression.mjs` | **12 PASS, 0 FAIL** | **PASS** — Deterministic chronological document IDs (`!timestamp_entropy`), merge sender/recipient snapshots, unread counts. |
| **Chat Audio Regression** | `qa/chat-audio-regression.mjs` | **17 PASS, 0 FAIL** | **PASS** — Downsampling 48 kHz ke 16 kHz PCM 16-bit mono WAV, header RIFF/WAVE, inferensi MIME audio, batas ukuran voice note. |
| **GADM Engine Regression** | `qa/gadm-engine-regression.mjs` | **13 PASS, 0 FAIL** | **PASS** — Modul ajar, prota, promes, silabus, kokurikuler, e-Rapor, fail-closed CP tanpa teks terverifikasi, provenance BSKAP 046/H/KR/2025. |
| **LPS/BLP Contract Regression** | `qa/lps-contract-regression.mjs` | **42 PASS, 0 FAIL** | **PASS** — 10 butir doa, 14 butir mahfudzat, BLP Murojaah teks tunggal, kontrak checklist/select/text, isolasi kelas pada dropdown siswa. |
| **Excel Template Regression** | `qa/excel-template-regression.mjs` | **10 PASS, 0 FAIL** | **PASS** — In-memory sheet duplication dengan ExcelJS, preservasi layout, merge cells, header/footer, print setup, dan logo gambar pada `LPS KLS 2 contoh.xlsx` dan `BLP contoh.xlsx`. |
| **Academic Workflow Test** | `qa/academic-workflow-test.mjs` | **24 PASS, 0 FAIL** | **PASS** — End-to-end simulasi form akademik (Presensi, Nilai, TP, Jurnal, Catatan, Jadwal, Cache) dengan Puppeteer, IndexedDB mock adapter, dan Request Interception. **Terbukti 0 request remote ke internet/Firebase produksi**. |
| **Security Contract Regression** | `qa/security-contract-regression.mjs` | **74 PASS, 1 FAIL** | **FAIL (Pre-existing bug)**: Gagal pada assertion `RULE-004` ("Listener Chat tidak bergantung pada composite index"). Diidentifikasi baris 182-183 `chat/js/chat-db.js` menggunakan `orderBy('createdAt', 'desc')` yang melanggar kontrak query index-free. |
| **Static Contract Regression** | `qa/static-contract-regression.mjs` | *Ditahan dari eksekusi mutatif* | **Outdated Harness**: Baris 222 menjalankan `scripts/build-hosting.mjs` dengan environment QA lalu baris 247-259 meremove meta tag secara manual dari `public/`, yang akan merusak hash `public/build-manifest.json` 4.6.9. Diperlukan isolasi runner agar read-only. |
| **GADM Mobile Workflow Test** | `qa/gadm-mobile-workflow-test.mjs` | **19 PASS, 1 TIMEOUT** | **Environment/Harness Issue**: Modul Ajar (pratinjau, Word export 13.4 KB, Excel export 33.6 KB, PDF export 3.1 MB) lulus 19 assertion. Namun alur kedua (`prota`) mengalami timeout pada transisi dialog seleksi dokumen di Puppeteer. |

---

## 3. Klasifikasi Masalah Baseline (Triase)

### A. Bug yang Sudah Ada (Pre-Existing Bugs)
1. **`RULE-004` pada `chat/js/chat-db.js:182-183`**:
   Kode menambahkan `orderBy('createdAt', 'desc')` dan `orderBy(documentId(), 'desc')` bersamaan dengan `where(field, '==', uid)`. Pada Firestore, kombinasi `where` kesamaan dan `orderBy` field berbeda membutuhkan composite index. Padahal arsitektur SIMNI Chat dirancang *index-free* dengan memanfaatkan ID dokumen kronologis deterministik (`createMessageDocumentId()`).
2. **S01 — Ketidakselarasan Batas Backup**:
   `backup.js:71` mengekspor berkas terindentasi (`null, 2`), sedangkan batas impor di `backup.js:239`, `backup-core.js:11`, dan `backup.js:351` adalah 25 MiB keras. Sebaliknya `repository.js:854` mengizinkan hingga 32 MiB berbasis JSON kompak.
3. **S04 — Draf Formulir Akademik dalam Memori**:
   `state.js:66` menyimpan draf pada `Map()` JavaScript dalam memori. Saat browser di-reload, ditutup, atau crash, seluruh draf yang belum tersimpan hilang.
4. **S08 — Loading Global Berlomba (Race Condition)**:
   `feedback.js:6-35` mengandalkan `loadingGeneration` global tunggal tanpa token pemilik. Panggilan `hideLoad()` oleh operasi async yang selesai lebih cepat dapat menutup indikator operasi async lain yang masih berjalan.

### B. Harness Usang (Outdated Test Harnesses)
1. **`qa/static-contract-regression.mjs` Memutasi Direktori `public`**:
   Runner ini memanggil `build-hosting.mjs` saat pengetesan statis dan memodifikasi file `public/chat/chat.html` serta `public/index.html`. Runner pengetesan kontrak statis seharusnya bersifat murni read-only dan tidak merusak hasil kompilasi produksi yang sudah ada.

### C. Masalah Lingkungan / Runner (Environment Issues)
1. **Node.js Type Warning**:
   Warning `[MODULE_TYPELESS_PACKAGE_JSON]` muncul karena `package.json` tidak menyertakan `"type": "module"`, sementara skrip menggunakan ES module import. Ini peringatan performa loader Node.js, bukan error sintaksis.

---

## 4. Pembuktian Isolasi Pengujian Lokal

Pada pengujian `qa/academic-workflow-test.mjs`:
- Intersepsi network browser dipasang via `page.setRequestInterception(true)`.
- Request di luar origin `http://127.0.0.1:4196` langsung di-abort dan dicatat pada array `remoteRequests`.
- Hasil eksekusi: `remoteRequests.length === 0`.
- Firebase Database digantikan sepenuhnya oleh `qa/academic-mock-database.js` yang beroperasi di IndexedDB lokal browser.
- Terbukti: **0 paket data dikirim ke Firebase produksi atau origin eksternal mana pun**.
