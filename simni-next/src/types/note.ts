import { ClassId } from './auth';

export interface Note {
  Tanggal: string;        // YYYY-MM-DD
  NISN: string;
  'Nama Lengkap': string;
  Catatan: string;        // Maksimal 5.000 karakter
  Kelas: ClassId;
}
