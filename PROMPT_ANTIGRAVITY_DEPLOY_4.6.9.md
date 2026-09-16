# Prompt Antigravity — deploy SIMNI 4.6.9

Laksanakan deployment SIMNI PWA 4.6.9 dari root berikut:

`C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`

Ini perintah deployment setelah seluruh gerbang di bawah lulus. Lanjutkan langkah rutin tanpa meminta persetujuan berulang. Jangan menjalankan deploy dari folder/ZIP/APK lama, jangan melakukan rekonstruksi besar, dan jangan menyatakan seluruh produk telah tersertifikasi hanya karena deploy berhasil.

## 1. Tetapkan sumber dan lingkup rilis

Baca `Reconstruction_status.md`, `RECONSTRUCTION_REAUDIT_4.6.7.md`, `UIUX_RECONSTRUCTION_4.6.8.md`, `LPS_BLP_TEMPLATE_RECONSTRUCTION_4.6.9.md`, lalu konfigurasi `firebase.json`, `.firebaserc`, `chat/edge/wrangler.jsonc`, `scripts/build-hosting.mjs`, dan bukti QA terbaru. Dokumen 4.5.x/4.6.1–4.6.4 adalah histori; jangan menjalankan perintah ekstraksi ZIP atau pembatasan hosting-only dari runbook lama untuk rilis gabungan ini.

Target yang sudah diketahui:

- Firebase project: `admin-kelas-3a`.
- Hosting source: `public`, dihasilkan dari root oleh `node scripts/build-hosting.mjs`.
- Versi source/hosting/cache: `4.6.9`.
- Build ID acuan terakhir: `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`.
- Firestore rules: `chat/firestore.rules`; indexes: `chat/firestore.indexes.json`.
- RTDB rules: `firebase/database.rules.production.json`.
- Worker: `simni-chat-media-gateway`; URL yang dipakai build: `https://simni-chat-media-gateway.2ndgoal.workers.dev`.
- Worker config: `chat/edge/wrangler.jsonc`; bucket binding `CHAT_MEDIA_BUCKET` menunjuk bucket yang sudah ada `simni-chat-media`.

Periksa keadaan live secara read-only dan bandingkan dengan source. Working tree berisi perubahan historis yang belum di-commit; jangan reset, clean, checkout paksa, atau menganggap HEAD sama dengan rilis live. Source akhir mencakup perubahan Chat dari 4.6.7/4.6.8, bukan hanya hotfix LPS 4.6.9.

Buat matriks `target → keadaan live → perubahan yang diperlukan → deploy/skip`. Firestore memiliki dua indeks messages baru (senderUid/createdAt dan recipientUid/createdAt), rules membatasi hapus pesan kepada pengirim aktif, Worker mencakup dukungan student_photo serta checkpoint pembersihan media. Jangan melewatkan perubahan ini jika belum tersedia live. Jangan menghapus indeks live lain yang masih digunakan. RTDB tidak memiliki revisi baru dalam tahap ini: default SKIP deploy database; jika menemukan perbedaan, jelaskan apakah benar dibutuhkan oleh rilis sebelum mengambil tindakan.

Scope tidak meliputi migrasi/reset data, penggantian akun/role/workspace/tahun, pelonggaran rules, upgrade billing, penghapusan bucket, rotasi secret, pengiriman pesan/push ke pengguna, atau pembuatan APK baru. Jangan memicu cron cleanup media secara manual; pertahankan jadwal dan kebijakan retensi yang sudah ada. Pengujian yang menulis data harus menggunakan mock/emulator atau lingkungan uji terisolasi.

## 2. Rekam titik pemulihan dan periksa prasyarat

- Simpan inventaris source/hash, manifest build, release Hosting aktif, ruleset Firestore aktif, daftar/status indeks, serta deployment/version Worker aktif. Simpan konfigurasi rollback di luar public; jangan menyalin nilai secret ke laporan.
- Pastikan akun CLI benar dan mempunyai akses ke project serta akun Cloudflare pemilik Worker yang sudah ada. Catat versi CLI yang dipakai; gunakan versi tetap sepanjang rilis, jangan menggunakan pembaruan `@latest` otomatis.
- Pertahankan lockfile/dependency. Jangan menjalankan `npm update` atau `npm audit fix` sebagai bagian deploy.
- Verifikasi bindings, origin yang diizinkan, variable dan keberadaan secret Worker tanpa menampilkan nilainya. `wrangler.jsonc` tidak memuat seluruh vars live; deployment Worker harus mempertahankan vars yang sudah ada.
- Jika akses tidak tersedia atau target tidak cocok, laporkan prasyarat yang kurang; jangan membuat project/Worker/bucket pengganti.

## 3. Gerbang sebelum perubahan cloud

Semua perintah PowerShell dijalankan berurutan dengan pemeriksaan `$LASTEXITCODE`; hentikan tahap berikutnya pada kegagalan. Jangan memakai rangkaian perintah yang mengabaikan exit code.

1. Jalankan `node scripts/build-hosting.mjs`.
2. Jalankan QA relevan terhadap source final: runtime, security, Chat query/audio, GADM, kontrak LPS, static contract, serta alur akademik mock. Gunakan skrip tersedia di `qa/`; baca terlebih dahulu agar pengujian tidak tersambung atau menulis ke produksi.
3. Jalankan `node qa/lps-template-workflow.mjs`, kemudian `qa/lps-native-fidelity.py` dengan Python yang tersedia. Gerbang terkini adalah 15 alur browser, 27 pemeriksaan OOXML, dan 42 pemeriksaan kontrak LPS; jumlah ini acuan bukti, bukan pengganti pemeriksaan hasil aktual.
4. Jalankan ulang alur UI mock GADM/Chat/akademik yang relevan dengan perubahan gabungan. Hasil 4.6.8 tidak boleh diberi label seolah dijalankan pada hash 4.6.9.
5. Untuk perubahan rules yang akan diterbitkan, uji izin pada emulator/lingkungan uji: pengirim boleh menghapus pesan sendiri; penerima/pihak lain/anggota nonaktif tidak boleh; update pesan tetap ditolak; isolasi baca dan validasi create tetap berlaku. Suite regex source bukan pengganti uji izin. `firebase.emulator.json` belum tersedia di root: bila perlu, buat konfigurasi QA terpisah di luar public dengan project demo, tanpa mengubah target produksi.
6. Uji Worker yang berubah dengan binding tiruan: student_photo sesuai MIME/batas ukuran, checkpoint pagination cleanup tetap lanjut setelah batas batch, dan checkpoint tidak maju ketika penghapusan gagal. Lakukan dry-run build Worker dengan konfigurasi yang ditentukan, bukan auto-detection project.
7. Jalankan `node qa/lps-release-audit.mjs`. Pastikan 117 hash file cocok, 62 JS lolos parse, tidak ada source/public mismatch, fixture, kredensial, QA, atau test-output dalam hosting. Periksa seluruh authority 4.6.9, termasuk dashboard dan SW yang mengambil versi dari runtime-config.

Jika tes lama gagal karena asumsi lama (misalnya vendor harus dimuat di dashboard atau exporter ExcelJS lama), bedakan bug produk dari harness usang dengan bukti. Jangan menonaktifkan assertion untuk memperoleh PASS. Perbaikan terbatas pada harness boleh dilakukan bila mempertahankan pemeriksaan perilaku; jika perlu perubahan produk, hentikan deployment dan laporkan temuan untuk revisi terpisah.

Bekukan source/config setelah gerbang lulus. Build ulang harus menghasilkan hash yang sama dengan artefak yang diuji. Perbedaan dari ID acuan harus dijelaskan; perubahan source setelah QA memerlukan pengujian ulang yang relevan. Jangan menaikkan versi hanya agar tes lolos.

## 4. Urutan deployment — Hosting paling akhir

Jalankan hanya target yang dinyatakan perlu pada matriks tahap 1. Jangan menjalankan `firebase deploy` tanpa `--only`, dan jangan menggunakan `--force` untuk melewati penghapusan indeks atau konflik konfigurasi.

### A. Firestore indexes

```powershell
firebase deploy --project admin-kelas-3a --only firestore:indexes
if ($LASTEXITCODE -ne 0) { throw 'Deploy indeks gagal' }
```

Pastikan indeks live tambahan tidak dihapus. Jika CLI mengusulkan penghapusan, batalkan operasi itu dan rekonsiliasi konfigurasi secara non-destruktif. Tunggu kedua indeks yang diperlukan sampai **READY/Enabled** di console/API. CLI selesai upload belum berarti backfill indeks selesai. Jika masih Building atau Error, jangan melanjutkan Hosting.

### B. Cloudflare Worker

Pastikan revisi Worker kompatibel dengan frontend lama dan baru. Jika belum terpasang live, jalankan dari root dengan CLI Wrangler yang versinya sudah ditetapkan:

```powershell
wrangler deploy --config chat/edge/wrangler.jsonc --keep-vars
if ($LASTEXITCODE -ne 0) { throw 'Deploy Worker gagal' }
```

Verifikasi Worker yang sama menerima versi baru, bindings/vars/secrets tetap tersedia, origin benar, dan route yang benar memberikan respons yang sesuai kontrak. Jangan menganggap 404 pada `/` gagal: source tidak menyediakan endpoint health di `/`. Jangan mengirim push atau memicu operasi mutasi untuk smoke test produksi. Catat version/deployment ID.

### C. Firestore rules

Setelah uji izin lulus, terbitkan rules jika berbeda dari live:

```powershell
firebase deploy --project admin-kelas-3a --only firestore:rules
if ($LASTEXITCODE -ne 0) { throw 'Deploy rules Firestore gagal' }
```

Verifikasi ruleset aktif dan tetap kompatibel dengan tab versi lama. Jangan melonggarkan rules untuk menutupi kegagalan aplikasi.

### D. RTDB rules — bersyarat

Default **SKIP** karena tidak ada revisi RTDB baru pada tahap ini. Hanya jika matriks membuktikan rules live belum memiliki kontrak rilis yang diperlukan, uji rules tersebut dahulu dan deploy target `database` secara terpisah dengan project eksplisit. Jangan menimpa aturan cloud hanya karena nama file lokal tersedia.

### E. Firebase Hosting

Pastikan seluruh dependensi backend siap dan validasi manifest terakhir lulus:

```powershell
firebase deploy --project admin-kelas-3a --only hosting
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting gagal' }
```

`firebase.json` mempunyai hook predeploy yang menjalankan build ulang. Pertahankan source/environment build yang sama; periksa manifest setelah hook/deploy tetap sama dengan artefak yang diuji. Jangan menghapus hook. Catat URL dan release/version ID dari hasil aktual CLI.

## 5. Verifikasi live dan pembaruan PWA

- Ambil build-manifest, runtime-config, sw.js, HTML dashboard serta aset LPS baru langsung dari jaringan. Cocokkan versi 4.6.9 dan hash artefak live dengan manifest lokal; verifikasi file yang dirilis, bukan hanya teks versi.
- Unduh kedua template acuan dari Hosting dan cocokkan SHA-256 dengan root. Pastikan JS/CSS baru dan library ZIP tersedia dengan content type yang sesuai; tidak ada 404/CSP error.
- Verifikasi UI template menggunakan lingkungan uji terisolasi; jangan menyimpan penilaian sintetis ke database sekolah. Hasil mock tetap diberi label mock.
- Uji profil browser baru dan profil uji yang masih memakai SW rilis lama. Pastikan draft tidak hilang, pembaruan tidak memaksa reload saat mengisi form, dan setelah semua tab lama ditutup lalu aplikasi dibuka lagi SW/cache baru aktif. Jangan menyuruh pengguna menghapus IndexedDB, cache, atau kunci enkripsi Chat sebagai prosedur upgrade normal.
- Verifikasi offline setelah instalasi cache selesai, serta respons online kembali. Bedakan cache versi lama yang masih dipakai tab aktif dari kegagalan deployment.
- Pemeriksaan read-only produksi tidak membuktikan autentikasi, simpan, media/push atau seluruh fitur telah lulus end-to-end. Catat bagian yang belum diuji secara jujur.

## 6. Kegagalan dan rollback

Jika tahap backend gagal, jangan deploy Hosting. Jika frontend baru gagal setelah terbit, pulihkan release Hosting sebelumnya yang ID-nya sudah dicatat, tanpa reset data. Rollback Worker hanya ke version ID yang diketahui cocok jika Worker memang menjadi sumber kegagalan; jangan rollback backend yang masih dibutuhkan tab frontend baru. Indeks tambahan yang kompatibel tidak perlu dihapus saat rollback frontend. Rules hanya dipulihkan ke ruleset terdahulu yang telah diperiksa, bukan rules terbuka. Rollback server tidak otomatis mengganti SW yang masih aktif di perangkat; verifikasi dampaknya dan jelaskan prosedur pemulihan tanpa menghapus data lokal.

## 7. Laporan akhir

Buat `DEPLOYMENT_REPORT_4.6.9.md` di root: waktu WIB, target/account/project terverifikasi, versi CLI, hasil QA beserta hash build, target yang deploy/skip dan alasannya, kesiapan indeks, IDs Worker/rules/Hosting, URL live, hasil hash aset dan template, pemeriksaan SW/offline, kendala aktual dan status rollback bila ada. Nyatakan tidak ada migrasi/write data uji produksi, pengiriman pesan/push, atau pembuatan APK. Bedakan **deployment berhasil** dari **seluruh fitur produksi terverifikasi**; jangan mengklaim UX 9/10 atau 10/10.

Referensi resmi untuk memastikan sintaks sesuai CLI yang dipakai:

- Firebase partial deploy: https://firebase.google.com/docs/cli
- Status pembangunan indeks: https://firebase.google.com/docs/firestore/query-data/indexing
- Wrangler deploy/keep-vars: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Rollback Worker: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
