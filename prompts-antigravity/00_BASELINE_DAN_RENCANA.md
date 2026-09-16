# Prompt terpisah 0 — SIMNI pasca-4.6.9

Model pilihan: Gemini 3.8 Flash; gunakan tingkat penalaran High/tinggi jika tersedia di model selector. Jangan menganggap pilihan model menggantikan gerbang audit dan pengujian.

**KERJAKAN HANYA TAHAP 0. Jangan meneruskan ke tahap lain, walaupun tahap ini berhasil.**

Ini tahap pembuka. Jangan merevisi source aplikasi. Lingkupnya inventaris, rancangan dan baseline uji lokal terisolasi.

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

## Tahap 0 — baseline, peta dampak dan kontrak

Baca laporan scorecard 12 September, laporan rekonstruksi 4.6.7, UI/UX 4.6.8, template 4.6.9, `Reconstruction_status.md`, konfigurasi build/runtime/Firebase/Worker dan bukti QA yang relevan. Periksa source terkini; laporan adalah titik awal, bukan pengganti membaca kode.

1. Rekam versi, manifest, hash dan status working tree. ID historis 4.6.9 adalah `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`; jika keadaan sekarang berbeda, jelaskan penyebabnya, jangan memaksa kembali ke file lama.
2. Buat matriks `temuan → aksi terdampak → file pemilik → pemakai kontrak → tes → risiko → checkpoint`.
3. Tetapkan invariant: data tidak hilang/tercampur scope, input valid tetap valid, satu aksi satu commit, snapshot final terlindungi, backup benar-benar dapat dipulihkan, data parsial tidak dihitung sebagai data lengkap.
4. Tetapkan kontrak draf, batas/format backup, model pembacaan data dan status kelengkapan sebelum mengimplementasikan perubahan yang bergantung padanya. Gunakan struktur yang sudah ada bila cukup.
5. Baca test runner sebelum menjalankannya. Rekam baseline pengujian lokal terisolasi; bedakan bug yang sudah ada, harness usang dan kegagalan lingkungan.
6. Buat `REKONSTRUKSI_BERTAHAP_STATUS.md`: tahap aktif, status tiap S01–S09/G01, hash checkpoint, hasil gerbang, masalah terbuka dan aksi berikutnya. Simpan bukti terperinci di direktori QA, bukan memenuhi root dengan laporan berulang.

Gerbang: scope dan kontrak jelas, baseline dapat dipulihkan, isolasi pengujian terbukti. Jangan mulai revisi sambil belum mengetahui pemakai fungsi bersama.


## Penyerahan tahap aktif

Perbarui REKONSTRUKSI_BERTAHAP_STATUS.md dengan tahap aktif, file yang berubah, perilaku sebelum/sesudah, hasil audit statis ulang sebelum tes, hasil tes aktual, hash checkpoint, dampak lintas fitur, batas bukti dan blocker. Jangan mengubah hasil historis menjadi PASS baru.

Simpan bukti di luar public. Jika perlu memperbaiki regresi yang ditimbulkan tahap ini, selesaikan sebelum menyatakan tahap selesai. Jangan menambah pekerjaan fitur baru atau melompat ke tahap selanjutnya.

**Setelah laporan tahap 0 diberikan, BERHENTI dan tunggu prompt berikutnya dari pengguna. Tidak ada deploy.**

