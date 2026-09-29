import { ClassId } from './auth';

export interface LearningObjective {
  ID_mapel: string;
  kode_tp: string;
  mapel: string;          // Jika role VIP, wajib hanya 'PJOK'
  bab?: string;           // Bab 1 s/d Bab 10 atau 'Umum'
  semester: '1' | '2';
  deskripsi: string;
}

export interface Grade {
  NISN: string;
  learningObjectiveId: string;
  nilai: number;          // Rentang valid: 0 - 100
  mapel: string;
  Kelas: ClassId;
  'Nama Lengkap': string;
}
