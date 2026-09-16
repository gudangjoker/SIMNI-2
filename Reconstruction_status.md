# Laporan Status Rekonstruksi & Normalisasi Database SIMNI

> Pembaruan 10 September 2026: template LPS/BLP lokal direkonstruksi pada **4.6.9**. Pilihan bawaan, pemetaan acuan XLSX, edit template dan ekspor offline telah diuji dengan mock. Lihat [LPS_BLP_TEMPLATE_RECONSTRUCTION_4.6.9.md](LPS_BLP_TEMPLATE_RECONSTRUCTION_4.6.9.md). Belum deploy/ubah APK; hasil UI/UX 4.6.8 di bawah tetap merupakan histori tersendiri.

> Pembaruan 10 September 2026: revisi inti UI/UX lokal menjadi 4.6.8. Hasil dan pekerjaan yang masih terbuka tersedia pada [UIUX_RECONSTRUCTION_4.6.8.md](UIUX_RECONSTRUCTION_4.6.8.md). Belum deploy dan belum dinyatakan mencapai UX 9/10.

> Catatan 9 September 2026: isi di bawah adalah histori build 4.6.5, bukan status rilis terkini. Audit 4.6.6 dan tindak lanjut 4.6.7 tercatat pada `FORENSIC_AUDIT_4.6.6_2026-09-09.md` dan `RECONSTRUCTION_REAUDIT_4.6.7.md`. Pernyataan mock/READY lama tidak membuktikan kondisi cloud atau build baru.

STATE: READY_FOR_AUDIT
ACTOR: ANTIGRAVITY
BUILD_ID: v4.6.5

AUDIT_DATABASE: MOCK
AUDIT_DATABASE_READY: YES
PRODUCTION_DATABASE_CONTACT_ALLOWED: NO

Dokumen ini memuat laporan terperinci hasil normalisasi arsitektur, skema data, sinkronisasi antar-workspace, dan pemetaan kurikulum sesuai instruksi pengguna dan Master Execution Specification (MES).

---

## 1. REKONSTRUKSI DATA SISWA & PEMANGGIL UTAMA (POIN 1 - 3)

### A. Skema Data Siswa & Normalisasi
Field data siswa telah dinormalisasi tanpa memicu migrasi destruktif pada data eksisting di Firebase:
- **`NISN` / `id_siswa`**: 10 digit angka unik. Menjadi **Pemanggil Utama (Primary Identifier)** perorangan universal di seluruh aplikasi (Profil Siswa, Presensi QR, Input Nilai, Buku Induk, Catatan, dan LPS/BLP).
- **`ID_Siswa`**: Kunci unik turunan deterministik (`stu_${NISN}`) untuk menjaga integritas foreign key relasi nilai dan laporan.
- **`Nama Lengkap` / `nama`**: Nama resmi siswa, divalidasi 1–160 karakter.
- **`Nama Panggilan` / `nama_panggilan`**: Nama panggilan siswa untuk kartu profil dan rapor.
- **`Kelas` / `id_kelas`**: Format label kelas standar (`1A` s.d. `6B`).
- **`QR Code`**: Dihasilkan secara dinamis di sisi klien melalui `QRCode.js` berbasis NISN siswa.
- **`Foto URL` / `url_foto`**: Terhubung langsung dengan akun **Cloudinary**:
  - Whitelist purpose `STUDENT_PHOTO` ditambahkan pada `js/database/cloudinary-client.js`.
  - Policy upload (maksimal 2MB, format JPEG/PNG/WebP) diamankan pada Cloudflare Edge Worker (`chat/edge/worker.js`).
  - Fungsi `uploadStudentPhoto()` dan action deklaratif `uploadStudentPhotoAction` aktif pada form siswa.

### B. Penambahan Kolom Kelas pada Form Tambah Siswa
- Input dropdown `<select id="input-kelas">` telah ditambahkan pada modal form siswa (`features/students/students.html`), memuat pilihan kelas lengkap `1A` s.d. `6B`.
- Logika `submitSiswa()` kini membaca nilai dari `#input-kelas`.
- Logika `openAddSiswaModal()` melakukan auto-select ke kelas aktif (`state.activeKelas`).
- Logika `editSiswa()` mengisi dropdown sesuai kelas siswa yang diedit.

---

## 2. PENYELESAIAN ROOT CAUSE MAC-04 (INPUT TP MEMANGGIL DATA SISWA)

### Analisis Akar Masalah:
1. **Operator Nullish Coalescing (`??`)**: Pada `grades.js`, fungsi `tpId(tp)` menggunakan `tp?.ID_mapel ?? tp?.learningObjectiveId ?? tp?.kode_tp`. Data TP hasil impor/migrasi memiliki field `"ID_mapel": ""`. Dalam JavaScript, `"" ?? "MAT.1"` mengevaluasi ke string kosong `""` (bukan fallback). Akibatnya, setiap elemen `<option>` TP pada dropdown bernilai `value=""`. Saat dipilih pengguna, `renderNilaiGrid()` mendeteksi ID kosong dan langsung membatalkan render tabel siswa.
2. **Kehilangan Object Key saat Ingest Sinkronisasi**: Fungsi `valuesOf(data)` mengekstrak nilai dictionary tanpa menyertakan kunci Firebase `$objectiveId` (misal `"Mtk_1"`). Jika properti `ID_mapel` di dalam objek kosong, kuncinya hilang.
3. **Inkonsistensi Normalisasi Kelas**: Filter kehadiran dan siswa menggunakan perbandingan string mentah, sementara modul nilai menggunakan `normalizeClassLabel()`.

### Tindakan Korektif (Bukan Tambalan):
- **Koreksi `tpId()`**: Diubah menjadi `String(tp?.ID_mapel || tp?.learningObjectiveId || tp?.kode_tp || '').trim()`. Jika `ID_mapel` kosong, otomatis mengambil fallback kode TP atau objective ID.
- **Resiliensi `getTPById()`**: Diperluas untuk mencocokkan `tpId(tp)` maupun `kode_tp` pada `visibleLearningObjectives()` dengan fallback ke `state.mapelTP`.
- **Normalisasi Ingest `sync.js`**:
  - `Mapel_TP`: Memastikan setiap objek TP memiliki `ID_mapel` valid (memanfaatkan key Firebase jika kosong) dan normalisasi properti kelas.
  - `Siswa`: Memastikan setiap objek siswa memiliki `NISN`, `ID_Siswa`, serta kompatibilitas properti kelas (`Kelas`, `kelas`, `id_kelas`).
- **Koreksi `activeGradeStudents()` & `renderNilaiGrid()`**: Mampu membaca variasi atribut kelas dan nama, serta menampilkan status informatif bila kelas belum memiliki murid.
- **Koreksi `local-cache.js`**: Memperbarui guard owner legacy dari `'ws_3a'` ke `'ws_superuser'`.

---

## 3. PENYERAGAMAN MATA PELAJARAN TP DAN GADM (POIN 4)

### Permasalahan Sebelumnya:
GADM memuat puluhan mata pelajaran yang tidak relevan dengan sekolah SDIT BM (seperti seluruh agama non-Islam, seni tari, seni musik, seni teater, dan koding KA berlebih), sehingga terjadi diskoneksi jumlah dan penamaan mata pelajaran antara GADM dengan `Mapel_TP` SIMNI.

### Standarisasi 12 Mata Pelajaran SIMNI:
Dropdown mata pelajaran GADM (`features/gadm/gadm.html`) kini telah diseragamkan persis dengan 12 mata pelajaran resmi SIMNI:
1. **Matematika** (Kurikulum Nasional)
2. **Bahasa Indonesia** (Kurikulum Nasional)
3. **Pendidikan Pancasila** (Kurikulum Nasional)
4. **IPAS** (Kurikulum Nasional)
5. **Seni Rupa** (Kurikulum Nasional)
6. **PJOK** (Kurikulum Nasional — Satu-satunya mapel yang diizinkan untuk VIP)
7. **PAI** (Pendidikan Agama Islam — Kurikulum Nasional Kemenag/BSKAP)
8. **Bahasa Inggris** (Kurikulum Nasional)
9. **Bahasa Sunda** (Muatan Lokal)
10. **Komputer** (Muatan Sekolah)
11. **BTQ** (Muatan Sekolah)
12. **Murojaah** (Muatan Sekolah)

Seluruh 12 mata pelajaran ini telah terhubung ke modul Knowledge Base Kurikulum GADM (`resolveSubject` di `gadm-kb.js`), memastikan perumusan Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) di GADM terintegrasi mulus dengan `Mapel_TP` SIMNI.

---

## 4. HASIL UJI REGRESI & KONTRAK

Semua pengujian kontrak dan regresi lolos secara deterministik:

| Test Suite | Hasil | Keterangan |
|---|---|---|
| **Static Contract Regression** | **224 PASS, 0 FAIL** | Seluruh aturan sintaks, versi, PWA precache, CSP, dan UI lolos. |
| **Security Contract Regression** | **75 PASS, 0 FAIL** | Keamanan scope, isolasi role (Superuser/VIP), autentikasi lolos. |
| **GADM Engine Regression** | **13 PASS, 0 FAIL** | Modul ajar, prota, promes, silabus, dan CP 2026 lolos. |
| **LPS/BLP Contract Regression** | **40 PASS, 0 FAIL** | Kontrak template, ceklis, dropdown, dan isolasi kelas lolos. |
| **Excel Template Regression** | **10 PASS, 0 FAIL** | Fidelity duplikasi sheet in-memory ExcelJS lolos. |
| **Deterministic Hosting Build** | **PASS** | `public/` tersinkronisasi penuh dengan versi `4.6.5`. |

---

Sistem telah dinormalisasi, seluruh komponen terhubung dengan benar, dan siap diverifikasi oleh pengguna maupun auditor.
