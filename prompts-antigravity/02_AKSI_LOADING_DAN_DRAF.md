# Prompt terpisah 2 — SIMNI pasca-4.6.9

Model pilihan: Gemini 3.8 Flash; gunakan tingkat penalaran High/tinggi jika tersedia di model selector. Jangan menganggap pilihan model menggantikan gerbang audit dan pengujian.

**KERJAKAN HANYA TAHAP 2. Jangan meneruskan ke tahap lain, walaupun tahap ini berhasil.**

Baca REKONSTRUKSI_BERTAHAP_STATUS.md dan bukti tahap sebelumnya. Pastikan tahap sebelumnya selesai dan hash checkpoint sesuai. Bila ada blocker yang belum terselesaikan, laporkan dan jangan memulai revisi tahap ini.

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
- Berhenti setelah tahap aktif selesai. Tahap berikutnya hanya boleh dimulai setelah pengguna mengirim prompt tahap tersebut. Jika menemukan kebutuhan perubahan produk di luar scope, akses eksternal yang wajib, atau blocker yang tidak dapat diselesaikan lokal, jelaskan masalah konkret dan jangan menyatakan tahap selesai.

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


## Penyerahan tahap aktif

Perbarui REKONSTRUKSI_BERTAHAP_STATUS.md dengan tahap aktif, file yang berubah, perilaku sebelum/sesudah, hasil audit statis ulang sebelum tes, hasil tes aktual, hash checkpoint, dampak lintas fitur, batas bukti dan blocker. Jangan mengubah hasil historis menjadi PASS baru.

Simpan bukti di luar public. Jika perlu memperbaiki regresi yang ditimbulkan tahap ini, selesaikan sebelum menyatakan tahap selesai. Jangan menambah pekerjaan fitur baru atau melompat ke tahap selanjutnya.

**Setelah laporan tahap 2 diberikan, BERHENTI dan tunggu prompt berikutnya dari pengguna. Tidak ada deploy.**

