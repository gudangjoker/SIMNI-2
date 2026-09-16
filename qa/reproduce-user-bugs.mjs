import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const WORKSPACE_ROOT = 'C:\\Users\\Aretha Hafiza S\\Downloads\\SIMNI\\SIMNI_GADM_INTEGRATION';
const PUBLIC_ROOT = path.resolve(WORKSPACE_ROOT, 'public');
const HOST = '127.0.0.1';
const PORT = 4178;
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
    if (new URL(req.url || '/', BASE_URL).pathname === '/qa-workflow.html') {
        const markup = '<!doctype html><html><head><meta charset="utf-8"><title>SIMNI QA</title></head><body><div id="toast-container" class="fixed top-16 right-4 max-w-sm z-[9990] flex flex-col gap-2 no-print pointer-events-none"></div><div id="simni-view-fragment-root"></div><div id="simni-modal-fragment-root"></div></body></html>';
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cross-Origin-Opener-Policy': 'same-origin'
        });
        res.end(markup);
        return;
    }

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
    page.on('console', (msg) => console.log('[CONSOLE]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.error('[PAGE ERROR]', err.message));

    await page.goto(`${BASE_URL}/qa-workflow.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });

    // Load core UI scripts
    for (const script of [
        'js/core/state.js',
        'js/auth/access-policy-core.js',
        'js/utils/sanitize.js',
        'js/ui/date.js',
        'js/ui/feedback.js',
        'js/ui/navigation.js',
        'js/ui/actions.js',
        'js/ui/render.js'
    ]) {
        await page.addScriptTag({ url: `${BASE_URL}/${script}` });
    }

    // Mount fragments and features
    await page.evaluate(async () => {
        window.SIMNICurrentAccess = {
            uid: 'superuser_uid',
            email: 'unggaran.sditbm@gmail.com',
            displayName: 'Guru Penguji',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            classId: '3A',
            activeAcademicYearId: '2026-2027',
            status: 'active'
        };
        window.SIMNIAccess = {
            canAccess: () => true,
            applyAccessUI: () => {}
        };
        window.state.students = [
            { ID_Siswa: 'stu_1234567890', NISN: '1234567890', 'Nama Lengkap': 'Ahmad Dahlan', Kelas: '3A' },
            { ID_Siswa: 'stu_1234567891', NISN: '1234567891', 'Nama Lengkap': 'Siti Walidah', Kelas: '3A' }
        ];
        window.state.activeKelas = '3A';
        window.state.jadwal = [
            { Hari: 'Senin', Jam_Ke: 1, Mapel: 'Matematika', Kelas: '3A' },
            { Hari: 'Senin', Jam_Ke: 2, Mapel: 'Bahasa Indonesia', Kelas: '3A' }
        ];
        window.state.presensi = [];
        window.state.jurnal = [];
        window.state.mapelTP = [];
        window.state.nilaiTP = [];
        window.dbSet = async (path, val) => {
            console.log('[MOCK dbSet]', path);
            return { ok: true };
        };
        window.dbUpdate = async (updates) => {
            console.log('[MOCK dbUpdate]', Object.keys(updates));
            return { ok: true };
        };
        window.dbRemove = async (path) => {
            console.log('[MOCK dbRemove]', path);
            return { ok: true };
        };
        window.renderDashboard = () => {};

        // Fetch and append fragments
        for (const feature of ['attendance', 'journal', 'grades', 'students']) {
            const res = await fetch(`./features/${feature}/${feature}.html`);
            const text = await res.text();
            const parsed = new DOMParser().parseFromString(text, 'text/html');
            for (const t of parsed.querySelectorAll('template[data-simni-view]')) {
                document.body.appendChild(document.importNode(t.content, true));
            }
            for (const t of parsed.querySelectorAll('template[data-simni-modal]')) {
                document.body.appendChild(document.importNode(t.content, true));
            }
        }
    });

    // Add feature scripts
    for (const feature of ['attendance', 'journal', 'grades', 'students']) {
        await page.addScriptTag({ url: `${BASE_URL}/features/${feature}/${feature}.js` });
    }

    console.log('\n=== TEST 1: Presensi save button click & Pop-up Check ===');
    const presensiRes = await page.evaluate(async () => {
        window.switchView('presensi');
        await new Promise(r => setTimeout(r, 200));

        const dateInput = document.getElementById('presensi-date');
        const rows = document.querySelectorAll('#presensi-table-body tr');
        const saveBtn = document.getElementById('presensi-primary-action');

        console.log('Date:', dateInput?.value, 'Rows:', rows.length, 'saveBtn action:', saveBtn?.dataset?.simniAction);

        // Click save attendance
        saveBtn?.click();
        await new Promise(r => setTimeout(r, 300));

        // Check popup overlay in document.body
        const bodyOverlay = document.body.querySelector(':scope > .fixed.inset-0.z-\\[15000\\]');
        const heading = bodyOverlay?.querySelector('h3');

        return {
            date: dateInput?.value,
            rowCount: rows.length,
            presensiInState: window.state?.presensi?.length,
            bodyOverlayFound: Boolean(bodyOverlay),
            popupHeading: heading?.textContent,
            zIndex: bodyOverlay ? window.getComputedStyle(bodyOverlay).zIndex : null
        };
    });
    console.log('Presensi result:', JSON.stringify(presensiRes, null, 2));

    console.log('\n=== TEST 2: Pop up Berhasil di Semua Halaman (General Toast Test) ===');
    const popupRes = await page.evaluate(async () => {
        window.toast('Data Berhasil Disimpan!', 'success');
        await new Promise(r => setTimeout(r, 200));

        const overlay = document.body.querySelector(':scope > .fixed.inset-0.z-\\[15000\\]');
        const popup = overlay?.querySelector('div');
        const text = popup?.querySelector('h3')?.textContent;

        return {
            mountedInBody: Boolean(overlay),
            notInToastContainer: document.getElementById('toast-container')?.contains(overlay) === false,
            headingText: text,
            overlayOpacity: overlay ? window.getComputedStyle(overlay).opacity : null,
            overlayDisplay: overlay ? window.getComputedStyle(overlay).display : null,
            overlayZIndex: overlay ? window.getComputedStyle(overlay).zIndex : null
        };
    });
    console.log('Popup result:', JSON.stringify(popupRes, null, 2));

    console.log('\n=== TEST 3: Jurnal Input & Save Button Click ===');
    const jurnalRes = await page.evaluate(async () => {
        window.switchView('jurnal');
        await new Promise(r => setTimeout(r, 200));

        const dateInput = document.getElementById('input-jurnal-tanggal');
        dateInput.value = '2026-09-07'; // Monday
        window.checkJurnalDateChange('2026-09-07');
        await new Promise(r => setTimeout(r, 200));

        const rows = document.querySelectorAll('.j-row');
        console.log('Jurnal form rows count:', rows.length);
        if (rows.length > 0) {
            const mat = rows[0].querySelector('.j-mat');
            if (mat) mat.value = 'Operasi Hitung Penjumlahan';
            const ket = rows[0].querySelector('.j-ket');
            if (ket) ket.value = 'Siswa aktif mengerjakan latihan';
        }

        const saveBtn = document.querySelector('#jurnal-tab-input button[data-simni-action="saveJurnalHarian"]');
        console.log('saveBtn:', saveBtn?.outerHTML);
        saveBtn?.click();
        await new Promise(r => setTimeout(r, 300));

        const overlay = document.body.querySelector(':scope > .fixed.inset-0.z-\\[15000\\]');
        const heading = overlay?.querySelector('h3');

        return {
            date: dateInput?.value,
            rowsCount: rows.length,
            jurnalInState: window.state?.jurnal?.length,
            bodyOverlayFound: Boolean(overlay),
            popupHeading: heading?.textContent
        };
    });
    console.log('Jurnal result:', JSON.stringify(jurnalRes, null, 2));

} finally {
    await browser.close();
    server.close();
}
