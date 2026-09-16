# Runbook rilis SIMNI 4.7.2

Status: kandidat lokal; deployment ditahan sesuai instruksi menyelesaikan S07, S02, dan S05 terlebih dahulu. Jangan memakai urutan Hosting saja dari versi sebelumnya.

## Urutan rilis

1. Periksa laporan `AUDIT_PENUTUPAN_3_TEMUAN_4.7.2_2026-09-14.md` dan `test-output/three-findings/final-evidence.json`. Jalankan `node scripts/verify-hosting.mjs`; cocokkan build ID dengan laporan. Simpan salinan rilis produksi, rules, konfigurasi Worker, dan backup data terverifikasi sebelum perubahan cloud.
2. Jeda tindakan administratif kedua akun (restore, arsip, reset, pergantian tahun). Pastikan semua tab/PWA lama ditutup sebelum tindakan tersebut dipakai kembali. Rules baru menolak penulisan audit dari klien lama; klien lama bisa sudah mengubah data lalu gagal menulis audit.
3. Terbitkan **Worker SIMNI baru** dari `edge/wrangler.jsonc`, bernama `simni-assets-gateway`. Jangan menimpa Worker Chat. Siapkan `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SIMNI_ALLOWED_ORIGINS`, dan konfigurasi Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`) pada layanan baru. Simpan kunci sebagai secret, bukan di Hosting atau laporan. Service account harus dapat membaca profil serta menulis reservasi dan receipt RTDB; perubahan data pengguna menggunakan Firebase ID token pengguna dan tetap mengikuti rules.
4. Pastikan URL Worker hasil rilis sama dengan meta `simni-edge-url` di artefak. Kandidat memakai `https://simni-assets-gateway.2ndgoal.workers.dev` sebagai **target**, bukan bukti bahwa endpoint sudah aktif. Jika URL berbeda, atur `SIMNI_EDGE_URL`, bangun ulang, dan ulangi pemeriksaan terdampak; jangan mengedit `public/` secara manual. Validasi route `/v1/admin/commit`, `/v1/admin/status`, dan route Cloudinary di staging/mock terlebih dahulu. Verifikasi batas resource Worker untuk ukuran backup nyata sebelum membuka restore besar di produksi.
5. Deploy hanya rules RTDB yang telah diuji, ke project eksplisit `admin-kelas-3a`: `firebase deploy --only database --project admin-kelas-3a`. Rules menutup write `auditLogs` dan akses klien ke `administrativeOperations`; marker commit memiliki izin terbatas. Tidak ada deployment Firestore/Chat.
6. Setelah Worker dan rules tersedia, deploy Hosting dari artefak yang telah diverifikasi: `firebase deploy --only hosting --project admin-kelas-3a`. Hook pra-deploy memverifikasi artefak dan tidak membangun ulang. Langkah 3, 5, dan 6 belum dijalankan dalam penyelesaian tiga temuan ini.
7. Baca manifest produksi dan cocokkan build ID, versi dashboard, serta SW. Buka kembali PWA setelah tab lama ditutup. Aktifkan kembali tindakan administratif setelah versi baru terkonfirmasi. Uji tulis cloud harus menggunakan lingkungan/data yang disetujui; hasil mock bukan izin melakukan reset produksi.

## Kegagalan dan rollback

- Respons sukses administratif memerlukan receipt server. Jika status `pending`, pertahankan operation ID. Retry memeriksa reservasi yang sama; jangan menghapus Web Storage atau mengganti ID agar operasi bisa dipaksa berjalan lagi.
- Data dan marker nonce dikirim dalam satu PATCH. Jika acknowledgement/receipt hilang, server dapat memulihkan receipt dari marker yang cocok tanpa mengulang perubahan. Jika tidak ada marker yang dapat membuktikan commit, status tetap belum pasti dan perlu pemeriksaan operator. Tidak ada replay otomatis terhadap hasil yang belum diketahui.
- Receipt dan penyelesaian reservasi merupakan PATCH server berikutnya; seluruh proses bukan satu transaksi tunggal lintas dua identitas. Kegagalan langkah kedua tidak boleh ditampilkan sebagai sukses palsu.
- Jangan membuka kembali write audit klien saat rollback. Kandidat lama 4.7.1 dapat tetap dipakai untuk fitur akademik, tetapi tindakan administratifnya tidak kompatibel dengan rules audit baru. Perbaikan maju pada klien atau mode pemeliharaan administratif lebih aman daripada mengembalikan celah audit.
- Jangan memulihkan seluruh database atau menghapus cache pengguna untuk mengatasi regresi tampilan. Arsip baseline lokal 4.7.0 memuat Chat dan bukan target rollback produksi yang otomatis disetujui.

## Batas hasil lokal

Dry-run Wrangler 4.131.1 berhasil membundel Worker (59,17 KiB; gzip 15,21 KiB), tanpa deployment. Arsip baru memakai `json-chunks-v1` agar objek kosong, array, dan key numerik tidak diubah oleh penyimpanan RTDB; pembaca baru tetap menerima arsip object versi lama. Pengujian Firebase memakai emulator dan identitas sintetis. Kredensial, kapasitas/CPU layanan cloud, perangkat fisik/APK, dan soak jangka panjang belum disertifikasi oleh hasil ini.
