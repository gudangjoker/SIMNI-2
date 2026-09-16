# Penilaian forensik SIMNI 4.6.9

Tanggal: 12 September 2026, Asia/Jakarta. Metode: audit statis source, konfigurasi, laporan dan bukti yang sudah tersedia. **Tidak menjalankan aplikasi, browser, pengujian, build, deploy, atau revisi kode.** Satu berkas baru ini adalah laporan audit.

## Kesimpulan dan skor

**Skor gabungan sementara: 6,8/10.** SIMNI telah memiliki alur kerja dan perlindungan yang cukup baik untuk konteks penggunaan yang terkontrol, tetapi belum memiliki dasar untuk predikat 9/10, terutama dalam pemulihan, pertumbuhan data dan pembuktian operasi produksi lintas tahun.

| Aspek | Skor /10 | Keyakinan penilaian | Alasan utama |
|---|---:|---|---|
| UI/UX | **7,5** | Sedang | Perbaikan alur, responsivitas, fokus, feedback dan template nyata; performa perangkat rendah, form panjang dan validasi guru belum lengkap. |
| Frontend–backend | **7,0** | Sedang untuk source; rendah untuk kesetaraan live | Pemisahan akses/repository dan kontrak fitur cukup baik; validasi server belum merata, audit persisten belum terhubung, bukti backend live belum tersedia di root. |
| Database | **6,5** | Sedang | Isolasi scope, transaksi dan guard kapasitas ada; pertumbuhan tahunan dapat memblokir simpan, quota banyak berada di client dan kontrak pemulihan ukuran tidak selaras. |
| Lifecycle | **7,0** | Sedang | Generation guard, penghentian listener dan aktivasi SW terkontrol; draf akademik masih volatil dan loading global belum memiliki pemilik operasi. |
| Kelayakan jangka panjang | **6,0** | Sedang-rendah | Dasar retensi/versioning ada, tetapi pemulihan menyeluruh, kapasitas, audit persisten, bukti upgrade/rollback dan operasi jangka panjang belum matang. |

Gabungan memakai bobot sama, masing-masing 20%: `(7,5 + 7,0 + 6,5 + 7,0 + 6,0) / 5 = 6,8`. Bobot ini pilihan reviewer agar transparan, bukan ukuran statistik atau SLA. Dimensi saling berkaitan; rata-rata tidak menghapus risiko pemulihan yang berprioritas tinggi.

Skala yang dipakai: 5 = dasar tersedia tetapi kekurangan besar; 6 = berfungsi dengan batas operasional penting; 7 = baik untuk lingkup terkontrol dengan pekerjaan ketahanan tersisa; 8 = matang dengan bukti operasi lebih lengkap; 9 = matang dan terbukti pada penggunaan representatif; 10 = tingkat aspirasi sangat tinggi yang tidak dapat disimpulkan dari pembacaan kode. Setengah poin menyatakan posisi di antara tingkat tersebut. Skor bukan persentase fitur yang benar atau peluang aplikasi tidak gagal.

## Status deployment dan batas bukti

- Pengguna menyatakan build 4.6.9 sudah deploy; hal tersebut dicatat sebagai informasi pengguna, bukan dibantah oleh laporan lama yang masih bertuliskan “belum deploy”.
- `DEPLOYMENT_REPORT_4.6.9.md` belum ditemukan pada root ini. Yang tersedia adalah prompt deployment, bukan hasil pelaksanaannya. Release ID Hosting/Worker, ruleset aktif, kesiapan indeks dan kesetaraan aset live belum dapat dikonfirmasi dari artefak lokal.
- Audit tidak mengakses cloud atau mencoba login karena lingkup kali ini statis tanpa pengujian. Tidak menyimpulkan backend salah deploy hanya karena bukti lokal belum ada.
- Pembacaan SHA-256 pada 117 berkas `public` cocok dengan manifest lokal; tidak ada mismatch. Build ID: `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`. Ini pemeriksaan berkas statis, bukan pengujian runtime maupun bukti live.
- Working tree masih memiliki banyak perubahan dan berkas untracked. Ini bukan bukti kerusakan, tetapi HEAD/nomor versi saja tidak cukup sebagai identitas rilis.
- Tidak ditemukan skor gabungan lima aspek pascarevisi. Skor UI/UX historis 5,9/10 berasal dari audit **sebelum** perbaikan 4.6.8/4.6.9.

Bukti historis yang digunakan: `RECONSTRUCTION_REAUDIT_4.6.7.md`, `UIUX_FORENSIC_AUDIT_4.6.7_2026-09-10.md`, `UIUX_RECONSTRUCTION_4.6.8.md`, `LPS_BLP_TEMPLATE_RECONSTRUCTION_4.6.9.md`, serta manifest dan hasil yang telah tersimpan di `test-output`. Angka PASS di sana tidak dijalankan ulang hari ini. Hasil 4.6.8 juga tidak diubah menjadi klaim seluruh fitur sudah diuji pada hash final 4.6.9.

## Rubrik UI/UX yang sebanding dengan audit awal

Bobot dipertahankan dari rubrik awal; skor di bawah adalah penilaian ulang berbasis perbaikan source dan bukti historis, bukan survei baru.

| Dimensi | Bobot | Skor | Dasar penilaian ulang |
|---|---:|---:|---|
| Keberhasilan alur utama | 15% | 8,5 | Kerusakan Pengaturan/preview diperbaiki; template dan unduh LPS/BLP mendapat verifikasi terperinci. |
| Responsivitas | 15% | 8,0 | Bukti lebar ponsel sampai desktop dan reflow membaik; keyboard virtual/perangkat fisik belum lengkap. |
| Aksesibilitas | 15% | 7,5 | Label, fokus, dialog, kontras dan reduced-motion; belum audit manual seluruh kriteria dan screen reader. |
| Feedback/loading | 10% | 7,5 | Snackbar, status simpan dan timer membaik; status pemulihan belum lengkap dan operasi loading bersamaan masih berisiko. |
| Performa | 15% | 6,0 | Vendor berat ditunda, tetapi bootstrap fitur masih luas dan belum ada bukti kecepatan lapangan/perangkat rendah. |
| Offline/ketahanan | 10% | 7,0 | Cache dan ekspor offline terbukti pada fixture; simpan akademik memerlukan koneksi dan draf bukan penyimpanan tahan crash. |
| Konsistensi visual | 8% | 8,0 | Kontrol, tema dan toolbar semakin konsisten. |
| Navigasi | 5% | 8,0 | Pengaturan dan dialog pulih; pembagian form panjang belum selesai. |
| Form/pemulihan draf | 5% | 7,0 | Draf terlindungi saat navigasi dalam sesi, belum pada penghentian proses. |
| Bantuan/microcopy | 2% | 6,5 | Petunjuk template membaik; pemetaan seluruh error menjadi langkah pemulihan belum lengkap. |

Jumlah tertimbang **7,47**, disajikan **7,5/10**. Penilaian draf memperhitungkan penghentian proses sehingga tidak otomatis mengikuti skor 8 pada rubrik awal yang lebih menekankan skenario navigasi sesi.

## Checklist cakupan audit

Keterangan: **Ada** = implementasi/bukti dapat ditelusuri; **Parsial** = ada tetapi cakupan atau ketahanan belum lengkap; **Belum terbukti** = memerlukan bukti tambahan, bukan otomatis gagal. Semua butir di bawah telah ditinjau; statusnya bukan hasil tes baru.

| Area | Poin yang diperiksa | Status dan batas |
|---|---|---|
| UI/UX | Alur presensi, nilai/TP, jurnal | Ada: bukti mock akademik; produksi tidak diuji ulang. |
| UI/UX | LPS/BLP siap pakai, editable, hasil unduh | Ada: 15 alur browser dan 27 pemeriksaan OOXML historis; edit struktur memang mengubah geometri. |
| UI/UX | Ukuran kontrol, reflow, fokus dan dialog | Ada/parsial: CSS 44 px, checkbox/radio 24 px, focus-visible; belum semua keadaan fisik. |
| UI/UX | Kontras, tema, keyboard, screen reader | Parsial: bukti axe terbatas pada keadaan yang diuji; belum sertifikasi menyeluruh. |
| UI/UX | Feedback error/sukses, loading, form panjang | Parsial: status commit membaik; lihat S08 dan catatan microcopy. |
| Frontend–backend | Pemisahan SDK, akses dan repository | Ada: guard akses serta sinkronisasi mendahului write. |
| Frontend–backend | Validasi dan otorisasi server | Parsial: default deny/scope tersedia; schema beberapa koleksi belum divalidasi. |
| Frontend–backend | Chat/rules/index/Worker | Ada di source; keadaan live belum terbukti dari laporan lokal. |
| Frontend–backend | Integritas ekspor dan data final | Ada di client; bukan bukti bahwa semua perubahan database dipaksakan mengikuti kontrak tersebut di server. |
| Frontend–backend | Audit persisten dan diagnosa produksi | Parsial: API audit client sengaja diblokir; jalur server penggantinya tidak ditemukan dalam source yang ditinjau. |
| Database | Identitas, scope tahun/workspace, validasi nilai | Ada; struktur masih sangat spesifik pada role/workspace yang ditetapkan. |
| Database | Transaksi dan konflik | Ada pada jurnal/arsip; belum bukti seluruh cabang dan persaingan perangkat. |
| Database | Query, indeks dan batas volume | Parsial: pembatas query ada, tetapi bukan pagination operasional tahun besar. |
| Database | Retensi, quota dan data legacy | Parsial: batas per subsistem; bukan batas global seluruh cloud/tahun. |
| Database | Backup/restore dan cakupan berkas | Parsial: hash/scope ada; kontrak ukuran dan media perlu perhatian. |
| Lifecycle | Auth/switch scope dan callback usang | Ada: pemeriksaan generation/signature. |
| Lifecycle | Listener, timer, URL objek dan perekaman | Ada mekanisme cleanup; kebocoran jangka panjang belum diukur. |
| Lifecycle | Draf, offline dan pemulihan crash | Parsial: draf akademik session-only; bukan outbox persisten. |
| Lifecycle | Instalasi/aktivasi SW dan pergantian versi | Ada: precache atomik, aktivasi paksa dinonaktifkan; matriks upgrade/rollback belum lengkap. |
| Lifecycle | Operasi bersamaan | Parsial: beberapa busy guard tersedia; loader global belum bertoken operasi. |
| Jangka panjang | Kapasitas banyak kelas/tahun | Parsial: batas aman dapat menjadi batas operasional keras. |
| Jangka panjang | Pemulihan bencana seluruh subsistem | Belum terbukti; backup akademik tidak mencakup seluruh aset dan penyimpanan produk. |
| Jangka panjang | Perubahan schema/dependency | Ada versioning; bukti migrasi lintas beberapa versi dan kebijakan pemeliharaan belum lengkap. |
| Jangka panjang | Observabilitas, audit, SOP pemulihan | Parsial: ada runbook, belum bukti pelaksanaan/restore drill yang lengkap. |
| Jangka panjang | Perangkat rendah, soak, penerimaan guru | Belum terbukti pada bukti yang tersedia. |

## Temuan dan alasan pengurangan skor

Prioritas **P1** di bawah berarti perlu didahulukan sebelum skenario pertumbuhan/pemulihan terkait, bukan klaim insiden sedang terjadi. **P2** berarti kelemahan penting untuk ketahanan. Kondisi runtime yang belum direproduksi diberi batas secara eksplisit.

### S01 — P1: batas ekspor dan impor backup tidak selaras

**Fakta source:** `features/backup/backup.js:69` membuat Blob JSON berindentasi tanpa pemeriksaan ukuran file terhadap batas impor. `features/backup/backup-core.js:11` menetapkan 25 MiB; `features/backup/backup.js:239` menolak impor di atas batas itu dan baris 351 menolak verifikasi arsip untuk readiness reset. Sementara `js/database/repository.js:854` mengizinkan arsip sampai 32 MiB berdasarkan JSON ringkas.

**Dampak bersyarat:** ketika kumpulan data/format JSON menghasilkan file di atas 25 MiB, ekspor dapat berhasil tetapi file yang sama ditolak oleh jalur impor/verifikasi standar. Indentasi juga membuat ukuran unduhan lebih besar daripada JSON ringkas yang dihitung pada arsip. Belum ada bukti ukuran data pengguna sudah mencapai keadaan ini.

**Rancangan, belum dikerjakan:** satukan kontrak ukuran berdasarkan berkas yang benar-benar diekspor, atau sediakan format arsip terpecah/terkompresi dengan manifest dan importer pasangannya. Kriteria penerimaan kelak: setiap hasil ekspor yang dinyatakan dapat dipulihkan memang diterima kembali, termasuk batas ukuran dan reset readiness. Ini lebih mendesak daripada polesan visual.

### S02 — P1 bersyarat: batas tahunan dapat menghentikan write operasional

**Fakta source:** `js/database/sync.js:46`, `:1341`, `:1632` membatasi koleksi pada sentinel 20.001 record dan menolak lebih dari 20.000 record atau 16 MiB. `js/database/repository.js:158` menahan write ketika binding wajib belum sehat.

**Makna:** ini perlindungan yang baik terhadap laporan dari data parsial, tetapi belum menyelesaikan kebutuhan dataset besar. Contoh hitungan rancangan, bukan pengukuran database: empat kelas × 30 siswa × 200 hari = 24.000 record presensi jika setiap siswa/hari menjadi satu record pada binding tahun/workspace yang sama. Scope yang lebih kecil tidak otomatis mencapai batas itu.

**Rancangan:** baca detail per kelas/periode dengan pagination, agregat ringkasan untuk laporan, dan indikator kapasitas sebelum ambang. Jangan sekadar menaikkan batas atau menandai potongan data sebagai lengkap.

### S03 — P2: validasi server belum setara dengan validasi client

**Fakta source:** `firebase/database.rules.production.json:101` dan seterusnya memberi read/write sesuai scope pada notes, journals, schedule, documents, LPS dan archives tanpa schema/ukuran record setara guard client. Aturan siswa/presensi/nilai lebih terstruktur. `chat/firestore.rules:41` membatasi nama field dan identitas pesan, tetapi tidak memvalidasi tipe/panjang `ciphertext`, `iv`, `aad` dan hubungan lengkap field media per tipe pesan.

**Dampak:** client yang salah atau dimodifikasi oleh pengguna yang memang berhak menulis dapat memasukkan data di luar kontrak UI, termasuk membuat volume membesar. Ini bukan bukti pengguna tanpa autentikasi dapat mengakses data. Quota dalam JavaScript tidak menjadi batas server yang mengikat semua penulis.

**Rancangan:** schema record yang konsisten, batas payload di otoritas penulisan, validasi referensi relevan dan kompatibilitas data lama. Keadaan rules live tetap belum diverifikasi pada audit ini.

### S04 — P2: draf akademik tidak tahan penghentian proses

**Fakta source:** `js/core/state.js:66` menyimpan draf pada Map/Set dalam memori; draf dikosongkan ketika identitas sesi berubah. `:144` memasang beforeunload. `js/database/repository.js:164` menahan simpan ketika koneksi database putus.

**Dampak:** navigasi antarform dalam sesi mendapat perlindungan, tetapi reload yang dilanjutkan pengguna, crash atau penghentian proses tidak memiliki pemulihan draf akademik persisten dari mekanisme ini. Pernyataan “offline” tidak boleh ditafsirkan bahwa semua simpan akademik memiliki antrean persisten.

**Rancangan:** draf persisten terisolasi UID/workspace/tahun/kelas, revisi dan kebijakan kedaluwarsa; rekonsiliasi sebelum commit. Antrean write offline, bila kelak dibutuhkan, harus memiliki identitas operasi dan penanganan konflik sendiri.

### S05 — P2: pencatatan audit persisten belum lengkap

**Fakta source:** `js/database/firebase-client.js:350` mengembalikan `ok:false`, `blocked:true`, `CLIENT_FORGED_AUDIT_DISABLED` untuk `logSIMNIAuditEvent`. Pemanggil ada pada backup restore, arsip dan reset; rules RTDB menolak write client ke auditLogs. Tidak ditemukan implementasi server pencatat peristiwa tersebut pada source yang ditinjau.

**Makna:** menolak log yang bisa dipalsukan client adalah keputusan baik; tetap diperlukan jalur server terpercaya untuk jejak perubahan. Tidak disimpulkan bahwa seluruh log infrastruktur cloud tidak ada. Logging Worker tidak otomatis menjadi audit transaksi akademik.

**Rancangan:** pencatatan otoritatif dengan identitas operasi, pelaku, scope, waktu server dan hasil; bedakan commit sukses dari audit event yang belum tercatat.

### S06 — P2: backup akademik bukan pemulihan menyeluruh SIMNI

**Fakta source:** `features/backup/backup-core.js:16` mencakup path akademik/LPS; `:169` menyatakan dokumen hanya metadata/URL, tanpa file fisik Cloudinary. Penyimpanan GADM lokal, pesan/media Chat, serta pemulihan kunci memerlukan alur terpisah.

**Dampak:** satu JSON akademik tidak cukup memulihkan seluruh produk apabila perangkat hilang atau aset eksternal terhapus. Adanya alur ekspor terpisah tidak sama dengan bukti semua bagian sudah dicadangkan dan dapat direstorasi bersama.

**Rancangan:** inventaris pemulihan per subsistem, jadwal/penanggung jawab, prosedur pemulihan kunci dan aset, serta bukti restore menyeluruh pada tahap yang nanti diizinkan.

### S07 — P2: batas cache per subsistem bukan batas total jangka panjang

**Fakta source:** cache akademik 32 MiB/snapshot dan 96 MiB/database (`js/database/local-cache.js:16`); GADM 2 MiB/record, 64 MiB/database, 500 dokumen per scope (`features/gadm/gadm-storage.js:5`); runtime SW 64 item/16 MiB/7 hari (`sw.js:99`). Arsip client membatasi 20 versi/128 MiB per tahun (`js/database/repository.js:858`).

**Batas:** nilai tersebut tidak boleh dijumlahkan sebagai jaminan quota browser total; beberapa ruang penyimpanan berbeda dan ada aset/overhead lain. Ukuran precache historis 4.6.9 adalah 7.449.169 byte mentah, terpisah dari runtime cache. Batas arsip per tahun tidak membatasi semua tahun; inventaris baru juga belum menghitung seluruh arsip legacy. Pagination pesan membatasi pembacaan, bukan total pesan yang tersimpan.

**Rancangan:** inventaris penggunaan gabungan, peringatan sebelum penuh, kebijakan lintas tahun dan observasi pertumbuhan. Tidak ada bukti “bom waktu pasti” pada data sekarang; yang ada adalah jalur pertumbuhan dan kondisi kapasitas yang belum ditutup.

### S08 — P2, inferensi statis: loading global belum aman terhadap penyelesaian operasi berbeda

**Fakta source:** `js/ui/feedback.js:6` menggunakan generation untuk timer; `hideLoad()` pada baris 25 menaikkan generation tanpa token pemilik operasi. Backup dan LPS menggunakan pasangan show/hide global.

**Urutan logis yang berisiko:** operasi A menampilkan loading; B kemudian menampilkan loading; A selesai dan memanggil hideLoad; indikator B dapat ikut ditutup. Generation yang ada mencegah timer lama berlaku setelah timer baru, tetapi tidak membedakan penyelesaian async A dari B. Apakah urutan ini dapat dicapai pada setiap UI belum direproduksi; busy guard per fitur dapat mempersempit peluangnya.

**Rancangan:** token operasi atau registry/refcount loading dengan penutupan hanya oleh pemilik yang sesuai. Temuan ini memperjelas batas perbaikan timer 4.6.8, bukan mengulang klaim bahwa timer lama belum pernah diperbaiki.

### S09 — P2: pemuatan awal masih mencakup banyak fitur

**Fakta source:** `js/core/feature-loader.js:150` mengumpulkan runtime fitur yang diizinkan lalu memuat script berurutan; `:517` menunggu runtime itu sebelum mounting fragmen. Penundaan scanner/XLSX/ExcelJS/PDF/ZIP sudah ada dan bermanfaat, tetapi belum menjadi bootstrap shell/dashboard saja.

**Dampak:** klaim “super ringan dan super cepat di semua perangkat” belum ditopang desain pemuatan maupun bukti perangkat acuan. Angka performa lama tetap angka fixture, bukan keadaan live sekarang.

**Rancangan:** muat runtime saat fitur dibuka, tetapkan anggaran initial JS serta kebijakan offline shell/fitur, dan verifikasi terpisah ketika pengujian diizinkan.

### G01 — Kesenjangan bukti operasional, bukan bug yang terbukti

Tidak tersedia di root: hasil deploy 4.6.9, penerimaan auth/rules/media/push produksi, matriks pembaruan SW lintas versi/perangkat, restore drill menyeluruh dan pengamatan jangka panjang. Tidak ada penilaian negatif terhadap hasil yang belum dilihat; kekurangan ini membatasi keyakinan dan membuat skor 9/10 tidak dapat dipertanggungjawabkan.

## Urutan rancangan perbaikan berikutnya — belum dieksekusi

1. Selaraskan kontrak ekspor–impor–arsip–reset readiness dan kapasitas dataset tahunan (S01/S02).
2. Lengkapi schema/validasi server, pencatatan audit dan cakupan pemulihan (S03/S05/S06).
3. Persistensi draf dan kepemilikan operasi loading (S04/S08).
4. Inventaris quota/retensi lintas subsistem dan pemuatan runtime per fitur (S07/S09).
5. Lengkapi bukti deployment, penerimaan perangkat/guru, restore, upgrade/rollback dan operasi jangka panjang (G01). Tahap ini memerlukan izin pengujian tersendiri sesuai batas sesi sekarang.

Menuju 8/10 memerlukan penutupan risiko source prioritas tinggi dan kontrak pemulihan yang konsisten. Menuju 9/10 juga memerlukan bukti penggunaan representatif serta operasional, sehingga tidak bisa diperoleh hanya dengan menambah jumlah tes atau menerbitkan versi baru.

## Penutup audit

UI/UX meningkat dari penilaian historis **5,9 menjadi sekitar 7,5/10**. Nilai keseluruhan **6,8/10** lebih rendah karena menilai lapisan yang tidak terlihat pada antarmuka, khususnya kemampuan memulihkan dan mempertahankan sistem saat data bertambah. Tidak ditemukan dasar untuk menyatakan seluruh sistem sedang rusak atau data sudah membengkak, dan tidak ada dasar untuk menjamin kelayakan tanpa pemeliharaan bertahun-tahun.

Tidak ada revisi aplikasi atau pengujian baru pada sesi ini. Temuan statis dan rancangan di atas diserahkan untuk dibaca terlebih dahulu.
