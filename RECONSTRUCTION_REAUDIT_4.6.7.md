# Rekonstruksi dan audit ulang SIMNI 4.6.7

Tanggal pekerjaan: 9–10 September 2026 (Asia/Jakarta). Status: revisi lanjutan dan audit ulang selesai untuk lingkup ini; uji mock akademik final 24 PASS / 0 FAIL. Belum merupakan penerimaan produksi seluruh fitur.

## Audit statis sebelum pengujian

Audit ulang dilakukan dengan membaca perubahan pada state/draft, presensi, jurnal/jadwal, TP/nilai, repository, sinkronisasi, feedback, tema, siswa, SW dan build script. Pada checkpoint ini belum ada aplikasi/test suite yang dijalankan.

- F01: draft di memori dipisahkan dari data tersimpan, berkunci sesi/kelas/form/tanggal/TP. Renderer mempertahankan DOM dirty dan tab; commit hanya membersihkan revision draft yang dikirim.
- F02: padding NISN pada simpan presensi dihapus. Identitas invalid/duplikat dan riwayat lintas kelas ditolak dengan alasan. Tidak ada migrasi NISN produksi.
- F03: guard binding tetap ketat, error menyebut binding. Koneksi RTDB `.info/connected` dipantau. Tidak ada pelonggaran rules RTDB akademik.
- F04: nilai kosong/invalid menjadi null, completion menggunakan nilai 0–100 yang valid. ID nilai mempertahankan key fisik; kode TP legacy tidak dipalsukan menjadi ID.
- F05: lookup TP pada kelas aktif memakai ID, edit Bab mempertahankan ID/metadata legacy. Kode/semester TP yang memiliki nilai dikunci; duplikat ditolak. Bab ditampilkan pada dropdown nilai.
- F06: key jurnal/jadwal legacy dipertahankan. Simpan membandingkan baseline record dalam transaksi; slot lain dipertahankan. Form tanpa jadwal meminta mapel nyata dan tersedia juga pada akhir pekan. Data tanpa kelas hanya dapat diatribusikan pada konteks Superuser satu kelas; data VIP tanpa kelas tidak ditebak.
- F07: tabrakan NISN ditolak; perubahan NISN lewat edit profil ditahan sampai tersedia alur koreksi referensi tersendiri.
- F08: satu popup success, error catatan/jadwal eksplisit, tema tidak mengklaim persistensi saat gagal. Error render sesudah commit dibedakan dari kegagalan commit.
- F09/F12: source menjadi 4.6.7 agar cache rilis lama tidak dipakai ulang. Build memeriksa authority dan menulis manifest SHA-256. SW menunggu tab lama ditutup dan tidak memaksa reload form.
- F10: revision cache baru diakui bila penyimpanan berhasil; retry terbatas dengan status degradasi.
- F11: revisi lanjutan dijelaskan di bawah. Bagian ini tidak lagi ditinggalkan sebagai daftar pekerjaan tanpa implementasi.

## Revisi lanjutan setelah permintaan menuntaskan temuan

Checkpoint audit ulang statis: perubahan berikut dibaca sebelum uji mock pertama. Belum ada akses database produksi, deploy, penghapusan riwayat produksi, ataupun pengujian GADM/LPS/BLP/Chat.

| Area | Implementasi dan batas yang dapat diperiksa |
|---|---|
| Pembacaan akademik | Query koleksi tahun/workspace menggunakan key dan batas 20.001 sebagai sentinel untuk maksimum 20.000 record. Snapshot di atas batas record atau 16 MiB ditolak, binding FAILED, simpan ditahan. State parsial tidak dipakai untuk menghitung ketuntasan. Ini batas operasional, bukan pemotongan riwayat diam-diam atau pagination laporan tanggal. |
| Cache akademik | Maksimum 32 MiB/snapshot dan 96 MiB database lokal; pengecekan total memakai cursor dalam transaksi write yang sama. Pengaturan → Penyimpanan perangkat menampilkan inventaris akun/workspace sendiri dan ukuran total. Cache tahun lama hanya dapat dihapus setelah ekspor JSON dipilih kembali, hash cocok, isi masih sama dalam transaksi, dan konfirmasi pengguna; cache aktif ditahan. |
| Arsip cloud | ID SHA-256 isi mencegah duplikasi snapshot identik. Metadata disimpan terpisah di `archives/_index/{tahun}` secara atomik dengan snapshot; daftar metadata 20 item, penelusuran kompatibilitas lama satu snapshot per halaman. Inventaris baru dibatasi 20 versi / 128 MiB per tahun, maksimum 32 MiB/arsip; reservasi quota memakai transaksi metadata. Pengelolaan Arsip menyediakan ekspor, verifikasi ulang berkas, dan penghapusan versi lama pilihan; snapshot aktif tetap dilindungi. Arsip legacy tidak dihapus/migrasikan otomatis dan ukuran legacy belum terhitung pada quota inventaris baru. |
| Riwayat GADM | Simpan isi identik memperbarui ID yang sama, mempertahankan createdAt. Cursor riwayat 20 metadata per halaman; isi penuh diambil per dokumen saat Buka/Ekspor. Batas dokumen 64 MiB perangkat/500 dokumen scope, draft 16 MiB perangkat. Pemilih tahun/kelas mencakup riwayat milik akun/workspace yang sama, sehingga tahun lama tetap bisa diekspor/dikelola sesudah rollover. Draft lama dapat dihapus setelah berkas ekspor dipilih kembali dan isinya masih cocok; draft aktif dipertahankan. Hanya audit statis. |
| Chat | Query latest diurutkan createdAt + ID dan berlimit; halaman riwayat lebih lama 50 pesan, kembali ke latest tanpa menumpuk DOM. Pesan dipertahankan sampai pengirim memilih ekspor/hapus; rules lokal membatasi delete pada pengirim. Kunci enkripsi tidak dibersihkan. Cleanup media R2 menyimpan cursor antarrun sehingga objek setelah 10.000 tetap terjangkau. Hanya audit statis; indeks Firestore dan perubahan rules harus dirilis bersamaan sebelum penerimaan fitur ini. |
| SW dan versi | Precache tidak lagi menunjuk mock-adapter yang sengaja tidak dikirim ke public. Kegagalan menulis runtime cache tidak menelan respons jaringan; usia cache dicek saat baca. Pengaturan kini 4.6.7 dan klaim lama “Produksi Terverifikasi” dihapus. Build memeriksa package/lock/runtime/manifest/dashboard/pengaturan/index dan menulis manifest SHA-256. |
| Jurnal/TP/presensi | Jurnal historis mempertahankan jam dan mapel meski jadwal baru berbeda; rekap/QR menggunakan kontrak kelas yang sama. Presensi menahan commit bila roster berubah ketika draft terbuka. Edit TP hanya mengirim field yang diedit sehingga metadata legacy lain tidak ditimpa. |

Kebijakan retensi dipisahkan dari tindakan penghapusan. Revisi menyediakan batas, inventaris dan alur pemilihan; tidak memilih atau menghapus data pengguna pada sesi ini. Batas numerik adalah kebijakan aplikasi yang baru dipasang, bukan hasil pengukuran database pengguna. Quota tahunan tidak membatasi total semua tahun cloud; rollover/arsip dan pengelolaan versi tetap diperlukan. Reservasi arsip akibat tab berhenti mendadak mempertahankan quota secara konservatif. Tombol Periksa reservasi tertunda menyusun ulang metadata bila snapshot ada; reservasi tanpa snapshot baru dapat dilepas setelah satu jam dan compare-and-set cocok. Tidak menghapus snapshot dalam proses ini.

Pemeriksaan statis tambahan atas riwayat GADM dan pemulihan reservasi dilakukan setelah checkpoint awal, sebelum build final dibuat. Keduanya tidak diklaim lulus uji fitur. Perubahan final source tidak dilakukan lagi setelah uji mock yang dicatat di bawah.

## Isolasi uji yang disiapkan

Fixture `qa/academic-workflow-test.mjs` memakai UI fitur asli dan repository/sync asli. Boundary Firebase SDK, client dan access context diganti hanya pada server fixture localhost; IndexedDB mock persisten mendukung read/write/update/remove/transaction/listener. CSP dan request interception menolak jaringan eksternal serta request fitur GADM, LPS/BLP dan Chat. Login Superuser/VIP sintetis berada pada fixture, bukan source produksi.

Skrip debug lama tidak dijalankan. Suite `npm run verify` dan E2E umum tidak dijalankan karena mencakup fitur yang dikecualikan. Fixture baru tidak menguji Firebase Authentication atau rules produksi; hal itu bukan klaim dari hasil mock.

## Batas rilis

Belum deploy. APK/ZIP 4.6.6 lama tidak diubah atau diberi label sebagai build baru. GADM, LPS/BLP, Chat, retensi historis cloud, dan integrasi cloud produksi belum memperoleh penerimaan runtime tahap ini. Perubahan Chat membutuhkan indeks/rules lokal yang baru; belum boleh dianggap terverifikasi hanya karena build frontend berhasil.

Kapasitas operasional akademik sekarang memiliki batas eksplisit. Bila volume nyata membutuhkan lebih dari 20.000 record per binding/tahun atau 16 MiB snapshot, aplikasi akan menahan simpan. Rancangan tahap kapasitas berikutnya adalah ringkasan ketuntasan yang terpisah dari detail dan query kelas/periode dengan penanda kelengkapan; menaikkan batas atau memakai data parsial sebagai lengkap bukan solusi. Besarnya kebutuhan tersebut belum diukur di database pengguna.

## Temuan saat uji dan koreksinya

1. Popup sukses sinkronisasi awal dapat masih terlihat ketika pengujian commit gagal dimulai. Sinkronisasi awal diubah menjadi informasi; hanya satu overlay sukses ditampilkan pada satu waktu. Commit gagal diuji ulang tanpa overlay sukses.
2. Placeholder foto profil mengarah ke layanan avatar eksternal. Diganti aset lokal agar tidak memerlukan jaringan untuk placeholder.
3. Driver QA sempat mengisi ElementHandle yang telah terlepas saat realtime mengganti DOM. Penelusuran event menunjukkan nilai tidak masuk ke form yang terpasang. Driver sekarang mencari dan mengisi field dalam satu task browser; kegagalan awal tetap tersimpan pada berkas attempt. Perlindungan aplikasi juga memeriksa nilai DOM sebelum render untuk autofill/perubahan tanpa event. Regresi delapan putaran edit cepat/autofill/konflik lulus.

## Hasil final dan bukti

- Waktu selesai mock final: 10 September 2026, 03:17:24 WIB.
- Build: **4.6.7**.
- Build ID SHA-256: `f0c4e17dc305075c2ad956cf0098eea8d9c78ed7a89f2723466811f8e1032c72`.
- `node qa/academic-workflow-test.mjs`: **24 PASS, 0 FAIL**.
- Request jaringan produksi/eksternal: **0**. Request fitur GADM/LPS/BLP/Chat: **0**. Exception browser tak terduga: **0**.
- Satu error guard kapasitas diharapkan dan diverifikasi: snapshot 20.001 record ditolak, state sebelumnya dipertahankan, write ditahan, lalu binding pulih setelah data mock dikoreksi. Error terencana ini dicatat terpisah.
- Pemeriksaan sintaks: 21 file dalam lingkup yang diizinkan, ditambah pemeriksaan ulang file terkait setelah revisi. Tidak menjalankan pemeriksaan sintaks/test suite GADM, LPS/BLP atau Chat.
- Audit artefak statis: **115** hash file cocok dengan manifest; **101** file precache tersedia; **16** file kritis source/public identik. Mock tidak terkirim ke public. Audit hash tidak menjalankan fitur yang dikecualikan.

Skenario meliputi login mock Superuser/VIP; nilai legacy null; presensi hari ini/lampau/edit/reload; draft lintas tanggal/kelas; write gagal/double-submit; NISN invalid/binding gagal; jurnal legacy/key lama/konflik/mapel historis/akhir pekan; jadwal parsial; TP tanpa Bab menjadi Bab 10 dengan ID tetap; nilai 0–100, nilai kosong, rekap edit; koneksi Firebase putus; cache oversized; ekspor/verifikasi/hapus cache lama serta isolasi akun; tampilan mobile 390×844; dan pemulihan dari overflow snapshot.

Artefak:

- [Hasil mock final](test-output/academic-4.6.7/results.json)
- [Audit hash build](test-output/academic-4.6.7/build-audit.json)
- [Manifest build](public/build-manifest.json)
- [Fixture uji akademik](qa/academic-workflow-test.mjs)
- [Bukti presensi mobile](test-output/academic-4.6.7/attendance-mobile.png), [jurnal mobile](test-output/academic-4.6.7/journal-mobile.png), [nilai mobile](test-output/academic-4.6.7/grades-mobile.png)

Hasil mock membuktikan perilaku pada data sintetis dan boundary yang dimock. Authentication, rules yang terpasang, volume data riil, aktivasi SW di perangkat pengguna, binary APK/ZIP baru, serta penerimaan fitur yang dikecualikan tetap membutuhkan tahap tersendiri. Tidak ada klaim bahwa kendala sesi produksi pengguna telah direproduksi secara langsung.
