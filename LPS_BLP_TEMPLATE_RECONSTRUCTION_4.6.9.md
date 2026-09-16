# Template LPS/BLP 4.6.9

Permintaan: pilihan template bawaan sesuai workbook root, dapat diedit guru, serta hasil unduh yang terverifikasi.

## Temuan dan audit source sebelum pengujian

- Workbook `LPS KLS 2 contoh.xlsx` dan `BLP contoh.xlsx` sudah tersedia dan disalin ke hosting; pilihan template hanya menginventaris template tersimpan sehingga bawaan tidak muncul.
- Editor sudah menyediakan ubah/tambah/hapus/urut bagian, aspek dan butir, tetapi ekspor lama mencari nama teks pada workbook asli. Nama atau struktur yang diedit dapat membuat ekspor gagal.
- BLP contoh memiliki dua blok catatan guru; form lama hanya menyimpan satu.
- Duplikasi ExcelJS lama membuktikan salinan konsisten dengan salinan lain, bukan seluruh OOXML identik dengan root. Pustaka dapat menormalisasi styles, page breaks dan metadata printer.

Revisi menambahkan dua pilihan bawaan dengan salinan editable, dua tautan unduh acuan asli, blok catatan BLP kedua, dan ekspor melalui bagian OOXML workbook asli. Struktur bawaan mempertahankan layout native; struktur yang diubah menghasilkan baris mengikuti template guru tanpa menghilangkan isian. Nilai siswa, semester, tanggal, catatan dan identitas sekolah memang harus menggantikan data contoh.

Audit source memeriksa pemetaan berdasarkan ID stabil, encoding teks XML agar isian tidak menjadi formula, pemeriksaan hash acuan, validasi integritas final sebelum ekspor, dan penguncian tombol selama pustaka dimuat. Template lama dan snapshot laporan final tidak dimigrasikan secara paksa.

Uji pertama juga menemukan klik tombol submit template dibatalkan handler lokal sebelum dispatcher formulir. Handler kini menyerahkan submit kepada pemilik formulir deklaratif.

## Hasil akhir — 10 September 2026

Rekonstruksi lokal selesai pada build **4.6.9**, ID `1c3b13cbb62c0bc331667f70f9120b4e8012c485fc33db9b1fcc5f2e2b839fe1`. Tidak ada deploy atau perubahan database produksi. Pengujian menggunakan login dan database mock di localhost, dua siswa sintetis, serta pemblokiran permintaan keluar.

### Checklist permintaan

- [x] Dua pilihan **Template LPS — sesuai contoh** dan **Template BLP — sesuai contoh** tersedia dalam **Pilih Template → Template bawaan siap pakai**. Jenis yang dapat digunakan mengikuti periode LPS/BLP yang dipilih di halaman utama; pilihan jenis lain tetap terlihat dengan petunjuk untuk mengganti jenis laporan.
- [x] Guru menerima isian siap pakai: 8 aspek LPS dan 7 aspek BLP beserta semua butir acuan; tidak perlu menyusun dari kosong.
- [x] Nama bagian/aspek, kriteria, tipe isian, detail, dan butir dapat diedit. Bagian/aspek/butir dapat ditambah, dihapus dan diurutkan. Penyimpanan membuat versi template; template bawaan dan snapshot final lama tetap dipertahankan.
- [x] Tautan **Unduh Acuan LPS** dan **Unduh Acuan BLP** menghasilkan file **identik byte demi byte** dengan kedua contoh di root. File root tidak diubah.
- [x] Ekspor struktur bawaan mempertahankan seluruh atribut baris/kolom/sel, merge, margin, page setup, page break dan properti worksheet di luar isi sel. Styles, theme, logo, drawing, dan data printer identik byte demi byte dengan acuan. Ini diperiksa pada kedua sheet siswa di setiap output bawaan dan output dengan perubahan nama saja.
- [x] Data siswa, nilai, detail, deskripsi, tahun pelajaran, semester, tanggal, dan identitas sekolah menggantikan contoh pada lokasi yang sesuai. Seluruh 50 tanda pilihan LPS dan 26 tanda pilihan BLP cocok dengan pilihan mock, tanpa tanda contoh tersisa pada kolom lain.
- [x] Dua catatan guru BLP serta tanggapan orang tua tersimpan dan muncul di workbook.
- [x] Perubahan nama tidak memutus pemetaan ekspor. Penambahan/penghapusan/perubahan urutan butir, penambahan bagian/aspek, kriteria baru, dan isian teks muncul dalam hasil unduh.
- [x] Editor diperiksa pada lebar 320, 390, dan 1366 px, masing-masing mode terang/gelap: tidak ada overflow horizontal atau pelanggaran WCAG yang ditemukan axe pada konteks modal yang diuji.
- [x] Unduh XLSX offline berhasil setelah cache PWA terpasang. Seluruh bagian workbook offline sama dengan workbook online untuk laporan yang sama.
- [x] Hash final yang tidak valid ditolak; tidak ada uncaught browser error atau permintaan eksternal dalam pengujian ini.
- [x] Build, package, lockfile, runtime, manifest, dan cache memakai versi 4.6.9. Seluruh 117 hash file valid, 62 berkas JavaScript lolos pemeriksaan sintaks, dan tidak ada mock/QA/test-output yang masuk public.

### Batas pengertian “100% identik”

File **acuan asli** benar-benar identik secara biner dengan root. File **hasil laporan** mempertahankan struktur dan format asli yang diuji, tetapi isinya memang harus berubah mengikuti siswa dan penilaian guru; file hasil bukan salinan biner seluruh workbook contoh. Ubah nama saja tetap memakai geometri asli. Jika guru menambah/menghapus/mengurutkan bagian, aspek, butir atau mengganti struktur kriteria, exporter membangun area penilaian mengikuti struktur baru sambil mempertahankan kop, aset, kolom dan pengaturan halaman acuan. Geometri setelah perubahan struktur tentu tidak lagi sama dengan contoh awal.

Editor ini mengubah isi dan struktur penilaian; ia bukan editor bebas untuk setiap properti format Excel seperti posisi logo atau ukuran kolom. Teks sangat panjang pada struktur bawaan tetap mengikuti dimensi sel asli; guru perlu memeriksa hasil cetak untuk isi di luar panjang wajar. Verifikasi visual dilakukan melalui renderer spreadsheet, bukan cetak fisik atau menjalankan Microsoft Excel pada setiap perangkat. Pratinjau HTML aplikasi tetap merupakan pratinjau responsif; bukti kesamaan native dalam laporan ini berlaku untuk file XLSX.

### Temuan tambahan yang diperbaiki saat verifikasi

1. Tombol **Simpan Versi Template** sebelumnya dibatalkan listener lokal sebelum dispatcher submit; kini submit memiliki satu pemilik.
2. Menghapus lalu mengurutkan butir dapat menggunakan ID yang sudah dipakai oleh butir lain. Pemetaan sekarang mempertahankan kecocokan label terlebih dahulu dan hanya memakai ID yang belum terpakai.
3. Token warna dan field editor sebelumnya hanya terpasang pada modul utama, sehingga modal editor kehilangan border/background. Scope token diperluas ke modal; kontras teks petunjuk mode gelap juga diperbaiki.
4. Acuan LPS mencampur font normal dan Wingdings pada kotak pilihan. Simbol centang sekarang dipilih berdasarkan font sel tujuan, sehingga tidak berubah menjadi huruf “ü”.

### Bukti pengujian

| Pemeriksaan | Hasil | Bukti |
|---|---:|---|
| Alur browser dan unduhan nyata melalui mock | 15 PASS / 0 FAIL | `test-output/lps-template-fidelity/workflow-results.json` |
| Kontrak LPS/BLP empat periode | 42 PASS / 0 FAIL | `node qa/lps-contract-regression.mjs` |
| OOXML, data isian, aset, edit guru, dan offline | 27 PASS / 0 FAIL | `test-output/lps-template-fidelity/native-fidelity-results.json` |
| Hash, versi, sintaks dan pemisahan hosting | PASS | `test-output/lps-template-fidelity/final-artifact-audit.json` |
| Render visual header, seluruh badan dan penutup | Diperiksa | `test-output/lps-template-fidelity/visual/` |

Hasil unduh acuan terisi tersedia di [LPS-reference-result.xlsx](test-output/lps-template-fidelity/LPS-reference-result.xlsx) dan [BLP-reference-result.xlsx](test-output/lps-template-fidelity/BLP-reference-result.xlsx). Contoh perubahan struktur yang lebih luas tersedia di `LPS-extended-result.xlsx` dan `BLP-extended-result.xlsx` dalam direktori yang sama. Semua berisi data sintetis.

Percobaan awal disimpan sebagai histori, bukan dihitung sebagai hasil akhir. Kegagalan pendeteksian unduh akibat nama file yang sama diperbaiki pada driver dengan GUID download; kegagalan offline pada percobaan modal yang masih terbuka diselesaikan dengan isolasi keadaan UI pada pengujian. Kedua hal ini dibedakan dari bug produk di atas.

### Cara menggunakan

1. Buka **LPS/BLP**, pilih periode LPS atau BLP yang dituju.
2. Buka pengaturan template, lalu **Pilih Template → Template bawaan siap pakai → Template LPS/BLP — sesuai contoh**.
3. Klik **Gunakan Template**, sesuaikan bila perlu, lalu **Simpan Versi Template**.
4. Pada laporan yang sudah mempunyai snapshot versi lama, gunakan tindakan untuk memakai template aktif jika ingin menerapkan versi baru. Laporan final perlu dibuka sebagai revisi terlebih dahulu.
5. Isi penilaian dan catatan, simpan, lalu unduh Excel. Unduhan acuan asli juga tersedia langsung di editor.

Tidak ada perbaikan tambahan yang masih terbuka dari skenario LPS/BLP yang diuji di atas. Batas verifikasi dan perbedaan geometri setelah edit struktur tetap berlaku. Pekerjaan ini belum dipublikasikan ke hosting atau APK.
