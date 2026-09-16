import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const hash = data => createHash('sha256').update(data).digest('hex');

const manifest = JSON.parse(readFileSync('public/build-manifest.json', 'utf8'));
const publicFiles = Object.keys(manifest.files).filter(f =>
  !f.startsWith('vendor/') && !f.startsWith('templates/') && !f.startsWith('icons/')
);

const nonPublicFiles = [
  'package.json',
  'firebase.json',
  'firebase/database.rules.production.json',
  'edge/worker.js',
  'edge/admin-operations.js',
  'edge/wrangler.jsonc',
  'capacitor.config.json',
  'scripts/build-hosting.mjs',
  'scripts/verify-hosting.mjs'
];

// Sort and categorize files
const allFiles = [...publicFiles, ...nonPublicFiles].sort();

let totalLines = 0;
let totalBytes = 0;

const fileEntries = [];

for (const relPath of allFiles) {
  const content = readFileSync(relPath, 'utf8');
  const lines = content.split('\n').length;
  const sha = hash(content);
  const bytes = Buffer.byteLength(content, 'utf8');
  totalLines += lines;
  totalBytes += bytes;

  let lang = 'javascript';
  if (relPath.endsWith('.html')) lang = 'html';
  else if (relPath.endsWith('.css')) lang = 'css';
  else if (relPath.endsWith('.json') || relPath.endsWith('.jsonc')) lang = 'json';
  else if (relPath.endsWith('.mjs') || relPath.endsWith('.js')) lang = 'javascript';

  fileEntries.push({
    relPath,
    lang,
    lines,
    bytes,
    sha,
    content
  });
}

console.log(`Processing ${fileEntries.length} files (${totalLines} lines, ${(totalBytes / 1024).toFixed(1)} KB)...`);

let out = `# SNAPSHOT KODE SUMBER LENGKAP SIMNI 4.7.2
## Artefak Rekonstruksi Mandiri dari Nol (Zero-Loss Codebase Archive)

> **PENTING / DOKUMEN PRESERVASI RESMI:**
> Berkas ini memuat seluruh kode sumber (*source code*) aplikasi **SIMNI (Sistem Informasi Manajemen Nilai & Administrasi Pembelajaran)** versi **4.7.2** secara lengkap, baris per baris, tanpa ada pemotongan, peringkasan, maupun baris yang terlewatkan.
>
> Jika seluruh repositori Git, server hosting, dan penyimpanan lokal hilang, repositori SIMNI dapat dibangun ulang secara utuh dan identik 100% menggunakan kode yang tercatat dalam dokumen ini.

---

### METADATA REKONSTRUKSI
- **Aplikasi:** SIMNI (SDIT Bina Madani)
- **Versi Rilis:** 4.7.2
- **Build ID:** \`${manifest.buildId}\`
- **Total File Sumber Aplikasi:** ${fileEntries.length} berkas
- **Total Baris Kode Sumber:** ${totalLines.toLocaleString('id-ID')} baris
- **Total Ukuran Teks Sumber:** ${(totalBytes / 1024).toFixed(1)} KB (${totalBytes.toLocaleString('id-ID')} byte)
- **Waktu Snapshot:** ${new Date().toISOString()}

---

### DAFTAR ISI BERKAS SUMBER

| No | Path Berkas | Bahasa | Baris | Ukuran (Byte) | SHA-256 |
|---|---|---|---|---|---|
`;

fileEntries.forEach((entry, idx) => {
  const anchor = entry.relPath.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  out += `| ${idx + 1} | [${entry.relPath}](#file-${anchor}) | \`${entry.lang}\` | ${entry.lines} | ${entry.bytes} | \`${entry.sha.slice(0, 16)}...\` |\n`;
});

out += `\n---\n\n## SNAPSHOT KODE SUMBER LENGKAP\n\n`;

for (const entry of fileEntries) {
  const anchor = 'file-' + entry.relPath.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  out += `### <a id="${anchor}"></a>File: \`${entry.relPath}\`\n\n`;
  out += `- **Path Direktori:** \`${entry.relPath}\`\n`;
  out += `- **Ukuran:** ${entry.bytes} byte | **Baris:** ${entry.lines} baris\n`;
  out += `- **Checksum (SHA-256):** \`${entry.sha}\`\n\n`;
  out += `\`\`\`\`${entry.lang}\n`;
  out += entry.content.endsWith('\n') ? entry.content : entry.content + '\n';
  out += `\`\`\`\`\n\n---\n\n`;
}

out += `## LAMPIRAN: SPESIFIKASI DEPENDENSI VENDOR & ASET BINER

Aplikasi SIMNI menggunakan pustaka pihak ketiga (*vendor libraries*) yang disimpan secara offline di dalam direktori \`public/vendor/\` untuk menjamin operasi tanpa ketergantungan CDN eksternal. Berikut adalah spesifikasi lengkap untuk merekonstruksi direktori vendor:

### 1. Pustaka Pihak Ketiga (\`public/vendor/\`)
1. **Firebase Web SDK (v10.12.x / v9 compat):**
   - \`vendor/firebase/firebase-app.js\`
   - \`vendor/firebase/firebase-auth.js\`
   - \`vendor/firebase/firebase-database.js\`
   - Sumber: Unduh dari Google Firebase CDN (\`https://www.gstatic.com/firebasejs/10.12.2/...\`) atau via npm \`firebase\`.
2. **ExcelJS & SheetJS (XLSX):**
   - \`vendor/exceljs/exceljs.min.js\` (ExcelJS browser bundle)
   - \`vendor/xlsx/xlsx.full.min.js\` (SheetJS CE)
   - Digunakan untuk engine laporan LPS / BLP dan impor data siswa/TP.
3. **PDF Generator:**
   - \`vendor/html2pdf/html2pdf.bundle.min.js\`
   - Menggabungkan \`html2canvas\` dan \`jsPDF\` untuk mencetak rapor, jurnal, dan modul ajar.
4. **QR Code Reader & Generator:**
   - \`vendor/html5-qrcode/html5-qrcode.min.js\` (pemindai QR presensi kamera)
   - \`vendor/qrcodejs/qrcode.min.js\` (pembuat QR identitas kartu siswa)
5. **OCR Engine (Tesseract):**
   - \`vendor/tesseract/tesseract.min.js\`
   - \`vendor/tesseract/worker.min.js\`
   - \`vendor/tesseract/tesseract-core.wasm.js\`
   - \`vendor/tesseract/ind.traineddata.gz\` (model bahasa Indonesia)
   - Digunakan pada modul GADM untuk ekstraksi teks dokumen fisik.
6. **Icons (FontAwesome 6 Free):**
   - \`vendor/fontawesome/css/all.min.css\`
   - \`vendor/fontawesome/webfonts/fa-solid-900.ttf\` & \`woff2\`
   - \`vendor/fontawesome/webfonts/fa-brands-400.ttf\` & \`woff2\`
7. **JSZip:**
   - \`vendor/jszip/jszip.min.js\`
   - Digunakan untuk dekompresi template XLSX dan berkas DOCX GADM.

### 2. Berkas Template Excel (\`public/templates/\`)
Daftar berkas template yang ditempatkan di \`templates/\`:
- \`Template_Data_Siswa_1_Kelas.xlsx\` (4.395 byte)
- \`Template_Data_Siswa_Per_Kelas.xlsx\` (18.749 byte)
- \`Template_Impor_TP_1_Kelas.xlsx\` (4.469 byte)
- \`Template_Impor_TP_Per_Kelas.xlsx\` (19.620 byte)
- \`LPS KLS 2 contoh.xlsx\` (94.636 byte)
- \`BLP contoh.xlsx\` (91.698 byte)

### 3. Ikon Aplikasi (\`public/icons/\`)
- \`favicon-32.png\` (32x32)
- \`icon-192.png\` (192x192)
- \`icon-512.png\` (512x512)
- \`icon-maskable-512.png\` (512x512 maskable)
- \`simni-logo.png\`
- \`school-logo.png\`

---
*Akhir dari Berkas Snapshot SIMNI 4.7.2.*
`;

writeFileSync('SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md', out, 'utf8');
console.log('SUCCESS: SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md generated!');
const writtenStats = statSync('SIMNI_SNAPSHOT_SOURCE_KODE_LENGKAP.md');
console.log(`Generated file size: ${(writtenStats.size / 1024 / 1024).toFixed(2)} MB (${writtenStats.size} bytes).`);
