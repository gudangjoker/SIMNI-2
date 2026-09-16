// ==========================================
// FILE: js/database/local-cache.js
// FUNGSI:
// IndexedDB cache terisolasi per user/workspace/tahun.
// Menjaga integritas, urutan write, dan migrasi legacy fail-closed.
// ==========================================

const DB_NAME = 'AdminKelasDB';
const DB_VERSION = 3;
const STORE_NAME = 'stateStore';

const LEGACY_KEY = 'appState';
const LEGACY_MIGRATION_KEY = 'appState:migration:v3';

const CACHE_SCHEMA_VERSION = 3;
const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const MAX_DATABASE_BYTES = 96 * 1024 * 1024;

let writeQueue = Promise.resolve();
let localRevision = 0;

function nowISO() {
    return new Date().toISOString();
}

function currentAccess() {
    const access =
        window.SIMNICurrentAccess;

    if (
        !access?.uid ||
        !access?.role ||
        !access?.workspaceId ||
        !access?.classId ||
        !access?.activeAcademicYearId
    ) {
        throw new Error(
            'Access context belum siap untuk cache.'
        );
    }

    return access;
}

function cacheScope(
    access = currentAccess()
) {
    return {
        uid:
            String(
                access.uid
            ),

        role:
            String(
                access.role
            ),

        workspaceId:
            String(
                access.workspaceId
            ),

        classId:
            String(
                access.classId
            ),

        activeAcademicYearId:
            String(
                access.activeAcademicYearId
            ),

        assignmentRevision:
            Number(access.assignmentRevision || 1),

        schemaVersion:
            CACHE_SCHEMA_VERSION
    };
}

function accessCacheKey(
    access = currentAccess()
) {
    const scope =
        cacheScope(
            access
        );

    return [
        'appState',
        scope.uid,
        scope.workspaceId,
        scope.activeAcademicYearId,
        `rev${scope.assignmentRevision}`,
        `schema${CACHE_SCHEMA_VERSION}`
    ].join(':');
}

function previousScopedCacheKey(
    access = currentAccess()
) {
    return [
        'appState',
        String(access.uid),
        String(access.workspaceId),
        String(
            access.activeAcademicYearId
        ),
        'schema2'
    ].join(':');
}

function canonical(value) {
    if (
        Array.isArray(
            value
        )
    ) {
        return value.map(
            (item) =>
                item ===
                undefined
                    ? null
                    : canonical(
                        item
                    )
        );
    }

    if (
        value &&
        typeof value ===
            'object'
    ) {
        return Object.fromEntries(
            Object.keys(
                value
            )
                .sort()
                .filter(
                    (key) =>
                        value[key] !==
                        undefined
                )
                .map(
                    (key) => [
                        key,
                        canonical(
                            value[key]
                        )
                    ]
                )
        );
    }

    return value;
}

function persistedState(
    value
) {
    if (
        !value ||
        typeof value !==
            'object' ||
        Array.isArray(
            value
        )
    ) {
        return {};
    }

    const copy = {
        ...value
    };

    delete copy.scannerInstance;
    delete copy.__scope;
    delete copy.__cache;
    delete copy.__migratedFrom;
    delete copy.__migratedAt;

    return canonical(
        copy
    );
}

function extractState(
    record
) {
    if (
        record &&
        typeof record ===
            'object' &&
        !Array.isArray(
            record
        ) &&
        record.__cache
            ?.schemaVersion ===
            CACHE_SCHEMA_VERSION &&
        record.state &&
        typeof record.state ===
            'object' &&
        !Array.isArray(
            record.state
        )
    ) {
        return canonical(
            record.state
        );
    }

    return persistedState(
        record
    );
}

function stableStringify(
    value
) {
    return JSON.stringify(
        canonical(
            value
        )
    );
}

async function sha256(
    value
) {
    if (
        !globalThis.crypto?.subtle ||
        typeof TextEncoder ===
            'undefined'
    ) {
        throw new Error(
            'Web Crypto tidak tersedia untuk verifikasi cache.'
        );
    }

    const bytes =
        new TextEncoder()
            .encode(
                stableStringify(
                    value
                )
            );

    const digest =
        await globalThis
            .crypto
            .subtle
            .digest(
                'SHA-256',
                bytes
            );

    return Array.from(
        new Uint8Array(
            digest
        )
    )
        .map(
            (byte) =>
                byte
                    .toString(16)
                    .padStart(
                        2,
                        '0'
                    )
        )
        .join('');
}

function scopeMatches(
    record,
    access = currentAccess(),
    {
        allowLegacySchema2 =
            false
    } = {}
) {
    const scope =
        record?.__scope;

    if (
        !scope ||
        typeof scope !==
            'object'
    ) {
        return false;
    }

    const baseMatch =
        String(
            scope.uid || ''
        ) ===
            String(
                access.uid
            ) &&
        String(
            scope.workspaceId || ''
        ) ===
            String(
                access.workspaceId
            ) &&
        String(
            scope.activeAcademicYearId ||
            ''
        ) ===
            String(
                access.activeAcademicYearId
            );

    if (!baseMatch) {
        return false;
    }

    if (
        allowLegacySchema2
    ) {
        if (
            scope.role &&
            String(
                scope.role
            ) !==
                String(
                    access.role
                )
        ) {
            return false;
        }

        if (
            scope.classId &&
            String(
                scope.classId
            ) !==
                String(
                    access.classId
                )
        ) {
            return false;
        }

        return true;
    }

    return (
        String(
            scope.role || ''
        ) ===
            String(
                access.role
            ) &&
        String(
            scope.classId || ''
        ) ===
            String(
                access.classId
            ) &&
        Number(
            scope.schemaVersion
        ) ===
            CACHE_SCHEMA_VERSION
    );
}

function assertLegacyOwner(
    access = currentAccess()
) {
    if (
        access.role !==
            'superuser' ||
        access.workspaceId !==
            'ws_kelas3a' ||
        access.classId !==
            '3A'
    ) {
        throw new Error(
            'Cache legacy tanpa scope hanya boleh diwarisi Superuser kelas 3A.'
        );
    }
}

function openDatabase() {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );

            request.onerror =
                () => {
                    reject(
                        new Error(
                            `Kesalahan IndexedDB: ${
                                request.error
                                    ?.message ||
                                request.error ||
                                'unknown'
                            }`
                        )
                    );
                };

            request.onupgradeneeded =
                () => {
                    const db =
                        request.result;

                    if (
                        !db
                            .objectStoreNames
                            .contains(
                                STORE_NAME
                            )
                    ) {
                        db.createObjectStore(
                            STORE_NAME
                        );
                    }
                };

            request.onsuccess =
                () => {
                    resolve(
                        request.result
                    );
                };

            request.onblocked =
                () => {
                    reject(
                        new Error(
                            'Upgrade IndexedDB diblokir oleh tab SIMNI lain.'
                        )
                    );
                };
        }
    );
}

async function readKey(
    key
) {
    const db =
        await openDatabase();

    try {
        const transaction =
            db.transaction(
                STORE_NAME,
                'readonly'
            );

        const request =
            transaction
                .objectStore(
                    STORE_NAME
                )
                .get(
                    key
                );

        return await new Promise(
            (
                resolve,
                reject
            ) => {
                request.onsuccess =
                    () => {
                        resolve(
                            request.result
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                'Pembacaan IndexedDB gagal.'
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                'Pembacaan IndexedDB dibatalkan.'
                            )
                        );
                    };
            }
        );
    } finally {
        db.close();
    }
}

async function writeKey(
    key,
    value
) {
    const db =
        await openDatabase();

    try {
        const transaction =
            db.transaction(
                STORE_NAME,
                'readwrite'
            );

        const store = transaction.objectStore(STORE_NAME);
        // Check the total in the same write transaction, without loading all
        // years into an array. Existing records are never silently evicted.
        let totalBytes = new Blob([JSON.stringify(value)]).size;
        let capacityError = null;
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
                if (cursor.key !== key) totalBytes += new Blob([JSON.stringify(cursor.value)]).size;
                cursor.continue();
            } else if (totalBytes > MAX_DATABASE_BYTES) {
                capacityError = new Error('Penyimpanan offline mencapai batas 96 MiB. Buka Pengaturan → Penyimpanan perangkat, ekspor dan verifikasi cache lama sebelum menghapusnya.');
                transaction.abort();
            } else store.put(value, key);
        };

        await new Promise(
            (
                resolve,
                reject
            ) => {
                transaction.oncomplete =
                    () => {
                        resolve();
                    };

                transaction.onerror =
                    () => {
                        reject(
                            capacityError || transaction.error ||
                            new Error(
                                'Transaksi IndexedDB gagal.'
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            capacityError || transaction.error ||
                            new Error(
                                'Transaksi IndexedDB dibatalkan.'
                            )
                        );
                    };
            }
        );
    } finally {
        db.close();
    }
}

async function deleteKey(
    key
) {
    const db =
        await openDatabase();

    try {
        const transaction =
            db.transaction(
                STORE_NAME,
                'readwrite'
            );

        transaction
            .objectStore(
                STORE_NAME
            )
            .delete(
                key
            );

        await new Promise(
            (
                resolve,
                reject
            ) => {
                transaction.oncomplete =
                    () => {
                        resolve();
                    };

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                'Penghapusan IndexedDB gagal.'
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                'Penghapusan IndexedDB dibatalkan.'
                            )
                        );
                    };
            }
        );
    } finally {
        db.close();
    }
}

async function buildEnvelope(
    state,
    {
        access =
            currentAccess(),

        revision =
            null,

        migratedFrom =
            null
    } = {}
) {
    const normalizedState =
        persistedState(
            state
        );

    const stateHash =
        await sha256(
            normalizedState
        );

    const requestedRevision =
        Number.isFinite(
            Number(
                revision
            )
        )
            ? Number(
                revision
            )
            : 0;

    localRevision =
        Math.max(
            localRevision + 1,
            requestedRevision,
            Date.now()
        );

    return {
        __cache: {
            schemaVersion:
                CACHE_SCHEMA_VERSION,

            revision:
                localRevision,

            stateHash,

            savedAt:
                nowISO(),

            migratedFrom:
                migratedFrom ||
                null
        },

        __scope:
            cacheScope(
                access
            ),

        state:
            normalizedState
    };
}

async function verifyEnvelope(
    envelope,
    access = currentAccess()
) {
    if (
        !envelope ||
        typeof envelope !==
            'object' ||
        Array.isArray(
            envelope
        )
    ) {
        throw new Error(
            'Envelope cache tidak valid.'
        );
    }

    if (
        envelope.__cache
            ?.schemaVersion !==
        CACHE_SCHEMA_VERSION
    ) {
        throw new Error(
            'Versi schema cache tidak cocok.'
        );
    }

    if (
        !scopeMatches(
            envelope,
            access
        )
    ) {
        throw new Error(
            'Scope cache tidak cocok dengan user/workspace/tahun aktif.'
        );
    }

    const state =
        extractState(
            envelope
        );

    const actualHash =
        await sha256(
            state
        );

    if (
        actualHash !==
        envelope.__cache
            ?.stateHash
    ) {
        throw new Error(
            'Hash cache tidak cocok; cache ditolak.'
        );
    }

    return {
        ok:
            true,

        state,

        revision:
            Number(
                envelope.__cache
                    ?.revision ||
                0
            ),

        stateHash:
            actualHash
    };
}

function enqueueWrite(
    task
) {
    const operation =
        writeQueue.then(
            task,
            task
        );

    writeQueue =
        operation.catch(
            () => undefined
        );

    return operation;
}

async function writeEnvelopeVerified(
    key,
    envelope,
    access = currentAccess()
) {
    await writeKey(
        key,
        envelope
    );

    const readBack =
        await readKey(
            key
        );

    const verification =
        await verifyEnvelope(
            readBack,
            access
        );

    if (
        verification.stateHash !==
        envelope.__cache
            .stateHash
    ) {
        throw new Error(
            'Read-back cache tidak cocok dengan snapshot yang ditulis.'
        );
    }

    return {
        envelope:
            readBack,

        verification
    };
}

async function migrateScopedSchema2IfNeeded(
    access = currentAccess()
) {
    const targetKey =
        accessCacheKey(
            access
        );

    const existing =
        await readKey(
            targetKey
        );

    if (existing) {
        try {
            await verifyEnvelope(
                existing,
                access
            );

            return {
                ok:
                    true,

                migrated:
                    false,

                reason:
                    'schema3-cache-exists',

                targetKey
            };
        } catch (error) {
            return {
                ok:
                    false,

                migrated:
                    false,

                reason:
                    'schema3-cache-invalid',

                targetKey,

                error
            };
        }
    }

    const sourceKey =
        previousScopedCacheKey(
            access
        );

    const source =
        await readKey(
            sourceKey
        );

    if (!source) {
        return {
            ok:
                true,

            migrated:
                false,

            reason:
                'schema2-cache-empty',

            targetKey
        };
    }

    if (
        !scopeMatches(
            source,
            access,
            {
                allowLegacySchema2:
                    true
            }
        )
    ) {
        return {
            ok:
                false,

            migrated:
                false,

            reason:
                'schema2-scope-mismatch',

            sourceKey,

            targetKey
        };
    }

    const sourceState =
        extractState(
            source
        );

    const envelope =
        await buildEnvelope(
            sourceState,
            {
                access,

                migratedFrom:
                    sourceKey
            }
        );

    await writeEnvelopeVerified(
        targetKey,
        envelope,
        access
    );

    await deleteKey(
        sourceKey
    );

    return {
        ok:
            true,

        migrated:
            true,

        sourceKey,

        targetKey
    };
}

async function migrateUnscopedLegacyIfNeeded(
    access = currentAccess()
) {
    try {
        assertLegacyOwner(
            access
        );
    } catch (_) {
        return {
            ok:
                true,

            migrated:
                false,

            reason:
                'legacy-cache-owner-only'
        };
    }

    const targetKey =
        accessCacheKey(
            access
        );

    const existingTarget =
        await readKey(
            targetKey
        );

    if (existingTarget) {
        try {
            await verifyEnvelope(
                existingTarget,
                access
            );

            return {
                ok:
                    true,

                migrated:
                    false,

                reason:
                    'scoped-cache-already-exists',

                targetKey
            };
        } catch (error) {
            return {
                ok:
                    false,

                migrated:
                    false,

                reason:
                    'existing-scoped-cache-invalid',

                targetKey,

                error
            };
        }
    }

    const legacy =
        await readKey(
            LEGACY_KEY
        );

    if (
        !legacy ||
        typeof legacy !==
            'object' ||
        Array.isArray(
            legacy
        )
    ) {
        return {
            ok:
                true,

            migrated:
                false,

            reason:
                'legacy-empty'
        };
    }

    const legacyState =
        extractState(
            legacy
        );

    const envelope =
        await buildEnvelope(
            legacyState,
            {
                access,

                migratedFrom:
                    LEGACY_KEY
            }
        );

    const {
        verification
    } =
        await writeEnvelopeVerified(
            targetKey,
            envelope,
            access
        );

    const legacyHash =
        await sha256(
            legacyState
        );

    if (
        verification.stateHash !==
        legacyHash
    ) {
        throw new Error(
            'Verifikasi migrasi cache legacy gagal; cache legacy dipertahankan.'
        );
    }

    const migrationMarker = {
        status:
            'verified',

        source:
            LEGACY_KEY,

        targetKey,

        uid:
            access.uid,

        role:
            access.role,

        workspaceId:
            access.workspaceId,

        classId:
            access.classId,

        academicYearId:
            access.activeAcademicYearId,

        sourceHash:
            legacyHash,

        targetHash:
            verification.stateHash,

        verifiedAt:
            nowISO()
    };

    await writeKey(
        LEGACY_MIGRATION_KEY,
        migrationMarker
    );

    const markerReadBack =
        await readKey(
            LEGACY_MIGRATION_KEY
        );

    if (
        markerReadBack
            ?.status !==
            'verified' ||
        markerReadBack
            ?.targetKey !==
            targetKey ||
        markerReadBack
            ?.sourceHash !==
            legacyHash ||
        markerReadBack
            ?.targetHash !==
            legacyHash
    ) {
        throw new Error(
            'Marker verifikasi migrasi legacy gagal disimpan.'
        );
    }

    await deleteKey(
        LEGACY_KEY
    );

    return {
        ok:
            true,

        migrated:
            true,

        sourceKey:
            LEGACY_KEY,

        targetKey,

        stateHash:
            legacyHash
    };
}

export async function migrateLegacyCacheIfNeeded() {
    let access;

    try {
        access =
            currentAccess();
    } catch (error) {
        return {
            ok:
                false,

            migrated:
                false,

            reason:
                'access-context-unavailable',

            error
        };
    }

    try {
        const scopedMigration =
            await migrateScopedSchema2IfNeeded(
                access
            );

        if (
            !scopedMigration.ok
        ) {
            return scopedMigration;
        }

        if (
            scopedMigration.migrated ||
            scopedMigration.reason ===
                'schema3-cache-exists'
        ) {
            return scopedMigration;
        }

        return await migrateUnscopedLegacyIfNeeded(
            access
        );
    } catch (error) {
        console.error(
            '[SIMNI Cache] Migrasi cache ditahan:',
            error
        );

        return {
            ok:
                false,

            migrated:
                false,

            error
        };
    }
}

export async function purgeLegacyUnscopedCache() {
    let access;

    try {
        access =
            currentAccess();

        assertLegacyOwner(
            access
        );
    } catch (error) {
        return {
            ok:
                false,

            purged:
                false,

            error
        };
    }

    try {
        const legacy =
            await readKey(
                LEGACY_KEY
            );

        if (!legacy) {
            return {
                ok:
                    true,

                purged:
                    false,

                reason:
                    'legacy-empty'
            };
        }

        const marker =
            await readKey(
                LEGACY_MIGRATION_KEY
            );

        const targetKey =
            accessCacheKey(
                access
            );

        if (
            marker
                ?.status !==
                'verified' ||
            marker
                ?.targetKey !==
                targetKey ||
            marker
                ?.uid !==
                access.uid ||
            marker
                ?.workspaceId !==
                access.workspaceId ||
            marker
                ?.academicYearId !==
                access.activeAcademicYearId
        ) {
            throw new Error(
                'Legacy cache tidak boleh dihapus sebelum migration marker VERIFIED cocok dengan scope aktif.'
            );
        }

        const target =
            await readKey(
                targetKey
            );

        await verifyEnvelope(
            target,
            access
        );

        const legacyHash =
            await sha256(
                extractState(
                    legacy
                )
            );

        if (
            legacyHash !==
                marker.sourceHash ||
            legacyHash !==
                marker.targetHash
        ) {
            throw new Error(
                'Hash cache legacy tidak cocok dengan migration marker.'
            );
        }

        await deleteKey(
            LEGACY_KEY
        );

        return {
            ok:
                true,

            purged:
                true
        };
    } catch (error) {
        console.error(
            '[SIMNI Cache] Purge legacy ditahan:',
            error
        );

        return {
            ok:
                false,

            purged:
                false,

            error
        };
    }
}

export async function purgeCurrentLocalCache(access = currentAccess()) {
    const keys = [
        accessCacheKey(access),
        previousScopedCacheKey(access)
    ];
    await writeQueue.catch(() => undefined);
    await Promise.all(keys.map((key) => deleteKey(key)));
    localRevision = 0;
    window.SIMNILocalCacheState = null;
    return { ok: true, purged: true, keys: keys.length };
}

function assertHealthySnapshotForPersistence() {
    const sync =
        window.SIMNISyncState;

    if (!sync) {
        throw new Error(
            'Sync state belum tersedia; cache tidak ditulis.'
        );
    }

    if (
        sync.status !==
            'ready' ||
        sync.initialComplete !==
            true
    ) {
        throw new Error(
            `Cache tidak ditulis karena sinkronisasi belum READY (${sync.status || 'unknown'}).`
        );
    }

    const bindings =
        Object.values(
            sync.bindings ||
            {}
        ).filter(
            (binding) =>
                binding?.required ===
                true
        );

    if (
        !bindings.length ||
        bindings.some(
            (binding) =>
                binding?.status !==
                'ready'
        )
    ) {
        throw new Error(
            'Cache tidak ditulis karena satu atau lebih binding wajib belum READY.'
        );
    }

    return sync;
}

export async function saveLocalBackup() {
    let access;
    let stateSnapshot;
    let syncRevision;

    try {
        access =
            currentAccess();

        const sync =
            assertHealthySnapshotForPersistence();

        syncRevision =
            Number(
                sync.revision ||
                0
            );

        stateSnapshot =
            persistedState(
                window.state
            );
        if (new TextEncoder().encode(JSON.stringify(stateSnapshot)).byteLength > MAX_SNAPSHOT_BYTES) {
            throw new Error('Salinan offline melebihi 32 MiB. Data cloud tidak dihapus; arsipkan dan tinjau retensi tahun ajaran.');
        }
    } catch (error) {
        return {
            ok:
                false,

            saved:
                false,

            reason:
                'cache-write-not-eligible',

            error
        };
    }

    return enqueueWrite(
        async () => {
            try {
                const key =
                    accessCacheKey(
                        access
                    );

                if (
                    String(
                        window
                            .SIMNICurrentAccess
                            ?.uid ||
                        ''
                    ) !==
                        String(
                            access.uid
                        ) ||
                    String(
                        window
                            .SIMNICurrentAccess
                            ?.workspaceId ||
                        ''
                    ) !==
                        String(
                            access.workspaceId
                        ) ||
                    String(
                        window
                            .SIMNICurrentAccess
                            ?.activeAcademicYearId ||
                        ''
                    ) !==
                        String(
                            access.activeAcademicYearId
                        )
                ) {
                    throw new Error(
                        'Scope berubah sebelum cache ditulis; snapshot lama dibatalkan.'
                    );
                }

                assertHealthySnapshotForPersistence();

                const envelope =
                    await buildEnvelope(
                        stateSnapshot,
                        {
                            access,

                            revision:
                                syncRevision
                        }
                    );

                const existing =
                    await readKey(
                        key
                    );

                if (existing) {
                    try {
                        const current =
                            await verifyEnvelope(
                                existing,
                                access
                            );

                        if (
                            current.revision >
                            envelope
                                .__cache
                                .revision
                        ) {
                            return {
                                ok:
                                    true,

                                saved:
                                    false,

                                reason:
                                    'newer-cache-already-exists',

                                key,

                                revision:
                                    current.revision
                            };
                        }

                        if (
                            current.stateHash ===
                            envelope
                                .__cache
                                .stateHash
                        ) {
                            return {
                                ok:
                                    true,

                                saved:
                                    false,

                                reason:
                                    'cache-unchanged',

                                key,

                                revision:
                                    current.revision,

                                stateHash:
                                    current.stateHash
                            };
                        }
                    } catch (error) {
                        console.warn(
                            '[SIMNI Cache] Existing cache invalid akan diganti snapshot sehat:',
                            error
                        );
                    }
                }

                const {
                    verification
                } =
                    await writeEnvelopeVerified(
                        key,
                        envelope,
                        access
                    );

                return {
                    ok:
                        true,

                    saved:
                        true,

                    key,

                    revision:
                        verification.revision,

                    stateHash:
                        verification.stateHash
                };
            } catch (error) {
                console.warn(
                    '[SIMNI Cache] Gagal menyimpan cache terisolasi:',
                    error
                );

                return {
                    ok:
                        false,

                    saved:
                        false,

                    error
                };
            }
        }
    );
}

function applyCachedState(
    cachedState
) {
    if (
        !window.state ||
        typeof window.state !==
            'object'
    ) {
        throw new Error(
            'State aplikasi belum tersedia.'
        );
    }

    const normalized =
        persistedState(
            cachedState
        );

    Object.assign(
        window.state,
        normalized
    );

    window.state.scannerInstance =
        null;
}

export async function loadLocalBackup() {
    let access;

    try {
        access =
            currentAccess();
    } catch (error) {
        return {
            ok:
                false,

            loaded:
                false,

            reason:
                'access-context-unavailable',

            error
        };
    }

    try {
        const migration =
            await migrateScopedSchema2IfNeeded(
                access
            );

        if (
            !migration.ok
        ) {
            return {
                ok:
                    false,

                loaded:
                    false,

                reason:
                    migration.reason ||
                    'scoped-cache-migration-failed',

                error:
                    migration.error ||
                    null
            };
        }

        const key =
            accessCacheKey(
                access
            );

        const cached =
            await readKey(
                key
            );

        if (!cached) {
            return {
                ok:
                    true,

                loaded:
                    false,

                reason:
                    'cache-empty',

                key
            };
        }

        const verification =
            await verifyEnvelope(
                cached,
                access
            );

        localRevision =
            Math.max(
                localRevision,
                verification.revision
            );

        applyCachedState(
            verification.state
        );

        window.SIMNILocalCacheState = {
            loaded: true,
            revision: verification.revision,
            stateHash: verification.stateHash,
            savedAt: cached.__cache?.savedAt || null
        };

        return {
            ok:
                true,

            loaded:
                true,

            key,

            revision:
                verification.revision,

            stateHash:
                verification.stateHash,

            savedAt:
                cached.__cache
                    ?.savedAt ||
                null
        };
    } catch (error) {
        console.warn(
            '[SIMNI Cache] Cache workspace tidak dapat dimuat:',
            error
        );

        return {
            ok:
                false,

            loaded:
                false,

            error
        };
    }
}

export async function getLocalCacheDiagnostics() {
    let access;

    try {
        access =
            currentAccess();

        const key =
            accessCacheKey(
                access
            );

        const cached =
            await readKey(
                key
            );

        if (!cached) {
            return {
                ok:
                    true,

                exists:
                    false,

                key,

                scope:
                    cacheScope(
                        access
                    )
            };
        }

        const verification =
            await verifyEnvelope(
                cached,
                access
            );

        return {
            ok:
                true,

            exists:
                true,

            key,

            scope:
                cacheScope(
                    access
                ),

            revision:
                verification.revision,

            stateHash:
                verification.stateHash,

            savedAt:
                cached.__cache
                    ?.savedAt ||
                null,

            migratedFrom:
                cached.__cache
                    ?.migratedFrom ||
                null
        };
    } catch (error) {
        return {
            ok:
                false,

            exists:
                false,

            error
        };
    }
}

function sameCacheOwner(record, access) {
    return record?.__scope?.uid === access.uid && record.__scope.workspaceId === access.workspaceId &&
        record.__scope.role === access.role;
}

export async function listLocalCacheInventory() {
    const access = { ...currentAccess() };
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const rows = [];
            let totalBytes = 0;
            const transaction = database.transaction(STORE_NAME);
            const request = transaction.objectStore(STORE_NAME).openCursor();
            request.onerror = () => reject(request.error);
            transaction.onabort = () => reject(transaction.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) { resolve({ rows, totalBytes, limitBytes: MAX_DATABASE_BYTES }); return; }
                const record = cursor.value;
                const bytes = new Blob([JSON.stringify(record)]).size;
                totalBytes += bytes;
                if (sameCacheOwner(record, access)) rows.push({ key: cursor.key, bytes,
                    year: record.__scope.activeAcademicYearId, savedAt: record.__cache?.savedAt || '',
                    current: cursor.key === accessCacheKey(access) });
                cursor.continue();
            };
        });
    } finally { database.close(); }
}

export async function exportLocalCacheRecord(key) {
    const access = { ...currentAccess() };
    const record = await readKey(key);
    if (!sameCacheOwner(record, access)) throw new Error('Cache bukan milik akun/workspace aktif.');
    return { format: 'simni-local-cache-export-v1', key, exportedAt: nowISO(), hash: await sha256(record), record };
}

export async function deleteLocalCacheAfterVerification(key, exported) {
    const access = { ...currentAccess() };
    if (key === accessCacheKey(access)) throw new Error('Cache tahun aktif dipertahankan.');
    if (exported?.format !== 'simni-local-cache-export-v1' || exported.key !== key ||
        !sameCacheOwner(exported.record, access) || exported.hash !== await sha256(exported.record)) {
        throw new Error('Berkas ekspor tidak cocok atau rusak. Cache dipertahankan.');
    }
    const expected = stableStringify(exported.record);
    await writeQueue.catch(() => undefined);
    const database = await openDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            let refusal;
            request.onsuccess = () => {
                if (access.uid !== currentAccess().uid || access.workspaceId !== currentAccess().workspaceId ||
                    access.activeAcademicYearId !== currentAccess().activeAcademicYearId ||
                    !sameCacheOwner(request.result, access) || stableStringify(request.result) !== expected) {
                    refusal = new Error('Sesi atau cache berubah sejak ekspor. Ekspor ulang sebelum menghapus.');
                    transaction.abort(); return;
                }
                store.delete(key);
            };
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(refusal || transaction.error);
        });
    } finally { database.close(); }
    return { ok: true };
}

async function inspectDraftsStorage() {
    if (typeof indexedDB === 'undefined') return { count: 0, totalBytes: 0, drafts: [] };
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open('SIMNIDraftsDB', 1);
            req.onerror = () => resolve({ count: 0, totalBytes: 0, drafts: [] });
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('academicDrafts')) {
                    db.close();
                    resolve({ count: 0, totalBytes: 0, drafts: [] });
                    return;
                }
                const tx = db.transaction('academicDrafts', 'readonly');
                const store = tx.objectStore('academicDrafts');
                const getAll = store.getAll();
                getAll.onsuccess = () => {
                    const items = getAll.result || [];
                    let bytes = 0;
                    const summaries = items.map((item) => {
                        const itemBytes = new Blob([JSON.stringify(item)]).size;
                        bytes += itemBytes;
                        return {
                            id: item.id,
                            session: item.session,
                            date: item.date || null,
                            classId: item.classId || null,
                            formId: item.formId || null,
                            bytes: itemBytes,
                            updatedAt: item.updatedAt || null
                        };
                    });
                    db.close();
                    resolve({ count: items.length, totalBytes: bytes, drafts: summaries });
                };
                getAll.onerror = () => { db.close(); resolve({ count: 0, totalBytes: 0, drafts: [] }); };
            };
        } catch (_) {
            resolve({ count: 0, totalBytes: 0, drafts: [] });
        }
    });
}

async function inspectGADMStorage() {
    if (typeof indexedDB === 'undefined') return { documentCount: 0, draftCount: 0, totalBytes: 0 };
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open('simni-gadm-offline', 1);
            req.onerror = () => resolve({ documentCount: 0, draftCount: 0, totalBytes: 0 });
            req.onsuccess = () => {
                const db = req.result;
                let docCount = 0, draftCount = 0, totalBytes = 0;
                const storeNames = [];
                if (db.objectStoreNames.contains('documents')) storeNames.push('documents');
                if (db.objectStoreNames.contains('drafts')) storeNames.push('drafts');
                if (!storeNames.length) { db.close(); resolve({ documentCount: 0, draftCount: 0, totalBytes: 0 }); return; }

                const tx = db.transaction(storeNames, 'readonly');
                let pendingStores = storeNames.length;

                const finishStore = () => {
                    pendingStores--;
                    if (pendingStores === 0) {
                        db.close();
                        resolve({ documentCount: docCount, draftCount, totalBytes });
                    }
                };

                if (db.objectStoreNames.contains('documents')) {
                    const docReq = tx.objectStore('documents').getAll();
                    docReq.onsuccess = () => {
                        const docs = docReq.result || [];
                        docCount = docs.length;
                        for (const doc of docs) totalBytes += new Blob([JSON.stringify(doc)]).size;
                        finishStore();
                    };
                    docReq.onerror = finishStore;
                }
                if (db.objectStoreNames.contains('drafts')) {
                    const draftReq = tx.objectStore('drafts').getAll();
                    draftReq.onsuccess = () => {
                        const drafts = draftReq.result || [];
                        draftCount = drafts.length;
                        for (const d of drafts) totalBytes += new Blob([JSON.stringify(d)]).size;
                        finishStore();
                    };
                    draftReq.onerror = finishStore;
                }
            };
        } catch (_) {
            resolve({ documentCount: 0, draftCount: 0, totalBytes: 0 });
        }
    });
}

async function inspectServiceWorkerCaches() {
    if (typeof caches === 'undefined' || typeof caches.keys !== 'function') {
        return { totalBytes: 0, cacheCount: 0, entryCount: 0, caches: [] };
    }
    try {
        const cacheNames = await caches.keys();
        const cacheList = [];
        let totalBytes = 0;
        let entryCount = 0;
        for (const name of cacheNames) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            entryCount += requests.length;
            let cacheBytes = 0;
            for (const req of requests) {
                try {
                    const res = await cache.match(req);
                    if (res) {
                        const buf = await res.clone().arrayBuffer();
                        cacheBytes += buf.byteLength;
                    }
                } catch (_) {}
            }
            totalBytes += cacheBytes;
            cacheList.push({ name, entries: requests.length, bytes: cacheBytes });
        }
        return { totalBytes, cacheCount: cacheNames.length, entryCount, caches: cacheList };
    } catch (_) {
        return { totalBytes: 0, cacheCount: 0, entryCount: 0, caches: [] };
    }
}

export async function getCompleteStorageInventory() {
    let access = null;
    try { access = currentAccess(); } catch (_) {}

    const academic = await listLocalCacheInventory().catch(() => ({ rows: [], totalBytes: 0, limitBytes: MAX_DATABASE_BYTES }));
    const drafts = await inspectDraftsStorage();
    const gadm = await inspectGADMStorage();
    const swCaches = await inspectServiceWorkerCaches();

    let storageEstimate = { usage: null, quota: null, isEstimated: true };
    if (typeof navigator !== 'undefined' && typeof navigator.storage?.estimate === 'function') {
        try {
            const est = await navigator.storage.estimate();
            storageEstimate = {
                usage: typeof est.usage === 'number' ? est.usage : null,
                quota: typeof est.quota === 'number' ? est.quota : null,
                isEstimated: true
            };
        } catch (_) {}
    }

    const totalMeasuredPayloadBytes = academic.totalBytes + drafts.totalBytes + gadm.totalBytes + swCaches.totalBytes;

    const approachingQuota = (storageEstimate.quota && storageEstimate.usage && (storageEstimate.usage / storageEstimate.quota > 0.8)) ||
        (academic.totalBytes > 75 * 1024 * 1024);

    return {
        measuredPayload: {
            academicCacheBytes: academic.totalBytes,
            academicRows: academic.rows,
            draftsBytes: drafts.totalBytes,
            draftCount: drafts.count,
            draftSummaries: drafts.drafts,
            gadmBytes: gadm.totalBytes,
            gadmDocumentCount: gadm.documentCount,
            gadmDraftCount: gadm.draftCount,
            swCacheBytes: swCaches.totalBytes,
            swEntryCount: swCaches.entryCount,
            swCaches: swCaches.caches,
            totalMeasuredBytes: totalMeasuredPayloadBytes
        },
        browserEstimate: storageEstimate,
        warnings: {
            approachingQuota: !!approachingQuota,
            hasUnsentDrafts: drafts.count > 0,
            unsentDraftCount: drafts.count
        },
        classification: {
            safeToPurge: ['Service Worker Runtime Cache', 'Expired Caches'],
            protected: [
                'Tahun Aktif Akademik',
                'Draf Formulir Belum Terkirim (SIMNIDraftsDB)',
            ]
        }
    };
}

export async function purgeSafeCaches() {
    let purgedBytes = 0;
    const purgedNames = [];
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
        try {
            const names = await caches.keys();
            for (const name of names) {
                // App-shell caches can still belong to open tabs. Only disposable
                // runtime entries owned by SIMNI are eligible for this action.
                if (!/^simni-runtime-[A-Za-z0-9._-]+$/.test(name)) continue;
                const cache = await caches.open(name);
                const reqs = await cache.keys();
                for (const r of reqs) {
                    try {
                        const res = await cache.match(r);
                        if (res) purgedBytes += (await res.clone().arrayBuffer()).byteLength;
                    } catch (_) {}
                }
                await caches.delete(name);
                purgedNames.push(name);
            }
        } catch (e) {
            console.warn('[SIMNI Storage] Safe cache purge error:', e);
        }
    }
    return {
        ok: true,
        purgedCaches: purgedNames,
        purgedBytes,
        preserved: [
            'SIMNIDraftsDB (Draf Formulir Belum Terkirim)',
            'AdminKelasDB (Cache Akademik Tahun Aktif)',
        ]
    };
}

if (typeof window !== 'undefined') {
    window.openLocalStorageManager = async function () {
        const access = { ...currentAccess() };
        const completeInventory = await getCompleteStorageInventory();
        if (access.uid !== currentAccess().uid || access.workspaceId !== currentAccess().workspaceId) return;
        document.getElementById('simni-storage-manager')?.remove();
        const dialog = document.createElement('dialog');
    dialog.id = 'simni-storage-manager';
    dialog.style.cssText = 'max-width:640px;width:92%;max-height:85vh;overflow:auto;padding:24px;border-radius:16px;border:1px solid #e2e8f0;';

    const title = document.createElement('h2');
    title.className = 'font-bold text-base mb-2 text-slate-800 dark:text-white';
    title.innerHTML = '<i class="fas fa-server text-primary mr-2"></i>Penyimpanan Perangkat & Inventaris Subsistem';

    const estimateText = completeInventory.browserEstimate.quota
        ? `${(completeInventory.browserEstimate.usage / 1048576).toFixed(1)} MiB dari ${(completeInventory.browserEstimate.quota / (1024 * 1024 * 1024)).toFixed(2)} GiB kuota browser`
        : 'Tidak dilaporkan oleh browser';

    const summary = document.createElement('div');
    summary.className = 'p-3 rounded-xl bg-slate-100 dark:bg-[#1a1a1a] text-xs space-y-1 mb-3';
    summary.innerHTML = `
        <div class="font-bold text-slate-800 dark:text-slate-200">Perkiraan Storage Browser (Termasuk Metadata/SQLite):</div>
        <div class="text-slate-600 dark:text-slate-400">${estimateText}</div>
        <div class="font-bold text-slate-800 dark:text-slate-200 mt-2">Total Ukuran Payload Terukur:</div>
        <div class="text-primary font-extrabold">${(completeInventory.measuredPayload.totalMeasuredBytes / 1048576).toFixed(2)} MiB</div>
    `;

    dialog.append(title, summary);

    // Warning banner if unsent drafts or approaching quota
    if (completeInventory.warnings.hasUnsentDrafts) {
        const warnDraft = document.createElement('div');
        warnDraft.className = 'p-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold';
        warnDraft.innerHTML = `<i class="fas fa-exclamation-triangle mr-1.5"></i>PERINGATAN: Terdapat ${completeInventory.warnings.unsentDraftCount} draf formulir yang belum dikirim ke server. Draf ini aman tersimpan di perangkat dan dilindungi dari pembersihan otomatis.`;
        dialog.append(warnDraft);
    }
    if (completeInventory.warnings.approachingQuota) {
        const warnQuota = document.createElement('div');
        warnQuota.className = 'p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 text-xs font-bold';
        warnQuota.innerHTML = '<i class="fas fa-exclamation-circle mr-1.5"></i>PERINGATAN KAPASITAS: Penyimpanan perangkat mendekati ambang batas kapasitas.';
        dialog.append(warnQuota);
    }

    // Breakdown subsistem
    const breakdown = document.createElement('div');
    breakdown.className = 'space-y-2 mb-4';

    const pAkademik = document.createElement('div');
    pAkademik.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs';
    pAkademik.innerHTML = `
        <div class="flex justify-between font-bold text-slate-700 dark:text-slate-200">
            <span>Cache Akademik & LPS (IndexedDB)</span>
            <span>${(completeInventory.measuredPayload.academicCacheBytes / 1048576).toFixed(2)} MiB</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">Tahun aktif dipertahankan. Tahun lama dapat diverifikasi dan dibersihkan secara selektif.</div>
    `;
    breakdown.append(pAkademik);

    const pDrafts = document.createElement('div');
    pDrafts.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs';
    pDrafts.innerHTML = `
        <div class="flex justify-between font-bold text-slate-700 dark:text-slate-200">
            <span>Draf Formulir Belum Terkirim (SIMNIDraftsDB)</span>
            <span>${completeInventory.measuredPayload.draftCount} draf · ${(completeInventory.measuredPayload.draftBytes / 1024).toFixed(1)} KiB</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">Pekerjaan lokal yang belum dikirim ke server. Dilindungi dari pembersihan otomatis.</div>
    `;
    breakdown.append(pDrafts);

    const pGadm = document.createElement('div');
    pGadm.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs';
    pGadm.innerHTML = `
        <div class="flex justify-between font-bold text-slate-700 dark:text-slate-200">
            <span>Penyimpanan GADM Offline (IndexedDB)</span>
            <span>${completeInventory.measuredPayload.gadmDocumentCount} dokumen · ${(completeInventory.measuredPayload.gadmBytes / 1048576).toFixed(2)} MiB</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">Dokumen modul ajar, prota, promes lokal. Ekspor tersedia di menu GADM.</div>
    `;
    breakdown.append(pGadm);

    const pSw = document.createElement('div');
    pSw.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs';
    pSw.innerHTML = `
        <div class="flex justify-between font-bold text-slate-700 dark:text-slate-200">
            <span>Cache Service Worker (PWA Offline)</span>
            <span>${completeInventory.measuredPayload.swEntryCount} berkas · ${(completeInventory.measuredPayload.swCacheBytes / 1048576).toFixed(2)} MiB</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">Aset PWA offline yang aman dibuat ulang saat terhubung ke jaringan.</div>
    `;
    breakdown.append(pSw);

    dialog.append(breakdown);

    // Safe purge button
    const actionsRow = document.createElement('div');
    actionsRow.className = 'flex flex-col sm:flex-row gap-2 mb-4';

    const safePurgeBtn = document.createElement('button');
    safePurgeBtn.type = 'button';
    safePurgeBtn.className = 'flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer';
    safePurgeBtn.textContent = 'Bersihkan Cache Aman (SW Runtime)';
    safePurgeBtn.onclick = async () => {
        if (!confirm('Bersihkan cache Service Worker yang dapat diunduh ulang? Draf dan data akademik aktif tidak akan dihapus.')) return;
        const res = await purgeSafeCaches();
        if (res.ok) {
            alert(`Cache aman dibersihkan (${(res.purgedBytes / 1048576).toFixed(2)} MiB dibebaskan). Draf dan data aktif tetap terjaga.`);
            dialog.close(); dialog.remove();
        }
    };
    actionsRow.append(safePurgeBtn);

    const recoveryGuideBtn = document.createElement('button');
    recoveryGuideBtn.type = 'button';
    recoveryGuideBtn.className = 'flex-1 py-2.5 px-3 bg-slate-800 dark:bg-[#222222] hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer';
    recoveryGuideBtn.textContent = 'Panduan Pemulihan Subsistem';
    recoveryGuideBtn.onclick = () => {
        dialog.close(); dialog.remove();
        if (typeof window.openSubsystemRecoveryGuide === 'function') window.openSubsystemRecoveryGuide();
    };
    actionsRow.append(recoveryGuideBtn);

    dialog.append(actionsRow);

    // Detail tahun akademik
    const detailTitle = document.createElement('h3');
    detailTitle.className = 'font-bold text-xs text-slate-700 dark:text-slate-300 uppercase mb-2';
    detailTitle.textContent = 'Riwayat Cache Akademik per Tahun:';
    dialog.append(detailTitle);

    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'text-xs text-slate-600 dark:text-slate-400 mb-2';
    dialog.append(status);

    for (const row of completeInventory.measuredPayload.academicRows) {
        const article = document.createElement('div');
        article.className = 'flex items-center justify-between p-2 mb-2 bg-slate-50 dark:bg-[#111111] rounded-lg border text-xs';
        const info = document.createElement('span');
        info.textContent = `${row.year} · ${(row.bytes / 1048576).toFixed(2)} MiB${row.current ? ' (Aktif — Terlindungi)' : ''}`;
        article.append(info);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex items-center gap-1.5';

        const download = document.createElement('button');
        download.className = 'px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded font-bold text-[11px]';
        download.textContent = 'Ekspor';
        download.onclick = async () => {
            try {
                const payload = await exportLocalCacheRecord(row.key);
                const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                const anchor = document.createElement('a'); anchor.href = url; anchor.download = `SIMNI_cache_${row.year}.json`; anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                status.textContent = 'Simpan berkas JSON, lalu pilih kembali untuk verifikasi sebelum menghapus cache tahun lama.';
            } catch (error) { status.textContent = error.message; }
        };
        btnGroup.append(download);

        if (!row.current) {
            const verifyLabel = document.createElement('label');
            verifyLabel.className = 'px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded font-bold text-[11px] cursor-pointer';
            verifyLabel.textContent = 'Hapus (Verifikasi)';
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.className = 'hidden';
            input.onchange = async () => {
                try {
                    const file = input.files?.[0]; if (!file) return;
                    if (file.size > MAX_DATABASE_BYTES) throw new Error('Berkas terlalu besar.');
                    const payload = JSON.parse(await file.text());
                    if (!confirm(`Hapus cache lokal tahun ${row.year} setelah mencocokkan berkas ekspor? Data cloud tetap tersedia sesuai retensinya.`)) return;
                    await deleteLocalCacheAfterVerification(row.key, payload);
                    article.remove(); status.textContent = 'Berkas cocok. Cache lokal yang dipilih telah dihapus.';
                } catch (error) { status.textContent = error.message; }
            };
            verifyLabel.append(input);
            btnGroup.append(verifyLabel);
        }

        article.append(btnGroup);
        dialog.append(article);
    }

    const close = document.createElement('button');
    close.className = 'w-full mt-3 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer';
    close.textContent = 'Tutup';
    close.onclick = () => { dialog.close(); dialog.remove(); };
    dialog.append(close);

    document.body.append(dialog);
    dialog.showModal();
};
}

const SIMNILocalCache =
    Object.freeze({
        migrateLegacyCacheIfNeeded,
        purgeLegacyUnscopedCache,
        purgeCurrentLocalCache,
        listLocalCacheInventory,
        getCompleteStorageInventory,
        purgeSafeCaches,
        exportLocalCacheRecord,
        deleteLocalCacheAfterVerification,
        saveLocalBackup,
        loadLocalBackup,

        getDiagnostics:
            getLocalCacheDiagnostics
    });

if (typeof window !== 'undefined') {
    Object.assign(
        window,
        {
            loadLocalBackup,
            saveLocalBackup,
            migrateLegacyCacheIfNeeded,
            purgeLegacyUnscopedCache,
            purgeCurrentLocalCache,
            getCompleteStorageInventory,
            purgeSafeCaches,

            getSIMNILocalCacheDiagnostics:
                getLocalCacheDiagnostics,

            SIMNILocalCache
        }
    );
}

export default SIMNILocalCache;
