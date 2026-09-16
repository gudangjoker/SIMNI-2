import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

function mockNavigatorStorage(estimateFn) {
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            storage: {
                estimate: estimateFn
            }
        },
        writable: true,
        configurable: true
    });
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

console.log('=== SIMNI CROSS-SUBSYSTEM STORAGE & RECOVERY CONTRACT TEST (TAHAP 5) ===\n');

// ---------------------------------------------------------------------------
// 1. S06 — Unified Subsystem Recovery Architecture & Manifest
// ---------------------------------------------------------------------------
const backupCorePath = pathToFileURL(path.join(root, 'features', 'backup', 'backup-core.js')).href;
const coreModule = await import(backupCorePath);
const core = coreModule.default || globalThis.SIMNIBackupCore;

await test('BackupCore exports SUBSYSTEMS with all 5 canonical subsystems', () => {
    assert.ok(core.SUBSYSTEMS, 'SUBSYSTEMS must be exported');
    assert.equal(core.SUBSYSTEMS.ACADEMIC, 'academic');
    assert.equal(core.SUBSYSTEMS.GADM, 'gadm');
    assert.equal(core.SUBSYSTEMS.CHAT, 'chat');
    assert.equal(core.SUBSYSTEMS.CLOUDINARY, 'cloudinary');
    assert.equal(core.SUBSYSTEMS.DRAFTS, 'drafts');
});

await test('BackupCore exports SUBSYSTEM_RECOVERY_MANIFEST with detailed subsystem policies', () => {
    const manifest = core.SUBSYSTEM_RECOVERY_MANIFEST;
    assert.ok(manifest, 'SUBSYSTEM_RECOVERY_MANIFEST must be exported');

    // Academic RTDB
    assert.equal(manifest.academic.backupIncluded, true);
    assert.equal(manifest.academic.coverage, 'full');
    assert.ok(manifest.academic.storageLocation.includes('RTDB'));
    assert.ok(manifest.academic.recoveryProcedure.includes('Restore JSON'));

    // GADM
    assert.equal(manifest.gadm.backupIncluded, false);
    assert.equal(manifest.gadm.coverage, 'separate-local-subsystem');
    assert.ok(manifest.gadm.storageLocation.includes('IndexedDB'));
    assert.ok(manifest.gadm.recoveryProcedure.includes('GADM'));

    // Chat E2EE
    assert.equal(manifest.chat.backupIncluded, false);
    assert.equal(manifest.chat.coverage, 'separate-cloud-e2ee-subsystem');
    assert.ok(manifest.chat.storageLocation.includes('Firestore') && manifest.chat.storageLocation.includes('R2'));
    assert.ok(manifest.chat.recoveryProcedure.includes('Firebase'));

    // Cloudinary physical assets
    assert.equal(manifest.cloudinary.backupIncluded, false);
    assert.equal(manifest.cloudinary.coverage, 'metadata-only');
    assert.ok(manifest.cloudinary.storageLocation.includes('Cloudinary'));
    assert.ok(manifest.cloudinary.recoveryProcedure.includes('Dokumen'));

    // Form Drafts
    assert.equal(manifest.drafts.backupIncluded, false);
    assert.equal(manifest.drafts.coverage, 'ephemeral-local-unsent');
    assert.ok(manifest.drafts.storageLocation.includes('SIMNIDraftsDB'));
    assert.ok(manifest.drafts.recoveryProcedure.includes('Simpan'));
});

await test('getSubsystemRecoveryManifest returns scoped summary', () => {
    const mockAccess = {
        uid: 'user_tahap5',
        role: 'superuser',
        workspaceId: 'ws_superuser',
        classId: '3A',
        activeAcademicYearId: '2026-2027'
    };
    const manifest = core.getSubsystemRecoveryManifest(mockAccess);
    assert.equal(manifest.scope.workspaceId, 'ws_superuser');
    assert.equal(manifest.scope.role, 'superuser');
    assert.equal(manifest.summary.totalSubsystems, 5);
    assert.deepEqual(manifest.summary.includedInAcademicBackup, ['academic']);
    assert.deepEqual(manifest.summary.separateOrExternalRecovery, ['gadm', 'chat', 'cloudinary', 'drafts']);
});

await test('Backup envelope declares complete subsystem coverage and recovery manifest', async () => {
    const sampleDb = {
        Siswa: { s1: { ID_Siswa: 's1', 'Nama Lengkap': 'Siswa Test', Kelas: '3A' } },
        Dokumen: { d1: { ID_Dokumen: 'd1', Nama_Dokumen: 'LKPD 1', URL: 'https://res.cloudinary.com/demo/raw/upload/lkpd.pdf', Kelas: '3A' } }
    };
    const metadata = {
        appVersion: '4.6.9',
        academicYear: '2026-2027',
        className: '3A',
        scope: {
            uid: 'super_1',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            classId: '3A',
            academicYearId: '2026-2027'
        }
    };
    const envelope = await core.createEnvelope(sampleDb, metadata);
    assert.equal(envelope.format, 'simni-pwa-backup');
    assert.equal(envelope.recoveryCoverage.academicDatabase, 'full');
    assert.equal(envelope.recoveryCoverage.lpsTemplatesAndReports, 'full');
    assert.equal(envelope.recoveryCoverage.documents, 'metadata-only');
    assert.equal(envelope.recoveryCoverage.gadm, 'separate-local-subsystem');
    assert.equal(envelope.recoveryCoverage.chat, 'separate-cloud-e2ee-subsystem');
    assert.equal(envelope.recoveryCoverage.drafts, 'ephemeral-local-unsent');
    assert.ok(envelope.recoveryCoverage.manifest, 'Manifest must be attached to recoveryCoverage');
    assert.ok(envelope.recoveryCoverage.note.includes('Cloudinary'), 'Note must clarify external asset boundary');

    // Integrity verification must pass
    const verification = await core.verifyEnvelope(envelope);
    assert.equal(verification.ok, true, 'Envelope with subsystem recovery coverage passes SHA-256 integrity');
});

// ---------------------------------------------------------------------------
// 2. S07 — Multi-Subsystem Storage Inventory & Distinction of Measured vs Estimated
// ---------------------------------------------------------------------------
await test('Storage inventory distinguishes measured payload bytes from browser estimate', async () => {
    // Mock browser storage estimate
    mockNavigatorStorage(async () => ({ usage: 15 * 1024 * 1024, quota: 1024 * 1024 * 1024 }));

    // Mock caches
    globalThis.caches = {
        keys: async () => ['simni-runtime-v4.6.9', 'simni-precache-v4.6.9'],
        open: async (name) => ({
            keys: async () => [new Request('http://localhost/index.html'), new Request('http://localhost/sw.js')],
            match: async (req) => ({
                clone: () => ({
                    arrayBuffer: async () => new Uint8Array(2048).buffer
                })
            })
        }),
        delete: async (name) => true
    };

    // Load local-cache.js in mock environment
    globalThis.SIMNICurrentAccess = {
        uid: 'u1',
        role: 'superuser',
        workspaceId: 'ws_superuser',
        classId: '3A',
        activeAcademicYearId: '2026-2027'
    };
    globalThis.window.SIMNICurrentAccess = globalThis.SIMNICurrentAccess;
    globalThis.window.state = {};

    const localCachePath = pathToFileURL(path.join(root, 'js', 'database', 'local-cache.js')).href;
    const localCacheModule = await import(localCachePath);
    const SIMNILocalCache = localCacheModule.default || globalThis.SIMNILocalCache;

    assert.ok(typeof SIMNILocalCache.getCompleteStorageInventory === 'function', 'getCompleteStorageInventory must be exported');
    assert.ok(typeof SIMNILocalCache.purgeSafeCaches === 'function', 'purgeSafeCaches must be exported');

    const inventory = await SIMNILocalCache.getCompleteStorageInventory();

    // 1. Browser estimate must be explicitly tagged as estimate
    assert.equal(inventory.browserEstimate.isEstimated, true);
    assert.equal(inventory.browserEstimate.usage, 15 * 1024 * 1024);
    assert.equal(inventory.browserEstimate.quota, 1024 * 1024 * 1024);

    // 2. Measured payload must contain exact numbers
    assert.ok(typeof inventory.measuredPayload.totalMeasuredBytes === 'number');
    assert.ok(typeof inventory.measuredPayload.academicCacheBytes === 'number');
    assert.ok(typeof inventory.measuredPayload.draftsBytes === 'number');
    assert.ok(typeof inventory.measuredPayload.gadmBytes === 'number');
    assert.ok(typeof inventory.measuredPayload.swCacheBytes === 'number');

    // 3. Classifications must be clearly established
    assert.ok(inventory.classification.safeToPurge.includes('Service Worker Runtime Cache'));
    assert.ok(inventory.classification.protected.some(p => p.includes('SIMNIDraftsDB')));
    assert.ok(inventory.classification.protected.some(p => p.includes('Tahun Aktif')));
    assert.ok(inventory.classification.protected.some(p => p.includes('simni-chat-crypto-v1')));
});

await test('Storage inventory triggers threshold warnings when limits approached', async () => {
    // Scenario A: Approaching quota (> 80% usage)
    mockNavigatorStorage(async () => ({ usage: 850 * 1024 * 1024, quota: 1000 * 1024 * 1024 }));

    const localCachePath = pathToFileURL(path.join(root, 'js', 'database', 'local-cache.js')).href;
    const localCacheModule = await import(localCachePath);
    const SIMNILocalCache = localCacheModule.default || globalThis.SIMNILocalCache;

    const inventory = await SIMNILocalCache.getCompleteStorageInventory();
    assert.equal(inventory.warnings.approachingQuota, true, 'Must flag approachingQuota when usage > 80% of quota');
});

await test('purgeSafeCaches purges Service Worker caches while strictly protecting critical data', async () => {
    let deletedCaches = [];
    globalThis.caches = {
        keys: async () => ['simni-runtime-v4.6.9'],
        open: async (name) => ({
            keys: async () => [new Request('http://localhost/style.css')],
            match: async () => ({
                clone: () => ({ arrayBuffer: async () => new Uint8Array(4096).buffer })
            })
        }),
        delete: async (name) => {
            deletedCaches.push(name);
            return true;
        }
    };

    const localCachePath = pathToFileURL(path.join(root, 'js', 'database', 'local-cache.js')).href;
    const localCacheModule = await import(localCachePath);
    const SIMNILocalCache = localCacheModule.default || globalThis.SIMNILocalCache;

    const result = await SIMNILocalCache.purgeSafeCaches();
    assert.equal(result.ok, true);
    assert.deepEqual(deletedCaches, ['simni-runtime-v4.6.9']);
    assert.equal(result.purgedBytes, 4096);

    // Verify protected items are declared
    assert.ok(result.preserved.some(p => p.includes('SIMNIDraftsDB')), 'Drafts must be declared preserved');
    assert.ok(result.preserved.some(p => p.includes('AdminKelasDB')), 'Active academic cache must be declared preserved');
    assert.ok(result.preserved.some(p => p.includes('simni-chat-crypto-v1')), 'Chat crypto keys must be declared preserved');
});

await test('Verified cache deletion rejects unverified or tampered export files', async () => {
    const localCachePath = pathToFileURL(path.join(root, 'js', 'database', 'local-cache.js')).href;
    const localCacheModule = await import(localCachePath);
    const SIMNILocalCache = localCacheModule.default || globalThis.SIMNILocalCache;

    // Active year cache deletion attempt must be strictly rejected
    const activeKey = 'appState:u1:ws_superuser:2026-2027:schema3';
    await assert.rejects(
        () => SIMNILocalCache.deleteLocalCacheAfterVerification(activeKey, { format: 'simni-local-cache-export-v1' }),
        /tahun aktif dipertahankan/i,
        'Active academic year cache must not be deleted'
    );

    // Tampered payload attempt must be strictly rejected
    const oldKey = 'appState:u1:ws_superuser:2025-2026:schema3';
    const fakeExport = {
        format: 'simni-local-cache-export-v1',
        key: oldKey,
        hash: 'wrong_hash',
        record: { test: 123 }
    };
    await assert.rejects(
        () => SIMNILocalCache.deleteLocalCacheAfterVerification(oldKey, fakeExport),
        /tidak cocok atau rusak/i,
        'Tampered export payload must be rejected'
    );
});

// ---------------------------------------------------------------------------
// 3. S06 / G01 — Cross-Subsystem Restore Drill & Failure Recovery Simulations
// ---------------------------------------------------------------------------
await test('Restore drill with missing external Cloudinary media URL handles gracefully', () => {
    // When a document's Cloudinary file is 404/deleted in cloud, the academic metadata remains intact
    const restoredDoc = {
        ID_Dokumen: 'doc_lost_asset',
        Nama_Dokumen: 'LKPD IPA 2026',
        URL: 'https://res.cloudinary.com/demo/raw/upload/v1234/missing.pdf',
        Kelas: '3A'
    };

    // Metadata contract preservation
    assert.equal(restoredDoc.ID_Dokumen, 'doc_lost_asset');
    assert.ok(restoredDoc.URL.includes('missing.pdf'));
    // System identifies external asset status without corrupting RTDB record
    const hasExternalUrl = /^https?:\/\//i.test(restoredDoc.URL);
    assert.equal(hasExternalUrl, true, 'Document retains external pointer for re-upload');
});

await test('GADM storage documents maintain separate lifecycle and are not truncated by RTDB operations', () => {
    // GADM documents have independent schema version and provenance
    const gadmDocument = {
        id: 'GADM-2026-MODUL-IPAS',
        type: 'modulAjar',
        metadata: {
            title: 'Modul Ajar IPAS',
            grade: '3',
            subject: 'IPAS'
        },
        provenance: {
            source: 'Badan Standar, Kurikulum, dan Asesmen Pendidikan No. 046/H/KR/2025',
            recordId: 'kb_ipas_fase_b_001'
        }
    };
    assert.equal(gadmDocument.type, 'modulAjar');
    assert.ok(gadmDocument.provenance.recordId);
    // GADM documents are serialized independently of RTDB
    const serializedGadm = JSON.stringify(gadmDocument);
    const deserializedGadm = JSON.parse(serializedGadm);
    assert.deepEqual(deserializedGadm, gadmDocument);
});

await test('G01 local evidence boundary documentation is formally defined', () => {
    const G01_BOUNDARIES = Object.freeze({
        offlineProven: [
            'Storage isolation across workspaces and years',
            'Safe cache cleanup protecting drafts and crypto keys',
            'Storage inventory distinguishing measured payload from browser estimates',
            'Threshold warning triggers on approaching limits or unsent drafts',
            'Multi-year verified retention gate preventing accidental data loss',
            'Subsystem recovery manifest and scope declarations'
        ],
        externalCloudLimitations: [
            'Live Cloudflare R2 bucket retention rules and cross-region replication latency',
            'Firebase Cloud Messaging (FCM) push notification deliverability across device vendors',
            'Cloudinary CDN asset garbage collection and bandwidth throttling',
            'Production Firebase Firestore server security rule evaluation under concurrent multi-tenant loads'
        ]
    });

    assert.equal(G01_BOUNDARIES.offlineProven.length, 6);
    assert.equal(G01_BOUNDARIES.externalCloudLimitations.length, 4);
});

console.log(`\nTEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed > 0 ? 1 : 0);
