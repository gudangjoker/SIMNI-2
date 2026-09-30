import ExcelJS from 'exceljs';
import { LearningObjective } from '@/types/grade';
import { ClassId } from '@/types/auth';
import { ALL_MAPEL_LIST, BAB_OPTIONS, REGULAR_CLASSES, SPECIALIST_MAPEL_LIST, getSubjectsForClass } from '../constants/subjects';

export interface ParsedTPRecord {
  kode_tp: string;
  mapel: string;
  semester: '1' | '2';
  bab: string;
  deskripsi: string;
  targetClasses: ClassId[];
}

export interface ParsedTPResult {
  validTPs: ParsedTPRecord[];
  errors: { row: number; sheet: string; message: string }[];
  totalRows: number;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E1B4B' } // Indigo 950
};

const EXAMPLE_FILL: ExcelJS.Fill = {
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
 * Setup sheet Tujuan Pembelajaran (TP) dengan styling profesional dan Data Validation Dropdown
 */
function setupTPSheet(
  sheet: ExcelJS.Worksheet,
  targetClass: string,
  academicYear: string,
  isSpecialist: boolean,
  specificMapel?: string
) {
  // Lebar kolom
  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'mapel', width: 28 },
    { key: 'semester', width: 12 },
    { key: 'bab', width: 14 },
    { key: 'kode_tp', width: 16 },
    { key: 'deskripsi', width: 50 },
    { key: 'target_kelas', width: 26 }
  ];

  // Baris 1: Judul Utama
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = isSpecialist
    ? `FORMAT TUJUAN PEMBELAJARAN (TP) MULTI-KELAS - SPESIALIS GURU BIDANG STUDI`
    : `FORMAT TUJUAN PEMBELAJARAN (TP) - KELAS ${targetClass}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E1B4B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 28;

  // Baris 2: Sub-judul
  sheet.mergeCells('A2:G2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `SDIT BINA MUDA CICALENGKA | TAHUN AJARAN ${academicYear}`;
  subtitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 20;

  // Baris 3: Petunjuk
  sheet.mergeCells('A3:G3');
  const noteCell = sheet.getCell('A3');
  noteCell.value = isSpecialist
    ? 'Petunjuk: Gunakan pilihan Dropdown pada kolom Mapel, Semester, dan Bab. Tuliskan target kelas (contoh: 1A, 1B, 2A atau SEMUA).'
    : 'Petunjuk: Pilih Mata Pelajaran dan Bab melalui panah Dropdown List. Kolom Kode TP dan Deskripsi wajib diisi.';
  noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FFB45309' } };
  noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(3).height = 18;

  // Spacing
  sheet.getRow(4).height = 10;

  // Header
  const headers = [
    'NO',
    'MATA PELAJARAN',
    'SEMESTER',
    'BAB',
    'KODE TP',
    'DESKRIPSI TUJUAN PEMBELAJARAN',
    'TARGET KELAS'
  ];

  const headerRow = sheet.getRow(5);
  headerRow.height = 26;

  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: index === 0 || index === 2 || index === 3 || index === 4 ? 'center' : 'left' };
    cell.border = BORDER_STYLE;
  });

  // Contoh Data
  const sampleMapel = specificMapel || (isSpecialist ? 'PJOK' : 'Bahasa Indonesia');
  const exampleRow1 = sheet.getRow(6);
  exampleRow1.values = [
    1,
    sampleMapel,
    '1',
    'Bab 1',
    'TP-01',
    'Memahami pola gerak dasar lokomotor dan manipulatif sesuai instruksi.',
    isSpecialist ? '1A, 1B, 2A, 2B, 3A, 3B' : targetClass
  ];
  exampleRow1.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  exampleRow1.fill = EXAMPLE_FILL;
  for (let c = 1; c <= 7; c++) {
    exampleRow1.getCell(c).border = BORDER_STYLE;
    if (c === 1 || c === 3 || c === 4 || c === 5) {
      exampleRow1.getCell(c).alignment = { horizontal: 'center' };
    }
  }

  // Terapkan Data Validation Dropdown List pada baris 6 sampai 60
  // Formula list dalam ExcelJS memerlukan format string berkutik ganda di dalam array: ['"A,B,C"']
  const mapelChoices = isSpecialist ? SPECIALIST_MAPEL_LIST : getSubjectsForClass(targetClass);
  const mapelFormula = `"${mapelChoices.join(',')}"`;
  const semesterFormula = '"1,2"';
  const babFormula = `"${BAB_OPTIONS.join(',')}"`;

  for (let r = 6; r <= 60; r++) {
    const row = sheet.getRow(r);

    // Kolom B: Mata Pelajaran
    const mapelCell = row.getCell(2);
    mapelCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [mapelFormula]
    };

    // Kolom C: Semester
    const semCell = row.getCell(3);
    semCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [semesterFormula]
    };

    // Kolom D: Bab
    const babCell = row.getCell(4);
    babCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [babFormula]
    };

    // Terapkan border tipis pada cell kosong agar template bergaris profesional
    if (r > 6) {
      for (let c = 1; c <= 7; c++) {
        row.getCell(c).border = BORDER_STYLE;
        if (c === 1 || c === 3 || c === 4 || c === 5) {
          row.getCell(c).alignment = { horizontal: 'center' };
        }
      }
    }
  }
}

/**
 * Generate Template Impor TP (Single Class atau Multi-Class Spesialis PJOK/B.Inggris/PAI)
 */
export async function generateTPTemplate(options: {
  mode: 'single' | 'specialist';
  classId: string;
  academicYear: string;
  specificMapel?: string;
}): Promise<Blob> {
  const { mode, classId, academicYear, specificMapel } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  if (mode === 'single') {
    const sheet = workbook.addWorksheet(`TP Kelas ${classId}`, {
      views: [{ showGridLines: true }]
    });
    setupTPSheet(sheet, classId, academicYear, false, specificMapel);
  } else {
    // Mode Spesialis Multi-Kelas (PJOK, Bahasa Inggris, PAI)
    // 1. Sheet Gabungan Multi-Kelas dengan Kolom Target Kelas
    const multiSheet = workbook.addWorksheet('TP Multi-Kelas', {
      views: [{ showGridLines: true }]
    });
    setupTPSheet(multiSheet, 'Multi-Kelas', academicYear, true, specificMapel);

    // 2. Sheet per jenjang untuk kemudahan distribusi
    ['Fase A (Kelas 1-2)', 'Fase B (Kelas 3-4)', 'Fase C (Kelas 5-6)'].forEach((fase) => {
      const sheet = workbook.addWorksheet(fase, {
        views: [{ showGridLines: true }]
      });
      setupTPSheet(sheet, fase, academicYear, true, specificMapel);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Ekspor TP yang sudah ada di sistem ke Excel
 */
export async function exportTPToExcel(options: {
  tps: LearningObjective[];
  classId: string;
  academicYear: string;
  mapel?: string;
}): Promise<Blob> {
  const { tps, classId, academicYear, mapel } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`TP ${mapel || 'Semua Mapel'}`, {
    views: [{ showGridLines: true }]
  });

  setupTPSheet(sheet, classId, academicYear, false, mapel);

  tps.forEach((tp, idx) => {
    const row = sheet.getRow(6 + idx);
    row.values = [
      idx + 1,
      tp.mapel,
      tp.semester,
      tp.bab || 'Umum',
      tp.kode_tp,
      tp.deskripsi,
      classId
    ];
    row.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).border = BORDER_STYLE;
      if (c === 1 || c === 3 || c === 4 || c === 5) {
        row.getCell(c).alignment = { horizontal: 'center' };
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Parser file Excel Tujuan Pembelajaran (TP)
 */
export async function parseTPExcelFile(
  file: File,
  activeClass: ClassId
): Promise<ParsedTPResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const validTPs: ParsedTPRecord[] = [];
  const errors: { row: number; sheet: string; message: string }[] = [];
  let totalRows = 0;

  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name;
    let headerRowIdx = -1;

    worksheet.eachRow((row, rowNumber) => {
      const rowValues = row.values as unknown[];
      if (!rowValues) return;

      const rowStr = rowValues.map((v) => String(v || '').toLowerCase()).join(' ');
      if (rowStr.includes('kode') && (rowStr.includes('tujuan') || rowStr.includes('deskripsi') || rowStr.includes('tp'))) {
        headerRowIdx = rowNumber;
        return;
      }

      if (headerRowIdx !== -1 && rowNumber > headerRowIdx) {
        const cellMapel = row.getCell(2).text?.trim();
        const cellSemester = row.getCell(3).text?.trim();
        const cellBab = row.getCell(4).text?.trim();
        const cellKode = row.getCell(5).text?.trim();
        const cellDeskripsi = row.getCell(6).text?.trim();
        const cellTargetKelas = row.getCell(7).text?.trim();

        // Abaikan baris kosong
        if (!cellKode && !cellDeskripsi && !cellMapel) return;

        // Abaikan baris contoh jika ada
        if (cellDeskripsi?.toLowerCase().includes('pola gerak dasar') && rowNumber === 6) {
          return;
        }

        totalRows++;

        if (!cellKode) {
          errors.push({ row: rowNumber, sheet: sheetName, message: 'Kode TP (misal: TP-01) wajib diisi.' });
          return;
        }

        if (!cellDeskripsi) {
          errors.push({ row: rowNumber, sheet: sheetName, message: `Deskripsi TP pada Kode "${cellKode}" wajib diisi.` });
          return;
        }

        if (!cellMapel) {
          errors.push({ row: rowNumber, sheet: sheetName, message: `Mata Pelajaran pada Kode "${cellKode}" wajib diisi.` });
          return;
        }

        const validSemester: '1' | '2' = cellSemester === '2' ? '2' : '1';
        const validBab = cellBab || 'Umum';

        // Tentukan Target Kelas
        let targetClasses: ClassId[] = [activeClass];
        if (cellTargetKelas) {
          const upper = cellTargetKelas.toUpperCase();
          if (upper === 'SEMUA') {
            targetClasses = REGULAR_CLASSES as ClassId[];
          } else {
            const splitted = upper
              .split(/[,;\s]+/)
              .map((c) => c.replace(/kelas/i, '').trim())
              .filter((c) => REGULAR_CLASSES.includes(c) || c === 'PJOK') as ClassId[];

            if (splitted.length > 0) {
              targetClasses = splitted;
            }
          }
        }

        validTPs.push({
          kode_tp: cellKode,
          mapel: cellMapel,
          semester: validSemester,
          bab: validBab,
          deskripsi: cellDeskripsi,
          targetClasses
        });
      }
    });
  });

  return { validTPs, errors, totalRows };
}
