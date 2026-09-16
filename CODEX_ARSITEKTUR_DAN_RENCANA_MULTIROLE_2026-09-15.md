# SIMNI — spesifikasi, inventaris source, dan pemulihan layanan

## Bukti pemulihan dokumen final — 15 September 2026

- Ekstraktor diambil langsung dari blok PowerShell dalam dokumen snapshot final, bukan dari source proyek.
- Hasil: **513/513 berkas berhasil dipulihkan dan cocok ukuran serta SHA-256** ke direktori baru `test-output/recovery-from-two-md-final`.
- Arsip tertanam final SHA-256: `6d9669c5dc8642f32bdf490388fff18ca3032996d238699600c5e0ca5431a468`.
- Artefak Hosting hasil pemulihan: versi **4.7.2**, build ID `844d010acb53f5d8d0f1eac9a1baf72b7bd78d4bec3614e47f6ff51242bd5261`, **104 berkas**, diverifikasi tanpa rebuild.
- Pemeriksaan ini membuktikan pemulihan source/artefak. Tidak membuktikan validitas secret, kesiapan seluruh layanan produksi, implementasi multi-role, atau pemulihan data pengguna.
- Tidak ada deployment, perubahan rules live, atau pengujian aplikasi terhadap produksi dalam pekerjaan dokumentasi ini.

## 1. Status dan batas authority
Dokumen ini bersama `SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md` memulihkan berkas yang diinventarisasi secara byte-identik. Snapshot adalah SIMNI 4.7.2 dua akun; jangan menyebutnya implementasi multi-role siap deploy. Rancangan multi-role di bagian 8 adalah target pekerjaan berikutnya. Dokumen historis yang ikut diarsipkan dapat mengandung status lama dan tidak mengalahkan batas ini.

Pemulihan source bukan pemulihan akun cloud, data siswa, password, file Cloudinary, domain, atau private key. Data produksi sengaja tidak dimasukkan ke dokumen source. Jika cloud beserta semua backup data hilang, data pengguna yang tidak tercakup backup tidak dapat direkonstruksi dari kode. Jika kedua MD ikut hilang, pemulihan ini juga tidak tersedia. Simpan dua MD di media cadangan yang terpisah.

Hasil pemeriksaan terakhir: Hosting 104 berkas cocok dengan manifest build `844d010acb53f5d8d0f1eac9a1baf72b7bd78d4bec3614e47f6ff51242bd5261` pada kedua domain Firebase. Worker versi `4377da0b-b1dc-48eb-a525-30143acd5ea0` memiliki enam binding nonsecret; `secret list` menghasilkan `[]`. FIREBASE_PRIVATE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET belum terlihat pada binding aktif saat pemeriksaan. Karena itu kesiapan operasi administratif live BELUM ditutup. Tidak ada klaim zero-error, transaksi lintas layanan atomik, atau backup otomatis terenkripsi.

## 2. Identitas dan sistem kerja
SIMNI adalah PWA administrasi guru: siswa, presensi berdasarkan tanggal, tujuan pembelajaran (TP) beserta Bab, nilai, jurnal harian, catatan, dokumen, laporan LPS/BLP, serta GADM. Frontend HTML/CSS/JavaScript modular menggunakan Firebase Authentication dan Realtime Database. Service Worker dan IndexedDB mendukung penggunaan offline dalam batas kontrak sesi dan penyimpanan.

Alur utama: shell index memuat runtime/config/policy → autentikasi → profil `users/UID` → validasi role/workspace/tahun → fragmen fitur yang diizinkan → listener data scope aktif → render. Aksi pengguna divalidasi → repository memetakan path logis → operasi cloud atau antrean yang didukung → state/cache → feedback. Operasi administratif memakai Worker dan receipt; jangan menampilkan sukses sebelum kontraknya terpenuhi.

## 3. Lifecycle halaman, modal, tombol, dan sesi
Authority fragment berada di `js/core/feature-loader.js`; mapping izin di `js/auth/access-policy-core.js`; navigasi dan modal di `js/ui/navigation.js`; feedback di `js/ui/feedback.js`. Jangan membuat modal manager kedua.

Halaman: periksa izin → muat HTML/CSS/runtime yang dibutuhkan → mount template ke root views/modals → inisialisasi terkontrol → tampilkan halaman → bersihkan resources ketika sesi berubah. Signature sesi memuat UID/workspace/tahun sehingga respons lama tidak boleh merender sesi baru. Sign-out membersihkan akses dan listener, bukan membuang data belum tersinkron secara sembarang.

Modal: pemicu membuka melalui fungsi bersama → fitur dimuat dan izin diperiksa → data form diisi → modal ditampilkan → fokus dipindahkan → background inert → Tab tetap dalam dialog → Escape/close menutup layer teratas → inert dan fokus pemicu dipulihkan. Modal bertingkat menyimpan state setiap layer. Perubahan form harus mengikuti handler aktual, bukan sekadar memodifikasi value tanpa event.

Tombol simpan: validasi input → cegah pengiriman ganda selama proses → await operasi → sukses/gagal sesuai hasil → pulihkan tombol. Bedakan tersimpan lokal, menunggu sinkronisasi, committed server, dan hasil pending. Daftar setiap elemen statis, handler inline, event JS, dan fungsi berikut tersedia di inventaris; kode utuh termasuk markup dinamis ada di snapshot. Inventaris statis bukan pengganti pengujian UI runtime.

## 4. Fitur dan kontrak data
Siswa: tambah/edit/impor/ekspor data kelas; ID siswa menjadi referensi presensi/nilai/laporan. Presensi: pilih tanggal, muat catatan tanggal itu, tentukan status, simpan untuk scope kelas/tahun; jangan mengganti tanggal pilihan dengan tanggal hari ini saat menyimpan. TP: kelola mapel, Bab, dan tujuan; TP lama tanpa Bab tetap dibaca dan dapat diedit. Nilai: pilih konteks penilaian dan siswa, validasi nilai, simpan tanpa menghapus data mapel lain. Jurnal: tanggal, kegiatan/materi, data form, simpan/edit sesuai path journals. Catatan: rekam catatan kelas/siswa dengan scope pengguna. Dokumen: metadata RTDB serta aset Cloudinary melalui Worker. Dashboard: ringkasan state dan versi authority. Pengaturan: identitas kelas/sekolah, tampilan, penyimpanan lokal, dan akun yang diizinkan.

LPS/BLP: pilihan template bawaan berbasis `LPS KLS 2 contoh.xlsx` dan `BLP contoh.xlsx`, konfigurasi editable, laporan/revisi, ekspor Excel/cetak. File referensi asli harus ikut dipulihkan. `lps-core` memproses data, `lps-reference-data` memuat referensi, `lps-excel` dan `lps-print` menangani keluaran. Kesesuaian visual tidak disimpulkan hanya dari checksum source; gunakan QA fidelity setelah perubahan.

GADM: UI input → validasi → engine dengan knowledge base/kurikulum → preview/editor → penyimpanan scope → ekspor DOCX. Cache GADM memuat UID, role, workspace, tahun, kelas. Worker bukan mesin GADM. Chat sudah dipisahkan dari source aplikasi aktif; dokumen atau pengujian historis Chat bukan perintah memasangnya kembali.

## 5. Firebase: database, autentikasi, rules, dan Hosting
Proyek produksi tercatat: `admin-kelas-3a`; RTDB `https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app`. Akun deployment `sikalumant@gmail.com` berbeda dari identitas owner aplikasi. Owner aplikasi `unggaran.sditbm@gmail.com`; VIP `anur.auliya01@gmail.com`. Jangan memakai email deployment sebagai pengganti owner tanpa migrasi eksplisit.

Auth menggunakan email/password; password disimpan oleh Firebase Auth, bukan dalam users RTDB. Profil memuat uid, email, displayName, role, workspaceId, classId, activeAcademicYearId, status. Saat ini binding hanya owner dan VIP; VIP bukan akun undangan. Rules profil juga mengunci identitas tersebut. Jangan membuka write role/workspace untuk pendaftaran klien.

Struktur RTDB:
```text
system/academicYear/activeYearId
users/{uid}
assignments/{yearId}/{uid}
rollovers/{yearId}/...
workspaces/{workspaceId}/settings/identity
workspaces/{workspaceId}/settings/lpsV2
workspaces/{workspaceId}/academicYears/{yearId}/students
workspaces/{workspaceId}/academicYears/{yearId}/attendance
workspaces/{workspaceId}/academicYears/{yearId}/learningObjectives
workspaces/{workspaceId}/academicYears/{yearId}/grades
workspaces/{workspaceId}/academicYears/{yearId}/documents
workspaces/{workspaceId}/academicYears/{yearId}/notes
workspaces/{workspaceId}/academicYears/{yearId}/journals
workspaces/{workspaceId}/academicYears/{yearId}/schedule
workspaces/{workspaceId}/academicYears/{yearId}/legacyLps
workspaces/{workspaceId}/academicYears/{yearId}/lps/{templates,reports,revisions}
workspaces/{workspaceId}/archives/...
auditLogs/{workspaceId}/{operationId}
administrativeOperations/{workspaceId}/{operationId}
administrativeCommitMarkers/{workspaceId}/{operationId}
```
Struktur lengkap dan validator adalah JSON rules di snapshot, bukan contoh struktur di atas. `workspace-paths-core.js` adalah authority pemetaan path lama ke modern. Tahun akademik berpola YYYY-YYYY. Perubahan koleksi/subfield harus mematuhi `.validate`, bukan mengasumsikan seluruh child bebas ditulis.

Rules produksi: `firebase/database.rules.production.json`; dipilih oleh `firebase.json`. Klien tidak boleh menulis auditLogs atau membaca/menulis administrativeOperations. Marker memiliki validator identitas/nonce/create-only. Data mutation Worker menggunakan ID token pengguna, sedangkan reservation/receipt menggunakan service account. Jangan menambahkan Firestore sebagai database utama atau deploy rules Chat.

Pemulihan Firebase: buat/pulihkan proyek dan Auth email/password, sediakan RTDB, konfigurasi aplikasi web pada runtime yang tercantum di snapshot, atur authorized domains, pasang service account yang sesuai di Worker, lalu deploy rules dan Hosting secara berurutan. Jika proyek baru memiliki ID/URL berbeda, ubah konfigurasi source di lingkungan terpisah dan rebuild; ID build lama tidak akan lagi berlaku. Data backup diimpor hanya ke target yang telah diperiksa, jangan menimpa database aktif.

Hosting public directory `public/`; hook predeploy `node scripts/verify-hosting.mjs` memverifikasi tanpa rebuild. Domain tercatat `admin-kelas-3a.web.app`, `admin-kelas-3a.firebaseapp.com`; `simni.my.id` tercantum pada CORS, tetapi kepemilikan/DNS/TLS harus diperiksa terpisah. Headers/CSP/rewrite lengkap ada dalam firebase.json. Public build dan manifest ikut snapshot sehingga dapat dipulihkan tanpa menginstal dependency frontend dahulu.

## 6. Cloudinary dan Cloudflare: panduan konfigurasi lengkap
Cloudflare account tercatat `2ndgoal@gmail.com`, Worker `simni-assets-gateway`, URL `https://simni-assets-gateway.2ndgoal.workers.dev`. Source `edge/worker.js`, engine `edge/admin-operations.js`, deploy config `edge/wrangler.jsonc`. Jangan menimpa Worker Chat.

Binding nonsecret: FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_EMAIL, SIMNI_ALLOWED_ORIGINS, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET. Nilai terkonfigurasi aktual ada pada salinan wrangler.jsonc di snapshot. Cloud name saat snapshot `xesssofq`, preset `simni_lkpd_dokumen_signed`. Nama ini bukan bukti akun/preset telah berfungsi.

Binding rahasia server: FIREBASE_PRIVATE_KEY (PEM service account), CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Sediakan dari akun yang berwenang; jangan tanam di frontend, Markdown, Git, atau log. Firestore key/Cloudflare token/Firebase CLI token bukan pengganti service account. Setelah memulihkan source, gunakan `wrangler secret put NAMA --config edge/wrangler.jsonc` melalui input interaktif atau secret bulk yang aman; secret list hanya membuktikan nama tersedia, bukan validitas nilainya.

Cloudinary account API Credentials menyediakan cloud name/API key/API secret. Pada pengaturan Upload buat signed upload preset, cocokkan nama, batasi format dan ukuran di penyedia, dan periksa bahwa kebijakan sesuai purpose. Worker membatasi logo PNG/JPEG/WebP 5 MiB; document PDF/PNG/JPEG/WebP/text 8 MiB; student_photo PNG/JPEG/WebP 2 MiB. Signed preset harus tetap kompatibel dengan ketiga penggunaan; jika kebijakan preset lebih sempit, sesuaikan rancangan secara eksplisit, jangan membuka unsigned upload.

Alur unggah: klien meminta POST `/v1/cloudinary/sign` dengan Firebase ID token → Worker validasi origin/token/profil/role/purpose/ukuran/MIME → signature SHA-1 parameter Cloudinary dibuat server → klien mengunggah ke Cloudinary → metadata hasil disimpan ke workspace RTDB. Bila metadata gagal tersimpan, cleanup scoped dipanggil. Delete POST `/v1/cloudinary/delete` memeriksa prefix `simni/{workspaceId}/{academicYearId}/{purpose}/` sebelum destroy; jangan menghapus public_id dari workspace lain.

File Cloudinary tidak otomatis privat hanya karena tombol SIMNI dibatasi: akses URL delivery mengikuti konfigurasi resource/type Cloudinary. Target pembatasan owner harus mencakup kebijakan delivery bila kerahasiaan unduhan diperlukan, bukan mengklaim URL publik tidak dapat diakses role lain. Salinan file yang sudah diunduh tidak dapat ditarik kembali melalui rules aplikasi.

Pemulihan aset: backup harus menyimpan byte asli plus public_id, resource_type, delivery type, metadata dan kaitan RTDB. Jika cloud account lama masih ada, jangan upload ulang tanpa perlu. Jika akun cloud baru, pulihkan aset dan remap URL/public_id yang berubah; source saja tidak mengembalikan unggahan. Validasi signature dengan akun sah dan aset uji terisolasi sebelum membuka penggunaan; penolakan 401 tanpa token tidak membuktikan credential valid.

## 7. Offline, sinkronisasi, dan lifecycle administratif
Cache authority scope UID/workspace/tahun; local-cache schema 3, snapshot maksimum 32 MiB, payload database lokal maksimum 96 MiB. Runtime SW: 64 entry, 16 MiB, 7 hari. Cleanup aman tidak boleh menghapus app-shell aktif, draf, atau antrean pending. Listener menggunakan halaman/rentang key dan guard signature sesi; data tahun aktif masih diagregasi di memori, bukan jaminan memori konstan.

Operasi admin: simpan operationId/fingerprint sebelum request → reserve server → validasi payload/izin → PATCH data dengan token pengguna dan nonce marker → server menulis receipt → konfirmasi sukses. Jika acknowledgement ambigu, simpan operationId. Status dapat memulihkan receipt hanya jika nonce membuktikan commit. Ini bukan transaksi atomik lintas dua identitas. Jangan mengulangi reset/restore dengan ID baru untuk mengatasi pending. Arsip `json-chunks-v1` menjaga objek kosong, array/null dan key numerik dari normalisasi RTDB.

## 8. Spesifikasi multi-role yang disepakati (BELUM DIIMPLEMENTASIKAN)
Tujuan: tambah slot wali kelas 1A,1B,2A,2B,3A,3B,4A,4B,5A,5B,6A,6B; owner menempati slot 3A awal, VIP PJOK tetap akun existing tanpa jalur undangan. Pertahankan ws_superuser dan ws_pjok serta seluruh data lama. Role izin baru usulan `teacher`, workspace kelas baru `ws_kelas_1a` dst; penamaan baru ini spesifikasi, bukan fakta source.

Pisahkan role, assignment dan workspace. Owner/superuser saja boleh mengelola akun dan menu File/Dokumen/operasi Cloudinary terkait. VIP dan seluruh guru undangan ditolak pada UI, RTDB dan Worker, termasuk panggilan langsung. Jangan mengubah cara login VIP dan jangan menghapus aset lama. Tentukan izin fitur guru kelas melalui matrix eksplisit; jangan memberikan superuser supaya LPS/BLP muncul. Guru kelas harus dapat memakai fungsi akademik dan LPS/BLP miliknya tanpa hak administratif global.

Tahap minimal: (1) baseline setelah closure 4.7.2, branch/direktori terpisah dan staging tanpa data produksi; (2) perluas access-context/policy/rules/Worker/rollover, akun guru disediakan administrator; (3) pendaftaran berbasis slot dengan nama/email/password/pilihan assignment, undangan atau approval server; (4) audit perubahan dan uji isolasi sebelum rilis pilot satu kelas. Jangan mengubah frontend akademik yang sudah generik tanpa temuan.

Model target baru: `registrationSlots/{slotId}` status available/reserved/occupied, assignedUid, expiresAt, operationId; invitation hanya token hash/expiry/scope pada server, bukan token mentah yang readable publik. Workspace tidak menentukan password. Server memvalidasi invitation, email verified, status dan slot. Reservasi atomik menghindari dua UID mengambil slot sama. Firebase Auth create dan RTDB provisioning bukan satu transaksi; gunakan proses idempotent, recovery, expiry dan compensation yang tidak menghapus akun sah. Penuh berarti server menolak registrasi baru; login/reset password tetap tersedia. Daftar publik hanya slot tersedia, tidak membocorkan profil guru.

Akun lama tetap bekerja. Rollover harus memakai daftar assignment aktif, bukan dua email hardcoded. Workspace melekat pada kelas; pergantian guru melalui pencabutan akses lama dan assignment baru, bukan menyalin seluruh database. Scope lokal harus mempertimbangkan perubahan assignment UID yang sama. Hubungan data siswa PJOK lintas kelas masih usulan dan perlu keputusan pemilik; jangan mengimplementasikan otomatis.

Acceptance: guru A gagal membaca/menulis workspace B; role tidak bisa diangkat klien; ganti akun offline tidak mencampur cache/queue; satu slot untuk satu pemenang; retry tidak membuat user/workspace ganda; expired reservation dapat dipulihkan; VIP tetap login lama; owner-only file enforced di server; rollover tidak melewatkan kelas; restore beda workspace ditolak. Tes memakai emulator/staging dengan identitas sintetis, bukan reset produksi.

## 9. Pemulihan dan deployment berurutan
1. Ekstrak snapshot ke direktori baru dengan PowerShell pada dokumen pasangan. Semua berkas diverifikasi SHA-256. Jangan ekstrak ke proyek aktif.
2. Untuk artefak Hosting existing jalankan `node scripts/verify-hosting.mjs`; public lengkap ikut snapshot. Untuk rebuild source, install Node/npm yang kompatibel dan jalankan `npm ci` mengikuti lock, kemudian `npm run build:hosting`. Vendor tarball xlsx dan template disertakan. node_modules tidak disertakan; npm registry dibutuhkan untuk reinstall dependencies. CLI Firebase/Wrangler adalah alat deploy terpisah, bukan runtime frontend; versi yang dipakai sebelumnya firebase-tools 15.30.0 dan wrangler 4.131.1.
3. Pulihkan konfigurasi cloud dan credential secara aman. Verifikasi akun serta proyek target. Jangan mengandalkan token CLI lama atau menganggap akun Google sama dengan owner aplikasi.
4. Backup live dan koordinasikan jeda operasi admin sebelum perubahan cloud. Siapkan Worker baru plus bindings. Deploy Worker dan verifikasi dengan akun sah. Baru deploy rules RTDB; kemudian Hosting. Jangan deploy Chat/Firestore.
5. Bandingkan manifest/build ID/hash file live, runtime, SW dan endpoint Worker. Catat version ID Worker terpisah dari build ID Hosting. Source Worker berubah tidak otomatis mengubah build ID frontend.
6. Aktifkan kembali operasi setelah kesiapan dibuktikan. Rollback tidak boleh membuka write audit klien atau menghapus data/cache pengguna.

Contoh CLI setelah alat dipasang:
```powershell
firebase login:add sikalumant@gmail.com --interactive
firebase projects:list --account sikalumant@gmail.com
wrangler login
wrangler whoami
wrangler secret put FIREBASE_PRIVATE_KEY --config edge/wrangler.jsonc
wrangler secret put CLOUDINARY_API_KEY --config edge/wrangler.jsonc
wrangler secret put CLOUDINARY_API_SECRET --config edge/wrangler.jsonc
wrangler deploy --config edge/wrangler.jsonc
# Hanya lanjut setelah Worker siap dan target produksi sudah disetujui:
firebase deploy --only database --project admin-kelas-3a --account sikalumant@gmail.com
firebase deploy --only hosting --project admin-kelas-3a --account sikalumant@gmail.com
```
Untuk environment baru ganti target secara eksplisit; jangan menjalankan contoh produksi di staging. Android wrapper ikut snapshot, tetapi SDK/JDK/Gradle dan signing key eksternal tetap diperlukan untuk APK; APK lama bukan bagian pemulihan source.

## 10. Inventaris per file dan indeks logika
Setiap file memiliki path/direktori, fungsi, ukuran/hash di snapshot, dan indeks struktur. Indeks fungsi, event dan kontrol dihasilkan dari source aktual, bukan daftar perilaku yang ditebak. Nama fungsi + nomor baris merujuk source hasil ekstraksi. Kode fungsi lengkap pada snapshot adalah spesifikasi eksekusi paling presisi, termasuk branch/validasi/error. Pustaka vendor dan public hasil build tetap diinventarisasi, tetapi bukan tempat mengedit fitur.

Snapshot 2026-09-15T08:11:17.775034+00:00; 513 berkas.

### `.firebaserc`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `.gitignore`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `ANTIGRAVITY_DEPLOY_PROCEDURE_V4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `ANTIGRAVITY_MASTER_CONTEXT_V4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `ANTIGRAVITY_TEST_REPAIR_RUNBOOK_V4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `AUDIT_FINAL_TAHAP_7_4.7.1_2026-09-14.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `AUDIT_PENUTUPAN_3_TEMUAN_4.7.2_2026-09-14.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `BLP contoh.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `CODEX_AUDIT_AND_TEST_REFERENCE_4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `CODEX_MAC_01_05_06_07_LOCALHOST_QA_4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `CODEX_RUNTIME_AUDIT.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `DEPLOYMENT_RUNBOOK_4.7.0.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `DEPLOYMENT_RUNBOOK_4.7.1.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `DEPLOYMENT_RUNBOOK_4.7.2.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FIREBASE_DEPLOY_ANTIGRAVITY_4.5.6.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FIREBASE_DEPLOY_ANTIGRAVITY_4.5.7.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FIREBASE_DEPLOY_ANTIGRAVITY_4.6.1.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FIREBASE_DEPLOY_ANTIGRAVITY_4.6.2.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FIREBASE_DEPLOY_ANTIGRAVITY_4.6.3.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_AUDIT_4.6.6_2026-09-09.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_AUDIT_4.6.6_2026-09-09_EVIDENCE.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_AUDIT_REPORT_4.5.5.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_AUDIT_REPORT_4.5.6.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_CHAT_AUDIO_AUTH_REPORT_4.6.1.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `FORENSIC_SCORECARD_4.6.9_2026-09-12.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `GADM_INTEGRATION_FORENSIC_REPORT_4.6.0.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `GADM_RECONSTRUCTION_AND_MOBILE_QA_REPORT_4.6.2.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `HOTFIX_REPORT_4.5.7.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `HOTFIX_REPORT_4.6.3.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `INTEGRATION_SCOPE.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `LPS KLS 2 contoh.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `LPS_BLP_TEMPLATE_RECONSTRUCTION_4.6.9.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `MASTER EXECUTION SPECIFICATION  UNTUK ANTIGRAVITY.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `MASTER EXECUTION SPECIFICATION UNTUK CODEX.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `Modul Ajar Super Visi IPAS Kelas 3.pdf`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `PROMPT_ANTIGRAVITY_DEPLOY_4.6.9.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `PROMPT_ANTIGRAVITY_RECONSTRUCTION_QA_V4.6.4.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `PROMPT_ANTIGRAVITY_REKONSTRUKSI_BERTAHAP_POST_4.6.9.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `RECONSTRUCTION_REAUDIT_4.6.7.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `REKONSTRUKSI_BERTAHAP_STATUS.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `REVIEW_TAHAP_7_4.7.0_2026-09-13.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `Reconstruction_status.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `SIMNI_PANDUAN_PEMBANGUNAN_KOTLIN_ANDROID_APK.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `Template_Data_Siswa_1_Kelas.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `Template_Data_Siswa_Per_Kelas.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `Template_Impor_TP_1_Kelas.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `Template_Impor_TP_Per_Kelas.xlsx`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `UIUX_FORENSIC_AUDIT_4.6.7_2026-09-10.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `UIUX_RECONSTRUCTION_4.6.8.md`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `android/.gitignore`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/.gitignore`
Direktori: `android/app`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/build.gradle`
Direktori: `android/app`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/capacitor.build.gradle`
Direktori: `android/app`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/proguard-rules.pro`
Direktori: `android/app`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`
Direktori: `android/app/src/androidTest/java/com/getcapacitor/myapp`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/AndroidManifest.xml`
Direktori: `android/app/src/main`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/assets/capacitor.config.json`
Direktori: `android/app/src/main/assets`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/capacitor.plugins.json`
Direktori: `android/app/src/main/assets`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/chat.html`
Direktori: `android/app/src/main/assets/public/chat`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/css/chat-style.css`
Direktori: `android/app/src/main/assets/public/chat/css`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-auth.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-config.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-crypto.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-db.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-media.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-platform.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-query-core.mjs`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/chat/js/chat-ui-handler.js`
Direktori: `android/app/src/main/assets/public/chat/js`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/cordova.js`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/cordova_plugins.js`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/archive/archive.js`
Direktori: `android/app/src/main/assets/public/features/archive`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/attendance/attendance.html`
Direktori: `android/app/src/main/assets/public/features/attendance`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/attendance/attendance.js`
Direktori: `android/app/src/main/assets/public/features/attendance`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/backup/backup-core.js`
Direktori: `android/app/src/main/assets/public/features/backup`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/backup/backup.js`
Direktori: `android/app/src/main/assets/public/features/backup`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/dashboard/dashboard.html`
Direktori: `android/app/src/main/assets/public/features/dashboard`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/dashboard/dashboard.js`
Direktori: `android/app/src/main/assets/public/features/dashboard`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/documents/documents.html`
Direktori: `android/app/src/main/assets/public/features/documents`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/documents/documents.js`
Direktori: `android/app/src/main/assets/public/features/documents`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm-curriculum-2026.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm-docx.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm-engine.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm-kb.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm-storage.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm.css`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm.html`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/gadm/gadm.js`
Direktori: `android/app/src/main/assets/public/features/gadm`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/grades/grades.html`
Direktori: `android/app/src/main/assets/public/features/grades`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/grades/grades.js`
Direktori: `android/app/src/main/assets/public/features/grades`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/journal/journal.html`
Direktori: `android/app/src/main/assets/public/features/journal`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/journal/journal.js`
Direktori: `android/app/src/main/assets/public/features/journal`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/lps/lps-core.js`
Direktori: `android/app/src/main/assets/public/features/lps`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/lps/lps-print.js`
Direktori: `android/app/src/main/assets/public/features/lps`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/lps/lps.css`
Direktori: `android/app/src/main/assets/public/features/lps`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/lps/lps.html`
Direktori: `android/app/src/main/assets/public/features/lps`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/lps/lps.js`
Direktori: `android/app/src/main/assets/public/features/lps`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/notes/notes.html`
Direktori: `android/app/src/main/assets/public/features/notes`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/notes/notes.js`
Direktori: `android/app/src/main/assets/public/features/notes`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/reset/reset.js`
Direktori: `android/app/src/main/assets/public/features/reset`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/settings/settings.html`
Direktori: `android/app/src/main/assets/public/features/settings`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/settings/settings.js`
Direktori: `android/app/src/main/assets/public/features/settings`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/students/students.html`
Direktori: `android/app/src/main/assets/public/features/students`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/features/students/students.js`
Direktori: `android/app/src/main/assets/public/features/students`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/firebase-messaging-sw.js`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/icons/favicon-32.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/icons/icon-192.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/icons/icon-512.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/icons/icon-maskable-512.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/icons/school-logo.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/icons/simni-logo.png`
Direktori: `android/app/src/main/assets/public/icons`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/index.html`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/auth/access-context.js`
Direktori: `android/app/src/main/assets/public/js/auth`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/auth/access-policy-core.js`
Direktori: `android/app/src/main/assets/public/js/auth`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/auth/auth.js`
Direktori: `android/app/src/main/assets/public/js/auth`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/auth/chat-unlock.js`
Direktori: `android/app/src/main/assets/public/js/auth`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/core/app.js`
Direktori: `android/app/src/main/assets/public/js/core`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/core/feature-loader.js`
Direktori: `android/app/src/main/assets/public/js/core`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/core/runtime-config.js`
Direktori: `android/app/src/main/assets/public/js/core`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/core/shell.js`
Direktori: `android/app/src/main/assets/public/js/core`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/core/state.js`
Direktori: `android/app/src/main/assets/public/js/core`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/cloudinary-client.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/firebase-client.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/local-cache.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/mock-adapter.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/repository.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/sync.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/database/workspace-paths-core.js`
Direktori: `android/app/src/main/assets/public/js/database`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/platform/bootstrap.js`
Direktori: `android/app/src/main/assets/public/js/platform`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/platform/download-service.js`
Direktori: `android/app/src/main/assets/public/js/platform`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/platform/main.js`
Direktori: `android/app/src/main/assets/public/js/platform`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/platform/native-back-button.js`
Direktori: `android/app/src/main/assets/public/js/platform`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/platform/permission-service.js`
Direktori: `android/app/src/main/assets/public/js/platform`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/services/chat-notifications.js`
Direktori: `android/app/src/main/assets/public/js/services`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/services/edge-service.js`
Direktori: `android/app/src/main/assets/public/js/services`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/actions.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/date.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/feedback.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/navigation.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/render.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/shell.css`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/ui/theme.js`
Direktori: `android/app/src/main/assets/public/js/ui`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/js/utils/sanitize.js`
Direktori: `android/app/src/main/assets/public/js/utils`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/manifest.json`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/sw.js`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/tailwind-offline.css`
Direktori: `android/app/src/main/assets/public`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/templates/BLP contoh.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/templates/LPS KLS 2 contoh.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/templates/Template_Data_Siswa_1_Kelas.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/templates/Template_Data_Siswa_Per_Kelas.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/templates/Template_Impor_TP_1_Kelas.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/templates/Template_Impor_TP_Per_Kelas.xlsx`
Direktori: `android/app/src/main/assets/public/templates`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/exceljs/exceljs.min.js`
Direktori: `android/app/src/main/assets/public/vendor/exceljs`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/firebase/firebase-app.js`
Direktori: `android/app/src/main/assets/public/vendor/firebase`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/firebase/firebase-auth.js`
Direktori: `android/app/src/main/assets/public/vendor/firebase`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/firebase/firebase-database.js`
Direktori: `android/app/src/main/assets/public/vendor/firebase`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/firebase/firebase-firestore.js`
Direktori: `android/app/src/main/assets/public/vendor/firebase`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/firebase/firebase-messaging.js`
Direktori: `android/app/src/main/assets/public/vendor/firebase`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/fontawesome/css/all.min.css`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/css`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-brands-400.ttf`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-brands-400.woff2`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-regular-400.ttf`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-regular-400.woff2`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-solid-900.ttf`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-solid-900.woff2`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-v4compatibility.ttf`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/fontawesome/webfonts/fa-v4compatibility.woff2`
Direktori: `android/app/src/main/assets/public/vendor/fontawesome/webfonts`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/html2pdf/html2pdf.bundle.min.js`
Direktori: `android/app/src/main/assets/public/vendor/html2pdf`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/html5-qrcode/html5-qrcode.min.js`
Direktori: `android/app/src/main/assets/public/vendor/html5-qrcode`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/jszip/jszip.min.js`
Direktori: `android/app/src/main/assets/public/vendor/jszip`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/qrcodejs/qrcode.min.js`
Direktori: `android/app/src/main/assets/public/vendor/qrcodejs`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/tesseract/ind.traineddata.gz`
Direktori: `android/app/src/main/assets/public/vendor/tesseract`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/assets/public/vendor/tesseract/ocr-worker.js`
Direktori: `android/app/src/main/assets/public/vendor/tesseract`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/tesseract/tesseract-core.wasm.js`
Direktori: `android/app/src/main/assets/public/vendor/tesseract`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/tesseract/tesseract.min.js`
Direktori: `android/app/src/main/assets/public/vendor/tesseract`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/tesseract/worker.min.js`
Direktori: `android/app/src/main/assets/public/vendor/tesseract`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/assets/public/vendor/xlsx/xlsx.full.min.js`
Direktori: `android/app/src/main/assets/public/vendor/xlsx`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `android/app/src/main/java/id/sch/simni/app/MainActivity.java`
Direktori: `android/app/src/main/java/id/sch/simni/app`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/drawable-land-hdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-land-hdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-land-mdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-land-mdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-land-xhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-land-xhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-land-xxhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-land-xxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-land-xxxhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-land-xxxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-port-hdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-port-hdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-port-mdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-port-mdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-port-xhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-port-xhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-port-xxhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-port-xxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-port-xxxhdpi/splash.png`
Direktori: `android/app/src/main/res/drawable-port-xxxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`
Direktori: `android/app/src/main/res/drawable-v24`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/drawable/ic_launcher_background.xml`
Direktori: `android/app/src/main/res/drawable`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/drawable/splash.png`
Direktori: `android/app/src/main/res/drawable`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/layout/activity_main.xml`
Direktori: `android/app/src/main/res/layout`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
Direktori: `android/app/src/main/res/mipmap-anydpi-v26`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
Direktori: `android/app/src/main/res/mipmap-anydpi-v26`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
Direktori: `android/app/src/main/res/mipmap-hdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png`
Direktori: `android/app/src/main/res/mipmap-hdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png`
Direktori: `android/app/src/main/res/mipmap-hdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
Direktori: `android/app/src/main/res/mipmap-mdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png`
Direktori: `android/app/src/main/res/mipmap-mdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png`
Direktori: `android/app/src/main/res/mipmap-mdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
Direktori: `android/app/src/main/res/mipmap-xhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png`
Direktori: `android/app/src/main/res/mipmap-xhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png`
Direktori: `android/app/src/main/res/mipmap-xhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
Direktori: `android/app/src/main/res/mipmap-xxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png`
Direktori: `android/app/src/main/res/mipmap-xxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png`
Direktori: `android/app/src/main/res/mipmap-xxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
Direktori: `android/app/src/main/res/mipmap-xxxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png`
Direktori: `android/app/src/main/res/mipmap-xxxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png`
Direktori: `android/app/src/main/res/mipmap-xxxhdpi`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/app/src/main/res/values/ic_launcher_background.xml`
Direktori: `android/app/src/main/res/values`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/values/strings.xml`
Direktori: `android/app/src/main/res/values`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/values/styles.xml`
Direktori: `android/app/src/main/res/values`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/xml/config.xml`
Direktori: `android/app/src/main/res/xml`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/main/res/xml/file_paths.xml`
Direktori: `android/app/src/main/res/xml`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`
Direktori: `android/app/src/test/java/com/getcapacitor/myapp`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/build.gradle`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor-cordova-android-plugins/build.gradle`
Direktori: `android/capacitor-cordova-android-plugins`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor-cordova-android-plugins/cordova.variables.gradle`
Direktori: `android/capacitor-cordova-android-plugins`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml`
Direktori: `android/capacitor-cordova-android-plugins/src/main`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor-cordova-android-plugins/src/main/java/.gitkeep`
Direktori: `android/capacitor-cordova-android-plugins/src/main/java`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor-cordova-android-plugins/src/main/res/.gitkeep`
Direktori: `android/capacitor-cordova-android-plugins/src/main/res`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/capacitor.settings.gradle`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/gradle.properties`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/gradle/wrapper/gradle-wrapper.jar`
Direktori: `android/gradle/wrapper`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `android/gradle/wrapper/gradle-wrapper.properties`
Direktori: `android/gradle/wrapper`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/gradlew`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/gradlew.bat`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/settings.gradle`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `android/variables.gradle`
Direktori: `android`. Fungsi: Wrapper Android/Capacitor dan konfigurasi native.

### `capacitor.config.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Root konfigurasi: `appId`, `appName`, `webDir`, `server`, `plugins`

### `edge/README.md`
Direktori: `edge`. Fungsi: Backend Worker: autentikasi, kebijakan aset dan operasi administratif.

### `edge/admin-operations.js`
Direktori: `edge`. Fungsi: Backend Worker: autentikasi, kebijakan aset dan operasi administratif.

Dependensi:
~~~~text
1: import '../features/backup/backup-core.js';
2: import '../js/auth/access-policy-core.js';
3: import '../js/database/workspace-paths-core.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
8: const error = (message, extra = {}) => Object.assign(new Error(message), { definiteRejection: true }, extra);
9: const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
11: export async function recoverAdminOperation(io, identity, operationId) {
34: export async function executeAdminOperation(io, identity, body) {
63: const others = Object.entries(index).filter(([id]) => id !== targetId);
76: const entry = Object.entries(users).find(([, p]) => p.email === email);
~~~~

### `edge/worker.js`
Direktori: `edge`. Fungsi: Backend Worker: autentikasi, kebijakan aset dan operasi administratif.

Dependensi:
~~~~text
1: import { executeAdminOperation, recoverAdminOperation } from './admin-operations.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
15: function json(status, body, extra = {}) {
26: function cors(request, env) {
42: function base64UrlDecode(value) {
44: const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
48: function base64UrlEncode(bytes) {
55: function pemToBytes(pem) {
60: async function firebasePublicKeys() {
67: const keys = Object.fromEntries((data.keys || []).filter((key) => key?.kid).map((key) => [key.kid, key]));
73: async function verifyFirebaseIdToken(token, projectId) {
93: async function serviceJwt(env) {
113: async function googleAccessToken(env) {
121: const data = await response.json().catch(() => null);
127: function bearerToken(request) {
133: function requireEnv(env) {
140: function requireCloudinary(env) {
149: function hex(bytes) {
153: async function cloudinarySignature(params, secret) {
162: function scopedPublicId(profile, purpose, suffix = crypto.randomUUID()) {
166: async function authoritativeProfile(env, uid) {
185: async function authenticated(request, env) {
193: async function destroyCloudinaryAsset(env, publicId, resourceType) {
211: const result = await response.json().catch(() => null);
216: async function createCloudinarySignature(request, env, identity) {
218: const body = await request.json().catch(() => ({}));
241: async function deleteCloudinaryAsset(request, env, identity) {
243: const body = await request.json().catch(() => ({}));
254: async function route(request, env) {
277: async function db(path, method = 'GET', value, asUser = false, extraHeaders = {}) {
~~~~

### `edge/wrangler.jsonc`
Direktori: `edge`. Fungsi: Backend Worker: autentikasi, kebijakan aset dan operasi administratif.
Root konfigurasi: `$schema`, `name`, `main`, `compatibility_date`, `compatibility_flags`, `workers_dev`, `preview_urls`, `observability`, `vars`

### `features/archive/archive.js`
Direktori: `features/archive`. Fungsi: Modul arsip data tahun ajaran. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/archive/archive.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
8: (function initSIMNIAnnualArchive() {
20: function notify(message, type = 'info') {
32: function showProgress(message) {
38: function hideProgress() {
44: function access() {
51: function backupCore() {
58: function backupFeature() {
65: function nowISO() {
70: function cleanText(value) {
77: function normalizeError(
94: function requireArchiveAccess() {
138: function requireOnlineDatabase() {
170: function requireBackupAuthority() {
207: function randomSuffix() {
240: function archiveId() {
254: function assertEnvelopeScope(
318: function assertEnvelopeComplete(
391: async function buildVerifiedCurrentEnvelope() {
439: function archivePayloadFromEnvelope(
584: async function verifyAnnualArchive(
783: async function createAnnualArchiveCloud() {
1040: async function getVerifiedAnnualArchive() {
1239: async function openAnnualArchiveManager() {
1250: const close = document.createElement('button'); close.textContent = 'Tutup'; close.onclick = () => { dialog.close(); dialog.remove(); };
1253: const sameOwner = () => ['uid', 'workspaceId', 'activeAcademicYearId'].every(key => owner[key] === window.SIMNICurrentAccess?.[key]);
1254: async function page(before = null, metadataOnly = true) {
1309: const addPageButton = (text, cursor, mode) => {
1321: function getRuntimeSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
21: if (typeof window.toast === 'function') {
33: if (typeof window.showLoad === 'function') {
39: if (typeof window.hideLoad === 'function') {
1250: const close = document.createElement('button'); close.textContent = 'Tutup'; close.onclick = () => { dialog.close(); dialog.remove(); };
1264: repair.onclick = async () => {
1276: download.onclick = async () => {
1295: input.onchange = async () => {
1311: button.onclick = () => page(cursor, mode).catch(error => { status.textContent = error.message; }); list.append(button);
1346: window.SIMNIArchive =
~~~~

### `features/attendance/attendance.html`
Direktori: `features/attendance`. Fungsi: Modul presensi tanggal pilihan dan rekap. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 8,
    "tag": "button",
    "data-simni-action": "setPresensiTab",
    "id": "tab-presensi-input"
  },
  {
    "line": 9,
    "tag": "button",
    "data-simni-action": "setPresensiTab",
    "id": "tab-presensi-rekap"
  },
  {
    "line": 15,
    "tag": "input",
    "type": "date",
    "id": "presensi-date",
    "aria-label": "Tanggal presensi",
    "data-simni-action": "renderPresensiManual"
  },
  {
    "line": 16,
    "tag": "button",
    "data-simni-action": "openQRScanner"
  },
  {
    "line": 22,
    "tag": "button",
    "id": "presensi-primary-action",
    "data-simni-action": "savePresensiManual"
  },
  {
    "line": 30,
    "tag": "select",
    "id": "filter-presensi-waktu",
    "data-simni-action": "renderRekapPresensi"
  },
  {
    "line": 37,
    "tag": "input",
    "type": "date",
    "id": "filter-presensi-tanggal",
    "data-simni-action": "renderRekapPresensi"
  },
  {
    "line": 40,
    "tag": "select",
    "id": "filter-presensi-siswa",
    "data-simni-action": "renderRekapPresensi"
  },
  {
    "line": 45,
    "tag": "button",
    "data-simni-action": "cetakRekapPresensiPDF"
  },
  {
    "line": 62,
    "tag": "template",
    "data-simni-modal": null
  },
  {
    "line": 65,
    "tag": "button",
    "data-simni-action": "closeQRScanner"
  }
]
~~~~

### `features/attendance/attendance.js`
Direktori: `features/attendance`. Fungsi: Modul presensi tanggal pilihan dan rekap. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/attendance/attendance.js

Fungsi dan cabang entry point:
~~~~text
6: function setPresensiTab(tab) {
19: function activeAttendanceStudents() {
28: function attendanceCompleteForDate(date, students = activeAttendanceStudents()) {
34: function renderPresensiManual() {
65: const existing = state.presensi.find((item) => normalizeDate(item.Tanggal) === date && academicNisn(item.NISN) === academicNisn(student.NISN) && academicRecordClass(item) === academicRecordClass(student));
77: function editPresensiManual() {
84: async function savePresensiManual() {
96: const invalid = activeAttendanceStudents().filter(student => !/^\d{10}$/.test(academicNisn(student.NISN)));
100: const displayedNisns = [...document.querySelectorAll('#presensi-table-body .p-nisn')].map(input => academicNisn(input.value));
131: const committedNisn = new Set(committed.map((item) => item.NISN));
142: async function openQRScanner() {
159: async function closeQRScanner() {
171: async function onScanSuccess(decodedText) {
177: const student = activeAttendanceStudents().find((item) => academicNisn(item.NISN) === nisn);
211: function filteredAttendance() {
217: let items = state.presensi.filter((item) => {
228: function renderRekapPresensi() {
236: const rows = [...items].sort((a, b) => (a.Nama || '').localeCompare(b.Nama || '')).map((item) => {
250: async function cetakRekapPresensiPDF() {
256: const rows = [...items].sort((a, b) => (a.Nama || '').localeCompare(b.Nama || '')).map((item, index) => `<tr><td style="border:1px solid #000;padding:5px;text-align:center">${index + 1}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(item.Nama)}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(normalizeDate(item.Tanggal))}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(item.Status)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(item.Keterangan || '-')}</td></tr>`).join('');
~~~~

Binding event/aksi publik:
~~~~text
279: window.setPresensiTab = setPresensiTab;
280: window.renderPresensiManual = renderPresensiManual;
281: window.savePresensiManual = savePresensiManual;
282: window.editPresensiManual = editPresensiManual;
283: window.openQRScanner = openQRScanner;
284: window.closeQRScanner = closeQRScanner;
285: window.renderRekapPresensi = renderRekapPresensi;
286: window.cetakRekapPresensiPDF = cetakRekapPresensiPDF;
~~~~

### `features/backup/backup-core.js`
Direktori: `features/backup`. Fungsi: Modul backup, validasi scope dan restore. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIBackupCore(root, factory) {
5: }(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIBackupCore() {
73: function getSubsystemRecoveryManifest(access = null) {
92: function deepClone(value) {
96: function sanitizeFirebaseKey(value, fallback = 'tanpa_id') {
102: function canonicalize(value) {
113: function canonicalStringify(value) {
117: async function sha256(value) {
125: function setAtPath(target, path, value) {
138: function getAtPath(source, path) {
142: function indexCollection(collection, keyBuilder) {
153: function stateToDatabase(state = {}) {
154: const safe = (value, fallback) => value === undefined || value === null ? fallback : value;
177: function normalizeKnownCollections(database) {
192: function filterAllowedDatabase(database) {
202: function isLegacyState(value) {
208: function extractDatabase(parsed) {
215: async function createEnvelope(database, metadata = {}) {
254: async function verifyEnvelope(envelope) {
263: function validateRestoreScope(envelope, access) {
281: function filterDatabaseToPaths(database, allowedPaths = DATA_PATHS) {
291: function countRecords(value) {
298: function summarizeDatabase(database) {
304: function flattenForMerge(database, allowedPaths = DATA_PATHS) {
307: function walk(value, path) {
320: function buildReplaceUpdates(database, allowedPaths = DATA_PATHS) {
329: function safeFilenamePart(value, fallback) {
335: function createFilename(metadata = {}, prefix = 'SIMNI_Backup') {
~~~~

### `features/backup/backup.js`
Direktori: `features/backup`. Fungsi: Modul backup, validasi scope dan restore. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIBackupFeature() {
10: const notify = (message, type = 'info') => typeof window.toast === 'function' ? window.toast(message, type) : console.log(message);
11: const showProgress = (message) => typeof window.showLoad === 'function' && window.showLoad(message);
12: const hideProgress = () => typeof window.hideLoad === 'function' && window.hideLoad();
13: const currentSettings = () => window.SIMNILPSCore?.normalizeSettings(window.state?.pengaturan || {}) || (window.state?.pengaturan || {});
14: const currentUser = () => typeof window.getCurrentUserMeta === 'function' ? window.getCurrentUserMeta() : { uid: null, email: null };
15: const currentAccess = () => window.SIMNICurrentAccess || null;
16: const allowedDataPaths = () => core.DATA_PATHS.filter((path) => {
21: function setAtPath(target, path, value) {
25: async function gatherDatabase() {
33: const results = await Promise.all(allowedPaths.map(async (path) => {
62: function downloadBlob(blob, filename) {
78: function downloadEnvelope(envelope, prefix) {
92: async function buildCurrentEnvelope() {
116: async function exportDataLokal(options = {}) {
140: function formatSummary(summary) {
152: async function inspectBackupPayload(parsed) {
161: async function readDatabasePaths(paths) {
163: const results = await Promise.all(paths.map(async (path) => ({ path, result: await window.dbGet(path) })));
164: const failed = results.filter(({ result }) => !result?.ok);
170: async function verifyRestore(mode, inspected, updates) {
185: async function rollbackFromSafetyBackup(safetyBackup, allowedPaths) {
197: async function restoreParsedBackup(parsed, options = {}) {
242: async function importDataLokal(event) {
298: function toRows(collection) {
309: async function exportArsipTotalExcel() {
321: const addSheet = (name, rows) => {
362: async function verifyAnnualArchiveFile(event) {
403: function openSubsystemRecoveryGuide() {
410: const esc = (str) => typeof window.escapeHTML === 'function' ? window.escapeHTML(str) : String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
~~~~

Binding event/aksi publik:
~~~~text
10: const notify = (message, type = 'info') => typeof window.toast === 'function' ? window.toast(message, type) : console.log(message);
11: const showProgress = (message) => typeof window.showLoad === 'function' && window.showLoad(message);
12: const hideProgress = () => typeof window.hideLoad === 'function' && window.hideLoad();
14: const currentUser = () => typeof window.getCurrentUserMeta === 'function' ? window.getCurrentUserMeta() : { uid: null, email: null };
32: if (databaseReachable && window.isUserLoggedIn && (typeof window.dbFetchCompleteCollection === 'function' || typeof window.dbGet === 'function')) {
35: if (typeof window.dbFetchCompleteCollection === 'function') {
38: if (!result?.ok && typeof window.dbGet === 'function') {
410: const esc = (str) => typeof window.escapeHTML === 'function' ? window.escapeHTML(str) : String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
446: closeBtn.onclick = () => { dialog.close(); dialog.remove(); };
454: window.SIMNIBackup = Object.freeze({
~~~~

### `features/dashboard/dashboard.html`
Direktori: `features/dashboard`. Fungsi: Modul ringkasan dan versi aplikasi. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 24,
    "tag": "button",
    "data-simni-action": "openAttendanceScanner"
  },
  {
    "line": 25,
    "tag": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 26,
    "tag": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 27,
    "tag": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 28,
    "tag": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 29,
    "tag": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 30,
    "tag": "button",
    "data-simni-action": "openStudentsCreate"
  }
]
~~~~

### `features/dashboard/dashboard.js`
Direktori: `features/dashboard`. Fungsi: Modul ringkasan dan versi aplikasi. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/dashboard/dashboard.js

Fungsi dan cabang entry point:
~~~~text
6: function renderDashboard() {
9: const myStudents = currentKelas ? state.students.filter(s => s.Kelas === currentKelas) : state.students;
10: const myJurnal = currentKelas ? state.jurnal.filter(j => j.Kelas === currentKelas) : state.jurnal;
11: const myPresensi = currentKelas ? state.presensi.filter(p => p.Kelas === currentKelas) : state.presensi;
12: const myNilai = currentKelas ? state.nilaiTP.filter(n => n.Kelas === currentKelas) : state.nilaiTP;
19: const hadir = myPresensi.filter(p => normalizeDate(p.Tanggal)===today && (p.Status||'').toLowerCase()==='hadir').length;
~~~~

### `features/documents/documents.html`
Direktori: `features/documents`. Fungsi: Modul metadata dokumen dan operasi Cloudinary. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 7,
    "tag": "button",
    "data-simni-action": "openModal"
  },
  {
    "line": 10,
    "tag": "button",
    "data-simni-action": "setDokumenTab",
    "id": "tab-admin"
  },
  {
    "line": 11,
    "tag": "button",
    "data-simni-action": "setDokumenTab",
    "id": "tab-lkpd"
  },
  {
    "line": 17,
    "tag": "template",
    "data-simni-modal": null
  },
  {
    "line": 22,
    "tag": "button",
    "data-simni-action": "closeModal"
  },
  {
    "line": 24,
    "tag": "form",
    "data-simni-action": "submitDokumenMurni"
  },
  {
    "line": 26,
    "tag": "select",
    "id": "input-doc-kat"
  },
  {
    "line": 27,
    "tag": "select",
    "id": "input-doc-mapel"
  },
  {
    "line": 28,
    "tag": "input",
    "type": "text",
    "id": "input-doc-nama"
  },
  {
    "line": 29,
    "tag": "input",
    "type": "file",
    "id": "input-doc-file"
  },
  {
    "line": 30,
    "tag": "button",
    "type": "submit",
    "id": "btn-upload-murni"
  }
]
~~~~

### `features/documents/documents.js`
Direktori: `features/documents`. Fungsi: Modul metadata dokumen dan operasi Cloudinary. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/documents/documents.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
8: (function initSIMNIDocuments() {
33: function byId(
41: function requireDocumentsAccess() {
58: function assertDocumentsAccess() {
85: function normalizeTab(
105: function currentTab() {
115: function documentCollection() {
124: function documentId(
136: function safeDocumentId(
168: function createDocumentId() {
192: function safeHTTPS(
219: function cloudinaryDownloadURL(
245: function documentIcon(
331: function setTabButtonState(
362: function setUploadButtonState() {
400: function renderDocumentsUI() {
432: function createEmptyState() {
447: function createActionLink({
497: function createDocumentCard(
767: function renderDokumenList() {
874: function setDokumenTab(
902: function validateDocumentFile(
950: function formPayload() {
987: async function loadCloudinary() {
1011: async function cleanupUploadedDocument(
1040: async function submitDokumenMurni(
1295: async function hapusDokumen(
1480: function getDocumentsRuntimeSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
140: typeof window.safeFirebaseKey ===
745: deleteButton.addEventListener(
890: typeof window.state ===
1519: window.SIMNIDocuments =
1539: typeof window.state ===
~~~~

### `features/gadm/gadm-curriculum-2026.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.
Keterangan source: "authority": "Kementerian Pendidikan Dasar dan Menengah / BSKAP",; "authority": "Kementerian Pendidikan Dasar dan Menengah / BKPDM",

### `features/gadm/gadm-docx.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
6: function escapeXml(str) {
16: function textRun(text, { bold = false, italic = false, size = 22, color = '1F2937' } = {}) {
27: function paragraph(runsXml, { align = 'left', spaceBefore = 80, spaceAfter = 120, lineSpacing = 276 } = {}) {
33: function headingParagraph(text, level = 1) {
43: function tableCell(cellXml, { width = null, isHeader = false, shading = null } = {}) {
51: function parseDomToOpenXml(container) {
54: function processNode(node) {
109: const col1Pars = Array.from(divs[0].querySelectorAll('p')).map((p) => p.textContent?.trim()).filter(Boolean);
110: const col2Pars = Array.from(divs[1].querySelectorAll('p')).map((p) => p.textContent?.trim()).filter(Boolean);
112: const c1Xml = col1Pars.map((t, idx) => {
117: const c2Xml = col2Pars.map((t, idx) => {
122: const noBorderCell = (inner) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr>${inner}</w:tc>`;
191: export async function createDocxBlob(snapshot) {
~~~~

### `features/gadm/gadm-engine.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.

Dependensi:
~~~~text
1: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
30: export const GADM_ENGINE = (() => {
59: function configureHost(adapter) {
72: function normalizeHostInput(input) {
81: function lifecycleOptions() {
88: const normalizeText = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
89: const normalizeMultiline = (value) => String(value ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
90: const normalizeId = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
91: const compact = (items) => items.filter((item) => item != null && item !== "");
92: const unique = (items) => [...new Set(compact(items))];
94: function stableHash(input) {
104: function deterministicPick(items, seed = "gadm") {
109: function deterministicMany(items, count, seed = "gadm") {
122: function escapeHTML(value) {
131: function stripTerminalPunctuation(value) {
135: function sentenceCase(value) {
140: function ensureSentence(value) {
146: function asList(value) {
154: function formatNumber(value) {
159: function joinNatural(items) {
167: function getByPath(source, path) {
237: function makeIssue(code, message, field = null, severity = "error") {
241: function mergeValidation(...reports) {
251: function parsePipeRows(value, options = {}) {
258: const parts = line.split("|").map((part) => part.trim());
264: function parsePositiveNumber(value) {
271: function parseTimeAllocation(input = {}) {
304: function buildTeacherContext(input, phase) {
327: function resolveCurriculumGrounding(input, phase) {
351: function plannedProfileEvidence(profileEntries, phase, seed) {
361: function translateReasonCodes(codes) {
365: function buildDecisionExplanations({ model, media, profiles, assessments, context }) {
375: function qualityIssuesFromAudit(audit) {
384: function buildConsistencyEnvelope(type, input, data = {}) {
398: function registerDocument(type, input, result) {
407: function resolveProfileDimensions(rawValue, phase, seed, reasoningContext = {}) {
426: function resolveMethods(phase, contextText, seed, preferredCount = 2, teacherContext = null) {
432: const scored = entries.map(([key, method]) => {
436: const purposeWords = normalizeText(purpose).toLowerCase().split(/\s+/).filter((word) => word.length >= 5);
448: const strongest = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "id"));
453: function resolveMedia(phase, seed, count = 3, teacherContext = null, explicitValue = "") {
460: const remainder = base.filter((item) => !primary.includes(item));
466: function resolveKko(contextText, seed) {
479: function resolveModel(input, phase, seed, teacherContext = null) {
483: const selected = models.find((model) => [normalizeId(model.id), normalizeId(model.label)].includes(requested));
504: const selected = models.find((model) => model.id === chosen?.id) ?? models.find((model) => model.id === "explicit_instruction") ?? models[0];
508: function modelSyntaxLabel(stepId) {
512: function buildModulePlan(input, seed) {
563: const modelSyntax = model.syntax.map((step, index) => ({
645: function renderIssues(validation) {
656: function renderHeader(title, subtitle = "") {
660: function renderKeyValue(rows) {
664: function renderBullets(items) {
668: function renderTable(headers, rows) {
672: function renderFormatBasis(documentName) {
678: function renderApprovalBlock(input) {
685: function renderQualityAudit(audit) {
687: const rows = audit.checks.map((item) => [item.status === "pass" ? "✓" : item.status === "warning" ? "!" : "×", sentenceCase(item.id), item.message]);
691: function renderDecisionExplanations(explanations) {
703: function renderTeacherContext(context) {
708: function renderTimePlan(timePlan) {
711: const rows = Object.entries(timePlan.segments).map(([key, value]) => [labels[key] || sentenceCase(key), `${value} menit`]);
716: function renderCurriculumGrounding(curriculum) {
723: function resultFromHTML(type, title, html, text, validation, data = {}) {
727: function generateModule(input, seed) {
732: const text = ["MODUL AJAR — GENERASI DIBLOKIR", ...validation.errors.map((item) => `- ${item.message || item.code}`)].join("\n");
737: const profileLabels = profiles.map((item) => item.label);
769: const syntaxRows = plan.modelSyntax.map((step, index) => {
781: const profileRows = profiles.map((item) => [
993: function generateProta(input) {
998: const parsed = rows.map((row) => ({
1011: const totalRows = parsed.reduce((sum, row) => sum + (row.jp || 0), 0);
1022: const tableRows = parsed.map((row, index) => [String(index + 1), row.semester, row.unit, `${formatNumber(row.jp)} JP`, ""]);
1053: function generatePromes(input) {
1058: const parsed = rows.map((row) => ({ unit: row.parts[0], jp: parsePositiveNumber(row.parts[1]), periode: normalizeText(row.parts[2]) }));
1072: const total = parsed.reduce((sum, row) => sum + row.jp, 0);
1103: function generateSilabus(input, seed) {
1125: const rows = targets.map((target, index) => {
1151: function resolveDimensionEntries(rawValue) {
1159: function generateKokurikuler(input, seed) {
1191: function normalizeAchievementState(value) {
1208: function generateERapor(input, seed) {
1242: function generateLKPDRubrik(input, seed) {
1288: const rubricRows = rawRubricCriteria.map((crit) => {
1395: function generateDocument(rawInput) {
1417: function inspectTeacherIntelligence(input = {}) {
1434: function validateCurrentBundle(bundle = state.documentBundle) {
1438: function resetDocumentBundle() {
1443: function collectInput(root = document) {
1444: const get = (id) => root.querySelector(`#${id}`)?.value ?? "";
1498: function setFieldVisibility(type) {
1505: function renderResult(result) {
1524: async function saveDraft(input) {
1543: function populateInputFields(input) {
1558: async function restoreDraft() {
1565: function reportAsyncError(error) {
1574: function triggerGenerate({ incrementVariation = false } = {}) {
1596: function setResultActionsEnabled(enabled) {
1603: function renderEmptyPreview() {
1609: function startNewDocument() {
1645: async function copyOutput() {
1661: function downloadText() {
1676: function printOutput() {
1686: async function printOutputImplementation() {
1731: function injectStandaloneStyles() {
1744: function injectStandaloneUI(root) {
1845: function populateModelOptions() {
1858: function syncDocumentNavigation(type) {
1873: function setWizardStep(nextStep) {
1898: function setTeacherMode(mode) {
1909: function setMobilePane(pane) {
1918: function scrollGadmToTop() {
1929: function toggleContextChip(button) {
1943: function updateQualitySummary(result) {
1974: function bindTeacherCopilotUI(typeSelect) {
2004: function bindUI() {
2049: function preflight() {
2061: async function mount(adapter = null) {
2086: function unmount() {
2100: function snapshot() {
2109: function loadInput(input) {
~~~~

Binding event/aksi publik:
~~~~text
1924: if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
1978: button.addEventListener("click", () => {
1986: document.querySelectorAll("[data-gadm-step-target]").forEach((button) => button.addEventListener("click", () => setWizardStep(button.dataset.gadmStepTarget), options));
1987: document.querySelector("#gadm-step-prev")?.addEventListener("click", () => {
1991: document.querySelector("#gadm-step-next")?.addEventListener("click", () => {
1995: document.querySelectorAll("[data-gadm-mode-value]").forEach((button) => button.addEventListener("click", () => setTeacherMode(button.dataset.gadmModeValue), options));
1996: document.querySelectorAll("[data-gadm-context-target]").forEach((button) => button.addEventListener("click", () => toggleContextChip(button), options));
1997: document.querySelectorAll("[data-gadm-pane-value]").forEach((button) => button.addEventListener("click", () => setMobilePane(button.dataset.gadmPaneValue), options));
2015: type?.addEventListener("change", () => {
2020: document.querySelector(".gadm-controls")?.addEventListener("submit", (event) => {
2024: generate?.addEventListener("click", () => triggerGenerate(), options);
2025: variation?.addEventListener("click", () => triggerGenerate({ incrementVariation: true }), options);
2026: copy?.addEventListener("click", () => void copyOutput().catch(reportAsyncError), options);
2027: print?.addEventListener("click", () => void printOutput().catch(reportAsyncError), options);
2028: download?.addEventListener("click", downloadText, options);
2031: element.addEventListener("change", () => void saveDraft(collectInput()).catch(reportAsyncError), options);
2034: document.addEventListener("gadm:generate", (event) => {
~~~~

### `features/gadm/gadm-kb.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.

Dependensi:
~~~~text
1: import GADM_CURRICULUM_2026 from "./gadm-curriculum-2026.js";
~~~~

Fungsi dan cabang entry point:
~~~~text
56: function unique(values) {
60: function normalizeText(value) {
67: function normalizeId(value) {
74: function stableHash(input) {
84: function deterministicPick(items, seed = "gadm") {
89: function hasAny(haystack, needles) {
1759: export function resolvePhase(value) {
1791: export function recommendModels(context = {}) {
1805: const addScore = (modelId, score, reason) => {
1834: const model = models.find((item) => item.id === modelId);
1853: export function pickLanguageVariant(kind, seed) {
1862: function validateRequiredFields(target, requiredFields) {
1883: function getModelByAnyId(value) {
1898: export function validateLearningPlan(plan = {}) {
1965: const missingSteps = model.syntax.filter((step) => !provided.includes(normalizeId(step)));
2023: export function validateDocumentInput(documentType, input = {}) {
2064: export function validateERaporEvidence(input = {}) {
2112: export function resolveSubject(value) {
2117: const candidates = [subject.label, ...(subject.aliases ?? [])].map((item) => normalizeText(item).toLowerCase());
2126: export function resolveCurriculumSource(subjectValue) {
2151: export function validateCurriculumRecord(record = {}) {
2179: export function findCurriculumRecords(criteria = {}) {
2195: function curriculumSearchTokens(value) {
2200: function curriculumSegments(officialText) {
2206: function scoreCurriculumSegment(segment, topicTokens) {
2215: export function recommendOfficialCp(criteria = {}) {
2259: export function suggestLearningObjective(criteria = {}) {
2279: function normalizeContextFlags(context = {}) {
2293: export function recommendContextSupports(context = {}) {
2303: const explicit = Array.isArray(context.contextFlags) && context.contextFlags.some((flag) => normalizeId(flag) === normalizeId(item.id));
2322: function rebalanceWeights(weights) {
2323: const positive = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0.02, Number(value) || 0)]));
2324: const sum = Object.values(positive).reduce((a, b) => a + b, 0) || 1;
2328: function allocateIntegerMinutes(totalMinutes, weights, segmentOrder) {
2329: const raw = segmentOrder.map((key) => ({ key, raw: totalMinutes * (weights[key] ?? 0) }));
2330: const base = raw.map((item) => ({ ...item, value: Math.floor(item.raw), fraction: item.raw - Math.floor(item.raw) }));
2331: let assigned = base.reduce((sum, item) => sum + item.value, 0);
2332: const order = [...base].sort((a, b) => b.fraction - a.fraction || segmentOrder.indexOf(a.key) - segmentOrder.indexOf(b.key));
2336: const target = base.find((item) => item.key === targetKey);
2344: function enforceMinimumSegmentMinutes(segments, totalMinutes) {
2349: const minimumTotal = Object.values(minimums).reduce((a, b) => a + b, 0);
2375: export function planLessonTime(context = {}) {
2405: export function validateTimeBudget(timePlan = {}, availableMinutes = null) {
2409: const sum = Object.values(segments).filter((v) => Number.isFinite(Number(v))).reduce((a, b) => a + Number(b), 0);
2420: export function repairTimeBudget(timePlan = {}, context = {}) {
2430: export function recommendProfileDimensions(context = {}) {
2435: const hits = rule.signals.filter((signal) => text.includes(signal.toLowerCase()));
2450: export function validateProfileEvidence(selectedDimensions = [], evidence = {}) {
2453: const normalized = selectedDimensions.map((item) => typeof item === "string" ? item : item.dimension).filter(Boolean);
2464: export function explainDecision(kind, selected, context = {}) {
2471: const rec = recs.find((item) => model && item.id === model.id) ?? recs[0];
2487: export function validateCrossDocumentConsistency(bundle = {}) {
2490: const entries = Object.entries(bundle).filter(([, value]) => value && typeof value === "object");
2493: const observed = unique(entries.map(([, doc]) => normalizeText(doc[key])).filter(Boolean));
2502: function makeQualityCheck(id, status, message, detail = null) {
2509: export function auditGeneratedDocument(payload = {}) {
2532: const syntaxOk = !model || syntaxProvided.length === 0 ? null : model.syntax.every((step) => syntaxProvided.map(normalizeId).includes(normalizeId(step)));
2553: const experienceOk = DEEP_LEARNING_EXPERIENCES.every((key) => Boolean(experienceContainer?.[key]));
2557: const forbidden = GADM_KB.antiHallucination.forbiddenInferences.filter((term) => serialized.includes(term.toLowerCase()));
2561: const score = Math.round((checks.reduce((sum, item) => sum + (scoring[item.status] ?? 0), 0) / checks.length) * 100);
2562: const fails = checks.filter((item) => item.status === "fail");
2563: const warnings = checks.filter((item) => item.status === "warning");
2568: export function buildRepairPlan(audit = {}) {
2587: export function selfAuditKB() {
2624: const forbiddenModel = Object.values(GADM_KB.modelPembelajaran).some((model) =>
~~~~

### `features/gadm/gadm-storage.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
10: function cleanScopePart(value, label) {
18: export function createGADMScope(context) {
38: function clonePlain(value, label) {
55: function requestResult(request, errorMessage) {
62: function transactionDone(transaction) {
70: function openDatabase() {
90: async function withStore(storeName, mode, operation) {
104: function validDocumentId(value) {
110: export async function loadGADMDraft(scope) {
118: export async function saveGADMDraft(scope, input) {
147: export async function saveGADMDocument(scope, documentRecord) {
191: export async function listGADMDocuments(scope, { before = null, limit = 20 } = {}) {
218: export async function getGADMDocument(scope, documentId) {
227: export async function deleteGADMDocument(scope, documentId) {
233: export async function listGADMStorageScopes(scope) {
256: export async function deleteGADMDraftAfterVerification(scope, exported) {
~~~~

Binding event/aksi publik:
~~~~text
57: request.addEventListener('success', () => resolve(request.result), { once: true });
58: request.addEventListener('error', () => reject(new Error(errorMessage, { cause: request.error })), { once: true });
64: transaction.addEventListener('complete', resolve, { once: true });
65: transaction.addEventListener('abort', () => reject(new Error('Transaksi IndexedDB GADM dibatalkan.', { cause: transaction.error })), { once: true });
66: transaction.addEventListener('error', () => reject(new Error('Transaksi IndexedDB GADM gagal.', { cause: transaction.error })), { once: true });
73: request.addEventListener('upgradeneeded', () => {
84: request.addEventListener('blocked', () => {
~~~~

### `features/gadm/gadm.css`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Aturan tampilan dan responsivitas.

### `features/gadm/gadm.html`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 21,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 22,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 26,
    "tag": "div",
    "id": "gadm-selector-modal",
    "role": "dialog"
  },
  {
    "line": 29,
    "tag": "button",
    "id": "gadm-selector-close",
    "type": "button",
    "aria-label": "Tutup Pilihan"
  },
  {
    "line": 67,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 68,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 69,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 107,
    "tag": "button",
    "id": "gadm-btn-start-builder",
    "type": "button"
  },
  {
    "line": 123,
    "tag": "select",
    "id": "gadm-document-type",
    "aria-label": "Jenis dokumen"
  },
  {
    "line": 134,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 138,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 142,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 146,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 150,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 154,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 171,
    "tag": "button",
    "id": "gadm-btn-change-doc",
    "type": "button",
    "title": "Pilih kembali dari 4 opsi administrasi"
  },
  {
    "line": 180,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 181,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 186,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 188,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 190,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 192,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 195,
    "tag": "form"
  },
  {
    "line": 196,
    "tag": "input",
    "id": "gadm-seed",
    "type": "hidden"
  },
  {
    "line": 208,
    "tag": "select",
    "id": "gadm-prota-sub-type"
  },
  {
    "line": 218,
    "tag": "input",
    "id": "gadm-nama-sekolah"
  },
  {
    "line": 222,
    "tag": "input",
    "id": "gadm-nama-guru"
  },
  {
    "line": 226,
    "tag": "select",
    "id": "gadm-kelas-fase"
  },
  {
    "line": 237,
    "tag": "select",
    "id": "gadm-mata-pelajaran"
  },
  {
    "line": 256,
    "tag": "input",
    "id": "gadm-materi-unit"
  },
  {
    "line": 261,
    "tag": "input",
    "id": "gadm-lkpd-alokasi"
  },
  {
    "line": 266,
    "tag": "textarea",
    "id": "gadm-materi-lingkup"
  },
  {
    "line": 271,
    "tag": "input",
    "id": "gadm-tahun-pelajaran"
  },
  {
    "line": 275,
    "tag": "input",
    "id": "gadm-prota-total-jp"
  },
  {
    "line": 280,
    "tag": "select",
    "id": "gadm-semester"
  },
  {
    "line": 284,
    "tag": "input",
    "id": "gadm-minggu-efektif-semester"
  },
  {
    "line": 289,
    "tag": "input",
    "id": "gadm-kegiatan-kokurikuler"
  },
  {
    "line": 294,
    "tag": "input",
    "id": "gadm-erapor-materi"
  },
  {
    "line": 321,
    "tag": "button",
    "id": "gadm-use-cp",
    "type": "button"
  },
  {
    "line": 322,
    "tag": "button",
    "id": "gadm-use-tp",
    "type": "button"
  },
  {
    "line": 323,
    "tag": "button",
    "id": "gadm-refresh-curriculum",
    "type": "button"
  },
  {
    "line": 330,
    "tag": "input",
    "id": "gadm-curriculum-record-id",
    "type": "hidden"
  },
  {
    "line": 331,
    "tag": "textarea",
    "id": "gadm-cp-tp"
  },
  {
    "line": 335,
    "tag": "textarea",
    "id": "gadm-tp-manual"
  },
  {
    "line": 341,
    "tag": "textarea",
    "id": "gadm-lkpd-aktivitas"
  },
  {
    "line": 345,
    "tag": "textarea",
    "id": "gadm-lkpd-alat-bahan"
  },
  {
    "line": 349,
    "tag": "textarea",
    "id": "gadm-lkpd-petunjuk"
  },
  {
    "line": 354,
    "tag": "input",
    "id": "gadm-alokasi-waktu"
  },
  {
    "line": 358,
    "tag": "input",
    "id": "gadm-total-menit"
  },
  {
    "line": 363,
    "tag": "input",
    "id": "gadm-jp"
  },
  {
    "line": 367,
    "tag": "input",
    "id": "gadm-menit-per-jp"
  },
  {
    "line": 371,
    "tag": "textarea",
    "id": "gadm-tujuan"
  },
  {
    "line": 375,
    "tag": "input",
    "id": "gadm-bukti-belajar"
  },
  {
    "line": 380,
    "tag": "textarea",
    "id": "gadm-kalender-efektif"
  },
  {
    "line": 384,
    "tag": "textarea",
    "id": "gadm-prota-unit"
  },
  {
    "line": 390,
    "tag": "textarea",
    "id": "gadm-referensi-prota"
  },
  {
    "line": 394,
    "tag": "textarea",
    "id": "gadm-promes-unit"
  },
  {
    "line": 399,
    "tag": "textarea",
    "id": "gadm-evidence-kokurikuler"
  },
  {
    "line": 404,
    "tag": "select",
    "id": "gadm-erapor-status"
  },
  {
    "line": 408,
    "tag": "input",
    "id": "gadm-erapor-kompetensi"
  },
  {
    "line": 412,
    "tag": "textarea",
    "id": "gadm-erapor-evidence"
  },
  {
    "line": 445,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 446,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 447,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 448,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 449,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 450,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 457,
    "tag": "textarea",
    "id": "gadm-kondisi-awal"
  },
  {
    "line": 461,
    "tag": "textarea",
    "id": "gadm-sumber-daya"
  },
  {
    "line": 465,
    "tag": "textarea",
    "id": "gadm-konteks-sekolah"
  },
  {
    "line": 469,
    "tag": "select",
    "id": "gadm-model"
  },
  {
    "line": 474,
    "tag": "input",
    "id": "gadm-target-profil"
  },
  {
    "line": 478,
    "tag": "input",
    "id": "gadm-media"
  },
  {
    "line": 483,
    "tag": "input",
    "id": "gadm-target-dimensi"
  },
  {
    "line": 489,
    "tag": "select",
    "id": "gadm-rubrik-model"
  },
  {
    "line": 498,
    "tag": "textarea",
    "id": "gadm-rubrik-kriteria"
  },
  {
    "line": 503,
    "tag": "input",
    "id": "gadm-erapor-next-step"
  },
  {
    "line": 507,
    "tag": "textarea",
    "id": "gadm-erapor-observation"
  },
  {
    "line": 528,
    "tag": "button",
    "id": "gadm-generate",
    "type": "button"
  },
  {
    "line": 533,
    "tag": "button",
    "id": "gadm-step-prev",
    "type": "button"
  },
  {
    "line": 535,
    "tag": "button",
    "id": "gadm-step-next",
    "type": "button"
  },
  {
    "line": 547,
    "tag": "button",
    "id": "gadm-new-document",
    "type": "button"
  },
  {
    "line": 548,
    "tag": "button",
    "id": "gadm-edit-form",
    "type": "button"
  },
  {
    "line": 549,
    "tag": "button",
    "id": "gadm-download-word",
    "type": "button"
  },
  {
    "line": 550,
    "tag": "button",
    "id": "gadm-download-excel",
    "type": "button"
  },
  {
    "line": 551,
    "tag": "button",
    "id": "gadm-print",
    "type": "button"
  },
  {
    "line": 552,
    "tag": "button",
    "id": "gadm-save",
    "type": "button"
  },
  {
    "line": 553,
    "tag": "button",
    "id": "gadm-history",
    "type": "button"
  },
  {
    "line": 554,
    "tag": "button",
    "id": "gadm-variation",
    "type": "button",
    "title": "Buat alternatif dengan fakta yang sama"
  },
  {
    "line": 555,
    "tag": "button",
    "id": "gadm-copy",
    "type": "button"
  },
  {
    "line": 556,
    "tag": "button",
    "id": "gadm-download-text",
    "type": "button"
  },
  {
    "line": 587,
    "tag": "button",
    "id": "gadm-history-close",
    "type": "button",
    "aria-label": "Tutup riwayat"
  }
]
~~~~

### `features/gadm/gadm.js`
Direktori: `features/gadm`. Fungsi: Modul generator administrasi/modul ajar, penyimpanan dan DOCX. Logika, validasi, handler dan koordinasi data.

Dependensi:
~~~~text
1: import GADM_ENGINE from './gadm-engine.js';
2: import { createDocxBlob } from './gadm-docx.js';
3: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
22: function cleanText(value) {
26: function safeFilename(value) {
31: function notify(message, type = 'info') {
35: function currentContext() {
46: function currentClass(context) {
55: function scopeForContext(context) {
62: function canonicalIdentity(context) {
75: function normalizeInput(input) {
97: function lockCanonicalFields() {
131: function curriculumContext() {
141: function updateCurriculumSuggestion() {
180: function applySuggestion(targetId, value) {
187: function adapterForScope(scope) {
196: function uniqueDocumentId() {
203: function requireValidSnapshot() {
211: async function saveCurrentDocument() {
217: const contentId = Array.from(new Uint8Array(fingerprint), byte => byte.toString(16).padStart(2, '0')).join('');
234: function downloadBlob(blob, filename) {
249: function wordDocumentHTML(snapshot) {
256: function exportWord() {
262: function safeCell(value) {
267: async function exportExcel() {
299: function closeHistory() {
305: function historyButton(label, className, handler) {
315: async function renderHistory(before = null, selectedScope = null) {
334: const exportJson = (payload, filename) => {
418: async function openHistory() {
428: function openSelectorModal() {
446: function closeSelectorModal() {
460: function syncSelectorCardHighlights(choice) {
475: function selectAndStartChoice(choice) {
502: function bindIntegrationUI() {
621: export async function ensureGADMReady() {
654: export function unmountGADM() {
665: export async function refreshGADMContext() {
~~~~

Binding event/aksi publik:
~~~~text
32: if (typeof window.toast === 'function') window.toast(cleanText(message), type);
310: button.addEventListener('click', handler);
332: selector.onchange = () => renderHistory(null, scopes.find(entry => entry.key === selector.value)).catch(error => notify(error.message, 'error'));
350: fileInput.onchange = async () => {
507: document.getElementById('gadm-selector-close')?.addEventListener('click', closeSelectorModal, options);
508: document.querySelector('.gadm-selector-overlay')?.addEventListener('click', closeSelectorModal, options);
512: card.addEventListener('click', (event) => {
518: card.addEventListener('keydown', (e) => {
529: btn.addEventListener('click', (e) => {
536: document.getElementById('gadm-btn-start-builder')?.addEventListener('click', () => {
540: document.getElementById('gadm-btn-change-doc')?.addEventListener('click', () => {
544: document.getElementById('gadm-prota-sub-type')?.addEventListener('change', (e) => {
553: document.getElementById('gadm-document-type')?.addEventListener('change', (e) => {
565: btn.addEventListener('click', () => {
570: document.getElementById('gadm-save')?.addEventListener('click', () => void saveCurrentDocument().catch((error) => notify(error.message || error, 'error')), options);
571: document.getElementById('gadm-history')?.addEventListener('click', () => void openHistory().catch((error) => notify(error.message || error, 'error')), options);
572: document.getElementById('gadm-history-close')?.addEventListener('click', closeHistory, options);
573: document.getElementById('gadm-new-document')?.addEventListener('click', () => {
577: document.getElementById('gadm-edit-form')?.addEventListener('click', () => {
588: document.getElementById('gadm-refresh-curriculum')?.addEventListener('click', updateCurriculumSuggestion, options);
589: document.getElementById('gadm-use-cp')?.addEventListener('click', () => {
594: document.getElementById('gadm-use-tp')?.addEventListener('click', () => {
598: document.getElementById(id)?.addEventListener('change', updateCurriculumSuggestion, options);
600: document.getElementById('gadm-cp-tp')?.addEventListener('input', () => {
604: document.getElementById('gadm-download-word')?.addEventListener('click', () => {
611: document.getElementById('gadm-download-excel')?.addEventListener('click', async (event) => {
671: window.SIMNIGADM = Object.freeze({
~~~~

### `features/grades/grades.html`
Direktori: `features/grades`. Fungsi: Modul nilai, mapel, TP dan Bab. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 8,
    "tag": "button",
    "data-simni-action": "setNilaiTab",
    "id": "tab-nilai-input"
  },
  {
    "line": 9,
    "tag": "button",
    "data-simni-action": "setNilaiTab",
    "id": "tab-nilai-rekap"
  },
  {
    "line": 10,
    "tag": "button",
    "data-simni-action": "setNilaiTab",
    "id": "tab-nilai-induk"
  },
  {
    "line": 15,
    "tag": "button",
    "data-simni-action": "openModal"
  },
  {
    "line": 17,
    "tag": "select",
    "id": "filter-mapel-nilai",
    "aria-label": "Mata pelajaran nilai",
    "data-simni-action": "updateTPDropdown"
  },
  {
    "line": 18,
    "tag": "select",
    "id": "filter-tp-nilai",
    "aria-label": "Tujuan pembelajaran nilai",
    "data-simni-action": "renderNilaiGrid"
  },
  {
    "line": 25,
    "tag": "button",
    "data-simni-action": "saveNilaiBatch"
  },
  {
    "line": 32,
    "tag": "select",
    "id": "rekap-mapel-nilai",
    "data-simni-action": "updateRekapTPDropdown"
  },
  {
    "line": 33,
    "tag": "select",
    "id": "rekap-tp-nilai",
    "data-simni-action": "renderRekapNilai"
  },
  {
    "line": 34,
    "tag": "select",
    "id": "rekap-siswa-nilai",
    "data-simni-action": "renderRekapNilai"
  },
  {
    "line": 41,
    "tag": "select",
    "id": "induk-siswa-select",
    "data-simni-action": "renderBukuInduk"
  },
  {
    "line": 42,
    "tag": "button",
    "data-simni-action": "cetakBukuInduk"
  },
  {
    "line": 51,
    "tag": "template",
    "data-simni-modal": null
  },
  {
    "line": 54,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 59,
    "tag": "select",
    "id": "tp-import-template",
    "data-simni-action": "updateTPTemplateLink"
  },
  {
    "line": 66,
    "tag": "input",
    "type": "file",
    "data-simni-action": "importTPExcel"
  },
  {
    "line": 67,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openSIMNILens"
  },
  {
    "line": 70,
    "tag": "form",
    "id": "form-add-tp",
    "data-simni-action": "submitTP"
  },
  {
    "line": 72,
    "tag": "select",
    "id": "input-tp-mapel"
  },
  {
    "line": 73,
    "tag": "select",
    "id": "input-tp-smt"
  },
  {
    "line": 76,
    "tag": "select",
    "id": "input-tp-bab"
  },
  {
    "line": 90,
    "tag": "input",
    "type": "text",
    "id": "input-tp-kode"
  },
  {
    "line": 91,
    "tag": "textarea",
    "id": "input-tp-desc"
  },
  {
    "line": 92,
    "tag": "button",
    "type": "submit"
  },
  {
    "line": 101,
    "tag": "button",
    "data-simni-action": "closeModal",
    "aria-label": "Tutup pratinjau"
  },
  {
    "line": 107,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 107,
    "tag": "button",
    "id": "btn-commit-tp-import",
    "data-simni-action": "commitTPImport"
  },
  {
    "line": 114,
    "tag": "button",
    "data-simni-action": "closeModal",
    "aria-label": "Tutup edit"
  },
  {
    "line": 116,
    "tag": "form",
    "id": "form-edit-tp",
    "data-simni-action": "submitEditTP"
  },
  {
    "line": 117,
    "tag": "input",
    "type": "hidden",
    "id": "edit-tp-id"
  },
  {
    "line": 118,
    "tag": "input",
    "type": "text",
    "id": "edit-tp-mapel"
  },
  {
    "line": 119,
    "tag": "select",
    "id": "edit-tp-smt"
  },
  {
    "line": 120,
    "tag": "select",
    "id": "edit-tp-bab"
  },
  {
    "line": 121,
    "tag": "input",
    "type": "text",
    "id": "edit-tp-kode"
  },
  {
    "line": 122,
    "tag": "textarea",
    "id": "edit-tp-desc"
  },
  {
    "line": 124,
    "tag": "button",
    "type": "button",
    "data-simni-action": "deleteTPEditModal"
  },
  {
    "line": 126,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "type": "button",
    "data-simni-action": "closeModal"
  },
  {
    "line": 127,
    "tag": "button",
    "type": "submit"
  },
  {
    "line": 142,
    "tag": "button",
    "type": "button",
    "data-simni-action": "closeSIMNILens",
    "aria-label": "Tutup SIMNI Lens"
  },
  {
    "line": 155,
    "tag": "select",
    "id": "ocr-target-bab-select"
  },
  {
    "line": 171,
    "tag": "textarea",
    "id": "ocr-result-preview"
  },
  {
    "line": 173,
    "tag": "button",
    "type": "button",
    "data-simni-action": "restartLensCapture"
  },
  {
    "line": 174,
    "tag": "button",
    "type": "button",
    "data-simni-action": "batchInsertScannedTP"
  },
  {
    "line": 180,
    "tag": "button",
    "type": "button",
    "data-simni-action": "rotateLens90",
    "title": "Putar Orientasi 90°"
  },
  {
    "line": 181,
    "tag": "button",
    "type": "button",
    "data-simni-action": "captureLensFrameToRAM",
    "title": "Jepret Frame Teks"
  },
  {
    "line": 182,
    "tag": "input",
    "type": "file",
    "data-simni-action": "handleLensGalleryFile"
  }
]
~~~~

### `features/grades/grades.js`
Direktori: `features/grades`. Fungsi: Modul nilai, mapel, TP dan Bab. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/grades/grades.js

Fungsi dan cabang entry point:
~~~~text
6: function tpId(tp) {
10: function gradeSubjectAllowed(subject) {
15: function visibleLearningObjectives() {
25: function applyGradeSubjectPolicy() {
40: function getTPById(id) {
46: function legacyCodeUnique(code) {
50: function gradeMatchesTP(grade, tp) {
67: const candidates = state.mapelTP.filter(item =>
75: function gradeIdFor(student, tp) {
83: function activeGradeStudents() {
92: function gradeForStudentTP(student, tp) {
94: const matches = state.nilaiTP.filter((item) => {
102: function gradeProgressForTP(tp) {
104: const graded = students.filter((student) => {
111: function setNilaiTab(tab) {
122: function renderNilaiTPControls() {
128: async function hapusTP(idMapel, kodeTP) {
150: function resolveChapterNumber(tp) {
169: function selectBabDropdown(selectId, chapterNumber) {
177: function updateTPListModal() {
208: const sortedGroups = [...groups.entries()].sort((a, b) => {
300: async function submitTP(event) {
310: const duplicate = state.mapelTP.some((tp) => tp.mapel === mapel && String(tp.semester) === String(semester) && String(tp.kode_tp).toLowerCase() === kode.toLowerCase() && (tp.kelas || tp.Kelas || '') === currentKelas);
341: function openEditTPModal(idMapel) {
362: async function submitEditTP(event) {
396: const result = await dbUpdate(Object.fromEntries(Object.entries(changes).map(([field, value]) => [`Mapel_TP/${safeId}/${field}`, value])));
412: function deleteTPEditModal() {
426: function getActiveOCRWorker() {
434: function handleOCRWorkerMessage(e) {
474: function smartParseTP(rawText) {
503: async function openSIMNILens() {
565: function stopLensStream() {
572: function closeSIMNILens() {
583: function rotateLens90() {
589: function restartLensCapture() {
595: async function captureLensFrameToRAM() {
658: async function handleLensGalleryFile(event) {
696: async function batchInsertScannedTP() {
709: const items = rawText.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t.length > 5);
713: const existingMapelTPs = visibleLearningObjectives().filter((tp) => tp.mapel === mapel && String(tp.semester) === String(semester));
750: function updateTPTemplateLink() {
759: function renderTPImportPreview(summary) {
798: async function importTPExcel(event) {
866: const exists = seenKeys.has(key) || state.mapelTP.some((tp) => {
917: async function commitTPImport() {
924: const ids = new Set(imported.map((item) => item.ID_mapel));
937: function updateTPDropdown(resetSelection = false) {
945: const candidates = mapel ? visibleLearningObjectives().filter((tp) => tp.mapel === mapel) : [];
971: function renderNilaiGrid() {
1003: async function saveNilaiBatch() {
1023: const existingList = state.nilaiTP.filter((item) => {
1058: const committedIds = new Set(committed.map((item) => item.ID_Nilai));
1059: const committedPairs = new Set(committed.map((item) => `${item.ID_Siswa}|${item.learningObjectiveId}`));
1075: function updateRekapTPDropdown() {
1081: const candidates = mapel ? visible.filter((tp) => tp.mapel === mapel) : visible;
1086: function renderRekapNilai() {
1094: let targetTPs = mapel ? visibleLearningObjectives().filter((tp) => tp.mapel === mapel) : visibleLearningObjectives();
1099: const students = nisn ? filteredStudents.filter((student) => student.NISN === nisn) : filteredStudents;
1129: async function saveEditedGrade(row) {
1137: const existing = state.nilaiTP.find((item) => {
1159: function renderBukuInduk() {
1168: const student = state.students.find((item) => item.NISN === nisn);
1170: const attendance = state.presensi.filter((item) => item.NISN === nisn);
1171: const count = (status) => attendance.filter((item) => String(item.Status || '').toUpperCase() === status).length;
1174: const mapelList = [...new Set(visibleLearningObjectives().map((tp) => tp.mapel).filter(Boolean))];
1176: const objectives = visibleLearningObjectives().filter((tp) => tp.mapel === mapel);
1177: const grades = objectives.map((tp) => ({ tp, grade: gradeForStudentTP(student, tp) })).filter((item) => academicScore(item.grade?.nilai) !== null);
1179: const average = Math.round(grades.reduce((sum, item) => sum + Number(item.grade.nilai || 0), 0) / grades.length);
1180: const sorted = [...grades].sort((a, b) => Number(b.grade.nilai) - Number(a.grade.nilai));
1191: async function cetakBukuInduk() {
1197: const student = state.students.find((item) => item.NISN === nisn);
~~~~

Binding event/aksi publik:
~~~~text
275: btnEdit.addEventListener('click', () => openEditTPModal(tpId(tp)));
282: btnDelete.addEventListener('click', () => hapusTP(tpId(tp), tp.kode_tp || ''));
289: header.addEventListener('click', () => {
1114: body.querySelectorAll('.start-grade-edit').forEach((button) => button.addEventListener('click', () => {
1118: body.querySelectorAll('.cancel-grade-edit').forEach((button) => button.addEventListener('click', () => {
1122: body.querySelectorAll('.save-grade-edit').forEach((button) => button.addEventListener('click', () => {
1216: window.openEditTPModal = openEditTPModal;
1217: window.submitEditTP = submitEditTP;
1218: window.deleteTPEditModal = deleteTPEditModal;
1219: window.openSIMNILens = openSIMNILens;
1220: window.closeSIMNILens = closeSIMNILens;
1221: window.rotateLens90 = rotateLens90;
1222: window.restartLensCapture = restartLensCapture;
1223: window.captureLensFrameToRAM = captureLensFrameToRAM;
1224: window.handleLensGalleryFile = handleLensGalleryFile;
1225: window.batchInsertScannedTP = batchInsertScannedTP;
1226: window.smartParseTP = smartParseTP;
1227: window.updateTPListModal = updateTPListModal;
1228: window.submitTP = submitTP;
1229: window.hapusTP = hapusTP;
1230: window.saveNilaiBatch = saveNilaiBatch;
1231: window.updateTPDropdown = updateTPDropdown;
1232: window.renderNilaiGrid = renderNilaiGrid;
1233: window.renderNilaiTPControls = renderNilaiTPControls;
1234: window.setNilaiTab = setNilaiTab;
1235: window.renderBukuInduk = renderBukuInduk;
1236: window.cetakBukuInduk = cetakBukuInduk;
~~~~

### `features/journal/journal.html`
Direktori: `features/journal`. Fungsi: Modul jurnal harian guru. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 8,
    "tag": "button",
    "data-simni-action": "setJurnalTab",
    "id": "tab-jurnal-input"
  },
  {
    "line": 9,
    "tag": "button",
    "data-simni-action": "setJurnalTab",
    "id": "tab-jurnal-rekap"
  },
  {
    "line": 10,
    "tag": "button",
    "data-simni-action": "setJurnalTab",
    "id": "tab-jurnal-jadwal"
  },
  {
    "line": 17,
    "tag": "input",
    "type": "date",
    "id": "input-jurnal-tanggal",
    "aria-label": "Tanggal mengajar",
    "data-simni-action": "checkJurnalDateChange"
  },
  {
    "line": 22,
    "tag": "button",
    "data-simni-action": "saveJurnalHarian"
  },
  {
    "line": 28,
    "tag": "input",
    "type": "month",
    "id": "filter-jurnal-bulan",
    "data-simni-action": "renderRekapJurnal"
  },
  {
    "line": 29,
    "tag": "button",
    "data-simni-action": "cetakJurnalPDF"
  },
  {
    "line": 38,
    "tag": "button",
    "data-simni-action": "saveJadwalMaster"
  }
]
~~~~

### `features/journal/journal.js`
Direktori: `features/journal`. Fungsi: Modul jurnal harian guru. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/journal/journal.js

Fungsi dan cabang entry point:
~~~~text
6: function setJurnalTab(tab) {
18: function renderJadwalSetting() {
29: const existing = state.jadwal.find((item) => item.Hari === day && Number(item.Jam_Ke) === hour && academicRecordClass(item) === currentKelas);
39: async function saveJadwalMaster() {
46: const matches = state.jadwal.filter(item => item.Hari === select.dataset.hari && Number(item.Jam_Ke) === Number(select.dataset.jam) && academicRecordClass(item) === currentKelas);
63: function checkJurnalDateChange(newDate) {
68: function generateFormJurnal() {
81: let schedule = state.jadwal.filter((item) => item.Hari === day);
97: const historical = state.jurnal.filter(journal => normalizeDate(journal.Tanggal) === date && academicRecordClass(journal) === currentKelas);
104: const existing = state.jurnal.find((journal) => normalizeDate(journal.Tanggal) === date && Number(journal.Jam_Ke) === Number(item.Jam_Ke) && academicRecordClass(journal) === currentKelas);
114: const mapelInput = item.Mapel ? `<h4 class="font-bold text-sm">${escapeHTML(mapel)}</h4><input type="hidden" data-draft-key="${item.Jam_Ke}:mapel" class="j-map" value="${escapeHTML(mapel)}">` : `<select aria-label="Mata pelajaran jam ${item.Jam_Ke}" data-draft-key="${item.Jam_Ke}:mapel" class="j-map p-2 border rounded bg-white dark:bg-black"><option value="">Pilih mata pelajaran</option>${subjects.filter(subject => window.SIMNICurrentAccess?.role !== 'vip' || subject === 'PJOK').map(subject => `<option ${subject === mapel ? 'selected' : ''}>${escapeHTML(subject)}</option>`).join('')}</select>`;
121: async function saveJurnalHarian() {
134: const matches = state.jurnal.filter(item => normalizeDate(item.Tanggal) === date && Number(item.Jam_Ke) === Number(hour) && academicRecordClass(item) === currentKelas);
169: async function hapusJurnal(id) {
175: function renderRekapJurnal() {
182: const filtered = state.jurnal.filter((item) => {
197: const icon = document.createElement('i'); icon.className = 'fas fa-trash'; button.appendChild(icon); button.addEventListener('click', () => hapusJurnal(item.ID_Jurnal));
202: async function cetakJurnalPDF() {
205: const rows = Array.from(document.querySelectorAll('#rekap-jurnal-body tr')).map((row) => row.cells.length > 1 ? `<tr><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(row.cells[0].innerText)}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(row.cells[1].innerText)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(row.cells[2].innerText)}</td><td style="border:1px solid #000;padding:5px;white-space:pre-wrap">${escapeHTML(row.cells[3].innerText)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(row.cells[4].innerText)}</td></tr>` : '').join('');
~~~~

Binding event/aksi publik:
~~~~text
197: const icon = document.createElement('i'); icon.className = 'fas fa-trash'; button.appendChild(icon); button.addEventListener('click', () => hapusJurnal(item.ID_Jurnal));
228: window.setJurnalTab = setJurnalTab;
229: window.renderJadwalSetting = renderJadwalSetting;
230: window.saveJadwalMaster = saveJadwalMaster;
231: window.checkJurnalDateChange = checkJurnalDateChange;
232: window.generateFormJurnal = generateFormJurnal;
233: window.saveJurnalHarian = saveJurnalHarian;
234: window.hapusJurnal = hapusJurnal;
235: window.renderRekapJurnal = renderRekapJurnal;
236: window.cetakJurnalPDF = cetakJurnalPDF;
~~~~

### `features/lps/lps-core.js`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNILPSCore(root, factory) {
17: function createSIMNILPSCore() {
131: function isPlainObject(
158: function assertSafeObjectKey(
188: function assertSerializable(
307: function cloneSerializable(
429: function deepClone(
437: function cleanText(
460: function normalizeKey(
497: function randomHex(
551: function randomId(
592: function deterministicId(
607: function getPeriod(
623: function requirePeriod(
640: function getPeriodFromLegacyLabel(
660: function normalizeAcademicYear(
696: function normalizeSettings(
812: function templateScopeId(
845: function reportId(
896: function buildItems(
927: function buildAspect(
993: function defaultLPSSections() {
1175: function defaultBLPSections() {
1320: function createDefaultTemplate(
1412: function normalizeOptions(
1471: function normalizeAspectInputType(
1532: function normalizeItems(
1596: function normalizeTemplate(
1914: function valuesOf(
1949: function getActiveTemplate(
2019: function getTemplateById(
2047: function getReportById(
2075: function cloneTemplateForPeriod(
2140: function createEmptyResponses(
2263: function validateTemplate(
2677: function validateReportIdentity(
2796: function validateFinalReport(
3058: function parseGregorian(
3118: function fallbackHijri(
3301: function gregorianToHijri(
3403: function formatGregorianIndonesian(
3460: function canonicalize(
3597: function canonicalStringify(
3607: async function sha256(
3666: async function hashReport(
3691: async function verifyReportHash(
~~~~

### `features/lps/lps-excel.js`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Logika, validasi, handler dan koordinasi data.

Fungsi dan cabang entry point:
~~~~text
7: const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
8: const flatten = template => template.sections.flatMap(section => section.aspects);
9: function createTemplate(settings, periodId) {
20: function matchesStructure(template, base) {
21: const shape = t => t.sections.map(s => [s.id, s.aspects.map(a => [a.id, a.inputType, a.options.length, a.detailLabel, a.descriptionEnabled, a.descriptionLabel, a.items.map(i => i.id)])]);
24: function sourceCells(xml) {
32: function patchCells(xml, changes) {
43: function fillIdentity(changes, report) {
52: function fillClosing(changes, report, offset = 0) {
70: function nativeSheet(xml, report, template, base, styleFonts) {
116: function customSheet(xml, report, template) {
120: const style=addr=>cells.get(addr)?.attrs.match(/\bs="(\d+)"/)?.[1] || '0';
122: const append=(entries,height=24)=>{
142: const move=(fragment)=>fragment.replace(/\b(r|ref)="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"/g,(_,key,col,n,endCol,end)=>`${key}="${col}${Number(n)+offset}${endCol?':'+endCol+(Number(end)+offset):''}"`).replace(/<row r="(\d+)"/g,(_,n)=>`<row r="${Number(n)+offset}"`);
143: const sourceRows=[...xml.matchAll(/<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)].map(m=>m[0]);
144: const number=r=>Number(r.match(/\br="(\d+)"/)[1]);
145: const prefix=sourceRows.filter(r=>number(r)<14).join(''),suffix=sourceRows.filter(r=>number(r)>=reference.footer).map(move).join('');
146: const originalMerges=[...xml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map(m=>m[1]);
147: const preserved=originalMerges.filter(m=>Number(m.match(/\d+/)[0])<14),closing=originalMerges.filter(m=>Number(m.match(/\d+/)[0])>=reference.footer).map(m=>move(`ref="${m}"`).slice(5,-1));
155: async function createWorkbook(reports, names) {
163: const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
167: const fonts=Array.from(styles.getElementsByTagName('fonts')[0].children, font=>font.getElementsByTagName('name')[0]?.getAttribute('val') || '');
168: const styleFonts=Array.from(styles.getElementsByTagName('cellXfs')[0].children, xf=>fonts[Number(xf.getAttribute('fontId') || 0)]);
~~~~

Binding event/aksi publik:
~~~~text
195: window.SIMNILPSExcel=Object.freeze({createTemplate,createWorkbook,matchesStructure});
~~~~

### `features/lps/lps-print.js`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/lps/lps-print.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
8: (function initSIMNILPSPrint(
34: function createSIMNILPSPrint(
48: function requireCore() {
85: function isPlainObject(
112: function text(
121: function trimmed(
129: function escapeHTML(
157: function safeAttribute(
167: function safeImageUrl(
231: function normalizeStatus(
245: function getResponse(
306: function checkmark(
328: function alphaIndex(
368: function validateRenderableTemplate(
614: function validateRenderableReport(
789: function renderCriteriaTable(
933: function renderAspect(
1000: function renderSection(
1081: function renderHeader(
1177: function renderStudentIdentity(
1265: function renderDate(
1303: function renderTeacherSignature(
1343: function renderParentSignature() {
1359: function renderClosing(
1420: function renderFooter(
1489: function renderReportInternal(
1615: function renderReport(
1630: async function renderVerifiedReport(
1695: async function verifyPrintableReport(
~~~~

### `features/lps/lps-reference-data.js`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Logika, validasi, handler dan koordinasi data.

Binding event/aksi publik:
~~~~text
2: window.SIMNILPSReferenceData = {"LPS":{"file":"LPS KLS 2 contoh.xlsx","sectionRows":[14,52],"footer":96,"aspects":[{"row":18,"itemRows":[],"section":0,"title":"Baca Tulis Al-Quran","labels":[]},{"row":25,"itemRows":[27,28,29,30,31,32,33],"section":0,"title":"Penerapan 7 Kebiasaan Anak Indonesia Hebat","labels":["Bangun Pagi","Beribadah","Berolahraga","Makan Sehat dan Bergizi","Gemar Belajar","Bermasyarakat","Tidur Cepat"]},{"row":35,"itemRows":[37,38,39,40],"section":0,"title":"Pembiasaan","labels":["Makan dan minum sambil duduk","Tidak berbicara kasar","Salam dan salim kepada guru","Mengangkat tangan ketika berdo'a"]},{"row":41,"itemRows":[43,44,45],"section":0,"title":"Prestasi Akademik","labels":["Membaca","Menulis","Berhitung"]},{"row":46,"itemRows":[48,49,50],"section":0,"title":"Praktek Ibadah","labels":["Thaharah/wudhu","Bacaan shalat","Gerakan shalat"]},{"row":55,"itemRows":[56,57,58,59,60,61,62,63,64],"section":1,"title":"Tahfidz / Juz-Amma","labels":["Q.S Al-Ma'un","Q.S Al- Quraisy","Q.S Al- Fiil","Q.S Al-Humazah","Q.S Al-'Asr","Q.S At-Takatsur","Q.S Al-Qoriah","Q.S An-Naziat","Q.S 'Abasa"]},{"row":65,"itemRows":[66,67,68,69,70,71,72,73,74,75],"section":1,"title":"Do'a Sehari-hari","labels":["Do'a  Masuk WC","Do'a Keluar WC","Do'a Masuk Mesjid","Do'a Keluar Mesjid","Do'a Kebaikan Dunia dan Akhirat","Do'a ketika turun hujan","Do'a ketika ada petir","Do'a ketika ada angin ribut/kencang","Do'a setelah adzan","Do'a bercermin"]},{"row":76,"itemRows":[77,78,79,80,81,82,83,84,85,86,87,88,89,90],"section":1,"title":"Mahfudzat","labels":["Jangan Marah","Memberi itu lebih baik","Bahayanya ilmu","Kebaikan akhlak","Hidup itu perjuangan","Keutamaan buku","Manusia paling bermanfaat","Belajar Al-Qur'an","Sabar","Berkata benar","Berkata yang baik","Menjaga lisan","Tubuh yang sehat","Kuatnya kemauan"]}],"sha256":"5665f646c71c75959cbd5f004b3d944c337a283eb26590b8b9cfb089adda97f1","sections":["Baca Tulis Al-Qur'an, Penerapan 7 Kebiasaan, Pembiasaan, Prestasi Akademik dan Praktek ibadah","Target Hafalan"]},"BLP":{"file":"BLP contoh.xlsx","sectionRows":[14,42],"footer":72,"aspects":[{"row":18,"itemRows":[],"section":0,"title":"Baca Tulis al-Quran","labels":[]},{"row":25,"itemRows":[],"section":0,"title":"Muroja'ah","labels":[]},{"row":30,"itemRows":[32,33,34,35,36],"section":0,"title":"Pembiasaan","labels":["Salam dan salim","Tidak berbicara kasar","Mengangkat tangan ketika berdo'a","Makan dan minum sambil duduk","Infaq"]},{"row":37,"itemRows":[39,40],"section":0,"title":"Praktek Ibadah","labels":["Thaharah/wudhu","Shalat"]},{"row":45,"itemRows":[46,47,48,49,50],"section":1,"title":"Tahfidz / Juz-Amma","labels":["Q.S. Al-'Adiyat","Q.S. Al-Zalzalah","Q.S. Al-Bayyinah","Q.S. Al-Qadar","Q.S. Al-'Alaq"]},{"row":51,"itemRows":[52,53,54,55,56,57,58],"section":1,"title":"Do'a Sehari-hari","labels":["Do'a  Masuk WC","Do'a Keluar WC","Do'a Masuk Mesjid","Do'a Keluar Mesjid","Do'a Kebaikan Dunia dan Akhirat","Do'a ketika turun hujan","Do'a ketika ada petir"]},{"row":59,"itemRows":[60,61,62,63,64,65,66],"section":1,"title":"Mahfudzat","labels":["Jangan Marah","Memberi itu lebih baik","Bahayanya ilmu","Kebaikan akhlak","Hidup itu perjuangan","Keutamaan buku","Manusia paling bermanfaat"]}],"sha256":"dfd72e612d29b5ccf275ce573e7b74fdf7ef5297f94e0843e4d1e761130086db","sections":["Baca Tulis Al-Qur'an, Muroja'ah, Pembiasaan dan Praktek ibadah","Target Hafalan"]}};
~~~~

### `features/lps/lps.css`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Aturan tampilan dan responsivitas.

### `features/lps/lps.html`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 34,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openModalPengaturanLPS"
  },
  {
    "line": 59,
    "tag": "select",
    "id": "lps-filter-kelompok",
    "data-simni-action": "populateLPSFilter"
  },
  {
    "line": 87,
    "tag": "select",
    "id": "lps-select-siswa",
    "data-simni-action": "loadSiswaLPS"
  },
  {
    "line": 104,
    "tag": "select",
    "id": "lps-select-periode",
    "data-simni-action": "loadSiswaLPS"
  },
  {
    "line": 132,
    "tag": "input",
    "type": "date",
    "id": "lps-report-date",
    "data-simni-action": "updateLPSHijriDate"
  },
  {
    "line": 146,
    "tag": "input",
    "type": "text",
    "id": "lps-hijri-date"
  },
  {
    "line": 160,
    "tag": "select",
    "id": "lps-hijri-offset",
    "data-simni-action": "updateLPSHijriDate"
  },
  {
    "line": 195,
    "tag": "input",
    "type": "text",
    "id": "lps-class-period-display"
  },
  {
    "line": 262,
    "tag": "button",
    "type": "button",
    "data-simni-action": "previewLPS"
  },
  {
    "line": 276,
    "tag": "button",
    "type": "button",
    "data-simni-action": "cetakLPS"
  },
  {
    "line": 289,
    "tag": "button",
    "type": "button",
    "data-simni-action": "exportExcelLPS"
  },
  {
    "line": 312,
    "tag": "button",
    "type": "button",
    "data-simni-action": "gunakanTemplateLPSAktif"
  },
  {
    "line": 322,
    "tag": "form",
    "id": "lps-main-form",
    "data-simni-action": "preventDefault"
  },
  {
    "line": 342,
    "tag": "textarea",
    "id": "lps-teacher-note"
  },
  {
    "line": 353,
    "tag": "textarea",
    "id": "lps-teacher-note-secondary"
  },
  {
    "line": 360,
    "tag": "textarea",
    "id": "lps-parent-note"
  },
  {
    "line": 371,
    "tag": "button",
    "type": "button",
    "id": "lps-save-draft-button",
    "data-simni-action": "saveLPSData"
  },
  {
    "line": 386,
    "tag": "button",
    "type": "button",
    "id": "lps-finalize-button",
    "data-simni-action": "finalisasiLPS"
  },
  {
    "line": 401,
    "tag": "button",
    "type": "button",
    "id": "lps-revise-button",
    "data-simni-action": "bukaRevisiLPS"
  },
  {
    "line": 424,
    "tag": "div",
    "role": "dialog"
  },
  {
    "line": 448,
    "tag": "button",
    "type": "button",
    "data-simni-action": "closeModal",
    "aria-label": "Tutup pengaturan template LPS dan BLP"
  },
  {
    "line": 462,
    "tag": "form",
    "id": "lps-builder-form",
    "data-simni-action": "simpanPengaturanLPS"
  },
  {
    "line": 474,
    "tag": "select",
    "id": "lps-template-source"
  },
  {
    "line": 484,
    "tag": "button",
    "type": "button",
    "data-simni-action": "salinTemplateLPS"
  },
  {
    "line": 498,
    "tag": "button",
    "type": "button",
    "data-simni-action": "resetTemplateLPSKeAcuan"
  },
  {
    "line": 533,
    "tag": "button",
    "type": "button",
    "data-simni-action": "addLPSBuilderSection"
  },
  {
    "line": 547,
    "tag": "button",
    "type": "submit",
    "id": "lps-save-template-button"
  },
  {
    "line": 567,
    "tag": "div",
    "id": "lps-preview-modal",
    "role": "dialog"
  },
  {
    "line": 582,
    "tag": "button",
    "type": "button",
    "data-simni-action": "cetakLPS"
  },
  {
    "line": 595,
    "tag": "button",
    "type": "button",
    "data-simni-action": "exportExcelLPS"
  },
  {
    "line": 604,
    "tag": "button",
    "type": "button",
    "data-simni-action": "closeLPSPreview"
  }
]
~~~~

### `features/lps/lps.js`
Direktori: `features/lps`. Fungsi: Modul template editable LPS/BLP, laporan dan ekspor. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/lps/lps.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
17: (function initSIMNILPSFeature() {
26: const createReferenceTemplate = (settings, periodId) => window.SIMNILPSExcel.createTemplate(settings, periodId);
105: function nowISO() {
110: function notify(
132: function showProgress(
140: function hideProgress() {
144: function currentAccess() {
151: function canAccessLPS() {
165: function assertLPSAccess() {
194: function currentSettings() {
203: function currentPeriodId() {
213: function currentPeriod() {
222: function getUserMeta() {
263: function getJakartaDateString() {
329: function normalizeWriteResult(
360: async function databaseSet(
383: async function databaseUpdate(
404: function templateCollection() {
445: function reportCollection() {
486: function rememberTemplate(
506: function rememberReport(
526: function getTemplateScope(
537: function getActiveTemplate(
550: function getSavedReport(
560: function createContainerFromTemplate(
586: function sanitizeFeatureMarkup(
634: async function installFeatureMarkup() {
803: function unmountFeatureMarkup() {
834: function ensureFeatureInstalled() {
897: function runWhenReady(
925: function getSelectedStudent() {
950: function makeDraftReport(
1124: function findLegacyReport(
1159: function migrateLegacyReport(
1308: function normalizeResponsesToTemplate(
1399: function createElement(
1447: function createResponseSelect(
1502: function createResponseChecklist(
1593: function createResponseTextInput(
1625: function createField(
1655: function renderAspectInput(
1976: function renderReportForm() {
2244: function updateStatusUI(
2367: function renderBusyState() {
2418: async function verifyFinalReport(
2459: function populateLPSFilter() {
2630: function loadSiswaLPS() {
2812: function updateLPSHijriDate() {
2869: function collectReportFromForm() {
3168: async function ensureTemplatePersisted() {
3268: async function persistReport(
3319: async function saveLPSData() {
3502: async function finalisasiLPS() {
3776: async function bukaRevisiLPS() {
4022: function gunakanTemplateLPSAktif() {
4098: function templateCandidateLabel(
4122: function populateTemplateSourceSelect() {
4204: function openModalPengaturanLPS() {
4268: function createBuilderInput(
4304: function createBuilderActionButton({
4405: function renderBuilderAspect(
4698: function renderBuilder() {
4915: function syncBuilderFromDOM() {
5101: const matched = labels.map(label => {
5102: const item = oldItems.find(item => item.label === label && !reserved.has(item.id));
5121: function addLPSBuilderSection() {
5161: function removeLPSBuilderSection(
5205: function moveLPSBuilderSection(
5254: function addLPSBuilderCategory(
5308: function removeLPSBuilderCategory(
5344: function moveLPSBuilderAspect(
5398: function salinTemplateLPS() {
5453: function resetTemplateLPSKeAcuan() {
5477: async function simpanPengaturanLPS(
5699: function uniqueExcelSheetName(workbook, student, index) {
5714: async function exportExcelLPS() {
5736: const name=uniqueExcelSheetName({getWorksheet:name=>used.has(name)},student,index);
5757: function reportForOutput() {
5779: async function renderOutputHTML(
5826: async function previewLPS() {
5936: function closeLPSPreview() {
5959: function waitForPrintCompletion(
6016: async function cetakLPS() {
6190: function numericDataset(
6211: async function handleLPSAction(
6383: function bindLPSDOMEvents() {
6536: function guardLPS(
6539: return function guardedLPSAction(
6559: function getRuntimeSnapshot() {
6642: async function renderCurrentReportHTML() {
~~~~

Binding event/aksi publik:
~~~~text
36: window.SIMNILPSReady =
116: typeof window.toast ===
889: window.SIMNILPSReady =
1562: checkbox.addEventListener(
5998: .addEventListener(
6394: .addEventListener(
6417: .addEventListener(
6460: .addEventListener(
6488: .addEventListener(
6786: window.SIMNILPSReady =
6791: window.SIMNILPS =
~~~~

### `features/notes/notes.html`
Direktori: `features/notes`. Fungsi: Modul catatan siswa/kelas. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 8,
    "tag": "button",
    "data-simni-action": "setCatatanTab",
    "id": "tab-catatan-input"
  },
  {
    "line": 9,
    "tag": "button",
    "data-simni-action": "setCatatanTab",
    "id": "tab-catatan-rekap"
  },
  {
    "line": 14,
    "tag": "form",
    "data-simni-action": "submitCatatan"
  },
  {
    "line": 16,
    "tag": "input",
    "type": "date",
    "id": "input-catatan-tanggal",
    "aria-label": "Tanggal catatan"
  },
  {
    "line": 17,
    "tag": "select",
    "id": "input-catatan-siswa",
    "aria-label": "Siswa catatan"
  },
  {
    "line": 19,
    "tag": "textarea",
    "id": "input-catatan-teks"
  },
  {
    "line": 20,
    "tag": "button",
    "type": "submit"
  },
  {
    "line": 26,
    "tag": "select",
    "id": "filter-catatan-siswa",
    "aria-label": "Filter siswa catatan",
    "data-simni-action": "renderCatatanList"
  },
  {
    "line": 27,
    "tag": "button",
    "data-simni-action": "cetakCatatanPDF"
  }
]
~~~~

### `features/notes/notes.js`
Direktori: `features/notes`. Fungsi: Modul catatan siswa/kelas. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/notes/notes.js

Fungsi dan cabang entry point:
~~~~text
6: function setCatatanTab(tab) {
16: async function submitCatatan(event) {
20: const student = state.students.find((item) => item.NISN === nisn);
47: async function hapusCatatan(id) {
53: function renderCatatanList() {
58: const filtered = state.catatan.filter((item) => {
74: const icon = document.createElement('i'); icon.className = 'fas fa-trash'; del.appendChild(icon); del.addEventListener('click', () => hapusCatatan(item.ID_Catatan));
81: async function cetakCatatanPDF() {
~~~~

Binding event/aksi publik:
~~~~text
74: const icon = document.createElement('i'); icon.className = 'fas fa-trash'; del.appendChild(icon); del.addEventListener('click', () => hapusCatatan(item.ID_Catatan));
~~~~

### `features/reset/reset.js`
Direktori: `features/reset`. Fungsi: Modul reset dan pergantian tahun. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/reset/reset.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
8: (function initSIMNIReset() {
50: function notify(message, type = 'info') {
62: function showProgress(message) {
68: function hideProgress() {
74: function nowISO() {
79: function cleanText(value) {
86: function normalizeError(
103: function requireResetAccess() {
148: function requireRepository() {
168: function requireArchiveAuthority() {
188: function resolveScope(
208: function resolveAuthorizedTargets(
286: async function requireFreshVerifiedArchive() {
336: function confirmReset(
380: async function verifyTargetsAreNull(
424: async function performReset(
741: function resetDataMurid() {
747: function resetDataTP() {
753: function resetDataJadwal() {
759: async function startAnnualRollover(event) {
789: const readinessCount = requiredScopes.filter(([email, role, workspaceId]) => {
790: const profile = profiles.find((item) => String(item?.email || '').toLowerCase() === email);
832: function getRuntimeSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
51: if (typeof window.toast === 'function') {
63: if (typeof window.showLoad === 'function') {
69: if (typeof window.hideLoad === 'function') {
857: window.SIMNIReset =
~~~~

### `features/settings/settings.html`
Direktori: `features/settings`. Fungsi: Modul identitas, akun, tampilan dan penyimpanan. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 15,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 45,
    "tag": "select",
    "id": "theme-selector-dropdown",
    "aria-label": "Tema warna aplikasi"
  },
  {
    "line": 53,
    "tag": "button",
    "type": "button",
    "data-simni-action": "saveThemeFromDropdown"
  },
  {
    "line": 62,
    "tag": "form",
    "data-simni-action": "simpanIdentitas"
  },
  {
    "line": 63,
    "tag": "input",
    "type": "text",
    "id": "set-nama-app"
  },
  {
    "line": 65,
    "tag": "input",
    "type": "text",
    "id": "set-nama-kelas"
  },
  {
    "line": 66,
    "tag": "input",
    "type": "text",
    "id": "set-tapel"
  },
  {
    "line": 68,
    "tag": "input",
    "type": "text",
    "id": "set-nama-yayasan"
  },
  {
    "line": 70,
    "tag": "input",
    "type": "text",
    "id": "set-jenjang-sekolah"
  },
  {
    "line": 71,
    "tag": "input",
    "type": "text",
    "id": "set-nama-sekolah"
  },
  {
    "line": 74,
    "tag": "input",
    "type": "text",
    "id": "set-akreditasi"
  },
  {
    "line": 75,
    "tag": "input",
    "type": "text",
    "id": "set-kota"
  },
  {
    "line": 77,
    "tag": "input",
    "type": "text",
    "id": "set-nomor-izin"
  },
  {
    "line": 79,
    "tag": "input",
    "type": "text",
    "id": "set-nama-wali-kelas"
  },
  {
    "line": 80,
    "tag": "input",
    "type": "text",
    "id": "set-nuptk-wali-kelas"
  },
  {
    "line": 85,
    "tag": "input",
    "type": "text",
    "id": "set-ikon-kelas"
  },
  {
    "line": 86,
    "tag": "input",
    "type": "file",
    "id": "set-logo-file",
    "aria-label": "Unggah logo sekolah"
  },
  {
    "line": 87,
    "tag": "button",
    "type": "button",
    "data-simni-action": "hapusLogo",
    "title": "Kembali ke Ikon Standar"
  },
  {
    "line": 90,
    "tag": "button",
    "type": "submit",
    "id": "btn-save-id"
  },
  {
    "line": 96,
    "tag": "button",
    "data-simni-action": "createAnnualArchiveCloud"
  },
  {
    "line": 97,
    "tag": "button",
    "data-simni-action": "exportArsipTotalExcel"
  },
  {
    "line": 98,
    "tag": "input",
    "type": "file",
    "data-simni-action": "verifyAnnualArchiveFile"
  },
  {
    "line": 100,
    "tag": "button",
    "data-simni-action": "exportDataLokal"
  },
  {
    "line": 101,
    "tag": "input",
    "type": "file",
    "data-simni-action": "importDataLokal"
  },
  {
    "line": 104,
    "tag": "select",
    "id": "restore-mode"
  },
  {
    "line": 115,
    "tag": "form",
    "data-simni-action": "updateCredentials"
  },
  {
    "line": 116,
    "tag": "input",
    "type": "password",
    "id": "edit-current-password"
  },
  {
    "line": 117,
    "tag": "input",
    "type": "email",
    "id": "edit-email"
  },
  {
    "line": 118,
    "tag": "input",
    "type": "password",
    "id": "edit-password"
  },
  {
    "line": 119,
    "tag": "button",
    "type": "submit",
    "id": "btn-save-cred"
  },
  {
    "line": 125,
    "tag": "form",
    "data-simni-action": "startAnnualRollover"
  },
  {
    "line": 126,
    "tag": "input",
    "id": "rollover-next-year"
  },
  {
    "line": 127,
    "tag": "input",
    "id": "rollover-superuser-class"
  },
  {
    "line": 129,
    "tag": "button",
    "type": "submit"
  },
  {
    "line": 134,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openLocalStorageManager"
  },
  {
    "line": 135,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openSubsystemRecoveryGuide"
  },
  {
    "line": 136,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openAnnualArchiveManager"
  },
  {
    "line": 142,
    "tag": "button",
    "data-simni-action": "logoutAuth"
  },
  {
    "line": 147,
    "tag": "template",
    "data-simni-modal": null
  },
  {
    "line": 152,
    "tag": "button",
    "type": "button",
    "data-simni-action": "closeModal",
    "aria-label": "Tutup Pusat Pengaturan",
    "title": "Tutup"
  },
  {
    "line": 156,
    "tag": "input",
    "type": "file",
    "data-simni-action": "verifyAnnualArchiveFile"
  },
  {
    "line": 157,
    "tag": "form",
    "data-simni-action": "startAnnualRollover"
  },
  {
    "line": 158,
    "tag": "button",
    "type": "submit"
  }
]
~~~~

### `features/settings/settings.js`
Direktori: `features/settings`. Fungsi: Modul identitas, akun, tampilan dan penyimpanan. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/settings/settings.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
9: (function initSIMNISettings() {
26: function currentAccess() {
33: function canAccessSettings() {
45: function canAdministerUsers() {
57: function assertSettingsAccess() {
82: function normalizedAcademicYear(
122: function element(
130: function requiredValue(
159: function optionalValue(
168: function currentIdentity() {
187: function collectIdentitySettings() {
280: function setButtonContent(
331: function renderSettingsActionState() {
381: function updateIdentityState(
411: async function loadCloudinary() {
430: function validateLogoFile(
478: function yearWillChange(
488: function assertYearTransitionPermission(
498: function confirmAcademicYearTransition(
514: async function persistIdentity({
540: async function compensateUploadedLogo(
569: async function simpanIdentitas(
839: async function hapusLogo() {
1020: function ekstrakCSSOffline() {
1099: async function migrateLegacyRTDB() {
1258: function getSettingsRuntimeSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
397: typeof window.state ===
1212: window.isInitialLoad =
1292: window.SIMNISettings =
~~~~

### `features/students/students.html`
Direktori: `features/students`. Fungsi: Modul kelola data siswa, impor/ekspor dan identitas siswa. Fragmen halaman, form dan modal.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 12,
    "tag": "input",
    "type": "text",
    "id": "search-siswa",
    "data-simni-action": "renderSiswaList"
  },
  {
    "line": 15,
    "tag": "button",
    "data-simni-action": "generatePrintQR"
  },
  {
    "line": 19,
    "tag": "select",
    "id": "student-import-template",
    "aria-label": "Template impor siswa",
    "data-simni-action": "updateStudentTemplateLink"
  },
  {
    "line": 26,
    "tag": "input",
    "type": "file",
    "data-simni-action": "importSiswaExcel"
  },
  {
    "line": 28,
    "tag": "button",
    "data-simni-action": "openAddSiswaModal"
  },
  {
    "line": 36,
    "tag": "template",
    "data-simni-modal": null
  },
  {
    "line": 39,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 40,
    "tag": "form",
    "id": "form-add-siswa",
    "data-simni-action": "submitSiswa"
  },
  {
    "line": 41,
    "tag": "input",
    "type": "hidden",
    "id": "input-old-nisn"
  },
  {
    "line": 42,
    "tag": "input",
    "type": "hidden",
    "id": "input-foto-public-id"
  },
  {
    "line": 43,
    "tag": "input",
    "type": "text",
    "id": "input-nisn"
  },
  {
    "line": 44,
    "tag": "input",
    "type": "text",
    "id": "input-nama"
  },
  {
    "line": 45,
    "tag": "input",
    "type": "text",
    "id": "input-panggilan"
  },
  {
    "line": 46,
    "tag": "select",
    "id": "input-kelas"
  },
  {
    "line": 47,
    "tag": "select",
    "id": "input-kelompok"
  },
  {
    "line": 53,
    "tag": "input",
    "type": "file",
    "id": "input-foto-file",
    "data-simni-action": "uploadStudentPhotoAction"
  },
  {
    "line": 57,
    "tag": "input",
    "type": "url",
    "id": "input-foto"
  },
  {
    "line": 59,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "type": "button",
    "data-simni-action": "closeModal"
  },
  {
    "line": 59,
    "tag": "button",
    "type": "submit"
  },
  {
    "line": 65,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 74,
    "tag": "button",
    "data-simni-action": "jumpToPresensi"
  },
  {
    "line": 75,
    "tag": "button",
    "data-simni-action": "jumpToBukuInduk"
  },
  {
    "line": 78,
    "tag": "button",
    "data-simni-action": "editSiswa"
  },
  {
    "line": 79,
    "tag": "button",
    "data-simni-action": "hapusSiswaPaten"
  },
  {
    "line": 90,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 105,
    "tag": "button",
    "aria-label": "Tutup dialog",
    "data-simni-action": "closeModal"
  },
  {
    "line": 106,
    "tag": "button",
    "data-simni-action": "commitSiswaImport",
    "id": "btn-commit-siswa-import"
  }
]
~~~~

### `features/students/students.js`
Direktori: `features/students`. Fungsi: Modul kelola data siswa, impor/ekspor dan identitas siswa. Logika, validasi, handler dan koordinasi data.
Keterangan source: FILE: features/students/students.js

Fungsi dan cabang entry point:
~~~~text
6: function studentPhotoUrl(student) {
11: function normalizeNisn(value, strict = false) {
18: function renderSiswaList() {
53: async function submitSiswa(event) {
64: const existing = state.students.find((item) => academicNisn(item.NISN) === oldNisn);
101: function openAddSiswaModal() {
116: function editSiswa() {
118: const student = state.students.find((item) => item.NISN === state.tempSelectedSiswaNISN);
138: function legacyGradeKey(grade) {
143: function studentCascadeUpdates(student) {
172: async function hapusSiswaPaten() {
173: const student = state.students.find((item) => item.NISN === state.tempSelectedSiswaNISN);
193: function openProfilSiswa(nisn) {
196: const student = state.students.find((item) => item.NISN === normalized);
209: function jumpToPresensi() {
216: function jumpToBukuInduk() {
223: async function generatePrintQR() {
271: function updateStudentTemplateLink() {
280: function renderStudentImportPreview(summary) {
319: async function importSiswaExcel(event) {
421: async function commitSiswaImport() {
429: const importedNisn = new Set(imported.map((item) => item.NISN));
445: async function uploadStudentPhotoAction(event) {
~~~~

Binding event/aksi publik:
~~~~text
49: card.addEventListener('click', () => openProfilSiswa(card.dataset.studentNisn || ''));
490: window.renderSiswaList = renderSiswaList;
491: window.openAddSiswaModal = openAddSiswaModal;
492: window.submitSiswa = submitSiswa;
493: window.editSiswa = editSiswa;
494: window.hapusSiswaPaten = hapusSiswaPaten;
495: window.importSiswaExcel = importSiswaExcel;
496: window.commitSiswaImport = commitSiswaImport;
497: window.uploadStudentPhotoAction = uploadStudentPhotoAction;
~~~~

### `firebase.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Root konfigurasi: `database`, `hosting`

### `firebase.tahap7.emulator.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Root konfigurasi: `database`, `emulators`

### `firebase/database.rules.production.json`
Direktori: `firebase`. Fungsi: Rules/konfigurasi Realtime Database.
Root konfigurasi: `rules`

### `icons/favicon-32.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `icons/icon-192.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `icons/icon-512.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `icons/icon-maskable-512.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `icons/school-logo.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `icons/simni-logo.png`
Direktori: `icons`. Fungsi: Ikon/aset identitas PWA.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `index.html`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

Kontrol, modal dan handler statis (label/markup lengkap di snapshot):
~~~~json
[
  {
    "line": 110,
    "tag": "form",
    "id": "form-login-auth"
  },
  {
    "line": 115,
    "tag": "input",
    "type": "email",
    "id": "auth-email"
  },
  {
    "line": 123,
    "tag": "input",
    "type": "password",
    "id": "auth-password"
  },
  {
    "line": 127,
    "tag": "button",
    "type": "submit",
    "id": "btn-login"
  },
  {
    "line": 133,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 220,
    "tag": "select",
    "id": "global-kelas-select",
    "data-simni-action": "setActiveKelas"
  },
  {
    "line": 240,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 254,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 268,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 282,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 296,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 311,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 325,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 340,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 373,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 396,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 438,
    "tag": "button",
    "type": "button",
    "id": "btn-menu-drawer",
    "data-simni-action": "toggleMenuDrawer",
    "aria-label": "Buka Menu Navigasi",
    "title": "Menu"
  },
  {
    "line": 479,
    "tag": "select",
    "id": "mobile-kelas-select",
    "data-simni-action": "setActiveKelas"
  },
  {
    "line": 496,
    "tag": "button",
    "type": "button"
  },
  {
    "line": 573,
    "tag": "button",
    "type": "button",
    "data-simni-action": "closeMenuDrawer",
    "aria-label": "Tutup Menu"
  },
  {
    "line": 589,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 601,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 613,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 625,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 637,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 650,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 667,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openAttendanceScanner"
  },
  {
    "line": 678,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 690,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 703,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  },
  {
    "line": 716,
    "tag": "button",
    "type": "button",
    "data-simni-action": "openStudentsCreate"
  },
  {
    "line": 732,
    "tag": "button",
    "type": "button",
    "data-simni-action": "switchView"
  }
]
~~~~

### `js/auth/access-context.js`
Direktori: `js/auth`. Fungsi: Autentikasi, pemetaan identitas, validasi profil dan izin.

Dependensi:
~~~~text
1: import { ref, get, set } from '../../vendor/firebase/firebase-database.js';
2: import { database, runtime } from '../database/firebase-client.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
16: function databaseReference(path) {
20: function readDatabase(path) {
24: function setDatabase(path, value) {
28: function cachedAcademicYear() {
37: function cacheAcademicYear(value) {
47: async function authoritativeAcademicYear() {
61: function validateIdentityBinding(profile, user) {
73: function emulatorContext(user) {
88: async function readAuthoritativeProfile(user) {
98: function canonicalProfile(user, activeAcademicYearId = DEFAULT_ACADEMIC_YEAR_ID) {
119: async function provisionCanonicalProfile(user, existing = null) {
128: export function getAccessContext() {
132: export function clearAccessContext() {
138: function activateAccessContext(profile, source, stale) {
149: export function canAccess(feature) {
153: export function assertFeature(feature) {
161: export function assertLogicalPath(path) {
168: export async function transitionAcademicYear(nextYearId) {
179: export function establishAccessContext(user) {
202: export async function verifyAccessContext(user, expectedContext = currentContext) {
221: function updateClassContext(role) {
241: function applyFeatureVisibility(role) {
263: export function applyAccessUI() {
~~~~

Binding event/aksi publik:
~~~~text
134: window.SIMNICurrentAccess = null;
144: window.SIMNICurrentAccess = currentContext;
294: window.SIMNIAccess = Object.freeze({
~~~~

### `js/auth/access-policy-core.js`
Direktori: `js/auth`. Fungsi: Autentikasi, pemetaan identitas, validasi profil dan izin.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIAccessPolicy(root, factory) {
5: }(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIAccessPolicy() {
70: function normalizeRole(value) {
75: function hasFeature(role, feature) {
80: function featureForView(viewId) {
84: function featureForModal(modalId) {
88: function featureForLogicalPath(path) {
102: function validateProfile(profile, uid) {
137: function allowedSubject(role, subject) {
~~~~

### `js/auth/auth.js`
Direktori: `js/auth`. Fungsi: Autentikasi, pemetaan identitas, validasi profil dan izin.
Keterangan source: FILE: js/auth/auth.js; FUNGSI: Firebase Authentication, reauthentication, dan lifecycle sesi role-scoped.

Dependensi:
~~~~text
5: import {
15: import { auth, authPersistenceReady, runtime } from '../database/firebase-client.js';
16: import { establishAccessContext, verifyAccessContext, clearAccessContext } from './access-context.js';
17: import { loadLocalBackup, migrateLegacyCacheIfNeeded, purgeCurrentLocalCache } from '../database/local-cache.js';
18: import { loadFeatureFragments, resetFeatureFragments } from '../core/feature-loader.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
46: function cloneSerializable(value) {
61: function authMessage(error) {
96: function isTerminalAccessError(error) {
107: function renderButtonContent(button, label, iconClass = '') {
120: function renderAuthUI() {
156: function setAuthState(patch) {
167: function resetInMemoryApplicationState() {
185: function resetProtectedFeatureSurfaces(reason) {
203: function teardownSession({ clearContext = true, clearState = true, reason = 'session-teardown' } = {}) {
217: function transitionIsCurrent(generation, expectedUid = null) {
227: function accessScopeKey(context) {
238: async function renderApplicationState(generation, uid) {
261: async function mountAuthorizedFeatures(generation, uid) {
276: async function hydrateAuthorizedSession(user, context, generation) {
448: function accessFailureMessage(error) {
465: async function rejectAuthenticatedSession(user, error, generation) {
494: async function verifyAuthoritativeSession(user, generation, initialContext) {
535: async function handleAuthenticatedUser(user, generation) {
564: function handleSignedOut(generation) {
593: function resumeAuthenticatedSession() {
635: function mockUserForEmail(email) {
662: window.loginAuth = async function loginAuth(event) {
722: window.requestPasswordReset = async function requestPasswordReset() {
744: window.updateCredentials = async function updateCredentials(event) {
797: window.logoutAuth = async function logoutAuth() {
~~~~

Binding event/aksi publik:
~~~~text
43: window.isUserLoggedIn = false;
44: window.SIMNIAuthState = authState;
162: window.SIMNIAuthState = authState;
206: window.isInitialLoad = true;
207: window.isUserLoggedIn = false;
375: window.isUserLoggedIn =
473: window.isUserLoggedIn = false;
600: && window.isUserLoggedIn === true
621: window.resumeSIMNIAuthSession = resumeAuthenticatedSession;
623: window.addEventListener('pageshow', (event) => {
629: document.addEventListener('visibilitychange', () => {
662: window.loginAuth = async function loginAuth(event) {
674: return window.isUserLoggedIn === true;
704: return window.isUserLoggedIn === true;
722: window.requestPasswordReset = async function requestPasswordReset() {
744: window.updateCredentials = async function updateCredentials(event) {
797: window.logoutAuth = async function logoutAuth() {
~~~~

### `js/core/app.js`
Direktori: `js/core`. Fungsi: Bootstrap, runtime, state bersama dan pemuatan fragmen.

Fungsi dan cabang entry point:
~~~~text
3: export async function bootstrapApp() {
~~~~

Binding event/aksi publik:
~~~~text
11: window.addEventListener('online', () => {
18: window.addEventListener('offline', () => {
~~~~

### `js/core/feature-loader.js`
Direktori: `js/core`. Fungsi: Bootstrap, runtime, state bersama dan pemuatan fragmen.
Keterangan source: FILE: js/core/feature-loader.js; FUNGSI: Authority tunggal pemuatan dan mounting fragmen UI berbasis izin.

Fungsi dan cabang entry point:
~~~~text
81: export function resolveFeatureId(featureOrViewId) {
136: const urls = [...new Set(groups.flatMap(group => {
143: function loadScript(url) {
145: const promise = new Promise((resolve, reject) => {
161: function loadStylesheet(url) {
163: const promise = new Promise((resolve, reject) => {
179: function loadModule(url) {
182: const promise = import(resolvedURL).then(() => url).catch((error) => {
190: async function loadAuthorizedRuntimeAssets(context) {
205: function accessContext() {
209: function accessSignature(context = accessContext()) {
227: function canAccessFeature(feature, context = accessContext()) {
264: function resolveRoots() {
280: function setFragmentState(status) {
284: function freezeDiagnostics(value) {
317: function clearFragmentRoots() {
325: function parseFragmentDocument(htmlText, url) {
344: async function fetchFragment(definition, signal) {
366: function cloneTemplateContents(
386: function validateFragment(
419: function mountParsedFragment(
450: function describeError(error) {
462: function currentAuthorizedDefinitions() {
478: export function resetFeatureFragments(
513: export function ensureFeatureLoaded(featureOrViewId) {
530: const loadPromise = (async () => {
537: const definition = FEATURE_DEFINITIONS.find((d) => d.feature === feature);
575: export function isFeatureLoaded(featureOrViewId) {
579: export function loadFeatureFragments(options = {}) {
624: const promise = (async () => {
815: export function getAuthorizedFeatureFragments() {
~~~~

Binding event/aksi publik:
~~~~text
135: window.ensureSIMNIVendors = async (...groups) => {
150: script.addEventListener('load', () => resolve(url), { once: true });
151: script.addEventListener('error', () => reject(new Error(`Runtime asset gagal dimuat: ${url}`)), { once: true });
168: link.addEventListener('load', () => resolve(url), { once: true });
169: link.addEventListener('error', () => reject(new Error(`Stylesheet gagal dimuat: ${url}`)), { once: true });
312: window.SIMNIFragmentDiagnostics = diagnostics;
834: window.SIMNIFeatureLoader =
844: window.ensureFeatureLoaded = ensureFeatureLoaded;
845: window.isFeatureLoaded = isFeatureLoaded;
~~~~

### `js/core/runtime-config.js`
Direktori: `js/core`. Fungsi: Bootstrap, runtime, state bersama dan pemuatan fragmen.
Keterangan source: FILE: js/core/runtime-config.js; FUNGSI:; Authority tunggal konfigurasi runtime,

Fungsi dan cabang entry point:
~~~~text
8: (function initSIMNIRuntimeConfig(
81: function cleanText(
90: function assertVersion(
113: function assertSchemaVersion(
137: function validateVersionManifest(
199: function validateFirebaseConfig(
326: function locationSnapshot() {
407: function resolveAuditMode() {
506: function getRuntimeSnapshot() {
~~~~

### `js/core/shell.js`
Direktori: `js/core`. Fungsi: Bootstrap, runtime, state bersama dan pemuatan fragmen.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIShell() {
131: function consumeSensitiveURLState() {
210: function authError(
242: function validateVendorRuntime() {
333: async function ensureAuthModule() {
341: async function invokeAuthAction(
377: async function handleShellAction(
410: function handleViewAction(
435: function handleModalAction(
461: function bindShellEvents() {
510: function registerServiceWorker() {
~~~~

Binding event/aksi publik:
~~~~text
94: window.addEventListener(
308: window.SIMNIVendorRuntime =
334: if (typeof window.startSIMNIPlatform === 'function') {
469: ?.addEventListener(
481: document.addEventListener(
536: navigator.serviceWorker.addEventListener(
548: window.addEventListener(
579: window.addEventListener(
594: window.validateSIMNIVendorRuntime =
~~~~

### `js/core/state.js`
Direktori: `js/core`. Fungsi: Bootstrap, runtime, state bersama dan pemuatan fragmen.
Keterangan source: FILE: js/core/state.js; FUNGSI: State global kompatibel selama transisi modular

Fungsi dan cabang entry point:
~~~~text
47: function academicRecordClass(record) {
52: const student = window.state.students.find((s) => academicNisn(s.NISN) === academicNisn(nisn));
60: function academicNisn(value) {
64: function academicScore(value) {
70: function academicSessionKey() {
92: function openDB() {
122: async function persistDraftToStorage(record) {
141: async function deleteDraftFromStorage(id) {
157: async function loadAllDraftsFromStorage(currentUid) {
180: async function clearDraftsFromStorage(uid) {
211: function updateVisualStatus(element, status, customText) {
260: function currentSession() {
279: async function syncFromStorage() {
292: function key(id, discriminator = '') {
296: function controls(element) { return [...element.querySelectorAll('[data-draft-key]')]; }
297: function values(element) {
304: function capture(element) {
307: const baselines = [...element.querySelectorAll('[data-baseline]')].map(input => ({
330: const timer = setTimeout(async () => {
390: const baseline = draft.baselines?.find(item => item.key === (input.dataset.draftKey || input.querySelector?.('.j-jam')?.value));
442: function activeClassStorageKey() {
448: window.getSIMNIActiveClass = function getSIMNIActiveClass() {
459: window.setActiveKelas = function setActiveKelas(kelas) {
~~~~

Binding event/aksi publik:
~~~~text
35: window.SIMNIDataScope = window.SIMNIDataScope || {};
38: window.daftarKelasDinamis = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];
77: window.SIMNIFormDrafts = (() => {
350: document.addEventListener(type, event => {
358: window.addEventListener('online', () => {
363: window.addEventListener('beforeunload', event => {
448: window.getSIMNIActiveClass = function getSIMNIActiveClass() {
459: window.setActiveKelas = function setActiveKelas(kelas) {
~~~~

### `js/database/cloudinary-client.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/cloudinary-client.js; FUNGSI:; Boundary Cloudinary client SIMNI.; const PURPOSE = Object.freeze({

Dependensi:
~~~~text
8: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
36: function cleanText(
44: function normalizePurpose(
65: function normalizeResourceType(
88: function assertUploadFile(
134: function assertHTTPSURL(
167: function uploadEndpoint({
201: function expectedPublicId(
212: function assertSignatureContract(
413: function buildUploadForm({
459: async function parseCloudinaryResponse(
487: function verifyUploadedAsset(
616: function inferPurposeFromPublicId(
645: async function cleanupUploadedAsset({
679: export async function signedCloudinaryUpload(
821: export async function uploadLogo(
830: export async function uploadDocument(
839: export async function uploadStudentPhoto(
848: export async function deleteCloudinaryAsset(
897: export function getCloudinaryRuntimeSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
926: window.SIMNICloudinary =
~~~~

### `js/database/firebase-client.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/firebase-client.js; FUNGSI:; Authority tunggal inisialisasi Firebase client SIMNI.

Dependensi:
~~~~text
8: import {
14: import {
18: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
33: function cleanText(value) {
39: function validateFirebaseConfig(
129: function validateRuntime(
179: function sameFirebaseProject(
212: function initializeFirebaseOnce(
288: export function applyFirebaseRuntimeUI() {
308: export function getFirebaseRuntimeSnapshot() {
350: export async function logSIMNIAuditEvent(action, targetId = '', details = {}, options = {}) {
~~~~

Binding event/aksi publik:
~~~~text
285: window.SIMNIDatabaseTarget =
351: if (typeof window !== 'undefined' && typeof window.dbRecordAuthoritativeAudit === 'function') {
362: window.logSIMNIAuditEvent =
386: window.SIMNIFirebaseClient =
~~~~

### `js/database/live-pages.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.

Fungsi dan cabang entry point:
~~~~text
4: export function subscribeLivePages(sdk, reference, onSnapshot, onError, {
10: const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
11: const publish = () => {
15: const value = Object.assign(Object.create(null), ...[...leaves].map(leaf => leaf.value));
19: function attach(left, right) {
~~~~

### `js/database/local-cache.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/local-cache.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
22: function nowISO() {
26: function currentAccess() {
45: function cacheScope(
79: function accessCacheKey(
96: function previousScopedCacheKey(
110: function canonical(value) {
156: function persistedState(
185: function extractState(
215: function stableStringify(
225: async function sha256(
272: function scopeMatches(
366: function assertLegacyOwner(
383: function openDatabase() {
446: async function readKey(
506: async function writeKey(
573: async function deleteKey(
630: async function buildEnvelope(
699: async function verifyEnvelope(
775: function enqueueWrite(
792: async function writeEnvelopeVerified(
831: async function migrateScopedSchema2IfNeeded(
971: async function migrateUnscopedLegacyIfNeeded(
1186: export async function migrateLegacyCacheIfNeeded() {
1248: export async function purgeLegacyUnscopedCache() {
1378: export async function purgeCurrentLocalCache(access = currentAccess()) {
1390: function assertHealthySnapshotForPersistence() {
1437: export async function saveLocalBackup() {
1645: function applyCachedState(
1672: export async function loadLocalBackup() {
1805: export async function getLocalCacheDiagnostics() {
1888: function sameCacheOwner(record, access) {
1893: export async function listLocalCacheInventory() {
1919: export async function exportLocalCacheRecord(key) {
1926: export async function deleteLocalCacheAfterVerification(key, exported) {
1959: async function inspectDraftsStorage() {
1978: const summaries = items.map((item) => {
2002: async function inspectGADMStorage() {
2019: const finishStore = () => {
2054: async function inspectServiceWorkerCaches() {
2086: export async function getCompleteStorageInventory() {
2090: const academic = await listLocalCacheInventory().catch(() => ({ rows: [], totalBytes: 0, limitBytes: MAX_DATABASE_BYTES }));
2143: export async function purgeSafeCaches() {
~~~~

Binding event/aksi publik:
~~~~text
1386: window.SIMNILocalCacheState = null;
1760: window.SIMNILocalCacheState = {
2180: window.openLocalStorageManager = async function () {
2280: safePurgeBtn.onclick = async () => {
2294: recoveryGuideBtn.onclick = () => {
2296: if (typeof window.openSubsystemRecoveryGuide === 'function') window.openSubsystemRecoveryGuide();
2324: download.onclick = async () => {
2340: input.onchange = async () => {
2361: close.onclick = () => { dialog.close(); dialog.remove(); };
~~~~

### `js/database/mock-adapter.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/mock-adapter.js; FUNGSI: Mock storage adapter untuk pengujian runtime offline/sandbox.

### `js/database/paged-query.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIPagedQuery(root, factory) {
6: }(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIPagedQuery() {
15: async function fetchPagedQuery(dbRefFn, physicalPath, {
41: const entries = Object.entries(raw).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
66: async function fetchCompleteCollectionPaged(dbRefFn, physicalPath, {
136: function filterRecordsByScope(records, {
161: const filtered = list.filter((item) => {
~~~~

### `js/database/repository.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/repository.js; FUNGSI:; Workspace-aware boundary operasi Realtime Database SIMNI.

Dependensi:
~~~~text
9: import { commitAdministrativeOperation } from '../services/edge-service.js';
11: import {
26: import { runtime } from './firebase-client.js';
28: import {
33: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
61: function currentAccess() {
80: function resolve(path) {
91: function databaseTargetIsEmulator() {
100: function databaseReference(path = '') {
104: function readDatabase(path = '') {
108: function setDatabase(path, value) {
112: function updateDatabase(path, values) {
116: function removeDatabase(path) {
120: function assertOnlineForWrite() {
131: function requiredBindingHealthIsReady(
162: function assertWritableState() {
221: function normalizeError(
240: function successfulResult(
249: function failedResult(
261: function requireHashCore() {
269: function cleanClassId(value, label = 'Kelas') {
275: function cleanAcademicYear(value) {
284: function safeArchiveId(value) {
304: function archiveBasePath() {
318: function archivePhysicalPath(
329: function normalizeArchiveCompatibility(
379: async function readAnnualArchive(
402: function mappedPhysicalUpdates(
471: function assertNoUpdatePathCollision(
545: export function resolveDatabasePath(
553: export async function dbSet(
577: export async function dbUpdate(
603: export async function dbAuditedUpdate(action, targetId, logicalUpdates) {
617: export async function dbRemove(
641: export async function dbCompareRecords(logicalRoot, changes, expected) {
648: const transaction = await runTransaction(databaseReference(physicalPath), current => {
667: export async function dbGet(
694: export async function dbFetchPagedCollection(logicalPath, {
703: const dbRefFn = (path, opts) => {
721: export async function dbFetchCompleteCollection(logicalPath, {
731: const dbRefFn = (path, opts) => {
750: export async function dbGetAnnualArchives({ before = null, metadataOnly = false } = {}) {
799: export async function dbCreateAnnualArchive() {
819: export async function dbGetAnnualArchiveStatus() {
827: const verified = Object.values(archives.value || {}).filter((item) => item?.verified === true);
839: export async function dbPerformAnnualReset({
863: export async function dbVerifyRestoreSnapshot({
902: export async function dbPutAnnualArchive(
942: const reservation = await runTransaction(indexReference, current => {
944: const others = Object.entries(index).filter(([id]) => id !== safeId);
945: const bytes = others.reduce((sum, [, item]) => sum + Number(item.snapshotBytes || 0), serializedBytes);
967: export async function dbExportAnnualArchive(id) {
976: export async function dbDeleteAnnualArchiveAfterVerification(id, exportedArchive) {
991: const deleted = await runTransaction(databaseReference(archivePhysicalPath(safeId)), value => {
1021: const result = await runTransaction(databaseReference(indexPath), current => JSON.stringify(current) === expected ? replacement : undefined, { applyLocally: false });
1028: export async function dbMarkRolloverArchiveReady(envelope) {
1072: export async function dbGetRolloverOverview() {
1091: export async function dbCommitAcademicYearRollover({ nextYearId, superuserClassId }) {
1109: const byEmail = new Map(profiles.map((profile) => [String(profile?.email || '').toLowerCase(), profile]));
1136: const verification = await Promise.all(required.map(async ([email, role, workspaceId, classId]) => {
1153: export function getCurrentUserMeta() {
1206: export async function dbRecordAuthoritativeAudit() {
1211: export async function logSIMNIAuditEvent(action, targetId = '', details = {}, options = {}) {
~~~~

Binding event/aksi publik:
~~~~text
615: window.dbAuditedUpdate = dbAuditedUpdate;
1001: window.dbExportAnnualArchive = dbExportAnnualArchive;
1002: window.dbDeleteAnnualArchiveAfterVerification = dbDeleteAnnualArchiveAfterVerification;
1003: window.dbRepairAnnualArchiveReservation = async function (id) {
~~~~

### `js/database/sync.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.
Keterangan source: FILE: js/database/sync.js; FUNGSI:

Dependensi:
~~~~text
9: import {
19: import { subscribeLivePages } from './live-pages.js';
21: import {
28: import {
32: import {
~~~~

Fungsi dan cabang entry point:
~~~~text
51: function collectionBinding(binding) {
195: const normalizeTPItem = (item, fallbackKey = '') => {
455: function valuesOf(data) {
489: function normalizeSchedule(
497: function errorMessage(
508: function hashPayload(val) {
519: function accessSignature() {
544: function generationIsCurrent(
556: function bindingSnapshot(
595: function initializeBindingState(
616: function requiredBindings() {
627: function deriveHealth({
728: function publishSyncState(
759: function setBindingStatus(
824: function scheduleRender({
881: function scheduleHealthyCachePersistence() {
967: function showInitialLoader() {
982: function hideInitialLoader() {
995: function announceInitialResult() {
1030: function finalizeInitialSync(
1106: function recalculateLiveHealth({
1182: function stopActiveSubscriptions() {
1201: function clearScheduledWork() {
1230: function resetSyncState(
1280: function eligibleBindings() {
1305: function resolveBindingPath(
1324: function handleBindingSuccess({
1445: function handleBindingFailure({
1500: export function stopFirebaseListener({
1524: export function initFirebaseListener() {
1709: export function getSyncStateSnapshot() {
~~~~

Binding event/aksi publik:
~~~~text
425: window.SIMNISyncState =
748: window.SIMNISyncState =
932: window.SIMNICacheHealth = { status: 'degraded', revision: requestedRevision, message: result?.error?.message || 'Cache lokal gagal disimpan.' };
937: window.SIMNICacheHealth = { status: 'ready', revision: requestedRevision };
1060: window.isInitialLoad =
1081: window.SIMNISyncState =
1142: window.SIMNISyncState =
1272: window.SIMNISyncState =
1382: window.SIMNIDataScope = window.SIMNIDataScope || {};
1513: window.isFirebaseListening =
1516: window.isInitialLoad =
1591: window.isFirebaseListening =
1602: window.isInitialLoad = false;
1605: window.isInitialLoad = true;
1776: window.SIMNISync =
~~~~

### `js/database/workspace-paths-core.js`
Direktori: `js/database`. Fungsi: Repository, pemetaan path workspace, penyimpanan/sinkronisasi data.

Fungsi dan cabang entry point:
~~~~text
1: (function initSIMNIWorkspacePaths(root, factory) {
5: }(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIWorkspacePaths() {
25: function cleanSegment(value, label) {
31: function normalizeLogicalPath(path) {
37: function requireContext(context) {
45: function resolveLogicalPath(path, context) {
48: const match = MAP.find(([legacy]) => logical === legacy || logical.startsWith(`${legacy}/`));
59: function workspaceRoot(context) {
64: function academicYearRoot(context) {
~~~~

### `js/platform/bootstrap.js`
Direktori: `js/platform`. Fungsi: Integrasi kemampuan platform/browser/native.

Fungsi dan cabang entry point:
~~~~text
3: export function startSIMNIPlatform() {
15: const startOnIntent = () => {
~~~~

Binding event/aksi publik:
~~~~text
13: window.startSIMNIPlatform = startSIMNIPlatform;
19: window.addEventListener('pointerdown', startOnIntent, { once: true, passive: true });
20: window.addEventListener('keydown', startOnIntent, { once: true, passive: true });
~~~~

### `js/platform/download-service.js`
Direktori: `js/platform`. Fungsi: Integrasi kemampuan platform/browser/native.
Keterangan source: FILE: js/platform/download-service.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
16: (function initSIMNIDownloadService() {
17: async function blobToBase64(blob) {
29: async function downloadBlob(blob, filename) {
~~~~

Binding event/aksi publik:
~~~~text
78: window.SIMNIDownloadService = Object.freeze({
~~~~

### `js/platform/main.js`
Direktori: `js/platform`. Fungsi: Integrasi kemampuan platform/browser/native.
Keterangan source: FILE: js/platform/main.js; FUNGSI:; Single startup authority SIMNI PWA.

Fungsi dan cabang entry point:
~~~~text
93: function recordRuntimeFailure(kind, value) {
123: function nowISO() {
129: function cleanText(
139: function resolveAppVersion() {
165: function publishDiagnostics() {
225: function updateBootDataset(
253: function stageStart(
293: function findRunningStage(
313: function stagePass(
339: function stageFail(
404: async function runBootStage(
439: function extractDiagnosticLocation(
496: function showFatalBootError(
605: async function startSIMNI() {
~~~~

Binding event/aksi publik:
~~~~text
104: window.SIMNIRuntimeFailures = Object.freeze([...runtimeFailures]);
107: window.addEventListener('error', (event) => {
111: window.addEventListener('unhandledrejection', (event) => {
113: if (typeof window.toast === 'function') {
166: window.SIMNIBootDiagnostics =
908: document.addEventListener(
~~~~

### `js/platform/native-back-button.js`
Direktori: `js/platform`. Fungsi: Integrasi kemampuan platform/browser/native.
Keterangan source: FILE: js/platform/native-back-button.js; FUNGSI:

Fungsi dan cabang entry point:
~~~~text
19: (function initNativeBackButton() {
23: function handleBackAction() {
~~~~

Binding event/aksi publik:
~~~~text
27: if (typeof window.closeSIMNILens === 'function') {
36: if (typeof window.closeModal === 'function') {
50: if (typeof window.isMenuDrawerOpen === 'function' && window.isMenuDrawerOpen()) {
51: if (typeof window.closeMenuDrawer === 'function') {
61: if (topModal?.id && typeof window.closeModal === 'function') {
70: if (typeof window.switchView === 'function') {
86: if (typeof window.toast === 'function') {
103: window.SIMNINativeBackButton = Object.freeze({
~~~~

### `js/platform/permission-service.js`
Direktori: `js/platform`. Fungsi: Integrasi kemampuan platform/browser/native.
Keterangan source: FILE: js/platform/permission-service.js; FUNGSI:

Binding event/aksi publik:
~~~~text
105: if (rationale && typeof window.toast === 'function') {
169: if (typeof window.toast === 'function') {
200: if (typeof window.toast === 'function') {
208: window.SIMNIPermissionService = permissionService;
~~~~

### `js/services/edge-service.js`
Direktori: `js/services`. Fungsi: Adapter layanan eksternal dan retry operasi.

Dependensi:
~~~~text
1: import { auth } from '../database/firebase-client.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
5: function edgeBaseUrl() {
18: async function invoke(path, body) {
32: const data = await response.json().catch(() => null);
39: export async function createCloudinaryUploadSignature(payload) {
43: export async function cleanupCloudinaryUpload(payload) {
47: export async function commitAdministrativeOperation(payload) {
52: const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
~~~~

### `js/ui/actions.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.
Keterangan source: FILE: js/ui/actions.js

Fungsi dan cabang entry point:
~~~~text
6: (function installSIMNIActionDispatcher(root) {
128: function parseArguments(element) {
145: function resolveAction(name) {
156: function reportFailure(error) {
163: async function invoke(element, event) {
~~~~

Binding event/aksi publik:
~~~~text
233: document.addEventListener(trigger, (event) => {
~~~~

### `js/ui/date.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.

Fungsi dan cabang entry point:
~~~~text
2: function jakartaParts(d=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SIMNI_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]))}
3: function getJakartaDateString(d=new Date()){const p=jakartaParts(d);return `${p.year}-${p.month}-${p.day}`}
4: function getJakartaMonthString(d=new Date()){const p=jakartaParts(d);return `${p.year}-${p.month}`}
5: function normalizeDate(raw){if(!raw)return '';const r=raw.toString();return r.includes('T')?r.split('T')[0]:r.split(' ')[0]}
6: function getNamaHari(ds){const [y,m,d]=String(ds).split('-').map(Number);return new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:SIMNI_TIMEZONE}).format(new Date(Date.UTC(y,m-1,d,12)))}
7: function initDates(){const today=getJakartaDateString();const pd=document.getElementById('presensi-date');if(pd&&!pd.value)pd.value=today;const cd=document.getElementById('input-catatan-tanggal');if(cd&&!cd.value)cd.value=today;const jd=document.getElementById('input-jurnal-tanggal');const ft=document.getElementById('filter-presensi-tanggal');if(ft&&!ft.value)ft.value=today;if(jd&&!jd.value){jd.value=today;lastJurnalDate=today;if(typeof generateFormJurnal==='function')setTimeout(generateFormJurnal,300)}}
~~~~

### `js/ui/feedback.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.
Keterangan source: FILE: js/ui/feedback.js

Fungsi dan cabang entry point:
~~~~text
10: function getActiveLoadingOwners() {
14: function showLoad(text, ownerId) {
31: const reveal = () => {
47: function hideLoad(token) {
84: function clearAllLoading() {
96: function playBeep() {
113: function toast(message, type = 'info') {
144: function notifyCommittedSave(render, message = 'Berhasil disimpan.') {
152: function updateSyncUI(online) {
159: const render = (element, small = false) => {
~~~~

Binding event/aksi publik:
~~~~text
129: close.setAttribute('aria-label', 'Tutup pemberitahuan'); close.addEventListener('click', () => node.remove());
158: window.SIMNILastConnectionLabel = label;
180: window.showLoad = showLoad;
181: window.hideLoad = hideLoad;
182: window.clearAllLoading = clearAllLoading;
183: window.getActiveLoadingOwners = getActiveLoadingOwners;
184: window.playBeep = playBeep;
185: window.toast = toast;
186: window.updateSyncUI = updateSyncUI;
~~~~

### `js/ui/navigation.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.
Keterangan source: FILE: js/ui/navigation.js

Fungsi dan cabang entry point:
~~~~text
6: function unlockScreen() {
14: function lockScreen() {
24: function isMenuDrawerOpen() {
29: function openMenuDrawer() {
46: function closeMenuDrawer() {
67: function toggleMenuDrawer() {
106: function unmountActiveView(viewId) {
133: async function switchView(id) {
259: async function openModal(id) {
282: function closeModal(id) {
295: const focusables = root => [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
297: function open(element, dismiss) {
319: function close(element) {
320: const index = stack.findIndex(item => item.element === element);
340: function closeAll(keepWithin) {
~~~~

Binding event/aksi publik:
~~~~text
75: document.addEventListener('click', (event) => {
148: if (feature && typeof window.ensureFeatureLoaded === 'function') {
265: if (feature && typeof window.ensureFeatureLoaded === 'function') {
278: if (id === 'modal-kelola-tp' && typeof window.updateTPListModal === 'function') window.updateTPListModal();
293: window.SIMNIDialog = (() => {
330: document.addEventListener('keydown', event => {
346: window.openMenuDrawer = openMenuDrawer;
347: window.closeMenuDrawer = closeMenuDrawer;
348: window.toggleMenuDrawer = toggleMenuDrawer;
349: window.isMenuDrawerOpen = isMenuDrawerOpen;
350: window.switchView = switchView;
351: window.openModal = openModal;
352: window.closeModal = closeModal;
353: window.unmountActiveView = unmountActiveView;
~~~~

### `js/ui/render.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.
Keterangan source: FILE: js/ui/render.js

Fungsi dan cabang entry point:
~~~~text
6: function populateAllDropdowns() {
12: const sortedStudents = [...filteredStudents].sort((a,b) => (a['Nama Lengkap']||'').localeCompare(b['Nama Lengkap']||''));
44: function renderIdentitas() {
66: const drawLogo = (container, rounding) => {
92: function renderAllViews() {
102: function renderCurrentView() {
~~~~

### `js/ui/shell.css`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.

### `js/ui/theme.js`
Direktori: `js/ui`. Fungsi: Navigasi, modal, render, feedback, tema dan tanggal.
Keterangan source: FILE: js/ui/theme.js

Fungsi dan cabang entry point:
~~~~text
15: function selectedThemeKey(value) {
19: function updateBrowserThemeColor(theme) {
24: window.applyColorTheme = function applyColorTheme(requestedKey) {
74: function initColorTheme() {
84: function initDarkMode() {
97: function toggleDarkMode() {
~~~~

Binding event/aksi publik:
~~~~text
24: window.applyColorTheme = function applyColorTheme(requestedKey) {
67: window.saveThemeFromDropdown = function() {
107: window.SIMNIColorThemes = THEMES;
~~~~

### `js/utils/sanitize.js`
Direktori: `js/utils`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Keterangan source: FILE: js/utils/sanitize.js

Fungsi dan cabang entry point:
~~~~text
6: function escapeHTML(str) {
16: function safeHTTPSUrl(value, fallback = '') {
29: function safeFirebaseKey(value, label = 'ID') {
37: function safeFilename(value, fallback = 'SIMNI') {
49: function normalizeClassLabel(value) {
~~~~

### `manifest.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Root konfigurasi: `id`, `name`, `short_name`, `description`, `lang`, `start_url`, `scope`, `display`, `background_color`, `theme_color`, `orientation`, `categories`, `icons`, `prefer_related_applications`, `version`

### `package-lock.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `package.json`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Root konfigurasi: `name`, `version`, `private`, `description`, `scripts`, `dependencies`, `devDependencies`

### `prompts-antigravity/00_BASELINE_DAN_RENCANA.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/01_BACKUP_DAN_PEMULIHAN.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/02_AKSI_LOADING_DAN_DRAF.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/03_KAPASITAS_DATABASE.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/04_VALIDASI_SERVER_DAN_AUDIT.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/05_RETENSI_DAN_BACKUP_LENGKAP.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/06_PEMUATAN_FITUR.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/07_AUDIT_INTEGRASI_FINAL.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `prompts-antigravity/README.md`
Direktori: `prompts-antigravity`. Fungsi: Instruksi historis pengerjaan; bukan source runtime.

### `public/build-manifest.json`
Direktori: `public`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/archive/archive.js`
Direktori: `public/features/archive`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/attendance/attendance.html`
Direktori: `public/features/attendance`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/attendance/attendance.js`
Direktori: `public/features/attendance`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/backup/backup-core.js`
Direktori: `public/features/backup`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/backup/backup.js`
Direktori: `public/features/backup`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/dashboard/dashboard.html`
Direktori: `public/features/dashboard`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/dashboard/dashboard.js`
Direktori: `public/features/dashboard`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/documents/documents.html`
Direktori: `public/features/documents`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/documents/documents.js`
Direktori: `public/features/documents`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm-curriculum-2026.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm-docx.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm-engine.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm-kb.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm-storage.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm.css`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm.html`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/gadm/gadm.js`
Direktori: `public/features/gadm`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/grades/grades.html`
Direktori: `public/features/grades`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/grades/grades.js`
Direktori: `public/features/grades`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/journal/journal.html`
Direktori: `public/features/journal`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/journal/journal.js`
Direktori: `public/features/journal`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps-core.js`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps-excel.js`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps-print.js`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps-reference-data.js`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps.css`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps.html`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/lps/lps.js`
Direktori: `public/features/lps`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/notes/notes.html`
Direktori: `public/features/notes`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/notes/notes.js`
Direktori: `public/features/notes`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/reset/reset.js`
Direktori: `public/features/reset`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/settings/settings.html`
Direktori: `public/features/settings`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/settings/settings.js`
Direktori: `public/features/settings`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/students/students.html`
Direktori: `public/features/students`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/features/students/students.js`
Direktori: `public/features/students`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/icons/favicon-32.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/icons/icon-192.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/icons/icon-512.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/icons/icon-maskable-512.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/icons/school-logo.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/icons/simni-logo.png`
Direktori: `public/icons`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/index.html`
Direktori: `public`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/auth/access-context.js`
Direktori: `public/js/auth`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/auth/access-policy-core.js`
Direktori: `public/js/auth`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/auth/auth.js`
Direktori: `public/js/auth`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/core/app.js`
Direktori: `public/js/core`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/core/feature-loader.js`
Direktori: `public/js/core`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/core/runtime-config.js`
Direktori: `public/js/core`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/core/shell.js`
Direktori: `public/js/core`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/core/state.js`
Direktori: `public/js/core`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/cloudinary-client.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/firebase-client.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/live-pages.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/local-cache.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/paged-query.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/repository.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/sync.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/database/workspace-paths-core.js`
Direktori: `public/js/database`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/platform/bootstrap.js`
Direktori: `public/js/platform`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/platform/download-service.js`
Direktori: `public/js/platform`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/platform/main.js`
Direktori: `public/js/platform`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/platform/native-back-button.js`
Direktori: `public/js/platform`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/platform/permission-service.js`
Direktori: `public/js/platform`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/services/edge-service.js`
Direktori: `public/js/services`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/actions.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/date.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/feedback.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/navigation.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/render.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/shell.css`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/ui/theme.js`
Direktori: `public/js/ui`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/js/utils/sanitize.js`
Direktori: `public/js/utils`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/manifest.json`
Direktori: `public`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/sw.js`
Direktori: `public`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/tailwind-offline.css`
Direktori: `public`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/templates/BLP contoh.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/templates/LPS KLS 2 contoh.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/templates/Template_Data_Siswa_1_Kelas.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/templates/Template_Data_Siswa_Per_Kelas.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/templates/Template_Impor_TP_1_Kelas.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/templates/Template_Impor_TP_Per_Kelas.xlsx`
Direktori: `public/templates`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/exceljs/exceljs.min.js`
Direktori: `public/vendor/exceljs`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/firebase/firebase-app.js`
Direktori: `public/vendor/firebase`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/firebase/firebase-auth.js`
Direktori: `public/vendor/firebase`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/firebase/firebase-database.js`
Direktori: `public/vendor/firebase`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/fontawesome/css/all.min.css`
Direktori: `public/vendor/fontawesome/css`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/fontawesome/webfonts/fa-brands-400.ttf`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-brands-400.woff2`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-regular-400.ttf`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-regular-400.woff2`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-solid-900.ttf`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-solid-900.woff2`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-v4compatibility.ttf`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/fontawesome/webfonts/fa-v4compatibility.woff2`
Direktori: `public/vendor/fontawesome/webfonts`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/html2pdf/html2pdf.bundle.min.js`
Direktori: `public/vendor/html2pdf`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/html5-qrcode/html5-qrcode.min.js`
Direktori: `public/vendor/html5-qrcode`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/jszip/jszip.min.js`
Direktori: `public/vendor/jszip`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/qrcodejs/qrcode.min.js`
Direktori: `public/vendor/qrcodejs`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/tesseract/ind.traineddata.gz`
Direktori: `public/vendor/tesseract`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `public/vendor/tesseract/ocr-worker.js`
Direktori: `public/vendor/tesseract`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/tesseract/tesseract-core.wasm.js`
Direktori: `public/vendor/tesseract`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/tesseract/tesseract.min.js`
Direktori: `public/vendor/tesseract`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/tesseract/worker.min.js`
Direktori: `public/vendor/tesseract`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `public/vendor/xlsx/xlsx.full.min.js`
Direktori: `public/vendor/xlsx`. Fungsi: Artefak Hosting hasil build; jangan diedit manual.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `qa/TAHAP_0_BASELINE_AUDIT_2026-09-12.md`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

### `qa/academic-bootstrap.js`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Fungsi dan cabang entry point:
~~~~text
6: async function script(url) {
15: const traceDraft = (event, extra = {}) => {
~~~~

Binding event/aksi publik:
~~~~text
2: window.SIMNIAccess = {
13: window.QADraftTrace = [];
21: window.SIMNIFormDrafts = { ...realDrafts,
26: document.addEventListener('input', event => { if(event.target.matches('.j-mat')) traceDraft('input',{connected:event.target.isConnected}); });
38: window.QALogin = async role => {
40: window.SIMNICurrentAccess = Object.freeze({ uid: `qa-${role}`, email: `${role}@qa.invalid`, role, workspaceId: role === 'vip' ? 'ws_pjok' : 'ws_superuser', classId: role === 'vip' ? 'PJOK' : '3A', activeAcademicYearId: '2026-2027', status: 'active' });
42: window.SIMNIDatabaseTarget = { mode: 'mock', projectId: 'qa-indexeddb' };
46: window.QABase = base;
68: window.SIMNIAuthState = { phase:'session-ready', uid:access.uid, role };
73: document.getElementById('qa-login').addEventListener('submit', event => { event.preventDefault(); void window.QALogin(document.getElementById('qa-role').value); });
74: document.getElementById('qa-class').addEventListener('change', event => window.setActiveKelas(event.target.value));
76: window.QABootReady = true;
~~~~

### `qa/academic-build-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
2: import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
3: import { createHash } from 'node:crypto';
4: import path from 'node:path';
5: import assert from 'node:assert/strict';
~~~~

Fungsi dan cabang entry point:
~~~~text
7: const sha=value=>createHash('sha256').update(value).digest('hex');
13: const assets=[...list.matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]);
~~~~

### `qa/academic-mock-database.js`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Fungsi dan cabang entry point:
~~~~text
11: const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('simni-academic-qa') : { postMessage: () => {}, onmessage: null };
12: export const ref = (_database, path = '') => ({ path });
13: export const query = (reference, ...constraints) => ({ ...reference, constraints });
14: export const orderByKey = () => ({ type: 'orderByKey' });
15: export const orderByChild = field => ({ type: 'orderByChild', field });
16: export const limitToFirst = count => ({ type: 'first', count });
17: export const limitToLast = count => ({ type: 'last', count });
18: export const endBefore = key => ({ type: 'before', key });
19: export const startAt = key => ({ type: 'startAt', key });
20: export const startAfter = key => ({ type: 'startAfter', key });
21: export const endAt = key => ({ type: 'endAt', key });
22: export const equalTo = value => ({ type: 'equalTo', value });
24: function readQuery(reference) {
28: const childOrder = reference.constraints.find(item => item.type === 'orderByChild');
54: const clone = value => structuredClone(value);
55: function read(path, root = tree) {
59: function replaceServerValues(val) {
68: export const serverTimestamp = () => ({ '.sv': 'timestamp' });
69: function write(root, path, value) {
73: const parent = parts.reduce((value, key) => value[key] ||= {}, root);
77: const snapshot = value => ({ val: () => clone(value), exists: () => value !== null });
78: async function db() {
87: async function load() {
96: function notify() {
104: async function mutate(updater, description) {
132: export async function get(reference) { await load(); return snapshot(readQuery(reference)); }
133: export async function set(reference, value) { await mutate(root => { write(root, reference.path, value); return root; }, { type: 'set', path: reference.path }); }
134: export async function update(reference, values) { await mutate(root => { for (const [key,value] of Object.entries(values)) write(root, [reference.path,key].filter(Boolean).join('/'), value); return root; }, { type: 'update', paths: Object.keys(values) }); }
135: export async function remove(reference) { return set(reference, null); }
136: export async function runTransaction(reference, updater) {
137: const committed = await mutate(root => {
144: export function onValue(reference, next, error) {
~~~~

Binding event/aksi publik:
~~~~text
7: globalThis.window.QAMock = { connected: true, failNext: false, hold: false, writes: [] };
150: window.QAMock = {
~~~~

### `qa/academic-uiux-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createServer } from 'node:http';
2: import { readFile, mkdir, writeFile } from 'node:fs/promises';
3: import path from 'node:path';
4: import assert from 'node:assert/strict';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
17: const server = createServer(async (request, response) => {
30: content = `export function getAccessContext(){return window.SIMNICurrentAccess;} export function canAccess(feature){return ${featureSet};} export function assertFeature(feature){if(!canAccess(feature))throw new Error('Mock policy denied '+feature);} export function assertLogicalPath(logical){assertFeature(window.SIMNIAccessPolicy.featureForLogicalPath(logical));}`;
46: async function test(name, fn) {
54: const args = await Promise.all(message.args().map(arg => arg.evaluate(value => value?.message || String(value)).catch(() => '')));
67: const evaluate = (fn, ...args) => page.evaluate(fn,...args);
68: const click = selector => page.click(selector);
69: async function ready() { await page.waitForFunction(() => window.SIMNISyncState?.status === 'ready' && state.students.length === 3); }
70: async function nav(id) { await click('#qa-nav-' + id); }
71: async function fill(selector, value) {
76: async function saved(count) { await page.waitForFunction(count => QAMock.writes.length > count, {}, count); await page.waitForFunction(() => !document.querySelector('[data-simni-processing="true"]')); }
77: async function writeCount() { return evaluate(() => QAMock.writes.length); }
78: async function refreshSnapshot() { await evaluate(() => QAMock.write(QABase+'/notes/refresh', {ID_Catatan:'refresh',NISN:'0123456789',Catatan:'snapshot-'+Date.now(),Kelas:'3A'})); await new Promise(resolve => setTimeout(resolve,100)); }
148: const result = await evaluate(()=>dbSet('Presensi/invalid',{}));
150: const message=await evaluate(async()=>String((await dbSet('Presensi/invalid',{})).error.message));
160: const data=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].journals);
171: const conflictFeedback = await page.$eval('#toast-container',el=>el.textContent);
202: const schedule=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].schedule);
236: const result = await evaluate(async () => {
250: const result = await evaluate(async () => {
262: const result = await evaluate(async () => {
269: const db = await new Promise((resolve, reject) => { const request = indexedDB.open('AdminKelasDB', 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
308: const original = await evaluate(() => ({ raw: QAMock.dump().workspaces[SIMNICurrentAccess.workspaceId].academicYears['2026-2027'].grades, state: JSON.stringify(state.nilaiTP) }));
312: const refusal = await evaluate(async () => { const result=await dbSet('Presensi/guard',{});return {ok:result.ok,message:result.error?.message}; });
325: const draftTrace = failures.length ? await evaluate(()=>window.QADraftTrace || []).catch(()=>[]) : [];
~~~~

### `qa/academic-workflow-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createServer } from 'node:http';
2: import { readFile, mkdir, writeFile } from 'node:fs/promises';
3: import path from 'node:path';
4: import assert from 'node:assert/strict';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
17: const server = createServer(async (request, response) => {
30: content = `export function getAccessContext(){return window.SIMNICurrentAccess;} export function canAccess(feature){return ${featureSet};} export function assertFeature(feature){if(!canAccess(feature))throw new Error('Mock policy denied '+feature);} export function assertLogicalPath(logical){assertFeature(window.SIMNIAccessPolicy.featureForLogicalPath(logical));}`;
46: async function test(name, fn) {
54: const args = await Promise.all(message.args().map(arg => arg.evaluate(value => value?.message || String(value)).catch(() => '')));
67: const evaluate = (fn, ...args) => page.evaluate(fn,...args);
68: const click = selector => page.click(selector);
69: async function ready() { await page.waitForFunction(() => window.SIMNISyncState?.status === 'ready' && state.students.length === 3); }
70: async function nav(id) { await click('#qa-nav-' + id); }
71: async function fill(selector, value) {
76: async function saved(count) { await page.waitForFunction(count => QAMock.writes.length > count, {}, count); await page.waitForFunction(() => !document.querySelector('[data-simni-processing="true"]')); }
77: async function writeCount() { return evaluate(() => QAMock.writes.length); }
78: async function refreshSnapshot() { await evaluate(() => QAMock.write(QABase+'/notes/refresh', {ID_Catatan:'refresh',NISN:'0123456789',Catatan:'snapshot-'+Date.now(),Kelas:'3A'})); await new Promise(resolve => setTimeout(resolve,100)); }
148: const result = await evaluate(()=>dbSet('Presensi/invalid',{}));
150: const message=await evaluate(async()=>String((await dbSet('Presensi/invalid',{})).error.message));
160: const data=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].journals);
201: const schedule=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].schedule);
235: const result = await evaluate(async () => {
249: const result = await evaluate(async () => {
261: const result = await evaluate(async () => {
268: const db = await new Promise((resolve, reject) => { const request = indexedDB.open('AdminKelasDB', 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
307: const original = await evaluate(() => ({ raw: QAMock.dump().workspaces[SIMNICurrentAccess.workspaceId].academicYears['2026-2027'].grades, state: JSON.stringify(state.nilaiTP) }));
312: const refusal = await evaluate(async () => { const result=await dbSet('Presensi/guard',{});return {ok:result.ok,message:result.error?.message}; });
324: const draftTrace = failures.length ? await evaluate(()=>window.QADraftTrace || []).catch(()=>[]) : [];
~~~~

### `qa/admin-client-retry.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { readFile, writeFile, mkdir } from 'node:fs/promises';
~~~~

Fungsi dan cabang entry point:
~~~~text
19: async function test(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
~~~~

### `qa/admin-operations-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.
Keterangan source: const identity = { claims: { sub: 'owner', email: 'unggaran.sditbm@gmail.com' }, profile: { status: 'active', role: 'superuser', workspaceId: 'ws_superuser', classId: '3A', activeAcademicYearId: '2026-2027' } };

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { mkdir, writeFile } from 'node:fs/promises';
3: import { executeAdminOperation, recoverAdminOperation } from '../edge/admin-operations.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
7: function fixture() {
9: const apply = updates => { for (const [path, value] of Object.entries(updates)) value === null ? store.delete(path) : store.set(path, structuredClone(value)); };
18: const body = (id = 'op_synthetic_00000001') => ({ operationId: id, action: 'annual_reset', targetId: 'all', expectedYear: '2026-2027', updates: { Presensi: null } });
19: async function test(name, fn) { try { await fn(); evidence.checks.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (e) { evidence.checks.push({ name, status: 'FAIL', error: e.stack }); process.exitCode = 1; console.error('FAIL', name, e); } }
30: const f = fixture(); f.mode(mode); await assert.rejects(executeAdminOperation(f.io, identity, body()), e => e.pending); f.mode('');
31: const r = await recoverAdminOperation(f.io, identity, body().operationId); assert.equal(r.receipt.status, 'committed'); assert.equal(f.events.filter(e => e === 'data').length, 1);
~~~~

### `qa/asset-worker-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { readFile, writeFile, mkdir } from 'node:fs/promises';
~~~~

Fungsi dan cabang entry point:
~~~~text
8: const base64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
9: async function token(overrides={}) {
36: async function request(route,body={},jwt=validToken,origin='https://simni.qa.invalid') {
39: async function test(name,fn){await fn();evidence.checks.push({name,status:'PASS'});console.log('PASS',name);}
~~~~

### `qa/backup-recovery-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import crypto from 'node:crypto';
3: import path from 'node:path';
4: import { fileURLToPath, pathToFileURL } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
34: async function runTest(name, fn) {
46: function createMockDatabase(sizeFactor = 1) {
294: function simulateImportValidation(rawFileSize, parsedObj) {
331: async function simulateMarkRolloverArchiveReady(envelope, access) {
~~~~

### `qa/build-lps-reference-data.py`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

### `qa/capture-screenshots.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, readFileSync, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
21: function createQaServer() {
~~~~

Binding event/aksi publik:
~~~~text
87: window.SIMNICurrentAccess = { role: 'superuser' };
88: window.state = {
100: window.dbSet = async () => ({ ok: true });
101: window.dbUpdate = async () => ({ ok: true });
102: window.renderDashboard = () => {};
~~~~

### `qa/chat-removal-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
3: import path from 'node:path';
4: import { createRequire } from 'node:module';
6: const policy = require('../js/auth/access-policy-core.js');
45: const core=require('../features/backup/backup-core.js');const recovery=core.getSubsystemRecoveryManifest();
~~~~

Fungsi dan cabang entry point:
~~~~text
9: const read = p => readFile(p,'utf8');
10: async function test(name, fn) { await fn(); result.checks.push({name,status:'PASS'}); console.log('PASS',name); }
11: async function absent(p) { try { await stat(p); assert.fail('Removed path still exists: '+p); } catch(e) { if(e.code !== 'ENOENT') throw e; } }
~~~~

### `qa/cross-subsystem-storage-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import crypto from 'node:crypto';
3: import path from 'node:path';
4: import { fileURLToPath, pathToFileURL } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
25: function mockNavigatorStorage(estimateFn) {
40: async function test(name, fn) {
~~~~

Binding event/aksi publik:
~~~~text
182: globalThis.window.SIMNICurrentAccess = globalThis.SIMNICurrentAccess;
183: globalThis.window.state = {};
~~~~

### `qa/database-capacity-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import crypto from 'node:crypto';
3: import { readFile } from 'node:fs/promises';
4: import path from 'node:path';
5: import { fileURLToPath, pathToFileURL } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
33: async function runTest(name, fn) {
46: function resetMockDatabase() {
49: function setMockStore(pathStr, data) {
57: function getFromMockStore(pathStr) {
67: function createMockRefFn() {
95: function generateRecords(count, prefix = 'rec', classAssigner = null) {
158: const testData = generateRecords(count, 'ann', (i) => {
204: const all3A = res3A.items.every(r => r.Kelas === '3A');
~~~~

### `qa/debug-writes.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
25: function resolvePublicPath(requestUrl) {
33: const server = createServer((req, res) => {
79: const syncInfo = await page.evaluate(() => {
92: const tpTest = await page.evaluate(async () => {
134: const editTest = await page.evaluate(async () => {
171: const presensiTest = await page.evaluate(async () => {
196: const gradesTest = await page.evaluate(async () => {
~~~~

### `qa/e2e-ui-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, readFileSync, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
32: function report(condition, label) {
43: function resolvePublicPath(requestUrl) {
51: function createQaServer() {
91: async function listen(server) {
98: async function closeServer(server) {
131: const logoProbe = await page.evaluate(() => ({
138: const themeProbe = await page.evaluate(() => {
149: const roleMatrix = await page.evaluate(() => ({
156: const themeRoleGuard = await page.evaluate(() => {
166: const navigationGuard = await page.evaluate(() => {
177: const inlineHandlerCount = await page.evaluate(() =>
182: const protectedFragmentsBeforeAuth = await page.evaluate(() =>
207: const settingsClosed = await page.$eval('#modal-pengaturan', (modal) =>
211: const manifest = await page.evaluate(async () => {
272: const gradeWorkflow = await workflowPage.evaluate(async () => {
335: const attendanceWorkflow = await workflowPage.evaluate(async () => {
362: const saveFeedbackWorkflow = await workflowPage.evaluate(async () => {
405: const gadmMounted = await gadmPage.evaluate(async () => {
448: const gadmOfflineStorage = await gadmPage.evaluate(async () => {
491: const gadmSuperuser = await gadmPage.evaluate(async () => {
519: const chatNavigationContract = await page.evaluate(() => ({
533: const mobileHeaderAndBadge = await mobilePage.evaluate(() => {
570: const loginTransitionContract = await mobilePage.evaluate(async () => {
590: const unlockBeforeReload = await mobilePage.evaluate(async () => {
607: const unlockAfterReload = await mobilePage.evaluate(async () => {
628: const chatUiContract = await chatPage.evaluate(() => ({
639: const composerContract = await chatPage.evaluate(() => {
652: const audioPlaybackContract = await chatPage.evaluate(async () => {
672: const timeout = setTimeout(() => reject(new Error('Metadata WAV timeout')), 5000);
685: const timeout = setTimeout(() => reject(new Error('Playback WAV tidak bergerak')), 5000);
686: const progressed = () => {
777: const restoringSessionUI = await mockSuperuserPage.evaluate(() => ({
787: const mockBeforeChat = await mockSuperuserPage.evaluate(() => ({
815: const mockAfterReopen = await mockSuperuserPage.evaluate(() => ({
834: const mockAfterChat = await mockSuperuserPage.evaluate(() => ({
849: const workerState = await page.evaluate(async () => {
851: const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 45_000));
869: const responseChecks = await page.evaluate(async () => {
893: const offlineAuthState = await page.evaluate(() => ({
907: const offlineAssetReady = await page.evaluate(async () => {
~~~~

Binding event/aksi publik:
~~~~text
241: window.SIMNICurrentAccess = {
251: window.state = {
263: window.dbSet = async () => ({ ok: true });
264: window.dbUpdate = async () => ({ ok: true });
265: window.dbRemove = async () => ({ ok: true });
266: window.renderDashboard = () => {};
408: window.state = {
415: window.getSIMNIActiveClass = () => window.state.activeKelas;
416: window.SIMNICurrentAccess = {
426: window.SIMNIAccess = Object.freeze({ canAccess: (feature) => feature === 'gadm' });
435: exportsReady: typeof window.XLSX?.writeFile === 'function' && typeof window.html2pdf === 'function',
498: window.SIMNICurrentAccess = {
627: await chatPage.waitForFunction(() => typeof window.SIMNIChatDebug === 'object', { timeout: 15_000 });
673: audio.addEventListener('loadedmetadata', () => {
677: audio.addEventListener('error', () => {
692: audio.addEventListener('timeupdate', progressed);
743: window.SIMNICurrentAccess = access;
744: window.SIMNIAccess = Object.freeze({
750: window.isUserLoggedIn = true;
751: window.SIMNIAuthState = Object.freeze({
764: window.resumeSIMNIAuthSession = () => {
860: new Promise((resolve) => worker.addEventListener('statechange', () => {
~~~~

### `qa/excel-template-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import ExcelJS from 'exceljs';
2: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
7: function assert(condition, message) {
17: function clone(value) {
21: function fingerprintParts(worksheet) {
64: function fingerprint(worksheet) {
68: function differences(left, right) {
74: function duplicateWorksheet(workbook, templateModel, name) {
~~~~

### `qa/final-cumulative-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import './tahap7-final-runner.mjs';
~~~~

### `qa/frontend-simplification-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import crypto from 'node:crypto';
3: import fs from 'node:fs';
4: import path from 'node:path';
5: import { fileURLToPath, pathToFileURL } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
29: async function test(name, fn) {
83: function calcBytes(list) {
274: function unmountActiveView(viewId) {
~~~~

Binding event/aksi publik:
~~~~text
155: addEventListener(ev, fn) { if (ev === 'load') setTimeout(fn, 10); }
~~~~

### `qa/gadm-engine-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import GADM_ENGINE from '../features/gadm/gadm-engine.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
5: function run(name, input, expectedValid = true) {
191: const passed = tests.filter((test) => test.passed).length;
~~~~

### `qa/gadm-mobile-workflow-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createServer } from 'node:http';
2: import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
3: import path from 'node:path';
4: import process from 'node:process';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
22: function safePublicPath(url) {
30: const server = createServer(async (request, response) => {
110: function record(name, passed, detail = '') {
115: async function setValues(values) {
126: async function selectDocument(type) {
133: async function generateAndVerify(type, expectedHeading, filename) {
138: const snapshot = await page.evaluate((heading) => {
180: async function waitForDownload(extension, before, timeoutMs = 30_000) {
184: const candidate = files.find((name) => name.toLowerCase().endsWith(extension) && !before.has(name));
197: async function clickAndCaptureDownload(button, extension, timeoutMs) {
203: async function verifyExports(expectedTitle) {
213: const unsupportedColors = await page.evaluate(() => {
235: const pdfState = await page.evaluate(() => ({
251: const entryContract = await page.evaluate(() => ({
259: const identity = await page.evaluate(() => ({
281: const cpContract = await page.evaluate(() => ({
290: const provenanceVerified = await page.evaluate(() => document.getElementById('gadm-preview')?.textContent.includes('Record KB terverifikasi') === true);
340: const returnedToForm = await page.evaluate(() => document.getElementById('gadm-root')?.dataset.gadmPane === 'form'
345: const errors = await page.evaluate(() => window.SIMNIDiagnostics?.entries?.filter((entry) => entry.level === 'error') || []);
353: const passed = results.filter((result) => result.passed).length;
~~~~

Binding event/aksi publik:
~~~~text
82: window.SIMNICurrentAccess = access;
83: window.SIMNIAccess = Object.freeze({
87: window.isUserLoggedIn = true;
88: window.SIMNIAuthState = Object.freeze({
~~~~

### `qa/generate-import-fixtures.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import fs from 'node:fs';
2: import path from 'node:path';
3: import XLSX from 'xlsx';
~~~~

Fungsi dan cabang entry point:
~~~~text
15: function writeWorkbook(filename, sheetRows) {
33: const studentMultiRows = new Map(classes.map((className) => [className, []]));
61: const tpMultiRows = new Map(classes.map((className) => [className, []]));
~~~~

### `qa/generated-lps-excel-verification.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import ExcelJS from 'exceljs';
2: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
13: function assert(condition, message) {
23: function clone(value) {
27: function fingerprint(worksheet) {
74: function plainCellValue(cell) {
85: function forbiddenExamples(worksheet) {
~~~~

### `qa/generated-workbook-layout-verification.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import ExcelJS from 'exceljs';
2: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
15: function assert(condition, message) {
25: function clone(value) {
29: function fingerprint(worksheet) {
85: function plainCellValue(cell) {
96: function forbiddenExamples(worksheet) {
~~~~

### `qa/inspect-excel-templates.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import ExcelJS from 'exceljs';
2: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: function cellText(cell) {
~~~~

### `qa/lifecycle-drafts-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import path from 'node:path';
3: import { fileURLToPath } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
14: async function runTest(name, fn) {
59: const walk = (node) => {
95: function showLoad(text, ownerId) {
103: function hideLoad(token) {
146: let timer = setTimeout(() => {
228: function createTestDraftManager(storage = mockDb) {
235: function key(id, discriminator = '') {
239: async function persist(id, record) {
243: async function removePersist(id) {
467: function simulateLogout(userAction) {
~~~~

### `qa/live-production-readiness.ps1`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

### `qa/lps-contract-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createRequire } from 'node:module';
2: import { readFileSync } from 'node:fs';
3: import path from 'node:path';
4: import vm from 'node:vm';
8: const core = require(path.join(root, 'features/lps/lps-core.js'));
~~~~

Fungsi dan cabang entry point:
~~~~text
13: function assert(condition, message) {
32: const aspects = template.sections.flatMap((section) => section.aspects);
34: const signature = aspect.options.map((option) => option.toUpperCase()).join('|');
46: const lpsAspects = lps.sections.flatMap((section) => section.aspects);
53: const murojaah = blp.sections.flatMap((section) => section.aspects)
58: assert(/function createResponseChecklist\(/.test(source)
62: assert(/function createResponseSelect\(/.test(source)
65: assert(/function createResponseTextInput\(/.test(source)
~~~~

### `qa/lps-native-fidelity.py`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

### `qa/lps-reference-inspect.py`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

### `qa/lps-release-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.
Keterangan source: const deferred=[];for(const f of ['vendor/xlsx/xlsx.full.min.js','vendor/exceljs/exceljs.min.js','vendor/html2pdf/html2pdf.bundle.min.js','vendor/html5-qrcode/html5-qrcode.min.js','vendor/jszip/jszip.min.js']){const b=await readFile(path.join('public',f));deferred.push({file:f,bytes:b.length,gzip:gzipSync(b).length});}

Dependensi:
~~~~text
1: import {readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import{execFileSync}from'node:child_process';
~~~~

Fungsi dan cabang entry point:
~~~~text
2: const hash=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(await readFile('public/build-manifest.json','utf8')),mismatches=[],sourceMismatches=[],syntax=[];
4: const sw=await readFile('public/sw.js','utf8'),pre=sw.slice(sw.indexOf('const PRECACHE_PATHS'),sw.indexOf('const PRECACHE_URLS'));const paths=[...pre.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);let precacheBytes=0;for(const p of paths)precacheBytes+=(await readFile(path.join('public',p))).length;
6: const all=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else all.push(f.replaceAll('\\','/'));}}await walk('public');
7: const forbidden=all.filter(f=>/\/qa\/|mock-adapter|academic-mock|uiux-.*mock|\/test-output\/|\/chat\/edge\//.test(f));
9: const result={version:pkg.version,buildId:manifest.buildId,buildIdVerified:hash(JSON.stringify(manifest.files))===manifest.buildId,hashFiles:Object.keys(manifest.files).length,mismatches,sourceMismatches,forbidden,syntaxChecked:syntax.length,versions,precacheCount:paths.length,precacheBytes,deferredVendors:deferred};await writeFile('test-output/lps-template-fidelity/final-artifact-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(mismatches.length||sourceMismatches.length||forbidden.length||!result.buildIdVerified||Object.values(versions).some(v=>v!==pkg.version))process.exitCode=1;
~~~~

### `qa/lps-template-workflow.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';import{startAuditServer}from'./uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});const completed=new Set(),downloadNames=new Map();cdp.on('Browser.downloadWillBegin',e=>downloadNames.set(e.guid,e.suggestedFilename));cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')completed.add(e.guid);});
7: const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
8: async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);if(!e)throw Error('Missing '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}
9: async function test(name,fn){try{r.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){r.checks.push({name,status:'FAIL',error:e.stack,feedback:await page.$eval('#toast-container',e=>e.innerText).catch(()=>null)});console.log('FAIL',name,e.message);}await writeFile(path.join(out,'workflow-results.json'),JSON.stringify(r,null,2));console.log(r.checks.at(-1).status,name);}
10: async function builder(){await page.click('[data-simni-action="openModalPengaturanLPS"]');await page.waitForFunction(()=>!document.querySelector('#modal-pengaturan-lps').classList.contains('hidden'));}
11: async function saveBuilder(){const before=await page.evaluate(()=>QAMock.writes.length);await page.click('#lps-save-template-button');await page.waitForFunction(n=>QAMock.writes.length>n,{},before);await page.waitForFunction(()=>document.querySelector('#modal-pengaturan-lps').classList.contains('hidden'));await page.waitForFunction(()=>!document.querySelector('#lps-save-template-button').disabled && !document.querySelector('[data-simni-processing="true"]'));assert.equal(await page.evaluate(()=>gunakanTemplateLPSAktif()),true);}
12: async function populate(){await page.evaluate(()=>{
19: async function download(label){const before=new Set(completed);await page.click('[data-simni-action="exportExcelLPS"]');for(let i=0;i<180;i++){await wait(200);const guid=[...completed].find(id=>!before.has(id)),f=downloadNames.get(guid);if(f){const bytes=await readFile(path.join(downloads,guid));assert.ok(bytes.length>500);const name=label+'.xlsx';await writeFile(path.join(out,name),bytes);r.downloads.push({label,file:name,guid,suggestedFilename:f,bytes:bytes.length});return {file:name,guid,bytes:bytes.length};}}throw Error('Unduhan tidak selesai: '+await page.$eval('#toast-container',e=>e.innerText));}
49: const result=await page.evaluate(async()=>{const el=document.querySelector('#modal-pengaturan-lps'),input=el.querySelector('.lps-builder-aspect-title'),style=getComputedStyle(input);const a=await axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,modalOverflow:el.scrollWidth>el.clientWidth,border:style.borderTopWidth,background:style.backgroundColor,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))};});
59: const cached=await page.evaluate(async()=>{const paths=['templates/BLP contoh.xlsx','vendor/jszip/jszip.min.js'];return Promise.all(paths.map(async p=>({path:p,cached:!!(await caches.match(new URL(p,location.href).href))})))});assert.ok(cached.every(e=>e.cached));
~~~~

### `qa/prepare-tahap7-baseline.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { readFile, writeFile, mkdir } from 'node:fs/promises';
2: import { createHash } from 'node:crypto';
3: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: const hash = value => createHash('sha256').update(value).digest('hex');
8: let bytes = await readFile(path.join(base, file)).catch(() => null);
~~~~

### `qa/prepare-three-findings-candidate.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
~~~~

### `qa/reconstruct-uiux-stage2.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Fungsi dan cabang entry point:
~~~~text
2: async function edit(file,fn){let old=await readFile(file,'utf8');old=old.replaceAll('\r\n','\n');const next=fn(old);if(next===old)throw Error('No edit '+file);await writeFile(file,next);}
~~~~

Binding event/aksi publik:
~~~~text
16: await edit('features/gadm/gadm.js',s=>s.replace("getElementById('gadm-download-excel')?.addEventListener('click', () => {\n        try {\n            exportExcel();", "getElementById('gadm-download-excel')?.addEventListener('click', async (event) => {\n        const button = event.currentTarget; button.disabled = true; button.setAttribute('aria-busy', 'true');\n        try {\n            await exportExcel();").replace("            await exportExcel();\n        } catch (error) {\n            notify(error.message || error, 'error');\n        }", "            await exportExcel();\n        } catch (error) {\n            notify(error.message || error, 'error');\n        } finally { button.disabled = false; button.removeAttribute('aria-busy'); }"));
~~~~

### `qa/reconstruct-uiux-stage3.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Fungsi dan cabang entry point:
~~~~text
2: let s=await readFile('features/settings/settings.html','utf8');s=s.replace(/<label([^>]*?)>([^<]+)<\/label>\s*(<(?:input|select|textarea)\b[^>]*\bid="([^"]+)")/g,(m,attrs,text,control,id)=>attrs.includes('for=')?m:'<label'+attrs+' for="'+id+'">'+text+'</label>'+control).replace('id="theme-selector-dropdown"','id="theme-selector-dropdown" aria-label="Tema warna aplikasi"');await writeFile('features/settings/settings.html',s);
~~~~

### `qa/reconstruct-uiux.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Fungsi dan cabang entry point:
~~~~text
4: async function edit(file,fn){const old=await readFile(file,'utf8'),next=fn(old);if(old===next)throw Error('No change '+file);await writeFile(file,next);}
6: const a=s.indexOf('function showLoad('),b=s.indexOf('function playBeep(');
8: function showLoad(text) {
14: const reveal = () => {
26: function hideLoad() {
39: const c=s.indexOf('function toast('),d=s.indexOf('// A successful commit',c);
40: s=s.slice(0,c)+`function toast(message, type = 'info') {
79: await edit('features/dashboard/dashboard.js',s=>s.replace(/function renderDashboard\(\)\s*\{/,"function renderDashboard() {\n    window.updateSyncUI?.(window.SIMNISyncState?.status === 'ready' && window.SIMNISyncState?.connected === true);"));
90: await edit('chat/js/chat-ui-handler.js',s=>s.replace("byId('chat-session-label').textContent = 'Online · Terenkripsi end-to-end';","updateConnectionLabel();").replace("authUnsubscribe = observeChatSession",`function updateConnectionLabel() {
~~~~

Binding event/aksi publik:
~~~~text
56: close.setAttribute('aria-label', 'Tutup pemberitahuan'); close.addEventListener('click', () => node.remove());
76: window.SIMNILastConnectionLabel = label;`);
88: await edit('features/gadm/gadm.js',s=>s.replace("card.setAttribute('aria-checked',", "if (card.getAttribute('role') === 'radio') card.setAttribute('aria-checked',").replace("card.addEventListener('click', () => {", "card.addEventListener('click', (event) => {\n            if (card.getAttribute('role') === 'group' || event.target.closest('button')) return;").replace("if (e.key === 'Enter' || e.key === ' ') {", "if (e.target !== card || card.getAttribute('role') === 'group') return;\n            if (e.key === 'Enter' || e.key === ' ') {"));
95: window.addEventListener('online', updateConnectionLabel);
96: window.addEventListener('offline', updateConnectionLabel);
~~~~

### `qa/record-lps-revalidation.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import {readFile,writeFile,copyFile} from 'node:fs/promises';
2: import {createHash} from 'node:crypto';
~~~~

Fungsi dan cabang entry point:
~~~~text
3: const hash=s=>createHash('sha256').update(s).digest('hex');
4: const read=async p=>JSON.parse(await readFile(p,'utf8'));
10: const suite=cumulative.suites.find(s=>s.script==='qa/lps-template-workflow.mjs');
~~~~

### `qa/reproduce-user-bugs.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
25: function resolvePublicPath(requestUrl) {
33: const server = createServer((req, res) => {
159: const presensiRes = await page.evaluate(async () => {
189: const popupRes = await page.evaluate(async () => {
209: const jurnalRes = await page.evaluate(async () => {
~~~~

Binding event/aksi publik:
~~~~text
98: window.SIMNICurrentAccess = {
108: window.SIMNIAccess = {
125: window.dbSet = async (path, val) => {
129: window.dbUpdate = async (updates) => {
133: window.dbRemove = async (path) => {
137: window.renderDashboard = () => {};
~~~~

### `qa/revise-lps-templates.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import {readFile,writeFile} from 'node:fs/promises';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: const selectStart=source.indexOf('    function populateTemplateSourceSelect()');
10: const helperStart=source.indexOf('    function normalizeExcelText('),nameStart=source.indexOf('    function uniqueExcelSheetName('),nameEnd=source.indexOf('    function cloneExcelValue(',nameStart),exportStart=source.indexOf('    async function exportExcelLPS()'),exportEnd=source.indexOf('    function reportForOutput()',exportStart);
12: const replacement=`    async function exportExcelLPS() {
34: const name=uniqueExcelSheetName({getWorksheet:name=>used.has(name)},student,index);
~~~~

### `qa/runtime-sandbox-test.js`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
11: const path = require('node:path');
12: const crypto = require('node:crypto');
13: const fs = require('node:fs');
40: const policy = require(path.join(ROOT, 'js/auth/access-policy-core.js'));
131: const BackupCore = require(path.join(ROOT, 'features/backup/backup-core.js'));
395: const { subtle } = require('node:crypto').webcrypto;
~~~~

Fungsi dan cabang entry point:
~~~~text
20: function assert(condition, label) {
31: function section(title) {
359: const siswaEntry = summary.find(e => e.path === 'Siswa');
~~~~

### `qa/security-contract-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { readFileSync, readdirSync, statSync } from 'node:fs';
2: import { createRequire } from 'node:module';
3: import path from 'node:path';
4: import process from 'node:process';
96: const policy = require(path.join(root, 'js/auth/access-policy-core.js'));
97: const workspacePaths = require(path.join(root, 'js/database/workspace-paths-core.js'));
~~~~

Fungsi dan cabang entry point:
~~~~text
17: function read(relativePath) {
21: function collect(directory, extensions, output = []) {
38: function assert(condition, id, message) {
53: const combinedSource = sourceFiles.map((file) => read(file)).join('\n');
71: const globalHeaders = firebaseConfig.hosting.headers.find((entry) => entry.source === '**')?.headers || [];
72: const csp = globalHeaders.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value || '';
102: const attendancePaths = Object.values(roleContexts).map((context) =>
144: && !/function unlockScreen\(\)[\s\S]{0,400}setTimeout/.test(read('js/ui/navigation.js')),
164: const uploadFormSource = /function buildUploadForm[\s\S]*?return form;/.exec(cloudinaryClient)?.[0] || '';
177: const missingActions = [...declaredActions].filter((action) => !registeredActions.has(action));
~~~~

### `qa/serve-local.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, readFileSync, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
~~~~

Fungsi dan cabang entry point:
~~~~text
12: const FIREBASE_HEADERS = FIREBASE_CONFIG.hosting?.headers?.find((entry) => entry.source === '**')?.headers || [];
25: function createQaServer() {
~~~~

### `qa/serve-public.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createReadStream, statSync } from 'node:fs';
2: import { createServer } from 'node:http';
3: import path from 'node:path';
4: import process from 'node:process';
~~~~

Fungsi dan cabang entry point:
~~~~text
20: function resolveRequestPath(requestUrl) {
28: const server = createServer((request, response) => {
~~~~

### `qa/server-validation-audit-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { readFile } from 'node:fs/promises';
~~~~

### `qa/smoke-test.js`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: const puppeteer = require('puppeteer');
~~~~

Fungsi dan cabang entry point:
~~~~text
38: const swStatus = await page.evaluate(async () => {
48: const cacheNames = await page.evaluate(async () => {
~~~~

### `qa/static-contract-regression.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
2: import { createHash } from 'node:crypto';
3: import { spawnSync } from 'node:child_process';
4: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
9: const absolute = (relativePath) => path.join(ROOT, relativePath);
10: const read = (relativePath) => readFileSync(absolute(relativePath), 'utf8');
11: const json = (relativePath) => JSON.parse(read(relativePath));
19: function assert(condition, id, message) {
29: function files(directory, extensions, output = []) {
88: const runtimeJavaScript = javascript.filter((file) => !file.startsWith('qa') && !file.startsWith('scripts'));
89: const allSource = [allMarkup, ...runtimeJavaScript.map((file) => read(file))].join('\n');
163: const headers = firebase.hosting?.headers?.find((entry) => entry.source === '**')?.headers || [];
164: const csp = headers.find((header) => String(header.key).toLowerCase() === 'content-security-policy')?.value || '';
~~~~

### `qa/sw-upgrade-rollback-contract-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import { readFileSync } from 'node:fs';
3: import path from 'node:path';
4: import process from 'node:process';
5: import { fileURLToPath } from 'node:url';
~~~~

Fungsi dan cabang entry point:
~~~~text
14: async function test(name, fn) {
50: const precachePaths = [...slice.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
~~~~

### `qa/tahap7-cache-gap-diagnostic.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
2: import { readFile, writeFile } from 'node:fs/promises';
~~~~

Fungsi dan cabang entry point:
~~~~text
11: const result={buildId:manifest.buildId,kind:'KNOWN_BLOCKER_DIAGNOSTIC',finding:'S07',status:deleted.includes(candidates[0])&&deleted.includes(candidates[2])?'REPRODUCED':'NOT_REPRODUCED',fixtureCacheNames:candidates,deletedCacheNames:deleted,impact:'The safe purge function removes active app-shell and unrelated caches, not only SIMNI runtime entries.',scope:'Only synthetic Cache API objects in a Node process; no real browser data touched'};
~~~~

### `qa/tahap7-evidence-summary.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { readFile, writeFile, mkdir } from 'node:fs/promises';
2: import { createHash } from 'node:crypto';
~~~~

Fungsi dan cabang entry point:
~~~~text
3: const read = async p => JSON.parse(await readFile(p,'utf8'));
4: const hash = async p => createHash('sha256').update(await readFile(p)).digest('hex');
~~~~

### `qa/tahap7-final-runner.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { spawn } from 'node:child_process';
2: import { readFile, mkdir, writeFile } from 'node:fs/promises';
3: import { createHash } from 'node:crypto';
4: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
8: const hash = value => createHash('sha256').update(value).digest('hex');
9: async function assertArtifact() {
32: const code = await new Promise((resolve, reject) => {
~~~~

### `qa/tahap7-lifecycle-browser.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createServer } from 'node:http';
2: import { readFile, mkdir, writeFile } from 'node:fs/promises';
3: import path from 'node:path';
4: import assert from 'node:assert/strict';
5: import puppeteer from 'puppeteer';
~~~~

Fungsi dan cabang entry point:
~~~~text
14: const server = createServer(async (req, res) => {
40: async function waitActivated(versionId) {
47: async function page() {
59: async function check(name, fn) {
74: const config = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
80: const waitingVersion = [...versions.values()].find(version => version.status === 'installed' && version.scriptURL === origin + '/sw.js');
90: const config = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
100: const value = await p.evaluate(async () => { await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
115: const value = await p.evaluate(async () => { await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
119: const dirty = await p.evaluate(() => {
127: const restored = await p.evaluate(async () => { SIMNICurrentAccess = { ...SIMNICurrentAccess, uid: 'local-B' }; await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); form.querySelector('input').value = ''; SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
142: const rollbackConfig = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
144: const records = await p.evaluate(() => new Promise((resolve, reject) => { const req = indexedDB.open('SIMNIDraftsDB'); req.onsuccess = () => { const db = req.result, read = db.transaction('academicDrafts').objectStore('academicDrafts').getAll(); read.onsuccess = () => { resolve(read.result); db.close(); }; read.onerror = reject; }; req.onerror = reject; }));
~~~~

Binding event/aksi publik:
~~~~text
53: window.SIMNICurrentAccess = { uid: 'local-A', role: 'superuser', workspaceId: 'local-workspace', activeAcademicYearId: '2026-2027' };
54: window.normalizeClassLabel = value => String(value || '').trim();
108: if (this.name === 'academicDrafts') { const tx = this.transaction; req.addEventListener('success', () => tx.abort(), { once: true }); IDBObjectStore.prototype.put = original; }
~~~~

### `qa/tahap7-rules-emulator.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import { createRequire } from 'node:module';
2: import { readFile, mkdir, writeFile } from 'node:fs/promises';
3: import vm from 'node:vm';
4: import assert from 'node:assert/strict';
5: import { executeAdminOperation, recoverAdminOperation } from '../edge/admin-operations.js';
6: import { subscribeLivePages } from '../js/database/live-pages.js';
8: const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
9: const firebase = require('firebase/compat/app');
~~~~

Fungsi dan cabang entry point:
~~~~text
15: async function test(name, fn) { try { await fn(); evidence.checks.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (error) { evidence.checks.push({ name, status: 'FAIL', error: error.message }); process.exitCode = 1; console.error('FAIL', name, error.message); } }
57: const privileged = async fn => { let result; await env.withSecurityRulesDisabled(async context => { result = await fn(context.database()); }); return result; };
73: const sample=Object.fromEntries(Array.from({length:35},(_,i)=>[String(i),{value:i}]));
75: const sdk={query:(r,...constraints)=>constraints.reduce((q,f)=>f(q),r),orderByKey:()=>r=>r.orderByKey(),startAfter:key=>r=>r.startAfter(key),endAt:key=>r=>r.endAt(key),limitToFirst:n=>r=>r.limitToFirst(n),onValue:(r,next,error)=>{r.on('value',next,error);return()=>r.off('value',next);}};
77: const until=async fn=>{for(let i=0;i<200;i++){if(failure)throw failure;if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('live range timeout');};
87: const decode=vm.runInNewContext('('+repo.slice(repo.indexOf('function normalizeArchiveCompatibility('),repo.indexOf('async function readAnnualArchive(')).trim()+')');
~~~~

### `qa/tahap7-ui-diagnostic.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';
2: import { startAuditServer } from './uiux-audit-server.mjs';
~~~~

### `qa/three-findings-evidence.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
2: import {createHash} from 'node:crypto';
~~~~

Fungsi dan cabang entry point:
~~~~text
3: const read=async p=>JSON.parse(await readFile(p,'utf8'));
4: const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
21: const result={completedAt:new Date().toISOString(),version:manifest.version,buildId:manifest.buildId,hostingFiles:Object.keys(manifest.files).length,hostingBytes:bytes,suites:20,evidence,sourceHashes,localGate:'PASS',findings:['S07','S02','S05'].map(id=>({id,status:'RESOLVED_LOCALLY'})),deployment:'NOT_PERFORMED_FOR_4.7.2',deploymentDependencies:['New assets/admin Worker with secrets and confirmed URL','RTDB rules before Hosting','Administrative maintenance for old clients'],limits:['Active year still materialized in memory for legacy UI; live queries bounded by record count and split on received byte size','Cache snapshot 32 MiB and total 96 MiB remain; online writes survive cache persistence refusal','Unknown commit with no provable marker stays pending for operator review','No cloud capacity/CPU, physical-device/APK, production-write or long-term-soak certification','Lifecycle baseline is local 4.7.0, not deployed 4.6.9']};
~~~~

### `qa/three-findings-local.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import assert from 'node:assert/strict';
2: import vm from 'node:vm';
3: import { readFile, mkdir, writeFile } from 'node:fs/promises';
4: import { subscribeLivePages } from '../js/database/live-pages.js';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: async function test(name, fn){await fn();result.checks.push({name,status:'PASS'});console.log('PASS',name);}
7: const delay=ms=>new Promise(r=>setTimeout(r,ms));
8: async function until(fn){for(let i=0;i<300;i++){if(fn())return;await delay(10);}throw Error('Condition timed out');}
19: const cache={keys:async()=>[...entries.keys()].map(url=>new Request(url)),match:async r=>entries.get(r.url)?.clone(),delete:async r=>entries.delete(r.url),put:async(r,v)=>{if(quotaFailure)throw Error('Quota exceeded');entries.set(r.url,v);}};
21: const context=vm.createContext({console,URL,Request,Response,Headers,Blob,TextEncoder,Map,Set,Promise,Date:class extends Date {static now(){return fakeNow;}},setTimeout,clearTimeout,importScripts(){},SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},self:{SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},registration:{scope:'https://qa.invalid/'},addEventListener(){}},caches:{open:async()=>cache},fetch:async()=>new Response('network image',{headers:{'Content-Type':'image/png'}})});
23: const functions=sw.slice(sw.indexOf('const RUNTIME_CACHE_POLICY'),sw.indexOf('/*',sw.indexOf('async function storeRuntimeAsset')));
24: const runtime=sw.slice(sw.indexOf('async function staleWhileRevalidateRuntimeAsset'),sw.indexOf('/*',sw.indexOf('async function staleWhileRevalidateRuntimeAsset')));
25: // The function contains comments: locate its end by the following INSTALL marker.
27: vm.runInContext('const RUNTIME_CACHE_NAME="simni-runtime-qa";const isSuccessfulResponse=r=>r.ok;const offlineResponse=()=>new Response("offline",{status:503});\n'+functions+'\n'+sw.slice(sw.indexOf('async function staleWhileRevalidateRuntimeAsset'),runtimeEnd),context);
36: const total=[...entries.values()].reduce((n,r)=>n+Number(r.headers.get('x-simni-cache-bytes')),0);assert.ok(total<=16*1024*1024);
44: let data=Object.fromEntries(Array.from({length:25001},(_,i)=>['k'+String(i).padStart(6,'0'),{value:'x'.repeat(720),index:i}]));
46: function snap(constraints){let keys=Object.keys(data).sort();for(const c of constraints){if(c.type==='start')keys=keys.filter(k=>k>c.value);if(c.type==='end')keys=keys.filter(k=>k<=c.value);}const limit=constraints.find(c=>c.type==='limit')?.value;keys=keys.slice(0,limit);maxSeen=Math.max(maxSeen,keys.length);return {val:()=>Object.fromEntries(keys.map(k=>[k,data[k]])),forEach:fn=>keys.forEach(k=>fn({key:k,val:()=>data[k]}))};}
47: const sdk={orderByKey:()=>({type:'order'}),startAfter:value=>({type:'start',value}),endAt:value=>({type:'end',value}),limitToFirst:value=>({type:'limit',value}),query:(_, ...constraints)=>constraints,onValue:(constraints,success,failure)=>{const listener={constraints,success,failure};listeners.add(listener);queueMicrotask(()=>{if(listeners.has(listener))success(snap(constraints));});return()=>listeners.delete(listener);}};
~~~~

Binding event/aksi publik:
~~~~text
21: const context=vm.createContext({console,URL,Request,Response,Headers,Blob,TextEncoder,Map,Set,Promise,Date:class extends Date {static now(){return fakeNow;}},setTimeout,clearTimeout,importScripts(){},SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},self:{SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},registration:{scope:'https://qa.invalid/'},addEventListener(){}},caches:{open:async()=>cache},fetch:async()=>new Response('network image',{headers:{'Content-Type':'image/png'}})});
~~~~

### `qa/uiux-audit-server.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import {createServer} from 'node:http';
2: import {readFile} from 'node:fs/promises';
3: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
6: const access=`export const getAccessContext=()=>window.SIMNICurrentAccess;
7: export const canAccess=feature=>window.SIMNIAccess?.canAccess(feature)===true;
8: export function assertFeature(feature){if(!canAccess(feature))throw new Error('MOCK_ACCESS_DENIED '+feature);}
9: export const assertLogicalPath=logical=>assertFeature(window.SIMNIAccessPolicy.featureForLogicalPath(logical));
10: export const establishAccessContext=async()=>window.SIMNICurrentAccess;`;
11: const client=`export const database={kind:'mock'};export const auth={currentUser:{uid:'uiux-superuser',getIdToken:async()=>'LOCAL_MOCK_ONLY'}};export const runtime={mode:'mock'};export const firebaseApp={};export const firebaseConfig={projectId:'admin-kelas-3a'};export function applyFirebaseRuntimeUI(){};`;
20: export async function startAuditServer(){
21: const server=createServer(async(req,res)=>{
~~~~

### `qa/uiux-auth-mock.js`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
2: import {ref,get,set} from '../../vendor/firebase/firebase-database.js';
~~~~

Binding event/aksi publik:
~~~~text
4: window.UIUXLogin=async()=>{
8: window.SIMNICurrentAccess=access;
9: window.SIMNIAccess={canAccess:feature=>SIMNIAccessPolicy.hasFeature(role,feature),applyAccessUI(){
19: window.SIMNIDatabaseTarget={mode:'mock',projectId:'uiux-isolated'};
20: window.isUserLoggedIn=true; state.activeKelas='3A';
23: window.QABase=base;
36: window.SIMNIAuthState={phase:'session-ready',uid:access.uid,role,loginBusy:false};
39: sessionStorage.setItem('uiux-session',role);window.UIUXReady=true;
40: window.UIUXLoginDuration=performance.now()-started;
42: window.loginAuth=window.UIUXLogin;
43: window.logoutAuth=async()=>{stopFirebaseListener();sessionStorage.removeItem('uiux-session');window.UIUXReady=false;lockScreen();document.documentElement.dataset.simniAuthPhase='signed-out';};
44: window.resetPasswordAuth=()=>toast('Respons reset akun tiruan.','info');
45: window.resumeSIMNIAuthSession=()=>true;
47: window.SIMNIAuthState={phase:'signed-out',loginBusy:false};
48: window.UIUXAuthReady=true;
~~~~

### `qa/uiux-evidence-summary.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.
Keterangan source: const sourceButtons=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())await walk(f);else if(f.endsWith('.html')){const text=await readFile(f,'utf8');for(const m of text.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi))sourceButtons.push({file:f.replaceAll('\\','/'),line:text.slice(0,m.index).split('\n').length,html:m[0],audit:'Static inventory; action coverage see report'});}}}await walk('features');await walk('chat');const shell=await readFile('index.html','utf8');for(const m of shell.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi))sourceButtons.push({file:'index.html',line:shell.slice(0,m.index).split('\n').length,html:m[0],audit:'Static inventory; action coverage see report'});await writeFile(out+'/source-buttons.json',JSON.stringify(sourceButtons,null,2));

Dependensi:
~~~~text
1: import {readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';import{createHash}from'node:crypto';
~~~~

Fungsi dan cabang entry point:
~~~~text
4: const history=[];for(const file of(await readdir('.')).filter(f=>f.endsWith('.md'))){const text=await readFile(file,'utf8');history.push({file,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),headings:text.split(/\r?\n/).filter(l=>/^#{1,3} /.test(l)),uiuxHistory:text.split(/\r?\n/).filter(l=>/UI|UX|responsi|popup|pop.?up|offline|mobile|cache|loading|modal/i.test(l))});}
8: const safe=v=>String(v).replaceAll('|','/').replaceAll('\n',' ').slice(0,120);let md='# Inventaris kontrol UI/UX 4.6.7\n\n127 identitas kontrol dari 1.633 sampel geometri pada 53 keadaan layar. Identitas dideduplikasi menurut ID, action, dan teks; kontrol berulang per siswa disatukan. Label di inventaris merupakan teks/atribut mentah, bukan perhitungan accessible-name. Elemen yang tertutup overlay atau berada di luar viewport masih dapat masuk sampel DOM. Ukuran <44 px adalah kandidat ergonomi; bukan otomatis kegagalan WCAG 2.5.8. Status aksi harus dilihat di laporan, bukan disimpulkan dari inventaris.\n\n| No | ID / label | Action | Minimum W×H CSS px | Audit ukuran | Keadaan contoh |\n|---|---|---|---|---|---|\n';let i=0;for(const c of controls.values())md+=`| ${++i} | ${safe(c.id||c.label||'(kontrol tanpa teks)')} | ${safe(c.action)} | ${c.minWidth}×${c.minHeight} | ${c.minWidth<44||c.minHeight<44?'Tinjau target sentuh':'≥44 pada sampel'} | ${safe(c.states.slice(0,3).join(', '))} |\n`;await writeFile(out+'/CONTROL_INVENTORY.md',md);
9: const sourceButtons=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())await walk(f);else if(f.endsWith('.html')){const text=await readFile(f,'utf8');for(const m of text.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi))sourceButtons.push({file:f.replaceAll('\\','/'),line:text.slice(0,m.index).split('\n').length,html:m[0],audit:'Static inventory; action coverage see report'});}}}await walk('features');await walk('chat');const shell=await readFile('index.html','utf8');for(const m of shell.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi))sourceButtons.push({file:'index.html',line:shell.slice(0,m.index).split('\n').length,html:m[0],audit:'Static inventory; action coverage see report'});await writeFile(out+'/source-buttons.json',JSON.stringify(sourceButtons,null,2));
10: const sw=await readFile('public/sw.js','utf8'),pre=sw.slice(sw.indexOf('const PRECACHE_PATHS'),sw.indexOf('const PRECACHE_URLS'));const precache=[...pre.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);let preBytes=0;for(const f of precache)preBytes+=(await readFile(path.join('public',f))).length;
11: const summary={buildId:manifest.buildId,version:manifest.version,hashFiles:integrity.length,hashMismatches:integrity.filter(i=>!i.match),screens:r.screens.length,axeStates:r.screens.filter(s=>s.axe).length,controlSamples:r.screens.reduce((n,s)=>n+s.controls.length,0),controlIdentities:controls.size,staticButtons:sourceButtons.length,precacheCount:precache.length,precacheBytes:preBytes,allPublicBytes:r.assets.reduce((n,a)=>n+a.bytes,0),publicGzipEstimate:r.assets.reduce((n,a)=>n+a.gzip,0),historicalRootMarkdown:history.length};await writeFile(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
~~~~

### `qa/uiux-feedback-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';import{writeFile}from'node:fs/promises';import{startAuditServer}from'./uiux-audit-server.mjs';
~~~~

### `qa/uiux-final-artifact-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.
Keterangan source: const deferred=[];for(const f of ['vendor/xlsx/xlsx.full.min.js','vendor/exceljs/exceljs.min.js','vendor/html2pdf/html2pdf.bundle.min.js','vendor/html5-qrcode/html5-qrcode.min.js','vendor/jszip/jszip.min.js']){const b=await readFile(path.join('public',f));deferred.push({file:f,bytes:b.length,gzip:gzipSync(b).length});}

Dependensi:
~~~~text
1: import {readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import{execFileSync}from'node:child_process';
~~~~

Fungsi dan cabang entry point:
~~~~text
2: const hash=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(await readFile('public/build-manifest.json','utf8')),mismatches=[],sourceMismatches=[],syntax=[];
4: const sw=await readFile('public/sw.js','utf8'),pre=sw.slice(sw.indexOf('const PRECACHE_PATHS'),sw.indexOf('const PRECACHE_URLS'));const paths=[...pre.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);let precacheBytes=0;for(const p of paths)precacheBytes+=(await readFile(path.join('public',p))).length;
6: const all=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else all.push(f.replaceAll('\\','/'));}}await walk('public');
7: const forbidden=all.filter(f=>/\/qa\/|mock-adapter|academic-mock|uiux-.*mock|\/test-output\/|\/chat\/edge\//.test(f));
9: const result={version:'4.6.8',buildId:manifest.buildId,buildIdVerified:hash(JSON.stringify(manifest.files))===manifest.buildId,hashFiles:Object.keys(manifest.files).length,mismatches,sourceMismatches,forbidden,syntaxChecked:syntax.length,versions,precacheCount:paths.length,precacheBytes,deferredVendors:deferred};await writeFile('test-output/uiux-4.6.8/final-artifact-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(mismatches.length||sourceMismatches.length||forbidden.length||!result.buildIdVerified||Object.values(versions).some(v=>v!=='4.6.8'))process.exitCode=1;
~~~~

### `qa/uiux-final-verification.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';
2: import assert from 'node:assert/strict';
3: import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
4: import path from 'node:path';
5: import {startAuditServer} from './uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
9: const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
12: const completed=new Set();cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')completed.add(e.guid);});
13: async function test(name,fn){try{r.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){r.checks.push({name,status:'FAIL',error:e.stack});}console.log(r.checks.at(-1).status,name);await writeFile(path.join(out,'results.json'),JSON.stringify(r,null,2));}
14: async function view(n){await page.evaluate(n=>switchView(n),n);await page.waitForFunction(n=>document.getElementById('view-'+n)?.hidden===false,{},n);await wait(200);}
15: async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}
16: async function scan(label){if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({url:origin+'/qa/axe.js'});const result=await page.evaluate(async()=>{const a=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {width:innerWidth,scroll:document.querySelector('#main-scroll-area').scrollWidth,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};});r.screens.push({label,...result});await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});assert.ok(result.scroll<=result.width+2,JSON.stringify(result));assert.equal(result.violations.length,0,JSON.stringify(result));return result;}
17: async function download(selector,ext){const before=new Set(await readdir(downloads)),count=completed.size;await page.click(selector);for(let i=0;i<240;i++){await wait(250);const file=(await readdir(downloads)).find(n=>n.endsWith(ext)&&!before.has(n));if(file&&completed.size>count){const bytes=await readFile(path.join(downloads,file));assert.ok(bytes.length>500);await writeFile(path.join(out,'verified-'+file),bytes);return {file,bytes:bytes.length,signature:bytes.subarray(0,8).toString(),completed:true};}}throw Error('No completed '+ext+' download');}
~~~~

### `qa/uiux-focused-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';
2: import {writeFile,mkdir,readdir,readFile} from 'node:fs/promises';
3: import path from 'node:path';
4: import {startAuditServer} from './uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
8: const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
9: async function save(){await writeFile(path.join(out,process.env.UIUX_FOLLOWUP?'followup.json':'focused.json'),JSON.stringify(r,null,2));}
10: async function test(name,fn){if(process.env.UIUX_FOLLOWUP&&!/Jurnal populated|Offline database|Chat upload/.test(name))return;try{const evidence=await fn();r.checks.push({name,status:'OBSERVED',evidence});console.log(name,JSON.stringify(evidence).slice(0,190));}catch(e){r.checks.push({name,status:'BLOCKED',error:e.message});console.log('BLOCKED',name,e.message);}await save();}
11: async function newpage(context){const p=await context.newPage();await p.setViewport({width:390,height:844});await p.setRequestInterception(true);p.on('request',q=>{if(!q.url().startsWith(origin)&&!q.url().startsWith('data:')&&!q.url().startsWith('blob:')){r.external.push(q.url());q.abort();}else q.continue();});p.on('pageerror',e=>r.errors.push(e.message));p.on('dialog',d=>d.dismiss());await p.evaluateOnNewDocument(()=>{window.UPerf={long:[],cls:0,lcp:0};for(const type of ['longtask','layout-shift','largest-contentful-paint'])try{new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(type==='longtask')UPerf.long.push(e.duration);if(type==='layout-shift'&&!e.hadRecentInput)UPerf.cls+=e.value;if(type==='largest-contentful-paint')UPerf.lcp=e.startTime;})).observe({type,buffered:true});}catch{}});return p;}
12: async function view(name){await page.evaluate(n=>switchView(n),name);await page.waitForFunction(n=>document.getElementById('view-'+n)?.hidden===false,{},name);await pause(450);}
13: async function fill(selector,value){await page.evaluate((s,v)=>{const e=document.querySelector(s);if(!e)throw new Error('Missing '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},selector,value);}
14: async function shot(name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
15: async function axe(){await page.addScriptTag({url:origin+'/qa/axe.js'});return page.evaluate(async()=>{const a=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});}
16: async function downloadFile(selector,ext){const old=await readdir(download);await page.click(selector);for(let i=0;i<100;i++){await pause(200);const names=await readdir(download),name=names.find(n=>!old.includes(n)&&n.endsWith(ext));if(name){const b=await readFile(path.join(download,name));return {name,bytes:b.length,signature:b.subarray(0,8).toString()};}}throw new Error('Download timeout '+ext);}
~~~~

Binding event/aksi publik:
~~~~text
11: async function newpage(context){const p=await context.newPage();await p.setViewport({width:390,height:844});await p.setRequestInterception(true);p.on('request',q=>{if(!q.url().startsWith(origin)&&!q.url().startsWith('data:')&&!q.url().startsWith('blob:')){r.external.push(q.url());q.abort();}else q.continue();});p.on('pageerror',e=>r.errors.push(e.message));p.on('dialog',d=>d.dismiss());await p.evaluateOnNewDocument(()=>{window.UPerf={long:[],cls:0,lcp:0};for(const type of ['longtask','layout-shift','largest-contentful-paint'])try{new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(type==='longtask')UPerf.long.push(e.duration);if(type==='layout-shift'&&!e.hadRecentInput)UPerf.cls+=e.value;if(type==='largest-contentful-paint')UPerf.lcp=e.startTime;})).observe({type,buffered:true});}catch{}});return p;}
~~~~

### `qa/uiux-forensic-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';
2: import {mkdir,writeFile,readFile,readdir,stat} from 'node:fs/promises';
3: import path from 'node:path';
4: import {gzipSync} from 'node:zlib';
5: import {startAuditServer,auditRequests} from './uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
15: const pause=ms=>new Promise(r=>setTimeout(r,ms));
16: async function check(name,fn){try{const evidence=await fn();results.checks.push({name,status:'OBSERVED',evidence});console.log(name,JSON.stringify(evidence).slice(0,200));}catch(e){results.checks.push({name,status:'BLOCKED',error:e.message});console.log('BLOCKED',name,e.message);}}
17: async function geometry(label,axe=true,screenshot=false){
18: const snapshot=await page.evaluate(()=>{
19: const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden]');};
20: const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(visible).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,label:(e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.title||'').trim().slice(0,100),action:e.dataset.simniAction||e.dataset.shellAction||e.getAttribute('onclick')||'',width:+r.width.toFixed(1),height:+r.height.toFixed(1),x:+r.x.toFixed(1),y:+r.y.toFixed(1),font:s.fontSize,disabled:e.disabled||false,ariaBusy:e.getAttribute('aria-busy'),outline:s.outlineStyle};});
27: async function view(name){await page.evaluate(n=>switchView(n),name);await page.waitForFunction(n=>{const e=document.getElementById('view-'+n);return e&&!e.hidden&&!e.classList.contains('hidden');},{timeout:15000},name);await pause(450);}
28: async function fields(values){await page.evaluate(values=>{for(const [id,value]of Object.entries(values)){const e=document.getElementById(id);if(!e)throw new Error('Missing '+id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}},values);}
56: async function walk(dir){for(const d of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,d.name);if(d.isDirectory())await walk(f);else{const b=await readFile(f);results.assets.push({path:path.relative('public',f).replaceAll('\\','/'),bytes:b.length,gzip:gzipSync(b).length});}}}
~~~~

Binding event/aksi publik:
~~~~text
14: await page.evaluateOnNewDocument(()=>{window.UIUXPerf={longTasks:[],cls:0,lcp:0};for(const type of ['longtask','layout-shift','largest-contentful-paint'])try{new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(type==='longtask')UIUXPerf.longTasks.push(e.duration);if(type==='layout-shift'&&!e.hadRecentInput)UIUXPerf.cls+=e.value;if(type==='largest-contentful-paint')UIUXPerf.lcp=e.startTime;})).observe({type,buffered:true});}catch{}});
~~~~

### `qa/uiux-output-audit.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';import {writeFile,mkdir,readdir,readFile}from'node:fs/promises';import path from'node:path';import{startAuditServer}from'./uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
2: const out=path.resolve('test-output/uiux-4.6.7'),downloads=path.join(out,'output-downloads');await mkdir(downloads,{recursive:true});const{server,origin}=await startAuditServer(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage(),r={errors:[],external:[],checks:[]};await page.setViewport({width:390,height:844});page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text());});await page.setRequestInterception(true);page.on('request',q=>{if(q.url().startsWith(origin)||q.url().startsWith('data:')||q.url().startsWith('blob:'))q.continue();else{r.external.push(q.url());q.abort();}});const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
3: const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}async function check(name,fn){try{r.checks.push({name,evidence:await fn()});}catch(e){r.checks.push({name,error:e.message});}console.log(JSON.stringify(r.checks.at(-1)).slice(0,800));await writeFile(path.join(out,'output-checks.json'),JSON.stringify(r,null,2));}
~~~~

### `qa/uiux-reconstruction-test.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import{mkdir,readFile,writeFile,readdir}from'node:fs/promises';import path from'node:path';import{startAuditServer}from'./uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
4: const build=JSON.parse(await readFile('public/build-manifest.json','utf8'));const r={checks:[],screens:[],errors:[],external:[],version:build.version,buildId:build.buildId};const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
8: async function save(){await writeFile(path.join(out,'reconstruction-results.json'),JSON.stringify(r,null,2));}
9: async function test(name,fn){try{const evidence=await fn();r.checks.push({name,status:'PASS',evidence});console.log('PASS',name,JSON.stringify(evidence)?.slice(0,100));}catch(e){const diagnostic=await page.evaluate(()=>({view:window.state?.currentView,focus:document.activeElement?.outerHTML.slice(0,180),feedback:document.querySelector('#toast-container')?.innerText,unsaved:window.SIMNIFormDrafts?.hasUnsaved(),picker:document.querySelector('#gadm-selector-modal')?.outerHTML.slice(0,180)})).catch(()=>null);r.checks.push({name,status:'FAIL',error:e.message,diagnostic});await page.screenshot({path:path.join(out,'failure-'+r.checks.length+'.png')}).catch(()=>{});console.log('FAIL',name,e.message,JSON.stringify(diagnostic));}await save();}
10: async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);if(!e)throw Error('Missing '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}
11: async function view(n){await page.evaluate(n=>switchView(n),n);await page.waitForFunction(n=>document.getElementById('view-'+n)?.hidden===false,{timeout:15000},n);await wait(200);}
12: async function scan(label,screenshot=false){if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({url:origin+'/qa/axe.js'});const s=await page.evaluate(async()=>{const a=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {width:innerWidth,main:document.querySelector('#main-scroll-area')?.scrollWidth,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:a.incomplete.map(v=>v.id)};});r.screens.push({label,...s});if(screenshot)await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});console.log('SCAN',label,s.violations.map(v=>v.id));await save();return s;}
~~~~

Binding event/aksi publik:
~~~~text
7: await page.evaluateOnNewDocument(()=>{window.UPerf={long:[],lcp:0,cls:0};for(const type of ['longtask','largest-contentful-paint','layout-shift'])new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(type==='longtask')UPerf.long.push(e.duration);if(type==='largest-contentful-paint')UPerf.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)UPerf.cls+=e.value;})).observe({type,buffered:true});});
21: await test('UX01 UX10 LPS BLP draft preview single dispatch',async()=>{await view('lps');await fill('#lps-select-siswa','1200000001');const evidence=[];await page.evaluate(()=>{window.UPreviewCalls=0;const original=window.previewLPS;window.previewLPS=(...args)=>{UPreviewCalls++;return original(...args);};});for(const type of ['lps_mid_s1','blp_final_s1']){await fill('#lps-select-periode',type);await fill('#lps-teacher-note','Catatan '+type);const before=await page.evaluate(()=>QAMock.writes.length);await page.click('#lps-save-draft-button');await page.waitForFunction(n=>QAMock.writes.length>n,{},before);await page.click('[data-simni-action="previewLPS"]');await page.waitForFunction(()=>document.querySelector('#lps-preview-modal').classList.contains('is-open'));const data=await page.evaluate(()=>({length:document.querySelector('#lps-preview-content').textContent.length,focus:document.querySelector('#lps-preview-modal').contains(document.activeElement)}));assert.ok(data.length>1000&&data.focus);evidence.push({type,...data});await scan(type+'-preview',true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.querySelector('#lps-preview-modal').classList.contains('is-open')),false);}assert.equal(await page.evaluate(()=>UPreviewCalls),2);return evidence;});
~~~~

### `qa/uiux-reflow-verification.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import{writeFile,mkdir}from'node:fs/promises';import path from'node:path';import{startAuditServer}from'./uiux-audit-server.mjs';
~~~~

Fungsi dan cabang entry point:
~~~~text
2: const out=path.resolve('test-output/uiux-4.6.8/reflow');await mkdir(out,{recursive:true});const{server,origin}=await startAuditServer(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage(),r={checks:[],errors:[],external:[]};page.on('pageerror',e=>r.errors.push(e.message));await page.setRequestInterception(true);page.on('request',q=>{if(q.url().startsWith(origin)||q.url().startsWith('data:')||q.url().startsWith('blob:'))q.continue();else{r.external.push(q.url());q.abort();}});
3: async function view(n){await page.evaluate(n=>switchView(n),n);await page.waitForFunction(n=>document.getElementById('view-'+n)?.hidden===false,{},n);}
4: async function test(name,fn){try{r.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){r.checks.push({name,status:'FAIL',error:e.stack,overflow:await page.evaluate(()=>[...document.querySelectorAll('.view-section:not([hidden]) *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth;}).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,25))});}console.log(r.checks.at(-1).status,name);}
~~~~

### `qa/update-server-audit-source.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.
Keterangan source: if(start<0||end<0)throw Error('Audit boundary missing');; if(from<0||to<0)throw Error('Rollover boundary missing');

Dependensi:
~~~~text
2: import fs from 'node:fs';
~~~~

Fungsi dan cabang entry point:
~~~~text
3: const edit=(file,fn)=>fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')));
5: const start=s.indexOf('export async function dbRecordAuthoritativeAudit('),end=s.indexOf('export async function logSIMNIAuditEvent',start);
7: s=s.slice(0,start)+`export async function dbRecordAuthoritativeAudit() {
13: const from=s.indexOf('        const updates = {};',s.indexOf('export async function dbCommitAcademicYearRollover'));
25: const start=s.indexOf('    async function writeAudit('),end=s.indexOf('\n    async function ',start+20);
~~~~

### `qa/write-three-findings-report.mjs`
Direktori: `qa`. Fungsi: Pengujian/regresi/mock; bukan runtime produksi.

Dependensi:
~~~~text
1: import {readFile,writeFile} from 'node:fs/promises';
~~~~

Fungsi dan cabang entry point:
~~~~text
4: const count=name=>evidence.evidence[name].checks;
~~~~

### `scripts/build-hosting.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.
Keterangan source: throw new Error('Version authority source tidak konsisten. Build dibatalkan sebelum public diubah.');

Dependensi:
~~~~text
1: import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
2: import path from 'node:path';
3: import process from 'node:process';
4: import { createHash } from 'node:crypto';
~~~~

Fungsi dan cabang entry point:
~~~~text
23: function requiredDeploymentValue(name) {
29: function validateEdgeUrl(value) {
126: async function ensureExists(relativePath) {
132: async function copyIntoPublic(sourceRelative, targetRelative = sourceRelative) {
140: async function resetOutputDirectory() {
142: const clearDirectory = async (directory) => {
164: async function assertNoUnexpectedHostingFiles() {
234: async function fingerprint(directory) {
~~~~

### `scripts/extract-gadm-curriculum.py`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

### `scripts/generate-architecture-doc.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.
Keterangan source: SIMNI menggabungkan fungsi:

Dependensi:
~~~~text
1: import { writeFileSync, statSync } from 'node:fs';
~~~~

### `scripts/generate-kotlin-doc.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

Dependensi:
~~~~text
1: import { writeFileSync, statSync } from 'node:fs';
102: import androidx.room.Entity
103: import androidx.room.PrimaryKey
104: import androidx.room.Index
200: import com.google.firebase.database.DataSnapshot
201: import com.google.firebase.database.DatabaseError
202: import com.google.firebase.database.DatabaseReference
203: import com.google.firebase.database.ValueEventListener
204: import kotlinx.coroutines.channels.awaitClose
205: import kotlinx.coroutines.flow.Flow
206: import kotlinx.coroutines.flow.callbackFlow
228: import android.content.Context
229: import androidx.hilt.work.HiltWorker
230: import androidx.work.*
231: import dagger.assisted.Assisted
232: import dagger.assisted.AssistedInject
233: import id.my.simni.core.database.dao.AttendanceDao
234: import id.my.simni.core.database.dao.GradeDao
235: import com.google.firebase.database.FirebaseDatabase
236: import kotlinx.coroutines.tasks.await
273: import io.ktor.client.*
274: import io.ktor.client.call.*
275: import io.ktor.client.request.*
276: import io.ktor.http.*
277: import javax.inject.Inject
308: import androidx.camera.core.*
309: import androidx.camera.view.PreviewView
310: import androidx.compose.foundation.layout.*
311: import androidx.compose.material3.*
312: import androidx.compose.runtime.*
313: import androidx.compose.ui.Modifier
314: import androidx.compose.ui.platform.LocalContext
315: import androidx.compose.ui.platform.LocalLifecycleOwner
316: import androidx.compose.ui.viewinterop.AndroidView
317: import com.google.mlkit.vision.barcode.BarcodeScanning
318: import com.google.mlkit.vision.common.InputImage
319: import java.util.concurrent.Executors
~~~~

### `scripts/generate-snapshot.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

Dependensi:
~~~~text
1: import { readFileSync, writeFileSync, statSync } from 'node:fs';
2: import { createHash } from 'node:crypto';
3: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
5: const hash = data => createHash('sha256').update(data).digest('hex');
8: const publicFiles = Object.keys(manifest.files).filter(f =>
~~~~

### `scripts/ocr-gadm-curriculum.py`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

### `scripts/refactor-inline-events.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

Dependensi:
~~~~text
1: import { readdir, readFile, writeFile } from 'node:fs/promises';
2: import path from 'node:path';
3: import process from 'node:process';
~~~~

Fungsi dan cabang entry point:
~~~~text
8: const none = (event, action, args = null) =>
11: const declaration = (trigger, action, options = {}) => {
65: async function htmlFiles(target) {
66: const info = await import('node:fs/promises').then(({ stat }) => stat(target));
69: const nested = await Promise.all(entries.map((entry) => {
92: const leftovers = [...output.matchAll(/\son[a-z]+\s*=\s*"[^"]*"/gi)].map((match) => match[0]);
~~~~

### `scripts/verify-hosting.mjs`
Direktori: `scripts`. Fungsi: Build, pemeriksaan artefak atau tooling; baca command sebelum menjalankan.

Dependensi:
~~~~text
1: import { readFile, readdir } from 'node:fs/promises';
2: import { createHash } from 'node:crypto';
3: import path from 'node:path';
~~~~

Fungsi dan cabang entry point:
~~~~text
4: const hash = data => createHash('sha256').update(data).digest('hex');
9: async function walk(dir) { for(const item of await readdir(dir,{withFileTypes:true})) {
~~~~

### `sw.js`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.
Keterangan source: FILE: sw.js; FUNGSI:; - version authority dari runtime-config.js;

Fungsi dan cabang entry point:
~~~~text
102: async function storeRuntimeAsset(cache, request, response) {
115: const persist = async () => {
127: let total = entries.reduce((sum, entry) => sum + entry.size, 0);
414: function isSameOrigin(
424: function isSuccessfulResponse(
438: function offlineResponse(
463: async function fetchForPrecache(
535: async function installAppCache() {
631: async function activateCurrentVersion() {
691: async function cacheFirstAppShell(
756: async function networkFirstNavigation(
826: async function staleWhileRevalidateRuntimeAsset(
~~~~

Binding event/aksi publik:
~~~~text
907: self.addEventListener(
929: self.addEventListener(
957: self.addEventListener(
979: self.addEventListener(
~~~~

### `tailwind-offline.css`
Direktori: `.`. Fungsi: Dokumen referensi/historis atau konfigurasi/aset root; perannya mengikuti nama dan isi file.

### `vendor/jszip/jszip.min.js`
Direktori: `vendor/jszip`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `vendor/tesseract/ind.traineddata.gz`
Direktori: `vendor/tesseract`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

### `vendor/tesseract/ocr-worker.js`
Direktori: `vendor/tesseract`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `vendor/tesseract/tesseract-core.wasm.js`
Direktori: `vendor/tesseract`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `vendor/tesseract/tesseract.min.js`
Direktori: `vendor/tesseract`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `vendor/tesseract/worker.min.js`
Direktori: `vendor/tesseract`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Isi lengkap serta hash tersedia pada snapshot; public dan aset Android diturunkan dari build, vendor dari dependency berlisensi.

### `vendor/xlsx-0.20.3.tgz`
Direktori: `vendor`. Fungsi: Dependency/aset pihak ketiga untuk runtime/build offline; pertahankan lisensi.
Biner asli disimpan dalam arsip; verifikasi memakai hash manifest.

## 11. Cakupan, pengecualian, dan pembuktian pemulihan
Disertakan: seluruh source aplikasi, Worker, rules, QA, build scripts, wrapper Android (tanpa build output), vendor lokal, public deploy, ikon, template XLSX dan referensi PDF, serta histori MD. Tidak disertakan: node_modules/repository Git, cache/build sementara, backup data produksi, kredensial, signing key, log, APK lama, arsip proyek lama dan lampiran percakapan. Tidak ada potongan source yang diganti elipsis.
Ekstraktor memulihkan seluruh file manifest dan memverifikasi hash byte per file. Uji ekstraksi hanya memeriksa integritas dokumentasi, tidak menjalankan aplikasi atau mengubah layanan. Hasil uji aktual ditambahkan setelah proses selesai.

File yang dikecualikan berdasarkan kebijakan output/rahasia/artefak lama:
```text
firestore-debug.log
SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip
SIMNI_ARSITEKTUR_DAN_SPESIFIKASI_LENGKAP.md
SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md
SIMNI_v.4.6.6.apk
SIMNI_v.4.6.6.zip
android/local.properties
```
