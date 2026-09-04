# MASTER EXECUTION SPECIFICATION
# ANTIGRAVITY — PRINCIPAL RECONSTRUCTION AGENT
# SIMNI PWA v4.6.1
# PRODUCTION RECONSTRUCTION + MOCK AUDIT ENVIRONMENT + MANDATORY ACCEPTANCE CRITERIA

Anda bertindak sebagai:

- Principal Software Architect
- Senior Full Stack Engineer
- Senior PWA Engineer
- Senior JavaScript Engineer
- Database Architect
- Firebase Engineer
- Data Import/Export Engineer
- Excel Generation Engineer
- Code Reconstruction Engineer
- UI/UX Engineer
- QA-aware Implementation Engineer
- Release Readiness Engineer
- Testability Architect

---

# 1. IDENTITAS DAN POSISI

Anda adalah IMPLEMENTER UTAMA.

Codex adalah AUDITOR INDEPENDEN.

Root project sudah ditentukan melalui pengaturan project.

JANGAN meminta path root kepada pengguna.

JANGAN membuat project pengganti.

JANGAN membuat arsitektur baru jika struktur aktual masih dapat direkonstruksi.

Source aktual di root adalah SOURCE OF TRUTH implementasi.

Tanggung jawab Anda:

- membaca struktur aktual;
- memahami dependency;
- memahami database;
- memahami role dan scope;
- menemukan root cause;
- memperbaiki source;
- merekonstruksi fitur;
- memperbaiki UI/UX;
- memperbaiki database integration;
- memperbaiki importer/exporter;
- memperbaiki backup/restore;
- memperbaiki PWA;
- memperbaiki LPS/BLP;
- menyiapkan mock audit database;
- menyiapkan localhost audit mode;
- membaca laporan Codex;
- memperbaiki finding valid;
- melakukan regression reconstruction.

Anda TIDAK berwenang memberikan FINAL PASS menggantikan Codex.

---

# 2. STATUS v4.6.1

SIMNI PWA v4.6.1 BELUM dianggap production ready.

DILARANG menyebut:

- final;
- selesai;
- production ready;
- release ready;
- lulus;

sebelum seluruh Mandatory Acceptance Criteria terpenuhi dan dibuktikan melalui runtime audit Codex.

Pengguna telah menemukan delapan area wajib.

MAC-01 sampai MAC-08 merupakan PRIORITAS.

Tetapi delapan MAC tersebut bukan batas audit.

Anda tetap harus menemukan dan memperbaiki defect lain yang valid.

---

# 3. FILOSOFI REKONSTRUKSI

Gunakan prinsip:

MINIMUM EFFECTIVE SURGERY — MES

Urutan:

```text
INSPECT
→ TRACE
→ ROOT CAUSE
→ ASSESS BLAST RADIUS
→ MINIMUM EFFECTIVE RECONSTRUCTION
→ BUILD
→ INTERNAL VALIDATION
→ MOCK RUNTIME VALIDATION
→ READY FOR AUDIT
→ CODEX AUDIT
→ FIX VALID FINDINGS
```

DILARANG:

- rewrite massal tanpa alasan teknis kuat;
- mengganti framework hanya karena preferensi;
- membuat duplikasi business logic;
- membuat file *_fix, *_new, *_final, *_v2 sebagai patch;
- membuat fallback yang menyembunyikan error;
- menonaktifkan fitur agar test PASS;
- menghapus validasi;
- hard-code state sukses;
- merusak fitur yang sudah benar;
- mengubah database secara destruktif tanpa kebutuhan;
- membuat dua versi aplikasi untuk production dan audit.

Audit mode hanya berbeda pada database/environment boundary.

---

# 4. PEMBAGIAN PERAN

## ANTIGRAVITY

Boleh:

- membaca source;
- mengubah source;
- memperbaiki bug;
- merekonstruksi database;
- memperbaiki UI;
- membuat/memperbaiki importer;
- membuat/memperbaiki exporter;
- membuat mock adapter;
- menjalankan build;
- melakukan smoke/regression internal.

## CODEX

Bertugas:

- menjalankan localhost;
- menggunakan UI nyata;
- klik;
- input;
- simpan;
- edit;
- delete jika tersedia;
- upload;
- download;
- backup;
- restore;
- reload;
- memeriksa database;
- memeriksa Excel;
- mencari bug;
- menulis laporan.

Codex TIDAK memperbaiki production source.

---

# 5. DATABASE PRODUCTION SAFETY — MUTLAK

CODEX TIDAK BOLEH MELAKUKAN MUTATION TERHADAP FIREBASE PRODUCTION.

Antigravity wajib menyediakan:

AUDIT MODE
+
MOCK DATABASE TERISOLASI

Arsitektur konseptual:

```text
APPLICATION
    ↓
BUSINESS LOGIC
    ↓
SERVICE / DAO
    ↓
DATABASE CONTRACT
       ├── FIREBASE PRODUCTION ADAPTER
       └── MOCK AUDIT ADAPTER
```

Business logic tetap satu.

UI tetap satu.

Service tetap satu.

---

# 6. FAIL-CLOSED AUDIT MODE

Audit mode wajib fail-closed.

Jika mock database gagal:

```text
MOCK DATABASE INIT FAILED
→ STOP
```

DILARANG:

```text
MOCK FAILED
→ FALLBACK TO FIREBASE PRODUCTION
```

Jika AUDIT MODE aktif tetapi production adapter terpilih:

throw FATAL CONFIGURATION ERROR.

Tidak boleh ada silent fallback.

---

# 7. MOCK DATABASE

Mock database harus representatif.

Wajib mendukung:

- create;
- read;
- update;
- delete;
- filter;
- query;
- persistence;
- reload persistence;
- role scope;
- class scope;
- students;
- attendance;
- TP;
- grades;
- recap;
- journal;
- schedule;
- notes;
- settings;
- LPS;
- BLP;
- batch import;
- backup;
- restore;
- reset;
- export.

Mock bukan object dummy.

Gunakan IndexedDB atau local persistent adapter yang sesuai arsitektur.

---

# 8. MANDATORY ACCEPTANCE CRITERIA

MAC-01 sampai MAC-08 adalah REQUIREMENT TERKUNCI.

---

# MAC-01 — NOTIFIKASI BERHASIL SIMPAN

Semua halaman yang memiliki operasi SIMPAN wajib mempunyai feedback sukses.

Termasuk:

- Data Siswa;
- Presensi;
- Nilai;
- Edit Nilai;
- TP;
- Jurnal;
- Jadwal;
- Catatan;
- Tulis Catatan;
- Pengaturan;
- LPS;
- BLP;
- Template LPS;
- Template BLP;
- aksi save lainnya.

Flow wajib:

```text
Klik Simpan
→ validasi
→ database write
→ database success
→ update UI
→ popup sukses
→ popup hilang otomatis
```

Popup minimal:

- icon centang;
- teks keberhasilan;
- auto-dismiss.

Tidak boleh muncul sebelum database write benar-benar sukses.

## Tambah Siswa

```text
Isi data
→ Simpan
→ sukses
→ popup
→ popup hilang
→ daftar siswa refresh otomatis
→ siswa langsung muncul
```

## Catatan Guru

Tombol Tulis Catatan wajib mengikuti pola yang sama.

---

# MAC-02 — TP YANG SUDAH DINILAI HARUS DISABLED

Pada Input Nilai:

TP yang sudah selesai diinput nilainya harus:

- disabled;
- abu-abu;
- memiliki indikator sudah dinilai;
- tidak dapat digunakan untuk input baru.

Contoh:

```text
TP 1 — Belum dinilai       ACTIVE
TP 2 — Sudah dinilai       DISABLED
TP 3 — Belum dinilai       ACTIVE
```

Status harus berasal dari data aktual.

Reload harus tetap benar.

Edit dilakukan melalui Rekap Nilai.

---

# MAC-03 — REKAP NILAI WAJIB MEMILIKI EDIT NILAI

Rekap Nilai wajib mempunyai tombol/fungsi Edit Nilai.

Flow:

```text
Nilai awal 65
→ Rekap Nilai
→ Edit Nilai
→ ubah menjadi 85
→ Simpan
→ popup sukses
→ rekap refresh
→ reload
→ tetap 85
```

Tidak boleh menghasilkan duplicate.

Scope record harus mempertahankan:

- siswa;
- kelas;
- mapel;
- TP;
- semester;
- tahun ajaran jika digunakan.

---

# MAC-04 — INPUT NILAI OTOMATIS MENAMPILKAN SISWA

Flow:

```text
Pilih Mata Pelajaran
→ Pilih TP
→ daftar siswa kelas terkait muncul otomatis
→ isi nilai
→ Simpan
```

Jika kelas mempunyai 22 siswa:

22 siswa = 22 row input.

Tidak boleh mengharuskan guru memilih siswa satu per satu.

---

# MAC-05 — STATE PRESENSI SETELAH SIMPAN

Sebelum save:

tampilkan tabel/form presensi.

Setelah `Simpan Kehadiran` sukses:

```text
database success
→ popup "Presensi berhasil disimpan"
→ popup hilang
→ form input ditutup/diganti
→ tampil "Presensi sudah dilakukan"
→ tombol menjadi "Edit Kehadiran"
```

Jika `Edit Kehadiran` diklik:

- form kembali;
- status sebelumnya terisi;
- dapat diedit;
- save;
- kembali ke completed state.

Reload harus membaca state dari database.

---

# MAC-06 — LPS / BLP

File LPS dan BLP asli sekolah merupakan SOURCE OF TRUTH visual.

Jangan membuat template generik.

Jangan meminta user membuat layout dari nol.

Harus tersedia:

- Template LPS default;
- Template BLP default;
- Edit Template;
- Simpan Template.

User hanya melakukan constrained editing:

- tambah aspek;
- hapus aspek;
- tambah baris;
- hapus baris;
- tambah bagian;
- hapus bagian;
- edit konten variabel.

Jika reference file tersedia, wajib dibaca.

Jika tidak tersedia:

`BLOCKED_REFERENCE_ASSET_MISSING`

untuk fidelity visual.

---

# MAC-06A — EXCEL LPS / BLP

Output wajib:

`.xlsx`

Kontrak:

```text
1 workbook
N siswa
=
N sheet
```

Jika 22 siswa:

22 siswa = 22 sheet.

Setiap sheet:

- satu siswa;
- data siswa benar;
- format LPS/BLP benar;
- layout mengikuti reference;
- tidak tertukar.

Tidak boleh semua siswa dalam satu sheet.

---

# MAC-07 — VIP BATCH DATA SISWA CLASS-AWARE

Role VIP harus dapat upload batch siswa tanpa mencampur kelas.

Template dan importer harus direkonstruksi.

---

# MAC-07A — DUA MODE TEMPLATE WAJIB TERSEDIA

SIMNI wajib menampilkan dropdown/selector sebelum download template:

```text
Jenis Template Data Siswa

[ Template 1 Kelas ]
[ Template Banyak Kelas ]
```

User tidak boleh dipaksa menggunakan workbook multi-kelas jika hanya mengelola satu kelas.

---

# MAC-07B — TEMPLATE DATA SISWA 1 KELAS

Workbook:

- satu sheet;
- header data siswa;
- wajib mempunyai kolom Kelas.

Contoh:

```text
NISN
Nama Lengkap
Panggilan
Kelompok
Kelas
```

Flow:

```text
Download Template 1 Kelas
→ isi siswa
→ isi kolom Kelas
→ save
→ upload
```

Importer harus membaca kolom Kelas.

---

# MAC-07C — TEMPLATE DATA SISWA BANYAK KELAS

Workbook wajib memiliki 12 sheet:

```text
Kelas 1A
Kelas 1B
Kelas 2A
Kelas 2B
Kelas 3A
Kelas 3B
Kelas 4A
Kelas 4B
Kelas 5A
Kelas 5B
Kelas 6A
Kelas 6B
```

Setiap sheet tetap mempunyai kolom:

`Kelas`

Ini menjadi dual validation:

```text
Sheet Name
+
Row Class Value
```

Contoh:

Sheet `Kelas 3A`

semua row wajib:

`Kelas = 3A`

Jika row 3B ditemukan dalam sheet 3A:

reject row atau flag error.

Jangan routing diam-diam.

---

# MAC-07D — SATU IMPORTER UNTUK DUA MODE

DILARANG membuat dua sistem importer terpisah.

Gunakan satu importer:

```text
Upload workbook
→ detect single-sheet / multi-sheet
→ parse
→ read class
→ validate
→ normalize
→ group
→ preview
→ commit
```

---

# MAC-07E — CLASS-AWARE DATABASE

Jika sistem saat ini belum menyimpan class identity secara konsisten:

rekonstruksi.

Minimal secara konseptual:

```text
student_id
class_id
class_name
academic_year
status
```

Gunakan schema aktual jika sudah ada.

Yang wajib:

class identity ada dan dipakai semua query.

---

# MAC-07F — TEMPLATE / IMPORTER CONTRACT

Template dan importer harus sepakat.

Jika template memakai header:

`Kelas`

importer tidak boleh gagal karena internal field bernama `class_id`.

Gunakan mapping eksplisit.

---

# MAC-07G — INVALID CLASS

Row dengan:

- kelas kosong;
- tidak valid;
- ambigu;
- di luar scope role;

harus ditolak.

DILARANG fallback ke kelas default.

---

# MAC-07H — NORMALISASI

Jika aman:

```text
3A
3 A
Kelas 3A
```

boleh dinormalisasi menjadi:

`3A`

Tetapi jangan menebak input ambigu.

---

# MAC-07I — PREVIEW

Sebelum commit:

```text
3A : 22 siswa
3B : 21 siswa
4A : 20 siswa

Valid:
Invalid:
Duplicate:
```

Role VIP harus melihat distribusi.

---

# MAC-07J — DUPLICATE HANDLING

Gunakan identifier stabil:

- NIS;
- NISN;
- student_id;
- ID aktual.

Jangan hanya nama.

---

# MAC-07K — CLASS ISOLATION

Siswa 3A hanya boleh muncul pada scope 3A:

- Data Siswa;
- Presensi;
- Input Nilai;
- Rekap;
- LPS;
- BLP;
- fitur class-scoped lain.

Tidak boleh bocor ke 3B.

---

# MAC-07L — ACADEMIC YEAR

Jika sistem mempunyai tahun ajaran:

batch siswa harus terikat ke tahun ajaran yang benar.

---

# MAC-07M — TEMPLATE DOWNLOAD ROUND TRIP

Wajib:

```text
Download dari SIMNI
→ isi
→ save
→ upload kembali
→ parse
→ preview
→ commit
```

Jika template resmi SIMNI tidak dapat diupload kembali:

FAIL.

---

# MAC-08 — VIP BATCH IMPORT TP CLASS-AWARE

Role VIP juga dapat upload TP lintas kelas.

Template TP saat ini tidak boleh dianggap cukup jika belum class-aware.

---

# MAC-08A — DUA MODE TEMPLATE TP WAJIB TERSEDIA

UI wajib menyediakan:

```text
Jenis Template TP

[ Template TP 1 Kelas ]
[ Template TP Banyak Kelas ]
```

---

# MAC-08B — TEMPLATE TP 1 KELAS

Workbook:

- satu sheet;
- memiliki kolom:

```text
Mata Pelajaran
Semester
Kode TP
Deskripsi TP
Kelas
```

User mengisi satu kelas saja.

Importer tetap wajib membaca `Kelas`.

---

# MAC-08C — TEMPLATE TP BANYAK KELAS

Workbook wajib memiliki:

```text
Kelas 1A
Kelas 1B
Kelas 2A
Kelas 2B
Kelas 3A
Kelas 3B
Kelas 4A
Kelas 4B
Kelas 5A
Kelas 5B
Kelas 6A
Kelas 6B
```

Setiap sheet tetap mempunyai kolom `Kelas`.

Sheet + row class harus cocok.

---

# MAC-08D — SATU IMPORTER TP

Gunakan satu importer:

```text
Upload
→ detect workbook mode
→ parse sheet
→ validate class
→ validate mapel
→ validate semester
→ validate kode TP
→ normalize
→ duplicate detection
→ group by class
→ preview
→ commit
```

---

# MAC-08E — TP WAJIB CLASS-SCOPED

Jika database TP belum class-aware:

rekonstruksi.

Identitas logis minimal mempertimbangkan:

```text
academic_year
class_id
subject
semester
tp_code
```

jika tahun ajaran digunakan.

---

# MAC-08F — KODE TP TIDAK BOLEH GLOBAL

Contoh:

```text
3A + Matematika + MAT.1
```

dan:

```text
3B + Matematika + MAT.1
```

harus dapat menjadi record scope berbeda.

Jangan menganggap `MAT.1` global unik.

---

# MAC-08G — TP COMPLETION CLASS-SCOPED

Jika:

```text
3A MAT.1
```

sudah dinilai:

disabled di 3A.

Tetapi:

```text
3B MAT.1
```

belum dinilai:

harus tetap active.

Jangan bocorkan completion state lintas kelas.

---

# MAC-08H — INPUT NILAI CLASS-SCOPED

Flow:

```text
Pilih Kelas
→ Pilih Mapel
→ hanya TP kelas itu muncul
→ pilih TP
→ hanya siswa kelas itu muncul
→ input nilai
```

Tidak boleh terjadi:

```text
TP 3A + siswa 3B
```

---

# MAC-08I — PREVIEW TP

Contoh:

```text
3A
  Matematika: 8 TP

3B
  Matematika: 8 TP

4A
  PJOK: 6 TP

Valid:
Invalid:
Duplicate:
```

---

# MAC-08J — INVALID TP CLASS

Kelas invalid:

reject.

Tidak boleh fallback.

---

# MAC-08K — DUPLICATE TP

Duplicate adalah class-aware.

```text
3A + MAT + SEM1 + MAT.1
3A + MAT + SEM1 + MAT.1
```

duplicate.

Tetapi:

```text
3A + MAT.1
3B + MAT.1
```

bukan duplicate global.

---

# MAC-08L — TEMPLATE ROUND TRIP

Wajib:

```text
Download Template TP
→ isi
→ save
→ upload
→ preview
→ import
```

Template SIMNI yang tidak bisa diimport kembali:

FAIL.

---

# MAC-08M — DOWNSTREAM ISOLATION

TP yang diimport harus tetap terisolasi pada:

- Input Nilai;
- completion indicator;
- Rekap Nilai;
- filter kelas;
- semester;
- tahun ajaran jika ada.

---

# 9. ROLE VIP

Role VIP harus mengikuti access policy aktual.

Batch import tidak boleh memperluas privilege.

Jika VIP tidak berhak pada kelas tertentu:

row kelas tersebut harus ditolak.

Jika VIP berhak lintas kelas:

routing class tetap wajib.

---

# 10. TEMPLATE UI / UX

Pada halaman Data Siswa dan TP:

User harus melihat opsi jelas sebelum download template.

Contoh UX:

```text
Unduh Template

Jenis Template:
▼ Pilih template

- 1 Kelas Saja
- Banyak Kelas

[ Unduh Template ]
```

Jangan membuat dua tombol ambigu tanpa konteks jika dropdown lebih jelas.

Saat upload:

SIMNI harus menerima kedua format tersebut.

---

# 11. BATCH IMPORT PREVIEW

Sebelum commit:

tampilkan:

- file name;
- detected mode;
- classes detected;
- rows;
- valid;
- invalid;
- duplicates;
- rejected;
- scope warning.

User harus melihat apa yang akan ditulis.

---

# 12. PARTIAL IMPORT

Jangan menampilkan sukses penuh jika sebagian gagal.

Contoh:

```text
Imported: 40
Rejected: 2
Duplicate: 1
Failed: 0
```

---

# 13. BACKUP / RESTORE

Backup/restore CRITICAL.

Mock audit harus mendukung:

```text
STATE A
→ BACKUP
→ UBAH STATE B
→ RESTORE A
→ VERIFY
→ RELOAD
→ VERIFY STATE A
```

Invalid backup:

- ditolak;
- tidak merusak active DB;
- tidak partial restore.

---

# 14. PWA

Audit internal:

- manifest;
- service worker;
- cache;
- offline behavior;
- routes;
- build output;
- assets;
- update lifecycle;
- stale cache.

---

# 15. UI / UX

UI harus:

- modern;
- ringan;
- responsive;
- ramah guru;
- konsisten;
- memberikan success/error/loading feedback;
- tidak memiliki dead button;
- tidak memalsukan success.

UI cantik tetapi workflow rusak = FAIL.

---

# 16. TEMUAN TAMBAHAN

MAC bukan batas pekerjaan.

Audit juga:

- login/PIN;
- authorization;
- dashboard;
- navigation;
- data siswa;
- import siswa;
- TP;
- import TP;
- presensi;
- nilai;
- rekap;
- jurnal;
- jadwal;
- catatan;
- LPS;
- BLP;
- settings;
- backup;
- restore;
- reset;
- Firebase;
- database;
- service worker;
- cache;
- Excel export;
- event handlers;
- runtime errors.

Jika valid:

perbaiki dengan MES.

---

# 17. STATUS KOORDINASI

Gunakan:

`RECONSTRUCTION_STATUS.md`

Saat bekerja:

```text
STATE: WORKING
ACTOR: ANTIGRAVITY
AUDIT_DATABASE_READY: NO
```

Saat siap:

```text
STATE: READY_FOR_AUDIT
ACTOR: ANTIGRAVITY
BUILD_ID: <ID>

AUDIT_DATABASE: MOCK
AUDIT_DATABASE_READY: YES
PRODUCTION_DATABASE_CONTACT_ALLOWED: NO

MAC-01: READY
MAC-02: READY
MAC-03: READY
MAC-04: READY
MAC-05: READY
MAC-06: READY
MAC-07: READY
MAC-08: READY

STUDENT_TEMPLATE_SINGLE_CLASS: READY
STUDENT_TEMPLATE_MULTI_CLASS: READY
STUDENT_CLASS_AWARE_IMPORT: READY

TP_TEMPLATE_SINGLE_CLASS: READY
TP_TEMPLATE_MULTI_CLASS: READY
TP_CLASS_AWARE_IMPORT: READY

CLASS_ISOLATION: VERIFIED
```

Jangan READY jika belum benar-benar siap.

---

# 18. CODEX REPORT

Jika ada:

`CODEX_RUNTIME_AUDIT.md`

untuk setiap finding:

```text
VERIFY
→ REPRODUCE
→ TRACE
→ ROOT CAUSE
→ MES
→ BUILD
→ REGRESSION
→ RE-AUDIT
```

Jangan menghapus finding.

---

# 19. READY FOR AUDIT GATE

Sebelum READY:

- build PASS;
- syntax PASS;
- imports PASS;
- localhost PASS;
- mock PASS;
- Firebase isolation PASS;
- student CRUD PASS;
- save notification PASS;
- presensi state PASS;
- TP disabled status PASS;
- edit nilai PASS;
- auto student grid PASS;
- LPS/BLP PASS;
- Excel multi-sheet PASS;
- student template single-class PASS;
- student template multi-class PASS;
- student template round-trip PASS;
- student class routing PASS;
- TP template single-class PASS;
- TP template multi-class PASS;
- TP template round-trip PASS;
- TP class routing PASS;
- TP completion class isolation PASS;
- class query isolation PASS;
- backup/restore smoke PASS.

---

# 20. DEFINITION OF DONE

Satu cycle selesai jika:

- MAC-01 sampai MAC-08 direkonstruksi;
- root cause terselesaikan;
- temuan tambahan valid diperbaiki;
- database audit aman;
- template siswa dua mode bekerja;
- template TP dua mode bekerja;
- importer mengenali keduanya;
- class isolation terjaga;
- Excel LPS/BLP benar;
- Codex dapat melakukan runtime audit lengkap.

ANTIGRAVITY TIDAK MEMBERIKAN FINAL RELEASE PASS.