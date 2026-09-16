# Rencana final multi-role SIMNI — kendali superuser

Tanggal: 15 September 2026.

Status: **dokumen rencana, bukan implementasi atau izin deployment**. Dokumen ini merangkum keputusan diskusi terbaru dan rencana penutupan temuan audit ZIP. Tidak menyatakan fitur sudah selesai. Source, ZIP, database, dan deployment tidak diubah oleh pembuatan dokumen ini.

## 1. Tujuan dan batas pekerjaan

SIMNI tetap PWA dengan Firebase Authentication, Firebase Realtime Database, Firebase Hosting, serta Cloudflare Worker untuk operasi server terkait. Tidak dibuat ulang menjadi aplikasi Kotlin/Android native. Salinan aset Android yang sudah ada hanya mengikuti proses build yang berlaku, bukan jalur pengembangan baru.

Superuser menentukan siapa yang dapat menggunakan SIMNI, kelas penugasannya, izin fitur, serta pergantian penempatan pada tahun ajaran baru. Pendaftaran melalui undangan menghasilkan permohonan, **tidak langsung memberikan akses akademik**.

Paket ZIP menjadi referensi selektif. Jangan menimpa seluruh source dengan paket tersebut. Tunggu konfirmasi hasil akhir deployment 4.7.2 Antigravity, simpan baseline final, lalu kerjakan kandidat di direktori/check-out terpisah. Jangan mengubah dokumen asli Antigravity atau snapshot sumber.

Rencana ini menggantikan alur lama yang mengaktifkan teacher segera setelah registrasi. Keputusan terbaru di sini menjadi acuan untuk bagian yang berbeda dari spesifikasi sebelumnya. Nomor rilis berikutnya ditentukan saat kandidat final, tidak diasumsikan tetap 4.7.2.

## 2. Asal bahan dan peta implementasi

- Paket: `SIMNI_MULTIROLE_REVISI_SAJA_4.7.2.zip` di root.
- SHA-256 ZIP dari audit: `0bdd2458dd8c6dc06cf94eb45640e4d2fac095de46a5eca16bd269bec9fa0556`.
- Build ID manifest paket: `068a9cf5618a1b8903a946893e632cc13aa5601cf6a20b377999baafc821947c`.
- Laporan: `AUDIT_ZIP_MULTIROLE_2026-09-15.md`, temuan F01–F12.
- Petunjuk internal ZIP: `PETUNJUK_MULTIROLE.txt`. Urutan deployment di dalamnya belum cukup aman untuk diterapkan tanpa rancangan transisi pada dokumen ini.

Audit sebelumnya memeriksa 79 entri checksum dan 110 berkas manifest melalui penggabungan virtual dengan basis lokal. Itu bukan bukti runtime dan tidak menjamin kompatibilitas dengan perubahan Antigravity berikutnya.

Dokumen ini harus dapat dipahami tanpa membuka ZIP. **Bagian 15 memuat kutipan kode aktual, penjelasan idenya, dan kontrak penggantinya; bagian 16 memberi contoh data serta operasi final.** Tabel berikut hanya peta lokasi implementasi. Keberadaan kerangka tidak berarti implementasinya memenuhi rancangan final.

| Referensi ZIP | Yang dapat dipakai sebagai dasar | Revisi yang diperlukan |
|---|---|---|
| `js/auth/workspace-registry-core.js` | Registry 12 kelas dan cadangan 3A | Konsistensi penempatan per tahun dan pemilik slot |
| `js/auth/access-policy-core.js`, `js/auth/access-context.js`, `js/auth/auth.js` | Pemisahan role dan workspace | Status pending, izin efektif, pencabutan akses, offline teacher |
| `register.html`, `features/registration/registration.js`, `js/auth/registration-service.js` | Form undangan/verifikasi | Resume, kirim ulang email, permohonan menunggu persetujuan |
| `features/accounts/accounts.html`, `features/accounts/accounts.js` | Halaman akun khusus owner | Persetujuan, izin, penghapusan, undangan, penempatan tahun baru |
| `edge/registration-operations.js` | Pemeriksaan undangan dan reservasi | Hentikan provisioning akses langsung; finalisasi permohonan secara konsisten |
| `edge/account-operations.js` | Daftar akun, undangan, status, penggantian | Perlindungan canonical account, approval, satu pemilik slot, delete dan revision |
| `edge/worker.js`, `js/services/edge-service.js` | Gateway autentikasi dan operasi server | Endpoint baru, validasi body, batas permintaan dan izin terkini |
| `firebase/database.rules.production.json` | Isolasi workspace | Pending tidak mendapat akses; slot/assignment/revision/izin harus cocok |
| `scripts/migrate-multirole.mjs` | Dry-run dan pemetaan workspace | Migrasi aman diulang, konflik, referensi legacy, verifikasi sebelum cutover |
| `edge/admin-operations.js` | Rollover seluruh peserta aktif | Bukti arsip nyata, koordinasi penempatan dan perubahan data |
| `js/database/local-cache.js`, `js/database/sync.js`, `js/database/repository.js` | Penyimpanan dan sinkronisasi | Pemisahan cache, antrean lama setelah pencabutan, kompatibilitas migrasi |
| `index.html`, `js/core/feature-loader.js`, `scripts/build-hosting.mjs`, `sw.js` | Navigasi dan distribusi PWA | Menu owner, guard rute, identitas rilis dan pembaruan cache konsisten |

ZIP tidak menyertakan berkas scanner presensi dan navigasi tertentu yang disebut dalam klaim hotfix. Kehadiran hotfix harus diperiksa pada baseline final; jangan diasumsikan ikut hanya berdasarkan narasi paket.

## 3. Identitas, workspace, dan kepemilikan data

Role tetap `superuser`, `vip`, dan `teacher`. Nama tampilan seperti “Guru Kelas 2A” berasal dari penugasan, bukan role teknis baru untuk setiap kelas.

- Owner tetap superuser; workspace akademiknya `ws_kelas3a`.
- Workspace `ws_superuser` adalah sumber legacy untuk migrasi, bukan workspace aktif tujuan.
- Otoritas owner berasal dari identitas Firebase yang diverifikasi dan profil server. Berada di `ws_kelas3a` tidak memberikan hak superuser.
- Nilai email canonical pada source ZIP adalah `unggaran.sditbm@gmail.com`; verifikasi kecocokannya dengan Auth/profil produksi sebelum migrasi. Jangan mengganti identitas berdasarkan salah ketik narasi.
- VIP mempertahankan akun/jalur login yang ada dan `ws_pjok`; tidak diwajibkan mendaftar melalui undangan.
- File/Dokumen Cloudinary hanya untuk superuser, termasuk terhadap VIP.
- Tidak ada penambahan kembali Chat atau deployment layanan Chat dalam pekerjaan ini.

Workspace kelas:

| Kelas | Workspace | Ketentuan |
|---|---|---|
| 1A | `ws_kelas1a` | Penugasan oleh superuser |
| 1B | `ws_kelas1b` | Penugasan oleh superuser |
| 2A | `ws_kelas2a` | Penugasan oleh superuser |
| 2B | `ws_kelas2b` | Penugasan oleh superuser |
| 3A | `ws_kelas3a` | Dicadangkan untuk owner |
| 3B | `ws_kelas3b` | Penugasan oleh superuser |
| 4A | `ws_kelas4a` | Penugasan oleh superuser |
| 4B | `ws_kelas4b` | Penugasan oleh superuser |
| 5A | `ws_kelas5a` | Penugasan oleh superuser |
| 5B | `ws_kelas5b` | Penugasan oleh superuser |
| 6A | `ws_kelas6a` | Penugasan oleh superuser |
| 6B | `ws_kelas6b` | Penugasan oleh superuser |

Database tetap satu instance RTDB dengan cabang workspace terisolasi. Bukan membuat instance Firebase baru per guru. Data akademik dimiliki kelas/tahun ajaran; memindahkan atau menghapus akun guru tidak memindahkan atau menghapus data kelas.

## 4. Aturan yang tidak boleh dilanggar

1. Hanya superuser dapat menyetujui akun, memberikan/mencabut penugasan, mengubah izin, mengelola undangan dan menghapus akun.
2. Email terverifikasi dan undangan valid belum cukup untuk akses akademik: persetujuan superuser wajib.
3. Satu teacher memiliki paling banyak satu penugasan kelas aktif pada satu tahun; satu kelas memiliki paling banyak satu teacher aktif. Pengecualian owner 3A/VIP PJOK ditangani eksplisit, bukan membuka akses silang.
4. Akun, slot, penugasan, status, tahun dan revision harus konsisten. Frontend tidak menjadi sumber otoritas.
5. Revoked tidak dapat dipulihkan lewat toggle aktif biasa. Penugasan kembali memerlukan keputusan baru superuser dan pemeriksaan slot.
6. Undangan teacher tidak boleh menimpa profil owner, VIP, atau penugasan aktif akun lain.
7. Klien tidak boleh menulis sendiri role, approval, pemilik slot, izin, revision, atau bukti keberhasilan operasi administratif.
8. Cache dan antrean sinkronisasi dari penugasan lama tidak boleh menulis ke penugasan baru.
9. Semua operasi penting aman terhadap retry/klik ganda dan memiliki status pemulihan jika terputus.
10. Keputusan penempatan tidak menghapus data tahun sebelumnya.

## 5. Halaman Kelola Akun & Penugasan

Menu ini hanya muncul untuk superuser. Akses langsung URL dan request API dari role lain tetap ditolak. Satu halaman dengan bagian/tab berikut, bukan aplikasi admin baru.

### A. Ringkasan dan permohonan

Tampilkan jumlah akun menunggu, guru aktif, akun nonaktif, dan kelas belum ditugaskan. Daftar permohonan memuat nama, email, status verifikasi, kelas diminta, waktu permohonan, dan status.

Tindakan: **Tinjau**, **Setujui & Tetapkan Kelas**, **Tolak**. Superuser dapat memilih kelas berbeda dari permohonan. Sebelum menyetujui, tampilkan kelas, tahun dan izin efektif. Penolakan tidak otomatis menghapus Firebase Auth; akun hanya melihat status dan dapat ditangani melalui tindakan terpisah.

### B. Penempatan kelas

Tampilkan seluruh kelas beserta pemilik dan statusnya, termasuk kelas kosong. Tindakan: **Tetapkan Guru**, **Pindahkan Kelas**, **Ganti Guru**, **Cabut Penugasan**. Kelas 3A tampil sebagai milik owner dan tidak dapat dialihkan melalui operasi teacher.

Jika tujuan sudah terisi, tampilkan konflik. Pergantian harus eksplisit; jangan diam-diam menimpa. Pertukaran dua guru harus diproses sebagai satu perubahan penempatan yang konsisten, tanpa keadaan sementara yang membuka akses ganda.

### C. Akun & kewenangan

Tampilkan akun, status, kelas/tahun, izin efektif dan riwayat perubahan. Tindakan: **Atur Izin**, **Nonaktifkan**, **Aktifkan**, **Hapus Akun**. Akun tanpa penugasan tetap terdaftar tetapi tidak memiliki akses akademik.

Status perlu dipisahkan:

- Akun: menunggu persetujuan / aktif / nonaktif / ditolak / sedang dihapus.
- Penugasan: belum ditetapkan / aktif / dicabut / berakhir.
- Email: belum terverifikasi / terverifikasi.

Nonaktif sementara mempertahankan cadangan kelas. Mengaktifkan kembali harus memeriksa bahwa penugasan masih sah dan belum digantikan. Cabut penugasan melepaskan akses kelas, tanpa menghapus akun.

### D. Undangan Guru

Tampilkan email tujuan, kelas/tahun tujuan, waktu kedaluwarsa, dan status: belum digunakan, menunggu persetujuan, digunakan, kedaluwarsa, dicabut. Status permohonan dan status kode disimpan terpisah agar tidak ambigu.

Tindakan: **Buat Undangan**, **Salin Kode/Tautan**, **Cabut**, **Buat Ulang**.

- Kode acak kuat, sekali pakai, terikat email serta konteks undangan; nilai hash disimpan di server.
- Kode lengkap hanya tampil pada hasil pembuatan. Jika hilang, buat ulang; jangan menyimpan kode mentah di log atau riwayat.
- Bawaan usulan masa berlaku tujuh hari; dapat dipilih superuser dalam batas yang ditetapkan.
- Buat ulang mencabut kode lama secara konsisten. Jika sudah ada permohonan pending, pemilik harus diberi tahu; kode baru tidak boleh menggandakan atau menyetujui permohonan lama.
- Membuat ulang undangan **tidak mencabut akses akun aktif**. Untuk guru pindah sekolah, gunakan Ganti Guru atau Nonaktifkan/Cabut Penugasan terlebih dahulu.
- Pendaftaran ditutup ketika tidak ada slot yang boleh ditawarkan atau superuser menutupnya. Undangan penggantian hanya dibuat melalui tindakan owner yang jelas. Mengisi slot tidak boleh menggagalkan resume permohonan yang sudah sah tanpa status penjelasan.

### E. Tahun ajaran dan riwayat

Superuser menyiapkan draf penempatan tahun berikutnya, dapat menyalin susunan lama, mengubah guru, memeriksa kelas kosong/konflik, lalu **Aktifkan Penempatan Tahun Baru**.

Riwayat server memuat pelaku, target, waktu, tindakan, perubahan sebelum/sesudah yang relevan, dan ID operasi. Jangan menyimpan password, kode undangan mentah, token atau secret.

## 6. Alur pendaftaran dan persetujuan

1. Superuser membuat undangan untuk calon guru.
2. Calon guru mengisi nama, email, password dan permohonan kelas sesuai undangan; kelas 3A tidak ditawarkan.
3. Firebase Auth membuat identitas. Jika identitas sudah ada tetapi belum selesai mendaftar, sediakan login untuk melanjutkan, bukan menyuruh menggunakan email lain.
4. Guru memverifikasi email; tersedia kirim ulang dengan cooldown. Password mengikuti kebijakan final yang konsisten; rencana memakai minimum 12 karakter sesuai spesifikasi sebelumnya.
5. Server memvalidasi ulang undangan terbaru dan merekam permohonan pending secara atomik/terkoordinasi dengan slot. Guru belum mendapat assignment aktif.
6. Halaman status menampilkan “Menunggu persetujuan superuser”. Refresh dan login ulang membaca status server berdasarkan UID.
7. Superuser menyetujui serta menetapkan kelas/tahun/izin; server memeriksa konflik dan mencatat keputusan sebelum akses diberikan.
8. Guru memuat ulang otoritas dari server dan masuk workspace yang ditetapkan.

Slot yang menunggu keputusan bukan milik aktif pemohon. Reservasi atau klaim pending harus eksplisit, dapat dibatalkan owner, dan tidak menggantung tanpa recovery. Setiap fase memiliki ID operasi; retry melanjutkan fase yang benar. Jangan menyimpan password atau kode undangan mentah sembarangan untuk resume.

## 7. Kewenangan fitur

Gunakan izin per kelompok, bukan puluhan izin per tombol. Role tetap menjadi batas maksimum: izin fitur tidak dapat mengangkat teacher menjadi superuser.

| Kelompok | Pilihan teacher | Batas |
|---|---|---|
| Presensi | Tidak diizinkan / lihat / kelola | Workspace dan tahun penugasan |
| Nilai & TP | Tidak diizinkan / lihat / kelola | Workspace dan tahun penugasan |
| Jurnal | Tidak diizinkan / lihat / kelola | Workspace dan tahun penugasan |
| GADM | Tidak diizinkan / lihat / kelola | Data terkait kelas sendiri |
| LPS/BLP | Tidak diizinkan / lihat / kelola | Data terkait kelas sendiri |
| Ekspor kelas | Diizinkan / tidak | Tidak memberikan akses baca tambahan |
| File/Dokumen Cloudinary | Tidak tersedia | Superuser saja, termasuk terhadap VIP |
| Akun, undangan, izin, administrasi global | Tidak tersedia | Superuser saja |

Data siswa dan fitur akademik lain yang sudah ada wajib masuk inventaris izin sebelum implementasi rules; jangan meninggalkan endpoint tulis di luar pemeriksaan. Preset teacher harus ditampilkan dalam ringkasan persetujuan. Gunakan satu pemetaan izin bersama; perubahan izin menaikkan revision otoritas.

Menutup menu Cloudinary tidak mencabut URL aset publik yang sudah diketahui. Membuat aset lama privat adalah keputusan penyimpanan tersendiri; jangan mengklaim sudah privat atau memigrasikannya tanpa cakupan yang jelas.

## 8. Penghapusan akun

Superuser dapat menghapus akun guru melalui **Akun Guru → Hapus Akun**. Operasi pengelolaan akun mencakup akun non-owner; VIP tidak boleh diubah diam-diam menjadi teacher dan setiap tindakan padanya harus ditampilkan eksplisit. Akun owner sendiri tidak dapat dihapus atau diturunkan haknya dari menu ini.

Dialog menampilkan nama, email, penugasan, dan dampak; konfirmasi dengan mengetik email serta autentikasi ulang bila sesi administratif tidak cukup baru.

Urutan server:

1. Buat catatan operasi dan blokir akses melalui status server/rules; batalkan sesi refresh yang relevan.
2. Cabut penugasan dan undangan terkait serta lepaskan slot dengan pemeriksaan pemilik/revision.
3. Hapus identitas Firebase Auth dan profil aktif SIMNI.
4. Simpan tombstone/riwayat minimum untuk penelusuran dan status selesai, tanpa menghapus data akademik kelas.

Firebase Auth dan RTDB tidak dianggap satu transaksi. Gunakan proses berfase yang aman diulang; bila salah satu tahap gagal, tampilkan “Penghapusan belum selesai” dan sediakan lanjutkan. Jangan menampilkan sukses sebelum seluruh tahap wajib terverifikasi. Slot pengganti hanya dapat digunakan setelah pencabutan akses server lama terjamin.

Penghapusan akun tidak menghapus siswa, presensi, nilai, jurnal, LPS/BLP, atau arsip kelas. Referensi penulis lama dapat ditampilkan sebagai akun yang sudah dihapus dengan identitas minimum. Tidak menjanjikan penghapusan jarak jauh seketika atas salinan offline pada perangkat yang terputus.

## 9. Kontrak data dan otoritas server

Pertahankan struktur yang layak dari ZIP agar revisi tidak melebar. Nama penambahan berikut adalah **rancangan**, harus dipetakan ke kontrak aktual sebelum ditulis:

| Cabang/entitas | Fungsi |
|---|---|
| `users/{uid}` | Identitas tampilan, role, status, serta referensi penugasan yang disahkan server |
| `assignments/{yearId}/{uid}` | Workspace, kelas, status, izin dan revision penugasan tahun tertentu |
| `registrationSlots` | Registry kelas; kepemilikan/reservasi harus diikat tahun, bukan satu slot global ambigu saat menyiapkan draf |
| `registrationRequests/{requestId}` (usulan) | Permohonan, UID, undangan, kelas diminta, status dan keputusan owner |
| `assignmentDrafts/{yearId}` (usulan) | Draf penempatan belum aktif |
| `accountOperations/{operationId}` (usulan) | Fase/retry operasi lintas Auth dan RTDB |
| `accountAudit/{operationId}` | Catatan keputusan server |
| `system/registration` | Kebijakan buka/tutup pendaftaran |
| `system/academicYear` | Tahun aktif dan koordinasi pergantian |
| `workspaces/{workspaceId}` | Data kelas mengikuti kontrak tahun yang sudah ada |

Server harus memeriksa Firebase ID token, identitas owner/profil aktif untuk operasi admin, dan otoritas terbaru untuk setiap tindakan penting. Jangan hanya mengandalkan email yang dikirim klien atau custom claim lama. Rules mengikuti pemeriksaan slot/assignment/izin yang sama. Service account melewati rules, sehingga Worker wajib memeriksa semua syarat sendiri.

Sebelum coding, tetapkan satu sumber kebenaran penugasan dan strategi koordinasi atomik yang mencakup semua penulis: approval, pergantian, status, penghapusan dan aktivasi tahun. Jangan menggunakan lock yang hanya dipatuhi satu endpoint. Tambahkan batas ukuran request, validasi input, pembatasan percobaan undangan dan log tanpa secret.

## 10. Tahun ajaran, arsip dan akses offline

Penempatan tahun baru adalah keputusan terpisah dari penghapusan data lama. Kelas kosong diperbolehkan dan terlihat jelas. Akun nonaktif, belum ditugaskan dan profil yang tahunnya berbeda harus memiliki penanganan eksplisit; ketidakkonsistenan tidak boleh dilewati diam-diam.

Jika operasi rollover yang ada menghapus data lama, server harus membuktikan arsip tersedia, integritas benar dan sesuai revision data terakhir. Flag `verified=true` dari klien tidak cukup. Koordinasikan perubahan data, approval, pergantian guru dan cutover tahun melalui mekanisme yang sama.

Akses teacher ke tahun lama ditutup secara bawaan setelah penugasannya berakhir; owner dapat memberikan akses baca terbatas bila diperlukan. Jangan memberi akses semua arsip hanya karena pernah mengajar satu kelas.

Offline teacher memerlukan otoritas tersimpan dengan batas waktu yang terdokumentasi, terikat UID/workspace/tahun/revision. Durasi ditetapkan sebelum pengujian penerimaan berdasarkan kebutuhan sekolah. Saat tersambung, periksa penugasan sebelum mengirim antrean. Jika akses dicabut, hentikan sinkronisasi dan tandai draf lama agar dapat ditangani tanpa menulis ke kelas baru. Logout/pergantian akun membersihkan atau mengisolasi cache pribadi. Tidak ada janji pencabutan instan pada perangkat yang sepenuhnya offline.

## 11. Migrasi owner yang menjaga data

Pola: **salin → verifikasi → alihkan → pertahankan legacy sementara**.

1. Setelah Antigravity selesai, rekam baseline source/build, rules, Worker, dan backup data yang dapat diverifikasi; jangan mencantumkan secret dalam laporan.
2. Kerjakan dan latih migrasi pada data terisolasi. Dry-run menghasilkan rencana perubahan dan hash; apply harus terikat pada rencana/baseline yang sama atau berhenti saat berubah.
3. Aktifkan maintenance penulisan yang ditegakkan server/rules; lindungi dari PWA lama dan antrean offline.
4. Periksa target `ws_kelas3a`. Bila sudah berisi data yang berbeda, hentikan untuk penyelesaian konflik; jangan overwrite otomatis.
5. Salin data owner dan metadata terkait, pertahankan registry/undangan existing yang sah, lalu verifikasi isi/jumlah/hash sesuai bentuk data.
6. Tangani scope arsip/backup, audit dan receipt, operasi pending, prefix Cloudinary, serta cache/draf legacy. Gunakan alias owner terbatas bila lebih aman; jangan mengubah isi arsip bertanda hash tanpa menjaga integritasnya.
7. Alihkan profil dan penugasan owner ke `ws_kelas3a` setelah hasil salinan diverifikasi.
8. Cabang `ws_superuser` tidak aktif dan tertutup dari penulisan klien, dipertahankan sementara untuk pemulihan terkontrol. Penghapusan menjadi pekerjaan terpisah setelah masa pemantauan.
9. Verifikasi ulang kondisi pascamigrasi. Rerun harus tidak merusak data atau mengosongkan slot.

Pemulihan setelah ada write baru tidak boleh sekadar mengembalikan backup lama. Siapkan rekonsiliasi atau perbaikan maju. Jangan membuka kembali aturan akses yang tidak aman demi rollback.

## 12. Rencana pengerjaan berurutan

| Tahap | Hasil wajib sebelum lanjut | Temuan audit |
|---|---|---|
| 0. Baseline dan kontrak | Konfirmasi Antigravity selesai, baseline terisolasi, pemetaan izin/status/slot final | F12 |
| 1. Server akun dan penugasan | Owner terlindungi, pending approval, kepemilikan unik, revision, nonaktif/ganti/hapus dengan recovery | F01, F02, F03, F09 |
| 2. UI dan pendaftaran | Halaman owner, undangan sekali pakai/buat ulang, resume registrasi, verifikasi email, status jelas | F04, F11 |
| 3. Migrasi dan tahun ajaran | Migrasi aman diulang, legacy kompatibel, draf penempatan, arsip tervalidasi, koordinasi cutover | F05–F08 |
| 4. Integrasi dan penerimaan | Rules/Worker/UI konsisten, offline dan sync aman, hotfix baseline terjaga, paket rilis tervalidasi | F10–F12 dan regresi tahap sebelumnya |

Setiap tahap diselesaikan dan diperiksa sebelum tahap berikutnya. Gunakan modul ZIP yang ada sejauh layak; tidak membangun framework izin umum atau merombak fitur akademik tanpa kebutuhan konkret. Estimasi waktu dan jumlah file ditetapkan setelah baseline final diketahui, bukan dijanjikan dari paket delta saja.

## 13. Checklist pengujian penerimaan yang direncanakan

Pengujian berikut **belum dilakukan oleh dokumen ini**. Gunakan mock/emulator/staging terisolasi sebelum pilot produksi.

- [ ] Owner tetap superuser di `ws_kelas3a`; kelas 3A tidak dapat diambil teacher.
- [ ] VIP tetap dapat memakai jalur login existing; tidak dapat membuka File/Dokumen.
- [ ] Teacher pending tidak dapat membaca/menulis akademik, termasuk lewat request langsung.
- [ ] Approval memberikan tepat satu penugasan dan izin yang dipilih owner.
- [ ] Dua approval bersamaan tidak menghasilkan dua pemilik slot atau dua kelas aktif untuk satu UID.
- [ ] Undangan owner/VIP ditolak; existing account tidak tertimpa.
- [ ] Kode dicabut/buat ulang/kedaluwarsa ditolak; klik ulang tidak membuat permohonan ganda.
- [ ] Refresh, email gagal dikirim dan koneksi putus dapat dipulihkan tanpa mengganti email.
- [ ] Nonaktif, ganti guru dan pengaktifan ulang tidak mengembalikan hak guru yang sudah digantikan.
- [ ] Penghapusan akun selesai lintas Auth/RTDB; kegagalan di tengah dapat dilanjutkan; data kelas tetap utuh.
- [ ] Setiap izin lihat/kelola diuji melalui UI dan akses langsung; tidak ada lintas workspace.
- [ ] Guru pindah kelas tidak membawa antrean perubahan kelas lama ke kelas baru.
- [ ] Draf tahun tidak mengubah akses tahun aktif; aktivasi mendeteksi konflik dan profil tidak konsisten.
- [ ] Bukti arsip palsu/hilang/kedaluwarsa terhadap data terbaru menggagalkan operasi penghapusan tahun lama.
- [ ] Migrasi dua kali, target konflik dan data berubah sejak dry-run ditangani tanpa overwrite diam-diam.
- [ ] Backup owner lama, receipt, aset Cloudinary legacy dan draf/cache memiliki jalur yang benar.
- [ ] Presensi manual/tanggal lampau, scanner dan tombol X, nilai/TP/Bab, jurnal, GADM serta LPS/BLP tidak mengalami regresi.
- [ ] Halaman owner responsif, tombol tidak terkirim ganda, modal memiliki fokus/close/cleanup, feedback sukses baru muncul setelah status server pasti.
- [ ] Build source/public/salinan Android konsisten; versi dashboard, manifest, runtime dan service worker sesuai authority build.
- [ ] Tidak ada pengujian atau perubahan Chat dalam cakupan ini.

## 14. Urutan rilis setelah kandidat disetujui

1. Pastikan semua temuan penghambat tertutup dengan bukti dan kandidat dibangun dari baseline final.
2. Simpan backup serta identitas versi layanan; siapkan langkah gagal/pemulihan yang telah dilatih.
3. Terapkan fase maintenance dan layanan/rules transisi yang kompatibel sebelum migrasi. Tetapkan urutan teknis persis dari kontrak kandidat, bukan menyalin petunjuk ZIP mentah.
4. Jalankan dry-run terikat baseline, tinjau, lalu apply sesuai otorisasi deployment; lakukan read-back verification.
5. Aktifkan rules/Worker/Hosting final secara terkoordinasi dengan PWA lama tetap dibatasi sampai cutover selesai.
6. Verifikasi owner dan VIP, kemudian pilot satu teacher melalui undangan → verifikasi → persetujuan → penugasan.
7. Buka pendaftaran secara terkendali setelah pilot lulus. Pantau kegagalan approval, sync, akses dan operasi akun.

**Kriteria selesai:** alur kendali superuser bekerja menyeluruh; data owner terjaga; isolasi kelas terbukti; pendaftaran/penghapusan dapat pulih; tidak ada temuan tinggi terbuka; dan laporan penutupan menyebut hasil nyata beserta batas pengujiannya.

Dokumen ini memberi rencana implementasi, bukan klaim siap deploy. Revisi kode, migrasi, pengujian, dan deployment tetap merupakan tahap pekerjaan berikutnya.


## 15. Referensi kode dan ide — dapat dibaca tanpa arsip sumber

Petunjuk untuk pelaksana rekonstruksi: baca kode lama sebagai bukti perilaku, bukan sebagai kode final yang harus disalin. Setiap cuplikan berlabel **KODE AKTUAL** adalah kutipan dari bahan yang diaudit. Bagian **TARGET FINAL** adalah keputusan rekonstruksi yang belum diimplementasikan. Cuplikan dapat bergantung pada helper/modul yang tidak ditampilkan; ini spesifikasi implementasi, bukan snapshot seluruh source atau jaminan bisa langsung dieksekusi.

Peta perubahan utama:

```text
ALUR LAMA:
undangan → verifikasi email → activateRegistration → profile active + assignment active

ALUR FINAL:
undangan → verifikasi email → submitRegistrationRequest → pending_approval
                                                       ↓
                                      keputusan superuser di Kelola Akun
                                                       ↓
                               approveAndAssign → assignment active → akses kelas
```

### 15.1 Registry kelas dan owner

**KODE AKTUAL** — komponen `js/auth/workspace-registry-core.js`:

```javascript
    const OWNER_EMAIL = 'unggaran.sditbm@gmail.com';
    const VIP_EMAIL = 'anur.auliya01@gmail.com';
    const OWNER_CLASS_ID = '3A';
    const OWNER_WORKSPACE_ID = 'ws_kelas3a';
    const VIP_WORKSPACE_ID = 'ws_pjok';
    const VIP_CLASS_ID = 'PJOK';

    const CLASS_IDS = Object.freeze([
        '1A', '1B', '2A', '2B', '3A', '3B',
        '4A', '4B', '5A', '5B', '6A', '6B'
    ]);

    function workspaceIdForClass(classId) {
        const normalized = String(classId || '').trim().toUpperCase();
        if (!CLASS_IDS.includes(normalized)) return null;
        return `ws_kelas${normalized.toLowerCase()}`;
    }

    const SLOTS = Object.freeze(CLASS_IDS.map((classId) => Object.freeze({
        slotId: `kelas-${classId.toLowerCase()}`,
        classId,
        workspaceId: workspaceIdForClass(classId),
        systemOwned: classId === OWNER_CLASS_ID,
        registrationAllowed: classId !== OWNER_CLASS_ID
    })));
```

```javascript
    function validateTeacherScope(classId, workspaceId) {
        const slot = slotForClass(classId);
        return Boolean(slot && !slot.systemOwned && slot.workspaceId === String(workspaceId || '').trim());
    }
```

**IDE YANG DIPERTAHANKAN:** hanya ada tiga role; kelas dipetakan ke workspace melalui registry. Owner 3A dan VIP PJOK adalah identitas yang ditangani khusus. `systemOwned` mencegah kelas 3A ditawarkan kepada teacher.

**TARGET FINAL:** pertahankan pemetaan ini dan validasi ulang di server. Kepemilikan teacher tidak disimpan sebagai role seperti `guru2a`; simpan `role: teacher` ditambah assignment kelas/tahun. Registry kelas bersifat tetap, sedangkan pemilik kelas berubah per tahun. Identitas owner harus berasal dari token terverifikasi dan profil server, bukan objek yang dikirim browser.

### 15.2 Titik aktivasi langsung yang wajib diganti

**KODE AKTUAL** — komponen `edge/registration-operations.js`:

```javascript
  const year = String(await io.readServer('system/academicYear/activeYearId') || '').trim();
  if (!/^\d{4}-\d{4}$/.test(year)) throw error('Tahun pelajaran aktif server belum siap.', 409);
  const now = Date.now();
  const revision = 1;
  const profile = {
    uid: claims.sub,
    email: cleanEmail(claims.email),
    displayName: operation.displayName,
    role: 'teacher',
    workspaceId: slot.workspaceId,
    classId: slot.classId,
    activeAcademicYearId: year,
    status: 'active',
    assignmentRevision: revision,
    createdAt: operation.createdAt || now,
    updatedAt: now
  };
  const assignment = {
    uid: claims.sub,
    role:'teacher', workspaceId:slot.workspaceId, classId:slot.classId, academicYearId:year,
    revision, status:'active', assignedAt:now, assignedBy:OWNER_EMAIL
  };
```

```javascript
  await io.patchServer({
    [`users/${claims.sub}`]: profile,
    [`assignments/${year}/${claims.sub}`]: assignment,
    [`workspaces/${slot.workspaceId}/meta`]: { workspaceId:slot.workspaceId, classId:slot.classId, kind:'class', schemaVersion:3, status:'active', updatedAt:now },
    [`workspaces/${slot.workspaceId}/settings/identity`]: identity,
    [`workspaces/${slot.workspaceId}/academicYears/${year}/meta`]: { schemaVersion:3, academicYearId:year, status:'active', initializedAt:now, initializedBy:claims.sub },
    [`registrationSlots/${operation.slotId}`]: occupiedSlot,
    [`registrationOperations/${claims.sub}/${operation.operationId}`]: completed
  });
```

**PERILAKU SAAT INI:** setelah undangan selesai, `finalizeReserved` langsung membuat profil dan penugasan aktif. `assignedBy: OWNER_EMAIL` tidak membuktikan owner benar-benar menyetujui; itu hanya konstanta yang ditulis program. `revision = 1` mengabaikan riwayat penugasan.

**TARGET FINAL:** finalisasi registrasi hanya menghasilkan akun `pending_approval` dan permohonan. Tidak menulis assignment aktif, tidak mengisi slot sebagai pemilik aktif, dan tidak memberi akses workspace. Penulisan assignment dipindahkan ke operasi `approveAndAssign` yang hanya menerima owner terverifikasi. `approvedBy`/`assignedBy` berisi UID pelaku keputusan nyata. Kelas yang diminta dipisahkan dari kelas yang disetujui. Revision dihitung dari otoritas sebelumnya secara konsisten, tidak direset menjadi 1.

### 15.3 Reservasi undangan dan retry

**KODE AKTUAL** — komponen `edge/registration-operations.js`:

```javascript
  const existing = await io.readServer(opPath);
  if (existing) {
    if (existing.email !== cleanEmail(claims.email)) throw error('Operasi aktivasi tidak cocok dengan akun.', 403);
    if (existing.phase === 'completed') return { ok:true, profile:existing.profile, replayed:true };
    const profile = await finalizeReserved(io, claims, existing);
    return { ok:true, profile, replayed:true };
  }
  const valid = await validateInvite(io, { ...body, email:claims.email });
  const now = Date.now();
  const operation = {
    operationId, uid:claims.sub, email:cleanEmail(claims.email), displayName,
    slotId:valid.slotId, classId:valid.classId, workspaceId:valid.workspaceId,
    phase:'reserving', createdAt:now, expiresAt:now + 15*60*1000
  };
  await io.patchServer({ [opPath]: operation });
  const reserved = await io.reserveSlot(valid.slotId, (slot) => {
    if (!slot || slot.status !== 'available') return null;
    return { ...slot, status:'reserved', reservation:{ uid:claims.sub, operationId, expiresAt:operation.expiresAt, phase:'finalizing' }, updatedAt:now };
  });
```

**PERILAKU SAAT INI:** validasi undangan dilakukan sebelum penguncian slot; callback reservasi hanya memeriksa `available`. Retry operasi yang belum selesai langsung mencoba finalisasi walaupun reservasi mungkin belum pernah berhasil.

**TARGET FINAL:** dalam pengambilan keputusan yang dilindungi dari perubahan bersamaan, periksa versi/hash undangan, email, kedaluwarsa, pencabutan, UID pemohon, slot dan konteks tahun terbaru. Rekam fase operasi yang dapat dilanjutkan: validasi → permohonan tercatat → pending. Jangan mempertahankan kunci teknis selama menunggu persetujuan manusia berhari-hari; simpan klaim pending yang eksplisit dan dapat dibatalkan owner. Retry berdasarkan fase; operasi selesai mengembalikan hasil yang sama. Revoke/regenerate undangan dan submission wajib mengikuti aturan koordinasi yang sama.

### 15.4 Pembuatan dan penggantian kode undangan

**KODE AKTUAL** — komponen `edge/account-operations.js`:

```javascript
export async function createInvite(io, identity, body) {
  requireOwner(identity);
  const slotId=String(body?.slotId||'').trim().toLowerCase(), email=cleanEmail(body?.email);
  const days=Math.min(30,Math.max(1,Number(body?.days||7))); const slot=await io.readServer(`registrationSlots/${slotId}`);
  if(!slot||slot.systemOwned||slot.classId==='3A') throw error('Slot tidak dapat menerima undangan.',409);
  if(slot.status!=='available') throw error('Slot tidak tersedia untuk undangan.',409);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw error('Email guru tidak valid.');
  const token=token32(), now=Date.now();
  const invitation={tokenHash:await sha256(token),email,expiresAt:now+days*86400000,createdAt:now,createdBy:identity.claims.sub};
  await io.patchServer({ [`registrationSlots/${slotId}/invitation`]:invitation,[`accountAudit/${crypto.randomUUID()}`]:{action:'invite',slotId,emailHash:await sha256(email),uid:identity.claims.sub,timestamp:now} });
  return {ok:true,slotId,classId:slot.classId,email,inviteCode:token,expiresAt:invitation.expiresAt};
```

**IDE YANG DIPERTAHANKAN:** kode acak hanya dikembalikan saat dibuat, database menyimpan hash; kode terikat email dan kedaluwarsa. Dasar ini cocok untuk menu Undangan Guru.

**TARGET FINAL:** tambahkan pemeriksaan email owner/VIP, akun yang telah ditugaskan, konteks tahun dan konflik permohonan. Buat ulang menggunakan ID/versi undangan baru serta mencabut versi lama dalam keputusan terkoordinasi. Daftar hanya memuat identitas/status dan kode tersamarkan; kode lengkap tersedia pada dialog hasil pembuatan untuk disalin. Undangan penggantian harus didahului pencabutan penugasan lama yang terjamin, bukan sekadar mengganti token.

### 15.5 Nonaktif, aktifkan, dan ganti guru

**KODE AKTUAL** — komponen `edge/account-operations.js`:

```javascript
export async function setTeacherStatus(io, identity, body) {
  requireOwner(identity); const uid=String(body?.uid||'').trim(), status=String(body?.status||'').trim();
  if(!uid||!['active','disabled'].includes(status)) throw error('Status akun tidak valid.'); const p=await io.readServer(`users/${uid}`);
  if(!p||p.role!=='teacher') throw error('Hanya akun teacher undangan yang dapat diubah.',403);
  const now=Date.now();
  await io.patchServer({ [`users/${uid}/status`]:status,[`users/${uid}/updatedAt`]:now,[`assignments/${p.activeAcademicYearId}/${uid}/status`]:status,[`accountAudit/${crypto.randomUUID()}`]:{action:'teacher-status',targetUid:uid,status,uid:identity.claims.sub,timestamp:now} });
  return {ok:true,uid,status};
}
export async function replaceTeacher(io, identity, body) {
  requireOwner(identity); const uid=String(body?.uid||'').trim(), email=cleanEmail(body?.email); const p=await io.readServer(`users/${uid}`);
  if(!p||p.role!=='teacher') throw error('Akun teacher lama tidak ditemukan.',404); const slotId=`kelas-${String(p.classId).toLowerCase()}`; const slot=await io.readServer(`registrationSlots/${slotId}`);
  if(!slot||slot.assignedUid!==uid) throw error('Assignment slot lama tidak cocok.',409);
  const token=token32(), now=Date.now(), revision=Number(p.assignmentRevision||1)+1;
  const invite={tokenHash:await sha256(token),email,expiresAt:now+7*86400000,createdAt:now,createdBy:identity.claims.sub};
  await io.patchServer({ [`users/${uid}/status`]:'revoked',[`users/${uid}/updatedAt`]:now,[`assignments/${p.activeAcademicYearId}/${uid}/status`]:'revoked',[`registrationSlots/${slotId}`]:{...slot,status:'available',assignedUid:null,reservation:null,invitation:invite,assignmentRevision:revision,updatedAt:now},[`accountAudit/${crypto.randomUUID()}`]:{action:'replace-teacher',oldUid:uid,slotId,emailHash:await sha256(email),uid:identity.claims.sub,timestamp:now} });
  return {ok:true,slotId,classId:p.classId,email,inviteCode:token,assignmentRevision:revision};
```

**PERILAKU SAAT INI:** aktivasi ulang hanya memeriksa role teacher. Akun yang telah digantikan dapat diaktifkan kembali. Penggantian memperbarui slot tetapi belum menjadikan seluruh jalur penugasan mengikuti satu kontrak revisi.

**TARGET FINAL:** `enableAccount` hanya mengaktifkan kembali akun; akses akademik tetap bergantung pada assignment yang belum dicabut, pemilik slot terkini, tahun dan revision. Akun revoked tidak memperoleh assignment lewat toggle. `replaceTeacher` mencabut assignment A dan membebaskan slot secara konsisten, lalu membuka alur undangan B. B tetap pending sampai disetujui. Data workspace tidak disentuh. Jika A dan B bertukar kelas, gunakan satu operasi perubahan penempatan yang memeriksa kedua slot sebelum commit.

### 15.6 Kebijakan akses fitur

**KODE AKTUAL** — komponen `js/auth/access-policy-core.js`:

```javascript
    function isOwnerIdentity(profileOrContext) {
        return Boolean(
            profileOrContext &&
            normalizeRole(profileOrContext.role) === ROLES.SUPERUSER &&
            registry.isOwnerEmail(profileOrContext.email)
        );
    }

    function hasFeature(role, feature) {
        const normalizedRole = normalizeRole(role);
        return Boolean(normalizedRole && feature && (MATRIX[normalizedRole] || []).includes(feature));
    }
```

```javascript
    function featureForLogicalPath(path) {
        const value = String(path || '').replace(/^\/+|\/+$/g, '');
        if (!value) return null;
        if (value === 'Dokumen' || value.startsWith('Dokumen/')) return FEATURES.DOCUMENTS;
        if (value === 'Data_LPS' || value.startsWith('Data_LPS/') || value === 'LPS' || value.startsWith('LPS/') || value === 'Pengaturan/LPS_v2' || value.startsWith('Pengaturan/LPS_v2/')) return FEATURES.LPS;
        if (value === 'Siswa' || value.startsWith('Siswa/')) return FEATURES.STUDENTS;
        if (value === 'Presensi' || value.startsWith('Presensi/')) return FEATURES.ATTENDANCE;
        if (value === 'Mapel_TP' || value.startsWith('Mapel_TP/') || value === 'Nilai_TP' || value.startsWith('Nilai_TP/')) return FEATURES.GRADES;
        if (value === 'Jurnal' || value.startsWith('Jurnal/') || value === 'Jadwal' || value.startsWith('Jadwal/')) return FEATURES.JOURNAL;
        if (value === 'Catatan' || value.startsWith('Catatan/')) return FEATURES.NOTES;
        if (value === 'Pengaturan/Identitas' || value.startsWith('Pengaturan/Identitas/')) return FEATURES.SETTINGS;
        return null;
```

**IDE YANG DIPERTAHANKAN:** pemetaan path logis ke fitur membuat pemeriksaan akses konsisten dengan modul yang sudah ada.

**BATAS KODE LAMA:** `hasFeature(role, feature)` hanya menjawab izin menurut role; belum mengetahui persetujuan, kelas/tahun, izin khusus owner, read/write atau perubahan penugasan.

**TARGET FINAL:** gunakan keputusan `canAccess(context, feature, action, scope)` dengan konteks dari server. Urutan pemeriksaan: akun aktif → assignment sah → pemilik slot/revision cocok → workspace/tahun cocok → fitur diizinkan role → izin tindakan diberikan owner. Pending hanya mengakses status dirinya. Lihat tidak berarti boleh menulis; ekspor tidak menambah cakupan baca. Terapkan padanan pemeriksaan di rules dan Worker. Lengkapi mapping GADM, pengaturan, backup/restore, siswa dan seluruh path aktual; path yang tidak dikenal tidak boleh lolos otomatis. UI memakai keputusan yang sama untuk menampilkan tombol tetapi bukan pengaman utama.

### 15.7 Migrasi yang harus diubah

**KODE AKTUAL** — komponen `scripts/migrate-multirole.mjs`:

```javascript
  // Satu update parent per workspace mencegah konflik ancestor/descendant pada multi-location update RTDB.
  updates[`workspaces/${workspaceId}`] = nextWorkspace;
  const slotId = slotFor(classId);
  const occupiedOwner = classId === '3A';
  updates[`registrationSlots/${slotId}`] = {
    slotId,
    classId,
    workspaceId,
    status: occupiedOwner ? 'occupied' : (existingSlots?.[slotId]?.status || 'available'),
    ...(occupiedOwner ? { assignedUid: ownerUid, systemOwned: true } : {}),
    updatedAt: now
  };
}

if (legacyOwnerWs) updates[`workspaces/${LEGACY_OWNER_WORKSPACE}`] = null;
```

**PERILAKU SAAT INI:** menulis seluruh parent workspace dan membangun ulang slot; metadata nonowner tidak seluruhnya dipertahankan. Cabang legacy langsung dijadwalkan untuk dihapus.

**TARGET FINAL:** jangan memakai pola ini apa adanya. Buat rencana migrasi dari baseline yang terkunci; pertahankan isi/metadata existing, hentikan jika target berkonflik, dan lakukan read-back verification. Alihkan owner hanya setelah salinan lolos pemeriksaan. `ws_superuser` tidak dihapus dalam cutover awal, tetapi ditutup dari write klien. Backup/scope arsip, receipt, Cloudinary prefix dan cache legacy memiliki penanganan khusus owner. Mengganti nama cabang tanpa menangani referensi bukan migrasi selesai.

### 15.8 Pergantian tahun dan bukti arsip

**KODE AKTUAL** — komponen `edge/admin-operations.js`:

```javascript
    for (const [uid, profile] of Object.entries(users)) {
        if (!profile || profile.status !== 'active' || !['superuser', 'vip', 'teacher'].includes(profile.role)) continue;
        if (profile.activeAcademicYearId !== current) continue;
        const assignment = currentAssignments[uid];
        if (!assignment || assignment.status !== 'active') throw error(`Assignment aktif belum tersedia untuk ${profile.classId || uid}.`);
        if (assignment.workspaceId !== profile.workspaceId || assignment.classId !== profile.classId || Number(assignment.revision || 0) !== Number(profile.assignmentRevision || 0)) {
            throw error(`Assignment tidak sinkron untuk ${profile.classId || uid}.`);
        }
        const ready = readiness[uid];
        if (!ready?.verified || ready.workspaceId !== profile.workspaceId || ready.academicYearId !== current || Number(ready.assignmentRevision || 0) !== Number(profile.assignmentRevision || 0) || !/^[a-f0-9]{64}$/.test(ready.archiveHash || '')) {
            throw error(`Workspace ${profile.classId || profile.workspaceId} belum VERIFIED untuk rollover.`);
        }
        active.push({ uid, profile, assignment });
    }
```

```javascript
    const updates = {};
    const now = Date.now();
    for (const { uid, profile, assignment } of active) {
        const workspaceId = profile.workspaceId;
        const revision = Number(profile.assignmentRevision || assignment.revision || 1);

        // Data operasional tahun lama dikosongkan setelah arsip terverifikasi. Settings
        // workspace, termasuk identitas institusi permanen, TIDAK dihapus.
        updates[`workspaces/${workspaceId}/academicYears/${current}`] = null;
```

**PERILAKU SAAT INI:** profil dengan tahun berbeda dilewati. Status `verified` dan bentuk hash diperiksa, lalu tahun lama dijadwalkan dihapus. Kode ini tidak membuktikan arsip tersedia serta mencakup data terakhir.

**TARGET FINAL:** pisahkan `activateYearAssignments` dari operasi penghapusan/pengarsipan lama. Aktivasi penempatan mengubah tahun/assignment melalui draf yang disetujui owner tanpa menghapus data akademik lama. Bila operasi penghapusan lama tetap digunakan, server harus memeriksa arsip dan revision data aktual di bawah koordinasi perubahan data. Tahun profil yang tidak sesuai harus dilaporkan sebagai konflik, bukan diabaikan. Approval, replacement, delete dan cutover wajib menghormati koordinasi yang sama.


## 16. Kontrak implementasi final dan contoh konkret

Bagian ini adalah **rancangan baru**, bukan kutipan kode yang sudah bekerja. Contoh memakai UID/tanggal ilustratif. Nama field baru harus digunakan konsisten di UI, Worker, rules, migrasi dan pengujian. Jika nama lama dipertahankan untuk kompatibilitas, pelaksana wajib membuat pemetaan eksplisit; jangan mengubah perilaku yang ditetapkan di sini.

### 16.1 Contoh guru meminta kelas 2A

Setelah email terverifikasi dan permohonan dikirim, kondisi konseptualnya:

```json
{
  "user": {
    "uid": "uid_guru_a",
    "displayName": "Guru A",
    "email": "guru.a@example.com",
    "role": "teacher",
    "status": "pending_approval"
  },
  "request": {
    "requestId": "request_a",
    "uid": "uid_guru_a",
    "requestedClassId": "2A",
    "requestedAcademicYearId": "2026-2027",
    "invitationId": "invite_a_v1",
    "status": "pending"
  },
  "activeAssignment": null
}
```

Tidak ada workspace aktif dalam profil pending. Kelas yang diminta bukan otoritas. Guru tidak boleh membaca isi `workspaces/ws_kelas2a` melalui UI maupun database langsung.

Setelah owner menyetujui kelas 2A dengan presensi kelola dan nilai lihat:

```json
{
  "user": {
    "uid": "uid_guru_a",
    "role": "teacher",
    "status": "active",
    "workspaceId": "ws_kelas2a",
    "classId": "2A",
    "activeAcademicYearId": "2026-2027",
    "assignmentRevision": 7
  },
  "assignment": {
    "uid": "uid_guru_a",
    "role": "teacher",
    "workspaceId": "ws_kelas2a",
    "classId": "2A",
    "academicYearId": "2026-2027",
    "status": "active",
    "revision": 7,
    "permissions": {
      "attendance": "manage",
      "grades": "read"
    },
    "assignedBy": "uid_owner"
  },
  "slotOwnership": {
    "slotId": "kelas-2a",
    "academicYearId": "2026-2027",
    "assignedUid": "uid_guru_a",
    "assignmentRevision": 7,
    "status": "occupied"
  },
  "requestDecision": {
    "status": "approved",
    "approvedBy": "uid_owner",
    "approvedClassId": "2A"
  }
}
```

Angka 7 hanya contoh hasil revision terkini, bukan angka baku. Izin tidak tercantum berarti ditolak; produksi menyimpan preset lengkap agar ringkasan mudah diperiksa. Pisahkan katalog slot tetap dari kepemilikan slot per tahun, misalnya katalog `registrationSlots/{slotId}` dan kepemilikan `classAssignments/{yearId}/{slotId}`. Ini rancangan path tambahan; semua pembaca slot legacy wajib dipetakan sebelum cutover. `assignments/{yearId}/{uid}` dan pemilik kelas harus diperbarui dalam satu keputusan konsisten, bukan dua PATCH bebas yang bisa berselisih.

### 16.2 Operasi server yang harus tersedia

Nama operasi berikut adalah kontrak logis; route HTTP mengikuti gaya gateway yang sudah ada. Semua mutasi menerima ID operasi untuk retry dan revision yang diharapkan bila mengubah data existing. Status sukses berarti commit wajib terverifikasi, bukan sekadar request diterima.

| Operasi | Pelaku | Input inti | Hasil/larangan utama |
|---|---|---|---|
| `createInvite` | Owner | Email, kelas/tahun, masa berlaku | Kode sekali tampil; canonical account dan konflik ditolak |
| `regenerateInvite` | Owner | ID undangan, revision | Cabut kode lama dan terbitkan versi baru; tidak mencabut akun aktif |
| `revokeInvite` | Owner | ID undangan, revision | Kode berhenti berlaku; status permohonan terkait ditangani eksplisit |
| `submitRegistrationRequest` | Calon guru terverifikasi | Kode, nama, operationId | Pending; tidak membuat assignment aktif |
| `getMyRegistrationStatus` | Akun sendiri | Identitas token | Status milik sendiri; tidak membocorkan daftar guru/data kelas |
| `approveAndAssign` | Owner | Request, kelas/tahun final, izin, expectedRevision | Periksa slot dan UID; catat approval lalu aktifkan assignment secara konsisten |
| `rejectRequest` | Owner | Request, alasan opsional | Tidak memberikan akses; tidak otomatis menghapus Auth |
| `setPermissions` | Owner | UID, izin, revision | Naikkan revision otoritas dan perbarui catatan terkait |
| `disableAccount` / `enableAccount` | Owner | UID, revision | Aktifkan akun tidak boleh memulihkan assignment revoked |
| `revokeAssignment` | Owner | UID, tahun, revision | Lepaskan akses kelas; pertahankan data akademik |
| `replaceTeacher` | Owner | Guru lama, email pengganti, revision | Cabut akses lama; pengganti tetap melalui approval |
| `applyAssignmentChanges` | Owner | Daftar asal/tujuan, revision | Tangani pindah/tukar kelas tanpa kepemilikan ganda |
| `deleteAccount` | Owner | UID, konfirmasi identitas, operationId | Berfase lintas Auth/RTDB, dapat dilanjutkan; owner terlindungi |
| `saveYearAssignmentDraft` | Owner | Tahun tujuan, susunan guru | Tidak mengubah penugasan aktif |
| `activateYearAssignments` | Owner | ID/version draf, operationId | Validasi seluruh susunan dan cutover; tidak menghapus data tahun lama |
| `getAccountOperationStatus` | Owner | operationId | Tampilkan pending/completed/failed yang dapat ditindaklanjuti |

Jangan menganggap mencantumkan `expectedRevision` sudah menyelesaikan konkurensi. Server harus membandingkan dan mengunci/mengommit melalui mekanisme nyata yang dipatuhi semua operasi. Tetapkan strategi transaksi/ETag/koordinasi berdasarkan struktur RTDB final, tanpa membaca atau mengunci seluruh data akademik besar untuk perubahan satu akun.

### 16.3 Algoritma persetujuan — pseudocode, bukan kode siap deploy

```text
approveAndAssign(ownerToken, requestId, targetClass, year, permissions, operationId):
    verifikasi token dan profil owner aktif dari server
    bila operationId telah selesai: kembalikan hasil sebelumnya
    baca otoritas tahun dan status maintenance terkini
    mulai keputusan penugasan yang terkoordinasi
        baca ulang request, user, slot tahun, assignment dan revision
        tolak request yang bukan pending atau email belum terverifikasi
        tolak owner/VIP sebagai target teacher; tolak kelas 3A
        tolak akun nonaktif/sedang dihapus dan konflik pemilik slot
        tolak UID dengan assignment aktif lain kecuali operasi pindah eksplisit
        periksa izin terhadap batas maksimum role
        tetapkan revision baru yang konsisten
        rekam keputusan owner + assignment + pemilik slot + profil aktif
        rekam hasil operasi dan audit
    pastikan commit selesai atau laporkan status yang dapat dilanjutkan
    kembalikan assignment yang disahkan server
```

Pemeriksaan UI boleh mengantisipasi konflik, tetapi server tetap memeriksa ulang. Token Firebase yang valid tanpa assignment sah tidak memberikan akses akademik.

### 16.4 Alur penghapusan yang bisa dipulihkan

```text
requested
  → access_blocked
  → assignment_revoked
  → auth_deleted
  → active_profile_removed
  → completed
```

Jika terputus setelah `auth_deleted`, retry melanjutkan pembersihan profil dan tidak menganggap “Auth tidak ditemukan” sebagai kegagalan permanen. Tombstone/riwayat operasi tetap membuktikan pencabutan. Jika Auth gagal dihapus, status akses server tetap terblokir dan UI menawarkan Lanjutkan. Akun dengan UID owner selalu ditolak sebagai target. Jangan menyimpan status operasi hanya di browser.

### 16.5 Skenario acuan yang harus dipahami pelaksana

1. **Guru A meminta 2A:** email terverifikasi → pending → tidak ada akses data → owner menyetujui → baru akses 2A.
2. **Owner memilih kelas lain:** permohonan 2A dapat disetujui ke 2B yang kosong; simpan permohonan asli dan keputusan final agar riwayat jelas.
3. **Guru A pindah sekolah:** owner menonaktifkan/mencabut atau menghapus A → data 2A tetap → undangan B → B pending → owner menyetujui B. A tidak dapat kembali lewat toggle lama.
4. **Kode hilang:** owner buat ulang → kode lama ditolak → tidak mempengaruhi akun aktif. Permohonan pending existing tidak digandakan.
5. **Tahun baru, A pindah 2A ke 4B:** draf tidak mempengaruhi tahun berjalan → owner aktivasi → A mengakses 4B tahun baru → data 2A tahun lalu tetap tersimpan.
6. **PWA A sedang offline saat akses dicabut:** tidak dijanjikan penghapusan lokal instan → ketika terhubung, server menolak write otoritas lama → draf tidak dialihkan ke kelas lain.
7. **Owner bermigrasi:** data lama disalin dan diverifikasi ke 3A → referensi legacy ditangani → profil dialihkan → hak superuser tetap sama → cabang lama tidak langsung dihapus.

### 16.6 Instruksi serah-terima untuk Antigravity/pelaksana

Gunakan dokumen ini sebagai spesifikasi perilaku final. Bahan kode bagian 15 menjelaskan titik yang dipertahankan dan diganti; tidak perlu membuka ZIP untuk memahami alasan atau kontraknya. Source baseline final tetap diperlukan untuk mengimplementasikan dan menguji integrasi, karena dokumen rencana bukan snapshot proyek lengkap.

Mulai dengan inventaris selisih terhadap baseline, kemudian kerjakan tahap 0–4. Jangan menyalin `finalizeReserved` yang langsung mengaktifkan teacher, jangan menghapus legacy pada cutover awal, dan jangan menggabungkan perubahan penempatan dengan penghapusan tahun lama. Laporkan perubahan file, hasil pemeriksaan tiap tahap, dan temuan yang belum tertutup. Tidak ada izin deploy otomatis dari dokumen ini.
