import { ClassId } from './auth';

export interface AttendanceRecord {
  Tanggal: string;        // YYYY-MM-DD
  NISN: string;           // 10 digit
  'Nama Lengkap': string;
  Status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  Kelas: ClassId;
}
