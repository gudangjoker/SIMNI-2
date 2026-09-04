// ==========================================
// FILE: js/core/feature-loader.js
// FUNGSI: Authority tunggal pemuatan dan mounting fragmen UI berbasis izin.
// ==========================================

const FEATURE_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'dashboard',
        feature: 'dashboard',
        url: './features/dashboard/dashboard.html'
    }),
    Object.freeze({
        id: 'students',
        feature: 'students',
        url: './features/students/students.html'
    }),
    Object.freeze({
        id: 'attendance',
        feature: 'attendance',
        url: './features/attendance/attendance.html'
    }),
    Object.freeze({
        id: 'journal',
        feature: 'journal',
        url: './features/journal/journal.html'
    }),
    Object.freeze({
        id: 'grades',
        feature: 'grades',
        url: './features/grades/grades.html'
    }),
    Object.freeze({
        id: 'gadm',
        feature: 'gadm',
        url: './features/gadm/gadm.html'
    }),
    Object.freeze({
        id: 'notes',
        feature: 'notes',
        url: './features/notes/notes.html'
    }),
    Object.freeze({
        id: 'documents',
        feature: 'documents',
        url: './features/documents/documents.html'
    }),
    Object.freeze({
        id: 'settings',
        feature: 'settings',
        url: './features/settings/settings.html'
    })
]);

const ROOT_IDS = Object.freeze({
    views: 'simni-view-fragment-root',
    modals: 'simni-modal-fragment-root'
});

const COMMON_RUNTIME_ASSETS = Object.freeze([
    './vendor/qrcodejs/qrcode.min.js',
    './vendor/html5-qrcode/html5-qrcode.min.js',
    './vendor/xlsx/xlsx.full.min.js',
    './vendor/exceljs/exceljs.min.js',
    './vendor/html2pdf/html2pdf.bundle.min.js',
    './features/dashboard/dashboard.js',
    './features/settings/settings.js',
    './features/students/students.js',
    './features/attendance/attendance.js',
    './features/journal/journal.js',
    './features/grades/grades.js',
    './features/backup/backup-core.js',
    './features/backup/backup.js'
]);

const FEATURE_RUNTIME_ASSETS = Object.freeze({
    notes: Object.freeze(['./features/notes/notes.js']),
    documents: Object.freeze(['./features/documents/documents.js']),
    archive: Object.freeze(['./features/archive/archive.js']),
    reset: Object.freeze(['./features/reset/reset.js']),
    lps: Object.freeze([
        './features/lps/lps-core.js',
        './features/lps/lps-print.js',
        './features/lps/lps.js'
    ])
});

const loadedRuntimeAssets = new Map();

function loadScript(url) {
    if (loadedRuntimeAssets.has(url)) return loadedRuntimeAssets.get(url);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.dataset.simniRuntimeAsset = url;
        script.addEventListener('load', () => resolve(url), { once: true });
        script.addEventListener('error', () => reject(new Error(`Runtime asset gagal dimuat: ${url}`)), { once: true });
        document.head.appendChild(script);
    }).catch((error) => {
        loadedRuntimeAssets.delete(url);
        throw error;
    });
    loadedRuntimeAssets.set(url, promise);
    return promise;
}

function loadStylesheet(url) {
    if (loadedRuntimeAssets.has(url)) return loadedRuntimeAssets.get(url);
    const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.dataset.simniRuntimeAsset = url;
        link.addEventListener('load', () => resolve(url), { once: true });
        link.addEventListener('error', () => reject(new Error(`Stylesheet gagal dimuat: ${url}`)), { once: true });
        document.head.appendChild(link);
    }).catch((error) => {
        loadedRuntimeAssets.delete(url);
        throw error;
    });
    loadedRuntimeAssets.set(url, promise);
    return promise;
}

function loadModule(url) {
    if (loadedRuntimeAssets.has(url)) return loadedRuntimeAssets.get(url);
    const resolvedURL = new URL(url, document.baseURI).href;
    const promise = import(resolvedURL).then(() => url).catch((error) => {
        loadedRuntimeAssets.delete(url);
        throw new Error(`Runtime module gagal dimuat: ${url}`, { cause: error });
    });
    loadedRuntimeAssets.set(url, promise);
    return promise;
}

async function loadAuthorizedRuntimeAssets(context) {
    const assets = [...COMMON_RUNTIME_ASSETS];
    for (const [feature, featureAssets] of Object.entries(FEATURE_RUNTIME_ASSETS)) {
        if (canAccessFeature(feature, context)) assets.push(...featureAssets);
    }
    await loadStylesheet('./vendor/fontawesome/css/all.min.css');
    if (canAccessFeature('lps', context)) await loadStylesheet('./features/lps/lps.css');
    if (canAccessFeature('gadm', context)) await loadStylesheet('./features/gadm/gadm.css');
    for (const asset of assets) await loadScript(asset);
    if (canAccessFeature('gadm', context)) await loadModule('./features/gadm/gadm.js');
    window.validateSIMNIVendorRuntime?.();
}

let activeLoad = null;
let generation = 0;

function accessContext() {
    return window.SIMNICurrentAccess || null;
}

function accessSignature(context = accessContext()) {
    if (
        !context?.uid ||
        !context?.role ||
        !context?.workspaceId ||
        !context?.activeAcademicYearId
    ) {
        return null;
    }

    return [
        context.uid,
        context.role,
        context.workspaceId,
        context.activeAcademicYearId
    ].map(String).join('|');
}

function canAccessFeature(feature, context = accessContext()) {
    if (!context?.role || !feature) return false;

    if (typeof window.SIMNIAccess?.canAccess === 'function') {
        try {
            return window.SIMNIAccess.canAccess(feature) === true;
        } catch (error) {
            console.error(
                '[SIMNI Fragments] Pemeriksaan akses gagal:',
                feature,
                error
            );
            return false;
        }
    }

    if (typeof window.SIMNIAccessPolicy?.hasFeature === 'function') {
        try {
            return (
                window.SIMNIAccessPolicy.hasFeature(
                    context.role,
                    feature
                ) === true
            );
        } catch (error) {
            console.error(
                '[SIMNI Fragments] Policy akses gagal:',
                feature,
                error
            );
            return false;
        }
    }

    return false;
}

function resolveRoots() {
    const viewRoot = document.getElementById(ROOT_IDS.views);
    const modalRoot = document.getElementById(ROOT_IDS.modals);

    if (!viewRoot || !modalRoot) {
        throw new Error(
            'Root fragmen UI SIMNI tidak tersedia.'
        );
    }

    return {
        viewRoot,
        modalRoot
    };
}

function setFragmentState(status) {
    document.documentElement.dataset.simniFragmentsReady = status;
}

function freezeDiagnostics(value) {
    const failed = Object.freeze(
        (value.failed || []).map((item) =>
            Object.freeze({ ...item })
        )
    );

    const skipped = Object.freeze([
        ...(value.skipped || [])
    ]);

    const loaded = Object.freeze([
        ...(value.loaded || [])
    ]);

    const diagnostics = Object.freeze({
        status: value.status,
        signature: value.signature || null,
        loaded,
        skipped,
        failed,
        loadedCount: loaded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        total: FEATURE_DEFINITIONS.length,
        updatedAt: new Date().toISOString()
    });

    window.SIMNIFragmentDiagnostics = diagnostics;

    return diagnostics;
}

function clearFragmentRoots() {
    const viewRoot = document.getElementById(ROOT_IDS.views);
    const modalRoot = document.getElementById(ROOT_IDS.modals);

    viewRoot?.replaceChildren();
    modalRoot?.replaceChildren();
}

function parseFragmentDocument(htmlText, url) {
    const parser = new DOMParser();

    const parsed = parser.parseFromString(
        String(htmlText ?? ''),
        'text/html'
    );

    const parserError = parsed.querySelector('parsererror');

    if (parserError) {
        throw new Error(
            `Fragmen ${url} tidak dapat diparse.`
        );
    }

    return parsed;
}

async function fetchFragment(definition, signal) {
    const response = await fetch(definition.url, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'same-origin',
        signal
    });

    if (!response.ok) {
        throw new Error(
            `Gagal memuat fragmen ${definition.url} (${response.status}).`
        );
    }

    const htmlText = await response.text();

    return parseFragmentDocument(
        htmlText,
        definition.url
    );
}

function cloneTemplateContents(
    parsedDocument,
    selector
) {
    return [
        ...parsedDocument.querySelectorAll(selector)
    ].map((template) => {
        if (!(template instanceof HTMLTemplateElement)) {
            throw new Error(
                `Elemen ${selector} bukan HTMLTemplateElement.`
            );
        }

        return document.importNode(
            template.content,
            true
        );
    });
}

function validateFragment(
    definition,
    parsedDocument
) {
    const viewTemplates =
        parsedDocument.querySelectorAll(
            'template[data-simni-view]'
        );

    const modalTemplates =
        parsedDocument.querySelectorAll(
            'template[data-simni-modal]'
        );

    if (
        viewTemplates.length === 0 &&
        modalTemplates.length === 0
    ) {
        throw new Error(
            `Fragmen ${definition.url} tidak memiliki template SIMNI yang dapat dimount.`
        );
    }

    const forbiddenScripts =
        parsedDocument.querySelectorAll('script');

    if (forbiddenScripts.length > 0) {
        throw new Error(
            `Fragmen ${definition.url} tidak boleh membawa elemen <script>.`
        );
    }
}

function mountParsedFragment(
    definition,
    parsedDocument,
    roots
) {
    validateFragment(
        definition,
        parsedDocument
    );

    const viewFragments =
        cloneTemplateContents(
            parsedDocument,
            'template[data-simni-view]'
        );

    const modalFragments =
        cloneTemplateContents(
            parsedDocument,
            'template[data-simni-modal]'
        );

    viewFragments.forEach((fragment) => {
        roots.viewRoot.appendChild(fragment);
    });

    modalFragments.forEach((fragment) => {
        roots.modalRoot.appendChild(fragment);
    });
}

function describeError(error) {
    if (error?.name === 'AbortError') {
        return 'Pemuatan dibatalkan karena scope akses berubah.';
    }

    return String(
        error?.message ||
        error ||
        'Kesalahan pemuatan fragmen tidak diketahui.'
    );
}

function currentAuthorizedDefinitions() {
    const context = accessContext();

    if (!accessSignature(context)) {
        return [];
    }

    return FEATURE_DEFINITIONS.filter(
        (definition) =>
            canAccessFeature(
                definition.feature,
                context
            )
    );
}

export function resetFeatureFragments(
    reason = 'reset'
) {
    generation += 1;

    if (activeLoad?.controller) {
        activeLoad.controller.abort();
    }

    activeLoad = null;

    clearFragmentRoots();
    setFragmentState('idle');

    freezeDiagnostics({
        status: 'idle',
        signature: null,
        loaded: [],
        skipped: FEATURE_DEFINITIONS.map(
            (item) => item.id
        ),
        failed: reason
            ? [
                {
                    id: 'reset',
                    url: '',
                    message: String(reason)
                }
            ]
            : []
    });
}

export function loadFeatureFragments() {
    const context = accessContext();
    const signature = accessSignature(context);

    if (!signature) {
        const error = new Error(
            'Access context belum siap; fragmen fitur ditahan.'
        );

        error.code =
            'ACCESS_CONTEXT_UNAVAILABLE';

        return Promise.reject(error);
    }

    if (
        activeLoad?.signature === signature
    ) {
        return activeLoad.promise;
    }

    if (activeLoad?.controller) {
        activeLoad.controller.abort();
    }

    generation += 1;

    const loadGeneration = generation;
    const controller = new AbortController();

    const allowed =
        currentAuthorizedDefinitions();

    const allowedIds = new Set(
        allowed.map((item) => item.id)
    );

    const skipped =
        FEATURE_DEFINITIONS
            .filter(
                (item) =>
                    !allowedIds.has(item.id)
            )
            .map((item) => item.id);

    const promise = (async () => {
        await loadAuthorizedRuntimeAssets(context);
        const roots = resolveRoots();

        roots.viewRoot.replaceChildren();
        roots.modalRoot.replaceChildren();

        setFragmentState('loading');

        const settled =
            await Promise.allSettled(
                allowed.map(
                    async (definition) => ({
                        definition,
                        parsedDocument:
                            await fetchFragment(
                                definition,
                                controller.signal
                            )
                    })
                )
            );

        if (
            controller.signal.aborted ||
            loadGeneration !== generation ||
            accessSignature() !== signature
        ) {
            return {
                ok: false,
                cancelled: true,
                loaded: [],
                skipped,
                failed: []
            };
        }

        const loaded = [];
        const failed = [];

        settled.forEach(
            (result, index) => {
                const definition =
                    allowed[index];

                if (
                    result.status ===
                    'rejected'
                ) {
                    failed.push({
                        id: definition.id,
                        feature:
                            definition.feature,
                        url: definition.url,
                        message:
                            describeError(
                                result.reason
                            )
                    });

                    return;
                }

                try {
                    mountParsedFragment(
                        result.value.definition,
                        result.value
                            .parsedDocument,
                        roots
                    );

                    loaded.push(
                        definition.id
                    );
                } catch (error) {
                    failed.push({
                        id: definition.id,
                        feature:
                            definition.feature,
                        url: definition.url,
                        message:
                            describeError(
                                error
                            )
                    });
                }
            }
        );

        const status =
            failed.length > 0
                ? 'partial'
                : 'ready';

        setFragmentState(status);

        const diagnostics =
            freezeDiagnostics({
                status,
                signature,
                loaded,
                skipped,
                failed
            });

        window.SIMNIAccess
            ?.applyAccessUI?.();

        return {
            ok: failed.length === 0,
            cancelled: false,
            status,
            loaded: [...loaded],
            skipped: [...skipped],
            failed: failed.map(
                (item) => ({ ...item })
            ),
            diagnostics
        };
    })()
        .catch((error) => {
            if (
                controller.signal.aborted ||
                loadGeneration !== generation
            ) {
                return {
                    ok: false,
                    cancelled: true,
                    loaded: [],
                    skipped,
                    failed: []
                };
            }

            setFragmentState('failed');

            freezeDiagnostics({
                status: 'failed',
                signature,
                loaded: [],
                skipped,
                failed: [
                    {
                        id: 'loader',
                        url: '',
                        message:
                            describeError(
                                error
                            )
                    }
                ]
            });

            throw error;
        })
        .finally(() => {
            if (
                activeLoad?.generation ===
                loadGeneration
            ) {
                activeLoad = null;
            }
        });

    activeLoad = Object.freeze({
        generation: loadGeneration,
        signature,
        controller,
        promise
    });

    return promise;
}

export function getAuthorizedFeatureFragments() {
    return currentAuthorizedDefinitions()
        .map(
            (definition) => ({
                ...definition
            })
        );
}

export const SIMNI_FEATURE_FRAGMENTS =
    Object.freeze(
        FEATURE_DEFINITIONS.map(
            (item) => item.url
        )
    );

export const SIMNI_FEATURE_DEFINITIONS =
    FEATURE_DEFINITIONS;

window.SIMNIFeatureLoader =
    Object.freeze({
        loadFeatureFragments,
        resetFeatureFragments,
        getAuthorizedFeatureFragments
    });
