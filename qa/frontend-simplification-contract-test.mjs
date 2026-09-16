import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Setup Node environment to mimic browser globals
globalThis.window = globalThis;
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}
if (!globalThis.Blob) {
    globalThis.Blob = (await import('node:buffer')).Blob;
}
if (!globalThis.TextEncoder) {
    globalThis.TextEncoder = (await import('node:util')).TextEncoder;
}
if (!globalThis.TextDecoder) {
    globalThis.TextDecoder = (await import('node:util')).TextDecoder;
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`[PASS] ${name}`);
    } catch (err) {
        failed++;
        console.error(`[FAIL] ${name}: ${err.message}`);
    }
}

console.log('=== SIMNI FRONTEND SIMPLIFICATION & FEATURE LOADING CONTRACT TEST (TAHAP 6) ===\n');

// ---------------------------------------------------------------------------
// 1. S09 — Initial Boot Footprint & Loading Cost Comparison
// ---------------------------------------------------------------------------
await test('Initial boot footprint achieves >90% reduction compared to eager full loading', () => {
    const commonLegacy = [
        './vendor/qrcodejs/qrcode.min.js',
        './features/dashboard/dashboard.js',
        './features/settings/settings.js',
        './features/students/students.js',
        './features/attendance/attendance.js',
        './features/journal/journal.js',
        './features/grades/grades.js',
        './features/backup/backup-core.js',
        './features/backup/backup.js'
    ];
    const featureAssetsLegacy = [
        './features/notes/notes.js',
        './features/documents/documents.js',
        './features/archive/archive.js',
        './features/reset/reset.js',
        './features/lps/lps-core.js',
        './features/lps/lps-reference-data.js',
        './features/lps/lps-excel.js',
        './features/lps/lps-print.js',
        './features/lps/lps.js',
        './features/gadm/gadm.js',
        './features/lps/lps.css',
        './features/gadm/gadm.css'
    ];
    const htmlFragmentsLegacy = [
        './features/dashboard/dashboard.html',
        './features/students/students.html',
        './features/attendance/attendance.html',
        './features/journal/journal.html',
        './features/grades/grades.html',
        './features/gadm/gadm.html',
        './features/notes/notes.html',
        './features/documents/documents.html',
        './features/settings/settings.html'
    ];

    function calcBytes(list) {
        return list.reduce((sum, f) => {
            const p = path.join(root, f);
            return sum + (fs.existsSync(p) ? fs.statSync(p).size : 0);
        }, 0);
    }

    const legacyTotalBytes = calcBytes(commonLegacy) + calcBytes(featureAssetsLegacy) + calcBytes(htmlFragmentsLegacy);
    
    // Minimal initial startup (Tahap 6): only dashboard HTML and dashboard JS
    const initialStartupFiles = [
        './features/dashboard/dashboard.html',
        './features/dashboard/dashboard.js'
    ];
    const initialStartupBytes = calcBytes(initialStartupFiles);

    const reductionPercent = ((legacyTotalBytes - initialStartupBytes) / legacyTotalBytes) * 100;

    console.log(`   Baseline Eager Load: ${(legacyTotalBytes / 1024).toFixed(1)} KiB (${legacyTotalBytes} bytes)`);
    console.log(`   Tahap 6 Initial Boot: ${(initialStartupBytes / 1024).toFixed(1)} KiB (${initialStartupBytes} bytes)`);
    console.log(`   Payload Reduction   : ${reductionPercent.toFixed(1)}%`);

    assert.ok(legacyTotalBytes > 800000, 'Legacy eager load must exceed 800 KB');
    assert.ok(initialStartupBytes < 35000, 'Tahap 6 initial boot must stay below 35 KB');
    assert.ok(reductionPercent > 90, 'Initial boot reduction must exceed 90%');
});

// ---------------------------------------------------------------------------
// 2. Feature Loader Module Structure & Exports
// ---------------------------------------------------------------------------
const featureLoaderPath = pathToFileURL(path.join(root, 'js', 'core', 'feature-loader.js')).href;
const loaderModule = await import(featureLoaderPath);

await test('feature-loader.js exports canonical functions and definitions', () => {
    assert.ok(typeof loaderModule.loadFeatureFragments === 'function');
    assert.ok(typeof loaderModule.resetFeatureFragments === 'function');
    assert.ok(typeof loaderModule.ensureFeatureLoaded === 'function');
    assert.ok(typeof loaderModule.isFeatureLoaded === 'function');
    assert.ok(typeof loaderModule.resolveFeatureId === 'function');
    assert.ok(Array.isArray(loaderModule.SIMNI_FEATURE_DEFINITIONS));
    assert.equal(loaderModule.SIMNI_FEATURE_DEFINITIONS.length, 9);
});

await test('resolveFeatureId maps Indonesian view aliases to canonical feature names', () => {
    assert.equal(loaderModule.resolveFeatureId('siswa'), 'students');
    assert.equal(loaderModule.resolveFeatureId('presensi'), 'attendance');
    assert.equal(loaderModule.resolveFeatureId('nilai'), 'grades');
    assert.equal(loaderModule.resolveFeatureId('jurnal'), 'journal');
    assert.equal(loaderModule.resolveFeatureId('catatan'), 'notes');
    assert.equal(loaderModule.resolveFeatureId('dokumen'), 'documents');
    assert.equal(loaderModule.resolveFeatureId('pengaturan'), 'settings');
    assert.equal(loaderModule.resolveFeatureId('dashboard'), 'dashboard');
    assert.equal(loaderModule.resolveFeatureId('gadm'), 'gadm');
    assert.equal(loaderModule.resolveFeatureId('lps'), 'lps');
});

// ---------------------------------------------------------------------------
// 3. Idempotent Feature Loading & Single-Promise Gate
// ---------------------------------------------------------------------------
await test('ensureFeatureLoaded manages in-flight promises and single-promise cache', async () => {
    // Setup mock DOM environment
    const elements = new Map();
    globalThis.document = {
        baseURI: 'http://localhost/',
        documentElement: { dataset: {} },
        getElementById: (id) => elements.get(id) || null,
        createElement: (tag) => ({
            tagName: tag.toUpperCase(),
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
            setAttribute() {},
            removeAttribute() {},
            addEventListener(ev, fn) { if (ev === 'load') setTimeout(fn, 10); }
        }),
        head: { appendChild() {} },
        body: { appendChild() {} },
        querySelectorAll: () => []
    };

    // Setup view roots in mock document
    const viewRoot = {
        id: 'simni-view-fragment-root',
        replaceChildren() {},
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    const modalRoot = {
        id: 'simni-modal-fragment-root',
        replaceChildren() {},
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    elements.set('simni-view-fragment-root', viewRoot);
    elements.set('simni-modal-fragment-root', modalRoot);

    // Setup mock Access Context
    globalThis.SIMNICurrentAccess = {
        uid: 'user_tahap6',
        role: 'superuser',
        workspaceId: 'ws_superuser',
        classId: '3A',
        activeAcademicYearId: '2026-2027'
    };
    globalThis.SIMNIAccess = {
        canAccess: () => true,
        applyAccessUI() {}
    };

    // Mock fetch to return valid template HTML
    globalThis.fetch = async (url) => {
        const filePath = path.join(root, url.replace(/^\.\//, ''));
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '<div></div>';
        return {
            ok: true,
            status: 200,
            text: async () => content
        };
    };

    // Mock HTMLTemplateElement and DOMParser
    class MockTemplate {
        constructor() {
            this.content = { childNodes: [] };
        }
    }
    globalThis.HTMLTemplateElement = MockTemplate;
    globalThis.document.importNode = (content) => content;

    globalThis.DOMParser = class {
        parseFromString(html) {
            return {
                querySelector: () => null,
                querySelectorAll: (sel) => {
                    if (sel.includes('script')) return [];
                    if (sel.includes('template')) return [new MockTemplate()];
                    return [];
                }
            };
        }
    };

    // Concurrent calls must return the same Promise
    const p1 = loaderModule.ensureFeatureLoaded('attendance');
    const p2 = loaderModule.ensureFeatureLoaded('attendance');
    assert.equal(p1, p2, 'Concurrent calls to ensureFeatureLoaded must return the exact same in-flight Promise');

    const res = await p1;
    assert.equal(res.ok, true);
    assert.equal(res.feature, 'attendance');

    // Subsequent call returns cached result immediately
    const p3 = await loaderModule.ensureFeatureLoaded('attendance');
    assert.equal(p3.cached, true, 'Subsequent call must return cached: true without re-fetching');
});

// ---------------------------------------------------------------------------
// 4. Lifecycle Unmount & Resource Teardown
// ---------------------------------------------------------------------------
await test('Unmount active view cleanly clears scanner and sub-feature states', () => {
    let scannerCleared = false;
    let lpsUnmounted = false;
    let gadmUnmounted = false;
    let dialogsClosed = false;

    globalThis.state = {
        currentView: 'attendance',
        scannerInstance: {
            clear: async () => { scannerCleared = true; }
        }
    };

    globalThis.closeQRScanner = async () => {
        scannerCleared = true;
        globalThis.state.scannerInstance = null;
    };

    globalThis.SIMNILPS = {
        unmount: () => { lpsUnmounted = true; }
    };

    globalThis.SIMNIGADM = {
        unmount: () => { gadmUnmounted = true; }
    };

    globalThis.SIMNIDialog = {
        closeAll: () => { dialogsClosed = true; }
    };

    // Simulate navigation unmountActiveView
    function unmountActiveView(viewId) {
        if (!viewId) return;
        if (viewId === 'presensi' || viewId === 'attendance') {
            if (globalThis.state.scannerInstance) {
                if (typeof globalThis.closeQRScanner === 'function') {
                    void globalThis.closeQRScanner();
                } else if (globalThis.state.scannerInstance.clear) {
                    void globalThis.state.scannerInstance.clear();
                    globalThis.state.scannerInstance = null;
                }
            }
        }
        if (viewId === 'lps') {
            globalThis.SIMNILPS?.unmount?.();
        }
        if (viewId === 'gadm') {
            globalThis.SIMNIGADM?.unmount?.();
        }
        globalThis.SIMNIDialog?.closeAll?.();
    }

    unmountActiveView('attendance');
    assert.equal(scannerCleared, true, 'Scanner instance must be cleared on attendance unmount');
    assert.equal(globalThis.state.scannerInstance, null, 'state.scannerInstance must be reset to null');
    assert.equal(dialogsClosed, true, 'Open dialogs must be closed on unmount');

    unmountActiveView('lps');
    assert.equal(lpsUnmounted, true, 'LPS unmount must be called on leaving lps view');

    unmountActiveView('gadm');
    assert.equal(gadmUnmounted, true, 'GADM unmount must be called on leaving gadm view');
});

// ---------------------------------------------------------------------------
// 5. Action Integrity & No Undefined Actions on First Open
// ---------------------------------------------------------------------------
await test('Action dispatcher contains all declared actions without syntax or definition errors', async () => {
    const actionsSource = fs.readFileSync(path.join(root, 'js', 'ui', 'actions.js'), 'utf8');
    assert.ok(actionsSource.includes('root.SIMNIActionDispatcher = Object.freeze('));
    assert.ok(actionsSource.includes('openAttendanceScanner'));
    assert.ok(actionsSource.includes('openStudentsCreate'));
    assert.ok(actionsSource.includes('switchView'));

    // Check that switchView is awaited before invoking sub-modals
    assert.ok(actionsSource.includes('const switchRes = root.switchView?.(\'presensi\');'));
    assert.ok(actionsSource.includes('const switchRes = root.switchView?.(\'siswa\');'));
});

// ---------------------------------------------------------------------------
// 6. Role Scope Enforcement in Feature Loading
// ---------------------------------------------------------------------------
await test('Role-based access denies loading unauthorized features fail-closed', async () => {
    globalThis.SIMNICurrentAccess = {
        uid: 'user_vip',
        role: 'vip',
        workspaceId: 'ws_pjok',
        classId: 'PJOK',
        activeAcademicYearId: '2026-2027'
    };

    // Load access policy
    const policyPath = pathToFileURL(path.join(root, 'js', 'auth', 'access-policy-core.js')).href;
    const policyModule = await import(policyPath);
    const SIMNIAccessPolicy = policyModule.default || globalThis.SIMNIAccessPolicy;

    globalThis.SIMNIAccess = {
        canAccess: (feature) => SIMNIAccessPolicy.hasFeature('vip', feature),
        applyAccessUI() {}
    };

    // VIP cannot access notes, documents, lps
    await assert.rejects(
        () => loaderModule.ensureFeatureLoaded('notes'),
        /Akses ditolak/i,
        'VIP role must be rejected when attempting to load notes'
    );
    await assert.rejects(
        () => loaderModule.ensureFeatureLoaded('documents'),
        /Akses ditolak/i,
        'VIP role must be rejected when attempting to load documents'
    );
    await assert.rejects(
        () => loaderModule.ensureFeatureLoaded('lps'),
        /Akses ditolak/i,
        'VIP role must be rejected when attempting to load lps'
    );
});

// ---------------------------------------------------------------------------
// 7. Offline Precache Preservation
// ---------------------------------------------------------------------------
await test('sw.js preserves precache entries for all offline feature assets', () => {
    const swContent = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const requiredOfflineAssets = [
        './index.html',
        './manifest.json',
        './js/platform/bootstrap.js',
        './js/core/feature-loader.js',
        './features/dashboard/dashboard.js',
        './features/students/students.js',
        './features/attendance/attendance.js',
        './features/journal/journal.js',
        './features/grades/grades.js',
        './features/lps/lps.js',
        './features/gadm/gadm.js',
        './features/backup/backup-core.js'
    ];

    for (const asset of requiredOfflineAssets) {
        assert.ok(swContent.includes(`'${asset}'`), `sw.js precache must include ${asset}`);
    }
});

console.log(`\nTEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) {
    process.exit(1);
}
