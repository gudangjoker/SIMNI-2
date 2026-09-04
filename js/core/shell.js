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
                await import('./js/platform/main.js');
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
                    case 'password-reset':
                        return invokeAuthAction(
                            'requestPasswordReset'
                        );

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
                        window.location.reload();
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
