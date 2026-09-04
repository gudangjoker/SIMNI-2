# MASTER CONTEXT ANTIGRAVITY — SIMNI-GADM v4.6.4

## 1. Kedudukan tugas

Lanjutkan rekonstruksi dari root berikut, bukan dari ZIP, folder `public`, salinan lama, atau deployment live:

`C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`

Source pada checkpoint ini **belum boleh dinyatakan siap produksi**. Deployment tidak termasuk tahap rekonstruksi dan pengujian. Jangan melakukan deploy sebelum seluruh acceptance gate pada dokumen ini lulus dan pengguna memberikan perintah deploy terpisah.

Target release berikutnya adalah `4.6.4`. Source masih memakai version authority `4.6.3`; bump versi, build final, laporan, checksum, dan paket release belum dikerjakan.

## 2. Aturan rekonstruksi mutlak

1. Perbaiki akar masalah pada source yang memiliki logika tersebut. Dilarang menambahkan fallback, lapisan kompatibilitas, timer, reload halaman, duplicate handler, atau jalur alternatif untuk menyamarkan bug.
2. Jangan membuat implementasi berdasarkan asumsi. Baca handler, state, repository, listener realtime, access policy, fragment loader, dan DOM yang benar-benar dipakai sebelum mengubah kode.
3. Jangan menghapus atau mengubah data Firebase produksi. Semua pengujian tulis memakai mock, emulator, atau fixture lokal terisolasi.
4. Jangan mengubah Firebase project, billing, Cloudflare plan, atau Cloudinary plan. Semua layanan wajib tetap free tier. Jangan mengaktifkan Functions, Extensions, App Hosting berbayar, Blaze, atau layanan berbayar lain.
5. Hanya ada dua role aplikasi: `superuser` dan `vip`. Istilah guru dalam nama fitur, label profesi, catatan guru, jurnal guru, atau konten pedagogis bukan role dan tidak boleh dihapus.
6. Data SIMNI tetap role/workspace/year scoped. VIP hanya mengelola PJOK. Jangan merusak isolasi workspace Superuser dan VIP.
7. Chat tetap memakai backend dan kontrak yang sudah ada. Jangan memindahkan data chat, mengubah kriptografi, atau mengganti arsitektur chat dalam tugas ini.
8. Pertahankan mock login Superuser khusus QA. Mock tidak boleh masuk ke build hosting atau menjadi jalur autentikasi produksi.
9. Dilarang mengubah assertion atau menurunkan keketatan tes hanya agar hasil menjadi PASS. Assertion hanya boleh diubah jika kontrak bisnis tertulis berubah; perubahan tersebut harus dijelaskan dalam laporan.
10. Dilarang menyebut source siap produksi apabila ada satu FAIL, satu unhandled exception, satu console error relevan, satu request aset gagal, satu acceptance scenario belum diuji, atau hasil pengujian tidak dapat direproduksi.

## 3. Permintaan bisnis yang wajib dituntaskan

### A. Konfirmasi setiap penyimpanan

Setiap aksi simpan yang berhasil harus memenuhi seluruh kontrak berikut:

- Tunggu commit storage/database berhasil; jangan menampilkan sukses sebelum promise commit selesai.
- Tampilkan toast sementara berikon centang dengan teks yang jelas mengandung `Berhasil disimpan`.
- Toast hilang otomatis dan aksesibel melalui `role=status` serta `aria-live=polite`.
- Rekonsiliasi state lokal berdasarkan payload yang benar-benar berhasil di-commit.
- Render ulang view terkait tanpa `location.reload()`.
- Kegagalan commit tidak boleh mereset form, menutup modal, atau menampilkan sukses.
- Tombol harus aman dari double-submit selama operasi berjalan.

Cakupan minimal: Tambah/Edit Siswa, Tulis Catatan, Tambah TP, Simpan Nilai, Edit Nilai, Simpan/Edit Kehadiran, Simpan Jurnal, Simpan Jadwal, Simpan Identitas, Simpan Tema, Simpan Draft/Template LPS, Simpan Dokumen GADM, dan setiap tombol lain yang label atau fungsinya merupakan penyimpanan.

Khusus Tambah Siswa: setelah commit, modal ditutup, form dibersihkan, toast muncul, dan kartu siswa baru langsung terlihat bersama data lama tanpa browser reload.

### B. Status TP pada Input Nilai

- Setelah Mapel dipilih, dropdown TP harus menampilkan TP yang sesuai role dan mata pelajaran.
- TP tanpa nilai tetap aktif.
- TP parsial tetap aktif dan diberi indikator `Belum lengkap (x/y)`.
- TP dianggap selesai hanya jika setiap siswa aktif pada kelas/workspace aktif mempunyai nilai numerik valid untuk TP tersebut.
- TP selesai diberi indikator `Sudah dinilai`, dibuat disabled, dan tampil abu-abu menggunakan state native/aksesibel.
- Nilai kosong pada penyimpanan batch tidak boleh menghapus nilai lama secara diam-diam.
- Listener realtime yang datang setelah commit tidak boleh membuat pilihan selesai aktif kembali atau menggandakan record.

### C. Edit Nilai dari Rekap

- Setiap row Rekap Nilai yang memiliki nilai mempunyai tombol `Edit Nilai`.
- Edit dilakukan untuk pasangan siswa dan TP yang tepat.
- Validasi nilai wajib 0–100.
- Sukses hanya setelah database commit.
- Setelah sukses, row kembali ke mode baca dan angka baru terlihat tanpa reload.
- Update tidak boleh membuat record nilai ganda, mengubah nilai siswa lain, atau menulis workspace lain.

### D. Form siswa pada Input Nilai

- Setelah Mapel dan TP valid dipilih, nama seluruh siswa aktif serta input nilai muncul otomatis di bawah filter.
- Urutan siswa alfabetis dan hanya dari kelas/workspace aktif.
- Empty state hanya tampil sebelum pilihan lengkap atau jika kelas memang tidak memiliki siswa.
- VIP hanya dapat memilih PJOK.

### E. State selesai Presensi

- Setelah seluruh presensi pada tanggal aktif berhasil disimpan, toast sukses muncul.
- Tabel input disembunyikan dan diganti teks persis `Presensi sudah dilakukan`.
- Tombol berubah menjadi `Edit Kehadiran`.
- Menekan `Edit Kehadiran` membuka kembali data tersimpan; tombol menjadi `Simpan Perubahan`.
- Setelah perubahan berhasil disimpan, view kembali ke state selesai.
- Perubahan tanggal membatalkan mode edit tanggal lama dan merender state tanggal baru secara deterministik.

## 4. Perubahan yang sudah ada pada checkpoint

Jangan menulis ulang perubahan berikut sebelum mengaudit kebenarannya:

- `js/ui/feedback.js`: toast success/error/warning/info sekarang membuat ikon dan atribut live-region.
- `features/students/students.js`: submit siswa merekonsiliasi `state.students`, mengisi ulang dropdown, merender daftar/dashboard, dan menampilkan toast sukses.
- `features/notes/notes.js`: submit catatan membuat payload eksplisit, merekonsiliasi `state.catatan`, merender daftar, dan menampilkan toast sukses.
- `features/grades/grades.js`: sudah memiliki perhitungan siswa aktif, progress TP, TP parsial/lengkap, render siswa otomatis, batch save tanpa delete dari input kosong, dan edit nilai per row Rekap.
- `features/grades/grades.html`: tabel Rekap sudah memiliki kolom Aksi.
- `features/attendance/attendance.js`: sudah memiliki state selesai/edit per tanggal, local reconciliation, render ulang, dan toast sukses.
- `features/attendance/attendance.html`: sudah memiliki completed-state dan primary action yang berubah sesuai mode.
- `js/ui/actions.js`: `editPresensiManual` sudah masuk allowlist action.
- `features/journal/journal.js`: jadwal dan jurnal sudah merekonsiliasi state serta memberi toast sukses.
- `features/gadm/gadm.js` dan `features/lps/lps.js`: teks sukses penyimpanan sudah diperjelas.
- `qa/e2e-ui-test.mjs`: sudah memiliki halaman fixture steril `/qa-workflow.html` agar tes bisnis tidak berlomba dengan bootstrap autentikasi.

## 5. Bukti checkpoint dan pekerjaan yang belum selesai

Bukti terakhir yang berhasil:

- `node --check` pada file fitur yang diubah: PASS.
- `node qa/e2e-ui-test.mjs`: `58 PASS, 0 FAIL`.
- Skenario E2E yang baru lulus: render siswa setelah Mapel/TP; TP parsial; TP selesai disabled; edit nilai dari Rekap; state Presensi selesai/edit; Tambah Siswa; Tulis Catatan; toast centang.

Pekerjaan belum selesai:

- Seluruh suite `npm run verify` belum dijalankan setelah perubahan terakhir.
- Audit semua tombol simpan di luar fixture baru belum dituntaskan.
- Uji mobile 390×844 untuk lima skenario baru belum dibuktikan dengan screenshot.
- Uji double-submit, commit gagal, listener out-of-order, dan state realtime setelah commit belum lengkap.
- Version authority belum dinaikkan ke `4.6.4`.
- `public` terakhir dibangun sebagai `4.6.3`, sehingga bukan artefak release final.
- Laporan forensik `4.6.4`, runbook deploy final, ZIP release, daftar isi ZIP, dan SHA-256 belum dibuat.
- Paket `4.6.3` yang lama tidak boleh dipakai untuk deploy release ini.

## 6. Konfigurasi build publik yang diizinkan

Gunakan hanya nilai publik yang sudah menjadi kontrak source:

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
```

Nilai tersebut bukan secret server. Jangan mencetak, mencari, menyalin, atau memasukkan Firebase service-account key, Cloudinary API secret, Cloudflare API token, atau kredensial pengguna ke laporan maupun paket.

## 7. Definition of done

Rekonstruksi baru selesai jika:

1. Seluruh acceptance scenario pada bagian 3 lulus di desktop dan viewport 390×844.
2. Failure-path, double-submit, dan out-of-order listener lulus.
3. `npm run verify:dependencies` lulus.
4. `npm run verify` lulus serial tanpa satu FAIL.
5. Build bersih `4.6.4` lulus dan source/public/cache/manifest/dashboard sinkron.
6. Tidak ada mock, secret, screenshot sementara, data fixture, browser profile, server QA, atau hasil ekspor tes di artefak hosting.
7. ZIP dibangun dari source release yang sama, diverifikasi isinya, dan SHA-256 dicatat.
8. Laporan mencantumkan command, exit code, jumlah PASS/FAIL, temuan, koreksi file/baris, dan batas pengujian.
9. Antigravity hanya menyiapkan prosedur deploy; jangan menjalankan deploy sampai pengguna memberikan perintah eksplisit.

