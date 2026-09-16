# SPESIFIKASI ARSITEKTUR, SISTEM, DAN DOKUMENTASI LENGKAP SIMNI MULTI-ROLE
## Panduan Induk Pembangunan Ulang — Desain Final Berbasis SIMNI 4.7.2

> **KONTRAK PRODUK FINAL, BUKAN LAPORAN DEPLOYMENT.** Dokumen ini mendefinisikan sistem target seolah seluruh multi-role telah selesai: semua kata “harus” adalah persyaratan implementasi, bukan bukti bahwa source 4.7.2 sudah memenuhinya. AI pembangun wajib menghasilkan perilaku final ini. Snapshot Antigravity tetap menjadi sumber kode dasar 4.7.2 dan tidak diubah. Tidak ada revisi aplikasi atau cloud yang dilakukan dengan pembuatan dokumen ini.
>
> **IDENTITAS DASAR DIPERTAHANKAN.** Tampilan, fitur akademik, perhitungan, template, hasil ekspor, pola navigasi, responsivitas, dan feedback tetap mengikuti SIMNI dasar. Perbedaan hanya penambahan akun/workspace guru kelas dan alur administrasi yang diperlukan, serta penutupan akses File/Dokumen/Cloudinary bagi selain owner. AI tidak boleh mendesain ulang aplikasi atau menambahkan fitur lain atas inisiatif sendiri.
>
> File ini dibuat terpisah dari `SIMNI_ARSITEKTUR_DAN_SPESIFIKASI_LENGKAP.md` milik Antigravity. Struktur narasi, pembahasan fungsi dan logika mengikuti dokumen tersebut. Bila ada kontradiksi antara penjelasan modul dasar dan kontrak final bagian 4–13, kontrak final berlaku. Nama DOM/API existing harus diambil dari source, bukan mengarang alias dari contoh narasi.

### Cara AI menggunakan dokumen
1. Perlakukan dokumen ini sebagai spesifikasi tunggal perilaku multi-role, bukan rencana yang perlu ditafsirkan ulang.
2. Bila snapshot dasar tersedia, pulihkan source lalu implementasikan kontrak final pada salinan terpisah. Jangan menimpa produksi atau menganggap snapshot dua akun sudah multi-role.
3. Bila hanya dokumen ini tersedia, implementasikan kontrak fungsional yang tertulis. Jangan mengklaim kode/visual byte-identik tanpa source/aset referensi; deskripsi tidak menggantikan byte font, ikon, gambar dan template Excel.
4. Keputusan teknis dalam kontrak ini adalah desain yang ditetapkan untuk build target. Bagian “batas lingkup” berarti dilarang menambah perilaku di luar itu, bukan kesempatan berimprovisasi.
5. Jangan menyatakan selesai hanya karena halaman daftar muncul. Semua invariant keamanan, lifecycle, dan acceptance di bagian 12 harus terpenuhi.

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
   - Ekspor laporan berformat Excel tingkat presisi tinggi (`.xlsx`) dan cetak instan ke format PDF.
6. **GADM (Generator Administrasi & Desain Modul Ajar):**
   - Modul otomatis perancang dokumen RPP/Modul Ajar Kurikulum Merdeka 2026.
   - Dilengkapi Knowledge Base (KB) Taksonomi Bloom, pemetaan Profil Pelajar Pancasila, pembagi alokasi jam tatap muka, dan mesin ekspor dokumen Microsoft Word (`.docx`).
   - OCR kamera (Tesseract WASM) untuk menyalin referensi buku pegangan guru.
7. **Pengelolaan Aset Cloud Dokumen (LKPD & Portofolio):**
   - Integrasi Cloudinary Storage untuk penyimpanan berkas Lembar Kerja Peserta Didik (LKPD), foto siswa, dan dokumen digital dengan pembatasan kuota dan penandatanganan kriptografis server-side.
8. **Siklus Hidup Data & Tata Kelola Multi-Tahun (Administrative Lifecycle):**
   - Pencadangan terstruktur dengan pemeriksaan integritas dan scope; tidak mengasumsikan JSON otomatis terenkripsi.
   - Pemulihan (*restore*) dengan validasi server, identitas operasi, dan receipt.
   - Pengarsipan data tahun pelajaran lama (*annual archive*) dengan format chunks JSON berintegritas SHA-256.
   - Pergantian tahun ajaran (*rollover*) dan penyetelan ulang tahunan (*annual reset*).

### 1.2 Paradigma & Arsitektur Utama
SIMNI dibangun dengan prinsip-prinsip ketahanan tingkat tinggi:
- **Offline-First PWA (Progressive Web App):** Kinerja aplikasi tidak boleh bergantung pada kestabilan koneksi internet di kelas. Seluruh shell aplikasi, font, template, dan pustaka disimpan dalam Service Worker cache (`CacheStorage`).
- **Penyimpanan Lokal Reaktif (IndexedDB):** Menggunakan basis data lokal terstruktur yang disinkronisasikan ke Firebase Realtime Database (RTDB) secara latar belakang.
- **Isolasi Multi-Workspace (Multi-Tenant Sekolah):**
  - `ws_superuser`: Workspace Guru Kelas Utama (Kelas 3A). Akses penuh terhadap seluruh administrasi kelas reguler, backup, dan manajemen sistem.
  - `ws_kelas_1a` hingga `ws_kelas_6b` (kecuali 3A): Workspace wali kelas undangan dengan data terisolasi; kelas 3A mempertahankan `ws_superuser`.
  - `ws_pjok`: Workspace Guru Mata Pelajaran (PJOK / VIP). Ruang kerja terisolasi yang hanya mengelola penilaian spesifik mata pelajaran tanpa hak mereset sistem atau melihat data workspace lain.
- **Server-Verified Administrative Commit:** Klien tidak diizinkan menulis receipt mutasi administratif langsung ke database cloud. Setiap tindakan berisiko (restore, reset, arsip) dieksekusi dengan *pre-allocated operation ID*, *cryptographic nonce marker*, dan verifikasi receipt dari Cloudflare Edge Gateway (`simni-assets-gateway`).

---

## 2. STRUKTUR DIREKTORI & POHON BERKAS LENGKAP

Berikut adalah arsitektur struktur direktori proyek SIMNI:

```
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
│   ├── admin-operations.js         # Validasi mutasi administratif server & pemulihan receipt
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
│   │   ├── access-policy-core.js   # Aturan izin Superuser, VIP dan Teacher; workspace berasal dari assignment terverifikasi
│   │   └── auth.js                 # Firebase Authentication email/password dan lifecycle sesi
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
```

---

## 3. BERKAS INTI DASAR BESERTA FUNGSI & LOGIKA DETAIL

Berikut adalah dokumentasi analitis terhadap setiap berkas kode sumber yang menyusun aplikasi SIMNI:

### 3.1 Berkas Akar & Konfigurasi Hosting (Root Files)
1. **`index.html`**
   - **Fungsi:** Shell dokumen HTML tunggal (*Single Page Application*). Memuat tag meta viewport, konfigurasi PWA, CSP (Content Security Policy), kontainer navigasi atas (*top bar*), laci navigasi samping (*drawer navigation*), area penampung modul (`#app-content`), dan dialog modal global.
   - **Logika:** Mengimpor pustaka vendor esensial (`firebase-app.js`, `firebase-auth.js`, `firebase-database.js`), disusul modul core `runtime-config.js`, `state.js`, `shell.js`, `feature-loader.js`, dan `app.js`. Memuat meta tag unik `simni-edge-url` yang mengarahkan klien ke Worker `https://simni-assets-gateway.2ndgoal.workers.dev`.
2. **`manifest.json`**
   - **Fungsi:** Metadata PWA standar W3C.
   - **Logika:** Menentukan nama aplikasi (`SIMNI - Sistem Informasi Manajemen Nilai & Informasi`), nama pendek (`SIMNI`), warna tema (`#1e293b`), warna latar (`#0f172a`), orientasi (`any`), mode tampilan (`standalone`), dan asosiasi ikon multi-resolusi (`192x192`, `512x512`, dan maskable).
3. **`sw.js`**
   - **Fungsi:** Service Worker aplikasi offline.
   - **Logika:** Membaca otoritas versi dari `js/core/runtime-config.js` via `importScripts`. Melakukan *atomic precaching* terhadap 104 file app-shell saat tahap `install`. Saat event `activate`, membersihkan versi cache lama tanpa merusak cache aplikasi lain. Strategi fetching: *network-first* untuk navigasi HTML dan *cache-first* untuk aset versi terikat. Tidak pernah meng-cache URL Firebase API atau Cloudinary dinamis.
4. **`tailwind-offline.css`**
   - **Fungsi:** Lembar gaya desain berbasis Tailwind CSS versi offline.
   - **Logika:** Memuat seluruh kelas utilitas flexbox, CSS grid, spasi, warna slate/indigo/emerald/rose, tipografi, transisi, dan responsivitas tanpa perlu mengunduh CSS dari CDN eksternal.
5. **`package.json`**
   - **Fungsi:** Manifes dependensi Node.js proyek.
   - **Logika:** Menetapkan nama paket (`simni-gadm-integration`), versi aktif (`4.7.2`), skrip verifikasi (`npm run verify`), build (`npm run build`), test suite, dan dependensi perkakas pembantu.
6. **`firebase.json`**
   - **Fungsi:** Konfigurasi Firebase CLI untuk target `admin-kelas-3a`.
   - **Logika:** Memetakan aturan database ke `firebase/database.rules.production.json`, menetapkan direktori hosting ke `public/`, menyematkan hook pra-deploy `node scripts/verify-hosting.mjs`, dan menyematkan header keamanan HTTP ketat (CSP, X-Content-Type nosniff, Referrer-Policy strict-origin, COOP same-origin-allow-popups, dan Permissions-Policy).
7. **`capacitor.config.json`**
   - **Fungsi:** Konfigurasi pembungkus Android native (Capacitor/Cordova).
   - **Logika:** Menentukan App ID (`id.my.simni.app`), nama aplikasi (`SIMNI`), webDir (`public`), dan skema URL lokal (`https`).

---

### 3.2 Modul Keamanan & Hak Akses (`js/auth/`)
8. **`js/auth/access-context.js`**
   - **Fungsi:** Membentuk konteks akses dari Firebase Auth, profil RTDB dan assignment aktif.
   - **Logika:** Cocokkan UID/email/status serta `assignmentRevision`; baca workspace/kelas/tahun dari profil yang ditetapkan server. Owner dan VIP mempertahankan identitas existing. Guru baru tidak membutuhkan perubahan daftar email pada source. Profil hilang tidak otomatis diberi role owner. Status `provisioning`, `disabled`, atau `revoked` tidak dapat membuka data akademik.
9. **`js/auth/access-policy-core.js`**
   - **Fungsi:** Authority murni untuk nama role, hak fitur dan validasi konteks.
   - **Logika:** Role `superuser` milik owner, `vip` milik akun PJOK existing, `teacher` untuk wali kelas undangan. `teacher` bukan role per kelas; satu role dapat memiliki assignment workspace berbeda. Matrix bagian 4 berlaku identik di UI, repository, Worker dan rules. ClassID hanya 1A–6B untuk wali kelas; PJOK untuk VIP.
10. **`js/auth/auth.js`**
    - **Fungsi:** Login email/password existing, logout, reset password dan pemulihan sesi.
    - **Logika:** Pertahankan `signInWithEmailAndPassword` dan pengamatan status Auth. Jangan mengganti login existing menjadi Google popup. Form daftar guru adalah jalur baru terpisah; akun VIP tidak melewati undangan atau verifikasi ulang yang memblokir login lamanya. Setelah login, muat profil server sebelum mount fitur.

---

### 3.3 Inti Kerangka Kerja Aplikasi (`js/core/`)
11. **`js/core/runtime-config.js`**
    - **Fungsi:** Otoritas tunggal (*single source of truth*) konfigurasi runtime dan versi sistem.
    - **Logika:** Mendefinisikan `SIMNIVersionManifest` dengan `appVersion: '4.7.2'`, `cacheVersion: '4.7.2'`, skema backup, serta konfigurasi koneksi Firebase cloud asli (API Key, Auth Domain, Database URL, Project ID, Storage Bucket, Messaging Sender ID, App ID).
12. **`js/core/state.js`**
    - **Fungsi:** Pusat penyimpanan state reaktif aplikasi (*Central State Store*).
    - **Logika:** Mengelola data in-memory aktif: daftar siswa (`students`), nilai (`grades`), presensi (`attendance`), jurnal (`journal`), catatan (`notes`), dan pengaturan (`settings`). Mengimplementasikan pola *Pub/Sub* (Publish-Subscribe) sehingga ketika data diubah di repositori, seluruh komponen UI yang mendengarkan event state otomatis memperbarui tampilan.
13. **`js/core/feature-loader.js`**
    - **Fungsi:** Pemuat modul fitur secara dinamis dan asinkron (*Asynchronous Feature Loader*).
    - **Logika:** Membaca path hash URL (misal `#students`), memuat berkas HTML fitur via fetch/cache ke dalam `#app-content`, kemudian secara dinamis mengeksekusi skrip JS pendamping modul jika belum dimuat di memori. Mengisolasi inisialisasi modul via fungsi `init<Feature>()` dan pembersihan memory listener saat berpindah menu via `cleanup<Feature>()`.
14. **`js/core/shell.js`**
    - **Fungsi:** Pengatur tata letak visual utama dan kerangka aplikasi.
    - **Logika:** Mengendalikan tombol toggle sidebar/drawer untuk layar ponsel, menampilkan indikator status sinkronisasi (Online / Offline / Menyinkronkan), memuat avatar guru aktif di top bar, dan mengatur banner informasi tahun ajaran aktif.
15. **`js/core/app.js`**
    - **Fungsi:** Titik masuk (*entry point*) bootstrap aplikasi web.
    - **Logika:** Mengaitkan event DOMContentLoaded, menginisialisasi pustaka platform, mendaftarkan Service Worker `sw.js`, memeriksa ketersediaan IndexedDB, dan mengaktifkan router navigasi hash pertama kali.

---

### 3.4 Lapisan Basis Data, Sinkronisasi, & Jaringan (`js/database/`)
16. **`js/database/workspace-paths-core.js`**
    - **Fungsi:** Generator jalur URI database RTDB terisolasi.
    - **Logika:** Mengkonstruksi path data yang konsisten: `workspaces/{workspaceId}/data/{academicYearId}/{collectionName}`. Memastikan tidak terjadi tumpang tindih antara data tahun ajaran aktif dan tahun ajaran lampau.
17. **`js/database/local-cache.js`**
    - **Fungsi:** Pengelola cache runtime lokal berbatas kapasitas (memenuhi audit S07).
    - **Logika:** Mencegah kebocoran memori browser. Dibatasi maksimum 64 entri, total ukuran 16 MiB, dan umur retensi 7 hari. Menggunakan algoritma penggusuran LRU (*Least Recently Used*). Fungsi pembersihan (*purge*) hanya menyasar cache khusus `simni-runtime` tanpa pernah menghapus cache `app-shell` utama atau data IndexedDB.
18. **`js/database/paged-query.js`**
    - **Fungsi:** Pelaksana kueri bertahap pada koleksi RTDB besar (memenuhi audit S02).
    - **Logika:** Mengambil data dalam potongan (*page*) kunci maksimum 1.001 record menggunakan `orderByKey()`, `startAt()`, dan `limitToFirst()`. Mencegah browser mengalami kehabisan memori (*out of memory*) ketika koleksi presensi atau nilai mencapai puluhan ribu entri.
19. **`js/database/live-pages.js`**
    - **Fungsi:** Listener sinkronisasi waktu-nyata multi-halaman berbasis rentang kunci hidup (*live key ranges*).
    - **Logika:** Membagi koleksi data di atas 1.000 record ke dalam segmen-segmen rentang kunci dinamis. Memasang listener `child_added`, `child_changed`, `child_removed` pada masing-masing segmen secara paralel. Jika terjadi penyisipan data baru yang membuat suatu segmen melebihi batas, rentang otomatis dipecah menjadi dua (*split range*). Publikasi state ke UI hanya dilakukan setelah semua rentang selesai terisi penuh (*complete snapshot*).
20. **`js/database/firebase-client.js`**
    - **Fungsi:** Pembungkus (*wrapper*) SDK Firebase Realtime Database.
    - **Logika:** Menginisialisasi instans Firebase Database dari konfigurasi runtime. Menyediakan fungsi utilitas koneksi aman: pembacaan nilai sekali (`getOnce`), penulisan atomik (`set`, `update`), transaksi nilai, dan deteksi status koneksi cloud via `.info/connected`.
21. **`js/database/cloudinary-client.js`**
    - **Fungsi:** Klien pengunggah dan pembersih dokumen media Cloudinary.
    - **Logika:** Mencegah penyimpanan API Secret di aplikasi klien. Mengirim permohonan tanda tangan kriptografis ke Worker `/v1/cloudinary/sign`, kemudian mengunggah langsung berkas biner ke REST API Cloudinary menggunakan formulir FormData. Menghapus berkas via `/v1/cloudinary/delete`.
22. **`js/database/repository.js`**
    - **Fungsi:** Lapisan Abstraksi Data (*Data Access Object*) utama untuk entitas aplikasi.
    - **Logika:** Menyediakan API tingkat tinggi untuk CRUD entitas: `getStudents()`, `saveStudent()`, `deleteStudent()`, `getAttendance()`, `saveAttendanceBatch()`, `getGrades()`, `saveGrades()`, `getJournal()`, `getNotes()`, `getSettings()`, `saveSettings()`. Berkomunikasi transparan dengan IndexedDB untuk operasi luring dan menyalurkan pembaruan ke mesin sinkronisasi.
23. **`js/database/sync.js`**
    - **Fungsi:** Orkestrator sinkronisasi dua arah offline IndexedDB dan cloud RTDB.
    - **Logika:** Mengelola antrean penulisan luring (*offline write queue*). Saat perangkat kembali terhubung ke jaringan internet, antrean dieksekusi secara sekuensial dengan resolusi konflik berbasis *timestamp*. Mengaktifkan listener sinkronisasi latar belakang untuk menerima perubahan data dari perangkat guru lain secara instan.

---

### 3.5 Antarmuka Pengguna & Komponen UI (`js/ui/`)
24. **`js/ui/navigation.js`**
    - **Fungsi:** Router SPA berbasis URL Hash.
    - **Logika:** Menangkap event `hashchange`. Memetakan hash (seperti `#dashboard`, `#students`, `#attendance`, `#grades`, `#lps`, dll.) ke pemanggilan `FeatureLoader.loadFeature()`. Memperbarui penanda status menu aktif di sidebar dan menutup menu laci pada perangkat ponsel.
25. **`js/ui/render.js`**
    - **Fungsi:** Template engine ringan manipulasi DOM.
    - **Logika:** Menyediakan fungsi rendering tabel dinamis, pembuat elemen DOM aman dengan escape teks HTML otomatis, dan fungsi penyisipan fragmen dokumen untuk mencegah *layout reflow* berulang.
26. **`js/ui/feedback.js`**
    - **Fungsi:** Komponen umpan balik visual terpadu.
    - **Logika:** Menyediakan fungsi `showToast(message, type)` (sukses, error, info, peringatan), `showConfirmModal({title, message, onConfirm})`, serta pemutar indikator loading global (`showLoading`, `hideLoading`).
27. **`js/ui/date.js`**
    - **Fungsi:** Utilitas penanggalan nasional Indonesia.
    - **Logika:** Mengonversi string tanggal ISO (`YYYY-MM-DD`) menjadi format teks resmi Indonesia (misal: "Senin, 15 September 2026"), perhitungan rentang hari efektif sekolah, dan pemformatan tanggal pada kop rapor serta jurnal mengajar.
28. **`js/ui/theme.js`**
    - **Fungsi:** Manajer tema visual Dark / Light Mode.
    - **Logika:** Membaca preferensi tema dari `localStorage`, menerapkan kelas `dark` pada elemen root `<html>`, dan menyediakan fungsi sakelar (*toggle*) di bilah navigasi.
29. **`js/ui/actions.js`**
    - **Fungsi:** Penangan aksi global aplikasi.
    - **Logika:** Mengikat fungsi tombol logout (dengan konfirmasi pembersihan state sesi), penggantian tahun pelajaran aktif di header, pencetakan dokumen layar via `window.print()`, dan pembersihan cache darurat oleh pengguna.
30. **`js/ui/shell.css`**
    - **Fungsi:** Lembar gaya desain antarmuka shell utama.
    - **Logika:** Mengatur animasi slide sidebar, floating action button (FAB), transisi kartu dashboard, efek transparan backdrop modal dialog, dan aturan media query khusus perangkat layar sempit / ponsel pintar.

---

### 3.6 Layanan Platform Mobile & Utilitas (`js/platform/` & `js/utils/`)
31. **`js/platform/bootstrap.js`**
    - **Fungsi:** Detektor dan inisiator lingkungan jalan (PWA Browser vs APK Native).
    - **Logika:** Memeriksa keberadaan objek global `window.Capacitor` atau `window.cordova`. Jika berjalan sebagai aplikasi native Android, mengaktifkan plugin splash screen, status bar, dan pendengar tombol fisik.
32. **`js/platform/native-back-button.js`**
    - **Fungsi:** Handler tombol "Back" fisik perangkat Android.
    - **Logika:** Mencegah keluarnya aplikasi secara tidak sengaja saat pengguna menekan tombol kembali pada ponsel. Jika modal sedang terbuka, menutup modal; jika berada di sub-halaman, kembali ke Dashboard; jika berada di Dashboard, menampilkan konfirmasi keluar aplikasi.
33. **`js/platform/permission-service.js`**
    - **Fungsi:** Pengelola perizinan perangkat keras Android.
    - **Logika:** Meminta izin akses kamera (`CAMERA`) secara dinamis sebelum pemindai QR presensi dibuka, dan izin penyimpanan (`WRITE_EXTERNAL_STORAGE`) saat mengunduh laporan PDF/Excel pada perangkat Android versi lama.
34. **`js/platform/download-service.js`**
    - **Fungsi:** Layanan abstraksi pengunduhan berkas lintas platform.
    - **Logika:** Pada peramban web, membuat elemen anchor `<a>` sementara dengan `URL.createObjectURL(blob)` dan mengeksekusi `click()`. Pada native Android, menggunakan Capacitor Filesystem API untuk menyimpan berkas langsung ke folder `Downloads` perangkat.
35. **`js/platform/main.js`**
    - **Fungsi:** Pengait modul platform ke siklus hidup global.
36. **`js/services/edge-service.js`**
    - **Fungsi:** Klien jembatan komunikasi HTTP ke Cloudflare Worker Gateway.
    - **Logika:** Mengambil token autentikasi Firebase ID token aktif dari pengguna, menyematkannya pada header `Authorization: Bearer <token>`, dan mengirim permintaan mutasi administratif (`/v1/admin/commit`), pemeriksaan status (`/v1/admin/status`), atau rute Cloudinary. Mengimplementasikan mekanisme penanganan kegagalan jaringan dan pemulihan receipt (memenuhi S05).
37. **`js/utils/sanitize.js`**
    - **Fungsi:** Pustaka sanitasi string HTML.
    - **Logika:** Mencegah serangan injeksi skrip Cross-Site Scripting (XSS). Membersihkan tag HTML berbahaya dari input nama siswa, catatan pembinaan, jurnal, dan modul ajar sebelum dirender ke dalam DOM.

---

### 3.7 Modul Fitur Aplikasi (`features/`)

#### Modul Siswa (`features/students/`)
38. **`features/students/students.html`**
    - **Fungsi:** Template UI manajemen siswa.
    - **Logika:** Memuat tabel daftar siswa kelas, kolom pencarian, filter jenis kelamin, tombol tambah siswa manual, tombol cetak kartu QR, tombol ekspor Excel, dan tombol impor data siswa dari file spreadsheet.
39. **`features/students/students.js`**
    - **Fungsi:** Controller logika data siswa.
    - **Logika:** Melakukan validasi NIS/NISN unik, nama lengkap, jenis kelamin (L/P), dan status aktif. Membaca berkas template Excel siswa via pustaka `xlsx`, mengekstrak data baris secara massal, menyimpannya ke repositori, dan menghasilkan kode QR identitas kartu pelajar siswa menggunakan `qrcodejs`.

#### Modul Presensi (`features/attendance/`)
40. **`features/attendance/attendance.html`**
    - **Fungsi:** Template antarmuka presensi harian.
    - **Logika:** Memuat pemilih tanggal presensi, tombol sakelar cepat ("Hadirkan Semua"), area kamera scanner QR pemindai kartu siswa, tabel daftar siswa dengan tombol pilihan H (Hadir), S (Sakit), I (Izin), A (Alpa), dan panel ringkasan persentase kehadiran bulanan.
41. **`features/attendance/attendance.js`**
    - **Fungsi:** Controller logika presensi kelas.
    - **Logika:** Mengintegrasikan pustaka `html5-qrcode` untuk mengaktifkan kamera ponsel/laptop. Saat kode QR siswa terbaca, mencocokkan ID siswa dan otomatis menetapkan status "Hadir" dengan umpan balik suara beep. Menyimpan data presensi batch secara real-time ke IndexedDB/RTDB.

#### Modul Penilaian (`features/grades/`)
42. **`features/grades/grades.html`**
    - **Fungsi:** Template lembar asesmen Kurikulum Merdeka.
    - **Logika:** Tab pemilihan mata pelajaran (Pendidikan Agama Islam, Bahasa Indonesia, Matematika, IPAS, PJOK, Seni, dll.), pemilih jenis asesmen (Formatif TP atau Sumatif LM), tabel entri nilai dinamis per siswa, dan panel ringkasan nilai rerata.
43. **`features/grades/grades.js`**
    - **Fungsi:** Controller penilaian akademik.
    - **Logika:** Mendukung penambahan Tujuan Pembelajaran (TP) dinamis. Menghitung secara otomatis nilai akhir per lingkup materi dan semester, memetakan skor angka (0-100) ke interval predikat kompetensi (Sangat Baik, Baik, Cukup, Perlu Bimbingan), dan menyimpan matriks penilaian ke database.

#### Modul Jurnal Pembelajaran (`features/journal/`)
44. **`features/journal/journal.html`**
    - **Fungsi:** Template buku jurnal harian pembelajaran guru.
    - **Logika:** Formulir entri tanggal, mata pelajaran, materi pokok, TP yang diajarkan, metode pembelajaran, kendala/evaluasi kelas, serta tabel riwayat jurnal mengajar.
45. **`features/journal/journal.js`**
    - **Fungsi:** Controller jurnal mengajar.
    - **Logika:** Menghubungkan materi dengan daftar TP yang tersimpan di sistem, menyimpan catatan jurnal, dan mengekspor riwayat jurnal ke format PDF cetak berkala untuk laporan supervisi kepala sekolah.

#### Modul Catatan Siswa (`features/notes/`)
46. **`features/notes/notes.html`**
    - **Fungsi:** Template buku catatan anekdot dan pembinaan siswa.
    - **Logika:** Memuat formulir pencatatan kejadian perilaku siswa (positif, pembinaan, prestasi), tingkat urgensi catatan, dan daftar rekam jejak bimbingan per siswa.
47. **`features/notes/notes.js`**
    - **Fungsi:** Controller catatan perilaku.
    - **Logika:** Mengelompokkan riwayat catatan per siswa secara kronologis, memungkinkan owner dan guru kelas memberikan tindak lanjut pada workspace sendiri; VIP tidak memiliki menu Catatan, serta mencetak rekap pembinaan saat pertemuan orang tua murid.

#### Modul Generator Administrasi & Desain Modul Ajar (`features/gadm/`)
48. **`features/gadm/gadm-curriculum-2026.js`**
    - **Fungsi:** Standar referensi kurikulum nasional 2026.
    - **Logika:** Memuat struktur Capaian Pembelajaran (CP), alur tujuan pembelajaran (ATP), dan pemetaan fase B (Kelas 3-4) untuk seluruh mata pelajaran sekolah dasar.
49. **`features/gadm/gadm-kb.js`**
    - **Fungsi:** Knowledge Base instruksional pendidikan.
    - **Logika:** Kamus Taksonomi Bloom revisi (Kata Kerja Operasional C1-C6), katalog model pembelajaran kooperatif/PJBL/PBL/Inkuiri, media pembelajaran kontekstual, dan rubrik asesmen autentik.
50. **`features/gadm/gadm-storage.js`**
    - **Fungsi:** Penyimpanan persistensi draf rancangan modul ajar.
    - **Logika:** Menyimpan dokumen rancangan RPP/Modul Ajar ke IndexedDB lokal sehingga proses penyusunan yang belum selesai tidak hilang saat browser tertutup.
51. **`features/gadm/gadm-docx.js`**
    - **Fungsi:** Mesin generator berkas dokumen Microsoft Word (`.docx`).
    - **Logika:** Memanfaatkan `JSZip` untuk memanipulasi struktur arsip OpenXML. Membangun berkas `word/document.xml`, tabel styling, kop resmi SDIT Bina Madani, dan menyisipkan hasil perumusan modul ajar menjadi file dokumen Word asli yang siap diedit di Microsoft Word.
52. **`features/gadm/gadm-engine.js`**
    - **Fungsi:** Mesin perumus dan kalkulator alokasi jam tatap muka modul ajar.
    - **Logika:** Menghitung alokasi waktu per pertemuan (misal $2 \times 35$ menit), menyusun langkah-langkah kegiatan pembelajaran (Pendahuluan, Kegiatan Inti berdiferensiasi, Penutup), dan menyusun pertanyaan pemantik secara otomatis.
53. **`features/gadm/gadm.css`**
    - **Fungsi:** Gaya visual tata letak formulir multi-langkah dan pratinjau dokumen GADM.
54. **`features/gadm/gadm.html`**
    - **Fungsi:** Template antarmuka wizard builder GADM.
    - **Logika:** Formulir step-by-step perancangan modul ajar, pemilih tema, tombol aktivasi OCR kamera buku, dan panel pratinjau dokumen langsung.
55. **`features/gadm/gadm.js`**
    - **Fungsi:** Controller interaksi modul GADM.
    - **Logika:** Menghubungkan input guru dengan `gadm-engine.js`, mengintegrasikan pemindaian OCR teks buku pegangan melalui Tesseract WASM, dan memicu unduhan berkas `.docx` melalui `download-service.js`.

#### Modul Generator Rapor LPS & BLP (`features/lps/`)
56. **`features/lps/lps-reference-data.js`**
    - **Fungsi:** Kamus referensi batas predikat nilai rapor dan pemetaan frasa kompetensi.
57. **`features/lps/lps-core.js`**
    - **Fungsi:** Mesin generator narasi deskripsi capaian kompetensi rapor otomatis.
    - **Logika:** Menganalisis nilai siswa di setiap TP. Mengidentifikasi TP dengan nilai tertinggi (capaian optimal) dan TP dengan nilai terendah (perlu bimbingan lanjutan). Merumuskan kalimat deskripsi naratif otomatis yang baku dan gramatikal sesuai pedoman Kurikulum Merdeka.
58. **`features/lps/lps-excel.js`**
    - **Fungsi:** Generator lembar kerja Excel (`.xlsx`) rapor berformat resmi.
    - **Logika:** Menggunakan pustaka `exceljs` untuk mengisi template resmi `LPS KLS 2 contoh.xlsx` dan `BLP contoh.xlsx`. Menerapkan rumus formula penjumlahan, rata-rata, garis batas tabel (*border*), penggabungan sel (*merge cells*), font, dan layout cetak halaman.
59. **`features/lps/lps-print.js`**
    - **Fungsi:** Handler pencetakan langsung dan konversi PDF rapor.
    - **Logika:** Merender pratinjau rapor ke elemen kanvas cetak A4, menyematkan nomor halaman, kop sekolah, tanda tangan kepala sekolah & guru kelas, dan mengekspor ke file PDF menggunakan `html2pdf`.
60. **`features/lps/lps.css`**
    - **Fungsi:** Aturan CSS presisi tinggi untuk pratinjau dan pencetakan rapor A4 (margins, page breaks, font table alignment).
61. **`features/lps/lps.html`**
    - **Fungsi:** Template antarmuka generator rapor LPS/BLP.
    - **Logika:** Pemilih siswa, pemilih jenis laporan (LPS Tengah Semester atau BLP Rapor Akhir Semester), kolom catatan wali kelas, tombol ekspor Excel, dan tombol cetak PDF.
62. **`features/lps/lps.js`**
    - **Fungsi:** Controller utama modul laporan perkembangan siswa.
    - **Logika:** Mengagregasi data siswa, data nilai dari modul grades, dan data presensi harian menjadi satu bundel model data laporan utuh sebelum disalurkan ke mesin Excel atau PDF.

#### Modul Galeri Dokumen & LKPD (`features/documents/`)
63. **`features/documents/documents.html`**
    - **Fungsi:** Template galeri dokumen dan LKPD kelas.
    - **Logika:** Antarmuka unggah berkas (PDF, gambar tugas siswa, lembar LKPD), grid kartu berkas digital, filter kategori dokumen, dan tombol pratinjau berkas.
64. **`features/documents/documents.js`**
    - **Fungsi:** Controller manajemen dokumen digital.
    - **Logika:** Memeriksa ukuran berkas (maksimal 5-8 MB sesuai kebijakan aset), meminta izin dan tanda tangan unggah ke Worker, mengirim berkas ke Cloudinary, dan menyimpan metadata public URL berkas ke dalam RTDB.

#### Modul Pencadangan & Pemulihan (`features/backup/`)
65. **`features/backup/backup-core.js`**
    - **Fungsi:** Mesin pembuat dan pemverifikasi berkas arsip database.
    - **Logika:** Mengekstrak seluruh entitas dari IndexedDB, menghitung checksum SHA-256 integritas payload, mengompresi struktur data ke dalam format chunks string aman (`json-chunks-v1`) untuk mencegah penghapusan objek kosong oleh RTDB, dan menyediakan parser pembaca arsip versi lama maupun baru.
66. **`features/backup/backup.js`**
    - **Fungsi:** Controller antarmuka backup dan restore.
    - **Logika:** Menyediakan tombol unduh backup `.json` terstruktur dengan scope dan integritas, tombol unggah file restore, modal konfirmasi verifikasi, dan pengiriman mutasi restore melalui gateway edge. JSON ini tidak otomatis terenkripsi; jangan menyatakan proteksi enkripsi yang tidak diimplementasikan.

#### Modul Pengaturan & Profil (`features/settings/`)
67. **`features/settings/settings.html`**
    - **Fungsi:** Template formulir pengaturan sekolah dan aplikasi.
    - **Logika:** Input Nama Sekolah (`SDIT Bina Madani`), NPSN, Alamat, Nama Kepala Sekolah, NIP, Nama Guru Kelas, NIP, Tahun Pelajaran aktif, Semester, Titimangsa Rapor, dan opsi reset cache.
68. **`features/settings/settings.js`**
    - **Fungsi:** Controller konfigurasi profil sekolah.
    - **Logika:** Melakukan validasi format teks, menyimpan pembaruan identitas sekolah ke RTDB di bawah node `workspaces/{ws}/settings/identity`, dan menyinkronkannya ke seluruh modul rapor dan modul ajar.

#### Modul Dashboard (`features/dashboard/`)
69. **`features/dashboard/dashboard.html`**
    - **Fungsi:** Template beranda ringkasan informasi eksekutif.
    - **Logika:** Kartu statistik total siswa aktif (L/P), persentase kehadiran hari ini, status kelengkapan nilai mata pelajaran, grafik tren presensi mingguan, dan kartu pintasan aksi cepat (*quick actions*).
70. **`features/dashboard/dashboard.js`**
    - **Fungsi:** Controller dashboard.
    - **Logika:** Mengambil agregat data dari `StateStore`, mengalkulasi statistik secara instan di memori klien, merender diagram visual, dan memperbarui informasi secara otomatis saat terjadi event perubahan data.

#### Modul Penjelajah Arsip (`features/archive/`)
71. **`features/archive/archive.js`**
    - **Fungsi:** Controller penjelajah data tahun ajaran lampau (*Academic Year Archive Explorer*).
    - **Logika:** Mengakses simpul `workspaces/{ws}/archives/{yearId}`, memungkinkan guru kelas membuka kembali rekapitulasi nilai dan presensi siswa dari tahun ajaran sebelumnya dalam mode hanya-baca (*read-only*) tanpa merusak data tahun ajaran berjalan.

#### Modul Penyetelan Ulang Tahunan (`features/reset/`)
72. **`features/reset/reset.js`**
    - **Fungsi:** Controller penyetelan ulang tahunan (*Annual Reset*).
    - **Logika:** Menampilkan peringatan bahaya tingkat tinggi (*high-risk alert*). Menuntut konfirmasi frasa verifikasi sebelum menghapus koleksi nilai, presensi, dan jurnal untuk memulai tahun pelajaran baru. Mengeksekusi mutasi melalui Worker edge dengan receipt server resmi.

---

### 3.8 Backend Cloudflare Worker & Operasi Administratif (`edge/`)
73. **`edge/worker.js`**
    - **Fungsi:** Titik masuk tunggal (*Single Entry Point*) Cloudflare Worker `simni-assets-gateway`.
    - **Logika:** Mengamankan API backend:
      - CORS Handler ketat: hanya mengizinkan origin resmi (`https://admin-kelas-3a.web.app`, `https://admin-kelas-3a.firebaseapp.com`, `https://simni.my.id`). Permintaan dari origin lain ditolak dengan status HTTP 400.
      - Autentikasi: Memverifikasi Firebase ID Token JWT klien menggunakan Google Public Certs (`securetoken@system.gserviceaccount.com`).
      - Otorisasi: Memeriksa profil pengguna di RTDB via Service Account token. Autentikasi mengakui `superuser`, `vip`, dan `teacher`; setiap route menerapkan izin spesifik. Route Cloudinary hanya mengizinkan owner superuser.
      - Penandatanganan Cloudinary: Mengkalkulasi signature HMAC-SHA1 untuk upload/delete aset dengan pembatasan folder workspace dan tahun ajaran.
      - Routing administratif: Menyalurkan rute `/v1/admin/commit` dan `/v1/admin/status` ke `admin-operations.js`.
74. **`edge/admin-operations.js`**
    - **Fungsi:** Mesin pemroses mutasi administratif server dengan jaminan integritas (memenuhi S05).
    - **Logika:** Menggunakan pola *Two-Phase Commit*:
      1. Fase 1: Memeriksa reservasi operation ID dan marker nonce yang dipasang klien di RTDB.
      2. Fase 2: Menjalankan pembaruan data pengguna menggunakan identitas ID Token pengguna (sehingga aturan database RTDB tetap memvalidasi schema).
      3. Fase 3: Menulis receipt server resmi berstatus `committed` dengan otoritas `server-executed-rtdb-ack` di bawah simpul `auditLogs/{ws}/{opId}` dan menghapus marker nonce sementara.
      4. Idempotensi: Jika request dikirim ulang dengan operation ID yang sama, mengembalikan receipt yang sudah ada (`replayed: true`) tanpa mengulang mutasi data.
75. **`edge/wrangler.jsonc`**
    - **Fungsi:** Konfigurasi infrastruktur Cloudflare Worker.
    - **Logika:** Menentukan nama Worker (`simni-assets-gateway`), skrip utama (`worker.js`), tanggal kompatibilitas (`2026-08-27`), flag `nodejs_compat`, observabilitas log, dan variabel lingkungan publik (`CLOUDINARY_CLOUD_NAME`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, dll.).

---

### 3.9 Basis Data Cloud & Skrip Verifikasi Rilis (`firebase/` & `scripts/`)
76. **`firebase/database.rules.production.json`**
    - **Fungsi:** Aturan keamanan (*Security Rules*) Firebase Realtime Database produksi.
    - **Logika:** 
      - Root `.read: false`, `.write: false` secara default.
      - `auditLogs/{ws}/{opId}/.write: false` $
ightarrow$ Klien dilarang keras menulis atau merekayasa log audit sendiri.
      - `administrativeOperations/.read: false`, `.write: false` $
ightarrow$ Klien dilarang mengakses tabel reservasi internal server.
      - `administrativeCommitMarkers/{ws}/{opId}` $
ightarrow$ Hanya dapat ditulis sekali (`!data.exists() && newData.exists()`) dengan validasi format nonce 36-karakter.
      - Isolasi workspace ketat: Setiap akun membaca/menulis hanya workspace aktif yang ditetapkan server; owner mempertahankan `ws_superuser`, VIP `ws_pjok`, guru undangan menggunakan workspace kelas masing-masing.
77. **`scripts/verify-hosting.mjs`**
    - **Fungsi:** Gerbang audit pra-deploy (*Pre-deploy Enforcer*).
    - **Logika:** Membaca `public/build-manifest.json`, mencocokkan versi dengan authority source dan `package.json`, memverifikasi build ID serta SHA-256 seluruh berkas manifest. Baseline 4.7.2 memiliki 104 berkas dengan build ID `844d010acb53f5d8d0f1eac9a1baf72b7bd78d4bec3614e47f6ff51242bd5261`; hasil multi-role wajib memakai versi/build ID dan jumlah berkas hasil build-nya sendiri. Jika ada modifikasi artefak tanpa build, deployment dibatalkan.
78. **`scripts/build-hosting.mjs`**
    - **Fungsi:** Kompilator bundel rilis Hosting.
    - **Logika:** Menyalin seluruh berkas sumber aplikasi dari direktori kerja ke dalam direktori `public/`, menyematkan meta tag URL edge resmi, mengecualikan berkas tes QA dan berkas chat usang, menghitung checksum SHA-256 seluruh berkas, dan menerbitkan `build-manifest.json`.

---


## 4. STRUKTUR MENU & MATRIKS HAK AKSES FINAL

### 4.1 Tiga role izin, tiga jalur identitas

| Identitas | Role internal | Jalur masuk | Workspace | Kelas |
|---|---|---|---|---|
| Pemilik SIMNI `unggaran.sditbm@gmail.com` | `superuser` | Login email/password existing | `ws_superuser` | `3A` saat awal |
| Guru PJOK existing `anur.auliya01@gmail.com` | `vip` | Login email/password existing; **bukan undangan** | `ws_pjok` | `PJOK` |
| Guru wali kelas tambahan | `teacher` | Pendaftaran dengan undangan milik slot kelas | Sesuai tabel slot | Sesuai assignment |

`sikalumant@gmail.com` adalah akun administrasi Firebase deployment, bukan identitas superuser aplikasi. Jangan menukarnya. Tidak ada pilihan superuser atau VIP pada form daftar. Label form adalah **Pilih Kelas / Penugasan**, bukan daftar privilege.

### 4.2 Matriks fitur

Semua akses akademik berarti **workspace sendiri**. Hak superuser untuk manajemen akun/rollover bukan izin browser membaca seluruh data akademik semua guru.

| Fitur / aksi | Superuser | VIP existing | Teacher undangan |
|---|---|---|---|
| Dashboard, tema, status sinkronisasi | Ya | Ya | Ya |
| Data siswa, impor/ekspor, kartu QR | Ya | Ya pada workspace PJOK existing | Ya |
| Presensi tanggal hari ini/lampau | Ya | Ya | Ya |
| TP, Bab, nilai | Semua mapel kelasnya | Mapel PJOK | Semua mapel kelasnya |
| Jurnal dan GADM | Ya | Ya | Ya |
| Catatan siswa | Ya | Tidak | Ya |
| LPS/BLP, template editable, unduh Excel/cetak | Ya | Tidak | Ya |
| Pengaturan identitas kelas sendiri | Ya | Ya sesuai perilaku existing | Ya |
| Backup JSON dan restore tervalidasi workspace sendiri | Ya | Ya, pertahankan kontrak existing | Ya |
| Arsip tahun sendiri, baca arsip sendiri, tandai siap rollover | Ya | Pertahankan alur readiness existing | Ya |
| Reset data operasional langsung | Ya, workspace sendiri | Tidak | Tidak |
| Pergantian tahun global | Owner saja | Tidak | Tidak |
| Kelola akun, slot, undangan, penugasan | Owner saja | Tidak | Tidak |
| Menu File, Dokumen/LKPD, metadata dan aset Cloudinary | **Owner saja** | **Tidak** | **Tidak** |
| Panggilan Cloudinary sign/delete dan unggahan foto/logo cloud | **Owner saja** | **Tidak** | **Tidak** |

Ekspor lokal LPS/BLP, GADM DOCX, kartu siswa dan backup **bukan** menu File/Dokumen Cloudinary. Ekspor tersebut tetap tersedia mengikuti izin fitur. Teacher/VIP memakai placeholder foto/default logo atau aset sekolah statis yang dibundel; jangan menyelundupkan upload Cloudinary lewat Pengaturan atau Data Siswa.

Role feature dipetakan ke view existing: `dashboard`, `siswa`, `presensi`, `nilai`, `jurnal`, `catatan`, `dokumen`, `lps`, `gadm`, `pengaturan`. Jangan mengganti semua ID view menjadi nama Inggris hanya karena nama folder source berbahasa Inggris. Tambahkan view `kelola-akun` khusus owner serta halaman autentikasi `daftar` dan `verifikasi-email`.

### 4.3 Daftar slot yang deterministik

| Slot | classId | workspaceId | Kondisi awal |
|---|---|---|---|
| `kelas-1a` | `1A` | `ws_kelas_1a` | Tersedia untuk undangan |
| `kelas-1b` | `1B` | `ws_kelas_1b` | Tersedia untuk undangan |
| `kelas-2a` | `2A` | `ws_kelas_2a` | Tersedia untuk undangan |
| `kelas-2b` | `2B` | `ws_kelas_2b` | Tersedia untuk undangan |
| `kelas-3a` | `3A` | `ws_superuser` | Terisi owner existing; tidak dapat diambil lewat daftar |
| `kelas-3b` | `3B` | `ws_kelas_3b` | Tersedia untuk undangan |
| `kelas-4a` | `4A` | `ws_kelas_4a` | Tersedia untuk undangan |
| `kelas-4b` | `4B` | `ws_kelas_4b` | Tersedia untuk undangan |
| `kelas-5a` | `5A` | `ws_kelas_5a` | Tersedia untuk undangan |
| `kelas-5b` | `5B` | `ws_kelas_5b` | Tersedia untuk undangan |
| `kelas-6a` | `6A` | `ws_kelas_6a` | Tersedia untuk undangan |
| `kelas-6b` | `6B` | `ws_kelas_6b` | Tersedia untuk undangan |

Total maksimal: 12 wali kelas termasuk owner, ditambah 1 VIP PJOK existing, yaitu 13 akun aktif sesuai assignment. Form daftar menawarkan maksimal 11 slot kelas baru. Tidak membuat akun tambahan untuk kelas 3A atau PJOK. Tidak membuat database Firebase baru per kelas.

## 5. HALAMAN, FORM, TOMBOL, DAN LIFECYCLE PENDAFTARAN

### 5.1 Halaman login existing
- Pertahankan susunan, warna, ikon, tombol masuk, reset password dan feedback existing.
- Tambahkan tautan `Daftar Guru` di bawah tombol masuk. Klik memuat halaman daftar dengan komponen visual SIMNI yang sama.
- Saat seluruh slot terisi, ganti tautan dengan status `Pendaftaran guru sudah penuh`. Login existing dan reset password tetap berfungsi.
- Owner dapat menutup pendaftaran sementara; pesan menjadi `Pendaftaran guru sedang ditutup`. Penuh dan ditutup manual adalah keadaan berbeda.
- Offline: login/sesi cache existing mengikuti kontrak lama; pendaftaran baru dinonaktifkan dengan pesan `Pendaftaran memerlukan koneksi internet`. Jangan menyimpan password/undangan dalam antrean offline.

### 5.2 Halaman daftar
Field berurutan: **Nama lengkap guru**, **Email**, **Kata sandi**, **Ulangi kata sandi**, **Pilih kelas/penugasan**, **Kode undangan**. Tautan undangan dapat mengisi kelas dan kode otomatis; kelas terkunci pada slot undangan tersebut. Daftar umum tanpa undangan tetap menunjukkan slot tersedia, tetapi tidak dapat mengaktifkan akun tanpa kode undangan sah.

Validasi: nama dipangkas di tepi, 2–100 karakter, menerima nama Unicode tanpa membatasi hanya huruf Latin; email dipangkas dan dinormalisasi lower-case untuk pencocokan; password tidak dipangkas, minimal 12 karakter dan mengikuti kebijakan Firebase yang lebih ketat bila ada; konfirmasi harus sama; classId dipilih dari slot server; jangan menerima role/workspaceId dari hidden input sebagai authority. Render nama melalui textContent/escaping, bukan HTML mentah.

Tombol `Daftar`: validasi lokal → set disabled/aria-busy dan label `Memproses…` → validasi undangan/slot melalui server → buat akun Firebase Auth email/password → kirim verifikasi email → tampilkan tahap verifikasi. Jangan menampilkan `Pendaftaran berhasil` pada tahap Auth saja. Jika email sudah ada, arahkan pengguna ke login/reset password untuk melanjutkan, bukan membuat UID kedua. Firebase Auth account yang belum mendapat profil aktif tidak memiliki akses RTDB akademik.

Tombol `Tampilkan kata sandi` hanya mengganti tipe input dan aria-label; jangan menyalin password ke log atau menyimpannya ke Web Storage. Tombol `Kembali ke Masuk` membatalkan UI, membersihkan password dari memori/form, bukan menghapus akun Firebase yang telah terbuat.

### 5.3 Verifikasi email dan aktivasi
Halaman menampilkan email tujuan, tombol `Kirim ulang email verifikasi`, `Saya sudah verifikasi`, dan `Kembali ke Masuk`. Kirim ulang memiliki cooldown UI 60 detik ditambah rate limit penyedia; tidak menjamin email terkirim hanya karena timer berjalan.

`Saya sudah verifikasi`: reload user dan refresh ID token → server memeriksa claim `email_verified` → verifikasi ulang undangan/slot → reservasi slot atomik → provisioning workspace/profil/assignment → finalisasi slot → muat ulang konteks → tampilkan `Akun guru aktif. Selamat datang di kelas …` dan buka dashboard.

Slot **tidak ditahan selama menunggu email**. Pengguna yang lambat verifikasi tidak boleh mengunci kelas. Reservasi 15 menit hanya terjadi saat server mulai aktivasi. Jika slot sudah diambil pada saat verifikasi selesai, tampilkan `Kelas ini sudah terisi. Hubungi pemilik SIMNI.`; akun Auth tetap tidak memiliki akses akademik. Jangan otomatis menempatkannya di kelas lain.

### 5.4 Penanganan error dan retry
Status UI: idle → validating → creating-auth → awaiting-email → activating → active, dengan cabang recoverable-error. Error jaringan tidak boleh dianggap sukses atau gagal permanen tanpa pemeriksaan status. Aktivasi membawa operationId stabil; retry memeriksa operasi yang sama. Setelah reload, kelanjutan didasarkan UID Auth dan status server, bukan token undangan mentah yang disimpan localStorage.

HTTP 400: field/format tidak valid; 401: belum login/token tidak sah; 403: undangan/identitas/izin ditolak; 409: slot terisi atau konflik aktivasi; 429: rate limit. Error tidak menampilkan stack trace atau nilai secret kepada pengguna. Pesan error field dekat input dan dapat dibaca screen reader; error umum tidak menghilangkan isi nama/email.

### 5.5 Halaman Kelola Akun khusus owner
Tabel: kelas, nama guru, email, status slot, status akun, tahun aktif, aksi. Filter kelas/status; daftar tidak menampilkan password atau token mentah. Tombol halaman: `Buat Undangan`, `Tutup Pendaftaran` / `Buka Pendaftaran`. Tombol per baris: `Salin Undangan` saat token baru tersedia, `Cabut Undangan`, `Nonaktifkan Akun`, `Aktifkan Kembali`, `Ganti Guru` sesuai kondisi.

Modal undangan: kelas kosong, email guru tujuan, berlaku hingga (default 7 hari; maksimal 30 hari), tombol `Buat` dan `Batal`. Server membuat token acak kriptografis 32 byte dan menyimpan hanya hash SHA-256. Token mentah ditampilkan satu kali setelah sukses; salin menggunakan Clipboard API dan feedback. Jangan mengirim email atas nama pengguna secara otomatis. Token di URL menggunakan fragment dan dihapus dengan replaceState segera setelah dibaca; jangan dicatat analytics/log. Jika hilang, cabut undangan dan buat ulang.

Modal nonaktif: ringkasan akun/kelas, alasan opsional, konfirmasi. Nonaktif tidak membuka slot: data dan penugasan tetap ada sampai owner menjalankan Ganti Guru. Owner dan VIP existing tidak dapat diganti/dihapus dari menu guru undangan ini. Hindari tombol hapus permanen data kelas.

Modal Ganti Guru: kelas, akun lama, email guru baru; jelaskan bahwa data kelas tetap dan akses lama dicabut. Server menonaktifkan assignment lama dahulu, menambah assignmentRevision dan membuka undangan pengganti untuk workspace sama. Akun lama tidak aktif kembali lewat restore cache. Nama pencatat lama pada jurnal/audit dipertahankan.

### 5.6 Lifecycle seluruh modal
Gunakan manager `js/ui/navigation.js`: buka hanya setelah izin dan fragmen tersedia, simpan fokus pemicu, focus trap, background inert, Escape menutup layer teratas, restore inert/fokus ketika ditutup. Gunakan modal responsif maksimal tinggi viewport dengan scroll konten; keyboard mobile tidak menutupi aksi utama. Klik simpan ganda tidak menghasilkan dua request. Menutup modal ketika operasi telah dikirim tidak berarti membatalkan mutasi server; tampilkan status yang dapat diperiksa kembali. Overlay tidak boleh membuat toast sukses berkedip/hilang sebelum terbaca.

## 6. STRUKTUR DATABASE DAN KONTRAK ISOLASI FINAL

### 6.1 Profil dan assignment
Tetap satu Firebase RTDB. Branch `users`, `workspaces`, `assignments`, `rollovers` dan audit existing dipertahankan. Tambahkan cabang terarah berikut:
```text
system/academicYear/activeYearId
system/registration/{enabled,schemaVersion}
users/{uid}
assignments/{academicYearId}/{uid}
registrationSlots/{slotId}
registrationOperations/{uid}/{operationId}
accountAudit/{operationId}
workspaces/{workspaceId}/settings/{identity,lpsV2}
workspaces/{workspaceId}/academicYears/{yearId}/...
workspaces/{workspaceId}/archives/...
administrativeOperations/{workspaceId}/{operationId}
administrativeCommitMarkers/{workspaceId}/{operationId}
auditLogs/{workspaceId}/{operationId}
```

Profil aktif: `uid`, `email`, `displayName`, `role`, `workspaceId`, `classId`, `activeAcademicYearId`, `status`, `assignmentRevision`, `createdAt`, `updatedAt`. Timestamp server berupa epoch milidetik. `role=teacher` hanya boleh classId `^[1-6][AB]$`, workspace tepat sesuai registry slot. `uid` harus cocok dengan path/Auth; classId/role/workspace tidak dapat diubah pengguna sendiri. Status final akun: active/disabled/revoked. Record operasi menangani provisioning; akun yang belum memiliki profil active ditolak.

Assignment tahunan memuat UID, role, workspace, kelas, tahun, revision, status, assignedAt dan assignedBy. Owner/VIP lama yang belum punya revision dibaca sebagai revision 1 selama migrasi, lalu dibakukan server tanpa mengganti UID, workspace atau data. Assignment harus cocok dengan profil aktif sebelum akses data diberikan.

Slot menyimpan `slotId`, `classId`, `workspaceId`, `status` (available/reserved/occupied), `assignedUid` bila occupied, dan reservation berisi UID/operationId/expiry jika reserved. Undangan dalam slot menyimpan `tokenHash`, `email`, `expiresAt`, `revokedAt`, `consumedAt`; field kosong dihilangkan, jangan bergantung pada objek kosong yang dipertahankan RTDB. Slot 3A dilindungi sebagai system-owned. PJOK tidak berada dalam daftar slot pendaftaran kelas.

### 6.2 Atomisitas aktivasi dan pemulihan
1. Server memverifikasi ID token dan email verified; token undangan harus cocok hash/email/slot/masa berlaku.
2. Jalankan transaksi CAS pada **record slot yang sama**, termasuk pembacaan undangan dan status slot. Jika occupied UID lain, tolak. Jika reserved UID/operationId sama, lanjut idempotent. Jika reservation lain masih berlaku, konflik. Reservation kedaluwarsa hanya direbut setelah memeriksa bahwa profil aktif/hasil final belum terpasang.
3. Simpan operation record privat berisi UID/slot/phase/expiry. Identitas operasi bertahan di server untuk pemulihan; jangan menyimpan password/ID token/undangan mentah.
4. Buat assignment/profil dan metadata workspace menggunakan nilai server. Jangan overwrite siswa/nilai/settings workspace yang sudah ada. Pada kelas baru, sediakan metadata schema dan default identitas kelas; koleksi kosong dibaca sebagai `{}` tanpa menulis placeholder siswa.
5. Sebelum final commit, CAS slot dari reservation milik UID/operationId tersebut ke `reservation.phase=finalizing`. Transisi hanya berhasil satu kali pada revision slot yang tepat. Reservation pada fase finalizing tidak boleh direbut atau dilepas karena expiry; owner action harus menunggu penyelesaian/recovery operasi yang sama. Sesudah fence ini diperoleh, finalisasi profil active, assignment active, slot occupied, konsumsi undangan dan operation completed melalui satu multi-location update RTDB. Jika writer mati setelah fence, retry/recovery operationId yang sama melanjutkan final commit; tidak membuka slot bagi UID lain. Semua writer slot, termasuk owner, wajib mengikuti protokol ini. Jangan hanya melakukan GET ownership lalu PATCH tanpa fence, karena ada celah balapan.
6. Jika proses terputus, endpoint status/provision retry mengembalikan fase yang benar dan melanjutkan untuk UID yang sama. Jangan otomatis menghapus akun Auth yang mungkin sudah sah. Jika tidak dapat membuktikan penyelesaian, status tetap pending untuk pemeriksaan owner; tidak ada pemberian akses sementara.

Firebase Auth create dan RTDB update bukan satu transaksi. Server menolak penulisan akademik hingga provisioning selesai. Antisipasi pemanggilan ulang, koneksi putus, undangan dicabut, dan dua pengguna serentak sebagai alur wajib, bukan edge case opsional.

### 6.3 Rules akses
- Default deny. Public **tidak** membaca seluruh `users`, `registrationSlots`, operation, atau invitation.
- Daftar slot publik dilayani endpoint server dengan whitelist field classId/slotId/availability, tanpa email/nama/UID/token hash.
- Profil: pengguna membaca profil sendiri; perubahan role/workspace/status/revision/assignment hanya server terotorisasi. Owner manajemen lewat endpoint, bukan membuka `.write=true` pada seluruh users.
- Workspace read/write: auth sah, profil active, assignment cocok, workspace path sama, tahun sesuai, izin koleksi sesuai matrix. Validasi field data lama tetap dipertahankan.
- Owner tetap dibatasi pada workspace akademik sendiri untuk browser normal. Operasi sistem lintas workspace hanya endpoint owner yang memvalidasi scope, readiness dan audit.
- Metadata documents hanya owner canonical di ws_superuser. VIP/teacher ditolak meskipun memanggil RTDB REST langsung.
- `registrationOperations`, invitation, audit administratif privat: klien tidak menulis langsung. UID/auth.email dari token, bukan body.
- Storage lokal tidak pernah dianggap otoritas role. Rules tidak mengandalkan menu tersembunyi atau parameter frontend.

### 6.4 Siklus tahun dan pergantian guru
Kelas baru bergabung ke activeAcademicYearId server, tidak mengambil tahun dari komputer pengguna. Jangan menggunakan array dua email untuk rollover. Owner melihat readiness seluruh workspace aktif yang ditugaskan; satu workspace belum siap menyebabkan rollover ditolak dengan daftar kekurangan.

Teacher dapat membuat arsip workspace sendiri melalui validasi dan receipt server agar dapat menyatakan readiness. VIP mempertahankan mekanisme readiness existing. Readiness terkait archiveHash, UID, workspace, tahun dan revision; perubahan data sesudah arsip membatalkan kesiapan atau mewajibkan pemeriksaan ulang sebelum rollover. Jangan mengosongkan tahun lama hanya karena flag lama `verified=true` masih ada.

Rollover mengunci aktivasi/ganti assignment sementara. Ambil registry assignment dan revision yang konsisten, pastikan semua backup terverifikasi, proses seluruh workspace aktif, simpan receipt. Jika melebihi batas payload/runtime, tolak sebelum perubahan dan laporkan; jangan membagi diam-diam menjadi partial commit yang tampil sukses. Semua guru tetap di kelasnya pada tahun baru; tidak otomatis berpindah mengikuti siswa. Owner/VIP mempertahankan workspace lama. Histori attribution tidak berubah.

## 7. CACHE OFFLINE, SINKRONISASI, DAN PENGECEKAN SESI

### 7.1 Scope lokal
Pertahankan IndexedDB/cache existing dengan scope UID + role + workspaceId + classId + academicYearId; tambahkan assignmentRevision pada signature sesi dan scope baru. Cache lama owner/VIP dibaca melalui adapter revision 1, tidak dipurge massal. Teacher belum pernah login online tidak mendapat akses offline.

Setiap write queue menyimpan immutable scope asal. Saat flush: bandingkan auth UID, profil aktif, workspace, tahun dan revision. Ketidakcocokan menahan item untuk pemulihan akun asal; jangan menulisnya ke workspace akun yang sekarang. Background callback/listener harus ditolak jika generation/signature berubah. Hindari menghapus pending queue hanya karena logout.

### 7.2 Batas pencabutan offline
Pencabutan akses ditegakkan segera pada request cloud berikutnya oleh rules/server. Perangkat yang benar-benar offline tidak bisa menerima perubahan status secara instan. Untuk guru undangan, lease offline adalah 24 jam sejak validasi online terakhir; setelah habis, data akademik disembunyikan sampai revalidasi. Clock mundur dari waktu terakhir diketahui memerlukan online. Lease bukan perlindungan terhadap pemilik perangkat yang memodifikasi kode/browser storage; jangan menjanjikan remote wipe atau pencabutan data yang sudah diekspor.

Owner/VIP mempertahankan perilaku offline existing agar perluasan tidak menjadi perubahan login lama. Ketika online kembali, semua role revalidasi status sebelum flush. Data cache yang ditahan tetap terlindungi dari cleanup otomatis sampai ada keputusan pemulihan yang sah.

### 7.3 Performa
Tidak memasang listener seluruh `workspaces` atau `users` untuk guru. Listener hanya workspace/tahun/koleksi aktif; pagination/range-key existing dipertahankan. Daftar slot hanya 12 item, satu request saat halaman daftar dibuka dan refresh sebelum aktivasi. Kelola akun owner mengambil metadata ringkas, bukan semua siswa/nilai tiap kelas.

Pertahankan batas snapshot lokal 32 MiB, payload cache 96 MiB, SW runtime 64 entry/16 MiB/7 hari pada baseline. Request Auth/registration/admin/sign/delete dan token tidak masuk cache SW. Jangan menambah library framework hanya untuk form daftar.

## 8. FIREBASE, CLOUDINARY, DAN HOSTING

### 8.1 Firebase Authentication
Gunakan Auth email/password existing. Provider, authorized domains dan action URL verifikasi/reset harus sesuai domain Hosting. Verifikasi email wajib untuk aktivasi teacher baru; tidak mengubah login VIP menjadi invitation flow. Endpoint publik rate limited; API key Firebase web bukan secret dan tidak cukup untuk melewati rules. Jangan menganggap menutup tombol daftar dapat mencegah semua pembuatan akun Auth melalui API; yang dijamin ditutup adalah aktivasi akun SIMNI dan akses datanya. Unassigned Auth user tidak memperoleh workspace.

Service account server memiliki akses administratif minimum yang dibutuhkan provisioning dan receipt; private key disimpan sebagai Worker secret. Jangan membuat endpoint pengembalian token service account atau endpoint PATCH RTDB arbitrer.

### 8.2 Firebase RTDB dan Hosting
Baseline proyek `admin-kelas-3a`, RTDB `https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app`; Hosting `https://admin-kelas-3a.web.app` dan alias firebaseapp.com. Akun deployment `sikalumant@gmail.com`. Nama proyek adalah baseline konfigurasi, bukan kewajiban menulis ke produksi saat AI melakukan build.

Rules berada pada `firebase/database.rules.production.json`; public build `public/`; `firebase.json` memuat headers/CSP dan predeploy verify. Source baru harus melalui build agar manifest mencakup file baru. **Build multi-role tidak boleh memakai build ID 4.7.2 lama**; versi semua authority source ditingkatkan bersama saat rilis target ditetapkan. Jangan menentukan nomor rilis baru lewat asumsi bahwa nomor tertentu masih kosong.

### 8.3 Cloudinary dan Worker
Worker baseline `simni-assets-gateway`, endpoint `https://simni-assets-gateway.2ndgoal.workers.dev`. Cloud name baseline `xesssofq`, preset signed `simni_lkpd_dokumen_signed`. Nilai ini referensi konfigurasi; credential dan keberadaan preset harus diverifikasi, bukan dianggap tersedia dari teks.

Variables: FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_EMAIL, SIMNI_ALLOWED_ORIGINS, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET. Secrets: FIREBASE_PRIVATE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Tidak ada nilai rahasia dalam dokumen. Instalasi target belum siap sebelum semuanya terpasang dan diperiksa dengan akun sah.

Route Cloudinary sign/delete menolak selain profil canonical owner active dengan UID/role/workspace/email yang benar. Penolakan dilakukan sebelum menghubungi Cloudinary. Scope public_id `simni/{workspaceId}/{yearId}/{purpose}/...` tetap diperiksa. Purpose logo max 5 MiB PNG/JPEG/WebP; document max 8 MiB PDF/PNG/JPEG/WebP/text; student_photo max 2 MiB PNG/JPEG/WebP. Batas harus ditegakkan pula oleh signed upload preset penyedia; ukuran yang dilaporkan klien bukan bukti ukuran file sesungguhnya.

Metadata asset berisi public_id/resource_type/delivery type/bytes/URL/workspace/year/createdBy. Upload dan metadata RTDB bukan transaksi tunggal; gunakan compensation cleanup terotorisasi ketika penyimpanan metadata gagal. Jangan membiarkan teacher mendapat signature melalui endpoint umum yang hanya memeriksa “role dikenal”.

Kebijakan dokumen baru: delivery authenticated/private untuk dokumen yang harus hanya diunduh owner; buka lewat endpoint owner yang menghasilkan URL bertanda tangan berumur singkat, tidak menyimpan URL bertoken permanen ke database. Endpoint `POST /v1/cloudinary/download` menerima documentId scope sendiri, membaca public_id dari metadata server, lalu menghasilkan URL berlaku 60 detik. Jangan menerima URL/public_id arbitrer dari body tanpa lookup. Preview memakai otorisasi yang sama.

Aset lama yang URL-nya publik tidak otomatis menjadi privat setelah menu ditutup. Jangan menghapusnya. Inventarisasi dan migrasi delivery dilakukan terpisah dengan backup dan pembaruan metadata; sebelum migrasi, catat batas bahwa pemegang URL publik lama masih dapat mengaksesnya. Gambar brand statis yang dibundel aplikasi bukan dokumen privat. Cloudinary credentials tidak dapat dipulihkan dari snapshot; aset unggahan perlu backup byte/metadata tersendiri.

### 8.4 Endpoint target dan kontrak
| Method / path | Pemanggil | Tanggung jawab |
|---|---|---|
| GET `/v1/registration/slots` | Publik | Status enabled/full dan slot tersedia tanpa PII; no-store |
| POST `/v1/registration/validate-invite` | Publik, rate limited | Validasi kode+email+slot; respons generik; tidak reservasi |
| POST `/v1/registration/activate` | Auth email verified | Reservasi dan provisioning idempotent; tidak butuh profil aktif sebelumnya |
| POST `/v1/registration/status` | Auth pemilik operasi | Baca/lanjutkan operasi miliknya; bukan operasi UID lain |
| POST `/v1/accounts/list` | Owner | Metadata slot/akun ringkas |
| POST `/v1/accounts/invite` | Owner | Buat/cabut undangan slot; token baru hanya satu kali |
| POST `/v1/accounts/status` | Owner | Aktif/nonaktif teacher; cegah perubahan owner/VIP |
| POST `/v1/accounts/replace` | Owner | Cabut assignment teacher lama dan undang pengganti |
| POST `/v1/accounts/registration` | Owner | Buka/tutup pendaftaran global |
| POST `/v1/admin/commit` dan `/v1/admin/status` | Auth aktif sesuai action | Kontrak receipt existing diperluas sesuai matrix |
| POST `/v1/cloudinary/sign`, `/delete`, `/download` | Owner saja | Operasi aset terbatas scope |

Routing registration harus memverifikasi token tanpa mensyaratkan profil yang belum dibuat; routing akademik/admin tetap mensyaratkan profil active. Jangan memindahkan semua route ke mode anonim untuk memudahkan registrasi. CORS memakai allowlist origin; no-store untuk seluruh respons sensitif. Rate limiting server untuk validate-invite: 5 percobaan/menit per sumber dan 20/jam per email-hash; aktivasi 5/menit per UID. Jangan log email/password/token mentah. Untuk deployment multi-instance gunakan rate-limit binding/server store yang konsisten, bukan counter JS lokal yang hilang saat isolate berganti.

## 9. BERKAS TAMBAHAN DAN REVISI TARGET

Tambahkan hanya boundary yang dibutuhkan; logika akademik existing tetap. Semua path berikut relatif root. Ini file target yang harus dibangun, bukan klaim sudah ada dalam snapshot.

```text
features/registration/
  registration.html
  registration.js
features/accounts/
  accounts.html
  accounts.js
js/auth/
  registration-service.js
  workspace-registry-core.js
edge/
  registration-operations.js
  account-operations.js
scripts/
  migrate-multirole.mjs
  verify-environment-boundary.mjs
qa/
  multirole-policy-regression.mjs
  registration-race-regression.mjs
  multirole-rules-emulator.mjs
  multirole-session-regression.mjs
```

| File | Fungsi | Logika wajib |
|---|---|---|
| registration.html | Form daftar dan verifikasi | Field/label/error/status bagian 5; gunakan CSS shell, bukan tema baru |
| registration.js | State machine UI daftar | Binding sekali, disable submit, email verify, activation/status, cleanup input sensitif |
| accounts.html | View owner dan modal akun | Tabel/filter, undangan, toggle registrasi, nonaktif/ganti guru |
| accounts.js | Kontrol UI manajemen | Cek izin, dialog konfirmasi, refresh list setelah receipt, tampilkan hasil tanpa token di log |
| registration-service.js | Adapter frontend | Fetch endpoint registrasi/account, fresh ID token, no-store, error mapping; tidak menghitung hak dari form |
| workspace-registry-core.js | Konstanta/pure validation | 12 slot, role enum, format classId, invariant canonical owner/VIP; bukan tempat menanam email semua guru |
| registration-operations.js | Engine aktivasi server | CAS slot, invitation validation, phases/idempotency/recovery; tidak menerima arbitrary updates |
| account-operations.js | Engine admin akun server | Owner verification, status/replace/invite/global toggle, audit metadata |
| migrate-multirole.mjs | Migrasi terkontrol | Default dry-run, validasi target, seed slot/assignment revision, idempotent, tidak mengganti UID/data lama |
| verify-environment-boundary.mjs | Pencegah salah target | Cocokkan mode environment, projectId, Worker name/URL, Auth/RTDB config; staging menolak produksi |
| multirole-policy-regression.mjs | Kontrak role | Semua matrix, fake superuser, kelas invalid, non-owner Cloudinary ditolak |
| registration-race-regression.mjs | Aktivasi serentak/retry | Satu pemenang, crash antar-fase, expired invite/reservation, final commit tidak double |
| multirole-rules-emulator.mjs | Rules dengan identitas sintetis | Cross-workspace, profile tampering, assignments, docs owner-only, disabled/revision |
| multirole-session-regression.mjs | Cache/UI/session | Pergantian UID/workspace/revision, pending queue, stale callback dan offline lease |

Revisi minimal: access-policy-core, access-context, auth, feature-loader, navigation, index shell; repository dan admin-operations untuk rollover/readiness; local-cache/sync/GADM scope untuk revision; edge worker routes/authorization; rules RTDB; SW precache/build/manifest/version authority. Gunakan feedback/modal existing. Jangan membongkar rumus nilai atau generator laporan hanya untuk role baru.

## 10. KOMPATIBILITAS FITUR DASAR DAN IDENTITAS VISUAL

Pertahankan struktur dan gaya SIMNI dasar: CSS shell/Tailwind offline, FontAwesome lokal, warna/tema gelap-terang, ukuran komponen, bottom/navigation layout, loader dan toast. Halaman baru mengikuti input/card/button existing. Form mobile satu kolom; desktop maksimal lebar form 480 px dan berpusat. Kelola akun desktop tabel; mobile dapat scroll horizontal dalam kontainer tanpa membuat seluruh halaman overflow. Target sentuh aksi baru minimal 44×44 CSS px; preferensi reduced-motion dihormati.

Presensi hari lampau, TP tanpa Bab, jurnal, template LPS/BLP editable, fidelity XLSX terhadap contoh root, export DOCX GADM, backup scoped, runtime pagination dan batas cache tidak berubah. Jangan menghilangkan fitur lama agar test multi-role lulus. Inisialisasi kelas baru tidak menyuntikkan contoh siswa/nilai milik owner. Template bawaan identik secara struktur, konfigurasi guru disimpan per workspace.

Tidak menambah chat, OCR/library baru, sinkronisasi daftar siswa lintas guru, dashboard kepala sekolah, database terpisah per role, pembayaran, atau manajemen organisasi multi-sekolah. PJOK mempertahankan data terpisah existing; sharing roster lintas kelas berada di luar kontrak ini. Penjelasan OCR/dokumen historis pada modul dasar tidak menjadi izin menambahkan implementasi yang tidak ada dalam snapshot dasar.

## 11. PANDUAN AI MEMBANGUN, MIGRASI, DAN DEPLOY

### 11.1 Urutan pembangunan
1. Pulihkan source dasar/aset; verifikasi keadaan awal dan simpan baseline terpisah. Snapshot 78 file bukan jaminan aset biner/dependency tersedia; gunakan template dan vendor asli bila ada, jangan mengarang pengganti lalu mengklaim identik.
2. Pasang environment development dengan emulator/staging, proyek dan Worker terpisah. Guard deployment aktif sebelum edit. Jangan menulis data produksi.
3. Implementasi registry/policy/profil/rules dan adapter kompatibilitas akun lama. Lulus uji isolasi sebelum UI daftar.
4. Implementasi provisioning/undangan/status server dan manajemen owner. Lulus race/idempotency sebelum menghubungkan form.
5. Implementasi UI daftar/verifikasi/kelola akun dengan lifecycle existing. Lengkapi signature scope offline dan rollover.
6. Audit diff, uji target dan regresi, build source dengan versi target konsisten. Laporan menyebut apa yang diuji dan belum diuji.

### 11.2 Migrasi data lama
Ambil backup data/rules/Auth identity dan konfigurasi sebelum migrasi produksi. Dry-run menampilkan jumlah perubahan dan hash baseline tanpa data sensitif. Seed registry slot, pin slot3A ke UID owner, VIP tetap ws_pjok, tambahkan revision/assignment kompatibel, buat slot kelas kosong. Tidak memindahkan subtree ws_superuser menjadi ws_kelas_3a. Tidak mengganti password/email/UID. Jika canonical data bertentangan, berhenti dan laporkan; jangan memperbaiki dengan penghapusan.

Selama migrasi, registrasi dan tindakan admin dijeda. Gunakan aturan transisi yang tetap menerima owner/VIP lama sambil menolak teacher belum aktif; deploy Worker kompatibel, rules transisi, migrasi terverifikasi, rules final, lalu Hosting. Urutan ini berbeda dari deploy rilis tanpa migrasi; setiap tahap harus terbukti siap sebelum berikutnya. Setelah pilot, aktifkan satu slot undangan terlebih dahulu, lalu lainnya.

### 11.3 Deployment dan penutupan
Periksa target Firebase/Cloudflare secara eksplisit. Siapkan seluruh binding/secret Worker. Uji operasi dengan akun sah pada staging; respons 401/preflight saja tidak cukup. Verifikasi artifact source, manifest version/build ID, rules diff, dan rollback forward plan. Hosting hanya deploy output build yang sudah diverifikasi. Setelah deploy, cocokkan manifest/SW/runtime/dashboard dan identitas Worker live. Jangan menganggap build ID frontend mengidentifikasi versi Worker.

Pada kegagalan: jangan membuka rules menjadi publik, jangan menghapus cache pengguna, jangan memulihkan seluruh RTDB untuk masalah tampilan, jangan rollback ke klien yang melanggar kontrak audit baru. Pendaftaran dapat ditutup sementara tanpa mematikan login existing. Semua operasi pending mempertahankan identitasnya hingga hasil dapat dibuktikan.

## 12. ACCEPTANCE WAJIB SEBELUM MENYATAKAN BUILD SELESAI

| Area | Bukti lulus |
|---|---|
| Dua akun existing | Owner/VIP login dengan UID/workspace/data lama, tanpa undangan |
| Slot | Tepat 12 slot kelas; 3A tidak bisa direbut; PJOK bukan pilihan; maksimal 11 guru baru |
| Pendaftaran penuh | UI menutup, server menolak aktivasi tambahan, login/reset password tetap berfungsi |
| Race | Dua proses mengambil slot sama menghasilkan tepat satu assignment aktif |
| Retry/crash | Setiap fase putus dapat dilanjutkan tanpa duplicate UID/workspace/claim |
| Email/undangan | Email belum verified, email mismatch, token expired/revoked/reused ditolak |
| Rules | Guru A tidak dapat read/write workspace B melalui SDK maupun REST |
| Hak role | Body role=superuser/workspace lain tidak dapat menaikkan privilege |
| File/Cloudinary | VIP/teacher ditolak UI, metadata, sign/delete/download; ekspor lokal tetap berfungsi |
| Ganti guru | Data kelas tidak dihapus; assignment lama dicabut, revision berubah, queue lama tidak pindah |
| Offline | Data UID/workspace/revision tidak tercampur; teacher lease berlaku; stale callbacks ditolak |
| Rollover | Semua assignment aktif masuk readiness; satu belum siap menolak sebelum mutasi |
| Akademik | Presensi lampau, TP lama tanpa Bab, nilai/jurnal, LPS/BLP/GADM tetap lolos regresi |
| UX | Keyboard/focus/modal bertingkat/mobile, submit ganda, loading, error dan toast teruji |
| Hosting | Version authority konsisten, vendor/template tersedia offline, hash hasil build/live sesuai |

Pengujian menggunakan emulator/staging, mock credential dan aset uji yang diizinkan. Tidak boleh menguji reset/restore destruktif pada data produksi untuk mendapatkan status lulus. Identik fungsional berarti input yang sama memberi hasil yang sama pada fitur dasar; identik visual memerlukan perbandingan screenshot/reference dan template asli, bukan sekadar klaim AI.

## 13. BATAS DOKUMEN DAN SUMBER KEBENARAN

Dokumen ini adalah deskripsi final multi-role yang harus diimplementasikan, bukan snapshot source multi-role. Snapshot Antigravity tetap asli. Tidak ada perintah menimpa kedua file original atau source produksi. AI wajib membuat hasil kerja terpisah dan memperbarui status berdasarkan bukti.

Dokumen spesifikasi dapat menetapkan perilaku, arsitektur dan kontrak data secara tegas, tetapi tidak menjamin byte-identik dengan aplikasi bila seluruh source/aset asli tidak tersedia. Secret cloud, data siswa, password, histori pengguna, domain dan unggahan Cloudinary memerlukan backup/configuration recovery tersendiri. Jangan menyatakan bisa memulihkan data yang tidak pernah dicadangkan.

---
*Spesifikasi desain final SIMNI Multi-Role, 15 September 2026. Berdasarkan struktur dokumentasi Antigravity dan keputusan pemilik dalam percakapan; dokumen dasar dan snapshot tidak diubah.*
