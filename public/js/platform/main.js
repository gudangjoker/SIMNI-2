// ==========================================
// FILE: js/platform/main.js
//
// FUNGSI:
// Single startup authority SIMNI PWA.
//
// Prinsip:
// - deterministic staged bootstrap;
// - fatal error mengidentifikasi stage;
// - fatal error mengidentifikasi app version;
// - Firebase Auth SDK diuji terpisah dari auth module;
// - tidak menyembunyikan original exception;
// - tidak memuat protected feature sebelum auth/access;
// - diagnostic runtime tersedia di window.SIMNIBootDiagnostics.
// ==========================================

'use strict';


const BOOT_STAGES =
    Object.freeze({
        FIREBASE_CLIENT:
            'firebase-client',

        ACCESS_CONTEXT:
            'access-context',

        LOCAL_CACHE:
            'local-cache',

        REPOSITORY:
            'repository',

        SYNC:
            'sync',

        CORE_APP:
            'core-app',

        CORE_APP_BOOTSTRAP:
            'core-app-bootstrap',

        FIREBASE_AUTH_SDK:
            'firebase-auth-sdk',

        AUTH_MODULE:
            'auth-module',

        FIREBASE_RUNTIME_UI:
            'firebase-runtime-ui',

        COMPLETE:
            'complete'
    });


const FIREBASE_AUTH_SDK_URL =
    '../../vendor/firebase/firebase-auth.js';


const bootState = {
    started:
        false,

    finished:
        false,

    status:
        'idle',

    stage:
        null,

    version:
        null,

    startedAt:
        null,

    completedAt:
        null,

    error:
        null,

    stages:
        []
};

const RUNTIME_FAILURE_LIMIT = 50;
const runtimeFailures = [];

function recordRuntimeFailure(kind, value) {
    const error = value instanceof Error ? value : new Error(String(value || 'Unknown runtime failure'));
    runtimeFailures.push(Object.freeze({
        kind,
        name: String(error.name || 'Error').slice(0, 80),
        message: String(error.message || error).slice(0, 500),
        occurredAt: new Date().toISOString()
    }));
    if (runtimeFailures.length > RUNTIME_FAILURE_LIMIT) {
        runtimeFailures.splice(0, runtimeFailures.length - RUNTIME_FAILURE_LIMIT);
    }
    window.SIMNIRuntimeFailures = Object.freeze([...runtimeFailures]);
}

window.addEventListener('error', (event) => {
    recordRuntimeFailure('error', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    recordRuntimeFailure('unhandledrejection', event.reason);
    if (typeof window.toast === 'function') {
        window.toast('Operasi asynchronous gagal dituntaskan.', 'error');
    }
});


/* ============================================================
 * BASIC HELPERS
 * ============================================================ */

function nowISO() {
    return new Date()
        .toISOString();
}


function cleanText(
    value
) {
    return String(
        value ??
        ''
    ).trim();
}


function resolveAppVersion() {
    return (
        cleanText(
            window
                .SIMNIVersionManifest
                ?.appVersion
        ) ||
        cleanText(
            window
                .SIMNI_APP_VERSION
        ) ||
        cleanText(
            document
                .documentElement
                ?.dataset
                ?.simniVersion
        ) ||
        'unknown'
    );
}


/* ============================================================
 * DIAGNOSTIC STATE
 * ============================================================ */

function publishDiagnostics() {
    window.SIMNIBootDiagnostics =
        Object.freeze({
            started:
                bootState.started,

            finished:
                bootState.finished,

            status:
                bootState.status,

            stage:
                bootState.stage,

            version:
                bootState.version,

            startedAt:
                bootState.startedAt,

            completedAt:
                bootState.completedAt,

            error:
                bootState.error
                    ? Object.freeze({
                        name:
                            bootState
                                .error
                                .name,

                        message:
                            bootState
                                .error
                                .message,

                        stack:
                            bootState
                                .error
                                .stack
                    })
                    : null,

            stages:
                Object.freeze(
                    bootState.stages
                        .map(
                            (
                                stage
                            ) =>
                                Object.freeze({
                                    ...stage
                                })
                        )
                )
        });
}


function updateBootDataset(
    status,
    stage
) {
    const root =
        document.documentElement;

    if (!root) {
        return;
    }

    root.dataset.simniBoot =
        status;

    root.dataset.simniBootStage =
        stage ||
        '';

    root.dataset.simniVersion =
        bootState.version ||
        'unknown';
}


/* ============================================================
 * STAGE CONTROL
 * ============================================================ */

function stageStart(
    name
) {
    bootState.stage =
        name;

    bootState.status =
        'running';

    bootState.stages.push({
        name,

        status:
            'running',

        startedAt:
            nowISO(),

        completedAt:
            null,

        error:
            null
    });

    updateBootDataset(
        'running',
        name
    );

    publishDiagnostics();

    console.info(
        `[SIMNI BOOT][${
            bootState.version
        }] START: ${name}`
    );
}


function findRunningStage(
    name
) {
    return [
        ...bootState.stages
    ]
        .reverse()
        .find(
            (
                item
            ) =>
                item.name ===
                    name &&
                item.status ===
                    'running'
        ) ||
        null;
}


function stagePass(
    name
) {
    const record =
        findRunningStage(
            name
        );

    if (record) {
        record.status =
            'pass';

        record.completedAt =
            nowISO();
    }

    publishDiagnostics();

    console.info(
        `[SIMNI BOOT][${
            bootState.version
        }] PASS: ${name}`
    );
}


function stageFail(
    name,
    error
) {
    const message =
        cleanText(
            error?.message ||
            error
        ) ||
        'Unknown startup error';

    const stack =
        cleanText(
            error?.stack
        );

    const errorName =
        cleanText(
            error?.name
        ) ||
        'Error';

    const record =
        findRunningStage(
            name
        );

    if (record) {
        record.status =
            'fail';

        record.completedAt =
            nowISO();

        record.error =
            message;
    }

    bootState.status =
        'failed';

    bootState.stage =
        name;

    bootState.error = {
        name:
            errorName,

        message,

        stack
    };

    bootState.completedAt =
        nowISO();

    updateBootDataset(
        'failed',
        name
    );

    publishDiagnostics();
}


async function runBootStage(
    name,
    action
) {
    stageStart(
        name
    );

    try {
        const result =
            await action();

        stagePass(
            name
        );

        return result;

    } catch (
        error
    ) {
        stageFail(
            name,
            error
        );

        throw error;
    }
}


/* ============================================================
 * ERROR DIAGNOSTICS
 * ============================================================ */

function extractDiagnosticLocation(
    error
) {
    const stack =
        cleanText(
            error?.stack
        );

    if (!stack) {
        return '';
    }

    const lines =
        stack
            .split(
                /\r?\n/
            )
            .map(
                (
                    line
                ) =>
                    line.trim()
            )
            .filter(
                Boolean
            );

    const preferred =
        lines.find(
            (
                line
            ) =>
                line.includes(
                    'localhost'
                ) ||
                line.includes(
                    '/js/'
                ) ||
                line.includes(
                    '/features/'
                ) ||
                line.includes(
                    'gstatic.com'
                )
        );

    if (preferred) {
        return preferred;
    }

    return (
        lines[1] ||
        ''
    );
}


function showFatalBootError(
    stage,
    error
) {
    const version =
        bootState.version ||
        'unknown';

    const message =
        cleanText(
            error?.message ||
            error
        ) ||
        'Unknown startup error';

    const errorName =
        cleanText(
            error?.name
        ) ||
        'Error';

    const location =
        extractDiagnosticLocation(
            error
        );

    const lines = [
        'Aplikasi gagal dimulai.',
        `Versi: ${version}`,
        `Tahap: ${stage}`,
        `Jenis: ${errorName}`,
        `Error: ${message}`
    ];

    if (location) {
        lines.push(
            `Lokasi: ${location}`
        );
    }

    const box =
        document
            .getElementById(
                'auth-error'
            );

    if (box) {
        box.textContent =
            lines.join(
                '\n'
            );

        box.classList
            .remove(
                'hidden'
            );

        box.style.whiteSpace =
            'pre-line';
    }

    console.error(
        '===================================================='
    );

    console.error(
        '[SIMNI PWA] FATAL BOOT FAILURE'
    );

    console.error(
        'Version:',
        version
    );

    console.error(
        'Stage:',
        stage
    );

    console.error(
        'Error name:',
        errorName
    );

    console.error(
        'Error message:',
        message
    );

    console.error(
        'Original error:',
        error
    );

    console.error(
        'Diagnostics:',
        window.SIMNIBootDiagnostics
    );

    console.error(
        '===================================================='
    );
}


/* ============================================================
 * STARTUP
 * ============================================================ */

async function startSIMNI() {
    if (
        bootState.started
    ) {
        return;
    }

    bootState.started =
        true;

    bootState.status =
        'starting';

    bootState.version =
        resolveAppVersion();

    bootState.startedAt =
        nowISO();

    updateBootDataset(
        'starting',
        'startup'
    );

    publishDiagnostics();


    let firebaseClient =
        null;


    try {

        /*
         * ====================================================
         * STAGE 1
         * FIREBASE CLIENT
         * ====================================================
         */

        firebaseClient =
            await runBootStage(
                BOOT_STAGES
                    .FIREBASE_CLIENT,
                () =>
                    import(
                        '../database/firebase-client.js'
                    )
            );


        /*
         * ====================================================
         * STAGE 2
         * ACCESS CONTEXT
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .ACCESS_CONTEXT,
            () =>
                import(
                    '../auth/access-context.js'
                )
        );


        /*
         * ====================================================
         * STAGE 3
         * LOCAL CACHE
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .LOCAL_CACHE,
            () =>
                import(
                    '../database/local-cache.js'
                )
        );


        /*
         * ====================================================
         * STAGE 4
         * REPOSITORY
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .REPOSITORY,
            () =>
                import(
                    '../database/repository.js'
                )
        );


        /*
         * ====================================================
         * STAGE 5
         * SYNC
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .SYNC,
            () =>
                import(
                    '../database/sync.js'
                )
        );


        /*
         * ====================================================
         * STAGE 6
         * CORE APP MODULE
         * ====================================================
         */

        const appModule =
            await runBootStage(
                BOOT_STAGES
                    .CORE_APP,
                () =>
                    import(
                        '../core/app.js'
                    )
            );


        if (
            typeof appModule
                ?.bootstrapApp !==
            'function'
        ) {
            throw new Error(
                'core/app.js tidak mengekspor bootstrapApp().'
            );
        }


        /*
         * ====================================================
         * STAGE 7
         * CORE APP BOOTSTRAP
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .CORE_APP_BOOTSTRAP,
            () =>
                appModule
                    .bootstrapApp()
        );


        /*
         * ====================================================
         * STAGE 8
         * FIREBASE AUTH SDK
         *
         * PENTING:
         * Ini sengaja dipisahkan dari auth.js.
         *
         * Jika stage ini FAIL:
         * masalah terbukti berada pada Firebase Auth SDK /
         * module graph yang diterima browser.
         *
         * Jika stage ini PASS tetapi AUTH_MODULE FAIL:
         * Firebase Auth SDK sudah terbukti sehat.
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .FIREBASE_AUTH_SDK,
            () =>
                import(
                    FIREBASE_AUTH_SDK_URL
                )
        );


        /*
         * ====================================================
         * STAGE 9
         * LOCAL AUTH MODULE
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .AUTH_MODULE,
            () =>
                import(
                    '../auth/auth.js'
                )
        );


        /*
         * ====================================================
         * STAGE 10
         * FIREBASE RUNTIME UI
         * ====================================================
         */

        await runBootStage(
            BOOT_STAGES
                .FIREBASE_RUNTIME_UI,
            async () => {
                if (
                    typeof firebaseClient
                        ?.applyFirebaseRuntimeUI !==
                    'function'
                ) {
                    throw new Error(
                        'firebase-client.js tidak mengekspor applyFirebaseRuntimeUI().'
                    );
                }

                firebaseClient
                    .applyFirebaseRuntimeUI();

                return true;
            }
        );


        /*
         * ====================================================
         * COMPLETE
         * ====================================================
         */

        bootState.stage =
            BOOT_STAGES
                .COMPLETE;

        bootState.status =
            'ready';

        bootState.finished =
            true;

        bootState.completedAt =
            nowISO();

        updateBootDataset(
            'ready',
            BOOT_STAGES
                .COMPLETE
        );

        publishDiagnostics();

        console.info(
            `[SIMNI BOOT][${
                bootState.version
            }] READY`
        );

    } catch (
        error
    ) {
        const failedStage =
            bootState.stage ||
            'unknown';

        if (
            bootState.status !==
            'failed'
        ) {
            stageFail(
                failedStage,
                error
            );
        }

        showFatalBootError(
            failedStage,
            error
        );
    }
}


/* ============================================================
 * SINGLE STARTUP BINDING
 * ============================================================ */

if (
    document.readyState ===
    'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        startSIMNI,
        {
            once:
                true
        }
    );

} else {
    void startSIMNI();
}
