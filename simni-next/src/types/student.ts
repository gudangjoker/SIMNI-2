import { ClassId } from './auth';

export interface Student {
  ID_Siswa: string;
  NISN: string;           // Tepat 10 digit angka
  'Nama Lengkap': string; // 1 - 160 karakter
  Panggilan?: string;
  Kelas: ClassId;
  Kelompok?: string;      // Rombel BTQ
  foto?: string;          // URL Cloudinary HTTPS
  foto_public_id?: string;
}
