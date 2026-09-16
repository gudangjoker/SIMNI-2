# Audit statis paket SIMNI multi-role — 15 September 2026

## Keputusan

**TAHAN OVERLAY / MIGRASI / DEPLOYMENT.** Arsitektur dasar sesuai arah multi-role, tetapi paket belum layak langsung menimpa source aktif. Ada cacat pada lifecycle akun, reservasi, migrasi, kompatibilitas legacy dan perlindungan rollover.

Audit hanya membaca ZIP dan source lokal, menghitung checksum dan membandingkan overlay secara virtual dalam memori. Tidak mengekstrak ke source aktif, menjalankan kode paket, menjalankan migrasi/emulator, menulis database, mengubah ZIP atau menyentuh deployment Antigravity. Laporan ini tidak membuktikan perilaku runtime; temuan berikut diturunkan dari alur source dan rules yang konkret.

## Identitas dan integritas

- ZIP: `SIMNI_MULTIROLE_REVISI_SAJA_4.7.2.zip`.
- SHA-256 ZIP: `0bdd2458dd8c6dc06cf94eb45640e4d2fac095de46a5eca16bd269bec9fa0556`.
- 79 entri checksum dalam SHA256SUMS.txt diperiksa; semuanya cocok.
- Manifest Hosting: 110 berkas, build ID `068a9cf5618a1b8903a946893e632cc13aa5601cf6a20b377999baafc821947c`.
- SHA-256 110 berkas cocok ketika berkas ZIP digabung secara virtual dengan public lokal saat audit. Ini bukti kompatibilitas byte terhadap basis lokal saat ini, bukan terhadap hasil deployment Antigravity yang masih berjalan.
- Semua salinan public yang juga tercantum pada android/app/src/main/assets/public dalam ZIP identik.
- Paket adalah delta, bukan proyek mandiri. File yang tidak disertakan tetap bergantung pada basis overlay.

## Yang sudah sesuai

1. Registry menyediakan kelas 1A–6B, workspace `ws_kelas1a` sampai `ws_kelas6b`; 3A milik owner dan tidak tersedia untuk pendaftaran teacher.
2. Role `superuser`, `vip`, `teacher`; hak teacher tidak ditentukan hanya oleh nama kelas.
3. VIP mempertahankan akun existing dan `ws_pjok`, tidak dipindahkan ke undangan.
4. Cloudinary sign/delete memeriksa role superuser dan email canonical. Rules metadata documents menolak VIP/teacher.
5. Form daftar, halaman kelola akun, endpoint undangan/status dan migration dry-run tersedia.
6. Repository dalam ZIP sudah memakai `ref(database)` untuk root; hotfix path kosong presensi ada dalam file tersebut.
7. Daftar peserta rollover tidak lagi berupa dua email tetap; mencakup profil aktif yang cocok dengan tahun saat ini.

Penamaan workspace baru berbeda dari spesifikasi terdahulu tetapi **tidak dihitung sebagai bug**: laporan terbaru menyatakan owner pindah ke ws_kelas3a. Audit ini menilai keamanan implementasi perubahan itu.

## Temuan penghambat utama

Nomor baris berikut merujuk berkas **di dalam ZIP**, bukan source aktif.

### F01 — Tinggi: akun guru lama dapat diaktifkan kembali setelah diganti

**Bukti:** `edge/account-operations.js:39–54`. `replaceTeacher` menandai akun lama revoked, tetapi `setTeacherStatus` hanya memeriksa bahwa profil ber-role teacher dan menerima status active. Tidak memeriksa status revoked, pemilik slot saat ini, atau penugasan pengganti. Ia menulis users/status dan assignment lama/status menjadi active.

**Dampak:** setelah guru B menggantikan guru A, permintaan aktivasi ulang A dapat mengaktifkan dua akun untuk workspace yang sama. Rules workspace memeriksa kecocokan users dengan assignment masing-masing, bukan assignedUid slot; pengaktifan ulang dapat mengembalikan akses A terhadap data kelas B.

**Perbaikan diperlukan:** revoked tidak boleh dipulihkan oleh toggle aktif/nonaktif biasa; transaksi aktivasi harus memverifikasi slot.assignedUid dan revision terkini. UI jangan menawarkan Aktifkan untuk akun yang sudah tidak memiliki slot. Uji skenario A→B→aktifkan A.

### F02 — Tinggi: aktivasi tidak melindungi akun yang sudah memiliki profil/slot

**Bukti:** `edge/registration-operations.js:109–141` tidak membaca users/{uid} untuk menolak akun aktif/akun canonical sebelum provisioning. `finalizeReserved:97–104` mengganti users/{uid} dan assignment tahun tersebut. `edge/account-operations.js:23–33` tidak melarang undangan untuk email owner/VIP atau email yang sudah menempati slot lain.

**Dampak:** bila email sama diundang ke dua slot, UID dapat menempati dua slot sementara profil akhirnya menunjuk satu workspace. Undangan yang salah ditujukan kepada owner/VIP dapat menimpa profilnya menjadi teacher melalui request aktivasi langsung; validasi frontend policy tidak melindungi PATCH service account.

**Perbaikan diperlukan:** server menolak canonical owner/VIP dari jalur teacher, memeriksa existing assignment/slot, dan menetapkan invariant satu UID satu penugasan aktif secara atomik. Jangan hanya melarang lewat UI.

### F03 — Tinggi: validasi undangan terpisah dari CAS slot dan recovery tidak lengkap

**Bukti:** `edge/registration-operations.js:123–134`: undangan diperiksa sebelum reserveSlot; callback CAS hanya memeriksa status available, tidak hash/email/revoked/expiry undangan terbaru. `edge/account-operations.js:31–37` membuat/mencabut undangan melalui PATCH tanpa mengikuti lock finalizing. `registration-operations.js:130` menyimpan operasi sebelum reservasi; retry existing pada 116–121 langsung finalizeReserved walau slot masih available.

**Dampak:** undangan yang dicabut/diganti di antara validasi dan reservasi masih dapat dipakai. Putus setelah operation dibuat tetapi sebelum reservasi membuat retry ditolak “reservasi tidak lagi dimiliki”, bukan melanjutkan reservasi. expiresAt dicatat tetapi tidak ada jalur pemulihan slot reserved terbengkalai. `phase=finalizing` sendiri bukan bukti seluruh writer mengikuti fence.

**Perbaikan diperlukan:** validasi undangan pada record CAS yang sama, state machine per fase, proteksi perubahan undangan selama finalisasi, dan recovery yang tidak merebut commit yang mungkin sudah terjadi.

### F04 — Tinggi: pendaftaran tidak dapat dilanjutkan setelah reload atau gagal kirim email

**Bukti:** `features/registration/registration.js:17,84–88,100–102`: operationId dan invite hanya berada dalam variabel JS; keduanya baru ditetapkan setelah updateProfile dan sendEmailVerification berhasil. Saat reload nilainya hilang. Pesan email-already-in-use pada 41 menyarankan email lain/hubungi owner; tidak ada alur login untuk melanjutkan akun belum terprovisi. `register.html:57–60` hanya menyediakan tombol cek verifikasi, tidak kirim ulang/login kelanjutan.

**Dampak:** Firebase Auth dapat sudah memiliki akun tetapi pengguna tidak bisa menyelesaikan SIMNI setelah refresh, membuka link verifikasi di tab lain yang menutup tab asal, atau kegagalan pengiriman email. Membuat akun ulang ditolak karena email sudah terpakai.

**Perbaikan diperlukan:** resume berdasarkan Auth UID + status server, login existing unassigned user, kirim ulang verifikasi dengan cooldown, penyimpanan ID operasi tanpa menyimpan password/token undangan mentah sembarangan.

### F05 — Tinggi: migrasi tidak aman untuk dijalankan ulang setelah sistem mulai dipakai

**Bukti:** `scripts/migrate-multirole.mjs:103–113` menulis ulang seluruh slot, mempertahankan status saja untuk nonowner tetapi membuang assignedUid, invitation, reservation dan revision existing. Baris 103 menulis ulang parent seluruh workspace dari snapshot pembacaan; 116 menghapus ws_superuser. Tidak ada ETag/lock yang melindungi perubahan di antara GET dan PATCH. Baris 151 selalu menutup registrasi dan menulis ulang konfigurasi.

**Dampak:** rerun bisa menghasilkan slot occupied tanpa pemilik, menghapus undangan/reservasi aktif, atau menimpa write baru sejak pembacaan. Satu PATCH atomik tidak mencegah stale snapshot overwrite. Dry-run dan apply menghitung ulang rencana berbeda; belum ada pengikatan ke hash rencana yang disetujui atau read-back setelah apply.

**Perbaikan diperlukan:** migrasi idempotent, pertahankan metadata existing, fail-closed pada konflik, lock maintenance/ETag, validasi target, plan hash dan post-verification. Jangan menghapus legacy sebelum semua kompatibilitas F06 selesai.

### F06 — Tinggi: migrasi hanya memindahkan subtree, bukan seluruh referensi workspace

**Bukti:** script migrasi memindahkan workspaces/ws_superuser lalu menghapusnya, tetapi tidak mengubah scope internal arsip/backup, auditLogs, administrativeOperations atau administrativeCommitMarkers pada workspace legacy. `edge/worker.js:309–310` hanya menerima public_id dengan prefix workspace aktif baru. `features/backup/backup-core.js` tidak ada dalam ZIP; validator basis menolak scope.workspaceId yang berbeda.

**Dampak:** backup/arsip owner lama masih menyebut ws_superuser dan dapat ditolak saat restore sebagai ws_kelas3a. Status operasi pending/receipt lama tidak ditemukan pada cabang baru. Aset Cloudinary lama dengan prefix simni/ws_superuser/... tidak dapat dihapus melalui gateway yang mengharapkan simni/ws_kelas3a/.... Cache/draf lokal juga membutuhkan keputusan pemulihan legacy, bukan dianggap otomatis pindah.

**Perbaikan diperlukan:** inventaris seluruh referensi, aturan alias/migrasi legacy owner yang sempit dan terverifikasi, proteksi integritas hash arsip, pemulihan operasi pending serta kebijakan aset lama. Jangan mengganti string dalam backup tanpa menghitung ulang/menjaga bukti integritas secara benar.

### F07 — Tinggi: rollover bisa menghapus data tanpa membuktikan arsip masih melindunginya

**Bukti:** `edge/admin-operations.js:56–73` hanya membaca users, assignments dan readiness; archiveHash diperiksa format 64 hex, tidak membaca/verifikasi arsip atau kesesuaian data terbaru. Baris 88 menghapus subtree tahun lama dan 193–195 memilih privilegedServerPatch. Rules readiness `firebase/database.rules.production.json:34–35` mengizinkan pengguna aktif menulis verified=true dengan hash berformat benar.

**Dampak:** readiness palsu, readiness lama setelah perubahan nilai/presensi, atau arsip yang telah dihapus dapat tetap dianggap VERIFIED. Owner kemudian melakukan rollover yang menghapus tahun lama tanpa bukti backup terkini. Validasi frontend bukan pengaman untuk operasi service account.

**Perbaikan diperlukan:** server memverifikasi sumber arsip/receipt dan revision data aktual, mengikat readiness ke keadaan data, serta menolak perubahan data sampai commit selesai. Uji readiness palsu, arsip hilang dan data berubah setelah arsip.

### F08 — Tinggi: rollover tidak dikunci terhadap aktivasi/ganti guru dan melewatkan profil tahun berbeda

**Bukti:** `edge/admin-operations.js:61–74` membangun daftar dengan pembacaan terpisah dan melewatkan profil activeAcademicYearId berbeda (`continue`). Endpoint activation/account tidak memeriksa lock rollover. Pemindahan tahun dilakukan sesudah daftar tersebut dibuat.

**Dampak:** guru dapat diaktifkan pada tahun lama setelah daftar rollover diambil tetapi sebelum tahun global diubah, lalu tertinggal. Profil aktif yang tahunnya salah dilewatkan diam-diam, bukan dilaporkan sebagai registry tidak konsisten. Disabled workspace juga tidak memiliki kebijakan transisi tahun yang jelas sebelum diaktifkan kembali.

**Perbaikan diperlukan:** koordinasi lock/epoch yang berlaku pada rollover, activation, replacement dan status; registry mismatch harus dilaporkan sebelum mutasi. Tetapkan penanganan akun disabled agar reaktivasi tidak membuka tahun lama tanpa sengaja.

## Kekurangan tambahan

### F09 — Sedang: assignmentRevision tidak mengikuti penggantian guru

`edge/account-operations.js:51–54` menaikkan revision slot, tetapi `registration-operations.js:62` selalu menetapkan revision=1. Users lama tidak mendapat peningkatan revision. Nilai pada slot/profil/assignment dapat menyimpang dan kontrak invalidasi sesi tidak konsisten. Rules normal memeriksa profil-assignment, tetapi tidak revision slot.

### F10 — Sedang: teacher tidak memiliki pemulihan login offline yang dijanjikan

`js/auth/access-context.js:227–230` menolak teacher offline. Penambahan assignmentRevision pada key cache sudah ada, tetapi lease offline/resume cached authority teacher belum diterapkan. Ini bukan kebocoran akses, tetapi ketidaksesuaian kebutuhan PWA offline. Jangan mengklaim multi-role sepenuhnya offline-ready dari adanya IndexedDB saja.

### F11 — Sedang: proteksi endpoint publik dan detail UX belum lengkap

Route publik validate-invite pada `edge/worker.js:327–330` langsung membaca JSON dan memanggil backend; tidak ada rate limiter atau body cap khusus registrasi. Ganti guru menerima email tanpa validator setara createInvite. UI manajemen memakai prompt/confirm, belum modal lifecycle yang ditetapkan spesifikasi. Password minimal 8 pada register.html, bukan 12 pada spesifikasi. Tidak ada route Cloudinary download terotorisasi; penutupan metadata/sign/delete tidak mencabut URL publik aset lama.

Perbaikan penting diprioritaskan pada backend validation/rate limiting; detail UI dapat dikerjakan setelah invariant data aman. Jangan menambah scope produk yang tidak diminta.

### F12 — Sedang: paket delta dan prosedur rilis belum cukup untuk overlay aman

ZIP tidak memuat features/attendance/attendance.js, attendance.html, atau js/ui/navigation.js. Jadi klaim mempertahankan hotfix scanner bukan bukti hotfix itu tersedia dari ZIP ini; ia bergantung pada basis Antigravity. Hotfix root ref memang ada pada repository. Identitas institusi/tahun pada beberapa file direvisi, tetapi runtime-config dan semua file authority lain tidak seluruhnya disertakan.

Versi tetap 4.7.2 walau kontrak database dan akun berubah besar. Sebelum rilis perlu versi/build authority baru yang konsisten, baseline file yang pasti, dan validasi source/public/android setelah Antigravity selesai. Jangan memakai kecocokan hash overlay sekarang sebagai izin menimpa perubahan yang nanti dibuat Antigravity.

Urutan petunjuk Worker→migrasi→rules→Hosting meninggalkan interval di mana klien/rules lama membaca ws_superuser yang sudah dihapus. Butuh maintenance terkoordinasi, rules/Worker transisi yang kompatibel, post-migration verification dan rencana kegagalan sebelum cutover. Saat ini keberhasilan deploy 4.7.2 bukan berarti migrasi multi-role siap.

## Catatan identitas owner

Teks laporan yang dikirim menyebut `unggaran.sditbm@gmail.com` dengan variasi ejaan pada beberapa bagian percakapan. **Kode ZIP menggunakan `unggaran.sditbm@gmail.com`**, sama dengan canonical source lokal yang diperiksa. Jangan mengubah email canonical berdasarkan salah ketik laporan. Konfirmasikan dengan profil/Auth yang sebenarnya saat tahap migrasi diizinkan; audit ini tidak membaca akun produksi.

## Urutan perbaikan yang disarankan, belum dijalankan

1. Tunggu Antigravity menyelesaikan 4.7.2 dan simpan baseline final lengkap. Pertahankan ZIP ini sebagai input yang belum diterapkan.
2. Perbaiki invariant UID/slot, reaktivasi revoked, CAS undangan serta recovery pendaftaran (F01–F04, F09).
3. Perbaiki migrasi dan seluruh referensi legacy, dengan rencana apply yang terikat ke baseline dan backup (F05–F06).
4. Perbaiki verifikasi arsip dan koordinasi rollover (F07–F08).
5. Lengkapi offline, validasi endpoint serta UX yang disepakati (F10–F11).
6. Uji emulator/staging untuk Owner/VIP/Teacher, race/retry, nonaktif/ganti guru, migration rerun, legacy restore/asset cleanup dan rollover. Pastikan hotfix presensi/scanner dari basis ikut lolos.
7. Baru tentukan nomor rilis, hasil overlay final dan cutover sesuai F12. Deploy hanya setelah persetujuan pemilik.

**Kesimpulan:** gunakan paket sebagai bahan pengembangan, bukan paket siap timpa. Belum ada revisi dilakukan dalam audit ini.
