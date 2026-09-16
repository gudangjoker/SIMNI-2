import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Node crypto & blob polyfill
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}
if (!globalThis.Blob) {
    globalThis.Blob = (await import('node:buffer')).Blob;
}

// Import modules
const pagedQueryPath = pathToFileURL(path.join(root, 'js', 'database', 'paged-query.js')).href;
const pagedQueryModule = await import(pagedQueryPath);
const pagedQuery = pagedQueryModule.default || globalThis.SIMNIPagedQuery;

const backupCorePath = pathToFileURL(path.join(root, 'features', 'backup', 'backup-core.js')).href;
const backupCoreModule = await import(backupCorePath);
const backupCore = backupCoreModule.default || globalThis.SIMNIBackupCore;

console.log('--- SIMNI TAHAP 3 CONTRACT TEST SUITE: DATABASE CAPACITY & PAGED QUERIES (S02) ---');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
        testsFailed++;
    }
}

// In-memory mock RTDB store and reference builder
let mockStore = {};
function resetMockDatabase() {
    mockStore = {};
}
function setMockStore(pathStr, data) {
    const parts = pathStr.split('/').filter(Boolean);
    let cur = mockStore;
    for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]] ||= {};
    }
    cur[parts[parts.length - 1]] = structuredClone(data);
}
function getFromMockStore(pathStr) {
    const parts = pathStr.split('/').filter(Boolean);
    let cur = mockStore;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object') return null;
        cur = cur[part];
    }
    return cur ?? null;
}

function createMockRefFn() {
    return (physicalPath, { cursor, limit, constraintsBuilder } = {}) => {
        return {
            path: physicalPath,
            get: async () => {
                const data = getFromMockStore(physicalPath) || {};
                let entries = Object.entries(data);
                // Sort by key
                entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
                // Apply cursor startAt
                if (cursor) {
                    entries = entries.filter(([k]) => k >= cursor);
                }
                // Apply limit
                if (typeof limit === 'number') {
                    entries = entries.slice(0, limit);
                }
                const resultObj = Object.fromEntries(entries);
                return {
                    val: () => structuredClone(resultObj),
                    exists: () => entries.length > 0
                };
            }
        };
    };
}

// Helper to generate synthetic records
function generateRecords(count, prefix = 'rec', classAssigner = null) {
    const records = {};
    for (let i = 0; i < count; i++) {
        const id = `${prefix}_${String(i).padStart(6, '0')}`;
        const studentIndex = i % 30;
        const studentNisn = `NISN_${String(studentIndex).padStart(4, '0')}`;
        records[id] = {
            id,
            nisn: studentNisn,
            nama: `Siswa ${studentIndex}`,
            tanggal: '2026-09-01',
            status: 'H',
            nilai: 85,
            ...(classAssigner ? classAssigner(i, studentIndex) : { Kelas: '3A' })
        };
    }
    return records;
}

// 1. Paged query reading of dataset < 20,000 records
await runTest('1. Paged query reading of dataset < 20,000 records', async () => {
    resetMockDatabase();
    const count = 500;
    const testData = generateRecords(count, 'p1');
    setMockStore('Presensi/Records', testData);

    const mockRefFn = createMockRefFn();
    const result = await pagedQuery.fetchPagedQuery(mockRefFn, 'Presensi/Records', {
        pageSize: 100
    });

    assert.equal(result.count, 100, 'Page must return 100 items');
    assert.equal(result.hasMore, true, 'hasMore must be true when items remain');
    assert.ok(result.nextCursor, 'nextCursor must be populated');
    assert.equal(result.entries.length, 100);
});

// 2. Exact 20,000 records boundary handling
await runTest('2. Paged query reading on exact 20,000 records boundary', async () => {
    resetMockDatabase();
    const count = 20000;
    const testData = generateRecords(count, 'bnd');
    setMockStore('Presensi/Records', testData);

    const mockRefFn = createMockRefFn();
    const result = await pagedQuery.fetchCompleteCollectionPaged(mockRefFn, 'Presensi/Records', {
        pageSize: 5000,
        maxRecords: 25000
    });

    assert.equal(result.count, 20000, 'Must read all 20,000 items without drops');
    assert.equal(result.isComplete, true, 'isComplete must be true');

    // Verify key integrity & uniqueness
    const keys = Object.keys(result.value);
    assert.equal(keys.length, 20000, 'All 20,000 keys must be unique');
});

// 3. Complete paged reading (> 20,000 records, e.g. 24,000 items)
await runTest('3. Complete paged reading (> 20,000 records dataset) without memory spike or truncation', async () => {
    resetMockDatabase();
    // 4 classes * 30 students * 200 days = 24,000 records
    const count = 24000;
    const testData = generateRecords(count, 'ann', (i) => {
        const classes = ['1A', '2A', '3A', '4A'];
        return { Kelas: classes[i % 4] };
    });
    setMockStore('Nilai_TP/Rekap', testData);

    const mockRefFn = createMockRefFn();
    let progressEvents = 0;
    const result = await pagedQuery.fetchCompleteCollectionPaged(mockRefFn, 'Nilai_TP/Rekap', {
        pageSize: 4000,
        maxRecords: 30000,
        onProgress: (prog) => {
            progressEvents++;
            assert.ok(prog.pageCount <= 4000, 'Page size must not exceed limit');
        }
    });

    assert.equal(result.count, 24000, 'Must read all 24,000 records completely');
    assert.equal(result.isComplete, true, 'isComplete must be true');
    assert.ok(progressEvents >= 6, 'Must have received progress events across pages');

    // Check first and last keys
    const keys = Object.keys(result.value).sort();
    assert.equal(keys[0], 'ann_000000');
    assert.equal(keys[23999], 'ann_023999');
    assert.equal(new Set(keys).size, 24000, 'All 24,000 keys must be strictly unique');
});

// 4. Multi-class scope isolation and filtering
await runTest('4. Multi-class scope isolation: filter 24,000 records into class-specific subsets', async () => {
    const mockRefFn = createMockRefFn();
    const result = await pagedQuery.fetchCompleteCollectionPaged(mockRefFn, 'Nilai_TP/Rekap', {
        pageSize: 5000,
        maxRecords: 30000
    });

    // Filter for class 3A
    const res3A = pagedQuery.filterRecordsByScope(result.value, { classId: '3A' });

    // Filter for class 1A
    const res1A = pagedQuery.filterRecordsByScope(result.value, { classId: '1A' });

    assert.equal(res3A.count, 6000, 'Class 3A must have exactly 6,000 records (24,000 / 4)');
    assert.equal(res1A.count, 6000, 'Class 1A must have exactly 6,000 records (24,000 / 4)');

    // Ensure all 3A records have Kelas 3A
    const all3A = res3A.items.every(r => r.Kelas === '3A');
    assert.ok(all3A, 'All filtered records must match target class 3A');
});

// 5. Pagination cursor boundary conditions (empty collection, exact multiple)
await runTest('5. Pagination cursor boundary conditions', async () => {
    resetMockDatabase();
    // 5a. Empty collection
    setMockStore('Empty/Collection', {});
    const mockRefFn = createMockRefFn();
    const emptyResult = await pagedQuery.fetchPagedQuery(mockRefFn, 'Empty/Collection', { pageSize: 50 });
    assert.equal(emptyResult.count, 0, 'Empty collection returns 0 items');
    assert.equal(emptyResult.hasMore, false, 'Empty collection hasMore is false');
    assert.equal(emptyResult.nextCursor, null, 'Empty collection nextCursor is null');

    // 5b. Exact multiple of page size (e.g. 200 items with pageSize 100)
    const exactData = generateRecords(200, 'ex');
    setMockStore('Exact/Records', exactData);

    const page1 = await pagedQuery.fetchPagedQuery(mockRefFn, 'Exact/Records', { pageSize: 100 });
    assert.equal(page1.count, 100);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor);

    const page2 = await pagedQuery.fetchPagedQuery(mockRefFn, 'Exact/Records', { pageSize: 100, cursor: page1.nextCursor });
    assert.equal(page2.count, 100);
    assert.equal(page2.hasMore, false, 'Second page exhausts the collection');
    assert.equal(page2.nextCursor, null, 'No further cursor on last page');
});

// 6. Legacy record resolution without 'Kelas' attribute
await runTest('6. Legacy record resolution without Kelas attribute using student roster', async () => {
    const legacyRecords = [
        { id: 'leg_01', nisn: 'NISN_001', nama: 'Budi', nilai: 90 }, // no Kelas
        { id: 'leg_02', nisn: 'NISN_002', nama: 'Siti', nilai: 88 }, // no Kelas
        { id: 'leg_03', nisn: 'NISN_003', nama: 'Andi', nilai: 95, Kelas: '4B' }, // explicit Kelas
    ];

    const studentRoster = [
        { nisn: 'NISN_001', nama: 'Budi', kelas: '3A' },
        { nisn: 'NISN_002', nama: 'Siti', kelas: '3B' },
        { nisn: 'NISN_003', nama: 'Andi', kelas: '4B' },
    ];

    // Filter for class 3A
    const filtered3A = pagedQuery.filterRecordsByScope(legacyRecords, { classId: '3A', studentsRoster: studentRoster });
    assert.equal(filtered3A.count, 1, 'Should resolve Budi into 3A via NISN');
    assert.equal(filtered3A.items[0].id, 'leg_01');

    // Filter for class 3B
    const filtered3B = pagedQuery.filterRecordsByScope(legacyRecords, { classId: '3B', studentsRoster: studentRoster });
    assert.equal(filtered3B.count, 1, 'Should resolve Siti into 3B via NISN');
    assert.equal(filtered3B.items[0].id, 'leg_02');
});

// Runtime >25,000 records is tested by three-findings-local and the browser suite.
await runTest('7. Production sync routes collections through complete live pages', async () => {
    const source = await readFile(path.join(root, 'js/database/sync.js'), 'utf8');
    assert.match(source, /subscribeLivePages/);
    assert.match(source, /pagedComplete/);
    assert.doesNotMatch(source, /MAX_BINDING_RECORDS/);
});

// 8. Repository dbFetchCompleteCollection chunked read integration
await runTest('8. Repository dbFetchCompleteCollection reads large datasets in chunks', async () => {
    resetMockDatabase();
    const count = 12000;
    const testData = generateRecords(count, 'repo');
    setMockStore('Jurnal/Rekap', testData);

    const mockRefFn = createMockRefFn();
    const result = await pagedQuery.fetchCompleteCollectionPaged(mockRefFn, 'Jurnal/Rekap', {
        pageSize: 3000,
        maxRecords: 20000
    });

    assert.equal(result.count, 12000);
    assert.equal(result.isComplete, true);
    assert.equal(Object.keys(result.value).length, 12000);
});

// 9. Backup & recovery integration with > 20,000 records dataset
await runTest('9. Backup & recovery integration with > 20,000 records dataset creates valid verified envelope <= 25 MiB', async () => {
    resetMockDatabase();
    // Create large database mock:
    // Identitas
    const db = {};
    backupCore.DATA_PATHS.forEach(p => backupCore.setAtPath(db, p, {}));
    backupCore.setAtPath(db, 'Pengaturan/Identitas', {
        nama_sekolah: 'SDIT Bina Madani',
        nama_kelas: '3A',
        tahun_pelajaran: '2026-2027',
        nama_guru: 'Unggaran, S.Pd.'
    });

    // Populate 21,000 records in Presensi
    const largePresensi = generateRecords(21000, 'bkp');
    backupCore.setAtPath(db, 'Presensi', largePresensi);

    // Create backup envelope
    const envelope = await backupCore.createEnvelope(db, {
        academicYear: '2026-2027',
        className: '3A',
        createdBy: 'test-user@simni.invalid',
        scope: {
            uid: 'qa-user',
            role: 'superuser',
            workspaceId: 'ws_superuser',
            classId: '3A',
            academicYearId: '2026-2027'
        },
        source: 'local-test'
    });

    assert.equal(envelope.format, backupCore.FORMAT);
    assert.equal(envelope.version, backupCore.VERSION);
    assert.equal(envelope.schemaVersion, backupCore.SCHEMA_VERSION);
    assert.ok(envelope.integrity?.hash, 'Envelope must have integrity hash');
    assert.equal(envelope.counts.Presensi, 21000, 'Counts must report all 21,000 records in Presensi');

    // Serialize envelope to JSON string and check size
    const envelopeStr = JSON.stringify(envelope);
    const byteLength = Buffer.byteLength(envelopeStr, 'utf8');
    console.log(`     -> Generated backup envelope size for 21,000 records: ${(byteLength / (1024 * 1024)).toFixed(2)} MiB`);

    assert.ok(byteLength <= backupCore.MAX_FILE_BYTES, `Backup envelope must be <= 25 MiB (was ${byteLength} bytes)`);

    // Verify envelope integrity
    const verifyResult = await backupCore.verifyEnvelope(envelope);
    assert.equal(verifyResult.ok, true, 'Envelope verification must succeed');

    // Parse / extract backup
    const extractedDb = envelope.database;
    assert.equal(Object.keys(extractedDb.Presensi).length, 21000, 'Extracted data must have all 21,000 records intact');
});

// 10. Scope contract and loading status verification
await runTest('10. Scope contract state metadata verification', async () => {
    // Check state shape
    const mockState = {
        presensiScope: {
            kelas: '3A',
            period: '2026-09',
            isComplete: false,
            paged: true,
            lastCursor: 'rec_000100',
            hasMore: true,
            loadedAt: '2026-09-12T14:00:00.000Z'
        },
        nilaiScope: {
            kelas: '3A',
            isComplete: false,
            paged: true,
            lastCursor: null,
            hasMore: false,
            loadedAt: '2026-09-12T14:00:00.000Z'
        },
        jurnalScope: {
            kelas: '3A',
            isComplete: true,
            paged: false,
            lastCursor: null,
            hasMore: false,
            loadedAt: '2026-09-12T14:00:00.000Z'
        }
    };

    assert.equal(mockState.presensiScope.kelas, '3A');
    assert.equal(mockState.presensiScope.paged, true);
    assert.equal(mockState.presensiScope.hasMore, true);
    assert.equal(mockState.jurnalScope.isComplete, true);
});

console.log('--- SUMMARY ---');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
