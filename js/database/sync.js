// ==========================================
// FILE: js/database/sync.js
// FUNGSI:
// Listener workspace-scoped Firebase -> state aplikasi.
// Health dipelihara per binding agar satu listener gagal
// tidak dapat ditutupi callback sukses listener lain.
// ==========================================

import {
    ref,
    onValue,
    query,
    orderByKey,
    limitToFirst,
    startAfter,
    endAt
} from '../../vendor/firebase/firebase-database.js';

import { subscribeLivePages } from './live-pages.js';

import {
    database,
    runtime
} from './firebase-client.js';



import {
    saveLocalBackup
} from './local-cache.js';

import {
    canAccess
} from '../auth/access-context.js';

const DEFAULT_LPS_SETTINGS =
    Object.freeze([
        Object.freeze({
            id: 'k1',
            judul: 'Kemampuan Akademis',
            opsi: 'A,B,C,D',
            items: Object.freeze([
                'Ketuntasan Materi'
            ])
        })
    ]);

// Scalars remain bounded. Collections are published only after all live key
// ranges are complete, rather than rejecting a healthy, growing year.
const MAX_BINDING_BYTES = 16 * 1024 * 1024;
function collectionBinding(binding) {
    return !binding.logicalPath.startsWith('Pengaturan/');
}

const NODE_BINDINGS =
    Object.freeze([
        Object.freeze({
            logicalPath:
                'Pengaturan/Identitas',

            feature:
                'settings',

            stateKey:
                'pengaturan',

            apply(data) {
                if (
                    data &&
                    typeof data ===
                        'object' &&
                    !Array.isArray(data)
                ) {
                    window.state.pengaturan =
                        data;
                }
            }
        }),

        Object.freeze({
            logicalPath:
                'Pengaturan/LPS_v2',

            feature:
                'lps',

            stateKey:
                'pengaturanLPS_v2',

            apply(data) {
                window.state.pengaturanLPS_v2 =
                    data ??
                    DEFAULT_LPS_SETTINGS.map(
                        (item) => ({
                            ...item,
                            items: [
                                ...item.items
                            ]
                        })
                    );
            }
        }),

        Object.freeze({
            logicalPath:
                'Siswa',

            feature:
                'students',

            stateKey:
                'students',

            apply(data) {
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    window.state.students = Object.entries(data)
                        .filter(([_, item]) => item !== undefined && item !== null)
                        .map(([key, item]) => {
                            if (typeof item === 'object') {
                                const nisn = window.academicNisn(item.NISN || (/^\d{10}$/.test(String(item.id_siswa || '')) ? item.id_siswa : '') || (/^\d{10}$/.test(key) ? key : ''));
                                return {
                                    ...item,
                                    NISN: nisn,
                                    ID_Siswa: item.ID_Siswa || item.id_siswa || `stu_${nisn}`,
                                    'Nama Lengkap': item['Nama Lengkap'] || item.nama || item.Nama || '',
                                    'Nama Panggilan': item['Nama Panggilan'] || item.nama_panggilan || '',
                                    Kelas: item.Kelas || item.kelas || item.id_kelas || ''
                                };
                            }
                            return item;
                        });
                } else {
                    window.state.students = valuesOf(data).map((item) => {
                        if (item && typeof item === 'object') {
                            const nisn = window.academicNisn(item.NISN || (/^\d{10}$/.test(String(item.id_siswa || '')) ? item.id_siswa : ''));
                            return {
                                ...item,
                                NISN: nisn,
                                ID_Siswa: item.ID_Siswa || item.id_siswa || (nisn ? `stu_${nisn}` : ''),
                                'Nama Lengkap': item['Nama Lengkap'] || item.nama || item.Nama || '',
                                'Nama Panggilan': item['Nama Panggilan'] || item.nama_panggilan || '',
                                Kelas: item.Kelas || item.kelas || item.id_kelas || ''
                            };
                        }
                        return item;
                    });
                }
            }
        }),

        Object.freeze({
            logicalPath:
                'Presensi',

            feature:
                'attendance',

            stateKey:
                'presensi',

            apply(data) {
                window.state.presensi = valuesOf(data).map((item) => {
                    if (!item || typeof item !== 'object') return item;
                    const rawDate = item.Tanggal || item.tanggal || '';
                    let tanggal = String(rawDate).trim();
                    if (tanggal.includes('T')) {
                        tanggal = tanggal.split('T')[0];
                    }
                    const rawStatus = item.Status || item.status || 'Hadir';
                    const statusFormatted = String(rawStatus).charAt(0).toUpperCase() + String(rawStatus).slice(1).toLowerCase();
                    return {
                        ...item,
                        Tanggal: tanggal,
                        NISN: String(item.NISN || item.nisn || '').trim(),
                        Nama: item.Nama || item.nama || '',
                        Status: ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(statusFormatted) ? statusFormatted : 'Hadir',
                        Keterangan: item.Keterangan || item.keterangan || '',
                        Kelas: item.Kelas || item.kelas || item.id_kelas || ''
                    };
                });
            }
        }),

        Object.freeze({
            logicalPath:
                'Mapel_TP',

            feature:
                'grades',

            stateKey:
                'mapelTP',

            apply(data) {
                const normalizeTPItem = (item, fallbackKey = '') => {
                    let ch = null;
                    if (item.chapterNumber != null) {
                        const n = Number(item.chapterNumber);
                        if (n >= 1 && n <= 10) ch = n;
                    } else if (!item.chapterDefined && item.bab_id) {
                        const n = Number(item.bab_id);
                        if (n >= 1 && n <= 10) ch = n;
                    }
                    if (ch === null && !item.chapterDefined) {
                        const match = String(item.bab_nama || item.bab || '').match(/\bBab\s+(\d{1,2})\b/i);
                        if (match) {
                            const m = Number(match[1]);
                            if (m >= 1 && m <= 10) ch = m;
                        }
                    }
                    const canonicalId = fallbackKey || String(item.ID_mapel || item.learningObjectiveId || item.kode_tp || '').trim().replace(/[.#$\[\]\/]/g, '_');
                    return {
                        ...item,
                        ID_mapel: canonicalId,
                        kelas: item.kelas || item.Kelas || item.id_kelas || '',
                        chapterNumber: ch
                    };
                };

                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    window.state.mapelTP = Object.entries(data)
                        .filter(([_, item]) => item !== undefined && item !== null)
                        .map(([key, item]) => (typeof item === 'object' ? normalizeTPItem(item, key) : item));
                } else {
                    window.state.mapelTP = valuesOf(data).map((item) => (item && typeof item === 'object' ? normalizeTPItem(item) : item));
                }
            }
        }),

        Object.freeze({
            logicalPath:
                'Nilai_TP',

            feature:
                'grades',

            stateKey:
                'nilaiTP',

            apply(data) {
                window.state.nilaiTP = Object.entries(data || {}).filter(([, item]) => item && typeof item === 'object').map(([key, item]) => {
                    if (!item || typeof item !== 'object') return item;
                    const nisn = String(item.NISN || item.nisn || '').trim();
                    const learningObjectiveId = String(item.learningObjectiveId || item.ID_mapel || '').trim();
                    const idNilai = key;
                    return {
                        ...item,
                        NISN: nisn,
                        learningObjectiveId: learningObjectiveId,
                        ID_Nilai: idNilai,
                        mapel: item.mapel || item.Mapel || '',
                        semester: String(item.semester || item.Semester || '1'),
                        nilai: window.academicScore(item.nilai ?? item.Nilai),
                        Kelas: item.Kelas || item.kelas || item.id_kelas || ''
                    };
                });
            }
        }),

        Object.freeze({
            logicalPath:
                'Dokumen',

            feature:
                'documents',

            stateKey:
                'dokumen',

            apply(data) {
                window.state.dokumen =
                    valuesOf(
                        data
                    );
            }
        }),

        Object.freeze({
            logicalPath:
                'Catatan',

            feature:
                'notes',

            stateKey:
                'catatan',

            apply(data) {
                window.state.catatan =
                    valuesOf(
                        data
                    );
            }
        }),

        Object.freeze({
            logicalPath:
                'Jurnal',

            feature:
                'journal',

            stateKey:
                'jurnal',

            apply(data) {
                window.state.jurnal = Object.entries(data || {}).filter(([, item]) => item && typeof item === 'object').map(([key, item]) => ({
                    ...item, ID_Jurnal: key,
                    Tanggal: window.normalizeDate(item.Tanggal || item.tanggal || ''),
                    Kelas: item.Kelas || item.kelas || item.id_kelas || ''
                }));
            }
        }),

        Object.freeze({
            logicalPath:
                'Jadwal',

            feature:
                'journal',

            stateKey:
                'jadwal',

            apply(data) {
                window.state.jadwal =
                    normalizeSchedule(
                        data
                    );
            }
        }),

        Object.freeze({
            logicalPath:
                'Data_LPS',

            feature:
                'lps',

            stateKey:
                'dataLPS',

            apply(data) {
                window.state.dataLPS =
                    valuesOf(
                        data
                    );
            }
        }),

        Object.freeze({
            logicalPath:
                'LPS/Templates',

            feature:
                'lps',

            stateKey:
                'lpsTemplates',

            apply(data) {
                window.state.lpsTemplates =
                    data &&
                    typeof data ===
                        'object'
                        ? data
                        : {};
            }
        }),

        Object.freeze({
            logicalPath:
                'LPS/Reports',

            feature:
                'lps',

            stateKey:
                'lpsReports',

            apply(data) {
                window.state.lpsReports =
                    valuesOf(
                        data
                    );
            }
        })
    ]);

const syncState = {
    status:
        'idle',

    required:
        0,

    succeeded:
        0,

    failedPaths:
        [],

    pendingPaths:
        [],

    bindings:
        {},

    generation:
        0,

    revision:
        0,

    initialComplete:
        false,

    lastCompleteAt:
        null,

    lastChangeAt:
        null
};

window.SIMNISyncState =
    syncState;

let activeUnsubscribers =
    [];

let activeGeneration =
    0;

let initialLoadingVisible =
    false;

let renderTimer =
    null;

let renderAllPending =
    false;

let cacheTimer =
    null;

let cacheWriteChain =
    Promise.resolve();

let cacheRevisionRequested =
    0;

let cacheRevisionPersisted =
    0;

function valuesOf(data) {
    if (
        !data ||
        typeof data !==
            'object'
    ) {
        return [];
    }

    if (
        Array.isArray(
            data
        )
    ) {
        return data.filter(
            (item) =>
                item !==
                    undefined &&
                item !==
                    null
        );
    }

    return Object.values(
        data
    ).filter(
        (item) =>
            item !==
                undefined &&
            item !==
                null
    );
}

function normalizeSchedule(
    data
) {
    return Object.entries(data || {}).filter(([, item]) => item && typeof item === 'object').map(([key, item]) => ({
        ...item, ID_Jadwal: key, Kelas: item.Kelas || item.kelas || item.id_kelas || ''
    }));
}

function errorMessage(
    error
) {
    return String(
        error?.message ||
        error?.code ||
        error ||
        'Kesalahan sinkronisasi tidak diketahui.'
    );
}

function hashPayload(val) {
    if (val === null || val === undefined) return 0;
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function accessSignature() {
    const access =
        window.SIMNICurrentAccess;

    if (
        !access?.uid ||
        !access?.workspaceId ||
        !access?.activeAcademicYearId
    ) {
        return null;
    }

    return [
        access.uid,
        access.role,
        access.workspaceId,
        access.classId,
        access.activeAcademicYearId,
        access.assignmentRevision || 1
    ]
        .map(
            String
        )
        .join(
            '|'
        );
}

function generationIsCurrent(
    generation,
    signature
) {
    return (
        generation ===
            activeGeneration &&
        signature ===
            accessSignature()
    );
}

function bindingSnapshot(
    binding
) {
    return {
        logicalPath:
            binding.logicalPath,

        feature:
            binding.feature,

        stateKey:
            binding.stateKey,

        required:
            true,

        status:
            'pending',

        physicalPath:
            null,

        error:
            null,

        lastSuccessAt:
            null,

        lastFailureAt:
            null,

        revision:
            0,

        lastPayloadHash:
            null
    };
}

function initializeBindingState(
    bindings
) {
    const output =
        {};

    for (
        const binding
        of bindings
    ) {
        output[
            binding.logicalPath
        ] =
            bindingSnapshot(
                binding
            );
    }

    return output;
}

function requiredBindings() {
    return Object.values(
        syncState.bindings ||
        {}
    ).filter(
        (binding) =>
            binding?.required ===
            true
    );
}

function deriveHealth({
    initialPhase =
        !syncState.initialComplete
} = {}) {
    const bindings =
        requiredBindings();

    if (!bindings.length) {
        return {
            status:
                'failed',

            required:
                0,

            succeeded:
                0,

            failedPaths:
                [],

            pendingPaths:
                []
        };
    }

    const ready =
        bindings.filter(
            (binding) =>
                binding.status ===
                'ready'
        );

    const failed =
        bindings.filter(
            (binding) =>
                binding.status ===
                'failed'
        );

    const pending =
        bindings.filter(
            (binding) =>
                binding.status ===
                    'pending' ||
                binding.status ===
                    'loading'
        );

    let status;

    if (
        pending.length >
        0
    ) {
        status =
            'loading';
    } else if (
        failed.length ===
        0 &&
        ready.length ===
        bindings.length
    ) {
        status =
            'ready';
    } else if (
        ready.length ===
        0
    ) {
        status =
            'failed';
    } else {
        status =
            initialPhase
                ? 'partial'
                : 'degraded';
    }

    return {
        status,

        required:
            bindings.length,

        succeeded:
            ready.length,

        failedPaths:
            failed.map(
                (binding) =>
                    binding.logicalPath
            ),

        pendingPaths:
            pending.map(
                (binding) =>
                    binding.logicalPath
            )
    };
}

function publishSyncState(
    extra = {}
) {
    const health =
        deriveHealth();

    Object.assign(
        syncState,
        health,
        extra,
        {
            generation:
                activeGeneration,

            lastChangeAt:
                new Date()
                    .toISOString()
        }
    );

    window.SIMNISyncState =
        syncState;

    window.updateSyncUI?.(
        syncState.status ===
            'ready' && syncState.connected !== false
    );

    return syncState;
}

function setBindingStatus(
    logicalPath,
    status,
    {
        physicalPath,
        error = null
    } = {}
) {
    const binding =
        syncState
            .bindings
            ?.[
                logicalPath
            ];

    if (!binding) {
        return;
    }

    binding.status =
        status;

    if (
        physicalPath !==
        undefined
    ) {
        binding.physicalPath =
            physicalPath;
    }

    binding.error =
        error
            ? errorMessage(
                error
            )
            : null;

    binding.revision =
        Number(
            binding.revision ||
            0
        ) + 1;

    if (
        status ===
        'ready'
    ) {
        binding.lastSuccessAt =
            new Date()
                .toISOString();
    }

    if (
        status ===
        'failed'
    ) {
        binding.lastFailureAt =
            new Date()
                .toISOString();
    }

    syncState.revision +=
        1;
}

function scheduleRender({
    all =
        false
} = {}) {
    if (all) {
        renderAllPending =
            true;
    }

    if (
        renderTimer !==
        null
    ) {
        return;
    }

    renderTimer =
        window.setTimeout(
            () => {
                renderTimer =
                    null;

                try {
                    window
                        .populateAllDropdowns
                        ?.();

                    window
                        .renderIdentitas
                        ?.();

                    if (
                        renderAllPending
                    ) {
                        renderAllPending =
                            false;

                        window
                            .renderAllViews
                            ?.();
                    } else {
                        window
                            .renderCurrentView
                            ?.();
                    }
                } catch (error) {
                    console.error(
                        '[SIMNI Sync] Render pipeline gagal:',
                        error
                    );
                }
            },
            40
        );
}

let cacheRetryCount = 0;
function scheduleHealthyCachePersistence() {

    if (
        syncState.status !==
        'ready'
    ) {
        return;
    }

    cacheRevisionRequested =
        syncState.revision;
    const requestedGeneration = activeGeneration;

    if (
        cacheTimer !==
        null
    ) {
        return;
    }

    cacheTimer =
        window.setTimeout(
            () => {
                cacheTimer =
                    null;

                const requestedRevision =
                    cacheRevisionRequested;

                cacheWriteChain =
                    cacheWriteChain
                        .then(
                            async () => {
                                if (
                                    syncState.status !==
                                    'ready'
                                ) {
                                    return;
                                }

                                if (
                                    requestedRevision <=
                                    cacheRevisionPersisted
                                ) {
                                    return;
                                }

                                const result = await saveLocalBackup();
                                if (requestedGeneration !== activeGeneration) return;
                                if (!result?.ok) {
                                    cacheRetryCount += 1;
                                    window.SIMNICacheHealth = { status: 'degraded', revision: requestedRevision, message: result?.error?.message || 'Cache lokal gagal disimpan.' };
                                    if (cacheRetryCount === 1) window.toast?.('Data cloud tetap tersimpan; salinan offline belum dapat diperbarui.', 'warning');
                                    return;
                                }
                                cacheRetryCount = 0;
                                window.SIMNICacheHealth = { status: 'ready', revision: requestedRevision };
                                cacheRevisionPersisted = requestedRevision;
                            }
                        )
                        .catch(
                            (error) => {
                                console.error(
                                    '[SIMNI Sync] Penyimpanan cache sehat gagal:',
                                    error
                                );
                            }
                        )
                        .finally(
                            () => {
                                if (
                                    cacheRevisionRequested >
                                        cacheRevisionPersisted &&
                                    requestedGeneration === activeGeneration &&
                                    syncState.status ===
                                        'ready' && cacheRetryCount < 3
                                ) {
                                    scheduleHealthyCachePersistence();
                                }
                            }
                        );
            },
            cacheRetryCount ? Math.min(30000, 1000 * 2 ** cacheRetryCount) : 800
        );
}

function showInitialLoader() {
    if (
        initialLoadingVisible
    ) {
        return;
    }

    initialLoadingVisible =
        true;

    window.showLoad?.(
        'Menghubungkan workspace & sinkronisasi...'
    );
}

function hideInitialLoader() {
    if (
        !initialLoadingVisible
    ) {
        return;
    }

    initialLoadingVisible =
        false;

    window.hideLoad?.();
}

function announceInitialResult() {
    const status =
        syncState.status;

    if (
        status ===
        'ready'
    ) {
        window.toast?.(
            'Workspace database terhubung lengkap.',
            'info'
        );

        return;
    }

    if (
        status ===
        'partial'
    ) {
        window.toast?.(
            `Workspace hanya terbaca sebagian (${syncState.failedPaths.length} alur gagal). Penulisan diblokir sampai seluruh sinkronisasi sehat.`,
            'error'
        );

        return;
    }

    window.toast?.(
        'Workspace belum dapat dibaca. Periksa profil akses, koneksi, dan Firebase Rules.',
        'error'
    );

}

function finalizeInitialSync(
    generation,
    signature
) {
    if (
        !generationIsCurrent(
            generation,
            signature
        )
    ) {
        return;
    }

    const health =
        deriveHealth({
            initialPhase:
                true
        });

    if (
        health.pendingPaths
            .length >
        0
    ) {
        return;
    }

    syncState.initialComplete =
        true;

    window.isInitialLoad =
        false;

    Object.assign(
        syncState,
        health,
        {
            lastCompleteAt:
                health.status ===
                    'ready'
                    ? new Date()
                        .toISOString()
                    : syncState
                        .lastCompleteAt,

            lastChangeAt:
                new Date()
                    .toISOString()
        }
    );

    window.SIMNISyncState =
        syncState;

    window.updateSyncUI?.(
        syncState.status ===
            'ready'
    );

    hideInitialLoader();

    announceInitialResult();

    scheduleRender({
        all:
            true
    });

    if (
        syncState.status ===
        'ready'
    ) {
        scheduleHealthyCachePersistence();
    }
}

function recalculateLiveHealth({
    previousGlobalStatus =
        syncState.status
} = {}) {
    if (
        !syncState.initialComplete
    ) {
        publishSyncState();

        return;
    }

    const health =
        deriveHealth({
            initialPhase:
                false
        });

    Object.assign(
        syncState,
        health,
        {
            lastCompleteAt:
                health.status ===
                    'ready'
                    ? new Date()
                        .toISOString()
                    : syncState
                        .lastCompleteAt,

            lastChangeAt:
                new Date()
                    .toISOString()
        }
    );

    window.SIMNISyncState =
        syncState;

    window.updateSyncUI?.(
        syncState.status ===
            'ready'
    );

    if (
        previousGlobalStatus ===
            'ready' &&
        syncState.status !==
            'ready'
    ) {
        window.toast?.(
            `Sinkronisasi workspace menurun ke ${syncState.status}. Penulisan diblokir sampai seluruh binding pulih.`,
            'error'
        );
    }

    if (
        previousGlobalStatus !==
            'ready' &&
        syncState.status ===
            'ready'
    ) {
        window.toast?.(
            'Seluruh sinkronisasi workspace pulih.',
            'success'
        );
    }

    if (
        syncState.status ===
        'ready'
    ) {
        scheduleHealthyCachePersistence();
    }
}

function stopActiveSubscriptions() {
    const subscriptions =
        activeUnsubscribers;

    activeUnsubscribers =
        [];

    for (
        const unsubscribe
        of subscriptions
    ) {
        try {
            unsubscribe();
        } catch (_) {
            // Best effort teardown.
        }
    }
}

function clearScheduledWork() {
    if (
        renderTimer !==
        null
    ) {
        clearTimeout(
            renderTimer
        );

        renderTimer =
            null;
    }

    renderAllPending =
        false;

    if (
        cacheTimer !==
        null
    ) {
        clearTimeout(
            cacheTimer
        );

        cacheTimer =
            null;
    }
}

function resetSyncState(
    status =
        'idle'
) {
    Object.assign(
        syncState,
        {
            status,

            required:
                0,

            succeeded:
                0,

            failedPaths:
                [],

            pendingPaths:
                [],

            bindings:
                {},

            generation:
                activeGeneration,

            revision:
                0,

            initialComplete:
                false,

            lastCompleteAt:
                null,

            lastChangeAt:
                new Date()
                    .toISOString()
        }
    );

    window.SIMNISyncState =
        syncState;

    window.updateSyncUI?.(
        false
    );
}

function eligibleBindings() {
    return NODE_BINDINGS.filter(
        (binding) => {
            try {
                return (
                    canAccess(
                        binding.feature
                    ) ===
                    true
                );
            } catch (
                error
            ) {
                console.error(
                    '[SIMNI Sync] Pemeriksaan permission binding gagal:',
                    binding.logicalPath,
                    error
                );

                return false;
            }
        }
    );
}

function resolveBindingPath(
    binding
) {
    if (
        typeof window
            .resolveDatabasePath !==
        'function'
    ) {
        throw new Error(
            'Database repository belum siap.'
        );
    }

    return window
        .resolveDatabasePath(
            binding.logicalPath
        );
}

function handleBindingSuccess({
    binding,
    physicalPath,
    snapshot,
    generation,
    signature
}) {
    if (
        !generationIsCurrent(
            generation,
            signature
        )
    ) {
        return;
    }

    const previousGlobalStatus =
        syncState.status;

    const val = snapshot.val();
    if ((collectionBinding(binding) && snapshot.pagedComplete !== true) ||
        (!collectionBinding(binding) && new TextEncoder().encode(JSON.stringify(val)).byteLength > MAX_BINDING_BYTES)) {
        handleBindingFailure({ binding, physicalPath, generation, signature,
            error: new Error(`Data ${binding.logicalPath} belum lengkap atau satu nilai melebihi 16 MiB. Data parsial tidak digunakan.`) });
        return;
    }
    const payloadHash = hashPayload(val);
    const existingBinding = syncState.bindings?.[binding.logicalPath];
    const isUnchanged = Boolean(
        existingBinding &&
        existingBinding.status === 'ready' &&
        existingBinding.lastPayloadHash === payloadHash
    );

    if (isUnchanged) {
        if (!syncState.initialComplete) {
            publishSyncState();
            finalizeInitialSync(generation, signature);
        }
        return;
    }

    try {
        binding.apply(
            val
        );

        const recordCount = Object.keys(val || {}).length;
        const activeClass = window.state?.activeKelas || window.SIMNICurrentAccess?.classId || '';
        const scopeMeta = {
            logicalPath: binding.logicalPath,
            scope: 'all',
            classId: activeClass,
            isComplete: true,
            isClassComplete: true,
            recordCount,
            lastUpdated: new Date().toISOString()
        };
        window.SIMNIDataScope = window.SIMNIDataScope || {};
        window.SIMNIDataScope[binding.logicalPath] = scopeMeta;
        if (binding.logicalPath === 'Presensi' && window.state) {
            window.state.presensiScope = { ...scopeMeta };
        } else if (binding.logicalPath === 'Nilai_TP' && window.state) {
            window.state.nilaiScope = { ...scopeMeta };
        } else if (binding.logicalPath === 'Jurnal' && window.state) {
            window.state.jurnalScope = { ...scopeMeta };
        }

        setBindingStatus(
            binding.logicalPath,
            'ready',
            {
                physicalPath,
                error:
                    null
            }
        );

        if (syncState.bindings?.[binding.logicalPath]) {
            syncState.bindings[binding.logicalPath].lastPayloadHash = payloadHash;
        }
    } catch (error) {
        console.error(
            '[SIMNI Sync] Apply listener gagal:',
            binding.logicalPath,
            error
        );

        setBindingStatus(
            binding.logicalPath,
            'failed',
            {
                physicalPath,
                error
            }
        );
    }

    if (
        !syncState.initialComplete
    ) {
        publishSyncState();

        finalizeInitialSync(
            generation,
            signature
        );

        return;
    }

    recalculateLiveHealth({
        previousGlobalStatus
    });

    scheduleRender({
        all:
            false
    });
}

function handleBindingFailure({
    binding,
    physicalPath,
    error,
    generation,
    signature
}) {
    if (
        !generationIsCurrent(
            generation,
            signature
        )
    ) {
        return;
    }

    console.error(
        '[SIMNI Sync] Listener Firebase gagal:',
        binding.logicalPath,
        physicalPath,
        error?.code ||
        error?.message ||
        error
    );

    const previousGlobalStatus =
        syncState.status;

    setBindingStatus(
        binding.logicalPath,
        'failed',
        {
            physicalPath,
            error
        }
    );

    if (
        !syncState.initialComplete
    ) {
        publishSyncState();

        finalizeInitialSync(
            generation,
            signature
        );

        return;
    }

    recalculateLiveHealth({
        previousGlobalStatus
    });
}

export function stopFirebaseListener({
    status =
        'idle'
} = {}) {
    activeGeneration +=
        1;

    stopActiveSubscriptions();

    clearScheduledWork();

    hideInitialLoader();

    window.isFirebaseListening =
        false;

    window.isInitialLoad =
        true;

    resetSyncState(
        status
    );
}

export function initFirebaseListener() {
    if (
        window.isFirebaseListening
    ) {
        return {
            ok: true,
            alreadyListening: true,
            generation:
                activeGeneration
        };
    }

    const signature =
        accessSignature();

    if (!signature) {
        throw new Error(
            'Access context belum siap untuk sinkronisasi Firebase.'
        );
    }

    const bindings =
        eligibleBindings();

    if (!bindings.length) {
        throw new Error(
            'Role aktif tidak memiliki binding data yang diizinkan.'
        );
    }

    activeGeneration +=
        1;

    const generation =
        activeGeneration;

    stopActiveSubscriptions();

    clearScheduledWork();

    syncState.bindings =
        initializeBindingState(
            bindings
        );

    syncState.initialComplete =
        false;

    syncState.revision =
        0;

    syncState.lastCompleteAt =
        null;

    cacheRevisionRequested =
        0;

    cacheRevisionPersisted =
        0;
    cacheRetryCount = 0;
    syncState.connected = null;
    activeUnsubscribers.push(onValue(ref(database, '.info/connected'), snapshot => {
        if (!generationIsCurrent(generation, signature)) return;
        syncState.connected = snapshot.val() === true;
        publishSyncState();
    }));

    window.isFirebaseListening =
        true;

    const hasHydratedCache = Boolean(
        (Array.isArray(window.state?.students) && window.state.students.length > 0) ||
        (Array.isArray(window.state?.mapelTP) && window.state.mapelTP.length > 0) ||
        Boolean(window.state?.pengaturan?.nama_aplikasi) ||
        Boolean(window.SIMNILocalCacheState?.loaded)
    );

    if (hasHydratedCache) {
        window.isInitialLoad = false;
        initialLoadingVisible = false;
    } else {
        window.isInitialLoad = true;
        showInitialLoader();
    }

    publishSyncState({
        status:
            'loading'
    });

    for (
        const binding
        of bindings
    ) {
        let physicalPath;

        try {
            physicalPath =
                resolveBindingPath(
                    binding
                );

            setBindingStatus(
                binding.logicalPath,
                'loading',
                {
                    physicalPath
                }
            );
        } catch (error) {
            console.error(
                '[SIMNI Sync] Resolusi path listener gagal:',
                binding.logicalPath,
                error
            );

            setBindingStatus(
                binding.logicalPath,
                'failed',
                {
                    physicalPath:
                        null,

                    error
                }
            );

            continue;
        }

        const reference = ref(database, physicalPath);
        const listener = collectionBinding(binding)
            ? (target, success, failure) => subscribeLivePages({ onValue, query, orderByKey, limitToFirst, startAfter, endAt }, target, success, failure)
            : onValue;
        const unsubscribe =
            listener(
                reference,

                (snapshot) =>
                    handleBindingSuccess({
                        binding,
                        physicalPath,
                        snapshot,
                        generation,
                        signature
                    }),

                (error) =>
                    handleBindingFailure({
                        binding,
                        physicalPath,
                        error,
                        generation,
                        signature
                    })
            );

        activeUnsubscribers.push(
            unsubscribe
        );
    }

    publishSyncState();

    finalizeInitialSync(
        generation,
        signature
    );

    return {
        ok: true,

        generation,

        required:
            bindings.length,

        bindings:
            bindings.map(
                (binding) =>
                    binding.logicalPath
            )
    };
}

export function getSyncStateSnapshot() {
    const bindings =
        Object.fromEntries(
            Object.entries(
                syncState.bindings ||
                {}
            ).map(
                ([
                    logicalPath,
                    binding
                ]) => [
                    logicalPath,
                    {
                        ...binding
                    }
                ]
            )
        );

    return {
        status:
            syncState.status,

        required:
            syncState.required,

        succeeded:
            syncState.succeeded,

        failedPaths: [
            ...syncState.failedPaths
        ],

        pendingPaths: [
            ...syncState.pendingPaths
        ],

        bindings,

        generation:
            syncState.generation,

        revision:
            syncState.revision,

        initialComplete:
            syncState.initialComplete,

        lastCompleteAt:
            syncState.lastCompleteAt,

        lastChangeAt:
            syncState.lastChangeAt
    };
}

Object.assign(
    window,
    {
        initFirebaseListener,
        stopFirebaseListener,

        getSIMNISyncState:
            getSyncStateSnapshot
    }
);

window.SIMNISync =
    Object.freeze({
        init:
            initFirebaseListener,

        stop:
            stopFirebaseListener,

        getState:
            getSyncStateSnapshot
    });
