import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const WORKSPACE_ROOT = 'C:\\Users\\Aretha Hafiza S\\Downloads\\SIMNI\\SIMNI_GADM_INTEGRATION';
const PUBLIC_ROOT = path.resolve(WORKSPACE_ROOT, 'public');
const HOST = '127.0.0.1';
const PORT = 4175;
const BASE_URL = `http://${HOST}:${PORT}`;

const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.woff2', 'font/woff2']
]);

function resolvePublicPath(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl || '/', BASE_URL).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(PUBLIC_ROOT, relative);
    const boundary = `${PUBLIC_ROOT}${path.sep}`;
    return target === PUBLIC_ROOT || target.startsWith(boundary) ? target : null;
}

const server = createServer((req, res) => {
    const target = resolvePublicPath(req.url);
    if (!target) {
        res.writeHead(404);
        return res.end('Not found');
    }
    try {
        const meta = statSync(target);
        if (!meta.isFile()) {
            res.writeHead(404);
            return res.end('Not found');
        }
        res.writeHead(200, {
            'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
            'Cross-Origin-Opener-Policy': 'same-origin'
        });
        createReadStream(target).pipe(res);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

await new Promise((resolve) => server.listen(PORT, HOST, resolve));
console.log('Server listening on', BASE_URL);

const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.error('[PAGE ERROR]', err));

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Login as mock Superuser
    await page.evaluate(() => {
        if (window.loginMockSuperuser) return window.loginMockSuperuser();
    });
    // Wait for boot and sync ready
    await page.waitForFunction(() => window.SIMNISyncState?.status === 'ready' && window.state?.students?.length > 0, { timeout: 15000 });

    // Inspect sync state
    const syncInfo = await page.evaluate(() => {
        return {
            syncState: window.SIMNISyncState,
            accessContext: window.SIMNICurrentAccess,
            mapelTPCount: window.state?.mapelTP?.length,
            studentsCount: window.state?.students?.length,
            presensiCount: window.state?.presensi?.length
        };
    });
    console.log('SYNC INFO:', JSON.stringify(syncInfo, null, 2));

    // Test 1: Submit new TP
    console.log('\n--- TEST 1: Submit new TP ---');
    const tpTest = await page.evaluate(async () => {
        if (window.switchView) await window.switchView('grades');
        await new Promise((r) => setTimeout(r, 600));
        if (window.openModal) window.openModal('modal-kelola-tp');
        await new Promise((r) => setTimeout(r, 300));

        const mapel = document.getElementById('input-tp-mapel');
        const smt = document.getElementById('input-tp-smt');
        const kode = document.getElementById('input-tp-kode');
        const desc = document.getElementById('input-tp-desc');
        const bab = document.getElementById('input-tp-bab');

        if (!mapel || !kode || !desc) return { error: 'Elements not found' };

        mapel.value = 'Matematika';
        smt.value = '1';
        kode.value = 'MAT.99';
        desc.value = 'Deskripsi TP Baru Pengujian Debugging';
        if (bab) bab.value = '1';

        const form = document.getElementById('form-add-tp');
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });

        let submitResult = null;
        try {
            if (window.submitTP) {
                submitResult = await window.submitTP(submitEvent);
            }
        } catch (e) {
            return { threw: e.message, stack: e.stack };
        }

        return {
            submitResult,
            mapelTPLength: window.state?.mapelTP?.length,
            hasNewTP: window.state?.mapelTP?.some(tp => tp.kode_tp === 'MAT.99')
        };
    });
    console.log('TP TEST RESULT:', tpTest);

    // Test 2: Edit existing TP
    console.log('\n--- TEST 2: Edit existing TP ---');
    const editTest = await page.evaluate(async () => {
        const firstTP = window.state?.mapelTP?.[0];
        if (!firstTP) return { error: 'No TP in state' };

        console.log('First TP in state:', JSON.stringify(firstTP));

        const tpIdVal = String(firstTP.ID_mapel || firstTP.learningObjectiveId || firstTP.kode_tp || '');
        if (window.openEditTPModal) {
            window.openEditTPModal(tpIdVal);
        }

        const editBab = document.getElementById('edit-tp-bab');
        if (editBab) editBab.value = '2';

        const editDesc = document.getElementById('edit-tp-desc');
        if (editDesc) editDesc.value = (editDesc.value || '') + ' [EDITED]';

        const editForm = document.getElementById('form-edit-tp');
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });

        try {
            if (window.submitEditTP) {
                await window.submitEditTP(submitEvent);
            }
        } catch (e) {
            return { threw: e.message, stack: e.stack };
        }

        return {
            success: true,
            editedTP: window.state?.mapelTP?.find(tp => (tp.ID_mapel || tp.kode_tp) === tpIdVal)
        };
    });
    console.log('EDIT TP RESULT:', editTest);

    // Test 3: Save attendance
    console.log('\n--- TEST 3: Save Attendance ---');
    const presensiTest = await page.evaluate(async () => {
        if (window.switchView) window.switchView('attendance');
        await new Promise((r) => setTimeout(r, 200));

        const dateInput = document.getElementById('presensi-date');
        if (dateInput) dateInput.value = '2026-09-07';

        if (window.renderPresensiManual) window.renderPresensiManual();

        try {
            if (window.savePresensiManual) {
                await window.savePresensiManual();
            }
        } catch (e) {
            return { threw: e.message, stack: e.stack };
        }

        return {
            presensiCount: window.state?.presensi?.length
        };
    });
    console.log('PRESENSI TEST RESULT:', presensiTest);

    // Test 4: Save Grades
    console.log('\n--- TEST 4: Save Grades ---');
    const gradesTest = await page.evaluate(async () => {
        if (window.switchView) window.switchView('grades');
        await new Promise((r) => setTimeout(r, 200));

        const filterMapel = document.getElementById('filter-mapel-nilai');
        if (filterMapel) {
            filterMapel.value = 'Matematika';
            filterMapel.dispatchEvent(new Event('change'));
        }

        const filterTP = document.getElementById('filter-tp-nilai');
        if (filterTP && filterTP.options.length > 1) {
            filterTP.selectedIndex = 1;
            filterTP.dispatchEvent(new Event('change'));
        }

        const scoreInputs = document.querySelectorAll('#nilai-table-body .n-scr');
        if (scoreInputs.length) {
            scoreInputs[0].value = '88';
        }

        try {
            if (window.saveNilaiBatch) {
                await window.saveNilaiBatch();
            }
        } catch (e) {
            return { threw: e.message, stack: e.stack };
        }

        return {
            scoreCount: window.state?.nilaiTP?.length
        };
    });
    console.log('GRADES TEST RESULT:', gradesTest);

} finally {
    await browser.close();
    server.close();
}
