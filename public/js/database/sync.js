// ==========================================
// FILE: js/database/sync.js
// FUNGSI:
// Listener workspace-scoped Firebase -> state aplikasi.
// Health dipelihara per binding agar satu listener gagal
// tidak dapat ditutupi callback sukses listener lain.
// ==========================================

import {
    ref,
    onValue
} from '../../vendor/firebase/firebase-database.js';

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
                window.state.students =
                    valuesOf(
                        data
                    );
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
                window.state.presensi =
                    valuesOf(
                        data
                    );
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
                window.state.mapelTP =
                    valuesOf(
                        data
                    );
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
                window.state.nilaiTP =
                    valuesOf(
                        data
                    );
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
                window.state.jurnal =
                    valuesOf(
                        data
                    );
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

    if (
        data &&
        typeof data ===
            'object'
    ) {
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

    return [];
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
        access.workspaceId,
        access.activeAcademicYearId
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
            0
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
            'ready'
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
            0
        );
}

function scheduleHealthyCachePersistence() {

    if (
        syncState.status !==
        'ready'
    ) {
        return;
    }

    cacheRevisionRequested =
        syncState.revision;

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

                                await saveLocalBackup();

                                cacheRevisionPersisted =
                                    requestedRevision;
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
                                    syncState.status ===
                                        'ready'
                                ) {
                                    scheduleHealthyCachePersistence();
                                }
                            }
                        );
            },
            120
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
            'success'
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

    try {
        binding.apply(
            snapshot.val()
        );

        setBindingStatus(
            binding.logicalPath,
            'ready',
            {
                physicalPath,
                error:
                    null
            }
        );
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

    window.isFirebaseListening =
        true;

    window.isInitialLoad =
        true;

    publishSyncState({
        status:
            'loading'
    });

    showInitialLoader();

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

        const listener = onValue;
        const reference = ref(database, physicalPath);
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
