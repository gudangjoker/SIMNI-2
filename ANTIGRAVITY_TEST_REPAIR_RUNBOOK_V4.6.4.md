# RUNBOOK ANTIGRAVITY — PENGUJIAN DAN PERBAIKAN KETAT v4.6.4

## Mandat

Kerjakan di `C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`. Baca seluruh `ANTIGRAVITY_MASTER_CONTEXT_V4.6.4.md` sebelum menjalankan command. Jangan deploy. Jangan menyentuh dataset produksi. Jangan menyatakan siap produksi sebelum semua gerbang di bawah lulus.

## Gerbang 0 — Preservasi dan inventaris

1. Catat hash source kritis sebelum perubahan: `package.json`, `manifest.json`, `js/core/runtime-config.js`, `sw.js`, empat modul fitur, rules Firebase, dan seluruh QA.
2. Catat file yang sudah berubah pada checkpoint. Jangan mengganti root dengan ZIP atau `public`.
3. Pastikan proses QA lama pada port 4173, 4174, dan 4175 tidak hidup. Hentikan hanya proses yang command line-nya terbukti milik server QA root ini.
4. Pastikan tidak ada secret dalam source:

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!test-output/**' --glob '!public/**' '(BEGIN PRIVATE KEY|service[_-]?account|api_secret|CLOUDFLARE_API_TOKEN|FIREBASE_TOKEN)' .
```

Jika ditemukan secret, hentikan release, hapus dari source secara aman, rotasi melalui pemilik akun, dan dokumentasikan tanpa menyalin nilainya.

## Gerbang 1 — Audit implementasi, bukan tebakan

Untuk setiap permintaan bisnis, buat tabel traceability berisi:

- elemen HTML dan action;
- handler JavaScript;
- fungsi repository yang dipanggil;
- physical database path hasil resolver;
- state key yang diperbarui listener;
- fungsi render setelah commit;
- tes success path;
- tes failure path;
- tes role/workspace isolation.

Audit khusus:

1. Tidak ada `location.reload()` pada alur simpan fitur yang diminta.
2. Tidak ada `setTimeout` yang dipakai untuk menebak selesai commit.
3. Tidak ada toast sukses sebelum `result.ok === true`.
4. Tidak ada blank grade yang menghapus record lama.
5. Completion TP memakai seluruh siswa aktif dari kelas aktif, bukan jumlah record global.
6. Edit grade memakai ID siswa dan ID TP kanonik.
7. Completion Presensi memakai seluruh siswa aktif pada tanggal yang dipilih.
8. Local reconciliation idempotent saat listener realtime mengirim payload yang sama.
9. Selector dan render VIP tidak pernah mengekspos selain PJOK.
10. Semua dynamic action tercantum di allowlist dan tidak memakai inline handler.

Jika ada cacat, koreksi fungsi pemilik logika. Jangan membuat wrapper kompatibilitas atau handler kedua.

## Gerbang 2 — Unit/static contract

Jalankan serial:

```powershell
node --check features/students/students.js
node --check features/notes/notes.js
node --check features/grades/grades.js
node --check features/attendance/attendance.js
node --check features/journal/journal.js
node --check js/ui/feedback.js
node --check js/ui/actions.js
node --check qa/e2e-ui-test.mjs
npm run verify:dependencies
```

Tambahkan assertion ke QA untuk setiap kontrak yang belum memiliki bukti. Dilarang menguji hanya keberadaan string atau nama fungsi bila perilaku dapat dijalankan.

## Gerbang 3 — Matriks perilaku mock terisolasi

Gunakan fixture `/qa-workflow.html` pada `qa/e2e-ui-test.mjs`. Database mock harus mencatat path dan payload setiap write.

### Tambah siswa dan Catatan Guru

- commit sukses: state berubah satu kali, DOM langsung berubah, form reset, toast centang tampil;
- commit gagal: state/DOM/form tetap, toast error tampil, tidak ada toast sukses;
- double tap: hanya satu record dibuat;
- data lama tetap ada;
- NISN yang sama tidak membuat duplikasi.

### Input dan Rekap Nilai

- Mapel tanpa TP: empty state benar;
- Mapel + TP: seluruh siswa aktif muncul otomatis;
- 0/y dinilai: TP aktif;
- x/y dinilai: TP aktif dan label `Belum lengkap (x/y)`;
- y/y dinilai: TP disabled dan label `Sudah dinilai`;
- nilai 0 dan 100 diterima; -1, 101, NaN, dan kosong ditangani benar;
- blank pada batch tidak menghapus nilai lama;
- Edit Nilai hanya mengubah satu pasangan siswa/TP;
- commit edit gagal tidak mengubah angka DOM/state;
- listener lama yang tiba setelah commit tidak boleh memulihkan angka lama;
- TP berkode sama pada Mapel berbeda tidak tertukar;
- VIP hanya melihat dan menulis PJOK.

### Presensi

- sebelum lengkap: tabel dan `Simpan Kehadiran` terlihat;
- sesudah commit lengkap: tabel hilang, `Presensi sudah dilakukan` dan `Edit Kehadiran` terlihat;
- edit: data lama terisi, tombol `Simpan Perubahan` terlihat;
- commit perubahan sukses mengembalikan completed-state;
- commit gagal mempertahankan mode edit dan input pengguna;
- tanggal lain tidak mewarisi edit-state;
- siswa baru yang ditambahkan membuat tanggal lama tidak lagi dianggap lengkap sampai presensinya diisi, kecuali kontrak bisnis source secara eksplisit menetapkan snapshot roster; jika menemukan konflik, laporkan kepada pengguna sebelum mengubah model data.

### Semua tombol simpan

Enumerasi seluruh tombol/form save dari HTML dengan `rg`. Untuk setiap handler, buktikan success/error/double-submit. Hasil bukan PASS jika hanya beberapa halaman diuji.

## Gerbang 4 — Mobile UI/UX nyata

Gunakan Chromium headless dan headed jika tersedia pada viewport berikut:

- 390×844, device scale factor 1;
- 412×915, device scale factor 2;
- desktop 1366×768.

Gunakan mock Superuser yang sudah tersedia dan fixture VIP terisolasi. Untuk setiap viewport:

1. Tambah siswa dan pastikan toast tidak tertutup header/bottom navigation.
2. Tulis catatan dan pastikan tombol tetap dapat diketuk.
3. Pilih Mapel/TP dan pastikan daftar siswa tidak berada di bawah bottom navigation.
4. Verifikasi option selesai disabled melalui property DOM dan visual state.
5. Edit nilai dari Rekap; keyboard viewport tidak boleh menghilangkan tombol simpan.
6. Simpan Presensi; completed-state dan Edit Kehadiran harus terlihat tanpa scroll yang membingungkan.
7. Uji mode terang dan gelap.
8. Ambil screenshot bernama deterministik dan simpan hanya sebagai bukti QA, tidak di dalam `public` atau ZIP release.

Kriteria visual wajib: tidak ada overlap, clipped text, horizontal overflow tak disengaja, dead click, layout shift besar, atau kontrol di bawah fixed navigation.

## Gerbang 5 — Build dan suite penuh

Setelah koreksi selesai, bump target ke `4.6.4` hanya pada authority/source aktif dan ekspektasi QA terkait. Jangan mengubah laporan historis `4.6.3`.

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'Build hosting gagal' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Full QA gagal' }
```

Jalankan suite serial, bukan paralel, agar build `public` dan server port tidak berlomba. Catat jumlah PASS/FAIL per gate dan exit code sebenarnya.

Sesudah suite, jalankan ulang `npm run build:hosting`, lalu pastikan build final tidak diubah oleh tes berikutnya.

## Gerbang 6 — Inspeksi artefak dan kebersihan

Verifikasi:

- package, manifest, runtime-config, dashboard label, dan Service Worker semuanya `4.6.4`;
- tidak ada URL localhost atau fixture QA di `public`;
- mock auth hanya berada di QA;
- tidak ada source map, service-account key, `.env`, browser profile, screenshot tes, log mentah, atau secret di `public`;
- service worker precache memuat file terbaru dan tidak mencampur cache `4.6.3`;
- `firebase.json`, Firestore rules/indexes, dan RTDB rules tidak berubah tanpa alasan yang dibuktikan oleh kebutuhan fitur;
- `test-output/gadm-mobile` dan artefak sementara tes dibersihkan setelah bukti ringkas dicatat.

## Gerbang 7 — Laporan perbaikan

Buat `FORENSIC_FIX_AND_QA_REPORT_4.6.4.md` yang berisi:

1. reproduksi setiap bug;
2. akar masalah berdasarkan file/fungsi;
3. koreksi yang dilakukan;
4. invariants data yang dipertahankan;
5. daftar test case dan hasil;
6. jumlah PASS/FAIL setiap suite;
7. hasil mobile tiap viewport;
8. hash file source kritis dan paket;
9. pernyataan eksplisit bahwa tidak ada deploy dan tidak ada write ke data produksi;
10. unresolved issue. Jika ada satu unresolved issue, status release adalah `BLOCKED`, bukan siap produksi.

## Gerbang 8 — Paket release

Hanya jika Gerbang 0–7 lulus:

- buat ZIP source release `SIMNI-GADM-v4.6.4-PRODUCTION-READY.zip`;
- jangan memasukkan `node_modules`, `.git`, `.firebase`, `.codex`, `.agents`, `test-output`, browser profile, log, screenshot, secret, atau arsip lama;
- buka ZIP ke direktori temporer baru;
- jalankan pemeriksaan versi dan daftar file dari hasil ekstraksi;
- hitung SHA-256 ZIP;
- buat `.sha256` dan `PACKAGE_VERIFICATION_4.6.4.md`;
- jangan deploy.

## Stop conditions

Hentikan dan laporkan `BLOCKED` jika:

- diperlukan keputusan model data baru;
- ada rules produksi yang harus dilonggarkan;
- perbaikan membutuhkan layanan berbayar;
- ditemukan data korup atau konflik schema produksi;
- test hanya dapat lulus dengan menurunkan assertion;
- kredensial/secret diperlukan tetapi tidak tersedia;
- satu acceptance scenario gagal tiga kali setelah akar masalah yang sama dikoreksi.

