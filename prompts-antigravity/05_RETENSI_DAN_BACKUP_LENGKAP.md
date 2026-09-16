# Prompt terpisah 5 — SIMNI pasca-4.6.9

Model pilihan: Gemini 3.8 Flash; gunakan tingkat penalaran High/tinggi jika tersedia di model selector. Jangan menganggap pilihan model menggantikan gerbang audit dan pengujian.

**KERJAKAN HANYA TAHAP 5. Jangan meneruskan ke tahap lain, walaupun tahap ini berhasil.**

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

## Tahap 5 — retensi, penyimpanan dan pemulihan lintas subsistem (S06/S07)

- Sediakan inventaris yang dapat dipahami untuk cache akademik, draf, GADM, cache SW dan arsip yang dapat diakses. Bedakan byte payload dari perkiraan storage browser; jangan menyajikan angka sebagai ukuran pasti jika tidak diukur.
- Tunjukkan peringatan sebelum mencapai ambang. Bedakan data yang aman dibuat ulang dari pekerjaan pengguna yang belum tersimpan.
- Pertahankan data aktif, draf belum terkirim dan kunci enkripsi. Penghapusan data penting harus berdasarkan pilihan serta verifikasi pemulihan yang sesuai.
- Dokumentasikan dan implementasikan jalur pemulihan minimum tiap subsistem. Backup JSON akademik harus tetap menyatakan batas cakupannya; jangan menyebut seluruh SIMNI tercadangkan jika GADM, kunci/media Chat atau aset Cloudinary belum tercakup.
- Manfaatkan ekspor yang sudah ada. Tambahkan cakupan yang kurang secara terarah; jangan membangun sistem backup generik yang jauh lebih rumit dari produk.
- Periksa retensi lintas tahun dan arsip legacy; jangan mengasumsikan quota per tahun membatasi seluruh cloud. Rencana penghitungan/backfill legacy tidak boleh menghapus data produksi.

Uji lokal: ruang hampir penuh, write gagal, tahun/scope berbeda, ekspor→verifikasi→pemulihan, file media hilang, draf/kunci tetap terlindungi dan cleanup cache yang aman. Gunakan fixture, bukan bucket/aset asli.

Gerbang: pengguna mengetahui apa yang tersimpan, apa yang belum terkirim, apa yang tercadangkan dan langkah pemulihannya. Tulis keterbatasan eksternal yang belum dapat dibuktikan.


## Penyerahan tahap aktif

Perbarui REKONSTRUKSI_BERTAHAP_STATUS.md dengan tahap aktif, file yang berubah, perilaku sebelum/sesudah, hasil audit statis ulang sebelum tes, hasil tes aktual, hash checkpoint, dampak lintas fitur, batas bukti dan blocker. Jangan mengubah hasil historis menjadi PASS baru.

Simpan bukti di luar public. Jika perlu memperbaiki regresi yang ditimbulkan tahap ini, selesaikan sebelum menyatakan tahap selesai. Jangan menambah pekerjaan fitur baru atau melompat ke tahap selanjutnya.

**Setelah laporan tahap 5 diberikan, BERHENTI dan tunggu prompt berikutnya dari pengguna. Tidak ada deploy.**

