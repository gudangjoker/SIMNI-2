import ExcelJS from 'exceljs';
import { BTQRecord } from '@/types/btq';

export interface BTQExportParams {
  sheetTitle?: string;
  periode: string; // e.g. "PERTENGAHAN SEMESTER 1"
  tahunPelajaran: string; // e.g. "2025-2026"
  namaPengajar: string; // e.g. "Unggaran"
  records: BTQRecord[];
  isMultiClass?: boolean;
}

export async function exportBTQToExcel(params: BTQExportParams): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIMNI - SDIT Bina Muda Cicalengka';
  wb.created = new Date();

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  const populateSheet = (ws: ExcelJS.Worksheet, records: BTQRecord[]) => {
    // Column widths identical to template
    ws.columns = [
      { key: 'no', width: 5.5 },
      { key: 'nama', width: 52 },
      { key: 'kelas', width: 12 },
      { key: 'hanca', width: 24.5 },
      { key: 'nilai', width: 13 },
      { key: 'deskripsi', width: 71.5 }
    ];

    // Row 1: Title
    ws.mergeCells('A1:F1');
    const r1 = ws.getCell('A1');
    r1.value = 'LAPORAN PERKEMBANGAN BTQ';
    r1.font = { name: 'Calibri', size: 14, bold: true };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 18.75;

    // Row 2: Periode
    ws.mergeCells('A2:F2');
    const r2 = ws.getCell('A2');
    r2.value = params.periode.toUpperCase();
    r2.font = { name: 'Calibri', size: 14, bold: true };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18.75;

    // Row 3: Tahun Pelajaran
    ws.mergeCells('A3:F3');
    const r3 = ws.getCell('A3');
    r3.value = `TAHUN PELAJARAN ${params.tahunPelajaran}`;
    r3.font = { name: 'Calibri', size: 12, bold: true };
    r3.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 18.75;

    // Row 5: Nama Pengajar
    ws.mergeCells('A5:C5');
    const r5 = ws.getCell('A5');
    r5.value = `NAMA PENGAJAR : ${params.namaPengajar || '-'}`;
    r5.font = { name: 'Calibri', size: 12, bold: true };
    r5.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(5).height = 15.75;

    // Row 7: Table Headers
    const headers = [
      { col: 1, text: 'NO', font: { name: 'Calibri', size: 12, bold: true } },
      { col: 2, text: 'NAMA SISWA', font: { name: 'Calibri', size: 12, bold: true } },
      { col: 3, text: 'KELAS', font: { name: 'Calibri', size: 12, bold: true } },
      { col: 4, text: 'HANCA TERAKHIR', font: { name: 'Calibri', size: 12, bold: true } },
      { col: 5, text: 'NILAI', font: { name: 'Calibri', size: 12, bold: true } },
      { col: 6, text: 'GAMBARAN KEMAMPUAN MENGAJI DAN REKOMENDASI UNTUK ORANGTUA', font: { name: 'Calibri', size: 11, bold: true } }
    ];

    ws.getRow(7).height = 20;
    headers.forEach((h) => {
      const cell = ws.getRow(7).getCell(h.col);
      cell.value = h.text;
      cell.font = h.font;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });

    // Row 8+: Data Rows
    records.forEach((rec, idx) => {
      const rowNum = 8 + idx;
      const row = ws.getRow(rowNum);

      // NO
      const c1 = row.getCell(1);
      c1.value = idx + 1;
      c1.font = { name: 'Calibri', size: 11 };
      c1.alignment = { horizontal: 'center', vertical: 'middle' };
      c1.border = thinBorder;

      // NAMA SISWA
      const c2 = row.getCell(2);
      c2.value = rec.nama;
      c2.font = { name: 'Calibri', size: 12 };
      c2.alignment = { horizontal: 'left', vertical: 'middle' };
      c2.border = thinBorder;

      // KELAS
      const c3 = row.getCell(3);
      c3.value = rec.kelas;
      c3.font = { name: 'Calibri', size: 11 };
      c3.alignment = { horizontal: 'center', vertical: 'middle' };
      c3.border = thinBorder;

      // HANCA TERAKHIR
      const c4 = row.getCell(4);
      c4.value = rec.hancaTerakhir || '-';
      c4.font = { name: 'Calibri', size: 11 };
      c4.alignment = { horizontal: 'center', vertical: 'middle' };
      c4.border = thinBorder;

      // NILAI
      const c5 = row.getCell(5);
      c5.value = rec.nilai && rec.nilai !== '-' ? rec.nilai : '-';
      c5.font = { name: 'Calibri', size: 11 };
      c5.alignment = { horizontal: 'center', vertical: 'middle' };
      c5.border = thinBorder;

      // GAMBARAN KEMAMPUAN
      const c6 = row.getCell(6);
      c6.value = rec.gambaranKemampuan || '-';
      c6.font = { name: 'Calibri', size: 10 };
      c6.alignment = { vertical: 'middle', wrapText: true };
      c6.border = thinBorder;

      // Dynamic row height based on content length
      const textLen = (rec.gambaranKemampuan || '').length;
      if (textLen > 250) row.height = 95;
      else if (textLen > 150) row.height = 65;
      else if (textLen > 70) row.height = 45;
      else row.height = 28;
    });

    // Page Setup for Print/PDF
    ws.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    };
  };

  if (params.isMultiClass) {
    // Group records by kelas
    const classGroups: Record<string, BTQRecord[]> = {};
    params.records.forEach((r) => {
      const k = r.kelas || 'Umum';
      if (!classGroups[k]) classGroups[k] = [];
      classGroups[k].push(r);
    });

    // Also create 1 master sheet "KELAS1-6" like the official template
    const masterSheet = wb.addWorksheet('KELAS1-6');
    populateSheet(masterSheet, params.records);

    // And separate tabs per rombel
    Object.keys(classGroups).sort().forEach((kelas) => {
      const ws = wb.addWorksheet(`Kelas ${kelas}`);
      populateSheet(ws, classGroups[kelas]);
    });
  } else {
    const sheetName = params.sheetTitle || 'Laporan BTQ';
    const ws = wb.addWorksheet(sheetName.substring(0, 31));
    populateSheet(ws, params.records);
  }

  // Trigger browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safePeriode = params.periode.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `Laporan_BTQ_${safePeriode}_${params.tahunPelajaran.replace('/', '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
