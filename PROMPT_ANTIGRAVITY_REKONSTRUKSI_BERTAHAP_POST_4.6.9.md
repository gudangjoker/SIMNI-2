# Prompt Antigravity — rekonstruksi bertahap SIMNI setelah 4.6.9

**DOKUMEN RENCANA, BUKAN PROMPT EKSEKUSI GABUNGAN.** Sesuai permintaan terbaru pengguna, gunakan berkas terpisah dalam `prompts-antigravity/`, mulai dari `00_BASELINE_DAN_RENCANA.md`. Setiap tahap berhenti untuk dibaca pengguna; tidak lanjut otomatis. Lihat `prompts-antigravity/README.md`.

Pilihan model diperbarui menjadi **Gemini 3.8 Flash**, dengan tingkat penalaran tinggi jika tersedia. Ini rekomendasi untuk tugas SIMNI berdasarkan sumber resmi terbaru, bukan hasil perbandingan langsung kedua model pada repository ini: https://www.antigravity.google/blog/gemini-3-8-flash-in-google-antigravity

---

Anda bertugas memperbaiki temuan audit SIMNI dan menyederhanakan jalur kerjanya secara bertahap. Kerjakan dari:

`C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`

Build 4.6.9 dilaporkan pengguna sudah deploy. Tugas ini adalah rekonstruksi source dan pengujian **lokal terisolasi**, bukan deployment. Saat prompt ini diberikan sebagai perintah kerja, revisi lokal, pembuatan fixture serta pengujian mock/emulator yang dijelaskan di bawah diizinkan. Larangan pengujian pada sesi audit forensik terdahulu berlaku pada sesi audit itu; jangan menafsirkan hasil audit statis sebagai bukti tes sudah lulus.

Jangan menyentuh data produksi, mengirim pesan/push kepada pengguna, deploy Hosting/Worker/rules/index, memicu cleanup cloud, reset tahun, mengubah akun/role/billing, atau menerbitkan APK. Instruksi deploy lama tidak menjadi izin deploy untuk tugas baru ini.

## Tujuan dan keputusan desain

Tutup temuan **S01–S09** dalam `FORENSIC_SCORECARD_4.6.9_2026-09-12.md` dan tangani kesenjangan bukti **G01** sebatas yang dapat dilakukan lokal. Pertahankan perilaku fitur yang sudah benar. Kurangi koordinasi dan lapisan yang tidak diperlukan; jangan menulis ulang seluruh aplikasi.

Arsitektur sasaran: **halaman fitur → aksi fitur → layanan data yang tipis**. Tanggung jawab bersama cukup jelas untuk sesi/akses, draf, notifikasi/loading dan berkas. Jangan menambah event bus, dependency injection framework, sistem plugin, general workflow engine atau abstraksi baru hanya demi kerapian diagram. Jangan menggabungkan semua kode menjadi satu file. Satu aksi harus mempunyai satu pemilik; logika umum hanya diekstrak bila memang ada pemakai dan kontraknya jelas.

Kebijakan offline formulir akademik:

1. Data yang sudah tersedia dapat dibaca offline.
2. Perubahan formulir disimpan otomatis sebagai **draf lokal persisten**, baik online maupun offline.
3. Tampilkan “Draf tersimpan di perangkat — belum terkirim” hanya setelah penyimpanan lokal benar-benar selesai.
4. Ketika koneksi pulih, beri tahu bahwa guru dapat mengirim melalui tombol **Simpan**. Jangan otomatis mengirim draf ke server.
5. Saat Simpan, periksa sesi, scope dan konflik terhadap data terbaru. Tampilkan “Tersimpan di database” hanya setelah konfirmasi server.
6. Hapus hanya revisi draf yang berhasil dikirim. Ketikan baru selama request berjalan tidak boleh ikut terhapus.

Ekspor dapat tetap offline dari data tersimpan. GADM dan Chat tetap memiliki lifecycle sesuai kebutuhan masing-masing; jangan memasukkan pesan Chat ke mekanisme draf/commit formulir akademik.

## Aturan kerja untuk mencegah regresi lintas tahap

- Urutan tahap bersifat wajib. Jangan mengerjakan tahap berikutnya sambil meninggalkan kegagalan dari tahap sebelumnya.
- Jalankan satu perubahan perilaku yang koheren per checkpoint. Tidak ada edit paralel pada kontrak/state/handler bersama.
- Sebelum revisi, telusuri semua pemanggil, penulis, pembaca, format data, aturan akses, ekspor/impor dan lifecycle terkait. Catat dampak yang diperkirakan.
- Setelah revisi: **audit statis ulang terlebih dahulu → tes perubahan → tes pemakai langsung → pemeriksaan regresi tahap sebelumnya yang terdampak → checkpoint**.
- Jangan menunda pengujian seluruh pekerjaan sampai akhir. Tes integrasi final melengkapi gerbang per tahap, bukan menggantikannya.
- Pertahankan kompatibilitas data lama. Jangan mengganti key siswa/TP/nilai, scope workspace/tahun, snapshot final, atau format backup tanpa strategi kompatibilitas yang eksplisit.
- Jangan mengurangi fitur demi skor atau memperbaiki kegagalan dengan melonggarkan validasi, melewati hash, menonaktifkan assertion, menggunakan data parsial sebagai lengkap, maupun menaikkan batas tanpa rancangan kapasitas.
- Jangan melakukan format ulang massal, upgrade dependency/framework, atau mengubah semua nama file sekaligus.
- Jangan reset/clean working tree. Banyak perubahan dan file untracked sudah ada sebelum tugas ini. Simpan checkpoint berbasis salinan/hash atau Git selektif bila tersedia; jangan menganggap HEAD adalah baseline yang benar.
- Source diedit di root; `public` dihasilkan oleh build. Jangan memperbaiki public secara manual. Berkas mock, database uji, hasil ekspor dan laporan QA harus tetap di luar hosting.
- Jalankan pengujian dengan pemblokiran koneksi keluar. Gunakan project emulator demo dan binding tiruan. Nama file “mock” saja tidak cukup membuktikan isolasi.
- GADM, LPS, BLP dan Chat **termasuk** pemeriksaan dampak/regresi; jangan mengecualikannya berdasarkan instruksi lama.
- Jangan jalankan ulang skrip rekonstruksi satu kali seperti `qa/revise-lps-templates.mjs` atau `qa/reconstruct-uiux*.mjs`. Itu bukan test runner.
- Berhenti setelah tahap aktif selesai; mulai tahap berikutnya hanya setelah pengguna mengirim prompt tahap tersebut. Jika menemukan kebutuhan perubahan produk di luar scope, akses eksternal yang wajib, atau blocker yang tidak dapat diselesaikan lokal, jelaskan masalah konkret dan jangan menyatakan tahap selesai.

## Tahap 0 — baseline, peta dampak dan kontrak

Baca laporan scorecard 12 September, laporan rekonstruksi 4.6.7, UI/UX 4.6.8, template 4.6.9, `Reconstruction_status.md`, konfigurasi build/runtime/Firebase/Worker dan bukti QA yang relevan. Periksa source terkini; laporan adalah titik awal, bukan pengganti membaca kode.

1. Rekam versi, manifest, hash dan status working tree. ID historis 4.6.9 adalah `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`; jika keadaan sekarang berbeda, jelaskan penyebabnya, jangan memaksa kembali ke file lama.
2. Buat matriks `temuan → aksi terdampak → file pemilik → pemakai kontrak → tes → risiko → checkpoint`.
3. Tetapkan invariant: data tidak hilang/tercampur scope, input valid tetap valid, satu aksi satu commit, snapshot final terlindungi, backup benar-benar dapat dipulihkan, data parsial tidak dihitung sebagai data lengkap.
4. Tetapkan kontrak draf, batas/format backup, model pembacaan data dan status kelengkapan sebelum mengimplementasikan perubahan yang bergantung padanya. Gunakan struktur yang sudah ada bila cukup.
5. Baca test runner sebelum menjalankannya. Rekam baseline pengujian lokal terisolasi; bedakan bug yang sudah ada, harness usang dan kegagalan lingkungan.
6. Buat `REKONSTRUKSI_BERTAHAP_STATUS.md`: tahap aktif, status tiap S01–S09/G01, hash checkpoint, hasil gerbang, masalah terbuka dan aksi berikutnya. Simpan bukti terperinci di direktori QA, bukan memenuhi root dengan laporan berulang.

Gerbang: scope dan kontrak jelas, baseline dapat dipulihkan, isolasi pengujian terbukti. Jangan mulai revisi sambil belum mengetahui pemakai fungsi bersama.

## Tahap 1 — backup, impor, arsip dan readiness reset (S01)

Fokus hanya pada rantai pemulihan. Jangan mengubah strategi query database pada tahap ini.

- Selaraskan batas ekspor/impor/verifikasi arsip berdasarkan byte file sebenarnya, termasuk JSON berindentasi, metadata dan Unicode. Saat ini impor 25 MiB tidak sejalan dengan arsip cloud hingga 32 MiB dan ekspor tanpa batas pasangan.
- Pilih solusi paling sederhana yang menjamin setiap ekspor yang disebut dapat direstorasi mempunyai jalur impor yang sesuai. Jangan sekadar menaikkan angka tanpa memperhitungkan memori dan kapasitas dataset berikutnya.
- Jika diperlukan format baru/berkas terpecah, sediakan importer dan manifest yang berpasangan, validasi kelengkapan/hash/scope, serta pembaca backup legacy yang sah. Batasi ukuran terdekompresi jika menggunakan kompresi.
- Jangan mengizinkan reset hanya karena file berhasil diunduh; bukti pemulihan harus melewati gerbang verifikasi yang benar.
- Error tidak boleh menghasilkan sukses palsu atau mutasi sebagian yang tidak ditangani.

Audit ulang kemudian uji: round-trip kecil dan besar, sekitar ambang ukuran, metadata/Unicode, file rusak/terpotong, scope salah, format versi lama/lebih baru, backup tidak lengkap, arsip→verifikasi→readiness reset. Reset/restore hanya pada fixture.

Gerbang: tidak ada hasil ekspor yang dinyatakan siap pemulihan tetapi ditolak oleh importer pasangannya karena kontrak ukuran; data dan hash round-trip benar; semua perubahan pemulihan terdokumentasi.

## Tahap 2 — satu pemilik aksi/loading, kemudian draf persisten (S08/S04)

### 2A. Dasar lifecycle operasi

Perbaiki kepemilikan loading dengan mekanisme minimal, misalnya token operasi. Telusuri semua pemakai show/hide; jangan memutus pemakai lama. Hindari dua sistem loading yang hidup permanen. Satu tombol/form hanya mempunyai satu handler yang berwenang menjalankan aksi.

Uji A dimulai, B dimulai, A selesai lebih dahulu; loading B tetap benar. Uji gagal, batal, double-click, operasi yang sudah selesai saat timer akan tampil, dan cleanup. Jangan menganggap timer generation saja menyelesaikan kepemilikan operasi async.

### 2B. Draf persisten — terapkan satu fitur dahulu

Mulai dari **presensi**, tutup gerbangnya, lalu **nilai/TP**, kemudian **jurnal**. Jangan sekaligus mengganti tiga formulir.

- Scope draf minimal UID/workspace/tahun/kelas/form/identitas record, misalnya tanggal atau TP. Simpan revision, baseline/version record dan waktu perubahan.
- Persistensi boleh memakai debounce kecil, tetapi indikator “tersimpan di perangkat” hanya muncul setelah transaksi lokal berhasil. Nyatakan batas kehilangan ketikan yang masih pending dengan jujur; jangan mengklaim flush async pada pagehide selalu selesai.
- Saat reload, pulihkan draf hanya untuk akun/scope yang tepat. Ketika server berbeda dari baseline, jangan menimpa otomatis.
- Tangani quota/write lokal gagal secara eksplisit, pertahankan input yang masih ada, dan sediakan langkah pemulihan yang masuk akal.
- Logout dengan draf harus menyediakan keputusan jelas: kembali mengerjakan, menyimpan draf untuk akun yang sama, atau membuang draf tertentu dengan konfirmasi. Jangan membocorkan draf kepada akun berikutnya atau menghapus kunci Chat.
- Bersihkan draf hanya setelah commit server berhasil dan revision masih sama. Kebijakan umur/batas draf tidak boleh diam-diam membuang pekerjaan belum terkirim.
- Jangan membuat antrean auto-sync offline.

Uji per fitur: reload, navigasi, offline–online tanpa pengiriman otomatis, pergantian kelas/tahun/akun, ketikan selama request, double-click, server menolak, konflik dua tab, quota gagal, serta restore draf lama yang masih valid. Simulasi penghentian dilakukan setelah persistensi terkonfirmasi; bedakan dari kehilangan proses di tengah write yang belum selesai.

Gerbang: ketiga fitur mendapat perilaku konsisten, satu commit per aksi, draf lintas scope tidak tercampur dan API bersama lama yang diganti tidak menyisakan pemanggil rusak.

## Tahap 3 — kapasitas database tanpa merusak laporan (S02)

Kerjakan setelah kontrak backup dan draf stabil.

1. Inventaris setiap pembaca data: halaman, rekap dashboard, ketuntasan, QR, laporan, ekspor, backup, arsip, LPS/BLP. Tentukan mana perlu seluruh data dan mana cukup kelas/periode.
2. Buat kontrak eksplisit untuk kelengkapan, cursor, scope dan status pemuatan. Hindari state global berisi potongan data yang dianggap seluruh tahun.
3. Gunakan query kelas/periode dan pagination sesuai skema Firebase yang nyata. RTDB tidak boleh diasumsikan mendukung kombinasi filter arbitrer. Jika perlu indeks/data turunan, siapkan desain additive, kompatibilitas baca legacy dan rencana backfill lokal; jangan memigrasikan cloud.
4. Integrasikan satu koleksi lebih dahulu, mulai dari presensi, kemudian koleksi lain yang terkena ambang. Pertahankan jalur ekspor/backup yang dapat mengambil keseluruhan dataset secara lengkap dan terkendali.
5. Ringkasan/agregat yang ditambah harus memiliki strategi konsistensi dan pemulihan. Jangan menggandakan seluruh data untuk setiap layar.
6. Pertahankan guard keselamatan. Penghapusan limit atau peningkatan angka saja bukan penyelesaian.

Uji dataset sintetis di bawah, pada dan di atas 20.000 record; banyak kelas/tahun; halaman kosong/terakhir; perubahan data saat pagination; data legacy tanpa kelas; jumlah hasil ekspor dan rekap; koneksi putus; isolasi scope. Pastikan tahap 1 dapat memulihkan backup dari volume yang kini didukung dan tahap 2 tetap menyimpan konflik/baseline dengan benar.

Gerbang: volume di atas ambang lama dapat ditangani melalui pembacaan lengkap yang dirancang, tidak ada data terlewat/duplikat dalam hasil akhir, dan laporan tidak menghitung data parsial sebagai lengkap. Jika skema lama tidak memungkinkan pencapaian tanpa backfill produksi, tandai rollout pending dan sediakan jalur kompatibilitas; jangan mengklaim cloud sudah diperbaiki.

## Tahap 4 — validasi server dan audit terpercaya (S03/S05)

- Selaraskan schema/ukuran server dengan payload valid dari tahap sebelumnya. Periksa data legacy sebelum memperketat rules.
- Lengkapi validasi koleksi yang saat ini hanya mempunyai scope read/write; validasi field dan hubungan yang penting tanpa memperluas akses.
- Untuk Chat, validasi bentuk pesan sesuai tipe, ciphertext/IV/AAD dan field media tanpa mengubah kontrak enkripsi atau membuat riwayat lama tidak terbaca.
- Kuota client jangan diklaim sebagai kuota server. Terapkan otoritas penulisan untuk batas yang memang harus mengikat semua penulis.
- Implementasikan audit otoritatif untuk operasi administratif penting, terutama restore/arsip/reset. Endpoint yang sekadar menerima klaim client bukan bukti peristiwa database terjadi. Pilih mekanisme minimum pada backend yang sudah ada, dan ikat audit pada operasi yang benar-benar berhasil.
- Audit membutuhkan operation ID/idempotensi dan keadaan gagal yang jelas. Jangan menduplikasi aksi akibat retry atau melaporkan audit berhasil ketika tidak tercatat.
- Jangan menambah backend/framework/layanan berbayar baru tanpa kebutuhan yang terbukti. Bila sarana server yang tersedia tidak cukup, jelaskan keputusan arsitektur yang diperlukan sebagai blocker, bukan memasang audit palsu.

Audit ulang kemudian uji emulator/binding tiruan: hak akses valid/invalid, payload sah/rusak, field berlebih, batas ukuran, data legacy, server time, pengirim/penerima Chat, retry, commit/audit failure dan operation ID sama. Ulangi round-trip backup serta skenario draf/commit yang terdampak rules baru.

Gerbang: aturan lokal dan backend konsisten dengan aplikasi, regresi payload sah tidak ada, dan audit tidak dapat diklaim dari input client saja. Siapkan urutan deploy/backfill/rules untuk rilis mendatang, tetapi jangan menjalankannya.

## Tahap 5 — retensi, penyimpanan dan pemulihan lintas subsistem (S06/S07)

- Sediakan inventaris yang dapat dipahami untuk cache akademik, draf, GADM, cache SW dan arsip yang dapat diakses. Bedakan byte payload dari perkiraan storage browser; jangan menyajikan angka sebagai ukuran pasti jika tidak diukur.
- Tunjukkan peringatan sebelum mencapai ambang. Bedakan data yang aman dibuat ulang dari pekerjaan pengguna yang belum tersimpan.
- Pertahankan data aktif, draf belum terkirim dan kunci enkripsi. Penghapusan data penting harus berdasarkan pilihan serta verifikasi pemulihan yang sesuai.
- Dokumentasikan dan implementasikan jalur pemulihan minimum tiap subsistem. Backup JSON akademik harus tetap menyatakan batas cakupannya; jangan menyebut seluruh SIMNI tercadangkan jika GADM, kunci/media Chat atau aset Cloudinary belum tercakup.
- Manfaatkan ekspor yang sudah ada. Tambahkan cakupan yang kurang secara terarah; jangan membangun sistem backup generik yang jauh lebih rumit dari produk.
- Periksa retensi lintas tahun dan arsip legacy; jangan mengasumsikan quota per tahun membatasi seluruh cloud. Rencana penghitungan/backfill legacy tidak boleh menghapus data produksi.

Uji lokal: ruang hampir penuh, write gagal, tahun/scope berbeda, ekspor→verifikasi→pemulihan, file media hilang, draf/kunci tetap terlindungi dan cleanup cache yang aman. Gunakan fixture, bukan bucket/aset asli.

Gerbang: pengguna mengetahui apa yang tersimpan, apa yang belum terkirim, apa yang tercadangkan dan langkah pemulihannya. Tulis keterbatasan eksternal yang belum dapat dibuktikan.

## Tahap 6 — pemuatan fitur dan penyederhanaan frontend (S09)

Kerjakan setelah kontrak data/lifecycle stabil agar perubahan pemuatan tidak menutupi bug data.

- Muat shell/dashboard dan runtime yang benar-benar diperlukan saat awal; fitur lainnya saat dibuka.
- Gunakan pemuatan idempotent dan satu Promise per modul. Sambungkan refresh data serta lifecycle mount/unmount dengan jelas.
- Jangan mendaftarkan ulang listener setiap kali fitur dibuka. Bersihkan timer, observer, URL objek, scanner dan media ketika tidak digunakan.
- Pisahkan kebutuhan parsing awal dari ketersediaan aset offline. Jangan menghapus aset precache tanpa jalur unduh fitur dan status kesiapan offline yang jelas.
- Pertahankan seluruh aksi, label, fokus, state loading dan akses keyboard. Tidak ada redesign visual besar dalam tahap ini.
- Hapus handler/lapisan lama hanya setelah semua pemanggil dipindah dan pemeriksaan regresi lulus. Tolak duplikasi permanen antara jalur “lama” dan “baru”.

Uji: buka langsung setiap fitur, login scope berbeda, pindah berulang, reload/deep link yang didukung, aset gagal dimuat lalu retry, offline cold/warm dengan keterangan yang tepat, ekspor GADM/LPS/BLP, dan Chat. Bandingkan ukuran/biaya pemuatan awal dengan baseline; jangan sekadar mengklaim lebih cepat karena file dipindahkan.

Gerbang: fitur lengkap, tidak ada duplicate listener/action, tidak ada fungsi undefined pada first-open, dan biaya awal membaik pada pengukuran yang sama.

## Tahap 7 — audit integrasi dan persiapan rilis lokal

1. Audit statis seluruh diff dan peta pemanggil bersama. Pastikan tidak ada sisa jalur lama, guard yang dihapus tanpa pengganti, perubahan scope/key, atau log sensitif.
2. Jalankan regresi kumulatif pada satu artefak final: login/scope, presensi hari ini/historis/QR, TP legacy/Bab, nilai, jurnal, siswa, backup/restore/arsip/reset mock, GADM, LPS/BLP, Chat, draf, konflik dan offline.
3. Pertahankan fidelity template asli LPS/BLP. Unduh nyata, periksa isi/struktur/format dan edit guru; jumlah file atau header ZIP saja tidak cukup. Acuan root tidak diubah.
4. Uji desktop/ponsel dan tema, fokus keyboard, status sukses/gagal, loading bersamaan, buka-tutup fitur serta lintas tab. Pisahkan bukti simulasi browser dari perangkat fisik.
5. Uji pembaruan SW dari baseline ke versi baru dan rollback dalam origin uji dengan source produksi/build, sementara auth/database tetap fixture. Jangan menghapus seluruh storage untuk membuat upgrade lolos.
6. Tetapkan versi rilis baru yang belum dipakai, cocok dengan tingkat perubahan; jangan menimpa identitas rilis 4.6.9 yang sudah live. Selaraskan package/lock/runtime/manifest/dashboard/settings dan authority SW. Periksa harness yang hard-code versi lama tanpa melemahkan validasi.
7. Build final, catat hash, verifikasi source/public dan larangan mock/QA/secret di artefak. Jika source berubah sesudah QA, jalankan ulang pemeriksaan yang terpengaruh; jangan menggabungkan hasil beberapa hash menjadi satu klaim.
8. Siapkan runbook deployment baru dan rollback kompatibel dengan perubahan schema/rules/index/Worker. Jangan menjalankan runbook deploy 4.6.9 lama untuk rilis baru ini.

Gerbang: seluruh temuan memiliki status yang jujur, bukti terikat pada checkpoint yang jelas, tidak ada kegagalan prioritas tinggi yang disembunyikan. G01 tentang cloud live, perangkat nyata, penggunaan guru dan soak jangka panjang boleh berstatus belum terverifikasi; jangan memalsukan penutupannya melalui mock.

## Cara melaporkan dan melanjutkan pekerjaan

Pada setiap tahap, laporkan singkat:

- Masalah yang ditutup dan perilaku sebelum/sesudah.
- File yang berubah serta pemakai kontrak yang diperiksa.
- Hasil audit ulang sebelum tes, tes yang dijalankan dan hasil aktualnya.
- Dampak pada tahap sebelumnya, hash checkpoint dan risiko tersisa.
- Status **SELESAI**, **GAGAL**, atau **TERBLOKIR** dengan alasan. Jangan menandai “selesai” hanya karena kode telah ditulis.

Jangan meminta persetujuan ulang untuk langkah lokal yang sudah diizinkan. Jangan berpindah tahap saat gerbang gagal. Jika percakapan terputus, lanjutkan dari `REKONSTRUKSI_BERTAHAP_STATUS.md`, periksa kesesuaian hash dan jangan menjalankan ulang skrip migrasi/revisi satu kali.

Hasil akhir yang harus diserahkan: source yang diperbaiki, bukti QA per tahap, daftar temuan S01–S09/G01 beserta status, rangkuman penyederhanaan jalur aksi, dokumentasi kontrak data/draf/backup, laporan audit akhir, artefak lokal terverifikasi dan runbook deployment berikutnya. Jangan menjanjikan skor 9/10 atau “tanpa efek domino” berdasarkan niat desain; buktikan pengurangan regresi melalui gerbang di atas dan nyatakan batas yang belum diverifikasi.

**Jangan menjalankan dokumen gabungan ini. Gunakan satu prompt terpisah per tahap dan berhenti pada akhir tahap. Jangan deploy.**
