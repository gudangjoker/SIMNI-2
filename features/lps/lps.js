// ==========================================
// FILE: features/lps/lps.js
// FUNGSI:
// Controller LPS / BLP.
//
// Tanggung jawab:
// - authorized lazy mount;
// - form penilaian;
// - template versioning;
// - finalisasi + SHA-256;
// - immutable final snapshot;
// - revision history;
// - preview / print terverifikasi;
// - event delegation tanpa inline handler runtime.
// ==========================================

(function initSIMNILPSFeature() {
    'use strict';

    const core =
        window.SIMNILPSCore;

    const printEngine =
        window.SIMNILPSPrint;

    if (
        !core ||
        !printEngine
    ) {
        console.error(
            'Modul inti LPS/BLP gagal dimuat.'
        );

        window.SIMNILPSReady =
            Promise.resolve(
                false
            );

        return;
    }

    const runtime = {
        installed:
            false,

        installPromise:
            null,

        eventsBound:
            false,

        currentTemplate:
            null,

        currentReport:
            null,

        currentFinalIntegrity:
            null,

        builderDraft:
            null,

        builderSourceTemplateId:
            null,

        localTemplates:
            new Map(),

        localReports:
            new Map(),

        busy: {
            saveDraft:
                false,

            finalize:
                false,

            revision:
                false,

            template:
                false,

            preview:
                false,

            print:
                false
        },

        lastOperation:
            null
    };

    const byId =
        (id) =>
            document.getElementById(
                id
            );

    function nowISO() {
        return new Date()
            .toISOString();
    }

    function notify(
        message,
        type =
            'info'
    ) {
        if (
            typeof window.toast ===
            'function'
        ) {
            window.toast(
                message,
                type
            );

            return;
        }

        console.log(
            message
        );
    }

    function showProgress(
        message
    ) {
        window.showLoad?.(
            message
        );
    }

    function hideProgress() {
        window.hideLoad?.();
    }

    function currentAccess() {
        return (
            window.SIMNICurrentAccess ||
            null
        );
    }

    function canAccessLPS() {
        try {
            return (
                window.SIMNIAccess
                    ?.canAccess(
                        'lps'
                    ) ===
                true
            );
        } catch (_) {
            return false;
        }
    }

    function assertLPSAccess() {
        if (
            !canAccessLPS()
        ) {
            throw new Error(
                'Role Anda tidak memiliki akses LPS/BLP.'
            );
        }

        const access =
            currentAccess();

        if (
            !access?.uid ||
            !access?.workspaceId ||
            !access?.classId ||
            !access
                ?.activeAcademicYearId ||
            access.status !==
                'active'
        ) {
            throw new Error(
                'Access context LPS/BLP belum siap.'
            );
        }

        return access;
    }

    function currentSettings() {
        return core
            .normalizeSettings(
                window.state
                    ?.pengaturan ||
                {}
            );
    }

    function currentPeriodId() {
        return (
            byId(
                'lps-select-periode'
            )?.value ||
            core.PERIODS[0]
                .id
        );
    }

    function currentPeriod() {
        return (
            core.getPeriod(
                currentPeriodId()
            ) ||
            core.PERIODS[0]
        );
    }

    function getUserMeta() {
        if (
            typeof window
                .getCurrentUserMeta ===
            'function'
        ) {
            return window
                .getCurrentUserMeta();
        }

        const access =
            currentAccess();

        return {
            uid:
                access?.uid ||
                null,

            email:
                null,

            role:
                access?.role ||
                null,

            workspaceId:
                access
                    ?.workspaceId ||
                null,

            classId:
                access?.classId ||
                null,

            activeAcademicYearId:
                access
                    ?.activeAcademicYearId ||
                null
        };
    }

    function getJakartaDateString() {
        if (
            typeof window
                .getJakartaDateString ===
            'function'
        ) {
            return window
                .getJakartaDateString();
        }

        try {
            const parts =
                new Intl
                    .DateTimeFormat(
                        'en-CA',
                        {
                            timeZone:
                                'Asia/Jakarta',

                            year:
                                'numeric',

                            month:
                                '2-digit',

                            day:
                                '2-digit'
                        }
                    )
                    .formatToParts(
                        new Date()
                    );

            const map =
                Object.fromEntries(
                    parts.map(
                        (part) => [
                            part.type,
                            part.value
                        ]
                    )
                );

            if (
                map.year &&
                map.month &&
                map.day
            ) {
                return (
                    `${map.year}-` +
                    `${map.month}-` +
                    `${map.day}`
                );
            }
        } catch (_) {
            // Fallback UTC hanya jika Intl timezone tidak tersedia.
        }

        return new Date()
            .toISOString()
            .slice(
                0,
                10
            );
    }

    function normalizeWriteResult(
        result
    ) {
        if (
            result ===
            undefined
        ) {
            return {
                ok:
                    true
            };
        }

        if (
            result &&
            typeof result ===
                'object' &&
            'ok' in result
        ) {
            return result;
        }

        return {
            ok:
                true,

            value:
                result
        };
    }

    async function databaseSet(
        path,
        payload
    ) {
        assertLPSAccess();

        if (
            typeof window.dbSet !==
            'function'
        ) {
            throw new Error(
                'Database repository belum siap.'
            );
        }

        return normalizeWriteResult(
            await window.dbSet(
                path,
                payload
            )
        );
    }

    async function databaseUpdate(
        payload
    ) {
        assertLPSAccess();

        if (
            typeof window.dbUpdate !==
            'function'
        ) {
            throw new Error(
                'Database repository belum siap.'
            );
        }

        return normalizeWriteResult(
            await window.dbUpdate(
                payload
            )
        );
    }

    function templateCollection() {
        const merged =
            new Map();

        for (
            const template
            of core.valuesOf(
                window.state
                    ?.lpsTemplates
            )
        ) {
            if (
                template
                    ?.templateId
            ) {
                merged.set(
                    template.templateId,
                    template
                );
            }
        }

        for (
            const [
                id,
                template
            ]
            of runtime
                .localTemplates
        ) {
            merged.set(
                id,
                template
            );
        }

        return [
            ...merged.values()
        ];
    }

    function reportCollection() {
        const merged =
            new Map();

        for (
            const report
            of core.valuesOf(
                window.state
                    ?.lpsReports
            )
        ) {
            if (
                report
                    ?.reportId
            ) {
                merged.set(
                    report.reportId,
                    report
                );
            }
        }

        for (
            const [
                id,
                report
            ]
            of runtime
                .localReports
        ) {
            merged.set(
                id,
                report
            );
        }

        return [
            ...merged.values()
        ];
    }

    function rememberTemplate(
        template
    ) {
        if (
            !template
                ?.templateId
        ) {
            return;
        }

        runtime
            .localTemplates
            .set(
                template.templateId,
                core.deepClone(
                    template
                )
            );
    }

    function rememberReport(
        report
    ) {
        if (
            !report
                ?.reportId
        ) {
            return;
        }

        runtime
            .localReports
            .set(
                report.reportId,
                core.deepClone(
                    report
                )
            );
    }

    function getTemplateScope(
        periodId =
            currentPeriodId()
    ) {
        return core
            .templateScopeId(
                currentSettings(),
                periodId
            );
    }

    function getActiveTemplate(
        periodId =
            currentPeriodId()
    ) {
        return core
            .getActiveTemplate(
                templateCollection(),
                getTemplateScope(
                    periodId
                )
            );
    }

    function getSavedReport(
        reportId
    ) {
        return core
            .getReportById(
                reportCollection(),
                reportId
            );
    }

    function createContainerFromTemplate(
        template,
        id
    ) {
        const fragment =
            template
                .content
                .cloneNode(
                    true
                );

        const first =
            fragment
                .firstElementChild;

        if (
            id &&
            first
        ) {
            first.id =
                id;
        }

        return fragment;
    }

    function sanitizeFeatureMarkup(
        holder
    ) {
        holder
            .querySelectorAll(
                'script,iframe,object,embed'
            )
            .forEach(
                (element) => {
                    element.remove();
                }
            );

        holder
            .querySelectorAll(
                '*'
            )
            .forEach(
                (element) => {
                    for (
                        const attribute
                        of [
                            ...element
                                .attributes
                        ]
                    ) {
                        const name =
                            attribute
                                .name
                                .toLowerCase();

                        if (
                            name.startsWith(
                                'on'
                            ) ||
                            name ===
                                'srcdoc'
                        ) {
                            element
                                .removeAttribute(
                                    attribute.name
                                );
                        }
                    }
                }
            );
    }

    async function installFeatureMarkup() {
        assertLPSAccess();

        const url =
            new URL(
                './features/lps/lps.html',
                window.location.href
            );

        if (
            url.origin !==
            window.location.origin
        ) {
            throw new Error(
                'Lokasi fragment LPS tidak valid.'
            );
        }

        const response =
            await fetch(
                url.href,
                {
                    method:
                        'GET',

                    credentials:
                        'same-origin',

                    cache:
                        'no-cache'
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                `Gagal memuat tampilan LPS (${response.status}).`
            );
        }

        const markup =
            await response.text();

        const holder =
            document.createElement(
                'div'
            );

        holder.innerHTML =
            markup;

        sanitizeFeatureMarkup(
            holder
        );

        const viewTemplate =
            holder.querySelector(
                '#simni-lps-view-template'
            );

        const builderTemplate =
            holder.querySelector(
                '#simni-lps-builder-template'
            );

        const previewTemplate =
            holder.querySelector(
                '#simni-lps-preview-template'
            );

        let view =
            byId(
                'view-lps'
            );

        const mainScrollArea =
            byId(
                'main-scroll-area'
            );

        const builderModal =
            byId(
                'modal-pengaturan-lps'
            );

        if (
            (!view && !mainScrollArea) ||
            !builderModal ||
            !viewTemplate ||
            !builderTemplate ||
            !previewTemplate
        ) {
            throw new Error(
                'Placeholder LPS tidak lengkap.'
            );
        }

        if (!view) {
            view = document.createElement(
                'section'
            );

            view.id =
                'view-lps';

            view.className =
                'view-section hidden';

            view.hidden =
                true;

            view.dataset.requiresFeature =
                'lps';

            mainScrollArea.appendChild(
                view
            );
        }

        view.replaceChildren(
            createContainerFromTemplate(
                viewTemplate
            )
        );

        builderModal.replaceChildren(
            createContainerFromTemplate(
                builderTemplate
            )
        );

        const oldPreview =
            byId(
                'lps-preview-modal'
            );

        oldPreview?.remove();

        document.body
            .appendChild(
                createContainerFromTemplate(
                    previewTemplate
                )
            );

        const dateInput =
            byId(
                'lps-report-date'
            );

        if (
            dateInput &&
            !dateInput.value
        ) {
            dateInput.value =
                getJakartaDateString();
        }

        runtime.installed =
            true;

        bindLPSDOMEvents();

        updateLPSHijriDate();

        return true;
    }

    function unmountFeatureMarkup() {
        byId(
            'view-lps'
        )?.remove();

        byId(
            'lps-preview-modal'
        )?.remove();

        const builderModal =
            byId(
                'modal-pengaturan-lps'
            );

        if (builderModal) {
            builderModal.replaceChildren();
            builderModal.classList.add(
                'hidden',
                'opacity-0'
            );
            builderModal.classList.remove(
                'flex'
            );
        }

        runtime.installed =
            false;

        return true;
    }

    function ensureFeatureInstalled() {
        try {
            assertLPSAccess();
        } catch (error) {
            return Promise
                .reject(
                error
            );
        }

        if (
            runtime.installed
        ) {
            return Promise.resolve(
                true
            );
        }

        if (
            runtime.installPromise
        ) {
            return runtime
                .installPromise;
        }

        runtime.installPromise =
            installFeatureMarkup()
                .catch(
                    (error) => {
                        console.error(
                            '[SIMNI LPS] Instalasi fragment gagal:',
                            error
                        );

                        runtime.installed =
                            false;

                        notify(
                            `Modul LPS/BLP gagal dimuat: ${
                                error?.message ||
                                error
                            }`,
                            'error'
                        );

                        return false;
                    }
                )
                .finally(
                    () => {
                        runtime.installPromise =
                            null;
                    }
                );

        window.SIMNILPSReady =
            runtime
                .installPromise;

        return runtime
            .installPromise;
    }

    function runWhenReady(
        callback
    ) {
        return ensureFeatureInstalled()
            .then(
                (ready) => {
                    if (!ready) {
                        return undefined;
                    }

                    return callback();
                }
            )
            .catch(
                (error) => {
                    notify(
                        error?.message ||
                        String(
                            error
                        ),
                        'error'
                    );

                    return undefined;
                }
            );
    }

    function getSelectedStudent() {
        const studentId =
            byId(
                'lps-select-siswa'
            )?.value ||
            '';

        return (
            (
                window.state
                    ?.students ||
                []
            ).find(
                (student) =>
                    String(
                        student.NISN
                    ) ===
                    String(
                        studentId
                    )
            ) ||
            null
        );
    }

    function makeDraftReport(
        student,
        template
    ) {
        const access =
            assertLPSAccess();

        const settings =
            currentSettings();

        const period =
            core.getPeriod(
                template.periodId
            );

        if (!period) {
            throw new Error(
                'Periode template tidak valid.'
            );
        }

        const date =
            byId(
                'lps-report-date'
            )?.value ||
            getJakartaDateString();

        const offset =
            Number(
                byId(
                    'lps-hijri-offset'
                )?.value ||
                0
            );

        return {
            schemaVersion:
                core.SCHEMA_VERSION,

            reportId:
                core.reportId(
                    settings,
                    period.id,
                    student.NISN
                ),

            workspaceId:
                access.workspaceId,

            academicYearId:
                core.normalizeKey(
                    settings
                        .tahun_pelajaran
                ),

            academicYearLabel:
                settings
                        .tahun_pelajaran,

            classId:
                core.normalizeKey(
                    settings
                        .nama_kelas
                ),

            classLabel:
                settings
                    .nama_kelas,

            periodId:
                period.id,

            reportType:
                period.type,

            semester:
                period.semester,

            term:
                period.term,

            studentSnapshot: {
                studentId:
                    String(
                        student.NISN
                    ),

                name:
                    student[
                        'Nama Lengkap'
                    ] ||
                    '',

                nickname:
                    student[
                        'Nama Panggilan'
                    ] ||
                    '',

                group:
                    student.Kelompok ||
                    '-'
            },

            schoolSnapshot:
                settings,

            templateId:
                template.templateId,

            templateVersion:
                template.templateVersion,

            templateSnapshot:
                core.deepClone(
                    template
                ),

            responses:
                core.createEmptyResponses(
                    template
                ),

            teacherNote:
                '',

            parentNote:
                '',

            reportDate:
                date,

            hijriAdjustmentDays:
                offset,

            hijriDate:
                core
                    .gregorianToHijri(
                        date,
                        offset
                    ),

            status:
                'draft',

            revision:
                1,

            revisionOfHash:
                null,

            hash:
                null,

            createdAt:
                null,

            createdBy:
                null,

            updatedAt:
                null,

            updatedBy:
                null,

            finalizedAt:
                null,

            finalizedBy:
                null
        };
    }

    function findLegacyReport(
        studentId,
        periodId
    ) {
        const legacyLabel =
            core.getPeriod(
                periodId
            )?.legacyLabel;

        if (!legacyLabel) {
            return null;
        }

        return (
            (
                window.state
                    ?.dataLPS ||
                []
            ).find(
                (report) =>
                    String(
                        report.NISN
                    ) ===
                        String(
                            studentId
                        ) &&
                    String(
                        report.Periode
                    ) ===
                        legacyLabel
            ) ||
            null
        );
    }

    function migrateLegacyReport(
        legacy,
        student,
        template
    ) {
        const report =
            makeDraftReport(
                student,
                template
            );

        let legacyValues =
            {};

        try {
            const parsed =
                JSON.parse(
                    legacy
                        .Nilai_Dinamis ||
                    '{}'
                );

            if (
                parsed &&
                typeof parsed ===
                    'object' &&
                !Array.isArray(
                    parsed
                )
            ) {
                legacyValues =
                    parsed;
            }
        } catch (_) {
            legacyValues =
                {};
        }

        template
            .sections
            .forEach(
                (section) => {
                    section
                        .aspects
                        .forEach(
                            (aspect) => {
                                const response =
                                    report
                                        .responses[
                                            aspect.id
                                        ];

                                const oldAspectValues =
                                    legacyValues[
                                        aspect.title
                                    ];

                                const safeOldValues =
                                    oldAspectValues &&
                                    typeof oldAspectValues ===
                                        'object' &&
                                    !Array.isArray(
                                        oldAspectValues
                                    )
                                        ? oldAspectValues
                                        : {};

                                aspect
                                    .items
                                    .forEach(
                                        (item) => {
                                            if (
                                                safeOldValues[
                                                    item.label
                                                ] !==
                                                undefined
                                            ) {
                                                response
                                                    .items[
                                                        item.id
                                                    ] =
                                                    String(
                                                        safeOldValues[
                                                            item.label
                                                        ] ??
                                                        ''
                                                    );
                                            }
                                        }
                                    );

                                if (
                                    /baca tulis|btq/i
                                        .test(
                                            aspect.title
                                        )
                                ) {
                                    response.overall =
                                        String(
                                            legacy
                                                .BTQ_Nilai ||
                                            ''
                                        );

                                    response.detail =
                                        [
                                            legacy
                                                .BTQ_Tipe,

                                            legacy
                                                .BTQ_SuratJilid,

                                            legacy
                                                .BTQ_AyatHal
                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(
                                                ' — '
                                            );

                                    response.description =
                                        String(
                                            legacy
                                                .Catatan_Saran ||
                                            ''
                                        );
                                }
                            }
                        );
                }
            );

        report.legacySource = {
            id:
                legacy.ID_LPS ||
                null,

            path:
                'Data_LPS',

            migratedAt:
                nowISO()
        };

        return report;
    }

    function normalizeResponsesToTemplate(
        existing,
        template
    ) {
        const responses =
            core
                .createEmptyResponses(
                    template
                );

        const source =
            existing &&
            typeof existing ===
                'object' &&
            !Array.isArray(
                existing
            )
                ? existing
                : {};

        for (
            const section
            of template.sections
        ) {
            for (
                const aspect
                of section.aspects
            ) {
                const old =
                    source[
                        aspect.id
                    ];

                if (
                    !old ||
                    typeof old !==
                        'object' ||
                    Array.isArray(
                        old
                    )
                ) {
                    continue;
                }

                responses[
                    aspect.id
                ].overall =
                    String(
                        old.overall ||
                        ''
                    );

                responses[
                    aspect.id
                ].detail =
                    String(
                        old.detail ||
                        ''
                    );

                responses[
                    aspect.id
                ].description =
                    String(
                        old.description ||
                        ''
                    );

                for (
                    const item
                    of aspect.items
                ) {
                    responses[
                        aspect.id
                    ].items[
                        item.id
                    ] =
                        String(
                            old.items
                                ?.[
                                    item.id
                                ] ||
                            ''
                        );
                }
            }
        }

        return responses;
    }

    function createElement(
        tagName,
        {
            className =
                '',

            textContent =
                '',

            type =
                null
        } = {}
    ) {
        const element =
            document.createElement(
                tagName
            );

        if (className) {
            element.className =
                className;
        }

        if (
            textContent !==
            undefined &&
            textContent !==
            null &&
            textContent !==
            ''
        ) {
            element.textContent =
                String(
                    textContent
                );
        }

        if (
            type !==
            null
        ) {
            element.type =
                type;
        }

        return element;
    }

    function createResponseSelect(
        options,
        selected
    ) {
        const select =
            createElement(
                'select'
            );

        const placeholder =
            createElement(
                'option',
                {
                    textContent:
                        '-- Pilih --'
                }
            );

        placeholder.value =
            '';

        select.appendChild(
            placeholder
        );

        for (
            const option
            of options
        ) {
            const optionElement =
                createElement(
                    'option',
                    {
                        textContent:
                            option
                    }
                );

            optionElement.value =
                option;

            optionElement.selected =
                selected ===
                option;

            select.appendChild(
                optionElement
            );
        }

        return select;
    }

    function createResponseChecklist(
        options,
        selected,
        aspectId,
        itemId =
            ''
    ) {
        const group =
            createElement(
                'div',
                {
                    className:
                        'lps-choice-group'
                }
            );

        group.setAttribute(
            'role',
            'group'
        );

        for (
            const option
            of options
        ) {
            const label =
                createElement(
                    'label',
                    {
                        className:
                            'lps-choice-option'
                    }
                );

            const checkbox =
                createElement(
                    'input'
                );

            checkbox.type =
                'checkbox';

            checkbox.className =
                'lps-response-check';

            checkbox.value =
                option;

            checkbox.checked =
                selected ===
                option;

            checkbox.dataset.aspectId =
                aspectId;

            if (itemId) {
                checkbox.dataset.itemId =
                    itemId;
            }

            checkbox.addEventListener(
                'change',
                () => {
                    if (!checkbox.checked) return;
                    group
                        .querySelectorAll(
                            '.lps-response-check'
                        )
                        .forEach(
                            (other) => {
                                if (other !== checkbox) other.checked = false;
                            }
                        );
                }
            );

            label.append(
                checkbox,
                document.createTextNode(
                    option
                )
            );

            group.appendChild(
                label
            );
        }

        return group;
    }

    function createResponseTextInput(
        value,
        aspectId,
        itemId =
            ''
    ) {
        const input =
            createElement(
                'input'
            );

        input.type =
            'text';

        input.maxLength =
            4000;

        input.value =
            value ||
            '';

        input.dataset.aspectId =
            aspectId;

        if (itemId) {
            input.dataset.itemId =
                itemId;
        }

        return input;
    }

    function createField(
        labelText,
        control
    ) {
        const label =
            createElement(
                'label',
                {
                    className:
                        'lps-field'
                }
            );

        const caption =
            createElement(
                'span',
                {
                    textContent:
                        labelText
                }
            );

        label.append(
            caption,
            control
        );

        return label;
    }

    function renderAspectInput(
        aspect,
        response
    ) {
        const article =
            createElement(
                'article',
                {
                    className:
                        'lps-aspect-card'
                }
            );

        const heading =
            createElement(
                'h4',
                {
                    textContent:
                        aspect.title
                }
            );

        article.appendChild(
            heading
        );

        const options =
            Array.isArray(
                aspect.options
            )
                ? aspect.options
                : [];

        const items =
            Array.isArray(
                aspect.items
            )
                ? aspect.items
                : [];

        const inputType =
            [
                'select',
                'checklist',
                'text'
            ].includes(
                aspect.inputType
            )
                ? aspect.inputType
                : (
                    options.length
                        ? 'select'
                        : 'text'
                );

        if (
            aspect.detailLabel
        ) {
            const input =
                createElement(
                    'input'
                );

            input.type =
                'text';

            input.className =
                'lps-response-detail';

            input.dataset.aspectId =
                aspect.id;

            input.value =
                response
                    ?.detail ||
                '';

            input.maxLength =
                4000;

            article.appendChild(
                createField(
                    aspect.detailLabel,
                    input
                )
            );
        }

        if (
            items.length ===
            0
        ) {
            const row =
                createElement(
                    'div',
                    {
                        className:
                            'lps-aspect-item'
                    }
                );

            row.appendChild(
                createElement(
                    'span',
                    {
                        textContent:
                            'Nilai / hasil pengamatan'
                    }
                )
            );

            if (
                inputType ===
                'checklist'
            ) {
                row.appendChild(
                    createResponseChecklist(
                        options,
                        response
                            ?.overall ||
                        '',
                        aspect.id
                    )
                );
            } else if (
                inputType ===
                'text'
            ) {
                const input =
                    createResponseTextInput(
                        response
                            ?.overall ||
                        '',
                        aspect.id
                    );

                input.className =
                    'lps-response-overall-text';

                row.appendChild(
                    input
                );
            } else {
                const select =
                    createResponseSelect(
                        options,
                        response
                            ?.overall ||
                        ''
                    );

                select.className =
                    'lps-response-overall';

                select.dataset.aspectId =
                    aspect.id;

                row.appendChild(
                    select
                );
            }

            article.appendChild(
                row
            );
        } else if (
            items.length
        ) {
            for (
                const item
                of items
            ) {
                const row =
                    createElement(
                        'div',
                        {
                            className:
                                'lps-aspect-item'
                        }
                    );

                row.appendChild(
                    createElement(
                        'span',
                        {
                            textContent:
                                item.label
                        }
                    )
                );

                if (
                    inputType ===
                    'checklist'
                ) {
                    row.appendChild(
                        createResponseChecklist(
                            options,
                            response
                                ?.items
                                ?.[
                                    item.id
                                ] ||
                            '',
                            aspect.id,
                            item.id
                        )
                    );
                } else if (
                    inputType ===
                    'text'
                ) {
                    const input =
                        createResponseTextInput(
                            response
                                ?.items
                                ?.[
                                    item.id
                                ] ||
                            '',
                            aspect.id,
                            item.id
                        );

                    input.className =
                        'lps-response-item-text';

                    row.appendChild(
                        input
                    );
                } else if (
                    options.length
                ) {
                    const select =
                        createResponseSelect(
                            options,
                            response
                                ?.items
                                ?.[
                                    item.id
                                ] ||
                            ''
                        );

                    select.className =
                        'lps-response-item';

                    select.dataset.aspectId =
                        aspect.id;

                    select.dataset.itemId =
                        item.id;

                    row.appendChild(
                        select
                    );
                } else {
                    row.appendChild(
                        createElement(
                            'span',
                            {
                                className:
                                    'text-slate-400',

                                textContent:
                                    'Tanpa kriteria pilihan'
                            }
                        )
                    );
                }

                article.appendChild(
                    row
                );
            }
        }

        if (
            aspect
                .descriptionEnabled !==
            false
        ) {
            const textarea =
                createElement(
                    'textarea'
                );

            textarea.rows =
                4;

            textarea.maxLength =
                4000;

            textarea.className =
                'lps-response-description';

            textarea.dataset.aspectId =
                aspect.id;

            textarea.value =
                response
                    ?.description ||
                '';

            article.appendChild(
                createField(
                    aspect
                        .descriptionLabel ||
                    'Deskripsi dan Rekomendasi',
                    textarea
                )
            );
        }

        return article;
    }

    function renderReportForm() {
        const report =
            runtime.currentReport;

        const template =
            runtime.currentTemplate;

        if (
            !report ||
            !template
        ) {
            return;
        }

        const container =
            byId(
                'lps-dynamic-form-container'
            );

        if (!container) {
            return;
        }

        container
            .replaceChildren();

        const fragment =
            document
                .createDocumentFragment();

        template
            .sections
            .forEach(
                (
                    section,
                    sectionIndex
                ) => {
                    const sectionElement =
                        createElement(
                            'section',
                            {
                                className:
                                    'lps-section-screen'
                            }
                        );

                    const heading =
                        createElement(
                            'h3',
                            {
                                textContent:
                                    `${
                                        section.code ||
                                        String
                                            .fromCharCode(
                                                65 +
                                                sectionIndex
                                            )
                                    }. ${section.title}`
                            }
                        );

                    const grid =
                        createElement(
                            'div',
                            {
                                className:
                                    'lps-aspects-grid'
                            }
                        );

                    for (
                        const aspect
                        of section.aspects
                    ) {
                        grid.appendChild(
                            renderAspectInput(
                                aspect,
                                report
                                    .responses
                                    ?.[
                                        aspect.id
                                    ] ||
                                {}
                            )
                        );
                    }

                    sectionElement.append(
                        heading,
                        grid
                    );

                    fragment.appendChild(
                        sectionElement
                    );
                }
            );

        container.appendChild(
            fragment
        );

        const dateInput =
            byId(
                'lps-report-date'
            );

        const offsetInput =
            byId(
                'lps-hijri-offset'
            );

        if (dateInput) {
            dateInput.value =
                report.reportDate ||
                '';
        }

        if (offsetInput) {
            offsetInput.value =
                String(
                    report
                        .hijriAdjustmentDays ||
                    0
                );
        }

        updateLPSHijriDate();

        const period =
            core.getPeriod(
                report.periodId
            );

        const title =
            byId(
                'lps-form-title'
            );

        if (title) {
            title.textContent =
                `${
                    period?.label ||
                    report.periodId
                } — ${
                    report
                        .studentSnapshot
                        .name
                }`;
        }

        const meta =
            byId(
                'lps-form-meta'
            );

        if (meta) {
            meta.textContent =
                `${
                    report
                        .academicYearLabel
                } · ${
                    report.classLabel
                } · Template v${
                    template
                        .templateVersion
                }`;
        }

        const periodDisplay =
            byId(
                'lps-class-period-display'
            );

        if (periodDisplay) {
            periodDisplay.value =
                `${
                    report.classLabel
                } / Semester ${
                    report.semester
                } (${
                    report.term ===
                        'ganjil'
                        ? 'Ganjil'
                        : 'Genap'
                })`;
        }

        const teacherNote =
            byId(
                'lps-teacher-note'
            );

        if (teacherNote) {
            teacherNote.value =
                report.teacherNote ||
                '';
        }

        const parentNote =
            byId(
                'lps-parent-note'
            );

        if (parentNote) {
            parentNote.value =
                report.parentNote ||
                '';
        }

        byId(
            'lps-blp-notes'
        )?.toggleAttribute(
            'hidden',
            report.reportType !==
                'BLP'
        );

        const badge =
            byId(
                'lps-template-version-badge'
            );

        if (badge) {
            badge.textContent =
                `Template ${
                    template
                        .reportType
                } v${
                    template
                        .templateVersion
                }`;
        }

        const latest =
            getActiveTemplate(
                report.periodId
            );

        const hasNewer =
            report.status !==
                'final' &&
            latest &&
            Number(
                latest
                    .templateVersion
            ) >
            Number(
                template
                    .templateVersion
            );

        byId(
            'lps-latest-template-alert'
        )?.toggleAttribute(
            'hidden',
            !hasNewer
        );

        updateStatusUI(
            report
        );
    }

    function updateStatusUI(
        report
    ) {
        const status =
            byId(
                'lps-report-status'
            );

        const final =
            report.status ===
                'final';

        if (status) {
            if (!final) {
                status.textContent =
                    `Draft · Revisi ${
                        report.revision ||
                        1
                    }`;

                status.className =
                    'lps-status-badge is-draft';
            } else if (
                runtime
                    .currentFinalIntegrity ===
                true
            ) {
                status.textContent =
                    `Final · Revisi ${
                        report.revision ||
                        1
                    } · VERIFIED`;

                status.className =
                    'lps-status-badge is-final';
            } else if (
                runtime
                    .currentFinalIntegrity ===
                false
            ) {
                status.textContent =
                    `Final · Revisi ${
                        report.revision ||
                        1
                    } · INTEGRITAS GAGAL`;

                status.className =
                    'lps-status-badge is-error';
            } else {
                status.textContent =
                    `Final · Revisi ${
                        report.revision ||
                        1
                    } · Memeriksa...`;

                status.className =
                    'lps-status-badge is-final';
            }
        }

        byId(
            'lps-save-draft-button'
        )?.toggleAttribute(
            'hidden',
            final
        );

        byId(
            'lps-finalize-button'
        )?.toggleAttribute(
            'hidden',
            final
        );

        byId(
            'lps-revise-button'
        )?.toggleAttribute(
            'hidden',
            !final ||
            runtime
                .currentFinalIntegrity ===
                false
        );

        const form =
            byId(
                'lps-main-form'
            );

        form
            ?.querySelectorAll(
                'input,select,textarea'
            )
            .forEach(
                (field) => {
                    field.disabled =
                        final;
                }
            );

        const dateInput =
            byId(
                'lps-report-date'
            );

        const offsetInput =
            byId(
                'lps-hijri-offset'
            );

        if (dateInput) {
            dateInput.disabled =
                final;
        }

        if (offsetInput) {
            offsetInput.disabled =
                final;
        }

        renderBusyState();
    }

    function renderBusyState() {
        const mapping =
            [
                [
                    'lps-save-draft-button',
                    runtime
                        .busy
                        .saveDraft
                ],

                [
                    'lps-finalize-button',
                    runtime
                        .busy
                        .finalize
                ],

                [
                    'lps-revise-button',
                    runtime
                        .busy
                        .revision
                ],

                [
                    'lps-save-template-button',
                    runtime
                        .busy
                        .template
                ]
            ];

        for (
            const [
                id,
                busy
            ]
            of mapping
        ) {
            const button =
                byId(
                    id
                );

            if (button) {
                button.disabled =
                    !!busy;
            }
        }
    }

    async function verifyFinalReport(
        report
    ) {
        if (
            report?.status !==
            'final'
        ) {
            return true;
        }

        if (
            typeof core
                .verifyReportHash !==
            'function'
        ) {
            return false;
        }

        try {
            const result =
                await core
                    .verifyReportHash(
                        report
                    );

            return (
                result?.ok ===
                true
            );
        } catch (
            error
        ) {
            console.error(
                '[SIMNI LPS] Verifikasi hash final gagal:',
                error
            );

            return false;
        }
    }

    function populateLPSFilter() {
        return runWhenReady(
            () => {
                const group =
                    byId(
                        'lps-filter-kelompok'
                    )?.value ||
                    'Semua';

                const select =
                    byId(
                        'lps-select-siswa'
                    );

                if (!select) {
                    return;
                }

                const selected =
                    select.value;

                const activeClass =
                    normalizeClassLabel(
                        window.state
                            ?.activeKelas
                    );

                const students =
                    [
                        ...(
                            window.state
                                ?.students ||
                            []
                        )
                    ]
                        .filter(
                            (student) =>
                                !activeClass ||
                                normalizeClassLabel(
                                    student
                                        .Kelas
                                ) ===
                                    activeClass
                        )
                        .filter(
                            (student) =>
                                group ===
                                    'Semua' ||
                                student
                                    .Kelompok ===
                                    group
                        )
                        .sort(
                            (
                                left,
                                right
                            ) =>
                                String(
                                    left[
                                        'Nama Lengkap'
                                    ] ||
                                    ''
                                )
                                    .localeCompare(
                                        String(
                                            right[
                                                'Nama Lengkap'
                                            ] ||
                                            ''
                                        ),
                                        'id'
                                    )
                        );

                select
                    .replaceChildren();

                const placeholder =
                    createElement(
                        'option',
                        {
                            textContent:
                                '-- Pilih Siswa --'
                        }
                    );

                placeholder.value =
                    '';

                select.appendChild(
                    placeholder
                );

                for (
                    const student
                    of students
                ) {
                    const option =
                        createElement(
                            'option',
                            {
                                textContent:
                                    student[
                                        'Nama Lengkap'
                                    ] ||
                                    String(
                                        student.NISN ||
                                        ''
                                    )
                            }
                        );

                    option.value =
                        String(
                            student.NISN ||
                            ''
                        );

                    select.appendChild(
                        option
                    );
                }

                if (
                    students.some(
                        (student) =>
                            String(
                                student.NISN
                            ) ===
                            String(
                                selected
                            )
                    )
                ) {
                    select.value =
                        selected;
                }

                if (
                    !select.value
                ) {
                    runtime.currentTemplate =
                        null;

                    runtime.currentReport =
                        null;

                    runtime.currentFinalIntegrity =
                        null;

                    byId(
                        'lps-empty-state'
                    )?.removeAttribute(
                        'hidden'
                    );

                    byId(
                        'lps-form-area'
                    )?.setAttribute(
                        'hidden',
                        ''
                    );

                    return;
                }

                void loadSiswaLPS();
            }
        );
    }

    function loadSiswaLPS() {
        return runWhenReady(
            async () => {
                const student =
                    getSelectedStudent();

                const period =
                    currentPeriod();

                if (
                    !student ||
                    !period
                ) {
                    runtime.currentTemplate =
                        null;

                    runtime.currentReport =
                        null;

                    runtime.currentFinalIntegrity =
                        null;

                    byId(
                        'lps-empty-state'
                    )?.removeAttribute(
                        'hidden'
                    );

                    byId(
                        'lps-form-area'
                    )?.setAttribute(
                        'hidden',
                        ''
                    );

                    return;
                }

                const settings =
                    currentSettings();

                const targetReportId =
                    core.reportId(
                        settings,
                        period.id,
                        student.NISN
                    );

                const savedReport =
                    getSavedReport(
                        targetReportId
                    );

                let template;
                let report;

                if (
                    savedReport
                        ?.templateSnapshot
                ) {
                    report =
                        core.deepClone(
                            savedReport
                        );

                    if (
                        report.status ===
                        'final'
                    ) {
                        /*
                         * Final snapshot tidak dinormalisasi ulang.
                         * Immutable snapshot harus tetap identik agar hash
                         * historis tetap dapat diverifikasi.
                         */
                        template =
                            core.deepClone(
                                report
                                    .templateSnapshot
                            );
                    } else {
                        template =
                            core.normalizeTemplate(
                                report
                                    .templateSnapshot,
                                settings,
                                period.id
                            );

                        report.templateSnapshot =
                            core.deepClone(
                                template
                            );
                    }
                } else {
                    template =
                        core.normalizeTemplate(
                            getActiveTemplate(
                                period.id
                            ) ||
                            core
                                .createDefaultTemplate(
                                    settings,
                                    period.id
                                ),
                            settings,
                            period.id
                        );

                    const legacy =
                        findLegacyReport(
                            student.NISN,
                            period.id
                        );

                    report =
                        legacy
                            ? migrateLegacyReport(
                                legacy,
                                student,
                                template
                            )
                            : makeDraftReport(
                                student,
                                template
                            );
                }

                if (
                    report.status !==
                    'final'
                ) {
                    report.responses =
                        normalizeResponsesToTemplate(
                            report.responses,
                            template
                        );
                }

                runtime.currentTemplate =
                    template;

                runtime.currentReport =
                    report;

                runtime.currentFinalIntegrity =
                    report.status ===
                        'final'
                        ? await verifyFinalReport(
                            report
                        )
                        : null;

                byId(
                    'lps-empty-state'
                )?.setAttribute(
                    'hidden',
                    ''
                );

                byId(
                    'lps-form-area'
                )?.removeAttribute(
                    'hidden'
                );

                renderReportForm();

                if (
                    report.status ===
                        'final' &&
                    runtime
                        .currentFinalIntegrity ===
                        false
                ) {
                    notify(
                        'Integritas SHA-256 laporan final gagal. Preview, cetak, dan revisi diblokir.',
                        'error'
                    );
                }
            }
        );
    }

    function updateLPSHijriDate() {
        const date =
            byId(
                'lps-report-date'
            )?.value ||
            '';

        const offset =
            Number(
                byId(
                    'lps-hijri-offset'
                )?.value ||
                0
            );

        const hijri =
            core
                .gregorianToHijri(
                    date,
                    offset
                );

        const target =
            byId(
                'lps-hijri-date'
            );

        if (target) {
            target.value =
                hijri;
        }

        if (
            runtime
                .currentReport &&
            runtime
                .currentReport
                .status !==
                'final'
        ) {
            runtime
                .currentReport
                .reportDate =
                date;

            runtime
                .currentReport
                .hijriAdjustmentDays =
                offset;

            runtime
                .currentReport
                .hijriDate =
                hijri;
        }
    }

    function collectReportFromForm() {
        if (
            !runtime
                .currentReport ||
            !runtime
                .currentTemplate
        ) {
            return null;
        }

        if (
            runtime
                .currentReport
                .status ===
                'final'
        ) {
            return core.deepClone(
                runtime.currentReport
            );
        }

        const report =
            core.deepClone(
                runtime.currentReport
            );

        const template =
            core.normalizeTemplate(
                runtime.currentTemplate,
                currentSettings(),
                currentPeriod()?.id
            );

        report.templateSnapshot =
            template;

        report.templateId =
            template.templateId;

        report.templateVersion =
            template.templateVersion;

        report.responses =
            core.createEmptyResponses(
                template
            );

        const form =
            byId(
                'lps-main-form'
            );

        form
            ?.querySelectorAll(
                '.lps-response-overall'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    if (target) {
                        target.overall =
                            field.value;
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-overall-text'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    if (target) {
                        target.overall =
                            field.value
                                .trim();
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-check:checked'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    const itemId =
                        field
                            .dataset
                            .itemId ||
                        '';

                    if (!target) return;

                    if (
                        itemId &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                target.items,
                                itemId
                            )
                    ) {
                        target.items[
                            itemId
                        ] =
                            field.value;
                    } else if (!itemId) {
                        target.overall =
                            field.value;
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-detail'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    if (target) {
                        target.detail =
                            field.value
                                .trim();
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-description'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    if (target) {
                        target.description =
                            field.value
                                .trim();
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-item'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    const itemId =
                        field
                            .dataset
                            .itemId;

                    if (
                        target &&
                        itemId &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                target.items,
                                itemId
                            )
                    ) {
                        target.items[
                            itemId
                        ] =
                            field.value;
                    }
                }
            );

        form
            ?.querySelectorAll(
                '.lps-response-item-text'
            )
            .forEach(
                (field) => {
                    const target =
                        report.responses[
                            field
                                .dataset
                                .aspectId
                        ];

                    const itemId =
                        field
                            .dataset
                            .itemId;

                    if (
                        target &&
                        itemId &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                target.items,
                                itemId
                            )
                    ) {
                        target.items[
                            itemId
                        ] =
                            field.value
                                .trim();
                    }
                }
            );

        report.teacherNote =
            byId(
                'lps-teacher-note'
            )?.value
                .trim() ||
            '';

        report.parentNote =
            byId(
                'lps-parent-note'
            )?.value
                .trim() ||
            '';

        report.reportDate =
            byId(
                'lps-report-date'
            )?.value ||
            '';

        report.hijriAdjustmentDays =
            Number(
                byId(
                    'lps-hijri-offset'
                )?.value ||
                0
            );

        report.hijriDate =
            core
                .gregorianToHijri(
                    report.reportDate,
                    report
                        .hijriAdjustmentDays
                );

        report.schoolSnapshot =
            currentSettings();

        report.updatedAt =
            nowISO();

        report.updatedBy =
            getUserMeta();

        return report;
    }

    async function ensureTemplatePersisted() {
        let template =
            runtime
                .currentTemplate;

        if (!template) {
            return {
                ok:
                    false,

                error:
                    new Error(
                        'Template aktif tidak tersedia.'
                    )
            };
        }

        const existing =
            core.getTemplateById(
                templateCollection(),
                template.templateId
            );

        if (existing) {
            return {
                ok:
                    true,

                template:
                    core.deepClone(
                        existing
                    )
            };
        }

        template =
            core.deepClone(
                template
            );

        template.createdAt =
            template.createdAt ||
            nowISO();

        template.updatedAt =
            nowISO();

        template.createdBy =
            template.createdBy ||
            getUserMeta();

        template.updatedBy =
            getUserMeta();

        const errors =
            core.validateTemplate(
                template
            );

        if (
            errors.length
        ) {
            return {
                ok:
                    false,

                error:
                    new Error(
                        errors[0]
                    )
            };
        }

        const result =
            await databaseSet(
                `LPS/Templates/${
                    template.templateId
                }`,
                template
            );

        if (!result.ok) {
            return result;
        }

        rememberTemplate(
            template
        );

        runtime.currentTemplate =
            template;

        return {
            ok:
                true,

            template
        };
    }

    async function persistReport(
        report
    ) {
        const result =
            await databaseSet(
                `LPS/Reports/${
                    report.reportId
                }`,
                report
            );

        if (!result.ok) {
            return result;
        }

        rememberReport(
            report
        );

        runtime.currentReport =
            core.deepClone(
                report
            );

        runtime.currentTemplate =
            core.deepClone(
                report
                    .templateSnapshot
            );

        runtime.currentFinalIntegrity =
            report.status ===
                'final'
                ? await verifyFinalReport(
                    report
                )
                : null;

        renderReportForm();

        return {
            ok:
                true,

            report:
                core.deepClone(
                    report
                )
        };
    }

    async function saveLPSData() {
        if (
            runtime
                .busy
                .saveDraft
        ) {
            return false;
        }

        if (
            !runtime
                .currentReport
        ) {
            notify(
                'Pilih siswa dan jenis laporan terlebih dahulu.',
                'warning'
            );

            return false;
        }

        if (
            runtime
                .currentReport
                .status ===
                'final'
        ) {
            notify(
                'Laporan sudah final. Gunakan Buka Revisi.',
                'warning'
            );

            return false;
        }

        runtime.busy.saveDraft =
            true;

        renderBusyState();

        showProgress(
            'Menyimpan draft LPS/BLP...'
        );

        try {
            const templateResult =
                await ensureTemplatePersisted();

            if (
                !templateResult.ok
            ) {
                throw (
                    templateResult.error ||
                    new Error(
                        'Template gagal disimpan.'
                    )
                );
            }

            const report =
                collectReportFromForm();

            if (!report) {
                throw new Error(
                    'Form laporan tidak tersedia.'
                );
            }

            report.templateId =
                templateResult
                    .template
                    .templateId;

            report.templateVersion =
                templateResult
                    .template
                    .templateVersion;

            report.templateSnapshot =
                core.deepClone(
                    templateResult
                        .template
                );

            report.status =
                'draft';

            report.hash =
                null;

            report.createdAt =
                report.createdAt ||
                nowISO();

            report.createdBy =
                report.createdBy ||
                getUserMeta();

            report.updatedAt =
                nowISO();

            report.updatedBy =
                getUserMeta();

            const result =
                await persistReport(
                    report
                );

            if (!result.ok) {
                throw (
                    result.error ||
                    new Error(
                        'Draft gagal disimpan.'
                    )
                );
            }

            runtime.lastOperation = {
                type:
                    'save-draft',

                status:
                    'success',

                reportId:
                    report.reportId,

                revision:
                    report.revision,

                completedAt:
                    nowISO()
            };

            notify(
                'Berhasil disimpan: draft LPS/BLP diperbarui.',
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Simpan draft gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'save-draft',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            notify(
                `Draft gagal disimpan: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            runtime.busy.saveDraft =
                false;

            renderBusyState();

            hideProgress();
        }
    }

    async function finalisasiLPS() {
        if (
            runtime
                .busy
                .finalize
        ) {
            return false;
        }

        if (
            !runtime
                .currentReport
        ) {
            notify(
                'Pilih siswa dan jenis laporan terlebih dahulu.',
                'warning'
            );

            return false;
        }

        if (
            runtime
                .currentReport
                .status ===
                'final'
        ) {
            notify(
                'Laporan ini sudah final.',
                'info'
            );

            return false;
        }

        runtime.busy.finalize =
            true;

        renderBusyState();

        showProgress(
            'Memvalidasi laporan final...'
        );

        try {
            const templateResult =
                await ensureTemplatePersisted();

            if (
                !templateResult.ok
            ) {
                throw (
                    templateResult.error ||
                    new Error(
                        'Template final gagal dipastikan.'
                    )
                );
            }

            const report =
                collectReportFromForm();

            if (!report) {
                throw new Error(
                    'Form laporan tidak tersedia.'
                );
            }

            report.templateId =
                templateResult
                    .template
                    .templateId;

            report.templateVersion =
                templateResult
                    .template
                    .templateVersion;

            report.templateSnapshot =
                core.deepClone(
                    templateResult
                        .template
                );

            report.status =
                'final';

            report.finalizedAt =
                nowISO();

            report.finalizedBy =
                getUserMeta();

            report.createdAt =
                report.createdAt ||
                nowISO();

            report.createdBy =
                report.createdBy ||
                getUserMeta();

            report.updatedAt =
                nowISO();

            report.updatedBy =
                getUserMeta();

            report.hash =
                null;

            const errors =
                core.validateFinalReport(
                    report
                );

            if (
                errors.length
            ) {
                notify(
                    `${
                        errors[0]
                    }${
                        errors.length >
                            1
                            ? ` (+${
                                errors.length -
                                1
                            } lainnya)`
                            : ''
                    }`,
                    'warning'
                );

                return false;
            }

            hideProgress();

            const approved =
                window.confirm(
                    [
                        'Finalkan dan kunci laporan ini?',
                        '',
                        'Setelah final:',
                        '- isian dikunci;',
                        '- SHA-256 laporan disimpan;',
                        '- perubahan berikutnya harus melalui Buka Revisi;',
                        '- snapshot final lama tetap dipertahankan.'
                    ].join(
                        '\n'
                    )
                );

            if (!approved) {
                return false;
            }

            showProgress(
                'Menghitung SHA-256 dan menyimpan laporan final...'
            );

            report.hash =
                await core
                    .hashReport(
                        report
                    );

            const localVerification =
                await core
                    .verifyReportHash(
                        report
                    );

            if (
                !localVerification
                    ?.ok
            ) {
                throw new Error(
                    'SHA-256 laporan final gagal diverifikasi sebelum penyimpanan.'
                );
            }

            const result =
                await persistReport(
                    report
                );

            if (!result.ok) {
                throw (
                    result.error ||
                    new Error(
                        'Laporan final gagal disimpan.'
                    )
                );
            }

            if (
                runtime
                    .currentFinalIntegrity !==
                true
            ) {
                throw new Error(
                    'Read-back lokal laporan final gagal verifikasi SHA-256.'
                );
            }

            runtime.lastOperation = {
                type:
                    'finalize',

                status:
                    'verified',

                reportId:
                    report.reportId,

                revision:
                    report.revision,

                hash:
                    report.hash,

                completedAt:
                    nowISO()
            };

            notify(
                'Laporan final berhasil dikunci dan SHA-256 VERIFIED.',
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Finalisasi gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'finalize',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            notify(
                `Finalisasi gagal: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            runtime.busy.finalize =
                false;

            renderBusyState();

            hideProgress();
        }
    }

    async function bukaRevisiLPS() {
        if (
            runtime
                .busy
                .revision
        ) {
            return false;
        }

        const current =
            runtime.currentReport;

        if (
            !current ||
            current.status !==
                'final'
        ) {
            notify(
                'Hanya laporan final yang dapat direvisi.',
                'warning'
            );

            return false;
        }

        runtime.busy.revision =
            true;

        renderBusyState();

        showProgress(
            'Memverifikasi laporan final sebelum revisi...'
        );

        try {
            const verification =
                await core
                    .verifyReportHash(
                        current
                    );

            if (
                !verification
                    ?.ok
            ) {
                runtime
                    .currentFinalIntegrity =
                    false;

                renderReportForm();

                throw new Error(
                    'Hash laporan final tidak valid. Revisi diblokir agar snapshot rusak tidak dijadikan sumber.'
                );
            }

            runtime
                .currentFinalIntegrity =
                true;

            hideProgress();

            const approved =
                window.confirm(
                    [
                        'Buka revisi baru?',
                        '',
                        'Snapshot laporan final saat ini akan disimpan',
                        'ke Riwayat Revisi sebelum laporan aktif dibuka kembali.'
                    ].join(
                        '\n'
                    )
                );

            if (!approved) {
                return false;
            }

            showProgress(
                'Menyimpan snapshot final dan membuka revisi...'
            );

            const draft =
                core.deepClone(
                    current
                );

            draft.status =
                'draft';

            draft.revision =
                Number(
                    current.revision ||
                    1
                ) + 1;

            draft.revisionOfHash =
                current.hash;

            draft.hash =
                null;

            draft.finalizedAt =
                null;

            draft.finalizedBy =
                null;

            draft.updatedAt =
                nowISO();

            draft.updatedBy =
                getUserMeta();

            const archiveKey =
                `r${
                    String(
                        current.revision ||
                        1
                    ).padStart(
                        3,
                        '0'
                    )
                }_${
                    String(
                        current.hash
                    ).slice(
                        0,
                        16
                    )
                }`;

            const result =
                await databaseUpdate({
                    [
                        `LPS/Revisions/${
                            current.reportId
                        }/${archiveKey}`
                    ]:
                        current,

                    [
                        `LPS/Reports/${
                            current.reportId
                        }`
                    ]:
                        draft
                });

            if (!result.ok) {
                throw (
                    result.error ||
                    new Error(
                        'Revisi gagal dibuka.'
                    )
                );
            }

            rememberReport(
                draft
            );

            runtime.currentReport =
                draft;

            runtime.currentTemplate =
                core.deepClone(
                    draft
                        .templateSnapshot
                );

            runtime.currentFinalIntegrity =
                null;

            renderReportForm();

            runtime.lastOperation = {
                type:
                    'open-revision',

                status:
                    'success',

                reportId:
                    draft.reportId,

                revision:
                    draft.revision,

                previousHash:
                    current.hash,

                completedAt:
                    nowISO()
            };

            notify(
                `Revisi ${
                    draft.revision
                } dibuka.`,
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Buka revisi gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'open-revision',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            notify(
                `Revisi gagal dibuka: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            runtime.busy.revision =
                false;

            renderBusyState();

            hideProgress();
        }
    }

    function gunakanTemplateLPSAktif() {
        const latest =
            getActiveTemplate(
                runtime
                    .currentReport
                    ?.periodId
            );

        if (
            !latest ||
            !runtime
                .currentReport ||
            runtime
                .currentReport
                .status ===
                'final'
        ) {
            return false;
        }

        const approved =
            window.confirm(
                [
                    'Gunakan template terbaru?',
                    '',
                    'Isian penilaian draft ini akan dikosongkan',
                    'karena struktur aspek dapat berubah.'
                ].join(
                    '\n'
                )
            );

        if (!approved) {
            return false;
        }

        const normalized =
            core.normalizeTemplate(
                latest,
                currentSettings(),
                latest.periodId
            );

        runtime.currentTemplate =
            normalized;

        runtime.currentReport.templateId =
            normalized.templateId;

        runtime.currentReport.templateVersion =
            normalized.templateVersion;

        runtime.currentReport.templateSnapshot =
            core.deepClone(
                normalized
            );

        runtime.currentReport.responses =
            core.createEmptyResponses(
                normalized
            );

        runtime.currentReport.hash =
            null;

        runtime.currentReport.updatedAt =
            nowISO();

        runtime.currentReport.updatedBy =
            getUserMeta();

        renderReportForm();

        return true;
    }

    function templateCandidateLabel(
        template
    ) {
        const period =
            core.getPeriod(
                template.periodId
            );

        return (
            `${
                template
                    .academicYearLabel
            } · ${
                template.classLabel
            } · ${
                period?.label ||
                template.periodId
            } · v${
                template
                    .templateVersion
            }`
        );
    }

    function populateTemplateSourceSelect() {
        const select =
            byId(
                'lps-template-source'
            );

        if (!select) {
            return;
        }

        select
            .replaceChildren();

        const placeholder =
            createElement(
                'option',
                {
                    textContent:
                        '-- Pilih template sumber --'
                }
            );

        placeholder.value =
            '';

        select.appendChild(
            placeholder
        );

        const templates =
            templateCollection()
                .sort(
                    (
                        left,
                        right
                    ) =>
                        String(
                            right.updatedAt ||
                            ''
                        )
                            .localeCompare(
                                String(
                                    left.updatedAt ||
                                    ''
                                )
                            )
                );

        for (
            const template
            of templates
        ) {
            const option =
                createElement(
                    'option',
                    {
                        textContent:
                            templateCandidateLabel(
                                template
                            )
                    }
                );

            option.value =
                template.templateId;

            select.appendChild(
                option
            );
        }
    }

    function openModalPengaturanLPS() {
        return runWhenReady(
            () => {
                const periodId =
                    currentPeriodId();

                const settings =
                    currentSettings();

                runtime.builderDraft =
                    core.normalizeTemplate(
                        getActiveTemplate(
                            periodId
                        ) ||
                        core
                            .createDefaultTemplate(
                                settings,
                                periodId
                            ),
                        settings,
                        periodId
                    );

                runtime
                    .builderSourceTemplateId =
                    runtime
                        .builderDraft
                        ?.copiedFromTemplateId ||
                    null;

                populateTemplateSourceSelect();

                const scopeLabel =
                    byId(
                        'lps-builder-scope-label'
                    );

                if (scopeLabel) {
                    scopeLabel.textContent =
                        `${
                            settings
                                .tahun_pelajaran
                        } · ${
                            settings
                                .nama_kelas
                        } · ${
                            core
                                .getPeriod(
                                    periodId
                                )
                                .label
                        }`;
                }

                renderBuilder();

                window.openModal?.(
                    'modal-pengaturan-lps'
                );

                return true;
            }
        );
    }

    function createBuilderInput(
        className,
        value,
        {
            placeholder =
                ''
        } = {}
    ) {
        const input =
            createElement(
                'input'
            );

        input.type =
            'text';

        input.className =
            className;

        input.value =
            String(
                value ||
                ''
            );

        input.maxLength =
            4000;

        if (placeholder) {
            input.placeholder =
                placeholder;
        }

        return input;
    }

    function createBuilderActionButton({
        action,
        icon,
        textContent =
            '',
        className =
            'lps-button lps-button-soft',
        disabled =
            false,
        sectionIndex =
            null,
        aspectIndex =
            null,
        direction =
            null,
        ariaLabel =
            ''
    }) {
        const button =
            createElement(
                'button',
                {
                    type:
                        'button',

                    className
                }
            );

        button.dataset.lpsAction =
            action;

        if (
            sectionIndex !==
            null
        ) {
            button.dataset.sectionIndex =
                String(
                    sectionIndex
                );
        }

        if (
            aspectIndex !==
            null
        ) {
            button.dataset.aspectIndex =
                String(
                    aspectIndex
                );
        }

        if (
            direction !==
            null
        ) {
            button.dataset.direction =
                String(
                    direction
                );
        }

        button.disabled =
            !!disabled;

        if (ariaLabel) {
            button.setAttribute(
                'aria-label',
                ariaLabel
            );
        }

        const iconElement =
            createElement(
                'i'
            );

        iconElement.className =
            icon;

        iconElement.setAttribute(
            'aria-hidden',
            'true'
        );

        button.appendChild(
            iconElement
        );

        if (textContent) {
            button.appendChild(
                document
                    .createTextNode(
                        ` ${textContent}`
                    )
            );
        }

        return button;
    }

    function renderBuilderAspect(
        aspect,
        sectionIndex,
        aspectIndex,
        aspectCount
    ) {
        const article =
            createElement(
                'article',
                {
                    className:
                        'lps-builder-aspect'
                }
            );

        article.dataset.aspectIndex =
            String(
                aspectIndex
            );

        const grid =
            createElement(
                'div',
                {
                    className:
                        'lps-builder-aspect-grid'
                }
            );

        const inputTypeSelect =
            createElement(
                'select'
            );

        inputTypeSelect.className =
            'lps-builder-aspect-input-type';

        [
            [
                'select',
                'Dropdown pilihan'
            ],
            [
                'checklist',
                'Kolom ceklis'
            ],
            [
                'text',
                'Isian teks'
            ]
        ].forEach(
            ([
                value,
                label
            ]) => {
                const option =
                    createElement(
                        'option',
                        {
                            textContent:
                                label
                        }
                    );

                option.value =
                    value;

                option.selected =
                    aspect.inputType ===
                    value;

                inputTypeSelect.appendChild(
                    option
                );
            }
        );

        grid.append(
            createField(
                'Nama Aspek',
                createBuilderInput(
                    'lps-builder-aspect-title',
                    aspect.title
                )
            ),

            createField(
                'Kriteria (pisahkan koma)',
                createBuilderInput(
                    'lps-builder-aspect-options',
                    (
                        aspect.options ||
                        []
                    ).join(
                        ', '
                    ),
                    {
                        placeholder:
                            'A, B, C, D'
                    }
                )
            ),

            createField(
                'Tipe isian nilai',
                inputTypeSelect
            ),

            createField(
                'Label detail opsional',
                createBuilderInput(
                    'lps-builder-aspect-detail',
                    aspect.detailLabel,
                    {
                        placeholder:
                            'Contoh: Surat/Jilid'
                    }
                )
            )
        );

        article.appendChild(
            grid
        );

        const items =
            createElement(
                'textarea'
            );

        items.rows =
            4;

        items.className =
            'lps-builder-aspect-items';

        items.maxLength =
            20000;

        items.value =
            (
                aspect.items ||
                []
            )
                .map(
                    (item) =>
                        item.label
                )
                .join(
                    '\n'
                );

        const itemField =
            createField(
                'Butir penilaian (satu baris satu butir)',
                items
            );

        itemField.classList.add(
            'lps-builder-items'
        );

        article.appendChild(
            itemField
        );

        const descriptionLabel =
            createElement(
                'label'
            );

        descriptionLabel.style.display =
            'flex';

        descriptionLabel.style.alignItems =
            'center';

        descriptionLabel.style.gap =
            '.45rem';

        descriptionLabel.style.fontSize =
            '.75rem';

        descriptionLabel.style.marginTop =
            '.5rem';

        const checkbox =
            createElement(
                'input'
            );

        checkbox.type =
            'checkbox';

        checkbox.className =
            'lps-builder-description-enabled';

        checkbox.checked =
            aspect
                .descriptionEnabled !==
            false;

        descriptionLabel.append(
            checkbox,
            document.createTextNode(
                ' Sediakan kolom deskripsi dan rekomendasi'
            )
        );

        article.appendChild(
            descriptionLabel
        );

        const actions =
            createElement(
                'div',
                {
                    className:
                        'lps-builder-row-actions'
                }
            );

        actions.append(
            createBuilderActionButton({
                action:
                    'move-builder-aspect',

                icon:
                    'fas fa-arrow-up',

                textContent:
                    'Naik',

                sectionIndex,

                aspectIndex,

                direction:
                    -1,

                disabled:
                    aspectIndex ===
                    0
            }),

            createBuilderActionButton({
                action:
                    'move-builder-aspect',

                icon:
                    'fas fa-arrow-down',

                textContent:
                    'Turun',

                sectionIndex,

                aspectIndex,

                direction:
                    1,

                disabled:
                    aspectIndex ===
                    aspectCount - 1
            }),

            createBuilderActionButton({
                action:
                    'remove-builder-aspect',

                icon:
                    'fas fa-trash',

                textContent:
                    'Hapus Aspek',

                className:
                    'lps-button lps-button-danger',

                sectionIndex,

                aspectIndex
            })
        );

        article.appendChild(
            actions
        );

        return article;
    }

    function renderBuilder() {
        const template =
            runtime.builderDraft;

        const container =
            byId(
                'lps-builder-container'
            );

        if (
            !template ||
            !container
        ) {
            return;
        }

        container
            .replaceChildren();

        const fragment =
            document
                .createDocumentFragment();

        template
            .sections
            .forEach(
                (
                    section,
                    sectionIndex
                ) => {
                    const sectionElement =
                        createElement(
                            'section',
                            {
                                className:
                                    'lps-builder-section'
                            }
                        );

                    sectionElement.dataset.sectionIndex =
                        String(
                            sectionIndex
                        );

                    const head =
                        createElement(
                            'div',
                            {
                                className:
                                    'lps-builder-section-head'
                            }
                        );

                    head.append(
                        createField(
                            'Kode',
                            createBuilderInput(
                                'lps-builder-section-code',
                                section.code
                            )
                        ),

                        createField(
                            'Judul Bagian',
                            createBuilderInput(
                                'lps-builder-section-title',
                                section.title
                            )
                        )
                    );

                    const sectionActions =
                        createElement(
                            'div',
                            {
                                className:
                                    'lps-builder-row-actions'
                            }
                        );

                    sectionActions.append(
                        createBuilderActionButton({
                            action:
                                'move-builder-section',

                            icon:
                                'fas fa-arrow-up',

                            sectionIndex,

                            direction:
                                -1,

                            disabled:
                                sectionIndex ===
                                0,

                            ariaLabel:
                                'Naikkan bagian'
                        }),

                        createBuilderActionButton({
                            action:
                                'move-builder-section',

                            icon:
                                'fas fa-arrow-down',

                            sectionIndex,

                            direction:
                                1,

                            disabled:
                                sectionIndex ===
                                template
                                    .sections
                                    .length -
                                1,

                            ariaLabel:
                                'Turunkan bagian'
                        }),

                        createBuilderActionButton({
                            action:
                                'remove-builder-section',

                            icon:
                                'fas fa-trash',

                            className:
                                'lps-button lps-button-danger',

                            sectionIndex,

                            ariaLabel:
                                'Hapus bagian'
                        })
                    );

                    head.appendChild(
                        sectionActions
                    );

                    sectionElement.appendChild(
                        head
                    );

                    const aspects =
                        createElement(
                            'div',
                            {
                                className:
                                    'lps-builder-aspects'
                            }
                        );

                    section
                        .aspects
                        .forEach(
                            (
                                aspect,
                                aspectIndex
                            ) => {
                                aspects.appendChild(
                                    renderBuilderAspect(
                                        aspect,
                                        sectionIndex,
                                        aspectIndex,
                                        section
                                            .aspects
                                            .length
                                    )
                                );
                            }
                        );

                    sectionElement
                        .appendChild(
                            aspects
                        );

                    const addAspect =
                        createBuilderActionButton({
                            action:
                                'add-builder-aspect',

                            icon:
                                'fas fa-plus',

                            textContent:
                                'Tambah Aspek',

                            sectionIndex
                        });

                    addAspect.style.marginTop =
                        '.7rem';

                    sectionElement
                        .appendChild(
                            addAspect
                        );

                    fragment
                        .appendChild(
                            sectionElement
                        );
                }
            );

        container.appendChild(
            fragment
        );
    }

    function syncBuilderFromDOM() {
        const template =
            runtime.builderDraft;

        if (!template) {
            return;
        }

        byId(
            'lps-builder-container'
        )
            ?.querySelectorAll(
                '.lps-builder-section'
            )
            .forEach(
                (
                    sectionElement,
                    sectionIndex
                ) => {
                    const section =
                        template
                            .sections[
                                sectionIndex
                            ];

                    if (!section) {
                        return;
                    }

                    section.code =
                        sectionElement
                            .querySelector(
                                '.lps-builder-section-code'
                            )
                            ?.value
                            .trim() ||
                        String
                            .fromCharCode(
                                65 +
                                sectionIndex
                            );

                    section.title =
                        sectionElement
                            .querySelector(
                                '.lps-builder-section-title'
                            )
                            ?.value
                            .trim() ||
                        '';

                    sectionElement
                        .querySelectorAll(
                            '.lps-builder-aspect'
                        )
                        .forEach(
                            (
                                aspectElement,
                                aspectIndex
                            ) => {
                                const aspect =
                                    section
                                        .aspects[
                                            aspectIndex
                                        ];

                                if (!aspect) {
                                    return;
                                }

                                aspect.title =
                                    aspectElement
                                        .querySelector(
                                            '.lps-builder-aspect-title'
                                        )
                                        ?.value
                                        .trim() ||
                                    '';

                                const optionValues =
                                    (
                                        aspectElement
                                            .querySelector(
                                                '.lps-builder-aspect-options'
                                            )
                                            ?.value ||
                                        ''
                                    )
                                        .split(
                                            ','
                                        )
                                        .map(
                                            (item) =>
                                                item
                                                    .trim()
                                        )
                                        .filter(
                                            Boolean
                                        );

                                aspect.options =
                                    [
                                        ...new Set(
                                            optionValues
                                        )
                                    ];

                                aspect.inputType =
                                    aspectElement
                                        .querySelector(
                                            '.lps-builder-aspect-input-type'
                                        )
                                        ?.value ||
                                    'select';

                                const optionSignature =
                                    aspect.options
                                        .map(
                                            (option) =>
                                                option
                                                    .toLocaleUpperCase(
                                                        'id-ID'
                                                    )
                                        )
                                        .join(
                                            '|'
                                        );

                                if (
                                    optionSignature ===
                                    'A|B|C|D'
                                ) {
                                    aspect.inputType =
                                        'select';
                                } else if (
                                    aspect.inputType ===
                                    'text'
                                ) {
                                    aspect.options =
                                        [];
                                }

                                aspect.detailLabel =
                                    aspectElement
                                        .querySelector(
                                            '.lps-builder-aspect-detail'
                                        )
                                        ?.value
                                        .trim() ||
                                    '';

                                aspect.descriptionEnabled =
                                    !!aspectElement
                                        .querySelector(
                                            '.lps-builder-description-enabled'
                                        )
                                        ?.checked;

                                const oldItems =
                                    aspect.items ||
                                    [];

                                const labels =
                                    (
                                        aspectElement
                                            .querySelector(
                                                '.lps-builder-aspect-items'
                                            )
                                            ?.value ||
                                        ''
                                    )
                                        .split(
                                            '\n'
                                        )
                                        .map(
                                            (item) =>
                                                item
                                                    .trim()
                                        )
                                        .filter(
                                            Boolean
                                        );

                                aspect.items =
                                    labels.map(
                                        (
                                            label,
                                            itemIndex
                                        ) => {
                                            const exact =
                                                oldItems
                                                    .find(
                                                        (item) =>
                                                            item.label ===
                                                            label
                                                    );

                                            return {
                                                id:
                                                    exact
                                                        ?.id ||
                                                    oldItems[
                                                        itemIndex
                                                    ]?.id ||
                                                    core
                                                        .randomId(
                                                            `${aspect.id}_item`
                                                        ),

                                                label
                                            };
                                        }
                                    );
                            }
                        );
                }
            );
    }

    function addLPSBuilderSection() {
        syncBuilderFromDOM();

        const draft =
            runtime.builderDraft;

        if (!draft) {
            return false;
        }

        const sectionIndex =
            draft
                .sections
                .length;

        draft.sections.push({
            id:
                core.randomId(
                    'section'
                ),

            code:
                String
                    .fromCharCode(
                        65 +
                        sectionIndex
                    ),

            title:
                'Bagian Baru',

            aspects:
                []
        });

        renderBuilder();

        return true;
    }

    function removeLPSBuilderSection(
        sectionIndex
    ) {
        const draft =
            runtime.builderDraft;

        if (!draft) {
            return false;
        }

        if (
            draft
                .sections
                .length <=
            1
        ) {
            notify(
                'Template harus memiliki minimal satu bagian.',
                'warning'
            );

            return false;
        }

        if (
            !window.confirm(
                'Hapus bagian beserta seluruh aspeknya?'
            )
        ) {
            return false;
        }

        syncBuilderFromDOM();

        draft.sections.splice(
            sectionIndex,
            1
        );

        renderBuilder();

        return true;
    }

    function moveLPSBuilderSection(
        sectionIndex,
        direction
    ) {
        syncBuilderFromDOM();

        const sections =
            runtime
                .builderDraft
                ?.sections;

        if (!sections) {
            return false;
        }

        const target =
            sectionIndex +
            direction;

        if (
            target <
                0 ||
            target >=
                sections.length
        ) {
            return false;
        }

        [
            sections[
                sectionIndex
            ],
            sections[
                target
            ]
        ] = [
            sections[
                target
            ],
            sections[
                sectionIndex
            ]
        ];

        renderBuilder();

        return true;
    }

    function addLPSBuilderCategory(
        sectionIndex =
            0
    ) {
        syncBuilderFromDOM();

        const section =
            runtime
                .builderDraft
                ?.sections
                ?.[
                    sectionIndex
                ];

        if (!section) {
            return false;
        }

        section.aspects.push({
            id:
                core.randomId(
                    'aspect'
                ),
            title:
                'Aspek Baru',

            options: [
                'A',
                'B',
                'C',
                'D'
            ],

            inputType:
                'select',

            items:
                [],

            detailLabel:
                '',

            descriptionLabel:
                'Deskripsi dan Rekomendasi',

            descriptionEnabled:
                true
        });

        renderBuilder();

        return true;
    }

    function removeLPSBuilderCategory(
        sectionIndex,
        aspectIndex
    ) {
        syncBuilderFromDOM();

        const section =
            runtime
                .builderDraft
                ?.sections
                ?.[
                    sectionIndex
                ];

        if (!section) {
            return false;
        }

        if (
            !window.confirm(
                'Hapus aspek ini?'
            )
        ) {
            return false;
        }

        section.aspects.splice(
            aspectIndex,
            1
        );

        renderBuilder();

        return true;
    }

    function moveLPSBuilderAspect(
        sectionIndex,
        aspectIndex,
        direction
    ) {
        syncBuilderFromDOM();

        const aspects =
            runtime
                .builderDraft
                ?.sections
                ?.[
                    sectionIndex
                ]
                ?.aspects;

        if (!aspects) {
            return false;
        }

        const target =
            aspectIndex +
            direction;

        if (
            target <
                0 ||
            target >=
                aspects.length
        ) {
            return false;
        }

        [
            aspects[
                aspectIndex
            ],
            aspects[
                target
            ]
        ] = [
            aspects[
                target
            ],
            aspects[
                aspectIndex
            ]
        ];

        renderBuilder();

        return true;
    }

    function salinTemplateLPS() {
        const sourceId =
            byId(
                'lps-template-source'
            )?.value ||
            '';

        const source =
            core.getTemplateById(
                templateCollection(),
                sourceId
            );

        if (!source) {
            notify(
                'Pilih template sumber terlebih dahulu.',
                'warning'
            );

            return false;
        }

        runtime.builderDraft =
            core.cloneTemplateForPeriod(
                source,
                currentSettings(),
                currentPeriodId()
            );

        runtime
            .builderSourceTemplateId =
            source.templateId;

        renderBuilder();

        notify(
            'Struktur template berhasil disalin. Simpan untuk membuat versi aktif.',
            'success'
        );

        return true;
    }

    function resetTemplateLPSKeAcuan() {
        if (
            !window.confirm(
                'Kembalikan builder ke struktur acuan Excel untuk jenis laporan ini?'
            )
        ) {
            return false;
        }

        runtime.builderDraft =
            core.createDefaultTemplate(
                currentSettings(),
                currentPeriodId()
            );

        runtime
            .builderSourceTemplateId =
            null;

        renderBuilder();

        return true;
    }

    async function simpanPengaturanLPS(
        event
    ) {
        event
            ?.preventDefault?.();

        if (
            runtime
                .busy
                .template
        ) {
            return false;
        }

        runtime.busy.template =
            true;

        renderBusyState();

        showProgress(
            'Memvalidasi dan menyimpan versi template...'
        );

        try {
            assertLPSAccess();

            syncBuilderFromDOM();

            const settings =
                currentSettings();

            const periodId =
                currentPeriodId();

            const active =
                getActiveTemplate(
                    periodId
                );

            const normalized =
                core.normalizeTemplate(
                    runtime
                        .builderDraft,
                    settings,
                    periodId
                );

            const errors =
                core.validateTemplate(
                    normalized
                );

            if (
                errors.length
            ) {
                notify(
                    `${
                        errors[0]
                    }${
                        errors.length >
                            1
                            ? ` (+${
                                errors.length -
                                1
                            } lainnya)`
                            : ''
                    }`,
                    'warning'
                );

                return false;
            }

            const version =
                (
                    Number(
                        active
                            ?.templateVersion
                    ) ||
                    0
                ) + 1;

            const timestamp =
                nowISO();

            const scopeId =
                core.templateScopeId(
                    settings,
                    periodId
                );

            const template = {
                ...normalized,

                scopeId,

                templateId:
                    `${scopeId}_v${version}`,

                templateVersion:
                    version,

                createdAt:
                    timestamp,

                createdBy:
                    getUserMeta(),

                updatedAt:
                    timestamp,

                updatedBy:
                    getUserMeta(),

                copiedFromTemplateId:
                    runtime
                        .builderSourceTemplateId ||
                    normalized
                        .copiedFromTemplateId ||
                    null
            };

            const result =
                await databaseSet(
                    `LPS/Templates/${
                        template.templateId
                    }`,
                    template
                );

            if (!result.ok) {
                throw (
                    result.error ||
                    new Error(
                        'Versi template gagal disimpan.'
                    )
                );
            }

            rememberTemplate(
                template
            );

            runtime.builderDraft =
                core.deepClone(
                    template
                );

            runtime
                .builderSourceTemplateId =
                null;

            window.closeModal?.(
                'modal-pengaturan-lps'
            );

            await loadSiswaLPS();

            runtime.lastOperation = {
                type:
                    'save-template',

                status:
                    'success',

                templateId:
                    template.templateId,

                version,

                completedAt:
                    nowISO()
            };

            notify(
                `Berhasil disimpan: template versi ${version} telah diaktifkan.`,
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Simpan template gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'save-template',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            notify(
                `Template gagal disimpan: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            runtime.busy.template =
                false;

            renderBusyState();

            hideProgress();
        }
    }

    function normalizeExcelText(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLocaleLowerCase('id-ID')
            .replace(/[^a-z0-9]+/g, '');
    }

    function excelCellText(cell) {
        const value = cell?.value;
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
            if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
            if (value.text !== undefined) return String(value.text);
            if (value.result !== undefined) return String(value.result);
        }
        return String(value);
    }

    function findExcelCellByText(worksheet, text) {
        const target = normalizeExcelText(text);
        if (!target) return null;
        let partialMatch = null;
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            row.eachCell({ includeEmpty: false }, (cell) => {
                if (partialMatch?.exact) return;
                if (cell.isMerged && cell.master.address !== cell.address) return;
                const candidate = normalizeExcelText(excelCellText(cell));
                if (!candidate) return;
                if (candidate === target) {
                    partialMatch = { exact: true, cell };
                    return;
                }
                if (!partialMatch && candidate.includes(target)) {
                    partialMatch = { exact: false, cell };
                }
            });
        });
        return partialMatch?.cell || null;
    }

    function setExcelCellValue(cell, value) {
        if (!cell) return;
        const writableCell = cell.isMerged ? cell.master : cell;
        writableCell.value = value;
    }

    function writeExcelIdentity(worksheet, report) {
        const student = report.studentSnapshot || {};
        const school = report.schoolSnapshot || {};
        [
            ['A1', school.nama_yayasan || ''],
            ['A2', school.jenjang_sekolah || ''],
            ['A3', school.nama_sekolah || ''],
            ['A4', school.status_akreditasi || ''],
            ['A5', school.nomor_izin || '']
        ].forEach(([address, value]) => setExcelCellValue(worksheet.getCell(address), value));
        const identityMappings = [
            ['Nama Siswa', 3, student.name || ''],
            ['No. Induk', 3, student.studentId || ''],
            ['Kelas', 4, report.classLabel || ''],
            ['Semester', 4, String(report.semester || '')]
        ];
        identityMappings.forEach(([label, offset, value]) => {
            const labelCell = findExcelCellByText(worksheet, label);
            if (!labelCell) return;
            setExcelCellValue(worksheet.getCell(labelCell.row, labelCell.col + offset), value);
        });
        const yearCell = findExcelCellByText(worksheet, 'Tahun Pelajaran');
        if (!yearCell) throw new Error('Template Excel tidak memiliki anchor Tahun Pelajaran.');
        setExcelCellValue(yearCell, `Tahun Pelajaran ${report.academicYearLabel || ''}`);
    }

    function optionColumnForAspect(worksheet, aspectRow, itemRow, value) {
        const selected = normalizeExcelText(value);
        if (!selected) return null;
        const lastHeaderRow = Math.max(aspectRow, itemRow - 1);
        for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
            const fragments = [];
            for (let rowIndex = aspectRow; rowIndex <= lastHeaderRow; rowIndex += 1) {
                const cell = worksheet.getCell(rowIndex, columnIndex);
                if (cell.isMerged && cell.master.address !== cell.address) continue;
                const fragment = normalizeExcelText(excelCellText(cell));
                if (fragment && !fragments.includes(fragment)) fragments.push(fragment);
            }
            const candidate = fragments.join('');
            if (fragments.includes(selected) || candidate === selected) return columnIndex;
        }
        return null;
    }

    function clearExcelCheckmarks(worksheet, rowIndex) {
        for (let columnIndex = 6; columnIndex <= 24; columnIndex += 1) {
            const cell = worksheet.getCell(rowIndex, columnIndex);
            const raw = excelCellText(cell).trim();
            if (['✓', 'ü', '√'].includes(raw)) setExcelCellValue(cell, '');
        }
    }

    function findExcelHeaderColumn(worksheet, rowIndex, label, lookback = 16) {
        const target = normalizeExcelText(label);
        for (let row = rowIndex; row >= Math.max(1, rowIndex - lookback); row -= 1) {
            for (let column = 1; column <= worksheet.columnCount; column += 1) {
                const cell = worksheet.getCell(row, column);
                if (cell.isMerged && cell.master.address !== cell.address) continue;
                const candidate = normalizeExcelText(excelCellText(cell));
                if (
                    candidate === target ||
                    (target === 'deskripsi' && candidate.startsWith(target))
                ) return cell.master.col;
            }
        }
        return null;
    }

    function writeExcelDirectGrade(worksheet, rowIndex, value) {
        const gradeColumn = findExcelHeaderColumn(worksheet, rowIndex, 'NILAI', 4);
        if (gradeColumn === null) throw new Error(`Kolom nilai template tidak ditemukan pada baris ${rowIndex}.`);
        setExcelCellValue(worksheet.getCell(rowIndex, gradeColumn), value || '');
    }

    function writeExcelResponseRow(worksheet, aspectRow, rowIndex, aspect, itemValue) {
        clearExcelCheckmarks(worksheet, rowIndex);
        const selected = itemValue || '';
        if (!selected) return;
        const optionColumn = optionColumnForAspect(worksheet, aspectRow, rowIndex, selected);
        if (optionColumn === null) {
            throw new Error(`Kolom pilihan "${selected}" untuk ${aspect.title} tidak ditemukan pada template.`);
        }
        setExcelCellValue(worksheet.getCell(rowIndex, optionColumn), '✓');
    }

    function writeExcelDescription(worksheet, rowIndex, value) {
        const descriptionColumn = findExcelHeaderColumn(worksheet, rowIndex, 'DESKRIPSI', 32);
        if (descriptionColumn === null) throw new Error(`Kolom deskripsi template tidak ditemukan pada baris ${rowIndex}.`);
        setExcelCellValue(worksheet.getCell(rowIndex, descriptionColumn), value || '');
    }

    function writeExcelClosing(worksheet, report) {
        const cityCell = findExcelCellByText(worksheet, 'Cicalengka');
        if (cityCell) setExcelCellValue(cityCell, `${report.schoolSnapshot?.kota || ''}${report.schoolSnapshot?.kota ? ',' : ''}`);

        const signatureAnchors = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            row.eachCell({ includeEmpty: false }, (cell) => {
                if (cell.isMerged && cell.master.address !== cell.address) return;
                if (normalizeExcelText(excelCellText(cell)) === 'classmaster') signatureAnchors.push(cell.master);
            });
        });
        signatureAnchors.sort((left, right) => left.row - right.row || left.col - right.col);
        const teacherName = report.schoolSnapshot?.nama_wali_kelas || '';
        const teacherNumber = report.schoolSnapshot?.nuptk_wali_kelas || '';
        signatureAnchors.forEach((anchor, index) => {
            const isPrincipalSlot = report.reportType === 'LPS' && signatureAnchors.length > 1 && index === 0;
            setExcelCellValue(anchor, isPrincipalSlot ? 'Kepala Sekolah' : 'Wali Kelas');
            setExcelCellValue(worksheet.getCell(anchor.row + 5, anchor.col), isPrincipalSlot ? '' : teacherName);
            setExcelCellValue(
                worksheet.getCell(anchor.row + 6, anchor.col),
                isPrincipalSlot ? 'NUPTK. -' : `NUPTK. ${teacherNumber || '-'}`
            );
        });

        const dateRow = report.reportType === 'BLP' ? 72 : 96;
        setExcelCellValue(worksheet.getCell(dateRow, 24), core.formatGregorianIndonesian(report.reportDate));
        setExcelCellValue(worksheet.getCell(dateRow + 1, 24), report.hijriDate || '');
    }

    function writeExcelReport(worksheet, report) {
        writeExcelIdentity(worksheet, report);
        const template = core.normalizeTemplate(
            report.templateSnapshot || {},
            report.schoolSnapshot || currentSettings(),
            report.periodId
        );
        (template.sections || []).forEach((section) => {
            (section.aspects || []).forEach((aspect) => {
                const response = report.responses?.[aspect.id] || {};
                const optionSignature = (aspect.options || [])
                    .map((option) => String(option).toLocaleUpperCase('id-ID'))
                    .join('|');
                const inputType = optionSignature === 'A|B|C|D'
                    ? 'select'
                    : ((aspect.options || []).length ? 'checklist' : 'text');
                const aspectCell = findExcelCellByText(worksheet, aspect.title);
                if (!aspectCell) {
                    throw new Error(`Aspek "${aspect.title}" tidak ditemukan pada template Excel.`);
                }
                if (inputType === 'select' && !(aspect.items || []).length) {
                    writeExcelDirectGrade(worksheet, aspectCell.row, response.overall || '');
                }
                if (inputType === 'text' && !(aspect.items || []).length) {
                    writeExcelDescription(worksheet, aspectCell.row, response.description || response.overall || '');
                } else {
                    const description = String(
                        response.description || ''
                    ).trim();
                    writeExcelDescription(worksheet, aspect.detailLabel ? aspectCell.row + 2 : aspectCell.row, description);
                }
                const detail = String(response.detail || '').trim();
                if (aspect.detailLabel) setExcelCellValue(worksheet.getCell(aspectCell.row + 2, aspectCell.col), detail);
                (aspect.items || []).forEach((item) => {
                    const itemCell = findExcelCellByText(worksheet, item.label);
                    if (!itemCell) throw new Error(`Butir "${item.label}" tidak ditemukan pada template Excel.`);
                    const itemValue = response.items?.[item.id] || '';
                    if (inputType === 'text') {
                        writeExcelDescription(worksheet, itemCell.row, itemValue);
                    } else {
                        writeExcelResponseRow(worksheet, aspectCell.row, itemCell.row, aspect, itemValue);
                    }
                });
            });
        });
        const noteCell = findExcelCellByText(worksheet, 'Catatan:');
        if (noteCell) setExcelCellValue(worksheet.getCell(noteCell.row + 1, noteCell.col), report.teacherNote || '');
        const parentNoteCell = findExcelCellByText(worksheet, 'Catatan Orang tua');
        if (parentNoteCell) setExcelCellValue(worksheet.getCell(parentNoteCell.row + 1, parentNoteCell.col), report.parentNote || '');
        writeExcelClosing(worksheet, report);
    }

    function uniqueExcelSheetName(workbook, student, index) {
        const base = String(student['Nama Lengkap'] || `Siswa ${index + 1}`)
            .replace(/[\\/?*\[\]:]/g, '')
            .trim()
            .slice(0, 31) || `Siswa ${index + 1}`;
        let candidate = base;
        let suffix = 2;
        while (workbook.getWorksheet(candidate)) {
            const marker = ` ${suffix}`;
            candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
            suffix += 1;
        }
        return candidate;
    }

    function cloneExcelValue(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function excelLayoutFingerprint(worksheet) {
        const model = worksheet.model;
        const cellStyles = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (cell.isMerged && cell.master.address !== cell.address) return;
                if (cell.hasStyle) cellStyles.push([cell.address, cloneExcelValue(cell.style)]);
            });
        });
        return JSON.stringify({
            columns: (model.cols || []).map((column) => ({
                min: column.min,
                max: column.max,
                width: column.width,
                hidden: column.hidden || false,
                outlineLevel: column.outlineLevel || 0,
                style: column.style || null
            })),
            rows: (model.rows || []).map((row) => ({
                number: row.number,
                height: row.height,
                hidden: row.hidden || false,
                outlineLevel: row.outlineLevel || 0,
                style: row.style || null
            })),
            merges: [...(model.merges || [])].sort(),
            pageSetup: model.pageSetup || null,
            pageMargins: model.pageMargins || null,
            headerFooter: model.headerFooter || null,
            views: model.views || null,
            properties: model.properties || null,
            images: worksheet.getImages().map((image) => ({
                imageId: image.imageId,
                tl: image.range?.tl ? {
                    col: image.range.tl.col,
                    row: image.range.tl.row,
                    nativeCol: image.range.tl.nativeCol,
                    nativeRow: image.range.tl.nativeRow,
                    nativeColOff: image.range.tl.nativeColOff,
                    nativeRowOff: image.range.tl.nativeRowOff
                } : null,
                br: image.range?.br ? {
                    col: image.range.br.col,
                    row: image.range.br.row,
                    nativeCol: image.range.br.nativeCol,
                    nativeRow: image.range.br.nativeRow,
                    nativeColOff: image.range.br.nativeColOff,
                    nativeRowOff: image.range.br.nativeRowOff
                } : null,
                ext: image.range?.ext ? cloneExcelValue(image.range.ext) : null,
                editAs: image.range?.editAs || null
            })),
            cellStyles
        });
    }

    function duplicateExcelWorksheet(workbook, templateModel, sheetName) {
        const worksheet = workbook.addWorksheet(sheetName);
        const model = cloneExcelValue(templateModel);
        model.id = worksheet.id;
        model.name = sheetName;
        model.mergeCells = [...(model.merges || [])];
        worksheet.model = model;
        return worksheet;
    }

    async function exportExcelLPS() {
        if (runtime.busy.print) return false;
        runtime.busy.print = true;
        renderBusyState();
        showProgress('Menyiapkan workbook LPS/BLP...');
        try {
            if (!window.ExcelJS?.Workbook) throw new Error('Pustaka ExcelJS belum tersedia.');
            const period = currentPeriod();
            if (!period) throw new Error('Jenis laporan belum dipilih.');
            const group = byId('lps-filter-kelompok')?.value || 'Semua';
            const currentClass = String(window.state?.activeKelas || '').trim();
            const students = [...(window.state?.students || [])]
                .filter((student) => !currentClass || String(student.Kelas || '') === currentClass)
                .filter((student) => group === 'Semua' || student.Kelompok === group)
                .sort((left, right) => String(left['Nama Lengkap'] || '').localeCompare(String(right['Nama Lengkap'] || ''), 'id'));
            if (!students.length) throw new Error('Tidak ada siswa pada filter aktif.');
            const template = core.normalizeTemplate(
                getActiveTemplate(period.id) || core.createDefaultTemplate(currentSettings(), period.id),
                currentSettings(),
                period.id
            );
            const templateFilename = period.type === 'BLP' ? 'BLP contoh.xlsx' : 'LPS KLS 2 contoh.xlsx';
            const response = await fetch(`templates/${encodeURIComponent(templateFilename)}`);
            if (!response.ok) throw new Error('Template Excel LPS/BLP tidak dapat dimuat.');
            const workbook = new window.ExcelJS.Workbook();
            await workbook.xlsx.load(await response.arrayBuffer());
            const master = workbook.worksheets[0];
            if (!master) throw new Error('Sheet acuan LPS/BLP tidak tersedia.');
            const templateModel = cloneExcelValue(master.model);
            const templateFingerprint = excelLayoutFingerprint(master);
            workbook.worksheets.slice().forEach((worksheet) => workbook.removeWorksheet(worksheet.id));
            const currentReport = reportForOutput();
            students.forEach((student, index) => {
                const reportId = core.reportId(currentSettings(), period.id, student.NISN);
                let report = getSavedReport(reportId);
                if (currentReport?.reportId === reportId) report = currentReport;
                if (!report) report = makeDraftReport(student, template);
                const sheetName = uniqueExcelSheetName(workbook, student, index);
                const worksheet = duplicateExcelWorksheet(workbook, templateModel, sheetName);
                if (excelLayoutFingerprint(worksheet) !== templateFingerprint) {
                    throw new Error(`Duplikasi layout template tidak presisi pada sheet ${sheetName}.`);
                }
                writeExcelReport(worksheet, report);
                if (excelLayoutFingerprint(worksheet) !== templateFingerprint) {
                    throw new Error(`Layout template berubah saat mengisi sheet ${sheetName}.`);
                }
            });
            if (workbook.worksheets.length !== students.length) throw new Error('Jumlah sheet hasil tidak sama dengan jumlah siswa.');
            const data = await workbook.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
            const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${period.type}_${safeFilename(currentSettings().nama_kelas || 'SIMNI')}_${safeFilename(currentSettings().tahun_pelajaran || '')}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify(`Berhasil disimpan: workbook ${period.type} berisi ${students.length} sheet siswa.`, 'success');
            return true;
        } catch (error) {
            console.error('[SIMNI LPS] Ekspor Excel gagal:', error);
            notify(`Ekspor Excel gagal: ${error?.message || error}`, 'error');
            return false;
        } finally {
            runtime.busy.print = false;
            renderBusyState();
            hideProgress();
        }
    }

    function reportForOutput() {
        if (
            !runtime
                .currentReport
        ) {
            return null;
        }

        if (
            runtime
                .currentReport
                .status ===
                'final'
        ) {
            return core.deepClone(
                runtime.currentReport
            );
        }

        return collectReportFromForm();
    }

    async function renderOutputHTML(
        report
    ) {
        if (
            !report
        ) {
            throw new Error(
                'Laporan tidak tersedia.'
            );
        }

        if (
            report.status ===
            'final'
        ) {
            if (
                runtime
                    .currentFinalIntegrity ===
                false
            ) {
                throw new Error(
                    'Integritas laporan final gagal. Output diblokir.'
                );
            }

            if (
                typeof printEngine
                    .renderVerifiedReport !==
                'function'
            ) {
                throw new Error(
                    'Renderer laporan final terverifikasi belum tersedia.'
                );
            }

            return printEngine
                .renderVerifiedReport(
                    report
                );
        }

        return printEngine
            .renderReport(
                report
            );
    }

    async function previewLPS() {
        if (
            runtime
                .busy
                .preview
        ) {
            return false;
        }

        runtime.busy.preview =
            true;

        try {
            const report =
                reportForOutput();

            if (!report) {
                notify(
                    'Pilih siswa dan jenis laporan terlebih dahulu.',
                    'warning'
                );

                return false;
            }

            const content =
                byId(
                    'lps-preview-content'
                );

            const modal =
                byId(
                    'lps-preview-modal'
                );

            if (
                !content ||
                !modal
            ) {
                throw new Error(
                    'Area Preview A4 tidak tersedia.'
                );
            }

            showProgress(
                report.status ===
                    'final'
                    ? 'Memverifikasi dan menyiapkan preview final...'
                    : 'Menyiapkan preview draft...'
            );

            const html =
                await renderOutputHTML(
                    report
                );

            content.innerHTML =
                html;

            modal.classList.add(
                'is-open'
            );

            modal.setAttribute(
                'aria-hidden',
                'false'
            );

            runtime.lastOperation = {
                type:
                    'preview',

                status:
                    'success',

                reportId:
                    report.reportId,

                reportStatus:
                    report.status,

                completedAt:
                    nowISO()
            };

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Preview gagal:',
                error
            );

            notify(
                `Preview gagal: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            runtime.busy.preview =
                false;

            hideProgress();
        }
    }

    function closeLPSPreview() {
        const modal =
            byId(
                'lps-preview-modal'
            );

        if (!modal) {
            return false;
        }

        modal.classList.remove(
            'is-open'
        );

        modal.setAttribute(
            'aria-hidden',
            'true'
        );

        return true;
    }

    function waitForPrintCompletion(
        timeoutMs =
            30000
    ) {
        return new Promise(
            (resolve) => {
                let settled =
                    false;

                let timer =
                    null;

                const finish =
                    () => {
                        if (
                            settled
                        ) {
                            return;
                        }

                        settled =
                            true;

                        if (timer) {
                            clearTimeout(
                                timer
                            );
                        }

                        window
                            .removeEventListener(
                                'afterprint',
                                finish
                            );

                        resolve();
                    };

                window
                    .addEventListener(
                        'afterprint',
                        finish,
                        {
                            once:
                                true
                        }
                    );

                timer =
                    window.setTimeout(
                        finish,
                        timeoutMs
                    );
            }
        );
    }

    async function cetakLPS() {
        if (
            runtime
                .busy
                .print
        ) {
            return false;
        }

        runtime.busy.print =
            true;

        let printArea =
            null;

        try {
            const report =
                reportForOutput();

            if (!report) {
                notify(
                    'Pilih siswa dan jenis laporan terlebih dahulu.',
                    'warning'
                );

                return false;
            }

            printArea =
                byId(
                    'print-area'
                );

            if (!printArea) {
                throw new Error(
                    'Area cetak tidak tersedia.'
                );
            }

            showProgress(
                report.status ===
                    'final'
                    ? 'Memverifikasi laporan final sebelum cetak...'
                    : 'Menyiapkan cetak draft...'
            );

            const html =
                await renderOutputHTML(
                    report
                );

            printArea.innerHTML =
                html;

            printArea
                .classList
                .remove(
                    'hidden'
                );

            document.body
                .classList
                .add(
                    'lps-printing'
                );

            closeLPSPreview();

            /*
             * Beri browser kesempatan melakukan layout A4
             * sebelum dialog print dibuka.
             */
            await new Promise(
                (resolve) => {
                    requestAnimationFrame(
                        () => {
                            requestAnimationFrame(
                                resolve
                            );
                        }
                    );
                }
            );

            hideProgress();

            const completion =
                waitForPrintCompletion();

            window.print();

            await completion;

            runtime.lastOperation = {
                type:
                    'print',

                status:
                    'success',

                reportId:
                    report.reportId,

                reportStatus:
                    report.status,

                integrityVerified:
                    report.status ===
                        'final'
                        ? true
                        : false,

                completedAt:
                    nowISO()
            };

            return true;
        } catch (error) {
            console.error(
                '[SIMNI LPS] Cetak gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'print',

                status:
                    'failed',

                completedAt:
                    nowISO(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            notify(
                `Cetak/PDF gagal: ${
                    error?.message ||
                    error
                }`,
                'error'
            );

            return false;
        } finally {
            document.body
                .classList
                .remove(
                    'lps-printing'
                );

            if (printArea) {
                printArea
                    .classList
                    .add(
                        'hidden'
                    );

                printArea
                    .replaceChildren();
            }

            runtime.busy.print =
                false;

            hideProgress();
        }
    }

    function numericDataset(
        element,
        name
    ) {
        const value =
            Number(
                element
                    ?.dataset
                    ?.[
                        name
                    ]
            );

        return Number
            .isInteger(
                value
            )
                ? value
                : null;
    }

    async function handleLPSAction(
        button
    ) {
        const action =
            button
                ?.dataset
                ?.lpsAction;

        if (!action) {
            return;
        }

        try {
            assertLPSAccess();
        } catch (error) {
            notify(
                error.message,
                'error'
            );

            return;
        }

        const sectionIndex =
            numericDataset(
                button,
                'sectionIndex'
            );

        const aspectIndex =
            numericDataset(
                button,
                'aspectIndex'
            );

        const direction =
            numericDataset(
                button,
                'direction'
            );

        switch (action) {
            case 'open-template-builder':
                await openModalPengaturanLPS();
                break;

            case 'close-template-builder':
                window.closeModal?.(
                    'modal-pengaturan-lps'
                );
                break;

            case 'preview':
                await previewLPS();
                break;

            case 'print':
                await cetakLPS();
                break;

            case 'close-preview':
                closeLPSPreview();
                break;

            case 'use-latest-template':
                gunakanTemplateLPSAktif();
                break;

            case 'save-draft':
                await saveLPSData();
                break;

            case 'finalize':
                await finalisasiLPS();
                break;

            case 'open-revision':
                await bukaRevisiLPS();
                break;

            case 'copy-template':
                salinTemplateLPS();
                break;

            case 'reset-template-reference':
                resetTemplateLPSKeAcuan();
                break;

            case 'add-builder-section':
                addLPSBuilderSection();
                break;

            case 'move-builder-section':
                if (
                    sectionIndex !==
                        null &&
                    direction !==
                        null
                ) {
                    moveLPSBuilderSection(
                        sectionIndex,
                        direction
                    );
                }

                break;

            case 'remove-builder-section':
                if (
                    sectionIndex !==
                    null
                ) {
                    removeLPSBuilderSection(
                        sectionIndex
                    );
                }

                break;

            case 'add-builder-aspect':
                if (
                    sectionIndex !==
                    null
                ) {
                    addLPSBuilderCategory(
                        sectionIndex
                    );
                }

                break;

            case 'move-builder-aspect':
                if (
                    sectionIndex !==
                        null &&
                    aspectIndex !==
                        null &&
                    direction !==
                        null
                ) {
                    moveLPSBuilderAspect(
                        sectionIndex,
                        aspectIndex,
                        direction
                    );
                }

                break;

            case 'remove-builder-aspect':
                if (
                    sectionIndex !==
                        null &&
                    aspectIndex !==
                        null
                ) {
                    removeLPSBuilderCategory(
                        sectionIndex,
                        aspectIndex
                    );
                }

                break;

            default:
                console.warn(
                    '[SIMNI LPS] Action tidak dikenal:',
                    action
                );
        }
    }

    function bindLPSDOMEvents() {
        if (
            runtime.eventsBound
        ) {
            return;
        }

        runtime.eventsBound =
            true;

        document
            .addEventListener(
                'click',
                (event) => {
                    const button =
                        event
                            .target
                            ?.closest?.(
                                '[data-lps-action]'
                            );

                    if (!button) {
                        return;
                    }

                    event.preventDefault();

                    void handleLPSAction(
                        button
                    );
                }
            );

        document
            .addEventListener(
                'change',
                (event) => {
                    const target =
                        event.target;

                    const action =
                        target
                            ?.dataset
                            ?.lpsChange;

                    if (!action) {
                        return;
                    }

                    try {
                        assertLPSAccess();
                    } catch (_) {
                        return;
                    }

                    switch (action) {
                        case 'filter-group':
                            void populateLPSFilter();
                            break;

                        case 'student':
                        case 'period':
                            void loadSiswaLPS();
                            break;

                        case 'report-date':
                        case 'hijri-offset':
                            updateLPSHijriDate();
                            break;

                        default:
                            break;
                    }
                }
            );

        document
            .addEventListener(
                'submit',
                (event) => {
                    if (
                        event.target
                            ?.id ===
                        'lps-main-form'
                    ) {
                        event.preventDefault();
                        return;
                    }

                    if (
                        event.target
                            ?.id ===
                        'lps-builder-form'
                    ) {
                        event.preventDefault();

                        void simpanPengaturanLPS(
                            event
                        );
                    }
                }
            );

        document
            .addEventListener(
                'keydown',
                (event) => {
                    if (
                        event.key !==
                        'Escape'
                    ) {
                        return;
                    }

                    const preview =
                        byId(
                            'lps-preview-modal'
                        );

                    if (
                        preview
                            ?.classList
                            .contains(
                                'is-open'
                            )
                    ) {
                        closeLPSPreview();

                        return;
                    }

                    const builder =
                        byId(
                            'modal-pengaturan-lps'
                        );

                    if (
                        builder &&
                        !builder
                            .classList
                            .contains(
                                'hidden'
                            )
                    ) {
                        window.closeModal?.(
                            'modal-pengaturan-lps'
                        );
                    }
                }
            );
    }

    function guardLPS(
        fn
    ) {
        return function guardedLPSAction(
            ...args
        ) {
            try {
                assertLPSAccess();
            } catch (error) {
                notify(
                    error.message,
                    'error'
                );

                return undefined;
            }

            return fn(
                ...args
            );
        };
    }

    function getRuntimeSnapshot() {
        return {
            installed:
                runtime.installed,

            currentTemplate:
                runtime.currentTemplate
                    ? {
                        templateId:
                            runtime
                                .currentTemplate
                                .templateId,

                        templateVersion:
                            runtime
                                .currentTemplate
                                .templateVersion,

                        periodId:
                            runtime
                                .currentTemplate
                                .periodId
                    }
                    : null,

            currentReport:
                runtime.currentReport
                    ? {
                        reportId:
                            runtime
                                .currentReport
                                .reportId,

                        status:
                            runtime
                                .currentReport
                                .status,

                        revision:
                            runtime
                                .currentReport
                                .revision,

                        hash:
                            runtime
                                .currentReport
                                .hash ||
                            null
                    }
                    : null,

            currentFinalIntegrity:
                runtime
                    .currentFinalIntegrity,

            builderSourceTemplateId:
                runtime
                    .builderSourceTemplateId,

            localTemplateCount:
                runtime
                    .localTemplates
                    .size,

            localReportCount:
                runtime
                    .localReports
                    .size,

            busy: {
                ...runtime.busy
            },

            lastOperation:
                runtime.lastOperation
                    ? {
                        ...runtime
                            .lastOperation
                    }
                    : null
        };
    }

    async function renderCurrentReportHTML() {
        assertLPSAccess();

        await ensureFeatureInstalled();

        const report =
            reportForOutput();

        if (!report) {
            return '';
        }

        return renderOutputHTML(
            report
        );
    }

    /*
     * Compatibility globals.
     *
     * lps.html runtime tidak lagi bergantung inline-handler karena
     * seluruh atribut on* dihapus ketika fragment dimount.
     * Global API tetap dipertahankan untuk consumer lama.
     */
    Object.assign(
        window,
        {
            populateLPSFilter:
                guardLPS(
                    populateLPSFilter
                ),

            loadSiswaLPS:
                guardLPS(
                    loadSiswaLPS
                ),

            renderLPSFormDynamic:
                guardLPS(
                    renderReportForm
                ),

            updateLPSHijriDate:
                guardLPS(
                    updateLPSHijriDate
                ),

            saveLPSData:
                guardLPS(
                    saveLPSData
                ),

            finalisasiLPS:
                guardLPS(
                    finalisasiLPS
                ),

            bukaRevisiLPS:
                guardLPS(
                    bukaRevisiLPS
                ),

            gunakanTemplateLPSAktif:
                guardLPS(
                    gunakanTemplateLPSAktif
                ),

            openModalPengaturanLPS:
                guardLPS(
                    openModalPengaturanLPS
                ),

            addLPSBuilderSection:
                guardLPS(
                    addLPSBuilderSection
                ),

            removeLPSBuilderSection:
                guardLPS(
                    removeLPSBuilderSection
                ),

            moveLPSBuilderSection:
                guardLPS(
                    moveLPSBuilderSection
                ),

            addLPSBuilderCategory:
                guardLPS(
                    addLPSBuilderCategory
                ),

            removeLPSBuilderCategory:
                guardLPS(
                    removeLPSBuilderCategory
                ),

            moveLPSBuilderAspect:
                guardLPS(
                    moveLPSBuilderAspect
                ),

            salinTemplateLPS:
                guardLPS(
                    salinTemplateLPS
                ),

            resetTemplateLPSKeAcuan:
                guardLPS(
                    resetTemplateLPSKeAcuan
                ),

            simpanPengaturanLPS:
                guardLPS(
                    simpanPengaturanLPS
                ),

            previewLPS:
                guardLPS(
                    previewLPS
                ),

            closeLPSPreview:
                guardLPS(
                    closeLPSPreview
                ),

            cetakLPS:
                guardLPS(
                    cetakLPS
                ),

            exportExcelLPS:
                guardLPS(
                    exportExcelLPS
                )
        }
    );

    /*
     * Tidak memuat lps.html saat script startup.
     * Mount baru terjadi ketika consumer authorized memanggil
     * populate/load/open atau ensureReady().
     */
    window.SIMNILPSReady =
        Promise.resolve(
            false
        );

    window.SIMNILPS =
        Object.freeze({
            ensureReady:
                ensureFeatureInstalled,

            unmount:
                unmountFeatureMarkup,

            get ready() {
                return runtime.installed
                    ? Promise.resolve(
                        true
                    )
                    : ensureFeatureInstalled();
            },

            getRuntimeSnapshot,

            renderCurrentReportHTML
        });
}());
