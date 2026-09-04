# Laporan Rekonstruksi SIMNI PWA v4.5.7

Tanggal verifikasi: 2 September 2026  
Target rilis: Firebase Hosting `admin-kelas-3a`  
Status: siap dipublikasikan, belum dideploy

## Ruang lingkup

Rekonstruksi ini membetulkan empat kegagalan produksi pada dashboard ponsel dan Chat tanpa memindahkan data Chat, mengubah database akademik, atau menambah layanan berbayar:

1. Status `Online` menimpa nama aplikasi pada header ponsel.
2. Badge unread bernilai `0` terlihat dan berpindah ke ikon menu yang salah.
3. Identity E2E Chat terus meminta Frasa Pemulihan setelah reload atau pembersihan data browser.
4. Tombol kembali dari Chat merusak kesinambungan sesi dan membuat login SIMNI tersangkut.

## Rekonstruksi akar masalah

### 1. Header ponsel

Akar masalah berada pada struktur flex header yang tidak memberi baris mandiri untuk nama aplikasi dan status koneksi. Markup dan CSS sekarang menggunakan `mobile-app-identity`, `mobile-app-title`, serta `mobile-sync-status`. Nama `SIMNI` dan status `Online` memiliki baris, ukuran, dan batas overflow masing-masing.

### 2. Badge unread

Akar masalah terdiri dari dua bagian:

- aturan tampilan badge mengalahkan utilitas `hidden`, sehingga angka nol masih dirender;
- perpindahan view mengganti keseluruhan `className` tombol navigasi, sehingga kelas semantik `chat-nav-link`, `hidden`, dan hasil otorisasi dapat hilang.

Navigasi sekarang hanya men-toggle kelas presentasi aktif/tidak aktif. Badge nol memakai aturan `display: none`, tetap menjadi anak tombol Chat, dan tidak dapat berpindah ke menu Nilai TP atau menu lain.

### 3. Pemulihan identity Chat terintegrasi login Firebase

Login Firebase sekarang membentuk kunci akun lokal dengan PBKDF2-SHA256 600.000 iterasi dari kombinasi kata sandi login, UID, dan email akun. Kunci hasil derivasi disimpan di IndexedDB sebagai `CryptoKey` AES-GCM non-exportable. Kata sandi dan Frasa Pemulihan tidak disimpan.

Private key ECDH Chat dibungkus menggunakan kunci akun tersebut lalu disimpan sebagai backup terenkripsi pada dokumen backup kunci milik UID yang sama. Sesudah itu:

- hard refresh tidak meminta Frasa Pemulihan;
- reload Service Worker tidak meminta Frasa Pemulihan;
- setelah data/cache browser dihapus, login Firebase dengan akun dan kata sandi yang sama membentuk kembali kunci akun secara deterministik dan memulihkan identity Chat otomatis;
- Superuser dan VIP tetap memiliki identity terpisah berdasarkan UID;
- Firestore tetap menolak penyimpanan Frasa Pemulihan plaintext.

Kondisi legacy yang tidak dapat dilewati secara kriptografis: jika identity lokal versi lama sudah terhapus sementara backup server lama hanya terenkripsi oleh Frasa Pemulihan, frasa lama harus dimasukkan tepat satu kali. Setelah berhasil, aplikasi langsung mengganti backup lama dengan backup yang terikat login Firebase. Menghapus prompt tanpa frasa pada kondisi tersebut berarti membuang akses ke pesan lama atau melemahkan enkripsi; kedua tindakan itu tidak dilakukan.

### 4. Lifecycle autentikasi dan tombol kembali

Firebase Authentication sekarang mempunyai satu authority persistence `browserLocalPersistence` yang ditunggu oleh dashboard dan Chat sebelum observer sesi dipasang. Tombol kembali Chat hanya melakukan navigasi same-tab ke `../index.html`; tombol tersebut tidak melakukan teardown, sign-out, pembersihan context, atau pembukaan tab baru.

Kegagalan jaringan/profil sementara kini bersifat fail-closed pada UI tanpa menghapus sesi Firebase. Sign-out hanya dilakukan untuk pelanggaran akses terminal seperti binding akun tidak valid, profil tidak diizinkan, atau permission denied. Jika login UI tampil ketika `auth.currentUser` sebenarnya masih valid, tombol login merehidrasi sesi yang sama dan tidak membuat alur autentikasi kedua.

## Berkas inti yang direkonstruksi

- `js/database/firebase-client.js`
- `js/auth/auth.js`
- `js/auth/chat-unlock.js`
- `js/ui/navigation.js`
- `js/ui/shell.css`
- `index.html`
- `chat/js/chat-auth.js`
- `chat/js/chat-crypto.js`
- `chat/js/chat-ui-handler.js`
- `sw.js`
- `manifest.json`
- `js/core/runtime-config.js`
- `qa/security-contract-regression.mjs`
- `qa/static-contract-regression.mjs`
- `qa/e2e-ui-test.mjs`

## Hasil verifikasi

| Gerbang | Hasil |
|---|---:|
| Runtime sandbox | 157 PASS, 0 FAIL |
| Chat query regression | 12 PASS, 0 FAIL |
| Security contract | 71 PASS, 0 FAIL |
| Static/build contract | 177 PASS, 0 FAIL |
| E2E UI dan PWA | 38 PASS, 0 FAIL |
| Total kontrak | 455 PASS, 0 FAIL |

Skenario E2E yang diverifikasi secara eksplisit:

- status `Online` tidak bertabrakan dengan nama `SIMNI` pada viewport ponsel;
- badge nol tidak dirender;
- badge unread berada di dalam tombol Chat;
- kunci akun non-exportable tetap bekerja setelah hard reload;
- tombol kembali berpindah ke dashboard pada tab yang sama;
- composer kembali ke tinggi satu baris setelah pesan dikirim;
- kontrol file dan voice note tersedia dan aksesibel;
- tidak ada unhandled browser exception atau asset gagal;
- cold reload offline berhasil dari Service Worker.

Lighthouse terhadap build produksi lokal:

| Kategori | Skor |
|---|---:|
| Performance | 90 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

Laporan mesin tersedia pada `test-output/lighthouse-4.5.7.json`.

## Integritas rilis

- Versi package, manifest, runtime config, dan cache Service Worker sinkron pada `4.5.7`.
- `js/auth/chat-unlock.js` masuk precache Service Worker.
- Build produksi memakai Worker `https://simni-chat-media-gateway.2ndgoal.workers.dev`.
- Public VAPID key disuntikkan hanya pada output build.
- Tidak ditemukan kata sandi akun, private key Firebase, service-account JSON, atau secret Cloudinary dalam source dan output hosting.
- Dependency tree produksi lengkap; tidak ada dependency wajib yang hilang.
- Tidak ada perubahan RTDB Rules, Firestore Rules/indexes, Cloudflare Worker, R2, Cloudinary, maupun data live pada hotfix ini.

## Status publikasi

Folder `public/` telah dibangun ulang dari source v4.5.7 menggunakan konfigurasi produksi dan lulus E2E sesudah build. Deployment belum dijalankan. Publikasi harus memakai urutan pada `FIREBASE_DEPLOY_ANTIGRAVITY_4.5.7.md` dan hanya menargetkan Firebase Hosting.
