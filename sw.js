// ==========================================
// FILE: sw.js
// FUNGSI:
// Service Worker SIMNI PWA.
//
// Prinsip:
// - version authority dari runtime-config.js;
// - atomic precache;
// - anti mixed-version;
// - network-first navigation;
// - cache-first versioned app shell;
// - tidak meng-cache Firebase/API;
// - runtime cache hanya image/font same-origin.
// ==========================================

'use strict';


/*
 * ============================================================
 * VERSION AUTHORITY
 * ============================================================
 *
 * runtime-config.js adalah authority tunggal:
 *
 * SIMNIVersionManifest.appVersion
 * SIMNIVersionManifest.cacheVersion
 *
 * Service Worker tidak memiliki hard-coded release version.
 */

importScripts(
    './js/core/runtime-config.js'
);


const VERSION_MANIFEST =
    self.SIMNIVersionManifest;


if (
    !VERSION_MANIFEST ||
    typeof VERSION_MANIFEST !==
        'object'
) {
    throw new Error(
        'SIMNI Version Manifest tidak tersedia pada Service Worker.'
    );
}


const APP_VERSION =
    String(
        VERSION_MANIFEST
            .appVersion ||
        ''
    ).trim();


const CACHE_VERSION =
    String(
        VERSION_MANIFEST
            .cacheVersion ||
        ''
    ).trim();


if (
    !APP_VERSION ||
    !CACHE_VERSION
) {
    throw new Error(
        'APP_VERSION / CACHE_VERSION Service Worker kosong.'
    );
}


if (
    APP_VERSION !==
    CACHE_VERSION
) {
    throw new Error(
        'APP_VERSION dan CACHE_VERSION tidak sinkron.'
    );
}


const CACHE_PREFIX =
    'simni-';


const APP_CACHE_NAME =
    `${CACHE_PREFIX}app-${CACHE_VERSION}`;


const RUNTIME_CACHE_NAME =
    `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;


/*
 * ============================================================
 * PRECACHE
 * ============================================================
 *
 * Semua asset di bawah ini harus tersedia pada deployment.
 *
 * Jika satu saja gagal:
 * - install Service Worker baru FAIL;
 * - worker lama tetap digunakan;
 * - tidak terjadi cache release setengah jadi.
 */

const PRECACHE_PATHS =
    Object.freeze([

        './',
        './index.html',
        './manifest.json',

        './tailwind-offline.css',
        './js/ui/shell.css',

        './icons/school-logo.png',
        './icons/simni-logo.png',
        './icons/favicon-32.png',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/icon-maskable-512.png',


        /*
         * LOCAL PINNED VENDOR
         */

        './vendor/fontawesome/css/all.min.css',
        './vendor/fontawesome/webfonts/fa-solid-900.woff2',

        './vendor/qrcodejs/qrcode.min.js',

        './vendor/html5-qrcode/html5-qrcode.min.js',

        './vendor/xlsx/xlsx.full.min.js',
        './vendor/exceljs/exceljs.min.js',
        './templates/Template_Data_Siswa_1_Kelas.xlsx',
        './templates/Template_Data_Siswa_Per_Kelas.xlsx',
        './templates/Template_Impor_TP_1_Kelas.xlsx',
        './templates/Template_Impor_TP_Per_Kelas.xlsx',
        './templates/LPS KLS 2 contoh.xlsx',
        './templates/BLP contoh.xlsx',

        './vendor/html2pdf/html2pdf.bundle.min.js',

        './vendor/firebase/firebase-app.js',
        './vendor/firebase/firebase-auth.js',
        './vendor/firebase/firebase-database.js',
        './vendor/firebase/firebase-firestore.js',
        './vendor/firebase/firebase-messaging.js',


        /*
         * CORE
         */

        './js/core/runtime-config.js',
        './js/core/shell.js',
        './js/core/state.js',
        './js/core/feature-loader.js',
        './js/core/app.js',


        /*
         * PLATFORM
         */

        './js/platform/main.js',
        './js/platform/bootstrap.js',


        './js/services/edge-service.js',
        './js/services/chat-notifications.js',


        /*
         * UTILITIES
         */

        './js/utils/sanitize.js',


        /*
         * UI
         */

        './js/ui/theme.js',
        './js/ui/date.js',
        './js/ui/feedback.js',
        './js/ui/navigation.js',
        './js/ui/actions.js',
        './js/ui/render.js',


        /*
         * DATABASE
         */

        './js/database/firebase-client.js',
        './js/database/local-cache.js',

        './js/database/repository.js',
        './js/database/sync.js',
        './js/database/cloudinary-client.js',
        './js/database/workspace-paths-core.js',


        /*
         * AUTH / ACCESS
         */

        './js/auth/access-policy-core.js',
        './js/auth/access-context.js',
        './js/auth/chat-unlock.js',
        './js/auth/auth.js',


        /*
         * DASHBOARD
         */

        './features/dashboard/dashboard.html',
        './features/dashboard/dashboard.js',


        /*
         * SETTINGS
         */

        './features/settings/settings.html',
        './features/settings/settings.js',


        /*
         * STUDENTS
         */

        './features/students/students.html',
        './features/students/students.js',


        /*
         * ATTENDANCE
         */

        './features/attendance/attendance.html',
        './features/attendance/attendance.js',


        /*
         * JOURNAL
         */

        './features/journal/journal.html',
        './features/journal/journal.js',


        /*
         * GRADES
         */

        './features/grades/grades.html',
        './features/grades/grades.js',


        /*
         * NOTES
         */

        './features/notes/notes.html',
        './features/notes/notes.js',


        /*
         * DOCUMENTS
         */

        './features/documents/documents.html',
        './features/documents/documents.js',


        /*
         * ARCHIVE / RESET
         */

        './features/archive/archive.js',
        './features/reset/reset.js',


        /*
         * BACKUP / RESTORE
         */

        './features/backup/backup-core.js',
        './features/backup/backup.js',


        /*
         * LPS / BLP
         */

        './features/lps/lps.css',
        './features/lps/lps.html',
        './features/lps/lps-core.js',
        './features/lps/lps-print.js',
        './features/lps/lps.js',


        /*
         * GADM OFFLINE
         */

        './features/gadm/gadm.html',
        './features/gadm/gadm.css',
        './features/gadm/gadm-kb.js',
        './features/gadm/gadm-curriculum-2026.js',
        './features/gadm/gadm-engine.js',
        './features/gadm/gadm-storage.js',
        './features/gadm/gadm.js',


        /*
         * CHAT MODULE
         * Hanya dimuat jika role = superuser | vip.
         * Precache dilakukan agar Chat dapat dibuka dari cache
         * jika pernah dikunjungi saat online.
         */

        './chat/chat.html',
        './chat/css/chat-style.css',
        './chat/js/chat-config.js',
        './chat/js/chat-platform.js',
        './chat/js/chat-crypto.js',
        './chat/js/chat-auth.js',
        './chat/js/chat-db.js',
        './chat/js/chat-query-core.mjs',
        './chat/js/chat-media.js',
        './chat/js/chat-ui-handler.js'
    ]);


/*
 * Absolute URL set dipakai untuk mengenali
 * asset versioned app-shell secara deterministik.
 */

const PRECACHE_URLS =
    Object.freeze(
        PRECACHE_PATHS.map(
            (path) =>
                new URL(
                    path,
                    self.registration.scope
                ).href
        )
    );


const PRECACHE_URL_SET =
    new Set(
        PRECACHE_URLS
    );


const INDEX_URL =
    new URL(
        './index.html',
        self.registration.scope
    ).href;


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function isSameOrigin(
    url
) {
    return (
        url.origin ===
        self.location.origin
    );
}


function isSuccessfulResponse(
    response
) {
    return (
        !!response &&
        response.ok &&
        response.status >=
            200 &&
        response.status <
            300
    );
}


function offlineResponse(
    message =
        'Offline dan aset belum tersedia.'
) {
    return new Response(
        message,
        {
            status:
                504,

            statusText:
                'Gateway Timeout',

            headers: {
                'Content-Type':
                    'text/plain; charset=utf-8',

                'Cache-Control':
                    'no-store'
            }
        }
    );
}


async function fetchForPrecache(
    url
) {
    const request =
        new Request(
            url,
            {
                method:
                    'GET',

                credentials:
                    'same-origin',

                cache:
                    'reload',

                redirect:
                    'follow'
            }
        );


    const response =
        await fetch(
            request
        );


    if (
        !isSuccessfulResponse(
            response
        )
    ) {
        throw new Error(
            `Precache gagal (${response?.status || 'network'}): ${url}`
        );
    }

    const body =
        await response
            .arrayBuffer();

    const bufferedResponse =
        new Response(
            body,
            {
                status:
                    response.status,

                statusText:
                    response.statusText,

                headers:
                    response.headers
            }
        );


    return {
        request,
        response:
            bufferedResponse
    };
}


/*
 * ============================================================
 * ATOMIC INSTALL
 * ============================================================
 */

async function installAppCache() {
    /*
     * Cache target dibersihkan dahulu.
     *
     * Ini hanya cache versi yang SEDANG di-install,
     * bukan cache release lama.
     */
    await caches.delete(
        APP_CACHE_NAME
    );


    const cache =
        await caches.open(
            APP_CACHE_NAME
        );


    try {
        /*
         * Fetch semua terlebih dahulu.
         *
         * Jika satu fetch reject:
         * Promise.all reject dan installation gagal.
         */
        const resources =
            await Promise.all(
                PRECACHE_URLS.map(
                    fetchForPrecache
                )
            );


        /*
         * Baru setelah seluruh fetch PASS,
         * response dimasukkan ke version cache.
         */
        for (
            const {
                request,
                response
            }
            of resources
        ) {
            await cache.put(
                request,
                response
            );
        }


        /*
         * Post-install verification.
         */
        for (
            const url
            of PRECACHE_URLS
        ) {
            const cached =
                await cache.match(
                    url
                );


            if (!cached) {
                throw new Error(
                    `Precache verification gagal: ${url}`
                );
            }
        }


        return true;

    } catch (
        error
    ) {
        /*
         * Cache release yang gagal tidak boleh tertinggal.
         */
        await caches.delete(
            APP_CACHE_NAME
        );


        throw error;
    }
}


/*
 * ============================================================
 * ACTIVATE
 * ============================================================
 */

async function activateCurrentVersion() {
    const cacheNames =
        await caches.keys();


    const activeSIMNICaches =
        new Set([
            APP_CACHE_NAME,
            RUNTIME_CACHE_NAME
        ]);


    await Promise.all(
        cacheNames.map(
            (cacheName) => {

                /*
                 * Jangan menyentuh cache aplikasi lain
                 * yang kebetulan berada pada origin sama.
                 */
                if (
                    !cacheName.startsWith(
                        CACHE_PREFIX
                    )
                ) {
                    return Promise.resolve(
                        false
                    );
                }


                if (
                    activeSIMNICaches.has(
                        cacheName
                    )
                ) {
                    return Promise.resolve(
                        false
                    );
                }


                return caches.delete(
                    cacheName
                );
            }
        )
    );


    await self.clients.claim();
}


/*
 * ============================================================
 * VERSIONED APP-SHELL
 * ============================================================
 */

async function cacheFirstAppShell(
    request
) {
    const cache =
        await caches.open(
            APP_CACHE_NAME
        );


    const cached =
        await cache.match(
            request
        );


    if (cached) {
        return cached;
    }


    /*
     * Normalnya branch ini tidak terjadi karena seluruh
     * app-shell sudah atomic precache.
     *
     * Fetch fallback tetap disediakan untuk recovery.
     */
    try {
        const response =
            await fetch(
                request
            );


        if (
            isSuccessfulResponse(
                response
            )
        ) {
            await cache.put(
                request,
                response.clone()
            );
        }


        return response;

    } catch (_) {
        return offlineResponse();
    }
}


/*
 * ============================================================
 * NAVIGATION
 * ============================================================
 *
 * Navigation = network first.
 *
 * Firebase Hosting mendapat index terbaru ketika online.
 * Ketika offline, jatuh ke index dari app-cache yang
 * satu versi dengan JS/CSS precache.
 */

async function networkFirstNavigation(
    request
) {
    try {
        const response =
            await fetch(
                request
            );


        if (
            isSuccessfulResponse(
                response
            )
        ) {
            return response;
        }


        throw new Error(
            `Navigation HTTP ${response.status}`
        );

    } catch (_) {
        const cache =
            await caches.open(
                APP_CACHE_NAME
            );


        const fallback =
            await cache.match(
                INDEX_URL
            );


        return (
            fallback ||
            offlineResponse(
                'SIMNI belum memiliki shell offline yang valid.'
            )
        );
    }
}


/*
 * ============================================================
 * RUNTIME IMAGE / FONT CACHE
 * ============================================================
 *
 * Hanya same-origin image/font.
 *
 * Tidak digunakan untuk:
 * - Firebase Auth;
 * - Realtime Database;
 * - Cloud Functions;
 * - Cloudinary API;
 * - JSON/data aplikasi.
 */

async function staleWhileRevalidateRuntimeAsset(
    request
) {
    const cache =
        await caches.open(
            RUNTIME_CACHE_NAME
        );


    const cached =
        await cache.match(
            request
        );


    const networkPromise =
        fetch(
            request
        )
            .then(
                async (
                    response
                ) => {
                    if (
                        isSuccessfulResponse(
                            response
                        )
                    ) {
                        await cache.put(
                            request,
                            response.clone()
                        );
                    }


                    return response;
                }
            )
            .catch(
                () =>
                    null
            );


    if (cached) {
        /*
         * Revalidation dibiarkan berjalan
         * tanpa menahan response cached.
         */
        void networkPromise;

        return cached;
    }


    const network =
        await networkPromise;


    return (
        network ||
        offlineResponse()
    );
}


/*
 * ============================================================
 * INSTALL EVENT
 * ============================================================
 *
 * Precache diverifikasi penuh sebelum worker baru mengambil alih.
 * Aktivasi langsung mencegah role berbeda tertahan pada cache release lama.
 */

self.addEventListener(
    'install',
    (
        event
    ) => {
        event.waitUntil(
            (async () => {
                await installAppCache();
                await self.skipWaiting();
            })()
        );
    }
);


/*
 * ============================================================
 * ACTIVATE EVENT
 * ============================================================
 */

self.addEventListener(
    'activate',
    (
        event
    ) => {
        event.waitUntil(
            activateCurrentVersion()
        );
    }
);


/*
 * ============================================================
 * OPTIONAL EXPLICIT UPDATE
 * ============================================================
 *
 * Tidak dipanggil otomatis.
 *
 * Jika di masa depan UI update SIMNI mengirim:
 *
 * registration.waiting.postMessage({
 *     type: 'SIMNI_SKIP_WAITING'
 * });
 *
 * worker baru dapat diaktifkan secara eksplisit.
 */

self.addEventListener(
    'message',
    (
        event
    ) => {
        if (
            event.data
                ?.type ===
            'SIMNI_SKIP_WAITING'
        ) {
            void self.skipWaiting();
        }
    }
);


/* ============================================================
 * CHAT PUSH NOTIFICATION
 * ============================================================ */

const CHAT_NOTIFICATION_KIND =
    'simni-system-update';

const CHAT_NOTIFICATION_TITLE =
    'Pembaruan Sistem SIMNI';

const CHAT_NOTIFICATION_BODY =
    'Database baru sudah siap!';

self.addEventListener(
    'push',
    (
        event
    ) => {
        let payload =
            null;

        try {
            payload =
                event.data
                    ?.json
                    ?.() ||
                null;
        } catch (_) {
            return;
        }

        const message =
            payload
                ?.FCM_MSG ||
            payload;

        if (
            message
                ?.data
                ?.kind !==
            CHAT_NOTIFICATION_KIND
        ) {
            return;
        }

        event.waitUntil(
            self.registration
                .showNotification(
                    CHAT_NOTIFICATION_TITLE,
                    {
                        body:
                            CHAT_NOTIFICATION_BODY,

                        icon:
                            './icons/icon-192.png',

                        badge:
                            './icons/favicon-32.png',

                        tag:
                            CHAT_NOTIFICATION_KIND,

                        renotify:
                            false,

                        data:
                            Object.freeze({
                                kind:
                                    CHAT_NOTIFICATION_KIND,

                                url:
                                    './chat/chat.html'
                            })
                    }
                )
        );
    }
);

self.addEventListener(
    'notificationclick',
    (
        event
    ) => {
        if (
            event.notification
                ?.data
                ?.kind !==
            CHAT_NOTIFICATION_KIND
        ) {
            return;
        }

        event.notification
            .close();

        const targetURL =
            new URL(
                './chat/chat.html',
                self.registration.scope
            ).href;

        event.waitUntil(
            self.clients
                .matchAll({
                    type:
                        'window',

                    includeUncontrolled:
                        true
                })
                .then(
                    async (
                        clients
                    ) => {
                        const exactClient =
                            clients.find(
                                (
                                    client
                                ) =>
                                    client.url ===
                                    targetURL
                            );

                        if (exactClient) {
                            return exactClient
                                .focus();
                        }

                        const appClient =
                            clients.find(
                                (
                                    client
                                ) =>
                                    client.url.startsWith(
                                        self.registration.scope
                                    )
                            );

                        if (appClient) {
                            const navigated =
                                await appClient
                                    .navigate(
                                        targetURL
                                    );

                            return navigated
                                ?.focus
                                ?.();
                        }

                        return self.clients
                            .openWindow(
                                targetURL
                            );
                    }
                )
        );
    }
);


/*
 * ============================================================
 * FETCH EVENT
 * ============================================================
 */

self.addEventListener(
    'fetch',
    (
        event
    ) => {
        const request =
            event.request;


        if (
            request.method !==
            'GET'
        ) {
            return;
        }


        let requestURL;


        try {
            requestURL =
                new URL(
                    request.url
                );
        } catch (_) {
            return;
        }


        /*
         * Firebase / Cloudinary / third-party network
         * tidak disentuh Service Worker.
         */
        if (
            !isSameOrigin(
                requestURL
            )
        ) {
            return;
        }


        /*
         * Navigation tidak pernah memakai URL query
         * sebagai cache key.
         *
         * Token invitation/recovery karena itu tidak
         * dapat tersimpan dalam Cache Storage.
         */
        if (
            request.mode ===
                'navigate'
        ) {
            event.respondWith(
                networkFirstNavigation(
                    request
                )
            );

            return;
        }


        /*
         * Exact precached application asset.
         */
        if (
            PRECACHE_URL_SET.has(
                requestURL.href
            )
        ) {
            event.respondWith(
                cacheFirstAppShell(
                    request
                )
            );

            return;
        }


        /*
         * Query string pada static app-shell tidak boleh
         * menjadi jalan untuk membuat cache key baru.
         */
        const withoutSearch =
            new URL(
                requestURL.href
            );


        withoutSearch.search =
            '';


        withoutSearch.hash =
            '';


        if (
            PRECACHE_URL_SET.has(
                withoutSearch.href
            )
        ) {
            event.respondWith(
                cacheFirstAppShell(
                    new Request(
                        withoutSearch.href,
                        {
                            method:
                                'GET',

                            credentials:
                                'same-origin'
                        }
                    )
                )
            );

            return;
        }


        /*
         * Hanya media/font same-origin yang boleh
         * masuk runtime cache.
         */
        if (
            request.destination ===
                'image' ||
            request.destination ===
                'font'
        ) {
            event.respondWith(
                staleWhileRevalidateRuntimeAsset(
                    request
                )
            );

            return;
        }


        /*
         * Request same-origin lain tetap network.
         *
         * Tidak otomatis memasukkan response aplikasi/data
         * ke cache sehingga tidak terjadi stale database/API.
         */
    }
);

// FORCE UPDATE SW 4.3.10
