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
  classMaster?: string;
  nuptkMaster?: string;
  headMaster?: string;
  nuptkHead?: string;
}

// Helper to fetch school logo buffer in both browser and node
async function getLogoBuffer(): Promise<ArrayBuffer | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/school-logo.png');
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // fallback
    }
  } else {
    try {
      const fs = require('fs');
      const path = require('path');
      const p = path.join(process.cwd(), 'public', 'school-logo.png');
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function exportReportToExcel(params: ReportExportParams): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIMNI - SDIT Bina Muda Cicalengka';
  wb.created = new Date();

  const logoBuffer = await getLogoBuffer();
  let logoImgId: number | null = null;
  if (logoBuffer) {
    logoImgId = wb.addImage({
      buffer: logoBuffer,
      extension: 'png'
    });
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  const grayFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' }
  };

  const studentsToExport = params.isSingleStudent && params.targetNisn
    ? params.students.filter((s) => s.NISN === params.targetNisn)
    : params.students;

  if (studentsToExport.length === 0) {
    throw new Error('Tidak ada data siswa untuk diekspor.');
  }

  studentsToExport.forEach((student) => {
    const rawSheetName = student.Panggilan || student['Nama Lengkap'].split(' ')[0] || student.NISN;
    const sheetName = rawSheetName.replace(/[\\/?*[\]]/g, '').substring(0, 30);
    const ws = wb.addWorksheet(sheetName);

    const evalData: StudentEvaluationData = params.evaluations[student.NISN] || {
      studentNisn: student.NISN,
      aspectGrades: {},
      indicatorChecks: {},
      descriptions: {}
    };

    // Set 31 column widths matching official template
    const colWidths = [
      4.8, 3.8, 4.8, 4.8, 4.8, 4.8, // A - F
      3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, // G - N
      3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8 // O - AE
    ];
    colWidths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    // 1. School Logo (Row 1-4, Col A-C)
    if (logoImgId !== null) {
      ws.addImage(logoImgId, {
        tl: { col: 0.43, row: 0.57 } as any,
        br: { col: 2.37, row: 4.00 } as any
      });
    }

    // 2. School Header (Kop Surat 100% Identik)
    ws.mergeCells('A1:AE1');
    const r1 = ws.getCell('A1');
    r1.value = 'YAYASAN SOSIAL DAN PENDIDIKAN BINA MUDA';
    r1.font = { name: 'Britannic Bold', size: 11 };
    r1.alignment = { horizontal: 'left', vertical: 'middle', indent: 9 };
    ws.getRow(1).height = 15;

    ws.mergeCells('A2:AE2');
    const r2 = ws.getCell('A2');
    r2.value = 'SEKOLAH DASAR ISLAM TERPADU';
    r2.font = { name: 'Estrangelo Edessa', size: 11 };
    r2.alignment = { horizontal: 'left', vertical: 'middle', indent: 9 };
    ws.getRow(2).height = 15;

    ws.mergeCells('A3:AE3');
    const r3 = ws.getCell('A3');
    r3.value = 'SDIT BINA MUDA CICALENGKA';
    r3.font = { name: 'Cooper Black', size: 18 };
    r3.alignment = { horizontal: 'left', vertical: 'middle', indent: 9 };
    ws.getRow(3).height = 22;

    ws.mergeCells('A4:AE4');
    const r4 = ws.getCell('A4');
    r4.value = 'Terakreditasi "A"';
    r4.font = { name: 'Cambria', size: 11, bold: true };
    r4.alignment = { horizontal: 'left', vertical: 'middle', indent: 9 };
    ws.getRow(4).height = 15;

    ws.mergeCells('A5:AE5');
    const r5 = ws.getCell('A5');
    r5.value = 'Ijin Operasional/RPS : No.421.2/1143-Disdikbud/2011';
    r5.font = { name: 'Candara', size: 10, italic: true };
    r5.alignment = { horizontal: 'left', vertical: 'middle', indent: 9 };
    ws.getRow(5).height = 13;

    // Row 6: Empty separator
    ws.getRow(6).height = 6;

    // Row 7: Report Title
    ws.mergeCells('A7:AE7');
    const r7 = ws.getCell('A7');
    r7.value = params.template.title;
    r7.font = { name: 'Gill Sans MT', size: 11, bold: true };
    r7.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(7).height = 15;

    // Row 8: Subtitle
    ws.mergeCells('A8:AE8');
    const r8 = ws.getCell('A8');
    r8.value = params.template.subTitle;
    r8.font = { name: 'Calibri', size: 11, bold: params.type === 'LPS' };
    r8.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(8).height = 15;

    // Row 9: Academic Year
    ws.mergeCells('A9:AE9');
    const r9 = ws.getCell('A9');
    r9.value = `Tahun Pelajaran ${params.academicYear}`;
    r9.font = { name: 'Sakkal Majalla', size: 12 };
    r9.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(9).height = 15;

    // Row 10: Empty separator
    ws.getRow(10).height = 6;

    // Row 11: Nama Siswa & Kelas
    ws.mergeCells('A11:C11');
    ws.getCell('A11').value = 'Nama Siswa';
    ws.getCell('A11').font = { name: 'Calibri', size: 11, bold: true };

    ws.mergeCells('D11:O11');
    ws.getCell('D11').value = `: ${student['Nama Lengkap']}`;
    ws.getCell('D11').font = { name: 'Calibri', size: 11 };

    ws.mergeCells('Q11:T11');
    ws.getCell('Q11').value = 'Kelas';
    ws.getCell('Q11').font = { name: 'Calibri', size: 11, bold: true };

    ws.mergeCells('U11:AE11');
    ws.getCell('U11').value = `: ${student.Kelas || params.classId}`;
    ws.getCell('U11').font = { name: 'Calibri', size: 11 };
    ws.getRow(11).height = 15;

    // Row 12: No. Induk & Semester
    ws.mergeCells('A12:C12');
    ws.getCell('A12').value = 'No. Induk';
    ws.getCell('A12').font = { name: 'Calibri', size: 11, bold: true };

    ws.mergeCells('D12:O12');
    ws.getCell('D12').value = `: ${student.NISN || '-'}`;
    ws.getCell('D12').font = { name: 'Calibri', size: 11 };

    ws.mergeCells('Q12:T12');
    ws.getCell('Q12').value = 'Semester';
    ws.getCell('Q12').font = { name: 'Calibri', size: 11, bold: true };

    ws.mergeCells('U12:AE12');
    ws.getCell('U12').value = `: ${params.semester} (${params.semester === '1' ? 'Satu' : 'Dua'})`;
    ws.getCell('U12').font = { name: 'Calibri', size: 11 };
    ws.getRow(12).height = 15;

    // Row 13: Empty
    ws.getRow(13).height = 6;

    let currentRow = 14;

    // Loop Sections (A and B)
    params.template.sections.forEach((sec) => {
      // Section Header (e.g. A. Baca Tulis Al-Qur'an... or B. Target Hafalan)
      ws.mergeCells(`A${currentRow}:AE${currentRow}`);
      const secCell = ws.getCell(`A${currentRow}`);
      secCell.value = sec.title;
      secCell.font = { name: 'Calibri', size: 11, bold: true };
      secCell.alignment = { horizontal: 'left', vertical: 'middle' };
      ws.getRow(currentRow).height = 18;
      currentRow++;

      // Table Main Headers
      if (sec.id === 'A') {
        // Table Header 1
        ws.mergeCells(`A${currentRow}:A${currentRow + 1}`);
        const cNo = ws.getCell(`A${currentRow}`);
        cNo.value = 'NO';
        cNo.font = { name: 'Calibri', size: 10, bold: true };
        cNo.alignment = { horizontal: 'center', vertical: 'middle' };
        cNo.fill = grayFill;

        ws.mergeCells(`B${currentRow}:N${currentRow}`);
        const cAspek = ws.getCell(`B${currentRow}`);
        cAspek.value = params.type === 'BLP' ? 'MATA PELAJARAN / ASPEK PENILAIAN' : 'ASPEK PENILAIAN';
        cAspek.font = { name: 'Calibri', size: 10, bold: true };
        cAspek.alignment = { horizontal: 'center', vertical: 'middle' };
        cAspek.fill = grayFill;

        ws.mergeCells(`O${currentRow}:AE${currentRow}`);
        const cNilai = ws.getCell(`O${currentRow}`);
        cNilai.value = 'NILAI';
        cNilai.font = { name: 'Calibri', size: 10, bold: true };
        cNilai.alignment = { horizontal: 'center', vertical: 'middle' };
        cNilai.fill = grayFill;
        ws.getRow(currentRow).height = 16;
        currentRow++;

        // Table Header 2
        ws.mergeCells(`B${currentRow}:N${currentRow}`);
        const cKd = ws.getCell(`B${currentRow}`);
        cKd.value = 'Kompetensi Dasar (KD) - Indikator';
        cKd.font = { name: 'Calibri', size: 10, bold: true };
        cKd.alignment = { horizontal: 'center', vertical: 'middle' };
        cKd.fill = grayFill;

        ws.mergeCells(`O${currentRow}:AE${currentRow}`);
        const cDesk = ws.getCell(`O${currentRow}`);
        cDesk.value = params.type === 'BLP' ? 'DESKRIPSI' : 'DESKRIPSI DAN REKOMENDASI';
        cDesk.font = { name: 'Calibri', size: 10, bold: true };
        cDesk.alignment = { horizontal: 'center', vertical: 'middle' };
        cDesk.fill = grayFill;
        ws.getRow(currentRow).height = 16;
        currentRow++;
      } else {
        // Section B Headers
        ws.mergeCells(`A${currentRow}:A${currentRow}`);
        const cNo = ws.getCell(`A${currentRow}`);
        cNo.value = 'NO';
        cNo.font = { name: 'Calibri', size: 10, bold: true };
        cNo.alignment = { horizontal: 'center', vertical: 'middle' };
        cNo.fill = grayFill;

        ws.mergeCells(`B${currentRow}:F${currentRow}`);
        const cAspek = ws.getCell(`B${currentRow}`);
        cAspek.value = 'ASPEK PENILAIAN';
        cAspek.font = { name: 'Calibri', size: 10, bold: true };
        cAspek.alignment = { horizontal: 'center', vertical: 'middle' };
        cAspek.fill = grayFill;

        ws.mergeCells(`G${currentRow}:Q${currentRow}`);
        const cKrit = ws.getCell(`G${currentRow}`);
        cKrit.value = 'KRITERIA';
        cKrit.font = { name: 'Calibri', size: 10, bold: true };
        cKrit.alignment = { horizontal: 'center', vertical: 'middle' };
        cKrit.fill = grayFill;

        ws.mergeCells(`R${currentRow}:AE${currentRow}`);
        const cDesk = ws.getCell(`R${currentRow}`);
        cDesk.value = params.type === 'BLP' ? 'DESKRIPSI' : 'DESKRIPSI DAN REKOMENDASI';
        cDesk.font = { name: 'Calibri', size: 10, bold: true };
        cDesk.alignment = { horizontal: 'center', vertical: 'middle' };
        cDesk.fill = grayFill;
        ws.getRow(currentRow).height = 18;
        currentRow++;
      }

      // Loop Aspects in Section
      sec.aspects.forEach((asp, aspIdx) => {
        const aspectStartRow = currentRow;
        const indCount = Math.max(asp.indicators.length, 1);
        const descText = evalData.descriptions[asp.id] || asp.defaultDescription;
        const aspectGrade = evalData.aspectGrades[asp.id] || 'B';

        if (sec.id === 'A') {
          // SECTION A RENDERING
          if (asp.evalType === 'single_grade') {
            // E.g. Baca Tulis Al-Quran or Muroja'ah
            const totalRows = Math.max(indCount + 1, 3);
            const aspectEndRow = aspectStartRow + totalRows - 1;

            // Merged No
            ws.mergeCells(`A${aspectStartRow}:A${aspectEndRow}`);
            const cellNo = ws.getCell(`A${aspectStartRow}`);
            cellNo.value = aspIdx + 1;
            cellNo.font = { name: 'Calibri', size: 11, bold: true };
            cellNo.alignment = { horizontal: 'center', vertical: 'middle' };

            // Aspect Title Row
            ws.mergeCells(`B${aspectStartRow}:N${aspectStartRow}`);
            const cellTitle = ws.getCell(`B${aspectStartRow}`);
            cellTitle.value = asp.title;
            cellTitle.font = { name: 'Calibri', size: 10, bold: true };
            cellTitle.alignment = { horizontal: 'left', vertical: 'middle' };

            // Grade cell top
            ws.mergeCells(`O${aspectStartRow}:AE${aspectStartRow}`);
            const cellGr = ws.getCell(`O${aspectStartRow}`);
            cellGr.value = aspectGrade;
            cellGr.font = { name: 'Calibri', size: 12, bold: true };
            cellGr.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(aspectStartRow).height = 20;

            // Indicator Rows
            asp.indicators.forEach((ind, iIdx) => {
              const rIdx = aspectStartRow + 1 + iIdx;
              ws.mergeCells(`B${rIdx}:N${rIdx}`);
              const cellInd = ws.getCell(`B${rIdx}`);
              cellInd.value = ind.text;
              cellInd.font = { name: 'Calibri', size: 10 };
              cellInd.alignment = { horizontal: 'left', vertical: 'middle' };
              ws.getRow(rIdx).height = 18;
            });

            // Description block merged
            ws.mergeCells(`O${aspectStartRow + 1}:AE${aspectEndRow}`);
            const cellDesc = ws.getCell(`O${aspectStartRow + 1}`);
            cellDesc.value = descText;
            cellDesc.font = { name: 'Calibri', size: 9 };
            cellDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

            currentRow = aspectEndRow + 1;
          } else {
            // Checklist or Grade per Indicator (7 Kebiasaan, Pembiasaan, Prestasi Akademik, Praktek Ibadah)
            const is7Kebiasaan = asp.evalType === 'checklist';
            const totalRows = indCount + 1;
            const aspectEndRow = aspectStartRow + totalRows - 1;

            // Merged No
            ws.mergeCells(`A${aspectStartRow}:A${aspectEndRow}`);
            const cellNo = ws.getCell(`A${aspectStartRow}`);
            cellNo.value = aspIdx + 1;
            cellNo.font = { name: 'Calibri', size: 11, bold: true };
            cellNo.alignment = { horizontal: 'center', vertical: 'middle' };

            // Aspect Title
            ws.mergeCells(`B${aspectStartRow}:F${aspectStartRow}`);
            const cellTitle = ws.getCell(`B${aspectStartRow}`);
            cellTitle.value = asp.title;
            cellTitle.font = { name: 'Calibri', size: 10, bold: true };
            cellTitle.alignment = { horizontal: 'left', vertical: 'middle' };

            // Criteria subheaders in Row 1 of Aspect
            if (is7Kebiasaan) {
              ws.mergeCells(`G${aspectStartRow}:I${aspectStartRow}`);
              const cSub1 = ws.getCell(`G${aspectStartRow}`);
              cSub1.value = 'Sudah Terbiasa';
              cSub1.font = { name: 'Calibri', size: 9, bold: true };
              cSub1.alignment = { horizontal: 'center', vertical: 'middle' };

              ws.mergeCells(`J${aspectStartRow}:N${aspectStartRow}`);
              const cSub2 = ws.getCell(`J${aspectStartRow}`);
              cSub2.value = 'Belum Terbiasa';
              cSub2.font = { name: 'Calibri', size: 9, bold: true };
              cSub2.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              // Grade options A, B, C, D
              ws.mergeCells(`G${aspectStartRow}:H${aspectStartRow}`);
              ws.getCell(`G${aspectStartRow}`).value = 'A';
              ws.getCell(`G${aspectStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

              ws.mergeCells(`I${aspectStartRow}:J${aspectStartRow}`);
              ws.getCell(`I${aspectStartRow}`).value = 'B';
              ws.getCell(`I${aspectStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

              ws.mergeCells(`K${aspectStartRow}:L${aspectStartRow}`);
              ws.getCell(`K${aspectStartRow}`).value = 'C';
              ws.getCell(`K${aspectStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

              ws.mergeCells(`M${aspectStartRow}:N${aspectStartRow}`);
              ws.getCell(`M${aspectStartRow}`).value = 'D';
              ws.getCell(`M${aspectStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

              ['G', 'I', 'K', 'M'].forEach((col) => {
                ws.getCell(`${col}${aspectStartRow}`).font = { name: 'Calibri', size: 9, bold: true };
              });
            }

            // Description block merged across all rows of this aspect
            ws.mergeCells(`O${aspectStartRow}:AE${aspectEndRow}`);
            const cellDesc = ws.getCell(`O${aspectStartRow}`);
            cellDesc.value = descText;
            cellDesc.font = { name: 'Calibri', size: 9 };
            cellDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            ws.getRow(aspectStartRow).height = 18;

            // Indicator Rows
            asp.indicators.forEach((ind, iIdx) => {
              const rIdx = aspectStartRow + 1 + iIdx;
              const cellCode = ws.getCell(`B${rIdx}`);
              cellCode.value = ind.code;
              cellCode.font = { name: 'Calibri', size: 10 };
              cellCode.alignment = { horizontal: 'center', vertical: 'middle' };

              ws.mergeCells(`C${rIdx}:F${rIdx}`);
              const cellText = ws.getCell(`C${rIdx}`);
              cellText.value = ind.text;
              cellText.font = { name: 'Calibri', size: 10 };
              cellText.alignment = { horizontal: 'left', vertical: 'middle' };

              const chosenVal = evalData.indicatorChecks[ind.id] || (is7Kebiasaan ? 'Sudah Terbiasa' : 'A');
              const mark = params.template.checkMarkChar || '✓';

              if (is7Kebiasaan) {
                ws.mergeCells(`G${rIdx}:I${rIdx}`);
                const cG = ws.getCell(`G${rIdx}`);
                if (chosenVal === 'Sudah Terbiasa' || chosenVal === 'Sudah') {
                  cG.value = mark;
                  cG.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cG.alignment = { horizontal: 'center', vertical: 'middle' };

                ws.mergeCells(`J${rIdx}:N${rIdx}`);
                const cJ = ws.getCell(`J${rIdx}`);
                if (chosenVal === 'Belum Terbiasa' || chosenVal === 'Belum') {
                  cJ.value = mark;
                  cJ.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cJ.alignment = { horizontal: 'center', vertical: 'middle' };
              } else {
                // A, B, C, D cells
                ws.mergeCells(`G${rIdx}:H${rIdx}`);
                const cA = ws.getCell(`G${rIdx}`);
                if (chosenVal === 'A') {
                  cA.value = mark;
                  cA.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cA.alignment = { horizontal: 'center', vertical: 'middle' };

                ws.mergeCells(`I${rIdx}:J${rIdx}`);
                const cB = ws.getCell(`I${rIdx}`);
                if (chosenVal === 'B') {
                  cB.value = mark;
                  cB.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cB.alignment = { horizontal: 'center', vertical: 'middle' };

                ws.mergeCells(`K${rIdx}:L${rIdx}`);
                const cC = ws.getCell(`K${rIdx}`);
                if (chosenVal === 'C') {
                  cC.value = mark;
                  cC.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cC.alignment = { horizontal: 'center', vertical: 'middle' };

                ws.mergeCells(`M${rIdx}:N${rIdx}`);
                const cD = ws.getCell(`M${rIdx}`);
                if (chosenVal === 'D') {
                  cD.value = mark;
                  cD.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
                }
                cD.alignment = { horizontal: 'center', vertical: 'middle' };
              }

              ws.getRow(rIdx).height = 18;
            });

            currentRow = aspectEndRow + 1;
          }
        } else {
          // SECTION B RENDERING (HAFALAN, DOA, MAHFUDZAT)
          const totalRows = indCount + 1;
          const aspectEndRow = aspectStartRow + totalRows - 1;

          // Merged No
          ws.mergeCells(`A${aspectStartRow}:A${aspectEndRow}`);
          const cellNo = ws.getCell(`A${aspectStartRow}`);
          cellNo.value = aspIdx + 1;
          cellNo.font = { name: 'Calibri', size: 11, bold: true };
          cellNo.alignment = { horizontal: 'center', vertical: 'middle' };

          // Aspect Title
          ws.mergeCells(`B${aspectStartRow}:F${aspectStartRow}`);
          const cellTitle = ws.getCell(`B${aspectStartRow}`);
          cellTitle.value = asp.title;
          cellTitle.font = { name: 'Calibri', size: 10, bold: true };
          cellTitle.alignment = { horizontal: 'left', vertical: 'middle' };

          // Criteria subheaders: Hafal (G..I), Sebagian (J..N), Belum (O..Q)
          ws.mergeCells(`G${aspectStartRow}:I${aspectStartRow}`);
          const cHafal = ws.getCell(`G${aspectStartRow}`);
          cHafal.value = 'Hafal';
          cHafal.font = { name: 'Calibri', size: 9, bold: true };
          cHafal.alignment = { horizontal: 'center', vertical: 'middle' };

          ws.mergeCells(`J${aspectStartRow}:N${aspectStartRow}`);
          const cSebagian = ws.getCell(`J${aspectStartRow}`);
          cSebagian.value = 'Sebagian';
          cSebagian.font = { name: 'Calibri', size: 9, bold: true };
          cSebagian.alignment = { horizontal: 'center', vertical: 'middle' };

          ws.mergeCells(`O${aspectStartRow}:Q${aspectStartRow}`);
          const cBelum = ws.getCell(`O${aspectStartRow}`);
          cBelum.value = 'Belum';
          cBelum.font = { name: 'Calibri', size: 9, bold: true };
          cBelum.alignment = { horizontal: 'center', vertical: 'middle' };

          // Description block merged
          ws.mergeCells(`R${aspectStartRow}:AE${aspectEndRow}`);
          const cellDesc = ws.getCell(`R${aspectStartRow}`);
          cellDesc.value = descText;
          cellDesc.font = { name: 'Calibri', size: 9 };
          cellDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          ws.getRow(aspectStartRow).height = 18;

          // Indicator Rows
          asp.indicators.forEach((ind, iIdx) => {
            const rIdx = aspectStartRow + 1 + iIdx;
            const cellCode = ws.getCell(`B${rIdx}`);
            cellCode.value = ind.code;
            cellCode.font = { name: 'Calibri', size: 10 };
            cellCode.alignment = { horizontal: 'center', vertical: 'middle' };

            ws.mergeCells(`C${rIdx}:F${rIdx}`);
            const cellText = ws.getCell(`C${rIdx}`);
            cellText.value = ind.text;
            cellText.font = { name: 'Calibri', size: 10 };
            cellText.alignment = { horizontal: 'left', vertical: 'middle' };

            const chosenVal = evalData.indicatorChecks[ind.id] || 'Hafal';
            const mark = params.template.checkMarkChar || '✓';

            ws.mergeCells(`G${rIdx}:I${rIdx}`);
            const cG = ws.getCell(`G${rIdx}`);
            if (chosenVal === 'Hafal') {
              cG.value = mark;
              cG.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
            }
            cG.alignment = { horizontal: 'center', vertical: 'middle' };

            ws.mergeCells(`J${rIdx}:N${rIdx}`);
            const cJ = ws.getCell(`J${rIdx}`);
            if (chosenVal === 'Sebagian') {
              cJ.value = mark;
              cJ.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
            }
            cJ.alignment = { horizontal: 'center', vertical: 'middle' };

            ws.mergeCells(`O${rIdx}:Q${rIdx}`);
            const cO = ws.getCell(`O${rIdx}`);
            if (chosenVal === 'Belum') {
              cO.value = mark;
              cO.font = { name: mark === 'ü' ? 'Wingdings' : 'Calibri', size: 12, bold: true };
            }
            cO.alignment = { horizontal: 'center', vertical: 'middle' };

            ws.getRow(rIdx).height = 18;
          });

          currentRow = aspectEndRow + 1;
        }
      });

      // Small spacing after section
      ws.getRow(currentRow).height = 6;
      currentRow++;
    });

    // Apply borders to all table cells from Row 14 to currentRow - 1
    for (let r = 14; r < currentRow; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 31; c++) {
        const cell = row.getCell(c);
        // Only apply border if cell has content or is part of a merge
        if (cell.value !== null && cell.value !== undefined) {
          cell.border = thinBorder;
        }
      }
    }

    // Signatures and Dates Section
    currentRow += 2;
    const dateRow = currentRow;

    // Dates (Cicalengka, DD MMMM YYYY / Hijriyah)
    const mDate = evalData.masehiDate || params.masehiDate || '03 Mei 2025';
    const hDate = evalData.hijriDate || params.hijriDate || '05 Dzulqaidah 1446 H';

    ws.mergeCells(`S${dateRow}:W${dateRow}`);
    ws.getCell(`S${dateRow}`).value = 'Cicalengka,';
    ws.getCell(`S${dateRow}`).font = { name: 'Calibri', size: 10 };
    ws.getCell(`S${dateRow}`).alignment = { horizontal: 'right' };

    ws.mergeCells(`X${dateRow}:AE${dateRow}`);
    ws.getCell(`X${dateRow}`).value = mDate;
    ws.getCell(`X${dateRow}`).font = { name: 'Calibri', size: 10 };
    ws.getCell(`X${dateRow}`).alignment = { horizontal: 'left' };
    ws.getRow(dateRow).height = 15;

    ws.mergeCells(`S${dateRow + 1}:W${dateRow + 1}`);
    ws.getCell(`S${dateRow + 1}`).value = 'Cicalengka,';
    ws.getCell(`S${dateRow + 1}`).font = { name: 'Calibri', size: 10 };
    ws.getCell(`S${dateRow + 1}`).alignment = { horizontal: 'right' };

    ws.mergeCells(`X${dateRow + 1}:AE${dateRow + 1}`);
    ws.getCell(`X${dateRow + 1}`).value = hDate;
    ws.getCell(`X${dateRow + 1}`).font = { name: 'Calibri', size: 10 };
    ws.getCell(`X${dateRow + 1}`).alignment = { horizontal: 'left' };
    ws.getRow(dateRow + 1).height = 15;

    currentRow += 4;
    const sigTitleRow = currentRow;

    // Signature Headers
    ws.mergeCells(`C${sigTitleRow}:F${sigTitleRow}`);
    ws.getCell(`C${sigTitleRow}`).value = 'Class Master';
    ws.getCell(`C${sigTitleRow}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`C${sigTitleRow}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`R${sigTitleRow}:AE${sigTitleRow}`);
    ws.getCell(`R${sigTitleRow}`).value = 'Class Master';
    ws.getCell(`R${sigTitleRow}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`R${sigTitleRow}`).alignment = { horizontal: 'center' };

    // Space for physical signature
    currentRow += 5;
    const nameRow = currentRow;

    const masterName = evalData.classMaster || params.classMaster || 'Wali Kelas, S.Pd.';
    const masterNuptk = evalData.nuptkMaster || params.nuptkMaster || 'NUPTK. 112231231231231';
    const headName = evalData.headMaster || params.headMaster || 'Kepala Sekolah, S.Pd., Gr.';
    const headNuptk = evalData.nuptkHead || params.nuptkHead || 'NUPTK. 525252524242341';

    ws.mergeCells(`C${nameRow}:F${nameRow}`);
    ws.getCell(`C${nameRow}`).value = masterName;
    ws.getCell(`C${nameRow}`).font = { name: 'Calibri', size: 10, bold: true, underline: true };
    ws.getCell(`C${nameRow}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`R${nameRow}:AE${nameRow}`);
    ws.getCell(`R${nameRow}`).value = headName;
    ws.getCell(`R${nameRow}`).font = { name: 'Calibri', size: 10, bold: true, underline: true };
    ws.getCell(`R${nameRow}`).alignment = { horizontal: 'center' };

    // NUPTK Row
    const nuptkRow = nameRow + 1;
    ws.mergeCells(`C${nuptkRow}:F${nuptkRow}`);
    ws.getCell(`C${nuptkRow}`).value = masterNuptk.startsWith('NUPTK') ? masterNuptk : `NUPTK. ${masterNuptk}`;
    ws.getCell(`C${nuptkRow}`).font = { name: 'Calibri', size: 9 };
    ws.getCell(`C${nuptkRow}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`R${nuptkRow}:AE${nuptkRow}`);
    ws.getCell(`R${nuptkRow}`).value = headNuptk.startsWith('NUPTK') ? headNuptk : `NUPTK. ${headNuptk}`;
    ws.getCell(`R${nuptkRow}`).font = { name: 'Calibri', size: 9 };
    ws.getCell(`R${nuptkRow}`).alignment = { horizontal: 'center' };

    // Notes Row (Catatan Orang Tua)
    const notesRow = nuptkRow + 2;
    ws.mergeCells(`A${notesRow}:AE${notesRow}`);
    ws.getCell(`A${notesRow}`).value = 'Catatan Orang tua :';
    ws.getCell(`A${notesRow}`).font = { name: 'Calibri', size: 10, bold: true };

    const parentLineRow = notesRow + 6;
    ws.mergeCells(`R${parentLineRow}:AE${parentLineRow}`);
    ws.getCell(`R${parentLineRow}`).value = '( _______________________ )';
    ws.getCell(`R${parentLineRow}`).alignment = { horizontal: 'center' };

    // Page Setup
    ws.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    };
  });

  // Write and trigger download in browser
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
