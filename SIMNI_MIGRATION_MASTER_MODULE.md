# MODUL INDUK & MAKALAH RENCANA MIGRASI ARSITEKTUR SIMNI
## Transformasi dari Vanilla JS Monolith ke Next.js 15 + TypeScript + Tailwind CSS + Firebase Modern
**Target Daya Tahan Sistem:** 10+ Tahun (Skalabilitas, Type-Safety, Zero-Backtracking Lifecycle)  
**Versi Dokumen:** 2.0 (Final Enterprise Specification)  
**Tanggal:** 29 September 2026

---

## DAFTAR ISI
1. [BAB 1: ARSITEKTUR SAAT INI (BASELINE VANILLA JS)](#bab-1-arsitektur-saat-ini-baseline-vanilla-js)
2. [BAB 2: PETA & ENSIKLOPEDIA SELURUH SOURCE CODE LAMA](#bab-2-peta--ensiklopedia-seluruh-source-code-lama)
3. [BAB 3: ANALISIS KELEMAHAN, RISIKO KEAMANAN & SKALABILITAS](#bab-3-analisis-kelemahan-risiko-keamanan--skalabilitas)
4. [BAB 4: DESAIN ARSITEKTUR PENGGANTI (NEXT.JS + TS + FIREBASE)](#bab-4-desain-arsitektur-pengganti-nextjs--ts--firebase)
5. [BAB 5: MATRIKS MAPPING FILE LAMA KE FILE BARU (1-TO-1 MAPPING)](#bab-5-matriks-mapping-file-lama-ke-file-baru-1-to-1-mapping)
6. [BAB 6: RENCANA IMPLEMENTASI 6 FASE TANPA BACKTRACKING](#bab-6-rencana-implementasi-6-fase-tanpa-backtracking)
7. [LAMPIRAN: SKEMA DATABASE & DEFINISI TIPE TYPESCRIPT UTAMA](#lampiran-skema-database--definisi-tipe-typescript-utama)

---

# BAB 1: ARSITEKTUR SAAT INI (BASELINE VANILLA JS)

Aplikasi SIMNI saat ini beroperasi menggunakan tumpukan teknologi:
- **Client Runtime**: Pure Vanilla JavaScript (ES2020+) tanpa build-step/bundler modern, dieksekusi langsung oleh browser engine.
- **Tampilan & Desain**: Monolitik HTML (`index.html` 1.109 baris) berpadu dengan kelas Tailwind CSS offline (`tailwind-offline.css`, 49 KB) dan FontAwesome 6.4.0 lokal.
- **Pola Komponen**: Menggunakan teknik *HTML Fragment Dynamic Fetch & Mount* via `js/core/feature-loader.js` ke container DOM (`#simni-view-fragment-root` dan `#simni-modal-fragment-root`).
- **Pola State**: Global Variable Monolitik di memori (`window.state`) berukuran ~22 KB tanpa enkapsulasi, didukung IndexedDB (`SIMNIDraftsDB` & `AdminKelasDB`) untuk draf dan offline snapshot.
- **Sinkronisasi Data**: Firebase Realtime Database SDK (v12.17.1) dengan pola Multi-Path Listener realtime (`js/database/sync.js`).
- **Keamanan Multi-Role**: Skema Versi 4 RBAC terbagi atas:
  - `superuser`: Akses menyeluruh + kelola akun + manajemen arsip/dokumen + reset tahunan (`ws_superuser`, email kanonikal: `unggaran.sditbm@gmail.com`).
  - `vip`: Akses terbatas mapel PJOK (`ws_pjok`, email: `anur.auliya01@gmail.com`).
  - `teacher`: Akses ber-scope kelas masing-masing (1A–6B).
- **Backend Servis**: Cloudflare Workers (`edge/worker.js`, `edge/admin-operations.js`) untuk transaksi dua fase (Two-Phase Commit Protocol) dan tanda tangan aset Cloudinary.
- **PWA & Mobile**: Custom Service Worker (`sw.js`, 1.140 baris) dengan precache 65+ aset dan wrapper Android via Capacitor 8.5.1.

---

# BAB 2: PETA & ENSIKLOPEDIA SELURUH SOURCE CODE LAMA

Untuk memastikan developer maupun AI tidak kehilangan fungsi historis ketika mengonversi ke file baru, berikut adalah ensiklopedia seluruh file aktif:

### 2.1 Kelompok Core JavaScript (`js/`)
1. **`js/auth/auth.js` (879 baris, 29.8 KB)**
   - *Tujuan*: Mengatur siklus hidup autentikasi Firebase, form login, logout aman dengan deteksi draf belum terkirim, reautentikasi kredensial, dan hidrasi sesi terotorisasi.
   - *Fungsi Kunci*: `loginAuth()`, `logoutAuth()`, `hydrateAuthorizedSession()`, `teardownSession()`, `updateCredentials()`, `resetInMemoryApplicationState()`.
2. **`js/auth/access-context.js` (156 baris, 9.1 KB)**
   - *Tujuan*: Mengelola context hak akses aktif (`SIMNICurrentAccess`), masa berlaku sewa offline (8 jam), verifikasi realtime node `accessControl/users/{uid}`, dan penyesuaian visibilitas UI.
   - *Fungsi Kunci*: `establishAccessContext()`, `verifyAccessContext()`, `canAccess()`, `applyFeatureVisibility()`, `applyAccessUI()`.
3. **`js/auth/access-policy-core.js` (237 baris, 9.8 KB)**
   - *Tujuan*: Matriks perizinan murni (UMD) untuk role `superuser`, `vip`, dan `teacher`. Memetakan view ID, modal ID, dan logical path RTDB ke nama fitur.
   - *Fungsi Kunci*: `canAccess()`, `featureForView()`, `featureForModal()`, `featureForLogicalPath()`, `validateProfile()`.
4. **`js/auth/workspace-registry-core.js` (98 baris, 3.2 KB)**
   - *Tujuan*: Registry kanonikal pemetaan nama kelas (1A–6B) ke workspace ID (`ws_kelas1a` s/d `ws_kelas6b`), serta validasi akun khusus.
   - *Fungsi Kunci*: `workspaceIdForClass()`, `isOwnerEmail()`, `isVipEmail()`, `slotForClass()`.
5. **`js/auth/registration-service.js` (257 baris, 10.2 KB)**
   - *Tujuan*: Service interaksi registrasi guru, kode undangan QR, dan eksekusi command superuser (approve, reject, unassign, permissions, delete).
   - *Fungsi Kunci*: `listAccounts()`, `accountCommand()`, `getRegistrationSlots()`, `validateRegistrationInvite()`, `activateRegistration()`.
6. **`js/core/runtime-config.js` (625 baris, 13.9 KB)**
   - *Tujuan*: Otoritas tunggal parameter Firebase cloud produksi, version manifest (4.8.2), dan validasi environment HTTPS.
7. **`js/core/state.js` (502 baris, 22.3 KB)**
   - *Tujuan*: Definisi store monolitik `window.state`, daftar kelas aktif, dan mesin persistensi draf formulir offline IndexedDB (`SIMNIFormDrafts`).
   - *Fungsi Kunci*: `SIMNIFormDrafts.capture()`, `restore()`, `begin()`, `finish()`, `hasUnsaved()`, `setActiveKelas()`, `getSIMNIActiveClass()`.
8. **`js/core/feature-loader.js` (865 baris, 23.5 KB)**
   - *Tujuan*: Dynamic lazy loader pemuatan fragmen HTML, stylesheet, dan modul JavaScript fitur ke DOM root.
   - *Fungsi Kunci*: `loadFeatureFragments()`, `ensureFeatureLoaded()`, `mountParsedFragment()`, `resetFeatureFragments()`.
9. **`js/core/shell.js` (688 baris, 23.8 KB)**
   - *Tujuan*: Event listener awal sebelum modul berat dimuat, pembersihan token sensitif dari URL bar, binding form login/reset, dan pendaftaran Service Worker.
10. **`js/core/app.js` (25 baris, 588 B)**
    - *Tujuan*: Inisialisasi awal aplikasi (dark mode, identitas, listener online/offline).
11. **`js/database/sync.js` (1.790 baris, 40.1 KB)**
    - *Tujuan*: Engine sinkronisasi dua arah Firebase RTDB ke `window.state`, pelacakan status kesehatan koneksi per node, dan debounced render trigger (40ms).
    - *Fungsi Kunci*: `initFirebaseListener()`, `stopFirebaseListener()`, `applyIncomingData()`, `deriveHealth()`, `scheduleRender()`.
12. **`js/database/repository.js` (1.219 baris, 36.8 KB)**
    - *Tujuan*: Boundary transaksi data: resolusi logical path ke physical path ber-scope workspace, optimistic concurrency (`dbCompareRecords`), dan manajemen arsip tahunan.
    - *Fungsi Kunci*: `dbSet()`, `dbUpdate()`, `dbRemove()`, `dbGet()`, `dbCompareRecords()`, `dbAuditedUpdate()`, `dbPutAnnualArchive()`.
13. **`js/database/local-cache.js` (2.411 baris, 63.1 KB)**
    - *Tujuan*: Penyimpanan snapshot offline terenkapsulasi IndexedDB (`AdminKelasDB`), verifikasi integritas SHA-256, batas kuota 96 MiB, dan dialog Pengelola Penyimpanan.
    - *Fungsi Kunci*: `saveLocalBackup()`, `loadLocalBackup()`, `verifyEnvelope()`, `getCompleteStorageInventory()`, `openLocalStorageManager()`.
14. **`js/database/firebase-client.js` (394 baris, 7.6 KB)**: Inisialisasi Firebase App, Database, dan Auth.
15. **`js/database/cloudinary-client.js` (934 baris, 17 KB)**: Client upload file ke Cloudinary CDN dengan tanda tangan kriptografis dari Edge Worker.
16. **`js/database/workspace-paths-core.js` (71 baris, 3 KB)**: Penerjemah logical path (`Siswa/${nisn}`) ke physical path (`workspaces/${wsId}/academicYears/${year}/students/${nisn}`).
17. **`js/database/paged-query.js` (210 baris, 7.1 KB)**: Cursor key pagination untuk koleksi RTDB besar.
18. **`js/database/live-pages.js` (57 baris, 3.3 KB)**: Auto-splitting range pagination realtime.
19. **`js/database/mock-adapter.js` (31 baris, 763 B)**: Adapter localStorage untuk sandbox unit test.
20. **`js/platform/main.js` (920 baris, 17.8 KB)**: Orkestrator bootstrap antarmuka platform mobile/desktop.
21. **`js/platform/permission-service.js` (211 baris, 8.8 KB)**: Penegakan otorisasi UI berbasis permission action.
22. **`js/platform/download-service.js` (87 baris, 3.4 KB)**: Abstraksi unduh berkas (Blob URL di web, Filesystem API di Android native).
23. **`js/platform/haptics-service.js` (73 baris, 2.4 KB)**: Umpan balik getar haptic Android.
24. **`js/platform/native-back-button.js` (111 baris, 3.9 KB)**: Penanganan tombol kembali Android fisik.
25. **`js/platform/bootstrap.js` (24 baris, 632 B)**: Entry module bootstrap aplikasi.
26. **`js/services/edge-service.js` (82 baris, 3.7 KB)**: HTTP client ke Cloudflare Workers.
27. **`js/ui/navigation.js` (363 baris, 15 KB)**: Routing SPA lama (`switchView`, `openModal`, `closeModal`).
28. **`js/ui/feedback.js` (313 baris, 15.2 KB)**: Toast alert dan loading bar indicator.
29. **`js/ui/actions.js` (298 baris, 10.2 KB)**: Event delegation atribut `data-simni-action`.
30. **`js/ui/render.js` (199 baris, 9.8 KB)**: Render identitas dan update dropdown.
31. **`js/ui/theme.js` (109 baris, 5.8 KB)**: Pengelola tema (dark mode + 6 palet preset warna).
32. **`js/ui/date.js` (8 baris, 1.4 KB)**: Utilitas tanggal zona Jakarta.
33. **`js/utils/sanitize.js` (59 baris, 1.8 KB)**: Pembersihan string & pencegahan XSS.

### 2.2 Kelompok 16 Modul Fitur (`features/`)
1. **`accounts` (2 berkas, 848 baris)**: Dashboard superuser persetujuan akun guru, kuota kelas, token undangan QR, dan audit log.
2. **`archive` (2 berkas, 1.395 baris)**: Pembuatan snapshot tahunan berintegritas SHA-256 dan pembaca arsip lintas tahun (*Granted Archives*).
3. **`attendance` (2 berkas, 658 baris)**: Presensi harian, scanner QR kamera (`html5-qrcode`), rekapitulasi semester, dan ekspor PDF.
4. **`backup` (2 berkas, 842 baris)**: Export/import JSON database ber-envelope kriptografis dan pembuatan master workbook Excel multi-sheet.
5. **`btq` (2 berkas, 72 baris)**: Modul roadmap Tilawah dan Tahfidz Juz 30 (terhubung ke LPS).
6. **`dashboard` (2 berkas, 341 baris)**: Rekapitulasi KPI (total siswa, kehadiran harian, jurnal, TP) dan *Early Warning Radar* siswa berisiko.
7. **`documents` (2 berkas, 1.648 baris)**: Pengarsipan file modul/RPP/LKPD di Cloudinary CDN dengan metadata RTDB.
8. **`gadm` (8 berkas, 6.537 baris)**: Generator administrasi ajar 100% offline (Modul Ajar, Prota, Promes, Silabus, P5, LKPD, Rapor) berbasis Kurikulum Merdeka & Deep Learning 2026. Menghasilkan file Word DOCX native via JSZip.
9. **`grades` (2 berkas, 2.280 baris)**: Manajemen Tujuan Pembelajaran (TP), scanner teks buku via kamera OCR (Tesseract), input nilai batch, rekapitulasi nilai, dan Buku Induk Siswa PDF.
10. **`journal` (2 berkas, 701 baris)**: Matriks jadwal pelajaran mingguan 5x10, form jurnal harian otomatis pre-fill, rekapitulasi bulanan, dan ekspor Excel/PDF.
11. **`lps` (7 berkas, 14.739 baris)**: Sistem rapor rapor LPS & BLP (Mid & Final Semester), builder template aspek kustom, konversi kalender Hijriah otomatis, penguncian nilai final ber-hash SHA-256, cetak 2 halaman A4 presisi tinggi, dan patching file Excel resmi.
12. **`notes` (2 berkas, 196 baris)**: Catatan anekdotal observasi perilaku dan bimbingan siswa.
13. **`registration` (1 berkas, 90 baris)**: Alur pendaftaran mandiri guru via token undangan.
14. **`reset` (1 berkas, 807 baris)**: Reset selektif data tahunan dengan pengamanan wajib bukti arsip cloud (*Archive-Gated Reset*).
15. **`settings` (2 berkas, 1.546 baris)**: Konfigurasi data sekolah, profil guru, pemeliharaan cache, dan alat diagnostik.
16. **`students` (2 berkas, 1.243 baris)**: Master buku data siswa, foto profil Cloudinary, pencetakan kartu presensi QR, batch edit rombel/kelas, dan import/export Excel.

### 2.3 Kelompok Infrastruktur, Edge & Rules
- **`sw.js` (1.140 baris)**: Service Worker dengan strategi precache atomik 65+ berkas dan isolasi cache per versi.
- **`edge/worker.js` & `edge/admin-operations.js` (459 baris)**: Cloudflare Worker penengah Google OAuth Service Account, JWT verification, dan Two-Phase Administrative Commit.
- **`firebase/database.rules.production.json` (299 baris, 153 KB)**: Aturan keamanan database berlapis 7 asersi skema multi-role.

---

# BAB 3: ANALISIS KELEMAHAN, RISIKO KEAMANAN & SKALABILITAS

1. **Kelemahan Keamanan (Security Hazards)**:
   - *Client-Side Exposure*: Seluruh logika validasi bisnis, hak akses role, dan pembatasan kurikulum terekspos di browser tanpa kompilasi/obfuscation.
   - *DevTools Tampering*: Pengecekan izin fitur di client (`canAccess()`) dapat dibypass oleh pengguna mahir melalui browser console.
   - *Single Point of Failure*: Aturan keamanan hanya mengandalkan Firebase Rules; jika ada celah di rules, penyerang dapat langsung memanipulasi database via REST API.
2. **Kelemahan Pemeliharaan (Maintainability & Code Smell)**:
   - *No Type-Safety*: Ketidakhadiran TypeScript membuat kesalahan ketik (typo) field database baru terdeteksi saat runtime/produksi.
   - *Giant Files*: Berkas seperti `lps.js` (6.812 baris) dan `gadm-engine.js` (2.158 baris) sangat rawan regresi saat dilakukan perbaikan bug kecil.
   - *Global State Collision*: 50+ objek global di `window.*` mengakibatkan ketergantungan implisit yang menyulitkan pengujian unit otomatis.
3. **Kelemahan Performa & UX di Perangkat Pengguna**:
   - *Browser Main-Thread Bottleneck*: Penguraian workbook Excel, rendering PDF kanvas, dan OCR teks buku berjalan di thread browser klien, berpotensi membekukan (freeze) layar pada ponsel berkapasitas rendah.
   - *No Tree-Shaking*: Browser mengunduh seluruh 33 pustaka JS di awal meskipun pengguna hanya membuka dashboard.

---

# BAB 4: DESAIN ARSITEKTUR PENGGANTI (NEXT.JS + TS + FIREBASE)

Target arsitektur 10+ tahun dirancang dengan fondasi:
1. **Next.js 15 (App Router)**:
   - **React Server Components (RSC)**: Logika otorisasi, pembacaan konfigurasi sensitif, dan pembuatan dokumen sensitif berjalan di server, tidak pernah sampai ke browser.
   - **Route Handlers / API Routes**: Menggantikan peran Cloudflare Workers sepenuhnya ke dalam satu repositori terintegrasi (*unified monolith*).
2. **TypeScript 5 (Strict Mode)**:
   - Menghasilkan antarmuka data yang mencerminkan 100% struktur Firebase Rules (Schema v4). Tidak ada lagi tipe `any`.
3. **Zustand State Store**:
   - Menggantikan `window.state` global dengan store terisolasi, reaktif, dan memiliki type-safety penuh.
4. **Server-Side Export Engine**:
   - Pembuatan PDF dan Excel dipindahkan ke Next.js API Routes (menggunakan `exceljs` dan `@react-pdf/renderer` di server), membebaskan memori ponsel klien.
5. **Double-Layer Security Validation**:
   - Layer 1: Middleware & Server Action otentikasi sesi di Next.js Server.
   - Layer 2: Firebase Realtime Database Security Rules asli yang tetap dipertahankan.

---

# BAB 5: MATRIKS MAPPING FILE LAMA KE FILE BARU (1-TO-1 MAPPING)

| # | Berkas Sumber Lama (Vanilla JS) | Berkas Target Baru (Next.js 15 + TS) | Peran & Perubahan Arsitektural |
|---|---|---|---|
| 1 | `index.html` (1.109 baris) | `src/app/layout.tsx` + `src/components/layout/*` | Dekomposisi monolitik HTML ke React Layout, Header, & Drawer terpisah. |
| 2 | `register.html` | `src/app/register/page.tsx` | Formulir pendaftaran guru modern dengan validasi Zod. |
| 3 | `js/auth/auth.js` | `src/app/login/page.tsx` + `src/lib/auth/session.ts` | Form login client terhubung ke Next.js session handler. |
| 4 | `js/auth/access-context.js` | `src/hooks/useAccessContext.ts` + `src/middleware.ts` | Pemisahan: validasi server via middleware, sinkronisasi via React Hook. |
| 5 | `js/auth/access-policy-core.js` | `src/lib/auth/access-policy.ts` | Porting 1:1 ke TypeScript class/utility murni. |
| 6 | `js/auth/workspace-registry-core.js`| `src/lib/auth/workspace-registry.ts` | Type-safe registry workspace dan mapping kelas. |
| 7 | `js/auth/registration-service.js` | `src/app/api/auth/registration/route.ts` | Logika approval/slot dipindahkan ke server endpoint aman. |
| 8 | `js/core/runtime-config.js` | `src/lib/config/runtime.ts` + `.env.local` | Konfigurasi runtime membaca environment variable type-safe. |
| 9 | `js/core/state.js` | `src/stores/app-store.ts` | Mengonversi `window.state` menjadi Zustand store reaktif. |
| 10| `SIMNIFormDrafts` (di `state.js`) | `src/hooks/useFormDraft.ts` | Hook draf formulir offline berbasis IndexedDB dengan auto-restore. |
| 11| `js/core/feature-loader.js` | *Dihapus* (Diganti Next.js App Router) | Routing ditangani native oleh struktur folder Next.js. |
| 12| `js/core/shell.js` | *Dihapus* (Terdistribusi ke Layout Components)| Lifecycle ditangani otomatis oleh React hydration. |
| 13| `js/database/firebase-client.js` | `src/lib/firebase/client.ts` & `admin.ts` | Pemisahan client SDK (browser) dan Firebase Admin SDK (server). |
| 14| `js/database/repository.js` | `src/lib/firebase/repository.ts` | Type-safe CRUD operations, optimistic concurrency, dan path resolver. |
| 15| `js/database/sync.js` | `src/hooks/useFirebaseSync.ts` | Hook sinkronisasi realtime dengan cleanup otomatis saat unmount. |
| 16| `js/database/local-cache.js` | `src/lib/cache/offline-cache.ts` | Enkapsulasi IndexedDB dengan verifikasi SHA-256 Web Crypto. |
| 17| `js/database/cloudinary-client.js` | `src/app/api/cloudinary/sign/route.ts` | Signing upload Cloudinary dilakukan 100% di server side. |
| 18| `edge/worker.js` & `admin-operations.js` | `src/app/api/admin/operations/route.ts` | Transaksi Two-Phase Commit dipindahkan ke serverless API Route. |
| 19| `features/dashboard/*` | `src/app/(auth)/dashboard/page.tsx` | Dashboard KPI & Radar membaca langsung dari Zustand selector. |
| 20| `features/students/*` | `src/app/(auth)/students/page.tsx` | Master Siswa, batch action floating bar, & card grid responsif. |
| 21| `features/attendance/*` | `src/app/(auth)/attendance/page.tsx` | Presensi grid, scanner kamera, dan rekap semester. |
| 22| `features/grades/*` | `src/app/(auth)/grades/page.tsx` | Kelola TP, SIMNI Lens OCR, input nilai, dan Buku Induk Siswa. |
| 23| `features/journal/*` | `src/app/(auth)/journal/page.tsx` | Matriks jadwal mingguan 5x10 dan form jurnal otomatis. |
| 24| `features/documents/*` | `src/app/(auth)/documents/page.tsx` | Manajemen arsip dokumen terintegrasi Cloudinary CDN. |
| 25| `features/gadm/*` (8 berkas) | `src/app/(auth)/gadm/page.tsx` + `src/lib/gadm/*` | Generator ajar Kurikulum Merdeka 2026 murni offline ber-DOCX. |
| 26| `features/lps/*` (7 berkas) | `src/app/(auth)/lps/page.tsx` + `src/lib/lps/*` | Engine Rapor LPS/BLP, Hijri calculator, dan A4 verified print. |
| 27| `features/notes/*` | `src/app/(auth)/notes/page.tsx` | Jurnal anekdotal dan rekap catatan perilaku siswa. |
| 28| `features/settings/*` | `src/app/(auth)/settings/page.tsx` | Panel Pengaturan, identitas sekolah, tema, dan database tools. |
| 29| `features/accounts/*` | `src/app/(auth)/accounts/page.tsx` | Konsol Superuser persetujuan akun & token undangan. |
| 30| `sw.js` (1.140 baris) | `next-pwa` (Serwist engine) | Konfigurasi PWA otomatis terkompilasi saat build. |

---

# BAB 6: RENCANA IMPLEMENTASI 6 FASE TANPA BACKTRACKING

> **HUKUM ZERO-BACKTRACKING**: Setiap fase harus tuntas 100% dan menghasilkan fondasi yang terisolasi. Fase berikutnya HANYA mengonsumsi API/Komponen dari fase sebelumnya. Dilarang mengedit fondasi fase sebelumnya di tengah jalan.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUR EKSEKUSI BERTAHAP                          │
│                                                                        │
│  [FASE 0] Setup Tooling, Monorepo & Kontrak Tipe TypeScript Final     │
│      │                                                                 │
│      ▼                                                                 │
│  [FASE 1] Fondasi Database Layer, Zustand Store & Hook Realtime Sync   │
│      │                                                                 │
│      ▼                                                                 │
│  [FASE 2] Shell Aplikasi, Autentikasi, Layout, Theme & UI Primitives   │
│      │                                                                 │
│      ▼                                                                 │
│  [FASE 3] Konversi 16 Modul Fitur (Berdasarkan Tingkat Dependensi)     │
│      │    ├─ Tier 1: Dashboard, Students, Notes                       │
│      │    ├─ Tier 2: Attendance, Grades (+OCR), Journal               │
│      │    ├─ Tier 3: Documents, GADM Suite, LPS/BLP Suite             │
│      │    └─ Tier 4: Settings, Backup, Archive, Accounts, Reset       │
│      │                                                                 │
│      ▼                                                                 │
│  [FASE 4] Serverless API Routes (Pengganti Cloudflare Edge Workers)    │
│      │                                                                 │
│      ▼                                                                 │
│  [FASE 5] PWA Offline Layer, Capacitor Mobile Build & QA Testing       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### FASE 0: Inisialisasi Proyek & Kontrak Tipe TypeScript Final (Minggu 1)
- **Target**: Membangun kerangka Next.js 15 dan mendefinisikan SEMUA interface TypeScript berdasarkan skema Firebase RTDB.
- **Langkah Kerja**:
  1. Scaffold proyek baru: `npx create-next-app@latest simni-next --typescript --tailwind --app --src-dir`.
  2. Setup linter dan formatter ketat: `.eslintrc.json` dan `.prettierrc`.
  3. Konversi logika UMD lama yang sudah independen:
     - `js/auth/access-policy-core.js` → `src/lib/auth/access-policy.ts`
     - `js/auth/workspace-registry-core.js` → `src/lib/auth/workspace-registry.ts`
     - `js/database/workspace-paths-core.js` → `src/lib/firebase/paths.ts`
     - `js/utils/sanitize.js` → `src/lib/utils/sanitize.ts`
     - `js/ui/date.js` → `src/lib/utils/date.ts`
  4. Tulis file definisi tipe lengkap (lihat Lampiran): `src/types/student.ts`, `attendance.ts`, `grade.ts`, `journal.ts`, `document.ts`, `lps.ts`, `gadm.ts`, `auth.ts`.
- **Kriteria Keberhasilan (Exit Criteria)**:
  - `npm run build` sukses tanpa warning.
  - Seluruh types terdefinisi dan lulus pengujian unit isolasi.

---

### FASE 1: Database Layer, Zustand State Store & Sync Hook (Minggu 2)
- **Target**: Membangun lapisan akses data yang type-safe, manajemen state global, dan sinkronisasi realtime yang stabil.
- **Langkah Kerja**:
  1. Setup `src/lib/firebase/client.ts` untuk koneksi browser dan `src/lib/firebase/admin.ts` untuk server-side.
  2. Bangun `src/lib/firebase/repository.ts` yang mengimplementasikan fungsi typed: `dbSet<T>`, `dbUpdate`, `dbRemove`, `dbGet<T>`, dan `dbCompareRecords`.
  3. Konversi `js/core/state.js` ke Zustand store: `src/stores/app-store.ts` dan `src/stores/sync-store.ts`.
  4. Konversi `js/database/sync.js` menjadi custom hook `src/hooks/useFirebaseSync.ts` dengan debounce dan cleanup otomatis.
  5. Konversi `SIMNIFormDrafts` menjadi hook `src/hooks/useFormDraft.ts` berbasis IndexedDB.
  6. Konversi `js/database/local-cache.js` menjadi `src/lib/cache/offline-cache.ts`.
- **Kriteria Keberhasilan (Exit Criteria)**:
  - Repository CRUD lulus integration test ke Firebase emulator/staging.
  - Hook sync dapat mengisi Zustand store tanpa memory leak.
  - Draf formulir tersimpan otomatis di IndexedDB saat disimulasikan offline.

---

### FASE 2: Shell Layout, Sistem Autentikasi & UI Primitives (Minggu 3)
- **Target**: Menghadirkan antarmuka utama yang siap menampung halaman fitur tanpa perlu mengubah layout lagi.
- **Langkah Kerja**:
  1. Bangun komponen atomik di `src/components/ui/`: `Button`, `Input`, `Select`, `Textarea`, `Modal`, `Toast`, `LoadingBar`.
  2. Implementasikan halaman login di `src/app/login/page.tsx` dan registrasi di `src/app/register/page.tsx`.
  3. Konversi antarmuka shell:
     - `DesktopHeader`: Switcher kelas, greeting, status sync, toggle tema.
     - `MobileHeader`: Compact navigation bar dengan hamburger drawer.
     - `NavigationDrawer`: Menu samping lengkap dengan badge approval.
  4. Integrasikan `next-themes` untuk mendukung dark mode dan 6 tema palet SIMNI.
- **Kriteria Keberhasilan (Exit Criteria)**:
  - Login dan logout berhasil mengontrol visibilitas layout.
  - Navigasi antar rute bekerja instan.
  - Dialog modal dan toast alert berfungsi secara deklaratif.

---

### FASE 3: Konversi 16 Modul Fitur (Minggu 4 - Minggu 10)
Setiap modul fitur dibangun sebagai halaman tersendiri di dalam rute grup `src/app/(authenticated)/` dengan urutan dependensi ketat:

#### **Tier 1: Modul Dasar (Independen)**
1. **Dashboard** (`/dashboard`):
   - Widget ringkasan KPI dan Early Warning Radar membaca langsung dari store.
2. **Master Siswa** (`/students`):
   - Form input siswa, grid kartu responsif, multi-select floating bar, cetak kartu QR presensi, dan impor/ekspor Excel.
3. **Catatan Guru** (`/notes`):
   - Jurnal catatan perilaku dan rekapitulasi anekdotal.

#### **Tier 2: Modul Terikat Siswa**
4. **Presensi** (`/attendance`):
   - Grid presensi harian H/S/I/A, scanner kamera QR (`html5-qrcode`), dan rekap semester.
5. **Nilai TP & Buku Induk** (`/grades`):
   - Manajemen Tujuan Pembelajaran, integrasi SIMNI Lens OCR (Tesseract Web Worker), input nilai ber-draf, dan kompilasi lembar Buku Induk Siswa.
6. **Jurnal & Jadwal** (`/journal`):
   - Editor jadwal 5x10, jurnal otomatis harian dengan perlindungan konkurensi `dbCompareRecords`.

#### **Tier 3: Modul Kompleks & Mesin Dokumen**
7. **Repository Dokumen** (`/documents`):
   - Katalog file administrasi terhubung Cloudinary CDN.
8. **Generator Administrasi GADM** (`/gadm`):
   - Porting 8 berkas GADM engine ke `src/lib/gadm/`. 100% offline generator modul ajar Kurikulum Merdeka berformat DOCX via JSZip.
9. **Rapor LPS & BLP** (`/lps`):
   - Porting 7 berkas LPS ke `src/lib/lps/`. Template aspect builder, konverter kalender Hijriah, SHA-256 report finalization, dan rendering 2 halaman A4 presisi cetak.

#### **Tier 4: Administrasi & Pemeliharaan**
10. **Pengaturan** (`/settings`):
    - Identitas sekolah, profil akun guru, manajemen tema, dan storage cleanup.
11. **Cadangan & Arsip** (`/settings/backup`):
    - Export/import database JSON ber-envelope SHA-256 dan arsip total Excel.
12. **Kelola Akun** (`/accounts`):
    - Konsol Superuser untuk persetujuan akun baru, slot penugasan kelas, dan audit log.
13. **Reset Tahunan** (`/settings/reset`):
    - Reset data aman terproteksi arsip cloud (*Archive-Gated Reset*).
14. **BTQ** (`/btq`):
    - Halaman bimbingan tilawah terhubung ke LPS.

- **Kriteria Keberhasilan (Exit Criteria)**:
  - Seluruh 16 modul berfungsi 1:1 tanpa kehilangan field data satupun.
  - Logika perhitungan nilai, absensi, dan format rapor identik dengan versi lama.

---

### FASE 4: Serverless API Routes (Pengganti Cloudflare Workers) (Minggu 11)
- **Target**: Memindahkan seluruh fungsi backend perantara ke dalam Next.js API Routes.
- **Langkah Kerja**:
  1. `src/app/api/cloudinary/sign/route.ts`: Membuat signature upload Cloudinary menggunakan secret server-side.
  2. `src/app/api/cloudinary/delete/route.ts`: Penghapusan aset Cloudinary terproteksi.
  3. `src/app/api/admin/operations/route.ts`: Mengimplementasikan Two-Phase Commit Protocol (`backup_restore`, `annual_archive`, `annual_reset`, `year_rollover`) menggunakan Firebase Admin SDK.
  4. `src/app/api/export/excel/route.ts`: Generator spreadsheet Excel berbasis streaming di server.
  5. `src/app/api/export/pdf/route.ts`: Generator laporan PDF di sisi server untuk dokumen berukuran masif.
- **Kriteria Keberhasilan (Exit Criteria)**:
  - Repositori Cloudflare Workers lama dapat dipensiunkan sepenuhnya.
  - Operasi administratif tereksekusi atomik dan tercatat di audit log.

---

### FASE 5: PWA Offline, Capacitor Android Build & QA Komprehensif (Minggu 12 - 13)
- **Target**: Memastikan kapabilitas offline-first berjalan sempurna dan membangun berkas APK Android.
- **Langkah Kerja**:
  1. Konfigurasi Service Worker modern via Serwist/next-pwa dengan strategi caching aset statis dan API pass-through.
  2. Integrasi Capacitor 8: Menghubungkan output build Next.js (`out` atau custom server endpoint) ke project `android/`.
  3. Uji fungsi hardware native: getar haptic, tombol back Android, dan kamera scanner QR/OCR.
  4. Jalankan pengujian regresi menyeluruh (Lighthouse Score $\ge 90$, audit keamanan CSP, uji offline mode tanpa internet).
  5. Rilis produksi ke Firebase Hosting / Vercel dan build APK release.
- **Kriteria Keberhasilan (Exit Criteria)**:
  - Aplikasi dapat dibuka dan dioperasikan dalam kondisi airplane mode (offline).
  - Berkas APK Android terkompilasi dan berjalan mulus di perangkat fisik.

---

# LAMPIRAN: SKEMA DATABASE & DEFINISI TIPE TYPESCRIPT UTAMA

Berikut adalah kontrak tipe data TypeScript yang wajib digunakan di proyek baru:

```typescript
// ==========================================
// 1. IDENTITAS AKUN & RBAC (src/types/auth.ts)
// ==========================================
export type Role = 'superuser' | 'vip' | 'teacher';

export type ClassId = 
  | '1A' | '1B' | '2A' | '2B' | '3A' | '3B' 
  | '4A' | '4B' | '5A' | '5B' | '6A' | '6B' 
  | 'PJOK';

export interface UserProfile {
  uid: string;
  email: string;
  status: 'active' | 'suspended' | 'pending_approval';
  role: Role;
  workspaceId: string;
  classId: ClassId;
  activeAcademicYearId: string;
  assignmentRevision: number;
}

// ==========================================
// 2. DATA SISWA (src/types/student.ts)
// ==========================================
export interface Student {
  ID_Siswa: string;
  NISN: string;           // Tepat 10 digit angka
  'Nama Lengkap': string; // 1 - 160 karakter
  Panggilan?: string;
  Kelas: ClassId;
  Kelompok?: string;      // Rombel BTQ
  foto?: string;          // URL Cloudinary HTTPS
  foto_public_id?: string;
}

// ==========================================
// 3. PRESENSI (src/types/attendance.ts)
// ==========================================
export interface AttendanceRecord {
  Tanggal: string;        // Format ISO: YYYY-MM-DD
  NISN: string;           // 10 digit
  'Nama Lengkap': string;
  Status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  Kelas: ClassId;
}

// ==========================================
// 4. TUJUAN PEMBELAJARAN & NILAI (src/types/grade.ts)
// ==========================================
export interface LearningObjective {
  ID_mapel: string;
  kode_tp: string;
  mapel: string;          // Jika role VIP, wajib hanya 'PJOK'
  bab?: string;           // Bab 1 s/d Bab 10 atau 'Umum'
  semester: '1' | '2';
  deskripsi: string;
}

export interface Grade {
  NISN: string;
  learningObjectiveId: string;
  nilai: number;          // Rentang valid: 0 - 100
  mapel: string;
  Kelas: ClassId;
  'Nama Lengkap': string;
}

// ==========================================
// 5. JURNAL & JADWAL (src/types/journal.ts)
// ==========================================
export interface JournalEntry {
  Tanggal: string;        // YYYY-MM-DD
  Jam_Ke: string;         // '1' s/d '10'
  Mapel: string;
  Materi: string;         // Maksimal 4.000 karakter
  Keterangan: string;     // Refleksi, maksimal 4.000 karakter
  Kelas: ClassId;
}

export interface ScheduleSlot {
  Hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';
  Jam_Ke: string;
  Mapel: string;
  Kelas: ClassId;
}

// ==========================================
// 6. CATATAN GURU (src/types/note.ts)
// ==========================================
export interface Note {
  Tanggal: string;
  NISN: string;
  'Nama Lengkap': string;
  Catatan: string;        // Maksimal 5.000 karakter
  Kelas: ClassId;
}

// ==========================================
// 7. ARSIP DOKUMEN (src/types/document.ts)
// ==========================================
export interface DocumentAsset {
  ID_dokumen: string;
  Nama: string;
  Kategori: 'Modul Ajar' | 'RPP' | 'LKPD' | 'Silabus' | 'Administrasi Kelas' | 'Media Ajar' | 'Lainnya';
  Deskripsi: string;
  url_file: string;       // URL HTTPS Cloudinary
  public_id: string;
  bytes: number;          // Maksimal 10.485.760 (10 MiB)
}

// ==========================================
// 8. EVALUASI RAPOR LPS & BLP (src/types/lps.ts)
// ==========================================
export interface LPSTemplateSection {
  id: string;
  title: string;
  aspects: {
    id: string;
    label: string;
    criteria?: string[];
  }[];
}

export interface LPSTemplate {
  templateVersion: number;
  reportType: 'LPS' | 'BLP';
  sections: LPSTemplateSection[]; // Maksimal 26 bagian
}

export interface LPSReport {
  id: string;
  period: 'lps_mid_s1' | 'blp_final_s1' | 'lps_mid_s2' | 'blp_final_s2';
  status: 'draft' | 'final';
  hash?: string;          // Checksum SHA-256 (Wajib ada saat status 'final')
  gregorianDate: string;
  hijriDate: string;
  templateSnapshot: LPSTemplate;
  studentSnapshot: Student;
  evaluations: Record<string, string | number>;
  notes?: {
    waliKelas?: string;
    guruPendamping?: string;
    orangTua?: string;
  };
}
```

---

*Makalah cetak biru arsitektur ini disusun sebagai acuan definitif, presisi, dan tidak ambigu, sehingga setiap developer manusia maupun agen AI dapat menjalankan migrasi SIMNI ke Next.js + TypeScript secara mulus dari Fase 0 hingga Fase 5 tanpa backtracking atau kehilangan data.*
