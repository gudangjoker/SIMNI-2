import ExcelJS from 'exceljs';
import { Student } from '@/types/student';
import { ClassId } from '@/types/auth';
import { REGULAR_CLASSES } from '../constants/subjects';

export interface ParsedStudentResult {
  validStudents: Student[];
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
 * Setup layout profesional pada satu sheet template siswa
 */
function setupStudentSheet(sheet: ExcelJS.Worksheet, targetClass: string, academicYear: string, isTemplate: boolean) {
  // Setup Lebar Kolom
  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'nisn', width: 20 },
    { key: 'nama', width: 38 },
    { key: 'panggilan', width: 18 },
    { key: 'kelas', width: 16 },
    { key: 'kelompok', width: 18 }
  ];

  // Baris 1: Judul Utama
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `FORMAT DATA SISWA - KELAS ${targetClass}`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E1B4B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 28;

  // Baris 2: Sub-judul Lembaga & Tahun Ajaran
  sheet.mergeCells('A2:F2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `SDIT BINA MUDA CICALENGKA | TAHUN AJARAN ${academicYear}`;
  subtitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 20;

  // Baris 3: Petunjuk Teknis Pengisian
  sheet.mergeCells('A3:F3');
  const noteCell = sheet.getCell('A3');
  noteCell.value = isTemplate
    ? 'Petunjuk: Kolom NISN wajib tepat 10 digit angka. Kolom Nama Lengkap wajib diisi. Jangan mengubah urutan kolom.'
    : `Daftar siswa resmi terdaftar di rombel Kelas ${targetClass}.`;
  noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FFB45309' } }; // Amber 700
  noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(3).height = 18;

  // Baris 4: Spacing
  sheet.getRow(4).height = 10;

  // Baris 5: Header Kolom
  const headers = ['NO', 'NISN (10 DIGIT)', 'NAMA LENGKAP SISWA', 'PANGGILAN', 'KELAS', 'KELOMPOK BTQ'];
  const headerRow = sheet.getRow(5);
  headerRow.height = 26;

  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: index === 0 || index === 1 || index === 4 ? 'center' : 'left' };
    cell.border = BORDER_STYLE;
  });

  if (isTemplate) {
    // Baris 6: Contoh Pengisian Baris 1
    const exampleRow1 = sheet.getRow(6);
    exampleRow1.values = [1, '0012345678', 'Ahmad Fatih Ramadhan', 'Fatih', targetClass, 'Tahsin A'];
    exampleRow1.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    exampleRow1.fill = EXAMPLE_FILL;
    for (let c = 1; c <= 6; c++) {
      exampleRow1.getCell(c).border = BORDER_STYLE;
      if (c === 1 || c === 2 || c === 5) exampleRow1.getCell(c).alignment = { horizontal: 'center' };
    }

    // Baris 7: Contoh Pengisian Baris 2
    const exampleRow2 = sheet.getRow(7);
    exampleRow2.values = [2, '0012345679', 'Aisyah Putri Azzahra', 'Aisyah', targetClass, 'Tahsin B'];
    exampleRow2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    exampleRow2.fill = EXAMPLE_FILL;
    for (let c = 1; c <= 6; c++) {
      exampleRow2.getCell(c).border = BORDER_STYLE;
      if (c === 1 || c === 2 || c === 5) exampleRow2.getCell(c).alignment = { horizontal: 'center' };
    }
  }
}

/**
 * Generate Template Impor Siswa Excel (Single Class atau Multi-Sheet Semua Kelas)
 */
export async function generateStudentTemplate(options: {
  mode: 'single' | 'all';
  classId: string;
  academicYear: string;
}): Promise<Blob> {
  const { mode, classId, academicYear } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  if (mode === 'single') {
    const sheetName = `Kelas ${classId}`;
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });
    setupStudentSheet(sheet, classId, academicYear, true);
  } else {
    // Mode All: 12 Sheet per kelas
    REGULAR_CLASSES.forEach((cls) => {
      const sheet = workbook.addWorksheet(`Kelas ${cls}`, {
        views: [{ showGridLines: true }]
      });
      setupStudentSheet(sheet, cls, academicYear, true);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Ekspor Data Siswa ke Excel Profesional
 */
export async function exportStudentsToExcel(options: {
  students: Student[];
  classId: string;
  academicYear: string;
  mode: 'single' | 'all';
}): Promise<Blob> {
  const { students, classId, academicYear, mode } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMNI Digital Classroom';
  workbook.created = new Date();

  if (mode === 'single') {
    const sheet = workbook.addWorksheet(`Kelas ${classId}`, {
      views: [{ showGridLines: true }]
    });
    setupStudentSheet(sheet, classId, academicYear, false);

    const filtered = students.filter((s) => s.Kelas === classId);
    filtered.forEach((st, idx) => {
      const r = sheet.getRow(6 + idx);
      r.values = [
        idx + 1,
        st.NISN,
        st['Nama Lengkap'],
        st.Panggilan || '-',
        st.Kelas,
        st.Kelompok || '-'
      ];
      r.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      for (let c = 1; c <= 6; c++) {
        r.getCell(c).border = BORDER_STYLE;
        if (c === 1 || c === 2 || c === 5) r.getCell(c).alignment = { horizontal: 'center' };
      }
    });

    // Summary Row
    const lastRowIndex = 6 + filtered.length;
    const summaryRow = sheet.getRow(lastRowIndex);
    sheet.mergeCells(`A${lastRowIndex}:D${lastRowIndex}`);
    summaryRow.getCell(1).value = `TOTAL SISWA TERDAFTAR: ${filtered.length} SISWA`;
    summaryRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
    summaryRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    summaryRow.getCell(1).fill = EXAMPLE_FILL;
    for (let c = 1; c <= 6; c++) {
      summaryRow.getCell(c).border = BORDER_STYLE;
    }
  } else {
    // Export All Classes across separate sheets
    REGULAR_CLASSES.forEach((cls) => {
      const sheet = workbook.addWorksheet(`Kelas ${cls}`, {
        views: [{ showGridLines: true }]
      });
      setupStudentSheet(sheet, cls, academicYear, false);

      const filtered = students.filter((s) => s.Kelas === cls);
      filtered.forEach((st, idx) => {
        const r = sheet.getRow(6 + idx);
        r.values = [
          idx + 1,
          st.NISN,
          st['Nama Lengkap'],
          st.Panggilan || '-',
          st.Kelas,
          st.Kelompok || '-'
        ];
        r.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        for (let c = 1; c <= 6; c++) {
          r.getCell(c).border = BORDER_STYLE;
          if (c === 1 || c === 2 || c === 5) r.getCell(c).alignment = { horizontal: 'center' };
        }
      });

      const lastRowIndex = 6 + filtered.length;
      const summaryRow = sheet.getRow(lastRowIndex);
      sheet.mergeCells(`A${lastRowIndex}:D${lastRowIndex}`);
      summaryRow.getCell(1).value = `TOTAL SISWA KELAS ${cls}: ${filtered.length} SISWA`;
      summaryRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
      summaryRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      summaryRow.getCell(1).fill = EXAMPLE_FILL;
      for (let c = 1; c <= 6; c++) {
        summaryRow.getCell(c).border = BORDER_STYLE;
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Parsing file Excel siswa dari unggahan pengguna
 */
export async function parseStudentExcelFile(file: File, fallbackClass: ClassId): Promise<ParsedStudentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const validStudents: Student[] = [];
  const errors: { row: number; sheet: string; message: string }[] = [];
  let totalRows = 0;

  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name;
    // Deteksi kelas dari nama sheet jika formatnya seperti "Kelas 1A" atau "1A"
    let sheetClass: ClassId = fallbackClass;
    const cleanSheetName = sheetName.replace(/kelas\s*/i, '').trim().toUpperCase();
    if (REGULAR_CLASSES.includes(cleanSheetName)) {
      sheetClass = cleanSheetName as ClassId;
    }

    let headerRowIdx = -1;

    worksheet.eachRow((row, rowNumber) => {
      // Cari baris header
      const rowValues = row.values as unknown[];
      if (!rowValues) return;

      const rowStr = rowValues.map((v) => String(v || '').toLowerCase()).join(' ');
      if (rowStr.includes('nisn') && rowStr.includes('nama')) {
        headerRowIdx = rowNumber;
        return;
      }

      // Jika sudah melewati header, lakukan parsing data
      if (headerRowIdx !== -1 && rowNumber > headerRowIdx) {
        // Ambil nilai sel
        const cellNo = row.getCell(1).text?.trim();
        const cellNisn = row.getCell(2).text?.trim().replace(/[^0-9]/g, '');
        const cellNama = row.getCell(3).text?.trim();
        const cellPanggilan = row.getCell(4).text?.trim();
        const cellKelas = row.getCell(5).text?.trim().toUpperCase();
        const cellKelompok = row.getCell(6).text?.trim();

        // Abaikan baris kosong atau baris contoh jika ada kata "ahmad fatih"
        if (!cellNisn && !cellNama) return;
        if (cellNama?.toLowerCase().includes('contoh') || cellNama?.toLowerCase().includes('fatih ramadhan')) {
          return;
        }

        totalRows++;

        if (!cellNama) {
          errors.push({ row: rowNumber, sheet: sheetName, message: 'Nama lengkap wajib diisi.' });
          return;
        }

        if (!cellNisn || cellNisn.length !== 10) {
          errors.push({
            row: rowNumber,
            sheet: sheetName,
            message: `NISN "${cellNisn || '-'}" tidak valid (harus 10 digit angka).`
          });
          return;
        }

        const studentClass: ClassId = REGULAR_CLASSES.includes(cellKelas)
          ? (cellKelas as ClassId)
          : sheetClass;

        validStudents.push({
          ID_Siswa: `SISWA_${studentClass}_${cellNisn}`,
          NISN: cellNisn,
          'Nama Lengkap': cellNama,
          Panggilan: cellPanggilan || undefined,
          Kelas: studentClass,
          Kelompok: cellKelompok || undefined
        });
      }
    });
  });

  return { validStudents, errors, totalRows };
}
