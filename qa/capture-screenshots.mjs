import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');
const HOST = '127.0.0.1';
const PORT = 4175; // Different port to avoid conflict
const BASE_URL = `http://${HOST}:${PORT}`;
const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml']
]);

function createQaServer() {
    return createServer((request, response) => {
        if (new URL(request.url || '/', BASE_URL).pathname === '/qa-workflow.html') {
            const markup = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SIMNI Workflow QA</title></head><body><div id="toast-container" class="fixed top-4 left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2"></div><div id="print-area" class="hidden"></div></body></html>';
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': Buffer.byteLength(markup),
                'Content-Type': 'text/html; charset=utf-8',
                'X-Content-Type-Options': 'nosniff'
            });
            response.end(markup);
            return;
        }
        const pathname = decodeURIComponent(new URL(request.url || '/', BASE_URL).pathname);
        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const target = path.resolve(PUBLIC_ROOT, relative);
        try {
            const metadata = statSync(target);
            if (!metadata.isFile()) throw new Error('Not a file');
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': metadata.size,
                'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff'
            });
            createReadStream(target).pipe(response);
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not Found');
        }
    });
}

(async () => {
    const server = createQaServer();
    await new Promise((resolve) => server.listen(PORT, HOST, resolve));

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    console.log('Capturing mobile screenshots for 5 scenarios...');

    await page.goto(`${BASE_URL}/qa-workflow.html`, { waitUntil: 'networkidle0' });

    // Load styles and scripts
    
    for (const script of [
        'js/auth/access-policy-core.js',
        'js/utils/sanitize.js',
        'js/ui/date.js',
        'js/ui/feedback.js',
        'js/ui/navigation.js',
        'js/ui/render.js'
    ]) {
        await page.addScriptTag({ url: `${BASE_URL}/${script}` });
    }

    await page.evaluate(async () => {
        for (const feature of ['students', 'notes', 'grades', 'attendance']) {
            const response = await fetch(`./features/${feature}/${feature}.html`);
            const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
            for (const template of parsed.querySelectorAll('template')) {
                document.body.appendChild(document.importNode(template.content, true));
            }
        }
        window.SIMNICurrentAccess = { role: 'superuser' };
        window.state = {
            activeKelas: '3A',
            students: [
                { ID_Siswa: 'stu_111', NISN: '111', 'Nama Lengkap': 'Alya', Kelas: '3A' },
                { ID_Siswa: 'stu_222', NISN: '222', 'Nama Lengkap': 'Bima', Kelas: '3A' }
            ],
            mapelTP: [{ ID_mapel: 'tp_math_1', mapel: 'Matematika', semester: '1', kode_tp: 'MTK.1', deskripsi_tp: 'Menjumlahkan bilangan cacah' }],
            nilaiTP: [],
            presensi: [],
            catatan: [],
            pengaturan: { nama_kelas: '3A' }
        };
        window.dbSet = async () => ({ ok: true });
        window.dbUpdate = async () => ({ ok: true });
        window.renderDashboard = () => {};
    });
    for (const feature of ['students', 'notes', 'grades', 'attendance']) {
        await page.addScriptTag({ url: `${BASE_URL}/features/${feature}/${feature}.js` });
    }

    // SCENARIO 1 & 2: Tambah siswa dan tulis catatan
    await page.evaluate(() => {
        document.querySelector('#siswa-tab-tambah')?.classList.remove('hidden');
        document.getElementById('input-nisn').value = '333';
        document.getElementById('input-nama').value = 'Citra';
        document.getElementById('input-panggilan').value = 'Citra';
        document.getElementById('input-kelompok').value = 'Kelompok 1';
        window.submitSiswa({ preventDefault(){}, target: document.getElementById('form-add-siswa') });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'MOBILE_QA_SCENARIO_1_TAMBAH_SISWA_TOAST.png' });

    // Tulis Catatan
    await page.evaluate(() => {
        document.querySelector('#siswa-tab-tambah')?.classList.add('hidden');
        document.getElementById('catatan-tab-input').classList.remove('hidden');
        document.getElementById('input-catatan-siswa').value = '111';
        document.getElementById('input-catatan-teks').value = 'Sangat baik.';
    });
    await page.screenshot({ path: 'MOBILE_QA_SCENARIO_2_TULIS_CATATAN.png' });

    // SCENARIO 3 & 4: Nilai
    await page.evaluate(async () => {
        document.getElementById('catatan-tab-input').classList.add('hidden');
        document.getElementById('view-nilai').classList.remove('hidden');
        window.renderNilaiTPControls();
        const subject = document.getElementById('filter-mapel-nilai');
        subject.value = 'Matematika';
        window.updateTPDropdown(true);
        const objective = document.getElementById('filter-tp-nilai');
        objective.value = 'tp_math_1';
        window.renderNilaiGrid();
        
        // Simpan 1
        const scores = document.querySelectorAll('#nilai-table-body .n-scr');
        if(scores[0]) scores[0].value = '80';
        await window.saveNilaiBatch();
        
        // Simpan 2 (complete)
        objective.value = 'tp_math_1';
        window.renderNilaiGrid();
        const scores2 = document.querySelectorAll('#nilai-table-body .n-scr');
        if(scores2[1]) scores2[1].value = '90';
        await window.saveNilaiBatch();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'MOBILE_QA_SCENARIO_3_NILAI_RENDER_DAN_TP_DISABLED.png' });

    // SCENARIO 5: Edit rekap
    await page.evaluate(() => {
        window.setNilaiTab('rekap');
        document.getElementById('rekap-mapel-nilai').value = 'Matematika';
        window.updateRekapTPDropdown();
        document.querySelector('.start-grade-edit')?.click();
    });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: 'MOBILE_QA_SCENARIO_4_EDIT_REKAP.png' });

    // SCENARIO 6: Presensi
    await page.evaluate(async () => {
        document.getElementById('view-nilai').classList.add('hidden');
        document.getElementById('view-presensi').classList.remove('hidden');
        document.getElementById('presensi-date').value = '2026-09-02';
        window.renderPresensiManual();
        await window.savePresensiManual();
    });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: 'MOBILE_QA_SCENARIO_5_PRESENSI_COMPLETED.png' });

    console.log('Screenshots done.');
    await browser.close();
    server.close();
})();
