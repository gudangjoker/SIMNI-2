# Laporan Rekonstruksi dan QA GADM — SIMNI v4.6.2

## Status

- Versi source, manifest, runtime, dan Service Worker: `4.6.2`.
- Status build hosting: `PASS`.
- Status seluruh gerbang QA: `587 PASS, 0 FAIL`.
- Deployment: belum dilakukan.
- Mock Superuser: dipertahankan hanya di fixture QA dan tidak masuk output `public`.

## Rekonstruksi UI dan Alur Kerja

1. GADM dihapus dari navigasi desktop dan navigasi bawah ponsel.
2. GADM tersedia tepat satu kali melalui Aksi Cepat Dashboard untuk Superuser dan VIP.
3. Form ponsel memakai alur empat langkah dengan pemilih `Form/Hasil` yang sticky di bawah appbar GADM dan tidak bertabrakan dengan navigasi SIMNI.
4. Setelah dokumen dibuat, posisi scroll dikembalikan ke bagian atas hasil. Tombol aksi dan judul dokumen langsung terlihat.
5. Tombol `Buat Dokumen Baru` mengosongkan state dokumen, kembali ke formulir, dan menonaktifkan ekspor sampai hasil baru valid.
6. Nama guru memakai nama profil SIMNI bila tersedia dan tetap dapat diedit manual. Email tidak dipakai sebagai nama guru.
7. Superuser memilih mata pelajaran melalui dropdown. VIP dikunci ke PJOK oleh policy bersama SIMNI.
8. CP dan TP dipisahkan secara semantik. CP resmi atau input manual berada pada field tersendiri; TP saran GADM berada pada field editable dan memerlukan keputusan guru.
9. Pratinjau memakai struktur administrasi guru yang operasional: identitas, landasan kurikulum dan tujuan, kesiapan/konteks, desain, pengalaman belajar, langkah pembelajaran, asesmen, profil lulusan, diferensiasi/tindak lanjut, serta pengesahan.
10. Prota, Promes, Silabus/ATP, Modul Ajar, dan Deskripsi Kokurikuler memiliki identitas dan blok pengesahan yang konsisten.

## Corpus Kurikulum

### CP Nonagama

- Sumber: Keputusan Kepala BSKAP Nomor `046/H/KR/2025`.
- URL resmi: `https://kurikulum.kemendikdasmen.go.id/file/1753929861_manage_file.pdf`.
- SHA-256 sumber: `F8E5F478DE4DC1790BFC800104135F992C8FE6CB2D8F770F46B616932A2AEC34`.
- Corpus tertanam: 30 record fase SD yang telah diekstrak tanpa parafrasa.
- Cakupan: Pendidikan Pancasila, Bahasa Indonesia, Matematika, Bahasa Inggris, IPAS, Seni Musik, Seni Rupa, Seni Tari, Seni Teater, PJOK, serta Koding dan Kecerdasan Artifisial pada fase yang tersedia.
- GADM dapat memilih bagian CP yang relevan dengan topik tanpa mengubah teks sumber.

### CP Agama 2026

- Kemendikdasmen menyatakan CP yang berubah pada 2026 hanya Pendidikan Agama dan Budi Pekerti melalui Keputusan Kepala BKPDM Nomor `020/2026`.
- Siaran pers resmi: `https://www.kemendikdasmen.go.id/siaran-pers/15636-capaian-pembelajaran-baru-telah-terbit-yang-berubah-hanya-mata-pelajaran-agama-dan-budi-pekerti`.
- Salinan PDF yang tersedia berbentuk pindai. SHA-256 salinan audit: `598278746B0F62333FDCAB520D5DD4C1A9650C94BD3906ACFF4254100976552B`.
- Hasil OCR tidak ditanam sebagai teks resmi karena mengandung kesalahan karakter dan belum memenuhi verifikasi salinan per karakter.
- Runtime bersifat fail-closed: untuk mata pelajaran agama, GADM meminta guru memasukkan CP terverifikasi secara manual dan tidak mengklaim OCR sebagai teks kementerian.

### Integritas Provenance

- Tombol `Gunakan CP` menyimpan ID record corpus bersama teks CP.
- Engine memberi status `Record KB terverifikasi` hanya bila teks yang dipakai benar-benar terdapat dalam record resmi yang lolos validasi.
- Bila guru mengubah teks CP, ID provenance dibersihkan dan engine mengubah status menjadi input guru yang tidak diklaim sebagai salinan resmi.
- TP selalu diberi status saran GADM yang dapat diedit dan harus dikonfirmasi guru.

## Dasar Layout Dokumen

- Panduan Pembelajaran dan Asesmen 2025: `https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf`.
- Pengembangan kurikulum Kemendikdasmen: `https://kurikulum.kemendikdasmen.go.id/pengembangan-kurikulum`.
- Referensi struktur Prota/Promes: `https://repositori.kemendikdasmen.go.id/11319/1/000005-k13-ks-1-1-mod-sd-180331.pdf`.
- Referensi ATP operasional: `https://guru.kemendikdasmen.go.id/bukti-karya/pdf/359214`.

Implementasi mempertahankan format yang fleksibel, jelas, dan sederhana. GADM tidak menyatakan satu template sebagai formulir nasional wajib.

## Penyimpanan dan Isolasi

- GADM tidak membaca atau menulis Firebase.
- Dokumen dan draft disimpan di IndexedDB lokal.
- Scope penyimpanan terdiri dari UID, role, workspace, kelas aktif, dan tahun pelajaran.
- Data Superuser dan VIP tidak memakai key yang sama.
- GADM tetap dapat digunakan tanpa internet setelah asset masuk cache Service Worker.

## Ekspor

### Word

- File uji: `Modul Ajar Pembelajaran Mendalam.doc`.
- Ukuran uji: `10.550 byte`.
- Validasi: header HTML Word-compatible tersedia dan judul dokumen aktif terdapat dalam file.

### Excel

- File uji: `Modul Ajar Pembelajaran Mendalam.xlsx`.
- Ukuran uji: `29.820 byte`.
- Validasi: signature ZIP/XLSX valid dan workbook memuat sheet Ringkasan, Input, dan Hasil.

### PDF

- File uji: `modul_ajar_pembelajaran_mendalam.pdf`.
- Ukuran uji: `828.342 byte`.
- Jumlah halaman: 5.
- Validasi: signature `%PDF` valid, memiliki image objects per halaman, dan halaman pertama berhasil dirender secara visual.
- Koreksi produksi: variabel warna global `oklch()` dinormalkan hanya selama ekspor karena tidak didukung renderer PDF; state warna dikembalikan setelah selesai. Overlay renderer dibersihkan pada jalur sukses maupun gagal.

## Hasil QA

| Gerbang | Hasil |
|---|---:|
| Runtime sandbox dan role/workspace | 167 PASS |
| Chat query regression | 12 PASS |
| Chat audio regression | 17 PASS |
| Security contract | 74 PASS |
| GADM engine dan provenance | 13 PASS |
| Static/build/PWA contract | 208 PASS |
| E2E UI umum | 47 PASS |
| GADM mobile workflow | 49 PASS |
| **Total** | **587 PASS, 0 FAIL** |

## Skenario Ponsel yang Dieksekusi

1. Mock Superuser masuk langsung ke Dashboard.
2. GADM dibuka dari Aksi Cepat.
3. Modul Ajar IPAS topik Pancaindra dibuat memakai CP corpus dan TP saran yang dikonfirmasi.
4. Prota dibuat untuk distribusi dua semester.
5. Promes dibuat untuk distribusi minggu efektif semester 1.
6. Silabus/ATP operasional dibuat dari CP dan TP yang sama.
7. Deskripsi Kokurikuler dibuat dari evidence observasi.
8. Setiap hasil diperiksa terhadap tombol aktif, judul, posisi scroll, overflow horizontal, tab Form/Hasil, dan benturan navigasi.
9. Word, Excel, dan PDF benar-benar diunduh dari browser headless ponsel dan divalidasi sebagai file, bukan hanya event klik.
10. Tidak ditemukan error runtime GADM.

## Bukti QA yang Dapat Diregenerasi

- Fixture QA ponsel dipertahankan di `qa/gadm-mobile-workflow-test.mjs`.
- Menjalankan `npm run test:gadm-mobile` akan membuat ulang screenshot, ekspor Word/Excel/PDF, dan render validasi PDF di `test-output/gadm-mobile/`.
- Seluruh artefak hasil pengujian lokal telah dibersihkan setelah validasi final; source, fixture, mock Superuser, dan skrip QA tidak dihapus.

## Kesimpulan

Source SIMNI-GADM v4.6.2 dan output `public` lulus seluruh gerbang lokal. Tidak ada deployment yang dilakukan dalam rekonstruksi ini. Corpus CP Agama 2026 tetap diblokir dari klaim resmi sampai tersedia teks yang dapat diverifikasi per karakter; kebijakan ini mencegah halusinasi dan pencemaran dokumen guru.
