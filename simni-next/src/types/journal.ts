import { ClassId } from './auth';

export interface JournalEntry {
  Tanggal: string;        // YYYY-MM-DD
  Jam_Ke: string;         // '1' s/d '10'
  Mapel: string;
  Materi: string;         // Maksimal 4.000 karakter
  Keterangan: string;     // Refleksi, maksimal 4.000 karakter
  Kelas: ClassId;
}

export interface ScheduleSlot {
  Hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';
  Jam_Ke: string;
  Mapel: string;
  Kelas: ClassId;
}
