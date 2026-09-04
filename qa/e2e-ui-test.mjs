import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');
const HOST = '127.0.0.1';
const PORT = 4174;
const BASE_URL = `http://${HOST}:${PORT}`;
const FIREBASE_CONFIG = JSON.parse(readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf8'));
const PRODUCTION_CSP = FIREBASE_CONFIG.hosting?.headers
    ?.find((entry) => entry.source === '**')?.headers
    ?.find((header) => String(header.key).toLowerCase() === 'content-security-policy')?.value || '';
const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml']
]);

let passed = 0;
let failed = 0;
const failures = [];

function report(condition, label) {
    if (condition) {
        passed += 1;
        process.stdout.write(`[PASS] ${label}\n`);
        return;
    }
    failed += 1;
    failures.push(label);
    process.stdout.write(`[FAIL] ${label}\n`);
}

function resolvePublicPath(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl || '/', BASE_URL).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(PUBLIC_ROOT, relative);
    const boundary = `${PUBLIC_ROOT}${path.sep}`;
    return target === PUBLIC_ROOT || target.startsWith(boundary) ? target : null;
}

function createQaServer() {
    return createServer((request, response) => {
        if (new URL(request.url || '/', BASE_URL).pathname === '/qa-workflow.html') {
            const markup = '<!doctype html><html><head><meta charset="utf-8"><title>SIMNI Workflow QA</title></head><body><div id="toast-container"></div><div id="print-area" class="hidden"></div></body></html>';
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': Buffer.byteLength(markup),
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': PRODUCTION_CSP,
                'X-Content-Type-Options': 'nosniff'
            });
            response.end(markup);
            return;
        }
        const target = resolvePublicPath(request.url);
        if (!target) {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Forbidden');
            return;
        }
        try {
            const metadata = statSync(target);
            if (!metadata.isFile()) throw new Error('Not a file');
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': metadata.size,
                'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
                'Content-Security-Policy': PRODUCTION_CSP,
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Referrer-Policy': 'no-referrer',
                'X-Content-Type-Options': 'nosniff'
            });
            createReadStream(target).pipe(response);
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not Found');
        }
    });
}

async function listen(server) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(PORT, HOST, resolve);
    });
}

async function closeServer(server) {
    await new Promise((resolve) => server.close(resolve));
}

const server = createQaServer();
let browser;

try {
    await listen(server);
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
    });
    const page = await browser.newPage();
    const runtimeErrors = [];
    const failedResponses = [];
    page.on('pageerror', (error) => runtimeErrors.push(String(error?.message || error)));
    page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
        if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#form-login-auth', { visible: true, timeout: 15_000 });
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30_000 });

    report(await page.$('#form-login-auth') !== null, 'Login shell tersedia pada cold start');
    report(await page.$('#auth-email[autocomplete="username"]') !== null, 'Field email memiliki autocomplete login yang benar');
    report(await page.$('#auth-password[autocomplete="current-password"]') !== null, 'Field kata sandi memiliki autocomplete yang benar');

    report(await page.$('.login-shell[aria-labelledby="login-heading"]') !== null, 'Login modern memiliki struktur dan label aksesibel');
    const logoProbe = await page.evaluate(() => ({
        login: document.querySelector('.login-brand-icon img')?.getAttribute('src') || '',
        sidebar: document.querySelector('#icon-sidebar-container img')?.getAttribute('src') || ''
    }));
    report(logoProbe.login.includes('simni-logo.png') && logoProbe.sidebar.includes('simni-logo.png'),
        'Logo SIMNI baru tampil pada login dan shell dashboard');

    const themeProbe = await page.evaluate(() => {
        window.applyColorTheme?.('sage');
        const styles = getComputedStyle(document.documentElement);
        return {
            key: document.documentElement.dataset.colorTheme,
            primary: styles.getPropertyValue('--simni-primary').trim(),
            canvas: styles.getPropertyValue('--simni-canvas').trim()
        };
    });
    report(themeProbe.key === 'sage' && themeProbe.primary === '#0D9488' && themeProbe.canvas === '#F3FAF8', 'Tema mengubah palet tombol dan background global');

    const roleMatrix = await page.evaluate(() => ({
        count: Object.keys(window.SIMNIAccessPolicy.ROLES).length,
        vip: ['lps', 'notes', 'documents'].every((feature) => !window.SIMNIAccessPolicy.hasFeature('vip', feature))
    }));
    report(roleMatrix.count === 2, 'Policy UI hanya memuat role Superuser dan VIP');
    report(roleMatrix.vip, 'VIP tidak memiliki LPS, Catatan Guru, dan File/LKPD');

    const themeRoleGuard = await page.evaluate(() => {
        const restricted = document.querySelector('[data-target="lps"]');
        document.documentElement.dataset.simniRole = 'vip';
        window.applyColorTheme?.('sakura');
        const vipHidden = getComputedStyle(restricted).display === 'none';
        document.documentElement.dataset.simniRole = 'none';
        return vipHidden;
    });
    report(themeRoleGuard, 'Perubahan tema tidak dapat memunculkan menu LPS pada VIP');

    const navigationGuard = await page.evaluate(() => {
        const restricted = document.querySelector('[data-target="lps"]');
        restricted.classList.add('hidden');
        restricted.setAttribute('aria-hidden', 'true');
        window.switchView?.('qa-unauthorized');
        return restricted.classList.contains('hidden') && restricted.getAttribute('aria-hidden') === 'true';
    });
    report(navigationGuard, 'Perpindahan view tidak membuka kembali menu terlarang');

    report((await page.$eval('#ui-nama-kelas', (element) => element.textContent.trim())) === 'SIMNI', 'Brand shell tidak memakai Nama Kelas');

    const inlineHandlerCount = await page.evaluate(() =>
        [...document.querySelectorAll('*')].reduce((count, element) =>
            count + [...element.attributes].filter((attribute) => /^on/i.test(attribute.name)).length, 0));
    report(inlineHandlerCount === 0, 'DOM tidak memuat executable inline event handler');

    const protectedFragmentsBeforeAuth = await page.evaluate(() =>
        document.querySelectorAll('[data-simni-fragment-loaded="true"]').length);
    report(protectedFragmentsBeforeAuth === 0, 'Protected feature tidak dimuat sebelum autentikasi');

    report(await page.$('#invite-registration-modal') === null, 'Permukaan undangan berbayar/deprecated tidak diekspos');

    await page.evaluate(async () => {
        const loginScreen = document.getElementById('login-screen');
        loginScreen?.classList.add('hidden');
        loginScreen?.style.setProperty('display', 'none', 'important');
        const response = await fetch('./features/settings/settings.html', { cache: 'no-store' });
        const source = await response.text();
        const parsed = new DOMParser().parseFromString(source, 'text/html');
        const template = parsed.querySelector('template[data-simni-modal]');
        document.body.appendChild(document.importNode(template.content, true));
        const modal = document.getElementById('modal-pengaturan');
        modal.classList.remove('hidden', 'opacity-0');
        modal.classList.add('flex');
    });
    report(await page.$('#workspace-migration-panel, [data-simni-action="migrateLegacyWorkspacesByOwner"]') === null,
        'Pusat Pengaturan tidak mengekspos migrasi database sebagai tindakan role');
    report(await page.$('[data-simni-action="verifyAnnualArchiveFile"]') !== null && await page.$('[data-simni-action="startAnnualRollover"]') !== null,
        'Pusat Pengaturan menyediakan verifikasi arsip dan wizard rollover');
    await page.click('#modal-pengaturan [data-simni-action="closeModal"]');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const settingsClosed = await page.$eval('#modal-pengaturan', (modal) =>
        modal.classList.contains('hidden') && !modal.classList.contains('flex'));
    report(settingsClosed, 'Tombol X Pusat Pengaturan menutup modal melalui delegated action');

    const manifest = await page.evaluate(async () => {
        const response = await fetch('./manifest.json', { cache: 'no-store' });
        return response.ok ? response.json() : null;
    });
    report(manifest?.display === 'standalone', 'Manifest menggunakan display standalone');
    report(manifest?.icons?.some((icon) => icon.sizes === '512x512' && String(icon.purpose).includes('maskable')) === true,
        'Manifest menyediakan ikon 512 maskable');

    const workflowPage = await browser.newPage();
    await workflowPage.goto(`${BASE_URL}/qa-workflow.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await workflowPage.waitForFunction(() => document.readyState === 'complete', { timeout: 30_000 });
    for (const script of [
        'js/auth/access-policy-core.js',
        'js/utils/sanitize.js',
        'js/ui/date.js',
        'js/ui/feedback.js',
        'js/ui/navigation.js',
        'js/ui/render.js'
    ]) {
        await workflowPage.addScriptTag({ url: `${BASE_URL}/${script}` });
    }
    await workflowPage.evaluate(async () => {
        for (const feature of ['students', 'notes', 'grades', 'attendance']) {
            const response = await fetch(`./features/${feature}/${feature}.html`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Fragment ${feature} gagal dimuat.`);
            const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
            for (const template of parsed.querySelectorAll('template')) {
                document.body.appendChild(document.importNode(template.content, true));
            }
        }
        window.SIMNICurrentAccess = {
            uid: 'qa-owner-uid',
            email: 'owner@example.test',
            displayName: 'Guru Penguji',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            classId: '3A',
            activeAcademicYearId: '2026-2027',
            status: 'active'
        };
        window.state = {
            activeKelas: '3A',
            students: [
                { ID_Siswa: 'stu_1111111111', NISN: '1111111111', 'Nama Lengkap': 'Alya', Kelas: '3A' },
                { ID_Siswa: 'stu_2222222222', NISN: '2222222222', 'Nama Lengkap': 'Bima', Kelas: '3A' }
            ],
            mapelTP: [{ ID_mapel: 'tp_math_1', mapel: 'Matematika', semester: '1', kode_tp: 'MTK.1', deskripsi_tp: 'Menjumlahkan bilangan cacah' }],
            nilaiTP: [],
            presensi: [],
            catatan: [],
            pengaturan: { nama_kelas: '3A', tahun_pelajaran: '2026-2027' }
        };
        window.dbSet = async () => ({ ok: true });
        window.dbUpdate = async () => ({ ok: true });
        window.dbRemove = async () => ({ ok: true });
        window.renderDashboard = () => {};
    });
    for (const feature of ['students', 'notes', 'grades', 'attendance']) {
        await workflowPage.addScriptTag({ url: `${BASE_URL}/features/${feature}/${feature}.js` });
    }

    const gradeWorkflow = await workflowPage.evaluate(async () => {
        window.state.activeKelas = '3A';
        window.state.students = [
            { ID_Siswa: 'stu_1111111111', NISN: '1111111111', 'Nama Lengkap': 'Alya', Kelas: '3A' },
            { ID_Siswa: 'stu_2222222222', NISN: '2222222222', 'Nama Lengkap': 'Bima', Kelas: '3A' }
        ];
        window.state.mapelTP = [{ ID_mapel: 'tp_math_1', mapel: 'Matematika', semester: '1', kode_tp: 'MTK.1', deskripsi_tp: 'Menjumlahkan bilangan cacah' }];
        window.state.nilaiTP = [];
        window.state.presensi = [];
        window.state.catatan = [];
        renderNilaiTPControls();
        const subject = document.getElementById('filter-mapel-nilai');
        subject.value = 'Matematika';
        updateTPDropdown(true);
        const objective = document.getElementById('filter-tp-nilai');
        const before = objective.querySelector('option[value="tp_math_1"]');
        objective.value = 'tp_math_1';
        renderNilaiGrid();
        const rowsBefore = document.querySelectorAll('#nilai-table-body tr').length;
        const scores = document.querySelectorAll('#nilai-table-body .n-scr');
        scores[0].value = '80';
        await saveNilaiBatch();
        const partial = document.querySelector('#filter-tp-nilai option[value="tp_math_1"]');
        const partialEnabled = partial?.disabled === false;
        const partialLabel = partial?.textContent || '';
        objective.value = 'tp_math_1';
        renderNilaiGrid();
        const remainingScores = document.querySelectorAll('#nilai-table-body .n-scr');
        if (!remainingScores[1]) {
            throw new Error(`Tabel nilai parsial tidak lengkap: selected=${objective.value || '-'}, rows=${remainingScores.length}, state=${window.state.nilaiTP.length}`);
        }
        remainingScores[1].value = '90';
        await saveNilaiBatch();
        const completed = document.querySelector('#filter-tp-nilai option[value="tp_math_1"]');
        setNilaiTab('rekap');
        document.getElementById('rekap-mapel-nilai').value = 'Matematika';
        updateRekapTPDropdown();
        document.querySelector('.start-grade-edit')?.click();
        const editInput = document.querySelector('.edit-grade-score');
        if (editInput) editInput.value = '95';
        document.querySelector('.save-grade-edit')?.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
            beforeEnabled: before?.disabled === false,
            rowsBefore,
            partialEnabled,
            partialLabel,
            completedDisabled: completed?.disabled === true,
            completedLabel: completed?.textContent || '',
            savedCount: window.state.nilaiTP.length,
            editedScore: window.state.nilaiTP.find((item) => item.NISN === '1111111111')?.nilai,
            editButtonRestored: Boolean(document.querySelector('.start-grade-edit'))
        };
    });
    report(gradeWorkflow.beforeEnabled && gradeWorkflow.rowsBefore === 2,
        'Input Nilai otomatis menampilkan seluruh siswa setelah Mapel dan TP dipilih');
    report(gradeWorkflow.partialEnabled && gradeWorkflow.partialLabel.includes('Belum lengkap'),
        'TP dengan nilai parsial tetap dapat dipilih untuk menuntaskan siswa yang belum dinilai');
    report(gradeWorkflow.completedDisabled && gradeWorkflow.completedLabel.includes('Sudah dinilai') && gradeWorkflow.savedCount === 2,
        'TP lengkap ditandai sudah dinilai dan tidak dapat dipilih ulang');
    report(gradeWorkflow.editedScore === 95 && gradeWorkflow.editButtonRestored,
        'Rekap Nilai mengedit dan menyimpan perbaikan nilai per siswa');

    const attendanceWorkflow = await workflowPage.evaluate(async () => {
        window.state.activeKelas = '3A';
        window.state.students = [
            { ID_Siswa: 'stu_1111111111', NISN: '1111111111', 'Nama Lengkap': 'Alya', Kelas: '3A' },
            { ID_Siswa: 'stu_2222222222', NISN: '2222222222', 'Nama Lengkap': 'Bima', Kelas: '3A' }
        ];
        window.state.presensi = [];
        document.getElementById('presensi-date').value = '2026-09-02';
        renderPresensiManual();
        const initialRows = document.querySelectorAll('#presensi-table-body tr').length;
        await savePresensiManual();
        const completedVisible = !document.getElementById('presensi-completed-state').classList.contains('hidden');
        const completedLabel = document.querySelector('#presensi-primary-action span')?.textContent || '';
        editPresensiManual();
        return {
            initialRows,
            completedVisible,
            completedLabel,
            tableVisibleAfterEdit: !document.getElementById('presensi-entry-table').classList.contains('hidden'),
            editLabel: document.querySelector('#presensi-primary-action span')?.textContent || ''
        };
    });
    report(attendanceWorkflow.initialRows === 2 && attendanceWorkflow.completedVisible && attendanceWorkflow.completedLabel === 'Edit Kehadiran',
        `Presensi lengkap berubah menjadi status sudah dilakukan selesai dan tombol Edit Kehadiran (${JSON.stringify(attendanceWorkflow)})`);
    report(attendanceWorkflow.tableVisibleAfterEdit && attendanceWorkflow.editLabel === 'Simpan Perubahan',
        `Edit Kehadiran membuka kembali tabel dan menyediakan simpan perubahan (${JSON.stringify(attendanceWorkflow)})`);

    const saveFeedbackWorkflow = await workflowPage.evaluate(async () => {
        window.state.activeKelas = '3A';
        window.state.students = [
            { ID_Siswa: 'stu_1111111111', NISN: '1111111111', 'Nama Lengkap': 'Alya', Kelas: '3A' },
            { ID_Siswa: 'stu_2222222222', NISN: '2222222222', 'Nama Lengkap': 'Bima', Kelas: '3A' }
        ];
        window.state.catatan = [];
        const toastCountBefore = document.querySelectorAll('#toast-container [role="status"]').length;
        document.getElementById('input-old-nisn').value = '';
        document.getElementById('input-nisn').value = '3333333333';
        document.getElementById('input-nama').value = 'Citra';
        document.getElementById('input-panggilan').value = 'Citra';
        document.getElementById('input-kelompok').value = 'Kelompok 1';
        document.getElementById('input-foto').value = '';
        const studentForm = document.getElementById('form-add-siswa');
        await submitSiswa({ preventDefault() {}, target: studentForm });
        document.getElementById('input-catatan-siswa').value = '3333333333';
        document.getElementById('input-catatan-teks').value = 'Perkembangan belajar baik.';
        document.getElementById('input-catatan-tanggal').value = '2026-09-02';
        const noteForm = document.querySelector('#catatan-tab-input form');
        await submitCatatan({ preventDefault() {}, target: noteForm });
        const successToasts = [...document.querySelectorAll('#toast-container [role="status"]')]
            .filter((node) => node.textContent.includes('Berhasil disimpan.'));
        return {
            studentStored: window.state.students.some((item) => item.NISN === '3333333333'),
            studentRendered: Boolean(document.querySelector('[data-student-nisn="3333333333"]')),
            noteStored: window.state.catatan.some((item) => item.NISN === '3333333333'),
            successToastCount: successToasts.length - toastCountBefore,
            allHaveCheckIcon: successToasts.every((node) => Boolean(node.querySelector('.fa-check-circle')))
        };
    });
    report(saveFeedbackWorkflow.studentStored && saveFeedbackWorkflow.studentRendered && saveFeedbackWorkflow.noteStored,
        `Simpan siswa dan Tulis Catatan merekonsiliasi state serta merender data baru (${JSON.stringify(saveFeedbackWorkflow)})`);
    report(saveFeedbackWorkflow.successToastCount >= 2 && saveFeedbackWorkflow.allHaveCheckIcon,
        `Operasi simpan menampilkan popup Berhasil disimpan dengan ikon centang (${JSON.stringify(saveFeedbackWorkflow)})`);
    await workflowPage.close();

    const gadmPage = await browser.newPage();
    await gadmPage.goto(`${BASE_URL}/features/gadm/gadm.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await gadmPage.addStyleTag({ url: `${BASE_URL}/features/gadm/gadm.css` });
    await gadmPage.addScriptTag({ url: `${BASE_URL}/js/auth/access-policy-core.js` });
    await gadmPage.addScriptTag({ url: `${BASE_URL}/vendor/xlsx/xlsx.full.min.js` });
    await gadmPage.addScriptTag({ url: `${BASE_URL}/vendor/html2pdf/html2pdf.bundle.min.js` });
    const gadmMounted = await gadmPage.evaluate(async () => {
        const template = document.querySelector('template[data-simni-view="gadm"]');
        document.body.appendChild(document.importNode(template.content, true));
        window.state = {
            pengaturan: {
                nama_sekolah: 'SDIT BINA MUDA CICALENGKA',
                nama_wali_kelas: 'Guru Penguji'
            },
            activeKelas: '5B'
        };
        window.getSIMNIActiveClass = () => window.state.activeKelas;
        window.SIMNICurrentAccess = {
            uid: 'qa-vip-uid',
            email: 'vip@example.test',
            displayName: 'Guru PJOK',
            role: 'vip',
            workspaceId: 'ws_pjok',
            classId: 'PJOK',
            activeAcademicYearId: '2026-2027',
            status: 'active'
        };
        window.SIMNIAccess = Object.freeze({ canAccess: (feature) => feature === 'gadm' });
        await import('./gadm.js');
        await window.SIMNIGADM.ensureReady();
        return {
            mounted: window.SIMNIGADM.isMounted(),
            subject: document.getElementById('gadm-mata-pelajaran')?.value,
            subjectLocked: document.getElementById('gadm-mata-pelajaran')?.disabled,
            grade: document.getElementById('gadm-kelas-fase')?.value,
            year: document.getElementById('gadm-tahun-pelajaran')?.value,
            exportsReady: typeof window.XLSX?.writeFile === 'function' && typeof window.html2pdf === 'function',
            wordButton: !!document.getElementById('gadm-download-word'),
            excelButton: !!document.getElementById('gadm-download-excel')
        };
    });
    report(gadmMounted.mounted && gadmMounted.subject === 'PJOK' && gadmMounted.subjectLocked,
        'GADM aktif untuk VIP dan mata pelajaran terkunci ke PJOK');
    report(gadmMounted.grade === '5' && gadmMounted.year === '2026/2027',
        'GADM mengambil kelas aktif dan tahun pelajaran dari scope SIMNI');
    report(gadmMounted.exportsReady && gadmMounted.wordButton && gadmMounted.excelButton,
        'Runtime ekspor PDF, Word, dan Excel tersedia pada GADM');

    await gadmPage.setOfflineMode(true);
    const gadmOfflineStorage = await gadmPage.evaluate(async () => {
        const values = {
            'gadm-materi-unit': 'Gerak dasar lokomotor',
            'gadm-cp-tp': 'Peserta didik mempraktikkan variasi gerak dasar lokomotor dengan kontrol tubuh yang baik.',
            'gadm-alokasi-waktu': '2 x 35 menit'
        };
        for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
        document.getElementById('gadm-generate').click();
        document.getElementById('gadm-save').click();
        const storage = await import('./gadm-storage.js');
        const vipScope = {
            uid: 'qa-vip-uid',
            role: 'vip',
            workspaceId: 'ws_pjok',
            activeAcademicYearId: '2026-2027',
            scopedClassId: '5B'
        };
        const superuserScope = {
            uid: 'qa-owner-uid',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            activeAcademicYearId: '2026-2027',
            scopedClassId: '3A'
        };
        let vipRecords = [];
        for (let attempt = 0; attempt < 30; attempt += 1) {
            vipRecords = await storage.listGADMDocuments(vipScope);
            if (vipRecords.length) break;
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const superuserRecords = await storage.listGADMDocuments(superuserScope);
        return {
            previewReady: document.getElementById('gadm-status')?.dataset.state === 'ok',
            vipCount: vipRecords.length,
            vipSubject: vipRecords[0]?.input?.mataPelajaran || '',
            superuserCount: superuserRecords.length
        };
    });
    await gadmPage.setOfflineMode(false);
    report(gadmOfflineStorage.previewReady && gadmOfflineStorage.vipCount === 1 && gadmOfflineStorage.vipSubject === 'PJOK',
        'GADM membuat dan menyimpan dokumen VIP sepenuhnya offline');
    report(gadmOfflineStorage.superuserCount === 0,
        'IndexedDB GADM mencegah kebocoran data antara scope VIP dan Superuser');
    const gadmSuperuser = await gadmPage.evaluate(async () => {
        window.SIMNIGADM.unmount();
        document.querySelector('section#view-gadm')?.remove();
        document.getElementById('gadm-history-dialog')?.remove();
        const template = document.querySelector('template[data-simni-view="gadm"]');
        document.body.appendChild(document.importNode(template.content, true));
        window.state.activeKelas = '3A';
        window.SIMNICurrentAccess = {
            uid: 'qa-owner-uid',
            email: 'owner@example.test',
            displayName: 'Owner Superuser',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            classId: '3A',
            activeAcademicYearId: '2026-2027',
            status: 'active'
        };
        await window.SIMNIGADM.ensureReady();
        return {
            mounted: window.SIMNIGADM.isMounted(),
            subjectUnlocked: document.getElementById('gadm-mata-pelajaran')?.disabled === false,
            grade: document.getElementById('gadm-kelas-fase')?.value
        };
    });
    report(gadmSuperuser.mounted && gadmSuperuser.subjectUnlocked && gadmSuperuser.grade === '3',
        'GADM aktif untuk Superuser dengan mata pelajaran editable dan kelas kanonik');
    await gadmPage.close();

    const chatNavigationContract = await page.evaluate(() => ({
        links: [...document.querySelectorAll('a[data-requires-feature="chat"]')].length,
        newTabLinks: [...document.querySelectorAll('a[data-requires-feature="chat"]')]
            .filter((link) => link.getAttribute('target') === '_blank').length,
        badges: document.querySelectorAll('[data-chat-unread-badge]').length
    }));
    report(chatNavigationContract.links === 2 && chatNavigationContract.newTabLinks === 0,
        'Chat desktop/mobile memakai tab yang sama untuk mempertahankan sesi');
    report(chatNavigationContract.badges === 2, 'Badge unread tersedia pada navigasi Chat desktop dan mobile');

    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mobilePage.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await mobilePage.waitForSelector('#sync-status-mobile', { timeout: 15_000 });
    const mobileHeaderAndBadge = await mobilePage.evaluate(() => {
        document.getElementById('login-screen')?.classList.add('hidden');
        const title = document.getElementById('ui-mobile-nama-kelas');
        const status = document.getElementById('sync-status-mobile');
        const link = document.querySelector('nav[aria-label="Navigasi utama mobile"] .chat-nav-link');
        const badge = link?.querySelector('[data-chat-unread-badge]');
        const hiddenDisplay = badge ? getComputedStyle(badge).display : '';
        link?.classList.remove('hidden');
        link?.setAttribute('aria-hidden', 'false');
        badge?.classList.remove('hidden');
        const titleRect = title?.getBoundingClientRect();
        const statusRect = status?.getBoundingClientRect();
        const linkRect = link?.getBoundingClientRect();
        const badgeRect = badge?.getBoundingClientRect();
        return {
            noHeaderOverlap: !!titleRect && !!statusRect && (
                titleRect.right <= statusRect.left
                || statusRect.right <= titleRect.left
                || titleRect.bottom <= statusRect.top
                || statusRect.bottom <= titleRect.top
            ),
            statusOutsideIdentity: status?.parentElement !== title?.parentElement,
            hiddenDisplay,
            semanticAnchor: link?.classList.contains('chat-nav-link') === true && getComputedStyle(link).position === 'relative',
            badgeInsideChat: !!linkRect && !!badgeRect
                && badgeRect.left >= linkRect.left
                && badgeRect.right <= linkRect.right
                && badgeRect.top >= linkRect.top
                && badgeRect.bottom <= linkRect.bottom
        };
    });
    report(mobileHeaderAndBadge.noHeaderOverlap && mobileHeaderAndBadge.statusOutsideIdentity,
        'Status Online mobile berada di luar blok judul dan tidak menimpa nama SIMNI');
    report(mobileHeaderAndBadge.hiddenDisplay === 'none', 'Badge unread nol benar-benar tidak dirender');
    report(mobileHeaderAndBadge.semanticAnchor && mobileHeaderAndBadge.badgeInsideChat,
        'Badge unread mobile terikat pada ikon Chat, bukan menu lain');

    const loginTransitionContract = await mobilePage.evaluate(async () => {
        const screen = document.getElementById('login-screen');
        window.lockScreen?.();
        window.unlockScreen?.();
        window.lockScreen?.();
        await new Promise((resolve) => setTimeout(resolve, 650));
        const remainsLocked = screen
            && !screen.classList.contains('hidden')
            && screen.classList.contains('flex')
            && screen.inert === false;
        window.unlockScreen?.();
        const unlocksSynchronously = screen
            && screen.classList.contains('hidden')
            && !screen.classList.contains('flex')
            && screen.inert === true;
        return { remainsLocked, unlocksSynchronously };
    });
    report(loginTransitionContract.remainsLocked && loginTransitionContract.unlocksSynchronously,
        'Urutan lock/unlock cepat tidak meninggalkan layar login beku');

    const unlockBeforeReload = await mobilePage.evaluate(async () => {
        const module = await import('./js/auth/chat-unlock.js');
        const user = { uid: 'qa_chat_unlock_uid', email: 'qa-chat-unlock@simni.test' };
        const key = await module.establishChatAccountUnlock(user, 'qa-only-password-457');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode('SIMNI_CHAT_RELOAD_OK')
        );
        sessionStorage.setItem('qa-chat-unlock-payload', JSON.stringify({
            iv: Array.from(iv),
            ciphertext: Array.from(new Uint8Array(ciphertext))
        }));
        return key.extractable === false;
    });
    await mobilePage.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    const unlockAfterReload = await mobilePage.evaluate(async () => {
        const module = await import('./js/auth/chat-unlock.js');
        const payload = JSON.parse(sessionStorage.getItem('qa-chat-unlock-payload'));
        const key = await module.getChatAccountUnlock('qa_chat_unlock_uid');
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
            key,
            new Uint8Array(payload.ciphertext)
        );
        await module.clearChatAccountUnlock('qa_chat_unlock_uid');
        sessionStorage.removeItem('qa-chat-unlock-payload');
        return new TextDecoder().decode(plaintext);
    });
    report(unlockBeforeReload && unlockAfterReload === 'SIMNI_CHAT_RELOAD_OK',
        'Kunci akun Chat non-exportable tetap dapat digunakan setelah hard refresh');
    await mobilePage.close();

    const chatPage = await browser.newPage();
    await chatPage.goto(`${BASE_URL}/chat/chat.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await chatPage.waitForSelector('#chat-composer', { visible: true, timeout: 15_000 });
    await chatPage.waitForFunction(() => typeof window.SIMNIChatDebug === 'object', { timeout: 15_000 });
    const chatUiContract = await chatPage.evaluate(() => ({
        appRows: getComputedStyle(document.getElementById('chat-app')).gridTemplateRows,
        logo: document.querySelector('.chat-brand-logo')?.getAttribute('src') || '',
        voiceLabel: document.getElementById('chat-voice')?.getAttribute('aria-label') || '',
        acceptsMedia: document.getElementById('chat-file-input')?.getAttribute('accept') || ''
    }));
    report(chatUiContract.appRows.split(' ').length >= 4 && chatUiContract.logo.includes('simni-logo.png'),
        'UI Chat modern memakai layout responsif dan identitas SIMNI');
    report(/voice note/i.test(chatUiContract.voiceLabel) && /image\/\*/.test(chatUiContract.acceptsMedia) && /audio\/\*/.test(chatUiContract.acceptsMedia),
        'Kontrol upload media dan voice note tersedia serta aksesibel');

    const composerContract = await chatPage.evaluate(() => {
        const input = document.getElementById('chat-input');
        input.disabled = false;
        input.value = Array.from({ length: 8 }, (_, index) => `Baris ${index + 1}`).join('\n');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const expanded = input.getBoundingClientRect().height;
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const collapsed = input.getBoundingClientRect().height;
        return { expanded, collapsed };
    });
    report(composerContract.expanded > composerContract.collapsed && composerContract.collapsed <= 48,
        'Composer mengembang mengikuti teks dan kembali mengecil setelah dikosongkan');
    const audioPlaybackContract = await chatPage.evaluate(async () => {
        const platform = await import('./js/chat-platform.js');
        const sampleRate = 16000;
        const samples = new Float32Array(sampleRate / 2);
        for (let index = 0; index < samples.length; index += 1) {
            samples[index] = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.2;
        }
        const wav = platform.encodeMonoPcm16Wav(samples, sampleRate);
        const blob = await platform.createPlayableAudioBlob(
            new Uint8Array(wav),
            'audio/wav',
            'qa-voice.wav'
        );
        const url = URL.createObjectURL(blob);
        const audio = document.createElement('audio');
        audio.src = url;
        audio.preload = 'auto';
        document.body.appendChild(audio);
        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Metadata WAV timeout')), 5000);
                audio.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
                audio.addEventListener('error', () => {
                    clearTimeout(timeout);
                    reject(new Error('WAV tidak dapat didekode browser'));
                }, { once: true });
                audio.load();
            });
            await audio.play();
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Playback WAV tidak bergerak')), 5000);
                const progressed = () => {
                    if (audio.currentTime <= 0) return;
                    clearTimeout(timeout);
                    audio.removeEventListener('timeupdate', progressed);
                    resolve();
                };
                audio.addEventListener('timeupdate', progressed);
            });
            return {
                mime: blob.type,
                duration: audio.duration,
                progressed: audio.currentTime > 0
            };
        } finally {
            audio.pause();
            audio.remove();
            URL.revokeObjectURL(url);
        }
    });
    report(audioPlaybackContract.mime === 'audio/wav'
        && audioPlaybackContract.duration >= 0.45
        && audioPlaybackContract.progressed,
        'Voice note WAV didekode dan benar-benar bergerak pada media engine browser');
    await Promise.all([
        chatPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }),
        chatPage.click('#chat-back')
    ]);
    report(new URL(chatPage.url()).pathname.endsWith('/index.html'),
        'Tombol kembali Chat menavigasi ke Dashboard pada tab yang sama');
    await chatPage.close();

    const mockSuperuserPage = await browser.newPage();
    const mockRuntimeErrors = [];
    mockSuperuserPage.on('pageerror', (error) => mockRuntimeErrors.push(String(error?.message || error)));
    mockSuperuserPage.on('console', (message) => {
        if (message.type() === 'error') mockRuntimeErrors.push(message.text());
    });
    await mockSuperuserPage.setBypassServiceWorker(true);
    await mockSuperuserPage.setCacheEnabled(false);
    await mockSuperuserPage.setRequestInterception(true);
    mockSuperuserPage.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith('/js/auth/auth.js')) {
            request.respond({
                status: 200,
                contentType: 'text/javascript; charset=utf-8',
                body: `
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    const access = Object.freeze({
                        uid: 'qa-superuser-uid',
                        email: 'superuser@qa.simni.test',
                        displayName: 'Superuser QA',
                        role: 'superuser',
                        workspaceId: 'ws_superuser',
                        classId: '3A',
                        activeAcademicYearId: '2026-2027',
                        status: 'active'
                    });
                    window.SIMNICurrentAccess = access;
                    window.SIMNIAccess = Object.freeze({
                        canAccess: () => true,
                        applyAccessUI: () => {
                            document.documentElement.dataset.simniRole = access.role;
                        }
                    });
                    window.isUserLoggedIn = true;
                    window.SIMNIAuthState = Object.freeze({
                        phase: 'session-ready',
                        uid: access.uid,
                        email: access.email,
                        message: '',
                        loginBusy: false,
                        credentialBusy: false
                    });
                    const { loadFeatureFragments } = await import('../core/feature-loader.js');
                    await loadFeatureFragments();
                    window.SIMNIAccess.applyAccessUI();
                    window.switchView?.('dashboard');
                    window.unlockScreen?.();
                    window.resumeSIMNIAuthSession = () => {
                        window.unlockScreen?.();
                        return true;
                    };
                    export {};
                `
            }).catch(() => undefined);
            return;
        }
        request.continue().catch(() => undefined);
    });
    await mockSuperuserPage.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await mockSuperuserPage.waitForSelector('.session-restore-panel', { visible: true, timeout: 15_000 });
    const restoringSessionUI = await mockSuperuserPage.evaluate(() => ({
        phase: document.documentElement.dataset.simniAuthPhase,
        restoreDisplay: getComputedStyle(document.querySelector('.session-restore-panel')).display,
        loginDisplay: getComputedStyle(document.querySelector('.login-shell')).display
    }));
    report(restoringSessionUI.phase === 'restoring-session'
        && restoringSessionUI.restoreDisplay === 'flex'
        && restoringSessionUI.loginDisplay === 'none',
        'Cold start menampilkan pemulihan sesi tanpa kilatan formulir login');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const mockBeforeChat = await mockSuperuserPage.evaluate(() => ({
        phase: window.SIMNIAuthState?.phase,
        role: window.SIMNICurrentAccess?.role,
        loginHidden: document.getElementById('login-screen')?.classList.contains('hidden'),
        dashboardVisible: document.getElementById('view-dashboard')?.hidden === false,
        dashboardPresent: Boolean(document.getElementById('view-dashboard')),
        boot: window.SIMNIBootDiagnostics || null,
        fragments: window.SIMNIFragmentDiagnostics || null
    }));
    if (
        mockBeforeChat.phase !== 'session-ready'
        || mockBeforeChat.role !== 'superuser'
        || !mockBeforeChat.loginHidden
        || !mockBeforeChat.dashboardVisible
    ) {
        throw new Error(`Mock Superuser gagal aktif: ${JSON.stringify({ mockBeforeChat, mockRuntimeErrors })}`);
    }
    report(mockBeforeChat.phase === 'session-ready'
        && mockBeforeChat.role === 'superuser'
        && mockBeforeChat.loginHidden
        && mockBeforeChat.dashboardVisible,
        'Mock login Superuser masuk langsung ke Dashboard');
    await mockSuperuserPage.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await mockSuperuserPage.waitForFunction(() =>
        window.SIMNIAuthState?.phase === 'session-ready'
        && document.getElementById('login-screen')?.classList.contains('hidden')
        && document.getElementById('view-dashboard')?.hidden === false,
    { timeout: 30_000 });
    const mockAfterReopen = await mockSuperuserPage.evaluate(() => ({
        phase: window.SIMNIAuthState?.phase,
        loginHidden: document.getElementById('login-screen')?.classList.contains('hidden'),
        dashboardVisible: document.getElementById('view-dashboard')?.hidden === false
    }));
    report(mockAfterReopen.phase === 'session-ready'
        && mockAfterReopen.loginHidden
        && mockAfterReopen.dashboardVisible,
        'Mock Superuser pulih setelah reload/reopen tanpa layar login beku');
    await mockSuperuserPage.goto(`${BASE_URL}/chat/chat.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await Promise.all([
        mockSuperuserPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
        mockSuperuserPage.click('#chat-back')
    ]);
    await mockSuperuserPage.waitForFunction(() =>
        window.SIMNIAuthState?.phase === 'session-ready'
        && document.getElementById('login-screen')?.classList.contains('hidden')
        && document.getElementById('view-dashboard')?.hidden === false,
    { timeout: 30_000 });
    const mockAfterChat = await mockSuperuserPage.evaluate(() => ({
        pathname: location.pathname,
        phase: window.SIMNIAuthState?.phase,
        role: window.SIMNICurrentAccess?.role,
        loginHidden: document.getElementById('login-screen')?.classList.contains('hidden'),
        dashboardVisible: document.getElementById('view-dashboard')?.hidden === false
    }));
    report(mockAfterChat.pathname.endsWith('/index.html')
        && mockAfterChat.phase === 'session-ready'
        && mockAfterChat.role === 'superuser'
        && mockAfterChat.loginHidden
        && mockAfterChat.dashboardVisible,
        'Mock Superuser kembali dari Chat tanpa logout, layar login beku, atau kehilangan Dashboard');
    await mockSuperuserPage.close();

    const workerState = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'unsupported';
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 45_000));
        const registration = await Promise.race([navigator.serviceWorker.ready, timeout]);
        if (!registration) {
            const current = await navigator.serviceWorker.getRegistration();
            return current?.installing?.state || current?.waiting?.state || current?.active?.state || 'timeout';
        }
        const worker = registration.active || registration.waiting || registration.installing;
        if (!worker || worker.state === 'activated') return worker?.state || 'missing';
        await Promise.race([
            new Promise((resolve) => worker.addEventListener('statechange', () => {
                if (worker.state === 'activated' || worker.state === 'redundant') resolve();
            })),
            new Promise((resolve) => setTimeout(resolve, 15_000))
        ]);
        return worker.state;
    });
    report(workerState === 'activated', `Service Worker terpasang dan aktif (state=${workerState})`);

    const responseChecks = await page.evaluate(async () => {
        const paths = ['./index.html', './icons/simni-logo.png', './icons/favicon-32.png', './js/platform/main.js', './vendor/firebase/firebase-app.js'];
        return Promise.all(paths.map(async (asset) => {
            const response = await fetch(asset, { cache: 'reload' });
            return { asset, ok: response.ok };
        }));
    });
    responseChecks.forEach(({ asset, ok }) => report(ok, `Asset inti dapat dimuat: ${asset}`));

    report(runtimeErrors.length === 0, `Tidak ada unhandled browser exception${runtimeErrors.length ? `: ${runtimeErrors.join(' | ')}` : ''}`);
    report(failedResponses.length === 0, `Tidak ada respons aset gagal${failedResponses.length ? `: ${failedResponses.join(' | ')}` : ''}`);

    await page.setOfflineMode(true);
    try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
        let offlineAuthTerminal = true;
        try {
            await page.waitForFunction(() => {
                const phase = document.documentElement.dataset.simniAuthPhase;
                return phase === 'signed-out' || phase === 'session-ready' || phase === 'error';
            }, { timeout: 15_000 });
        } catch (_) {
            offlineAuthTerminal = false;
        }
        const offlineAuthState = await page.evaluate(() => ({
            phase: document.documentElement.dataset.simniAuthPhase,
            loginVisible: !document.getElementById('login-screen')?.classList.contains('hidden'),
            dashboardVisible: document.getElementById('view-dashboard')?.hidden === false,
            runtimeReady: Boolean(window.SIMNIRuntime),
            authState: window.SIMNIAuthState || null,
            boot: window.SIMNIBootDiagnostics || null,
            failures: window.SIMNIRuntimeFailures || []
        }));
        report(
            offlineAuthTerminal && ((offlineAuthState.phase === 'signed-out' && offlineAuthState.loginVisible)
                || (offlineAuthState.phase === 'session-ready' && offlineAuthState.dashboardVisible)),
            `Cold reload offline mencapai state autentikasi terminal yang dapat digunakan (${JSON.stringify(offlineAuthState)})`
        );
        const offlineAssetReady = await page.evaluate(async () => {
            const response = await fetch('./js/platform/main.js');
            return response.ok;
        });
        report(offlineAssetReady, 'Cold reload offline memuat shell dan asset inti dari Service Worker');
    } finally {
        await page.setOfflineMode(false);
    }
} catch (error) {
    report(false, `E2E runner selesai tanpa crash: ${error?.stack || error?.message || error}`);
} finally {
    if (browser) await browser.close();
    await closeServer(server);
}

process.stdout.write(`\nE2E UI: ${passed} PASS, ${failed} FAIL\n`);
if (failures.length) failures.forEach((failure) => process.stdout.write(` - ${failure}\n`));
process.exitCode = failed > 0 ? 1 : 0;
