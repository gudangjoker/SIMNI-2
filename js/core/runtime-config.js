// ==========================================
// FILE: js/core/runtime-config.js
// FUNGSI:
// Authority tunggal konfigurasi runtime,
// Firebase cloud asli, dan version manifest SIMNI.
// ==========================================

(function initSIMNIRuntimeConfig(
    root
) {
    'use strict';

    if (
        !root ||
        typeof root !==
            'object'
    ) {
        throw new Error(
            'Global runtime SIMNI tidak tersedia.'
        );
    }

    const VERSION_MANIFEST =
        Object.freeze({
            appVersion:
                '4.8.2',

            cacheVersion:
                '4.8.2',

            backupSchemaVersion:
                3,

            lpsSchemaVersion:
                3
        });

    const FIREBASE_CONFIG =
        Object.freeze({
            apiKey:
                'AIzaSyBFA_-C90fP9vh6fbIfJaGSab-ctQxzJf0',

            authDomain:
                'admin-kelas-3a.firebaseapp.com',

            databaseURL:
                'https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app',

            projectId:
                'admin-kelas-3a',

            storageBucket:
                'admin-kelas-3a.firebasestorage.app',

            messagingSenderId:
                '618633503047',

            appId:
                '1:618633503047:web:43ac72d77a93d2b97a2c62'
        });

    const REQUIRED_FIREBASE_KEYS =
        Object.freeze([
            'apiKey',
            'authDomain',
            'databaseURL',
            'projectId',
            'storageBucket',
            'messagingSenderId',
            'appId'
        ]);

    const LOCAL_HOSTNAMES =
        Object.freeze([
            'localhost',
            '127.0.0.1',
            '::1',
            '[::1]'
        ]);

    function cleanText(
        value
    ) {
        return String(
            value ??
            ''
        ).trim();
    }

    function assertVersion(
        value,
        label
    ) {
        const version =
            cleanText(
                value
            );

        if (
            !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
                .test(
                    version
                )
        ) {
            throw new Error(
                `${label} tidak valid: ${version || '-'}`
            );
        }

        return version;
    }

    function assertSchemaVersion(
        value,
        label
    ) {
        const version =
            Number(
                value
            );

        if (
            !Number.isInteger(
                version
            ) ||
            version <
                1
        ) {
            throw new Error(
                `${label} harus berupa integer positif.`
            );
        }

        return version;
    }

    function validateVersionManifest(
        manifest
    ) {
        if (
            !manifest ||
            typeof manifest !==
                'object' ||
            Array.isArray(
                manifest
            )
        ) {
            throw new Error(
                'Version manifest SIMNI tidak valid.'
            );
        }

        const appVersion =
            assertVersion(
                manifest.appVersion,
                'APP_VERSION'
            );

        const cacheVersion =
            assertVersion(
                manifest.cacheVersion,
                'CACHE_VERSION'
            );

        /*
         * Pada release final, APP dan CACHE version
         * wajib identik agar tidak terjadi mixed source.
         */
        if (
            appVersion !==
            cacheVersion
        ) {
            throw new Error(
                'APP_VERSION dan CACHE_VERSION tidak sinkron.'
            );
        }

        return Object.freeze({
            appVersion,

            cacheVersion,

            backupSchemaVersion:
                assertSchemaVersion(
                    manifest
                        .backupSchemaVersion,
                    'BACKUP_SCHEMA_VERSION'
                ),

            lpsSchemaVersion:
                assertSchemaVersion(
                    manifest
                        .lpsSchemaVersion,
                    'LPS_SCHEMA_VERSION'
                )
        });
    }

    function validateFirebaseConfig(
        config
    ) {
        if (
            !config ||
            typeof config !==
                'object' ||
            Array.isArray(
                config
            )
        ) {
            throw new Error(
                'Firebase config SIMNI tidak valid.'
            );
        }

        for (
            const key
            of REQUIRED_FIREBASE_KEYS
        ) {
            if (
                !cleanText(
                    config[
                        key
                    ]
                )
            ) {
                throw new Error(
                    `Firebase config "${key}" kosong.`
                );
            }
        }

        let databaseURL;

        try {
            databaseURL =
                new URL(
                    config.databaseURL
                );
        } catch (_) {
            throw new Error(
                'Firebase databaseURL tidak valid.'
            );
        }

        if (
            databaseURL.protocol !==
            'https:'
        ) {
            throw new Error(
                'Firebase databaseURL wajib HTTPS.'
            );
        }

        const projectId =
            cleanText(
                config.projectId
            );

        const expectedAuthDomain =
            `${projectId}.firebaseapp.com`;

        if (
            cleanText(
                config.authDomain
            ) !==
            expectedAuthDomain
        ) {
            throw new Error(
                'Firebase authDomain tidak cocok dengan projectId.'
            );
        }

        const databaseHost =
            databaseURL.hostname
                .toLowerCase();

        if (
            !databaseHost.includes(
                projectId
                    .toLowerCase()
            ) ||
            !databaseHost.endsWith(
                '.firebasedatabase.app'
            )
        ) {
            throw new Error(
                'Firebase databaseURL tidak cocok dengan project SIMNI.'
            );
        }

        const senderId =
            cleanText(
                config
                    .messagingSenderId
            );

        if (
            !/^\d+$/.test(
                senderId
            )
        ) {
            throw new Error(
                'Firebase messagingSenderId tidak valid.'
            );
        }

        const appId =
            cleanText(
                config.appId
            );

        if (
            !/^1:\d+:web:[0-9a-f]+$/i
                .test(
                    appId
                )
        ) {
            throw new Error(
                'Firebase appId tidak valid.'
            );
        }

        return true;
    }

    function locationSnapshot() {
        const location =
            root.location;

        if (
            !location ||
            typeof location !==
                'object'
        ) {
            /*
             * Worker/test runtime tanpa navigation context.
             */
            return Object.freeze({
                hostname:
                    '',

                protocol:
                    '',

                origin:
                    '',

                isLocalHost:
                    false,

                isSecureTransport:
                    true
            });
        }

        const hostname =
            cleanText(
                location.hostname
            )
                .toLowerCase();

        const protocol =
            cleanText(
                location.protocol
            )
                .toLowerCase();

        const isLocalHost =
            LOCAL_HOSTNAMES
                .includes(
                    hostname
                );

        const isSecureTransport =
            protocol ===
                'https:' ||
            isLocalHost;

        return Object.freeze({
            hostname,

            protocol,

            origin:
                cleanText(
                    location.origin
                ),

            isLocalHost,

            isSecureTransport
        });
    }

    const versions =
        validateVersionManifest(
            VERSION_MANIFEST
        );

    validateFirebaseConfig(
        FIREBASE_CONFIG
    );

    const environment =
        locationSnapshot();

    function resolveAuditMode() {
        const location =
            root.location;

        if (
            !location ||
            typeof location !==
                'object'
        ) {
            return Object.freeze({
                requested:
                    false,

                mode:
                    'firebase-cloud'
            });
        }

        const parameters =
            new URLSearchParams(
                cleanText(
                    location.search
                )
            );

        return Object.freeze({
            requested: false,
            mode: 'firebase-cloud'
        });
    }

    const auditMode =
        resolveAuditMode();

    /*
     * Localhost HTTP memang diizinkan untuk pengujian nyata.
     * Hosting/non-localhost wajib HTTPS.
     */
    if (
        environment.protocol &&
        !environment
            .isSecureTransport
    ) {
        throw new Error(
            'SIMNI non-localhost wajib dijalankan melalui HTTPS.'
        );
    }

    const RUNTIME =
        Object.freeze({
            mode:
                auditMode.mode,

            firebaseEmulator:
                false,

            staging:
                false,

            mock:
                auditMode.requested,

            projectId:
                auditMode.requested
                    ? 'simni-audit-local'
                    : FIREBASE_CONFIG
                        .projectId,

            audit:
                auditMode.requested,

            productionDatabaseContactAllowed:
                !auditMode.requested,

            appVersion:
                versions
                    .appVersion,

            cacheVersion:
                versions
                    .cacheVersion,

            backupSchemaVersion:
                versions
                    .backupSchemaVersion,

            lpsSchemaVersion:
                versions
                    .lpsSchemaVersion,

            isLocalHost:
                environment
                    .isLocalHost,

            isSecureTransport:
                environment
                    .isSecureTransport
        });

    function getRuntimeSnapshot() {
        /*
         * Diagnostics hanya memuat metadata non-secret.
         */
        return Object.freeze({
            mode:
                RUNTIME.mode,

            firebaseEmulator:
                false,

            staging:
                false,

            mock:
                RUNTIME.mock,

            projectId:
                RUNTIME
                    .projectId,

            audit:
                RUNTIME.audit,

            productionDatabaseContactAllowed:
                RUNTIME
                    .productionDatabaseContactAllowed,

            appVersion:
                RUNTIME
                    .appVersion,

            cacheVersion:
                RUNTIME
                    .cacheVersion,

            backupSchemaVersion:
                RUNTIME
                    .backupSchemaVersion,

            lpsSchemaVersion:
                RUNTIME
                    .lpsSchemaVersion,

            hostname:
                environment
                    .hostname,

            protocol:
                environment
                    .protocol,

            isLocalHost:
                environment
                    .isLocalHost,

            isSecureTransport:
                environment
                    .isSecureTransport
        });
    }

    /*
     * Compatibility globals.
     *
     * Existing consumers masih membaca:
     * - window.firebaseConfig
     * - window.SIMNI_APP_VERSION
     * - window.SIMNIRuntime
     *
     * Service Worker final juga dapat membaca properti yang sama
     * melalui globalThis setelah importScripts(runtime-config.js).
     */
    root.firebaseConfig =
        RUNTIME.mock
            ? null
            : FIREBASE_CONFIG;

    root.SIMNI_APP_VERSION =
        versions.appVersion;

    root.SIMNI_CACHE_VERSION =
        versions.cacheVersion;

    root.SIMNI_BACKUP_SCHEMA_VERSION =
        versions.backupSchemaVersion;

    root.SIMNI_LPS_SCHEMA_VERSION =
        versions.lpsSchemaVersion;

    root.SIMNIVersionManifest =
        versions;

    root.SIMNIRuntime =
        RUNTIME;

    root.getSIMNIRuntimeSnapshot =
        getRuntimeSnapshot;

    root.SIMNIRuntimeConfig =
        Object.freeze({
            firebaseConfig:
                RUNTIME.mock
                    ? null
                    : FIREBASE_CONFIG,

            versions,

            runtime:
                RUNTIME,

            getRuntimeSnapshot
        });
}(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : this
));
