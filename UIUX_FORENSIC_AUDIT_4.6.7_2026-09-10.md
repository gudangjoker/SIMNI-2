# Audit forensik UI/UX SIMNI 4.6.7

Tanggal: 10 September 2026. Workspace: `C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_GADM_INTEGRATION`.

**Kesimpulan: belum layak dinyatakan UX 9/10. Skor tinjauan heuristik sementara 5,9/10.** Alur simpan utama sudah berfungsi pada fixture, tetapi terdapat dua kerusakan fungsi, pemotongan kontrol di ponsel, masalah aksesibilitas, feedback koneksi yang tidak akurat, dan race pada indikator loading. Skor ini penilaian ahli berdasarkan rubrik di bawah, bukan skor kepuasan pengguna, SUS, sertifikat WCAG, atau hasil produksi.

GADM, LPS/BLP, dan Chat termasuk pengujian sesuai instruksi terbaru. Pekerjaan tahap ini berupa audit dan penambahan fixture/bukti/laporan. **Tidak ada revisi source aplikasi, build ulang, deploy, atau operasi database produksi.** Semua 115 hash file dalam manifest build masih cocok; build ID `f0c4e17dc305075c2ad956cf0098eea8d9c78ed7a89f2723466811f8e1032c72`.

## 1. Metode, cakupan, dan batas bukti

- Browser Chromium desktop headless melalui Puppeteer; viewport 320, 390, 768, 1366 CSS px; tambahan landscape 844×390 dan simulasi ukuran teks 200%. Emulasi viewport bukan pengujian perangkat fisik.
- 53 keadaan layar dalam matriks utama; 33 pemindaian axe pada matriks tersebut, ditambah pemindaian terarah untuk Pengaturan, modal siswa, nilai, dan BLP. Enam tema pada dashboard terang; satu dashboard gelap. Belum semua kombinasi tema × fitur × keadaan diuji.
- 1.633 sampel geometri kontrol, 127 identitas setelah deduplikasi ID/action/teks. Inventaris statis mencatat 174 elemen `<button>` dari HTML shell/fitur/Chat. Tombol yang dibuat lewat JavaScript tercakup sejauh keadaan runtime-nya dibuka; ini bukan klaim bahwa seluruh cabang dinamis sudah diklik.
- 30 siswa sintetis, termasuk nama panjang; 72 TP enam mapel; presensi, nilai, jurnal, GADM, LPS/BLP, dan Chat tiruan. UI, renderer, repository akademik, sinkronisasi, SW, serta kriptografi teks Chat memakai kode aplikasi; Firebase/login/membership/media/storage jaringan diganti boundary lokal. Identitas kriptografi Chat disiapkan oleh fixture sehingga alur pemulihan kunci akun tidak disertifikasi.
- Server localhost dan CSP membatasi jaringan; request interception menolak eksternal. Log seluruh fixture mencatat **0 request eksternal yang terintersep**. Tidak ada konektor produksi digunakan. Keberhasilan mock tidak membuktikan Firebase Rules, Auth, push notification, Worker/R2, atau latensi produksi.
- Semua 26 Markdown root sebelum laporan ini dibaca untuk indeks histori dan ekstraksi catatan relevan. Bukti histori terdahulu tidak diperlakukan sebagai hasil uji build sekarang. Contohnya, klaim GADM mobile lulus pada 4.6.2/4.6.3 perlu diperbarui karena hasil 4.6.7 menunjukkan overflow internal.

Status checklist: **L** = lulus dalam bukti terbatas; **P** = sebagian/risiko; **G** = gagal terbukti; **B** = belum diverifikasi. Tanda `[x]` berarti butir audit sudah ditinjau dan diberi status, bukan berarti semua lulus.

Rekap **92 butir: 22 L, 30 P, 23 G, 17 B**. Beberapa butir gagal berasal dari akar masalah yang sama; daftar temuan dikelompokkan menjadi 12 masalah, bukan 23 bug independen. Pemeriksaan akhir memastikan 33 tautan lokal laporan tersedia dan tidak ada perubahan terhadap 115 hash build yang diaudit.

## 2. Temuan yang perlu direvisi

### UX-01 — P1: Preview A4 LPS dan BLP gagal

**Reproduksi:** masuk mock → LPS/BLP → pilih siswa → pilih LPS atau BLP → Preview A4. BLP juga diuji melalui pemanggilan fungsi langsung untuk memisahkan persoalan klik dari renderer. Hasil: `Preview gagal: aspect.map is not a function`; modal tidak terbuka. LPS menghasilkan error yang sama.

**Akar masalah terkonfirmasi:** [lps-print.js](features/lps/lps-print.js:787), `renderCriteriaTable()` memeriksa `Array.isArray(aspect.options)` tetapi memanggil `aspect.map(...)`. Kontrak aspek adalah objek dengan array `options` dan `items`. Jalur cetak yang memakai `renderOutputHTML()` juga berisiko terkena renderer yang sama; dialog cetak fisik belum diuji.

**Rancangan:** perbaiki pemetaan sesuai kontrak opsi; uji aspek checklist, teks, kosong, legacy, draft, dan final. Syarat selesai: preview LPS dan BLP benar-benar terbuka dan berisi laporan, keluaran cetak sesuai preview, error tidak menggandakan toast. Ekspor Excel memakai jalur berbeda dan berhasil menghasilkan workbook 30 sheet; jangan menyimpulkan semua keluaran rusak.

### UX-02 — P1: Pengaturan memanggil fungsi yang tidak ada

**Reproduksi:** navigasi ke `pengaturan` pada keempat lebar matriks dan pengujian ulang. Hasil: `populateSettings is not defined`; `typeof populateSettings === 'undefined'`.

**Sumber:** [render.js](js/ui/render.js:119) masih memanggil `populateSettings()`. Pencarian source menemukan pemanggilan tersebut tanpa definisinya. Halaman dapat terlanjur terlihat karena navigasi mengubah visibilitas sebelum renderer melempar error; itu bukan berarti proses membuka halaman selesai sehat.

**Rancangan:** satukan kontrak render Pengaturan dengan API aktual modul settings, hilangkan pemanggilan usang, sediakan keadaan gagal yang terbaca. Verifikasi seluruh kontrol Pengaturan setelah halaman bisa dibuka tanpa error.

### UX-03 — P1: tombol hasil GADM terpotong di ponsel

Pada viewport 390, `main-scroll-area.clientWidth = 390`, tetapi `scrollWidth = 455`. Sisi kanan tombol **Simpan** dan **Unduh Excel** mencapai x=455,1. Wrapper GADM membentang dari x=-16 sampai 406. Pada form 320 dan 390 juga ada overflow internal.

Pemeriksaan `document.documentElement.scrollWidth` saja sebelumnya terlihat baik; pengukuran container dan screenshot membuktikan pemotongan. Sumber yang perlu direkonstruksi: [gadm.css](features/gadm/gadm.css:140), aturan toolbar flex, grid tombol mobile, serta margin negatif [baris 279](features/gadm/gadm.css:279). Screenshot: [hasil GADM](test-output/uiux-4.6.7/gadm-clipped.png).

**Rancangan:** lepaskan margin negatif dari kontrak shell, gunakan container `min-width:0`, toolbar mobile bertumpuk dan grid yang benar-benar muat, teks tombol boleh membungkus. Syarat: semua tindakan utama terbaca penuh tanpa scroll horizontal pada 320–430 px; scroll horizontal hanya untuk tabel/dokumen yang memang memerlukannya, dengan penanda dan akses keyboard.

### UX-04 — P1: modal siswa tidak mengelola fokus dan Escape

Klik Tambah Siswa membuka `#modal-form-siswa`, tetapi fokus tetap pada tombol di belakang modal. Modal tidak memiliki `role="dialog"` atau `aria-modal`; Escape tidak menutupnya. Close icon juga tidak memiliki nama aksesibel yang memadai pada pemindaian modal.

Sumber: [navigation.js](js/ui/navigation.js:182), [students.html](features/students/students.html:37). Pengujian memakai selector modal aktual; percobaan pertama salah menunjuk `modal-siswa` dan **dikeluarkan dari dasar temuan**. Dialog kunci Chat menggunakan native dialog: Escape menutup dan fokus kembali ke tombol kunci, sehingga pola yang sudah baik dapat dijadikan acuan.

**Rancangan:** komponen dialog bersama dengan judul terhubung, fokus awal, tab loop, background inert, Escape, serta pengembalian fokus. Terapkan juga ke drawer dan modal custom lain dengan regresi tiap jenis.

### UX-05 — P1: label dan kontras belum memenuhi pemeriksaan aksesibilitas

Contoh terkonfirmasi dari axe:

| Area | Bukti |
|---|---|
| Presensi | Field tanggal/radio atau input tertentu tidak bernama secara aksesibel. Radio 16×16 tidak dibungkus label pada sampel; target efektif dan pengecualian jarak masih harus diperiksa. |
| Nilai | `filter-mapel-nilai` dan `filter-tp-nilai` memicu `select-name`. |
| Jurnal / Catatan | Label visual tidak selalu terhubung ke input; sebagian selector Catatan tidak bernama. |
| LPS/BLP berisi siswa | Select respons dinamis tidak bernama; BLP memiliki input respons teks tanpa label. Tampilan kosong sebelumnya lolos sehingga tidak boleh dijadikan bukti seluruh formulir aksesibel. |
| GADM | `gadm-seed` visually hidden tetapi tetap input tanpa label; kartu `role=radio` memiliki turunan yang dapat difokuskan (`nested-interactive`). |
| Dashboard | “Database Aktif & Aman” kontras 3,65:1. |
| Chat | Nama rekan 3,34:1; status header 2,84:1; status sukses 3,02:1. |
| BLP | Tombol Ekspor Excel putih pada hijau sekitar 2,53:1. |

**Rancangan:** ID/label unik termasuk baris siswa dan butir dinamis, fieldset/legend untuk kelompok radio, input internal menjadi hidden yang tepat, kartu pilihan satu target interaksi, token warna foreground/background teruji. Target teks normal 4,5:1; teks besar 3:1, dengan penerapan kategori yang benar. Rasio dan selector lengkap ada pada JSON axe; jangan hanya mengganti warna dari penampilan subjektif.

### UX-06 — P1: status koneksi memberi jaminan yang tidak benar

Sesudah `QAMock.connected=false` dan browser offline, tombol dashboard masih memunculkan sukses **“Sistem Realtime Firebase terhubung otomatis dan terlindungi.”** Chat tetap menunjukkan **“Online · Terenkripsi end-to-end”** saat `navigator.onLine=false`.

Sumber dashboard: [dashboard.html](features/dashboard/dashboard.html:7). Chat mengisi label tetap saat sesi siap: [chat-ui-handler.js](chat/js/chat-ui-handler.js:701).

**Rancangan:** pisahkan status koneksi perangkat, koneksi layanan, data terakhir tersinkron, draf lokal, dan hasil commit. Status keamanan tidak boleh menjadi sinonim koneksi berhasil. Tampilkan waktu sinkronisasi terakhir dan alasan simpan ditahan. Ini tidak membuktikan enkripsi Chat rusak; masalahnya adalah kebenaran feedback kepada pengguna.

### UX-07 — P1: timer loading lama menyembunyikan operasi baru

**Reproduksi terisolasi:** `showLoad(A)` → `hideLoad()` → 150 ms → `showLoad(B)` → 200 ms. Label masih “Operasi B masih berjalan”, tetapi overlay memiliki `hidden=true`, `display=none`.

Sumber: [feedback.js](js/ui/feedback.js:18). Timeout penutupan A tidak dibatalkan ketika B dimulai.

**Rancangan:** satu lifecycle indikator dengan token operasi atau penghitung operasi aktif, pembatalan timer lama, delay tampil singkat untuk operasi cepat, durasi tampil minimum bila sudah terlihat. Perintah B tidak boleh disembunyikan oleh timer A. Jangan sekadar memperpanjang timeout.

### UX-08 — P2: popup sukses terlalu dominan untuk pekerjaan berulang

Sukses membuat overlay gelap/blur **390×844**, menutupi konteks selama 1,5 detik lalu fade 300 ms. `pointer-events:none` membuat interaksi dapat menembus overlay. Tombol simpan akademik memiliki guard, tetapi secara visual halaman tampak tertutup padahal kontrol lain masih bisa menerima klik.

Sumber: [feedback.js](js/ui/feedback.js:46). Popup muncul lalu hilang merupakan perilaku desain yang disengaja, bukan dengan sendirinya bukti commit gagal. Uji presensi menunjukkan gagal tidak menghasilkan success; sukses menghasilkan satu overlay dan tombol berubah menjadi Edit Kehadiran.

**Rancangan:** status sukses inline di dekat aksi + snackbar kecil nonblocking, waktu simpan jelas. Error penting tetap tersedia sampai diperbaiki/ditutup dan memiliki langkah pemulihan; jangan hanya pesan teknis yang hilang dalam 3 detik. Gunakan dialog hanya untuk keputusan yang membutuhkan respons.

### UX-09 — P2: bootstrap belum sesuai target sangat ringan

[feature-loader.js](js/core/feature-loader.js:59) memasukkan QR scanner, XLSX, ExcelJS, html2pdf, ZIP, dan semua runtime umum; [baris 145](js/core/feature-loader.js:145) memuat script berurutan. Pustaka ekspor sudah dibayar saat baru masuk dashboard.

**Rancangan:** shell/data/dashboard sebagai jalur awal; impor berbagi Promise per fitur saat dibutuhkan. Prioritaskan satu engine spreadsheet bila kontrak memungkinkan, pecah PDF/QR/OCR dari jalur login, muat sisanya ketika idle atau saat pengguna membuka fitur. Tetap pertahankan strategi unduh paket offline yang eksplisit agar optimasi jaringan tidak menghilangkan fitur offline tanpa pemberitahuan.

### UX-10 — P2: LPS mempunyai dua jalur event untuk aksi yang sama

HTML memuat `data-simni-action` dan `data-lps-action`; dispatcher umum dan [bindLPSDOMEvents](features/lps/lps.js:6689) sama-sama mendengarkan klik. Satu klik Preview BLP menghasilkan dua pesan error yang sama, kemudian pemanggilan langsung tambahan menghasilkan satu lagi. Guard busy membantu beberapa operasi, tetapi bukan kontrak event tunggal.

**Rancangan:** satu pemilik event LPS, semua aksi meneruskan konteks dan status yang sama; uji satu klik menghasilkan tepat satu pekerjaan, satu perubahan state, dan satu feedback untuk sukses maupun gagal.

### UX-11 — P2: Chat belum konsisten dan tombol panggilan menjanjikan fungsi yang belum ada

Tombol suara/video tampak aktif, tetapi hanya menampilkan penjelasan teknis bahwa infrastruktur WebRTC masih disiapkan. Kontrol **Halaman lebih lama**, **Kembali ke terbaru**, dan **Ekspor / hapus pesan** memakai tampilan tombol browser biasa; tombol ekspor/hapus membesar di sebelah gelembung pesan. [Screenshot](test-output/uiux-4.6.7/chat-message-390.png).

**Rancangan:** status fitur “Segera tersedia” yang jelas atau sembunyikan sampai siap; microcopy berbasis kebutuhan pengguna. Riwayat menjadi toolbar kecil, tindakan pesan menjadi menu berlabel dengan fokus yang benar dan konfirmasi terukur. Pertahankan kriptografi dan perlindungan draf yang sudah terbukti.

### UX-12 — P2: ukuran sentuh dan gerakan belum konsisten

Hamburger 32×32; beberapa close 32×32; banyak tab/tombol 34–42 px. Form nilai sekitar 39 px dan banyak kontrol LPS sekitar 41 px. Ini belum mencapai target ergonomi desain 44×44 yang disarankan untuk aksi sentuh utama. **Ukuran <44 tidak otomatis gagal WCAG AA**; minimum 24 CSS px memiliki pengecualian, termasuk jarak dan ekuivalensi. Radio 16 px memerlukan pemeriksaan efektif target/spacing, bukan vonis dari kotaknya saja.

`prefers-reduced-motion:reduce` masih menyisakan `fadeIn` 0,4 detik pada view. [shell.css](js/ui/shell.css:711) hanya mematikan animasi orb login dalam aturan tersebut. Simulasi teks 200% pada 320 menghasilkan container utama 366 px; perlu tinjau reflow nyata pada browser zoom/perangkat.

**Rancangan:** token tinggi kontrol dan spacing, area klik diperluas tanpa membuat ikon besar, respons hover/focus/pressed/disabled/busy konsisten, reduced-motion global untuk transisi nonesensial. Uji 200% teks dan 400% zoom dengan konten nyata.

## 3. Bukti fungsi dan performa

| Skenario | Hasil audit |
|---|---|
| Presensi gagal lalu berhasil | Draf tetap ada; gagal tidak memunculkan sukses; commit berhasil, satu overlay, tombol menjadi Edit Kehadiran. |
| Nilai TP | Nilai 85 tersimpan ke mock; form terisi dipindai aksesibilitas. |
| Jurnal tanggal lampau | Materi/refleksi tersimpan; satu record jurnal. |
| LPS dan BLP draft | Catatan bertahan setelah pindah siswa lalu kembali, terpisah menurut jenis laporan. |
| Preview LPS/BLP | Gagal, UX-01; bukan hasil pass. |
| BLP Excel | File 400.173 byte dibuka dengan ExcelJS; 30 worksheet. Ini validasi struktur, belum perbandingan visual setiap sel/hasil cetak. |
| GADM Modul Ajar | Generate/preview/simpan dijalankan. Word 13.275 byte dan XLSX 33.630 byte terunduh; PDF teramati 3.092.268 byte berawalan `%PDF`, sekitar 7,6 detik. Keindahan seluruh halaman cetak dan semua jenis dokumen belum disertifikasi. |
| Chat teks | Pesan berhasil dienkripsi, dikirim melalui adapter dan ditampilkan; payload mock tidak mengandung teks terang pesan uji. |
| Chat gagal | Draft teks tetap; unggah tiruan gagal memberi alasan, composer kembali aktif. Sukses unggah media asli/rekaman mikrofon belum diuji. |
| Chat dialog kunci | Escape menutup; fokus kembali ke tombol kunci. Pemulihan identity akun bukan cakupan bukti ini. |
| Offline warm/cold | Halaman presensi dapat dibuka offline dan sesi mock pulih sesudah reload melalui SW. Status koneksi terpisah tetap bermasalah, UX-06. |

Performa bersifat **sampel laboratorium**, bukan persentil ke-75 pengguna nyata:

| Ukuran | Lokal tanpa throttle | Profil CDP CPU 4×, latensi 150 ms |
|---|---:|---:|
| Navigasi awal → auth mock siap | 1,071 s | 4,762 s |
| Pemanggilan login mock → workspace siap | 1,200 s | 3,177 s |
| Long task terbesar | 164 ms | 640 ms |
| LCP observer dokumen | 3,500 s | 2,580 s |
| CLS observer | 0 | 0 |

LCP mencakup pergantian login ke workspace dalam dokumen yang sama; angka throttle dapat tampak lebih kecil karena kandidat LCP/akhir observasi berbeda. SW dapat melayani asset dari cache dan throttle CDP pada halaman bukan emulasi seluruh worker/jaringan perangkat. Karena itu angka ini **tidak boleh** disebut jaminan “koneksi 1,6 Mbps selesai dalam X detik”. Satu sampel tiap profil juga tidak cukup untuk menyatakan kestabilan.

Pergantian view ke dua frame berikutnya umumnya 14,7–58,9 ms; kembali ke dashboard sesudah rangkaian fitur mencapai 271,5 ms. Pengukuran ini belum menunggu seluruh lazy mount selesai dan **bukan INP**. Animasi view tetap 400 ms. Klaim “super mulus” belum terpenuhi tanpa pengukuran distribusi interaksi, frame drops, dan perangkat kelas rendah.

Ukuran asset dan penyimpanan:

- `public/`: 116 file termasuk build-manifest, total **13.799.614 byte (13,16 MiB)**. Estimasi gzip offline seluruh berkas 5.583.579 byte; bukan ukuran transfer hosting yang dibuktikan.
- Precache source: 101 file, **7.426.670 byte (7,08 MiB)**. Fixture cache terpasang 102 entry/7.021.621 byte karena URL navigasi dan substitusi boundary; jangan menyamakan besar fixture dengan produksi.
- Tiga library XLSX/ExcelJS/html2pdf masing-masing sekitar 0,95 MB mentah. Tesseract core 4,73 MB merupakan aset tambahan; bukan seluruhnya bagian precache awal.
- SW membatasi cache runtime gambar/font: 64 entry, 16 MiB, 2 MiB/item, TTL 7 hari. Asset app/OCR memiliki jalur cache sendiri; batas runtime **bukan** batas total storage aplikasi.
- Satu census fixture: estimasi penggunaan browser 14,15 MB, termasuk overhead cache/indexedDB/SW. Ini bukan ukuran database pengguna dan bukan proyeksi pertumbuhan tahunan.
- Batas snapshot/database lokal yang sudah direvisi pada audit sebelumnya tetap relevan. Belum ada soak test berbulan-bulan, simulasi storage eviction/low-disk, atau pengukuran data produksi; tidak ada dasar untuk menjamin bebas pembengkakan jangka panjang hanya dari satu sesi.

## 4. Checklist audit UI/UX

### A. Arsitektur informasi dan navigasi

- [x] **L** Nama fitur utama dapat ditemukan melalui shell/dashboard/drawer pada fixture.
- [x] **P** Hierarki dashboard jelas; GADM/Chat/LPS memiliki pola antarmuka berbeda (UX-11).
- [x] **G** Navigasi Pengaturan selesai tanpa exception (UX-02).
- [x] **P** Penanda view aktif tersedia secara visual; pengumuman perpindahan dan fokus heading belum menyeluruh.
- [x] **P** Navigasi keyboard perlu perbaikan modal/drawer (UX-04).
- [x] **B** Back/forward/history/deep-link setiap fitur belum diuji menyeluruh.
- [x] **P** Konsistensi masuk/keluar fitur lazy; LPS unmount ketika pindah perlu regresi state.
- [x] **B** Efisiensi pencarian fitur melalui pengujian pengguna baru belum diukur.

### B. Tombol dan interaksi

- [x] **P** Inventaris 174 button statis dan 127 identitas kontrol runtime tersedia; cabang dinamis belum semuanya diklik.
- [x] **G** Semua tombol utama terlihat penuh pada ponsel: gagal GADM (UX-03).
- [x] **P** Area sentuh 44 px konsisten: banyak kandidat perbaikan (UX-12).
- [x] **P** Minimum 24 px/spacing diperiksa sebagai kandidat; pengecualian WCAG per radio belum diselesaikan.
- [x] **P** Nama aksi umumnya jelas; ikon close/modal dan beberapa kontrol perlu label.
- [x] **P** Hover/focus/pressed/disabled/busy memakai beberapa pola, belum satu sistem.
- [x] **L** Simpan akademik teruji menghasilkan perubahan data dan feedback sesuai sukses/gagal.
- [x] **G** Satu klik satu feedback pada Preview LPS: terduplikasi (UX-10).
- [x] **G** Tombol panggilan Chat menyampaikan kesiapan fungsi secara jujur (UX-11).
- [x] **B** Semua aksi destruktif, ekspor, impor, dan varian peran belum diulang seluruhnya pada audit ini.

### C. Responsivitas dan visual

- [x] **L** Shell utama tidak menunjukkan overflow dokumen pada matriks 320/390/768/1366.
- [x] **G** Overflow container internal dan kontrol GADM (UX-03).
- [x] **P** Landscape drawer tampil; fokus dan keyboard perlu perbaikan.
- [x] **G** Simulasi teks 200% menghasilkan overflow internal 366 pada viewport 320.
- [x] **B** Zoom browser 400%, keyboard virtual, safe area iPhone, notch, dan foldable belum diuji fisik.
- [x] **L** Nama siswa panjang masuk ke tampilan LPS/BLP tanpa memecah lebar dokumen utama pada sampel.
- [x] **P** Tipografi/hierarki umumnya terbaca tetapi label 10–12 px padat di beberapa modul.
- [x] **G** Kontras dashboard/Chat/BLP/GADM memiliki kegagalan terukur (UX-05).
- [x] **P** Enam tema dan mode gelap tersedia; bukti saat ini belum seluruh kombinasi fitur/keadaan.
- [x] **G** Tombol riwayat/tindakan Chat menyatu secara estetis dengan komponen lain (UX-11).

### D. Aksesibilitas

- [x] **L** Bahasa dokumen Indonesia dan meta viewport ada.
- [x] **P** Heading dan landmark tersedia; struktur semua modal/dynamic view belum konsisten.
- [x] **G** Label field dinamis, tanggal, select, dan kelompok radio lengkap (UX-05).
- [x] **G** Kontrol pilihan GADM bebas nested interactive (UX-05).
- [x] **G** Dialog siswa memiliki semantics, fokus awal, dan Escape (UX-04).
- [x] **L** Dialog kunci Chat menutup via Escape dan mengembalikan fokus.
- [x] **P** Tab order/focus visibility/focus tidak tertutup perlu audit semua overlay setelah rekonstruksi.
- [x] **L** Feedback memiliki live region status/alert pada implementasi inti dan Chat.
- [x] **G** Reduced-motion mematikan gerakan nonesensial secara menyeluruh (UX-12).
- [x] **B** Screen reader NVDA/TalkBack/VoiceOver belum diuji; axe bukan penggantinya.

### E. Form, validasi, dan ketahanan data

- [x] **L** Presensi gagal mempertahankan draf dan tidak mengumumkan sukses.
- [x] **L** Presensi sukses beralih ke Edit Kehadiran.
- [x] **L** Nilai TP dapat diisi dan tersimpan pada fixture.
- [x] **L** Jurnal lampau dapat diisi dan tersimpan pada fixture.
- [x] **L** Draf LPS dan BLP bertahan setelah pergantian siswa.
- [x] **P** TP legacy/Bab memiliki hasil mock 24-pass audit sebelumnya; kombinasi UI baru seluruh Bab belum diulang.
- [x] **P** Dirty-draft guard aktif; sempat menahan navigasi driver yang menolak beforeunload, bukan dianggap crash aplikasi.
- [x] **P** Error field/summary/pemulihan masih mengandalkan toast sementara/teks teknis.
- [x] **B** Undo/hapus massal/reset/arsip dan migrasi peran/tahun belum diuji ulang seluruhnya.
- [x] **B** IME, autofill perangkat, input suara, dan input locale lain belum diuji pada audit ini.

### F. Feedback dan loading

- [x] **G** Kebenaran status dashboard saat database offline (UX-06).
- [x] **G** Kebenaran label Online Chat saat browser offline (UX-06).
- [x] **L** Keberhasilan dan kegagalan simpan akademik dapat dibedakan pada fixture.
- [x] **G** Operasi loading bertumpuk bebas race timer (UX-07).
- [x] **P** Popup sukses tidak mengganggu pekerjaan berulang: overlay penuh masih dominan (UX-08).
- [x] **P** Durasi error memberi waktu membaca/mengambil tindakan: 3 detik tanpa riwayat persisten.
- [x] **G** Error Preview LPS tidak berulang dari satu klik (UX-10).
- [x] **B** Cancel/retry/resume seluruh operasi panjang belum diuji satu per satu.

### G. Kinerja dan transisi

- [x] **G** Dashboard hanya memuat kebutuhan awal: vendor ekspor dimuat sebelum dibutuhkan (UX-09).
- [x] **P** Navigasi hangat umumnya cepat; ada sampel 271,5 ms dan lazy-ready belum seluruhnya diukur.
- [x] **G** Tidak ada long task berat pada profil CPU lambat: maksimum 640 ms.
- [x] **L** Tidak ditemukan layout shift terukur dalam dua sampel startup terarah; bukan jaminan semua keadaan.
- [x] **P** Distribusi payload dan cache dihitung; ukuran transfer produksi/compression belum diverifikasi.
- [x] **B** Core Web Vitals p75 lapangan belum tersedia.
- [x] **B** Frame drops, battery drain, thermal throttling, dan perangkat RAM rendah belum diuji.
- [x] **B** Stress ribuan siswa/TP dan ekspor sangat besar belum diuji pada audit UI/UX ini.

### H. Offline, sinkronisasi, dan PWA

- [x] **L** Warm offline dan reload offline mock memuat aplikasi.
- [x] **P** Salinan data lokal tersedia; kebenaran status koneksi perlu UX-06.
- [x] **L** Versi 4.6.7 dan 115 hash manifest cocok pada akhir audit.
- [x] **L** Cache runtime memiliki batas jumlah/ukuran/umur pada source.
- [x] **P** Total storage mencakup cache app/OCR/database, bukan hanya batas runtime.
- [x] **B** Eviction, quota penuh, private mode, dan izin persistent storage belum disimulasikan lengkap.
- [x] **B** Pembaruan SW lintas beberapa versi/dua tab/rollback belum diuji ulang di sini.
- [x] **B** Longevity cache/cloud bertahun-tahun belum dibuktikan dengan soak/volume nyata.

### I. GADM, LPS/BLP, dan Chat

- [x] **L** GADM Modul Ajar dapat dibuat dan disimpan di fixture.
- [x] **L** GADM Word/XLSX terunduh; PDF teramati menghasilkan signature valid.
- [x] **G** Toolbar GADM mobile muat tanpa scroll horizontal (UX-03).
- [x] **B** Seluruh jenis dokumen, riwayat/paging, cetak fisik, dan fidelity setiap halaman belum disertifikasi.
- [x] **L** BLP Excel dibuka kembali dan memuat 30 sheet.
- [x] **G** Preview LPS/BLP berfungsi (UX-01).
- [x] **L** Chat teks terenkripsi tampil dan kegagalan mempertahankan draf.
- [x] **L** Kegagalan unggah mock memberi pesan dan memulihkan composer.
- [x] **B** Media sukses, rekaman mikrofon, push background, dan login akun Chat asli belum diuji.
- [x] **G** Kesiapan panggilan, tampilan riwayat, dan status Chat akurat/konsisten (UX-06/11).

### J. Heuristik, bantuan, dan penerimaan

- [x] **G** Visibility of system status: koneksi dan loading belum dapat dipercaya sepenuhnya.
- [x] **P** Match with real world: istilah WebRTC/engine/KB/quality sebaiknya dijauhkan dari keputusan pengguna biasa.
- [x] **P** User control/freedom: dialog custom dan alur keluar perlu revisi fokus/Escape.
- [x] **G** Consistency/standards: Chat, modal, dan tombol belum konsisten.
- [x] **P** Error prevention: guard data ada, tetapi dua jalur event LPS perlu disatukan.
- [x] **P** Recognition rather than recall: label dinamis/aksi belum lengkap.
- [x] **P** Flexibility/efficiency: draf dan ekspor membantu, payload dan popup menghambat kerja berulang.
- [x] **P** Aesthetic/minimalist design: dashboard cukup jelas; area hasil GADM/Chat perlu penyederhanaan.
- [x] **P** Help users recover: draf dipertahankan; pesan teknis belum selalu memberi tindakan pemulihan.
- [x] **B** Help/documentation dan kepuasan guru: perlu uji tugas nyata dan validasi panduan dengan pengguna.

## 5. Rubrik skor dan gerbang menuju 9/10

| Dimensi | Bobot | Skor sementara /10 | Dasar |
|---|---:|---:|---|
| Keberhasilan alur utama | 15% | 7 | Simpan dan beberapa ekspor berhasil; Preview/Pengaturan gagal. |
| Responsivitas | 15% | 6 | Mayoritas shell muat; GADM dan pembesaran teks bermasalah. |
| Aksesibilitas | 15% | 4 | Label, kontras, dialog, nested control. |
| Feedback/loading | 10% | 5 | Feedback commit benar; status koneksi/race/popup bermasalah. |
| Performa | 15% | 5 | Vendor eager dan long tasks; belum ada bukti lapangan. |
| Offline/ketahanan | 10% | 7 | Reload mock berhasil, batas cache ada; state/status perlu revisi. |
| Konsistensi visual | 8% | 7 | Dasar dashboard baik; Chat dan toolbar berbeda. |
| Navigasi | 5% | 6 | Fitur dapat ditemukan; Pengaturan/fokus menghambat. |
| Form/pemulihan draf | 5% | 8 | Draf akademik/LPS/Chat terjaga pada skenario uji. |
| Bantuan/microcopy | 2% | 6 | Sebagian label teknis dan belum diuji pengguna. |

Jumlah tertimbang **5,88 → 5,9/10**. Bobot/skor adalah keputusan reviewer yang dinyatakan terbuka; bukan hasil statistik populasi. Tidak menambahkan nilai karena jumlah test banyak.

**Gerbang penerimaan target 9/10:**

1. Semua P1 di atas ditutup, tanpa error pembuka Pengaturan/Preview LPS/BLP dan tanpa kontrol utama terpotong.
2. Tugas simpan/edit/pemulihan utama berhasil 100% pada fixture yang disepakati; tidak ada double execution atau sukses palsu.
3. Tidak ada pelanggaran aksesibilitas A/AA serius/kritis pada seluruh keadaan penting; keyboard dan screen reader lulus pemeriksaan manual. Penilaian WCAG lengkap tetap memerlukan review per kriteria.
4. Target sentuh utama 44 px, seluruh fungsi muat 320–430 px, dialog aman untuk fokus, reflow dan keyboard virtual diuji.
5. Sasaran rekayasa: shell awal ≤300 KB gzip JS sebagai anggaran awal yang perlu disepakati, vendor ekspor dimuat sesuai kebutuhan; transisi hangat ke view siap p95 ≤150 ms pada perangkat acuan; feedback awal ≤100 ms. Angka ini sasaran desain, belum hasil aplikasi.
6. Ukur Web Vitals lapangan: LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1 pada p75 mobile/desktop; uji perangkat rendah dan koneksi nyata secara terpisah dari fixture.
7. Guru mengerjakan tugas presensi, nilai, jurnal, GADM, LPS/BLP, dan Chat: target ≥95% penyelesaian tanpa bantuan pada tugas inti, tanpa kesalahan kritis. Lakukan putaran kualitatif kecil dahulu, lalu evaluasi kuantitatif yang memadai. Skor 9/10 harus didukung rubrik ulang dan bukti pengguna; skor 10/10 tidak dapat dijanjikan sebelum validasi.

## 6. Rancangan rekonstruksi dan urutan kerja

**Tahap 1 — pulihkan kontrak fungsi dan status.** UX-01, 02, 06, 07, 10. Pusatkan event/action dan status operasi. Pisahkan `idle → validating → saving → saved/error` dari status jaringan. Jangan mengubah data pengguna untuk memperbaiki UI. Hasil yang direview: patch kecil, reproduksi sebelum/sesudah, checklist penerimaan per temuan.

**Tahap 2 — bangun komponen UI bersama.** Button, icon button, field/label/error, radio group, dialog, drawer, toast, status koneksi. Token ukuran, warna, spacing, tipografi, fokus, dan motion berlaku di SIMNI/GADM/LPS/Chat. Pertahankan identitas visual yang sudah baik sambil menghapus variasi perilaku.

**Tahap 3 — rapikan layout dan alur.** GADM form/hasil dan action bar yang muat ponsel; LPS/BLP form panjang dipecah ke bagian dengan status kelengkapan; menu tindakan Chat dan riwayat yang ringkas. Gunakan prototipe kecil pada data panjang sebelum menerapkan seluruh halaman.

**Tahap 4 — kurangi biaya awal.** Profil dependency, lazy loader vendor dengan deduplikasi Promise, pemrosesan berat bertahap/worker bila perlu, perencanaan paket offline. Pisahkan anggaran cache shell, fitur, media, dan data; perbarui indikator penyimpanan serta mekanisme pemulihan quota.

**Tahap 5 — audit ulang lalu uji penerimaan.** Audit source sebelum menjalankan regresi, kemudian mock semua fitur termasuk GADM/LPS/BLP/Chat, matriks viewport/tema/keyboard, error/offline, volume besar, update SW, dan pemeriksaan dokumen. Terakhir perangkat nyata serta uji guru; produksi tetap memerlukan validasi integrasi tersendiri.

## 7. Koreksi fixture dan batas klaim

- Temuan awal `aria-hidden-focus` pada link Chat desktop berasal dari mock yang tidak menghapus `aria-hidden=true` ketika memberi akses. Fixture disamakan dengan kontrak aplikasi; pengujian ulang desktop menghilangkan pelanggaran tersebut. **Tidak dimasukkan sebagai bug produk.**
- Selector modal siswa awal salah; uji terarah memakai `modal-form-siswa` dan membuktikan masalah sebenarnya.
- Selector jurnal `.j-keg` tidak ada; diganti `.j-ket` hanya dalam driver lalu uji berhasil. **Bukan bug jurnal.**
- Dua `ERR_ABORTED` pada navigasi driver pertama terkait draf/beforeunload yang ditolak driver. Pengujian terisolasi berikutnya berhasil membuka halaman; **bukan crash produk.**
- Pemindaian axe pada run utama dapat menambah long task; tabel performa mengambil run terpisah sebelum axe, bukan angka run utama yang tercampur.
- Hasil `OBSERVED` dalam JSON artinya skenario dieksekusi dan bukti dicatat, bukan otomatis PASS. Preview BLP yang awalnya belum terlihat ditindaklanjuti dengan await dan pemanggilan langsung; error renderer sekarang terkonfirmasi.
- Suite ini tidak mengklaim setiap tombol/varian/perangkat sudah lolos. Item B merupakan pekerjaan validasi lanjutan yang eksplisit, bukan diam-diam dianggap selesai.

## 8. Artefak dan acuan

- [Ringkasan integritas/ukuran](test-output/uiux-4.6.7/summary.json).
- [Matriks layar, geometri, dan axe](test-output/uiux-4.6.7/results.json).
- [Uji terarah dan performa](test-output/uiux-4.6.7/focused.json), [uji lanjutan](test-output/uiux-4.6.7/followup.json), [renderer/ekspor](test-output/uiux-4.6.7/output-checks.json), [race loading dan LPS](test-output/uiux-4.6.7/feedback-checks.json).
- [Inventaris kontrol terbaca](test-output/uiux-4.6.7/CONTROL_INVENTORY.md), [geometri terdeduplikasi](test-output/uiux-4.6.7/control-inventory.json), [174 button HTML beserta file/baris](test-output/uiux-4.6.7/source-buttons.json).
- [Validasi workbook BLP](test-output/uiux-4.6.7/excel-validation.json), [indeks histori 26 Markdown](test-output/uiux-4.6.7/history-index.json).
- Screenshot utama: [dashboard](test-output/uiux-4.6.7/dashboard-390.png), [modal siswa](test-output/uiux-4.6.7/student-modal.png), [GADM](test-output/uiux-4.6.7/gadm-clipped.png), [BLP](test-output/uiux-4.6.7/blp-preview-awaited.png), [Chat](test-output/uiux-4.6.7/chat-message-390.png), [popup sukses](test-output/uiux-4.6.7/success-feedback-390.png).
- Fixture terisolasi: `qa/uiux-*.mjs` dan `qa/uiux-*-mock.js`; tidak masuk `public/`. Server hanya hidup selama pengujian dan sudah ditutup.

Checklist mengacu pada [WCAG 2.2](https://www.w3.org/TR/WCAG22/), dengan pembacaan target minimum dan pengecualiannya pada [W3C Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). Kinerja mengikuti definisi [Core Web Vitals](https://web.dev/articles/vitals) dan [ambang metrik](https://web.dev/articles/defining-core-web-vitals-thresholds), tanpa menyamakan lab dengan lapangan. Kerangka usability memakai [10 heuristik Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) dan batas [heuristic evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/).
