// ==========================================
// FILE: features/reset/reset.js
// FUNGSI:
// Reset tahunan workspace-scoped, archive-gated,
// role-aware, atomic multi-path, dan post-verified.
// ==========================================

(function initSIMNIReset() {
    'use strict';

    const SCOPES = Object.freeze({
        students: Object.freeze({
            label: 'Data Siswa dan data turunannya',
            phrase: 'RESET SISWA',
            paths: Object.freeze([
                'Siswa',
                'Presensi',
                'Nilai_TP',
                'Catatan',
                'Data_LPS',
                'LPS/Reports',
                'LPS/Revisions'
            ])
        }),

        tp: Object.freeze({
            label: 'Data TP dan nilai terkait',
            phrase: 'RESET TP',
            paths: Object.freeze([
                'Mapel_TP',
                'Nilai_TP'
            ])
        }),

        journal: Object.freeze({
            label: 'Jurnal dan Jadwal',
            phrase: 'RESET JURNAL',
            paths: Object.freeze([
                'Jurnal',
                'Jadwal'
            ])
        })
    });

    const runtime = {
        busy: false,
        lastOperation: null
    };

    function notify(message, type = 'info') {
        if (typeof window.toast === 'function') {
            window.toast(message, type);
            return;
        }

        console.log(
            `[SIMNI Reset:${type}]`,
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
        fallback = 'Reset gagal.'
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

    function requireResetAccess() {
        if (
            window.SIMNIAccess
                ?.canAccess(
                    'reset'
                ) !==
            true
        ) {
            throw new Error(
                'Role tidak memiliki izin reset.'
            );
        }

        const current =
            window.SIMNICurrentAccess ||
            null;

        if (
            !current ||
            current.status !==
                'active' ||
            !cleanText(
                current.uid
            ) ||
            !cleanText(
                current.role
            ) ||
            !cleanText(
                current.workspaceId
            ) ||
            !cleanText(
                current.classId
            ) ||
            !cleanText(
                current.activeAcademicYearId
            )
        ) {
            throw new Error(
                'Access context reset belum siap.'
            );
        }

        return current;
    }

    function requireRepository() {
        if (
            typeof window.dbUpdate !==
            'function'
        ) {
            throw new Error(
                'dbUpdate belum tersedia.'
            );
        }

        if (
            typeof window.dbGet !==
            'function'
        ) {
            throw new Error(
                'dbGet belum tersedia.'
            );
        }
    }

    function requireArchiveAuthority() {
        if (
            !window.SIMNIArchive ||
            typeof window
                .SIMNIArchive
                .getVerifiedAnnualArchive !==
                'function' ||
            typeof window
                .SIMNIArchive
                .createAnnualArchiveCloud !==
                'function'
        ) {
            throw new Error(
                'Authority arsip tahunan belum siap.'
            );
        }

        return window.SIMNIArchive;
    }

    function resolveScope(
        scopeKey
    ) {
        const scope =
            SCOPES[
                scopeKey
            ];

        if (!scope) {
            throw new Error(
                `Scope reset tidak dikenali: ${
                    scopeKey ||
                    '-'
                }.`
            );
        }

        return scope;
    }

    function resolveAuthorizedTargets(
        paths
    ) {
        const policy =
            window.SIMNIAccessPolicy;

        const access =
            window.SIMNIAccess;

        if (
            !policy ||
            typeof policy
                .featureForLogicalPath !==
                'function' ||
            !access ||
            typeof access
                .canAccess !==
                'function'
        ) {
            throw new Error(
                'Access policy reset belum siap.'
            );
        }

        const authorized =
            [];

        const denied =
            [];

        for (
            const logicalPath
            of paths
        ) {
            const feature =
                policy
                    .featureForLogicalPath(
                        logicalPath
                    );

            if (!feature) {
                throw new Error(
                    `Path reset tidak memiliki permission mapping: ${logicalPath}`
                );
            }

            if (
                access.canAccess(
                    feature
                )
            ) {
                authorized.push(
                    logicalPath
                );
            } else {
                denied.push({
                    path:
                        logicalPath,

                    feature
                });
            }
        }

        if (
            !authorized.length
        ) {
            throw new Error(
                'Tidak ada path reset yang diizinkan untuk role aktif.'
            );
        }

        return {
            authorized,
            denied
        };
    }

    async function requireFreshVerifiedArchive() {
        const archiveAuthority =
            requireArchiveAuthority();

        let archive =
            await archiveAuthority
                .getVerifiedAnnualArchive();

        if (archive) {
            return archive;
        }

        const createNow =
            window.confirm(
                'Belum ada arsip database VERIFIED yang identik dengan data aktif untuk workspace/tahun ini.\n\nBuat arsip sekarang sebelum reset?'
            );

        if (!createNow) {
            throw new Error(
                'Reset dibatalkan karena arsip VERIFIED belum tersedia.'
            );
        }

        const creation =
            await archiveAuthority
                .createAnnualArchiveCloud();

        if (
            creation?.ok !==
            true
        ) {
            throw normalizeError(
                creation?.error,
                'Pembuatan arsip VERIFIED gagal.'
            );
        }

        archive =
            await archiveAuthority
                .getVerifiedAnnualArchive();

        if (!archive) {
            throw new Error(
                'Arsip dibuat tetapi verifikasi archive-before-reset belum PASS.'
            );
        }

        return archive;
    }

    function confirmReset(
        scope,
        current,
        archive,
        targets
    ) {
        const first =
            window.confirm(
                `Arsip VERIFIED ditemukan (${
                    archive.archiveId ||
                    '-'
                }).\n\n` +
                `Reset: ${scope.label}\n` +
                `Workspace: ${current.workspaceId}\n` +
                `Kelas: ${current.classId}\n` +
                `Tahun Pelajaran: ${current.activeAcademicYearId}\n` +
                `Path yang akan dihapus: ${targets.length}\n\n` +
                'Lanjutkan reset?'
            );

        if (!first) {
            return false;
        }

        const typed =
            window.prompt(
                `Ketik tepat: ${scope.phrase}`
            );

        if (
            typed !==
            scope.phrase
        ) {
            notify(
                'Reset dibatalkan karena konfirmasi tidak cocok.',
                'info'
            );

            return false;
        }

        return true;
    }

    async function verifyTargetsAreNull(
        targets
    ) {
        const checks =
            await Promise.all(
                targets.map(
                    async (
                        logicalPath
                    ) => ({
                        path:
                            logicalPath,

                        result:
                            await window
                                .dbGet(
                                    logicalPath
                                )
                    })
                )
            );

        const failed =
            checks.filter(
                ({
                    result
                }) => (
                    result?.ok !==
                        true ||
                    result.value !==
                        null
                )
            );

        return {
            ok:
                failed.length ===
                0,

            checks,
            failed
        };
    }

    async function writeAudit(
        scopeKey,
        scope,
        current,
        archive,
        targets,
        denied
    ) {
        if (
            typeof window
                .logSIMNIAuditEvent !==
            'function'
        ) {
            return {
                ok:
                    true,

                skipped:
                    true
            };
        }

        try {
            const result =
                await window
                    .logSIMNIAuditEvent(
                        'annual_reset_completed',
                        scopeKey,
                        {
                            label:
                                scope.label,

                            archiveId:
                                archive.archiveId ||
                                null,

                            archiveHash:
                                archive.integrity
                                    ?.hash ||
                                null,

                            academicYearId:
                                current
                                    .activeAcademicYearId,

                            classId:
                                current.classId,

                            pathCount:
                                targets.length,

                            paths:
                                [
                                    ...targets
                                ],

                            deniedPaths:
                                denied.map(
                                    (
                                        entry
                                    ) =>
                                        entry.path
                                )
                        }
                    );

            return (
                result ||
                {
                    ok:
                        true
                }
            );

        } catch (
            error
        ) {
            console.error(
                '[SIMNI Reset] Audit event gagal:',
                error
            );

            return {
                ok:
                    false,

                error
            };
        }
    }

    async function performReset(
        scopeKey
    ) {
        if (
            runtime.busy
        ) {
            notify(
                'Reset lain masih berlangsung.',
                'info'
            );

            return {
                ok:
                    false,

                reason:
                    'busy'
            };
        }

        runtime.busy =
            true;

        let progressShown =
            false;

        try {
            const current =
                requireResetAccess();

            const scope =
                resolveScope(
                    scopeKey
                );

            requireRepository();

            const {
                authorized:
                    targets,

                denied
            } =
                resolveAuthorizedTargets(
                    scope.paths
                );

            const archive =
                await requireFreshVerifiedArchive();

            if (
                cleanText(
                    archive
                        ?.scope
                        ?.workspaceId
                ) !==
                    current.workspaceId ||
                cleanText(
                    archive
                        ?.scope
                        ?.academicYearId
                ) !==
                    current
                        .activeAcademicYearId ||
                cleanText(
                    archive
                        ?.scope
                        ?.classId
                ) !==
                    current.classId ||
                cleanText(
                    archive
                        ?.scope
                        ?.role
                ) !==
                    current.role ||
                archive?.verified !==
                    true
            ) {
                throw new Error(
                    'Arsip VERIFIED tidak cocok dengan scope akun aktif.'
                );
            }

            const confirmed =
                confirmReset(
                    scope,
                    current,
                    archive,
                    targets
                );

            if (!confirmed) {
                runtime.lastOperation = {
                    type:
                        'reset',

                    scopeKey,

                    status:
                        'cancelled',

                    completedAt:
                        nowISO()
                };

                return {
                    ok:
                        false,

                    cancelled:
                        true
                };
            }

            showProgress(
                `Reset ${scope.label}...`
            );

            progressShown =
                true;

            const updates =
                Object.fromEntries(
                    targets.map(
                        (
                            logicalPath
                        ) => [
                            logicalPath,
                            null
                        ]
                    )
                );

            const writeResult =
                await window
                    .dbUpdate(
                        updates
                    );

            if (
                writeResult?.ok !==
                true
            ) {
                throw normalizeError(
                    writeResult?.error,
                    'Database menolak reset.'
                );
            }

            const postVerify =
                await verifyTargetsAreNull(
                    targets
                );

            if (
                !postVerify.ok
            ) {
                const failedPaths =
                    postVerify.failed
                        .map(
                            ({
                                path
                            }) =>
                                path
                        )
                        .join(
                            ', '
                        );

                throw new Error(
                    `Post-verify reset gagal pada: ${failedPaths}`
                );
            }

            const audit =
                await writeAudit(
                    scopeKey,
                    scope,
                    current,
                    archive,
                    targets,
                    denied
                );

            runtime.lastOperation = {
                type:
                    'reset',

                scopeKey,

                status:
                    'verified',

                archiveId:
                    archive.archiveId ||
                    null,

                archiveHash:
                    archive.integrity
                        ?.hash ||
                    null,

                workspaceId:
                    current.workspaceId,

                classId:
                    current.classId,

                academicYearId:
                    current
                        .activeAcademicYearId,

                pathCount:
                    targets.length,

                paths:
                    [
                        ...targets
                    ],

                deniedPaths:
                    denied.map(
                        (
                            entry
                        ) =>
                            entry.path
                    ),

                auditLogged:
                    audit?.ok !==
                    false,

                completedAt:
                    nowISO()
            };

            notify(
                `Reset ${scope.label} berhasil dan terverifikasi.`,
                'success'
            );

            return {
                ok:
                    true,

                scopeKey,

                archiveId:
                    archive.archiveId ||
                    null,

                targets:
                    [
                        ...targets
                    ],

                denied:
                    denied.map(
                        (
                            entry
                        ) => ({
                            ...entry
                        })
                    ),

                verification:
                    postVerify,

                audit
            };

        } catch (
            rawError
        ) {
            const error =
                normalizeError(
                    rawError
                );

            console.error(
                '[SIMNI Reset] Reset gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'reset',

                scopeKey,

                status:
                    'failed',

                error:
                    error.message,

                completedAt:
                    nowISO()
            };

            notify(
                `Reset gagal: ${error.message}`,
                'error'
            );

            return {
                ok:
                    false,

                error
            };

        } finally {
            runtime.busy =
                false;

            if (
                progressShown
            ) {
                hideProgress();
            }
        }
    }

    function resetDataMurid() {
        return performReset(
            'students'
        );
    }

    function resetDataTP() {
        return performReset(
            'tp'
        );
    }

    function resetDataJadwal() {
        return performReset(
            'journal'
        );
    }

    async function startAnnualRollover(event) {
        event?.preventDefault?.();
        if (runtime.busy) {
            notify('Operasi reset lain masih berlangsung.', 'info');
            return { ok: false, reason: 'busy' };
        }
        runtime.busy = true;
        try {
            const current = requireResetAccess();
            if (current.workspaceId !== 'ws_superuser') {
                throw new Error('Migrasi Superuser ke ws_superuser wajib diselesaikan sebelum rollover.');
            }
            const nextYearId = cleanText(document.getElementById('rollover-next-year')?.value);
            const superuserClassId = cleanText(document.getElementById('rollover-superuser-class')?.value).toUpperCase();
            if (!/^\d{4}-\d{4}$/.test(nextYearId)) throw new Error('Format tahun pelajaran baru tidak valid.');
            if (!/^[1-6][A-Z]$/.test(superuserClassId)) {
                throw new Error('Kelas baru harus memakai format 1A sampai 6Z.');
            }
            if (typeof window.dbGetRolloverOverview !== 'function' || typeof window.dbCommitAcademicYearRollover !== 'function') {
                throw new Error('Repository rollover belum tersedia.');
            }
            showProgress('Memeriksa readiness arsip Superuser dan VIP...');
            const overview = await window.dbGetRolloverOverview();
            if (!overview?.ok) throw overview?.error || new Error('Status arsip role tidak dapat dibaca.');
            const readiness = overview.rollover?.readiness || {};
            const profiles = Object.values(overview.users || {});
            const requiredScopes = [
                ['unggaran.sditbm@gmail.com', 'superuser', 'ws_superuser'],
                ['anur.auliya01@gmail.com', 'vip', 'ws_pjok']
            ];
            const readinessCount = requiredScopes.filter(([email, role, workspaceId]) => {
                const profile = profiles.find((item) => String(item?.email || '').toLowerCase() === email);
                const ready = profile?.uid ? readiness[profile.uid] : null;
                return profile?.role === role && profile?.workspaceId === workspaceId && ready?.verified === true && ready?.workspaceId === workspaceId && ready?.academicYearId === current.activeAcademicYearId;
            }).length;
            if (readinessCount !== requiredScopes.length) throw new Error(`Baru ${readinessCount}/${requiredScopes.length} role yang memiliki arsip VERIFIED sesuai scope.`);
            hideProgress();

            const approved = window.confirm(
                `RESET TAHUN BUKU GLOBAL\n\nTahun: ${current.activeAcademicYearId} → ${nextYearId}\nKelas Superuser: ${superuserClassId}\nVIP: PJOK\n\nData operasional tahun lama pada dua workspace canonical akan dihapus setelah arsip VERIFIED. Lanjutkan?`
            );
            if (!approved) return { ok: false, cancelled: true };
            const typed = window.prompt(`Ketik tepat: AKTIFKAN ${nextYearId}`);
            if (typed !== `AKTIFKAN ${nextYearId}`) {
                notify('Rollover dibatalkan karena konfirmasi tidak cocok.', 'info');
                return { ok: false, cancelled: true };
            }

            showProgress('Mengosongkan tahun lama dan membuat struktur tahun baru secara atomik...');
            const result = await window.dbCommitAcademicYearRollover({ nextYearId, superuserClassId });
            if (!result?.ok) throw result?.error || new Error('Commit rollover ditolak.');
            runtime.lastOperation = {
                type: 'annual-rollover',
                status: 'verified',
                currentYearId: result.currentYearId,
                nextYearId: result.nextYearId,
                completedAt: result.completedAt
            };
            notify(`Tahun pelajaran ${nextYearId} aktif. Database operasional baru kosong dan terverifikasi.`, 'success');
            window.setTimeout(() => window.location.reload(), 1200);
            return result;
        } catch (rawError) {
            const error = normalizeError(rawError, 'Rollover tahun buku gagal.');
            console.error('[SIMNI Reset] Rollover gagal:', error);
            runtime.lastOperation = { type: 'annual-rollover', status: 'failed', error: error.message, completedAt: nowISO() };
            notify(`Rollover gagal: ${error.message}`, 'error');
            return { ok: false, error };
        } finally {
            runtime.busy = false;
            hideProgress();
        }
    }

    function getRuntimeSnapshot() {
        return {
            busy:
                runtime.busy,

            lastOperation:
                runtime.lastOperation
                    ? {
                        ...runtime
                            .lastOperation
                    }
                    : null
        };
    }

    Object.assign(
        window,
        {
            resetDataMurid,
            resetDataTP,
            resetDataJadwal,
            startAnnualRollover
        }
    );

    window.SIMNIReset =
        Object.freeze({
            SCOPES,
            performReset,
            resetDataMurid,
            resetDataTP,
            resetDataJadwal,
            startAnnualRollover,
            getRuntimeSnapshot
        });
}());
