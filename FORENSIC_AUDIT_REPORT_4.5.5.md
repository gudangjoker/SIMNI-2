# Laporan Audit Forensik dan Rekonstruksi SIMNI v4.5.5

Tanggal audit: 31 Agustus–1 September 2026  
Status source: lulus verifikasi lokal  
Status deployment: tidak dijalankan

## Kontrak sistem final

SIMNI hanya mengenali dua role akses:

| Role | Workspace | Ruang lingkup |
|---|---|---|
| Superuser | `ws_superuser` | Administrasi kelas penuh, arsip, rollover, LPS/BLP, dokumen, catatan, dan chat |
| VIP | `ws_pjok` | Data kelas lintas pilihan, presensi, nilai PJOK, jurnal, backup offline role-scoped, dan chat |

Role akses ketiga, binding akun terkait, workspace terkait, assignment, migrasi, sinkronisasi, selector UI, handler, dan aturan izinnya telah dieliminasi dari source serta output Hosting.

Kata “Guru” yang merupakan nama profesi, nama fitur pedagogis, atau isi materi tetap dipertahankan. Penghapusan hanya berlaku terhadap role akses Guru Kelas 3B.

## Log rekonstruksi

1. Menghapus konstanta role ketiga dari access policy dan feature matrix.
2. Menghapus scope canonical serta scope legacy role ketiga.
3. Menghapus binding akun role ketiga dari authority autentikasi.
4. Memperketat validasi identitas: email Firebase, email profil, dan role wajib sama dengan binding kanonik.
5. Menghapus seluruh mesin migrasi workspace dari repository runtime.
6. Menghapus skrip maintenance migrasi dan bukti migrasi gagal milik role ketiga.
7. Menghapus input kelas role ketiga dari wizard rollover.
8. Mengubah readiness rollover menjadi tepat dua scope: Superuser dan VIP.
9. Mengubah commit rollover agar hanya memproses dua workspace kanonik.
10. Menghapus selector CSS dan contract UI role ketiga.
11. Merekonstruksi Realtime Database Rules untuk dua role kanonik.
12. Menutup akses normal terhadap workspace sumber lama Superuser; data sumber tidak dihapus.
13. Menghapus seluruh kontrak migrasi dari Realtime Database Rules.
14. Menghapus laporan lama dan paket deploy v4.5.4 yang tidak lagi sesuai source.
15. Menaikkan version authority, manifest, cache Service Worker, package, dashboard, dan test fixture ke v4.5.5.
16. Membangun ulang direktori `public/` secara deterministik tanpa deployment.

## Pemeriksaan efek domino

| Area | Verifikasi |
|---|---|
| Access policy | Tepat dua role; role lain ditolak fail-closed |
| Profil Firebase | Workspace dan class divalidasi terhadap role kanonik |
| Superuser | Tetap terikat ke owner dan `ws_superuser` |
| VIP/Guru PJOK | Tetap terikat ke `ws_pjok`; mata pelajaran non-PJOK ditolak |
| Presensi | Path tetap diisolasi per workspace dan tahun pelajaran |
| Backup | Scope role, workspace, kelas, tahun, dan hash tetap diverifikasi |
| Rollover | Gate arsip memerlukan dua role yang tepat, bukan sekadar jumlah record |
| LPS/BLP | Tetap hanya untuk Superuser dan tidak tertanam di Dashboard |
| Chat | Tetap memakai project tunggal Superuser dan tidak memakai workspace akademik |
| UI tema | Tidak dapat membuka kembali fitur yang ditolak policy |
| Service Worker | Version cache sinkron dengan app version 4.5.5 |
| Hosting output | Tidak memuat binding, workspace, selector, atau handler role ketiga |

## Hasil pengujian

| Suite | Hasil |
|---|---|
| Runtime sandbox | 155 PASS, 0 FAIL |
| Chat query regression | 9 PASS, 0 FAIL |
| Security contract | 56 PASS, 0 FAIL |
| Static/build contract | 170 PASS, 0 FAIL |
| UI end-to-end dan offline reload | 28 PASS, 0 FAIL |
| Total | 418 PASS, 0 FAIL |

Pemeriksaan tambahan:

- Seluruh JavaScript runtime lulus syntax check.
- Manifest dan Realtime Database Rules lulus parsing JSON.
- Pencarian forensik pada source dan `public/` tidak menemukan binding akun, workspace, konstanta, selector, atau input rollover milik role ketiga.
- Build Hosting tidak mengekspos source internal.
- Tidak ada Firebase Functions atau layanan berbayar yang ditambahkan.

## Rekonstruksi data live

- Profil database Guru Kelas 3B telah dihapus permanen dan read-back tidak menemukan UID terkait.
- Record migrasi akun dan lock migrasi aktif Guru Kelas 3B telah dihapus permanen.
- Read-back mengonfirmasi `ws_3b`, `ws_guru`, assignment, dan rollover Guru Kelas 3B tidak ada.
- Profil, workspace, dan histori migrasi Superuser tetap ada dan tidak diubah.
- Profil serta workspace VIP/Guru PJOK tetap ada dan tidak diubah.

## Pembersihan sesi Google

- Sesi Google utama telah dikeluarkan.
- Dua identitas akun tersimpan telah dihapus dari Google Account Chooser.
- Seluruh tab in-app browser telah ditutup.
- Halaman internal Chromium untuk menghapus cache dan browsing history ditolak oleh kebijakan keamanan browser. Tidak dilakukan manipulasi file profil atau bypass mekanisme keamanan.

## Batas publikasi

Perubahan ini belum dideploy sesuai mandat. File Rules production yang telah direkonstruksi juga belum dipublikasikan.
