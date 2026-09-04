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
            'ws_3a' ||
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

        transaction
            .objectStore(
                STORE_NAME
            )
            .put(
                value,
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
                                'Transaksi IndexedDB gagal.'
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
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

const SIMNILocalCache =
    Object.freeze({
        migrateLegacyCacheIfNeeded,
        purgeLegacyUnscopedCache,
        purgeCurrentLocalCache,
        saveLocalBackup,
        loadLocalBackup,

        getDiagnostics:
            getLocalCacheDiagnostics
    });

Object.assign(
    window,
    {
        loadLocalBackup,

        saveLocalBackup,

        migrateLegacyCacheIfNeeded,

    purgeLegacyUnscopedCache,
    purgeCurrentLocalCache,

        getSIMNILocalCacheDiagnostics:
            getLocalCacheDiagnostics,

        SIMNILocalCache
    }
);

export default SIMNILocalCache;
