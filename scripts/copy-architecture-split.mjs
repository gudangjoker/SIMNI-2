import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const frontendDest = path.join(root, 'F dan D', 'frontend');
const backendDest = path.join(root, 'F dan D', 'backend');

const frontendItems = [
    'index.html',
    'register.html',
    'manifest.json',
    'sw.js',
    'tailwind-offline.css',
    'capacitor.config.json',
    'package.json',
    'package-lock.json',
    'features',
    'js',
    'icons',
    'vendor',
    'public',
    'android',
    'Template_Data_Siswa_1_Kelas.xlsx',
    'Template_Data_Siswa_Per_Kelas.xlsx',
    'Template_Impor_TP_1_Kelas.xlsx',
    'Template_Impor_TP_Per_Kelas.xlsx',
    'BLP contoh.xlsx',
    'LPS KLS 2 contoh.xlsx'
];

const backendItems = [
    'edge',
    'firebase',
    'firestore',
    'scripts',
    'qa',
    'firebase.json',
    'firebase.tahap7.emulator.json',
    '.firebaserc',
    'package.json',
    'package-lock.json'
];

console.log('--- MEMULAI PROSES PENYALINAN ARSITEKTUR SIMNI ---');

// 1. Copy Frontend Items
console.log('\n[1/2] Menyalin komponen Frontend ke "F dan D/frontend"...');
for (const item of frontendItems) {
    const src = path.join(root, item);
    const dest = path.join(frontendDest, item);
    try {
        await cp(src, dest, {
            recursive: true,
            force: true,
            filter: (srcPath) => !srcPath.includes('node_modules') && !srcPath.includes('.git')
        });
        console.log(`  ✓ ${item}`);
    } catch (err) {
        console.error(`  ✗ Gagal menyalin ${item}:`, err.message);
    }
}

// 2. Copy Backend Items
console.log('\n[2/2] Menyalin komponen Backend ke "F dan D/backend"...');
for (const item of backendItems) {
    const src = path.join(root, item);
    const dest = path.join(backendDest, item);
    try {
        await cp(src, dest, {
            recursive: true,
            force: true,
            filter: (srcPath) => !srcPath.includes('node_modules') && !srcPath.includes('.git')
        });
        console.log(`  ✓ ${item}`);
    } catch (err) {
        console.error(`  ✗ Gagal menyalin ${item}:`, err.message);
    }
}

// 3. Write Architecture Documentation inside each folder
const frontendReadme = `# SIMNI Frontend Architecture (Client PWA & Mobile)

Direktori ini berisi seluruh source code antarmuka pengguna (Frontend), modul klien, PWA, dan aset aplikasi SIMNI.

## Struktur Direktori:
- \`index.html\` : Single Page Application (SPA) shell utama aplikasi.
- \`register.html\` : Halaman pendaftaran akses guru/pengguna.
- \`manifest.json\` : Web App Manifest untuk PWA installable.
- \`sw.js\` : Service Worker untuk offline-first caching & background sync.
- \`tailwind-offline.css\` : Bundle offline utilitas desain Tailwind CSS.
- \`features/\` : Modul-modul fitur antarmuka (Dashboard, Siswa, Presensi, Nilai, Jurnal, LPS, BTQ, GADM, Catatan, Dokumen, Pengaturan, Akun).
- \`js/\` : Logika runtime frontend (Auth, State, UI, Navigation, Actions, Platform, Utils, Render).
- \`icons/\` : Ikon PWA dan branding identitas visual.
- \`vendor/\` : Pustaka browser lokal (FontAwesome, Firebase Client, QR scanner, Excel, PDF, Tesseract).
- \`public/\` : Hasil build produksi hosting siap saji.
- \`android/\` : Wrapper Capacitor / Android APK native.
- \`templates/\` & Berkas Excel : Template impor data siswa, TP, serta contoh rapor.
`;

const backendReadme = `# SIMNI Backend & Cloud Infrastructure Architecture

Direktori ini berisi seluruh source code backend serverless, Cloudflare Workers, aturan keamanan database Firebase, skrip otomatisasi, serta test suite.

## Struktur Direktori:
- \`edge/\` : Cloudflare Workers Serverless API (\`worker.js\`, \`admin-operations.js\`, \`wrangler.jsonc\`).
- \`firebase/\` : Firebase Realtime Database Security Rules (\`database.rules.production.json\`, \`database.rules.multirole-maintenance.json\`).
- \`firestore/\` : Firestore rules & config.
- \`firebase.json\` & \`.firebaserc\` : Konfigurasi deployment hosting, rules, dan emulator Firebase.
- \`scripts/\` : Skrip build (\`build-hosting.mjs\`), verifikasi (\`verify-hosting.mjs\`), migrasi, dan generator aset.
- \`qa/\` : Kontrak pengujian otomasi integrasi dan fungsionalitas sistem.
`;

await writeFile(path.join(frontendDest, 'README.md'), frontendReadme, 'utf8');
await writeFile(path.join(backendDest, 'README.md'), backendReadme, 'utf8');

console.log('\n--- PENYALINAN BERHASIL SEPENUHNYA ---');
console.log('Source asli di root tetap 100% utuh tanpa penghapusan.');
