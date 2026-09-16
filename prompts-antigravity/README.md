# Prompt SIMNI — satu tahap per perintah

Kirim hanya satu prompt pada satu waktu. Setiap berkas memuat aturan kerja bersama dan instruksi berhenti setelah tahapnya selesai. Baca laporan hasil tahap, lalu kirim prompt berikutnya bila siap. Jangan menempelkan seluruh berkas sekaligus.

| Urutan | Prompt | Hasil utama |
|---|---|---|
| 0 | [Baseline dan rencana](00_BASELINE_DAN_RENCANA.md) | Peta dependensi, baseline uji lokal, checkpoint; tanpa revisi source aplikasi. |
| 1 | [Backup dan pemulihan](01_BACKUP_DAN_PEMULIHAN.md) | Ekspor, impor, arsip dan verifikasi ukuran konsisten. |
| 2 | [Aksi, loading dan draf](02_AKSI_LOADING_DAN_DRAF.md) | Satu pemilik aksi/loading; draf lokal persisten, kirim manual saat online. |
| 3 | [Kapasitas database](03_KAPASITAS_DATABASE.md) | Pembacaan terukur tanpa laporan dari data parsial. |
| 4 | [Validasi server dan audit](04_VALIDASI_SERVER_DAN_AUDIT.md) | Kontrak server dan audit terpercaya, diuji lokal. |
| 5 | [Retensi dan backup lintas subsistem](05_RETENSI_DAN_BACKUP_LENGKAP.md) | Inventaris penyimpanan dan cakupan pemulihan yang jelas. |
| 6 | [Pemuatan fitur](06_PEMUATAN_FITUR.md) | Runtime dimuat saat diperlukan tanpa duplicate handler. |
| 7 | [Audit integrasi final](07_AUDIT_INTEGRASI_FINAL.md) | Regresi gabungan, build lokal dan laporan; tidak deploy. |

Semua tahap mengharuskan audit statis ulang sebelum tes, tes dampak terkait sebelum checkpoint, serta pemeriksaan status tahap sebelumnya. Proses ini mengurangi risiko efek domino; tidak menjamin nol bug. Jika tahap gagal, selesaikan dalam scope tersebut dan jangan lanjut otomatis.

## Pilihan model — diperbarui 12 September 2026

Rekomendasi utama: **Gemini 3.8 Flash**, gunakan tingkat penalaran High/tinggi jika pilihan tersebut tersedia. Antigravity menyatakan model ini tersedia dan thinking level dapat disesuaikan. [Sumber resmi Antigravity](https://www.antigravity.google/blog/gemini-3-8-flash-in-google-antigravity)

Google memperkenalkan Gemini 3.8 sebagai peningkatan coding/reasoning dan pekerjaan agen jangka panjang. Hal ini mendukung penggunaannya untuk implementasi bertahap SIMNI. Rekomendasi tersebut adalah penilaian untuk tugas ini; bukan klaim hasil benchmark langsung SIMNI atau bahwa 3.8 menang dalam setiap tugas dibanding 3.1 Pro. [Pengumuman Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/)

Gemini 3.1 Pro High tetap dapat digunakan bila 3.8 tidak tersedia atau untuk pendapat kedua pada diff sulit. Label Pro saja tidak membuktikan keunggulan atas Flash generasi baru. Tidak perlu mengganti model pada setiap tahap jika 3.8 memenuhi kontrak dan gerbang pengujian.

Dokumen gabungan lama di root telah ditandai sebagai rencana, bukan perintah menjalankan semua tahap. Gunakan prompt terpisah dalam folder ini.
