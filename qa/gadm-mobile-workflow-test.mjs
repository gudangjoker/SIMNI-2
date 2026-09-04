import { createServer } from 'node:http';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'test-output', 'gadm-mobile');
const DOWNLOADS = path.join(OUTPUT, 'downloads');
const MIME = Object.freeze({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
});

function safePublicPath(url) {
    const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const absolute = path.resolve(PUBLIC, relative);
    if (absolute !== PUBLIC && !absolute.startsWith(`${PUBLIC}${path.sep}`)) return null;
    return absolute;
}

const server = createServer(async (request, response) => {
    try {
        const filename = safePublicPath(request.url || '/');
        if (!filename) {
            response.writeHead(403).end('Forbidden');
            return;
        }
        const data = await readFile(filename);
        response.writeHead(200, {
            'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(data);
    } catch (_) {
        response.writeHead(404).end('Not Found');
    }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
await mkdir(OUTPUT, { recursive: true });
await rm(DOWNLOADS, { recursive: true, force: true });
await mkdir(DOWNLOADS, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
});
const cdp = await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setRequestInterception(true);
page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/js/auth/auth.js')) {
        request.respond({
            status: 200,
            contentType: 'text/javascript; charset=utf-8',
            body: `
                const access = Object.freeze({
                    uid: 'qa-superuser-gadm-mobile',
                    email: 'superuser@qa.simni.test',
                    displayName: 'Unggaran Reka Negara',
                    role: 'superuser',
                    workspaceId: 'ws_superuser',
                    classId: '3A',
                    activeAcademicYearId: '2026-2027',
                    status: 'active'
                });
                window.SIMNICurrentAccess = access;
                window.SIMNIAccess = Object.freeze({
                    canAccess: () => true,
                    applyAccessUI: () => { document.documentElement.dataset.simniRole = access.role; }
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
                export {};
            `
        }).catch(() => undefined);
        return;
    }
    request.continue().catch(() => undefined);
});

const results = [];
function record(name, passed, detail = '') {
    results.push({ name, passed: Boolean(passed), detail });
    process.stdout.write(`[${passed ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function setValues(values) {
    await page.evaluate((entries) => {
        for (const [id, value] of Object.entries(entries)) {
            const element = document.getElementById(id);
            if (!element) throw new Error(`Field tidak ditemukan: ${id}`);
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, values);
}

async function selectDocument(type) {
    await page.click(`[data-gadm-document="${type}"]`);
    await page.waitForFunction((expected) => document.getElementById('gadm-document-type')?.value === expected, {}, type);
}

async function generateAndVerify(type, expectedHeading, filename) {
    await page.click('[data-gadm-step-target="4"]');
    await page.click('#gadm-generate');
    await page.waitForFunction(() => document.getElementById('gadm-status')?.dataset.state === 'ok');
    await page.waitForFunction(() => (document.querySelector('#main-scroll-area')?.scrollTop || 0) <= 4);
    const snapshot = await page.evaluate((heading) => {
        const preview = document.getElementById('gadm-preview');
        const toolbarLabels = [...document.querySelectorAll('.gadm-preview-actions .gadm-tool-button span')]
            .filter((element) => getComputedStyle(element).display !== 'none')
            .map((element) => element.textContent.trim());
        const toolbar = document.querySelector('.gadm-preview-actions')?.getBoundingClientRect();
        const globalNavigation = document.querySelector('nav[aria-label="Navigasi utama mobile"]')?.getBoundingClientRect();
        const mobileSwitcherElement = document.querySelector('.gadm-mobile-switcher');
        const mobileSwitcher = mobileSwitcherElement?.getBoundingClientRect();
        const switcherStyle = mobileSwitcherElement ? getComputedStyle(mobileSwitcherElement) : null;
        const containingAncestors = [];
        for (let ancestor = mobileSwitcherElement?.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' || style.contain !== 'none' || style.willChange !== 'auto') {
                containingAncestors.push(`${ancestor.id || ancestor.tagName}:${style.transform}:${style.filter}:${style.perspective}:${style.contain}:${style.willChange}`);
            }
        }
        return {
            headingFound: preview?.textContent.includes(heading) === true,
            resultActionsEnabled: ['gadm-download-word', 'gadm-download-excel', 'gadm-print', 'gadm-save']
                .every((id) => document.getElementById(id)?.disabled === false),
            labels: toolbarLabels,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
            navigationOverlap: Boolean(toolbar && globalNavigation && toolbar.bottom > globalNavigation.top && toolbar.top < globalNavigation.bottom),
            switcherVisible: Boolean(mobileSwitcher && mobileSwitcher.width > 0 && mobileSwitcher.height > 0),
            switcherOverlap: Boolean(mobileSwitcher && globalNavigation && mobileSwitcher.bottom > globalNavigation.top),
            switcherRect: mobileSwitcher ? { top: mobileSwitcher.top, bottom: mobileSwitcher.bottom, height: mobileSwitcher.height, position: switcherStyle?.position, cssBottom: switcherStyle?.bottom } : null,
            navigationRect: globalNavigation ? { top: globalNavigation.top, bottom: globalNavigation.bottom, height: globalNavigation.height } : null,
            containingAncestors,
            previewAtTop: (document.querySelector('#main-scroll-area')?.scrollTop || 0) <= 4
        };
    }, expectedHeading);
    record(`${type}: pratinjau valid`, snapshot.headingFound, expectedHeading);
    record(`${type}: ekspor dan simpan aktif`, snapshot.resultActionsEnabled);
    record(`${type}: toolbar berlabel pada ponsel`, snapshot.labels.includes('Buat Dokumen Baru') && snapshot.labels.includes('Unduh PDF'));
    record(`${type}: tidak ada overflow horizontal`, !snapshot.horizontalOverflow);
    record(`${type}: toolbar tidak menimpa navigasi`, !snapshot.navigationOverlap);
    record(`${type}: hasil dibuka dari bagian paling atas`, snapshot.previewAtTop);
    record(`${type}: pemilih Form/Hasil terlihat dan tidak menimpa navigasi`, snapshot.switcherVisible && !snapshot.switcherOverlap, JSON.stringify({ switcher: snapshot.switcherRect, navigation: snapshot.navigationRect, containingAncestors: snapshot.containingAncestors }));
    await page.screenshot({ path: path.join(OUTPUT, filename), fullPage: true });
}

async function waitForDownload(extension, before, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const files = await readdir(DOWNLOADS);
        const candidate = files.find((name) => name.toLowerCase().endsWith(extension) && !before.has(name));
        if (candidate) {
            const absolute = path.join(DOWNLOADS, candidate);
            const first = await stat(absolute);
            await new Promise((resolve) => setTimeout(resolve, 200));
            const second = await stat(absolute);
            if (second.size > 0 && second.size === first.size) return { absolute, name: candidate, size: second.size };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Unduhan ${extension} tidak selesai dalam ${timeoutMs} ms.`);
}

async function clickAndCaptureDownload(button, extension, timeoutMs) {
    const before = new Set(await readdir(DOWNLOADS));
    await page.click(button);
    return waitForDownload(extension, before, timeoutMs);
}

async function verifyExports(expectedTitle) {
    const word = await clickAndCaptureDownload('#gadm-download-word', '.doc');
    const wordBytes = await readFile(word.absolute);
    const wordText = wordBytes.toString('utf8');
    record('Ekspor Word menghasilkan dokumen aktif yang valid', word.size > 500 && /<!doctype html>/i.test(wordText) && wordText.includes(expectedTitle), `${word.name} • ${word.size} byte`);

    const excel = await clickAndCaptureDownload('#gadm-download-excel', '.xlsx');
    const excelBytes = await readFile(excel.absolute);
    record('Ekspor Excel menghasilkan workbook XLSX yang valid', excel.size > 1_000 && excelBytes[0] === 0x50 && excelBytes[1] === 0x4b, `${excel.name} • ${excel.size} byte`);

    const unsupportedColors = await page.evaluate(() => {
        const preview = document.getElementById('gadm-preview');
        if (!preview) return [];
        const matches = [];
        for (const element of [preview, ...preview.querySelectorAll('*')]) {
            const style = getComputedStyle(element);
            for (const property of style) {
                if (property.startsWith('--')) continue;
                const value = style.getPropertyValue(property);
                if (/oklch|oklab|color-mix/i.test(value)) matches.push(`${element.tagName}.${element.className}:${property}=${value}`);
                if (matches.length >= 30) return matches;
            }
        }
        return matches;
    });
    record('Pratinjau PDF bebas fungsi warna yang tidak didukung', unsupportedColors.length === 0, unsupportedColors.join(' | '));

    try {
        const pdf = await clickAndCaptureDownload('#gadm-print', '.pdf', 30_000);
        const pdfBytes = await readFile(pdf.absolute);
        record('Ekspor PDF menghasilkan dokumen PDF yang valid dan berisi', pdf.size > 10_000 && pdfBytes.subarray(0, 4).toString('ascii') === '%PDF', `${pdf.name} • ${pdf.size} byte`);
    } catch (error) {
        const pdfState = await page.evaluate(() => ({
            status: document.getElementById('gadm-status')?.textContent,
            state: document.getElementById('gadm-status')?.dataset.state,
            busy: document.getElementById('gadm-print')?.getAttribute('aria-busy')
        }));
        record('Ekspor PDF menghasilkan dokumen PDF yang valid dan berisi', false, `${error.message} • ${JSON.stringify(pdfState)} • ${browserErrors.join(' | ')}`);
    }
}

try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(() => window.SIMNIAuthState?.phase === 'session-ready'
        && document.getElementById('view-dashboard')?.hidden === false
        && document.getElementById('login-screen')?.classList.contains('hidden') === true, { timeout: 30_000 });
    record('Mock Superuser masuk langsung ke Dashboard', true);

    const entryContract = await page.evaluate(() => ({
        quickActions: document.querySelectorAll('#view-dashboard [data-simni-args="[\\"gadm\\"]"]').length,
        navigationEntries: document.querySelectorAll('nav [data-target="gadm"], nav [data-shell-view="gadm"]').length
    }));
    record('GADM hanya berada di Aksi Cepat', entryContract.quickActions === 1 && entryContract.navigationEntries === 0);
    await page.click('#view-dashboard [data-simni-args="[\\"gadm\\"]"]');
    await page.waitForFunction(() => window.SIMNIGADM?.isMounted() === true && document.getElementById('view-gadm')?.hidden === false);

    const identity = await page.evaluate(() => ({
        teacher: document.getElementById('gadm-nama-guru')?.value,
        teacherEditable: document.getElementById('gadm-nama-guru')?.disabled === false,
        subjectEditable: document.getElementById('gadm-mata-pelajaran')?.disabled === false,
        grade: document.getElementById('gadm-kelas-fase')?.value
    }));
    record('Nama guru bukan email dan dapat diedit', identity.teacher === 'Unggaran Reka Negara' && identity.teacherEditable);
    record('Superuser memilih mata pelajaran melalui dropdown', identity.subjectEditable);
    record('Kelas SIMNI dipetakan ke Fase B', identity.grade === '3');

    await selectDocument('modulAjar');
    await setValues({
        'gadm-nama-guru': 'Unggaran Reka Negara',
        'gadm-mata-pelajaran': 'IPAS',
        'gadm-materi-unit': 'Pancaindra',
        'gadm-alokasi-waktu': '2 x 35 menit'
    });
    await page.click('[data-gadm-step-target="2"]');
    await page.click('#gadm-refresh-curriculum');
    await page.waitForFunction(() => document.getElementById('gadm-use-cp')?.disabled === false);
    await page.click('#gadm-use-cp');
    await page.click('#gadm-use-tp');
    const cpContract = await page.evaluate(() => ({
        cp: document.getElementById('gadm-cp-tp')?.value,
        tp: document.getElementById('gadm-tp-manual')?.value,
        recordId: document.getElementById('gadm-curriculum-record-id')?.value,
        source: document.getElementById('gadm-cp-source')?.textContent
    }));
    record('Modul Ajar memakai CP resmi terprovenance', /pancaindra/i.test(cpContract.cp) && cpContract.recordId && /046\/H\/KR\/2025/.test(cpContract.source));
    record('TP saran terpisah dan dapat disunting guru', /Pancaindra/.test(cpContract.tp));
    await generateAndVerify('modulAjar', 'Modul Ajar Pembelajaran Mendalam', '01-modul-ajar.png');
    const provenanceVerified = await page.evaluate(() => document.getElementById('gadm-preview')?.textContent.includes('Record KB terverifikasi') === true);
    record('Hasil Modul Ajar mempertahankan status provenance resmi', provenanceVerified);
    await verifyExports('Modul Ajar Pembelajaran Mendalam');

    await page.click('#gadm-new-document');
    await selectDocument('prota');
    await setValues({
        'gadm-nama-guru': 'Unggaran Reka Negara',
        'gadm-mata-pelajaran': 'IPAS',
        'gadm-prota-total-jp': '36',
        'gadm-kalender-efektif': '18 minggu efektif semester ganjil; 18 minggu efektif semester genap',
        'gadm-prota-unit': 'Pancaindra | 18 | 1\nSiklus hidup | 18 | 2'
    });
    await generateAndVerify('prota', 'Program Tahunan (Prota)', '02-prota.png');

    await page.click('#gadm-new-document');
    await selectDocument('promes');
    await setValues({
        'gadm-nama-guru': 'Unggaran Reka Negara',
        'gadm-mata-pelajaran': 'IPAS',
        'gadm-semester': '1',
        'gadm-minggu-efektif-semester': '18 minggu efektif',
        'gadm-referensi-prota': 'Pancaindra 18 JP pada semester 1',
        'gadm-promes-unit': 'Mengenal fungsi pancaindra | 8 | Minggu 1-4\nMerawat pancaindra | 10 | Minggu 5-9'
    });
    await generateAndVerify('promes', 'Program Semester (Promes)', '03-promes.png');

    await page.click('#gadm-new-document');
    await selectDocument('silabus');
    await setValues({
        'gadm-nama-guru': 'Unggaran Reka Negara',
        'gadm-mata-pelajaran': 'IPAS',
        'gadm-materi-lingkup': 'Pancaindra',
        'gadm-cp-tp': cpContract.cp,
        'gadm-tp-manual': cpContract.tp,
        'gadm-alokasi-waktu': '8 JP'
    });
    await generateAndVerify('silabus', 'Silabus / ATP Operasional', '04-silabus.png');

    await page.click('#gadm-new-document');
    await selectDocument('deskripsiKokurikuler');
    await setValues({
        'gadm-nama-guru': 'Unggaran Reka Negara',
        'gadm-kegiatan-kokurikuler': 'Gerakan sekolah minim sampah',
        'gadm-target-dimensi': 'Kolaborasi, Kewargaan',
        'gadm-evidence-kokurikuler': 'Murid membagi peran, memilah sampah sesuai kategori, dan menyampaikan hasil pengamatan kelompok.'
    });
    await generateAndVerify('deskripsiKokurikuler', 'Deskripsi Kokurikuler', '05-kokurikuler.png');

    await page.click('#gadm-new-document');
    const returnedToForm = await page.evaluate(() => document.getElementById('gadm-root')?.dataset.gadmPane === 'form'
        && document.getElementById('gadm-status')?.dataset.state === 'ok'
        && document.getElementById('gadm-print')?.disabled === true);
    record('Buat Dokumen Baru kembali ke formulir bersih', returnedToForm);

    const errors = await page.evaluate(() => window.SIMNIDiagnostics?.entries?.filter((entry) => entry.level === 'error') || []);
    record('Tidak ada error runtime GADM', errors.length === 0, `${errors.length} error`);
} finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}

const passed = results.filter((result) => result.passed).length;
process.stdout.write(`\nGADM MOBILE WORKFLOW: ${passed} PASS, ${results.length - passed} FAIL\n`);
if (passed !== results.length) process.exitCode = 1;
