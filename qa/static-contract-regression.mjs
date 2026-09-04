import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
let passed = 0;
const failures = [];
const absolute = (relativePath) => path.join(ROOT, relativePath);
const read = (relativePath) => readFileSync(absolute(relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const ignoredSourceDirectories = new Set([
    '.tmp-npm-cache',
    '.wrangler-config',
    '.wrangler-dry-run',
    'node_modules'
]);

function assert(condition, id, message) {
    if (condition) {
        passed += 1;
        console.log(`[PASS] ${id} — ${message}`);
        return;
    }
    failures.push(`${id}: ${message}`);
    console.error(`[FAIL] ${id} — ${message}`);
}

function files(directory, extensions, output = []) {
    for (const name of readdirSync(absolute(directory))) {
        const relativePath = path.join(directory, name);
        const metadata = statSync(absolute(relativePath));
        if (metadata.isDirectory()) {
            if (!ignoredSourceDirectories.has(name)) files(relativePath, extensions, output);
        }
        else if (extensions.has(path.extname(name).toLowerCase())) output.push(relativePath);
    }
    return output;
}

console.log('\nSIMNI PRODUCTION STATIC CONTRACT\n');

const required = [
    'index.html', 'manifest.json', 'sw.js', 'firebase.json', 'package.json', 'package-lock.json',
    'firebase/database.rules.production.json', 'chat/firestore.rules', 'chat/firestore.indexes.json',
    'chat/edge/worker.js', 'chat/edge/wrangler.jsonc', 'chat/js/chat-query-core.mjs', 'qa/chat-audio-regression.mjs', 'scripts/build-hosting.mjs',
    'js/services/chat-notifications.js',
    'js/platform/bootstrap.js', 'js/platform/main.js', 'js/services/edge-service.js',
    'js/auth/access-context.js', 'js/auth/access-policy-core.js', 'js/auth/chat-unlock.js', 'js/auth/auth.js',
    'js/database/firebase-client.js', 'js/database/local-cache.js', 'js/database/repository.js',
    'js/database/cloudinary-client.js', 'js/database/workspace-paths-core.js',
    'features/backup/backup-core.js', 'features/backup/backup.js', 'features/archive/archive.js',
    'features/reset/reset.js', 'features/lps/lps.js', 'features/lps/lps.html', 'features/lps/lps.css',
    'features/gadm/gadm.html', 'features/gadm/gadm.css', 'features/gadm/gadm-kb.js',
    'features/gadm/gadm-engine.js', 'features/gadm/gadm-storage.js', 'features/gadm/gadm.js',
    'icons/simni-logo.png', 'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png',
    'icons/icon-maskable-512.png', 'icons/school-logo.png'
];
for (const relativePath of required) assert(existsSync(absolute(relativePath)), 'SRC-001', `${relativePath} tersedia`);
assert(!existsSync(absolute('functions')), 'SRC-002', 'Firebase Functions/Blaze tidak terdapat pada source produksi');
assert(!existsSync(absolute('js/services/backend-service.js')), 'SRC-003', 'Backend Cloud Functions lama telah dieliminasi');
assert(!existsSync(absolute('js/auth/invitations.js')), 'SRC-004', 'Modul invitation deprecated telah dieliminasi');

for (const relativePath of ['manifest.json', 'firebase.json', 'package.json', 'package-lock.json', 'firebase/database.rules.production.json', 'chat/firestore.indexes.json', 'chat/edge/wrangler.jsonc']) {
    let valid = true;
    try { json(relativePath); } catch (_) { valid = false; }
    assert(valid, 'JSON-001', `${relativePath} valid JSON`);
}

const javascript = [...files('js', new Set(['.js', '.mjs'])), ...files('features', new Set(['.js', '.mjs'])), ...files('chat', new Set(['.js', '.mjs'])), ...files('qa', new Set(['.js', '.mjs'])), ...files('scripts', new Set(['.js', '.mjs'])), 'sw.js'];
for (const relativePath of javascript) {
    const result = spawnSync(process.execPath, ['--check', absolute(relativePath)], { encoding: 'utf8' });
    assert(result.status === 0, 'JS-001', `${relativePath} lolos syntax check`);
}

const packageJSON = json('package.json');
const manifest = json('manifest.json');
const runtime = read('js/core/runtime-config.js');
const version = /appVersion:\s*\n?\s*'([^']+)'/.exec(runtime)?.[1];
const cacheVersion = /cacheVersion:\s*\n?\s*'([^']+)'/.exec(runtime)?.[1];
assert(Boolean(version) && cacheVersion === version, 'VER-001', `App/cache version sinkron ${version || '(kosong)'}`);
assert(packageJSON.version === version && manifest.version === version, 'VER-002', 'Package/manifest version sinkron');
for (const [name, expected] of Object.entries({ exceljs: '4.4.0', firebase: '12.17.1', 'html2pdf.js': '0.14.0', 'html5-qrcode': '2.3.8', qrcodejs: '1.0.0', xlsx: 'file:vendor/xlsx-0.20.3.tgz' })) {
    assert(packageJSON.dependencies?.[name] === expected, 'DEP-001', `${name}@${expected} exact-pinned`);
}

const index = read('index.html');
const allMarkup = [index, ...files('features', new Set(['.html'])).map(read), ...files('chat', new Set(['.html'])).map(read)].join('\n');
const runtimeJavaScript = javascript.filter((file) => !file.startsWith('qa') && !file.startsWith('scripts'));
const allSource = [allMarkup, ...runtimeJavaScript.map((file) => read(file))].join('\n');
assert(!allSource.includes('window.SIMNIActions'), 'UI-012', 'Fitur memanggil fungsi modal runtime yang nyata, bukan facade yang tidak didefinisikan');
assert(/#modal-preview-tp-import\s*\{[\s\S]*?z-index:\s*10010/.test(read('js/ui/shell.css')), 'UI-013', 'Modal pratinjau TP berada di atas modal Kelola TP dan kontrolnya dapat diklik');
assert(/const activeClass = normalizeClassLabel\(state\?\.activeKelas\);[\s\S]*?objectiveClass === activeClass/.test(read('features/grades/grades.js')), 'DATA-024', 'Daftar TP membatasi TP berkelas ke kelas aktif tanpa memutus data TP legacy');
assert(/requestedAccount === 'vip'[\s\S]*?mockUserForEmail\('anur\.auliya01@gmail\.com'\)/.test(read('js/auth/auth.js')), 'AUTH-030', 'Harness localhost dapat menguji akun VIP tanpa mengubah default mock Superuser');
assert(!/<[^>]+\son(?:click|change|submit|input|load|error)\s*=/i.test(allMarkup), 'XSS-001', 'Tidak ada executable inline event handler');
assert(!/\b(?:eval|Function)\s*\(/.test(allSource), 'XSS-002', 'Tidak ada dynamic string execution');
assert((index.match(/type="module"[\s\S]{0,100}src="js\/platform\/bootstrap\.js"/g) || []).length === 1, 'BOOT-001', 'Satu bootstrap module authority');
assert(index.includes('id="login-screen"'), 'BOOT-002', 'Login shell tersedia statis');
assert(!index.includes('invite-registration-modal'), 'BOOT-003', 'Invitation shell deprecated tidak diekspos');
assert(index.includes('src="js/ui/actions.js"'), 'BOOT-004', 'Delegated action dispatcher dimuat oleh app shell');
assert(read('sw.js').includes("'./js/ui/actions.js'"), 'PWA-004', 'Delegated action dispatcher masuk precache Service Worker');
assert(/id="ui-nama-kelas"[\s\S]*?SIMNI/.test(index) && /Dashboard SIMNI/.test(read('features/dashboard/dashboard.html')), 'UI-003', 'Brand shell dan dashboard menggunakan SIMNI');
assert(/login-shell/.test(index) && /--simni-active-canvas/.test(read('js/ui/shell.css')), 'UI-004', 'Login modern dan canvas tema global tersedia');
assert(/data-target="lps"[\s\S]*?data-requires-feature="lps"/.test(index), 'UI-005', 'Menu LPS memiliki guard fitur eksplisit');
assert((index.match(/data-target="gadm"|data-shell-view="gadm"/g) || []).length === 0,
    'UI-010', 'GADM tidak dijejalkan ke navigasi desktop maupun mobile');
const dashboardMarkup = read('features/dashboard/dashboard.html');
assert((dashboardMarkup.match(/data-requires-feature="gadm"[\s\S]{0,160}?data-simni-args='\["gadm"\]'/g) || []).length === 1,
    'UI-011', 'GADM tersedia tepat sekali sebagai Aksi Cepat Dashboard');
assert(/GADM:\s*'gadm'/.test(read('js/auth/access-policy-core.js'))
    && /FEATURES\.GADM/.test(read('js/auth/access-policy-core.js')),
    'ROLE-003', 'GADM diizinkan untuk Superuser dan VIP melalui matriks akses bersama');
const gadmRuntime = [read('features/gadm/gadm.js'), read('features/gadm/gadm-storage.js')].join('\n');
assert(!/firebase|firestore|realtime database|fetch\s*\(|XMLHttpRequest|WebSocket/i.test(gadmRuntime),
    'GADM-001', 'Runtime integrasi dan penyimpanan GADM tidak memiliki ketergantungan jaringan atau Firebase');
assert(/indexedDB\.open/.test(read('features/gadm/gadm-storage.js'))
    && /uid[\s\S]*role[\s\S]*workspaceId[\s\S]*academicYearId/.test(read('features/gadm/gadm-storage.js')),
    'GADM-002', 'IndexedDB GADM diisolasi berdasarkan UID, role, workspace, dan tahun pelajaran');
assert(/html2pdf/.test(read('features/gadm/gadm-engine.js'))
    && /application\/msword/.test(read('features/gadm/gadm.js'))
    && /XLSX\.utils/.test(read('features/gadm/gadm.js')),
    'GADM-003', 'GADM memakai runtime ekspor PDF, Word, dan Excel lokal');
assert(/gadm-curriculum-2026\.js/.test(read('sw.js'))
    && /recommendOfficialCp/.test(read('features/gadm/gadm-kb.js'))
    && /gadm-curriculum-suggestion/.test(read('features/gadm/gadm.html')),
    'GADM-005', 'Corpus CP resmi dan rekomendasi kurikulum tersedia secara offline');
assert(/gadm-new-document/.test(read('features/gadm/gadm.html'))
    && !/gadm-tool-button span\{display:none\}/.test(read('features/gadm/gadm.css')),
    'GADM-006', 'Pratinjau mobile menyediakan aksi dokumen baru dan label tombol yang terbaca');
assert(!/localStorage/.test(read('features/gadm/gadm-engine.js'))
    && !/DOMContentLoaded[\s\S]*mount/.test(read('features/gadm/gadm-engine.js')),
    'GADM-004', 'Engine GADM tidak auto-mount dan tidak menyimpan draft global di localStorage');
assert(!/\.className\s*=/.test(read('js/ui/navigation.js'))
    && /classList\.toggle\('font-bold'/.test(read('js/ui/navigation.js'))
    && /classList\.toggle\('text-primary'/.test(read('js/ui/navigation.js'))
    && /applyAccessUI/.test(read('js/ui/navigation.js')),
    'UI-006', 'Navigasi mempertahankan kelas semantik dan hasil otorisasi role');
assert(/data-simni-role="vip"\] \[data-requires-feature="lps"\]/.test(read('js/ui/shell.css')),
    'UI-007', 'CSS role guard menutup menu LPS VIP secara fail-closed');
assert(index.includes('./icons/simni-logo.png') && index.includes('./icons/favicon-32.png'), 'UI-008', 'Logo SIMNI dan favicon baru digunakan shell');
assert(!/id="view-lps"/.test(index)
    && /id !== 'lps'[\s\S]*?SIMNILPS\?\.unmount/.test(read('js/ui/navigation.js'))
    && /mainScrollArea\.appendChild/.test(read('features/lps/lps.js')),
    'UI-009', 'LPS dibuat hanya dari menu LPS dan dihapus ketika Dashboard aktif');
assert(/requestAnimationFrame[\s\S]*?setTimeout\(startOnIntent, 150\)/.test(read('js/platform/bootstrap.js')), 'AUTH-BOOT-001', 'Firebase startup otomatis berjalan setelah first-paint shell tanpa menunggu intent');
assert(!/lockScreen|unlockScreen/.test(read('js/database/sync.js')), 'AUTH-BOOT-002', 'Layar login hanya dikendalikan lifecycle autentikasi, bukan status sinkronisasi database');
assert(/data-simni-auth-phase="restoring-session"/.test(index)
    && /session-restore-panel/.test(index)
    && /RESTORING_SESSION:\s*'restoring-session'/.test(read('js/auth/auth.js')),
    'AUTH-BOOT-003', 'Cold start menampilkan state pemulihan sesi, bukan formulir login sementara');
assert(/verifyAuthoritativeSession/.test(read('js/auth/auth.js'))
    && /context\.stale === true/.test(read('js/auth/auth.js'))
    && /resumeSIMNIAuthSession/.test(read('js/core/app.js')),
    'AUTH-BOOT-004', 'Dashboard lokal pulih tanpa menunggu profil jaringan dan verifikasi dilanjutkan saat online/resume');
assert(/createVoicePlayer/.test(read('chat/js/chat-ui-handler.js'))
    && /createPlayableAudioBlob/.test(read('chat/js/chat-ui-handler.js'))
    && /className = 'voice-timeline'/.test(read('chat/js/chat-ui-handler.js'))
    && /\.voice-player/.test(read('chat/css/chat-style.css')),
    'CHAT-AUDIO-001', 'Pesan suara memiliki player inline, timeline, dan normalisasi format');
assert(/audio\/wav/.test(read('chat/js/chat-platform.js'))
    && /downsampleMono/.test(read('chat/js/chat-platform.js'))
    && /encodeMonoPcm16Wav/.test(read('chat/js/chat-platform.js')),
    'CHAT-AUDIO-002', 'Recorder menghasilkan WAV PCM mono portabel dengan fallback codec browser');
assert(/COMMON_RUNTIME_ASSETS/.test(read('js/core/feature-loader.js')), 'PERF-002', 'Feature/vendor runtime dimuat setelah otorisasi');
assert(/new URL\(url, document\.baseURI\)\.href[\s\S]*?import\(resolvedURL\)/.test(read('js/core/feature-loader.js')),
    'PERF-003', 'Dynamic feature module di-resolve dari root dokumen, bukan direktori internal loader');

for (const forbidden of ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'gstatic.com/firebasejs']) {
    assert(!allSource.includes(forbidden), 'CDN-001', `Runtime tidak bergantung pada ${forbidden}`);
}

const firebase = json('firebase.json');
const headers = firebase.hosting?.headers?.find((entry) => entry.source === '**')?.headers || [];
const csp = headers.find((header) => String(header.key).toLowerCase() === 'content-security-policy')?.value || '';
assert(firebase.hosting?.public === 'public', 'HOST-001', 'Firebase Hosting dibatasi ke public/');
assert(!firebase.functions, 'FREE-001', 'Deploy Firebase tidak mengaktifkan Cloud Functions/Blaze');
assert(firebase.firestore?.indexes === 'chat/firestore.indexes.json', 'HOST-002', 'Firestore indexes masuk deployment contract');
assert(csp.includes("script-src-attr 'none'") && csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"), 'CSP-001', 'CSP menutup inline attributes, object, dan framing');
assert(csp.includes("media-src 'self' blob:"), 'CSP-002', 'CSP mengizinkan media hasil dekripsi lokal tanpa membuka origin eksternal');
assert(!csp.includes('cloudfunctions.net'), 'FREE-002', 'CSP tidak menyisakan endpoint Cloud Functions');

const edgeConfig = json('chat/edge/wrangler.jsonc');
const edge = read('chat/edge/worker.js');
assert(json('chat/firestore.indexes.json').indexes?.length === 0, 'CHAT-INDEX-001', 'Listener Chat tidak membutuhkan composite index');
assert(edgeConfig.r2_buckets?.length === 1
    && edgeConfig.r2_buckets[0].binding === 'CHAT_MEDIA_BUCKET'
    && edgeConfig.r2_buckets[0].bucket_name === 'simni-chat-media',
'FREE-003', 'Media Chat memakai tepat satu bucket Cloudflare R2');
const uploadMediaSource = /async function uploadMedia[\s\S]*?\n}/.exec(edge)?.[0] || '';
const readMediaSource = /async function readMedia[\s\S]*?\n}/.exec(edge)?.[0] || '';
assert(uploadMediaSource.includes('requireChatMediaBucket') && readMediaSource.includes('requireChatMediaBucket')
    && !uploadMediaSource.includes('requireCloudinary') && !readMediaSource.includes('requireCloudinary'),
'FREE-004', 'Media Chat memakai R2 dan tidak memakai Cloudinary');
assert(edge.includes('CLOUDINARY_POLICY') && edge.includes('Hanya Superuser yang dapat mengunggah aset dokumen.'),
'FREE-005', 'Cloudinary dibatasi untuk aset LKPD dan Dokumen SIMNI');
assert(edge.includes('verifyFirebaseIdToken') && edge.includes('SIMNI_ALLOWED_ORIGINS'), 'EDGE-001', 'Worker memverifikasi token dan origin');
assert(edge.includes('/v1/cloudinary/sign') && edge.includes('/v1/cloudinary/delete'), 'EDGE-002', 'Signed upload dan scoped cleanup tersedia');

const rules = read('firebase/database.rules.production.json');
for (const binding of [
    ['unggaran.sditbm@gmail.com', 'superuser', 'ws_superuser'],
    ['anur.auliya01@gmail.com', 'vip', 'ws_pjok', 'PJOK']
]) assert(binding.every((value) => rules.includes(value)), 'RULE-001', `Binding ${binding[1]} kanonik tersedia`);
assert(!rules.includes('workspaceMigrations') && !read('js/database/repository.js').includes('dbMigrateLegacyWorkspaces'), 'ROLE-001', 'Runtime migrasi workspace yang sudah selesai telah dihapus');
assert(!existsSync(absolute('scripts/execute-live-workspace-migration.mjs')) && !read('features/settings/settings.html').includes('workspace-migration-panel'), 'ROLE-002', 'Skrip dan UI migrasi tidak tersisa');
assert(rules.includes('rollovers') && rules.includes('assignments') && rules.includes('archiveHash'), 'YEAR-001', 'Rules menyediakan readiness arsip dan assignment per tahun');
assert(/verifyAnnualArchiveFile[\s\S]*?dbMarkRolloverArchiveReady/.test(read('features/backup/backup.js')), 'YEAR-002', 'Arsip JSON wajib diverifikasi ulang sebelum reset');
assert(/dbCommitAcademicYearRollover[\s\S]*?academicYears\/\$\{currentYearId\}`\] = null/.test(read('js/database/repository.js')), 'YEAR-003', 'Rollover mengosongkan namespace tahun lama secara eksplisit');
assert(/role'\)\.val\(\) != 'vip' \|\| newData\.child\('mapel'\)\.val\(\) == 'PJOK'/.test(rules), 'RULE-002', 'VIP dibatasi ke mata pelajaran PJOK');
assert(rules.includes('workspaces') && rules.includes('academicYears') && rules.includes('attendance'), 'RULE-003', 'Data attendance berada dalam workspace/year namespace');
assert(/"invites": \{ "\.read": false, "\.write": false \}/.test(rules), 'RULE-004', 'Legacy invitation root ditutup');

assert(manifest.display === 'standalone', 'PWA-001', 'Manifest display standalone');
assert(manifest.icons?.some((icon) => icon.sizes === '512x512' && String(icon.purpose).includes('maskable')), 'PWA-002', 'Maskable icon 512 tersedia');
const sw = read('sw.js');
for (const asset of ['./index.html', './manifest.json', './icons/simni-logo.png', './icons/favicon-32.png', './js/platform/bootstrap.js', './js/auth/chat-unlock.js', './js/database/mock-adapter.js', './vendor/firebase/firebase-auth.js', './features/backup/backup-core.js', './features/gadm/gadm.html', './features/gadm/gadm.js']) {
    assert(sw.includes(`'${asset}'`), 'SW-001', `${asset} masuk precache`);
}
const installHandler = sw.slice(sw.indexOf("'install'"), sw.indexOf('ACTIVATE EVENT'));
assert(installHandler.includes('await installAppCache()') && installHandler.includes('await self.skipWaiting()'), 'SW-002', 'Service Worker aktif otomatis hanya setelah precache terverifikasi');

const build = spawnSync(process.execPath, ['scripts/build-hosting.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
        ...process.env,
        SIMNI_CHAT_EDGE_URL: 'https://simni-chat-media-gateway.qa.workers.dev',
        SIMNI_CHAT_FCM_VAPID_KEY: 'BAbCdEfGhIjKlMnOpQrStUvWxYz0123456789_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_AbCdEfGhI'
    }
});
assert(build.status === 0, 'BUILD-001', 'Deterministic hosting build berhasil');
for (const relativePath of ['public/index.html', 'public/sw.js', 'public/js/platform/bootstrap.js', 'public/js/services/edge-service.js', 'public/chat/chat.html']) {
    assert(existsSync(absolute(relativePath)) && statSync(absolute(relativePath)).size > 0, 'BUILD-002', `${relativePath} tersedia pada output`);
}
assert(
    !existsSync(absolute('public/functions'))
    && !existsSync(absolute('public/qa'))
    && !existsSync(absolute('public/chat/edge'))
    && !existsSync(absolute('public/chat/firestore.rules'))
    && !existsSync(absolute('public/chat/firestore.indexes.json')),
    'BUILD-003',
    'Source internal tidak terekspos pada hosting output'
);
assert(/simni-chat-edge-url/.test(read('public/chat/chat.html')) && /simni-chat-fcm-vapid-key/.test(read('public/chat/chat.html')),
    'BUILD-004', 'Build menyuntikkan kontrak deployment Chat tanpa hard-coded secret/source placeholder');

const qaChatBuildPath = absolute('public/chat/chat.html');
const qaChatBuild = readFileSync(qaChatBuildPath, 'utf8')
    .replace(/^\s*<meta name="simni-chat-edge-url"[^>]*>\r?\n/m, '')
    .replace(/^\s*<meta name="simni-chat-fcm-vapid-key"[^>]*>\r?\n/m, '');
writeFileSync(qaChatBuildPath, qaChatBuild, 'utf8');

console.log(`\nSTATIC CONTRACT: ${passed} PASS, ${failures.length} FAIL`);
if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
}
