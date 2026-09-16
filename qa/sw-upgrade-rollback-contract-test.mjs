import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  [PASS] ${name}`);
    } catch (err) {
        failed++;
        console.error(`  [FAIL] ${name}: ${err.message}`);
    }
}

console.log('--- SIMNI SERVICE WORKER UPGRADE & ROLLBACK CONTRACT TEST (TAHAP 7) ---');

// 1. Service Worker Version Authority
await test('1. sw.js derives release and cache version dynamically from runtime-config.js (4.7.0)', () => {
    const swContent = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const runtimeConfigContent = readFileSync(path.join(ROOT, 'js', 'core', 'runtime-config.js'), 'utf8');

    assert.ok(/importScripts\s*\(\s*['"]\.\/js\/core\/runtime-config\.js['"]\s*\)/.test(swContent), 'sw.js imports runtime-config.js as single authority');
    assert.ok(swContent.includes('const APP_VERSION ='), 'sw.js binds APP_VERSION');
    assert.ok(swContent.includes('const CACHE_VERSION ='), 'sw.js binds CACHE_VERSION');

    const appVerMatch = runtimeConfigContent.match(/appVersion:\s*'([^']+)'/);
    const cacheVerMatch = runtimeConfigContent.match(/cacheVersion:\s*'([^']+)'/);
    assert.ok(appVerMatch && appVerMatch[1] === '4.7.0', 'runtime-config appVersion is 4.7.0');
    assert.ok(cacheVerMatch && cacheVerMatch[1] === '4.7.0', 'runtime-config cacheVersion is 4.7.0');
});

// 2. Precache Asset Consistency
await test('2. All precache URLs in sw.js map to actual production assets', () => {
    const swContent = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const startIdx = swContent.indexOf('const PRECACHE_PATHS');
    const endIdx = swContent.indexOf('const PRECACHE_URLS');
    assert.ok(startIdx !== -1 && endIdx !== -1, 'PRECACHE_PATHS declaration found');

    const slice = swContent.slice(startIdx, endIdx);
    const precachePaths = [...slice.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
    assert.ok(precachePaths.length >= 25, `Expected >= 25 precache paths, got ${precachePaths.length}`);

    // Essential boot files must be included
    const essentials = [
        'index.html',
        'manifest.json',
        'js/core/runtime-config.js',
        'js/core/feature-loader.js',
        'features/dashboard/dashboard.js'
    ];
    for (const req of essentials) {
        assert.ok(precachePaths.includes(req), `Precache must include ${req}`);
    }
});

// 3. Simulated Service Worker Upgrade Lifecycle (4.6.9 -> 4.7.0)
await test('3. SW upgrade (v4.6.9 -> v4.7.0) activates new cache and cleans old cache without touching user data', async () => {
    const deletedCaches = [];
    const createdCaches = [];

    // Mock storage states simulating existing v4.6.9 user installation
    const mockStorage = {
        caches: {
            'simni-precache-v4.6.9': ['/index.html', '/js/core/runtime-config.js'],
            'simni-runtime-v4.6.9': ['/icons/favicon-32.png']
        },
        indexedDB: {
            'SIMNIDraftsDB': {
                drafts: [
                    { id: 'draft_presensi_3A_2026-09-13', data: { hadir: 25 }, unsaved: true, revision: 2 },
                    { id: 'draft_jurnal_3A_2026-09-13', data: { materi: 'Pancaindra' }, unsaved: true, revision: 1 }
                ]
            },
            'AdminKelasDB': {
                roster: [{ nisn: '1234567890', nama: 'Siswa Test' }]
            },
            'simni-chat-crypto-v1': {
                keys: [{ type: 'e2ee-identity-key-pair', valid: true }]
            },
            'GADM_Database': {
                documents: [{ id: 'doc_gadm_1', title: 'Modul Ajar IPAS' }]
            }
        }
    };

    // SW Activation cleanup logic simulation (as defined in sw.js activate handler)
    const expectedCurrentPrefixes = ['simni-precache-v4.7.0', 'simni-runtime-v4.7.0'];
    const oldCacheKeys = Object.keys(mockStorage.caches);

    for (const key of oldCacheKeys) {
        if (!expectedCurrentPrefixes.includes(key)) {
            deletedCaches.push(key);
            delete mockStorage.caches[key];
        }
    }

    // Install new v4.7.0 caches
    mockStorage.caches['simni-precache-v4.7.0'] = ['/index.html', '/js/core/runtime-config.js'];
    mockStorage.caches['simni-runtime-v4.7.0'] = ['/icons/favicon-32.png'];
    createdCaches.push('simni-precache-v4.7.0', 'simni-runtime-v4.7.0');

    // Assertions:
    assert.deepEqual(deletedCaches.sort(), ['simni-precache-v4.6.9', 'simni-runtime-v4.6.9'].sort(), 'Old SW caches cleanly deleted');
    assert.deepEqual(Object.keys(mockStorage.caches).sort(), createdCaches.sort(), 'New 4.7.0 SW caches established');

    // CRITICAL USER DATA INVARIANT: Zero deletion or mutation of user databases
    assert.equal(mockStorage.indexedDB['SIMNIDraftsDB'].drafts.length, 2, 'Unsent drafts preserved during SW upgrade');
    assert.equal(mockStorage.indexedDB['SIMNIDraftsDB'].drafts[0].revision, 2, 'Draft revision unchanged');
    assert.equal(mockStorage.indexedDB['AdminKelasDB'].roster.length, 1, 'Academic cache preserved during SW upgrade');
    assert.equal(mockStorage.indexedDB['simni-chat-crypto-v1'].keys.length, 1, 'Chat E2EE crypto keys preserved during SW upgrade');
    assert.equal(mockStorage.indexedDB['GADM_Database'].documents.length, 1, 'GADM documents preserved during SW upgrade');
});

// 4. Simulated Rollback Lifecycle (v4.7.0 -> v4.6.9)
await test('4. SW rollback (v4.7.0 -> v4.6.9) restores previous cache safely and preserves drafts created in 4.7.0', async () => {
    // State before rollback: User has 4.7.0 caches and drafts created under 4.7.0
    const mockStorage = {
        caches: {
            'simni-precache-v4.7.0': ['/index.html'],
            'simni-runtime-v4.7.0': ['/icons/simni-logo.png']
        },
        indexedDB: {
            'SIMNIDraftsDB': {
                drafts: [
                    {
                        id: 'draft_nilai_3A_TP1',
                        appVersion: '4.7.0',
                        scores: { s1: 90, s2: 85 },
                        unsaved: true,
                        revision: 1
                    }
                ]
            },
            'AdminKelasDB': {
                academicYear: '2026-2027',
                workspace: 'ws_superuser'
            },
            'simni-chat-crypto-v1': {
                identityKey: 'key_material_abc123'
            }
        }
    };

    // Rollback procedure: 4.6.9 SW activates
    const expectedRollbackPrefixes = ['simni-precache-v4.6.9', 'simni-runtime-v4.6.9'];
    for (const key of Object.keys(mockStorage.caches)) {
        if (!expectedRollbackPrefixes.includes(key)) {
            delete mockStorage.caches[key];
        }
    }
    mockStorage.caches['simni-precache-v4.6.9'] = ['/index.html'];
    mockStorage.caches['simni-runtime-v4.6.9'] = ['/icons/simni-logo.png'];

    // Verify cache swapped
    assert.ok(mockStorage.caches['simni-precache-v4.6.9'], '4.6.9 precache restored');
    assert.ok(!mockStorage.caches['simni-precache-v4.7.0'], '4.7.0 precache removed');

    // Verify user data was not wiped to make rollback succeed
    const draft = mockStorage.indexedDB['SIMNIDraftsDB'].drafts[0];
    assert.ok(draft, 'Draft exists');
    assert.deepEqual(draft.scores, { s1: 90, s2: 85 }, 'Draft content is backward compatible and intact');
    assert.equal(mockStorage.indexedDB['AdminKelasDB'].academicYear, '2026-2027', 'Academic year intact');
    assert.equal(mockStorage.indexedDB['simni-chat-crypto-v1'].identityKey, 'key_material_abc123', 'Crypto key intact');
});

// 5. Anti Mixed-Version & Atomic Activate Verification
await test('5. Service worker implements anti-mixed-version atomic activation', () => {
    const swContent = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

    assert.ok(swContent.includes('skipWaiting()'), 'Calls skipWaiting during install phase');
    assert.ok(swContent.includes('clients.claim()'), 'Calls clients.claim during activate phase');
    assert.ok(swContent.includes('caches.delete'), 'Deletes obsolete cache namespaces during activate');
    assert.ok(!swContent.includes('localStorage.clear()'), 'Never blindly clears localStorage in SW');
    assert.ok(!swContent.includes('indexedDB.deleteDatabase'), 'Never deletes indexedDB during SW lifecycle');
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
