import ExcelJS from 'exceljs';
import { LPSBLPTemplate, StudentEvaluationData } from '@/types/lps-blp-template';
import { Student } from '@/types/student';

export interface ReportExportParams {
  type: 'LPS' | 'BLP';
  template: LPSBLPTemplate;
  evaluations: Record<string, StudentEvaluationData>; // key: nisn
  students: Student[];
  academicYear: string;
  semester: string; // e.g. "1" or "2"
  classId: string;
  isSingleStudent?: boolean;
  targetNisn?: string;
  masehiDate?: string;
  hijriDate?: string;
  waliKelas?: string;
  nuptkWali?: string;
  guruPendamping?: string;
  nuptkPendamping?: string;
  kepalaSekolah?: string;
  nuks?: string;
  catatan1?: string;
  catatan2?: string;
}

// Fetch template workbook array buffer
async function getTemplateBuffer(type: 'LPS' | 'BLP'): Promise<ArrayBuffer> {
  const filename = type === 'LPS' ? 'lps_template.xlsx' : 'blp_template.xlsx';
  if (typeof window !== 'undefined') {
    const res = await fetch(`/templates/${filename}`);
    if (!res.ok) throw new Error(`Gagal memuat template resmi: ${filename}`);
    return await res.arrayBuffer();
  } else {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(process.cwd(), 'public', 'templates', filename);
    const buf = fs.readFileSync(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
}

// Populate LPS Worksheet (100% Identik dengan LPS - Template wajib.xlsx)
function populateLPSSheet(
  ws: ExcelJS.Worksheet,
  student: Student,
  evalData: StudentEvaluationData,
  params: ReportExportParams
) {
  // 1. Identitas Siswa
  ws.getCell('D11').value = student['Nama Lengkap'];
  ws.getCell('D12').value = student.NISN || '-';

  // 2. Tanggal Pengesahan
  if (params.masehiDate) ws.getCell('X96').value = params.masehiDate;
  if (params.hijriDate) ws.getCell('X97').value = params.hijriDate;

  // 3. Tanda Tangan LPS (HANYA DUA CLASS MASTER: Wali Kelas & Guru Pendamping. TIDAK ADA KEPALA SEKOLAH & TIDAK ADA ORANG TUA)
  if (params.waliKelas) ws.getCell('C105').value = params.waliKelas;
  if (params.nuptkWali) {
    const n = params.nuptkWali.trim();
    ws.getCell('C106').value = n.startsWith('NUPTK') ? n : `    NUPTK. ${n}`;
  }

  if (params.guruPendamping) ws.getCell('R105').value = params.guruPendamping;
  if (params.nuptkPendamping) {
    const np = params.nuptkPendamping.trim();
    ws.getCell('R106').value = np.startsWith('NUPTK') ? np : `NUPTK. ${np}`;
  }

  // 4. Aspek & Indikator Section A
  // A.1 Baca Tulis Al-Quran
  const btqGrade = evalData.aspectGrades['lps_a_1'] || 'B';
  ws.getCell('O18').value = btqGrade;
  if (evalData.descriptions['lps_a_1']) {
    ws.getCell('O20').value = evalData.descriptions['lps_a_1'];
  }

  // A.2 Penerapan 7 Kebiasaan (Rows 27 - 33)
  const kebiasaanRows = [
    { row: 27, id: 'lps_a2_ind1' },
    { row: 28, id: 'lps_a2_ind2' },
    { row: 29, id: 'lps_a2_ind3' },
    { row: 30, id: 'lps_a2_ind4' },
    { row: 31, id: 'lps_a2_ind5' },
    { row: 32, id: 'lps_a2_ind6' },
    { row: 33, id: 'lps_a2_ind7' }
  ];
  kebiasaanRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Sudah Terbiasa';
    ws.getCell(`G${row}`).value = '';
    ws.getCell(`J${row}`).value = '';
    if (val === 'Sudah Terbiasa' || val === 'Sudah') {
      const c = ws.getCell(`G${row}`);
      c.value = 'ü';
      c.font = { name: 'Wingdings', size: 11 };
    } else {
      const c = ws.getCell(`J${row}`);
      c.value = 'ü';
      c.font = { name: 'Wingdings', size: 11 };
    }
  });
  if (evalData.descriptions['lps_a_2']) {
    ws.getCell('O25').value = evalData.descriptions['lps_a_2'];
  }

  // A.3 Pembiasaan (Rows 37 - 40, Pilihan A/B/C/D)
  const pembiasaanRows = [
    { row: 37, id: 'lps_a3_ind1' },
    { row: 38, id: 'lps_a3_ind2' },
    { row: 39, id: 'lps_a3_ind3' },
    { row: 40, id: 'lps_a3_ind4' }
  ];
  const gradeColMap: Record<string, string> = { A: 'G', B: 'I', C: 'K', D: 'M' };
  pembiasaanRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'A';
    ['G', 'I', 'K', 'M'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = gradeColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_a_3']) {
    ws.getCell('O35').value = evalData.descriptions['lps_a_3'];
  }

  // A.4 Prestasi Akademik (Rows 43 - 45)
  const akademikRows = [
    { row: 43, id: 'lps_a4_ind1' },
    { row: 44, id: 'lps_a4_ind2' },
    { row: 45, id: 'lps_a4_ind3' }
  ];
  akademikRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'B';
    ['G', 'I', 'K', 'M'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = gradeColMap[val] || 'I';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_a_4']) {
    ws.getCell('O41').value = evalData.descriptions['lps_a_4'];
  }

  // A.5 Praktek Ibadah (Rows 48 - 50)
  const ibadahRows = [
    { row: 48, id: 'lps_a5_ind1' },
    { row: 49, id: 'lps_a5_ind2' },
    { row: 50, id: 'lps_a5_ind3' }
  ];
  ibadahRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'A';
    ['G', 'I', 'K', 'M'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = gradeColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_a_5']) {
    ws.getCell('O46').value = evalData.descriptions['lps_a_5'];
  }

  // 5. Aspek & Indikator Section B (Target Hafalan)
  // B.1 Tahfidz / Juz-Amma (Rows 56 - 64)
  const hafalanColMap: Record<string, string> = { Hafal: 'G', Sebagian: 'J', Belum: 'O' };
  const tahfidzRows = [
    { row: 56, id: 'lps_b1_ind1' },
    { row: 57, id: 'lps_b1_ind2' },
    { row: 58, id: 'lps_b1_ind3' },
    { row: 59, id: 'lps_b1_ind4' },
    { row: 60, id: 'lps_b1_ind5' },
    { row: 61, id: 'lps_b1_ind6' },
    { row: 62, id: 'lps_b1_ind7' },
    { row: 63, id: 'lps_b1_ind8' },
    { row: 64, id: 'lps_b1_ind9' }
  ];
  tahfidzRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = hafalanColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_b_1']) {
    ws.getCell('R55').value = evalData.descriptions['lps_b_1'];
  }

  // B.2 Do'a Sehari-hari (Rows 66 - 75)
  const doaRows = [
    { row: 66, id: 'lps_b2_ind1' },
    { row: 67, id: 'lps_b2_ind2' },
    { row: 68, id: 'lps_b2_ind3' },
    { row: 69, id: 'lps_b2_ind4' },
    { row: 70, id: 'lps_b2_ind5' },
    { row: 71, id: 'lps_b2_ind6' },
    { row: 72, id: 'lps_b2_ind7' },
    { row: 73, id: 'lps_b2_ind8' },
    { row: 74, id: 'lps_b2_ind9' },
    { row: 75, id: 'lps_b2_ind10' }
  ];
  doaRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = hafalanColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_b_2']) {
    ws.getCell('R65').value = evalData.descriptions['lps_b_2'];
  }

  // B.3 Mahfudzat (Rows 77 - 90)
  const mahfudzatRows = [
    { row: 77, id: 'lps_b3_ind1' },
    { row: 78, id: 'lps_b3_ind2' },
    { row: 79, id: 'lps_b3_ind3' },
    { row: 80, id: 'lps_b3_ind4' },
    { row: 81, id: 'lps_b3_ind5' },
    { row: 82, id: 'lps_b3_ind6' },
    { row: 83, id: 'lps_b3_ind7' },
    { row: 84, id: 'lps_b3_ind8' },
    { row: 85, id: 'lps_b3_ind9' },
    { row: 86, id: 'lps_b3_ind10' },
    { row: 87, id: 'lps_b3_ind11' },
    { row: 88, id: 'lps_b3_ind12' },
    { row: 89, id: 'lps_b3_ind13' },
    { row: 90, id: 'lps_b3_ind14' }
  ];
  mahfudzatRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'K', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = val === 'Belum' ? 'K' : (val === 'Sebagian' ? 'J' : 'G');
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = 'ü';
    c.font = { name: 'Wingdings', size: 11 };
  });
  if (evalData.descriptions['lps_b_3']) {
    ws.getCell('R76').value = evalData.descriptions['lps_b_3'];
  }
}

// Populate BLP Worksheet (100% Identik dengan BLP - Template wajib.xlsx)
function populateBLPSheet(
  ws: ExcelJS.Worksheet,
  student: Student,
  evalData: StudentEvaluationData,
  params: ReportExportParams
) {
  // 1. Identitas Siswa & Kelas
  ws.getCell('D11').value = `: ${student['Nama Lengkap']}`;
  ws.getCell('D12').value = `: ${student.NISN || '-'}`;
  ws.getCell('U11').value = `: ${student.Kelas || params.classId}`;
  ws.getCell('U12').value = `: ${params.semester} (${params.semester === '1' ? 'Satu' : 'Dua'})`;

  // 2. Tanggal Pengesahan
  if (params.masehiDate) ws.getCell('X72').value = params.masehiDate;
  if (params.hijriDate) ws.getCell('X73').value = params.hijriDate;

  // 3. Tanda Tangan BLP (Catatan 1 + Wali Kelas, Catatan 2 + Kepala Sekolah, Catatan Orang Tua)
  if (params.catatan1) ws.getCell('A76').value = params.catatan1;
  if (params.waliKelas) ws.getCell('R81').value = params.waliKelas;
  if (params.nuptkWali) {
    const nw = params.nuptkWali.trim();
    ws.getCell('R82').value = nw.startsWith('NUPTK') ? nw : `NUPTK. ${nw}`;
  }

  if (params.catatan2) ws.getCell('A84').value = params.catatan2;
  const ksName = params.kepalaSekolah || params.guruPendamping || 'Kepala Sekolah, S.Pd., Gr.';
  ws.getCell('R89').value = ksName;
  const nuksVal = params.nuks || params.nuptkPendamping || '332353523532535';
  ws.getCell('R90').value = nuksVal.startsWith('NUKS') ? nuksVal : (nuksVal.startsWith('NUPTK') ? nuksVal : `NUKS. ${nuksVal}`);

  // Catatan Orang Tua
  ws.getCell('R97').value = '( _______________________ )';

  // 4. Aspek & Indikator Section A
  // A.1 BTQ & A.2 Muroja'ah
  const btqGrade = evalData.aspectGrades['blp_a_1'] || 'B';
  ws.getCell('O18').value = btqGrade;
  if (evalData.descriptions['blp_a_1']) {
    ws.getCell('O20').value = evalData.descriptions['blp_a_1'];
  }
  if (evalData.descriptions['blp_a_2']) {
    ws.getCell('O25').value = evalData.descriptions['blp_a_2'];
  }

  // A.3 Pembiasaan (Rows 32 - 36, Pilihan A/B/C/D)
  const pembiasaanBLPRows = [
    { row: 32, id: 'blp_a3_ind1' },
    { row: 33, id: 'blp_a3_ind2' },
    { row: 34, id: 'blp_a3_ind3' },
    { row: 35, id: 'blp_a3_ind4' },
    { row: 36, id: 'blp_a3_ind5' }
  ];
  const gradeColMap: Record<string, string> = { A: 'G', B: 'I', C: 'K', D: 'M' };
  pembiasaanBLPRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'A';
    ['G', 'I', 'K', 'M'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = gradeColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = '✓';
    c.font = { name: 'Calibri', size: 11, bold: true };
  });
  if (evalData.descriptions['blp_a_3']) {
    ws.getCell('O30').value = evalData.descriptions['blp_a_3'];
  }

  // A.4 Praktek Ibadah (Rows 39 - 40)
  const ibadahBLPRows = [
    { row: 39, id: 'blp_a4_ind1' },
    { row: 40, id: 'blp_a4_ind2' }
  ];
  ibadahBLPRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'B';
    ['G', 'I', 'K', 'M'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = gradeColMap[val] || 'I';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = '✓';
    c.font = { name: 'Calibri', size: 11, bold: true };
  });
  if (evalData.descriptions['blp_a_4']) {
    ws.getCell('O37').value = evalData.descriptions['blp_a_4'];
  }

  // 5. Aspek & Indikator Section B (Target Hafalan)
  const hafalanColMap: Record<string, string> = { Hafal: 'G', Sebagian: 'J', Belum: 'O' };

  // B.1 Tahfidz (Rows 46 - 50)
  const tahfidzBLPRows = [
    { row: 46, id: 'blp_b1_ind1' },
    { row: 47, id: 'blp_b1_ind2' },
    { row: 48, id: 'blp_b1_ind3' },
    { row: 49, id: 'blp_b1_ind4' },
    { row: 50, id: 'blp_b1_ind5' }
  ];
  tahfidzBLPRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = hafalanColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = '✓';
    c.font = { name: 'Calibri', size: 11, bold: true };
  });
  if (evalData.descriptions['blp_b_1']) {
    ws.getCell('R45').value = evalData.descriptions['blp_b_1'];
  }

  // B.2 Do'a Sehari-hari (Rows 52 - 58)
  const doaBLPRows = [
    { row: 52, id: 'blp_b2_ind1' },
    { row: 53, id: 'blp_b2_ind2' },
    { row: 54, id: 'blp_b2_ind3' },
    { row: 55, id: 'blp_b2_ind4' },
    { row: 56, id: 'blp_b2_ind5' },
    { row: 57, id: 'blp_b2_ind6' },
    { row: 58, id: 'blp_b2_ind7' }
  ];
  doaBLPRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = hafalanColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = '✓';
    c.font = { name: 'Calibri', size: 11, bold: true };
  });
  if (evalData.descriptions['blp_b_2']) {
    ws.getCell('R51').value = evalData.descriptions['blp_b_2'];
  }

  // B.3 Mahfudzat (Rows 60 - 66)
  const mahfudzatBLPRows = [
    { row: 60, id: 'blp_b3_ind1' },
    { row: 61, id: 'blp_b3_ind2' },
    { row: 62, id: 'blp_b3_ind3' },
    { row: 63, id: 'blp_b3_ind4' },
    { row: 64, id: 'blp_b3_ind5' },
    { row: 65, id: 'blp_b3_ind6' },
    { row: 66, id: 'blp_b3_ind7' }
  ];
  mahfudzatBLPRows.forEach(({ row, id }) => {
    const val = evalData.indicatorChecks[id] || 'Hafal';
    ['G', 'J', 'O'].forEach((col) => {
      ws.getCell(`${col}${row}`).value = '';
    });
    const targetCol = hafalanColMap[val] || 'G';
    const c = ws.getCell(`${targetCol}${row}`);
    c.value = '✓';
    c.font = { name: 'Calibri', size: 11, bold: true };
  });
  if (evalData.descriptions['blp_b_3']) {
    ws.getCell('R59').value = evalData.descriptions['blp_b_3'];
  }
}

// Master Export Function: Uses Official Template File to Guarantee 100% Identical Borders & Header
export async function exportReportToExcel(params: ReportExportParams): Promise<void> {
  const templateBuf = await getTemplateBuffer(params.type);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuf);

  const studentsToExport = params.isSingleStudent && params.targetNisn
    ? params.students.filter((s) => s.NISN === params.targetNisn)
    : params.students;

  if (studentsToExport.length === 0) {
    throw new Error('Tidak ada data siswa untuk diekspor.');
  }

  const masterSheet = wb.worksheets[0];

  studentsToExport.forEach((student, index) => {
    const rawSheetName = student.Panggilan || student['Nama Lengkap'].split(' ')[0] || student.NISN;
    const safeSheetName = rawSheetName.replace(/[\\/?*[\]]/g, '').substring(0, 30);

    let ws: ExcelJS.Worksheet;

    if (index === 0) {
      ws = masterSheet;
      ws.name = safeSheetName;
    } else {
      // Clone exact model and images from masterSheet to ensure 100% border & style fidelity
      ws = wb.addWorksheet(safeSheetName);
      const clonedModel = JSON.parse(JSON.stringify(masterSheet.model));
      clonedModel.name = safeSheetName;
      ws.model = clonedModel;

      if (masterSheet.getImages) {
        masterSheet.getImages().forEach((img: any) => {
          if (img.imageId !== undefined && img.range) {
            ws.addImage(Number(img.imageId), img.range);
          }
        });
      }
    }

    const evalData: StudentEvaluationData = params.evaluations[student.NISN] || {
      studentNisn: student.NISN,
      aspectGrades: {},
      indicatorChecks: {},
      descriptions: {}
    };

    if (params.type === 'LPS') {
      populateLPSSheet(ws, student, evalData, params);
    } else {
      populateBLPSheet(ws, student, evalData, params);
    }
  });

  // Write and trigger browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const prefix = params.type;
  const targetLabel = params.isSingleStudent && studentsToExport[0]
    ? studentsToExport[0].Panggilan || studentsToExport[0]['Nama Lengkap'].split(' ')[0]
    : `Kelas_${params.classId}`;
  a.download = `${prefix}_${targetLabel}_Semester_${params.semester}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
