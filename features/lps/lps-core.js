(function initSIMNILPSCore(root, factory) {
    const api = factory();

    if (
        typeof module === 'object' &&
        module.exports
    ) {
        module.exports = api;
    }

    root.SIMNILPSCore = api;
}(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,

    function createSIMNILPSCore() {
        'use strict';

        const SCHEMA_VERSION = 3;
        const SIMNI_TIMEZONE = 'Asia/Jakarta';

        const MAX_STRUCTURE_DEPTH = 64;
        const MAX_SECTION_COUNT = 26;
        const MAX_ASPECT_COUNT_PER_SECTION = 64;
        const MAX_ITEM_COUNT_PER_ASPECT = 256;
        const MAX_TEXT_LENGTH = 4000;

        const FORBIDDEN_KEYS =
            new Set([
                '__proto__',
                'prototype',
                'constructor'
            ]);

        const PERIODS =
            Object.freeze([
                Object.freeze({
                    id:
                        'lps_mid_s1',

                    type:
                        'LPS',

                    stage:
                        'mid',

                    semester:
                        1,

                    term:
                        'ganjil',

                    label:
                        'LPS Tengah Semester Ganjil',

                    legacyLabel:
                        'Tengah Semester - 1'
                }),

                Object.freeze({
                    id:
                        'blp_final_s1',

                    type:
                        'BLP',

                    stage:
                        'final',

                    semester:
                        1,

                    term:
                        'ganjil',

                    label:
                        'BLP Semester Ganjil',

                    legacyLabel:
                        'Semester - 1'
                }),

                Object.freeze({
                    id:
                        'lps_mid_s2',

                    type:
                        'LPS',

                    stage:
                        'mid',

                    semester:
                        2,

                    term:
                        'genap',

                    label:
                        'LPS Tengah Semester Genap',

                    legacyLabel:
                        'Tengah Semester - 2'
                }),

                Object.freeze({
                    id:
                        'blp_final_s2',

                    type:
                        'BLP',

                    stage:
                        'final',

                    semester:
                        2,

                    term:
                        'genap',

                    label:
                        'BLP Semester Genap',

                    legacyLabel:
                        'Semester - 2'
                })
            ]);

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

        function assertSafeObjectKey(
            key,
            label =
                'key'
        ) {
            const value =
                String(
                    key ??
                    ''
                );

            if (!value) {
                throw new Error(
                    `${label} kosong.`
                );
            }

            if (
                FORBIDDEN_KEYS.has(
                    value
                )
            ) {
                throw new Error(
                    `${label} terlarang: ${value}.`
                );
            }

            return value;
        }

        function assertSerializable(
            value,
            path =
                'root',
            depth =
                0
        ) {
            if (
                depth >
                MAX_STRUCTURE_DEPTH
            ) {
                throw new Error(
                    `Struktur data terlalu dalam pada ${path}.`
                );
            }

            if (
                value ===
                    undefined ||
                value ===
                    null
            ) {
                return;
            }

            const type =
                typeof value;

            if (
                type ===
                    'string' ||
                type ===
                    'boolean'
            ) {
                return;
            }

            if (
                type ===
                'number'
            ) {
                if (
                    !Number.isFinite(
                        value
                    )
                ) {
                    throw new Error(
                        `Angka tidak valid pada ${path}.`
                    );
                }

                return;
            }

            if (
                type ===
                    'function' ||
                type ===
                    'symbol' ||
                type ===
                    'bigint'
            ) {
                throw new Error(
                    `Tipe data tidak didukung pada ${path}.`
                );
            }

            if (
                Array.isArray(
                    value
                )
            ) {
                value.forEach(
                    (
                        item,
                        index
                    ) => {
                        assertSerializable(
                            item,
                            `${path}[${index}]`,
                            depth + 1
                        );
                    }
                );

                return;
            }

            if (
                !isPlainObject(
                    value
                )
            ) {
                throw new Error(
                    `Object non-plain tidak diizinkan pada ${path}.`
                );
            }

            Object.entries(
                value
            ).forEach(
                ([
                    key,
                    child
                ]) => {
                    assertSafeObjectKey(
                        key,
                        `Key pada ${path}`
                    );

                    assertSerializable(
                        child,
                        `${path}.${key}`,
                        depth + 1
                    );
                }
            );
        }

        function cloneSerializable(
            value,
            path =
                'root',
            depth =
                0
        ) {
            if (
                depth >
                MAX_STRUCTURE_DEPTH
            ) {
                throw new Error(
                    `Struktur data terlalu dalam pada ${path}.`
                );
            }

            if (
                value ===
                    undefined ||
                value ===
                    null
            ) {
                return value;
            }

            const type =
                typeof value;

            if (
                type ===
                    'string' ||
                type ===
                    'boolean'
            ) {
                return value;
            }

            if (
                type ===
                    'number'
            ) {
                if (
                    !Number.isFinite(
                        value
                    )
                ) {
                    throw new Error(
                        `Angka tidak valid pada ${path}.`
                    );
                }

                return value;
            }

            if (
                type ===
                    'function' ||
                type ===
                    'symbol' ||
                type ===
                    'bigint'
            ) {
                throw new Error(
                    `Tipe data tidak didukung pada ${path}.`
                );
            }

            if (
                Array.isArray(
                    value
                )
            ) {
                return value.map(
                    (
                        item,
                        index
                    ) =>
                        cloneSerializable(
                            item,
                            `${path}[${index}]`,
                            depth + 1
                        )
                );
            }

            if (
                !isPlainObject(
                    value
                )
            ) {
                throw new Error(
                    `Object non-plain tidak diizinkan pada ${path}.`
                );
            }

            const result =
                {};

            Object.entries(
                value
            ).forEach(
                ([
                    key,
                    child
                ]) => {
                    assertSafeObjectKey(
                        key,
                        `Key pada ${path}`
                    );

                    result[key] =
                        cloneSerializable(
                            child,
                            `${path}.${key}`,
                            depth + 1
                        );
                }
            );

            return result;
        }

        function deepClone(
            value
        ) {
            return cloneSerializable(
                value
            );
        }

        function cleanText(
            value,
            fallback =
                '',
            maxLength =
                MAX_TEXT_LENGTH
        ) {
            const text =
                String(
                    value ??
                    ''
                ).trim();

            if (!text) {
                return fallback;
            }

            return text.slice(
                0,
                maxLength
            );
        }

        function normalizeKey(
            value,
            fallback =
                'tidak_diketahui'
        ) {
            const normalized =
                String(
                    value ||
                    ''
                )
                    .normalize(
                        'NFKD'
                    )
                    .replace(
                        /[\u0300-\u036f]/g,
                        ''
                    )
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]+/g,
                        '_'
                    )
                    .replace(
                        /^_+|_+$/g,
                        ''
                    )
                    .slice(
                        0,
                        120
                    );

            return (
                normalized ||
                fallback
            );
        }

        function randomHex(
            bytes =
                16
        ) {
            const cryptoObject =
                typeof globalThis !==
                    'undefined'
                    ? globalThis
                        .crypto
                    : null;

            if (
                cryptoObject
                    ?.getRandomValues
            ) {
                const buffer =
                    new Uint8Array(
                        bytes
                    );

                cryptoObject
                    .getRandomValues(
                        buffer
                    );

                return Array.from(
                    buffer
                )
                    .map(
                        (byte) =>
                            byte
                                .toString(
                                    16
                                )
                                .padStart(
                                    2,
                                    '0'
                                )
                    )
                    .join('');
            }

            return (
                Date.now()
                    .toString(36) +
                Math.random()
                    .toString(36)
                    .slice(2) +
                Math.random()
                    .toString(36)
                    .slice(2)
            );
        }

        function randomId(
            prefix
        ) {
            const safePrefix =
                normalizeKey(
                    prefix,
                    'id'
                );

            const cryptoObject =
                typeof globalThis !==
                    'undefined'
                    ? globalThis
                        .crypto
                    : null;

            if (
                cryptoObject &&
                typeof cryptoObject
                    .randomUUID ===
                    'function'
            ) {
                return (
                    `${safePrefix}_` +
                    cryptoObject
                        .randomUUID()
                        .replace(
                            /-/g,
                            ''
                        )
                );
            }

            return (
                `${safePrefix}_` +
                randomHex(
                    16
                )
            );
        }

        function deterministicId(
            prefix,
            label,
            index
        ) {
            return (
                `${normalizeKey(prefix, 'item')}_` +
                `${String(index + 1).padStart(2, '0')}_` +
                normalizeKey(
                    label,
                    'item'
                )
            );
        }

        function getPeriod(
            periodId
        ) {
            return (
                PERIODS.find(
                    (period) =>
                        period.id ===
                        String(
                            periodId ||
                            ''
                        )
                ) ||
                null
            );
        }

        function requirePeriod(
            periodId
        ) {
            const period =
                getPeriod(
                    periodId
                );

            if (!period) {
                throw new Error(
                    `Periode tidak dikenal: ${periodId}`
                );
            }

            return period;
        }

        function getPeriodFromLegacyLabel(
            label
        ) {
            const normalized =
                cleanText(
                    label
                ).toLowerCase();

            return (
                PERIODS.find(
                    (period) =>
                        period
                            .legacyLabel
                            .toLowerCase() ===
                        normalized
                ) ||
                null
            );
        }

        function normalizeAcademicYear(
            value,
            fallback =
                'Tahun Pelajaran'
        ) {
            const text =
                cleanText(
                    value,
                    fallback,
                    32
                );

            const match =
                /^(\d{4})-(\d{4})$/
                    .exec(
                        text
                    );

            if (!match) {
                return text;
            }

            if (
                Number(
                    match[2]
                ) !==
                Number(
                    match[1]
                ) + 1
            ) {
                return text;
            }

            return text;
        }

        function normalizeSettings(
            settings =
                {}
        ) {
            const source =
                isPlainObject(
                    settings
                )
                    ? settings
                    : {};

            return {
                nama_aplikasi:
                    cleanText(
                        source
                            .nama_aplikasi,
                        'Administrasi Kelas',
                        120
                    ),

                nama_kelas:
                    cleanText(
                        source
                            .nama_kelas,
                        'Kelas',
                        80
                    ),

                tahun_pelajaran:
                    normalizeAcademicYear(
                        source
                            .tahun_pelajaran
                    ),

                ikon_kelas:
                    cleanText(
                        source
                            .ikon_kelas,
                        'fa-school',
                        80
                    ),

                logo_url:
                    cleanText(
                        source
                            .logo_url,
                        './icons/school-logo.png',
                        2048
                    ),

                nama_yayasan:
                    cleanText(
                        source
                            .nama_yayasan,
                        'YAYASAN SOSIAL DAN PENDIDIKAN BINA MUDA',
                        180
                    ),

                nama_sekolah:
                    cleanText(
                        source
                            .nama_sekolah,
                        'SDIT BINA MUDA CICALENGKA',
                        180
                    ),

                jenjang_sekolah:
                    cleanText(
                        source
                            .jenjang_sekolah,
                        'SEKOLAH DASAR ISLAM TERPADU',
                        180
                    ),

                status_akreditasi:
                    cleanText(
                        source
                            .status_akreditasi,
                        'Terakreditasi "A"',
                        120
                    ),

                nomor_izin:
                    cleanText(
                        source
                            .nomor_izin,
                        'Ijin Operasional/RPS : No.421.2/1143-Disdikbud/2011',
                        180
                    ),

                kota:
                    cleanText(
                        source
                            .kota,
                        'Cicalengka',
                        100
                    ),

                nama_wali_kelas:
                    cleanText(
                        source
                            .nama_wali_kelas,
                        '',
                        160
                    ),

                nuptk_wali_kelas:
                    cleanText(
                        source
                            .nuptk_wali_kelas,
                        '',
                        64
                    )
            };
        }

        function templateScopeId(
            settings,
            periodId
        ) {
            const normalized =
                normalizeSettings(
                    settings
                );

            const period =
                requirePeriod(
                    periodId
                );

            return [
                'tpl',

                normalizeKey(
                    normalized
                        .tahun_pelajaran
                ),

                normalizeKey(
                    normalized
                        .nama_kelas
                ),

                normalizeKey(
                    period.id
                )
            ].join('_');
        }

        function reportId(
            settings,
            periodId,
            studentId
        ) {
            const normalized =
                normalizeSettings(
                    settings
                );

            const period =
                requirePeriod(
                    periodId
                );

            const studentKey =
                normalizeKey(
                    studentId,
                    'tanpa_siswa'
                );

            if (
                studentKey ===
                'tanpa_siswa'
            ) {
                throw new Error(
                    'ID siswa wajib tersedia untuk reportId.'
                );
            }

            return [
                'rpt',

                normalizeKey(
                    normalized
                        .tahun_pelajaran
                ),

                normalizeKey(
                    normalized
                        .nama_kelas
                ),

                normalizeKey(
                    period.id
                ),

                studentKey
            ].join('_');
        }

        function buildItems(
            aspectId,
            labels
        ) {
            return labels
                .map(
                    (
                        label,
                        index
                    ) => ({
                        id:
                            deterministicId(
                                `${aspectId}_item`,
                                label,
                                index
                            ),

                        label:
                            cleanText(
                                label,
                                '',
                                240
                            )
                    })
                )
                .filter(
                    (item) =>
                        item.label
                );
        }

        function buildAspect(
            id,
            title,
            options,
            itemLabels,
            extra =
                {}
        ) {
            return {
                id:
                    cleanText(
                        id,
                        randomId(
                            'aspect'
                        ),
                        160
                    ),

                title:
                    cleanText(
                        title,
                        '',
                        240
                    ),

                options:
                    normalizeOptions(
                        options
                    ),

                inputType:
                    normalizeAspectInputType(
                        extra
                            .inputType,
                        options
                    ),

                items:
                    buildItems(
                        id,
                        itemLabels
                    ),

                detailLabel:
                    cleanText(
                        extra
                            .detailLabel,
                        '',
                        320
                    ),

                descriptionLabel:
                    cleanText(
                        extra
                            .descriptionLabel,
                        'Deskripsi dan Rekomendasi',
                        320
                    ),

                descriptionEnabled:
                    extra
                        .descriptionEnabled !==
                    false
            };
        }

        function defaultLPSSections() {
            return [
                {
                    id:
                        'section_a',

                    code:
                        'A',

                    title:
                        "Baca Tulis Al-Qur'an, Penerapan 7 Kebiasaan, Pembiasaan, Prestasi Akademik dan Praktek Ibadah",

                    aspects: [
                        buildAspect(
                            'aspect_btq',
                            "Baca Tulis Al-Qur'an",
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [],
                            {
                                detailLabel:
                                    "Pencapaian Al-Qur'an/Iqro (surat atau jilid dan ayat atau halaman)"
                            }
                        ),

                        buildAspect(
                            'aspect_7_kebiasaan',
                            'Penerapan 7 Kebiasaan Anak Indonesia Hebat',
                            [
                                'Sudah Terbiasa',
                                'Belum Terbiasa'
                            ],
                            [
                                'Bangun Pagi',
                                'Beribadah',
                                'Berolahraga',
                                'Makan Sehat dan Bergizi',
                                'Gemar Belajar',
                                'Bermasyarakat',
                                'Tidur Cepat'
                            ]
                        ),

                        buildAspect(
                            'aspect_pembiasaan',
                            'Pembiasaan',
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [
                                'Makan dan minum sambil duduk',
                                'Tidak berbicara kasar',
                                'Salam dan salim kepada guru',
                                "Mengangkat tangan ketika berdo'a"
                            ]
                        ),

                        buildAspect(
                            'aspect_prestasi_akademik',
                            'Prestasi Akademik',
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [
                                'Membaca',
                                'Menulis',
                                'Berhitung'
                            ]
                        ),

                        buildAspect(
                            'aspect_praktek_ibadah',
                            'Praktek Ibadah',
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [
                                'Thaharah/wudhu',
                                'Bacaan shalat',
                                'Gerakan shalat'
                            ]
                        )
                    ]
                },

                {
                    id:
                        'section_b',

                    code:
                        'B',

                    title:
                        'Target Hafalan',

                    aspects: [
                        buildAspect(
                            'aspect_tahfidz',
                            'Tahfidz / Juz-Amma',
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                "Q.S Al-Ma'un",
                                'Q.S Al-Quraisy',
                                'Q.S Al-Fiil',
                                'Q.S Al-Humazah',
                                "Q.S Al-'Asr",
                                'Q.S At-Takatsur',
                                'Q.S Al-Qoriah',
                                'Q.S An-Naziat',
                                "Q.S 'Abasa"
                            ]
                        ),

                        buildAspect(
                            'aspect_doa',
                            "Do'a Sehari-hari",
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                "Do'a Masuk WC",
                                "Do'a Keluar WC",
                                "Do'a Masuk Mesjid",
                                "Do'a Keluar Mesjid",
                                "Do'a Kebaikan Dunia dan Akhirat",
                                "Do'a ketika turun hujan",
                                "Do'a ketika ada petir",
                                "Do'a ketika ada angin ribut/kencang",
                                "Do'a setelah adzan",
                                "Do'a bercermin"
                            ]
                        ),

                        buildAspect(
                            'aspect_mahfudzat',
                            'Mahfudzat',
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                'Jangan Marah',
                                'Memberi itu lebih baik',
                                'Bahayanya ilmu',
                                'Kebaikan akhlak',
                                'Hidup itu perjuangan',
                                'Keutamaan buku',
                                'Manusia paling bermanfaat',
                                "Belajar Al-Qur'an",
                                'Sabar',
                                'Berkata benar',
                                'Berkata yang baik',
                                'Menjaga lisan',
                                'Tubuh yang sehat',
                                'Kuatnya kemauan'
                            ]
                        )
                    ]
                }
            ];
        }

        function defaultBLPSections() {
            return [
                {
                    id:
                        'section_a',

                    code:
                        'A',

                    title:
                        "Baca Tulis Al-Qur'an, Muroja'ah, Pembiasaan dan Praktek Ibadah",

                    aspects: [
                        buildAspect(
                            'aspect_btq',
                            "Baca Tulis Al-Qur'an",
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [],
                            {
                                detailLabel:
                                    "Pencapaian Al-Qur'an/Iqro (surat atau jilid dan ayat atau halaman)"
                            }
                        ),

                        buildAspect(
                            'aspect_murojaah',
                            "Muroja'ah",
                            [],
                            [],
                            {
                                descriptionEnabled:
                                    false
                            }
                        ),

                        buildAspect(
                            'aspect_pembiasaan',
                            'Pembiasaan',
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [
                                'Salam dan salim',
                                'Tidak berbicara kasar',
                                "Mengangkat tangan ketika berdo'a",
                                'Makan dan minum sambil duduk',
                                'Infaq'
                            ]
                        ),

                        buildAspect(
                            'aspect_praktek_ibadah',
                            'Praktek Ibadah',
                            [
                                'A',
                                'B',
                                'C',
                                'D'
                            ],
                            [
                                'Thaharah/wudhu',
                                'Shalat'
                            ]
                        )
                    ]
                },

                {
                    id:
                        'section_b',

                    code:
                        'B',

                    title:
                        'Target Hafalan',

                    aspects: [
                        buildAspect(
                            'aspect_tahfidz',
                            'Tahfidz / Juz-Amma',
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                "Q.S. Al-'Adiyat",
                                'Q.S. Al-Zalzalah',
                                'Q.S. Al-Bayyinah',
                                'Q.S. Al-Qadar',
                                "Q.S. Al-'Alaq"
                            ]
                        ),

                        buildAspect(
                            'aspect_doa',
                            "Do'a Sehari-hari",
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                "Do'a Masuk WC",
                                "Do'a Keluar WC",
                                "Do'a Masuk Mesjid",
                                "Do'a Keluar Mesjid",
                                "Do'a Kebaikan Dunia dan Akhirat",
                                "Do'a ketika turun hujan",
                                "Do'a ketika ada petir"
                            ]
                        ),

                        buildAspect(
                            'aspect_mahfudzat',
                            'Mahfudzat',
                            [
                                'Hafal',
                                'Sebagian',
                                'Belum'
                            ],
                            [
                                'Jangan Marah',
                                'Memberi itu lebih baik',
                                'Bahayanya ilmu',
                                'Kebaikan akhlak',
                                'Hidup itu perjuangan',
                                'Keutamaan buku',
                                'Manusia paling bermanfaat'
                            ]
                        )
                    ]
                }
            ];
        }

        function createDefaultTemplate(
            settings,
            periodId
        ) {
            const period =
                requirePeriod(
                    periodId
                );

            const normalized =
                normalizeSettings(
                    settings
                );

            const scopeId =
                templateScopeId(
                    normalized,
                    period.id
                );

            return {
                schemaVersion:
                    SCHEMA_VERSION,

                scopeId,

                templateId:
                    `${scopeId}_v1`,

                templateVersion:
                    1,

                academicYearId:
                    normalizeKey(
                        normalized
                            .tahun_pelajaran
                    ),

                academicYearLabel:
                    normalized
                        .tahun_pelajaran,

                classId:
                    normalizeKey(
                        normalized
                            .nama_kelas
                    ),

                classLabel:
                    normalized
                        .nama_kelas,

                periodId:
                    period.id,

                reportType:
                    period.type,

                stage:
                    period.stage,

                semester:
                    period.semester,

                term:
                    period.term,

                label:
                    period.label,

                sections:
                    period.type ===
                        'BLP'
                        ? defaultBLPSections()
                        : defaultLPSSections(),

                teacherNoteEnabled:
                    period.type ===
                    'BLP',

                parentNoteEnabled:
                    period.type ===
                    'BLP',

                createdAt:
                    null,

                updatedAt:
                    null
            };
        }

        function normalizeOptions(
            options
        ) {
            const source =
                Array.isArray(
                    options
                )
                    ? options
                    : String(
                        options ||
                        ''
                    ).split(',');

            const seen =
                new Set();

            const result =
                [];

            source.forEach(
                (item) => {
                    const option =
                        cleanText(
                            item,
                            '',
                            160
                        );

                    if (!option) {
                        return;
                    }

                    const key =
                        option
                            .toLocaleLowerCase(
                                'id-ID'
                            );

                    if (
                        seen.has(
                            key
                        )
                    ) {
                        return;
                    }

                    seen.add(
                        key
                    );

                    result.push(
                        option
                    );
                }
            );

            return result;
        }

        function normalizeAspectInputType(
            inputType,
            options
        ) {
            const normalized =
                cleanText(
                    inputType,
                    '',
                    32
                )
                    .toLocaleLowerCase(
                        'id-ID'
                    );

            const normalizedOptions =
                normalizeOptions(
                    options
                );

            if (
                normalizedOptions.length ===
                0
            ) {
                return 'text';
            }

            const optionSignature =
                normalizedOptions
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
                return 'select';
            }

            if (
                [
                    'select',
                    'checklist',
                    'text'
                ].includes(
                    normalized
                )
            ) {
                return normalized;
            }

            return 'checklist';
        }

        function normalizeItems(
            items,
            aspectId
        ) {
            const source =
                Array.isArray(
                    items
                )
                    ? items
                    : String(
                        items ||
                        ''
                    ).split('\n');

            return source
                .map(
                    (
                        item,
                        index
                    ) => {
                        const objectItem =
                            isPlainObject(
                                item
                            )
                                ? item
                                : null;

                        const label =
                            cleanText(
                                objectItem
                                    ? objectItem
                                        .label
                                    : item,
                                '',
                                240
                            );

                        if (!label) {
                            return null;
                        }

                        const id =
                            cleanText(
                                objectItem
                                    ?.id,
                                deterministicId(
                                    `${aspectId}_item`,
                                    label,
                                    index
                                ),
                                180
                            );

                        return {
                            id,
                            label
                        };
                    }
                )
                .filter(
                    Boolean
                );
        }

        function normalizeTemplate(
            template,
            settings,
            periodId
        ) {
            const requestedPeriodId =
                periodId ||
                template
                    ?.periodId;

            const base =
                createDefaultTemplate(
                    settings,
                    requestedPeriodId
                );

            const source =
                isPlainObject(
                    template
                )
                    ? deepClone(
                        template
                    )
                    : deepClone(
                        base
                    );

            const version =
                Math.max(
                    1,
                    Math.trunc(
                        Number(
                            source
                                .templateVersion
                        ) ||
                        1
                    )
                );

            const scopeId =
                templateScopeId(
                    settings,
                    base.periodId
                );

            const sourceTemplateId =
                cleanText(
                    source
                        .templateId,
                    '',
                    220
                );

            const sameScope =
                source.scopeId ===
                    scopeId ||
                sourceTemplateId
                    .startsWith(
                        `${scopeId}_v`
                    );

            const templateId =
                sameScope &&
                sourceTemplateId
                    ? sourceTemplateId
                    : `${scopeId}_v${version}`;

            const rawSections =
                Array.isArray(
                    source.sections
                ) &&
                source.sections.length
                    ? source.sections
                    : base.sections;

            const sections =
                rawSections.map(
                    (
                        section,
                        sectionIndex
                    ) => {
                        const sectionSource =
                            isPlainObject(
                                section
                            )
                                ? section
                                : {};

                        const sectionTitle =
                            cleanText(
                                sectionSource
                                    .title,
                                '',
                                320
                            );

                        const sectionId =
                            cleanText(
                                sectionSource
                                    .id,
                                deterministicId(
                                    'section',
                                    sectionTitle ||
                                    `Bagian ${sectionIndex + 1}`,
                                    sectionIndex
                                ),
                                180
                            );

                        const rawAspects =
                            Array.isArray(
                                sectionSource
                                    .aspects
                            )
                                ? sectionSource
                                    .aspects
                                : [];

                        return {
                            id:
                                sectionId,

                            code:
                                cleanText(
                                    sectionSource
                                        .code,
                                    String
                                        .fromCharCode(
                                            65 +
                                            sectionIndex
                                        ),
                                    16
                                ),

                            title:
                                sectionTitle,

                            aspects:
                                rawAspects.map(
                                    (
                                        aspect,
                                        aspectIndex
                                    ) => {
                                        const aspectSource =
                                            isPlainObject(
                                                aspect
                                            )
                                                ? aspect
                                                : {};

                                        const aspectTitle =
                                            cleanText(
                                                aspectSource
                                                    .title,
                                                '',
                                                240
                                            );

                                        const aspectId =
                                            cleanText(
                                                aspectSource
                                                    .id,
                                                deterministicId(
                                                    `${sectionId}_aspect`,
                                                    aspectTitle ||
                                                    `Aspek ${aspectIndex + 1}`,
                                                    aspectIndex
                                                ),
                                                180
                                            );

                                        return {
                                            id:
                                                aspectId,

                                            title:
                                                aspectTitle,

                                            options:
                                                normalizeOptions(
                                                    aspectSource
                                                        .options
                                                ),

                                            inputType:
                                                normalizeAspectInputType(
                                                    aspectSource
                                                        .inputType,
                                                    aspectSource
                                                        .options
                                                ),

                                            items:
                                                normalizeItems(
                                                    aspectSource
                                                        .items,
                                                    aspectId
                                                ),

                                            detailLabel:
                                                cleanText(
                                                    aspectSource
                                                        .detailLabel,
                                                    '',
                                                    320
                                                ),

                                            descriptionLabel:
                                                cleanText(
                                                    aspectSource
                                                        .descriptionLabel,
                                                    'Deskripsi dan Rekomendasi',
                                                    320
                                                ),

                                            descriptionEnabled:
                                                aspectSource
                                                    .descriptionEnabled !==
                                                false
                                        };
                                    }
                                )
                        };
                    }
                );

            return {
                schemaVersion:
                    SCHEMA_VERSION,

                scopeId,

                templateId,

                templateVersion:
                    version,

                academicYearId:
                    base
                        .academicYearId,

                academicYearLabel:
                    base
                        .academicYearLabel,

                classId:
                    base.classId,

                classLabel:
                    base.classLabel,

                periodId:
                    base.periodId,

                reportType:
                    base.reportType,

                stage:
                    base.stage,

                semester:
                    base.semester,

                term:
                    base.term,

                label:
                    base.label,

                sections,

                teacherNoteEnabled:
                    source
                        .teacherNoteEnabled ??
                    base
                        .teacherNoteEnabled,

                parentNoteEnabled:
                    source
                        .parentNoteEnabled ??
                    base
                        .parentNoteEnabled,

                createdAt:
                    source
                        .createdAt ||
                    null,

                updatedAt:
                    source
                        .updatedAt ||
                    null,

                createdBy:
                    source
                        .createdBy
                        ? deepClone(
                            source
                                .createdBy
                        )
                        : undefined,

                updatedBy:
                    source
                        .updatedBy
                        ? deepClone(
                            source
                                .updatedBy
                        )
                        : undefined,

                copiedFromTemplateId:
                    source
                        .copiedFromTemplateId ||
                    null
            };
        }

        function valuesOf(
            collection
        ) {
            if (!collection) {
                return [];
            }

            if (
                Array.isArray(
                    collection
                )
            ) {
                return collection
                    .filter(
                        Boolean
                    );
            }

            if (
                !isPlainObject(
                    collection
                )
            ) {
                return [];
            }

            return Object
                .values(
                    collection
                )
                .filter(
                    Boolean
                );
        }

        function getActiveTemplate(
            collection,
            scopeId
        ) {
            const targetScope =
                cleanText(
                    scopeId,
                    '',
                    220
                );

            if (!targetScope) {
                return null;
            }

            return valuesOf(
                collection
            )
                .filter(
                    (template) =>
                        isPlainObject(
                            template
                        ) &&
                        template.scopeId ===
                        targetScope
                )
                .sort(
                    (
                        left,
                        right
                    ) => {
                        const versionDifference =
                            (
                                Number(
                                    right
                                        .templateVersion
                                ) ||
                                0
                            ) -
                            (
                                Number(
                                    left
                                        .templateVersion
                                ) ||
                                0
                            );

                        if (
                            versionDifference !==
                            0
                        ) {
                            return versionDifference;
                        }

                        return String(
                            right
                                .updatedAt ||
                            ''
                        ).localeCompare(
                            String(
                                left
                                    .updatedAt ||
                                ''
                            )
                        );
                    }
                )[0] ||
                null;
        }

        function getTemplateById(
            collection,
            templateId
        ) {
            const id =
                cleanText(
                    templateId,
                    '',
                    220
                );

            if (!id) {
                return null;
            }

            return (
                valuesOf(
                    collection
                ).find(
                    (template) =>
                        template
                            ?.templateId ===
                        id
                ) ||
                null
            );
        }

        function getReportById(
            collection,
            targetReportId
        ) {
            const id =
                cleanText(
                    targetReportId,
                    '',
                    240
                );

            if (!id) {
                return null;
            }

            return (
                valuesOf(
                    collection
                ).find(
                    (report) =>
                        report
                            ?.reportId ===
                        id
                ) ||
                null
            );
        }

        function cloneTemplateForPeriod(
            sourceTemplate,
            settings,
            targetPeriodId
        ) {
            if (
                !isPlainObject(
                    sourceTemplate
                )
            ) {
                throw new Error(
                    'Template sumber tidak valid.'
                );
            }

            const base =
                createDefaultTemplate(
                    settings,
                    targetPeriodId
                );

            const source =
                deepClone(
                    sourceTemplate
                );

            return normalizeTemplate(
                {
                    sections:
                        source.sections,

                    teacherNoteEnabled:
                        base
                            .teacherNoteEnabled,

                    parentNoteEnabled:
                        base
                            .parentNoteEnabled,

                    templateVersion:
                        1,

                    templateId:
                        base
                            .templateId,

                    scopeId:
                        base.scopeId,

                    createdAt:
                        null,

                    updatedAt:
                        null,

                    copiedFromTemplateId:
                        source
                            .templateId ||
                        null
                },
                settings,
                targetPeriodId
            );
        }

        function createEmptyResponses(
            template
        ) {
            if (
                !template ||
                !Array.isArray(
                    template.sections
                )
            ) {
                throw new Error(
                    'Template tidak valid untuk membuat response.'
                );
            }

            const responses =
                {};

            template
                .sections
                .forEach(
                    (section) => {
                        (
                            section
                                .aspects ||
                            []
                        ).forEach(
                            (aspect) => {
                                const aspectId =
                                    cleanText(
                                        aspect.id,
                                        '',
                                        180
                                    );

                                if (
                                    !aspectId
                                ) {
                                    throw new Error(
                                        'Template memiliki aspek tanpa ID.'
                                    );
                                }

                                if (
                                    Object
                                        .prototype
                                        .hasOwnProperty
                                        .call(
                                            responses,
                                            aspectId
                                        )
                                ) {
                                    throw new Error(
                                        `ID aspek ganda: ${aspectId}.`
                                    );
                                }

                                const items =
                                    {};

                                (
                                    aspect
                                        .items ||
                                    []
                                ).forEach(
                                    (item) => {
                                        const itemId =
                                            cleanText(
                                                item.id,
                                                '',
                                                180
                                            );

                                        if (
                                            !itemId
                                        ) {
                                            throw new Error(
                                                `Butir pada ${aspect.title || aspectId} tidak memiliki ID.`
                                            );
                                        }

                                        if (
                                            Object
                                                .prototype
                                                .hasOwnProperty
                                                .call(
                                                    items,
                                                    itemId
                                                )
                                        ) {
                                            throw new Error(
                                                `ID butir ganda pada ${aspect.title || aspectId}: ${itemId}.`
                                            );
                                        }

                                        items[
                                            itemId
                                        ] =
                                            '';
                                    }
                                );

                                responses[
                                    aspectId
                                ] = {
                                    overall:
                                        '',

                                    detail:
                                        '',

                                    description:
                                        '',

                                    items
                                };
                            }
                        );
                    }
                );

            return responses;
        }

        function validateTemplate(
            template
        ) {
            const errors =
                [];

            if (
                !isPlainObject(
                    template
                )
            ) {
                return [
                    'Template tidak valid.'
                ];
            }

            if (
                Number(
                    template
                        .schemaVersion
                ) !==
                SCHEMA_VERSION
            ) {
                errors.push(
                    `Schema template harus versi ${SCHEMA_VERSION}.`
                );
            }

            if (
                !getPeriod(
                    template
                        .periodId
                )
            ) {
                errors.push(
                    'Periode template tidak valid.'
                );
            }

            if (
                !cleanText(
                    template
                        .scopeId
                )
            ) {
                errors.push(
                    'Scope template belum tersedia.'
                );
            }

            if (
                !cleanText(
                    template
                        .templateId
                )
            ) {
                errors.push(
                    'ID template belum tersedia.'
                );
            }

            if (
                !Number.isInteger(
                    Number(
                        template
                            .templateVersion
                    )
                ) ||
                Number(
                    template
                        .templateVersion
                ) <
                1
            ) {
                errors.push(
                    'Versi template tidak valid.'
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
                return [
                    ...errors,
                    'Template harus memiliki minimal satu bagian.'
                ];
            }

            if (
                template
                    .sections
                    .length >
                MAX_SECTION_COUNT
            ) {
                errors.push(
                    `Jumlah bagian melebihi batas ${MAX_SECTION_COUNT}.`
                );
            }

            const globalIds =
                new Set();

            template
                .sections
                .forEach(
                    (
                        section,
                        sectionIndex
                    ) => {
                        const sectionLabel =
                            `bagian ${sectionIndex + 1}`;

                        const sectionId =
                            cleanText(
                                section
                                    ?.id,
                                '',
                                180
                            );

                        if (
                            !sectionId
                        ) {
                            errors.push(
                                `ID ${sectionLabel} belum tersedia.`
                            );
                        } else if (
                            globalIds.has(
                                sectionId
                            )
                        ) {
                            errors.push(
                                `ID ganda: ${sectionId}.`
                            );
                        } else {
                            globalIds.add(
                                sectionId
                            );
                        }

                        if (
                            !cleanText(
                                section
                                    ?.title
                            )
                        ) {
                            errors.push(
                                `Judul ${sectionLabel} belum diisi.`
                            );
                        }

                        if (
                            !Array.isArray(
                                section
                                    ?.aspects
                            ) ||
                            section
                                .aspects
                                .length ===
                                0
                        ) {
                            errors.push(
                                `Bagian ${sectionIndex + 1} harus memiliki minimal satu aspek.`
                            );
                        }

                        if (
                            (
                                section
                                    ?.aspects ||
                                []
                            ).length >
                            MAX_ASPECT_COUNT_PER_SECTION
                        ) {
                            errors.push(
                                `Bagian ${sectionIndex + 1} melebihi ${MAX_ASPECT_COUNT_PER_SECTION} aspek.`
                            );
                        }

                        (
                            section
                                ?.aspects ||
                            []
                        ).forEach(
                            (
                                aspect,
                                aspectIndex
                            ) => {
                                const aspectTitle =
                                    cleanText(
                                        aspect
                                            ?.title
                                    );

                                const aspectId =
                                    cleanText(
                                        aspect
                                            ?.id,
                                        '',
                                        180
                                    );

                                if (
                                    !aspectTitle
                                ) {
                                    errors.push(
                                        `Judul aspek ${sectionIndex + 1}.${aspectIndex + 1} belum diisi.`
                                    );
                                }

                                if (
                                    !aspectId
                                ) {
                                    errors.push(
                                        `ID aspek ${sectionIndex + 1}.${aspectIndex + 1} belum tersedia.`
                                    );
                                } else if (
                                    globalIds.has(
                                        aspectId
                                    )
                                 ) {
                                    errors.push(
                                        `ID ganda: ${aspectId}.`
                                    );
                                } else {
                                    globalIds.add(
                                        aspectId
                                    );
                                }

                                const options =
                                    Array.isArray(
                                        aspect
                                            ?.options
                                    )
                                        ? aspect
                                            .options
                                        : [];

                                const inputType =
                                    normalizeAspectInputType(
                                        aspect
                                            ?.inputType,
                                        options
                                    );

                                if (
                                    inputType ===
                                    'text' &&
                                    options.length
                                ) {
                                    errors.push(
                                        `${aspectTitle || aspectId} bertipe teks dan tidak boleh memiliki pilihan kriteria.`
                                    );
                                }

                                if (
                                    inputType !==
                                    'text' &&
                                    options.length ===
                                    0
                                ) {
                                    errors.push(
                                        `${aspectTitle || aspectId} memerlukan pilihan kriteria.`
                                    );
                                }

                                const optionSet =
                                    new Set();

                                options
                                    .forEach(
                                        (option) => {
                                            const text =
                                                cleanText(
                                                    option,
                                                    '',
                                                    160
                                                );

                                            if (
                                                !text
                                            ) {
                                                errors.push(
                                                    `Ada pilihan kosong pada ${aspectTitle || aspectId || 'aspek'}.`
                                                );
                                            }

                                            const key =
                                                text
                                                    .toLocaleLowerCase(
                                                        'id-ID'
                                                    );

                                            if (
                                                optionSet.has(
                                                    key
                                                )
                                            ) {
                                                errors.push(
                                                    `Pilihan kriteria ganda pada ${aspectTitle || aspectId}: ${text}.`
                                                );
                                            }

                                            optionSet.add(
                                                key
                                            );
                                        }
                                    );

                                const items =
                                    Array.isArray(
                                        aspect
                                            ?.items
                                    )
                                        ? aspect
                                            .items
                                        : [];

                                if (
                                    items.length >
                                    MAX_ITEM_COUNT_PER_ASPECT
                                ) {
                                    errors.push(
                                        `${aspectTitle || aspectId} melebihi ${MAX_ITEM_COUNT_PER_ASPECT} butir.`
                                    );
                                }

                                const itemLabelSet =
                                    new Set();

                                items
                                    .forEach(
                                        (item) => {
                                            const itemId =
                                                cleanText(
                                                    item
                                                        ?.id,
                                                    '',
                                                    180
                                                );

                                            const itemLabel =
                                                cleanText(
                                                    item
                                                        ?.label,
                                                    '',
                                                    240
                                                );

                                            if (
                                                !itemLabel
                                            ) {
                                                errors.push(
                                                    `Ada butir kosong pada ${aspectTitle || aspectId}.`
                                                );
                                            }

                                            if (
                                                !itemId
                                            ) {
                                                errors.push(
                                                    `Ada butir tanpa ID pada ${aspectTitle || aspectId}.`
                                                );
                                            } else if (
                                                globalIds.has(
                                                    itemId
                                                )
                                            ) {
                                                errors.push(
                                                    `ID ganda: ${itemId}.`
                                                );
                                            } else {
                                                globalIds.add(
                                                    itemId
                                                );
                                            }

                                            const labelKey =
                                                itemLabel
                                                    .toLocaleLowerCase(
                                                        'id-ID'
                                                    );

                                            if (
                                                itemLabel &&
                                                itemLabelSet.has(
                                                    labelKey
                                                )
                                            ) {
                                                errors.push(
                                                    `Butir ganda pada ${aspectTitle || aspectId}: ${itemLabel}.`
                                                );
                                            }

                                            itemLabelSet.add(
                                                labelKey
                                            );
                                        }
                                    );
                            }
                        );
                    }
                );

            return errors;
        }

        function validateReportIdentity(
            report
        ) {
            const errors =
                [];

            if (
                !isPlainObject(
                    report
                )
            ) {
                return [
                    'Laporan tidak valid.'
                ];
            }

            if (
                !cleanText(
                    report
                        .reportId
                )
            ) {
                errors.push(
                    'ID laporan tidak tersedia.'
                );
            }

            if (
                !cleanText(
                    report
                        .academicYearId
                )
            ) {
                errors.push(
                    'Tahun pelajaran laporan tidak tersedia.'
                );
            }

            if (
                !cleanText(
                    report
                        .classId
                )
            ) {
                errors.push(
                    'Kelas laporan tidak tersedia.'
                );
            }

            if (
                !cleanText(
                    report
                        .periodId
                ) ||
                !getPeriod(
                    report
                        .periodId
                )
            ) {
                errors.push(
                    'Periode laporan tidak valid.'
                );
            }

            if (
                !cleanText(
                    report
                        .studentSnapshot
                        ?.studentId
                )
            ) {
                errors.push(
                    'Siswa belum dipilih.'
                );
            }

            if (
                !cleanText(
                    report
                        .templateId
                )
            ) {
                errors.push(
                    'ID template laporan tidak tersedia.'
                );
            }

            if (
                !Number.isInteger(
                    Number(
                        report
                            .templateVersion
                    )
                ) ||
                Number(
                    report
                        .templateVersion
                ) <
                1
            ) {
                errors.push(
                    'Versi template laporan tidak valid.'
                );
            }

            if (
                !isPlainObject(
                    report
                        .templateSnapshot
                )
            ) {
                errors.push(
                    'Snapshot template tidak ditemukan.'
                );
            }

            return errors;
        }

        function validateFinalReport(
            report
        ) {
            const errors =
                validateReportIdentity(
                    report
                );

            if (
                !isPlainObject(
                    report
                )
            ) {
                return errors;
            }

            if (
                !parseGregorian(
                    report
                        .reportDate
                )
            ) {
                errors.push(
                    'Tanggal laporan belum dipilih atau tidak valid.'
                );
            }

            if (
                !cleanText(
                    report
                        .hijriDate
                )
            ) {
                errors.push(
                    'Tanggal Hijriah belum terbentuk.'
                );
            }

            if (
                !cleanText(
                    report
                        .schoolSnapshot
                        ?.nama_wali_kelas
                )
            ) {
                errors.push(
                    'Nama wali kelas belum diisi pada Pengaturan.'
                );
            }

            if (
                !cleanText(
                    report
                        .schoolSnapshot
                        ?.nuptk_wali_kelas
                )
            ) {
                errors.push(
                    'NUPTK wali kelas belum diisi pada Pengaturan.'
                );
            }

            const template =
                report
                    .templateSnapshot;

            if (
                !isPlainObject(
                    template
                )
            ) {
                return errors;
            }

            const templateErrors =
                validateTemplate(
                    template
                );

            if (
                templateErrors.length
            ) {
                errors.push(
                    `Snapshot template tidak valid: ${templateErrors[0]}`
                );
            }

            if (
                template.templateId !==
                report.templateId
            ) {
                errors.push(
                    'ID snapshot template tidak cocok dengan laporan.'
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
                errors.push(
                    'Versi snapshot template tidak cocok dengan laporan.'
                );
            }

            if (
                template.periodId !==
                report.periodId
            ) {
                errors.push(
                    'Periode snapshot template tidak cocok dengan laporan.'
                );
            }

            if (
                template.reportType !==
                report.reportType
            ) {
                errors.push(
                    'Jenis snapshot template tidak cocok dengan laporan.'
                );
            }

            (
                template.sections ||
                []
            ).forEach(
                (section) => {
                    (
                        section.aspects ||
                        []
                    ).forEach(
                        (aspect) => {
                            const response =
                                isPlainObject(
                                    report
                                        .responses
                                        ?.[
                                            aspect.id
                                        ]
                                )
                                    ? report
                                        .responses[
                                            aspect.id
                                        ]
                                    : {};

                            const options =
                                normalizeOptions(
                                    aspect
                                        .options
                                );

                            const items =
                                Array.isArray(
                                    aspect.items
                                )
                                    ? aspect
                                        .items
                                    : [];

                            if (
                                aspect.inputType !==
                                'text' &&
                                options.length &&
                                items.length ===
                                    0 &&
                                !options.includes(
                                    response
                                        .overall
                                )
                            ) {
                                errors.push(
                                    `Nilai ${aspect.title} belum dipilih.`
                                );
                            }

                            if (
                                aspect.inputType !==
                                'text' &&
                                options.length &&
                                items.length >
                                    0
                            ) {
                                items
                                    .forEach(
                                        (item) => {
                                            if (
                                                !options.includes(
                                                    response
                                                        .items
                                                        ?.[
                                                            item.id
                                                        ]
                                                )
                                            ) {
                                                errors.push(
                                                    `${aspect.title} — ${item.label} belum dinilai.`
                                                );
                                            }
                                        }
                                    );
                            }

                            if (
                                aspect.inputType ===
                                'text' &&
                                items.length ===
                                0 &&
                                !cleanText(
                                    response
                                        .overall,
                                    '',
                                    4000
                                )
                            ) {
                                errors.push(
                                    `Isian teks ${aspect.title} belum diisi.`
                                );
                            }

                            if (
                                aspect.inputType ===
                                'text' &&
                                items.length >
                                0
                            ) {
                                items
                                    .forEach(
                                        (item) => {
                                            if (
                                                !cleanText(
                                                    response
                                                        .items
                                                        ?.[
                                                            item.id
                                                        ],
                                                    '',
                                                    4000
                                                )
                                            ) {
                                                errors.push(
                                                    `${aspect.title} — ${item.label} belum diisi.`
                                                );
                                            }
                                        }
                                    );
                            }
                        }
                    );
                }
            );

            return errors;
        }

        function parseGregorian(
            dateString
        ) {
            const match =
                /^(\d{4})-(\d{2})-(\d{2})$/
                    .exec(
                        String(
                            dateString ||
                            ''
                        )
                    );

            if (!match) {
                return null;
            }

            const year =
                Number(
                    match[1]
                );

            const month =
                Number(
                    match[2]
                );

            const day =
                Number(
                    match[3]
                );

            const date =
                new Date(
                    Date.UTC(
                        year,
                        month - 1,
                        day,
                        12,
                        0,
                        0
                    )
                );

            if (
                date
                    .getUTCFullYear() !==
                    year ||
                date
                    .getUTCMonth() !==
                    month - 1 ||
                date
                    .getUTCDate() !==
                    day
            ) {
                return null;
            }

            return date;
        }

        function fallbackHijri(
            date
        ) {
            const day =
                date
                    .getUTCDate();

            let month =
                date
                    .getUTCMonth() +
                1;

            let year =
                date
                    .getUTCFullYear();

            const a =
                Math.floor(
                    (
                        14 -
                        month
                    ) /
                    12
                );

            year +=
                4800 -
                a;

            month +=
                12 *
                a -
                3;

            const julianDay =
                day +
                Math.floor(
                    (
                        153 *
                        month +
                        2
                    ) /
                    5
                ) +
                365 *
                year +
                Math.floor(
                    year /
                    4
                ) -
                Math.floor(
                    year /
                    100
                ) +
                Math.floor(
                    year /
                    400
                ) -
                32045;

            let l =
                julianDay -
                1948440 +
                10632;

            const n =
                Math.floor(
                    (
                        l -
                        1
                    ) /
                    10631
                );

            l =
                l -
                10631 *
                n +
                354;

            const j =
                Math.floor(
                    (
                        10985 -
                        l
                    ) /
                    5316
                ) *
                Math.floor(
                    (
                        50 *
                        l
                    ) /
                    17719
                ) +
                Math.floor(
                    l /
                    5670
                ) *
                Math.floor(
                    (
                        43 *
                        l
                    ) /
                    15238
                );

            l =
                l -
                Math.floor(
                    (
                        30 -
                        j
                    ) /
                    15
                ) *
                Math.floor(
                    (
                        17719 *
                        j
                    ) /
                    50
                ) -
                Math.floor(
                    j /
                    16
                ) *
                Math.floor(
                    (
                        15238 *
                        j
                    ) /
                    43
                ) +
                29;

            const hijriMonth =
                Math.floor(
                    (
                        24 *
                        l
                    ) /
                    709
                );

            const hijriDay =
                l -
                Math.floor(
                    (
                        709 *
                        hijriMonth
                    ) /
                    24
                );

            const hijriYear =
                30 *
                n +
                j -
                30;

            const monthNames = [
                'Muharam',
                'Safar',
                'Rabiulawal',
                'Rabiulakhir',
                'Jumadilawal',
                'Jumadilakhir',
                'Rajab',
                'Syakban',
                'Ramadan',
                'Syawal',
                'Zulkaidah',
                'Zulhijah'
            ];

            return (
                `${hijriDay} ` +
                `${monthNames[hijriMonth - 1]} ` +
                `${hijriYear} H`
            );
        }

        function gregorianToHijri(
            dateString,
            adjustmentDays =
                0
        ) {
            const date =
                parseGregorian(
                    dateString
                );

            if (!date) {
                return '';
            }

            const adjustment =
                Math.max(
                    -2,
                    Math.min(
                        2,
                        Math.trunc(
                            Number(
                                adjustmentDays
                            ) ||
                            0
                        )
                    )
                );

            date.setUTCDate(
                date.getUTCDate() +
                adjustment
            );

            try {
                const formatter =
                    new Intl
                        .DateTimeFormat(
                            'id-ID-u-ca-islamic-umalqura-nu-latn',
                            {
                                day:
                                    'numeric',

                                month:
                                    'long',

                                year:
                                    'numeric',

                                timeZone:
                                    SIMNI_TIMEZONE
                            }
                        );

                const parts =
                    formatter
                        .formatToParts(
                            date
                        );

                const value =
                    Object
                        .fromEntries(
                            parts
                                .filter(
                                    (part) =>
                                         [
                                            'day',
                                            'month',
                                            'year'
                                        ]
                                            .includes(
                                                part.type
                                            )
                                )
                                .map(
                                    (part) => [
                                        part.type,
                                        part.value
                                    ]
                                )
                        );

                if (
                    value.day &&
                    value.month &&
                    value.year
                ) {
                    return (
                        `${value.day} ` +
                        `${value.month} ` +
                        `${value.year} H`
                    );
                }
            } catch (_) {
                // Browser tanpa kalender Umm al-Qura memakai perhitungan tabular.
            }

            return fallbackHijri(
                date
            );
        }

        function formatGregorianIndonesian(
            dateString
        ) {
            const date =
                parseGregorian(
                    dateString
                );

            if (!date) {
                return '';
            }

            try {
                return new Intl
                    .DateTimeFormat(
                        'id-ID',
                        {
                            day:
                                '2-digit',

                            month:
                                'long',

                            year:
                                'numeric',

                            timeZone:
                                SIMNI_TIMEZONE
                        }
                    )
                    .format(
                        date
                    );
            } catch (_) {
                const months = [
                    'Januari',
                    'Februari',
                    'Maret',
                    'April',
                    'Mei',
                    'Juni',
                    'Juli',
                    'Agustus',
                    'September',
                    'Oktober',
                    'November',
                    'Desember'
                ];

                return (
                    `${String(date.getUTCDate()).padStart(2, '0')} ` +
                    `${months[date.getUTCMonth()]} ` +
                    `${date.getUTCFullYear()}`
                );
            }
        }

        function canonicalize(
            value,
            path =
                'root',
            depth =
                0
        ) {
            if (
                depth >
                MAX_STRUCTURE_DEPTH
            ) {
                throw new Error(
                    `Struktur canonical terlalu dalam pada ${path}.`
                );
            }

            if (
                value ===
                undefined
            ) {
                return undefined;
            }

            if (
                value ===
                null
            ) {
                return null;
            }

            if (
                Array.isArray(
                    value
                )
            ) {
                return value.map(
                    (
                        item,
                        index
                    ) => {
                        const normalized =
                            canonicalize(
                                item,
                                `${path}[${index}]`,
                                depth + 1
                            );

                        return normalized ===
                            undefined
                            ? null
                            : normalized;
                    }
                );
            }

            const type =
                typeof value;

            if (
                type ===
                    'string' ||
                type ===
                    'boolean'
            ) {
                return value;
            }

            if (
                type ===
                'number'
            ) {
                if (
                    !Number.isFinite(
                        value
                    )
                ) {
                    throw new Error(
                        `Angka non-finite pada ${path}.`
                    );
                }

                return value;
            }

            if (
                type !==
                'object'
            ) {
                throw new Error(
                    `Tipe tidak dapat dicanonicalize pada ${path}.`
                );
            }

            if (
                !isPlainObject(
                    value
                )
            ) {
                throw new Error(
                    `Object non-plain tidak dapat dicanonicalize pada ${path}.`
                );
            }

            const result =
                {};

            Object.keys(
                value
            )
                .sort()
                .forEach(
                    (key) => {
                        assertSafeObjectKey(
                            key,
                            `Canonical key pada ${path}`
                        );

                        const child =
                            canonicalize(
                                value[key],
                                `${path}.${key}`,
                                depth + 1
                            );

                        if (
                            child !==
                            undefined
                        ) {
                            result[key] =
                                child;
                        }
                    }
                );

            return result;
        }

        function canonicalStringify(
            value
        ) {
            return JSON.stringify(
                canonicalize(
                    value
                )
            );
        }

        async function sha256(
            value
        ) {
            const cryptoObject =
                typeof globalThis !==
                    'undefined'
                    ? globalThis
                        .crypto
                    : null;

            if (
                !cryptoObject
                    ?.subtle ||
                typeof TextEncoder ===
                    'undefined'
            ) {
                throw new Error(
                    'Web Crypto SHA-256 tidak tersedia. Hash LPS tidak boleh diturunkan ke algoritma lemah.'
                );
            }

            const input =
                typeof value ===
                    'string'
                    ? value
                    : canonicalStringify(
                        value
                    );

            const digest =
                await cryptoObject
                    .subtle
                    .digest(
                        'SHA-256',
                        new TextEncoder()
                            .encode(
                                input
                            )
                    );

            return Array.from(
                new Uint8Array(
                    digest
                )
            )
                .map(
                    (byte) =>
                        byte
                            .toString(
                                16
                            )
                            .padStart(
                                2,
                                '0'
                            )
                )
                .join('');
        }

        async function hashReport(
            report
        ) {
            if (
                !isPlainObject(
                    report
                )
            ) {
                throw new Error(
                    'Laporan tidak valid untuk hashing.'
                );
            }

            const snapshot =
                deepClone(
                    report
                );

            delete snapshot.hash;

            return sha256(
                snapshot
            );
        }

        async function verifyReportHash(
            report
        ) {
            if (
                !isPlainObject(
                    report
                )
            ) {
                return {
                    ok:
                        false,

                    reason:
                        'invalid-report'
                };
            }

            const expected =
                cleanText(
                    report.hash
                ).toLowerCase();

            if (
                !/^[a-f0-9]{64}$/.test(
                    expected
                )
            ) {
                return {
                    ok:
                        false,

                    reason:
                        'invalid-hash'
                };
            }

            const actual =
                await hashReport(
                    report
                );

            return {
                ok:
                    actual ===
                    expected,

                expected,

                actual
            };
        }

        return Object.freeze({
            SCHEMA_VERSION,

            SIMNI_TIMEZONE,

            PERIODS,

            deepClone,

            normalizeKey,

            randomId,

            getPeriod,

            getPeriodFromLegacyLabel,

            normalizeSettings,

            templateScopeId,

            reportId,

            createDefaultTemplate,

            normalizeTemplate,

            getActiveTemplate,

            getTemplateById,

            getReportById,

            cloneTemplateForPeriod,

            createEmptyResponses,

            validateTemplate,

            validateReportIdentity,

            validateFinalReport,

            gregorianToHijri,

            formatGregorianIndonesian,

            canonicalStringify,

            sha256,

            hashReport,

            verifyReportHash,

            valuesOf
        });
    }
));
