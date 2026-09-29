import { create } from 'zustand';
import { ClassId } from '@/types/auth';
import { Student } from '@/types/student';
import { AttendanceRecord } from '@/types/attendance';
import { LearningObjective, Grade } from '@/types/grade';
import { JournalEntry, ScheduleSlot } from '@/types/journal';
import { Note } from '@/types/note';
import { DocumentAsset } from '@/types/document';
import { LPSTemplate, LPSReport } from '@/types/lps';
import { SchoolSettings } from '@/types/settings';

export interface AppState {
  // Academic & Operational Collections
  pengaturan: SchoolSettings;
  students: Record<string, Student>;
  presensi: Record<string, AttendanceRecord>;
  mapelTP: Record<string, LearningObjective>;
  nilaiTP: Record<string, Grade>;
  catatan: Record<string, Note>;
  jurnal: Record<string, JournalEntry>;
  jadwal: Record<string, ScheduleSlot>;
  dokumen: Record<string, DocumentAsset>;
  lpsTemplates: Record<string, LPSTemplate>;
  lpsReports: Record<string, LPSReport>;

  // Session Context
  activeKelas: ClassId;
  academicYear: string;

  // Actions
  setActiveKelas: (kelas: ClassId) => void;
  setAcademicYear: (year: string) => void;
  setCollection: <K extends keyof Omit<AppState, 'activeKelas' | 'academicYear' | 'setActiveKelas' | 'setAcademicYear' | 'setCollection' | 'resetStore'>>(
    key: K,
    data: AppState[K]
  ) => void;
  resetStore: () => void;
}

const initialSettings: SchoolSettings = {
  nama_aplikasi: 'SIMNI Administrasi Kelas',
  tahun_pelajaran: '2026-2027',
  nama_yayasan: 'Yayasan Sosial dan Pendidikan Bina Muda',
  nama_sekolah: 'SDIT Bina Muda Cicalengka',
  status_akreditasi: 'A',
  kota: 'Cicalengka',
  nomor_izin: 'No.421.2/1143-Disdikbud/2011'
};

const initialState = {
  pengaturan: initialSettings,
  students: {},
  presensi: {},
  mapelTP: {},
  nilaiTP: {},
  catatan: {},
  jurnal: {},
  jadwal: {},
  dokumen: {},
  lpsTemplates: {},
  lpsReports: {},
  activeKelas: '1A' as ClassId,
  academicYear: '2026-2027'
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setActiveKelas: (kelas) => set({ activeKelas: kelas }),
  setAcademicYear: (year) => set({ academicYear: year }),

  setCollection: (key, data) => set({ [key]: data } as Partial<AppState>),

  resetStore: () => set(initialState)
}));
