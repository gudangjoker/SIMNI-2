import GADM_CURRICULUM_2026 from "./gadm-curriculum-2026.js";

/**
 * GADM KNOWLEDGE BASE (gadm-kb.js) - v6.0.0 (TEACHER INTELLIGENCE EDITION)
 * Generative Administration for Deep Learning / Administrasi Pembelajaran Mendalam
 * Target: PWA offline-first untuk guru SD (Fase A, B, C)
 *
 * DESIGN CONTRACT
 * -----------------------------------------------------------------------------
 * 1) Pembelajaran Mendalam (PM) diperlakukan sebagai PENDEKATAN, bukan model.
 * 2) Model pembelajaran wajib memiliki sintaks/urutan kerja yang dapat divalidasi.
 * 3) Prinsip PM: berkesadaran, bermakna, menggembirakan.
 * 4) Pengalaman belajar PM: memahami, mengaplikasi, merefleksi.
 * 5) Kerangka PM: praktik pedagogis, kemitraan pembelajaran,
 *    lingkungan pembelajaran, pemanfaatan digital.
 * 6) Delapan dimensi profil lulusan tidak boleh diklaim "terbentuk" hanya karena
 *    sebuah aktivitas dirancang. Generator hanya boleh menyatakan "dikuatkan",
 *    "dilatih", atau "diberi ruang berkembang" tanpa bukti observasi.
 * 7) Deskripsi e-Rapor harus evidence-grounded. Dilarang mengarang kemampuan,
 *    diagnosis, gaya belajar, posisi terhadap rata-rata kelas, atau perilaku murid.
 * 8) CP resmi hanya boleh berasal dari record terverifikasi dengan provenance. v6
 *    menyediakan Curriculum Truth Layer, source routing, validator record, dan slot
 *    corpus versioned. Jika CP/TP tidak tersedia, generasi final tetap diblokir.
 * 9) KB menyediakan ontology, aturan seleksi, teacher-context intelligence,
 *    time/reality check, relasi antar-dokumen, decision explanation, quality
 *    inspector, bahasa, guardrail, serta validator deterministik.
 *
 * REGULATORY BASELINE (metadata, bukan salinan teks regulasi)
 * -----------------------------------------------------------------------------
 * - Permendikdasmen No. 13 Tahun 2025: penyesuaian kurikulum, termasuk PM.
 * - Permendikdasmen No. 1 Tahun 2026: Standar Proses yang berlaku saat v5 disusun.
 * - CP umum: Keputusan Kepala BSKAP No. 046/H/KR/2025.
 * - Perubahan CP 2026: Keputusan Kepala BKPDM No. 020 Tahun 2026, terbatas pada
 *   mata pelajaran Agama dan Budi Pekerti.
 *
 * Catatan: heuristik pedagogis (pemilihan model, durasi, media, scaffolding) di
 * bawah adalah aturan desain GADM, bukan klaim bahwa pemerintah mewajibkan model
 * atau format tertentu.
 */

const KB_VERSION = "6.0.0";
const KB_SCHEMA_VERSION = 6;

const PHASE_IDS = Object.freeze(["faseA", "faseB", "faseC"]);
const DEEP_LEARNING_PRINCIPLES = Object.freeze([
  "berkesadaran",
  "bermakna",
  "menggembirakan"
]);
const DEEP_LEARNING_EXPERIENCES = Object.freeze([
  "memahami",
  "mengaplikasi",
  "merefleksi"
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeId(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableHash(input) {
  const text = String(input ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPick(items, seed = "gadm") {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[stableHash(seed) % items.length];
}

function hasAny(haystack, needles) {
  const normalized = normalizeText(haystack).toLowerCase();
  return needles.some((needle) => normalized.includes(String(needle).toLowerCase()));
}

const MODEL_SYNTAX_KEYS = Object.freeze({
  explicitInstruction: [
    "orientasi_tujuan",
    "pemodelan",
    "latihan_terbimbing",
    "cek_pemahaman",
    "latihan_mandiri",
    "umpan_balik_refleksi"
  ],
  cooperativeLearning: [
    "tujuan_dan_tugas",
    "pembentukan_kelompok",
    "kerja_kolaboratif",
    "pemantauan_dan_bantuan",
    "berbagi_hasil",
    "refleksi_dan_apresiasi"
  ],
  inquiry: [
    "orientasi_fenomena",
    "merumuskan_pertanyaan",
    "mengumpulkan_bukti",
    "menganalisis_bukti",
    "menarik_kesimpulan",
    "mengomunikasikan_dan_merefleksi"
  ],
  discoveryLearning: [
    "stimulasi",
    "identifikasi_masalah_atau_pertanyaan",
    "pengumpulan_data",
    "pengolahan_data",
    "verifikasi",
    "generalisasi_dan_refleksi"
  ],
  problemBasedLearning: [
    "orientasi_masalah",
    "mengorganisasi_belajar",
    "penyelidikan",
    "mengembangkan_dan_menyajikan_solusi",
    "analisis_dan_refleksi"
  ],
  projectBasedLearning: [
    "pertanyaan_atau_tantangan_otentik",
    "perencanaan_produk_dan_kriteria",
    "penjadwalan_dan_pembagian_peran",
    "pelaksanaan_dan_monitoring",
    "uji_atau_presentasi_produk",
    "evaluasi_dan_refleksi"
  ]
});

export const GADM_KB = {
  meta: {
    id: "gadm-kb-sd",
    version: KB_VERSION,
    schemaVersion: KB_SCHEMA_VERSION,
    status: "production",
    locale: "id-ID",
    educationLevel: "SD",
    supportedPhases: [...PHASE_IDS],
    generatedAtPolicyBaseline: "2026-09-01",
    architecture: "teacher-intelligence-knowledge-graph-plus-deterministic-guardrails",
    cpPolicy: "verified-source-routing-external-or-embedded-versioned-corpus-required",
    nonGoals: [
      "menggantikan dokumen regulasi resmi",
      "mengarang CP/TP yang tidak diberikan atau tidak ditemukan di corpus resmi",
      "menentukan diagnosis psikologis atau gaya belajar murid",
      "mengklaim satu model pembelajaran sebagai model wajib nasional"
    ]
  },

  regulatorySources: [
    {
      id: "permendikdasmen_13_2025",
      kind: "regulation",
      title: "Permendikdasmen Nomor 13 Tahun 2025",
      role: "baseline_kurikulum_dan_pembelajaran_mendalam",
      statusAtBaseline: "active_reference",
      verificationRequiredOnUpdate: true
    },
    {
      id: "permendikdasmen_1_2026",
      kind: "regulation",
      title: "Permendikdasmen Nomor 1 Tahun 2026 tentang Standar Proses",
      role: "standar_proses",
      statusAtBaseline: "active",
      verificationRequiredOnUpdate: true
    },
    {
      id: "cp_046_2025",
      kind: "curriculum_decision",
      title: "Keputusan Kepala BSKAP Nomor 046/H/KR/2025",
      role: "capaian_pembelajaran_umum",
      statusAtBaseline: "active_except_amended_scope",
      verificationRequiredOnUpdate: true
    },
    {
      id: "cp_020_2026",
      kind: "curriculum_decision",
      title: "Keputusan Kepala BKPDM Nomor 020 Tahun 2026",
      role: "perubahan_cp_agama_dan_budi_pekerti",
      scope: "agama_dan_budi_pekerti_only",
      statusAtBaseline: "active",
      verificationRequiredOnUpdate: true
    }
  ],

  faseMap: {
    faseA: {
      label: "Fase A",
      kelas: [1, 2],
      rentangKelas: "1-2",
      typicalAge: "6-8 tahun",
      designPriorities: [
        "instruksi singkat dan konkret",
        "pemodelan eksplisit",
        "benda nyata dan representasi visual",
        "langkah kerja sedikit dan berulang",
        "umpan balik segera",
        "bahasa sederhana tanpa mengurangi ketepatan konsep"
      ]
    },
    faseB: {
      label: "Fase B",
      kelas: [3, 4],
      rentangKelas: "3-4",
      typicalAge: "8-10 tahun",
      designPriorities: [
        "menghubungkan konsep dengan pengalaman sehari-hari",
        "latihan terbimbing menuju mandiri",
        "diskusi dan observasi terstruktur",
        "penggunaan representasi konkret menuju simbolik",
        "tugas pemecahan masalah sederhana",
        "refleksi singkat berbasis bukti"
      ]
    },
    faseC: {
      label: "Fase C",
      kelas: [5, 6],
      rentangKelas: "5-6",
      typicalAge: "10-12 tahun",
      designPriorities: [
        "penalaran dan argumentasi berbasis bukti",
        "pemecahan masalah kontekstual",
        "kemandirian dan perencanaan tugas",
        "kolaborasi dengan peran yang jelas",
        "proyek atau investigasi terukur bila relevan",
        "refleksi strategi dan kualitas hasil"
      ]
    }
  },

  pembelajaranMendalam: {
    statusKonseptual: {
      type: "pendekatan_pembelajaran",
      label: "Pembelajaran Mendalam",
      forbiddenAsModelName: true,
      hardRule:
        "Jangan pernah mengisi kolom modelPembelajaran dengan 'Pembelajaran Mendalam'."
    },

    definition:
      "Pendekatan pembelajaran yang memuliakan murid dengan menekankan proses belajar berkesadaran, bermakna, dan menggembirakan melalui pengembangan yang holistik.",

    prinsip: {
      berkesadaran: {
        id: "berkesadaran",
        essence: [
          "murid memahami tujuan belajar",
          "murid terlibat sebagai pembelajar aktif",
          "murid mengembangkan motivasi intrinsik",
          "murid memilih atau menggunakan strategi belajar yang sesuai",
          "murid memantau dan meregulasi proses belajarnya"
        ],
        antiPatterns: [
          "menganggap berkesadaran identik dengan meditasi",
          "menganggap latihan napas sebagai bukti tunggal pembelajaran berkesadaran",
          "memaksa murid melakukan aktivitas emosional pribadi untuk memenuhi format",
          "mencantumkan refleksi tanpa hubungan dengan tujuan belajar"
        ],
        phaseIndicators: {
          faseA: [
            "menyebutkan dengan bahasa sederhana apa yang akan dipelajari",
            "menunjukkan kesiapan mengikuti kegiatan",
            "memilih satu cara sederhana untuk menyelesaikan tugas",
            "menyampaikan bagian yang sudah atau belum dipahami"
          ],
          faseB: [
            "menghubungkan tujuan belajar dengan pengetahuan awal",
            "memilih strategi sederhana dari beberapa pilihan",
            "memeriksa kemajuan tugas dengan panduan",
            "menjelaskan kesulitan dan bantuan yang diperlukan"
          ],
          faseC: [
            "menetapkan target belajar yang dapat diamati",
            "merencanakan strategi atau langkah kerja",
            "memantau kemajuan dan memperbaiki strategi",
            "menilai kualitas proses dan hasil belajar berdasarkan kriteria"
          ]
        },
        optionalReadinessActivities: {
          note:
            "Aktivitas berikut hanya pengondisian kesiapan, bukan definisi prinsip berkesadaran.",
          faseA: [
            "menunjukkan kondisi diri dengan kartu ekspresi sederhana",
            "melakukan peregangan singkat sebelum mulai belajar",
            "menyiapkan alat belajar dan posisi duduk yang nyaman"
          ],
          faseB: [
            "melakukan cek kesiapan belajar singkat",
            "menuliskan satu target kecil untuk kegiatan hari ini",
            "mengatur alat dan sumber belajar yang akan digunakan"
          ],
          faseC: [
            "menuliskan target dan strategi belajar singkat",
            "mengidentifikasi gangguan yang dapat menghambat konsentrasi",
            "menentukan indikator pribadi bahwa tugas telah selesai dengan baik"
          ]
        }
      },

      bermakna: {
        id: "bermakna",
        essence: [
          "pengetahuan baru terhubung dengan pengetahuan atau pengalaman sebelumnya",
          "murid memahami relevansi yang dipelajari",
          "murid menerapkan pengetahuan pada konteks yang sesuai",
          "kegiatan tidak berhenti pada hafalan atau reproduksi informasi"
        ],
        antiPatterns: [
          "memaksakan konteks kehidupan nyata yang tidak relevan",
          "menganggap semua tugas proyek otomatis bermakna",
          "menggunakan aktivitas ramai tanpa hubungan dengan tujuan belajar"
        ],
        phaseIndicators: {
          faseA: [
            "menghubungkan konsep dengan benda atau pengalaman yang dekat",
            "menggunakan konsep pada contoh konkret",
            "menjelaskan manfaat sederhana dari hal yang dipelajari"
          ],
          faseB: [
            "menghubungkan pengetahuan awal dengan konsep baru",
            "menggunakan konsep untuk menjelaskan kejadian sehari-hari",
            "menyelesaikan masalah sederhana yang relevan"
          ],
          faseC: [
            "menggunakan konsep untuk menganalisis situasi nyata",
            "memindahkan pemahaman ke konteks baru yang sejenis",
            "menghasilkan solusi, produk, keputusan, atau penjelasan berbasis konsep"
          ]
        }
      },

      menggembirakan: {
        id: "menggembirakan",
        essence: [
          "suasana belajar positif dan aman",
          "murid merasa dihargai atas keterlibatan dan kontribusinya",
          "terdapat tantangan yang sesuai kemampuan",
          "murid memiliki rasa ingin tahu, pilihan, atau kepemilikan terhadap proses belajar",
          "emosi positif mendukung keterlibatan, bukan sekadar hiburan"
        ],
        antiPatterns: [
          "menganggap menggembirakan selalu berarti permainan",
          "menggunakan kompetisi yang mempermalukan murid",
          "memaksa yel-yel, lagu, atau permainan ketika tidak relevan",
          "mengorbankan tujuan belajar demi aktivitas yang terlihat seru"
        ],
        phaseIndicators: {
          faseA: [
            "murid mendapat respons positif atas usaha",
            "kegiatan memiliki variasi gerak, benda, cerita, atau pilihan sederhana",
            "tantangan singkat dapat diselesaikan dengan dukungan yang sesuai"
          ],
          faseB: [
            "murid memiliki kesempatan memilih cara atau bentuk produk sederhana",
            "tantangan mendorong rasa ingin tahu tanpa membuat frustrasi",
            "interaksi kelompok menjaga rasa aman dan saling menghargai"
          ],
          faseC: [
            "murid memperoleh tantangan autentik yang memiliki tujuan jelas",
            "murid diberi ruang mengambil keputusan yang bertanggung jawab",
            "kelas menghargai proses, revisi, dan kontribusi beragam"
          ]
        },
        optionalGamification: {
          faseA: [
            "tebak gambar",
            "mencocokkan kartu",
            "gerak dan isyarat",
            "cerita interaktif"
          ],
          faseB: [
            "kuis kolaboratif",
            "puzzle konsep",
            "permainan peran sederhana",
            "tantangan kartu informasi"
          ],
          faseC: [
            "tantangan pemecahan kasus",
            "kuis berbasis alasan",
            "simulasi peran",
            "permainan strategi edukatif"
          ]
        }
      }
    },

    pengalamanBelajar: {
      memahami: {
        id: "memahami",
        intent:
          "membangun dan memperdalam pemahaman konsep, informasi, prosedur, atau hubungan yang diperlukan sebelum penerapan",
        evidenceExamples: [
          "penjelasan dengan kata sendiri",
          "representasi gambar, tabel, model, atau diagram",
          "pengelompokan atau perbandingan berdasarkan alasan",
          "jawaban terhadap pertanyaan konseptual",
          "demonstrasi pemahaman prosedur"
        ],
        phaseGuidance: {
          faseA: "utamakan pengalaman konkret, contoh dekat, pemodelan, dan bahasa ringkas",
          faseB: "gunakan perbandingan, klasifikasi, sebab-akibat sederhana, dan representasi",
          faseC: "gunakan hubungan antarkonsep, bukti, alasan, dan berbagai representasi"
        }
      },
      mengaplikasi: {
        id: "mengaplikasi",
        intent:
          "menggunakan pengetahuan atau keterampilan untuk menyelesaikan tugas, masalah, produk, atau situasi yang relevan",
        evidenceExamples: [
          "praktik atau demonstrasi",
          "pemecahan masalah",
          "produk atau karya",
          "penerapan prosedur pada konteks baru",
          "keputusan yang disertai alasan"
        ],
        phaseGuidance: {
          faseA: "gunakan situasi konkret dengan jumlah langkah terbatas dan bantuan yang jelas",
          faseB: "gunakan masalah kontekstual sederhana dan latihan transfer bertahap",
          faseC: "gunakan masalah lebih terbuka, investigasi, proyek terukur, atau transfer lintas konteks"
        }
      },
      merefleksi: {
        id: "merefleksi",
        intent:
          "menilai proses dan hasil belajar, mengenali bukti keberhasilan atau kesulitan, serta menentukan tindak lanjut",
        evidenceExamples: [
          "exit ticket",
          "catatan apa yang dipahami dan masih membingungkan",
          "perbandingan hasil dengan kriteria",
          "penjelasan strategi yang efektif atau perlu diperbaiki",
          "rencana tindak lanjut"
        ],
        phaseGuidance: {
          faseA: "gunakan pilihan sederhana, kalimat pendek, gambar, atau percakapan terbimbing",
          faseB: "gunakan pertanyaan refleksi terstruktur dan bukti hasil kerja",
          faseC: "minta murid menilai strategi, kualitas bukti, revisi, dan langkah berikutnya"
        }
      }
    },

    kerangkaPembelajaran: {
      praktikPedagogis: {
        id: "praktik_pedagogis",
        definition:
          "pilihan strategi, model, metode, scaffolding, asesmen, dan umpan balik yang selaras dengan tujuan serta karakteristik murid"
      },
      kemitraanPembelajaran: {
        id: "kemitraan_pembelajaran",
        definition:
          "kolaborasi yang relevan antara murid, guru, keluarga, warga sekolah, masyarakat, atau mitra lain tanpa menjadikannya kewajiban setiap pertemuan"
      },
      lingkunganPembelajaran: {
        id: "lingkungan_pembelajaran",
        definition:
          "pengaturan ruang fisik, sosial, budaya, dan psikologis yang aman, inklusif, mendukung partisipasi dan pembelajaran"
      },
      pemanfaatanDigital: {
        id: "pemanfaatan_digital",
        definition:
          "penggunaan teknologi bila memberi nilai tambah pada akses, eksplorasi, kolaborasi, penciptaan, dokumentasi, atau asesmen; bukan kewajiban dekoratif",
        hardRules: [
          "jangan mengharuskan internet bila tujuan dapat dicapai secara offline",
          "jangan meminta data pribadi murid yang tidak diperlukan",
          "sediakan alternatif nondigital bila sumber daya tidak tersedia"
        ]
      }
    },

    olahHolistik: {
      olahPikir: {
        focus: "pemahaman, penalaran, analisis, kreativitas kognitif, pemecahan masalah"
      },
      olahHati: {
        focus: "nilai, integritas, empati, tanggung jawab, kesadaran moral dan spiritual"
      },
      olahRasa: {
        focus: "kepekaan, apresiasi, estetika, hubungan sosial, ekspresi yang beradab"
      },
      olahRaga: {
        focus: "kebugaran, keterampilan fisik, kebiasaan sehat, koordinasi, dan kesejahteraan jasmani"
      }
    }
  },

  kko: {
    designRule:
      "KKO dipilih berdasarkan kompetensi dan bukti yang diminta, bukan dikunci secara kaku oleh fase. Fase mengatur kompleksitas, dukungan, dan konteks.",

    intents: {
      mengenaliMengingat: [
        "mengenali",
        "menyebutkan",
        "mengidentifikasi",
        "memilih",
        "mencocokkan",
        "mengurutkan"
      ],
      memahamiMenjelaskan: [
        "menjelaskan",
        "menggambarkan",
        "menceritakan kembali",
        "mengelompokkan",
        "membandingkan",
        "memberi contoh",
        "menghubungkan"
      ],
      menerapkan: [
        "menggunakan",
        "mempraktikkan",
        "mendemonstrasikan",
        "menghitung",
        "menerapkan",
        "menyelesaikan"
      ],
      menalarMenyelidiki: [
        "merumuskan pertanyaan",
        "mengamati",
        "mengumpulkan informasi",
        "menganalisis",
        "menafsirkan",
        "menentukan hubungan sebab-akibat",
        "menyimpulkan"
      ],
      mencipta: [
        "merancang",
        "menyusun",
        "membuat",
        "mengembangkan",
        "menghasilkan",
        "memodifikasi"
      ],
      mengevaluasiMerefleksi: [
        "memeriksa",
        "menilai berdasarkan kriteria",
        "memberikan alasan",
        "merevisi",
        "merefleksikan",
        "menentukan tindak lanjut"
      ]
    },

    nonCompetencyActivityWords: [
      "mewarnai",
      "menyalin",
      "menjiplak",
      "menggunting",
      "menempel"
    ],

    phaseComplexity: {
      faseA: {
        context: "konkret dan sangat dekat dengan pengalaman murid",
        expectedSteps: "1-3 langkah utama",
        reasoning: "alasan sederhana dengan dukungan pertanyaan atau contoh",
        output: "lisan singkat, tindakan, gambar, benda, kata atau kalimat sederhana"
      },
      faseB: {
        context: "konteks sehari-hari dengan variasi terbatas",
        expectedSteps: "2-5 langkah utama",
        reasoning: "perbandingan, pengelompokan, hubungan sederhana, alasan berbasis bukti yang tersedia",
        output: "penjelasan, tabel sederhana, paragraf pendek, model, praktik, atau produk sederhana"
      },
      faseC: {
        context: "konteks autentik atau baru yang masih sesuai perkembangan",
        expectedSteps: "beberapa langkah yang dapat direncanakan murid",
        reasoning: "analisis sederhana, evaluasi dengan kriteria, argumentasi atau pemecahan masalah",
        output: "laporan terstruktur, presentasi, produk, model, solusi, atau refleksi"
      }
    }
  },

  pendekatanPembelajaran: {
    pembelajaranMendalam: {
      id: "pembelajaran_mendalam",
      label: "Pembelajaran Mendalam",
      type: "approach",
      mandatoryPlacement: "pendekatanPembelajaran",
      forbiddenPlacement: "modelPembelajaran"
    }
  },

  modelPembelajaran: {
    explicitInstruction: {
      id: "explicit_instruction",
      label: "Pembelajaran Eksplisit/Terstruktur",
      type: "model_or_structured_pedagogy",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "keterampilan atau prosedur baru",
        "pengetahuan fondasional yang membutuhkan contoh jelas",
        "latihan bertahap dengan umpan balik segera",
        "materi dengan risiko miskonsepsi tinggi"
      ],
      avoidWhen: [
        "tujuan utama menuntut investigasi terbuka yang autentik",
        "murid sudah menguasai dasar dan membutuhkan transfer yang lebih kompleks"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.explicitInstruction],
      phaseNotes: {
        faseA: "gunakan pemodelan sangat singkat, contoh konkret, dan banyak cek pemahaman",
        faseB: "kurangi bantuan bertahap dan tambah latihan penerapan pada variasi konteks",
        faseC: "gunakan untuk fondasi atau prosedur, lalu lanjutkan ke aplikasi dan refleksi"
      }
    },

    cooperativeLearning: {
      id: "cooperative_learning",
      label: "Pembelajaran Kooperatif",
      type: "model",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "tujuan yang mendapat manfaat dari pertukaran ide",
        "latihan komunikasi dan kolaborasi",
        "tugas yang dapat dibagi menjadi peran bermakna"
      ],
      prerequisites: [
        "tugas dan kriteria keberhasilan jelas",
        "setiap murid memiliki kontribusi yang dapat diamati",
        "guru mencegah satu murid mendominasi atau menjadi penumpang"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.cooperativeLearning],
      phaseNotes: {
        faseA: "kelompok kecil, peran sangat sederhana, durasi singkat, produk bersama yang konkret",
        faseB: "gunakan peran terstruktur dan akuntabilitas individu sederhana",
        faseC: "gunakan pembagian peran, negosiasi, penilaian proses, dan tanggung jawab hasil"
      }
    },

    inquiry: {
      id: "inquiry",
      label: "Pembelajaran Inkuiri",
      type: "model",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "menyelidiki fenomena atau pertanyaan yang dapat dibuktikan",
        "mengembangkan kebiasaan bertanya dan menggunakan bukti",
        "membangun pemahaman melalui pengamatan atau data"
      ],
      prerequisites: [
        "tersedia fenomena, sumber, objek, atau data yang aman dan dapat diamati",
        "pertanyaan sesuai waktu dan kemampuan murid",
        "guru menyiapkan scaffolding agar inkuiri tidak berubah menjadi menebak"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.inquiry],
      phaseNotes: {
        faseA: "gunakan inkuiri terbimbing dengan satu pertanyaan konkret dan bukti yang mudah diamati",
        faseB: "gunakan pertanyaan terarah dan tabel pengamatan sederhana",
        faseC: "beri ruang lebih besar untuk merumuskan pertanyaan, memilih bukti, dan menjelaskan keterbatasan"
      }
    },

    discoveryLearning: {
      id: "discovery_learning",
      label: "Discovery Learning",
      type: "model",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "menemukan pola, hubungan, kategori, atau prinsip dari contoh yang dirancang",
        "konsep yang dapat ditemukan melalui data atau representasi yang memadai"
      ],
      prerequisites: [
        "contoh atau data cukup untuk mendukung penemuan",
        "guru menyiapkan pertanyaan penuntun",
        "kesimpulan akhir diverifikasi agar miskonsepsi tidak dibiarkan"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.discoveryLearning],
      phaseNotes: {
        faseA: "gunakan penemuan sangat terbimbing dengan benda atau gambar konkret",
        faseB: "gunakan beberapa contoh untuk menemukan pola sederhana",
        faseC: "murid dapat membandingkan data, menguji dugaan, dan merumuskan generalisasi terbatas"
      }
    },

    problemBasedLearning: {
      id: "problem_based_learning",
      label: "Problem Based Learning (PBL)",
      type: "model",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "pemecahan masalah kontekstual yang memiliki lebih dari satu kemungkinan strategi",
        "penerapan beberapa konsep pada satu situasi",
        "argumentasi, keputusan, dan evaluasi solusi"
      ],
      prerequisites: [
        "masalah benar-benar membutuhkan penalaran, bukan soal rutin yang diberi cerita",
        "murid memiliki atau dapat memperoleh pengetahuan dasar yang dibutuhkan",
        "ruang lingkup masalah sesuai waktu pembelajaran"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.problemBasedLearning],
      phaseNotes: {
        faseA: "gunakan masalah tunggal yang konkret, dekat, dan sangat terbimbing; jangan memaksakan PBL untuk semua materi",
        faseB: "gunakan masalah sederhana dengan data terbatas dan solusi yang dapat diuji",
        faseC: "gunakan masalah autentik terukur dengan pembandingan alternatif solusi dan refleksi"
      }
    },

    projectBasedLearning: {
      id: "project_based_learning",
      label: "Project Based Learning (PjBL)",
      type: "model",
      suitablePhases: [...PHASE_IDS],
      bestFor: [
        "tujuan yang membutuhkan produk, karya, layanan, atau performa yang dikembangkan melalui beberapa tahap",
        "integrasi beberapa keterampilan dalam tugas autentik",
        "perencanaan, revisi, kolaborasi, dan presentasi"
      ],
      prerequisites: [
        "produk bukan sekadar kerajinan dekoratif",
        "produk atau performa menjadi bukti penerapan kompetensi",
        "ada kriteria kualitas dan kesempatan revisi",
        "durasi realistis terhadap kalender dan beban belajar"
      ],
      syntax: [...MODEL_SYNTAX_KEYS.projectBasedLearning],
      phaseNotes: {
        faseA: "gunakan mini-project sangat pendek dengan 1 produk konkret dan peran guru kuat",
        faseB: "gunakan proyek ringkas dengan 2-4 tahap utama dan checkpoint jelas",
        faseC: "proyek dapat berlangsung beberapa pertemuan; default GADM menjaga ruang lingkup tetap terukur dan tidak otomatis membuat proyek panjang"
      }
    }
  },

  modelSelectionRules: [
    {
      id: "rule_foundational_skill",
      when: {
        intentsAny: ["fondasi", "prosedur", "kelancaran", "akurasi", "pemodelan"]
      },
      prefer: ["explicit_instruction"],
      reason: "keterampilan dasar baru sering memerlukan pemodelan, latihan terbimbing, cek pemahaman, dan umpan balik"
    },
    {
      id: "rule_pattern_discovery",
      when: {
        intentsAny: ["menemukan pola", "mengelompokkan", "membandingkan contoh", "generalisasi"]
      },
      prefer: ["discovery_learning", "inquiry"],
      reason: "tujuan cocok dengan penemuan hubungan berbasis contoh atau bukti"
    },
    {
      id: "rule_investigation",
      when: {
        intentsAny: ["menyelidiki", "mengamati", "mengumpulkan data", "menguji dugaan"]
      },
      prefer: ["inquiry"],
      reason: "inkuiri memberi struktur pada pertanyaan, bukti, analisis, kesimpulan, dan komunikasi"
    },
    {
      id: "rule_problem_solving",
      when: {
        intentsAny: ["memecahkan masalah", "menentukan solusi", "mengambil keputusan", "membandingkan solusi"]
      },
      prefer: ["problem_based_learning"],
      reason: "PBL sesuai ketika pusat kegiatan benar-benar masalah yang membutuhkan penalaran"
    },
    {
      id: "rule_product",
      when: {
        intentsAny: ["produk", "proyek", "karya bertahap", "layanan", "pameran"]
      },
      prefer: ["project_based_learning"],
      reason: "PjBL sesuai bila produk/performa menjadi bukti kompetensi dan dikembangkan melalui beberapa tahap"
    },
    {
      id: "rule_collaboration",
      when: {
        intentsAny: ["kolaborasi", "diskusi", "saling menjelaskan", "kerja kelompok"]
      },
      prefer: ["cooperative_learning"],
      reason: "pembelajaran kooperatif cocok bila kontribusi dan akuntabilitas anggota dapat dirancang jelas"
    }
  ],

  metodePembelajaran: {
    observasi: {
      label: "Observasi",
      suitablePhases: [...PHASE_IDS],
      purposes: ["mengumpulkan bukti", "mengenali ciri", "membandingkan", "memantik pertanyaan"]
    },
    demonstrasi: {
      label: "Demonstrasi",
      suitablePhases: [...PHASE_IDS],
      purposes: ["memodelkan prosedur", "menunjukkan fenomena", "menjelaskan penggunaan alat"]
    },
    latihanTerbimbing: {
      label: "Latihan Terbimbing",
      suitablePhases: [...PHASE_IDS],
      purposes: ["membangun akurasi", "mengurangi bantuan bertahap", "cek pemahaman"]
    },
    tanyaJawab: {
      label: "Tanya Jawab",
      suitablePhases: [...PHASE_IDS],
      purposes: ["mengaktifkan pengetahuan awal", "menggali alasan", "cek pemahaman", "refleksi"]
    },
    diskusi: {
      label: "Diskusi",
      suitablePhases: [...PHASE_IDS],
      purposes: ["bertukar gagasan", "membandingkan alasan", "menyusun kesepakatan", "merefleksi"]
    },
    eksperimen: {
      label: "Eksperimen/Percobaan",
      suitablePhases: [...PHASE_IDS],
      purposes: ["menguji hubungan", "mengumpulkan data", "membandingkan hasil"],
      hardRules: ["gunakan bahan dan prosedur aman untuk usia SD", "jangan mengarang hasil eksperimen"]
    },
    praktik: {
      label: "Praktik",
      suitablePhases: [...PHASE_IDS],
      purposes: ["menerapkan prosedur", "mengembangkan keterampilan", "menghasilkan bukti performa"]
    },
    bermainPeran: {
      label: "Bermain Peran/Simulasi",
      suitablePhases: [...PHASE_IDS],
      purposes: ["memahami perspektif", "melatih komunikasi", "mensimulasikan situasi sosial"]
    },
    membacaTerbimbing: {
      label: "Membaca Terbimbing",
      suitablePhases: [...PHASE_IDS],
      purposes: ["membangun pemahaman teks", "menemukan informasi", "mengembangkan strategi membaca"]
    },
    wawancara: {
      label: "Wawancara",
      suitablePhases: ["faseB", "faseC"],
      purposes: ["mengumpulkan informasi", "melatih pertanyaan", "menghubungkan pembelajaran dengan lingkungan"]
    },
    presentasi: {
      label: "Presentasi/Unjuk Hasil",
      suitablePhases: [...PHASE_IDS],
      purposes: ["mengomunikasikan pemahaman", "menjelaskan alasan", "mendapatkan umpan balik"]
    },
    phaseGuidance: {
      faseA: [
        "gunakan metode dengan instruksi singkat, contoh konkret, dan respons yang dapat diamati",
        "diskusi atau presentasi dibuat sangat singkat dengan dukungan pertanyaan guru",
        "eksperimen harus sederhana, aman, dan berfokus pada satu hubungan yang jelas"
      ],
      faseB: [
        "kombinasikan observasi, diskusi terstruktur, praktik, dan latihan terbimbing sesuai tujuan",
        "mulai memberi ruang pada wawancara, eksperimen, dan presentasi sederhana dengan instrumen bantu",
        "kurangi bantuan secara bertahap ketika murid menunjukkan bukti kesiapan"
      ],
      faseC: [
        "gunakan metode yang memberi ruang lebih besar pada alasan, bukti, perencanaan, dan revisi",
        "wawancara, investigasi, diskusi, praktik, dan presentasi dapat lebih mandiri bila prasyarat tersedia",
        "metode tetap dipilih berdasarkan tujuan; aktivitas kompleks tidak otomatis lebih baik"
      ]
    }
  },

  mediaPembelajaran: {
    selectionPrinciples: [
      "media dipilih karena membantu tujuan dan bukti belajar, bukan untuk mempercantik modul",
      "utamakan media konkret pada konsep yang masih abstrak bagi murid",
      "pastikan keterbacaan, keamanan, aksesibilitas, dan ketersediaan",
      "teknologi digital bersifat bernilai tambah, bukan kewajiban"
    ],
    byPhase: {
      faseA: [
        "benda konkret",
        "manipulatif",
        "kartu gambar atau kata",
        "gambar berukuran jelas",
        "buku cerita",
        "papan tulis",
        "lingkungan kelas atau sekolah"
      ],
      faseB: [
        "benda konkret dan model",
        "diagram atau peta sederhana",
        "kartu informasi",
        "bacaan pendek",
        "alat ukur sederhana",
        "lingkungan sekolah",
        "media digital sederhana bila tersedia"
      ],
      faseC: [
        "teks dan sumber informasi terpilih",
        "grafik, tabel, peta, atau diagram",
        "alat ukur dan bahan investigasi",
        "lingkungan sekolah atau masyarakat",
        "lembar data",
        "perangkat digital offline atau online bila relevan dan tersedia"
      ]
    },
    digitalGuardrails: [
      "jangan menjadikan kepemilikan gawai pribadi sebagai prasyarat",
      "jangan meminta akun pribadi murid bila tidak diperlukan",
      "hindari layanan yang mengumpulkan data murid tanpa dasar dan izin yang sesuai",
      "sediakan alternatif analog/offline"
    ]
  },

  profilLulusan: {
    usageRule:
      "Pilih hanya dimensi yang benar-benar dilatih dan memiliki perilaku/bukti yang dapat diamati. Jangan otomatis memilih semua delapan dimensi.",
    claimRule:
      "Tanpa bukti observasi, gunakan bahasa 'menguatkan', 'melatih', atau 'memberi ruang berkembang'; jangan menyatakan dimensi sudah terbentuk atau konsisten.",

    dimensions: {
      keimananKetakwaan: {
        label: "Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa",
        phaseIndicators: {
          faseA: ["menunjukkan sikap santun", "mengikuti kebiasaan baik yang berlaku di sekolah", "menghargai sesama"],
          faseB: ["menghubungkan nilai kebaikan dengan tindakan sehari-hari", "menunjukkan tanggung jawab dan rasa syukur secara wajar"],
          faseC: ["mempertimbangkan nilai moral dalam pilihan tindakan", "menghargai keyakinan dan martabat orang lain sesuai konteks"]
        }
      },
      kewargaan: {
        label: "Kewargaan",
        phaseIndicators: {
          faseA: ["mematuhi aturan kelas", "menjaga milik bersama", "menghargai perbedaan sederhana"],
          faseB: ["berpartisipasi dalam tanggung jawab kelas", "menunjukkan kepedulian terhadap lingkungan dan sesama"],
          faseC: ["membahas masalah bersama secara tertib", "mengambil peran pada aksi kepedulian yang sesuai usia"]
        }
      },
      penalaranKritis: {
        label: "Penalaran Kritis",
        phaseIndicators: {
          faseA: ["mengajukan pertanyaan sederhana", "membandingkan berdasarkan ciri yang diamati", "memberi alasan sederhana"],
          faseB: ["menggunakan informasi untuk menjelaskan hubungan", "membedakan informasi yang relevan", "menyimpulkan dari bukti sederhana"],
          faseC: ["menganalisis informasi", "membandingkan alternatif", "menilai berdasarkan kriteria dan bukti"]
        }
      },
      kreativitas: {
        label: "Kreativitas",
        phaseIndicators: {
          faseA: ["mencoba lebih dari satu cara", "membuat representasi sederhana"],
          faseB: ["mengembangkan ide atau produk dengan variasi", "memodifikasi contoh menjadi bentuk baru yang relevan"],
          faseC: ["menghasilkan beberapa alternatif", "merevisi gagasan atau produk untuk meningkatkan kegunaan atau kualitas"]
        }
      },
      kolaborasi: {
        label: "Kolaborasi",
        phaseIndicators: {
          faseA: ["bergiliran", "berbagi alat", "menyelesaikan tugas sederhana bersama"],
          faseB: ["menjalankan peran kelompok", "mendengarkan dan menanggapi ide teman", "menyelesaikan bagian tugasnya"],
          faseC: ["membagi peran berdasarkan kebutuhan", "mengintegrasikan kontribusi anggota", "menyelesaikan perbedaan secara konstruktif"]
        }
      },
      kemandirian: {
        label: "Kemandirian",
        phaseIndicators: {
          faseA: ["menyiapkan alat", "menyelesaikan bagian tugas dengan bantuan sesuai kebutuhan", "memeriksa pekerjaan sederhana"],
          faseB: ["mengikuti rencana kerja", "meminta bantuan secara tepat", "memperbaiki kesalahan setelah umpan balik"],
          faseC: ["merencanakan langkah", "memantau kemajuan", "merevisi strategi dan bertanggung jawab terhadap hasil"]
        }
      },
      kesehatan: {
        label: "Kesehatan",
        phaseIndicators: {
          faseA: ["mempraktikkan kebiasaan bersih dan aman", "mengenali kebutuhan dasar tubuh"],
          faseB: ["menjelaskan pilihan kebiasaan sehat", "menjaga keamanan diri dan lingkungan saat aktivitas"],
          faseC: ["menilai kebiasaan yang mendukung kesehatan", "membuat keputusan sederhana terkait keseimbangan aktivitas dan kesehatan"]
        }
      },
      komunikasi: {
        label: "Komunikasi",
        phaseIndicators: {
          faseA: ["menyampaikan ide sederhana", "mendengarkan giliran bicara", "menggunakan gambar atau kata untuk menjelaskan"],
          faseB: ["menyampaikan informasi secara runtut", "mengajukan dan menjawab pertanyaan", "menyesuaikan bentuk komunikasi sederhana"],
          faseC: ["menjelaskan gagasan dengan alasan dan bukti", "menanggapi pendapat secara santun", "memilih bentuk komunikasi sesuai tujuan"]
        }
      }
    }
  },

  asesmen: {
    principles: [
      "asesmen harus selaras dengan tujuan dan bukti belajar",
      "gunakan bukti yang cukup sebelum menyimpulkan capaian",
      "umpan balik harus spesifik terhadap pekerjaan atau strategi",
      "jangan mengubah satu skor menjadi klaim kepribadian",
      "asesmen dapat berbentuk lisan, tertulis, praktik, produk, observasi, atau kombinasi"
    ],
    moments: {
      awal: {
        purpose: "mengetahui kesiapan, pengetahuan awal, atau prasyarat yang relevan",
        examples: ["pertanyaan pemantik", "tugas diagnostik singkat", "demonstrasi prasyarat", "diskusi pengetahuan awal"]
      },
      proses: {
        purpose: "memantau pemahaman dan memberi umpan balik selama belajar",
        examples: ["cek pemahaman", "observasi strategi", "draft produk", "pertanyaan alasan", "exit ticket"]
      },
      akhir: {
        purpose: "menilai bukti capaian setelah rangkaian belajar yang memadai",
        examples: ["tugas performa", "tes", "produk", "presentasi", "laporan", "portofolio terpilih"]
      }
    },
    evidenceQuality: {
      minimum: [
        "berkaitan langsung dengan tujuan",
        "dapat diamati atau diverifikasi",
        "cukup spesifik untuk memberi umpan balik"
      ],
      avoid: [
        "nilai tanpa indikator atau tujuan",
        "pujian umum sebagai satu-satunya bukti",
        "asumsi tentang kemampuan berdasarkan perilaku sesaat"
      ]
    }
  },

  scaffolding: {
    designRule:
      "Adaptasi diberikan berdasarkan kebutuhan belajar yang teramati, bukan label tetap tentang murid.",
    supports: {
      representasi: [
        "benda konkret",
        "gambar atau diagram",
        "contoh dikerjakan",
        "tabel atau organizer",
        "kosakata kunci"
      ],
      proses: [
        "memecah tugas menjadi langkah",
        "memberi checklist",
        "memberi pertanyaan penuntun",
        "latihan bersama sebelum mandiri",
        "waktu tambahan yang wajar"
      ],
      respons: [
        "jawaban lisan",
        "gambar atau model",
        "tulisan singkat",
        "praktik atau demonstrasi",
        "produk terstruktur"
      ]
    },
    fadingRule:
      "Kurangi bantuan bertahap ketika bukti menunjukkan murid sudah dapat melakukan bagian tugas secara mandiri."
  },

  kegiatanKontekstual: {
    meaningfulByPhase: {
      faseA: [
        "mengamati benda nyata di kelas atau lingkungan sekolah",
        "menghubungkan konsep dengan rutinitas rumah dan sekolah",
        "mengelompokkan atau membandingkan objek konkret",
        "membuat representasi sederhana dari pengalaman nyata",
        "mempraktikkan keterampilan dalam situasi yang dekat dengan keseharian"
      ],
      faseB: [
        "melakukan pengamatan terstruktur di sekolah atau rumah",
        "membandingkan data atau kejadian sehari-hari",
        "melakukan percobaan sederhana yang aman",
        "membuat model atau poster berbasis hasil pengamatan",
        "membahas solusi sederhana untuk masalah di lingkungan terdekat"
      ],
      faseC: [
        "melakukan investigasi sederhana berbasis pertanyaan",
        "mengolah tabel atau grafik sederhana dari data yang tersedia",
        "mewawancarai narasumber yang relevan dengan pertanyaan jelas",
        "merancang solusi atau produk sederhana untuk kebutuhan nyata",
        "menyusun laporan atau presentasi berdasarkan bukti yang dikumpulkan"
      ]
    }
  },

  languageEngine: {
    styleContract: {
      register: "bahasa guru Indonesia profesional, natural, hangat, konkret, tidak bombastis",
      personTerms: {
        planning: "murid",
        formalAlternative: "peserta didik",
        reportPreferred: "Ananda"
      },
      rules: [
        "utamakan kalimat aktif dan jelas",
        "hindari nominalisasi berlebihan seperti 'substansi materi' bila 'konsep' cukup",
        "hindari klaim absolut tanpa bukti",
        "hindari pengulangan frasa 'siswa diajak untuk' pada setiap kalimat",
        "satu kalimat idealnya membawa satu gagasan utama",
        "gunakan istilah teknis hanya bila membantu ketepatan",
        "jangan menyebut aktivitas sebagai metode jika secara kategori bukan metode"
      ]
    },

    openings: [
      "Guru membuka pembelajaran dengan mengaitkan topik dengan pengalaman yang dekat dengan murid.",
      "Pembelajaran dimulai dengan pertanyaan yang mengaktifkan pengetahuan awal murid.",
      "Guru menampilkan contoh konkret untuk memantik rasa ingin tahu dan mengetahui pemahaman awal murid.",
      "Murid diajak memahami tujuan pembelajaran dan kriteria keberhasilan sebelum memulai kegiatan inti.",
      "Kegiatan awal membantu murid mengingat pengetahuan prasyarat yang akan digunakan pada pembelajaran hari ini."
    ],

    transitions: [
      "Setelah pemahaman awal terbentuk, kegiatan berlanjut pada penerapan konsep.",
      "Berbekal hasil pengamatan, murid kemudian menggunakan informasi tersebut untuk menyelesaikan tugas berikutnya.",
      "Guru secara bertahap mengurangi bantuan ketika murid mulai menunjukkan pemahaman.",
      "Hasil diskusi menjadi dasar bagi murid untuk mencoba strategi pada konteks yang berbeda.",
      "Kegiatan berikutnya memberi kesempatan kepada murid untuk menguji pemahaman melalui bukti yang dapat diamati."
    ],

    closings: [
      "Murid merefleksikan apa yang sudah dipahami, bagian yang masih menantang, dan langkah yang akan dilakukan berikutnya.",
      "Guru dan murid meninjau kembali tujuan pembelajaran dengan menggunakan hasil kerja sebagai bukti.",
      "Pembelajaran ditutup dengan umpan balik singkat dan tindak lanjut yang sesuai dengan kebutuhan belajar.",
      "Murid membandingkan hasil pekerjaannya dengan kriteria keberhasilan lalu menentukan satu perbaikan yang perlu dilakukan.",
      "Guru menutup pembelajaran setelah memastikan murid mengetahui capaian hari ini dan langkah belajar selanjutnya."
    ],

    claimLexicon: {
      safeWithoutEvidence: [
        "dirancang untuk melatih",
        "memberi ruang bagi murid untuk",
        "mendukung penguatan",
        "memfasilitasi murid untuk",
        "memberikan kesempatan untuk"
      ],
      evidenceRequired: [
        "telah menguasai",
        "konsisten menunjukkan",
        "terbukti lebih efektif",
        "di atas rata-rata kelas",
        "menjadi teladan bagi teman",
        "memiliki gaya belajar",
        "cerdas",
        "lemah",
        "malas"
      ]
    },

    bannedGeneratorPhrases: [
      "substansi materi ini",
      "siswa diajak aplikatif",
      "pembentukan karakter terwujud",
      "sebagai penutup manis",
      "gerbang masuk ke dalam konsep baru",
      "energi dan antusiasme siswa disalurkan guna"
    ]
  },

  erapor: {
    evidencePolicy: {
      hardRules: [
        "deskripsi harus diturunkan dari bukti capaian yang diberikan engine pemanggil",
        "jangan menyebut peringkat, rata-rata kelas, gaya belajar, kecerdasan, diagnosis, atau sifat menetap tanpa bukti dan kewenangan yang tepat",
        "jangan menyatakan suatu strategi 'terbukti membantu' murid tertentu hanya berdasarkan template",
        "utamakan kompetensi yang paling kuat dan satu area prioritas pengembangan yang spesifik",
        "saran tindak lanjut harus terkait langsung dengan kompetensi yang perlu dikembangkan"
      ],
      requiredEvidenceFields: ["materiAtauTP", "statusCapaian"],
      optionalEvidenceFields: ["strengthEvidence", "developmentEvidence", "teacherObservation", "nextStep"]
    },

    achievementStates: {
      sangatBaik: {
        id: "sangat_baik",
        sentencePlans: [
          "Ananda menunjukkan capaian sangat baik dalam {kompetensi}, terlihat dari {bukti}.",
          "Pada {materi}, Ananda mampu {kompetensi} dengan sangat baik berdasarkan {bukti}."
        ]
      },
      tercapai: {
        id: "tercapai",
        sentencePlans: [
          "Ananda telah mencapai kompetensi dalam {kompetensi}, ditunjukkan melalui {bukti}.",
          "Pada {materi}, Ananda mampu {kompetensi} sesuai kriteria yang digunakan, berdasarkan {bukti}."
        ]
      },
      berkembang: {
        id: "berkembang",
        sentencePlans: [
          "Kemampuan Ananda dalam {kompetensi} sedang berkembang. Bukti saat ini menunjukkan {bukti}.",
          "Pada {materi}, Ananda mulai mampu {kompetensi}; penguatan berikutnya dapat difokuskan pada {tindakLanjut}."
        ]
      },
      perluBimbingan: {
        id: "perlu_bimbingan",
        sentencePlans: [
          "Ananda masih memerlukan bimbingan dalam {kompetensi}. Berdasarkan {bukti}, latihan berikutnya perlu difokuskan pada {tindakLanjut}.",
          "Pada {materi}, kemampuan {kompetensi} perlu diperkuat secara bertahap melalui {tindakLanjut}."
        ]
      }
    },

    humanToneRules: [
      "bahasa tetap menghargai murid tanpa menutupi kebutuhan pengembangan",
      "hindari label negatif",
      "hindari pujian generik yang tidak terkait bukti",
      "hindari kalimat terlalu panjang atau berbunga-bunga",
      "gunakan 'Ananda' secara wajar dan tidak diulang pada setiap klausa"
    ]
  },

  documentSchemas: {
    modulAjar: {
      id: "modul_ajar",
      requiredInputs: [
        "kelasAtauFase",
        "mataPelajaran",
        "materiAtauUnit",
        "cpAtauTp",
        "alokasiWaktu"
      ],
      recommendedInputs: [
        "kondisiAwalMurid",
        "sumberDaya",
        "konteksSekolah",
        "targetProfilLulusan"
      ],
      requiredPlanComponents: [
        "tujuan",
        "buktiBelajar",
        "pendekatanPembelajaran",
        "modelPembelajaran",
        "metodePembelajaran",
        "mediaPembelajaran",
        "memahami",
        "mengaplikasi",
        "merefleksi",
        "asesmen",
        "tindakLanjut"
      ],
      hardRules: [
        "pendekatanPembelajaran harus memuat Pembelajaran Mendalam bila mode PM dipilih",
        "modelPembelajaran tidak boleh bernama Pembelajaran Mendalam",
        "jika model memiliki sintaks, urutan kegiatan harus memuat inti sintaks tersebut",
        "asesmen harus mengukur bukti yang selaras dengan tujuan",
        "kegiatan harus realistis terhadap alokasi waktu"
      ]
    },

    prota: {
      id: "program_tahunan",
      requiredInputs: [
        "tahunPelajaran",
        "mataPelajaran",
        "kelasAtauFase",
        "cpAtpTp",
        "alokasiJamTahunan",
        "kalenderPendidikanAtauMingguEfektif"
      ],
      hardRules: [
        "jangan mengarang minggu efektif",
        "jangan mengarang alokasi JP resmi jika tidak diberikan sumber atau konfigurasi",
        "distribusi waktu harus dapat dijumlahkan kembali ke total yang tersedia",
        "urutkan unit atau TP berdasarkan dependensi/prasyarat bila tersedia"
      ]
    },

    promes: {
      id: "program_semester",
      requiredInputs: [
        "semester",
        "hasilProtaAtauDistribusiTahunan",
        "mingguEfektifSemester",
        "tpAtauUnitSemester"
      ],
      hardRules: [
        "jumlah waktu promes tidak boleh melebihi waktu semester yang tersedia",
        "hari libur, asesmen, dan agenda sekolah hanya dimasukkan bila data tersedia",
        "jangan menciptakan tanggal kalender yang tidak diberikan"
      ]
    },

    silabus: {
      id: "silabus_operasional",
      requiredInputs: [
        "mataPelajaran",
        "kelasAtauFase",
        "cpAtauTp",
        "materiAtauLingkup",
        "alokasiWaktu"
      ],
      hardRules: [
        "jangan mengklaim satu bentuk tabel sebagai format nasional wajib",
        "setiap aktivitas dan asesmen harus ditautkan pada tujuan atau kompetensi"
      ]
    },

    deskripsiKokurikuler: {
      id: "deskripsi_kokurikuler",
      requiredInputs: ["kegiatan", "targetDimensi", "evidenceObservasi"],
      hardRules: [
        "jangan mengarang kontribusi atau perilaku murid",
        "gunakan hanya dimensi yang benar-benar memiliki bukti kegiatan",
        "deskripsi harus membedakan tujuan kegiatan dan capaian murid"
      ]
    },

    deskripsiERapor: {
      id: "deskripsi_erapor",
      requiredInputs: ["materiAtauTP", "statusCapaian", "evidence"],
      hardRules: [
        "tidak boleh dihasilkan final tanpa evidence",
        "tidak boleh menggunakan klaim psikologis atau perbandingan sosial tanpa data sah"
      ]
    },

    lkpdRubrik: {
      id: "lkpd_rubrik",
      requiredInputs: [
        "kelasAtauFase",
        "mataPelajaran",
        "materiAtauUnit"
      ],
      recommendedInputs: [
        "tujuanPembelajaran",
        "lkpdAktivitas",
        "lkpdAlatBahan",
        "lkpdPetunjuk",
        "rubrikModel",
        "rubrikKriteria"
      ],
      hardRules: [
        "aktivitas LKPD harus kontekstual dan sesuai dengan fase peserta didik",
        "rubrik penilaian harus memiliki kriteria yang terukur dan objektif"
      ]
    }
  },

  compatibilityRules: {
    approachModelSeparation: {
      invalidModelNames: ["pembelajaran mendalam", "deep learning"],
      message:
        "Pembelajaran Mendalam adalah pendekatan. Pilih model bersintaks yang sesuai tujuan pembelajaran."
    },
    modelSyntaxRequired: true,
    projectProductRule:
      "PjBL harus memiliki produk/performa yang menjadi bukti kompetensi; kerajinan dekoratif tanpa kaitan tujuan tidak cukup.",
    problemAuthenticityRule:
      "PBL memerlukan masalah yang menuntut penalaran atau keputusan; soal rutin berbalut cerita tidak otomatis PBL.",
    joyfulRule:
      "Menggembirakan tidak mensyaratkan permainan; rasa aman, tantangan yang sesuai, penghargaan, pilihan, dan keterlibatan adalah indikator yang sah.",
    mindfulRule:
      "Berkesadaran tidak boleh direduksi menjadi latihan napas/hening; inti utamanya tujuan, keaktifan, strategi, motivasi, dan regulasi diri.",
    digitalRule:
      "Digital digunakan bila bernilai tambah dan tersedia; selalu pertimbangkan alternatif offline."
  },

  antiHallucination: {
    hardStops: [
      {
        id: "missing_cp_tp",
        appliesTo: ["modul_ajar", "program_tahunan", "program_semester", "silabus_operasional"],
        condition: "cpAtauTp_missing",
        action: "block_final_generation",
        message: "CP/TP belum tersedia dari input atau corpus kurikulum yang tervalidasi."
      },
      {
        id: "missing_calendar",
        appliesTo: ["program_tahunan", "program_semester"],
        condition: "calendar_or_effective_weeks_missing",
        action: "block_calendar_claims",
        message: "Kalender atau minggu efektif belum tersedia; GADM tidak boleh mengarang tanggal atau minggu efektif."
      },
      {
        id: "missing_erapor_evidence",
        appliesTo: ["deskripsi_erapor"],
        condition: "evidence_missing",
        action: "block_final_generation",
        message: "Deskripsi e-Rapor memerlukan bukti capaian yang dapat diverifikasi."
      },
      {
        id: "unknown_regulation",
        appliesTo: ["all"],
        condition: "requested_current_regulation_not_verified",
        action: "flag_for_verification",
        message: "Klaim regulasi terkini harus diverifikasi sebelum ditampilkan sebagai fakta."
      }
    ],
    forbiddenInferences: [
      "gaya belajar tetap",
      "tingkat kecerdasan",
      "diagnosis kesehatan atau psikologis",
      "kepribadian berdasarkan satu tugas",
      "posisi terhadap rata-rata kelas tanpa data kelas",
      "dukungan keluarga yang tidak diberikan",
      "ketersediaan fasilitas yang tidak diberikan"
    ]
  },

  generationPolicies: {
    selectFewNotAll: {
      profileDimensionsDefaultMax: 3,
      methodsDefaultRange: [1, 3],
      mediaDefaultRange: [1, 4]
    },
    feasibility: {
      faseA: {
        maxNewComplexDirectionsPerActivity: 3,
        defaultReflectionMinutes: [3, 8]
      },
      faseB: {
        maxNewComplexDirectionsPerActivity: 5,
        defaultReflectionMinutes: [5, 10]
      },
      faseC: {
        maxNewComplexDirectionsPerActivity: 7,
        defaultReflectionMinutes: [5, 15]
      }
    },
    variability: {
      mechanism: "deterministic_seeded_selection",
      reason:
        "variasi bahasa harus dapat direproduksi untuk input yang sama bila seed sama, sehingga output lebih mudah diuji dan diaudit"
    }
  }
};

// ============================================================================
// V6 TEACHER INTELLIGENCE EXTENSIONS
// ============================================================================
// Semua bagian di bawah memperluas v5 tanpa memutus API lama. Tidak ada API
// eksternal, network call, random non-deterministik, atau fallback yang mengarang
// fakta kurikulum.

Object.assign(GADM_KB, {
  documentLayoutStandards: {
    modulAjar: {
      status: "Format fleksibel; bukan formulir nasional yang wajib diseragamkan.",
      basis: "Struktur mengikuti Panduan Pembelajaran dan Asesmen 2025: identifikasi, desain pembelajaran, pengalaman belajar, dan asesmen.",
      officialSource: "https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf",
      sourcePages: [38, 39, 40]
    },
    prota: {
      status: "Format kerja operasional yang lazim digunakan guru.",
      basis: "Identitas, semester, lingkup materi/TP, alokasi JP, dan keterangan disusun dari kalender pendidikan serta distribusi tahunan yang diberikan guru.",
      referenceSource: "https://repositori.kemendikdasmen.go.id/11319/1/000005-k13-ks-1-1-mod-sd-180331.pdf"
    },
    promes: {
      status: "Format kerja operasional yang lazim digunakan guru.",
      basis: "Identitas, bulan/minggu, TP/unit, alokasi JP, asesmen, dan keterangan diturunkan dari Prota serta kalender pendidikan yang diberikan guru.",
      referenceSource: "https://repositori.kemendikdasmen.go.id/11319/1/000005-k13-ks-1-1-mod-sd-180331.pdf"
    },
    silabus: {
      status: "Format Silabus/ATP operasional yang fleksibel.",
      basis: "Tujuan disusun sistematis dan logis dalam satu fase, lalu dipetakan ke lingkup materi, aktivitas, asesmen, media/sumber, dan alokasi waktu.",
      referenceSource: "https://guru.kemendikdasmen.go.id/bukti-karya/pdf/359214"
    }
  },
  curriculumTruth: {
    policy: {
      mode: "verified_provenance_first",
      officialTextRule:
        "Teks CP yang ditampilkan sebagai CP resmi harus berasal dari record tervalidasi yang memuat sourceId, decisionNumber, effectiveFrom, phase, subjectId, dan officialText.",
      noFabricationRule:
        "Jika record CP resmi tidak tersedia, GADM boleh menerima CP/TP eksplisit dari guru tetapi tidak boleh menamainya sebagai CP resmi yang diverifikasi.",
      sourceRoutingRule:
        "Agama dan Budi Pekerti dirutekan ke perubahan 020/2026; mata pelajaran lain menggunakan 046/H/KR/2025 sampai terdapat sumber resmi pengganti yang diverifikasi.",
      recordMutation: "build_time_or_explicit_verified_import_only",
      coverage: {
        sourceRoutingReady: true,
        embeddedOfficialCpRecords: GADM_CURRICULUM_2026.records.length,
        autoFillOfficialCp: true,
        reason: "Corpus SD Fase A-C diekstrak dari keputusan resmi, disimpan bersama provenance, dan tidak mencampurkan TP turunan dengan teks CP resmi."
      }
    },
    sourceSnapshot: {
      verifiedAt: "2026-09-01",
      sources: {
        cp_046_2025: {
          id: "cp_046_2025",
          authority: "Kementerian Pendidikan Dasar dan Menengah / BSKAP",
          decisionNumber: "046/H/KR/2025",
          officialUrl: GADM_CURRICULUM_2026.sources.cp_046_2025.officialUrl,
          sha256: GADM_CURRICULUM_2026.sources.cp_046_2025.sha256,
          effectiveFrom: "2025-07-16",
          role: "CP semua mata pelajaran kecuali cakupan yang kemudian diubah",
          status: "active_except_amended_scope",
          verification: "official_kemendikdasmen_source"
        },
        cp_020_2026: {
          id: "cp_020_2026",
          authority: "Kementerian Pendidikan Dasar dan Menengah / BKPDM",
          decisionNumber: "020 Tahun 2026",
          officialNoticeUrl: GADM_CURRICULUM_2026.sources.cp_020_2026.officialNoticeUrl,
          effectiveFrom: "2026-06-11",
          role: "perubahan CP Agama dan Budi Pekerti",
          scope: "agama_dan_budi_pekerti_only",
          status: "active",
          verification: "official_kemendikdasmen_source"
        },
        standard_process_1_2026: {
          id: "standard_process_1_2026",
          authority: "Kementerian Pendidikan Dasar dan Menengah",
          regulationNumber: "Permendikdasmen Nomor 1 Tahun 2026",
          role: "standar proses",
          effectiveFrom: "2026-01-05",
          status: "active"
        },
        curriculum_13_2025: {
          id: "curriculum_13_2025",
          authority: "Kementerian Pendidikan Dasar dan Menengah",
          regulationNumber: "Permendikdasmen Nomor 13 Tahun 2025",
          role: "penyesuaian kurikulum dan penerapan pendekatan Pembelajaran Mendalam",
          status: "active_reference"
        }
      }
    },
    subjectCatalog: {
      bahasa_indonesia: { label: "Bahasa Indonesia", aliases: ["bahasa indonesia", "b. indonesia", "bind"], sourceId: "cp_046_2025" },
      matematika: { label: "Matematika", aliases: ["matematika", "mtk"], sourceId: "cp_046_2025" },
      pendidikan_pancasila: { label: "Pendidikan Pancasila", aliases: ["pendidikan pancasila", "pancasila", "ppkn", "pkn"], sourceId: "cp_046_2025" },
      ipas: { label: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", aliases: ["ipas", "ilmu pengetahuan alam dan sosial"], sourceId: "cp_046_2025" },
      pjok: { label: "Pendidikan Jasmani, Olahraga, dan Kesehatan", aliases: ["pjok", "penjas", "pendidikan jasmani"], sourceId: "cp_046_2025" },
      seni_rupa: { label: "Seni Rupa", aliases: ["seni rupa"], sourceId: "cp_046_2025" },
      seni_musik: { label: "Seni Musik", aliases: ["seni musik", "musik"], sourceId: "cp_046_2025" },
      seni_tari: { label: "Seni Tari", aliases: ["seni tari", "tari"], sourceId: "cp_046_2025" },
      seni_teater: { label: "Seni Teater", aliases: ["seni teater", "teater"], sourceId: "cp_046_2025" },
      bahasa_inggris: { label: "Bahasa Inggris", aliases: ["bahasa inggris", "english", "bing"], sourceId: "cp_046_2025" },
      koding_ka: { label: "Koding dan Kecerdasan Artifisial", aliases: ["koding", "coding", "kecerdasan artifisial", "ka", "komputer"], sourceId: "cp_046_2025", availabilityRule: "verify_phase_and_school_provision" },
      pendidikan_agama_islam: { label: "Pendidikan Agama Islam dan Budi Pekerti", aliases: ["pai", "pendidikan agama islam", "agama islam"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      pendidikan_agama_kristen: { label: "Pendidikan Agama Kristen dan Budi Pekerti", aliases: ["pak", "agama kristen"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      pendidikan_agama_katolik: { label: "Pendidikan Agama Katolik dan Budi Pekerti", aliases: ["agama katolik"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      pendidikan_agama_hindu: { label: "Pendidikan Agama Hindu dan Budi Pekerti", aliases: ["agama hindu"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      pendidikan_agama_buddha: { label: "Pendidikan Agama Buddha dan Budi Pekerti", aliases: ["agama buddha"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      pendidikan_agama_khonghucu: { label: "Pendidikan Agama Khonghucu dan Budi Pekerti", aliases: ["agama khonghucu", "khonghucu"], sourceId: "cp_020_2026", category: "agama_dan_budi_pekerti" },
      bahasa_arab: { label: "Bahasa Arab", aliases: ["bahasa arab", "arab"], sourceId: "school_or_local_verified_source", availabilityRule: "school_specific_do_not_claim_national_cp_without_source" },
      bahasa_sunda: { label: "Bahasa Sunda", aliases: ["bahasa sunda", "sunda"], sourceId: "school_or_local_verified_source", availabilityRule: "school_specific_do_not_claim_national_cp_without_source" },
      btq: { label: "Baca Tulis Al-Qur'an", aliases: ["btq", "baca tulis al-quran", "baca tulis al-qur'an"], sourceId: "school_or_local_verified_source", availabilityRule: "school_specific_do_not_claim_national_cp_without_source" },
      murojaah: { label: "Murojaah", aliases: ["murojaah", "murajaah", "tahfiz", "tahfidz"], sourceId: "school_or_local_verified_source", availabilityRule: "school_specific_do_not_claim_national_cp_without_source" }
    },
    records: GADM_CURRICULUM_2026.records,
    requiredRecordFields: [
      "id",
      "subjectId",
      "phase",
      "officialText",
      "sourceId",
      "decisionNumber",
      "effectiveFrom"
    ],
    provenanceRules: [
      "record CP harus menunjuk sourceId yang dikenal atau sumber sekolah/lokal yang eksplisit",
      "phase harus Fase A/B/C untuk GADM SD",
      "officialText tidak boleh dibentuk dari template",
      "parafrase boleh digunakan untuk penjelasan internal tetapi tidak boleh diberi label teks CP resmi",
      "perubahan regulasi tidak boleh menimpa record lama; gunakan version/effectiveFrom dan status"
    ]
  },

  teacherContextIntelligence: {
    philosophy:
      "Guru memasukkan fakta kelas; GADM memilih dukungan pedagogis. Konteks tidak boleh berubah menjadi label tetap tentang murid.",
    contexts: {
      heterogeneousReadiness: {
        id: "heterogeneous_readiness",
        label: "Kemampuan/kesiapan murid beragam",
        triggers: ["beragam", "heterogen", "kemampuan berbeda", "kesiapan berbeda"],
        preferMethods: ["latihanTerbimbing", "diskusi", "praktik"],
        preferSupports: ["memecah tugas menjadi langkah", "memberi checklist", "memberi pertanyaan penuntun", "latihan bersama sebelum mandiri"],
        rules: ["sediakan satu tujuan yang sama dengan variasi tingkat bantuan", "hindari mengelompokkan murid dengan label kemampuan tetap"]
      },
      readingSupportNeeded: {
        id: "reading_support_needed",
        label: "Sebagian murid memerlukan dukungan membaca",
        triggers: ["bantuan membaca", "belum lancar membaca", "kesulitan membaca", "dukungan membaca"],
        preferMethods: ["membacaTerbimbing", "demonstrasi", "tanyaJawab"],
        preferSupports: ["kosakata kunci", "gambar atau diagram", "contoh dikerjakan", "memecah tugas menjadi langkah"],
        rules: ["ringkaskan instruksi tertulis", "sediakan representasi visual atau lisan tanpa mengurangi target kompetensi yang tidak terkait membaca"]
      },
      highlyActiveClass: {
        id: "highly_active_class",
        label: "Kelas sangat aktif",
        triggers: ["sangat aktif", "kelas aktif", "sulit diam"],
        preferMethods: ["praktik", "observasi", "diskusi"],
        preferSupports: ["memberi checklist", "memecah tugas menjadi langkah"],
        rules: ["gunakan transisi singkat dan peran yang jelas", "salurkan gerak ke aktivitas bermakna; jangan menghukum kebutuhan bergerak dengan tugas pasif berlebihan"]
      },
      limitedResources: {
        id: "limited_resources",
        label: "Sarana belajar terbatas",
        triggers: ["sarana terbatas", "tanpa lcd", "tanpa internet", "alat terbatas", "fasilitas terbatas"],
        preferMethods: ["observasi", "demonstrasi", "praktik", "tanyaJawab"],
        preferMediaByPhase: {
          faseA: ["benda konkret", "papan tulis", "lingkungan kelas atau sekolah"],
          faseB: ["benda konkret dan model", "kartu informasi", "lingkungan sekolah"],
          faseC: ["teks dan sumber informasi terpilih", "lingkungan sekolah atau masyarakat", "lembar data"]
        },
        avoidMediaSignals: ["wajib internet", "wajib gawai pribadi"],
        rules: ["pilih media yang benar-benar tersedia", "digital hanya digunakan bila bernilai tambah dan memiliki alternatif offline"]
      },
      largeClass: {
        id: "large_class",
        label: "Jumlah murid besar",
        triggers: ["kelas besar", "murid banyak", "jumlah siswa banyak"],
        preferMethods: ["demonstrasi", "latihanTerbimbing", "diskusi"],
        preferModels: ["cooperative_learning"],
        preferSupports: ["memberi checklist", "contoh dikerjakan"],
        rules: ["gunakan kelompok dengan peran jelas", "asesmen formatif harus memungkinkan guru memindai banyak bukti secara efisien"]
      },
      mixedDeviceAccess: {
        id: "mixed_device_access",
        label: "Akses perangkat digital tidak merata",
        triggers: ["gawai terbatas", "perangkat tidak merata", "tidak semua punya hp", "device terbatas"],
        preferMethods: ["diskusi", "praktik", "observasi"],
        rules: ["jangan menjadikan perangkat pribadi sebagai prasyarat", "jika digital dipakai, gunakan skema berbagi perangkat atau alternatif analog"]
      }
    }
  },

  timeIntelligence: {
    policy: {
      defaultMinutesPerJP: 35,
      defaultIsHeuristicNotRegulatoryClaim: true,
      explicitInputWins: true,
      exactTotalRule: "Jumlah segmen wajib sama dengan total waktu yang tersedia.",
      noSilentOverflow: true
    },
    segments: ["pendahuluan", "memahami", "mengaplikasi", "merefleksi", "penutup"],
    weightsByPhase: {
      faseA: { pendahuluan: 0.12, memahami: 0.28, mengaplikasi: 0.38, merefleksi: 0.10, penutup: 0.12 },
      faseB: { pendahuluan: 0.10, memahami: 0.24, mengaplikasi: 0.44, merefleksi: 0.12, penutup: 0.10 },
      faseC: { pendahuluan: 0.09, memahami: 0.22, mengaplikasi: 0.46, merefleksi: 0.14, penutup: 0.09 }
    },
    modelAdjustments: {
      explicit_instruction: { memahami: 0.05, mengaplikasi: 0.02, merefleksi: -0.02, pendahuluan: -0.02, penutup: -0.03 },
      inquiry: { memahami: 0.01, mengaplikasi: 0.05, merefleksi: 0.02, pendahuluan: -0.03, penutup: -0.05 },
      discovery_learning: { memahami: 0.02, mengaplikasi: 0.04, merefleksi: 0.01, pendahuluan: -0.03, penutup: -0.04 },
      problem_based_learning: { memahami: 0.00, mengaplikasi: 0.07, merefleksi: 0.02, pendahuluan: -0.04, penutup: -0.05 },
      project_based_learning: { memahami: -0.03, mengaplikasi: 0.10, merefleksi: 0.02, pendahuluan: -0.04, penutup: -0.05 },
      cooperative_learning: { memahami: 0.00, mengaplikasi: 0.04, merefleksi: 0.01, pendahuluan: -0.02, penutup: -0.03 }
    },
    feasibilityRules: [
      "jika total waktu kurang dari 35 menit, jangan memaksakan semua sintaks model kompleks dalam satu pertemuan",
      "PjBL multi-tahap boleh melintasi beberapa pertemuan; jangan merapatkan proyek hanya agar muat satu pertemuan",
      "pengalaman memahami, mengaplikasi, dan merefleksi dapat tersebar pada rangkaian pertemuan selama hubungan antarpertemuan eksplisit",
      "waktu alat/transisi harus diperhitungkan ketika konteks menyatakan alat kompleks atau perpindahan lokasi"
    ]
  },

  decisionExplanations: {
    reasonCodes: {
      FOUNDATIONAL_SKILL: "Tujuan memerlukan fondasi atau prosedur yang jelas sebelum transfer lebih kompleks.",
      EVIDENCE_COLLECTION_REQUIRED: "Tujuan meminta murid mengamati, mengumpulkan, atau menggunakan bukti.",
      PATTERN_DISCOVERY: "Tujuan meminta murid menemukan pola, hubungan, kategori, atau generalisasi dari contoh/data.",
      AUTHENTIC_PROBLEM: "Tujuan berpusat pada masalah yang membutuhkan penalaran atau pilihan strategi, bukan soal rutin.",
      PRODUCT_REQUIRED: "Bukti belajar berupa produk/performa yang dikembangkan melalui beberapa tahap dan dapat direvisi.",
      COLLABORATIVE_CONTRIBUTION: "Bukti belajar mendapat manfaat dari kontribusi dan akuntabilitas kelompok yang dapat diamati.",
      CONCRETE_REPRESENTATION: "Konsep lebih aman dipahami melalui benda/model/representasi konkret sesuai fase dan konteks.",
      LIMITED_RESOURCES: "Sarana yang tersedia mengutamakan media sederhana, nyata, dan dapat digunakan tanpa internet.",
      READING_SUPPORT: "Instruksi dan representasi perlu mengurangi beban baca yang tidak relevan dengan target kompetensi.",
      PROFILE_EVIDENCE: "Dimensi dipilih karena terdapat aktivitas atau bukti yang secara langsung melatih perilaku terkait.",
      ASSESSMENT_ALIGNMENT: "Bentuk asesmen dipilih karena paling langsung memperlihatkan kompetensi yang dituju.",
      PHASE_COMPLEXITY: "Kompleksitas tugas disesuaikan dengan fase tanpa mengunci murid pada KKO tingkat rendah."
    },
    displayPolicy: {
      maxReasonsDefault: 3,
      explainWhatNotWhyPerson: true,
      tone: "singkat, profesional, mudah dipahami guru, tanpa jargon yang tidak perlu"
    }
  },

  documentRelations: {
    principle: "Satu fakta kurikulum tidak boleh diketik ulang menjadi versi berbeda di setiap dokumen.",
    graph: {
      curriculum: { provides: ["cp", "phase", "subject"] },
      tp_atp: { consumes: ["cp"], provides: ["tp", "sequence", "prerequisites"] },
      prota: { consumes: ["tp", "sequence", "annual_time_basis"], provides: ["annual_distribution"] },
      promes: { consumes: ["annual_distribution", "semester_effective_time"], provides: ["semester_distribution"] },
      silabus: { consumes: ["cp_or_tp", "scope", "time_basis"], provides: ["learning_outline", "assessment_outline"] },
      modulAjar: { consumes: ["tp", "semester_distribution_optional", "class_context"], provides: ["learning_plan", "assessment_plan", "evidence_targets"] },
      assessmentEvidence: { consumes: ["evidence_targets"], provides: ["verified_student_evidence"] },
      deskripsiERapor: { consumes: ["tp", "verified_student_evidence"], provides: ["evidence_grounded_description"] },
      kokurikuler: { consumes: ["activity", "target_dimensions", "observed_evidence"], provides: ["kokurikuler_description"] }
    },
    consistencyKeys: ["tahunPelajaran", "semester", "kelasAtauFase", "mataPelajaran", "tpId", "cpId"],
    hardRules: [
      "dokumen turunan tidak boleh mengubah teks/ID CP sumber secara diam-diam",
      "Promes tidak boleh memiliki distribusi semester yang bertentangan dengan Prota kecuali ada revisi eksplisit",
      "Modul Ajar yang ditautkan ke TP harus menggunakan TP yang sama atau revisi yang tercatat",
      "Deskripsi e-Rapor hanya boleh memakai evidence yang terkait TP/kompetensi yang dideskripsikan"
    ]
  },

  profileSelectionRules: [
    { dimension: "penalaranKritis", signals: ["bukti", "data", "menganalisis", "membandingkan", "alasan", "menyimpulkan", "masalah", "menilai"] },
    { dimension: "kreativitas", signals: ["merancang", "mencipta", "membuat", "alternatif", "modifikasi", "produk", "karya", "ide baru"] },
    { dimension: "kolaborasi", signals: ["kelompok", "kolaborasi", "peran", "bersama", "diskusi", "kontribusi"] },
    { dimension: "kemandirian", signals: ["mandiri", "target", "rencana", "strategi", "memantau", "merevisi strategi", "tanggung jawab"] },
    { dimension: "komunikasi", signals: ["presentasi", "menjelaskan", "mengomunikasikan", "wawancara", "menanggapi", "menyampaikan"] },
    { dimension: "kewargaan", signals: ["aturan", "lingkungan", "masyarakat", "kepedulian", "milik bersama", "tanggung jawab bersama"] },
    { dimension: "kesehatan", signals: ["kesehatan", "kebersihan", "aman", "keselamatan", "tubuh", "olahraga", "kebugaran"] },
    { dimension: "keimananKetakwaan", signals: ["agama", "ibadah", "syukur", "tuhan", "akhlak", "moral", "nilai kebaikan"] }
  ],

  qualityInspector: {
    statusOrder: ["pass", "warning", "fail"],
    checks: [
      "phase_consistency",
      "curriculum_grounding",
      "objective_evidence_alignment",
      "approach_model_separation",
      "model_syntax",
      "method_feasibility",
      "media_feasibility",
      "time_budget",
      "assessment_alignment",
      "profile_evidence",
      "deep_learning_experiences",
      "hallucination_guard"
    ],
    scoring: { pass: 1, warning: 0.5, fail: 0 },
    readyRule: "ready hanya bila tidak ada fail; warning menghasilkan status review kecuali seluruh warning informasional",
    repairPolicy: {
      autoRepairAllowed: ["time_rounding", "duplicate_dimension", "language_repetition"],
      approvalRequired: ["model_change", "method_change", "media_change", "time_reallocation_material"],
      neverAutoRepair: ["cp_text", "tp_text", "student_evidence", "calendar_dates", "official_jp_allocation"]
    }
  },

  repairRules: {
    TIME_OVERFLOW: { action: "reallocate_time", requiresTeacherApproval: false, preservesFacts: true },
    MODEL_PHASE_MISMATCH: { action: "recommend_alternative_model", requiresTeacherApproval: true, preservesFacts: true },
    MODEL_SYNTAX_INCOMPLETE: { action: "complete_from_registered_model_syntax", requiresTeacherApproval: false, preservesFacts: true },
    PROFILE_WITHOUT_EVIDENCE: { action: "remove_or_request_evidence", requiresTeacherApproval: true, preservesFacts: true },
    CP_TP_MISSING: { action: "request_verified_curriculum_input", requiresTeacherApproval: true, preservesFacts: true },
    ERAPOR_EVIDENCE_MISSING: { action: "request_evidence", requiresTeacherApproval: true, preservesFacts: true }
  },

  // Compatibility arrays diwajibkan MES Pasal 4. Isinya merupakan fragmen yang
  // sudah dikoreksi agar tidak mereduksi mindful menjadi sekadar relaksasi.
  mindfulLearning: [
    { phases: ["faseA"], text: "murid mengetahui tujuan sederhana pembelajaran dan menunjukkan kesiapan untuk mengikuti langkah kegiatan" },
    { phases: ["faseA"], text: "murid menyebutkan apa yang sudah diketahui dan memilih satu cara sederhana untuk memulai tugas" },
    { phases: ["faseB"], text: "murid menghubungkan tujuan belajar dengan pengetahuan awal serta menyebutkan strategi yang akan digunakan" },
    { phases: ["faseB"], text: "murid memantau pemahamannya melalui pertanyaan singkat tentang bagian yang sudah dan belum dipahami" },
    { phases: ["faseC"], text: "murid menetapkan target belajar, memilih strategi, dan memeriksa kemajuannya selama kegiatan" },
    { phases: ["faseC"], text: "murid mengenali strategi yang berhasil dan menentukan penyesuaian ketika menemui kesulitan" }
  ],
  meaningfulLearning: [
    { phases: ["faseA"], text: "menghubungkan konsep dengan benda, kejadian, atau rutinitas yang dekat dengan kehidupan murid" },
    { phases: ["faseB"], text: "menggunakan hasil pengamatan atau percobaan sederhana untuk menjelaskan kejadian di rumah atau sekolah" },
    { phases: ["faseC"], text: "menerapkan konsep untuk menganalisis situasi nyata dan menyusun solusi atau keputusan berbasis bukti" }
  ],
  joyfulLearning: [
    { phases: ["faseA"], text: "memberikan pilihan sederhana, rasa aman untuk mencoba, dan apresiasi terhadap usaha murid" },
    { phases: ["faseB"], text: "menghadirkan tantangan yang sesuai, interaksi positif, dan kesempatan berbagi hasil tanpa mempermalukan kesalahan" },
    { phases: ["faseC"], text: "memberikan tantangan autentik, ruang memilih strategi, umpan balik konstruktif, dan kesempatan memperbaiki hasil" }
  ],
  growthMindset: [
    "Kemampuan Ananda sedang berkembang; penguatan berikutnya difokuskan pada langkah yang masih memerlukan bantuan berdasarkan bukti yang tersedia.",
    "Ananda telah menunjukkan kemajuan pada bagian yang dikuasai dan masih memerlukan latihan terarah pada kompetensi yang belum konsisten.",
    "Bukti belajar menunjukkan adanya perkembangan. Pendampingan berikutnya diarahkan pada strategi yang spesifik dan dapat dipraktikkan kembali."
  ]
});


/**
 * Mengubah kelas/fase menjadi ID fase yang dikenali KB.
 * @param {string|number} value
 * @returns {"faseA"|"faseB"|"faseC"|null}
 */
export function resolvePhase(value) {
  if (value == null) return null;

  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const kelas = Number(value);
    if (kelas === 1 || kelas === 2) return "faseA";
    if (kelas === 3 || kelas === 4) return "faseB";
    if (kelas === 5 || kelas === 6) return "faseC";
    return null;
  }

  const normalizedText = normalizeText(value).toLowerCase();
  const compact = normalizedText.replace(/\s+/g, "");
  if (/\bfase\s*a\b/.test(normalizedText) || ["fasea", "a"].includes(compact)) return "faseA";
  if (/\bfase\s*b\b/.test(normalizedText) || ["faseb", "b"].includes(compact)) return "faseB";
  if (/\bfase\s*c\b/.test(normalizedText) || ["fasec", "c"].includes(compact)) return "faseC";
  const classMatch = normalizedText.match(/(?:kelas\s*)?([1-6])(?:\s*[a-z])?\b/);
  if (classMatch) {
    const grade = Number(classMatch[1]);
    if (grade <= 2) return "faseA";
    if (grade <= 4) return "faseB";
    return "faseC";
  }
  return null;
}

/**
 * Menghasilkan rekomendasi model berbasis kata kunci intent. Fungsi ini tidak
 * menggantikan judgment planner; ia menyaring kandidat secara deterministik.
 * @param {object} context
 * @returns {Array<object>}
 */
export function recommendModels(context = {}) {
  const phase = resolvePhase(context.phase ?? context.fase ?? context.kelas);
  const intentText = [
    context.intent,
    context.tujuan,
    context.kompetensi,
    context.buktiBelajar,
    context.output
  ]
    .filter(Boolean)
    .join(" | ");

  const scores = new Map();

  const addScore = (modelId, score, reason) => {
    if (!scores.has(modelId)) scores.set(modelId, { score: 0, reasons: [] });
    const current = scores.get(modelId);
    current.score += score;
    current.reasons.push(reason);
  };

  for (const rule of GADM_KB.modelSelectionRules) {
    if (hasAny(intentText, rule.when.intentsAny)) {
      for (const modelId of rule.prefer) addScore(modelId, 3, rule.reason);
    }
  }

  if (hasAny(intentText, ["dasar", "fondasi", "prosedur", "langkah", "akurasi"])) {
    addScore("explicit_instruction", 2, "tujuan memerlukan fondasi atau prosedur yang jelas");
  }

  if (hasAny(intentText, ["kelompok", "kolaborasi", "saling menjelaskan", "diskusi"])) {
    addScore("cooperative_learning", 2, "tujuan memerlukan interaksi dan kontribusi kelompok");
  }

  if (scores.size === 0) {
    addScore("explicit_instruction", 1, "fallback aman ketika intent belum cukup spesifik");
    addScore("cooperative_learning", 1, "alternatif bila interaksi sosial relevan");
  }

  const models = Object.values(GADM_KB.modelPembelajaran);
  return [...scores.entries()]
    .map(([modelId, data]) => {
      const model = models.find((item) => item.id === modelId);
      if (!model) return null;
      if (phase && !model.suitablePhases.includes(phase)) return null;
      return {
        id: model.id,
        label: model.label,
        score: data.score,
        reasons: unique(data.reasons),
        syntax: [...model.syntax],
        phaseNote: phase ? model.phaseNotes?.[phase] ?? null : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "id"));
}

/**
 * Memilih variasi bahasa secara deterministik untuk seed tertentu.
 */
export function pickLanguageVariant(kind, seed) {
  const pools = {
    opening: GADM_KB.languageEngine.openings,
    transition: GADM_KB.languageEngine.transitions,
    closing: GADM_KB.languageEngine.closings
  };
  return deterministicPick(pools[kind] ?? [], `${KB_VERSION}:${kind}:${seed ?? "default"}`);
}

function validateRequiredFields(target, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    const value = target?.[field];
    const missing =
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
    if (missing) {
      errors.push({
        code: "REQUIRED_FIELD_MISSING",
        field,
        severity: "error",
        message: `Field wajib '${field}' belum tersedia.`
      });
    }
  }
  return errors;
}

function getModelByAnyId(value) {
  const normalized = normalizeId(value);
  return Object.values(GADM_KB.modelPembelajaran).find(
    (model) => normalizeId(model.id) === normalized || normalizeId(model.label) === normalized
  );
}

/**
 * Validator rencana pembelajaran. Tidak menilai kualitas isi CP; validator hanya
 * memeriksa kontrak struktur, konsistensi pendekatan-model, sintaks, pengalaman
 * belajar, dan keberadaan asesmen/evidence.
 *
 * @param {object} plan
 * @returns {{ok:boolean, errors:Array<object>, warnings:Array<object>}}
 */
export function validateLearningPlan(plan = {}) {
  const errors = [];
  const warnings = [];

  const phase = resolvePhase(plan.phase ?? plan.fase ?? plan.kelasAtauFase ?? plan.kelas);
  if (!phase) {
    errors.push({
      code: "PHASE_INVALID",
      severity: "error",
      message: "Fase/kelas tidak dikenali. GADM v5 hanya mendukung kelas 1-6 (Fase A-C)."
    });
  }

  if (!plan.cpAtauTp && !plan.cp && !plan.tp) {
    errors.push({
      code: "CP_TP_MISSING",
      severity: "error",
      message: "CP/TP wajib berasal dari input atau corpus kurikulum tervalidasi; GADM tidak akan mengarangnya."
    });
  }

  const approachText = normalizeText(
    plan.pendekatanPembelajaran?.label ??
      plan.pendekatanPembelajaran ??
      plan.pendekatan ??
      ""
  ).toLowerCase();

  const modelText = normalizeText(
    plan.modelPembelajaran?.label ?? plan.modelPembelajaran ?? plan.model ?? ""
  ).toLowerCase();

  if (modelText === "pembelajaran mendalam" || modelText === "deep learning") {
    errors.push({
      code: "DEEP_LEARNING_AS_MODEL",
      severity: "error",
      message: GADM_KB.compatibilityRules.approachModelSeparation.message
    });
  }

  if (plan.modePembelajaranMendalam !== false && !approachText.includes("pembelajaran mendalam")) {
    warnings.push({
      code: "DEEP_LEARNING_APPROACH_NOT_EXPLICIT",
      severity: "warning",
      message: "Mode Pembelajaran Mendalam aktif tetapi pendekatan belum ditulis eksplisit sebagai Pembelajaran Mendalam."
    });
  }

  const model = getModelByAnyId(modelText);
  if (!model && modelText) {
    warnings.push({
      code: "MODEL_UNKNOWN_TO_KB",
      severity: "warning",
      message: "Model tidak ditemukan di KB v5. Pastikan model tersebut memiliki sintaks yang valid dan sesuai tujuan."
    });
  }

  if (model && phase && !model.suitablePhases.includes(phase)) {
    errors.push({
      code: "MODEL_PHASE_MISMATCH",
      severity: "error",
      message: `${model.label} tidak dikonfigurasi untuk ${GADM_KB.faseMap[phase].label}.`
    });
  }

  if (model && Array.isArray(plan.modelSyntax)) {
    const provided = plan.modelSyntax.map(normalizeId);
    const missingSteps = model.syntax.filter((step) => !provided.includes(normalizeId(step)));
    if (missingSteps.length > 0) {
      errors.push({
        code: "MODEL_SYNTAX_INCOMPLETE",
        severity: "error",
        missingSteps,
        message: `Sintaks ${model.label} belum lengkap.`
      });
    }
  } else if (model && !Array.isArray(plan.modelSyntax)) {
    warnings.push({
      code: "MODEL_SYNTAX_NOT_PROVIDED",
      severity: "warning",
      message: `Sintaks ${model.label} belum diberikan untuk divalidasi.`
    });
  }

  const experienceContainer = plan.pengalamanBelajar ?? plan;
  for (const experience of DEEP_LEARNING_EXPERIENCES) {
    const value = experienceContainer?.[experience];
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      errors.push({
        code: "DEEP_LEARNING_EXPERIENCE_MISSING",
        field: experience,
        severity: "error",
        message: `Pengalaman belajar '${experience}' belum dirancang.`
      });
    }
  }

  if (!plan.asesmen || (typeof plan.asesmen === "object" && Object.keys(plan.asesmen).length === 0)) {
    errors.push({
      code: "ASSESSMENT_MISSING",
      severity: "error",
      message: "Asesmen/bukti belajar belum tersedia."
    });
  }

  const serialized = JSON.stringify(plan).toLowerCase();
  for (const phrase of GADM_KB.languageEngine.bannedGeneratorPhrases) {
    if (serialized.includes(phrase.toLowerCase())) {
      warnings.push({
        code: "LOW_QUALITY_GENERATOR_PHRASE",
        severity: "warning",
        phrase,
        message: `Frasa generik/kurang natural terdeteksi: '${phrase}'.`
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validasi input dokumen berdasarkan schema KB.
 * @param {string} documentType - salah satu key GADM_KB.documentSchemas
 * @param {object} input
 */
export function validateDocumentInput(documentType, input = {}) {
  const schema = GADM_KB.documentSchemas[documentType];
  if (!schema) {
    return {
      ok: false,
      errors: [
        {
          code: "DOCUMENT_TYPE_UNKNOWN",
          severity: "error",
          message: `Jenis dokumen '${documentType}' tidak dikenali.`
        }
      ],
      warnings: []
    };
  }

  const errors = validateRequiredFields(input, schema.requiredInputs);
  const warnings = [];

  if (["prota", "promes"].includes(documentType)) {
    const timeValues = [
      input.alokasiJamTahunan,
      input.mingguEfektifSemester,
      input.kalenderPendidikanAtauMingguEfektif
    ];
    if (timeValues.every((value) => value == null || value === "")) {
      errors.push({
        code: "TIME_BASIS_MISSING",
        severity: "error",
        message: "Basis waktu/minggu efektif belum tersedia; kalender tidak boleh diarang."
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validator evidence untuk deskripsi e-Rapor.
 * @param {object} input
 */
export function validateERaporEvidence(input = {}) {
  const errors = [];
  const warnings = [];

  if (!normalizeText(input.materiAtauTP)) {
    errors.push({
      code: "ERAPOR_TARGET_MISSING",
      severity: "error",
      message: "Materi/TP yang dideskripsikan belum tersedia."
    });
  }

  if (!normalizeText(input.statusCapaian)) {
    errors.push({
      code: "ERAPOR_STATUS_MISSING",
      severity: "error",
      message: "Status capaian belum tersedia."
    });
  }

  const evidence = normalizeText(input.evidence ?? input.bukti ?? input.strengthEvidence ?? "");
  if (!evidence) {
    errors.push({
      code: "ERAPOR_EVIDENCE_MISSING",
      severity: "error",
      message: "Bukti capaian wajib tersedia sebelum deskripsi e-Rapor dibuat."
    });
  }

  const serialized = JSON.stringify(input).toLowerCase();
  for (const forbidden of GADM_KB.antiHallucination.forbiddenInferences) {
    if (serialized.includes(forbidden.toLowerCase())) {
      warnings.push({
        code: "ERAPOR_FORBIDDEN_INFERENCE_RISK",
        severity: "warning",
        phrase: forbidden,
        message: `Input/output berisiko membuat inferensi yang dilarang: '${forbidden}'.`
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}


/**
 * Menyelesaikan ID mata pelajaran dari label/alias tanpa mengklaim status wajib.
 */
export function resolveSubject(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  for (const [id, subject] of Object.entries(GADM_KB.curriculumTruth.subjectCatalog)) {
    const normalizedId = normalizeId(id);
    const candidates = [subject.label, ...(subject.aliases ?? [])].map((item) => normalizeText(item).toLowerCase());
    if (normalizeId(normalized) === normalizedId || candidates.includes(normalized)) return { id, ...subject };
  }
  return null;
}

/**
 * Menentukan sumber CP yang benar berdasarkan subject catalog.
 */
export function resolveCurriculumSource(subjectValue) {
  const subject = typeof subjectValue === "object" && subjectValue?.sourceId
    ? subjectValue
    : resolveSubject(subjectValue);
  if (!subject) {
    return {
      ok: false,
      sourceId: null,
      reason: "Mata pelajaran belum dikenali; sumber CP harus diberikan secara eksplisit dan diverifikasi."
    };
  }
  const source = GADM_KB.curriculumTruth.sourceSnapshot.sources[subject.sourceId] ?? null;
  return {
    ok: Boolean(source) || subject.sourceId === "school_or_local_verified_source",
    subjectId: subject.id ?? normalizeId(subject.label),
    sourceId: subject.sourceId,
    source,
    requiresSchoolSource: subject.sourceId === "school_or_local_verified_source",
    availabilityRule: subject.availabilityRule ?? null
  };
}

/**
 * Validasi record CP sebelum record dapat dianggap official/verified oleh GADM.
 */
export function validateCurriculumRecord(record = {}) {
  const errors = validateRequiredFields(record, GADM_KB.curriculumTruth.requiredRecordFields);
  const warnings = [];
  const phase = resolvePhase(record.phase);
  if (!phase) {
    errors.push({ code: "CURRICULUM_PHASE_INVALID", severity: "error", message: "Phase record CP harus Fase A, B, atau C." });
  }
  const route = resolveCurriculumSource(record.subjectId ?? record.subject ?? record.mataPelajaran);
  if (!route.ok && !normalizeText(record.sourceId)) {
    errors.push({ code: "CURRICULUM_SOURCE_UNKNOWN", severity: "error", message: "Sumber CP belum dapat diverifikasi." });
  }
  if (route.ok && route.sourceId && normalizeText(record.sourceId) && normalizeId(route.sourceId) !== normalizeId(record.sourceId)) {
    warnings.push({
      code: "CURRICULUM_SOURCE_ROUTE_MISMATCH",
      severity: "warning",
      message: `Source record '${record.sourceId}' berbeda dari source routing '${route.sourceId}'. Periksa versi regulasi.`
    });
  }
  if (normalizeText(record.officialText).length < 20) {
    warnings.push({ code: "CURRICULUM_TEXT_SUSPICIOUSLY_SHORT", severity: "warning", message: "Teks CP sangat pendek; verifikasi bahwa record tidak terpotong." });
  }
  return { ok: errors.length === 0, errors, warnings, phase, route };
}

/**
 * Mencari record CP yang sudah benar-benar tertanam/diimpor dan tervalidasi.
 * Tidak pernah membuat CP fallback.
 */
export function findCurriculumRecords(criteria = {}) {
  const phase = resolvePhase(criteria.phase ?? criteria.fase ?? criteria.kelas);
  const subject = resolveSubject(criteria.subjectId ?? criteria.subject ?? criteria.mataPelajaran);
  return (GADM_KB.curriculumTruth.records ?? []).filter((record) => {
    if (phase && resolvePhase(record.phase) !== phase) return false;
    if (subject && normalizeId(record.subjectId) !== normalizeId(subject.id)) return false;
    if (criteria.element && normalizeId(record.element) !== normalizeId(criteria.element)) return false;
    return validateCurriculumRecord(record).ok;
  });
}

const CURRICULUM_SEARCH_STOPWORDS = new Set([
  "yang", "dan", "atau", "dengan", "untuk", "pada", "dalam", "dari", "serta",
  "tentang", "materi", "topik", "pembelajaran", "murid", "peserta", "didik"
]);

function curriculumSearchTokens(value) {
  return unique(normalizeText(value).toLowerCase().split(/[^a-z0-9à-ÿ]+/u))
    .filter((token) => token.length >= 3 && !CURRICULUM_SEARCH_STOPWORDS.has(token));
}

function curriculumSegments(officialText) {
  const text = normalizeText(officialText);
  const segments = text.split(/(?=\s\d+\.\d+\.\s)/).map(normalizeText).filter(Boolean);
  return segments.length > 1 ? segments.slice(1) : [text];
}

function scoreCurriculumSegment(segment, topicTokens) {
  const normalized = normalizeText(segment).toLowerCase();
  return topicTokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

/**
 * Mengambil CP resmi yang paling relevan tanpa mengubah teks keputusan.
 * Jika topik tidak cocok pada elemen tertentu, record fase utuh dikembalikan.
 */
export function recommendOfficialCp(criteria = {}) {
  const phase = resolvePhase(criteria.phase ?? criteria.fase ?? criteria.kelas ?? criteria.kelasAtauFase);
  const subject = resolveSubject(criteria.subjectId ?? criteria.subject ?? criteria.mataPelajaran);
  if (!phase || !subject) {
    return { ok: false, reason: "Pilih kelas dan mata pelajaran untuk membaca CP resmi." };
  }
  const records = findCurriculumRecords({ phase, subjectId: subject.id });
  if (!records.length) {
    const route = resolveCurriculumSource(subject);
    const religionPending = route.sourceId === "cp_020_2026";
    return {
      ok: false,
      phase,
      subject,
      source: route.source,
      reason: religionPending
        ? "Teks CP Agama 2026 belum lolos verifikasi OCR. Masukkan CP terverifikasi secara manual."
        : "Corpus resmi untuk kombinasi mata pelajaran dan fase ini tidak tersedia. Masukkan CP terverifikasi secara manual."
    };
  }
  const record = records[0];
  const topicTokens = curriculumSearchTokens(criteria.topic ?? criteria.materi ?? criteria.materiAtauUnit);
  const candidates = curriculumSegments(record.officialText)
    .map((text) => ({ text, score: scoreCurriculumSegment(text, topicTokens) }))
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const matched = Boolean(topicTokens.length && best?.score > 0);
  return {
    ok: true,
    phase,
    subject,
    record,
    source: GADM_KB.curriculumTruth.sourceSnapshot.sources[record.sourceId] ?? null,
    officialText: matched ? best.text : record.officialText,
    matched,
    matchScore: matched ? best.score : 0,
    topicTokens
  };
}

/**
 * Menurunkan draft TP dari topik guru dan fase. Hasil selalu berstatus saran GADM,
 * bukan kutipan resmi dan tetap harus dikonfirmasi guru.
 */
export function suggestLearningObjective(criteria = {}) {
  const phase = resolvePhase(criteria.phase ?? criteria.fase ?? criteria.kelas ?? criteria.kelasAtauFase);
  const topic = normalizeText(criteria.topic ?? criteria.materi ?? criteria.materiAtauUnit);
  if (!phase || !topic) {
    return { ok: false, reason: "Pilih kelas dan isi materi/topik untuk membuat saran TP." };
  }
  const competencies = {
    faseA: "mengenali, menceritakan, dan menunjukkan pemahaman tentang",
    faseB: "mengidentifikasi, menjelaskan, dan menerapkan pemahaman tentang",
    faseC: "menganalisis, menerapkan, dan merefleksikan pemahaman tentang"
  };
  return {
    ok: true,
    phase,
    status: "gadm_suggestion_requires_teacher_confirmation",
    text: `Murid mampu ${competencies[phase]} ${topic} melalui bukti belajar yang dapat diamati dan dinilai.`,
    basis: "Panduan Pembelajaran dan Asesmen Edisi Revisi 2025: TP memuat kompetensi dan konten serta menggunakan kata kerja operasional yang relevan."
  };
}

function normalizeContextFlags(context = {}) {
  const raw = [
    context.kondisiAwalMurid,
    context.kondisiKelas,
    context.classContext,
    context.catatan,
    ...(Array.isArray(context.contextFlags) ? context.contextFlags : [])
  ].filter(Boolean).join(" | ");
  return raw;
}

/**
 * Merekomendasikan dukungan berdasarkan fakta kelas, bukan label permanen murid.
 */
export function recommendContextSupports(context = {}) {
  const phase = resolvePhase(context.phase ?? context.fase ?? context.kelas ?? context.kelasAtauFase);
  const text = normalizeContextFlags(context).toLowerCase();
  const matched = [];
  const methods = [];
  const media = [];
  const supports = [];
  const rules = [];

  for (const item of Object.values(GADM_KB.teacherContextIntelligence.contexts)) {
    const explicit = Array.isArray(context.contextFlags) && context.contextFlags.some((flag) => normalizeId(flag) === normalizeId(item.id));
    if (!explicit && !hasAny(text, item.triggers ?? [])) continue;
    matched.push(item.id);
    methods.push(...(item.preferMethods ?? []));
    supports.push(...(item.preferSupports ?? []));
    rules.push(...(item.rules ?? []));
    if (phase && item.preferMediaByPhase?.[phase]) media.push(...item.preferMediaByPhase[phase]);
  }

  return {
    phase,
    matchedContexts: unique(matched),
    recommendedMethodKeys: unique(methods).filter((key) => Boolean(GADM_KB.metodePembelajaran[key]) || key === "cooperative_learning"),
    recommendedMedia: unique(media),
    recommendedSupports: unique(supports),
    rules: unique(rules)
  };
}

function rebalanceWeights(weights) {
  const positive = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0.02, Number(value) || 0)]));
  const sum = Object.values(positive).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(positive).map(([key, value]) => [key, value / sum]));
}

function allocateIntegerMinutes(totalMinutes, weights, segmentOrder) {
  const raw = segmentOrder.map((key) => ({ key, raw: totalMinutes * (weights[key] ?? 0) }));
  const base = raw.map((item) => ({ ...item, value: Math.floor(item.raw), fraction: item.raw - Math.floor(item.raw) }));
  let assigned = base.reduce((sum, item) => sum + item.value, 0);
  const order = [...base].sort((a, b) => b.fraction - a.fraction || segmentOrder.indexOf(a.key) - segmentOrder.indexOf(b.key));
  let index = 0;
  while (assigned < totalMinutes && order.length) {
    const targetKey = order[index % order.length].key;
    const target = base.find((item) => item.key === targetKey);
    target.value += 1;
    assigned += 1;
    index += 1;
  }
  return Object.fromEntries(base.map((item) => [item.key, item.value]));
}

function enforceMinimumSegmentMinutes(segments, totalMinutes) {
  const minimums = totalMinutes >= 60
    ? { pendahuluan: 5, memahami: 10, mengaplikasi: 15, merefleksi: 5, penutup: 5 }
    : { pendahuluan: 3, memahami: 5, mengaplikasi: 8, merefleksi: 3, penutup: 3 };
  const result = { ...segments };
  const minimumTotal = Object.values(minimums).reduce((a, b) => a + b, 0);
  if (totalMinutes < minimumTotal) return result;

  for (const key of GADM_KB.timeIntelligence.segments) {
    const deficit = Math.max(0, minimums[key] - (result[key] ?? 0));
    if (!deficit) continue;
    result[key] += deficit;
    let remaining = deficit;
    const donors = GADM_KB.timeIntelligence.segments
      .filter((candidate) => candidate !== key)
      .sort((a, b) => (result[b] - minimums[b]) - (result[a] - minimums[a]));
    for (const donor of donors) {
      if (remaining <= 0) break;
      const available = Math.max(0, result[donor] - minimums[donor]);
      const take = Math.min(available, remaining);
      result[donor] -= take;
      remaining -= take;
    }
    if (remaining > 0) result[key] -= remaining;
  }
  return result;
}

/**
 * Merencanakan waktu secara deterministik dan selalu menjumlah tepat ke total.
 */
export function planLessonTime(context = {}) {
  const phase = resolvePhase(context.phase ?? context.fase ?? context.kelas ?? context.kelasAtauFase) ?? "faseB";
  const minutesPerJP = Number(context.minutesPerJP ?? context.menitPerJP ?? GADM_KB.timeIntelligence.policy.defaultMinutesPerJP);
  const jp = Number(context.jp ?? context.jumlahJP ?? 0);
  const explicitTotal = Number(context.totalMinutes ?? context.totalMenit ?? context.alokasiMenit ?? 0);
  const totalMinutes = explicitTotal > 0 ? Math.round(explicitTotal) : (jp > 0 ? Math.round(jp * minutesPerJP) : 0);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return { ok: false, code: "TIME_INPUT_MISSING", message: "Total menit atau jumlah JP belum tersedia.", phase, totalMinutes: 0, segments: {} };
  }

  const modelId = normalizeId(context.modelId ?? context.model ?? context.modelPembelajaran?.id ?? context.modelPembelajaran ?? "");
  const base = { ...GADM_KB.timeIntelligence.weightsByPhase[phase] };
  const adjust = GADM_KB.timeIntelligence.modelAdjustments[modelId] ?? {};
  for (const key of GADM_KB.timeIntelligence.segments) base[key] = (base[key] ?? 0) + (adjust[key] ?? 0);
  const weights = rebalanceWeights(base);
  const allocated = allocateIntegerMinutes(totalMinutes, weights, GADM_KB.timeIntelligence.segments);
  const segments = enforceMinimumSegmentMinutes(allocated, totalMinutes);
  return {
    ok: true,
    phase,
    modelId: modelId || null,
    totalMinutes,
    minutesPerJP,
    jp: jp > 0 ? jp : null,
    segments,
    sum: Object.values(segments).reduce((a, b) => a + b, 0),
    exact: Object.values(segments).reduce((a, b) => a + b, 0) === totalMinutes
  };
}

export function validateTimeBudget(timePlan = {}, availableMinutes = null) {
  const errors = [];
  const warnings = [];
  const segments = timePlan.segments ?? timePlan;
  const sum = Object.values(segments).filter((v) => Number.isFinite(Number(v))).reduce((a, b) => a + Number(b), 0);
  const total = Number(availableMinutes ?? timePlan.totalMinutes ?? 0);
  if (!total || total <= 0) errors.push({ code: "TIME_TOTAL_MISSING", severity: "error", message: "Total waktu belum tersedia." });
  if (total > 0 && sum !== total) errors.push({ code: "TIME_BUDGET_MISMATCH", severity: "error", expected: total, actual: sum, message: `Jumlah segmen ${sum} menit tidak sama dengan waktu tersedia ${total} menit.` });
  if (total > 0 && total < 35) warnings.push({ code: "TIME_VERY_SHORT", severity: "warning", message: "Waktu sangat singkat; jangan memaksakan model dengan banyak sintaks dalam satu pertemuan." });
  return { ok: errors.length === 0, errors, warnings, totalMinutes: total, allocatedMinutes: sum };
}

/**
 * Repair aman hanya mengubah distribusi menit, tidak mengubah fakta kurikulum.
 */
export function repairTimeBudget(timePlan = {}, context = {}) {
  const total = Number(context.totalMinutes ?? context.totalMenit ?? timePlan.totalMinutes ?? 0);
  if (!total || total <= 0) return { ok: false, code: "TIME_TOTAL_MISSING", original: timePlan };
  const planned = planLessonTime({ ...context, totalMinutes: total, modelId: context.modelId ?? timePlan.modelId, phase: context.phase ?? timePlan.phase });
  return { ...planned, repaired: planned.ok, originalAllocatedMinutes: Object.values(timePlan.segments ?? {}).reduce((a, b) => a + (Number(b) || 0), 0) };
}

/**
 * Memilih maksimal tiga dimensi profil berdasarkan bukti/intensi yang tersedia.
 */
export function recommendProfileDimensions(context = {}) {
  const text = [context.tujuan, context.kompetensi, context.aktivitas, context.buktiBelajar, context.evidence, context.model, context.metode]
    .filter(Boolean).join(" | ").toLowerCase();
  const scores = [];
  for (const rule of GADM_KB.profileSelectionRules) {
    const hits = rule.signals.filter((signal) => text.includes(signal.toLowerCase()));
    if (hits.length) scores.push({ dimension: rule.dimension, score: hits.length, signals: hits });
  }
  const max = Number(context.maxDimensions ?? GADM_KB.generationPolicies.selectFewNotAll.profileDimensionsDefaultMax ?? 3);
  return scores
    .sort((a, b) => b.score - a.score || a.dimension.localeCompare(b.dimension, "id"))
    .slice(0, Math.max(1, max))
    .map((item, index) => ({
      ...item,
      label: GADM_KB.profilLulusan.dimensions[item.dimension]?.label ?? item.dimension,
      priority: index === 0 ? "utama" : "pendukung",
      reasonCode: "PROFILE_EVIDENCE"
    }));
}

export function validateProfileEvidence(selectedDimensions = [], evidence = {}) {
  const errors = [];
  const warnings = [];
  const normalized = selectedDimensions.map((item) => typeof item === "string" ? item : item.dimension).filter(Boolean);
  if (normalized.length > GADM_KB.generationPolicies.selectFewNotAll.profileDimensionsDefaultMax) {
    warnings.push({ code: "PROFILE_TOO_MANY_DIMENSIONS", severity: "warning", message: "Terlalu banyak dimensi dipilih; fokuskan pada dimensi yang benar-benar memiliki bukti." });
  }
  for (const dimension of normalized) {
    const value = evidence?.[dimension] ?? evidence?.[normalizeId(dimension)] ?? "";
    if (!normalizeText(value)) warnings.push({ code: "PROFILE_WITHOUT_EVIDENCE", severity: "warning", dimension, message: `Dimensi '${dimension}' belum memiliki bukti observabel.` });
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function explainDecision(kind, selected, context = {}) {
  const reasons = [];
  const normalizedKind = normalizeId(kind);
  const text = [context.tujuan, context.intent, context.kompetensi, context.buktiBelajar, context.aktivitas].filter(Boolean).join(" | ").toLowerCase();
  if (normalizedKind === "model") {
    const model = getModelByAnyId(selected?.id ?? selected);
    const recs = recommendModels(context);
    const rec = recs.find((item) => model && item.id === model.id) ?? recs[0];
    if (rec?.reasons) reasons.push(...rec.reasons);
    if (model?.id === "inquiry" && hasAny(text, ["bukti", "data", "mengamati", "menyelidiki"])) reasons.push(GADM_KB.decisionExplanations.reasonCodes.EVIDENCE_COLLECTION_REQUIRED);
    if (model?.id === "explicit_instruction") reasons.push(GADM_KB.decisionExplanations.reasonCodes.FOUNDATIONAL_SKILL);
  } else if (normalizedKind === "media") {
    const support = recommendContextSupports(context);
    if (support.matchedContexts.includes("limited_resources")) reasons.push(GADM_KB.decisionExplanations.reasonCodes.LIMITED_RESOURCES);
    reasons.push(GADM_KB.decisionExplanations.reasonCodes.CONCRETE_REPRESENTATION);
  } else if (normalizedKind === "profil_lulusan" || normalizedKind === "profile") {
    reasons.push(GADM_KB.decisionExplanations.reasonCodes.PROFILE_EVIDENCE);
  } else if (normalizedKind === "asesmen" || normalizedKind === "assessment") {
    reasons.push(GADM_KB.decisionExplanations.reasonCodes.ASSESSMENT_ALIGNMENT);
  }
  return unique(reasons).slice(0, GADM_KB.decisionExplanations.displayPolicy.maxReasonsDefault);
}

export function validateCrossDocumentConsistency(bundle = {}) {
  const errors = [];
  const warnings = [];
  const entries = Object.entries(bundle).filter(([, value]) => value && typeof value === "object");
  const keys = GADM_KB.documentRelations.consistencyKeys;
  for (const key of keys) {
    const observed = unique(entries.map(([, doc]) => normalizeText(doc[key])).filter(Boolean));
    if (observed.length > 1) {
      const issue = { code: "CROSS_DOCUMENT_MISMATCH", field: key, values: observed, severity: ["cpId", "tpId", "kelasAtauFase", "mataPelajaran"].includes(key) ? "error" : "warning", message: `Nilai '${key}' tidak konsisten antar dokumen.` };
      (issue.severity === "error" ? errors : warnings).push(issue);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

function makeQualityCheck(id, status, message, detail = null) {
  return { id, status, message, detail };
}

/**
 * Audit 12 gerbang kualitas. Tidak menggantikan review profesional guru.
 */
export function auditGeneratedDocument(payload = {}) {
  const documentType = payload.documentType ?? "modulAjar";
  const input = payload.input ?? {};
  const plan = payload.plan ?? input;
  const checks = [];

  const phase = resolvePhase(plan.phase ?? plan.fase ?? plan.kelasAtauFase ?? plan.kelas ?? input.kelasAtauFase);
  checks.push(makeQualityCheck("phase_consistency", phase ? "pass" : "fail", phase ? `Fase teridentifikasi sebagai ${GADM_KB.faseMap[phase].label}.` : "Fase/kelas tidak valid."));

  const curriculumPresent = Boolean(plan.cpAtauTp || plan.cp || plan.tp || input.cpAtauTp || input.cpAtpTp);
  const verifiedRecord = payload.curriculumRecord ? validateCurriculumRecord(payload.curriculumRecord) : null;
  checks.push(makeQualityCheck("curriculum_grounding", curriculumPresent ? (verifiedRecord && !verifiedRecord.ok ? "warning" : "pass") : "fail", curriculumPresent ? "CP/TP tersedia; status provenance mengikuti record/input." : "CP/TP belum tersedia."));

  const hasObjective = Boolean(normalizeText(plan.tujuan ?? input.tujuan ?? plan.cpAtauTp ?? input.cpAtauTp));
  const hasEvidence = Boolean(plan.buktiBelajar || plan.asesmen || input.evidence || input.bukti);
  checks.push(makeQualityCheck("objective_evidence_alignment", hasObjective && hasEvidence ? "pass" : hasObjective ? "warning" : "fail", hasObjective && hasEvidence ? "Tujuan dan bukti belajar tersedia." : "Tujuan/bukti belajar belum lengkap."));

  const modelText = normalizeText(plan.modelPembelajaran?.label ?? plan.modelPembelajaran ?? plan.model ?? "").toLowerCase();
  const approachOk = !["pembelajaran mendalam", "deep learning"].includes(modelText);
  checks.push(makeQualityCheck("approach_model_separation", approachOk ? "pass" : "fail", approachOk ? "Pendekatan dan model tidak tertukar." : GADM_KB.compatibilityRules.approachModelSeparation.message));

  const model = getModelByAnyId(modelText);
  const syntaxProvided = Array.isArray(plan.modelSyntax) ? plan.modelSyntax : [];
  const syntaxOk = !model || syntaxProvided.length === 0 ? null : model.syntax.every((step) => syntaxProvided.map(normalizeId).includes(normalizeId(step)));
  checks.push(makeQualityCheck("model_syntax", syntaxOk === false ? "fail" : syntaxOk === null ? "warning" : "pass", syntaxOk === false ? "Sintaks model belum lengkap." : syntaxOk === null ? "Sintaks model belum tersedia untuk audit penuh." : "Sintaks model lengkap."));

  const methodExists = Boolean(plan.metodePembelajaran || input.metodePembelajaran || input.metode);
  checks.push(makeQualityCheck("method_feasibility", methodExists ? "pass" : "warning", methodExists ? "Metode pembelajaran tersedia." : "Metode belum eksplisit; dapat direkomendasikan engine."));

  const mediaExists = Boolean(plan.mediaPembelajaran || input.mediaPembelajaran || input.media);
  checks.push(makeQualityCheck("media_feasibility", mediaExists ? "pass" : "warning", mediaExists ? "Media pembelajaran tersedia." : "Media belum eksplisit; periksa sarana nyata."));

  const timePlan = payload.timePlan ?? (input.alokasiWaktu || input.totalMinutes || input.jp ? planLessonTime({ ...input, ...plan }) : null);
  const timeValidation = timePlan?.ok ? validateTimeBudget(timePlan) : { ok: false };
  checks.push(makeQualityCheck("time_budget", timeValidation.ok ? "pass" : timePlan ? "fail" : "warning", timeValidation.ok ? `Alokasi waktu tepat ${timePlan.totalMinutes} menit.` : timePlan ? "Alokasi waktu tidak konsisten." : "Data waktu belum cukup untuk reality check."));

  const assessmentExists = Boolean(plan.asesmen || input.asesmen || input.evidence || input.bukti);
  checks.push(makeQualityCheck("assessment_alignment", assessmentExists ? "pass" : "fail", assessmentExists ? "Asesmen/bukti belajar tersedia." : "Asesmen belum tersedia."));

  const selectedProfiles = payload.selectedDimensions ?? plan.targetProfilLulusan ?? input.targetProfilLulusan ?? [];
  const profileAudit = Array.isArray(selectedProfiles) && selectedProfiles.length ? validateProfileEvidence(selectedProfiles, payload.profileEvidence ?? {}) : null;
  checks.push(makeQualityCheck("profile_evidence", profileAudit ? (profileAudit.warnings.length ? "warning" : "pass") : "warning", profileAudit ? (profileAudit.warnings.length ? "Sebagian dimensi belum memiliki bukti eksplisit." : "Dimensi memiliki bukti eksplisit.") : "Dimensi profil belum dapat diaudit."));

  const experienceContainer = plan.pengalamanBelajar ?? plan;
  const experienceOk = DEEP_LEARNING_EXPERIENCES.every((key) => Boolean(experienceContainer?.[key]));
  checks.push(makeQualityCheck("deep_learning_experiences", experienceOk ? "pass" : "fail", experienceOk ? "Memahami, mengaplikasi, dan merefleksi tersedia." : "Tiga pengalaman belajar belum lengkap."));

  const serialized = JSON.stringify(payload).toLowerCase();
  const forbidden = GADM_KB.antiHallucination.forbiddenInferences.filter((term) => serialized.includes(term.toLowerCase()));
  checks.push(makeQualityCheck("hallucination_guard", forbidden.length ? "warning" : "pass", forbidden.length ? `Terdeteksi risiko inferensi: ${forbidden.join(", ")}.` : "Tidak ada inferensi terlarang yang terdeteksi secara tekstual."));

  const scoring = GADM_KB.qualityInspector.scoring;
  const score = Math.round((checks.reduce((sum, item) => sum + (scoring[item.status] ?? 0), 0) / checks.length) * 100);
  const fails = checks.filter((item) => item.status === "fail");
  const warnings = checks.filter((item) => item.status === "warning");
  const status = fails.length ? "blocked" : warnings.length ? "review" : "ready";
  return { ok: fails.length === 0, status, score, checks, fails, warnings, documentType };
}

export function buildRepairPlan(audit = {}) {
  const actions = [];
  for (const check of audit.checks ?? []) {
    if (check.status === "pass") continue;
    const map = {
      time_budget: "TIME_OVERFLOW",
      model_syntax: "MODEL_SYNTAX_INCOMPLETE",
      profile_evidence: "PROFILE_WITHOUT_EVIDENCE",
      curriculum_grounding: "CP_TP_MISSING"
    };
    const code = map[check.id];
    if (code && GADM_KB.repairRules[code]) actions.push({ code, ...GADM_KB.repairRules[code], sourceCheck: check.id });
  }
  return { repairable: actions.length > 0, actions };
}

/**
 * Audit cepat integritas internal KB. Dapat dipanggil pada bootstrap/test suite.
 */
export function selfAuditKB() {
  const errors = [];
  const warnings = [];

  for (const phase of PHASE_IDS) {
    if (!GADM_KB.faseMap[phase]) {
      errors.push({ code: "KB_PHASE_MISSING", phase });
    }
  }

  for (const principle of DEEP_LEARNING_PRINCIPLES) {
    if (!GADM_KB.pembelajaranMendalam.prinsip[principle]) {
      errors.push({ code: "KB_PRINCIPLE_MISSING", principle });
    }
  }

  for (const experience of DEEP_LEARNING_EXPERIENCES) {
    if (!GADM_KB.pembelajaranMendalam.pengalamanBelajar[experience]) {
      errors.push({ code: "KB_EXPERIENCE_MISSING", experience });
    }
  }

  const modelIds = new Set();
  for (const model of Object.values(GADM_KB.modelPembelajaran)) {
    if (!model.id) errors.push({ code: "KB_MODEL_ID_MISSING", label: model.label });
    if (modelIds.has(model.id)) errors.push({ code: "KB_MODEL_ID_DUPLICATE", id: model.id });
    modelIds.add(model.id);

    if (!Array.isArray(model.syntax) || model.syntax.length < 3) {
      errors.push({ code: "KB_MODEL_SYNTAX_INVALID", id: model.id });
    }

    if (!Array.isArray(model.suitablePhases) || model.suitablePhases.length === 0) {
      errors.push({ code: "KB_MODEL_PHASES_INVALID", id: model.id });
    }
  }

  const forbiddenModel = Object.values(GADM_KB.modelPembelajaran).some((model) =>
    ["pembelajaran mendalam", "deep learning"].includes(normalizeText(model.label).toLowerCase())
  );
  if (forbiddenModel) {
    errors.push({ code: "KB_DEEP_LEARNING_REGISTERED_AS_MODEL" });
  }

  if (!GADM_KB.curriculumTruth || !GADM_KB.curriculumTruth.sourceSnapshot) {
    errors.push({ code: "KB_CURRICULUM_TRUTH_MISSING" });
  }

  for (const requiredArray of ["mindfulLearning", "meaningfulLearning", "joyfulLearning", "growthMindset"]) {
    if (!Array.isArray(GADM_KB[requiredArray]) || GADM_KB[requiredArray].length === 0) {
      errors.push({ code: "KB_MES_COMPATIBILITY_ARRAY_MISSING", field: requiredArray });
    }
  }

  if (!GADM_KB.timeIntelligence?.weightsByPhase || !GADM_KB.qualityInspector?.checks?.length) {
    errors.push({ code: "KB_V6_INTELLIGENCE_LAYER_INCOMPLETE" });
  }

  const testTime = planLessonTime({ kelas: 3, totalMinutes: 70, modelId: "inquiry" });
  if (!testTime.ok || testTime.sum !== 70) {
    errors.push({ code: "KB_TIME_ENGINE_SELFTEST_FAILED" });
  }

  const agamaRoute = resolveCurriculumSource("PAI");
  if (!agamaRoute.ok || agamaRoute.sourceId !== "cp_020_2026") {
    errors.push({ code: "KB_CP_2026_RELIGION_ROUTING_FAILED" });
  }

  const umumRoute = resolveCurriculumSource("Matematika");
  if (!umumRoute.ok || umumRoute.sourceId !== "cp_046_2025") {
    errors.push({ code: "KB_CP_2025_GENERAL_ROUTING_FAILED" });
  }

  return {
    ok: errors.length === 0,
    version: KB_VERSION,
    schemaVersion: KB_SCHEMA_VERSION,
    errors,
    warnings
  };
}

export const GADM_KB_VERSION = KB_VERSION;
export const GADM_KB_SCHEMA_VERSION = KB_SCHEMA_VERSION;

export default GADM_KB;
