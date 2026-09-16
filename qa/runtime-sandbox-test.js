'use strict';

/**
 * SIMNI PWA — RUNTIME SANDBOX TEST
 * 
 * Menguji semua business logic core yang bisa dijalankan di Node.js
 * tanpa browser: backup round-trip, access policy, free-tier edge contract,
 * dan simulasi operasi data (siswa, presensi, TP, jurnal, catatan, LPS).
 */

const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
    if (condition) {
        passed++;
        console.log(`  [PASS] ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  [FAIL] ${label}`);
    }
}

function section(title) {
    console.log(`\n${'='.repeat(60)}\n ${title}\n${'='.repeat(60)}`);
}

// ============================================================
// 1. ACCESS POLICY CORE
// ============================================================
section('1. ACCESS POLICY CORE — Role Matrix & Feature Guard');

const policy = require(path.join(ROOT, 'js/auth/access-policy-core.js'));

assert(policy.ROLES.SUPERUSER === 'superuser', 'ROLES.SUPERUSER = superuser');
assert(policy.ROLES.VIP === 'vip', 'ROLES.VIP = vip');
assert(Object.keys(policy.ROLES).length === 2, 'Access policy hanya memiliki dua role');

assert(policy.FEATURES.CHAT === undefined, 'Chat feature removed');
assert(policy.FEATURES.DASHBOARD === 'dashboard', 'FEATURES.DASHBOARD exists');
assert(policy.FEATURES.LPS === 'lps', 'FEATURES.LPS exists');
assert(policy.FEATURES.DOCUMENTS === 'documents', 'FEATURES.DOCUMENTS exists');
assert(policy.FEATURES.USER_ADMIN === 'userAdmin', 'FEATURES.USER_ADMIN exists');
assert(policy.FEATURES.GADM === 'gadm', 'FEATURES.GADM exists');

// Chat access: Superuser dan VIP
assert(policy.hasFeature('superuser', 'chat') === false, 'Superuser cannot access removed Chat');
assert(policy.hasFeature('vip', 'chat') === false, 'VIP cannot access removed Chat');

// Documents: Superuser YES, VIP NO
assert(policy.hasFeature('superuser', 'documents') === true, 'Superuser CAN access Documents');
assert(policy.hasFeature('vip', 'documents') === false, 'VIP CANNOT access Documents');

// LPS: Superuser YES, VIP NO
assert(policy.hasFeature('superuser', 'lps') === true, 'Superuser CAN access LPS');
assert(policy.hasFeature('vip', 'lps') === false, 'VIP CANNOT access LPS');
assert(policy.hasFeature('superuser', 'gadm') === true, 'Superuser CAN access GADM');
assert(policy.hasFeature('vip', 'gadm') === true, 'VIP CAN access GADM');

const expectedRoleFeatures = {
    superuser: ['dashboard', 'students', 'attendance', 'grades', 'journal', 'notes', 'settings', 'backup', 'archive', 'reset'],
    vip: ['dashboard', 'students', 'attendance', 'grades', 'journal', 'settings', 'backup']
};
for (const [role, features] of Object.entries(expectedRoleFeatures)) {
    for (const feat of features) assert(policy.hasFeature(role, feat) === true, `${role} has ${feat}`);
}
assert(policy.hasFeature('vip', 'notes') === false, 'vip cannot access notes');
assert(policy.hasFeature('vip', 'archive') === false, 'vip cannot access cloud archive');
assert(policy.hasFeature('vip', 'reset') === false, 'vip cannot reset academic year');

// Invalid role returns false
assert(policy.hasFeature('admin', 'dashboard') === false, 'Invalid role "admin" denied');
assert(policy.hasFeature('', 'dashboard') === false, 'Empty role denied');
assert(policy.hasFeature(null, 'dashboard') === false, 'Null role denied');

// normalizeRole
assert(policy.normalizeRole('SUPERUSER') === 'superuser', 'normalizeRole case-insensitive');
assert(policy.normalizeRole('  VIP  ') === 'vip', 'normalizeRole trims whitespace');
assert(policy.normalizeRole('admin') === null, 'normalizeRole rejects unknown role');

// validateProfile
const validProfile = policy.validateProfile({
    role: 'superuser',
    status: 'active',
    workspaceId: 'ws_superuser',
    classId: '5A',
    activeAcademicYearId: '2026-2027',
    email: 'test@test.com',
    displayName: 'Test User'
}, 'uid123');

assert(validProfile.uid === 'uid123', 'validateProfile sets uid');
assert(validProfile.role === 'superuser', 'validateProfile validates role');
assert(validProfile.workspaceId === 'ws_superuser', 'validateProfile keeps canonical workspaceId');
assert(validProfile.classId === '5A', 'validateProfile accepts yearly class assignment');
assert(Object.isFrozen(validProfile), 'validateProfile returns frozen object');

// validateProfile rejects
let threw = false;
try { policy.validateProfile({ role: 'admin', status: 'active', workspaceId: 'x', classId: 'x', activeAcademicYearId: '2026-2027' }); } catch (_) { threw = true; }
assert(threw, 'validateProfile rejects invalid role');

threw = false;
try { policy.validateProfile({ role: 'superuser', status: 'suspended', workspaceId: 'x', classId: 'x', activeAcademicYearId: '2026-2027' }); } catch (_) { threw = true; }
assert(threw, 'validateProfile rejects non-active status');

// featureForView
assert(policy.featureForView('dashboard') === 'dashboard', 'featureForView(dashboard)');
assert(policy.featureForView('siswa') === 'students', 'featureForView(siswa)');
assert(policy.featureForView('lps') === 'lps', 'featureForView(lps)');
assert(policy.featureForView('gadm') === 'gadm', 'featureForView(gadm)');
assert(policy.featureForView('nonexistent') === null, 'featureForView(nonexistent) = null');

// featureForLogicalPath
assert(policy.featureForLogicalPath('Dokumen') === 'documents', 'featureForLogicalPath(Dokumen)');
assert(policy.featureForLogicalPath('Data_LPS') === 'lps', 'featureForLogicalPath(Data_LPS)');
assert(policy.featureForLogicalPath('Siswa/1234') === 'students', 'featureForLogicalPath(Siswa/1234)');

// ============================================================
// 2. BACKUP CORE — Full Round-Trip
// ============================================================
section('2. BACKUP CORE — Envelope Create / Verify / Tamper Detection');

const BackupCore = require(path.join(ROOT, 'features/backup/backup-core.js'));

assert(BackupCore.FORMAT === 'simni-pwa-backup', 'Backup FORMAT correct');
assert(BackupCore.VERSION === 5, 'Backup VERSION = 5');
assert(BackupCore.SCHEMA_VERSION === 3, 'Backup SCHEMA_VERSION = 3');
assert(BackupCore.MAX_FILE_BYTES === 25 * 1024 * 1024, 'MAX_FILE_BYTES = 25MB');
assert(BackupCore.DATA_PATHS.length === 14, 'DATA_PATHS has 14 entries');
assert(BackupCore.APP_TOP_LEVELS.length === 11, 'APP_TOP_LEVELS has 11 entries');

// Simulate full SIMNI dataset
const mockStudents = {
    '1234567890': {
        NISN: '1234567890',
        ID_Siswa: 'stu_1234567890',
        nama: 'Ahmad Fauzan',
        kelas: '3A',
        jenisKelamin: 'L',
        tempatLahir: 'Bandung',
        tanggalLahir: '2019-05-15'
    },
    '0987654321': {
        NISN: '0987654321',
        ID_Siswa: 'stu_0987654321',
        nama: 'Siti Nurhaliza',
        kelas: '3A',
        jenisKelamin: 'P',
        tempatLahir: 'Jakarta',
        tanggalLahir: '2019-08-22'
    },
    '1122334455': {
        NISN: '1122334455',
        ID_Siswa: 'stu_1122334455',
        nama: 'Budi Santoso',
        kelas: '3A',
        jenisKelamin: 'L',
        tempatLahir: 'Surabaya',
        tanggalLahir: '2019-01-10'
    }
};

const mockPresensi = {
    '2026-08-01_1234567890': { Tanggal: '2026-08-01', NISN: '1234567890', status: 'hadir', waktu: '07:30' },
    '2026-08-01_0987654321': { Tanggal: '2026-08-01', NISN: '0987654321', status: 'hadir', waktu: '07:25' },
    '2026-08-01_1122334455': { Tanggal: '2026-08-01', NISN: '1122334455', status: 'sakit', waktu: null, keterangan: 'Demam' },
    '2026-08-02_1234567890': { Tanggal: '2026-08-02', NISN: '1234567890', status: 'izin', keterangan: 'Acara keluarga' },
    '2026-08-02_0987654321': { Tanggal: '2026-08-02', NISN: '0987654321', status: 'hadir', waktu: '07:20' }
};

const mockMapelTP = {
    'tp_mtk_01': {
        ID_mapel: 'tp_mtk_01',
        mapel: 'Matematika',
        semester: '1',
        kode_tp: 'MTK-3A-TP01',
        deskripsi_tp: 'Penjumlahan dan pengurangan bilangan sampai 1000'
    },
    'tp_bindo_01': {
        ID_mapel: 'tp_bindo_01',
        mapel: 'Bahasa Indonesia',
        semester: '1',
        kode_tp: 'BINDO-3A-TP01',
        deskripsi_tp: 'Membaca dan memahami teks cerita pendek'
    },
    'tp_ipa_01': {
        ID_mapel: 'tp_ipa_01',
        mapel: 'IPA',
        semester: '1',
        kode_tp: 'IPA-3A-TP01',
        deskripsi_tp: 'Menjelaskan siklus air'
    }
};

const mockNilaiTP = {
    'grade_stu_1234567890__tp_mtk_01': {
        ID_Nilai: 'grade_stu_1234567890__tp_mtk_01',
        ID_Siswa: 'stu_1234567890',
        NISN: '1234567890',
        learningObjectiveId: 'tp_mtk_01',
        mapel: 'Matematika',
        semester: '1',
        kode_tp: 'MTK-3A-TP01',
        Deskripsi_TP: 'Penjumlahan dan pengurangan bilangan sampai 1000',
        nilai: 85
    },
    'grade_stu_0987654321__tp_bindo_01': {
        ID_Nilai: 'grade_stu_0987654321__tp_bindo_01',
        ID_Siswa: 'stu_0987654321',
        NISN: '0987654321',
        learningObjectiveId: 'tp_bindo_01',
        mapel: 'Bahasa Indonesia',
        semester: '1',
        kode_tp: 'BINDO-3A-TP01',
        Deskripsi_TP: 'Membaca dan memahami teks cerita pendek',
        nilai: 92
    },
    'grade_stu_1122334455__tp_ipa_01': {
        ID_Nilai: 'grade_stu_1122334455__tp_ipa_01',
        ID_Siswa: 'stu_1122334455',
        NISN: '1122334455',
        learningObjectiveId: 'tp_ipa_01',
        mapel: 'IPA',
        semester: '1',
        kode_tp: 'IPA-3A-TP01',
        Deskripsi_TP: 'Menjelaskan siklus air',
        nilai: 78
    }
};

const mockJurnal = {
    'jurnal_20260801': {
        ID_Jurnal: 'jurnal_20260801',
        tanggal: '2026-08-01',
        kegiatan: 'Pembelajaran Matematika - Penjumlahan bersusun',
        catatan: 'Siswa antusias mengikuti pembelajaran',
        mapiId: 'tp_mtk_01'
    },
    'jurnal_20260802': {
        ID_Jurnal: 'jurnal_20260802',
        tanggal: '2026-08-02',
        kegiatan: 'Pembelajaran Bahasa Indonesia - Membaca cerita',
        catatan: 'Beberapa siswa perlu bimbingan membaca'
    }
};

const mockCatatan = {
    'catatan_001': {
        ID_Catatan: 'catatan_001',
        judul: 'Perkembangan Ahmad Fauzan',
        isi: 'Ahmad menunjukkan perkembangan yang baik di bidang Matematika. Perlu ditingkatkan di Bahasa Indonesia.',
        tanggal: '2026-08-15',
        nisn: '1234567890'
    },
    'catatan_002': {
        ID_Catatan: 'catatan_002',
        judul: 'Rencana Remidial IPA',
        isi: 'Budi Santoso perlu remidial untuk materi siklus air. Akan dilakukan pada minggu depan.',
        tanggal: '2026-08-16',
        nisn: '1122334455'
    }
};

const mockDokumen = {
    'doc_rpph_001': {
        ID_Dokumen: 'doc_rpph_001',
        judul: 'RPPH Minggu 1 Agustus 2026',
        jenis: 'RPPH',
        tanggal: '2026-08-01'
    }
};

const mockLPSTemplates = {
    'template_default': {
        templateId: 'template_default',
        name: 'Template Standar Kelas 3',
        version: 3,
        sections: ['identitas', 'kompetensi', 'catatan']
    }
};

const mockLPSReports = {
    'report_1234567890_sem1': {
        reportId: 'report_1234567890_sem1',
        nisn: '1234567890',
        semester: '1',
        status: 'draft',
        templateId: 'template_default'
    }
};

const fullDatabase = {
    Pengaturan: {
        Identitas: {
            nama_sekolah: 'SD Negeri Cimahi 01',
            nama_guru: 'Aretha Hafiza S',
            nama_kelas: 'Kelas 3A',
            tahun_pelajaran: '2026-2027'
        },
        LPS_v2: {}
    },
    Siswa: mockStudents,
    Presensi: mockPresensi,
    Mapel_TP: mockMapelTP,
    Nilai_TP: mockNilaiTP,
    Dokumen: mockDokumen,
    Catatan: mockCatatan,
    Jurnal: mockJurnal,
    Jadwal: [],
    Data_LPS: {},
    LPS: {
        Templates: mockLPSTemplates,
        Reports: mockLPSReports,
        Revisions: {}
    }
};

// Test filterAllowedDatabase
const filtered = BackupCore.filterAllowedDatabase(fullDatabase);
assert(Object.keys(filtered.Siswa).length === 3, 'filterAllowedDatabase: 3 students preserved');
assert(Object.keys(filtered.Presensi).length === 5, 'filterAllowedDatabase: 5 attendance records preserved');
assert(Object.keys(filtered.Mapel_TP).length === 3, 'filterAllowedDatabase: 3 TP records preserved');
assert(Object.keys(filtered.Nilai_TP).length === 3, 'filterAllowedDatabase: 3 grades preserved');
assert(Object.keys(filtered.Jurnal).length === 2, 'filterAllowedDatabase: 2 journal entries preserved');
assert(Object.keys(filtered.Catatan).length === 2, 'filterAllowedDatabase: 2 notes preserved');
assert(Object.keys(filtered.Dokumen).length === 1, 'filterAllowedDatabase: 1 document preserved');
assert(Object.keys(filtered.LPS.Templates).length === 1, 'filterAllowedDatabase: 1 LPS template preserved');
assert(Object.keys(filtered.LPS.Reports).length === 1, 'filterAllowedDatabase: 1 LPS report preserved');

// Test canonicalStringify determinism
const json1 = BackupCore.canonicalStringify({ b: 2, a: 1 });
const json2 = BackupCore.canonicalStringify({ a: 1, b: 2 });
assert(json1 === json2, 'canonicalStringify is deterministic (key order independent)');

// Test deepClone immutability
const original = { a: { b: 1 } };
const cloned = BackupCore.deepClone(original);
cloned.a.b = 999;
assert(original.a.b === 1, 'deepClone creates true deep copy');

// Test sanitizeFirebaseKey
assert(BackupCore.sanitizeFirebaseKey('normal_key') === 'normal_key', 'sanitizeFirebaseKey: normal key passes');
assert(BackupCore.sanitizeFirebaseKey('key.with.dots') === 'key_with_dots', 'sanitizeFirebaseKey: dots replaced');
assert(BackupCore.sanitizeFirebaseKey('key#hash') === 'key_hash', 'sanitizeFirebaseKey: hash replaced');
assert(BackupCore.sanitizeFirebaseKey('__proto__') === 'safe___proto__', 'sanitizeFirebaseKey: prototype pollution blocked');
assert(BackupCore.sanitizeFirebaseKey('') === 'tanpa_id', 'sanitizeFirebaseKey: empty gets fallback');

// Test summarizeDatabase
const summary = BackupCore.summarizeDatabase(fullDatabase);
assert(summary.length > 0, 'summarizeDatabase returns non-empty array');
const siswaEntry = summary.find(e => e.path === 'Siswa');
assert(siswaEntry && siswaEntry.count === 3, 'summarizeDatabase: Siswa count = 3');

// Test setAtPath / getAtPath
const target = {};
BackupCore.setAtPath(target, 'a/b/c', 42);
assert(BackupCore.getAtPath(target, 'a/b/c') === 42, 'setAtPath/getAtPath round-trip');
assert(BackupCore.getAtPath(target, 'a/b/d') === undefined, 'getAtPath returns undefined for missing');

// Test createFilename
const filename = BackupCore.createFilename({
    className: 'Kelas 3A',
    academicYear: '2026-2027',
    createdAt: '2026-08-28T10:00:00Z'
}, 'SIMNI_Backup');
assert(filename.endsWith('.json'), 'createFilename ends with .json');
assert(filename.includes('2026-08-28'), 'createFilename includes date');
assert(filename.includes('Kelas_3A'), 'createFilename includes class');

// Test buildReplaceUpdates
const replaceUpdates = BackupCore.buildReplaceUpdates(fullDatabase);
assert(Object.keys(replaceUpdates).length === 14, 'buildReplaceUpdates produces 14 path entries');
assert(replaceUpdates['Siswa'] !== undefined, 'buildReplaceUpdates includes Siswa');
assert(replaceUpdates['LPS/Templates'] !== undefined, 'buildReplaceUpdates includes LPS/Templates');

// Test flattenForMerge
const mergeUpdates = BackupCore.flattenForMerge(fullDatabase);
assert(Object.keys(mergeUpdates).length > 0, 'flattenForMerge produces update entries');
assert(mergeUpdates['Siswa/1234567890/nama'] === 'Ahmad Fauzan', 'flattenForMerge deep-flattens student name');

// ============================================================
// 3. BACKUP ENVELOPE — Create + Verify + Tamper
// ============================================================
section('3. BACKUP ENVELOPE — SHA-256 Integrity Round-Trip');

// Need to polyfill crypto.subtle for Node.js
const { subtle } = require('node:crypto').webcrypto;
Object.defineProperty(globalThis, 'crypto', { value: { subtle }, configurable: true });

(async () => {
    try {
        // Create envelope
        const envelope = await BackupCore.createEnvelope(fullDatabase, {
            appVersion: '4.6.3',
            projectId: 'admin-kelas-3a',
            academicYear: '2026-2027',
            className: 'Kelas 3A',
            createdBy: { uid: 'test-uid', role: 'superuser', workspaceId: 'ws_3a', classId: '3A', activeAcademicYearId: '2026-2027' },
            scope: { uid: 'test-uid', role: 'superuser', workspaceId: 'ws_3a', classId: '3A', academicYearId: '2026-2027' },
            source: 'sandbox-test'
        });

        assert(envelope.format === 'simni-pwa-backup', 'Envelope format correct');
        assert(envelope.version === 5, 'Envelope version = 5');
        assert(envelope.schemaVersion === 3, 'Envelope schemaVersion = 3');
        assert(envelope.appVersion === '4.6.3', 'Envelope appVersion = 4.6.3');
        assert(typeof envelope.integrity.hash === 'string' && envelope.integrity.hash.length === 64, 'Envelope SHA-256 hash present (64 hex chars)');
        assert(envelope.integrity.algorithm === 'SHA-256', 'Envelope algorithm = SHA-256');
        assert(envelope.scope.workspaceId === 'ws_3a', 'Envelope scope.workspaceId = ws_3a');
        assert(envelope.scope.academicYearId === '2026-2027', 'Envelope scope.academicYearId');
        assert(envelope.completeness.complete === true, 'Envelope completeness = true');
        assert(envelope.completeness.requiredPathCount === 14, 'Envelope requiredPathCount = 14');

        // Verify: envelope should pass integrity check
        const verification = await BackupCore.verifyEnvelope(envelope);
        assert(verification.ok === true, 'Envelope verification PASS (SHA-256 matches)');
        assert(verification.expected === verification.actual, 'Expected hash === actual hash');
        assert(verification.legacy === false, 'Not a legacy envelope');

        // Tamper detection: modify a grade value
        const tampered = BackupCore.deepClone(envelope);
        tampered.database.Nilai_TP['grade_stu_1234567890__tp_mtk_01'].nilai = 100;
        const tamperResult = await BackupCore.verifyEnvelope(tampered);
        assert(tamperResult.ok === false, 'Tampered envelope DETECTED (hash mismatch)');
        assert(tamperResult.expected !== tamperResult.actual, 'Expected !== actual after tamper');

        // Tamper detection: add a new student
        const tampered2 = BackupCore.deepClone(envelope);
        tampered2.database.Siswa['9999999999'] = { NISN: '9999999999', nama: 'Hacker' };
        const tamperResult2 = await BackupCore.verifyEnvelope(tampered2);
        assert(tamperResult2.ok === false, 'Injected student DETECTED by integrity check');

        // Tamper detection: delete attendance
        const tampered3 = BackupCore.deepClone(envelope);
        delete tampered3.database.Presensi['2026-08-01_1234567890'];
        const tamperResult3 = await BackupCore.verifyEnvelope(tampered3);
        assert(tamperResult3.ok === false, 'Deleted attendance record DETECTED');

        // Validate restore scope
        const accessContext = {
            status: 'active',
            workspaceId: 'ws_3a',
            role: 'superuser',
            classId: '3A',
            activeAcademicYearId: '2026-2027'
        };
        const scopeResult = BackupCore.validateRestoreScope(envelope, accessContext);
        assert(scopeResult.ok === true, 'Restore scope validation PASS');

        // Scope mismatch: wrong workspace
        let scopeThrew = false;
        try {
            BackupCore.validateRestoreScope(envelope, { ...accessContext, workspaceId: 'ws_other' });
        } catch (_) { scopeThrew = true; }
        assert(scopeThrew, 'Restore scope REJECTS wrong workspaceId');

        // Scope mismatch: wrong academic year
        scopeThrew = false;
        try {
            BackupCore.validateRestoreScope(envelope, { ...accessContext, activeAcademicYearId: '2025-2026' });
        } catch (_) { scopeThrew = true; }
        assert(scopeThrew, 'Restore scope REJECTS wrong academicYearId');

        // Scope mismatch: wrong role
        scopeThrew = false;
        try {
            BackupCore.validateRestoreScope(envelope, { ...accessContext, role: 'vip' });
        } catch (_) { scopeThrew = true; }
        assert(scopeThrew, 'Restore scope REJECTS wrong role');

        // ============================================================
        // 4. BACKUP FULL CYCLE: Create → Serialize → Parse → Verify → Restore Updates
        // ============================================================
        section('4. BACKUP FULL CYCLE — Write → Serialize → Parse → Verify → Restore');

        const serialized = JSON.stringify(envelope);
        const fileSize = Buffer.byteLength(serialized, 'utf8');
        assert(fileSize < BackupCore.MAX_FILE_BYTES, `Serialized size ${(fileSize/1024).toFixed(1)}KB < 25MB limit`);

        const parsed = JSON.parse(serialized);
        const parsedVerification = await BackupCore.verifyEnvelope(parsed);
        assert(parsedVerification.ok === true, 'Serialized → parsed envelope still passes SHA-256');

        const extractedDb = BackupCore.extractDatabase(parsed);
        assert(Object.keys(extractedDb.Siswa).length === 3, 'extractDatabase preserves 3 students');
        assert(Object.keys(extractedDb.Presensi).length === 5, 'extractDatabase preserves 5 attendance');
        assert(Object.keys(extractedDb.Nilai_TP).length === 3, 'extractDatabase preserves 3 grades');

        const restoreUpdates = BackupCore.buildReplaceUpdates(extractedDb);
        assert(Object.keys(restoreUpdates).length === 14, 'buildReplaceUpdates from restored = 14 paths');
        assert(restoreUpdates['Siswa']['1234567890'].nama === 'Ahmad Fauzan', 'Restored student name matches');
        assert(restoreUpdates['Nilai_TP']['grade_stu_1234567890__tp_mtk_01'].nilai === 85, 'Restored grade value matches');

        // ============================================================
        // 5. SIMULATED DATA OPERATIONS
        // ============================================================
        section('5. SIMULATED DATA OPERATIONS — CRUD Lifecycle');

        // Simulate "tambah siswa baru"
        const newStudents = BackupCore.deepClone(filtered.Siswa);
        newStudents['5566778899'] = {
            NISN: '5566778899',
            ID_Siswa: 'stu_5566778899',
            nama: 'Dewi Lestari',
            kelas: '3A',
            jenisKelamin: 'P',
            tempatLahir: 'Semarang',
            tanggalLahir: '2019-11-03'
        };
        assert(Object.keys(newStudents).length === 4, 'ADD student: 3→4 students');

        // Simulate "tambah presensi" for new student
        const newPresensi = BackupCore.deepClone(filtered.Presensi);
        newPresensi['2026-08-03_5566778899'] = { Tanggal: '2026-08-03', NISN: '5566778899', status: 'hadir', waktu: '07:15' };
        assert(Object.keys(newPresensi).length === 6, 'ADD presensi: 5→6 records');

        // Simulate "hapus siswa"
        delete newStudents['1122334455'];
        assert(Object.keys(newStudents).length === 3, 'DELETE student: 4→3 students');

        // Simulate "update nilai"
        const newNilai = BackupCore.deepClone(filtered.Nilai_TP);
        newNilai['grade_stu_1234567890__tp_mtk_01'].nilai = 90;
        assert(newNilai['grade_stu_1234567890__tp_mtk_01'].nilai === 90, 'UPDATE grade: 85→90');

        // Simulate backup after modifications
        const modifiedDb = BackupCore.deepClone(fullDatabase);
        modifiedDb.Siswa = newStudents;
        modifiedDb.Presensi = newPresensi;
        modifiedDb.Nilai_TP = newNilai;

        const modifiedEnvelope = await BackupCore.createEnvelope(modifiedDb, {
            appVersion: '4.3.4',
            scope: { uid: 'test-uid', role: 'superuser', workspaceId: 'ws_3a', classId: '3A', academicYearId: '2026-2027' },
            source: 'sandbox-modified'
        });

        assert(modifiedEnvelope.integrity.hash !== envelope.integrity.hash, 'Modified backup has DIFFERENT hash');

        const modifiedVerification = await BackupCore.verifyEnvelope(modifiedEnvelope);
        assert(modifiedVerification.ok === true, 'Modified backup passes own integrity check');

        // Verify counts in modified envelope
        assert(modifiedEnvelope.counts['Siswa'] === 3, 'Modified counts: 3 students (after delete)');
        assert(modifiedEnvelope.counts['Presensi'] === 6, 'Modified counts: 6 attendance (after add)');

        // ============================================================
        // 6. FREE-TIER EDGE — Contract Verification
        // ============================================================
        section('6. FREE-TIER EDGE — Billing-Safe Contract');

        const firebaseDeployment = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
        const edgeSource = fs.readFileSync(path.join(ROOT, 'edge/worker.js'), 'utf8');
        const edgeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'edge/wrangler.jsonc'), 'utf8'));
        assert(!firebaseDeployment.functions, 'Firebase deploy tidak memuat Cloud Functions/Blaze');
        assert(!edgeConfig.r2_buckets, 'Asset Worker has no Chat storage binding');
        assert(edgeSource.includes('CLOUDINARY_POLICY'), 'Worker mempertahankan policy Cloudinary untuk LKPD dan Dokumen');
        assert(edgeSource.includes('8 * 1024 * 1024'), 'Hard limit aset maksimal 8 MB');
        assert(edgeSource.includes('verifyFirebaseIdToken'), 'Worker memverifikasi Firebase ID token');
        assert(edgeSource.includes('SIMNI_ALLOWED_ORIGINS'), 'Worker menerapkan origin allowlist');
        assert(edgeSource.includes('/v1/cloudinary/sign'), 'Worker menyediakan signed upload endpoint');
        assert(edgeSource.includes('/v1/cloudinary/delete'), 'Worker menyediakan scoped cleanup endpoint');

        // ============================================================
        // 7. SERVICE WORKER — Precache Verification
        // ============================================================
        section('7. SERVICE WORKER — Precache Contract');

        const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

        const requiredPrecache = [
            './index.html',
            './manifest.json',
            './tailwind-offline.css',
            './icons/school-logo.png',
            './icons/icon-192.png',
            './icons/icon-512.png',
            './js/auth/auth.js',
            './js/core/app.js',
            './js/platform/bootstrap.js',
            './features/backup/backup-core.js',
            './features/lps/lps.js',
            './features/gadm/gadm.html',
            './features/gadm/gadm.css',
            './features/gadm/gadm-kb.js',
            './features/gadm/gadm-engine.js',
            './features/gadm/gadm-storage.js',
            './features/gadm/gadm.js'
        ];

        for (const asset of requiredPrecache) {
            assert(swSource.includes(`'${asset}'`), `SW precache includes: ${asset}`);
        }

        // ============================================================
        // 8. INDEX.HTML — Chat Integration
        // ============================================================
        section('8. INDEX.HTML — Chat Role Guard');

        const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

        assert(!/chat/i.test(indexSource), 'Chat access absent from desktop and mobile shell');

        // ============================================================
        // FINAL REPORT
        // ============================================================
        section('FINAL REPORT');

        console.log(`\n  PASS : ${passed}`);
        console.log(`  FAIL : ${failed}`);

        if (failures.length) {
            console.log('\n  FAILURES:');
            failures.forEach(f => console.log(`    - ${f}`));
        }

        console.log(`\n  RUNTIME SANDBOX TEST : ${failed === 0 ? 'PASS' : 'FAIL'}\n`);
        process.exit(failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n  FATAL ERROR during test execution:', error);
        process.exit(2);
    }
})();
