# Laporan Audit Forensik Chat Audio dan Autentikasi SIMNI v4.6.1

Tanggal: 2 September 2026  
Ruang kerja: `SIMNI_GADM_INTEGRATION`  
Status deployment: **BELUM DEPLOY**

## Ruang Lingkup

- Rekam dan kirim pesan suara.
- Dekripsi dan pemutaran pesan suara langsung di bubble Chat.
- Kompatibilitas codec browser desktop dan Android.
- Lifecycle media, retry, object URL, seek, durasi, serta batas ukuran upload.
- Tombol kembali Chat menuju Dashboard tanpa logout.
- Pemulihan sesi dan kepemilikan layar login.
- Bootstrap fitur setelah autentikasi, termasuk GADM.
- Cache dan version authority Service Worker.

## Temuan Forensik dan Rekonstruksi

### CHAT-AUDIO-001 — Media terenkripsi tidak memiliki player inline final

**Temuan:** pesan audio hanya membuka media hasil dekripsi melalui kontrol generik. Tidak tersedia state pemuatan, tombol play/pause yang konsisten, timeline, durasi, seek, retry, dan pesan kesalahan yang tepat.

**Koreksi:** `chat/js/chat-ui-handler.js` sekarang membuat player suara inline per pesan. Payload tetap diunduh dan didekripsi hanya ketika pengguna menekan Play. Player memiliki Play/Pause, timeline, seek, waktu berjalan/durasi, state memuat/dekripsi, retry setelah kegagalan sementara, dan penanganan pembatasan autoplay browser.

### CHAT-AUDIO-002 — Codec hasil rekaman bergantung pada browser

**Temuan:** nama berkas dan codec voice note mengikuti MediaRecorder browser. Codec WebM/Opus atau OGG dapat gagal dimainkan pada perangkat lain apabila dukungan decoder berbeda.

**Koreksi:** recorder utama menggunakan Web Audio untuk menghasilkan WAV PCM 16-bit, mono, 16 kHz. Format ini konsisten antara pengirim dan penerima. MediaRecorder tetap menjadi fallback terkontrol dengan ekstensi yang cocok dengan MIME aktual. Voice note maksimum 120 detik menghasilkan 3.840.044 byte sebelum enkripsi, tetap di bawah batas R2 8 MiB.

### CHAT-AUDIO-003 — Pesan lama memerlukan normalisasi MIME

**Temuan:** metadata lama dapat berisi MIME kosong, generik, atau codec yang tidak didukung media engine perangkat.

**Koreksi:** MIME dinormalisasi dari metadata dan ekstensi. Jika format lama tidak didukung langsung tetapi dapat didekode Web Audio, audio ditranskode lokal ke WAV sebelum diputar. Data plaintext tidak dikirim ke server dalam proses ini.

### CHAT-AUDIO-004 — CSP Firebase Hosting memblokir URL audio lokal

**Temuan:** media hasil dekripsi dimainkan dari URL `blob:`, tetapi Content Security Policy produksi tidak memiliki directive `media-src`. Browser kemudian mewarisi `default-src 'self'` dan menolak playback `blob:` walaupun audio valid.

**Koreksi:** CSP produksi sekarang menetapkan `media-src 'self' blob:`. Origin media eksternal tetap tidak dibuka. Browser E2E menggunakan header CSP produksi yang sama agar kontrak ini diuji pada setiap run.

### CHAT-NAV-001 — Modul sinkronisasi mengambil alih layar autentikasi

**Temuan:** `js/database/sync.js` memanggil `lockScreen()` ketika binding database gagal atau parsial. Pengguna tetap memiliki sesi Firebase yang sah, tetapi layar login kembali menutup Dashboard. Form login dan state autentikasi lalu berada pada kondisi berbeda sehingga tampak membeku setelah kembali dari Chat.

**Koreksi:** seluruh pemanggilan `lockScreen()` dan `unlockScreen()` dihapus dari modul sinkronisasi. Layar login sekarang hanya dimiliki lifecycle autentikasi pada `js/auth/auth.js`. Gangguan sinkronisasi tetap menahan penulisan dan menampilkan status/error, tetapi tidak dapat mengubah pengguna terautentikasi menjadi tampilan login.

### BOOT-IMPORT-001 — Dynamic import GADM menggunakan basis URL yang salah

**Temuan:** mock login Superuser menemukan request 404 ke `/js/core/features/gadm/gadm.js`. `import('./features/gadm/gadm.js')` di-resolve relatif terhadap `js/core/feature-loader.js`, bukan root aplikasi. Kegagalan ini menghentikan stage `auth-module`, mencegah Dashboard dimount, dan memperkuat gejala layar login beku.

**Koreksi:** dynamic feature module sekarang di-resolve melalui `new URL(url, document.baseURI).href`. Browser mengambil `/features/gadm/gadm.js` secara benar pada localhost maupun Firebase Hosting.

### PWA-VERSION-001 — Invalidasi cache setelah rekonstruksi

**Koreksi:** package, manifest, runtime app version, cache version, Dashboard, QA, dan readiness contract disinkronkan ke `4.6.1`. Service Worker sudah mem-precache seluruh file Chat dan GADM terkait; perubahan cache version memaksa app shell baru menggantikan versi lama secara atomik.

## Mock Login Superuser Persisten

Fixture mock Superuser dipertahankan di `qa/e2e-ui-test.mjs` sampai ada perintah penghapusan eksplisit. Fixture:

- hanya aktif pada browser QA melalui request interception;
- memakai UID/email dummy dan tidak memakai kredensial pengguna;
- tidak membaca atau menulis Firebase/Firestore/RTDB;
- tidak disalin ke output hosting `public`;
- menguji mount Dashboard nyata, role Superuser, navigasi ke Chat, tombol kembali, dan regresi layar login.

## Log Verifikasi

| Suite | PASS | FAIL |
|---|---:|---:|
| Runtime sandbox | 167 | 0 |
| Security contract | 74 | 0 |
| Chat query regression | 12 | 0 |
| Chat audio regression | 17 | 0 |
| GADM engine regression | 8 | 0 |
| Static/build contract | 203 | 0 |
| Browser E2E pada production build | 47 | 0 |
| **Total** | **528** | **0** |

Verifikasi browser mencakup decoding dan playback WAV dengan `currentTime` yang benar-benar bergerak, mock login Superuser ke Dashboard, navigasi Dashboard → Chat → kembali ke Dashboard, tidak munculnya layar login, Service Worker aktif, offline cold reload, serta tidak adanya unhandled browser exception atau asset response gagal.

## Status Akhir

**SOURCE DAN BUILD v4.6.1 LULUS QA — BELUM DEPLOY**
