// ==========================================
// FILE: js/database/repository.js
// FUNGSI:
// Workspace-aware boundary operasi Realtime Database SIMNI.
// Semua write client harus melewati logical-path resolver.
// Operasi privileged/destructive dialihkan ke backend server-authoritative.
// ==========================================

import {
    ref,
    get,
    set,
    update,
    remove
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

function resolve(path) {
    assertLogicalPath(
        path
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
    return ref(database, path);
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
            'Satu atau lebih binding Firebase wajib belum sehat. Penulisan ditahan untuk mencegah lost update.'
        );
    }

    if (
        bindingReady ===
        true
    ) {
        if (
            sync.status !==
            'ready'
        ) {
            throw new Error(
                `Sinkronisasi database belum READY (${sync.status || 'unknown'}). Penulisan ditahan.`
            );
        }

        return;
    }

    if (
        !sync.status ||
        BAD_SYNC_STATUSES.has(
            sync.status
        ) ||
        sync.status !==
            'ready'
    ) {
        throw new Error(
            `Sinkronisasi database belum sehat (${sync.status || 'unknown'}). Penulisan ditahan agar state parsial tidak menimpa Firebase.`
        );
    }
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

export async function dbRemove(
    logicalPath
) {
    try {
        assertWritableState();

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

export async function dbGetAnnualArchives() {
    try {
        assertFeature(
            'archive'
        );

        const physicalPath =
            archiveBasePath();

        const snapshot = await readDatabase(physicalPath);

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
            physicalPath
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

        const archives = await dbGetAnnualArchives();
        if (!archives.ok) throw archives.error;
        const verified = Object.values(archives.value || {}).filter((item) => item?.verified === true);
        verified.sort((left, right) => String(right.verifiedAt || right.createdAt || '').localeCompare(String(left.verifiedAt || left.createdAt || '')));
        return successfulResult({ count: verified.length, latest: verified[0] || null });
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
        await setDatabase(physicalPath, stored);
        const readBack = await readAnnualArchive(safeId);
        if (!readBack.value || readBack.value.integrity?.hash !== hash) {
            throw new Error('Read-back arsip gagal diverifikasi.');
        }
        return successfulResult({ archiveId: safeId, value: readBack.value, physicalPath });
    } catch (error) {
        return failedResult(
            error
        );
    }
}


export async function dbMarkRolloverArchiveReady(envelope) {
    try {
        const access = currentAccess();
        const canonicalWorkspace = window.SIMNIAccessPolicy?.ROLE_SCOPES?.[access.role]?.workspaceId;
        if (!canonicalWorkspace || access.workspaceId !== canonicalWorkspace) {
            throw new Error('Migrasi workspace wajib VERIFIED sebelum arsip dapat menjadi gate reset.');
        }
        const core = requireHashCore();
        const verification = await core.verifyEnvelope(envelope);
        if (!verification?.ok) throw new Error('Hash arsip JSON tidak valid.');
        core.validateRestoreScope(envelope, access);
        if (envelope?.completeness?.complete !== true || envelope?.incompletePaths?.length) {
            throw new Error('Arsip belum lengkap; readiness reset ditolak.');
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
            verified: true,
            verifiedAt: new Date().toISOString()
        };
        await setDatabase(`rollovers/${yearId}/readiness/${access.uid}`, payload);
        const readBack = await readDatabase(`rollovers/${yearId}/readiness/${access.uid}`);
        if (!readBack.exists() || readBack.val()?.archiveHash !== hash || readBack.val()?.verified !== true) {
            throw new Error('Read-back readiness arsip gagal.');
        }
        return successfulResult({ value: readBack.val() });
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbGetRolloverOverview() {
    try {
        const access = currentAccess();
        if (access.role !== 'superuser') throw new Error('Overview rollover hanya tersedia untuk Superuser.');
        const yearId = cleanAcademicYear(access.activeAcademicYearId);
        const [usersSnapshot, rolloverSnapshot] = await Promise.all([
            readDatabase('users'),
            readDatabase(`rollovers/${yearId}`)
        ]);
        return successfulResult({
            yearId,
            users: usersSnapshot.val() || {},
            rollover: rolloverSnapshot.val() || {}
        });
    } catch (error) {
        return failedResult(error);
    }
}

export async function dbCommitAcademicYearRollover({ nextYearId, superuserClassId }) {
    try {
        const access = currentAccess();
        if (access.role !== 'superuser' || access.email !== 'unggaran.sditbm@gmail.com' || access.workspaceId !== 'ws_superuser') {
            throw new Error('Commit tahun baru hanya tersedia untuk owner pada workspace canonical.');
        }
        assertOnlineForWrite();
        const currentYearId = cleanAcademicYear(access.activeAcademicYearId);
        const nextYear = cleanAcademicYear(nextYearId);
        const currentStart = Number(currentYearId.slice(0, 4));
        if (Number(nextYear.slice(0, 4)) !== currentStart + 1) {
            throw new Error('Tahun baru harus tepat satu periode setelah tahun aktif.');
        }
        const nextSuperClass = cleanClassId(superuserClassId, 'Kelas Superuser');

        const overview = await dbGetRolloverOverview();
        if (!overview.ok) throw overview.error;
        const profiles = Object.values(overview.users || {});
        const byEmail = new Map(profiles.map((profile) => [String(profile?.email || '').toLowerCase(), profile]));
        const required = [
            ['unggaran.sditbm@gmail.com', 'superuser', 'ws_superuser', nextSuperClass],
            ['anur.auliya01@gmail.com', 'vip', 'ws_pjok', 'PJOK']
        ];
        const readiness = overview.rollover?.readiness || {};
        for (const [email, role, workspaceId] of required) {
            const profile = byEmail.get(email);
            if (!profile?.uid || profile.role !== role || profile.workspaceId !== workspaceId) {
                throw new Error(`Profil canonical ${role} belum siap atau migrasi workspace belum selesai.`);
            }
            const ready = readiness[profile.uid];
            if (!ready?.verified || ready.archiveHash?.length !== 64 || ready.workspaceId !== workspaceId || ready.academicYearId !== currentYearId) {
                throw new Error(`Arsip role ${role} belum diverifikasi ulang untuk ${currentYearId}.`);
            }
        }

        const preparedAt = new Date().toISOString();
        await updateDatabase(`rollovers/${currentYearId}`, {
            state: 'ready',
            preparedAt,
            preparedBy: access.uid,
            nextYearId: nextYear
        });

        const updates = {};
        for (const [email, role, workspaceId, classId] of required) {
            const profile = byEmail.get(email);
            updates[`workspaces/${workspaceId}/academicYears/${currentYearId}`] = null;
            updates[`workspaces/${workspaceId}/settings/identity`] = null;
            updates[`workspaces/${workspaceId}/academicYears/${nextYear}/meta`] = {
                schemaVersion: 3,
                academicYearId: nextYear,
                initializedAt: preparedAt,
                initializedBy: access.uid,
                status: 'active'
            };
            updates[`users/${profile.uid}/activeAcademicYearId`] = nextYear;
            updates[`users/${profile.uid}/classId`] = classId;
            updates[`assignments/${nextYear}/${profile.uid}`] = {
                uid: profile.uid,
                email,
                role,
                workspaceId,
                classId,
                academicYearId: nextYear,
                assignedAt: preparedAt,
                assignedBy: access.uid
            };
        }
        updates['system/academicYear/activeYearId'] = nextYear;
        updates['system/academicYear/updatedAt'] = preparedAt;
        updates['system/academicYear/updatedBy'] = access.uid;
        updates[`rollovers/${currentYearId}/state`] = 'completed';
        updates[`rollovers/${currentYearId}/completedAt`] = preparedAt;
        updates[`rollovers/${currentYearId}/completedBy`] = access.uid;
        await updateDatabase('', updates);

        const verification = await Promise.all(required.map(async ([email, role, workspaceId, classId]) => {
            const profile = byEmail.get(email);
            const [oldYear, newMeta, userYear, userClass] = await Promise.all([
                readDatabase(`workspaces/${workspaceId}/academicYears/${currentYearId}`),
                readDatabase(`workspaces/${workspaceId}/academicYears/${nextYear}/meta`),
                readDatabase(`users/${profile.uid}/activeAcademicYearId`),
                readDatabase(`users/${profile.uid}/classId`)
            ]);
            return !oldYear.exists() && newMeta.val()?.status === 'active' && userYear.val() === nextYear && userClass.val() === classId && profile.role === role;
        }));
        if (verification.some((valid) => !valid)) throw new Error('Post-verify rollover gagal. Akses tetap harus dibekukan untuk audit manual.');
        return successfulResult({ currentYearId, nextYearId: nextYear, completedAt: preparedAt, verification });
    } catch (error) {
        return failedResult(error);
    }
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

const SIMNIRepository =
    Object.freeze({
        resolveDatabasePath,

        dbSet,
        dbUpdate,
        dbRemove,
        dbGet,

        dbGetAnnualArchives,
        dbCreateAnnualArchive,
        dbGetAnnualArchiveStatus,
        dbPerformAnnualReset,
        dbVerifyRestoreSnapshot,

        dbPutAnnualArchive,
        dbMarkRolloverArchiveReady,
        dbGetRolloverOverview,
        dbCommitAcademicYearRollover,

        getCurrentUserMeta
    });

Object.assign(
    window,
    {
        resolveDatabasePath,

        dbSet,
        dbUpdate,
        dbRemove,
        dbGet,

        dbGetAnnualArchives,
        dbCreateAnnualArchive,
        dbGetAnnualArchiveStatus,
        dbPerformAnnualReset,
        dbVerifyRestoreSnapshot,

        dbPutAnnualArchive,
        dbMarkRolloverArchiveReady,
        dbGetRolloverOverview,
        dbCommitAcademicYearRollover,

        getCurrentUserMeta,

        SIMNIRepository
    }
);

export default SIMNIRepository;
