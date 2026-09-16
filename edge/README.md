# Layanan aset SIMNI

Source ini dipisahkan dari modul Chat pada kandidat 4.7.1. Hanya menyediakan `POST /v1/cloudinary/sign` dan `POST /v1/cloudinary/delete` dengan verifikasi token Firebase, profil RTDB, origin, peran dan scope aset. Tidak memiliki Firestore, FCM, R2 Chat, sinkronisasi keanggotaan atau tugas pembersihan pesan.

**Belum dideploy.** Nama Worker baru pada `wrangler.jsonc` adalah `simni-assets-gateway` agar deployment berikutnya tidak menimpa layanan Chat yang akan dipisah. Source aplikasi masih memakai endpoint lama yang juga menyediakan Cloudinary. Nama endpoint tersebut mengandung `chat`, tetapi SIMNI hanya memanggil dua route Cloudinary di atas.

Setelah layanan aset baru disiapkan dan diverifikasi secara terpisah, isi `SIMNI_EDGE_URL` saat build, kemudian ulangi verifikasi artefak dan regresi yang terpengaruh. Jangan mengganti URL dengan alamat yang belum tersedia.

Environment yang diperlukan: `SIMNI_ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`. Rahasia tetap berada di konfigurasi layanan, bukan source maupun Hosting. Preset Cloudinary harus membatasi format dan ukuran di sisi penyedia.

Pengujian lokal: `node qa/asset-worker-regression.mjs`. Seluruh permintaan jaringan dalam pengujian ini diganti respons lokal; token ditandatangani dengan pasangan kunci sementara. Ini tidak membuktikan konfigurasi layanan produksi telah diterapkan.
