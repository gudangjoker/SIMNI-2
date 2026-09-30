import ExcelJS from 'exceljs';
import { Student } from '@/types/student';
import { Grade } from '@/types/grade';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E1B4B' } // Indigo 950
};

const STATS_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF1F5F9' } // Slate 100
};

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
};

/**
 * Ekspor Buku Induk Nilai Siswa (Rekap Seluruh Mapel) ke Excel Profesional
 */
export async function exportGradeBookToExcel(options: {
  students: Student[];
  grades: Record<string, Grade>;
  activeKelas: string;
  academicYear: string;
  mapelList: string[];
}): Promise<Blob> {
  const { students, grades, activeKelas, academicYear, mapelList } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Buku Induk Kelas ${activeKelas}`, {
    views: [{ showGridLines: true }]
  });

  const totalCols = 3 + mapelList.length + 2; // No, NISN, Nama + mapels + Rata2 + Predikat

  // Setup Lebar Kolom
  const colsConfig: { key?: string; width: number }[] = [
    { width: 6 },  // No
    { width: 18 }, // NISN
    { width: 34 }  // Nama Siswa
  ];
  mapelList.forEach(() => colsConfig.push({ width: 14 }));
  colsConfig.push({ width: 15 }); // Rata-rata
  colsConfig.push({ width: 14 }); // Predikat
  sheet.columns = colsConfig;

  // Baris 1: Judul
  sheet.mergeCells(1, 1, 1, totalCols);
  const title = sheet.getCell(1, 1);
  title.value = `BUKU INDUK NILAI SISWA - KELAS ${activeKelas}`;
  title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E1B4B' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 28;

  // Baris 2: Sub-judul
  sheet.mergeCells(2, 1, 2, totalCols);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = `SDIT BINA MUDA CICALENGKA | REKAPITULASI TAHUN AJARAN ${academicYear}`;
  subtitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 20;

  // Spacing Baris 3 & 4
  sheet.getRow(3).height = 8;

  // Baris 4: Header
  const headers = ['NO', 'NISN', 'NAMA LENGKAP SISWA', ...mapelList.map((m) => m.toUpperCase()), 'RATA-RATA', 'PREDIKAT'];
  const headerRow = sheet.getRow(4);
  headerRow.height = 26;

  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_STYLE;
  });

  // Hitung Nilai Rata-rata per Mapel untuk Setiap Siswa
  const studentMapelAvg: Record<string, Record<string, number[]>> = {};
  Object.values(grades).forEach((g) => {
    if (g.Kelas === activeKelas) {
      if (!studentMapelAvg[g.NISN]) studentMapelAvg[g.NISN] = {};
      if (!studentMapelAvg[g.NISN][g.mapel]) studentMapelAvg[g.NISN][g.mapel] = [];
      studentMapelAvg[g.NISN][g.mapel].push(g.nilai);
    }
  });

  // Render Baris Siswa
  const mapelTotals: Record<string, number[]> = {};
  mapelList.forEach((m) => { mapelTotals[m] = []; });
  const allFinalAverages: number[] = [];

  students.forEach((st, sIdx) => {
    const rowNum = 5 + sIdx;
    const r = sheet.getRow(rowNum);
    const rowValues: (string | number)[] = [sIdx + 1, st.NISN, st['Nama Lengkap']];

    let totalScore = 0;
    let countedMapels = 0;

    mapelList.forEach((m) => {
      const scores = studentMapelAvg[st.NISN]?.[m];
      if (scores && scores.length > 0) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        rowValues.push(avg);
        totalScore += avg;
        countedMapels++;
        mapelTotals[m].push(avg);
      } else {
        rowValues.push('-');
      }
    });

    const finalAvg = countedMapels > 0 ? Math.round(totalScore / countedMapels) : 0;
    rowValues.push(finalAvg > 0 ? finalAvg : '-');

    // Predikat Capaian
    let predikat = '-';
    if (finalAvg >= 90) predikat = 'Sangat Baik (A)';
    else if (finalAvg >= 80) predikat = 'Baik (B)';
    else if (finalAvg >= 70) predikat = 'Cukup (C)';
    else if (finalAvg > 0) predikat = 'Perlu Bimbingan (D)';
    rowValues.push(predikat);

    if (finalAvg > 0) allFinalAverages.push(finalAvg);

    r.values = rowValues;
    r.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };

    for (let c = 1; c <= totalCols; c++) {
      const cell = r.getCell(c);
      cell.border = BORDER_STYLE;
      if (c === 1 || c === 2 || c > 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (c === totalCols - 1 && finalAvg > 0) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
      }
    }
  });

  // Baris Statistik Kelas di Bawah Tabel
  const statStartRow = 5 + students.length;

  // 1. Rata-rata Kelas
  const avgRow = sheet.getRow(statStartRow);
  sheet.mergeCells(statStartRow, 1, statStartRow, 3);
  avgRow.getCell(1).value = 'RATA-RATA KELAS';
  avgRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
  avgRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  mapelList.forEach((m, idx) => {
    const list = mapelTotals[m];
    const cell = avgRow.getCell(4 + idx);
    cell.value = list.length > 0 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : '-';
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.alignment = { horizontal: 'center' };
  });

  const totalClassAvg = allFinalAverages.length > 0
    ? Math.round(allFinalAverages.reduce((a, b) => a + b, 0) / allFinalAverages.length)
    : '-';
  avgRow.getCell(totalCols - 1).value = totalClassAvg;
  avgRow.getCell(totalCols - 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
  avgRow.getCell(totalCols - 1).alignment = { horizontal: 'center' };
  avgRow.getCell(totalCols).value = '-';

  for (let c = 1; c <= totalCols; c++) {
    avgRow.getCell(c).border = BORDER_STYLE;
    avgRow.getCell(c).fill = STATS_FILL;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Ekspor Rekap Jurnal Mengajar Harian ke Excel
 */
export async function exportJournalToExcel(options: {
  journals: Array<{ Tanggal: string; Jam_Ke: string; Mapel: string; Materi: string; Keterangan?: string }>;
  activeKelas: string;
  academicYear: string;
}): Promise<Blob> {
  const { journals, activeKelas, academicYear } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Jurnal Kelas ${activeKelas}`, {
    views: [{ showGridLines: true }]
  });

  sheet.columns = [
    { width: 6 },  // No
    { width: 16 }, // Tanggal
    { width: 12 }, // Jam Ke
    { width: 26 }, // Mapel
    { width: 45 }, // Materi
    { width: 35 }  // Refleksi / Keterangan
  ];

  // Judul
  sheet.mergeCells('A1:F1');
  const t = sheet.getCell('A1');
  t.value = `REKAPITULASI JURNAL MENGAJAR GURU - KELAS ${activeKelas}`;
  t.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E1B4B' } };
  t.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:F2');
  const st = sheet.getCell('A2');
  st.value = `SDIT BINA MUDA CICALENGKA | TAHUN AJARAN ${academicYear}`;
  st.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  st.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 20;

  sheet.getRow(3).height = 8;

  // Header
  const headers = ['NO', 'TANGGAL', 'JAM KE', 'MATA PELAJARAN', 'MATERI PEMBELAJARAN', 'REFLEKSI / KETERANGAN'];
  const hRow = sheet.getRow(4);
  hRow.height = 24;
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.fill = HEADER_FILL;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: idx < 3 ? 'center' : 'left' };
    c.border = BORDER_STYLE;
  });

  journals.forEach((j, idx) => {
    const r = sheet.getRow(5 + idx);
    r.values = [idx + 1, j.Tanggal, `Jam Ke-${j.Jam_Ke}`, j.Mapel, j.Materi, j.Keterangan || '-'];
    r.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    for (let col = 1; col <= 6; col++) {
      const cell = r.getCell(col);
      cell.border = BORDER_STYLE;
      if (col <= 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Ekspor Buku Catatan & Pembinaan Siswa ke Excel
 */
export async function exportNotesToExcel(options: {
  notes: Array<{ tanggal?: string; nisn: string; nama_siswa?: string; kategori: string; catatan: string; tindak_lanjut?: string }>;
  activeKelas: string;
  academicYear: string;
}): Promise<Blob> {
  const { notes, activeKelas, academicYear } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Catatan Siswa ${activeKelas}`, {
    views: [{ showGridLines: true }]
  });

  sheet.columns = [
    { width: 6 },  // No
    { width: 16 }, // Tanggal
    { width: 18 }, // NISN
    { width: 30 }, // Nama Siswa
    { width: 18 }, // Kategori
    { width: 45 }, // Uraian Catatan
    { width: 35 }  // Tindak Lanjut
  ];

  sheet.mergeCells('A1:G1');
  const t = sheet.getCell('A1');
  t.value = `BUKU CATATAN PERKEMBANGAN & PEMBINAAN SISWA - KELAS ${activeKelas}`;
  t.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E1B4B' } };
  t.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:G2');
  const st = sheet.getCell('A2');
  st.value = `SDIT BINA MUDA CICALENGKA | TAHUN AJARAN ${academicYear}`;
  st.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  st.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 20;

  sheet.getRow(3).height = 8;

  const headers = ['NO', 'TANGGAL', 'NISN', 'NAMA SISWA', 'KATEGORI', 'URAIAN CATATAN', 'TINDAK LANJUT'];
  const hRow = sheet.getRow(4);
  hRow.height = 24;
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.fill = HEADER_FILL;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: idx < 3 ? 'center' : 'left' };
    c.border = BORDER_STYLE;
  });

  notes.forEach((n, idx) => {
    const r = sheet.getRow(5 + idx);
    r.values = [
      idx + 1,
      n.tanggal || '-',
      n.nisn,
      n.nama_siswa || '-',
      n.kategori,
      n.catatan,
      n.tindak_lanjut || '-'
    ];
    r.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    for (let col = 1; col <= 7; col++) {
      const cell = r.getCell(col);
      cell.border = BORDER_STYLE;
      if (col <= 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
