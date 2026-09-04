// ==========================================
// FILE: features/archive/archive.js
// FUNGSI:
// Arsip tahunan Firebase terpisah dari Backup JSON/Excel.
// Archive-gated reset, workspace-scoped, SHA-256 verified.
// ==========================================

(function initSIMNIAnnualArchive() {
    'use strict';

    const ARCHIVE_FORMAT = 'simni-pwa-annual-archive';
    const ARCHIVE_VERSION = 2;

    const runtime = {
        createBusy: false,
        verifyBusy: false,
        lastOperation: null
    };

    function notify(message, type = 'info') {
        if (typeof window.toast === 'function') {
            window.toast(message, type);
            return;
        }

        console.log(
            `[SIMNI Archive:${type}]`,
            message
        );
    }

    function showProgress(message) {
        if (typeof window.showLoad === 'function') {
            window.showLoad(message);
        }
    }

    function hideProgress() {
        if (typeof window.hideLoad === 'function') {
            window.hideLoad();
        }
    }

    function access() {
        return (
            window.SIMNICurrentAccess ||
            null
        );
    }

    function backupCore() {
        return (
            window.SIMNIBackupCore ||
            null
        );
    }

    function backupFeature() {
        return (
            window.SIMNIBackup ||
            null
        );
    }

    function nowISO() {
        return new Date()
            .toISOString();
    }

    function cleanText(value) {
        return String(
            value ??
            ''
        ).trim();
    }

    function normalizeError(
        error,
        fallback = 'Operasi arsip gagal.'
    ) {
        if (error instanceof Error) {
            return error;
        }

        return new Error(
            cleanText(
                error?.message ||
                error
            ) ||
            fallback
        );
    }

    function requireArchiveAccess() {
        if (
            window.SIMNIAccess
                ?.canAccess(
                    'archive'
                ) !==
            true
        ) {
            throw new Error(
                'Role tidak memiliki izin arsip.'
            );
        }

        const current =
            access();

        if (
            !current ||
            current.status !==
                'active' ||
            !cleanText(
                current.uid
            ) ||
            !cleanText(
                current.workspaceId
            ) ||
            !cleanText(
                current.classId
            ) ||
            !cleanText(
                current.activeAcademicYearId
            ) ||
            !cleanText(
                current.role
            )
        ) {
            throw new Error(
                'Access context arsip belum siap.'
            );
        }

        return current;
    }

    function requireOnlineDatabase() {
        if (
            !window.isUserLoggedIn
        ) {
            throw new Error(
                'Login Firebase aktif diperlukan untuk arsip.'
            );
        }

        if (
            typeof navigator !==
                'undefined' &&
            navigator.onLine ===
                false
        ) {
            throw new Error(
                'Arsip tahunan memerlukan koneksi ke Firebase cloud asli.'
            );
        }

        if (
            typeof window.dbPutAnnualArchive !==
                'function' ||
            typeof window.dbGetAnnualArchives !==
                'function'
        ) {
            throw new Error(
                'Repository arsip Firebase belum siap.'
            );
        }
    }

    function requireBackupAuthority() {
        const core =
            backupCore();

        const feature =
            backupFeature();

        if (
            !core ||
            typeof core.sha256 !==
                'function' ||
            typeof core.verifyEnvelope !==
                'function' ||
            typeof core.summarizeDatabase !==
                'function'
        ) {
            throw new Error(
                'SIMNIBackupCore belum siap.'
            );
        }

        if (
            !feature ||
            typeof feature.buildCurrentEnvelope !==
                'function'
        ) {
            throw new Error(
                'Authority backup belum siap.'
            );
        }

        return {
            core,
            feature
        };
    }

    function randomSuffix() {
        try {
            if (
                typeof window.crypto
                    ?.randomUUID ===
                'function'
            ) {
                return window.crypto
                    .randomUUID()
                    .replace(
                        /-/g,
                        ''
                    )
                    .slice(
                        0,
                        12
                    );
            }
        } catch (_) {
            /*
             * Fallback hanya untuk collision avoidance,
             * bukan secret / token keamanan.
             */
        }

        return Math.random()
            .toString(36)
            .slice(
                2,
                14
            );
    }

    function archiveId() {
        const stamp =
            nowISO()
                .replace(
                    /[-:.TZ]/g,
                    ''
                );

        return (
            `AR-${stamp}-` +
            randomSuffix()
        );
    }

    function assertEnvelopeScope(
        envelope,
        current
    ) {
        const scope =
            envelope
                ?.scope ||
            {};

        if (
            cleanText(
                scope.workspaceId
            ) !==
            cleanText(
                current.workspaceId
            )
        ) {
            throw new Error(
                'Envelope arsip berasal dari workspace berbeda.'
            );
        }

        if (
            cleanText(
                scope.academicYearId
            ) !==
            cleanText(
                current.activeAcademicYearId
            )
        ) {
            throw new Error(
                'Envelope arsip berasal dari tahun pelajaran berbeda.'
            );
        }

        if (
            cleanText(
                scope.classId
            ) !==
            cleanText(
                current.classId
            )
        ) {
            throw new Error(
                'Envelope arsip berasal dari kelas/scope berbeda.'
            );
        }

        if (
            cleanText(
                scope.role
            ) !==
            cleanText(
                current.role
            )
        ) {
            throw new Error(
                'Envelope arsip berasal dari role berbeda.'
            );
        }

        return true;
    }

    function assertEnvelopeComplete(
        envelope
    ) {
        const incomplete =
            Array.isArray(
                envelope
                    ?.incompletePaths
            )
                ? envelope
                    .incompletePaths
                    .filter(
                        Boolean
                    )
                : [];

        if (
            envelope
                ?.completeness
                ?.complete ===
                false ||
            incomplete.length
        ) {
            throw new Error(
                (
                    `Arsip ditolak karena ${incomplete.length} ` +
                    'alur belum terbaca lengkap dari Firebase'
                ) +
                (
                    incomplete.length
                        ? `: ${incomplete.join(', ')}`
                        : '.'
                )
            );
        }

        if (
            !envelope
                ?.database ||
            typeof envelope.database !==
                'object' ||
            Array.isArray(
                envelope.database
            )
        ) {
            throw new Error(
                'Snapshot database arsip tidak valid.'
            );
        }

        if (
            cleanText(
                envelope
                    ?.integrity
                    ?.algorithm
            )
                .toUpperCase() !==
                'SHA-256' ||
            !/^[a-f0-9]{64}$/i.test(
                cleanText(
                    envelope
                        ?.integrity
                        ?.hash
                )
            )
        ) {
            throw new Error(
                'Envelope arsip tidak memiliki SHA-256 valid.'
            );
        }

        return true;
    }

    async function buildVerifiedCurrentEnvelope() {
        const current =
            requireArchiveAccess();

        requireOnlineDatabase();

        const {
            core,
            feature
        } =
            requireBackupAuthority();

        const envelope =
            await feature
                .buildCurrentEnvelope();

        assertEnvelopeComplete(
            envelope
        );

        assertEnvelopeScope(
            envelope,
            current
        );

        const verification =
            await core
                .verifyEnvelope(
                    envelope
                );

        if (
            verification?.ok !==
            true
        ) {
            throw new Error(
                'Integritas SHA-256 snapshot aktif gagal diverifikasi.'
            );
        }

        return {
            current,
            core,
            envelope,
            verification
        };
    }

    function archivePayloadFromEnvelope(
        id,
        envelope,
        current
    ) {
        const core =
            backupCore();

        const userMeta =
            typeof window
                .getCurrentUserMeta ===
            'function'
                ? window
                    .getCurrentUserMeta()
                : {
                    uid:
                        current.uid,

                    role:
                        current.role,

                    workspaceId:
                        current.workspaceId,

                    classId:
                        current.classId,

                    activeAcademicYearId:
                        current.activeAcademicYearId
                };

        return {
            format:
                ARCHIVE_FORMAT,

            version:
                ARCHIVE_VERSION,

            archiveId:
                id,

            createdAt:
                nowISO(),

            verified:
                false,

            verifiedAt:
                null,

            appVersion:
                envelope.appVersion ||
                window.SIMNI_APP_VERSION ||
                null,

            sourceBackupVersion:
                envelope.version,

            sourceBackupSchemaVersion:
                envelope.schemaVersion ||
                null,

            scope: {
                uid:
                    cleanText(
                        envelope
                            ?.scope
                            ?.uid ||
                        current.uid
                    ) ||
                    null,

                role:
                    current.role,

                workspaceId:
                    current.workspaceId,

                classId:
                    current.classId,

                academicYearId:
                    current.activeAcademicYearId
            },

            createdBy:
                envelope.createdBy ||
                userMeta,

            integrity: {
                algorithm:
                    'SHA-256',

                hash:
                    cleanText(
                        envelope
                            .integrity
                            .hash
                    )
            },

            completeness: {
                complete:
                    true,

                requiredPathCount:
                    Number(
                        envelope
                            ?.completeness
                            ?.requiredPathCount ||
                        core
                            ?.DATA_PATHS
                            ?.length ||
                        0
                    )
            },

            recoveryCoverage:
                envelope.recoveryCoverage ||
                null,

            summary:
                core
                    .summarizeDatabase(
                        envelope.database
                    ),

            counts:
                envelope.counts ||
                null,

            database:
                typeof core.deepClone ===
                    'function'
                    ? core.deepClone(
                        envelope.database
                    )
                    : JSON.parse(
                        JSON.stringify(
                            envelope.database
                        )
                    )
        };
    }

    async function verifyAnnualArchive(
        archive,
        {
            requireCurrentScope = true,
            requireCurrentHash = false,
            currentEnvelope = null
        } = {}
    ) {
        const current =
            requireArchiveAccess();

        const core =
            backupCore();

        if (
            !core ||
            typeof core.sha256 !==
                'function'
        ) {
            return {
                ok:
                    false,

                reason:
                    'backup-core-unavailable'
            };
        }

        if (
            !archive ||
            typeof archive !==
                'object' ||
            Array.isArray(
                archive
            )
        ) {
            return {
                ok:
                    false,

                reason:
                    'invalid-archive'
            };
        }

        if (
            archive.format !==
                ARCHIVE_FORMAT ||
            Number(
                archive.version
            ) >
                ARCHIVE_VERSION
        ) {
            return {
                ok:
                    false,

                reason:
                    'unsupported-archive-format'
            };
        }

        if (
            archive.verified !==
            true
        ) {
            return {
                ok:
                    false,

                reason:
                    'archive-not-marked-verified'
            };
        }

        if (
            requireCurrentScope
        ) {
            try {
                assertEnvelopeScope(
                    {
                        scope:
                            archive.scope
                    },
                    current
                );
            } catch (
                error
            ) {
                return {
                    ok:
                        false,

                    reason:
                        'scope-mismatch',

                    error
                };
            }
        }

        const expectedHash =
            cleanText(
                archive
                    ?.integrity
                    ?.hash
            );

        if (
            !/^[a-f0-9]{64}$/i.test(
                expectedHash
            )
        ) {
            return {
                ok:
                    false,

                reason:
                    'missing-or-invalid-hash'
            };
        }

        const actualHash =
            await core
                .sha256(
                    archive.database ||
                    {}
                );

        if (
            actualHash !==
            expectedHash
        ) {
            return {
                ok:
                    false,

                reason:
                    'archive-hash-mismatch',

                expected:
                    expectedHash,

                actual:
                    actualHash
            };
        }

        if (
            requireCurrentHash
        ) {
            const activeEnvelope =
                currentEnvelope ||
                (
                    await buildVerifiedCurrentEnvelope()
                ).envelope;

            const currentHash =
                cleanText(
                    activeEnvelope
                        ?.integrity
                        ?.hash
                );

            if (
                !currentHash ||
                currentHash !==
                    expectedHash
            ) {
                return {
                    ok:
                        false,

                    reason:
                        'archive-is-stale',

                    expected:
                        currentHash ||
                        null,

                    actual:
                        expectedHash
                };
            }
        }

        return {
            ok:
                true,

            archiveId:
                archive.archiveId ||
                null,

            hash:
                expectedHash
        };
    }

    async function createAnnualArchiveCloud() {
        if (
            runtime.createBusy
        ) {
            notify(
                'Pembuatan arsip masih berlangsung.',
                'info'
            );

            return {
                ok:
                    false,

                reason:
                    'busy'
            };
        }

        runtime.createBusy =
            true;

        showProgress(
            'Membuat dan memverifikasi arsip workspace tahunan...'
        );

        try {
            const {
                current,
                core,
                envelope
            } =
                await buildVerifiedCurrentEnvelope();

            const id =
                archiveId();

            const payload =
                archivePayloadFromEnvelope(
                    id,
                    envelope,
                    current
                );

            const firstWrite =
                await window
                    .dbPutAnnualArchive(
                        id,
                        payload
                    );

            if (
                firstWrite?.ok !==
                    true ||
                !firstWrite.value
            ) {
                throw normalizeError(
                    firstWrite?.error,
                    'Penyimpanan arsip ditolak.'
                );
            }

            const firstReadBack =
                firstWrite.value;

            const firstHash =
                await core
                    .sha256(
                        firstReadBack.database ||
                        {}
                    );

            if (
                firstHash !==
                payload.integrity.hash
            ) {
                throw new Error(
                    'Read-back arsip tidak cocok dengan SHA-256 snapshot.'
                );
            }

            if (
                cleanText(
                    firstReadBack
                        ?.scope
                        ?.workspaceId
                ) !==
                    current.workspaceId ||
                cleanText(
                    firstReadBack
                        ?.scope
                        ?.academicYearId
                ) !==
                    current.activeAcademicYearId
            ) {
                throw new Error(
                    'Read-back arsip tidak cocok dengan workspace/tahun aktif.'
                );
            }

            const verifiedPayload = {
                ...payload,

                verified:
                    true,

                verifiedAt:
                    nowISO()
            };

            const finalWrite =
                await window
                    .dbPutAnnualArchive(
                        id,
                        verifiedPayload
                    );

            if (
                finalWrite?.ok !==
                    true ||
                !finalWrite.value
            ) {
                throw normalizeError(
                    finalWrite?.error,
                    'Flag verifikasi arsip gagal disimpan.'
                );
            }

            const finalArchive =
                finalWrite.value;

            const finalVerification =
                await verifyAnnualArchive(
                    finalArchive,
                    {
                        requireCurrentScope:
                            true,

                        requireCurrentHash:
                            true,

                        currentEnvelope:
                            envelope
                    }
                );

            if (
                finalVerification?.ok !==
                true
            ) {
                throw new Error(
                    `Verifikasi akhir arsip gagal: ${
                        finalVerification?.reason ||
                        'unknown'
                    }.`
                );
            }

            let auditResult =
                null;

            if (
                typeof window
                    .logSIMNIAuditEvent ===
                'function'
            ) {
                try {
                    auditResult =
                        await window
                            .logSIMNIAuditEvent(
                                'annual_archive_verified',
                                id,
                                {
                                    hash:
                                        finalVerification.hash,

                                    academicYearId:
                                        current
                                            .activeAcademicYearId,

                                    classId:
                                        current.classId,

                                    archiveVersion:
                                        ARCHIVE_VERSION
                                }
                            );
                } catch (
                    auditError
                ) {
                    console.error(
                        '[SIMNI Archive] Audit event gagal:',
                        auditError
                    );

                    auditResult = {
                        ok:
                            false,

                        error:
                            auditError
                    };
                }
            }

            runtime.lastOperation = {
                type:
                    'create',

                status:
                    'verified',

                archiveId:
                    id,

                hash:
                    finalVerification.hash,

                workspaceId:
                    current.workspaceId,

                academicYearId:
                    current.activeAcademicYearId,

                completedAt:
                    nowISO(),

                auditLogged:
                    auditResult?.ok !==
                    false
            };

            notify(
                `Berhasil disimpan: arsip tahunan VERIFIED untuk ${
                    current.workspaceId
                } / ${
                    current.activeAcademicYearId
                }`,
                'success'
            );

            return {
                ok:
                    true,

                archive:
                    finalArchive,

                verification:
                    finalVerification,

                audit:
                    auditResult
            };

        } catch (
            rawError
        ) {
            const error =
                normalizeError(
                    rawError
                );

            console.error(
                '[SIMNI Archive] Pembuatan arsip gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'create',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    error.message
            };

            notify(
                `Arsip tahunan gagal: ${error.message}`,
                'error'
            );

            return {
                ok:
                    false,

                error
            };

        } finally {
            runtime.createBusy =
                false;

            hideProgress();
        }
    }

    async function getVerifiedAnnualArchive() {
        if (
            runtime.verifyBusy
        ) {
            return null;
        }

        runtime.verifyBusy =
            true;

        try {
            requireArchiveAccess();
            requireOnlineDatabase();
            requireBackupAuthority();

            const currentSnapshot =
                await buildVerifiedCurrentEnvelope();

            const result =
                await window
                    .dbGetAnnualArchives();

            if (
                result?.ok !==
                true
            ) {
                return null;
            }

            const archives =
                result.value &&
                typeof result.value ===
                    'object' &&
                !Array.isArray(
                    result.value
                )
                    ? Object.values(
                        result.value
                    )
                    : [];

            const scopedCandidates =
                archives
                    .filter(
                        (item) =>
                            item &&
                            typeof item ===
                                'object' &&
                            item.verified ===
                                true &&
                            cleanText(
                                item
                                    ?.scope
                                    ?.workspaceId
                            ) ===
                                currentSnapshot
                                    .current
                                    .workspaceId &&
                            cleanText(
                                item
                                    ?.scope
                                    ?.academicYearId
                            ) ===
                                currentSnapshot
                                    .current
                                    .activeAcademicYearId &&
                            cleanText(
                                item
                                    ?.scope
                                    ?.classId
                            ) ===
                                currentSnapshot
                                    .current
                                    .classId &&
                            cleanText(
                                item
                                    ?.scope
                                    ?.role
                            ) ===
                                currentSnapshot
                                    .current
                                    .role
                    )
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            String(
                                right.verifiedAt ||
                                right.createdAt ||
                                ''
                            )
                                .localeCompare(
                                    String(
                                        left.verifiedAt ||
                                        left.createdAt ||
                                        ''
                                    )
                                )
                    );

            for (
                const candidate
                of scopedCandidates
            ) {
                const verification =
                    await verifyAnnualArchive(
                        candidate,
                        {
                            requireCurrentScope:
                                true,

                            requireCurrentHash:
                                true,

                            currentEnvelope:
                                currentSnapshot
                                    .envelope
                        }
                    );

                if (
                    verification?.ok ===
                    true
                ) {
                    runtime.lastOperation = {
                        type:
                            'lookup',

                        status:
                            'verified',

                        archiveId:
                            candidate.archiveId ||
                            null,

                        hash:
                            verification.hash,

                        completedAt:
                            nowISO()
                    };

                    return candidate;
                }
            }

            runtime.lastOperation = {
                type:
                    'lookup',

                status:
                    'not-found',

                completedAt:
                    nowISO()
            };

            return null;

        } catch (
            error
        ) {
            console.error(
                '[SIMNI Archive] Pemeriksaan arsip VERIFIED gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'lookup',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            return null;

        } finally {
            runtime.verifyBusy =
                false;
        }
    }

    function getRuntimeSnapshot() {
        return {
            createBusy:
                runtime.createBusy,

            verifyBusy:
                runtime.verifyBusy,

            lastOperation:
                runtime.lastOperation
                    ? {
                        ...runtime.lastOperation
                    }
                    : null
        };
    }

    Object.assign(
        window,
        {
            createAnnualArchiveCloud
        }
    );

    window.SIMNIArchive =
        Object.freeze({
            ARCHIVE_FORMAT,
            ARCHIVE_VERSION,
            createAnnualArchiveCloud,
            getVerifiedAnnualArchive,
            verifyAnnualArchive,
            getRuntimeSnapshot
        });
}());
