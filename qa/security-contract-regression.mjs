import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const require = createRequire(import.meta.url);
const failures = [];
let passed = 0;
const ignoredSourceDirectories = new Set([
    '.tmp-npm-cache',
    '.wrangler-config',
    '.wrangler-dry-run',
    'node_modules'
]);

function read(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8');
}

function collect(directory, extensions, output = []) {
    const absoluteDirectory = path.join(root, directory);
    for (const entry of readdirSync(absoluteDirectory)) {
        const relativePath = path.join(directory, entry);
        const metadata = statSync(path.join(root, relativePath));
        if (metadata.isDirectory()) {
            if (ignoredSourceDirectories.has(entry)) {
                continue;
            }
            collect(relativePath, extensions, output);
        } else if (extensions.has(path.extname(entry).toLowerCase())) {
            output.push(relativePath);
        }
    }
    return output;
}

function assert(condition, id, message) {
    if (condition) {
        passed += 1;
        process.stdout.write(`[PASS] ${id} — ${message}\n`);
        return;
    }
    failures.push(`${id}: ${message}`);
    process.stderr.write(`[FAIL] ${id} — ${message}\n`);
}

const sourceFiles = [
    'index.html',
    ...collect('js', new Set(['.js', '.mjs'])),
    ...collect('features', new Set(['.html', '.js', '.mjs'])),
    ];
const combinedSource = sourceFiles.map((file) => read(file)).join('\n');
const combinedMarkup = sourceFiles
    .filter((file) => path.extname(file).toLowerCase() === '.html')
    .map((file) => read(file))
    .join('\n');

assert(
    !/<[^>]+\son(?:click|change|submit|keyup|error)\s*=/i.test(combinedMarkup),
    'XSS-001',
    'Tidak ada executable inline event attribute.'
);
assert(
    !/\b(?:eval|Function)\s*\(/.test(combinedSource),
    'XSS-002',
    'Tidak ada dynamic string execution melalui eval/Function.'
);

const firebaseConfig = JSON.parse(read('firebase.json'));
const globalHeaders = firebaseConfig.hosting.headers.find((entry) => entry.source === '**')?.headers || [];
const csp = globalHeaders.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value || '';
assert(csp.includes("script-src-attr 'none'"), 'XSS-003', 'CSP memblokir script attribute.');
assert(!/script-src[^;]*'unsafe-inline'/.test(csp), 'XSS-004', 'CSP script-src tidak mengizinkan unsafe-inline.');
assert(csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"), 'XSS-005', 'CSP menutup object embedding dan framing.');

const authSource = read('js/auth/access-context.js');
assert(!/runTransaction|legacy-owner-auto-session/.test(authSource), 'AUTH-001', 'Browser tidak memiliki jalur provisioning role lokal.');
assert(/ACCOUNT_BINDINGS/.test(authSource) && /provisionCanonicalProfile/.test(authSource), 'AUTH-002', 'Provisioning profil dibatasi binding email-role kanonik oleh RTDB Rules.');
assert(!/simniLastAuthEmail/.test(combinedSource), 'AUTH-003', 'Email login tidak dipersistenkan ke Web Storage.');
assert(/purgeCurrentLocalCache/.test(read('js/auth/auth.js')), 'AUTH-004', 'Logout menghapus cache data offline milik sesi.');
assert(/ACCOUNT_BINDINGS\[authEmail\][\s\S]*?ACCOUNT_IDENTITY_INVALID/.test(authSource), 'AUTH-005', 'Access context mengikat setiap profil ke email dan role kanonik.');
assert(/setPersistence\([\s\S]*?auth,[\s\S]*?browserLocalPersistence/.test(read('js/database/firebase-client.js'))
    && /await authPersistenceReady/.test(read('js/auth/auth.js'))
    && /requestAnimationFrame[\s\S]*?setTimeout\(startOnIntent, 150\)/.test(read('js/platform/bootstrap.js')),
    'AUTH-007', 'Sesi Firebase persisten dipulihkan otomatis setelah first-paint shell.');
assert(!/profileCacheKey|firebase-authority-or-cache|validated-cache/.test(authSource)
    && /canonicalProfile\([\s\S]*?'firebase-auth-binding'[\s\S]*?true/.test(authSource)
    && /verifyAccessContext[\s\S]*?await readAuthoritativeProfile\(user\)[\s\S]*?'firebase-authority'[\s\S]*?false/.test(authSource),
    'AUTH-008', 'Pemulihan sesi memakai binding email-role kanonik tanpa cache role, lalu profil Firebase diverifikasi asynchronous.');

const stateSource = read('js/core/state.js');
assert(/simniActiveKelas:\$\{access\.uid\}:\$\{access\.workspaceId\}/.test(stateSource), 'STORE-001', 'Preferensi kelas diisolasi per UID dan workspace.');
assert(/stateHash/.test(read('js/database/local-cache.js')) && /scopeMatches/.test(read('js/database/local-cache.js')), 'STORE-003', 'Cache IndexedDB diverifikasi hash dan scope sebelum digunakan.');

const policy = require(path.join(root, 'js/auth/access-policy-core.js'));
const workspacePaths = require(path.join(root, 'js/database/workspace-paths-core.js'));
const roleContexts = {
    superuser: { uid: 'owner_uid', role: 'superuser', status: 'active', workspaceId: 'ws_superuser', classId: '3A', activeAcademicYearId: '2026-2027' },
    vip: { uid: 'vip_uid', role: 'vip', status: 'active', workspaceId: 'ws_pjok', classId: 'PJOK', activeAcademicYearId: '2026-2027' }
};
const attendancePaths = Object.values(roleContexts).map((context) =>
    workspacePaths.resolveLogicalPath('Presensi/2026-08-30_1234567890', context));
assert(new Set(attendancePaths).size === 2, 'SCOPE-001', 'Path kehadiran Superuser dan VIP terisolasi secara fisik.');
assert(policy.allowedSubject(roleContexts.vip.role, 'PJOK') && !policy.allowedSubject(roleContexts.vip.role, 'Matematika'),
    'SCOPE-002', 'VIP hanya diizinkan mengakses mata pelajaran PJOK.');
let invalidScopeRejected = false;
try {
    policy.validateProfile({ ...roleContexts.vip, workspaceId: 'ws_3a', classId: '3A' }, roleContexts.vip.uid);
} catch (error) {
    invalidScopeRejected = error?.code === 'PROFILE_SCOPE_INVALID';
}
assert(invalidScopeRejected, 'SCOPE-003', 'Profil VIP dengan workspace Superuser ditolak.');

const settingsMarkup = read('features/settings/settings.html');
assert(/data-requires-feature="userAdmin"[\s\S]*?>\s*<h4[^>]*>[^<]*<i[^>]*><\/i>Identitas Kelas/.test(settingsMarkup),
    'SCOPE-004', 'Identitas kelas hanya ditampilkan kepada Superuser.');
assert(/Ekspor & Cadangan Offline/.test(settingsMarkup) && /Keamanan Akun/.test(settingsMarkup),
    'SCOPE-005', 'Backup offline dan keamanan akun tersedia untuk role terautentikasi.');

const realtimeRules = read('firebase/database.rules.production.json');
assert(/ws_superuser[\s\S]*?ws_pjok/.test(realtimeRules),
    'SCOPE-006', 'RTDB rules mengikat dua role ke workspace kanonik.');
assert(/role'\)\.val\(\) != 'vip' \|\| newData\.child\('mapel'\)\.val\(\) == 'PJOK'/.test(realtimeRules),
    'SCOPE-007', 'RTDB rules menolak TP dan nilai non-PJOK milik VIP.');
assert((realtimeRules.match(/auth\.token\.email == 'unggaran\.sditbm@gmail\.com'/g) || []).length >= 20,
    'SCOPE-008', 'Akses RTDB Superuser terikat ke token email owner.');
assert(/auth\.uid != \$uid \|\| newData\.child\('email'\)\.val\(\) == auth\.token\.email/.test(realtimeRules),
    'AUTH-006', 'Self-profile write tidak dapat mengubah identitas menjadi role akun lain.');
assert(!realtimeRules.includes('workspaceMigrations') && !read('js/database/repository.js').includes('dbMigrateLegacyWorkspaces'),
    'ROLE-001', 'Mesin migrasi lama tidak menjadi dependensi runtime.');
assert(Object.keys(policy.ROLES).length === 2 && policy.normalizeRole('teacher') === null,
    'ROLE-002', 'Policy menerima tepat dua role dan menolak role lain.');
assert(/state:\s*'ready'[\s\S]*?commitAdministrativeOperation/.test(read('js/database/repository.js')) && /academicYears\/\$\{current\}`\] = null/.test(read('edge/admin-operations.js')) && /await io.patchUser/.test(read('edge/admin-operations.js')),
    'YEAR-004', 'Rollover memakai readiness gate dan PATCH data atomik melalui server.');
assert(/Tahun Pelajaran tidak dapat diubah dari Identitas Kelas/.test(read('features/settings/settings.js')),
    'YEAR-005', 'Perubahan tahun langsung dari Identitas Kelas ditolak.');

assert(/if \(!terminalAccessFailure\) return;[\s\S]*?signOut\(auth\)/.test(read('js/auth/auth.js')),
    'AUTH-010', 'Kegagalan profil sementara mempertahankan sesi lokal; hanya pelanggaran identitas terminal yang melakukan sign-out fail-closed.');
assert(/resumeAuthenticatedSession/.test(read('js/auth/auth.js'))
    && /pageshow/.test(read('js/auth/auth.js'))
    && /visibilitychange/.test(read('js/auth/auth.js'))
    && !/function unlockScreen\(\)[\s\S]{0,400}setTimeout/.test(read('js/ui/navigation.js')),
    'AUTH-011', 'Resume PWA memulihkan sesi aktif dan transisi layar login tidak memakai timer yang dapat saling menyalip.');
assert(!/\.className\s*=/.test(read('js/ui/navigation.js')) && /applyAccessUI/.test(read('js/ui/navigation.js')), 'UI-003', 'Switch view mempertahankan class semantik dan otorisasi elemen navigasi.');
assert(!/id="view-lps"/.test(read('index.html'))
    && /id !== 'lps'[\s\S]*?SIMNILPS\?\.unmount/.test(read('js/ui/navigation.js'))
    && /byId\([\s\S]*?'view-lps'[\s\S]*?\)\?\.remove\(\)/.test(read('features/lps/lps.js')),
    'UI-007', 'Markup LPS tidak berada di Dashboard dan dihapus dari DOM saat view ditinggalkan.');
assert(/const shellBrand = 'SIMNI'/.test(read('js/ui/render.js')), 'UI-004', 'Brand aplikasi dipisahkan dari identitas kelas.');
assert(/--simni-primary/.test(read('js/ui/shell.css')) && /--simni-active-canvas/.test(read('js/ui/shell.css')), 'UI-005', 'Tema global mencakup warna aksi dan canvas aplikasi.');
assert(/simni-logo\.png/.test(read('index.html')) && /school-logo\.png/.test(read('features/lps/lps-core.js')),
    'UI-006', 'Logo shell SIMNI dipisahkan dari logo sekolah LPS/BLP.');

const edgeWorker = read('edge/worker.js');
assert(/SIMNI_ALLOWED_ORIGINS/.test(edgeWorker), 'EDGE-001', 'Origin Edge API menggunakan allowlist eksplisit.');
assert(/createCloudinarySignature[\s\S]*?Hanya Superuser yang dapat mengunggah aset dokumen\./.test(edgeWorker),
    'EDGE-005', 'Cloudinary tetap terpisah untuk aset LKPD dan Dokumen SIMNI.');
assert(edgeWorker.includes('https://www.googleapis.com/auth/userinfo.email')
    && /authoritativeProfile[\s\S]*?Authorization:\s*`Bearer\s+\$\{access\}`/.test(edgeWorker),
    'EDGE-006', 'Service account RTDB memakai scope email wajib dan Authorization Bearer.');
const cloudinaryClient = read('js/database/cloudinary-client.js');
const uploadFormSource = /function buildUploadForm[\s\S]*?return form;/.exec(cloudinaryClient)?.[0] || '';
assert(uploadFormSource.indexOf("'upload_preset'") >= 0
    && uploadFormSource.indexOf("'upload_preset'") < uploadFormSource.indexOf("'file'")
    && /rawExtensionPattern/.test(cloudinaryClient),
    'EDGE-007', 'Parameter signed Cloudinary dikirim sebelum file dan public_id raw tervalidasi.');

const actionSource = read('js/ui/actions.js');
const declaredActions = new Set(
    [...combinedSource.matchAll(/data-simni-action="([^"]+)"/g)].map((match) => match[1])
);
const registeredActions = new Set([
    ...actionSource.matchAll(/^\s*'([^']+)',?\s*$/gm)
].map((match) => match[1]));
const missingActions = [...declaredActions].filter((action) => !registeredActions.has(action));
assert(missingActions.length === 0, 'UI-001', `Semua declarative action terdaftar${missingActions.length ? `: ${missingActions.join(', ')}` : ''}.`);
assert(/name === 'preventDefault'[\s\S]*?event\.preventDefault\(\)/.test(actionSource), 'UI-002', 'Built-in preventDefault mempertahankan kontrak event.');
const platformSource = read('js/platform/main.js');
assert(/addEventListener\('error'/.test(platformSource) && /addEventListener\('unhandledrejection'/.test(platformSource), 'ASYNC-001', 'Global error dan unhandled rejection boundary tersedia.');
assert(/RUNTIME_FAILURE_LIMIT/.test(platformSource), 'ASYNC-002', 'Runtime diagnostics dibatasi untuk mencegah pertumbuhan memori tanpa batas.');

const remoteFirebaseImport = /from\s+['"]https:\/\/www\.gstatic\.com\/firebasejs\//;
assert(!remoteFirebaseImport.test(combinedSource), 'PWA-001', 'Firebase Web SDK dimuat dari vendor lokal untuk cold-start offline.');
assert(/firebase-auth\.js/.test(read('sw.js')) && /firebase-database\.js/.test(read('sw.js')), 'PWA-002', 'Firebase Auth dan RTDB masuk precache Service Worker.');

const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.json'));
assert(packageJson.version === manifest.version, 'PWA-003', 'Versi package dan manifest sinkron.');
assert(manifest.display === 'standalone' && manifest.icons.some((icon) => icon.purpose === 'maskable'), 'PWA-004', 'Manifest menyediakan standalone display dan maskable icon.');

process.stdout.write(`\nSECURITY CONTRACT: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exitCode = 1;
}
