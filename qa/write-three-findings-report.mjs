import {readFile,writeFile} from 'node:fs/promises';
const evidence=JSON.parse(await readFile('test-output/three-findings/final-evidence.json','utf8'));
if(evidence.localGate!=='PASS') throw Error('Cannot publish completion report without passing evidence');
const count=name=>evidence.evidence[name].checks;
const report='AUDIT_PENUTUPAN_3_TEMUAN_4.7.2_2026-09-14.md';
const lines=[
'# Penutupan S07, S02, dan S05 — SIMNI 4.7.2',
'',
'Tanggal: 14 September 2026. Status: **ketiga temuan selesai pada source dan pengujian lokal**. Perubahan ini **belum diterapkan ke produksi**. Instruksi terakhir adalah menyelesaikan tiga temuan sebelum deployment.',
'',
`Build ID: \`${evidence.buildId}\`. Hosting: ${evidence.hostingFiles} berkas, ${evidence.hostingBytes.toLocaleString('en-US')} byte. Versi package, lockfile, manifest, runtime, dashboard, settings, dan SW selaras pada 4.7.2.`,
'',
'## Hasil audit ulang',
'',
'| Temuan | Sebelumnya | Perbaikan dan bukti | Status |',
'|---|---|---|---|',
'| S07 — purge dan pertumbuhan cache | Purge menghapus app-shell/cache lain; runtime cache tidak dibatasi | Purge hanya nama simni-runtime; maksimum 64 entri, 16 MiB, umur 7 hari. Uji konkuren, kuota penuh, kedaluwarsa, dan pelestarian cache app/asing lulus | Selesai lokal |',
'| S02 — kapasitas sinkronisasi | Koleksi di atas 20.000 record atau 16 MiB membuat sinkronisasi wajib gagal dan memblokir write | Listener memakai rentang key hidup dengan query maksimal 1.001 record; rentang dibagi saat penuh. Publikasi menunggu seluruh rentang lengkap. Uji 25.001 record di atas 16 MiB, perubahan batas, error/pemulihan, cleanup listener, serta key numerik RTDB lulus. Browser membuktikan presensi tetap dapat ditulis pada koleksi nilai 20.001 record | Selesai lokal |',
'| S05 — audit administratif | Klien dapat menulis committed tanpa menjalankan perubahan | Klien tidak boleh menulis receipt. Worker menjalankan PATCH dengan ID token pengguna; rules tetap memvalidasi data. Receipt berasal dari server, memakai operation ID, hash permintaan/perubahan, dan bukti acknowledgement atau marker atomik. Uji pemalsuan, schema ditolak, retry, 502, kehilangan acknowledgement/receipt, arsip, dan rollover lulus | Selesai lokal |',
'',
'## Detail yang penting',
'',
'- **Cache:** app-shell aktif dan cache aplikasi lain tidak dihapus oleh purge aman. Cache runtime membuang entri lama sebelum menyimpan entri baru. Kegagalan quota cache tidak menggagalkan respons jaringan yang valid. Batas di atas berlaku untuk cache runtime, bukan keseluruhan penyimpanan browser.',
'- **Sinkronisasi:** tidak ada hasil sebagian yang diberi label lengkap. Rentang key tetap mencakup insert/delete di batas halaman; listener/timer dilepas saat teardown. Batas 16 MiB untuk satu record tetap berlaku. Semua data tahun aktif masih digabungkan di memori untuk UI lama; ini bukan klaim memori konstan atau data tanpa batas. Snapshot offline 32 MiB dan batas penyimpanan 96 MiB tetap berlaku; jika cache menolak snapshot, penulisan cloud tetap bisa berlangsung dan pengguna menerima peringatan tentang salinan offline.',
'- **Audit:** PATCH data dan marker nonce dilakukan atomik menggunakan identitas pengguna. Receipt, status selesai, dan penghapusan marker ditulis pada PATCH server berikutnya. Seluruh alur bukan satu transaksi tunggal lintas dua identitas. Jika tahap kedua gagal, server memulihkan receipt dari marker tanpa mengulang perubahan. Tanpa marker yang bisa membuktikan commit, status tetap pending untuk pemeriksaan operator.',
'- **Retry:** identitas disimpan sebelum request. Respons 502/hasil jaringan tidak pasti mempertahankan ID. Permintaan dengan isi berbeda tidak otomatis mengeksekusi perubahan ketika masih ada operasi tertunda. Reservasi hanya menyimpan metadata/hash/receipt, bukan salinan seluruh payload restore. Log/reservasi dipertahankan untuk audit dan idempotensi; jangan menghapusnya otomatis hanya untuk membebaskan ruang.',
'- **Arsip:** emulator mengungkap bahwa RTDB menghapus objek kosong dan dapat mengubah struktur key numerik. Arsip baru disimpan sebagai JSON dalam potongan string (`json-chunks-v1`), lalu didekode oleh repository. Uji read-back mempertahankan objek kosong, array kosong, null, key numerik, dan SHA-256. Pembaca tetap mendukung arsip object lama; tidak ada migrasi massal database cloud.',
'- **Chat:** tetap tidak berada dalam source/Hosting SIMNI. Worker baru adalah layanan aset dan operasi administratif SIMNI; Worker/data Chat lama tidak diubah.',
'',
'## Verifikasi',
'',
`- **${evidence.suites}/${evidence.suites} suite kumulatif PASS** pada satu build ID. Pemeriksaan checksum menolak artefak yang berbeda dari source.`,
`- Cache/kapasitas: ${count('cacheAndCapacity')} pemeriksaan; mesin administratif: ${count('admin')}; retry klien: ${count('adminClient')}; Worker HTTP/aset: ${count('assets')}; rules dan operasi RTDB emulator: ${count('rules')}.`,
`- Akademik: ${count('academic')}; UI/UX: ${count('uiux')}; reflow: ${count('reflow')}; lifecycle: ${count('lifecycle')}; workflow LPS/BLP: ${count('lps')}; fidelity berkas XLSX hasil unduh: ${count('fidelity')}. GADM juga lulus dalam suite kumulatif.`,
'- Wrangler 4.131.1 dry-run berhasil, bundle 59,17 KiB (gzip 15,21 KiB); tidak ada deployment. Hash bundle dan source server dicatat terpisah dari hash Hosting.',
'- Alat uji ekspor diperbaiki agar mengambil berkas melalui GUID unduhan, mengirim event input/change, dan menunggu proses simpan lengkap sebelum menerapkan template. Workflow diulang pada build yang sama dan seluruh 27 pemeriksaan isi XLSX lulus. Catatan revalidasi tersimpan dalam hasil kumulatif; tidak ada perubahan source LPS tambahan pada langkah ini.',
'- Bukti utama: [final-evidence.json](test-output/three-findings/final-evidence.json), [hasil kumulatif](test-output/tahap7-final/cumulative-results.json), [rules emulator](test-output/tahap7-final/rules-emulator.json).',
'- Kegagalan antara selama perbaikan meliputi kontrak uji lama, emulator yang sudah berhenti, source/build yang belum dibangun ulang setelah koreksi, dan arsip kosong di RTDB. Hasil tersebut tidak dihitung sebagai PASS. Baseline serta bukti antara disimpan di test-output/three-findings-baseline dan test-output/three-findings-attempts.',
'',
'## Berkas utama dan batas rilis',
'',
'Perubahan utama berada di `sw.js`, `js/database/local-cache.js`, `js/database/live-pages.js`, `js/database/sync.js`, `js/database/repository.js`, `js/services/edge-service.js`, fitur backup/archive/reset, `edge/admin-operations.js`, `edge/worker.js`, rules RTDB, serta sumber versi/build. `public/` dihasilkan oleh build; mock dan alat QA tidak ikut Hosting.',
'',
'**Hosting saja tidak cukup untuk mengaktifkan perbaikan S05.** Urutan yang diperlukan: jeda tindakan administratif klien lama → Worker baru beserta konfigurasi/secret → rules RTDB → Hosting → verifikasi versi. Target URL Worker belum dianggap aktif hanya karena tercantum di build. Lihat [DEPLOYMENT_RUNBOOK_4.7.2.md](DEPLOYMENT_RUNBOOK_4.7.2.md).',
'',
'Audit ini tidak menyertifikasi batas CPU/memori layanan cloud untuk backup produksi berukuran besar, perangkat fisik/APK, atau soak jangka panjang. Uji lifecycle memakai baseline lokal 4.7.0, bukan bukti upgrade dari deployment live 4.6.9. Tiga temuan ditutup secara lokal; keberlakuannya di produksi menunggu penerapan komponen server dan klien sesuai runbook.',
''
];
await writeFile(report,lines.join('\n'));
const statusPath='REKONSTRUKSI_BERTAHAP_STATUS.md';
let status=await readFile(statusPath,'utf8');
status=status.replace('> **Status terbaru — penyerahan Codex','> **Riwayat penyerahan 4.7.1 — Codex').replace('## Penyerahan terbaru','## Penyerahan 4.7.1 (historis)');
const heading=status.indexOf('\n');
status=status.slice(0,heading+1)+`\n> **Status terbaru — 4.7.2: S07, S02, S05 SELESAI LOKAL.** ${evidence.suites}/${evidence.suites} suite PASS; ${count('rules')} pemeriksaan emulator PASS. Build ID \`${evidence.buildId}\`. Belum deploy 4.7.2; Worker baru dan rules diperlukan sebelum Hosting. Laporan: [${report}](${report}). Runbook: [DEPLOYMENT_RUNBOOK_4.7.2.md](DEPLOYMENT_RUNBOOK_4.7.2.md).\n`+status.slice(heading+1);
await writeFile(statusPath,status);
console.log(report);
