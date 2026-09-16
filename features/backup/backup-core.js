(function initSIMNIBackupCore(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIBackupCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIBackupCore() {
    'use strict';

    const FORMAT = 'simni-pwa-backup';
    const VERSION = 5;
    const SCHEMA_VERSION = 3;
    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
    const APP_TOP_LEVELS = Object.freeze([
        'Pengaturan', 'Siswa', 'Presensi', 'Mapel_TP', 'Nilai_TP',
        'Dokumen', 'Catatan', 'Jurnal', 'Jadwal', 'Data_LPS', 'LPS'
    ]);
    const DATA_PATHS = Object.freeze([
        'Pengaturan/Identitas', 'Pengaturan/LPS_v2', 'Siswa', 'Presensi',
        'Mapel_TP', 'Nilai_TP', 'Dokumen', 'Catatan', 'Jurnal', 'Jadwal',
        'Data_LPS', 'LPS/Templates', 'LPS/Reports', 'LPS/Revisions'
    ]);

    const SUBSYSTEMS = Object.freeze({
        ACADEMIC: 'academic',
        GADM: 'gadm',
        CLOUDINARY: 'cloudinary',
        DRAFTS: 'drafts'
    });

    const SUBSYSTEM_RECOVERY_MANIFEST = Object.freeze({
        [SUBSYSTEMS.ACADEMIC]: Object.freeze({
            id: 'academic',
            name: 'Database Akademik & LPS',
            storageLocation: 'Firebase Realtime Database (RTDB)',
            scope: 'Workspace & Tahun Pelajaran',
            backupIncluded: true,
            coverage: 'full',
            backupMechanism: 'Ekspor JSON Backup SIMNI (Enkripsi SHA-256)',
            recoveryProcedure: 'Gunakan tombol Restore JSON pada menu Pengaturan. Hash integritas dan scope akun diverifikasi sebelum pemulihan ke database.'
        }),
        [SUBSYSTEMS.GADM]: Object.freeze({
            id: 'gadm',
            name: 'Dokumen Guru Administrasi Mengajar (GADM)',
            storageLocation: 'IndexedDB Lokal (simni-gadm-offline)',
            scope: 'UID, Workspace, Kelas, Tahun Pelajaran',
            backupIncluded: false,
            coverage: 'separate-local-subsystem',
            backupMechanism: 'Ekspor Dokumen Word (.doc), Excel (.xlsx), PDF (.pdf), atau Ekspor Snapshot Dokumen GADM',
            recoveryProcedure: 'Buka GADM -> Riwayat Dokumen untuk mengunduh arsip dokumen atau menyalin kembali dokumen yang telah diekspor ke Word/Excel.'
        }),
        [SUBSYSTEMS.CLOUDINARY]: Object.freeze({
            id: 'cloudinary',
            name: 'Berkas Fisik Dokumen & LKPD',
            storageLocation: 'Cloudinary CDN (Aset Media Luar)',
            scope: 'URL Eksternal per Dokumen',
            backupIncluded: false,
            coverage: 'metadata-only',
            backupMechanism: 'Penyimpanan CDN Cloudinary Terpisah',
            recoveryProcedure: 'Jika URL eksternal tidak dapat diakses atau file di Cloudinary terhapus, unggah ulang berkas PDF/gambar melalui menu Dokumen.'
        }),
        [SUBSYSTEMS.DRAFTS]: Object.freeze({
            id: 'drafts',
            name: 'Draf Formulir Belum Terkirim',
            storageLocation: 'IndexedDB Lokal (SIMNIDraftsDB)',
            scope: 'Perangkat Lokal, UID, Workspace, Kelas, Tanggal/TP',
            backupIncluded: false,
            coverage: 'ephemeral-local-unsent',
            backupMechanism: 'Persistensi Lokal Otomatis di Perangkat',
            recoveryProcedure: 'Buka formulir terkait (Presensi, Nilai, atau Jurnal) dan klik Simpan untuk mengirim data ke server sebelum membersihkan perangkat atau keluar.'
        })
    });

    function getSubsystemRecoveryManifest(access = null) {
        return {
            generatedAt: new Date().toISOString(),
            scope: access ? {
                uid: access.uid || null,
                role: access.role || null,
                workspaceId: access.workspaceId || null,
                classId: access.classId || null,
                academicYearId: access.activeAcademicYearId || null
            } : null,
            subsystems: deepClone(SUBSYSTEM_RECOVERY_MANIFEST),
            summary: {
                totalSubsystems: Object.keys(SUBSYSTEM_RECOVERY_MANIFEST).length,
                includedInAcademicBackup: ['academic'],
                separateOrExternalRecovery: ['gadm', 'cloudinary', 'drafts']
            }
        };
    }

    function deepClone(value) {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function sanitizeFirebaseKey(value, fallback = 'tanpa_id') {
        const normalized = String(value ?? '').trim().replace(/[.#$\/[\]]/g, '_');
        if (['__proto__', 'prototype', 'constructor'].includes(normalized)) return `safe_${normalized}`;
        return normalized || fallback;
    }

    function canonicalize(value) {
        if (Array.isArray(value)) return value.map(canonicalize);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().reduce((result, key) => {
                if (value[key] !== undefined && typeof value[key] !== 'function') result[key] = canonicalize(value[key]);
                return result;
            }, {});
        }
        return value;
    }

    function canonicalStringify(value) {
        return JSON.stringify(canonicalize(value));
    }

    async function sha256(value) {
        const input = typeof value === 'string' ? value : canonicalStringify(value);
        const cryptoObject = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
        if (!cryptoObject?.subtle || typeof TextEncoder === 'undefined') throw new Error('Web Crypto SHA-256 tidak tersedia pada browser ini.');
        const digest = await cryptoObject.subtle.digest('SHA-256', new TextEncoder().encode(input));
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function setAtPath(target, path, value) {
        const segments = String(path || '').split('/').filter(Boolean);
        if (!segments.length) return;
        let cursor = target;
        segments.forEach((segment, index) => {
            if (index === segments.length - 1) cursor[segment] = deepClone(value);
            else {
                if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) cursor[segment] = {};
                cursor = cursor[segment];
            }
        });
    }

    function getAtPath(source, path) {
        return String(path || '').split('/').filter(Boolean).reduce((value, segment) => value?.[segment], source);
    }

    function indexCollection(collection, keyBuilder) {
        if (!collection) return {};
        if (!Array.isArray(collection)) return deepClone(collection);
        return collection.reduce((result, item, index) => {
            if (!item || typeof item !== 'object') return result;
            const key = sanitizeFirebaseKey(keyBuilder(item, index), `item_${String(index + 1).padStart(4, '0')}`);
            result[key] = deepClone(item);
            return result;
        }, {});
    }

    function stateToDatabase(state = {}) {
        const safe = (value, fallback) => value === undefined || value === null ? fallback : value;
        return {
            Pengaturan: {
                Identitas: deepClone(safe(state.pengaturan, {})),
                LPS_v2: deepClone(safe(state.pengaturanLPS_v2, []))
            },
            Siswa: indexCollection(state.students, (item) => item.NISN),
            Presensi: indexCollection(state.presensi, (item) => `${item.Tanggal || 'tanpa_tanggal'}_${item.NISN || 'tanpa_nisn'}`),
            Mapel_TP: indexCollection(state.mapelTP, (item) => item.ID_mapel),
            Nilai_TP: indexCollection(state.nilaiTP, (item) => item.ID_Nilai || `${item.ID_Siswa || item.NISN || 'tanpa_siswa'}_${item.learningObjectiveId || item.Deskripsi_TP || 'tanpa_tp'}`),
            Dokumen: indexCollection(state.dokumen, (item, index) => item.ID_Dokumen || item.id || `dokumen_${index + 1}`),
            Catatan: indexCollection(state.catatan, (item, index) => item.ID_Catatan || item.id || `catatan_${index + 1}`),
            Jurnal: indexCollection(state.jurnal, (item, index) => item.ID_Jurnal || item.id || `jurnal_${index + 1}`),
            Jadwal: deepClone(safe(state.jadwal, [])),
            Data_LPS: indexCollection(state.dataLPS, (item, index) => item.ID_LPS || item.id || `lps_lama_${index + 1}`),
            LPS: {
                Templates: indexCollection(state.lpsTemplates, (item, index) => item.templateId || `template_${index + 1}`),
                Reports: indexCollection(state.lpsReports, (item, index) => item.reportId || `report_${index + 1}`),
                Revisions: {}
            }
        };
    }

    function normalizeKnownCollections(database) {
        const normalized = deepClone(database || {});
        if (Array.isArray(normalized.Siswa)) normalized.Siswa = indexCollection(normalized.Siswa, (item) => item.NISN);
        if (Array.isArray(normalized.Presensi)) normalized.Presensi = indexCollection(normalized.Presensi, (item) => `${item.Tanggal}_${item.NISN}`);
        if (Array.isArray(normalized.Mapel_TP)) normalized.Mapel_TP = indexCollection(normalized.Mapel_TP, (item) => item.ID_mapel);
        if (Array.isArray(normalized.Nilai_TP)) normalized.Nilai_TP = indexCollection(normalized.Nilai_TP, (item) => item.ID_Nilai || `${item.ID_Siswa || item.NISN}_${item.learningObjectiveId || item.Deskripsi_TP}`);
        if (Array.isArray(normalized.Dokumen)) normalized.Dokumen = indexCollection(normalized.Dokumen, (item, index) => item.ID_Dokumen || item.id || `dokumen_${index + 1}`);
        if (Array.isArray(normalized.Catatan)) normalized.Catatan = indexCollection(normalized.Catatan, (item, index) => item.ID_Catatan || item.id || `catatan_${index + 1}`);
        if (Array.isArray(normalized.Jurnal)) normalized.Jurnal = indexCollection(normalized.Jurnal, (item, index) => item.ID_Jurnal || item.id || `jurnal_${index + 1}`);
        if (Array.isArray(normalized.Data_LPS)) normalized.Data_LPS = indexCollection(normalized.Data_LPS, (item, index) => item.ID_LPS || item.id || `lps_lama_${index + 1}`);
        if (Array.isArray(normalized.LPS?.Templates)) normalized.LPS.Templates = indexCollection(normalized.LPS.Templates, (item, index) => item.templateId || `template_${index + 1}`);
        if (Array.isArray(normalized.LPS?.Reports)) normalized.LPS.Reports = indexCollection(normalized.LPS.Reports, (item, index) => item.reportId || `report_${index + 1}`);
        return normalized;
    }

    function filterAllowedDatabase(database) {
        if (!database || typeof database !== 'object' || Array.isArray(database)) throw new Error('Isi database pada backup tidak valid.');
        const filtered = {};
        APP_TOP_LEVELS.forEach((key) => {
            if (database[key] !== undefined) filtered[key] = deepClone(database[key]);
        });
        if (!Object.keys(filtered).length) throw new Error('Backup tidak memuat kelompok data SIMNI yang dikenali.');
        return normalizeKnownCollections(filtered);
    }

    function isLegacyState(value) {
        return !!value && typeof value === 'object' && (
            'students' in value || 'pengaturan' in value || 'presensi' in value || 'nilaiTP' in value
        );
    }

    function extractDatabase(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Berkas JSON tidak valid.');
        if (parsed.format === FORMAT) return filterAllowedDatabase(parsed.database);
        if (isLegacyState(parsed)) return filterAllowedDatabase(stateToDatabase(parsed));
        return filterAllowedDatabase(parsed);
    }

    async function createEnvelope(database, metadata = {}) {
        const cleanDatabase = filterAllowedDatabase(database);
        const hash = await sha256(cleanDatabase);
        return {
            format: FORMAT,
            version: VERSION,
            schemaVersion: Number(metadata.schemaVersion || SCHEMA_VERSION),
            appVersion: metadata.appVersion || (typeof globalThis !== 'undefined' ? globalThis.SIMNI_APP_VERSION : null) || null,
            createdAt: metadata.createdAt || new Date().toISOString(),
            app: metadata.app || 'SIMNI PWA',
            projectId: metadata.projectId || null,
            academicYear: metadata.academicYear || null,
            className: metadata.className || null,
            createdBy: metadata.createdBy || null,
            scope: {
                uid: metadata.scope?.uid || metadata.createdBy?.uid || null,
                role: metadata.scope?.role || metadata.createdBy?.role || null,
                workspaceId: metadata.scope?.workspaceId || metadata.createdBy?.workspaceId || null,
                classId: metadata.scope?.classId || metadata.createdBy?.classId || null,
                academicYearId: metadata.scope?.academicYearId || metadata.createdBy?.activeAcademicYearId || null
            },
            source: metadata.source || 'unknown',
            incompletePaths: Array.isArray(metadata.incompletePaths) ? [...new Set(metadata.incompletePaths)] : [],
            completeness: { complete: !(Array.isArray(metadata.incompletePaths) && metadata.incompletePaths.length), requiredPathCount: DATA_PATHS.length },
            recoveryCoverage: {
                academicDatabase: 'full',
                lpsTemplatesAndReports: 'full',
                documents: 'metadata-only',
                gadm: 'separate-local-subsystem',
                drafts: 'ephemeral-local-unsent',
                manifest: deepClone(SUBSYSTEM_RECOVERY_MANIFEST),
                note: 'File fisik Cloudinary tidak tertanam di JSON backup SIMNI.'
            },
            counts: Object.fromEntries(summarizeDatabase(cleanDatabase).map((entry) => [entry.path, entry.count])),
            database: cleanDatabase,
            integrity: { algorithm: 'SHA-256', hash }
        };
    }

    async function verifyEnvelope(envelope) {
        if (!envelope || envelope.format !== FORMAT) return { ok: false, legacy: true, reason: 'legacy-or-unknown-format' };
        if (Number(envelope.version) > VERSION) throw new Error(`Versi backup ${envelope.version} lebih baru daripada aplikasi ini.`);
        if (Number(envelope.schemaVersion || 1) > SCHEMA_VERSION) throw new Error(`Schema backup ${envelope.schemaVersion} lebih baru daripada aplikasi ini.`);
        if (!envelope.integrity?.hash) return { ok: false, legacy: false, reason: 'missing-integrity-hash' };
        const actual = await sha256(filterAllowedDatabase(envelope.database));
        return { ok: actual === envelope.integrity.hash, expected: envelope.integrity.hash, actual, legacy: false };
    }

    function validateRestoreScope(envelope, access) {
        if (envelope?.completeness?.complete === false || (Array.isArray(envelope?.incompletePaths) && envelope.incompletePaths.length)) throw new Error(`Backup tidak lengkap; restore ditolak. Path belum terbaca: ${envelope.incompletePaths.join(', ')}`);
        if (!envelope || envelope.format !== FORMAT || Number(envelope.version) < 3) {
            throw new Error('Backup legacy belum memiliki scope workspace. Migrasikan backup sebelum restore.');
        }
        if (!access || access.status !== 'active') throw new Error('Access context aktif diperlukan untuk restore.');
        const scope = envelope.scope || {};
        const required = ['workspaceId', 'role', 'classId', 'academicYearId'];
        required.forEach((key) => {
            if (!String(scope[key] || '').trim()) throw new Error(`Backup tidak memiliki scope ${key}.`);
        });
        const legacyOwner = access.role === 'superuser' && access.email === 'unggaran.sditbm@gmail.com' && access.workspaceId === 'ws_kelas3a' && access.legacyOwnerWorkspace === 'ws_superuser' && scope.workspaceId === 'ws_superuser' && scope.role === 'superuser' && scope.classId === '3A';
        if (scope.workspaceId !== access.workspaceId && !legacyOwner) throw new Error('Backup berasal dari workspace berbeda. Restore ditolak.');
        if (scope.role !== access.role) throw new Error('Role backup tidak cocok dengan role akun aktif. Restore ditolak.');
        if (scope.classId !== access.classId) throw new Error('Kelas/scope backup tidak cocok dengan akun aktif. Restore ditolak.');
        if (scope.academicYearId !== access.activeAcademicYearId) throw new Error('Tahun pelajaran backup tidak sama dengan tahun aktif. Restore ditolak.');
        return { ok: true, scope: deepClone(scope) };
    }

    function filterDatabaseToPaths(database, allowedPaths = DATA_PATHS) {
        const clean = filterAllowedDatabase(database);
        const selected = {};
        allowedPaths.forEach((path) => {
            const value = getAtPath(clean, path);
            if (value !== undefined) setAtPath(selected, path, value);
        });
        return selected;
    }

    function countRecords(value) {
        if (value === undefined || value === null) return 0;
        if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).length;
        if (typeof value === 'object') return Object.keys(value).length;
        return 1;
    }

    function summarizeDatabase(database) {
        const clean = filterAllowedDatabase(database);
        return DATA_PATHS.map((path) => ({ path, count: countRecords(getAtPath(clean, path)) }))
            .filter((entry) => entry.count > 0);
    }

    function flattenForMerge(database, allowedPaths = DATA_PATHS) {
        const clean = filterDatabaseToPaths(database, allowedPaths);
        const updates = {};
        function walk(value, path) {
            if (Array.isArray(value) || value === null || typeof value !== 'object') {
                if (path && value !== undefined && value !== null) updates[path] = deepClone(value);
                return;
            }
            const entries = Object.entries(value);
            if (!entries.length) return;
            entries.forEach(([key, child]) => walk(child, path ? `${path}/${sanitizeFirebaseKey(key)}` : sanitizeFirebaseKey(key)));
        }
        walk(clean, '');
        return updates;
    }

    function buildReplaceUpdates(database, allowedPaths = DATA_PATHS) {
        const clean = filterAllowedDatabase(database);
        return allowedPaths.reduce((updates, path) => {
            const value = getAtPath(clean, path);
            updates[path] = value === undefined ? null : deepClone(value);
            return updates;
        }, {});
    }

    function safeFilenamePart(value, fallback) {
        const part = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
        return part || fallback;
    }

    function createFilename(metadata = {}, prefix = 'SIMNI_Backup') {
        const date = String(metadata.createdAt || new Date().toISOString()).slice(0, 10);
        return [
            safeFilenamePart(prefix, 'SIMNI_Backup'),
            safeFilenamePart(metadata.className, 'Kelas'),
            safeFilenamePart(metadata.academicYear, 'Tahun'),
            date
        ].join('_') + '.json';
    }

    return Object.freeze({
        FORMAT,
        VERSION,
        SCHEMA_VERSION,
        MAX_FILE_BYTES,
        MAX_IMPORT_BYTES,
        APP_TOP_LEVELS,
        DATA_PATHS,
        SUBSYSTEMS,
        SUBSYSTEM_RECOVERY_MANIFEST,
        getSubsystemRecoveryManifest,
        deepClone,
        sanitizeFirebaseKey,
        canonicalStringify,
        sha256,
        setAtPath,
        getAtPath,
        stateToDatabase,
        filterAllowedDatabase,
        extractDatabase,
        createEnvelope,
        verifyEnvelope,
        validateRestoreScope,
        filterDatabaseToPaths,
        summarizeDatabase,
        flattenForMerge,
        buildReplaceUpdates,
        createFilename
    });
}));
