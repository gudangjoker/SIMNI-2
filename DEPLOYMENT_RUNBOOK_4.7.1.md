# Runbook kandidat SIMNI 4.7.1 — belum diizinkan rilis

Tanggal penyerahan: 14 September 2026. Menggantikan petunjuk operasional runbook 4.7.0 untuk kandidat ini. Tidak ada deployment yang dilakukan dalam pengerjaan Codex.

## Gerbang saat ini

Rilis penuh ditahan sampai temuan S02 (kapasitas listener operasional), S05 (audit masih berupa klaim klien), dan S07 (pembersihan cache menghapus app-shell aktif; runtime cache tanpa batas otomatis) ditangani atau diputuskan secara eksplisit oleh pemilik sebagai keterbatasan yang diterima. Hasil regresi umum tidak menutup temuan ini. Lihat laporan final dan `REVIEW_TAHAP_7_4.7.0_2026-09-13.md`.

Source Chat dan konfigurasi deployment Firestore sudah dilepas. Data, aturan Firestore yang telah live, token push, bucket R2 dan Worker cloud tidak dihapus. APK/ZIP lama bukan paket kandidat baru.

## Urutan persiapan setelah blocker ditangani

1. Simpan checkpoint source, konfigurasi dan artefak pada lokasi terisolasi. Working tree sekarang memuat perubahan pengguna; jangan memakai reset/clean/checkout paksa untuk membuat checkpoint atau rollback.
2. Tentukan endpoint layanan aset. Default sekarang memakai route Cloudinary pada layanan lama. Jika memisahkan backend juga, siapkan Worker **baru** `simni-assets-gateway`, environment dan secrets-nya; jangan menimpa Worker Chat. Verifikasi layanan baru sebelum mengganti `SIMNI_EDGE_URL`. Deployment Worker memerlukan instruksi terpisah dari pemilik.
3. Bangun kandidat setelah perubahan terakhir. Jalankan perintah satu per satu dan hentikan bila exit code bukan nol:

   ```powershell
   node scripts/build-hosting.mjs
   if ($LASTEXITCODE -ne 0) { throw 'Build gagal' }
   node scripts/verify-hosting.mjs
   if ($LASTEXITCODE -ne 0) { throw 'Artefak tidak cocok' }
   node qa/tahap7-final-runner.mjs
   if ($LASTEXITCODE -ne 0) { throw 'Regresi gagal' }
   ```

4. Lengkapi uji emulator RTDB pada project `demo-simni-tahap7`, uji Worker dengan fetch lokal, unduh template dan fidelity XLSX. Catat hash rules, Worker, konfigurasi serta manifest. Jangan menjalankan emulator dengan project produksi.
5. Tinjau laporan dan setujui **buildId tertentu**, beserta scope rilis. Jika source atau konfigurasi yang memengaruhi hasil berubah, bangun dan uji bagian terdampak lagi. Jangan menganggap laporan dari hash sebelumnya otomatis berlaku.
6. Setelah pemilik memberi izin rilis, pastikan project eksplisit sesuai `.firebaserc` (`admin-kelas-3a`) dan scope hanya komponen yang telah disetujui. Validasi kompatibilitas rules dengan klien yang masih terbuka sebelum urutan rules/Hosting ditetapkan. Jangan deploy Firestore atau Worker Chat dari repository SIMNI ini.
7. Hook Hosting sekarang menjalankan `scripts/verify-hosting.mjs`, **bukan build ulang**. Artefak harus cocok dengan source dan manifest yang telah ditinjau. Verifikasi identitas build kembali sesudah rilis dengan pembacaan saja; uji tulis produksi memerlukan ruang lingkup tersendiri.

## Pembaruan klien dan rollback

SW baru menunggu seluruh tab versi lama ditutup. Tab yang masih memakai versi lama dapat tetap menampilkan Chat sampai pembaruan diaktifkan. Tutup tab/PWA lama lalu buka kembali; jangan menghapus database pengguna untuk memaksakan update.

Baseline lokal yang terbukti tersedia adalah snapshot 4.7.0, bukan artefak live 4.6.9. Uji upgrade/rollback lokal memakai baseline tersebut. Snapshot ini memuat Chat dan rules lama; rollback ke snapshot itu akan mengembalikan Chat. Karena tujuan sekarang memisahkan Chat, jangan menjadikannya target rollback produksi tanpa keputusan eksplisit dan penilaian kompatibilitas.

Sebelum rilis, sediakan target rollback produksi yang benar-benar diketahui, file lengkap dan checksum-nya, termasuk keputusan kompatibilitas rules. Gunakan direktori rilis terisolasi, bukan menimpa working tree. Jangan rollback data RTDB, hapus cache/database massal, atau mengembalikan Worker Chat hanya untuk mengatasi regresi UI.

## Batas bukti

Uji lokal bukan verifikasi layanan cloud live, browser/perangkat fisik, APK baru, penerimaan guru, ataupun soak berbulan-bulan. Semua batas ini tetap terlihat pada keputusan rilis.
