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
            ) && !(current.role === 'superuser' && current.email === 'unggaran.sditbm@gmail.com' && current.workspaceId === 'ws_kelas3a' && current.legacyOwnerWorkspace === 'ws_superuser' && scope.workspaceId === 'ws_superuser' && scope.role === 'superuser' && scope.classId === '3A')
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

            // Same verified content reuses its physical archive instead of
            // accumulating identical full snapshots on repeated saves.
            const id = `sha256_${envelope.integrity.hash}`;

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

            const auditResult = finalWrite;

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
                    auditResult?.ok ===
                    true
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

            let before = null;
            do {
            const result =
                await window
                    .dbGetAnnualArchives({ before });
            before = result?.nextCursor || null;

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

            } while (before);

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

    async function openAnnualArchiveManager() {
        requireArchiveAccess();
        document.getElementById('simni-archive-manager')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'simni-archive-manager';
        dialog.style.cssText = 'width:92%;max-width:660px;max-height:85vh;overflow:auto;padding:24px;border-radius:16px';
        const title = document.createElement('h2'); title.textContent = 'Pengelolaan Arsip';
        const notice = document.createElement('p');
        notice.textContent = 'Versi dengan isi sama disimpan sekali. Batas arsip terindeks: 20 versi / 128 MiB per tahun. Ekspor dan pilih kembali berkas untuk menghapus versi lama. Arsip yang sama dengan data aktif dipertahankan.';
        const status = document.createElement('p'); status.setAttribute('role', 'status');
        const list = document.createElement('div');
        const close = document.createElement('button'); close.textContent = 'Tutup'; close.onclick = () => { dialog.close(); dialog.remove(); };
        dialog.append(title, notice, status, close, list);
        const owner = { ...window.SIMNICurrentAccess };
        const sameOwner = () => ['uid', 'workspaceId', 'activeAcademicYearId'].every(key => owner[key] === window.SIMNICurrentAccess?.[key]);
        async function page(before = null, metadataOnly = true) {
            const result = await window.dbGetAnnualArchives({ before, metadataOnly });
            if (!sameOwner() || !dialog.isConnected) return;
            if (!result?.ok) throw result?.error || new Error('Daftar arsip gagal dibaca.');
            list.replaceChildren();
            status.textContent = metadataOnly ? 'Daftar metadata arsip 4.6.7.' : 'Riwayat kompatibilitas dibaca satu snapshot per halaman; belum seluruhnya masuk inventaris.';
            for (const [id, record] of Object.entries(result.value || {})) {
                const row = document.createElement('p'); row.textContent = `${record.createdAt || id} · ${record.verified ? 'VERIFIED' : 'belum terverifikasi'} `;
                if (record.pending) {
                    const repair = document.createElement('button'); repair.textContent = 'Periksa reservasi tertunda';
                    repair.onclick = async () => {
                        try {
                            if (!sameOwner()) throw new Error('Sesi berubah.');
                            const result = await window.dbRepairAnnualArchiveReservation(id);
                            if (!result.ok) throw result.error;
                            await page(before, metadataOnly);
                            status.textContent = 'Reservasi diperiksa; snapshot yang ada dipertahankan.';
                        } catch (error) { status.textContent = error.message; }
                    };
                    row.append(repair);
                }
                const download = document.createElement('button'); download.textContent = 'Ekspor arsip';
                download.onclick = async () => {
                    try {
                        if (!sameOwner()) throw new Error('Sesi berubah.');
                        const exported = await window.dbExportAnnualArchive(id);
                        if (!exported.ok) throw exported.error;
                        if (!sameOwner()) return;
                        const json = JSON.stringify(exported.value);
                        const blob = new Blob([json], { type: 'application/json' });
                        const maxBytes = window.SIMNIBackupCore?.MAX_FILE_BYTES || (25 * 1024 * 1024);
                        if (blob.size > maxBytes) {
                            throw new Error(`Ukuran arsip (${(blob.size / (1024 * 1024)).toFixed(2)} MB) melampaui batas aman (${(maxBytes / (1024 * 1024)).toFixed(0)} MB).`);
                        }
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `SIMNI_arsip_${id}.json`; anchor.click();
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                    } catch (error) { status.textContent = error.message; }
                };
                const label = document.createElement('label'); label.textContent = ' Pilih ekspor untuk verifikasi dan hapus: ';
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
                input.onchange = async () => {
                    try {
                        const file = input.files?.[0]; if (!file) return;
                        const maxImport = window.SIMNIBackupCore?.MAX_IMPORT_BYTES || (32 * 1024 * 1024);
                        if (!sameOwner() || file.size > maxImport) throw new Error('Sesi berubah atau berkas terlalu besar.');
                        const exported = JSON.parse(await file.text());
                        if (!confirm('Hapus versi arsip cloud ini setelah berkas ekspor cocok dan hash terverifikasi? Simpan berkas ekspor untuk pemulihan.')) return;
                        const deleted = await window.dbDeleteAnnualArchiveAfterVerification(id, exported);
                        if (!deleted.ok) throw deleted.error;
                        row.remove(); status.textContent = 'Arsip lama yang dipilih dihapus setelah verifikasi berkas.';
                    } catch (error) { status.textContent = error.message; }
                };
                label.append(input); row.append(download, label); list.append(row);
            }
            const addPageButton = (text, cursor, mode) => {
                const button = document.createElement('button'); button.textContent = text;
                button.onclick = () => page(cursor, mode).catch(error => { status.textContent = error.message; }); list.append(button);
            };
            if (result.nextCursor) addPageButton('Halaman berikutnya', result.nextCursor, metadataOnly);
            addPageButton('Kembali ke metadata terbaru', null, true);
            if (metadataOnly) addPageButton('Telusuri riwayat lama', null, false);
        }
        document.body.append(dialog); dialog.showModal();
        await page();
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
            createAnnualArchiveCloud,
            openAnnualArchiveManager
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

window.openGrantedAcademicArchives = async function () {
    try { const module = await import('./granted-archives.js'); module.openGrantedArchives(); }
    catch (error) { window.showToast?.(error.message, 'error'); }
};
