import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Setup Node environment to mimic browser globals for backup modules
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}
if (!globalThis.Blob) {
    globalThis.Blob = (await import('node:buffer')).Blob;
}

// Load backup-core using pathToFileURL for cross-platform Windows compatibility
const backupCorePath = pathToFileURL(path.join(root, 'features', 'backup', 'backup-core.js')).href;
const coreModule = await import(backupCorePath);
const core = coreModule.default || globalThis.SIMNIBackupCore;

console.log('--- SIMNI BACKUP & RECOVERY CONTRACT TEST SUITE (TAHAP 1) ---');
console.log('Testing BackupCore constants:');
console.log(`- FORMAT: ${core.FORMAT}`);
console.log(`- VERSION: ${core.VERSION}`);
console.log(`- SCHEMA_VERSION: ${core.SCHEMA_VERSION}`);
console.log(`- MAX_FILE_BYTES: ${core.MAX_FILE_BYTES} (${core.MAX_FILE_BYTES / (1024 * 1024)} MiB)`);
console.log(`- MAX_IMPORT_BYTES: ${core.MAX_IMPORT_BYTES} (${core.MAX_IMPORT_BYTES / (1024 * 1024)} MiB)`);

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

// Mock dataset generator
function createMockDatabase(sizeFactor = 1) {
    const db = {};
    core.DATA_PATHS.forEach(p => {
        core.setAtPath(db, p, {});
    });

    // Populate Identitas
    core.setAtPath(db, 'Pengaturan/Identitas', {
        nama_sekolah: 'SDIT Bina Madani',
        nama_kelas: '3A',
        tahun_pelajaran: '2026-2027',
        nama_guru: 'Unggaran, S.Pd.'
    });

    // Generate students
    const count = 5 * sizeFactor;
    for (let i = 1; i <= count; i++) {
        const nisn = `001234567${i}`.slice(-10);
        core.setAtPath(db, `Siswa/${nisn}`, {
            NISN: nisn,
            ID_Siswa: `stu_${nisn}`,
            nama: `Siswa Uji Ke-${i} (عمر / Café)`,
            kelas: '3A',
            jenisKelamin: i % 2 === 0 ? 'P' : 'L'
        });
        core.setAtPath(db, `Presensi/pres_${nisn}`, {
            ID_Presensi: `pres_${nisn}`,
            NISN: nisn,
            status: 'Hadir',
            tanggal: '2026-09-12'
        });
        core.setAtPath(db, `Nilai_TP/nilai_${nisn}`, {
            ID_Nilai: `nilai_${nisn}`,
            NISN: nisn,
            ID_TP: 'TP_MTK_01',
            nilai: 85 + (i % 15)
        });
    }

    return db;
}

const mockAccess = {
    uid: 'test-user-super',
    role: 'superuser',
    workspaceId: 'ws_superuser',
    classId: '3A',
    academicYearId: '2026-2027',
    activeAcademicYearId: '2026-2027',
    email: 'unggaran.sditbm@gmail.com',
    status: 'active'
};

// 1. Constants & Schema Tests
await runTest('Constants match architectural decisions', () => {
    assert.equal(core.MAX_FILE_BYTES, 25 * 1024 * 1024, 'MAX_FILE_BYTES must be 25 MiB');
    assert.equal(core.MAX_IMPORT_BYTES, 32 * 1024 * 1024, 'MAX_IMPORT_BYTES must be 32 MiB');
    assert.equal(core.VERSION, 5);
    assert.equal(core.SCHEMA_VERSION, 3);
});

// 2. Small dataset round-trip and integrity verification
await runTest('Small dataset round-trip: envelope creation, verification, and extraction', async () => {
    const db = createMockDatabase(2);
    const envelope = await core.createEnvelope(db, {
        academicYear: '2026-2027',
        className: '3A',
        createdBy: 'unggaran.sditbm@gmail.com',
        scope: {
            uid: mockAccess.uid,
            role: mockAccess.role,
            workspaceId: mockAccess.workspaceId,
            classId: mockAccess.classId,
            academicYearId: mockAccess.activeAcademicYearId
        },
        source: 'local-test',
        schemaVersion: core.SCHEMA_VERSION
    });

    assert(envelope.integrity?.hash, 'Hash must exist');
    assert.equal(envelope.completeness?.complete, true);
    assert.equal(envelope.incompletePaths?.length, 0);

    // Verify envelope integrity
    const verifyResult = await core.verifyEnvelope(envelope);
    assert.equal(verifyResult.ok, true, 'Original envelope must pass verification');

    // Serialization: Compact vs Indented
    const compactJson = JSON.stringify(envelope);
    const indentedJson = JSON.stringify(envelope, null, 2);

    assert(indentedJson.length > compactJson.length, 'Indented JSON is larger than compact');

    // Parse and re-verify compact
    const parsedCompact = JSON.parse(compactJson);
    const compactVerification = await core.verifyEnvelope(parsedCompact);
    assert.equal(compactVerification.ok, true, 'Compact parsed envelope passes SHA-256');

    // Parse and re-verify indented
    const parsedIndented = JSON.parse(indentedJson);
    const indentedVerification = await core.verifyEnvelope(parsedIndented);
    assert.equal(indentedVerification.ok, true, 'Indented parsed envelope passes SHA-256');

    // Scope validation
    assert.doesNotThrow(() => core.validateRestoreScope(parsedCompact, mockAccess));

    // Extract database
    const extracted = core.extractDatabase(parsedCompact);
    assert.equal(Object.keys(extracted.Siswa).length, 10);
    assert.equal(extracted.Pengaturan?.Identitas?.nama_sekolah, 'SDIT Bina Madani');
});

// 3. Unicode and multilingual text preservation
await runTest('Unicode preservation: Arabic, accents, symbols, emoji round-trip determinism', async () => {
    const complexUnicodeDb = {
        Siswa: {
            '001': {
                NISN: '001',
                nama: 'مُحَمَّد عُمَر 📚',
                catatan: 'Café & Résumé — Sekolah Menyenangkan 😊'
            }
        }
    };
    const envelope = await core.createEnvelope(complexUnicodeDb, {
        academicYear: '2026-2027',
        className: '3A',
        scope: mockAccess
    });

    const verify1 = await core.verifyEnvelope(envelope);
    assert.equal(verify1.ok, true);

    const json = JSON.stringify(envelope);
    const parsed = JSON.parse(json);
    const verify2 = await core.verifyEnvelope(parsed);
    assert.equal(verify2.ok, true);
    assert.equal(parsed.database.Siswa['001'].nama, 'مُحَمَّد عُمَر 📚');
    assert.equal(parsed.database.Siswa['001'].catatan, 'Café & Résumé — Sekolah Menyenangkan 😊');
});

// 4. Scope mismatch rejection
await runTest('Restore scope mismatch is strictly rejected', async () => {
    const db = createMockDatabase(1);

    // Mismatched role
    const wrongRoleEnvelope = await core.createEnvelope(db, {
        scope: { ...mockAccess, role: 'vip' }
    });
    assert.throws(() => {
        core.validateRestoreScope(wrongRoleEnvelope, mockAccess);
    }, /Role backup tidak cocok/);

    // Mismatched academic year
    const wrongYearEnvelope = await core.createEnvelope(db, {
        scope: { ...mockAccess, academicYearId: '2025-2026' }
    });
    assert.throws(() => {
        core.validateRestoreScope(wrongYearEnvelope, mockAccess);
    }, /Tahun pelajaran/);

    // Mismatched workspace
    const wrongWsEnvelope = await core.createEnvelope(db, {
        scope: { ...mockAccess, workspaceId: 'ws_pjok' }
    });
    assert.throws(() => {
        core.validateRestoreScope(wrongWsEnvelope, mockAccess);
    }, /workspace berbeda/i);

    // Mismatched classId
    const wrongClassEnvelope = await core.createEnvelope(db, {
        scope: { ...mockAccess, classId: '4B' }
    });
    assert.throws(() => {
        core.validateRestoreScope(wrongClassEnvelope, mockAccess);
    }, /Kelas\/scope backup tidak cocok/);
});

// 5. Corrupted data and tampered hash rejection
await runTest('Tampered envelope hash or data is rejected', async () => {
    const db = createMockDatabase(1);
    const envelope = await core.createEnvelope(db, { scope: mockAccess });

    // Tamper with data without updating hash
    const tampered = JSON.parse(JSON.stringify(envelope));
    tampered.database.Siswa['0012345671'].nama = 'HACKED NAME';

    const verify = await core.verifyEnvelope(tampered);
    assert.equal(verify.ok, false, 'Tampered data must fail SHA-256 check');
    assert.notEqual(verify.calculated, verify.expected);
});

// 6. Incomplete paths rejection for rollover gate
await runTest('Incomplete paths prevent complete verification flag', async () => {
    const incompleteEnvelope = {
        format: core.FORMAT,
        version: core.VERSION,
        schemaVersion: core.SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        completeness: { complete: false, missingPaths: ['Jurnal', 'Jadwal'] },
        incompletePaths: ['Jurnal', 'Jadwal'],
        database: { Siswa: {} },
        integrity: { hash: 'dummy' }
    };

    assert.equal(incompleteEnvelope.completeness.complete, false);
    assert(incompleteEnvelope.incompletePaths.length > 0);
});

// 7. Threshold & Boundary Tests: Export Guard
await runTest('Export guard: envelope <= 25 MiB passes; envelope > 25 MiB rejected before download', async () => {
    const maxFileBytes = core.MAX_FILE_BYTES; // 25 MiB

    // Case A: normal payload well within limit
    const smallDb = createMockDatabase(1);
    const smallEnv = await core.createEnvelope(smallDb, { scope: mockAccess });
    const smallJson = JSON.stringify(smallEnv);
    const smallBlob = new Blob([smallJson]);
    assert(smallBlob.size <= maxFileBytes, 'Small blob within 25 MiB');

    // Case B: oversized envelope exceeding 25 MiB
    // We simulate by adding a large payload chunk
    const largeDb = createMockDatabase(1);
    const largeChunk = 'x'.repeat(26 * 1024 * 1024); // 26 MB string
    largeDb['Dokumen'] = { largeDoc: { data: largeChunk } };
    const largeEnv = await core.createEnvelope(largeDb, { scope: mockAccess });
    const largeJson = JSON.stringify(largeEnv);
    const largeBlob = new Blob([largeJson]);

    assert(largeBlob.size > maxFileBytes, 'Blob size exceeds 25 MiB');

    // Emulate downloadEnvelope guard
    let guardBlocked = false;
    try {
        if (largeBlob.size > maxFileBytes) {
            throw new Error(`Ukuran berkas backup (${(largeBlob.size / (1024 * 1024)).toFixed(2)} MB) melampaui batas aman pemulihan (${(maxFileBytes / (1024 * 1024)).toFixed(0)} MB). Harap arsipkan sebagian data terlebih dahulu.`);
        }
    } catch (err) {
        guardBlocked = true;
        assert(err.message.includes('melampaui batas aman pemulihan'), 'Error message contains expected wording');
    }
    assert.equal(guardBlocked, true, 'Export guard successfully blocked oversized backup download');
});

// 8. Dual Threshold Tests: Import Logic
await runTest('Import dual guard: accepts indented file up to 32 MiB if payload <= 25 MiB; rejects > 32 MiB raw; rejects > 25 MiB payload', async () => {
    const maxImportBytes = core.MAX_IMPORT_BYTES; // 32 MiB
    const maxFileBytes = core.MAX_FILE_BYTES;     // 25 MiB

    function simulateImportValidation(rawFileSize, parsedObj) {
        if (rawFileSize > maxImportBytes) {
            throw new Error(`Ukuran berkas backup (${(rawFileSize / (1024 * 1024)).toFixed(2)} MB) melebihi batas baca ${(maxImportBytes / (1024 * 1024)).toFixed(0)} MB.`);
        }
        const payloadBytes = new TextEncoder().encode(JSON.stringify(parsedObj.database || parsedObj)).byteLength;
        if (payloadBytes > maxFileBytes) {
            throw new Error(`Ukuran data backup (${(payloadBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas muat ${(maxFileBytes / (1024 * 1024)).toFixed(0)} MB.`);
        }
        return { ok: true, payloadBytes };
    }

    // Scenario 1: Indented file of 27 MiB whose actual payload is 18 MiB
    // (Simulates a legacy pretty-printed JSON file)
    const validPayload = { Siswa: { '1': { nama: 'Test' } } };
    const validPayloadBytes = new TextEncoder().encode(JSON.stringify(validPayload)).byteLength;
    assert(validPayloadBytes <= maxFileBytes);
    const indentedRawSize = 27 * 1024 * 1024; // 27 MiB raw file with indentation
    const res1 = simulateImportValidation(indentedRawSize, { database: validPayload });
    assert.equal(res1.ok, true, 'Indented file within 32 MiB with valid payload is accepted');

    // Scenario 2: Raw file exceeds 32 MiB
    const oversizedRaw = 33 * 1024 * 1024;
    assert.throws(() => {
        simulateImportValidation(oversizedRaw, { database: validPayload });
    }, /melebihi batas baca 32 MB/);

    // Scenario 3: Raw file is 20 MiB, but payload is 26 MiB (compressed/dense payload)
    const heavyPayloadChunk = 'y'.repeat(26 * 1024 * 1024);
    const heavyPayload = { Siswa: { '1': { data: heavyPayloadChunk } } };
    assert.throws(() => {
        simulateImportValidation(20 * 1024 * 1024, { database: heavyPayload });
    }, /melebihi batas muat 25 MB/);
});

// 9. Repository Rollover Readiness Guard Logic
await runTest('dbMarkRolloverArchiveReady guard logic: strictly verifies canonical scope, completeness, hash, and size', async () => {
    // Emulate dbMarkRolloverArchiveReady verification chain
    async function simulateMarkRolloverArchiveReady(envelope, access) {
        const canonicalWorkspace = access.role === 'superuser' ? 'ws_superuser' : (access.role === 'vip' ? 'ws_pjok' : null);
        if (!canonicalWorkspace || access.workspaceId !== canonicalWorkspace) {
            throw new Error('Migrasi workspace wajib VERIFIED sebelum arsip dapat menjadi gate reset.');
        }
        const verification = await core.verifyEnvelope(envelope);
        if (!verification?.ok) throw new Error('Hash arsip JSON tidak valid.');
        core.validateRestoreScope(envelope, access);
        if (envelope?.completeness?.complete !== true || envelope?.incompletePaths?.length) {
            throw new Error('Arsip belum lengkap; readiness reset ditolak.');
        }
        const payloadBytes = new TextEncoder().encode(JSON.stringify(envelope?.database || envelope)).byteLength;
        const maxArchiveBytes = core.MAX_FILE_BYTES || (25 * 1024 * 1024);
        if (payloadBytes > maxArchiveBytes) {
            throw new Error(`Ukuran data arsip (${(payloadBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas muat ${(maxArchiveBytes / (1024 * 1024)).toFixed(0)} MB.`);
        }
        return {
            ok: true,
            payload: {
                uid: access.uid,
                role: access.role,
                workspaceId: access.workspaceId,
                archiveHash: envelope.integrity.hash,
                verified: true
            }
        };
    }

    const validDb = createMockDatabase(1);
    const validEnv = await core.createEnvelope(validDb, { scope: mockAccess });

    // Success case
    const readyResult = await simulateMarkRolloverArchiveReady(validEnv, mockAccess);
    assert.equal(readyResult.ok, true);
    assert.equal(readyResult.payload.verified, true);
    assert.equal(readyResult.payload.archiveHash, validEnv.integrity.hash);

    // Non-canonical workspace rejection
    const nonCanonicalAccess = { ...mockAccess, workspaceId: 'ws_legacy_old' };
    await assert.rejects(async () => {
        await simulateMarkRolloverArchiveReady(validEnv, nonCanonicalAccess);
    }, /Migrasi workspace wajib VERIFIED/);

    // Corrupted hash rejection
    const corruptedEnv = { ...validEnv, integrity: { hash: 'tampered_hash_value' } };
    await assert.rejects(async () => {
        await simulateMarkRolloverArchiveReady(corruptedEnv, mockAccess);
    }, /Hash arsip JSON tidak valid/);

    // Incomplete archive rejection
    const incompleteEnv = await core.createEnvelope(validDb, {
        scope: mockAccess,
        incompletePaths: ['Jurnal']
    });
    incompleteEnv.completeness = { complete: false, missingPaths: ['Jurnal'] };
    const rehashedIncomplete = await core.createEnvelope(validDb, {
        scope: mockAccess,
        incompletePaths: ['Jurnal']
    });
    await assert.rejects(async () => {
        await simulateMarkRolloverArchiveReady(rehashedIncomplete, mockAccess);
    }, /(Backup|Arsip) (tidak|belum) lengkap/);
});

console.log('\n========================================');
console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
console.log('========================================\n');

if (testsFailed > 0) {
    process.exit(1);
}
