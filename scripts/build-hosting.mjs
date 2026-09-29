import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'public');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const runtimeSource = await readFile(path.join(root, 'js/core/runtime-config.js'), 'utf8');
const manifestSource = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const dashboardSource = await readFile(path.join(root, 'features/dashboard/dashboard.html'), 'utf8');
const settingsSource = await readFile(path.join(root, 'features/settings/settings.html'), 'utf8');
const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
const lockVersion = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8')).version;
if (manifestSource.version !== packageJson.version || lockVersion !== packageJson.version || runtimeSource.match(/appVersion:\s*'([^']+)'/)?.[1] !== packageJson.version || runtimeSource.match(/cacheVersion:\s*'([^']+)'/)?.[1] !== packageJson.version || !dashboardSource.includes(`V.${packageJson.version}`) || !settingsSource.includes(`Versi Build: v${packageJson.version}`) || !indexSource.includes(packageJson.version)) {
    throw new Error('Version authority source tidak konsisten. Build dibatalkan sebelum public diubah.');
}

const PRODUCTION_DEFAULTS = Object.freeze({
    SIMNI_EDGE_URL: 'https://simni-assets-gateway.2ndgoal.workers.dev',
});

function requiredDeploymentValue(name) {
    const value = String(process.env[name] || PRODUCTION_DEFAULTS[name] || '').trim();
    if (!value) throw new Error(`Deployment variable ${name} wajib tersedia.`);
    return value;
}

function validateEdgeUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch (_) {
        throw new Error('SIMNI_EDGE_URL tidak valid.');
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) {
        throw new Error('SIMNI_EDGE_URL wajib berupa endpoint HTTPS workers.dev Free Tier.');
    }
    return url.href.replace(/\/$/, '');
}


const sourceEntries = Object.freeze([
    'index.html',
    'register.html',
    'manifest.json',
    'sw.js',
    'tailwind-offline.css',
    'icons',
    'features',
    'js',
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
    },
    {
        name: 'jszip@3.10.1',
        copies: [
            ['node_modules/jszip/dist/jszip.min.js', 'vendor/jszip/jszip.min.js']
        ]
    },
    {
        name: 'tesseract.js@5.1.1',
        copies: [
            ['vendor/tesseract/tesseract.min.js', 'vendor/tesseract/tesseract.min.js'],
            ['vendor/tesseract/worker.min.js', 'vendor/tesseract/worker.min.js'],
            ['vendor/tesseract/tesseract-core.wasm.js', 'vendor/tesseract/tesseract-core.wasm.js'],
            ['vendor/tesseract/ind.traineddata.gz', 'vendor/tesseract/ind.traineddata.gz'],
            ['vendor/tesseract/ocr-worker.js', 'vendor/tesseract/ocr-worker.js']
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
    await cp(source, target, { recursive: true, force: true, filter: filename => !filename.endsWith(`${path.sep}mock-adapter.js`) });
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
        'register.html',
        'manifest.json',
        'sw.js',
        'tailwind-offline.css',
        'build-manifest.json',
        'icons',
        'features',
        'js',
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
        if (targetRelative === 'vendor/firebase/firebase-auth.js' || targetRelative === 'vendor/firebase/firebase-database.js') {
            await ensureExists(sourceRelative);
            const source = path.join(root, sourceRelative);
            const target = path.join(out, targetRelative);
            await mkdir(path.dirname(target), { recursive: true });
            const content = await readFile(source, 'utf8');
            const localized = content.replaceAll(
                'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js',
                './firebase-app.js'
            );
            if (localized === content) {
                throw new Error(`Firebase module tidak memiliki app import yang dapat dilokalkan: ${sourceRelative}`);
            }
            await writeFile(target, localized, 'utf8');
        } else {
            await copyIntoPublic(sourceRelative, targetRelative);
        }
    }
}

const edgeUrl = validateEdgeUrl(requiredDeploymentValue('SIMNI_EDGE_URL'));
const deploymentMetadata = `  <meta name="simni-edge-url" content="${edgeUrl}">`;

for (const htmlFile of ['index.html', 'register.html']) {
    const builtHtmlPath = path.join(out, htmlFile);
    const builtHtml = await readFile(builtHtmlPath, 'utf8');
    if (builtHtml.includes('</head>') && !builtHtml.includes('simni-edge-url')) {
        await writeFile(
            builtHtmlPath,
            builtHtml.replace('</head>', `${deploymentMetadata}\n</head>`),
            'utf8'
        );
    }
}

await assertNoUnexpectedHostingFiles();

const files = {};
async function fingerprint(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) await fingerprint(filename);
        else files[path.relative(out, filename).replaceAll(path.sep, '/')] = createHash('sha256').update(await readFile(filename)).digest('hex');
    }
}
await fingerprint(out);
const buildId = createHash('sha256').update(JSON.stringify(files)).digest('hex');
await writeFile(path.join(out, 'build-manifest.json'), JSON.stringify({ version: packageJson.version, buildId, files }, null, 2));

console.log('');
console.log('SIMNI HOSTING BUILD PASS');
console.log(`Version : ${packageJson.version}`);
console.log(`Output  : ${out}`);
console.log(`Asset API: ${edgeUrl}`);
console.log('');
console.log('Vendor:');
for (const vendor of vendors) console.log(`- ${vendor.name}`);
console.log('');
console.log('Server/source-only directories were NOT copied.');
