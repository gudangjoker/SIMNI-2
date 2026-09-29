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

    const FALLBACK_INSTITUTION_IDENTITY = Object.freeze({
        nama_aplikasi: 'SIMNI Administrasi Kelas',
        nama_yayasan: 'Yayasan Sosial dan Pendidikan Bina Muda',
        jenjang_sekolah: 'Sekolah Dasar',
        nama_sekolah: 'SDIT Bina Muda Cicalengka',
        status_akreditasi: 'A',
        kota: 'Cicalengka',
        nomor_izin: 'No.421.2/1143-Disdikbud/2011'
    });

    function permanentInstitutionIdentity() {
        return window.SIMNIInstitutionIdentity || FALLBACK_INSTITUTION_IDENTITY;
    }

    const runtime = {
        savingIdentity: false,
        deletingLogo: false,
        migratingLegacy: false,
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

    function valueWithFallback(id, fallback = '') {
        const el = element(id);
        const val = el ? String(el.value || '').trim() : '';
        return val || fallback;
    }

    function setSettingsTab(tab) {
        const targetTab = tab || 'hub';
        const panelNames = ['hub', 'school', 'profile', 'database', 'maintenance'];
        panelNames.forEach((name) => {
            const panel = document.getElementById(`settings-panel-${name}`);
            if (panel) {
                const isActive = name === targetTab;
                panel.classList.toggle('hidden', !isActive);
                if (isActive) {
                    panel.classList.remove('fade-in');
                    void panel.offsetWidth;
                    panel.classList.add('fade-in');
                }
            }
        });
        const backBtn = document.getElementById('settings-header-back-btn');
        if (backBtn) {
            if (targetTab === 'hub') {
                backBtn.setAttribute('data-simni-action', 'switchView');
                backBtn.setAttribute('data-simni-args', '["dashboard"]');
                backBtn.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Kembali ke Dashboard';
            } else {
                backBtn.setAttribute('data-simni-action', 'setSettingsTab');
                backBtn.setAttribute('data-simni-args', '["hub"]');
                backBtn.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Kembali ke Menu Pengaturan';
            }
        }
        try {
            sessionStorage.setItem('simni:settings-active-tab', targetTab);
        } catch (_) {}
    }

    function collectIdentitySettings() {
        const existing = currentIdentity();
        const access = assertSettingsAccess();
        const institution = permanentInstitutionIdentity();
        const academicYear = normalizedAcademicYear(
            access.activeAcademicYearId || '2026-2027'
        );

        const namaKepalaSekolah = valueWithFallback(
            'set-nama-kepala-sekolah',
            existing.nama_kepala_sekolah || existing.nama_kamad || 'Kepala SDIT Bina Muda'
        );
        const nuksKepalaSekolah = valueWithFallback(
            'set-nuks-kepala-sekolah',
            existing.nuks_kepala_sekolah || existing.nuks_kamad || '-'
        );

        return {
            ...existing,
            ...institution,

            nama_kepala_sekolah: namaKepalaSekolah,
            nama_kamad: namaKepalaSekolah,
            nuks_kepala_sekolah: nuksKepalaSekolah,
            nuks_kamad: nuksKepalaSekolah,

            nama_kelas:
                valueWithFallback(
                    'set-nama-kelas',
                    existing.nama_kelas || 'Kelas 3'
                ),

            tahun_pelajaran:
                academicYear,

            nama_wali_kelas:
                valueWithFallback(
                    'set-nama-wali-kelas',
                    existing.nama_wali_kelas || ''
                ),

            nuptk_wali_kelas:
                valueWithFallback(
                    'set-nuptk-wali-kelas',
                    existing.nuptk_wali_kelas || '-'
                ),

            // Logo kustom dihapus dari UI. Pertahankan logo standar SIMNI
            // dan kosongkan metadata Cloudinary agar identitas konsisten.
            ikon_kelas:
                'fa-school',

            logo_url:
                DEFAULT_LOGO_URL,

            logo_public_id:
                null,

            logo_resource_type:
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
        const identity = window.SIMNIAuthState || {};
        const access = currentAccess();
        const email = document.getElementById('profile-email-display');
        const uid = document.getElementById('firebase-uid-display');
        if (email) email.textContent = identity.email || access?.email || 'Identitas akun belum tersedia';
        if (uid) uid.textContent = `UID: ${identity.uid || access?.uid || 'Tidak tersedia'}`;

        try { window.renderIdentitas?.(); } catch (_) {}

        const busy =
            runtime.savingIdentity ||
            runtime.deletingLogo;

        ['btn-save-id', 'btn-save-id-school', 'btn-save-id-profile'].forEach((btnId) => {
            const saveButton = element(btnId);
            if (saveButton) {
                saveButton.disabled = busy;
                const defaultText = saveButton.getAttribute('data-default-text') || 'Simpan Identitas';
                setButtonContent(
                    saveButton,
                    {
                        text: busy ? 'Menyimpan...' : defaultText,
                        icon: busy ? 'fas fa-spinner' : 'fas fa-save mr-1',
                        spinning: busy
                    }
                );
            }
        });
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

    async function persistIdentity({
        payload,
        access,
        yearChanged
    }) {
        if (!canAccessSettings()) throw new Error('Role tidak memiliki akses Pengaturan Identitas.');
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

        return { authority: 'workspace-settings', result, identity: payload, yearChanged };
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

        try {
            access = assertSettingsAccess();
            payload = collectIdentitySettings();

            const yearChanged = yearWillChange(
                payload,
                access
            );

            assertYearTransitionPermission(
                yearChanged
            );

            runtime.savingIdentity = true;
            runtime.lastOperation = {
                type: 'save-identity',
                startedAt: new Date().toISOString(),
                yearChanged: false
            };

            renderSettingsActionState();
            window.showLoad?.('Menyimpan identitas kelas...');

            const existing = currentIdentity();
            const previousLogoPublicId = existing.logo_public_id || null;
            const previousLogoResourceType = existing.logo_resource_type || 'image';

            const persisted = await persistIdentity({
                payload,
                access,
                yearChanged: false
            });

            updateIdentityState(
                persisted.identity
            );

            // Jika instalasi lama masih memiliki logo kustom Cloudinary,
            // identitas sudah dialihkan ke logo standar. Cleanup dilakukan
            // best-effort setelah commit database sukses dan tidak boleh
            // membatalkan penyimpanan identitas.
            if (previousLogoPublicId) {
                try {
                    const cloud = await loadCloudinary();
                    await cloud.deleteCloudinaryAsset(
                        previousLogoPublicId,
                        previousLogoResourceType,
                        'logo'
                    );
                } catch (cleanupError) {
                    console.warn(
                        '[SIMNI Settings] Cleanup logo kustom lama gagal:',
                        cleanupError
                    );
                }
            }

            runtime.lastOperation = {
                type: 'save-identity',
                status: 'success',
                authority: persisted.authority,
                completedAt: new Date().toISOString(),
                yearChanged: false
            };

            window.toast?.(
                'Berhasil disimpan: identitas kelas diperbarui.',
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Settings] Penyimpanan identitas gagal:',
                error
            );

            runtime.lastOperation = {
                type: 'save-identity',
                status: 'failed',
                completedAt: new Date().toISOString(),
                error: String(error?.message || error)
            };

            window.toast?.(
                `Gagal menyimpan identitas: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime.savingIdentity = false;
            renderSettingsActionState();
            window.hideLoad?.();
        }
    }

    async function hapusLogo() {
        // Kompatibilitas untuk action lama/cache Service Worker lama.
        // UI logo kustom sudah dihapus; fungsi ini hanya memastikan identitas
        // memakai logo standar tanpa membuka alur unggah baru.
        if (
            runtime.savingIdentity ||
            runtime.deletingLogo
        ) {
            return false;
        }

        try {
            const access = assertSettingsAccess();
            if (!canAdministerUsers()) {
                throw new Error('Logo standar hanya dapat dikonfirmasi Superuser.');
            }

            runtime.deletingLogo = true;
            renderSettingsActionState();

            const existing = currentIdentity();
            const payload = {
                ...existing,
                ...permanentInstitutionIdentity(),
                tahun_pelajaran: normalizedAcademicYear(
                    access.activeAcademicYearId || existing.tahun_pelajaran || '2026-2027'
                ),
                ikon_kelas: 'fa-school',
                logo_url: DEFAULT_LOGO_URL,
                logo_public_id: null,
                logo_resource_type: null
            };

            const result = await window.dbSet('Pengaturan/Identitas', payload);
            if (!result?.ok) {
                throw result?.error || new Error('Database gagal menetapkan logo standar.');
            }

            updateIdentityState(payload);
            return true;
        } catch (error) {
            console.error('[SIMNI Settings] Penetapan logo standar gagal:', error);
            window.toast?.(
                `Gagal menetapkan logo standar: ${error.message || error}`,
                'error'
            );
            return false;
        } finally {
            runtime.deletingLogo = false;
            renderSettingsActionState();
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

    async function clearAppCacheAndReload() {
        if (!confirm('Bersihkan cache aset aplikasi dan muat ulang versi terbaru? Data akademik offline Anda tetap aman tersimpan.')) {
            return;
        }

        window.showLoad?.('Membersihkan cache aplikasi...');
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.update().catch(() => {});
                }
            }
            sessionStorage.clear();
            window.toast?.('Cache berhasil dibersihkan. Memuat ulang...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 700);
        } catch (err) {
            console.error('[SIMNI Settings] Gagal membersihkan cache:', err);
            window.toast?.('Gagal membersihkan cache: ' + (err?.message || err), 'error');
            window.hideLoad?.();
        }
    }

    Object.assign(
        window,
        {
            simpanIdentitas,

            hapusLogo,

            ekstrakCSSOffline,

            clearAppCacheAndReload,

            setSettingsTab,

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

            clearAppCacheAndReload,

            setSettingsTab,

            sendProfilePasswordReset:
                () => window.sendProfilePasswordReset?.(),

            normalizedAcademicYear,

            getRuntimeSnapshot:
                getSettingsRuntimeSnapshot
        });

    try {
        const savedTab = sessionStorage.getItem('simni:settings-active-tab') || 'hub';
        setSettingsTab(savedTab);
    } catch (_) {
        setSettingsTab('hub');
    }

    renderSettingsActionState();
}());
