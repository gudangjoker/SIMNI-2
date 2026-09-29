import { writeFileSync, statSync } from 'node:fs';

const content = `# SPESIFIKASI ARSITEKTUR, SISTEM, DAN DOKUMENTASI LENGKAP SIMNI 4.7.2
## Panduan Induk Rekonstruksi Aplikasi Dari Nol (Zero-Source Disaster Recovery Document)

> **DOKUMEN INVENTARISASI SISTEM & SPESIFIKASI LOGIKA**  
> Dokumen ini disusun sebagai cetak biru (*blueprint*) dan dokumentasi arsitektur komprehensif bagi sistem aplikasi **SIMNI**. Jika seluruh source code, repositori Git, dan server produksi hilang, dokumen ini bersama berkas pendamping \`SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md\` menyediakan seluruh deskripsi konseptual, struktur folder, logika per modul, matriks perizinan, peta modal/menu, dan spesifikasi data yang diperlukan untuk membangun ulang SIMNI dari awal secara presisi 100%.

---

## 1. PENGENALAN & DEFINISI SISTEM SIMNI

### 1.1 Apa itu SIMNI?
**SIMNI** adalah singkatan dari **Sistem Informasi Manajemen Nilai & Administrasi Pembelajaran**. Aplikasi ini dirancang dan dikembangkan secara spesifik untuk lingkungan sekolah dasar (khususnya **SDIT Bina Madani**) guna mendigitalkan, menyederhanakan, dan mengintegrasikan seluruh instrumen administrasi guru kelas dan guru mata pelajaran dalam kerangka **Kurikulum Merdeka**.

SIMNI menggabungkan fungsi:
1. **Buku Nilai & Asesmen Akademik:** Pengelolaan Tujuan Pembelajaran (TP), Lingkup Materi (LM), Asesmen Formatif, dan Asesmen Sumatif (Lingkup Materi & Akhir Semester).
2. **Presensi Siswa Harian:** Presensi berbasis interaktif dan pemindai kamera kode QR kartu pelajar, dilengkapi rekapitulasi kehadiran berkala (Hadir, Sakit, Izin, Alpa).
3. **Jurnal Mengajar Harian:** Pencatatan agenda pembelajaran, ketercapaian materi, kendala kelas, dan dokumentasi visual.
4. **Catatan Perkembangan Siswa:** Rekam jejak anekdotal perilaku, prestasi, dan pembinaan karakter siswa.
5. **Generator Rapor Kurikulum Merdeka (LPS & BLP):**
   - **LPS (Lembar Perkembangan Siswa):** Laporan capaian kompetensi formatif-sumatif tengah semester / berkala.
   - **BLP (Buku Laporan Pendidikan):** Buku rapor resmi akhir semester dengan deskripsi capaian otomatis berbasis predikat dan capaian TP tertinggi/terendah.
   - Ekspor laporan berformat Excel tingkat presisi tinggi (\`.xlsx\`) dan cetak instan ke format PDF.
6. **GADM (Generator Administrasi & Desain Modul Ajar):**
   - Modul otomatis perancang dokumen RPP/Modul Ajar Kurikulum Merdeka 2026.
   - Dilengkapi Knowledge Base (KB) Taksonomi Bloom, pemetaan Profil Pelajar Pancasila, pembagi alokasi jam tatap muka, dan mesin ekspor dokumen Microsoft Word (\`.docx\`).
   - OCR kamera (Tesseract WASM) untuk menyalin referensi buku pegangan guru.
7. **Pengelolaan Aset Cloud Dokumen (LKPD & Portofolio):**
   - Integrasi Cloudinary Storage untuk penyimpanan berkas Lembar Kerja Peserta Didik (LKPD), foto siswa, dan dokumen digital dengan pembatasan kuota dan penandatanganan kriptografis server-side.
8. **Siklus Hidup Data & Tata Kelola Multi-Tahun (Administrative Lifecycle):**
   - Pencadangan (*backup*) terenkripsi lokal dan cloud.
   - Pemulihan (*restore*) transaksional.
   - Pengarsipan data tahun pelajaran lama (*annual archive*) dengan format chunks JSON berintegritas SHA-256.
   - Pergantian tahun ajaran (*rollover*) dan penyetelan ulang tahunan (*annual reset*).

### 1.2 Paradigma & Arsitektur Utama
SIMNI dibangun dengan prinsip-prinsip ketahanan tingkat tinggi:
- **Offline-First PWA (Progressive Web App):** Kinerja aplikasi tidak boleh bergantung pada kestabilan koneksi internet di kelas. Seluruh shell aplikasi, font, template, dan pustaka disimpan dalam Service Worker cache (\`CacheStorage\`).
- **Penyimpanan Lokal Reaktif (IndexedDB):** Menggunakan basis data lokal terstruktur yang disinkronisasikan ke Firebase Realtime Database (RTDB) secara latar belakang.
- **Isolasi Multi-Workspace (Multi-Tenant Sekolah):**
  - \`ws_superuser\`: Workspace Guru Kelas Utama (Kelas 3A). Akses penuh terhadap seluruh administrasi kelas reguler, backup, dan manajemen sistem.
  - \`ws_pjok\`: Workspace Guru Mata Pelajaran (PJOK / VIP). Ruang kerja terisolasi yang hanya mengelola penilaian spesifik mata pelajaran tanpa hak mereset sistem atau melihat data workspace lain.
- **Distributed Two-Phase Administrative Commit:** Klien tidak diizinkan menulis receipt mutasi administratif langsung ke database cloud. Setiap tindakan berisiko (restore, reset, arsip) dieksekusi dengan *pre-allocated operation ID*, *cryptographic nonce marker*, dan verifikasi receipt dari Cloudflare Edge Gateway (\`simni-assets-gateway\`).

---

## 2. STRUKTUR DIREKTORI & POHON BERKAS LENGKAP

Berikut adalah arsitektur struktur direktori proyek SIMNI:

\`\`\`
SIMNI_GADM_INTEGRATION/
├── capacitor.config.json           # Konfigurasi pembungkus APK native (Capacitor)
├── firebase.json                   # Konfigurasi routing Hosting, headers CSP, dan Rules RTDB
├── package.json                    # Deklarasi dependencies, build scripts, dan versi proyek
├── sw.js                           # Service Worker PWA (precaching, cache versioning, fetch strategy)
├── index.html                      # Shell HTML utama aplikasi SPA SIMNI
├── manifest.json                   # Web App Manifest PWA (ikon, display standalone, tema)
├── tailwind-offline.css            # Utilitas CSS Tailwind terkompilasi offline (tanpa CDN eksternal)
│
├── edge/                           # Cloudflare Worker Serverless Gateway
│   ├── admin-operations.js         # Logika atomik mutasi administratif server & pemulihan receipt
│   ├── README.md                   # Dokumentasi teknis service edge
│   ├── worker.js                   # Entry point Cloudflare Worker (routing, auth JWT, CORS, Cloudinary)
│   └── wrangler.jsonc              # Konfigurasi deployment Wrangler ke Cloudflare
│
├── features/                       # Modul Fitur Aplikasi (Plug-and-Play Architecture)
│   ├── archive/
│   │   └── archive.js              # Fitur penjelajah arsip database tahun ajaran lampau
│   ├── attendance/
│   │   ├── attendance.html         # Template UI presensi harian, scanner QR, dan rekapitulasi
│   │   └── attendance.js           # Logika presensi, scan QR kamera, filter tanggal, dan persentase
│   ├── backup/
│   │   ├── backup-core.js          # Core engine serialisasi, hashing SHA-256, chunking JSON arsip
│   │   └── backup.js               # UI backup data, unduh arsip JSON, dan modal dialog restore
│   ├── dashboard/
│   │   ├── dashboard.html          # Template UI dashboard ringkasan eksekutif dan kartu metrik
│   │   └── dashboard.js            # Logika agregasi metrik, grafik statistik siswa, dan shortcut
│   ├── documents/
│   │   ├── documents.html          # Template antarmuka galeri berkas LKPD dan dokumen kelas
│   │   └── documents.js            # Pengunggah dokumen ke Cloudinary, preview berkas, dan hapus berkas
│   ├── gadm/                       # Mesin Generator Administrasi & Desain Modul Ajar
│   │   ├── gadm-curriculum-2026.js # Standar CP/TP Kurikulum Merdeka 2026 IPAS, B.Indo, PPKn, dll.
│   │   ├── gadm-docx.js            # Generator berkas Word (.docx) berbasis XML JSZip
│   │   ├── gadm-engine.js          # Mesin perumus RPP/Modul Ajar, kalkulasi alokasi waktu, asesmen
│   │   ├── gadm-kb.js              # Knowledge Base Taksonomi Bloom, metode ajar, media, dan rubrik
│   │   ├── gadm-storage.js         # Penyimpanan lokal draf dan template modul ajar
│   │   ├── gadm.css                # Gaya visual tata letak builder modul ajar GADM
│   │   ├── gadm.html               # Formulir multi-langkah builder modul ajar dan preview dokumen
│   │   └── gadm.js                 # Handler interaksi UI GADM, integrasi OCR scanner, dan aksi ekspor
│   ├── grades/
│   │   ├── grades.html             # Template lembar penilaian formatif dan sumatif
│   │   └── grades.js               # Logika entri nilai, perhitungan otomatis rerata TP/LM, dan validasi
│   ├── journal/
│   │   ├── journal.html            # Template buku jurnal pembelajaran harian guru
│   │   └── journal.js              # CRUD jurnal mengajar, catatan kelas, dan filter riwayat
│   ├── lps/                        # Generator Rapor Lembar Perkembangan Siswa & Buku Laporan
│   │   ├── lps-core.js             # Engine perumusan deskripsi capaian otomatis rapor
│   │   ├── lps-excel.js            # Mesin ekspor laporan ke Excel (.xlsx) dengan formula dan styling
│   │   ├── lps-print.js            # Handler format siap-cetak dan rendering PDF
│   │   ├── lps-reference-data.js   # Basis data referensi predikat dan batas kompetensi
│   │   ├── lps.css                 # Gaya visual pratinjau rapor cetak
│   │   ├── lps.html                # Antarmuka pemilihan template rapor, input catatan, dan pratinjau
│   │   └── lps.js                  # Controller utama modul rapor LPS/BLP
│   ├── notes/
│   │   ├── notes.html              # Template buku catatan anekdot dan pembinaan siswa
│   │   └── notes.js                # Pengelolaan catatan siswa, kategori bimbingan, dan riwayat
│   ├── reset/
│   │   └── reset.js                # Antarmuka dan validator konfirmasi reset tahunan kelas
│   ├── settings/
│   │   ├── settings.html           # Formulir identitas sekolah, kepala sekolah, guru, dan tema
│   │   └── settings.js             # Logika penyimpanan profil kelas dan konfigurasi aplikasi
│   └── students/
│       ├── students.html           # Template direktori siswa, kartu nama, dan foto profil
│       └── students.js             # CRUD siswa, impor Excel massal, ekspor siswa, cetak kartu QR
│
├── firebase/                       # Aturan Keamanan Basis Data Cloud
│   └── database.rules.production.json # Definisi lengkap hak akses, validasi schema, dan izin tulis RTDB
│
├── js/                             # Pondasi Arsitektur JavaScript Utama
│   ├── auth/                       # Lapisan Keamanan & Hak Akses
│   │   ├── access-context.js       # Runtime context pengguna aktif, UID, peran, dan workspace
│   │   ├── access-policy-core.js   # Aturan validasi role-based access control (Superuser vs VIP)
│   │   └── auth.js                 # Interaksi Firebase Authentication (Google login, session state)
│   ├── core/                       # Inti Kerangka Kerja Aplikasi
│   │   ├── app.js                  # Inisialisasi siklus hidup aplikasi dan orkestrasi bootstrap
│   │   ├── feature-loader.js       # Dynamic asynchronous HTML/JS loader untuk modul fitur
│   │   ├── runtime-config.js       # Otoritas tunggal versi rilis, konfigurasi Firebase, dan konstanta
│   │   ├── shell.js                # Pengendali navigasi visual, hamburger menu, header, dan loading
│   │   └── state.js                # Reactive state management store untuk data aplikasi
│   ├── database/                   # Lapisan Persistensi & Sinkronisasi
│   │   ├── cloudinary-client.js    # Klien upload/destroy aset Cloudinary via edge signature
│   │   ├── firebase-client.js      # Klien pembungkus koneksi Firebase Realtime Database
│   │   ├── live-pages.js           # Mesin sync multi-halaman RTDB dengan key-range split (<1.001 items)
│   │   ├── local-cache.js          # Cache runtime berbatas kuota (max 64 entri, 16 MiB, LRU purge)
│   │   ├── paged-query.js          # Utilitas kueri halaman kunci RTDB tanpa beban memori tinggi
│   │   ├── repository.js           # Abstraksi Data Access Object (DAO) untuk seluruh entitas SIMNI
│   │   ├── sync.js                 # Orkestrator sinkronisasi dua arah offline IndexedDB <-> RTDB
│   │   └── workspace-paths-core.js # Utilitas penentu path database per workspace dan tahun ajaran
│   ├── platform/                   # Jembatan Perangkat Keras & Lingkungan Mobile
│   │   ├── bootstrap.js            # Penyesuai deteksi lingkungan (Web Browser vs Native Android APK)
│   │   ├── download-service.js     # Layanan penyimpanan berkas unduhan ke filesystem lokal / storage
│   │   ├── main.js                 # Entry point inisialisasi platform
│   │   ├── native-back-button.js   # Handler tombol fisik "Back" ponsel Android (mencegah close instan)
│   │   └── permission-service.js   # Pengelola izin kamera, penyimpanan, dan notifikasi
│   ├── services/
│   │   └── edge-service.js         # Jembatan HTTP klien ke Worker simni-assets-gateway
│   ├── ui/                         # Komponen Tampilan & Interaksi Pengguna
│   │   ├── actions.js              # Aksi global (logout, switch year, clear cache, print)
│   │   ├── date.js                 # Utilitas pemformatan penanggalan bahasa Indonesia (Hijriah/Masehi)
│   │   ├── feedback.js             # Komponen toast notification, alert banner, dan modal dialog
│   │   ├── navigation.js           # Router SPA berbasis URL Hash (#dashboard, #students, dll.)
│   │   ├── render.js               # Template engine utilitas manipulasi DOM aman
│   │   ├── shell.css               # Desain antarmuka responsif, layout grid, dan sidebar
│   │   └── theme.js                # Switcher tema tampilan (Dark Mode / Light Mode)
│   └── utils/
│       └── sanitize.js             # Sanitizer konten input untuk mencegah celah keamanan XSS
│
├── public/                         # Salinan Artefak Hosting Terverifikasi (Build Output)
│   ├── build-manifest.json         # Manifest integritas checksum SHA-256 seluruh berkas hosting
│   ├── icons/                      # Ikon PWA dan logo institusi
│   ├── templates/                  # Contoh lembar kerja Excel (.xlsx) untuk rapor dan impor siswa
│   └── vendor/                     # Pustaka pihak ketiga offline (Firebase, ExcelJS, SheetJS, dll.)
│
└── scripts/                        # Alat Bantu Build & Verifikasi
    ├── build-hosting.mjs           # Script kompilasi dan pembuatan build-manifest.json
    ├── generate-snapshot.mjs       # Script pembuat snapshot sumber kode mandiri
    └── verify-hosting.mjs          # Verifikator integritas pra-deploy (zero rebuild enforcer)
\`\`\`

---

## 3. DAFTAR LENGKAP 78 FILE SOURCE BESERTA FUNGSI & LOGIKA DETAIL

Berikut adalah dokumentasi analitis terhadap setiap berkas kode sumber yang menyusun aplikasi SIMNI:

### 3.1 Berkas Akar & Konfigurasi Hosting (Root Files)
1. **\`index.html\`**
   - **Fungsi:** Shell dokumen HTML tunggal (*Single Page Application*). Memuat tag meta viewport, konfigurasi PWA, CSP (Content Security Policy), kontainer navigasi atas (*top bar*), laci navigasi samping (*drawer navigation*), area penampung modul (\`#app-content\`), dan dialog modal global.
   - **Logika:** Mengimpor pustaka vendor esensial (\`firebase-app.js\`, \`firebase-auth.js\`, \`firebase-database.js\`), disusul modul core \`runtime-config.js\`, \`state.js\`, \`shell.js\`, \`feature-loader.js\`, dan \`app.js\`. Memuat meta tag unik \`simni-edge-url\` yang mengarahkan klien ke Worker \`https://simni-assets-gateway.2ndgoal.workers.dev\`.
2. **\`manifest.json\`**
   - **Fungsi:** Metadata PWA standar W3C.
   - **Logika:** Menentukan nama aplikasi (\`SIMNI - Sistem Informasi Manajemen Nilai & Informasi\`), nama pendek (\`SIMNI\`), warna tema (\`#1e293b\`), warna latar (\`#0f172a\`), orientasi (\`any\`), mode tampilan (\`standalone\`), dan asosiasi ikon multi-resolusi (\`192x192\`, \`512x512\`, dan maskable).
3. **\`sw.js\`**
   - **Fungsi:** Service Worker aplikasi offline.
   - **Logika:** Membaca otoritas versi dari \`js/core/runtime-config.js\` via \`importScripts\`. Melakukan *atomic precaching* terhadap 104 file app-shell saat tahap \`install\`. Saat event \`activate\`, membersihkan versi cache lama tanpa merusak cache aplikasi lain. Strategi fetching: *network-first* untuk navigasi HTML dan *cache-first* untuk aset versi terikat. Tidak pernah meng-cache URL Firebase API atau Cloudinary dinamis.
4. **\`tailwind-offline.css\`**
   - **Fungsi:** Lembar gaya desain berbasis Tailwind CSS versi offline.
   - **Logika:** Memuat seluruh kelas utilitas flexbox, CSS grid, spasi, warna slate/indigo/emerald/rose, tipografi, transisi, dan responsivitas tanpa perlu mengunduh CSS dari CDN eksternal.
5. **\`package.json\`**
   - **Fungsi:** Manifes dependensi Node.js proyek.
   - **Logika:** Menetapkan nama paket (\`simni-gadm-integration\`), versi aktif (\`4.7.2\`), skrip verifikasi (\`npm run verify\`), build (\`npm run build\`), test suite, dan dependensi perkakas pembantu.
6. **\`firebase.json\`**
   - **Fungsi:** Konfigurasi Firebase CLI untuk target \`admin-kelas-3a\`.
   - **Logika:** Memetakan aturan database ke \`firebase/database.rules.production.json\`, menetapkan direktori hosting ke \`public/\`, menyematkan hook pra-deploy \`node scripts/verify-hosting.mjs\`, dan menyematkan header keamanan HTTP ketat (CSP, X-Content-Type nosniff, Referrer-Policy strict-origin, COOP same-origin-allow-popups, dan Permissions-Policy).
7. **\`capacitor.config.json\`**
   - **Fungsi:** Konfigurasi pembungkus Android native (Capacitor/Cordova).
   - **Logika:** Menentukan App ID (\`id.my.simni.app\`), nama aplikasi (\`SIMNI\`), webDir (\`public\`), dan skema URL lokal (\`https\`).

---

### 3.2 Modul Keamanan & Hak Akses (\`js/auth/\`)
8. **\`js/auth/access-context.js\`**
   - **Fungsi:** Pengelola konteks identitas dan perizinan sesi saat runtime.
   - **Logika:** Mengabstraksikan objek pengguna aktif dari Firebase Auth dan profil pengguna dari RTDB (\`/users/{uid}\`). Menyediakan metode verifikasi cepat seperti \`isSuperuser()\`, \`isVip()\`, \`getActiveWorkspaceId()\`, dan \`getActiveAcademicYear()\`. Mencegah aksi administratif jika status pengguna bukan \`active\`.
9. **\`js/auth/access-policy-core.js\`**
   - **Fungsi:** Mesin aturan (*rule engine*) perizinan murni (bisa diuji di Node.js maupun browser).
   - **Logika:** Menegakkan isolasi hak akses:
     - Email \`unggaran.sditbm@gmail.com\` $\rightarrow$ Role \`superuser\`, Workspace \`ws_superuser\`, Kelas \`3A\`. Berhak atas seluruh fitur termasuk Backup, Restore, Reset, Pengaturan Sekolah, dan Rollover.
     - Email \`anur.auliya01@gmail.com\` $\rightarrow$ Role \`vip\`, Workspace \`ws_pjok\`, Kelas \`PJOK\`. Dibatasi hanya pada Penilaian, Presensi, Jurnal, dan Dokumen PJOK miliknya. Ditolak jika mencoba mengakses endpoint administratif.
10. **\`js/auth/auth.js\`**
    - **Fungsi:** Pengendali interaksi autentikasi Firebase di antarmuka.
    - **Logika:** Menangani alur login Google (\`signInWithPopup\` atau redirect), memantau perubahan status autentikasi via \`onAuthStateChanged\`, memvalidasi profil tersimpan di RTDB, memicu pemuatan shell jika valid, atau menampilkan halaman gerbang login jika tidak terautentikasi atau ditangguhkan.

---

### 3.3 Inti Kerangka Kerja Aplikasi (\`js/core/\`)
11. **\`js/core/runtime-config.js\`**
    - **Fungsi:** Otoritas tunggal (*single source of truth*) konfigurasi runtime dan versi sistem.
    - **Logika:** Mendefinisikan \`SIMNIVersionManifest\` dengan \`appVersion: '4.7.2'\`, \`cacheVersion: '4.7.2'\`, skema backup, serta konfigurasi koneksi Firebase cloud asli (API Key, Auth Domain, Database URL, Project ID, Storage Bucket, Messaging Sender ID, App ID).
12. **\`js/core/state.js\`**
    - **Fungsi:** Pusat penyimpanan state reaktif aplikasi (*Central State Store*).
    - **Logika:** Mengelola data in-memory aktif: daftar siswa (\`students\`), nilai (\`grades\`), presensi (\`attendance\`), jurnal (\`journal\`), catatan (\`notes\`), dan pengaturan (\`settings\`). Mengimplementasikan pola *Pub/Sub* (Publish-Subscribe) sehingga ketika data diubah di repositori, seluruh komponen UI yang mendengarkan event state otomatis memperbarui tampilan.
13. **\`js/core/feature-loader.js\`**
    - **Fungsi:** Pemuat modul fitur secara dinamis dan asinkron (*Asynchronous Feature Loader*).
    - **Logika:** Membaca path hash URL (misal \`#students\`), memuat berkas HTML fitur via fetch/cache ke dalam \`#app-content\`, kemudian secara dinamis mengeksekusi skrip JS pendamping modul jika belum dimuat di memori. Mengisolasi inisialisasi modul via fungsi \`init<Feature>()\` dan pembersihan memory listener saat berpindah menu via \`cleanup<Feature>()\`.
14. **\`js/core/shell.js\`**
    - **Fungsi:** Pengatur tata letak visual utama dan kerangka aplikasi.
    - **Logika:** Mengendalikan tombol toggle sidebar/drawer untuk layar ponsel, menampilkan indikator status sinkronisasi (Online / Offline / Menyinkronkan), memuat avatar guru aktif di top bar, dan mengatur banner informasi tahun ajaran aktif.
15. **\`js/core/app.js\`**
    - **Fungsi:** Titik masuk (*entry point*) bootstrap aplikasi web.
    - **Logika:** Mengaitkan event DOMContentLoaded, menginisialisasi pustaka platform, mendaftarkan Service Worker \`sw.js\`, memeriksa ketersediaan IndexedDB, dan mengaktifkan router navigasi hash pertama kali.

---

### 3.4 Lapisan Basis Data, Sinkronisasi, & Jaringan (\`js/database/\`)
16. **\`js/database/workspace-paths-core.js\`**
    - **Fungsi:** Generator jalur URI database RTDB terisolasi.
    - **Logika:** Mengkonstruksi path data yang konsisten: \`workspaces/{workspaceId}/data/{academicYearId}/{collectionName}\`. Memastikan tidak terjadi tumpang tindih antara data tahun ajaran aktif dan tahun ajaran lampau.
17. **\`js/database/local-cache.js\`**
    - **Fungsi:** Pengelola cache runtime lokal berbatas kapasitas (memenuhi audit S07).
    - **Logika:** Mencegah kebocoran memori browser. Dibatasi maksimum 64 entri, total ukuran 16 MiB, dan umur retensi 7 hari. Menggunakan algoritma penggusuran LRU (*Least Recently Used*). Fungsi pembersihan (*purge*) hanya menyasar cache khusus \`simni-runtime\` tanpa pernah menghapus cache \`app-shell\` utama atau data IndexedDB.
18. **\`js/database/paged-query.js\`**
    - **Fungsi:** Pelaksana kueri bertahap pada koleksi RTDB besar (memenuhi audit S02).
    - **Logika:** Mengambil data dalam potongan (*page*) kunci maksimum 1.001 record menggunakan \`orderByKey()\`, \`startAt()\`, dan \`limitToFirst()\`. Mencegah browser mengalami kehabisan memori (*out of memory*) ketika koleksi presensi atau nilai mencapai puluhan ribu entri.
19. **\`js/database/live-pages.js\`**
    - **Fungsi:** Listener sinkronisasi waktu-nyata multi-halaman berbasis rentang kunci hidup (*live key ranges*).
    - **Logika:** Membagi koleksi data di atas 1.000 record ke dalam segmen-segmen rentang kunci dinamis. Memasang listener \`child_added\`, \`child_changed\`, \`child_removed\` pada masing-masing segmen secara paralel. Jika terjadi penyisipan data baru yang membuat suatu segmen melebihi batas, rentang otomatis dipecah menjadi dua (*split range*). Publikasi state ke UI hanya dilakukan setelah semua rentang selesai terisi penuh (*complete snapshot*).
20. **\`js/database/firebase-client.js\`**
    - **Fungsi:** Pembungkus (*wrapper*) SDK Firebase Realtime Database.
    - **Logika:** Menginisialisasi instans Firebase Database dari konfigurasi runtime. Menyediakan fungsi utilitas koneksi aman: pembacaan nilai sekali (\`getOnce\`), penulisan atomik (\`set\`, \`update\`), transaksi nilai, dan deteksi status koneksi cloud via \`.info/connected\`.
21. **\`js/database/cloudinary-client.js\`**
    - **Fungsi:** Klien pengunggah dan pembersih dokumen media Cloudinary.
    - **Logika:** Mencegah penyimpanan API Secret di aplikasi klien. Mengirim permohonan tanda tangan kriptografis ke Worker \`/v1/cloudinary/sign\`, kemudian mengunggah langsung berkas biner ke REST API Cloudinary menggunakan formulir FormData. Menghapus berkas via \`/v1/cloudinary/delete\`.
22. **\`js/database/repository.js\`**
    - **Fungsi:** Lapisan Abstraksi Data (*Data Access Object*) utama untuk entitas aplikasi.
    - **Logika:** Menyediakan API tingkat tinggi untuk CRUD entitas: \`getStudents()\`, \`saveStudent()\`, \`deleteStudent()\`, \`getAttendance()\`, \`saveAttendanceBatch()\`, \`getGrades()\`, \`saveGrades()\`, \`getJournal()\`, \`getNotes()\`, \`getSettings()\`, \`saveSettings()\`. Berkomunikasi transparan dengan IndexedDB untuk operasi luring dan menyalurkan pembaruan ke mesin sinkronisasi.
23. **\`js/database/sync.js\`**
    - **Fungsi:** Orkestrator sinkronisasi dua arah offline IndexedDB dan cloud RTDB.
    - **Logika:** Mengelola antrean penulisan luring (*offline write queue*). Saat perangkat kembali terhubung ke jaringan internet, antrean dieksekusi secara sekuensial dengan resolusi konflik berbasis *timestamp*. Mengaktifkan listener sinkronisasi latar belakang untuk menerima perubahan data dari perangkat guru lain secara instan.

---

### 3.5 Antarmuka Pengguna & Komponen UI (\`js/ui/\`)
24. **\`js/ui/navigation.js\`**
    - **Fungsi:** Router SPA berbasis URL Hash.
    - **Logika:** Menangkap event \`hashchange\`. Memetakan hash (seperti \`#dashboard\`, \`#students\`, \`#attendance\`, \`#grades\`, \`#lps\`, dll.) ke pemanggilan \`FeatureLoader.loadFeature()\`. Memperbarui penanda status menu aktif di sidebar dan menutup menu laci pada perangkat ponsel.
25. **\`js/ui/render.js\`**
    - **Fungsi:** Template engine ringan manipulasi DOM.
    - **Logika:** Menyediakan fungsi rendering tabel dinamis, pembuat elemen DOM aman dengan escape teks HTML otomatis, dan fungsi penyisipan fragmen dokumen untuk mencegah *layout reflow* berulang.
26. **\`js/ui/feedback.js\`**
    - **Fungsi:** Komponen umpan balik visual terpadu.
    - **Logika:** Menyediakan fungsi \`showToast(message, type)\` (sukses, error, info, peringatan), \`showConfirmModal({title, message, onConfirm})\`, serta pemutar indikator loading global (\`showLoading\`, \`hideLoading\`).
27. **\`js/ui/date.js\`**
    - **Fungsi:** Utilitas penanggalan nasional Indonesia.
    - **Logika:** Mengonversi string tanggal ISO (\`YYYY-MM-DD\`) menjadi format teks resmi Indonesia (misal: "Senin, 15 September 2026"), perhitungan rentang hari efektif sekolah, dan pemformatan tanggal pada kop rapor serta jurnal mengajar.
28. **\`js/ui/theme.js\`**
    - **Fungsi:** Manajer tema visual Dark / Light Mode.
    - **Logika:** Membaca preferensi tema dari \`localStorage\`, menerapkan kelas \`dark\` pada elemen root \`<html>\`, dan menyediakan fungsi sakelar (*toggle*) di bilah navigasi.
29. **\`js/ui/actions.js\`**
    - **Fungsi:** Penangan aksi global aplikasi.
    - **Logika:** Mengikat fungsi tombol logout (dengan konfirmasi pembersihan state sesi), penggantian tahun pelajaran aktif di header, pencetakan dokumen layar via \`window.print()\`, dan pembersihan cache darurat oleh pengguna.
30. **\`js/ui/shell.css\`**
    - **Fungsi:** Lembar gaya desain antarmuka shell utama.
    - **Logika:** Mengatur animasi slide sidebar, floating action button (FAB), transisi kartu dashboard, efek transparan backdrop modal dialog, dan aturan media query khusus perangkat layar sempit / ponsel pintar.

---

### 3.6 Layanan Platform Mobile & Utilitas (\`js/platform/\` & \`js/utils/\`)
31. **\`js/platform/bootstrap.js\`**
    - **Fungsi:** Detektor dan inisiator lingkungan jalan (PWA Browser vs APK Native).
    - **Logika:** Memeriksa keberadaan objek global \`window.Capacitor\` atau \`window.cordova\`. Jika berjalan sebagai aplikasi native Android, mengaktifkan plugin splash screen, status bar, dan pendengar tombol fisik.
32. **\`js/platform/native-back-button.js\`**
    - **Fungsi:** Handler tombol "Back" fisik perangkat Android.
    - **Logika:** Mencegah keluarnya aplikasi secara tidak sengaja saat pengguna menekan tombol kembali pada ponsel. Jika modal sedang terbuka, menutup modal; jika berada di sub-halaman, kembali ke Dashboard; jika berada di Dashboard, menampilkan konfirmasi keluar aplikasi.
33. **\`js/platform/permission-service.js\`**
    - **Fungsi:** Pengelola perizinan perangkat keras Android.
    - **Logika:** Meminta izin akses kamera (\`CAMERA\`) secara dinamis sebelum pemindai QR presensi dibuka, dan izin penyimpanan (\`WRITE_EXTERNAL_STORAGE\`) saat mengunduh laporan PDF/Excel pada perangkat Android versi lama.
34. **\`js/platform/download-service.js\`**
    - **Fungsi:** Layanan abstraksi pengunduhan berkas lintas platform.
    - **Logika:** Pada peramban web, membuat elemen anchor \`<a>\` sementara dengan \`URL.createObjectURL(blob)\` dan mengeksekusi \`click()\`. Pada native Android, menggunakan Capacitor Filesystem API untuk menyimpan berkas langsung ke folder \`Downloads\` perangkat.
35. **\`js/platform/main.js\`**
    - **Fungsi:** Pengait modul platform ke siklus hidup global.
36. **\`js/services/edge-service.js\`**
    - **Fungsi:** Klien jembatan komunikasi HTTP ke Cloudflare Worker Gateway.
    - **Logika:** Mengambil token autentikasi Firebase ID token aktif dari pengguna, menyematkannya pada header \`Authorization: Bearer <token>\`, dan mengirim permintaan mutasi administratif (\`/v1/admin/commit\`), pemeriksaan status (\`/v1/admin/status\`), atau rute Cloudinary. Mengimplementasikan mekanisme penanganan kegagalan jaringan dan pemulihan receipt (memenuhi S05).
37. **\`js/utils/sanitize.js\`**
    - **Fungsi:** Pustaka sanitasi string HTML.
    - **Logika:** Mencegah serangan injeksi skrip Cross-Site Scripting (XSS). Membersihkan tag HTML berbahaya dari input nama siswa, catatan pembinaan, jurnal, dan modul ajar sebelum dirender ke dalam DOM.

---

### 3.7 Modul Fitur Aplikasi (\`features/\`)

#### Modul Siswa (\`features/students/\`)
38. **\`features/students/students.html\`**
    - **Fungsi:** Template UI manajemen siswa.
    - **Logika:** Memuat tabel daftar siswa kelas, kolom pencarian, filter jenis kelamin, tombol tambah siswa manual, tombol cetak kartu QR, tombol ekspor Excel, dan tombol impor data siswa dari file spreadsheet.
39. **\`features/students/students.js\`**
    - **Fungsi:** Controller logika data siswa.
    - **Logika:** Melakukan validasi NIS/NISN unik, nama lengkap, jenis kelamin (L/P), dan status aktif. Membaca berkas template Excel siswa via pustaka \`xlsx\`, mengekstrak data baris secara massal, menyimpannya ke repositori, dan menghasilkan kode QR identitas kartu pelajar siswa menggunakan \`qrcodejs\`.

#### Modul Presensi (\`features/attendance/\`)
40. **\`features/attendance/attendance.html\`**
    - **Fungsi:** Template antarmuka presensi harian.
    - **Logika:** Memuat pemilih tanggal presensi, tombol sakelar cepat ("Hadirkan Semua"), area kamera scanner QR pemindai kartu siswa, tabel daftar siswa dengan tombol pilihan H (Hadir), S (Sakit), I (Izin), A (Alpa), dan panel ringkasan persentase kehadiran bulanan.
41. **\`features/attendance/attendance.js\`**
    - **Fungsi:** Controller logika presensi kelas.
    - **Logika:** Mengintegrasikan pustaka \`html5-qrcode\` untuk mengaktifkan kamera ponsel/laptop. Saat kode QR siswa terbaca, mencocokkan ID siswa dan otomatis menetapkan status "Hadir" dengan umpan balik suara beep. Menyimpan data presensi batch secara real-time ke IndexedDB/RTDB.

#### Modul Penilaian (\`features/grades/\`)
42. **\`features/grades/grades.html\`**
    - **Fungsi:** Template lembar asesmen Kurikulum Merdeka.
    - **Logika:** Tab pemilihan mata pelajaran (Pendidikan Agama Islam, Bahasa Indonesia, Matematika, IPAS, PJOK, Seni, dll.), pemilih jenis asesmen (Formatif TP atau Sumatif LM), tabel entri nilai dinamis per siswa, dan panel ringkasan nilai rerata.
43. **\`features/grades/grades.js\`**
    - **Fungsi:** Controller penilaian akademik.
    - **Logika:** Mendukung penambahan Tujuan Pembelajaran (TP) dinamis. Menghitung secara otomatis nilai akhir per lingkup materi dan semester, memetakan skor angka (0-100) ke interval predikat kompetensi (Sangat Baik, Baik, Cukup, Perlu Bimbingan), dan menyimpan matriks penilaian ke database.

#### Modul Jurnal Pembelajaran (\`features/journal/\`)
44. **\`features/journal/journal.html\`**
    - **Fungsi:** Template buku jurnal harian pembelajaran guru.
    - **Logika:** Formulir entri tanggal, mata pelajaran, materi pokok, TP yang diajarkan, metode pembelajaran, kendala/evaluasi kelas, serta tabel riwayat jurnal mengajar.
45. **\`features/journal/journal.js\`**
    - **Fungsi:** Controller jurnal mengajar.
    - **Logika:** Menghubungkan materi dengan daftar TP yang tersimpan di sistem, menyimpan catatan jurnal, dan mengekspor riwayat jurnal ke format PDF cetak berkala untuk laporan supervisi kepala sekolah.

#### Modul Catatan Siswa (\`features/notes/\`)
46. **\`features/notes/notes.html\`**
    - **Fungsi:** Template buku catatan anekdot dan pembinaan siswa.
    - **Logika:** Memuat formulir pencatatan kejadian perilaku siswa (positif, pembinaan, prestasi), tingkat urgensi catatan, dan daftar rekam jejak bimbingan per siswa.
47. **\`features/notes/notes.js\`**
    - **Fungsi:** Controller catatan perilaku.
    - **Logika:** Mengelompokkan riwayat catatan per siswa secara kronologis, memungkinkan guru kelas dan guru VIP memberikan tindak lanjut, serta mencetak rekap pembinaan saat pertemuan orang tua murid.

#### Modul Generator Administrasi & Desain Modul Ajar (\`features/gadm/\`)
48. **\`features/gadm/gadm-curriculum-2026.js\`**
    - **Fungsi:** Standar referensi kurikulum nasional 2026.
    - **Logika:** Memuat struktur Capaian Pembelajaran (CP), alur tujuan pembelajaran (ATP), dan pemetaan fase B (Kelas 3-4) untuk seluruh mata pelajaran sekolah dasar.
49. **\`features/gadm/gadm-kb.js\`**
    - **Fungsi:** Knowledge Base instruksional pendidikan.
    - **Logika:** Kamus Taksonomi Bloom revisi (Kata Kerja Operasional C1-C6), katalog model pembelajaran kooperatif/PJBL/PBL/Inkuiri, media pembelajaran kontekstual, dan rubrik asesmen autentik.
50. **\`features/gadm/gadm-storage.js\`**
    - **Fungsi:** Penyimpanan persistensi draf rancangan modul ajar.
    - **Logika:** Menyimpan dokumen rancangan RPP/Modul Ajar ke IndexedDB lokal sehingga proses penyusunan yang belum selesai tidak hilang saat browser tertutup.
51. **\`features/gadm/gadm-docx.js\`**
    - **Fungsi:** Mesin generator berkas dokumen Microsoft Word (\`.docx\`).
    - **Logika:** Memanfaatkan \`JSZip\` untuk memanipulasi struktur arsip OpenXML. Membangun berkas \`word/document.xml\`, tabel styling, kop resmi SDIT Bina Madani, dan menyisipkan hasil perumusan modul ajar menjadi file dokumen Word asli yang siap diedit di Microsoft Word.
52. **\`features/gadm/gadm-engine.js\`**
    - **Fungsi:** Mesin perumus dan kalkulator alokasi jam tatap muka modul ajar.
    - **Logika:** Menghitung alokasi waktu per pertemuan (misal $2 \\times 35$ menit), menyusun langkah-langkah kegiatan pembelajaran (Pendahuluan, Kegiatan Inti berdiferensiasi, Penutup), dan menyusun pertanyaan pemantik secara otomatis.
53. **\`features/gadm/gadm.css\`**
    - **Fungsi:** Gaya visual tata letak formulir multi-langkah dan pratinjau dokumen GADM.
54. **\`features/gadm/gadm.html\`**
    - **Fungsi:** Template antarmuka wizard builder GADM.
    - **Logika:** Formulir step-by-step perancangan modul ajar, pemilih tema, tombol aktivasi OCR kamera buku, dan panel pratinjau dokumen langsung.
55. **\`features/gadm/gadm.js\`**
    - **Fungsi:** Controller interaksi modul GADM.
    - **Logika:** Menghubungkan input guru dengan \`gadm-engine.js\`, mengintegrasikan pemindaian OCR teks buku pegangan melalui Tesseract WASM, dan memicu unduhan berkas \`.docx\` melalui \`download-service.js\`.

#### Modul Generator Rapor LPS & BLP (\`features/lps/\`)
56. **\`features/lps/lps-reference-data.js\`**
    - **Fungsi:** Kamus referensi batas predikat nilai rapor dan pemetaan frasa kompetensi.
57. **\`features/lps/lps-core.js\`**
    - **Fungsi:** Mesin generator narasi deskripsi capaian kompetensi rapor otomatis.
    - **Logika:** Menganalisis nilai siswa di setiap TP. Mengidentifikasi TP dengan nilai tertinggi (capaian optimal) dan TP dengan nilai terendah (perlu bimbingan lanjutan). Merumuskan kalimat deskripsi naratif otomatis yang baku dan gramatikal sesuai pedoman Kurikulum Merdeka.
58. **\`features/lps/lps-excel.js\`**
    - **Fungsi:** Generator lembar kerja Excel (\`.xlsx\`) rapor berformat resmi.
    - **Logika:** Menggunakan pustaka \`exceljs\` untuk mengisi template resmi \`LPS KLS 2 contoh.xlsx\` dan \`BLP contoh.xlsx\`. Menerapkan rumus formula penjumlahan, rata-rata, garis batas tabel (*border*), penggabungan sel (*merge cells*), font, dan layout cetak halaman.
59. **\`features/lps/lps-print.js\`**
    - **Fungsi:** Handler pencetakan langsung dan konversi PDF rapor.
    - **Logika:** Merender pratinjau rapor ke elemen kanvas cetak A4, menyematkan nomor halaman, kop sekolah, tanda tangan kepala sekolah & guru kelas, dan mengekspor ke file PDF menggunakan \`html2pdf\`.
60. **\`features/lps/lps.css\`**
    - **Fungsi:** Aturan CSS presisi tinggi untuk pratinjau dan pencetakan rapor A4 (margins, page breaks, font table alignment).
61. **\`features/lps/lps.html\`**
    - **Fungsi:** Template antarmuka generator rapor LPS/BLP.
    - **Logika:** Pemilih siswa, pemilih jenis laporan (LPS Tengah Semester atau BLP Rapor Akhir Semester), kolom catatan wali kelas, tombol ekspor Excel, dan tombol cetak PDF.
62. **\`features/lps/lps.js\`**
    - **Fungsi:** Controller utama modul laporan perkembangan siswa.
    - **Logika:** Mengagregasi data siswa, data nilai dari modul grades, dan data presensi harian menjadi satu bundel model data laporan utuh sebelum disalurkan ke mesin Excel atau PDF.

#### Modul Galeri Dokumen & LKPD (\`features/documents/\`)
63. **\`features/documents/documents.html\`**
    - **Fungsi:** Template galeri dokumen dan LKPD kelas.
    - **Logika:** Antarmuka unggah berkas (PDF, gambar tugas siswa, lembar LKPD), grid kartu berkas digital, filter kategori dokumen, dan tombol pratinjau berkas.
64. **\`features/documents/documents.js\`**
    - **Fungsi:** Controller manajemen dokumen digital.
    - **Logika:** Memeriksa ukuran berkas (maksimal 5-8 MB sesuai kebijakan aset), meminta izin dan tanda tangan unggah ke Worker, mengirim berkas ke Cloudinary, dan menyimpan metadata public URL berkas ke dalam RTDB.

#### Modul Pencadangan & Pemulihan (\`features/backup/\`)
65. **\`features/backup/backup-core.js\`**
    - **Fungsi:** Mesin pembuat dan pemverifikasi berkas arsip database.
    - **Logika:** Mengekstrak seluruh entitas dari IndexedDB, menghitung checksum SHA-256 integritas payload, mengompresi struktur data ke dalam format chunks string aman (\`json-chunks-v1\`) untuk mencegah penghapusan objek kosong oleh RTDB, dan menyediakan parser pembaca arsip versi lama maupun baru.
66. **\`features/backup/backup.js\`**
    - **Fungsi:** Controller antarmuka backup dan restore.
    - **Logika:** Menyediakan tombol unduh file arsip \`.json\` terenkripsi ke komputer lokal pengguna, tombol unggah file restore, modal konfirmasi verifikasi integritas, dan pengiriman mutasi restore melalui gateway edge terverifikasi.

#### Modul Pengaturan & Profil (\`features/settings/\`)
67. **\`features/settings/settings.html\`**
    - **Fungsi:** Template formulir pengaturan sekolah dan aplikasi.
    - **Logika:** Input Nama Sekolah (\`SDIT Bina Madani\`), NPSN, Alamat, Nama Kepala Sekolah, NUKS, Nama Guru Kelas, NUPTK, Tahun Pelajaran aktif, Semester, Titimangsa Rapor, dan opsi reset cache.
68. **\`features/settings/settings.js\`**
    - **Fungsi:** Controller konfigurasi profil sekolah.
    - **Logika:** Melakukan validasi format teks, menyimpan pembaruan identitas sekolah ke RTDB di bawah node \`workspaces/{ws}/settings/identity\`, dan menyinkronkannya ke seluruh modul rapor dan modul ajar.

#### Modul Dashboard (\`features/dashboard/\`)
69. **\`features/dashboard/dashboard.html\`**
    - **Fungsi:** Template beranda ringkasan informasi eksekutif.
    - **Logika:** Kartu statistik total siswa aktif (L/P), persentase kehadiran hari ini, status kelengkapan nilai mata pelajaran, grafik tren presensi mingguan, dan kartu pintasan aksi cepat (*quick actions*).
70. **\`features/dashboard/dashboard.js\`**
    - **Fungsi:** Controller dashboard.
    - **Logika:** Mengambil agregat data dari \`StateStore\`, mengalkulasi statistik secara instan di memori klien, merender diagram visual, dan memperbarui informasi secara otomatis saat terjadi event perubahan data.

#### Modul Penjelajah Arsip (\`features/archive/\`)
71. **\`features/archive/archive.js\`**
    - **Fungsi:** Controller penjelajah data tahun ajaran lampau (*Academic Year Archive Explorer*).
    - **Logika:** Mengakses simpul \`workspaces/{ws}/archives/{yearId}\`, memungkinkan guru kelas membuka kembali rekapitulasi nilai dan presensi siswa dari tahun ajaran sebelumnya dalam mode hanya-baca (*read-only*) tanpa merusak data tahun ajaran berjalan.

#### Modul Penyetelan Ulang Tahunan (\`features/reset/\`)
72. **\`features/reset/reset.js\`**
    - **Fungsi:** Controller penyetelan ulang tahunan (*Annual Reset*).
    - **Logika:** Menampilkan peringatan bahaya tingkat tinggi (*high-risk alert*). Menuntut konfirmasi frasa verifikasi sebelum menghapus koleksi nilai, presensi, dan jurnal untuk memulai tahun pelajaran baru. Mengeksekusi mutasi melalui Worker edge dengan receipt server resmi.

---

### 3.8 Backend Cloudflare Worker & Operasi Administratif (\`edge/\`)
73. **\`edge/worker.js\`**
    - **Fungsi:** Titik masuk tunggal (*Single Entry Point*) Cloudflare Worker \`simni-assets-gateway\`.
    - **Logika:** Mengamankan API backend:
      - CORS Handler ketat: hanya mengizinkan origin resmi (\`https://admin-kelas-3a.web.app\`, \`https://admin-kelas-3a.firebaseapp.com\`, \`https://simni.my.id\`). Permintaan dari origin lain ditolak dengan status HTTP 400.
      - Autentikasi: Memverifikasi Firebase ID Token JWT klien menggunakan Google Public Certs (\`securetoken@system.gserviceaccount.com\`).
      - Otorisasi: Memeriksa profil pengguna di RTDB via Service Account token. Hanya peran \`superuser\` dan \`vip\` yang memiliki akses.
      - Penandatanganan Cloudinary: Mengkalkulasi signature HMAC-SHA1 untuk upload/delete aset dengan pembatasan folder workspace dan tahun ajaran.
      - Routing administratif: Menyalurkan rute \`/v1/admin/commit\` dan \`/v1/admin/status\` ke \`admin-operations.js\`.
74. **\`edge/admin-operations.js\`**
    - **Fungsi:** Mesin pemroses mutasi administratif server dengan jaminan integritas (memenuhi S05).
    - **Logika:** Menggunakan pola *Two-Phase Commit*:
      1. Fase 1: Memeriksa reservasi operation ID dan marker nonce yang dipasang klien di RTDB.
      2. Fase 2: Menjalankan pembaruan data pengguna menggunakan identitas ID Token pengguna (sehingga aturan database RTDB tetap memvalidasi schema).
      3. Fase 3: Menulis receipt server resmi berstatus \`committed\` dengan otoritas \`server-executed-rtdb-ack\` di bawah simpul \`auditLogs/{ws}/{opId}\` dan menghapus marker nonce sementara.
      4. Idempotensi: Jika request dikirim ulang dengan operation ID yang sama, mengembalikan receipt yang sudah ada (\`replayed: true\`) tanpa mengulang mutasi data.
75. **\`edge/wrangler.jsonc\`**
    - **Fungsi:** Konfigurasi infrastruktur Cloudflare Worker.
    - **Logika:** Menentukan nama Worker (\`simni-assets-gateway\`), skrip utama (\`worker.js\`), tanggal kompatibilitas (\`2026-08-27\`), flag \`nodejs_compat\`, observabilitas log, dan variabel lingkungan publik (\`CLOUDINARY_CLOUD_NAME\`, \`FIREBASE_PROJECT_ID\`, \`FIREBASE_DATABASE_URL\`, dll.).

---

### 3.9 Basis Data Cloud & Skrip Verifikasi Rilis (\`firebase/\` & \`scripts/\`)
76. **\`firebase/database.rules.production.json\`**
    - **Fungsi:** Aturan keamanan (*Security Rules*) Firebase Realtime Database produksi.
    - **Logika:** 
      - Root \`.read: false\`, \`.write: false\` secara default.
      - \`auditLogs/{ws}/{opId}/.write: false\` $\rightarrow$ Klien dilarang keras menulis atau merekayasa log audit sendiri.
      - \`administrativeOperations/.read: false\`, \`.write: false\` $\rightarrow$ Klien dilarang mengakses tabel reservasi internal server.
      - \`administrativeCommitMarkers/{ws}/{opId}\` $\rightarrow$ Hanya dapat ditulis sekali (\`!data.exists() && newData.exists()\`) dengan validasi format nonce 36-karakter.
      - Isolasi workspace ketat: Guru kelas hanya dapat membaca/menulis di \`ws_superuser\`, dan guru PJOK hanya di \`ws_pjok\`.
77. **\`scripts/verify-hosting.mjs\`**
    - **Fungsi:** Gerbang audit pra-deploy (*Pre-deploy Enforcer*).
    - **Logika:** Membaca berkas \`public/build-manifest.json\`, memeriksa apakah versi sama dengan \`package.json\` (\`4.7.2\`), memverifikasi hash build ID (\`844d010acb53f5d8d0f1eac9a1baf72b7bd78d4bec3614e47f6ff51242bd5261\`), memindai seluruh 104 berkas hosting dan mencocokkan SHA-256 masing-masing berkas dengan sumber aslinya. Jika ada berkas yang dimodifikasi tanpa build, proses deployment dibatalkan secara otomatis.
78. **\`scripts/build-hosting.mjs\`**
    - **Fungsi:** Kompilator bundel rilis Hosting.
    - **Logika:** Menyalin seluruh berkas sumber aplikasi dari direktori kerja ke dalam direktori \`public/\`, menyematkan meta tag URL edge resmi, mengecualikan berkas tes QA dan berkas chat usang, menghitung checksum SHA-256 seluruh berkas, dan menerbitkan \`build-manifest.json\`.

---

## 4. STRUKTUR MENU & MATRIKS HAK AKSES SIMNI

Navigasi aplikasi SIMNI diatur melalui router berbasis URL hash. Berikut adalah pemetaan lengkap seluruh menu:

| ID Menu (Hash) | Label Navigasi | Ikon | Hak Akses Superuser | Hak Akses VIP (PJOK) | Deskripsi Fungsional |
|---|---|---|---|---|---|
| \`#dashboard\` | Dashboard | \`fa-gauge-high\` | Ya (Akses Penuh) | Ya (Metrik PJOK) | Halaman beranda ringkasan metrik kelas, grafik kehadiran, dan shortcut aksi cepat. |
| \`#students\` | Data Siswa | \`fa-users\` | Ya (Akses Penuh) | Ya (Hanya Lihat) | Direktori biodata siswa, NIS/NISN, cetak kartu QR, dan impor/ekspor data siswa. |
| \`#attendance\` | Presensi | \`fa-calendar-check\` | Ya (Akses Penuh) | Ya (Presensi Mapel) | Input presensi harian siswa, pemindai kamera QR code kartu pelajar, dan rekapitulasi. |
| \`#grades\` | Penilaian | \`fa-chart-simple\` | Ya (Semua Mapel) | Ya (Hanya Mapel PJOK) | Entri nilai Formatif per TP dan Sumatif per Lingkup Materi dengan kalkulasi rerata otomatis. |
| \`#journal\` | Jurnal Mengajar | \`fa-book-bookmark\` | Ya (Akses Penuh) | Ya (Jurnal PJOK) | Pencatatan agenda harian pembelajaran guru, materi TP, kendala, dan evaluasi tatap muka. |
| \`#notes\` | Catatan Siswa | \`fa-clipboard-user\` | Ya (Akses Penuh) | Ya (Catatan PJOK) | Rekam jejak anekdotal perilaku, pembinaan kepribadian, prestasi, dan catatan perkembangan. |
| \`#gadm\` | Modul Ajar GADM | \`fa-compass-drafting\` | Ya (Akses Penuh) | Ya (Akses Penuh) | Generator Administrasi & Desain Modul Ajar Kurikulum Merdeka 2026 dan ekspor DOCX Word. |
| \`#lps\` | Rapor LPS & BLP | \`fa-file-invoice\` | Ya (Akses Penuh) | Tidak (Khusus Wali Kelas) | Pembuat Rapor Capaian Siswa (LPS tengah semester & BLP akhir semester), ekspor Excel & PDF. |
| \`#documents\` | Galeri Dokumen | \`fa-folder-open\` | Ya (Akses Penuh) | Ya (Dokumen PJOK) | Penyimpanan awan berkas LKPD, lembar kerja siswa, dan portofolio digital berbasis Cloudinary. |
| \`#settings\` | Pengaturan | \`fa-gear\` | Ya (Akses Penuh) | Tidak (Khusus Superuser) | Konfigurasi profil sekolah, nama kepala sekolah, titimangsa rapor, dan pengaturan tema. |
| \`#backup\` | Backup & Pulihkan | \`fa-database\` | Ya (Akses Penuh) | Tidak (Khusus Superuser) | Pembuat salinan database JSON terenkripsi, unduhan arsip offline, dan pemulihan data. |
| \`#archive\` | Arsip Tahun Lalu | \`fa-box-archive\` | Ya (Akses Penuh) | Tidak (Khusus Superuser) | Penjelajah basis data tahun pelajaran lampau dalam mode hanya-baca (*read-only*). |
| \`#reset\` | Penyetelan Ulang | \`fa-triangle-exclamation\` | Ya (Akses Penuh) | Tidak (Khusus Superuser) | Pembersihan tahunan data nilai, presensi, dan jurnal saat pergantian tahun ajaran baru. |

---

## 5. STRUKTUR MODAL & DIALOG INTERAKTIF

Seluruh interaksi kritis dan pengisian formulir tambahan di SIMNI dikelola melalui jendela pop-up dialog (*Modal*) terstandarisasi yang memiliki backdrop transparan dan pencegah kehilangan data:

### 5.1 Modal Siswa (\`features/students/\`)
1. **Modal Tambah / Edit Siswa (\`#student-form-modal\`):**
   - **Tujuan:** Menambah siswa baru atau memperbarui biodata siswa lama.
   - **Input Fields:** NIS, NISN, Nama Lengkap, Nama Panggilan, Jenis Kelamin (Radio L/P), Tempat/Tanggal Lahir, Nama Orang Tua, Nomor Kontak Darurat.
   - **Aksi:** Tombol "Batal" (menutup modal), Tombol "Simpan" (validasi data, tulis ke IndexedDB & RTDB).
2. **Modal Impor Siswa Excel (\`#student-import-modal\`):**
   - **Tujuan:** Impor data siswa massal dari berkas \`.xlsx\`.
   - **Input Fields:** Pemilih berkas Excel (\`.xlsx\`, \`.xls\`), pratinjau tabel baris siswa hasil pembacaan SheetJS.
   - **Aksi:** Tombol "Unduh Template Excel", Tombol "Proses Impor" (validasi duplikasi NISN, simpan massal).
3. **Modal Kartu QR Siswa (\`#student-qr-modal\`):**
   - **Tujuan:** Pratinjau dan pencetakan kartu identitas pelajar ber-QR code.
   - **Elemen:** Kanvas rendering kode QR, logo sekolah, nama, dan NISN siswa. Tombol "Cetak Kartu".

### 5.2 Modal Presensi (\`features/attendance/\`)
4. **Modal Pemindai Kamera QR (\`#qr-scanner-modal\`):**
   - **Tujuan:** Membuka kamera perangkat secara interaktif untuk memindai kartu presensi siswa.
   - **Elemen:** Video viewport stream kamera (\`html5-qrcode\`), pemilih kamera (depan/belakang), indikator target bidik, status siswa terakhir terpindai ("Ahmad Fauzi - Hadir").
   - **Aksi:** Tombol "Tutup Scanner".

### 5.3 Modal Penilaian & TP (\`features/grades/\`)
5. **Modal Tambah / Kelola Tujuan Pembelajaran (\`#tp-manage-modal\`):**
   - **Tujuan:** Mengatur daftar TP yang akan dinilai pada mata pelajaran terpilih.
   - **Input Fields:** Kode TP (misal \`TP 3.1\`), Deskripsi Kompetensi TP, Lingkup Materi (LM) terkait.
   - **Aksi:** Tombol "Tambah TP", Tombol "Hapus TP", Tombol "Simpan Perubahan".

### 5.4 Modal Generator Rapor LPS / BLP (\`features/lps/\`)
6. **Modal Pratinjau Cetak Rapor (\`#lps-preview-modal\`):**
   - **Tujuan:** Memeriksa tampilan visual rapor sebelum diekspor ke format cetak PDF atau Excel.
   - **Elemen:** Lembar kertas A4 virtual interaktif berisi data identitas siswa, nilai per muatan pelajaran, narasi capaian otomatis tertinggi/terendah, dan kolom tanda tangan.
   - **Aksi:** Tombol "Unduh Excel (.xlsx)", Tombol "Cetak / Simpan PDF", Tombol "Tutup".

### 5.5 Modal Modul Ajar GADM (\`features/gadm/\`)
7. **Modal Pemindai Teks Dokumen OCR (\`#gadm-ocr-modal\`):**
   - **Tujuan:** Mengekstraksi teks dari foto buku ajar menggunakan mesin Tesseract OCR WASM.
   - **Elemen:** Area upload foto / snapshot kamera buku pegangan guru, progress bar ekstraksi teks bahasa Indonesia.
   - **Aksi:** Tombol "Salin Teks ke Modul Ajar", Tombol "Batal".

### 5.6 Modal Pengunggah Dokumen (\`features/documents/\`)
8. **Modal Upload Dokumen & LKPD (\`#document-upload-modal\`):**
   - **Tujuan:** Mengunggah lembar tugas atau berkas pendukung pembelajaran ke cloud.
   - **Input Fields:** Judul Dokumen, Kategori (LKPD / Modul Ajar / Tugas Siswa / Foto Kegiatan), File Picker (PDF/PNG/JPEG).
   - **Aksi:** Tombol "Unggah ke Cloudinary" (menampilkan persentase upload), Tombol "Batal".

### 5.7 Modal Administratif & Pemulihan (\`features/backup/\` & \`features/reset/\`)
9. **Modal Konfirmasi Pemulihan Database / Restore (\`#restore-confirm-modal\`):**
   - **Tujuan:** Memulihkan seluruh basis data kelas dari file cadangan.
   - **Elemen:** Peringatan penimpaan data aktif, penampil ringkasan isi berkas backup (jumlah siswa, jumlah nilai, tanggal backup dibuat, checksum SHA-256).
   - **Aksi:** Input frasa konfirmasi "PULIHKAN DATA", Tombol "Batal", Tombol eksekusi "Mulai Pemulihan Data".
10. **Modal Konfirmasi Penyetelan Ulang / Reset Tahunan (\`#annual-reset-modal\`):**
    - **Tujuan:** Mengosongkan data nilai dan presensi untuk menyongsong tahun ajaran baru.
    - **Elemen:** Kotak dialog berlatar merah (bahaya permanen), instruksi wajib mengunduh backup terlebih dahulu.
    - **Aksi:** Pengetikan kode konfirmasi unik, Tombol "Batalkan", Tombol "Eksekusi Reset Bersih".

---

## 6. PANDUAN PEMBANGUNAN KEMBALI APLIKASI DARI NOL (ZERO-SOURCE RECONSTRUCTION GUIDE)

Jika seluruh sistem SIMNI mengalami bencana total (*total loss*):
1. **Ekstrak Seluruh Berkas Sumber:**
   Gunakan file pendamping \`SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md\` untuk merekonstruksi ke-78 berkas sumber persis pada lokasi path direktori masing-masing.
2. **Siapkan Pustaka Pihak Ketiga (Vendor):**
   Tempatkan pustaka offline di \`public/vendor/\` sebagaimana dijelaskan pada Lampiran \`SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md\` (Firebase Web SDK, ExcelJS, SheetJS, html2pdf, html5-qrcode, qrcodejs, Tesseract WASM, JSZip, FontAwesome).
3. **Instalasi Dependensi Pembangun:**
   Jalankan \`npm install\` untuk menginisialisasi lingkungan pengembang.
4. **Verifikasi Integritas:**
   Jalankan verifikasi pra-deploy:
   \`\`\`bash
   node scripts/verify-hosting.mjs
   \`\`\`
   Output wajib menampilkan \`VERIFIED 4.7.2 844d010acb53f5d8d0f1eac9a1baf72b7bd78d4bec3614e47f6ff51242bd5261 (104 files; no rebuild)\`.
5. **Deployment Cloud Terurut Sesuai Runbook 4.7.2:**
   - Deploy Cloudflare Worker: \`node test-output/tahap7-tools/node_modules/wrangler/bin/wrangler.js deploy --config edge/wrangler.jsonc\`
   - Deploy Rules RTDB: \`firebase deploy --only database --project admin-kelas-3a\`
   - Deploy Hosting PWA: \`firebase deploy --only hosting --project admin-kelas-3a\`
6. **Aplikasi siap beroperasi kembali 100% tanpa kehilangan fungsionalitas sedikit pun.**

---
*Dokumen Spesifikasi & Arsitektur Resmi SIMNI 4.7.2.*
`;

writeFileSync('SIMNI_ARSITEKTUR_DAN_SPESIFIKASI_LENGKAP.md', content, 'utf8');
console.log('SUCCESS: SIMNI_ARSITEKTUR_DAN_SPESIFIKASI_LENGKAP.md generated!');
const stats = statSync('SIMNI_ARSITEKTUR_DAN_SPESIFIKASI_LENGKAP.md');
console.log(`Generated size: ${(stats.size / 1024).toFixed(1)} KB (${stats.size} bytes).`);
