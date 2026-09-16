# Penulisan revisi multi-role SIMNI — 16 September 2026

Status: **kandidat source selesai ditulis; belum diuji, belum dibuild, belum dideploy**.

- Versi kandidat: `4.8.0-rc.1`.
- Folder source delta: `reconstruction-multirole-candidate/`.
- Paket: `SIMNI_MULTIROLE_4.8.0-rc.1_SOURCE_ONLY_BELUM_DIUJI.zip`.
- Berkas source/konfigurasi yang berbeda dari baseline: **43**.
- SHA-256 ZIP: `b0861b0fb57da5d03dac3084ca5061c296dfc5e272d3c0cb5bdfcacf64c15533`.
- Detail serah-terima: `reconstruction-multirole-candidate/SERAH_TERIMA_ANTIGRAVITY.md`.
- Inventaris hash source: `reconstruction-multirole-candidate/REVISION_MANIFEST.json`.

## Hasil penulisan kode

Persetujuan superuser sebelum akses, pengelolaan akun dan penempatan kelas, undangan sekali pakai/buat ulang/cabut, izin fitur, pindah/tukar guru, nonaktif, hapus akun berfase, draf tahun ajaran tanpa penghapusan data lama, serta riwayat keputusan telah dituliskan pada kandidat. Authority schema 4 menggunakan satu subtree administratif yang dikomit dengan ETag/CAS; data akademik tetap terpisah di workspace.

Migrasi menggunakan plan/hash/ETag dan read-back, menolak konflik, mempertahankan `ws_superuser`, serta menangani alias owner pada backup/arsip/aset lama. Rules, akses client, gateway, pendaftaran, menu superuser, versi kandidat dan serah-terima diperbarui bersama.

## Batas bukti

Tidak menjalankan kode aplikasi, parser/linter, unit test, mock login/database, emulator, browser, build, migration dry-run/apply ataupun deployment. Script Python yang digunakan hanya menulis berkas dan menyusun paket/inventaris. Daftar perubahan dan checksum bukan bukti seluruh skenario runtime benar. Antigravity wajib menguji integrasi sebelum rilis.

Source rilis root, public dan Android aktif tidak ditimpa. ZIP ChatGPT tetap utuh. Paket ini delta source, bukan aplikasi mandiri; gunakan baseline final Antigravity dan helper staging yang menolak konflik. Jangan deploy folder kandidat atau menyalin public lama. Nomor build/hash Hosting baru belum dibuat.

Keputusan penting: rollover tahun yang menghapus data tidak dilanjutkan; perubahan penempatan tahun baru mempertahankan data lama. File/Dokumen tetap owner saja. Lease offline dibatasi delapan jam dan tidak menjanjikan pencabutan salinan lokal saat perangkat terputus. Cloudinary URL publik lama tidak otomatis menjadi privat.
