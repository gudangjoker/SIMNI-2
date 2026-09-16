import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const root = process.cwd();
const out = path.join(root, 'test-output/tahap7-final');
await mkdir(out, { recursive: true });
const baseline = path.join(root, 'test-output/tahap7-takeover-baseline');
const manifest = JSON.parse(await readFile('public/build-manifest.json', 'utf8'));
let phase = 'baseline';
const results = { buildId: manifest.buildId, baseline: '4.7.0 takeover snapshot (NOT 4.6.9)', checks: [], external: [] };
const server = createServer(async (req, res) => {
    try {
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        let body;
        if (name === '/qa-lifecycle.html') body = '<!doctype html><meta charset="utf-8"><title>Isolated production lifecycle</title><div id="form"><input data-draft-key="note"></div><script src="/js/core/state.js"></script>';
        else {
            const relative = name.slice(1) || 'index.html';
            const selected = phase === 'baseline' ? baseline : path.join(root, 'public');
            const file = path.resolve(selected, relative);
            if (!file.startsWith(selected + path.sep)) throw Error('Boundary');
            body = await readFile(file);
        }
        res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'" });
        res.end(body);
    } catch (error) { console.error('Local resource unavailable', req.url, error.message); res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
const observer = await browser.newPage();
const workerSession = await observer.createCDPSession();
const versions = new Map();
workerSession.on('ServiceWorker.workerVersionUpdated', ({ versions: updates }) => {
    for (const version of updates) versions.set(version.versionId, version);
});
await workerSession.send('ServiceWorker.enable');
async function waitActivated(versionId) {
    const start = Date.now();
    while (versions.get(versionId)?.status !== 'activated') {
        if (Date.now() - start > 90000) throw Error('Worker activation did not complete: ' + JSON.stringify([...versions.values()]));
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
async function page() {
    const p = await browser.newPage();
    await p.setRequestInterception(true);
    p.on('request', r => { if (r.url().startsWith(origin) || /^(data|blob):/.test(r.url())) r.continue(); else { results.external.push(r.url()); r.abort(); } });
    p.on('dialog', d => d.accept());
    await p.evaluateOnNewDocument(() => {
        window.SIMNICurrentAccess = { uid: 'local-A', role: 'superuser', workspaceId: 'local-workspace', activeAcademicYearId: '2026-2027' };
        window.normalizeClassLabel = value => String(value || '').trim();
    });
    await p.goto(origin + '/qa-lifecycle.html');
    return p;
}
async function check(name, fn) {
    try { await fn(); results.checks.push({ name, status: 'PASS' }); console.log('PASS', name); }
    catch (e) { results.checks.push({ name, status: 'FAIL', error: e.stack }); throw e; }
}
let p;
try {
    p = await page();
    await check('Actual baseline production SW installs and controls browser', async () => {
        await p.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('Production SW failed to become ready')), 30000))]); });
        await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    });
    await check('Upgrade waits while old tab retains its production module cache', async () => {
        phase = 'final';
        await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await p.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting, { timeout: 60000 });
        const config = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
        assert.match(config, /appVersion:\s*'4\.7\.0'/);
        const second = await page();
        assert.equal(await second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
        await second.close();
    });
    const waitingVersion = [...versions.values()].find(version => version.status === 'installed' && version.scriptURL === origin + '/sw.js');
    assert.ok(waitingVersion, 'Chromium reports the actual waiting worker');
    await p.close();
    // Observe lifecycle from an about:blank page, which does not keep the old
    // origin alive; reopening that origin too early creates another old client.
    await waitActivated(waitingVersion.versionId);
    p = await page();
    await check('After old tabs close the new production worker activates', async () => {
        await p.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting, { timeout: 60000 });
        await p.reload();
        const config = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
        assert.match(config, new RegExp(`appVersion:\\s*'${manifest.version.replaceAll('.', '\\.')}'`));
    });
    await check('Production draft survives actual IndexedDB persistence and reload', async () => {
        await p.evaluate(async () => {
            await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form);
            const input = form.querySelector('input'); input.value = 'unsent local value'; input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await p.waitForFunction(() => document.body.textContent.includes('Draf tersimpan di perangkat'));
        await p.reload();
        const value = await p.evaluate(async () => { await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
        assert.equal(value, 'unsent local value');
    });
    await check('Aborted real IDB transaction never claims draft saved', async () => {
        await p.evaluate(() => {
            const original = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                const req = original.apply(this, args);
                if (this.name === 'academicDrafts') { const tx = this.transaction; req.addEventListener('success', () => tx.abort(), { once: true }); IDBObjectStore.prototype.put = original; }
                return req;
            };
            const input = document.querySelector('input'); input.value = 'must not claim persisted'; input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await p.waitForFunction(() => document.body.textContent.includes('Draf aktif di memori sesi'));
        await p.reload();
        const value = await p.evaluate(async () => { await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
        assert.equal(value, 'unsent local value');
    });
    await check('New typing during database commit remains a draft', async () => {
        const dirty = await p.evaluate(() => {
            const form = document.querySelector('#form'), token = SIMNIFormDrafts.begin(form), input = form.querySelector('input');
            input.value = 'new revision'; input.dispatchEvent(new Event('input', { bubbles: true })); SIMNIFormDrafts.finish(token, true); return SIMNIFormDrafts.dirty(form);
        });
        assert.equal(dirty, true);
        await p.waitForFunction(() => document.body.textContent.includes('Draf tersimpan di perangkat'));
    });
    await check('Another account cannot hydrate previous account draft', async () => {
        const restored = await p.evaluate(async () => { SIMNICurrentAccess = { ...SIMNICurrentAccess, uid: 'local-B' }; await SIMNIFormDrafts.ready(); const form = document.querySelector('#form'); form.querySelector('input').value = ''; SIMNIFormDrafts.prepare(form, 'local-date'); SIMNIFormDrafts.restore(form); return form.querySelector('input').value; });
        assert.equal(restored, '');
    });
    await check('Production rollback to takeover baseline preserves actual draft records', async () => {
        phase = 'baseline';
        await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        // Imported scripts are part of update detection. Bypass HTTP caches and
        // allow the baseline install to finish before checking its module cache.
        await p.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return !reg.installing && !reg.waiting;
        }, { timeout: 120000 });
        await p.close();
        await new Promise(resolve => setTimeout(resolve, 2000));
        p = await page();
        const rollbackConfig = await p.evaluate(async () => (await fetch('/js/core/runtime-config.js')).text());
        assert.match(rollbackConfig, /appVersion:\s*'4\.7\.0'/);
        const records = await p.evaluate(() => new Promise((resolve, reject) => { const req = indexedDB.open('SIMNIDraftsDB'); req.onsuccess = () => { const db = req.result, read = db.transaction('academicDrafts').objectStore('academicDrafts').getAll(); read.onsuccess = () => { resolve(read.result); db.close(); }; read.onerror = reject; }; req.onerror = reject; }));
        assert.ok(records.some(record => record.uid === 'local-A' && record.values.note === 'new revision'));
    });
    assert.deepEqual(results.external, []);
} catch (e) { results.fatal = e.stack; process.exitCode = 1; console.error(e); }
finally { await writeFile(path.join(out, 'lifecycle-browser.json'), JSON.stringify(results, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
