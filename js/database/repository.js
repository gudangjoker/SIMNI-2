// ==========================================
// FILE: js/database/repository.js
// FUNGSI:
// Workspace-aware boundary operasi Realtime Database SIMNI.
// Semua write client harus melewati logical-path resolver.
// Operasi privileged/destructive dialihkan ke backend server-authoritative.
// ==========================================

import { commitAdministrativeOperation, getGlobalRolloverOverview } from '../services/edge-service.js';

import {
    ref,
    get,
    set,
    update,
    remove,
    runTransaction,
    query,
    orderByKey,
    limitToFirst,
    limitToLast,
    startAt,
    endBefore
} from '../../vendor/firebase/firebase-database.js';

import { runtime } from './firebase-client.js';

import {
    database,
    auth
} from './firebase-client.js';

import {
    getAccessContext,
    assertLogicalPath,
    assertFeature
} from '../auth/access-context.js';

const paths =
    window.SIMNIWorkspacePaths;

const OWNER_EMAIL =
    'unggaran.sditbm@gmail.com';

if (!paths) {
    throw new Error(
        'Workspace path resolver belum dimuat.'
    );
}

const BAD_SYNC_STATUSES =
    new Set([
        'idle',
        'loading',
        'partial',
        'degraded',
        'failed',
        'stopped'
    ]);

function currentAccess() {
    const access =
        getAccessContext();

    if (
        !access?.uid ||
        !access?.role ||
        !access?.workspaceId ||
        !access?.classId ||
        !access?.activeAcademicYearId
    ) {
        throw new Error(
            'Access context database belum lengkap.'
        );
    }

    return access;
}

function resolve(path, action = 'read') {
    assertLogicalPath(
        path, action
    );

    return paths.resolveLogicalPath(
        path,
        currentAccess()
    );
}

function databaseTargetIsEmulator() {
    return (
        window
            .SIMNIDatabaseTarget
            ?.mode ===
        'emulator'
    );
}

function databaseReference(path = '') {
    const normalizedPath = String(path ?? '').trim();
    return normalizedPath ? ref(database, normalizedPath) : ref(database);
}

function readDatabase(path = '') {
    return get(databaseReference(path));
}

function setDatabase(path, value) {
    return set(databaseReference(path), value);
}

function updateDatabase(path, values) {
    return update(databaseReference(path), values);
}

function removeDatabase(path) {
    return remove(databaseReference(path));
}

function assertOnlineForWrite() {
    if (
        !navigator.onLine &&
        !databaseTargetIsEmulator()
    ) {
        throw new Error(
            'Aplikasi offline. Penulisan ditahan sampai koneksi Firebase kembali.'
        );
    }
}

function requiredBindingHealthIsReady(
    sync
) {
    if (
        !sync?.bindings ||
        typeof sync.bindings !==
            'object'
    ) {
        return null;
    }

    const required =
        Object.values(
            sync.bindings
        ).filter(
            (binding) =>
                binding?.required ===
                true
        );

    if (!required.length) {
        return null;
    }

    return required.every(
        (binding) =>
            binding?.status ===
            'ready'
    );
}

function assertWritableState() {
    currentAccess();
    assertOnlineForWrite();

    const sync =
        window.SIMNISyncState;
    if (sync?.connected === false) throw new Error('Koneksi Firebase terputus. Isian dipertahankan; simpan lagi setelah tersambung.');

    if (!sync) {
        throw new Error(
            'Status sinkronisasi database belum tersedia. Penulisan ditahan.'
        );
    }

    const bindingReady =
        requiredBindingHealthIsReady(
            sync
        );

    if (
        bindingReady ===
        false
    ) {
        throw new Error(
            `Sinkronisasi belum siap: ${Object.values(sync.bindings || {}).filter(binding => binding.required && binding.status !== 'ready').map(binding => `${binding.logicalPath} (${binding.status}${binding.error ? ': ' + (binding.error.message || binding.error) : ''})`).join(', ')}. Penulisan ditahan; tunggu koneksi pulih.`
        );
    }

    if (
        bindingReady ===
        true
    ) {
        if (
            sync.status !== 'ready' &&
            sync.status !== 'synced' &&
            !sync.initialComplete &&
            !sync.hasHydratedCache
        ) {
            throw new Error(
                `Sinkronisasi database belum READY (${sync.status || 'unknown'}). Penulisan ditahan.`
            );
        }

        return;
    }

    if (
        sync.status === 'ready' ||
        sync.status === 'synced' ||
        (sync.hasHydratedCache && !['failed', 'stopped'].includes(sync.status))
    ) {
        return;
    }

    throw new Error(
        `Sinkronisasi database belum sehat (${sync.status || 'unknown'}). Penulisan ditahan agar state parsial tidak menimpa Firebase.`
    );
}

function normalizeError(
    error,
    fallback
) {
    if (
        error instanceof Error
    ) {
        return error;
    }

    return new Error(
        String(
            error ||
            fallback ||
            'Operasi database gagal.'
        )
    );
}

function successfulResult(
    extra = {}
) {
    return {
        ok: true,
        ...extra
    };
}

function failedResult(
    error
) {
    return {
        ok: false,
        error:
            normalizeError(
                error
            )
    };
}

function requireHashCore() {
    const core = window.SIMNIBackupCore;
    if (!core || typeof core.sha256 !== 'function') {
        throw new Error('Backup core SHA-256 belum tersedia.');
    }
    return core;
}

function cleanClassId(value, label = 'Kelas') {
    const classId = String(value || '').trim().toUpperCase();
    if (!/^[1-6][A-Z]$/.test(classId)) throw new Error(`${label} harus memakai format 1A sampai 6Z.`);
    return classId;
}

function cleanAcademicYear(value) {
    const year = String(value || '').trim();
    const match = /^(\d{4})-(\d{4})$/.exec(year);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
        throw new Error('Tahun pelajaran harus berformat YYYY-YYYY dan berurutan.');
    }
    return year;
}

function safeArchiveId(value) {
    const text =
        String(
            value || ''
        ).trim();

    if (
        !text ||
        /[.#$\[\]\/]/.test(
            text
        )
    ) {
        throw new Error(
            'archiveId tidak valid.'
        );
    }

    return text;
}

function archiveBasePath() {
    assertFeature(
        'archive'
    );

    const access =
        currentAccess();

    return (
        `workspaces/${access.workspaceId}` +
        `/archives/${access.activeAcademicYearId}`
    );
}

function archivePhysicalPath(
    archiveId
) {
    return (
        `${archiveBasePath()}` +
        `/${safeArchiveId(
            archiveId
        )}`
    );
}

function normalizeArchiveCompatibility(
    archive
) {
    if (
        !archive ||
        typeof archive !==
            'object'
    ) {
        return archive;
    }

    if (archive.databaseEncoding === 'json-chunks-v1' && archive.database) {
        const chunks = Object.values(archive.database.chunks || {});
        if (!chunks.length || chunks.some(chunk => typeof chunk !== 'string') || chunks.reduce((n, chunk) => n + chunk.length, 0) > 25 * 1024 * 1024) throw new Error('Encoding arsip cloud tidak valid.');
        archive = { ...archive, database: JSON.parse(chunks.join('')) };
        delete archive.databaseEncoding;
    }

    return {
        ...archive,

        scope: {
            uid:
                archive.createdBy ||
                null,

            role:
                archive.role ||
                null,

            workspaceId:
                archive.workspaceId ||
                null,

            classId:
                archive.classId ||
                null,

            academicYearId:
                archive.academicYearId ||
                null
        },

        summary:
            archive.summary ||
            archive.counts ||
            {}
    };
}

async function readAnnualArchive(
    archiveId
) {
    const physicalPath =
        archivePhysicalPath(
            archiveId
        );

    let snapshot;
        snapshot = await readDatabase(physicalPath);

    return {
        value:
            snapshot.exists()
                ? normalizeArchiveCompatibility(
                    snapshot.val()
                )
                : null,

        physicalPath
    };
}

function mappedPhysicalUpdates(
    logicalUpdates
) {
    if (
        !logicalUpdates ||
        typeof logicalUpdates !==
            'object' ||
        Array.isArray(
            logicalUpdates
        )
    ) {
        throw new Error(
            'Payload update tidak valid.'
        );
    }

    const entries =
        Object.entries(
            logicalUpdates
        );

    if (!entries.length) {
        throw new Error(
            'Payload update kosong.'
        );
    }

    const mapped =
        {};

    for (
        const [
            logicalPath,
            value
        ]
        of entries
    ) {
        assertLogicalPath(logicalPath, 'manage');
        const physicalPath =
            resolve(
                logicalPath
            );

        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    mapped,
                    physicalPath
                )
        ) {
            throw new Error(
                `Dua logical path menghasilkan physical path yang sama: ${physicalPath}`
            );
        }

        mapped[
            physicalPath
        ] = value;
    }

    assertNoUpdatePathCollision(
        Object.keys(
            mapped
        )
    );

    return mapped;
}

function assertNoUpdatePathCollision(
    physicalPaths
) {
    const normalized =
        physicalPaths
            .map(
                (path) =>
                    String(
                        path
                    )
                        .replace(
                            /^\/+|\/+$/g,
                            ''
                        )
            )
            .sort();

    for (
        let index = 0;
        index <
        normalized.length;
        index += 1
    ) {
        const current =
            normalized[index];

        if (!current) {
            throw new Error(
                'Update ke root Firebase tidak diizinkan dari repository client.'
            );
        }

        for (
            let nextIndex =
                index + 1;
            nextIndex <
            normalized.length;
            nextIndex += 1
        ) {
            const candidate =
                normalized[
                    nextIndex
                ];

            if (
                candidate ===
                current
            ) {
                throw new Error(
                    `Duplicate update path terdeteksi: ${current}`
                );
            }

            if (
                candidate.startsWith(
                    `${current}/`
                )
            ) {
                throw new Error(
                    `Update path bertabrakan antara parent dan child: ${current} <> ${candidate}`
                );
            }

            if (
                !candidate.startsWith(
                    current
                )
            ) {
                break;
            }
        }
    }
}

export function resolveDatabasePath(
    logicalPath
) {
    return resolve(
        logicalPath
    );
}

export async function dbSet(
    logicalPath,
    value
) {
    try {
        assertWritableState();
        assertLogicalPath(logicalPath, 'manage');

        const physicalPath =
            resolve(
                logicalPath
            );

        await setDatabase(physicalPath, value);

        return successfulResult({
            physicalPath
        });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbUpdate(
    logicalUpdates
) {
    try {
        assertWritableState();

        const mapped =
            mappedPhysicalUpdates(
                logicalUpdates
            );

        await updateDatabase('', mapped);

        return successfulResult({
            paths:
                Object.keys(
                    mapped
                )
        });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbAuditedUpdate(action, targetId, logicalUpdates) {
    try {
        assertWritableState();
        if (!['backup_restore', 'annual_reset'].includes(action)) throw new Error('Aksi administratif tidak valid.');
        assertFeature(action === 'backup_restore' ? 'backup' : 'reset');
        mappedPhysicalUpdates(logicalUpdates); // Validate local path/scope before any request.
        const access = currentAccess();
        const result = await commitAdministrativeOperation({ action, targetId, expectedYear: access.activeAcademicYearId, updates: logicalUpdates });
        return successfulResult({ receipt: result.receipt, replayed: result.replayed });
    } catch (error) { return failedResult(error); }
}

window.dbAuditedUpdate = dbAuditedUpdate;

export async function dbRemove(
    logicalPath
) {
    try {
        assertWritableState();
        assertLogicalPath(logicalPath, 'manage');

        const physicalPath =
            resolve(
                logicalPath
            );

        await removeDatabase(physicalPath);

        return successfulResult({
            physicalPath
        });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

// Compare only the edited records, atomically. Unrelated slots are preserved.
export async function dbCompareRecords(logicalRoot, changes, expected) {
    try {
        assertWritableState();
        assertLogicalPath(logicalRoot, 'manage');
        if (!['Jadwal', 'Jurnal'].includes(logicalRoot)) throw new Error('Koleksi transaksi tidak diizinkan.');
        const physicalPath = resolve(logicalRoot);
        const keys = Object.keys(changes);
        if (!keys.length || keys.some(key => /[.#$\[\]\/]/.test(key) || !Object.hasOwn(expected, key))) throw new Error('Kontrak transaksi tidak lengkap.');
        const transaction = await runTransaction(databaseReference(physicalPath), current => {
            const source = current || {};
            for (const key of keys) {
                const baseline = expected[key];
                const actual = source[key] ?? null;
                if (baseline === null ? actual !== null : (!actual || Object.entries(baseline).some(([field, value]) => (actual[field] ?? '') !== value))) return;
            }
            const next = { ...source };
            for (const key of keys) {
                if (changes[key] === null) delete next[key];
                else next[key] = changes[key];
            }
            return next;
        }, { applyLocally: false });
        if (!transaction.committed) throw new Error('Data ini telah berubah di perangkat lain. Buka ulang setelah menyalin isian Anda.');
        return successfulResult({ physicalPath });
    } catch (error) { return failedResult(error); }
}

export async function dbGet(
    logicalPath
) {
    try {
        const physicalPath =
            resolve(
                logicalPath
            );

        const snapshot = await readDatabase(physicalPath);

        return successfulResult({
            value:
                snapshot.val(),

            exists:
                snapshot.exists(),

            physicalPath
        });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbFetchPagedCollection(logicalPath, {
    pageSize = 2000,
    cursor = null
} = {}) {
    try {
        const physicalPath = resolve(logicalPath);
        const pagedModule = window.SIMNIPagedQuery;
        if (!pagedModule) throw new Error('Modul paged query belum dimuat.');

        const dbRefFn = (path, opts) => {
            const constraints = [orderByKey(), limitToFirst(opts.limit)];
            if (opts.cursor) constraints.push(startAt(opts.cursor));
            return query(databaseReference(path), ...constraints);
        };

        const result = await pagedModule.fetchPagedQuery(dbRefFn, physicalPath, {
            pageSize,
            cursor,
            getFn: (ref) => get(ref)
        });

        return successfulResult(result);
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbFetchCompleteCollection(logicalPath, {
    pageSize = 2000,
    maxRecords = 100000,
    onProgress = null
} = {}) {
    try {
        const physicalPath = resolve(logicalPath);
        const pagedModule = window.SIMNIPagedQuery;
        if (!pagedModule) throw new Error('Modul paged query belum dimuat.');

        const dbRefFn = (path, opts) => {
            const constraints = [orderByKey(), limitToFirst(opts.limit)];
            if (opts.cursor) constraints.push(startAt(opts.cursor));
            return query(databaseReference(path), ...constraints);
        };

        const result = await pagedModule.fetchCompleteCollectionPaged(dbRefFn, physicalPath, {
            pageSize,
            maxRecords,
            onProgress,
            getFn: (ref) => get(ref)
        });

        return successfulResult(result);
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbGetAnnualArchives({ before = null, metadataOnly = false } = {}) {
    try {
        assertFeature(
            'archive'
        );

        const access = currentAccess();
        const physicalPath = metadataOnly
            ? `workspaces/${access.workspaceId}/archives/_index/${access.activeAcademicYearId}`
            : archiveBasePath();
        const pageSize = metadataOnly ? 20 : 1;
        const constraints = [orderByKey(), limitToLast(pageSize)];
        if (before) constraints.push(endBefore(safeArchiveId(before)));
        const snapshot = await get(query(databaseReference(physicalPath), ...constraints));

        const raw =
            snapshot.val() ||
            {};

        const value =
            Object.fromEntries(
                Object.entries(
                    raw
                ).map(
                    ([
                        archiveId,
                        archive
                    ]) => [
                        archiveId,
                        normalizeArchiveCompatibility(
                            archive
                        )
                    ]
                )
            );

        return successfulResult({
            value,
            physicalPath,
            nextCursor: Object.keys(value).length === pageSize ? Object.keys(value).sort()[0] : null,
            metadataOnly
        });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbCreateAnnualArchive() {
    try {
        assertWritableState();
        assertFeature(
            'archive'
        );

        if (typeof window.SIMNIArchive?.createAnnualArchiveCloud !== 'function') {
            throw new Error('Modul arsip tahunan belum siap.');
        }
        const response = await window.SIMNIArchive.createAnnualArchiveCloud();
        if (response?.ok !== true) throw response?.error || new Error('Pembuatan arsip gagal.');
        return response;
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbGetAnnualArchiveStatus() {
    try {
        assertFeature(
            'archive'
        );

        const archives = await dbGetAnnualArchives({ metadataOnly: true });
        if (!archives.ok) throw archives.error;
        const verified = Object.values(archives.value || {}).filter((item) => item?.verified === true);
        verified.sort((left, right) => String(right.verifiedAt || right.createdAt || '').localeCompare(String(left.verifiedAt || left.createdAt || '')));
        return successfulResult({ count: verified.length, latest: verified[0] || null,
            partial: Boolean(archives.nextCursor), nextCursor: archives.nextCursor,
            legacyUnindexed: true });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbPerformAnnualReset({
    scopeKey,
    archiveId,
    confirmation
}) {
    try {
        assertWritableState();
        assertFeature(
            'reset'
        );

        void archiveId;
        void confirmation;
        if (typeof window.SIMNIReset?.performReset !== 'function') throw new Error('Modul reset belum siap.');
        const response = await window.SIMNIReset.performReset(scopeKey);
        if (response?.ok !== true) throw response?.error || new Error('Reset tahunan ditolak.');
        return successfulResult(response);
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbVerifyRestoreSnapshot({
    expectedHash,
    backupId = ''
}) {
    try {
        assertWritableState();
        assertFeature(
            'backup'
        );

        const normalizedHash =
            String(
                expectedHash || ''
            )
                .trim()
                .toLowerCase();

        if (
            !/^[a-f0-9]{64}$/.test(
                normalizedHash
            )
        ) {
            throw new Error(
                'Hash restore harus SHA-256 64 karakter hex.'
            );
        }

        if (typeof window.SIMNIBackup?.buildCurrentEnvelope !== 'function') throw new Error('Modul backup belum siap.');
        const envelope = await window.SIMNIBackup.buildCurrentEnvelope();
        const actualHash = String(envelope?.integrity?.hash || '').toLowerCase();
        if (actualHash !== normalizedHash) throw new Error('Hash snapshot pasca-restore tidak cocok.');
        return successfulResult({ verified: true, expectedHash: normalizedHash, actualHash, backupId });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbPutAnnualArchive(
    archiveId,
    payload = {}
) {
    try {
        assertWritableState();
        assertFeature('archive');
        const safeId = safeArchiveId(archiveId);
        const access = currentAccess();
        const hash = String(payload?.integrity?.hash || '').trim().toLowerCase();
        const scope = payload?.scope || {};
        if (payload?.archiveId !== safeId || !/^[a-f0-9]{64}$/.test(hash)) {
            throw new Error('Payload arsip atau hash SHA-256 tidak valid.');
        }
        if (scope.workspaceId !== access.workspaceId || scope.classId !== access.classId ||
            scope.academicYearId !== access.activeAcademicYearId || scope.role !== access.role) {
            throw new Error('Scope payload arsip tidak cocok dengan sesi aktif.');
        }
        if (!payload.database || typeof payload.database !== 'object' || Array.isArray(payload.database)) {
            throw new Error('Snapshot database arsip tidak valid.');
        }
        const physicalPath = archivePhysicalPath(safeId);
        const stored = {
            ...payload,
            archiveId: safeId,
            authority: 'owner-client-sha256',
            workspaceId: access.workspaceId,
            classId: access.classId,
            academicYearId: access.activeAcademicYearId,
            role: access.role,
            createdBy: access.uid
        };
        const serializedBytes = new TextEncoder().encode(JSON.stringify(stored)).byteLength;
        const maxArchiveBytes = window.SIMNIBackupCore?.MAX_FILE_BYTES || (25 * 1024 * 1024);
        if (serializedBytes > maxArchiveBytes) {
            throw new Error(`Arsip melebihi ${Math.round(maxArchiveBytes / (1024 * 1024))} MiB. Gunakan ekspor JSON lokal sebelum meninjau retensi.`);
        }
        const { database: _snapshot, ...metadata } = stored;
        const archiveRoot = `workspaces/${access.workspaceId}/archives`;
        const indexReference = databaseReference(`${archiveRoot}/_index/${access.activeAcademicYearId}`);
        const reservation = await runTransaction(indexReference, current => {
            const index = { ...(current || {}) };
            const others = Object.entries(index).filter(([id]) => id !== safeId);
            const bytes = others.reduce((sum, [, item]) => sum + Number(item.snapshotBytes || 0), serializedBytes);
            if (others.length >= 20 || bytes > 128 * 1024 * 1024) return;
            index[safeId] = { ...metadata, verified: index[safeId]?.verified === true,
                pending: true, reservedAt: Date.now(), snapshotBytes: serializedBytes };
            return index;
        }, { applyLocally: false });
        if (!reservation.committed) throw new Error('Batas arsip tercapai (20 versi / 128 MiB per tahun). Ekspor dan verifikasi arsip lama melalui Pengelolaan Arsip sebelum menghapus versi pilihan.');
        if (access.uid !== currentAccess().uid || access.workspaceId !== currentAccess().workspaceId ||
            access.activeAcademicYearId !== currentAccess().activeAcademicYearId) throw new Error('Sesi berubah sebelum arsip ditulis.');
        const operation = await commitAdministrativeOperation({ action: 'annual_archive', targetId: safeId, expectedYear: access.activeAcademicYearId, archive: stored });
        const readBack = await readAnnualArchive(safeId);
        if (!readBack.value || readBack.value.integrity?.hash !== hash) {
            throw new Error('Read-back arsip gagal diverifikasi.');
        }
        return successfulResult({ archiveId: safeId, value: readBack.value, physicalPath, receipt: operation.receipt });
    } catch (error) {
        return failedResult(
            error
        );
    }
}

export async function dbExportAnnualArchive(id) {
    try {
        assertFeature('archive');
        assertFeature('archive', 'export');
        const result = await readAnnualArchive(safeArchiveId(id));
        if (!result.value) throw new Error('Arsip tidak ditemukan.');
        return successfulResult(result);
    } catch (error) { return failedResult(error); }
}

export async function dbDeleteAnnualArchiveAfterVerification(id, exportedArchive) {
    try {
        assertWritableState(); assertFeature('archive', 'manage');
        const safeId = safeArchiveId(id);
        const access = { ...currentAccess() };
        const result = await readAnnualArchive(safeId);
        const expected = result.value;
        if (!expected || exportedArchive?.archiveId !== safeId ||
            JSON.stringify(exportedArchive) !== JSON.stringify(expected)) throw new Error('Berkas ekspor tidak cocok dengan arsip cloud. Arsip dipertahankan.');
        const verified = await window.SIMNIArchive?.verifyAnnualArchive(exportedArchive, { requireCurrentScope: true, requireCurrentHash: false });
        if (!verified?.ok) throw new Error('Hash/scope berkas arsip tidak lolos verifikasi.');
        const current = await window.SIMNIBackup?.buildCurrentEnvelope();
        if (!current?.integrity?.hash || current.integrity.hash === expected.integrity?.hash) throw new Error('Arsip snapshot aktif dipertahankan untuk pemulihan dan reset.');
        if (access.uid !== currentAccess().uid || access.workspaceId !== currentAccess().workspaceId || access.activeAcademicYearId !== currentAccess().activeAcademicYearId) throw new Error('Sesi berubah.');
        const expectedText = JSON.stringify(expected);
        const deleted = await runTransaction(databaseReference(archivePhysicalPath(safeId)), value => {
            if (JSON.stringify(normalizeArchiveCompatibility(value)) !== expectedText) return;
            return null;
        }, { applyLocally: false });
        if (!deleted.committed) throw new Error('Arsip berubah selama verifikasi; tidak dihapus.');
        await removeDatabase(`workspaces/${access.workspaceId}/archives/_index/${access.activeAcademicYearId}/${safeId}`);
        return successfulResult({ deleted: true, archiveId: safeId });
    } catch (error) { return failedResult(error); }
}

window.dbExportAnnualArchive = dbExportAnnualArchive;
window.dbDeleteAnnualArchiveAfterVerification = dbDeleteAnnualArchiveAfterVerification;
window.dbRepairAnnualArchiveReservation = async function (id) {
    try {
        assertWritableState(); assertFeature('archive', 'manage');
        const safeId = safeArchiveId(id);
        const access = { ...currentAccess() };
        const indexPath = `workspaces/${access.workspaceId}/archives/_index/${access.activeAcademicYearId}/${safeId}`;
        const metadata = (await readDatabase(indexPath)).val();
        if (!metadata?.pending) return successfulResult({ repaired: false });
        const archived = (await readAnnualArchive(safeId)).value;
        let replacement = null;
        if (archived) {
            const { database: _snapshot, ...header } = archived;
            replacement = { ...header, snapshotBytes: new TextEncoder().encode(JSON.stringify(archived)).byteLength };
        } else if (Date.now() - Number(metadata.reservedAt || Date.parse(metadata.createdAt || '') || Date.now()) < 3600000) {
            throw new Error('Reservasi masih baru. Tunggu satu jam sebelum memeriksa ulang proses yang terputus.');
        }
        if (access.uid !== currentAccess().uid || access.workspaceId !== currentAccess().workspaceId || access.activeAcademicYearId !== currentAccess().activeAcademicYearId) throw new Error('Sesi berubah.');
        const expected = JSON.stringify(metadata);
        const result = await runTransaction(databaseReference(indexPath), current => JSON.stringify(current) === expected ? replacement : undefined, { applyLocally: false });
        if (!result.committed) throw new Error('Reservasi berubah; muat ulang daftar arsip.');
        return successfulResult({ repaired: true });
    } catch (error) { return failedResult(error); }
};


export async function dbMarkRolloverArchiveReady(envelope) {
    try {
        const access = currentAccess();
        if (!window.SIMNIAccessPolicy?.hasFeature?.(access.role, window.SIMNIAccessPolicy.FEATURES.ARCHIVE)) {
            throw new Error('Role aktif tidak memiliki izin arsip tahunan.');
        }
        window.SIMNIAccessPolicy?.validateProfile?.({ ...access, status: 'active' }, access.uid);
        const core = requireHashCore();
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
        const yearId = cleanAcademicYear(access.activeAcademicYearId);
        const hash = String(envelope.integrity?.hash || '').toLowerCase();
        const payload = {
            uid: access.uid,
            email: String(access.email || '').toLowerCase(),
            role: access.role,
            workspaceId: access.workspaceId,
            classId: access.classId,
            academicYearId: yearId,
            archiveHash: hash,
            archiveFilename: String(envelope?.filename || '').slice(0, 180),
            assignmentRevision: Number(access.assignmentRevision || 1),
            verified: true,
            verifiedAt: new Date().toISOString()
        };
        // Export verification is local evidence only. It never authorizes server deletion.
        return successfulResult({ value: {...payload, authority: 'local-export-verification', authorizesDeletion: false} });
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbGetRolloverOverview() {
    try {
        const access = currentAccess();
        if (access.role !== 'superuser' || String(access.email || '').toLowerCase() !== OWNER_EMAIL) {
            throw new Error('Overview rollover hanya tersedia untuk owner SIMNI.');
        }
        const result = await getGlobalRolloverOverview();
        return successfulResult(result);
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbCommitAcademicYearRollover() {
    return failedResult(new Error('Gunakan Kelola Akun & Penugasan > Tahun Ajaran. Data tahun lama dipertahankan.'));
}


export function getCurrentUserMeta() {
    const user =
        auth.currentUser;

    let access =
        null;

    try {
        access =
            getAccessContext();
    } catch (_) {
        access =
            null;
    }

    if (!user) {
        return {
            uid: null,
            email: null,
            role: null,
            workspaceId: null,
            classId: null,
            activeAcademicYearId: null
        };
    }

    return {
        uid:
            user.uid,

        email:
            user.email ||
            null,

        role:
            access?.role ||
            null,

        workspaceId:
            access?.workspaceId ||
            null,

        classId:
            access?.classId ||
            null,

        activeAcademicYearId:
            access
                ?.activeAcademicYearId ||
            null
    };
}

export async function dbRecordAuthoritativeAudit() {
    // Compatibility only: browser-authored committed receipts are forbidden.
    return failedResult(new Error('Audit hanya diterbitkan oleh operasi server. Gunakan receipt hasil operasi administratif.'));
}

export async function logSIMNIAuditEvent(action, targetId = '', details = {}, options = {}) {
    return dbRecordAuthoritativeAudit(action, targetId, details, options);
}

const SIMNIRepository =
    Object.freeze({
        dbCompareRecords,
        resolveDatabasePath,

        dbSet,
        dbUpdate,
        dbAuditedUpdate,
        dbRemove,
        dbGet,
        dbFetchPagedCollection,
        dbFetchCompleteCollection,

        dbGetAnnualArchives,
        dbCreateAnnualArchive,
        dbGetAnnualArchiveStatus,
        dbPerformAnnualReset,
        dbVerifyRestoreSnapshot,

        dbPutAnnualArchive,
        dbMarkRolloverArchiveReady,
        dbGetRolloverOverview,
        dbCommitAcademicYearRollover,

        dbRecordAuthoritativeAudit,
        logSIMNIAuditEvent,

        getCurrentUserMeta
    });

Object.assign(
    window,
    {
        dbCompareRecords,
        resolveDatabasePath,

        dbSet,
        dbUpdate,
        dbRemove,
        dbGet,
        dbFetchPagedCollection,
        dbFetchCompleteCollection,

        dbGetAnnualArchives,
        dbCreateAnnualArchive,
        dbGetAnnualArchiveStatus,
        dbPerformAnnualReset,
        dbVerifyRestoreSnapshot,

        dbPutAnnualArchive,
        dbMarkRolloverArchiveReady,
        dbGetRolloverOverview,
        dbCommitAcademicYearRollover,

        dbRecordAuthoritativeAudit,
        logSIMNIAuditEvent,

        getCurrentUserMeta,

        SIMNIRepository
    }
);

export default SIMNIRepository;
