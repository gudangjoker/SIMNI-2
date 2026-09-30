export interface BTQRecord {
  nisn: string;
  nama: string;
  kelas: string;
  hancaTerakhir: string;
  nilai: 'A' | 'B' | 'C' | 'D' | '-';
  gambaranKemampuan: string;
}

export interface BTQReportData {
  periode: string; // e.g. "PERTENGAHAN SEMESTER 1"
  tahunPelajaran: string; // e.g. "2025-2026"
  namaPengajar: string; // e.g. "Unggaran"
  records: Record<string, BTQRecord>; // key: nisn
}
