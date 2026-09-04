// ==========================================
// FILE: features/settings/settings.js
// FUNGSI:
// Identitas workspace, Tahun Pelajaran,
// migrasi legacy, logo, dan utilitas pengaturan.
// Operasi privileged dibatasi Firebase Rules dan Cloudflare Worker Free.
// ==========================================

(function initSIMNISettings() {
    'use strict';

    const DEFAULT_LOGO_URL =
        './icons/school-logo.png';

    const MAX_LOGO_BYTES =
        5 * 1024 * 1024;

    const runtime = {
        savingIdentity: false,
        deletingLogo: false,
        migratingLegacy: false,
        clearLogoInput: false,
        lastOperation: null
    };

    function currentAccess() {
        return (
            window.SIMNICurrentAccess ||
            null
        );
    }

    function canAccessSettings() {
        try {
            return (
                window.SIMNIAccess
                    ?.canAccess('settings') ===
                true
            );
        } catch (_) {
            return false;
        }
    }

    function canAdministerUsers() {
        try {
            return (
                window.SIMNIAccess
                    ?.canAccess('userAdmin') ===
                true
            );
        } catch (_) {
            return false;
        }
    }

    function assertSettingsAccess() {
        const access =
            currentAccess();

        if (!canAccessSettings()) {
            throw new Error(
                'Role tidak memiliki akses Pengaturan.'
            );
        }

        if (
            !access?.uid ||
            !access?.workspaceId ||
            !access?.classId ||
            !access?.activeAcademicYearId ||
            access.status !== 'active'
        ) {
            throw new Error(
                'Access context Pengaturan belum siap.'
            );
        }

        return access;
    }

    function normalizedAcademicYear(
        value
    ) {
        const year =
            String(
                value || ''
            ).trim();

        if (
            !/^\d{4}-\d{4}$/.test(
                year
            )
        ) {
            throw new Error(
                'Tahun Pelajaran harus berformat YYYY-YYYY, contoh 2026-2027.'
            );
        }

        const [
            start,
            end
        ] =
            year
                .split('-')
                .map(Number);

        if (
            !Number.isInteger(start) ||
            !Number.isInteger(end) ||
            end !==
                start + 1
        ) {
            throw new Error(
                'Rentang Tahun Pelajaran harus berurutan satu tahun.'
            );
        }

        return year;
    }

    function element(
        id
    ) {
        return document.getElementById(
            id
        );
    }

    function requiredValue(
        id,
        label
    ) {
        const target =
            element(
                id
            );

        if (!target) {
            throw new Error(
                `Field ${label} tidak tersedia.`
            );
        }

        const value =
            String(
                target.value || ''
            ).trim();

        if (!value) {
            throw new Error(
                `${label} wajib diisi.`
            );
        }

        return value;
    }

    function optionalValue(
        id
    ) {
        return String(
            element(id)?.value ||
            ''
        ).trim();
    }

    function currentIdentity() {
        const identity =
            window.state
                ?.pengaturan;

        if (
            !identity ||
            typeof identity !==
                'object' ||
            Array.isArray(
                identity
            )
        ) {
            return {};
        }

        return identity;
    }

    function collectIdentitySettings() {
        const existing =
            currentIdentity();

        return {
            ...existing,

            nama_aplikasi:
                requiredValue(
                    'set-nama-app',
                    'Nama Aplikasi'
                ),

            nama_kelas:
                requiredValue(
                    'set-nama-kelas',
                    'Nama Kelas'
                ),

            tahun_pelajaran:
                normalizedAcademicYear(
                    requiredValue(
                        'set-tapel',
                        'Tahun Pelajaran'
                    )
                ),

            ikon_kelas:
                optionalValue(
                    'set-ikon-kelas'
                ) ||
                'fa-school',

            nama_yayasan:
                requiredValue(
                    'set-nama-yayasan',
                    'Nama Yayasan'
                ),

            jenjang_sekolah:
                requiredValue(
                    'set-jenjang-sekolah',
                    'Jenjang Sekolah'
                ),

            nama_sekolah:
                requiredValue(
                    'set-nama-sekolah',
                    'Nama Sekolah'
                ),

            status_akreditasi:
                optionalValue(
                    'set-akreditasi'
                ),

            nomor_izin:
                optionalValue(
                    'set-nomor-izin'
                ),

            kota:
                requiredValue(
                    'set-kota',
                    'Kota Penandatanganan'
                ),

            nama_wali_kelas:
                requiredValue(
                    'set-nama-wali-kelas',
                    'Nama Wali Kelas'
                ),

            nuptk_wali_kelas:
                requiredValue(
                    'set-nuptk-wali-kelas',
                    'NUPTK Wali Kelas'
                ),

            logo_url:
                existing.logo_url ||
                DEFAULT_LOGO_URL,

            logo_public_id:
                existing.logo_public_id ||
                null,

            logo_resource_type:
                existing.logo_resource_type ||
                null
        };
    }

    function setButtonContent(
        button,
        {
            text,
            icon,
            spinning = false
        }
    ) {
        if (!button) {
            return;
        }

        const nodes =
            [];

        if (icon) {
            const iconElement =
                document.createElement(
                    'i'
                );

            iconElement.className =
                `${icon}${spinning ? ' fa-spin' : ''}`;

            iconElement.setAttribute(
                'aria-hidden',
                'true'
            );

            nodes.push(
                iconElement
            );

            nodes.push(
                document.createTextNode(
                    ' '
                )
            );
        }

        nodes.push(
            document.createTextNode(
                text
            )
        );

        button.replaceChildren(
            ...nodes
        );
    }

    function renderSettingsActionState() {
        const saveButton =
            element(
                'btn-save-id'
            );

        const busy =
            runtime.savingIdentity ||
            runtime.deletingLogo;

        if (saveButton) {
            saveButton.disabled =
                busy;

            setButtonContent(
                saveButton,
                {
                    text:
                        busy
                            ? 'Menyimpan...'
                            : 'Simpan Identitas',

                    icon:
                        busy
                            ? 'fas fa-spinner'
                            : 'fas fa-save mr-1',

                    spinning:
                        busy
                }
            );
        }

        const logoInput =
            element(
                'set-logo-file'
            );

        if (
            logoInput &&
            runtime.clearLogoInput
        ) {
            logoInput.value =
                '';

            runtime.clearLogoInput =
                false;
        }
    }

    function updateIdentityState(
        identity
    ) {
        if (
            !identity ||
            typeof identity !==
                'object' ||
            Array.isArray(
                identity
            )
        ) {
            return;
        }

        if (
            window.state &&
            typeof window.state ===
                'object'
        ) {
            window.state.pengaturan = {
                ...window.state
                    .pengaturan,

                ...identity
            };
        }

        window.renderIdentitas?.();
    }

    async function loadCloudinary() {
        const module =
            await import(
                '../../js/database/cloudinary-client.js'
            );

        const cloud =
            module.default ||
            window.SIMNICloudinary;

        if (!cloud) {
            throw new Error(
                'Cloudinary provider belum siap.'
            );
        }

        return cloud;
    }

    function validateLogoFile(
        file
    ) {
        if (!file) {
            return;
        }

        const size =
            Number(
                file.size
            );

        if (
            !Number.isFinite(size) ||
            size <= 0
        ) {
            throw new Error(
                'Ukuran logo tidak valid.'
            );
        }

        if (
            size >
            MAX_LOGO_BYTES
        ) {
            throw new Error(
                'Maksimal gambar logo 5 MB.'
            );
        }

        const mime =
            String(
                file.type || ''
            )
                .trim()
                .toLowerCase();

        if (
            !mime.startsWith(
                'image/'
            )
        ) {
            throw new Error(
                'Logo wajib berupa gambar.'
            );
        }
    }

    function yearWillChange(
        payload,
        access
    ) {
        return (
            payload.tahun_pelajaran !==
            access.activeAcademicYearId
        );
    }

    function assertYearTransitionPermission(
        yearChanged
    ) {
        if (yearChanged) {
            throw new Error(
                'Tahun Pelajaran tidak dapat diubah dari Identitas Kelas. Gunakan wizard Reset Tahun Buku.'
            );
        }
    }

    function confirmAcademicYearTransition(
        access,
        nextYear
    ) {
        return window.confirm(
            [
                `Tahun aktif akan diubah dari ${access.activeAcademicYearId} menjadi ${nextYear}.`,
                '',
                'Seluruh akun aktif akan diarahkan ke Tahun Pelajaran yang sama.',
                'Data tahun lama tetap berada pada namespace tahun lama.',
                '',
                'Lanjutkan?'
            ].join('\n')
        );
    }

    async function persistIdentity({
        payload,
        access,
        yearChanged
    }) {
        if (!canAdministerUsers()) throw new Error('Identitas sekolah hanya dapat dikelola Superuser.');
        if (typeof window.dbSet !== 'function') throw new Error('Database repository belum siap.');

        const result =
            await window.dbSet(
                'Pengaturan/Identitas',
                payload
            );

        if (!result?.ok) {
            throw (
                result?.error ||
                new Error(
                    'Identitas gagal disimpan.'
                )
            );
        }

        return { authority: 'firebase-spark-owner', result, identity: payload, yearChanged };
    }

    async function compensateUploadedLogo(
        uploaded
    ) {
        if (
            !uploaded
                ?.public_id
        ) {
            return;
        }

        try {
            const cloud =
                await loadCloudinary();

            await cloud
                .deleteCloudinaryAsset(
                    uploaded.public_id,
                    uploaded.resource_type ||
                    'image',
                    'logo'
                );
        } catch (error) {
            console.error(
                '[SIMNI Settings] Rollback logo upload gagal:',
                error
            );
        }
    }

    async function simpanIdentitas(
        event
    ) {
        event?.preventDefault?.();

        if (
            runtime.savingIdentity ||
            runtime.deletingLogo
        ) {
            return false;
        }

        let access;
        let payload;
        let uploaded =
            null;

        let yearChanged =
            false;

        try {
            access =
                assertSettingsAccess();

            payload =
                collectIdentitySettings();

            yearChanged =
                yearWillChange(
                    payload,
                    access
                );

            assertYearTransitionPermission(
                yearChanged
            );

            const fileInput =
                element(
                    'set-logo-file'
                );

            const file =
                fileInput
                    ?.files
                    ?.[0] ||
                null;

            validateLogoFile(
                file
            );

            if (
                file &&
                !canAdministerUsers()
            ) {
                throw new Error(
                    'Logo kustom hanya dapat dikelola Superuser.'
                );
            }

            /*
             * public_id Cloudinary memiliki academic-year scope.
             * Upload logo baru tidak boleh dibuat dengan scope tahun lama
             * lalu identity langsung dipindahkan ke tahun baru.
             */
            if (
                file &&
                yearChanged
            ) {
                throw new Error(
                    'Perubahan Tahun Pelajaran dan unggah logo baru tidak dapat dilakukan dalam satu operasi. Simpan perubahan Tahun Pelajaran terlebih dahulu.'
                );
            }

            if (
                yearChanged &&
                payload.logo_public_id
            ) {
                /*
                 * Logo tahun lama tidak dibawa ke namespace tahun baru.
                 * Backend akan membersihkan asset lama memakai scope
                 * caller sebelum transition dilakukan.
                 */
                payload.logo_url =
                    DEFAULT_LOGO_URL;

                payload.logo_public_id =
                    null;

                payload.logo_resource_type =
                    null;
            }

            if (
                yearChanged &&
                !confirmAcademicYearTransition(
                    access,
                    payload.tahun_pelajaran
                )
            ) {
                return false;
            }

            runtime.savingIdentity =
                true;

            runtime.lastOperation = {
                type:
                    'save-identity',

                startedAt:
                    new Date()
                        .toISOString(),

                yearChanged
            };

            renderSettingsActionState();

            window.showLoad?.(
                file
                    ? 'Mengunggah logo dan menyimpan identitas...'
                    : (
                        yearChanged
                            ? 'Mengubah Tahun Pelajaran dan menyimpan identitas...'
                            : 'Menyimpan identitas...'
                    )
            );

            if (file) {
                const cloud =
                    await loadCloudinary();

                uploaded =
                    await cloud
                        .uploadLogo(
                            file
                        );

                payload.logo_url =
                    uploaded.secure_url;

                payload.logo_public_id =
                    uploaded.public_id;

                payload.logo_resource_type =
                    uploaded.resource_type ||
                    'image';
            }

            const persisted =
                await persistIdentity({
                    payload,
                    access,
                    yearChanged
                });

            updateIdentityState(
                persisted.identity
            );

            runtime.clearLogoInput =
                true;

            runtime.lastOperation = {
                type:
                    'save-identity',

                status:
                    'success',

                authority:
                    persisted.authority,

                completedAt:
                    new Date()
                        .toISOString(),

                yearChanged:
                    persisted.yearChanged
            };

            const logoCleanup =
                persisted.result
                    ?.logoCleanup;

            if (
                logoCleanup &&
                logoCleanup.attempted &&
                logoCleanup.ok ===
                    false
            ) {
                window.toast?.(
                    'Identitas tersimpan, tetapi pembersihan logo lama di Cloudinary belum berhasil.',
                    'warning'
                );
            } else {
                window.toast?.(
                    'Berhasil disimpan: identitas sekolah diperbarui.',
                    'success'
                );
            }

            if (
                yearChanged
            ) {
                window.toast?.(
                    'Tahun Pelajaran aktif berhasil berubah. Workspace akan dimuat ulang.',
                    'success'
                );

                window.setTimeout(
                    () => {
                        window.location.reload();
                    },
                    700
                );
            }

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Settings] Penyimpanan identitas gagal:',
                error
            );

            if (
                uploaded
                    ?.public_id
            ) {
                await compensateUploadedLogo(
                    uploaded
                );
            }

            runtime.lastOperation = {
                type:
                    'save-identity',

                status:
                    'failed',

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            window.toast?.(
                `Gagal menyimpan identitas: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime.savingIdentity =
                false;

            renderSettingsActionState();

            window.hideLoad?.();
        }
    }

    async function hapusLogo() {
        if (
            runtime.savingIdentity ||
            runtime.deletingLogo
        ) {
            return false;
        }

        try {
            assertSettingsAccess();

            if (
                !canAdministerUsers()
            ) {
                throw new Error(
                    'Logo kustom hanya dapat dikelola Superuser.'
                );
            }

            const existing =
                currentIdentity();

            if (
                !existing
                    .logo_public_id &&
                (
                    !existing
                        .logo_url ||
                    existing.logo_url ===
                        DEFAULT_LOGO_URL
                )
            ) {
                window.toast?.(
                    'Logo sudah menggunakan logo standar.',
                    'info'
                );

                return true;
            }

            if (
                !window.confirm(
                    'Hapus logo kustom dan kembali ke logo standar?'
                )
            ) {
                return false;
            }

            runtime.deletingLogo =
                true;

            runtime.lastOperation = {
                type:
                    'delete-logo',

                startedAt:
                    new Date()
                        .toISOString()
            };

            renderSettingsActionState();

            window.showLoad?.(
                'Menghapus logo kustom...'
            );

            const payload = {
                ...existing,

                tahun_pelajaran:
                    normalizedAcademicYear(
                        existing
                            .tahun_pelajaran ||
                        currentAccess()
                            ?.activeAcademicYearId
                    ),

                logo_url:
                    DEFAULT_LOGO_URL,

                logo_public_id:
                    null,

                logo_resource_type:
                    null
            };

            const result = await window.dbSet('Pengaturan/Identitas', payload);

            if (!result?.ok) {
                throw new Error(
                    'Database gagal mengembalikan logo ke standar.'
                );
            }

            updateIdentityState(
                payload
            );

            if (existing.logo_public_id) {
                const cloud = await loadCloudinary();
                await cloud.deleteCloudinaryAsset(
                    existing.logo_public_id,
                    existing.logo_resource_type || 'image',
                    'logo'
                );
            }

            runtime.clearLogoInput =
                true;

            runtime.lastOperation = {
                type:
                    'delete-logo',

                status:
                    'success',

                completedAt:
                    new Date()
                        .toISOString()
            };

            if (
                result.logoCleanup
                    ?.attempted &&
                result.logoCleanup
                    ?.ok === false
            ) {
                window.toast?.(
                    'Logo standar sudah aktif, tetapi cleanup asset cloud lama belum berhasil.',
                    'warning'
                );
            } else {
                window.toast?.(
                    'Logo berhasil dikembalikan ke standar.',
                    'success'
                );
            }

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Settings] Hapus logo gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'delete-logo',

                status:
                    'failed',

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            window.toast?.(
                `Gagal menghapus logo: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime.deletingLogo =
                false;

            renderSettingsActionState();

            window.hideLoad?.();
        }
    }

    function ekstrakCSSOffline() {
        let cssContent =
            '';

        document
            .querySelectorAll(
                'style'
            )
            .forEach(
                (style) => {
                    cssContent +=
                        style.textContent ||
                        '';
                }
            );

        if (
            !cssContent.trim()
        ) {
            window.toast?.(
                'Gagal menemukan gaya CSS di layar ini.',
                'error'
            );

            return false;
        }

        const blob =
            new Blob(
                [
                    cssContent
                ],
                {
                    type:
                        'text/css;charset=utf-8'
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const anchor =
            document.createElement(
                'a'
            );

        try {
            anchor.href =
                url;

            anchor.download =
                'tailwind-offline.css';

            anchor.hidden =
                true;

            document.body.appendChild(
                anchor
            );

            anchor.click();

            window.toast?.(
                'CSS berhasil diunduh.',
                'success'
            );

            return true;
        } finally {
            anchor.remove();

            URL.revokeObjectURL(
                url
            );
        }
    }

    async function migrateLegacyRTDB() {
        if (
            runtime.migratingLegacy
        ) {
            return false;
        }

        try {
            assertSettingsAccess();

            if (
                !canAdministerUsers()
            ) {
                throw new Error(
                    'Hanya Superuser yang dapat menjalankan migrasi legacy.'
                );
            }

            if (
                !window.confirm(
                    [
                        'Migrasi legacy RTDB akan MENYALIN data root lama',
                        'ke workspace/tahun aktif tanpa menghapus source legacy.',
                        '',
                        'Migrasi hanya akan dinyatakan berhasil jika',
                        'seluruh record dapat dipetakan dan hash tujuan VERIFIED.',
                        '',
                        'Lanjutkan?'
                    ].join('\n')
                )
            ) {
                return false;
            }

            runtime.migratingLegacy =
                true;

            runtime.lastOperation = {
                type:
                    'legacy-migration',

                startedAt:
                    new Date()
                        .toISOString()
            };

            window.showLoad?.(
                'Menyalin dan memverifikasi data legacy ke workspace...'
            );

            throw new Error('Namespace legacy umum telah ditutup pada skema production v4.6.4. Gunakan cadangan role-scoped.');

            const result = null;

            if (
                !result?.ok ||
                result.marker
                    ?.status !==
                    'verified'
            ) {
                throw new Error(
                    'Server belum dapat memverifikasi hasil migrasi.'
                );
            }

            if (
                Number(
                    result.marker
                        ?.issueCount ||
                    0
                ) !== 0
            ) {
                throw new Error(
                    'Migration marker mengandung unresolved issue.'
                );
            }

            runtime.lastOperation = {
                type:
                    'legacy-migration',

                status:
                    'verified',

                completedAt:
                    new Date()
                        .toISOString(),

                academicYearId:
                    result.marker
                        .academicYearId,

                sourceHash:
                    result.marker
                        .sourceHash,

                actualHash:
                    result.marker
                        .actualHash
            };

            window.toast?.(
                `Migrasi legacy VERIFIED untuk ${result.marker.academicYearId}.`,
                'success'
            );

            window
                .stopFirebaseListener
                ?.({
                    status:
                        'stopped'
                });

            window.isInitialLoad =
                true;

            window
                .initFirebaseListener
                ?.();

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Settings] Migrasi legacy gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'legacy-migration',

                status:
                    'failed',

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            window.toast?.(
                `Migrasi legacy gagal: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime.migratingLegacy =
                false;

            window.hideLoad?.();
        }
    }

    function getSettingsRuntimeSnapshot() {
        return {
            savingIdentity:
                runtime.savingIdentity,

            deletingLogo:
                runtime.deletingLogo,

            migratingLegacy:
                runtime.migratingLegacy,

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
            simpanIdentitas,

            hapusLogo,

            ekstrakCSSOffline,

            renderSIMNISettingsActionState:
                renderSettingsActionState
        }
    );

    window.SIMNISettings =
        Object.freeze({
            saveIdentity:
                simpanIdentitas,

            deleteLogo:
                hapusLogo,

            normalizedAcademicYear,

            getRuntimeSnapshot:
                getSettingsRuntimeSnapshot
        });

    renderSettingsActionState();
}());
