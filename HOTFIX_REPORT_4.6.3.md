# Laporan Forensik Hotfix SIMNI-GADM v4.6.3

## Status

- Versi source, manifest, output hosting, dan cache Service Worker: `4.6.3`.
- Target pengujian: PWA ponsel, cold start, refresh cepat, reload/reopen, resume halaman, mode offline, dan navigasi Chat kembali ke Dashboard.
- Deployment: belum dilakukan.
- Database produksi: tidak dibaca, ditulis, dimigrasikan, dihapus, atau ditimpa selama rekonstruksi.

## Temuan Akar Masalah

1. `index.html` merender formulir login sebagai tampilan awal sebelum Firebase Authentication menyelesaikan pemulihan persistence. Akibatnya, refresh cepat selalu memperlihatkan kilatan halaman login walaupun sesi masih valid.
2. Pemulihan Dashboard menunggu pembacaan profil Realtime Database tanpa batas waktu. Pada WebView/PWA Android yang baru kembali dari background, koneksi jaringan dapat belum pulih walaupun sesi Firebase lokal sudah tersedia; state berhenti pada `loginBusy` dan layar terlihat membeku.
3. `unlockScreen()` menunda penyembunyian layar login selama 500 ms. Pemanggilan `lockScreen()` dan `unlockScreen()` yang berdekatan dapat diselesaikan di luar urutan oleh timer lama.
4. Lifecycle belum memulihkan state visual ketika halaman kembali dari BFCache, process discard, atau state `visibilitychange` ponsel.
5. Status `Online/Offline` ditempatkan di dalam blok vertikal nama aplikasi. Struktur ini bergantung pada line-height dan utility CSS sehingga dapat beririsan pada WebView/font scaling tertentu.

## Rekonstruksi

### State Autentikasi

- State awal diubah menjadi `restoring-session`.
- Selama `restoring-session`, `authenticating`, `establishing-access`, dan `loading-workspace`, formulir login tidak dirender. Pengguna melihat panel pemulihan sesi SIMNI yang terpisah.
- Formulir login baru muncul setelah Firebase secara definitif menyatakan tidak ada pengguna aktif atau terjadi error yang membutuhkan tindakan pengguna.

### Pemulihan Session-first dan Verifikasi Authority

- Firebase Authentication persistence tetap memakai `browserLocalPersistence` sebagai identity authority.
- Role tidak dibaca dari Web Storage dan tidak dapat dipilih klien. Role tetap diturunkan dari allowlist email kanonik Superuser/VIP.
- Access context awal dibuat langsung dari UID dan email sesi Firebase yang sudah dipulihkan agar cache IndexedDB role/workspace/tahun dapat dibuka tanpa menunggu jaringan.
- Profil RTDB diverifikasi asynchronous melalui `verifyAccessContext()` sebelum listener sinkronisasi database diaktifkan.
- Bila scope terverifikasi berbeda, state lokal dibersihkan dari memori dan dimuat ulang menggunakan scope hasil verifikasi sebelum sinkronisasi dimulai.
- Kegagalan jaringan sementara tidak menghapus sesi Firebase atau membekukan Dashboard.
- Ketidakcocokan identitas, role, workspace, atau permission terminal tetap melakukan lock dan sign-out secara fail-closed.

### Lifecycle PWA

- Event `pageshow` menangani BFCache dan halaman yang dibuang browser.
- Event `visibilitychange` memastikan PWA yang kembali ke foreground memulihkan sesi aktif.
- Event `online` memicu verifikasi authority dan sinkronisasi melalui lifecycle autentikasi yang sama.
- Transisi layar login kini sinkron tanpa timer, reflow paksa, atau callback lama yang dapat menimpa state terbaru.

### Header Ponsel

- Nama `SIMNI` dan status koneksi sekarang merupakan sibling terpisah.
- Status koneksi memakai badge mandiri dengan ukuran dan flex behavior yang tidak dapat memasuki kotak judul.
- Label status dibentuk sebagai elemen semantik tersendiri oleh `updateSyncUI()`.

## Batas Keamanan yang Dipertahankan

- Hanya role `superuser` dan `vip`.
- Superuser tetap terikat ke `ws_superuser`.
- VIP tetap terikat ke `ws_pjok` dan mata pelajaran PJOK.
- Cache IndexedDB tetap diisolasi dengan UID, role, workspace, kelas, tahun pelajaran, schema, dan hash integritas.
- Penulisan database tetap ditahan sampai binding sinkronisasi berstatus siap.
- Perubahan tidak menambahkan Cloud Functions, layanan berbayar, fallback role, localStorage password, token, atau profil akses.
- Mock Superuser QA dipertahankan hanya dalam skrip pengujian.

## Hasil Pengujian Final

| Gerbang | Hasil |
|---|---:|
| Runtime sandbox | 167 PASS |
| Chat query | 12 PASS |
| Chat audio | 17 PASS |
| Security contract | 75 PASS |
| GADM engine | 13 PASS |
| Static/build contract | 210 PASS |
| E2E UI/PWA | 50 PASS |
| GADM mobile workflow | 49 PASS |
| **Total** | **593 PASS, 0 FAIL** |

### Skenario Ponsel yang Dibuktikan

- Cold start menampilkan pemulihan sesi tanpa kilatan formulir login.
- Mock Superuser masuk ke Dashboard.
- Mock Superuser pulih setelah reload/reopen tanpa login freeze.
- Urutan lock/unlock cepat tidak meninggalkan layar login.
- Kembali dari Chat mempertahankan sesi dan Dashboard.
- Cold reload offline memuat shell serta asset inti dari Service Worker.
- Status Online berada di luar blok judul dan tidak beririsan dengan nama SIMNI.
- Service Worker aktif dengan cache version `4.6.3`.

## File Utama yang Dikoreksi

- `index.html`
- `js/auth/access-context.js`
- `js/auth/auth.js`
- `js/core/app.js`
- `js/ui/navigation.js`
- `js/ui/feedback.js`
- `js/ui/shell.css`
- `js/core/runtime-config.js`
- `manifest.json`
- `package.json`
- `package-lock.json`
- `qa/security-contract-regression.mjs`
- `qa/static-contract-regression.mjs`
- `qa/e2e-ui-test.mjs`

## Kesimpulan

Hotfix v4.6.3 menghilangkan login flash, pemulihan sesi yang tertahan jaringan, race condition transisi layar, dan benturan status koneksi pada judul ponsel. Output hosting sudah dibangun ulang dan tervalidasi lokal. Deployment belum dilakukan.
