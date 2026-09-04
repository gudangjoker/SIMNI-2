import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const out = path.join(root, 'public');

function requiredDeploymentValue(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Deployment variable ${name} wajib tersedia.`);
    return value;
}

function validateChatEdgeUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch (_) {
        throw new Error('SIMNI_CHAT_EDGE_URL tidak valid.');
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) {
        throw new Error('SIMNI_CHAT_EDGE_URL wajib berupa endpoint HTTPS workers.dev Free Tier.');
    }
    return url.href.replace(/\/$/, '');
}

function validateVapidKey(value) {
    if (!/^[A-Za-z0-9_-]{80,120}$/.test(value)) {
        throw new Error('SIMNI_CHAT_FCM_VAPID_KEY bukan public VAPID key yang valid.');
    }
    return value;
}

const sourceEntries = Object.freeze([
    'index.html',
    'manifest.json',
    'sw.js',
    'tailwind-offline.css',
    'icons',
    'features',
    'js',
    'chat/chat.html',
    'chat/css',
    'chat/js'
]);

const templateAssets = Object.freeze([
    'Template_Data_Siswa_1_Kelas.xlsx',
    'Template_Data_Siswa_Per_Kelas.xlsx',
    'Template_Impor_TP_1_Kelas.xlsx',
    'Template_Impor_TP_Per_Kelas.xlsx',
    'LPS KLS 2 contoh.xlsx',
    'BLP contoh.xlsx'
]);

const vendors = Object.freeze([
    {
        name: 'firebase@12.17.1',
        copies: [
            ['node_modules/firebase/firebase-app.js', 'vendor/firebase/firebase-app.js'],
            ['node_modules/firebase/firebase-auth.js', 'vendor/firebase/firebase-auth.js'],
            ['node_modules/firebase/firebase-database.js', 'vendor/firebase/firebase-database.js'],
            ['node_modules/firebase/firebase-firestore.js', 'vendor/firebase/firebase-firestore.js'],
            ['node_modules/firebase/firebase-messaging.js', 'vendor/firebase/firebase-messaging.js']
        ]
    },
    {
        name: '@fortawesome/fontawesome-free@6.4.0',
        copies: [
            ['node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'vendor/fontawesome/css/all.min.css'],
            ['node_modules/@fortawesome/fontawesome-free/webfonts', 'vendor/fontawesome/webfonts']
        ]
    },
    {
        name: 'qrcodejs@1.0.0',
        copies: [
            ['node_modules/qrcodejs/qrcode.min.js', 'vendor/qrcodejs/qrcode.min.js']
        ]
    },
    {
        name: 'html5-qrcode@2.3.8',
        copies: [
            ['node_modules/html5-qrcode/html5-qrcode.min.js', 'vendor/html5-qrcode/html5-qrcode.min.js']
        ]
    },
    {
        name: 'xlsx@0.20.3',
        copies: [
            ['node_modules/xlsx/dist/xlsx.full.min.js', 'vendor/xlsx/xlsx.full.min.js']
        ]
    },
    {
        name: 'exceljs@4.4.0',
        copies: [
            ['node_modules/exceljs/dist/exceljs.min.js', 'vendor/exceljs/exceljs.min.js']
        ]
    },
    {
        name: 'html2pdf.js@0.14.0',
        copies: [
            ['node_modules/html2pdf.js/dist/html2pdf.bundle.min.js', 'vendor/html2pdf/html2pdf.bundle.min.js']
        ]
    }
]);

async function ensureExists(relativePath) {
    const absolutePath = path.join(root, relativePath);
    const info = await stat(absolutePath);
    if (!info.isFile() && !info.isDirectory()) throw new Error(`Build input tidak valid: ${relativePath}`);
}

async function copyIntoPublic(sourceRelative, targetRelative = sourceRelative) {
    await ensureExists(sourceRelative);
    const source = path.join(root, sourceRelative);
    const target = path.join(out, targetRelative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, force: true });
}

async function resetOutputDirectory() {
    await mkdir(out, { recursive: true });
    const clearDirectory = async (directory) => {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const target = path.join(directory, entry.name);
            if (!entry.isDirectory()) {
                await rm(target, { force: true, maxRetries: 3, retryDelay: 100 });
                continue;
            }

            await clearDirectory(target);
            try {
                await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            } catch (error) {
                const remaining = await readdir(target);
                const lockOnly = ['EPERM', 'EBUSY'].includes(error?.code) && remaining.length === 0;
                if (!lockOnly) throw error;
            }
        }
    };
    await clearDirectory(out);
}

async function assertNoUnexpectedHostingFiles() {
    const allowedRoots = new Set([
        'index.html',
        'manifest.json',
        'sw.js',
        'tailwind-offline.css',
        'icons',
        'features',
        'js',
        'chat',
        'templates',
        'vendor'
    ]);
    const entries = await readdir(out, { withFileTypes: true });
    for (const entry of entries) {
        if (!allowedRoots.has(entry.name)) {
            throw new Error(`Artefak Hosting tidak dikenal terdeteksi: ${entry.name}`);
        }
    }
}

await resetOutputDirectory();

for (const item of sourceEntries) {
    await copyIntoPublic(item);
}

for (const filename of templateAssets) {
    await copyIntoPublic(filename, `templates/${filename}`);
}

for (const vendor of vendors) {
    for (const [sourceRelative, targetRelative] of vendor.copies) {
        await copyIntoPublic(sourceRelative, targetRelative);
    }
}

const firebaseVendorDirectory = path.join(out, 'vendor', 'firebase');
for (const filename of [
    'firebase-auth.js',
    'firebase-database.js',
    'firebase-firestore.js',
    'firebase-messaging.js'
]) {
    const modulePath = path.join(firebaseVendorDirectory, filename);
    const source = await readFile(modulePath, 'utf8');
    const localized = source.replaceAll(
        'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js',
        './firebase-app.js'
    );
    if (localized === source) {
        throw new Error(`Firebase module tidak memiliki app import yang dapat dilokalkan: ${filename}`);
    }
    await writeFile(modulePath, localized, 'utf8');
}

const chatEdgeUrl = validateChatEdgeUrl(requiredDeploymentValue('SIMNI_CHAT_EDGE_URL'));
const chatVapidKey = validateVapidKey(requiredDeploymentValue('SIMNI_CHAT_FCM_VAPID_KEY'));
const builtChatHtmlPath = path.join(out, 'chat', 'chat.html');
const builtChatHtml = await readFile(builtChatHtmlPath, 'utf8');
const deploymentMetadata = [
    `  <meta name="simni-chat-edge-url" content="${chatEdgeUrl}">`,
    `  <meta name="simni-chat-fcm-vapid-key" content="${chatVapidKey}">`
].join('\n');
if (!builtChatHtml.includes('</head>')) throw new Error('chat/chat.html tidak memiliki penutup head.');
await writeFile(
    builtChatHtmlPath,
    builtChatHtml.replace('</head>', `${deploymentMetadata}\n</head>`),
    'utf8'
);

await assertNoUnexpectedHostingFiles();

const packageJson = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root, 'package.json'), 'utf8'));

console.log('');
console.log('SIMNI HOSTING BUILD PASS');
console.log(`Version : ${packageJson.version}`);
console.log(`Output  : ${out}`);
console.log(`Chat API: ${chatEdgeUrl}`);
console.log('');
console.log('Vendor:');
for (const vendor of vendors) console.log(`- ${vendor.name}`);
console.log('');
console.log('Server/source-only directories were NOT copied.');
