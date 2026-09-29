(function initSIMNIShell() {
            'use strict';

            const SENSITIVE_QUERY_KEYS =
                Object.freeze([
                    'invite',
                    'token',
                    'inviteToken',
                    'recovery',
                    'recoveryToken',
                    'secret'
                ]);

            const EXPECTED_VENDOR_GLOBALS =
                Object.freeze([
                    Object.freeze({
                        id:
                            'qrcodejs',

                        label:
                            'QRCodeJS',

                        check() {
                            return (
                                typeof window
                                    .QRCode ===
                                'function'
                            );
                        }
                    }),

                    Object.freeze({
                        id:
                            'html5-qrcode',

                        label:
                            'html5-qrcode',

                        check() {
                            return (
                                typeof window
                                    .Html5Qrcode ===
                                    'function' ||
                                typeof window
                                    .Html5QrcodeScanner ===
                                    'function'
                            );
                        }
                    }),

                    Object.freeze({
                        id:
                            'xlsx',

                        label:
                            'XLSX',

                        check() {
                            return (
                                !!window.XLSX &&
                                typeof window
                                    .XLSX ===
                                    'object'
                            );
                        }
                    }),

                    Object.freeze({
                        id:
                            'html2pdf',

                        label:
                            'html2pdf.js',

                        check() {
                            return (
                                typeof window
                                    .html2pdf ===
                                'function'
                            );
                        }
                    })
                ]);

            const vendorFailures =
                new Set();

            /*
             * Resource-error listener dipasang sebelum vendor
             * CSS/JS dideklarasikan.
             *
             * Tidak memakai inline onerror.
             */
            window.addEventListener(
                'error',
                (event) => {
                    const target =
                        event.target;

                    const vendorId =
                        target
                            ?.dataset
                            ?.simniVendor;

                    if (!vendorId) {
                        return;
                    }

                    vendorFailures.add(
                        String(
                            vendorId
                        )
                    );

                    console.error(
                        `[SIMNI Vendor] Gagal memuat: ${vendorId}`,
                        target
                            ?.getAttribute?.(
                                'src'
                            ) ||
                        target
                            ?.getAttribute?.(
                                'href'
                            ) ||
                        ''
                    );
                },
                true
            );

            function consumeSensitiveURLState() {
                try {
                    const current =
                        new URL(
                            window.location.href
                        );

                    let changed =
                        false;

                    for (
                        const key
                        of [
                            ...current
                                .searchParams
                                .keys()
                        ]
                    ) {
                        const normalized =
                            String(
                                key
                            ).toLowerCase();

                        if (
                            SENSITIVE_QUERY_KEYS
                                .includes(
                                    key
                                ) ||
                            normalized
                                .includes(
                                    'token'
                                ) ||
                            normalized
                                .includes(
                                    'secret'
                                )
                        ) {
                            current
                                .searchParams
                                .delete(
                                    key
                                );

                            changed =
                                true;
                        }
                    }

                    if (changed) {
                        const params =
                            current
                                .searchParams
                                .toString();

                        const cleanURL =
                            current.pathname +
                            (
                                params
                                    ? `?${params}`
                                    : ''
                            ) +
                            current.hash;

                        history.replaceState(
                            history.state,
                            document.title,
                            cleanURL
                        );
                    }
                } catch (error) {
                    console.error(
                        '[SIMNI Shell] Pembersihan URL sensitif gagal:',
                        error
                    );
                }
            }

            consumeSensitiveURLState();

            function authError(
                message
            ) {
                const box =
                    document
                        .getElementById(
                            'auth-error'
                        );

                if (!box) {
                    if (message) {
                        console.error(
                            message
                        );
                    }

                    return;
                }

                box.textContent =
                    String(
                        message ||
                        ''
                    );

                box.classList
                    .toggle(
                        'hidden',
                        !message
                    );
            }

            function validateVendorRuntime() {
                const missing =
                    [];

                for (
                    const vendor
                    of EXPECTED_VENDOR_GLOBALS
                ) {
                    let available =
                        false;

                    try {
                        available =
                            vendor.check() ===
                            true;
                    } catch (_) {
                        available =
                            false;
                    }

                    if (
                        !available ||
                        vendorFailures
                            .has(
                                vendor.id
                            )
                    ) {
                        missing.push(
                            vendor.label
                        );
                    }
                }

                if (
                    vendorFailures
                        .has(
                            'fontawesome'
                        )
                ) {
                    missing.push(
                        'Font Awesome'
                    );
                }

                const uniqueMissing =
                    [
                        ...new Set(
                            missing
                        )
                    ];

                const snapshot =
                    Object.freeze({
                        ok:
                            uniqueMissing
                                .length ===
                            0,

                        missing:
                            Object.freeze(
                                [
                                    ...uniqueMissing
                                ]
                            )
                    });

                window.SIMNIVendorRuntime =
                    snapshot;

                if (
                    uniqueMissing.length
                ) {
                    authError(
                        'Dependency lokal SIMNI tidak lengkap: ' +
                        uniqueMissing.join(
                            ', '
                        ) +
                        '. Output hosting/vendor harus dibangun ulang.'
                    );

                    console.error(
                        '[SIMNI Vendor] Dependency tidak lengkap:',
                        uniqueMissing
                    );

                    return false;
                }

                return true;
            }

            async function ensureAuthModule() {
                if (typeof window.startSIMNIPlatform === 'function') {
                    await window.startSIMNIPlatform();
                    return;
                }
                await import('../platform/main.js');
            }

            async function invokeAuthAction(
                name,
                ...args
            ) {
                try {
                    await ensureAuthModule();

                    const action =
                        window[
                            name
                        ];

                    if (
                        typeof action !==
                        'function'
                    ) {
                        throw new Error(
                            `Auth action ${name} belum tersedia.`
                        );
                    }

                    return await action(
                        ...args
                    );
                } catch (error) {
                    authError(
                        `Modul autentikasi gagal: ${
                            error?.message ||
                            error
                        }`
                    );

                    return false;
                }
            }

            async function handleShellAction(
                target
            ) {
                const action =
                    target
                        ?.closest?.(
                            '[data-shell-action]'
                        )
                        ?.dataset
                        ?.shellAction;

                if (!action) {
                    return false;
                }

                switch (
                    action
                ) {
                    case 'toggle-password': {
                        const btn = target.closest('[data-shell-action="toggle-password"]');
                        const targetId = btn?.dataset?.target || 'auth-password';
                        const input = document.getElementById(targetId);
                        if (input) {
                            const isPassword = input.type === 'password';
                            input.type = isPassword ? 'text' : 'password';
                            const icon = btn.querySelector('i');
                            if (icon) {
                                icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                            }
                            btn.setAttribute('aria-label', isPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
                        }
                        return true;
                    }

                    case 'show-reset-panel': {
                        const mainPanel = document.getElementById('panel-login-main');
                        const resetPanel = document.getElementById('panel-reset-password');
                        const loginEmail = document.getElementById('auth-email')?.value?.trim();
                        const resetEmail = document.getElementById('reset-auth-email');
                        const feedback = document.getElementById('reset-feedback');
                        const authError = document.getElementById('auth-error');
                        if (authError) { authError.classList.add('hidden'); authError.textContent = ''; }
                        if (feedback) feedback.classList.add('hidden');
                        if (loginEmail && resetEmail) resetEmail.value = loginEmail;
                        if (mainPanel) mainPanel.classList.add('hidden');
                        if (resetPanel) {
                            resetPanel.classList.remove('hidden');
                            resetEmail?.focus();
                        }
                        return true;
                    }

                    case 'hide-reset-panel': {
                        const mainPanel = document.getElementById('panel-login-main');
                        const resetPanel = document.getElementById('panel-reset-password');
                        const feedback = document.getElementById('reset-feedback');
                        if (feedback) feedback.classList.add('hidden');
                        if (resetPanel) resetPanel.classList.add('hidden');
                        if (mainPanel) mainPanel.classList.remove('hidden');
                        return true;
                    }

                    case 'toggle-theme':
                        return window
                            .toggleDarkMode
                            ?.();

                    default:
                        return false;
                }
            }

            function handleViewAction(
                target
            ) {
                const button =
                    target
                        ?.closest?.(
                            '[data-shell-view]'
                        );

                const view =
                    button
                        ?.dataset
                        ?.shellView;

                if (!view) {
                    return false;
                }

                window.switchView?.(
                    view
                );

                return true;
            }

            function handleModalAction(
                target
            ) {
                const openButton =
                    target
                        ?.closest?.(
                            '[data-shell-modal-open]'
                        );

                if (
                    openButton
                        ?.dataset
                        ?.shellModalOpen
                ) {
                    window.openModal?.(
                        openButton
                            .dataset
                            .shellModalOpen
                    );

                    return true;
                }

                return false;
            }

            function bindShellEvents() {
                const loginForm =
                    document
                        .getElementById(
                            'form-login-auth'
                        );

                loginForm
                    ?.addEventListener(
                        'submit',
                        (event) => {
                            event.preventDefault();

                            void invokeAuthAction(
                                'loginAuth',
                                event
                            );
                        }
                    );

                const resetForm =
                    document
                        .getElementById(
                            'form-reset-auth'
                        );

                resetForm
                    ?.addEventListener(
                        'submit',
                        async (event) => {
                            event.preventDefault();
                            const email = document.getElementById('reset-auth-email')?.value?.trim();
                            const submitBtn = document.getElementById('btn-submit-reset');
                            const feedback = document.getElementById('reset-feedback');
                            if (!email) return;

                            if (submitBtn) {
                                submitBtn.disabled = true;
                                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Mengirim tautan...';
                            }
                            if (feedback) {
                                feedback.classList.add('hidden');
                                feedback.className = 'text-xs p-3.5 rounded-xl border leading-relaxed hidden';
                            }

                            try {
                                const res = await invokeAuthAction('requestPasswordReset', email);
                                if (feedback) {
                                    feedback.classList.remove('hidden');
                                    if (res && res.ok) {
                                        feedback.className = 'text-xs p-3.5 rounded-xl border leading-relaxed bg-emerald-500/20 border-emerald-500/40 text-emerald-200';
                                        feedback.innerHTML = `<i class="fas fa-check-circle mr-1"></i> Tautan reset berhasil dikirim ke <strong>${email}</strong>.<br><span class="opacity-90">Silakan periksa Kotak Masuk atau folder Spam pada email Anda, lalu klik tautan tersebut untuk membuat kata sandi baru.</span>`;
                                    } else {
                                        feedback.className = 'text-xs p-3.5 rounded-xl border leading-relaxed bg-red-500/20 border-red-500/40 text-red-200';
                                        feedback.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> ${res?.message || 'Gagal mengirim tautan reset. Pastikan email benar.'}`;
                                    }
                                }
                            } catch (err) {
                                if (feedback) {
                                    feedback.classList.remove('hidden');
                                    feedback.className = 'text-xs p-3.5 rounded-xl border leading-relaxed bg-red-500/20 border-red-500/40 text-red-200';
                                    feedback.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> Terjadi kesalahan: ${err?.message || err}`;
                                }
                            } finally {
                                if (submitBtn) {
                                    submitBtn.disabled = false;
                                    submitBtn.innerHTML = 'Kirim Tautan Reset Sandi <i class="fas fa-paper-plane" aria-hidden="true"></i>';
                                }
                            }
                        }
                    );

                document.addEventListener(
                    'click',
                    (event) => {
                        const target =
                            event.target;

                        if (
                            handleViewAction(
                                target
                            )
                        ) {
                            return;
                        }

                        if (
                            handleModalAction(
                                target
                            )
                        ) {
                            return;
                        }

                        void handleShellAction(
                            target
                        );
                    }
                );
            }

            function registerServiceWorker() {
                if (
                    !(
                        'serviceWorker'
                        in navigator
                    )
                ) {
                    return;
                }

                // Jangan daftarkan Service Worker jika berjalan di native Android/Capacitor
                // Pada native, seluruh aset web sudah di-bundle di APK secara offline.
                if (
                    Boolean(window.Capacitor) ||
                    Boolean(window.SIMNIPlatform) ||
                    window.location.protocol === 'capacitor:'
                ) {
                    console.log('SIMNI Native Runtime terdeteksi: Service Worker web dilewati.');
                    return;
                }

                const pageStartedWithController = Boolean(
                    navigator.serviceWorker.controller
                );
                let reloadingForServiceWorker = false;

                navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => {
                        if (!pageStartedWithController) return;
                        if (reloadingForServiceWorker) return;
                        reloadingForServiceWorker = true;
                        // Keep unsaved work in this tab. The next navigation uses
                        // the newly active release; no automatic page reload.
                        window.toast?.('Versi baru tersedia. Tutup lalu buka SIMNI setelah selesai menyimpan.', 'info');
                    }
                );

                window.addEventListener(
                    'load',
                    () => {
                        navigator
                            .serviceWorker
                            .register(
                                './sw.js'
                            )
                            .then(
                                (
                                    registration
                                ) => {
                                    console.log(
                                        'Service Worker aktif:',
                                        registration.scope
                                    );
                                    void registration.update();
                                }
                            )
                            .catch(
                                (error) => {
                                    console.error(
                                        'Service Worker gagal:',
                                        error
                                    );
                                }
                            );
                    }
                );
            }

            window.addEventListener(
                'DOMContentLoaded',
                () => {
                    bindShellEvents();


                },
                {
                    once:
                        true
                }
            );

            registerServiceWorker();

            window.validateSIMNIVendorRuntime =
                validateVendorRuntime;
        }());
