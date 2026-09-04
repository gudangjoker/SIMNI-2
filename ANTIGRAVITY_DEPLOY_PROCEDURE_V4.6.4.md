# ANTIGRAVITY DEPLOY PROCEDURE V4.6.4

**STATUS:** QA PASSED — PROSEDUR DEPLOY SIAP, BELUM DIJALANKAN

## Ringkasan Versi
- **Target Versi:** 4.6.4
- **Branch/Check-in:** Lolos Verifikasi
- **Paket Tersedia:** `SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip`

## Daftar Perbaikan Terverifikasi (Bug Group 1-5)
1. **Konfirmasi Simpan & Double-Submit Protection**: Semua aksi penyimpanan form/data kini dikelola dispatcher tersentralisasi `actions.js` dengan fitur block double-submit yang memastikan form dan state lokal stabil tanpa reload halaman.
2. **TP Dropdown Input Nilai**: State realtime tidak akan men-disable TP secara tak beralasan atau memunculkan listener out-of-order, karena perhitungan completeness dievaluasi langsung dari seluruh siswa aktif sebelum commit lokal maupun respon remote.
3. **Edit Nilai Rekap**: Validasi perbaikan nilai siswa stabil.
4. **Render Input Nilai**: DOM manipulation yang robust untuk perbaruan data otomatis ketika Mapel & TP dipilih tanpa menggandakan listener.
5. **Presensi Completed State**: State selesai untuk presensi menampilkan opsi Edit Kehadiran yang stabil dan merekonsiliasi dengan tepat.

## Prasyarat Pra-Deploy
- `npm run build:hosting` berhasil dijalankan dan folder `public` berhasil dibangun.
- File `SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip` telah dibuat dan SHA-256 telah dilampirkan pada `PACKAGE_VERIFICATION_4.6.4.md`.
- `FORENSIC_FIX_AND_QA_REPORT_4.6.4.md` memverifikasi lolosnya E2E test `58 PASS, 0 FAIL` beserta screenshots mobile UI.

## Prosedur Deploy (Manual)
Pengguna atau Release Engineer dapat mengeksekusi instruksi ini:
1. Validasi hash: `Get-FileHash SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip -Algorithm SHA256`.
2. Ekstrak package ke root folder deployment.
3. Konfirmasi `firebase.json` target `public`.
4. Eksekusi `firebase deploy --only hosting`.
5. Verifikasi post-deploy dari Service Worker aktif (Pastikan versi 4.6.4 tampil di konsol/shell).
