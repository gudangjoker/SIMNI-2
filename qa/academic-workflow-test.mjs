import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const root = process.cwd();
const results = [];
const failures = [];
const excludedRequests = [];
const remoteRequests = [];
const runtimeErrors = [];
const expectedGuardErrors = [];
const out = path.join(root, 'test-output', 'academic-4.6.7');
await mkdir(out, { recursive: true });
const featureSet = `!['gadm','lps','chat','documents','archive','reset'].includes(feature) && (window.SIMNICurrentAccess?.role === 'superuser' || feature !== 'notes')`;
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        const pathname = url.pathname;
        let content, type = 'text/javascript';
        if (pathname === '/qa-academic.html') {
            type = 'text/html';
            content = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tailwind-offline.css"><link rel="stylesheet" href="/js/ui/shell.css"><link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css"><title>SIMNI Academic QA</title></head><body class="p-4 bg-slate-50"><p>MOCK LOKAL · Data sintetis · GADM/LPS/Chat tidak diuji</p><form id="qa-login"><label>Role <select id="qa-role"><option>superuser</option><option>vip</option></select></label><button type="submit">Masuk mock</button></form><nav id="qa-nav" hidden>${['dashboard','presensi','nilai','jurnal','siswa','catatan'].map(id => `<button id="qa-nav-${id}" type="button" data-simni-trigger="click" data-simni-action="switchView" data-simni-args='["${id}"]' class="p-2 border">${id}</button>`).join('')}<select id="qa-class"><option>3A</option><option>3B</option></select></nav><div id="toast-container" class="fixed top-16 right-4 z-[9990]"></div><script type="module" src="/qa/academic-bootstrap.js"></script></body></html>`;
        } else if (pathname === '/vendor/firebase/firebase-database.js') {
            content = await readFile(path.join(root, 'qa/academic-mock-database.js'));
        } else if (pathname === '/js/database/firebase-client.js') {
            content = `export const database={kind:'indexeddb-mock'}; export const auth={currentUser:{uid:'qa-only'}}; export const runtime={mode:'mock'};`;
        } else if (pathname === '/js/auth/access-context.js') {
            content = `export function getAccessContext(){return window.SIMNICurrentAccess;} export function canAccess(feature){return ${featureSet};} export function assertFeature(feature){if(!canAccess(feature))throw new Error('Mock policy denied '+feature);} export function assertLogicalPath(logical){assertFeature(window.SIMNIAccessPolicy.featureForLogicalPath(logical));}`;
        } else if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return;
        } else {
            const base = pathname.startsWith('/qa/') ? root : path.join(root, 'public');
            const filename = path.resolve(base, '.' + decodeURIComponent(pathname));
            if (!filename.startsWith(base + path.sep)) throw new Error('Invalid path');
            content = await readFile(filename);
            type = ({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'})[path.extname(filename)] || 'application/octet-stream';
        }
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'" });
        response.end(content);
    } catch (error) { response.writeHead(404); response.end('QA resource unavailable'); }
});
await new Promise(resolve => server.listen(4196, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:4196';
const browser = await puppeteer.launch({ headless: true, args:['--no-sandbox'] });
async function test(name, fn) {
    try { await fn(); results.push({name,status:'PASS'}); console.log('PASS', name); }
    catch(error) { failures.push(name); results.push({name,status:'FAIL',error:error.stack}); console.log('FAIL', name, error.message); throw error; }
}
const page = await browser.newPage();
page.on('pageerror', error => runtimeErrors.push(error.message));
page.on('console', async message => {
    if (message.type() !== 'error') return;
    const args = await Promise.all(message.args().map(arg => arg.evaluate(value => value?.message || String(value)).catch(() => '')));
    const text = args.join(' ');
    if (text.includes('Batas aman Nilai_TP terlampaui')) { expectedGuardErrors.push(text); return; }
    if (!text.includes('MOCK_')) runtimeErrors.push(text || message.text());
});
page.on('dialog', dialog => dialog.accept());
await page.setRequestInterception(true);
page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== origin && !['data:','blob:'].includes(url.protocol)) { remoteRequests.push(request.url()); void request.abort(); return; }
    if (/\/features\/(gadm|lps)\/|\/chat\//.test(url.pathname)) { excludedRequests.push(url.pathname); void request.abort(); return; }
    void request.continue();
});
const evaluate = (fn, ...args) => page.evaluate(fn,...args);
const click = selector => page.click(selector);
async function ready() { await page.waitForFunction(() => window.SIMNISyncState?.status === 'ready' && state.students.length === 3); }
async function nav(id) { await click('#qa-nav-' + id); }
async function fill(selector, value) {
    // Query + edit in one browser task. A retained ElementHandle can become
    // detached between lookup and edit when a realtime render runs.
    await page.evaluate((selector, value) => { const element=document.querySelector(selector); if(!element?.isConnected) throw new Error('Field tidak terpasang: '+selector); element.value = value; element.dispatchEvent(new Event('input',{bubbles:true})); element.dispatchEvent(new Event('change',{bubbles:true})); }, selector, value);
}
async function saved(count) { await page.waitForFunction(count => QAMock.writes.length > count, {}, count); await page.waitForFunction(() => !document.querySelector('[data-simni-processing="true"]')); }
async function writeCount() { return evaluate(() => QAMock.writes.length); }
async function refreshSnapshot() { await evaluate(() => QAMock.write(QABase+'/notes/refresh', {ID_Catatan:'refresh',NISN:'0123456789',Catatan:'snapshot-'+Date.now(),Kelas:'3A'})); await new Promise(resolve => setTimeout(resolve,100)); }
try {
    await page.setViewport({width:1366,height:900});
    await page.goto(origin+'/qa-academic.html');
    await page.waitForFunction(() => window.QABootReady);
    await test('Mock login Superuser + repository/sync nyata, IndexedDB persisten', async () => {
        await click('#qa-login button'); await ready();
        assert.equal(await evaluate(() => SIMNIDatabaseTarget.projectId), 'qa-indexeddb');
        assert.equal(await evaluate(() => SIMNISyncState.connected), true);
    });
    await test('Nilai legacy kosong tetap null dan tidak menyelesaikan TP', async () => {
        assert.equal(await evaluate(() => state.nilaiTP[0].nilai), null);
        assert.equal(await evaluate(() => gradeProgressForTP(state.mapelTP.find(tp=>tp.ID_mapel==='legacy_tp')).graded), 0);
        for(const value of ['',null,' ',undefined,-1,101,'NaN']) assert.equal(await evaluate(value=>academicScore(value),value),null);
        for(const value of [0,100]) assert.equal(await evaluate(value=>academicScore(value),value),value);
    });
    await test('Presensi tanggal hari ini: radio/keterangan bertahan saat realtime', async () => {
        await nav('presensi');
        assert.equal(await page.$$eval('#presensi-table-body tr', rows=>rows.length),2);
        await click('input[name="s_0123456789"][value="Sakit"]');
        await fill('.p-ket','Izin berobat');
        await refreshSnapshot();
        assert.equal(await page.$eval('input[name="s_0123456789"]:checked',element=>element.value),'Sakit');
        assert.equal(await page.$eval('.p-ket',element=>element.value),'Izin berobat');
    });
    await test('Commit gagal mempertahankan presensi dan tidak menampilkan success', async () => {
        const count = await writeCount();
        await evaluate(()=>{QAMock.failNext=true;}); await click('#presensi-primary-action');
        await page.waitForFunction(()=>document.getElementById('toast-container').textContent.includes('MOCK_COMMIT_REJECTED'));
        assert.equal(await writeCount(),count);
        assert.equal(await page.$eval('.p-ket',element=>element.value),'Izin berobat');
        assert.equal(await page.$$eval('[data-simni-success]',nodes=>nodes.length),0);
    });
    await test('Presensi sukses, double-submit dicegah, popup tunggal lalu hilang', async () => {
        const count=await writeCount();
        await evaluate(()=>{QAMock.hold=true;});
        await click('#presensi-primary-action');
        await page.waitForFunction(()=>QAMock.release);
        await evaluate(()=>{document.getElementById('presensi-primary-action').click(); QAMock.hold=false; QAMock.release();});
        await saved(count);
        assert.equal(await writeCount(),count+1);
        await page.waitForFunction(()=>document.getElementById('presensi-primary-action').textContent.includes('Edit Kehadiran'));
        assert.equal(await page.$$eval('[data-simni-success]',nodes=>nodes.length),1);
        assert.equal(await page.$$eval('#toast-container .fa-check-circle',nodes=>nodes.length),0);
        await page.screenshot({path:path.join(out,'attendance-desktop.png')});
        await page.waitForFunction(()=>!document.querySelector('[data-simni-success]'));
    });
    await test('Presensi edit tanggal hari ini, tanggal lampau dan reload', async () => {
        await click('#presensi-primary-action'); await click('input[name="s_0123456789"][value="Izin"]');
        let count=await writeCount(); await click('#presensi-primary-action'); await saved(count);
        await fill('#presensi-date','2026-09-01');
        count=await writeCount(); await click('#presensi-primary-action'); await saved(count);
        await page.reload(); await ready(); await nav('presensi'); await fill('#presensi-date','2026-09-01');
        assert.ok((await page.$eval('#presensi-primary-action',el=>el.textContent)).includes('Edit Kehadiran'));
        assert.equal(await evaluate(()=>state.presensi.length),4);
    });
    await test('Draft presensi terpisah per tanggal dan kelas', async () => {
        await fill('#presensi-date','2026-09-02'); await fill('.p-ket','draft 3A');
        await fill('#presensi-date','2026-09-03'); assert.equal(await page.$eval('.p-ket',el=>el.value),'');
        await fill('#presensi-date','2026-09-02'); assert.equal(await page.$eval('.p-ket',el=>el.value),'draft 3A');
        await page.select('#qa-class','3B'); assert.equal(await page.$eval('.p-ket',el=>el.value),'');
        await page.select('#qa-class','3A'); assert.equal(await page.$eval('.p-ket',el=>el.value),'draft 3A');
    });
    await test('NISN invalid dan binding gagal menahan write dengan alasan jelas', async () => {
        await evaluate(()=>QAMock.write(QABase+'/students/bad',{ID_Siswa:'bad',NISN:'123', 'Nama Lengkap':'Invalid QA',Kelas:'3A'}));
        const count=await writeCount(); await click('#presensi-primary-action');
        assert.equal(await writeCount(),count);
        assert.ok((await page.$eval('#toast-container',el=>el.textContent)).includes('10 digit'));
        await evaluate(()=>QAMock.write(QABase+'/students/bad',null));
        await evaluate(()=>QAMock.failBinding('/schedule'));
        const result = await evaluate(()=>dbSet('Presensi/invalid',{}));
        assert.equal(result.ok,false);
        const message=await evaluate(async()=>String((await dbSet('Presensi/invalid',{})).error.message));
        assert.ok(message.includes('Jadwal'));
        await evaluate(()=>{stopFirebaseListener(); initFirebaseListener();}); await ready();
    });
    await test('Jurnal lama tanpa kelas/ID dimuat dan diedit pada key yang sama', async () => {
        await nav('jurnal'); await fill('#input-jurnal-tanggal','2026-09-07');
        assert.equal(await page.$eval('.j-mat',el=>el.value),'Materi lama');
        await fill('.j-mat','Materi revisi'); await refreshSnapshot();
        assert.equal(await page.$eval('.j-mat',el=>el.value),'Materi revisi');
        const count=await writeCount(); await click('[data-simni-action="saveJurnalHarian"]'); await saved(count);
        const data=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].journals);
        assert.deepEqual(Object.keys(data),['old_journal']); assert.equal(data.old_journal.Materi,'Materi revisi');
    });
    await test('Konflik jurnal perangkat lain ditolak atomik, draft tetap', async () => {
        await fill('.j-mat','Draft perangkat ini');
        assert.equal(await evaluate(() => SIMNIFormDrafts.dirty(document.getElementById('jurnal-form-container'))), true, 'draft harus tercatat sebelum perubahan remote');
        await evaluate(()=>QAMock.write(QABase+'/journals/old_journal/Materi','Perangkat lain'));
        assert.equal(await page.$eval('.j-mat',el=>el.value),'Draft perangkat ini', 'draft sebelum klik simpan');
        const count=await writeCount(); await click('[data-simni-action="saveJurnalHarian"]');
        await page.waitForFunction(()=>!document.querySelector('[data-simni-processing="true"]'));
        assert.equal(await writeCount(),count); assert.equal(await page.$eval('.j-mat',el=>el.value),'Draft perangkat ini');
        assert.ok((await page.$eval('#toast-container',el=>el.textContent)).includes('perangkat lain'));
    });
    await test('Jurnal tanpa jadwal termasuk akhir pekan memilih mapel nyata', async () => {
        await fill('#input-jurnal-tanggal','2026-09-06'); await fill('.j-mat','Kegiatan akhir pekan');
        const count=await writeCount(); await click('[data-simni-action="saveJurnalHarian"]'); assert.equal(await writeCount(),count);
        await page.select('.j-map','Matematika'); await click('[data-simni-action="saveJurnalHarian"]'); await saved(count);
        assert.equal(await evaluate(()=>state.jurnal.find(item=>item.Tanggal==='2026-09-06').Mapel),'Matematika');
    });
    await test('Draft jurnal tahan 8 putaran edit cepat, autofill tanpa event, dan konflik', async () => {
        await fill('#input-jurnal-tanggal','2026-09-07');
        for (let round=0; round<8; round++) {
            await evaluate(() => { SIMNIFormDrafts.clear(); generateFormJurnal(); });
            await fill('.j-mat', `Tersimpan ${round}`);
            const savedBefore = await writeCount(); await click('[data-simni-action="saveJurnalHarian"]'); await saved(savedBefore);
            await evaluate(value => { document.querySelector('.j-mat').value=value; }, `Draft cepat ${round}`);
            await refreshSnapshot();
            assert.equal(await page.$eval('.j-mat', element=>element.value), `Draft cepat ${round}`);
            await evaluate(round=>QAMock.write(QABase+'/journals/old_journal/Materi',`Remote ${round}`),round);
            const before = await writeCount(); await click('[data-simni-action="saveJurnalHarian"]');
            await page.waitForFunction(()=>!document.querySelector('[data-simni-processing="true"]'));
            assert.equal(await writeCount(),before);
            assert.equal(await page.$eval('.j-mat',element=>element.value),`Draft cepat ${round}`);
        }
    });
    await test('Jadwal menulis slot berubah saja, kelas lain tetap', async () => {
        await evaluate(()=>QAMock.write(QABase+'/schedule/other',{ID_Jadwal:'other',Hari:'Senin',Jam_Ke:1,Mapel:'PJOK',Kelas:'3B'}));
        await click('#tab-jurnal-jadwal');
        await page.select('.jdw-sel[data-hari="Senin"][data-jam="1"]','IPAS'); await refreshSnapshot();
        assert.equal(await page.$eval('.jdw-sel[data-hari="Senin"][data-jam="1"]',el=>el.value),'IPAS');
        const count=await writeCount(); await click('[data-simni-action="saveJadwalMaster"]'); await saved(count);
        const schedule=await evaluate(()=>QAMock.dump().workspaces.ws_superuser.academicYears['2026-2027'].schedule);
        assert.equal(schedule.other.Mapel,'PJOK'); assert.equal(schedule.legacy_slot.Mapel,'IPAS');
    });
    await test('TP legacy tambah Bab 10 tanpa mengganti ID atau menghapus nilai', async () => {
        await nav('nilai'); await evaluate(()=>openEditTPModal('legacy_tp'));
        await page.select('#edit-tp-bab','10');
        const count=await writeCount(); await click('#form-edit-tp button[type="submit"]'); await saved(count);
        assert.equal(await evaluate(()=>state.mapelTP.find(tp=>tp.ID_mapel==='legacy_tp').chapterNumber),10);
        assert.equal(await evaluate(()=>state.nilaiTP.length),1);
        await evaluate(()=>closeModal('modal-kelola-tp'));
    });
    await test('Input nilai terisolasi kelas, draft realtime, kosong tidak menghapus', async () => {
        await page.select('#filter-mapel-nilai','Matematika'); await page.select('#filter-tp-nilai','legacy_tp');
        assert.equal(await page.$$eval('#nilai-table-body tr',rows=>rows.length),2);
        await fill('.n-scr','0'); await refreshSnapshot(); assert.equal(await page.$eval('.n-scr',el=>el.value),'0');
        const count=await writeCount(); await click('[data-simni-action="saveNilaiBatch"]'); await saved(count);
        assert.equal(await evaluate(()=>gradeProgressForTP(state.mapelTP.find(tp=>tp.ID_mapel==='legacy_tp')).graded),1);
        await page.select('#filter-tp-nilai','legacy_tp');
        await fill('#nilai-table-body tr:nth-child(2) .n-scr','100');
        const next=await writeCount(); await click('[data-simni-action="saveNilaiBatch"]'); await saved(next);
        assert.equal(await page.$eval('#filter-tp-nilai option[value="legacy_tp"]',el=>el.disabled),true);
    });
    await test('Edit nilai rekap tidak menerima kosong dan persistensi reload', async () => {
        await click('#tab-nilai-rekap'); await click('.start-grade-edit'); await fill('.edit-grade-score','');
        const count=await writeCount(); await click('.save-grade-edit'); assert.equal(await writeCount(),count);
        await fill('.edit-grade-score','85'); await refreshSnapshot(); assert.equal(await page.$eval('.edit-grade-score',el=>el.value),'85');
        await click('.save-grade-edit'); await saved(count);
        await page.reload(); await ready();
        assert.ok(await evaluate(()=>state.nilaiTP.some(item=>item.nilai===85)));
        assert.equal(await evaluate(()=>state.mapelTP.find(tp=>tp.ID_mapel==='legacy_tp').chapterNumber),10);
    });
    await test('Koneksi Firebase putus menahan write meskipun browser online', async () => {
        const count = await writeCount();
        await evaluate(() => QAMock.disconnect(true));
        const result = await evaluate(async () => {
            const result = await dbSet('Presensi/offline', {});
            return { ok: result.ok, message: result.error?.message };
        });
        assert.equal(result.ok, false); assert.match(result.message, /Firebase|koneksi/i);
        assert.equal(await writeCount(), count);
        await evaluate(() => QAMock.disconnect(false)); await ready();
    });
    await test('Jurnal lama tetap memakai mapel historis ketika jadwal diganti', async () => {
        await evaluate(() => QAMock.write(QABase+'/schedule/legacy_slot', {Hari:'Senin',Jam_Ke:1,Mapel:'IPAS',Kelas:'3A'}));
        await nav('jurnal'); await fill('#input-jurnal-tanggal', '2026-09-07');
        assert.equal(await page.$eval('.j-map', element => element.value), 'Matematika');
    });
    await test('Cache oversized ditolak tanpa menimpa salinan sehat', async () => {
        const result = await evaluate(async () => {
            await saveLocalBackup();
            const before = await SIMNILocalCache.getDiagnostics();
            state.qaOversized = 'x'.repeat(33 * 1024 * 1024);
            const refused = await saveLocalBackup();
            delete state.qaOversized;
            const after = await SIMNILocalCache.getDiagnostics();
            return { before: before.stateHash, after: after.stateHash, ok: refused.ok, message: refused.error?.message };
        });
        assert.equal(result.ok, false); assert.match(result.message, /32 MiB/); assert.equal(result.before, result.after);
    });
    await test('Inventaris cache terisolasi; hapus hanya setelah berkas cocok, cache aktif aman', async () => {
        const result = await evaluate(async () => {
            await saveLocalBackup();
            const diagnostics = await SIMNILocalCache.getDiagnostics();
            const original = await SIMNILocalCache.exportLocalCacheRecord(diagnostics.key);
            const oldKey = diagnostics.key.replace('2026-2027', '2025-2026');
            const old = structuredClone(original.record); old.__scope.activeAcademicYearId = '2025-2026';
            const foreign = structuredClone(old); foreign.__scope.uid = 'qa-someone-else';
            const db = await new Promise((resolve, reject) => { const request = indexedDB.open('AdminKelasDB', 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            await new Promise((resolve, reject) => { const transaction = db.transaction('stateStore','readwrite'); const store=transaction.objectStore('stateStore'); store.put(old,oldKey); store.put(foreign,'qa-foreign'); transaction.oncomplete=resolve; transaction.onerror=()=>reject(transaction.error); });
            const inventory = await SIMNILocalCache.listLocalCacheInventory();
            const exported = await SIMNILocalCache.exportLocalCacheRecord(oldKey);
            let currentDenied=false, mismatchDenied=false, changedDenied=false;
            try { await SIMNILocalCache.deleteLocalCacheAfterVerification(diagnostics.key,original); } catch { currentDenied=true; }
            try { await SIMNILocalCache.deleteLocalCacheAfterVerification(oldKey,{...exported,hash:'wrong'}); } catch { mismatchDenied=true; }
            const edited = structuredClone(old); edited.state.qaChanged = true;
            await new Promise((resolve,reject)=>{const t=db.transaction('stateStore','readwrite');t.objectStore('stateStore').put(edited,oldKey);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
            try { await SIMNILocalCache.deleteLocalCacheAfterVerification(oldKey,exported); } catch { changedDenied=true; }
            const currentExport = await SIMNILocalCache.exportLocalCacheRecord(oldKey);
            await SIMNILocalCache.deleteLocalCacheAfterVerification(oldKey,currentExport);
            const remaining=await SIMNILocalCache.listLocalCacheInventory(); db.close();
            return { currentDenied,mismatchDenied,changedDenied,oldDeleted:!remaining.rows.some(row=>row.key===oldKey),foreignHidden:!inventory.rows.some(row=>row.key==='qa-foreign'),activeExists:remaining.rows.some(row=>row.key===diagnostics.key) };
        });
        for(const [name,value] of Object.entries(result)) assert.equal(value,true,name);
    });
    await test('VIP mock: TP PJOK serta draft kelas tidak bocor', async () => {
        await evaluate(()=>QALogin('vip')); await ready(); await nav('nilai');
        assert.equal(await page.$eval('#filter-mapel-nilai',el=>el.value),'PJOK');
        assert.equal(await evaluate(()=>getTPById('other_class')),null);
        await page.select('#filter-tp-nilai','legacy_tp'); assert.equal(await page.$$eval('#nilai-table-body tr',rows=>rows.length),2);
        await page.select('#qa-class','3B');
        assert.equal(await evaluate(()=>getTPById('legacy_tp')),null);
        assert.equal(await evaluate(()=>visibleLearningObjectives().length),1);
    });
    await test('Mobile 390x844: presensi, jurnal dan TP dapat dioperasikan', async () => {
        await page.setViewport({width:390,height:844}); await page.select('#qa-class','3A'); await nav('presensi');
        await fill('#presensi-date','2026-09-08');
        let count=await writeCount(); await click('#presensi-primary-action'); await saved(count);
        await page.screenshot({path:path.join(out,'attendance-mobile.png'),fullPage:true});
        await nav('jurnal'); await fill('#input-jurnal-tanggal','2026-09-08'); await page.select('.j-map','PJOK'); await fill('.j-mat','PJOK mobile');
        count=await writeCount(); await click('[data-simni-action="saveJurnalHarian"]'); await saved(count);
        await page.screenshot({path:path.join(out,'journal-mobile.png'),fullPage:true});
        await nav('nilai'); await page.select('#filter-tp-nilai','legacy_tp'); await fill('.n-scr','75');
        count=await writeCount(); await click('[data-simni-action="saveNilaiBatch"]'); await saved(count);
        await page.screenshot({path:path.join(out,'grades-mobile.png'),fullPage:true});
    });
    await test('Snapshot melebihi batas ditolak tanpa memakai data parsial; pulih setelah koreksi', async () => {
        const original = await evaluate(() => ({ raw: QAMock.dump().workspaces[SIMNICurrentAccess.workspaceId].academicYears['2026-2027'].grades, state: JSON.stringify(state.nilaiTP) }));
        await evaluate(() => QAMock.write(QABase+'/grades', Object.fromEntries(Array.from({length:20001}, (_,index) => ['limit_'+String(index).padStart(5,'0'), {nilai:10}]))));
        await page.waitForFunction(() => SIMNISyncState.bindings.Nilai_TP.status === 'failed');
        assert.equal(await evaluate(() => JSON.stringify(state.nilaiTP)), original.state);
        const count = await writeCount();
        const refusal = await evaluate(async () => { const result=await dbSet('Presensi/guard',{});return {ok:result.ok,message:result.error?.message}; });
        assert.equal(refusal.ok,false); assert.match(refusal.message,/20.000 record/); assert.equal(await writeCount(),count);
        await evaluate(raw => QAMock.write(QABase+'/grades', raw),original.raw); await ready();
        assert.equal(expectedGuardErrors.length,1);
    });
    await test('Tidak ada request produksi, fitur dikecualikan, atau exception browser', async () => {
        assert.deepEqual(remoteRequests,[]); assert.deepEqual(excludedRequests,[]); assert.deepEqual(runtimeErrors,[]);
    });
} catch(error) {
    console.error('Academic QA stopped:',error.message);
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
} finally {
    const draftTrace = failures.length ? await evaluate(()=>window.QADraftTrace || []).catch(()=>[]) : [];
    const build = JSON.parse(await readFile(path.join(root,'public/build-manifest.json'),'utf8'));
    const report = JSON.stringify({completedAt:new Date().toISOString(),version:build.version,buildId:build.buildId,results,failures,remoteRequests,excludedRequests,runtimeErrors,expectedGuardErrors,draftTrace},null,2);
    await writeFile(path.join(out,'results.json'),report);
    await writeFile(path.join(out,`attempt-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),report);
    await browser.close(); await new Promise(resolve=>server.close(resolve));
}
console.log(`${results.filter(result=>result.status==='PASS').length} PASS, ${failures.length} FAIL`);
if(failures.length || remoteRequests.length || excludedRequests.length || runtimeErrors.length) process.exitCode=1;
