export interface DocumentAsset {
  ID_dokumen: string;
  Nama: string;
  Kategori: 'Modul Ajar' | 'RPP' | 'LKPD' | 'Silabus' | 'Administrasi Kelas' | 'Media Ajar' | 'Lainnya';
  Deskripsi: string;
  url_file: string;       // URL HTTPS Cloudinary
  public_id: string;
  bytes: number;          // Maksimal 10.485.760 (10 MiB)
}
