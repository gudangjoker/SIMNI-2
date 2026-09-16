# Review independen Tahap 7 — SIMNI 4.7.0

Tanggal: 13 September 2026.

**Keputusan: BELUM LULUS gerbang Tahap 7. Klaim “100% sukses / seluruh S01–S09 resolved & verified” belum didukung implementasi dan bukti yang diperiksa. Tahan deployment 4.7.0.**

Review ini membaca laporan, prompt Tahap 7, source, rules, skrip QA, runbook, dan artefak lokal. Tidak menjalankan aplikasi, pengujian, build, emulator, deployment, atau mengubah kode aplikasi. Pemeriksaan hash dilakukan sebagai pemeriksaan berkas. Temuan runtime di bawah adalah risiko berdasarkan alur source, bukan hasil reproduksi browser baru.

## Bukti yang dapat dikonfirmasi

- Manifest lokal menyatakan versi **4.7.0**, buildId `60f14d98b350a65a273924fc9aad75a0f4b9b641dc40b8a7be01d4fa3e996630`.
- **118/118 hash berkas public cocok** dengan entri manifest. Ini memverifikasi integritas berkas terhadap manifest, bukan keberhasilan perilaku aplikasi atau deployment live.
- Perbandingan berkas sumber yang tersedia terhadap pasangan public hanya menemukan perbedaan pada `index.html` dan `chat/chat.html`; HTML build mendapat injeksi konfigurasi Chat. Perbedaan HTML hasil build tidak otomatis merupakan cacat.
- Implementasi baru seperti penyimpanan draf IndexedDB, helper pagination, tambahan rules, serta pemuatan fitur sesuai kebutuhan memang tersedia. Keberadaan implementasi belum berarti seluruh pemakai dan kasus gagal sudah benar.

## Temuan yang menghalangi penutupan

### T7-01 — Tinggi: pengujian upgrade/rollback tidak menjalankan Service Worker produksi

Lokasi: `qa/sw-upgrade-rollback-contract-test.mjs`, kasus 2–5; `prompts-antigravity/07_AUDIT_INTEGRASI_FINAL.md`, persyaratan 5.

Kasus upgrade dan rollback membuat objek JavaScript `mockStorage`, menghapus/menambahkan properti cache secara manual, lalu memastikan properti database yang tidak disentuh tetap tersedia. Skrip tidak mengoperasikan Service Worker aplikasi dalam browser maupun IndexedDB sebenarnya. Assertion “backward compatible” hanya memeriksa isi fixture, bukan kemampuan pembaca 4.6.9 memulihkan draf 4.7.0. Kasus precache juga tidak memeriksa keberadaan setiap berkas meskipun judul tes menyatakan demikian.

Dampak: PASS skrip ini tidak membuktikan update, rollback, perlindungan draf, atau kompatibilitas lintas versi sesuai gerbang yang diminta.

Tindak lanjut: gunakan baseline dan build baru pada origin browser terisolasi, SW produksi, serta auth/database fixture. Buktikan perubahan controller, pemuatan fitur yang belum dibuka, draf belum terkirim, lintas tab, offline, dan rollback tanpa menghapus storage. Sampai itu tersedia, tandai bukti lifecycle sebagai belum terverifikasi.

### T7-02 — Tinggi: aktivasi paksa SW membuka risiko campuran versi

Lokasi: `sw.js:872`, `sw.js:603`, `sw.js:653`, `js/core/shell.js:537`.

Install sekarang memanggil `self.skipWaiting()` tanpa kondisi. Aktivasi membersihkan cache lama dan memanggil `clients.claim()`. Handler `controllerchange` sengaja mempertahankan halaman lama dan hanya menampilkan toast; tidak mengganti seluruh runtime halaman secara terkoordinasi.

Dengan modul yang dimuat saat fitur dibuka, halaman yang masih menjalankan kode lama dapat mengambil modul dari versi baru. Pemeriksaan keberadaan string `skipWaiting()` dan `clients.claim()` pada QA justru menyatakan konfigurasi ini sebagai bukti anti-campuran versi, padahal tidak membuktikannya.

Tindak lanjut: tentukan kebijakan aktivasi yang menjaga konsistensi halaman, modul, cache dan draf antar-tab. Audit implementasi sebelum menjalankan uji update browser nyata yang terisolasi. Jangan menganggap tidak terhapusnya database sebagai bukti tidak ada regresi lifecycle.

### T7-03 — Tinggi: S02 belum selesai pada jalur sinkronisasi operasional

Lokasi: `js/database/sync.js:46`, `js/database/sync.js:1341`, `js/database/sync.js:1653`, `js/database/repository.js:160`.

Listener aktif masih memakai `limitToFirst(MAX_BINDING_RECORDS + 1)`, dengan batas 20.000 record dan 16 MiB. Handler masih menolak snapshot di atas batas. `assertWritableState()` tetap menahan penulisan ketika binding wajib tidak siap.

Helper pembacaan lengkap memang ditambahkan dan digunakan oleh backup (`features/backup/backup.js:36`), tetapi itu tidak menggantikan listener yang menentukan kesiapan operasional. Karena itu pertumbuhan koleksi wajib masih dapat menghalangi penyimpanan meskipun ekspor memiliki pagination.

Tindak lanjut: revisi jalur baca/sinkronisasi yang benar-benar dipakai fitur dan status kesiapan tulis. Pertahankan deteksi data parsial; jangan sekadar menaikkan batas atau menghapus guard. S02 harus dibuka kembali sampai alur kapasitas ini selesai dan dibuktikan.

### T7-04 — Tinggi: S05 masih log klaim klien, bukan bukti operasi server

Lokasi: `js/database/repository.js:1217`, `js/database/repository.js:1271`, `js/database/repository.js:1275`, `firebase/database.rules.production.json` cabang `auditLogs`.

Klien membuat record, menentukan aksi/target/details dan `status: 'committed'`, lalu menulisnya melalui `setDatabase`. Rules membatasi identitas penulis, bentuk record dan append-only; timestamp server serta readback mengonfirmasi pencatatan log. Keduanya tidak membuktikan operasi restore/arsip/reset yang disebut di log benar-benar dilakukan server.

Akun klien yang berwenang masih dapat mencatat aksi committed tanpa menjalankan operasi terkait. Ini bukan tuduhan akses terbuka untuk semua pengguna; masalahnya adalah tingkat kepercayaan bukti audit.

QA `qa/server-validation-audit-contract-test.mjs:213` menulis fixture audit langsung ke mock, sehingga juga tidak membuktikan keterikatan log dengan hasil operasi sebenarnya.

Tindak lanjut: kaitkan audit dengan hasil operasi pada jalur tepercaya di server, termasuk identitas operasi dan penanganan pengulangan. Jika tetap berupa log klien, beri label sesuai kemampuannya dan jangan menutup S05 sebagai authoritative audit.

### T7-05 — Sedang: validasi LPS masih placeholder

Lokasi: `firebase/database.rules.production.json:137`, `:145`, `:150`, `:155`.

Validasi `legacyLps`, `lps.templates`, `lps.reports`, dan `lps.revisions` memakai `newData.hasChildren([])`. Ekspresi ini tidak menyebut field wajib, tipe, batas ukuran, atau konsistensi payload LPS. Tes terkait hanya memastikan cabang rules tersedia.

Tindak lanjut: tetapkan schema yang kompatibel dengan dokumen lama, template editable, snapshot final dan revisi; kemudian buktikan penerimaan payload sah serta penolakan payload rusak melalui emulator. S03 belum layak ditutup penuh hanya berdasarkan keberadaan cabang rules.

### T7-06 — Sedang: status draf persisten mendahului commit transaksi

Lokasi: `js/core/state.js:121`, `js/core/state.js:129`, `js/core/state.js:324`.

Penyimpanan draf mengembalikan sukses pada `store.put(...).onsuccess`, kemudian menampilkan status tersimpan di perangkat. Kode belum menunggu `transaction.oncomplete` maupun menangani `transaction.onabort` sebagai hasil penyimpanan. Keberhasilan request belum menjamin keseluruhan transaksi berhasil; jika transaksi dibatalkan setelah request sukses, feedback dapat terlalu dini.

Tindak lanjut: tentukan sukses setelah transaksi selesai, tangani abort/error, dan pastikan feedback hanya milik revisi draf yang relevan. Audit juga jalur penghapusan draf yang menggunakan pola request-success serupa.

### T7-07 — Tinggi untuk gerbang rilis: bukti regresi belum mencakup satu artefak final sesuai prompt

Lokasi: `qa/final-cumulative-regression.mjs`, `test-output/lps-template-fidelity/`.

Runner menyebut 17 suite, tetapi dua entri adalah build dan audit artefak. Build final berada setelah mayoritas tes. Urutan ini belum membuktikan seluruh hasil terikat pada artefak akhir yang sama. Runner menampung stdout sukses tanpa menyimpannya dan tidak menuliskan manifest hasil per-suite beserta hash.

Runner tidak mencantumkan workflow akademik lengkap, workflow unduh template LPS/BLP, dan pemeriksaan native fidelity yang diminta gerbang Tahap 7. Dua bukti yang ditemukan, `workflow-results.json` dan `native-fidelity-results.json`, bertanggal modifikasi **10 September 2026**, sehingga tidak dapat dijadikan bukti baru untuk final 4.7.0 tanpa provenance tambahan. Ini tidak menyatakan template sekarang pasti rusak; yang belum tersedia adalah bukti terbaru yang memadai.

Tindak lanjut: setelah blocker implementasi diperbaiki, tetapkan satu checkpoint dan bangun artefak; jalankan workflow final yang diwajibkan terhadap artefak itu, simpan hasil terstruktur dengan hash dan waktu. Pisahkan tes kontrak, browser, emulator, unduh nyata, perangkat fisik dan cloud live.

## Runbook belum layak menjadi instruksi rilis final

`DEPLOYMENT_RUNBOOK_4.7.0.md` perlu dikoreksi setelah blocker selesai:

- Klaim kompatibilitas penuh pembaca draf lama tidak dibuktikan oleh tes rollback yang tersedia.
- Langkah hosting membangun ulang artefak setelah pre-flight, tanpa gerbang eksplisit untuk mencocokkan ulang hash sebelum deploy. Deployment harus menggunakan artefak yang benar-benar disetujui.
- Rangkaian perintah PowerShell tidak menyertakan penghentian eksplisit setelah exit code gagal. Target project/release serta prasyarat indeks siap perlu dibuat konkret.
- Contoh `git checkout <commit-rilis-sebelumnya>` bukan prosedur rollback siap pakai pada working tree yang memuat perubahan lokal. Gunakan artefak baseline terverifikasi atau checkout terisolasi, tanpa menimpa pekerjaan pengguna.
- Jangan menjadikan satu aksi administratif live sebagai pengganti pembuktian server audit di lingkungan uji.

Tidak ada perintah runbook yang dijalankan dalam review ini.

## Urutan penutupan yang disarankan

1. Koreksi status laporan: buka kembali S02, S05 dan bagian S03; tandai bukti lifecycle/regresi final belum lengkap.
2. Selesaikan jalur sinkronisasi, kontrak validasi dan audit server secara bertahap beserta pemeriksaan pemakainya.
3. Selesaikan kepastian commit draf lalu koordinasi update SW, karena pengamanan draf memengaruhi update/rollback.
4. Audit statis ulang perubahan dan kompatibilitas data; lanjutkan pengujian terisolasi sesuai izin pengerjaan yang berlaku.
5. Bekukan artefak final dan lengkapi regresi akademik, GADM, LPS/BLP beserta unduh fidelity, Chat, offline, lintas tab dan upgrade/rollback produksi lokal.
6. Koreksi runbook berdasarkan hasil nyata, kemudian ajukan rilis untuk keputusan pengguna. Bukti live, perangkat fisik dan soak tetap diberi status belum terverifikasi bila belum dilakukan.

Review ini tidak memberi skor baru dan tidak menyimpulkan seluruh perbaikan Tahap 1–6 gagal. Kesimpulannya spesifik: bukti dan implementasi yang ditemukan belum memenuhi penutupan penuh Tahap 7.
