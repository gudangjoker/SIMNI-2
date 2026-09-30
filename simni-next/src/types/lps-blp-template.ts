export interface LPSIndicator {
  id: string;
  code: string; // e.g. "a)", "1)", "2)"
  text: string;
}

export type LPSEvalType = 'single_grade' | 'checklist' | 'grade_per_indicator' | 'hafalan';

export interface LPSAspect {
  id: string;
  section: string;
  order: number;
  title: string;
  evalType: LPSEvalType;
  criteriaOptions: string[]; // e.g. ['Sudah Terbiasa', 'Belum Terbiasa'] or ['A', 'B', 'C', 'D'] or ['Hafal', 'Sebagian', 'Belum']
  indicators: LPSIndicator[];
  defaultDescription: string;
}

export interface LPSBLPSection {
  id: string;
  title: string;
  aspects: LPSAspect[];
}

export interface LPSBLPTemplate {
  type: 'LPS' | 'BLP';
  title: string;
  subTitle: string;
  checkMarkChar: string; // 'ü' or '✓'
  sections: LPSBLPSection[];
}

export interface StudentEvaluationData {
  studentNisn: string;
  aspectGrades: Record<string, string>; // aspectId -> grade
  indicatorChecks: Record<string, string>; // indicatorId -> chosen criterion (e.g. 'Sudah Terbiasa', 'A', 'Hafal')
  descriptions: Record<string, string>; // aspectId -> description text
  generalNotes?: string;
  parentNotes?: string;
  masehiDate?: string;
  hijriDate?: string;
  classMaster?: string;
  nuptkMaster?: string;
  headMaster?: string;
  nuptkHead?: string;
  lastUpdated?: string;
}

// DEFAULT STANDARD TEMPLATE FOR LPS (Identik dengan LPS - Template wajib.xlsx)
export const DEFAULT_LPS_TEMPLATE: LPSBLPTemplate = {
  type: 'LPS',
  title: 'LAPORAN PERKEMBANGAN SISWA',
  subTitle: 'Hasil Observasi Pembiasaan, Hafalan dan Prestasi akademik Tengah Semester - 2',
  checkMarkChar: 'ü',
  sections: [
    {
      id: 'A',
      title: "A. Baca Tulis Al-Qur'an, Penerapan 7 Kebiasaan, Pembiasaan, Prestasi Akademik dan Praktek ibadah",
      aspects: [
        {
          id: 'lps_a_1',
          section: 'A',
          order: 1,
          title: "Baca Tulis Al-Quran",
          evalType: 'single_grade',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'lps_a1_ind1', code: '-', text: 'Al-Quran : Surat ... /ayat ...' },
            { id: 'lps_a1_ind2', code: '-', text: 'Iqro (6) / Hal 6' }
          ],
          defaultDescription: "Alhamdulillah ananda mengajinya baik. Panjang pendeknya sudah baik. Sudah bisa membaca huruf berharakat tasydid. Masih harus semangat dan fokus ketika membaca. Dalam menulis ananda mampu menulis 2 huruf hijaiyah dengan menyambung dan memisahkan. Barakallah ahlul Qur'an selalu."
        },
        {
          id: 'lps_a_2',
          section: 'A',
          order: 2,
          title: "Penerapan 7 Kebiasaan Anak Indonesia Hebat",
          evalType: 'checklist',
          criteriaOptions: ['Sudah Terbiasa', 'Belum Terbiasa'],
          indicators: [
            { id: 'lps_a2_ind1', code: '1)', text: 'Bangun Pagi' },
            { id: 'lps_a2_ind2', code: '2)', text: 'Beribadah' },
            { id: 'lps_a2_ind3', code: '3)', text: 'Berolahraga' },
            { id: 'lps_a2_ind4', code: '4)', text: 'Makan Sehat dan Bergizi' },
            { id: 'lps_a2_ind5', code: '5)', text: 'Gemar Belajar' },
            { id: 'lps_a2_ind6', code: '6)', text: 'Bermasyarakat' },
            { id: 'lps_a2_ind7', code: '7)', text: 'Tidur Cepat' }
          ],
          defaultDescription: "Alhamdulillah untuk program 7 kebiasaan ini Ananda telah dapat membiasakan dalam kegiatan sehari-hari. Ayo lakukan terus 7 kebiasaan ini agar menjadi anak indonesia yang hebat!"
        },
        {
          id: 'lps_a_3',
          section: 'A',
          order: 3,
          title: "Pembiasaan",
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'lps_a3_ind1', code: 'a)', text: 'Makan dan minum sambil duduk' },
            { id: 'lps_a3_ind2', code: 'b)', text: 'Tidak berbicara kasar' },
            { id: 'lps_a3_ind3', code: 'c)', text: 'Salam dan salim kepada guru' },
            { id: 'lps_a3_ind4', code: 'd)', text: "Mengangkat tangan ketika berdo'a" }
          ],
          defaultDescription: "Alhamdulillah Ananda menunjukkan sikap yang baik dalam pembiasaan adab harian di sekolah."
        },
        {
          id: 'lps_a_4',
          section: 'A',
          order: 4,
          title: "Prestasi Akademik",
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'lps_a4_ind1', code: 'a)', text: 'Membaca' },
            { id: 'lps_a4_ind2', code: 'b)', text: 'Menulis' },
            { id: 'lps_a4_ind3', code: 'c)', text: 'Berhitung' }
          ],
          defaultDescription: "Alhamdulillah dalam akademik Ananda menunjukkan pemahaman yang baik serta konsentrasi belajar yang meningkat."
        },
        {
          id: 'lps_a_5',
          section: 'A',
          order: 5,
          title: "Praktek Ibadah",
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'lps_a5_ind1', code: 'a)', text: 'Thaharah/wudhu' },
            { id: 'lps_a5_ind2', code: 'b)', text: 'Bacaan shalat' },
            { id: 'lps_a5_ind3', code: 'c)', text: 'Gerakan shalat' }
          ],
          defaultDescription: "Alhamdulillah Ananda sudah baik dalam mempraktikkan wudhu dan gerakan shalat secara tertib."
        }
      ]
    },
    {
      id: 'B',
      title: "B. Target Hafalan",
      aspects: [
        {
          id: 'lps_b_1',
          section: 'B',
          order: 1,
          title: "Tahfidz / Juz-Amma",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'lps_b1_ind1', code: 'a)', text: "Q.S Al-Ma'un" },
            { id: 'lps_b1_ind2', code: 'b)', text: "Q.S Al-Quraisy" },
            { id: 'lps_b1_ind3', code: 'c)', text: "Q.S Al-Fiil" },
            { id: 'lps_b1_ind4', code: 'd)', text: "Q.S Al-Humazah" },
            { id: 'lps_b1_ind5', code: 'e)', text: "Q.S Al-'Asr" },
            { id: 'lps_b1_ind6', code: 'f)', text: "Q.S At-Takatsur" },
            { id: 'lps_b1_ind7', code: 'g)', text: "Q.S Al-Qoriah" },
            { id: 'lps_b1_ind8', code: 'h)', text: "Q.S An-Naziat" },
            { id: 'lps_b1_ind9', code: 'i)', text: "Q.S 'Abasa" }
          ],
          defaultDescription: "Alhamdulillah dalam Hafalan Juz Amma Ananda menunjukkan kemajuan yang membanggakan."
        },
        {
          id: 'lps_b_2',
          section: 'B',
          order: 2,
          title: "Do'a Sehari-hari",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'lps_b2_ind1', code: 'a)', text: 'Do\'a Masuk WC' },
            { id: 'lps_b2_ind2', code: 'b)', text: 'Do\'a Keluar WC' },
            { id: 'lps_b2_ind3', code: 'c)', text: 'Do\'a Masuk Mesjid' },
            { id: 'lps_b2_ind4', code: 'd)', text: 'Do\'a Keluar Mesjid' },
            { id: 'lps_b2_ind5', code: 'e)', text: 'Do\'a Kebaikan Dunia dan Akhirat' },
            { id: 'lps_b2_ind6', code: 'f)', text: 'Do\'a ketika turun hujan' },
            { id: 'lps_b2_ind7', code: 'g)', text: 'Do\'a ketika ada petir' },
            { id: 'lps_b2_ind8', code: 'h)', text: 'Do\'a ketika ada angin ribut/kencang' },
            { id: 'lps_b2_ind9', code: 'i)', text: 'Do\'a setelah adzan' },
            { id: 'lps_b2_ind10', code: 'j)', text: 'Do\'a bercermin' }
          ],
          defaultDescription: "Alhamdulillah di tengah semester dua ini hafalan doa harian Ananda tercapai dengan baik."
        },
        {
          id: 'lps_b_3',
          section: 'B',
          order: 3,
          title: "Mahfudzat",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'lps_b3_ind1', code: 'a)', text: 'Jangan Marah' },
            { id: 'lps_b3_ind2', code: 'b)', text: 'Memberi itu lebih baik' },
            { id: 'lps_b3_ind3', code: 'c)', text: 'Bahayanya ilmu' },
            { id: 'lps_b3_ind4', code: 'd)', text: 'Kebaikan akhlak' },
            { id: 'lps_b3_ind5', code: 'e)', text: 'Hidup itu perjuangan' },
            { id: 'lps_b3_ind6', code: 'f)', text: 'Keutamaan buku' },
            { id: 'lps_b3_ind7', code: 'g)', text: 'Manusia paling bermanfaat' },
            { id: 'lps_b3_ind8', code: 'h)', text: 'Belajar Al-Qur\'an' },
            { id: 'lps_b3_ind9', code: 'i)', text: 'Sabar' },
            { id: 'lps_b3_ind10', code: 'j)', text: 'Berkata benar' },
            { id: 'lps_b3_ind11', code: 'k)', text: 'Berkata yang baik' },
            { id: 'lps_b3_ind12', code: 'l)', text: 'Menjaga lisan' },
            { id: 'lps_b3_ind13', code: 'm)', text: 'Tubuh yang sehat' },
            { id: 'lps_b3_ind14', code: 'n)', text: 'Kuatnya kemauan' }
          ],
          defaultDescription: "Alhamdulillah di tengah semester dua ini hafalan mahfudzot Ananda telah mampu dihafal dan dipahami maknanya."
        }
      ]
    }
  ]
};

// DEFAULT STANDARD TEMPLATE FOR BLP (Identik dengan BLP - Template wajib.xlsx)
export const DEFAULT_BLP_TEMPLATE: LPSBLPTemplate = {
  type: 'BLP',
  title: 'LAPORAN PERKEMBANGAN SISWA',
  subTitle: "Hasil Observasi Baca Tulis A-Qur'an, Prestasi Hafalan, Pembiasaan dan Praktek Ibadah",
  checkMarkChar: '✓',
  sections: [
    {
      id: 'A',
      title: "A. Baca Tulis Al-Qur'an, Muroja'ah, Pembiasaan dan Praktek ibadah",
      aspects: [
        {
          id: 'blp_a_1',
          section: 'A',
          order: 1,
          title: "Baca Tulis al-Quran",
          evalType: 'single_grade',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'blp_a1_ind1', code: '-', text: 'Iqro 2 / Hal 18' }
          ],
          defaultDescription: "Alhamdulillah di semester 1 ini ananda menunjukkan kemajuan yang baik dalam membaca dan mengenal makharijul huruf."
        },
        {
          id: 'blp_a_2',
          section: 'A',
          order: 2,
          title: "Muroja'ah",
          evalType: 'single_grade',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'blp_a2_ind1', code: '-', text: 'Keaktifan dan kedisiplinan murojaah harian' }
          ],
          defaultDescription: "Alhamdulillah ananda selalu semangat ketika murojaah bersama di kelas. Tingkatkan terus murojaah di rumah ya."
        },
        {
          id: 'blp_a_3',
          section: 'A',
          order: 3,
          title: "Pembiasaan",
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'blp_a3_ind1', code: 'a)', text: 'Salam dan salim' },
            { id: 'blp_a3_ind2', code: 'b)', text: 'Tidak berbicara kasar' },
            { id: 'blp_a3_ind3', code: 'c)', text: "Mengangkat tangan ketika berdo'a" },
            { id: 'blp_a3_ind4', code: 'd)', text: 'Makan dan minum sambil duduk' },
            { id: 'blp_a3_ind5', code: 'e)', text: 'Infaq' }
          ],
          defaultDescription: "Alhamdulillah pembiasaan sehari-hari ananda sangat tertib, santun kepada guru dan teman."
        },
        {
          id: 'blp_a_4',
          section: 'A',
          order: 4,
          title: "Praktek Ibadah",
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: 'blp_a4_ind1', code: 'a)', text: 'Thaharah/wudhu' },
            { id: 'blp_a4_ind2', code: 'b)', text: 'Shalat' }
          ],
          defaultDescription: "Alhamdulillah praktek ibadah sudah cukup baik dan tertib."
        }
      ]
    },
    {
      id: 'B',
      title: "B. Target Hafalan",
      aspects: [
        {
          id: 'blp_b_1',
          section: 'B',
          order: 1,
          title: "Tahfidz / Juz-Amma",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'blp_b1_ind1', code: 'a)', text: "Q.S. Al-'Adiyat" },
            { id: 'blp_b1_ind2', code: 'b)', text: "Q.S. Al-Zalzalah" },
            { id: 'blp_b1_ind3', code: 'c)', text: "Q.S. Al-Bayyinah" },
            { id: 'blp_b1_ind4', code: 'd)', text: "Q.S. Al-Qadar" },
            { id: 'blp_b1_ind5', code: 'e)', text: "Q.S. Al-'Alaq" }
          ],
          defaultDescription: "Alhamdulillah hafalan surat di semester ini tercapai dengan baik dan lancar."
        },
        {
          id: 'blp_b_2',
          section: 'B',
          order: 2,
          title: "Do'a Sehari-hari",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'blp_b2_ind1', code: 'a)', text: 'Do\'a Masuk WC' },
            { id: 'blp_b2_ind2', code: 'b)', text: 'Do\'a Keluar WC' },
            { id: 'blp_b2_ind3', code: 'c)', text: 'Do\'a Masuk Mesjid' },
            { id: 'blp_b2_ind4', code: 'd)', text: 'Do\'a Keluar Mesjid' },
            { id: 'blp_b2_ind5', code: 'e)', text: 'Do\'a Kebaikan Dunia dan Akhirat' },
            { id: 'blp_b2_ind6', code: 'f)', text: 'Do\'a ketika turun hujan' },
            { id: 'blp_b2_ind7', code: 'g)', text: 'Do\'a ketika ada petir' }
          ],
          defaultDescription: "Alhamdulillah hafalan doa tercapai dengan baik dan fasih."
        },
        {
          id: 'blp_b_3',
          section: 'B',
          order: 3,
          title: "Mahfudzat",
          evalType: 'hafalan',
          criteriaOptions: ['Hafal', 'Sebagian', 'Belum'],
          indicators: [
            { id: 'blp_b3_ind1', code: 'a)', text: 'Jangan Marah' },
            { id: 'blp_b3_ind2', code: 'b)', text: 'Memberi itu lebih baik' },
            { id: 'blp_b3_ind3', code: 'c)', text: 'Bahayanya ilmu' },
            { id: 'blp_b3_ind4', code: 'd)', text: 'Kebaikan akhlak' },
            { id: 'blp_b3_ind5', code: 'e)', text: 'Hidup itu perjuangan' },
            { id: 'blp_b3_ind6', code: 'f)', text: 'Keutamaan buku' },
            { id: 'blp_b3_ind7', code: 'g)', text: 'Manusia paling bermanfaat' }
          ],
          defaultDescription: "Alhamdulillah hafalan mahfudzot tercapai dengan baik."
        }
      ]
    }
  ]
};
