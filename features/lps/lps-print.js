// ==========================================
// FILE: features/lps/lps-print.js
// FUNGSI:
// Renderer deterministik Preview / Print LPS-BLP.
// Menggunakan immutable templateSnapshot milik report.
// ==========================================

(function initSIMNILPSPrint(
    root,
    factory
) {
    const api =
        factory(
            root.SIMNILPSCore
        );

    if (
        typeof module ===
            'object' &&
        module.exports
    ) {
        module.exports =
            api;
    }

    root.SIMNILPSPrint =
        api;
}(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : this,

    function createSIMNILPSPrint(
        core
    ) {
        'use strict';

        const MAX_RENDER_SECTIONS =
            26;

        const MAX_RENDER_ASPECTS =
            64;

        const MAX_RENDER_ITEMS =
            256;

        function requireCore() {
            if (
                !core ||
                typeof core !==
                    'object'
            ) {
                throw new Error(
                    'SIMNI LPS Core belum tersedia.'
                );
            }

            const requiredFunctions = [
                'getPeriod',
                'formatGregorianIndonesian',
                'validateFinalReport',
                'validateReportIdentity'
            ];

            for (
                const functionName
                of requiredFunctions
            ) {
                if (
                    typeof core[
                        functionName
                    ] !==
                    'function'
                ) {
                    throw new Error(
                        `SIMNI LPS Core tidak menyediakan ${functionName}().`
                    );
                }
            }

            return core;
        }

        function isPlainObject(
            value
        ) {
            if (
                !value ||
                typeof value !==
                    'object' ||
                Array.isArray(
                    value
                )
            ) {
                return false;
            }

            const prototype =
                Object.getPrototypeOf(
                    value
                );

            return (
                prototype ===
                    Object.prototype ||
                prototype ===
                    null
            );
        }

        function text(
            value
        ) {
            return String(
                value ??
                ''
            );
        }

        function trimmed(
            value
        ) {
            return text(
                value
            ).trim();
        }

        function escapeHTML(
            value
        ) {
            return text(
                value
            )
                .replace(
                    /&/g,
                    '&amp;'
                )
                .replace(
                    /</g,
                    '&lt;'
                )
                .replace(
                    />/g,
                    '&gt;'
                )
                .replace(
                    /"/g,
                    '&quot;'
                )
                .replace(
                    /'/g,
                    '&#039;'
                );
        }

        function safeAttribute(
            value
        ) {
            return escapeHTML(
                trimmed(
                    value
                )
            );
        }

        function safeImageUrl(
            value
        ) {
            const raw =
                trimmed(
                    value
                );

            if (!raw) {
                return '';
            }

            /*
             * Hanya raster data URI.
             * SVG data URI sengaja tidak diizinkan.
             */
            if (
                /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i
                    .test(
                        raw
                    )
            ) {
                return escapeHTML(
                    raw
                );
            }

            try {
                const base =
                    typeof globalThis !==
                        'undefined' &&
                    globalThis.location
                        ?.href
                        ? globalThis
                            .location
                            .href
                        : 'https://simni.invalid/';

                const parsed =
                    new URL(
                        raw,
                        base
                    );

                if (
                    parsed.protocol !==
                    'https:'
                ) {
                    return '';
                }

                /*
                 * URL absolute HTTPS diperbolehkan.
                 * Relative same-origin juga akan ter-resolve menjadi HTTPS
                 * ketika PWA production berada pada HTTPS.
                 */
                return escapeHTML(
                    parsed.href
                );
            } catch (_) {
                return '';
            }
        }

        function normalizeStatus(
            value
        ) {
            const status =
                trimmed(
                    value
                ).toLowerCase();

            return status ===
                'final'
                ? 'final'
                : 'draft';
        }

        function getResponse(
            report,
            aspectId
        ) {
            const response =
                report
                    ?.responses
                    ?.[
                        aspectId
                    ];

            if (
                !isPlainObject(
                    response
                )
            ) {
                return {
                    overall:
                        '',

                    detail:
                        '',

                    description:
                        '',

                    items:
                        {}
                };
            }

            return {
                overall:
                    trimmed(
                        response
                            .overall
                    ),

                detail:
                    trimmed(
                        response
                            .detail
                    ),

                description:
                    trimmed(
                        response
                            .description
                    ),

                items:
                    isPlainObject(
                        response
                            .items
                    )
                        ? response
                            .items
                        : {}
            };
        }

        function checkmark(
            selected,
            option
        ) {
            return (
                trimmed(
                    selected
                ) ===
                trimmed(
                    option
                )
                    ? (
                        '<span '
                        + 'class="lps-check" '
                        + 'aria-label="dipilih">'
                        + '✓'
                        + '</span>'
                    )
                    : ''
            );
        }

        function alphaIndex(
            index
        ) {
            let number =
                Number(
                    index
                ) + 1;

            let output =
                '';

            while (
                number >
                0
            ) {
                number -=
                    1;

                output =
                    String
                        .fromCharCode(
                            97 +
                            (
                                number %
                                26
                            )
                        ) +
                    output;

                number =
                    Math.floor(
                        number /
                        26
                    );
            }

            return output ||
                'a';
        }

        function validateRenderableTemplate(
            template
        ) {
            if (
                !isPlainObject(
                    template
                )
            ) {
                throw new Error(
                    'Snapshot template laporan tidak tersedia.'
                );
            }

            if (
                !Array.isArray(
                    template.sections
                ) ||
                template
                    .sections
                    .length ===
                    0
            ) {
                throw new Error(
                    'Snapshot template tidak memiliki bagian laporan.'
                );
            }

            if (
                template
                    .sections
                    .length >
                MAX_RENDER_SECTIONS
            ) {
                throw new Error(
                    'Jumlah bagian template melebihi batas renderer.'
                );
            }

            const ids =
                new Set();

            template
                .sections
                .forEach(
                    (
                        section,
                        sectionIndex
                    ) => {
                        if (
                            !isPlainObject(
                                section
                            )
                        ) {
                            throw new Error(
                                `Bagian ${sectionIndex + 1} tidak valid.`
                            );
                        }

                        const sectionId =
                            trimmed(
                                section.id
                            );

                        if (!sectionId) {
                            throw new Error(
                                `Bagian ${sectionIndex + 1} tidak memiliki ID.`
                            );
                        }

                        if (
                            ids.has(
                                sectionId
                            )
                        ) {
                            throw new Error(
                                `ID template ganda: ${sectionId}.`
                            );
                        }

                        ids.add(
                            sectionId
                        );

                        if (
                            !trimmed(
                                section.title
                            )
                        ) {
                            throw new Error(
                                `Judul bagian ${sectionIndex + 1} kosong.`
                            );
                        }

                        if (
                            !Array.isArray(
                                section.aspects
                            ) ||
                            section
                                .aspects
                                .length ===
                                0
                        ) {
                            throw new Error(
                                `Bagian ${sectionIndex + 1} tidak memiliki aspek.`
                            );
                        }

                        if (
                            section
                                .aspects
                                .length >
                            MAX_RENDER_ASPECTS
                        ) {
                            throw new Error(
                                `Bagian ${sectionIndex + 1} memiliki terlalu banyak aspek.`
                            );
                        }

                        section
                            .aspects
                            .forEach(
                                (
                                    aspect,
                                    aspectIndex
                                ) => {
                                    if (
                                        !isPlainObject(
                                            aspect
                                        )
                                    ) {
                                        throw new Error(
                                            `Aspek ${sectionIndex + 1}.${aspectIndex + 1} tidak valid.`
                                        );
                                    }

                                    const aspectId =
                                        trimmed(
                                            aspect.id
                                        );

                                    if (!aspectId) {
                                        throw new Error(
                                            `Aspek ${sectionIndex + 1}.${aspectIndex + 1} tidak memiliki ID.`
                                        );
                                    }

                                    if (
                                        ids.has(
                                            aspectId
                                        )
                                    ) {
                                        throw new Error(
                                            `ID template ganda: ${aspectId}.`
                                        );
                                    }

                                    ids.add(
                                        aspectId
                                    );

                                    if (
                                        !trimmed(
                                            aspect.title
                                        )
                                    ) {
                                        throw new Error(
                                            `Judul aspek ${sectionIndex + 1}.${aspectIndex + 1} kosong.`
                                        );
                                    }

                                    const items =
                                        Array.isArray(
                                            aspect.items
                                        )
                                            ? aspect
                                                .items
                                            : [];

                                    if (
                                        items.length >
                                        MAX_RENDER_ITEMS
                                    ) {
                                        throw new Error(
                                            `Aspek "${trimmed(aspect.title)}" memiliki terlalu banyak butir.`
                                        );
                                    }

                                    items.forEach(
                                        (
                                            item,
                                            itemIndex
                                        ) => {
                                            if (
                                                !isPlainObject(
                                                    item
                                                )
                                            ) {
                                                throw new Error(
                                                    `Butir ${itemIndex + 1} pada "${trimmed(aspect.title)}" tidak valid.`
                                                );
                                            }

                                            const itemId =
                                                trimmed(
                                                    item.id
                                                );

                                            if (!itemId) {
                                                throw new Error(
                                                    `Butir ${itemIndex + 1} pada "${trimmed(aspect.title)}" tidak memiliki ID.`
                                                );
                                            }

                                            if (
                                                ids.has(
                                                    itemId
                                                )
                                            ) {
                                                throw new Error(
                                                    `ID template ganda: ${itemId}.`
                                                );
                                            }

                                            ids.add(
                                                itemId
                                            );

                                            if (
                                                !trimmed(
                                                    item.label
                                                )
                                            ) {
                                                throw new Error(
                                                    `Label butir pada "${trimmed(aspect.title)}" kosong.`
                                                );
                                            }
                                        }
                                    );
                                }
                            );
                    }
                );

            return true;
        }

        function validateRenderableReport(
            report,
            {
                requireFinalValidity =
                    true
            } = {}
        ) {
            requireCore();

            if (
                !isPlainObject(
                    report
                )
            ) {
                throw new Error(
                    'Data laporan tidak valid.'
                );
            }

            const identityErrors =
                core
                    .validateReportIdentity(
                        report
                    );

            if (
                identityErrors
                    .length
            ) {
                throw new Error(
                    identityErrors[0]
                );
            }

            const period =
                core.getPeriod(
                    report.periodId
                );

            if (!period) {
                throw new Error(
                    'Periode laporan tidak dikenal.'
                );
            }

            const template =
                report
                    .templateSnapshot;

            validateRenderableTemplate(
                template
            );

            if (
                template
                    .templateId !==
                report.templateId
            ) {
                throw new Error(
                    'Template snapshot tidak cocok dengan ID template laporan.'
                );
            }

            if (
                Number(
                    template
                        .templateVersion
                ) !==
                Number(
                    report
                        .templateVersion
                )
            ) {
                throw new Error(
                    'Versi template snapshot tidak cocok dengan laporan.'
                );
            }

            if (
                template
                    .periodId !==
                report.periodId
            ) {
                throw new Error(
                    'Periode template snapshot tidak cocok dengan laporan.'
                );
            }

            if (
                template
                    .reportType !==
                period.type
            ) {
                throw new Error(
                    'Jenis template snapshot tidak cocok dengan periode laporan.'
                );
            }

            if (
                report.reportType &&
                report.reportType !==
                    period.type
            ) {
                throw new Error(
                    'Jenis laporan tidak cocok dengan periode.'
                );
            }

            if (
                Number(
                    report.semester
                ) !==
                Number(
                    period.semester
                )
            ) {
                throw new Error(
                    'Semester laporan tidak cocok dengan periode.'
                );
            }

            if (
                report.term &&
                report.term !==
                    period.term
            ) {
                throw new Error(
                    'Term laporan tidak cocok dengan periode.'
                );
            }

            if (
                !trimmed(
                    report
                        .studentSnapshot
                        ?.name
                )
            ) {
                throw new Error(
                    'Nama siswa pada snapshot laporan tidak tersedia.'
                );
            }

            if (
                normalizeStatus(
                    report.status
                ) ===
                    'final' &&
                requireFinalValidity
            ) {
                const errors =
                    core
                        .validateFinalReport(
                            report
                        );

                if (
                    errors.length
                ) {
                    throw new Error(
                        `Laporan final tidak valid: ${errors[0]}`
                    );
                }
            }

            return {
                period,
                template,
                status:
                    normalizeStatus(
                        report.status
                    )
            };
        }

        function renderCriteriaTable(
            aspect,
            response
        ) {
            const options =
                Array.isArray(
                    aspect.options
                )
                    ? aspect.options
                        .map(
                            trimmed
                        )
                        .filter(
                            Boolean
                        )
                    : [];

            const items =
                Array.isArray(
                    aspect.items
                )
                    ? aspect
                        .items
                    : [];

            if (
                options.length ===
                    0 &&
                items.length ===
                    0
            ) {
                return '';
            }

            if (
                items.length ===
                0
            ) {
                const columnCount =
                    Math.max(
                        1,
                        options.length
                    );

                return `
                    <table class="lps-inner-table lps-overall-table">
                        <thead>
                            <tr>
                                <th colspan="${columnCount}">
                                    Hasil Pengamatan
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                ${options
                                    .map(
                                        (
                                            option
                                        ) =>
                                            `<th>${escapeHTML(option)}</th>`
                                    )
                                    .join('')}
                            </tr>
                            <tr>
                                ${options
                                    .map(
                                        (
                                            option
                                        ) =>
                                            `<td>${checkmark(response.overall, option)}</td>`
                                    )
                                    .join('')}
                            </tr>
                        </tbody>
                    </table>
                `;
            }

            return `
                <table class="lps-inner-table">
                    ${
                        options.length
                            ? `
                                <thead>
                                    <tr>
                                        <th class="lps-item-heading">
                                            Butir Penilaian
                                        </th>
                                        ${options
                                            .map(
                                                (
                                                    option
                                                ) =>
                                                    `<th>${escapeHTML(option)}</th>`
                                            )
                                            .join('')}
                                    </tr>
                                </thead>
                            `
                            : ''
                    }

                    <tbody>
                        ${items
                            .map(
                                (
                                    item,
                                    itemIndex
                                ) => {
                                    const selected =
                                        trimmed(
                                            response
                                                .items
                                                ?.[
                                                    item.id
                                                ]
                                        );

                                    return `
                                        <tr>
                                            <td class="lps-item-label">
                                                <span>${escapeHTML(alphaIndex(itemIndex))})</span>
                                                ${escapeHTML(item.label)}
                                            </td>

                                            ${options
                                                .map(
                                                    (
                                                        option
                                                    ) =>
                                                        `<td>${checkmark(selected, option)}</td>`
                                                )
                                                .join('')}
                                        </tr>
                                    `;
                                }
                            )
                            .join('')}
                    </tbody>
                </table>
            `;
        }

        function renderAspect(
            aspect,
            number,
            report
        ) {
            const response =
                getResponse(
                    report,
                    aspect.id
                );

            const detail =
                response.detail
                    ? `
                        <div class="lps-aspect-detail">
                            ${
                                aspect
                                    .detailLabel
                                    ? (
                                        `<strong>${escapeHTML(aspect.detailLabel)}:</strong> `
                                    )
                                    : ''
                            }
                            ${escapeHTML(response.detail)}
                        </div>
                    `
                    : '';

            const criteria =
                renderCriteriaTable(
                    aspect,
                    response
                );

            const description =
                aspect
                    .descriptionEnabled ===
                    false
                    ? ''
                    : `
                        <div class="lps-description-text">
                            ${escapeHTML(response.description || '-')}
                        </div>
                    `;

            return `
                <tr class="lps-print-aspect">
                    <td class="lps-number-cell">
                        ${Number(number)}
                    </td>

                    <td class="lps-evaluation-cell">
                        <div class="lps-aspect-title">
                            ${escapeHTML(aspect.title)}
                        </div>

                        ${detail}
                        ${criteria}
                    </td>

                    <td class="lps-description-cell">
                        ${description}
                    </td>
                </tr>
            `;
        }

        function renderSection(
            section,
            sectionIndex,
            report
        ) {
            const template =
                report
                    .templateSnapshot;

            const forcePage =
                template
                    .reportType ===
                    'LPS' &&
                sectionIndex >
                    0
                    ? ' lps-force-page'
                    : '';

            const code =
                trimmed(
                    section.code
                ) ||
                String.fromCharCode(
                    65 +
                    sectionIndex
                );

            return `
                <section class="lps-print-section${forcePage}">
                    <h2 class="lps-section-title">
                        ${escapeHTML(code)}. ${escapeHTML(section.title)}
                    </h2>

                    <table class="lps-report-table">
                        <thead>
                            <tr>
                                <th class="lps-number-heading" rowspan="2">
                                    NO
                                </th>

                                <th>
                                    ASPEK PENILAIAN / KRITERIA
                                </th>

                                <th>
                                    DESKRIPSI DAN REKOMENDASI
                                </th>
                            </tr>

                            <tr>
                                <th>
                                    Kompetensi Dasar (KD) - Indikator
                                </th>

                                <th>
                                    NILAI / HASIL OBSERVASI
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            ${section
                                .aspects
                                .map(
                                    (
                                        aspect,
                                        aspectIndex
                                    ) =>
                                        renderAspect(
                                            aspect,
                                            aspectIndex + 1,
                                            report
                                        )
                                )
                                .join('')}
                        </tbody>
                    </table>
                </section>
            `;
        }

        function renderHeader(
            report,
            period
        ) {
            const school =
                isPlainObject(
                    report
                        .schoolSnapshot
                )
                    ? report
                        .schoolSnapshot
                    : {};

            const logo =
                safeImageUrl(
                    school.logo_url
                );

            const reportType =
                period
                    ?.type ||
                report.reportType;

            const subtitle =
                reportType ===
                    'BLP'
                    ? (
                        "Hasil Observasi Baca Tulis Al-Qur'an, "
                        + 'Prestasi Hafalan, Pembiasaan dan Praktek Ibadah'
                    )
                    : (
                        'Hasil Observasi Pembiasaan, Hafalan dan '
                        + 'Prestasi Akademik Tengah Semester - '
                        + text(
                            period
                                ?.semester ||
                            report.semester
                        )
                    );

            return `
                <header class="lps-letterhead">
                    <div class="lps-logo-box${logo ? '' : ' is-empty'}">
                        ${
                            logo
                                ? (
                                    `<img src="${logo}" alt="Logo sekolah">`
                                )
                                : ''
                        }
                    </div>

                    <div class="lps-school-copy">
                        <p>
                            ${escapeHTML(school.nama_yayasan)}
                        </p>

                        <p>
                            ${escapeHTML(school.jenjang_sekolah)}
                        </p>

                        <h1>
                            ${escapeHTML(school.nama_sekolah)}
                        </h1>

                        <strong>
                            ${escapeHTML(school.status_akreditasi)}
                        </strong>

                        <em>
                            ${escapeHTML(school.nomor_izin)}
                        </em>
                    </div>
                </header>

                <div class="lps-report-heading">
                    <h1>
                        LAPORAN PERKEMBANGAN SISWA
                    </h1>

                    <p>
                        ${escapeHTML(subtitle)}
                    </p>

                    <p>
                        Tahun Pelajaran
                        ${escapeHTML(report.academicYearLabel)}
                    </p>

                    <span class="lps-period-caption">
                        ${escapeHTML(period?.label || report.periodId)}
                    </span>
                </div>
            `;
        }

        function renderStudentIdentity(
            report,
            period
        ) {
            const student =
                isPlainObject(
                    report
                        .studentSnapshot
                )
                    ? report
                        .studentSnapshot
                    : {};

            const semester =
                period
                    ?.semester ||
                report.semester;

            const term =
                period
                    ?.term ||
                report.term;

            return `
                <table class="lps-student-identity">
                    <tbody>
                        <tr>
                            <td>
                                Nama Siswa
                            </td>

                            <td>:</td>

                            <td>
                                <strong>
                                    ${escapeHTML(student.name)}
                                </strong>
                            </td>

                            <td>
                                Kelas
                            </td>

                            <td>:</td>

                            <td>
                                <strong>
                                    ${escapeHTML(report.classLabel)}
                                </strong>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                No. Induk / NISN
                            </td>

                            <td>:</td>

                            <td>
                                ${escapeHTML(student.studentId)}
                            </td>

                            <td>
                                Semester
                            </td>

                            <td>:</td>

                            <td>
                                <strong>
                                    ${escapeHTML(semester)}
                                    (
                                        ${escapeHTML(
                                            term ===
                                                'ganjil'
                                                ? 'Ganjil'
                                                : 'Genap'
                                        )}
                                    )
                                </strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
        }

        function renderDate(
            report
        ) {
            const city =
                trimmed(
                    report
                        .schoolSnapshot
                        ?.kota
                );

            const masehi =
                core
                    ?.formatGregorianIndonesian(
                        report.reportDate
                    ) ||
                trimmed(
                    report.reportDate
                );

            return `
                <div class="lps-date-block">
                    <span>
                        ${escapeHTML(city)}${city ? ',' : ''}
                    </span>

                    <span class="lps-date-lines">
                        <strong>
                            ${escapeHTML(masehi)}
                        </strong>

                        <em>
                            ${escapeHTML(report.hijriDate)}
                        </em>
                    </span>
                </div>
            `;
        }

        function renderTeacherSignature(
            report
        ) {
            const school =
                isPlainObject(
                    report
                        .schoolSnapshot
                )
                    ? report
                        .schoolSnapshot
                    : {};

            return `
                <div class="lps-signature-card">
                    <p>
                        Wali Kelas
                    </p>

                    <div class="lps-signature-space"></div>

                    <strong>
                        ${escapeHTML(
                            school
                                .nama_wali_kelas ||
                            'Belum diatur'
                        )}
                    </strong>

                    <span>
                        NUPTK.
                        ${escapeHTML(
                            school
                                .nuptk_wali_kelas ||
                            '-'
                        )}
                    </span>
                </div>
            `;
        }

        function renderParentSignature() {
            return `
                <div class="lps-signature-card">
                    <p>
                        Orang Tua / Wali
                    </p>

                    <div class="lps-signature-space"></div>

                    <span>
                        ( ______________________________ )
                    </span>
                </div>
            `;
        }

        function renderClosing(
            report,
            period
        ) {
            if (
                period
                    ?.type ===
                    'BLP' ||
                report.reportType ===
                    'BLP'
            ) {
                return `
                    <section class="lps-closing lps-blp-closing">
                        ${renderDate(report)}

                        <div class="lps-notes-signatures">
                            <div class="lps-note-box">
                                <strong>
                                    Catatan Wali Kelas:
                                </strong>

                                <p>
                                    ${escapeHTML(report.teacherNote || '-')}
                                </p>
                            </div>

                            ${renderTeacherSignature(report)}

                            <div class="lps-note-box">
                                <strong>Catatan Wali Kelas Kedua:</strong>
                                <p>${escapeHTML(report.teacherNoteSecondary || '')}</p>
                            </div>
                            ${renderTeacherSignature(report)}

                            <div class="lps-note-box">
                                <strong>
                                    Catatan Orang Tua:
                                </strong>

                                <p>
                                    ${escapeHTML(report.parentNote || '')}
                                </p>
                            </div>

                            ${renderParentSignature()}
                        </div>
                    </section>
                `;
            }

            return `
                <section class="lps-closing">
                    ${renderDate(report)}

                    <div class="lps-single-signature">
                        ${renderTeacherSignature(report)}
                    </div>
                </section>
            `;
        }

        function renderFooter(
            report,
            {
                integrityVerified =
                    false
            } = {}
        ) {
            const status =
                normalizeStatus(
                    report.status
                );

            const revision =
                Math.max(
                    1,
                    Math.trunc(
                        Number(
                            report.revision
                        ) ||
                        1
                    )
                );

            let integrityLabel;

            if (
                status !==
                'final'
            ) {
                integrityLabel =
                    'DRAFT';
            } else if (
                integrityVerified
            ) {
                integrityLabel =
                    `FINAL-VERIFIED · ${trimmed(report.hash).slice(0, 16)}`;
            } else {
                integrityLabel =
                    `FINAL-UNVERIFIED · ${
                        trimmed(
                            report.hash
                        )
                            ? trimmed(
                                report.hash
                            ).slice(
                                0,
                                16
                            )
                            : 'hash-tidak-tersedia'
                    }`;
            }

            return `
                <footer class="lps-document-footer">
                    <span>
                        ID:
                        ${escapeHTML(report.reportId)}
                    </span>

                    <span>
                        Revisi
                        ${escapeHTML(revision)}
                        ·
                        ${escapeHTML(integrityLabel)}
                    </span>
                </footer>
            `;
        }

        function renderReportInternal(
            report,
            options =
                {},
            {
                integrityVerified =
                    false
            } = {}
        ) {
            const validation =
                validateRenderableReport(
                    report,
                    {
                        requireFinalValidity:
                            true
                    }
                );

            const period =
                validation.period;

            const isDraft =
                validation.status !==
                'final';

            const articleClasses =
                [
                    'lps-print-document',

                    isDraft
                        ? 'is-draft'
                        : 'is-final',

                    integrityVerified
                        ? 'is-integrity-verified'
                        : ''
                ]
                    .filter(
                        Boolean
                    )
                    .join(' ');

            return `
                <article
                    class="${articleClasses}"
                    data-report-id="${safeAttribute(report.reportId)}"
                    data-report-status="${safeAttribute(validation.status)}"
                    data-report-integrity="${
                        integrityVerified
                            ? 'verified'
                            : (
                                isDraft
                                    ? 'draft'
                                    : 'unverified'
                            )
                    }"
                >
                    ${
                        isDraft
                            ? (
                                '<div class="lps-draft-watermark">'
                                + 'DRAFT'
                                + '</div>'
                            )
                            : ''
                    }

                    ${renderHeader(
                        report,
                        period
                    )}

                    ${renderStudentIdentity(
                        report,
                        period
                    )}

                    ${report
                        .templateSnapshot
                        .sections
                        .map(
                            (
                                section,
                                index
                            ) =>
                                renderSection(
                                    section,
                                    index,
                                    report
                                )
                        )
                        .join('')}

                    ${renderClosing(
                        report,
                        period
                    )}

                    ${
                        options
                            ?.hideFooter
                            ? ''
                            : renderFooter(
                                report,
                                {
                                    integrityVerified
                                }
                            )
                    }
                </article>
            `;
        }

        /*
         * Compatibility renderer.
         *
         * Draft:
         * - valid untuk preview/print.
         *
         * Final:
         * - structural/final validation dilakukan,
         * - tetapi SHA-256 tidak dapat diverifikasi secara sinkron.
         *
         * Consumer final production harus menggunakan
         * renderVerifiedReport().
         */
        function renderReport(
            report,
            options =
                {}
        ) {
            return renderReportInternal(
                report,
                options,
                {
                    integrityVerified:
                        false
                }
            );
        }

        async function renderVerifiedReport(
            report,
            options =
                {}
        ) {
            const validation =
                validateRenderableReport(
                    report,
                    {
                        requireFinalValidity:
                            true
                    }
                );

            if (
                validation.status !==
                'final'
            ) {
                /*
                 * Draft memang belum memiliki immutable hash.
                 */
                return renderReportInternal(
                    report,
                    options,
                    {
                        integrityVerified:
                            false
                    }
                );
            }

            if (
                typeof core
                    .verifyReportHash !==
                    'function'
            ) {
                throw new Error(
                    'SIMNI LPS Core tidak menyediakan verifier SHA-256 laporan.'
                );
            }

            const verification =
                await core
                    .verifyReportHash(
                        report
                    );

            if (
                !verification?.ok
            ) {
                throw new Error(
                    'Integritas laporan final gagal diverifikasi. Preview/print final diblokir.'
                );
            }

            return renderReportInternal(
                report,
                options,
                {
                    integrityVerified:
                        true
                }
            );
        }

        async function verifyPrintableReport(
            report
        ) {
            const validation =
                validateRenderableReport(
                    report,
                    {
                        requireFinalValidity:
                            true
                    }
                );

            if (
                validation.status !==
                'final'
            ) {
                return {
                    ok:
                        true,

                    status:
                        'draft',

                    hashVerified:
                        false
                };
            }

            if (
                typeof core
                    .verifyReportHash !==
                    'function'
            ) {
                return {
                    ok:
                        false,

                    status:
                        'final',

                    hashVerified:
                        false,

                    reason:
                        'hash-verifier-unavailable'
                };
            }

            const verification =
                await core
                    .verifyReportHash(
                        report
                    );

            return {
                ok:
                    verification
                        ?.ok ===
                    true,

                status:
                    'final',

                hashVerified:
                    verification
                        ?.ok ===
                    true,

                expected:
                    verification
                        ?.expected ||
                    null,

                actual:
                    verification
                        ?.actual ||
                    null,

                reason:
                    verification
                        ?.reason ||
                    null
            };
        }

        return Object.freeze({
            escapeHTML,

            safeImageUrl,

            validateRenderableReport,

            renderReport,

            renderVerifiedReport,

            verifyPrintableReport
        });
    }
));
