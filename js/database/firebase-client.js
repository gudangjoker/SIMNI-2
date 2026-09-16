// ==========================================
// FILE: js/database/firebase-client.js
// FUNGSI:
// Authority tunggal inisialisasi Firebase client SIMNI.
// Tidak menyediakan generic privileged audit writer.
// ==========================================

import {
    initializeApp,
    getApp,
    getApps
} from '../../vendor/firebase/firebase-app.js';

import {
    getDatabase
} from '../../vendor/firebase/firebase-database.js';

import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from '../../vendor/firebase/firebase-auth.js';

const REQUIRED_CONFIG_KEYS =
    Object.freeze([
        'apiKey',
        'authDomain',
        'databaseURL',
        'projectId',
        'appId'
    ]);

function cleanText(value) {
    return String(
        value ?? ''
    ).trim();
}

function validateFirebaseConfig(
    value
) {
    if (
        !value ||
        typeof value !==
            'object' ||
        Array.isArray(value)
    ) {
        throw new Error(
            'Konfigurasi Firebase SIMNI belum dimuat.'
        );
    }

    const config = {
        ...value
    };

    for (
        const key
        of REQUIRED_CONFIG_KEYS
    ) {
        if (
            !cleanText(
                config[key]
            )
        ) {
            throw new Error(
                `Konfigurasi Firebase "${key}" belum tersedia.`
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
            'Firebase databaseURL wajib menggunakan HTTPS.'
        );
    }

    const projectId =
        cleanText(
            config.projectId
        );

    const authDomain =
        cleanText(
            config.authDomain
        );

    if (
        !authDomain.endsWith(
            '.firebaseapp.com'
        )
    ) {
        throw new Error(
            'Firebase authDomain tidak valid.'
        );
    }

    return Object.freeze({
        ...config,

        projectId,

        authDomain,

        databaseURL:
            databaseURL.href.replace(
                /\/$/,
                ''
            )
    });
}

function validateRuntime(
    value
) {
    const runtimeConfig =
        value &&
        typeof value ===
            'object'
            ? value
            : {};

    const emulator =
        runtimeConfig
            .firebaseEmulator ===
        true;

    /*
     * Source produksi v4.3.4 memang menggunakan Firebase cloud asli.
     * Tidak boleh muncul emulator secara implisit.
     */
    if (emulator) {
        throw new Error(
            'Firebase Emulator tidak diizinkan oleh runtime produksi SIMNI saat ini.'
        );
    }

    const mode =
        cleanText(
            runtimeConfig.mode ||
            'firebase-cloud'
        );

    if (
        mode !== 'firebase-cloud'
    ) {
        throw new Error(
            `Mode Firebase tidak dikenali: ${mode}`
        );
    }

    return Object.freeze({
        ...runtimeConfig,

        mode:
            mode,

        firebaseEmulator:
            false
    });
}

function sameFirebaseProject(
    app,
    config
) {
    if (
        !app?.options
    ) {
        return false;
    }

    const activeProjectId =
        cleanText(
            app.options
                .projectId
        );

    const activeDatabaseURL =
        cleanText(
            app.options
                .databaseURL
        ).replace(
            /\/$/,
            ''
        );

    return (
        activeProjectId ===
            config.projectId &&
        activeDatabaseURL ===
            config.databaseURL
    );
}

function initializeFirebaseOnce(
    config
) {
    const apps =
        getApps();

    if (!apps.length) {
        return initializeApp(
            config
        );
    }

    const existing =
        getApp();

    if (
        !sameFirebaseProject(
            existing,
            config
        )
    ) {
        throw new Error(
            'Firebase [DEFAULT] sudah diinisialisasi dengan project/database yang berbeda. Bootstrap SIMNI diblokir.'
        );
    }

    return existing;
}

export const runtime =
    validateRuntime(
        window.SIMNIRuntime
    );

const config = validateFirebaseConfig(window.firebaseConfig);

export const firebaseApp = initializeFirebaseOnce(config);
export const database = getDatabase(firebaseApp);


export const auth = getAuth(firebaseApp);

export const authPersistenceReady = setPersistence(
    auth,
    browserLocalPersistence
);

const databaseTarget =
    Object.freeze({
        mode:
            runtime.mode,

        emulator:
            false,

        projectId:
            config.projectId,

        databaseURL:
            config.databaseURL,

        authDomain:
            config.authDomain,

        appVersion:
            cleanText(
                runtime.appVersion ||
                window.SIMNI_APP_VERSION ||
                ''
            ) ||
            null
    });

window.SIMNIDatabaseTarget =
    databaseTarget;

export function applyFirebaseRuntimeUI() {
    const project =
        document.getElementById(
            'firebase-project-display'
        );

    if (project) {
        project.textContent = `Firebase: ${config.projectId}`;
    }

    const target =
        document.getElementById(
            'firebase-target-display'
        );

    if (target) {
        target.textContent = 'Realtime Database · Firebase Cloud';
    }
}

export function getFirebaseRuntimeSnapshot() {
    return Object.freeze({
        mode:
            databaseTarget.mode,

        emulator:
            false,

        projectId:
            databaseTarget.projectId,

        databaseURL:
            databaseTarget.databaseURL,

        authDomain:
            databaseTarget.authDomain,

        appVersion:
            databaseTarget.appVersion,

        authenticated:
            !!auth.currentUser,

        uid:
            auth.currentUser
                ?.uid ||
            null
    });
}

/*
 * COMPATIBILITY BRIDGE
 * --------------------
 * Generic audit event dari browser DIHAPUS sebagai authority.
 *
 * Worker menulis receipt audit sendiri hanya setelah
 * operasi privileged benar-benar berhasil.
 *
 * Bridge ini sengaja tidak melakukan network request dan tidak menerima
 * payload client sebagai bukti audit. Consumer lama dapat tetap `await`
 * fungsi ini sampai direkonstruksi tanpa menyebabkan exception.
 */
export async function logSIMNIAuditEvent(action, targetId = '', details = {}, options = {}) {
    if (typeof window !== 'undefined' && typeof window.dbRecordAuthoritativeAudit === 'function') {
        return window.dbRecordAuthoritativeAudit(action, targetId, details, options);
    }
    return Object.freeze({
        ok: false,
        blocked: true,
        authority: 'server-only',
        reason: 'REPOSITORY_NOT_READY'
    });
}

window.logSIMNIAuditEvent =
    logSIMNIAuditEvent;

const SIMNIFirebaseClient =
    Object.freeze({
        app:
            firebaseApp,

        database,

        auth,

        runtime,

        target:
            databaseTarget,

        applyRuntimeUI:
            applyFirebaseRuntimeUI,

        getRuntimeSnapshot:
            getFirebaseRuntimeSnapshot
    });

window.SIMNIFirebaseClient =
    SIMNIFirebaseClient;

export {
    config as firebaseConfig
};

export default SIMNIFirebaseClient;
