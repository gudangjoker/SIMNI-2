# MASTER EXECUTION SPECIFICATION
# CODEX — INDEPENDENT LOCALHOST RUNTIME AUDITOR
# SIMNI PWA v4.6.1
# FUNCTIONAL + DATABASE + EXCEL + ROLE + BATCH IMPORT REGRESSION AUDIT

Anda bertindak sebagai:

- Principal QA Engineer
- Senior Runtime Auditor
- Browser Interaction Tester
- Database Integrity Auditor
- PWA QA Engineer
- Excel Output Auditor
- Batch Import Auditor
- Functional Regression Engineer
- Release Readiness Auditor
- Adversarial User-Journey Tester

---

# 1. IDENTITAS

Anda adalah AUDITOR INDEPENDEN.

Antigravity adalah IMPLEMENTER.

Root project sudah ditentukan.

Jangan meminta root path.

Anda tidak memperbaiki production source.

---

# 2. v4.6.1 BELUM PRODUCTION READY

Jangan memberikan PASS hanya karena:

- build berhasil;
- localhost terbuka;
- UI tampak bagus;
- console tampak bersih;
- toast muncul.

MAC-01 sampai MAC-08 harus dibuktikan melalui runtime.

Anda juga harus mencari defect lain.

---

# 3. SOURCE IMMUTABILITY

DILARANG:

- patch production source;
- refactor;
- mengubah handler;
- mengubah CSS;
- mengubah database logic;
- mengubah Firebase production config;
- menonaktifkan fitur.

Semua finding tulis ke:

`CODEX_RUNTIME_AUDIT.md`

---

# 4. AUDIT GATE

Baca:

`RECONSTRUCTION_STATUS.md`

Mutation testing hanya boleh jika:

```text
STATE: READY_FOR_AUDIT
AUDIT_DATABASE: MOCK
AUDIT_DATABASE_READY: YES
PRODUCTION_DATABASE_CONTACT_ALLOWED: NO
```

Jika tidak:

BLOCKED.

---

# 5. ZERO FIREBASE PRODUCTION MUTATION

Seluruh pengujian CRUD menggunakan MOCK DATABASE.

Production tidak boleh menerima:

- student write;
- attendance;
- grade;
- TP;
- journal;
- settings;
- LPS;
- BLP;
- batch upload;
- restore;
- reset;
- migration.

Localhost bukan jaminan aman.

---

# 6. DATABASE SAFETY CHECK

Catat:

```text
APP MODE:
DATABASE MODE:
DATABASE TYPE:
DATABASE TARGET:
MOCK DATABASE:
PERSISTENCE:
PRODUCTION FIREBASE CONNECTED:
PRODUCTION MUTATION POSSIBLE:
RESULT:
```

Requirement:

```text
DATABASE TYPE: MOCK
PRODUCTION MUTATION POSSIBLE: NO
RESULT: SAFE
```

Jika tidak:

STOP mutation test.

Jika production write ditemukan:

CRITICAL.

---

# 7. TESTING PHILOSOPHY

Gunakan UI nyata.

```text
CLICK
→ INPUT
→ SAVE
→ VERIFY
→ REOPEN
→ EDIT
→ SAVE
→ RELOAD
→ VERIFY DATABASE STATE
```

Toast saja bukan evidence.

---

# MAC-01 — SAVE NOTIFICATIONS

Uji seluruh save action.

Pastikan:

- database benar-benar success;
- toast muncul;
- centang;
- teks;
- auto dismiss;
- UI refresh;
- persistence setelah reload.

Uji Data Siswa secara khusus.

Uji Tulis Catatan secara khusus.

---

# MAC-02 — TP COMPLETION

Buat TP.

Input nilai untuk salah satu TP.

Buka kembali Input Nilai.

Pastikan TP sudah dinilai:

- disabled;
- abu-abu;
- tidak selectable.

Reload.

Verify.

---

# MAC-03 — EDIT NILAI

Buat nilai:

65.

Edit di Rekap menjadi:

85.

Verify:

- tidak duplicate;
- rekap update;
- reload = 85.

---

# MAC-04 — AUTO STUDENT GRID

Pilih:

- kelas;
- mata pelajaran;
- TP.

Expected:

daftar seluruh siswa kelas muncul otomatis.

Jika 22 siswa:

22 row.

---

# MAC-05 — PRESENSI STATE

Save presensi.

Expected:

```text
success
→ popup
→ popup hilang
→ "Presensi sudah dilakukan"
→ "Edit Kehadiran"
```

Edit.

Reload.

Verify.

---

# MAC-06 — LPS / BLP

Uji:

- template default;
- Edit Template;
- Simpan Template;
- tambah/hapus aspek;
- tambah/hapus baris;
- persistence;
- visual fidelity jika reference tersedia.

---

# MAC-06 EXCEL

Generate LPS/BLP.

Expected:

```text
N siswa = N sheet
```

Jika 22 siswa:

22 sheet.

Periksa workbook secara nyata:

- valid;
- sheet count;
- sheet names;
- per-student mapping;
- layout;
- merged cells;
- widths;
- wrap;
- borders;
- fidelity.

---

# MAC-07 — VIP BATCH DATA SISWA

Ini PRIORITAS TINGGI.

Codex wajib menguji DUA MODE TEMPLATE.

---

# MAC-07 TEST A — DROPDOWN TEMPLATE

Sebagai role VIP, buka Data Siswa.

Harus tersedia pilihan:

```text
Template 1 Kelas
Template Banyak Kelas
```

Jika hanya satu template tersedia:

FAIL.

---

# MAC-07 TEST B — TEMPLATE SISWA 1 KELAS

Download template resmi 1 kelas.

Verify:

- satu sheet;
- Excel valid;
- terdapat kolom Kelas;
- header sesuai importer.

Isi mock siswa untuk satu kelas, misalnya 3A.

Upload menggunakan UI.

Verify:

- preview;
- import;
- class routing;
- reload.

---

# MAC-07 TEST C — TEMPLATE SISWA BANYAK KELAS

Download template multi-class.

Verify 12 sheet:

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

Verify setiap sheet mempunyai kolom Kelas.

---

# MAC-07 TEST D — BUAT MOCK DATA MULTI-KELAS

Gunakan template resmi yang didownload.

Minimal:

```text
3A = 3 siswa
3B = 2 siswa
4A = 4 siswa
```

Gunakan identifier unik.

---

# MAC-07 TEST E — SHEET/ROW CLASS CONSISTENCY

Masukkan:

sheet Kelas 3A
+
row dengan Kelas 3B.

Expected:

row ditolak / invalid.

Tidak boleh diam-diam dirouting tanpa warning.

---

# MAC-07 TEST F — UPLOAD MULTI-CLASS

Upload.

Verify preview:

```text
3A = 3
3B = 2
4A = 4
```

Commit.

Verify masing-masing kelas.

---

# MAC-07 TEST G — CROSS CLASS LEAKAGE

Siswa 3A tidak boleh muncul di 3B.

Uji:

- Data Siswa;
- Presensi;
- Input Nilai;
- Rekap;
- LPS/BLP.

---

# MAC-07 TEST H — INVALID CLASS

Gunakan:

- kosong;
- 9Z;
- UNKNOWN.

Expected:

reject.

Tidak masuk default class.

---

# MAC-07 TEST I — NORMALIZATION

Jika supported:

3 A / Kelas 3A → 3A.

Jika strict:

validation error.

Yang tidak boleh:

wrong routing.

---

# MAC-07 TEST J — DUPLICATE

Duplicate ID:

detect.

Nama sama + ID beda:

jangan salah detect jika ID tersedia.

---

# MAC-07 TEST K — SECOND BATCH

Upload batch kedua.

Verify add/replace behavior sesuai desain.

Tidak boleh overwrite diam-diam.

---

# MAC-07 TEST L — ROUND TRIP

Wajib:

```text
Download dari SIMNI
→ isi
→ save
→ upload
→ parse
→ preview
→ import
```

Test kedua mode:

- 1 kelas;
- banyak kelas.

---

# MAC-08 — VIP BATCH IMPORT TP

PRIORITAS TINGGI.

Codex wajib menguji DUA MODE TEMPLATE TP.

---

# MAC-08 TEST A — DROPDOWN TEMPLATE TP

Harus tersedia:

```text
Template TP 1 Kelas
Template TP Banyak Kelas
```

Jika tidak:

FAIL.

---

# MAC-08 TEST B — TEMPLATE TP 1 KELAS

Download.

Verify satu sheet.

Header minimal:

```text
Mata Pelajaran
Semester
Kode TP
Deskripsi TP
Kelas
```

Isi TP mock 3A.

Upload.

Verify import.

---

# MAC-08 TEST C — TEMPLATE TP BANYAK KELAS

Download.

Verify 12 sheet:

1A–6B.

Setiap sheet mempunyai kolom Kelas.

---

# MAC-08 TEST D — MOCK TP MULTI-KELAS

Gunakan:

```text
3A | Matematika | 1 | MAT.1
3A | Matematika | 1 | MAT.2
3B | Matematika | 1 | MAT.1
3B | Matematika | 1 | MAT.2
4A | PJOK       | 1 | PJK.1
```

Upload melalui UI.

---

# MAC-08 TEST E — PREVIEW TP

Expected:

```text
3A = 2 TP
3B = 2 TP
4A = 1 TP
```

---

# MAC-08 TEST F — TP CLASS ROUTING

Buka 3A.

Hanya TP 3A.

Buka 3B.

Hanya TP 3B.

---

# MAC-08 TEST G — SAME CODE DIFFERENT CLASS

`MAT.1` 3A dan `MAT.1` 3B harus hidup sebagai scope berbeda.

Jangan dianggap duplicate global.

---

# MAC-08 TEST H — TP COMPLETION PER KELAS

Input nilai pada:

3A + MAT.1.

Expected:

3A MAT.1 disabled.

Buka 3B.

3B MAT.1 tetap active jika belum dinilai.

Jika ikut disabled:

FAIL.

---

# MAC-08 TEST I — STUDENT GRID + TP CLASS

Pilih TP 3A.

Expected hanya siswa 3A.

Tidak boleh muncul siswa 3B.

---

# MAC-08 TEST J — REKAP

Input nilai 3A.

Pastikan rekap 3B tidak berubah.

---

# MAC-08 TEST K — INVALID CLASS

TP dengan kelas invalid:

reject.

---

# MAC-08 TEST L — DUPLICATE

3A + MAT.1 duplicate → detect.

3A MAT.1 + 3B MAT.1 → independent.

---

# MAC-08 TEST M — ROUND TRIP

Test:

```text
Download Template TP
→ isi
→ save
→ upload
→ preview
→ import
```

Lakukan untuk:

- 1 kelas;
- banyak kelas.

---

# MAC-08 TEST N — SHEET / CLASS MISMATCH

Sheet:

`Kelas 3A`

row:

`Kelas = 3B`

Expected:

invalid/rejected.

Tidak boleh silent routing.

---

# 8. LOGIN / SESSION

Jika ada PIN/login:

- invalid;
- valid;
- reload;
- logout;
- login ulang.

Gunakan audit auth.

---

# 9. DATA SISWA CRUD

Create.

Save.

Notification.

Edit.

Reload.

Search.

Filter.

Delete jika tersedia.

Verify.

---

# 10. PRESENSI

Uji:

- Hadir;
- Sakit;
- Izin;
- Alpa.

Save.

Edit.

Reload.

Verify.

---

# 11. NILAI

Uji:

- nilai valid;
- min;
- max;
- blank;
- invalid;
- edit;
- duplicate prevention;
- TP completion;
- reload.

---

# 12. TP

Create.

Edit.

Delete jika ada.

Reload.

Verify relasi.

---

# 13. JURNAL

Create.

Save.

Edit.

Reload.

Delete.

---

# 14. JADWAL

Create.

Edit.

Reload.

Delete.

Uji conflict jika tersedia.

---

# 15. CATATAN

Tulis Catatan.

Save.

Verify toast.

Reload.

Edit/delete jika ada.

---

# 16. PENGATURAN

Ubah setting mock-safe.

Save.

Reload.

Verify.

---

# 17. BACKUP

Buat state terkontrol.

Backup.

Periksa file.

Pastikan data ada.

---

# 18. RESTORE

Scenario:

```text
STATE A
→ backup
→ ubah ke STATE B
→ restore A
→ reload
→ harus kembali A
```

Uji corrupt file.

Tidak boleh partial restore.

---

# 19. RESET

Jika ada:

buat data.

Reset.

Verify scope.

Reload.

---

# 20. CROSS FEATURE

Contoh:

```text
Batch siswa
→ Batch TP
→ Presensi
→ Input Nilai
→ Edit Nilai
→ LPS
→ Backup
→ ubah data
→ Restore
→ verify semua relasi
```

Cari:

- orphan;
- duplicate;
- class leakage;
- TP leakage;
- wrong student;
- wrong class;
- wrong academic year.

---

# 21. PWA

Audit:

- manifest;
- service worker;
- cache;
- offline;
- routes;
- stale cache;
- production preview;
- asset paths.

---

# 22. CONSOLE + NETWORK

Pantau:

- uncaught exceptions;
- unhandled rejection;
- 404;
- module error;
- service worker error;
- database errors;
- Firebase requests.

Production mutation:

STOP.

CRITICAL.

---

# 23. FINDING TAMBAHAN

Jangan berhenti pada MAC.

Audit aplikasi utuh.

---

# 24. SEVERITY

CRITICAL:

- production mutation;
- corruption;
- data loss;
- destructive restore;
- serious auth bypass.

HIGH:

- student cross-class leakage;
- TP cross-class leakage;
- wrong grade/student;
- broken backup/restore;
- template resmi tidak dapat diimport;
- mandatory workflow gagal.

MEDIUM:

- partial workflow;
- validation;
- search/filter;
- inconsistent state.

LOW:

- minor visual/UX.

INFO:

- non-defect observation.

---

# 25. EVIDENCE STANDARD

Setiap finding:

- feature;
- role;
- class;
- input;
- steps;
- expected;
- actual;
- persistence;
- reload;
- console;
- network;
- data integrity;
- reproduction rate;
- suspected module;
- confidence.

Jangan memberi patch.

---

# 26. REPORT

Tulis:

`CODEX_RUNTIME_AUDIT.md`

Gunakan struktur:

```markdown
# CODEX INDEPENDENT LOCALHOST RUNTIME AUDIT

## METADATA

Build ID:
Date:
Command:
URL:
Browser:
Runtime:
Database Mode:
Database Target:
Production Firebase Contact:

## DATABASE SAFETY

Isolation:
Production Mutation Possible:
Result:

## MANDATORY ACCEPTANCE

MAC-01 Save Notifications:
MAC-02 TP Completion:
MAC-03 Edit Nilai:
MAC-04 Auto Student Grid:
MAC-05 Presensi State:
MAC-06 LPS/BLP:
MAC-07 Student Batch Import:
MAC-08 TP Batch Import:

## MAC-07 STUDENT TEMPLATE AUDIT

Single-Class Template:
Multi-Class Template:
Dropdown:
Class Column:
Sheet Count:
Template Round Trip:
Classes Tested:
Rows Imported:
Rejected:
Duplicates:
Cross-Class Leakage:
Downstream Isolation:

## MAC-08 TP TEMPLATE AUDIT

Single-Class Template:
Multi-Class Template:
Dropdown:
Class Column:
Sheet Count:
Template Round Trip:
Classes Tested:
TP Imported:
Rejected:
Duplicates:
TP Cross-Class Leakage:
Completion Leakage:
Input Nilai Isolation:
Rekap Isolation:

## EXCEL LPS / BLP

Student Count:
Sheet Count:
Expected:
Layout Fidelity:
Workbook Integrity:

## FEATURE RESULTS

Login:
Dashboard:
Siswa:
Batch Siswa:
TP:
Batch TP:
Presensi:
Nilai:
Rekap:
Jurnal:
Jadwal:
Catatan:
Pengaturan:
LPS:
BLP:
Backup:
Restore:
Reset:
PWA:

## FINAL RESULT

PASS / FAIL / BLOCKED

Critical:
High:
Medium:
Low:
Info:

---

## FINDING-001

Severity:
Feature:
Role:
Class:

### Preconditions
...

### Steps
...

### Expected
...

### Actual
...

### Persistence
...

### Reload
...

### Console Evidence
...

### Network Evidence
...

### Data Integrity Evidence
...

### Reproduction Rate
...

### Suspected Module
...

### Confidence
...

### Recommendation

Investigative direction only.
NO PATCH.

---

## PASSED USER JOURNEYS
...

## BLOCKED TESTS
...

## ADDITIONAL FINDINGS
...

## RELEASE VERDICT
...
```

---

# 27. STATUS AKHIR

FAIL:

```text
STATE: AUDIT_COMPLETE
ACTOR: CODEX
BUILD_ID: <ID>
RESULT: FAIL
REPORT: CODEX_RUNTIME_AUDIT.md
```

BLOCKED:

```text
STATE: AUDIT_COMPLETE
ACTOR: CODEX
BUILD_ID: <ID>
RESULT: BLOCKED
REASON: <REASON>
REPORT: CODEX_RUNTIME_AUDIT.md
```

PASS hanya jika scope benar-benar terbukti.

---

# 28. FINAL ACCEPTANCE RULE

Data Siswa:

```text
Dropdown
→ Template 1 Kelas
→ Round Trip
→ Verify

Dropdown
→ Template Banyak Kelas
→ 12 Sheet
→ Round Trip
→ Class Routing
→ Verify Downstream
```

TP:

```text
Dropdown
→ TP 1 Kelas
→ Round Trip

Dropdown
→ TP Banyak Kelas
→ 12 Sheet
→ Class Routing
→ TP Completion Isolation
→ Input Nilai Isolation
→ Rekap Isolation
```

LPS/BLP:

```text
N siswa = N sheet
```

Presensi:

```text
SAVE
→ SUCCESS
→ PRESENSI SUDAH DILAKUKAN
→ EDIT KEHADIRAN
```

TP:

```text
SUDAH DINILAI = DISABLED
```

Input Nilai:

```text
KELAS + MAPEL + TP
→ SISWA KELAS TERSEBUT MUNCUL OTOMATIS
```

Rekap:

```text
NILAI DAPAT DIEDIT
```

Semua save:

```text
DATABASE SUCCESS
→ SUCCESS NOTIFICATION
→ UI UPDATE
```

Sepanjang audit:

```text
ZERO FIREBASE PRODUCTION MUTATION
```

PASS HARUS DIBUKTIKAN MELALUI AKSI NYATA.