import { ClassId } from '@/types/auth';

export const CABANG_SENI_OPTIONS: string[] = [
  'Seni Rupa',
  'Seni Musik',
  'Seni Tari',
  'Seni Teater'
];

export const ALL_MAPEL_LIST: string[] = [
  'Pendidikan Agama Islam',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'PJOK',
  'Seni Rupa',
  'Bahasa Arab',
  'Bahasa Inggris',
  'Bahasa Sunda',
  'Komputer'
];

export const SPECIALIST_ASSIGNMENTS: string[] = [
  'PJOK',
  'Pendidikan Agama Islam',
  'Bahasa Inggris',
  'Bahasa Arab',
  'Komputer'
];

export const SPECIALIST_MAPEL_LIST = SPECIALIST_ASSIGNMENTS;

export const BAB_OPTIONS: string[] = [
  'Bab 1',
  'Bab 2',
  'Bab 3',
  'Bab 4',
  'Bab 5',
  'Bab 6',
  'Bab 7',
  'Bab 8',
  'Bab 9',
  'Bab 10',
  'Umum'
];

export const ALL_CLASSES: ClassId[] = [
  '1A', '1B', '2A', '2B', '3A', '3B',
  '4A', '4B', '5A', '5B', '6A', '6B',
  'PJOK'
];

export const REGULAR_CLASSES: string[] = [
  '1A', '1B', '2A', '2B', '3A', '3B',
  '4A', '4B', '5A', '5B', '6A', '6B'
];

export const ALL_ASSIGNMENT_SLOTS: string[] = [
  '1A', '1B', '2A', '2B', '3A', '3B',
  '4A', '4B', '5A', '5B', '6A', '6B',
  'PJOK',
  'PAI',
  'Bahasa Inggris',
  'Bahasa Arab',
  'Komputer'
];

/**
 * Mengambil cabang seni aktif yang tersimpan atau default 'Seni Rupa'
 */
export function getActiveCabangSeni(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('simni_cabang_seni');
    if (saved && CABANG_SENI_OPTIONS.includes(saved)) {
      return saved;
    }
  }
  return 'Seni Rupa';
}

/**
 * Mengambil daftar mata pelajaran sesuai jenjang kelas dan cabang seni tahun ajaran.
 * Aturan kurikulum:
 * 1. Cabang seni mengikuti pilihan aktif tahun ajaran (Seni Rupa / Musik / Tari / Teater).
 * 2. Pada kelas 1, 2, dan 3, mata pelajaran 'Bahasa Arab' disembunyikan.
 * 3. Mata pelajaran 'Komputer' tersedia di seluruh jenjang.
 */
export function getSubjectsForClass(classId: string, customCabangSeni?: string): string[] {
  const seni = customCabangSeni || getActiveCabangSeni();

  const baseList: string[] = [
    'Pendidikan Agama Islam',
    'Pendidikan Pancasila',
    'Bahasa Indonesia',
    'Matematika',
    'IPAS',
    'PJOK',
    seni,
    'Bahasa Arab',
    'Bahasa Inggris',
    'Bahasa Sunda',
    'Komputer'
  ];

  if (!classId) return baseList;

  const firstChar = classId.charAt(0);
  const gradeLevel = parseInt(firstChar, 10);

  // Bahasa Arab disembunyikan pada kelas 1, 2, dan 3
  if (!isNaN(gradeLevel) && gradeLevel >= 1 && gradeLevel <= 3) {
    return baseList.filter((mapel) => mapel !== 'Bahasa Arab');
  }

  return baseList;
}
