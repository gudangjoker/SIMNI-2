import { ClassId } from '@/types/auth';

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
  'Bahasa Sunda'
];

export const SPECIALIST_MAPEL_LIST: string[] = [
  'PJOK',
  'Bahasa Inggris',
  'Pendidikan Agama Islam'
];

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

/**
 * Mengambil daftar mata pelajaran sesuai jenjang kelas.
 * Aturan kurikulum: Pada kelas 1, 2, dan 3, mata pelajaran 'Bahasa Arab' disembunyikan.
 */
export function getSubjectsForClass(classId: string): string[] {
  if (!classId) return ALL_MAPEL_LIST;

  const firstChar = classId.charAt(0);
  const gradeLevel = parseInt(firstChar, 10);

  if (!isNaN(gradeLevel) && gradeLevel >= 1 && gradeLevel <= 3) {
    return ALL_MAPEL_LIST.filter((mapel) => mapel !== 'Bahasa Arab');
  }

  return ALL_MAPEL_LIST;
}
