import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CLASSES = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];

const TAB_COLORS = [
    '2563EB', '3B82F6', // Kelas 1 (Blues)
    '0D9488', '14B8A6', // Kelas 2 (Teals)
    '059669', '10B981', // Kelas 3 (Emeralds)
    'D97706', 'F59E0B', // Kelas 4 (Ambers)
    '7C3AED', '8B5CF6', // Kelas 5 (Violets)
    'E11D48', 'F43F5E'  // Kelas 6 (Roses)
];

const THIN_BORDER = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
};

const HEADER_BORDER = {
    top: { style: 'thin', color: { argb: '1E293B' } },
    left: { style: 'thin', color: { argb: '334155' } },
    bottom: { style: 'medium', color: { argb: '0F172A' } },
    right: { style: 'thin', color: { argb: '334155' } }
};

// 1. Generate Template Data Siswa (1 Kelas)
async function generateStudent1Class() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIMNI Platform';
    wb.lastModifiedBy = 'SIMNI Administrator';
    wb.created = new Date();
    wb.modified = new Date();

    const sheet = wb.addWorksheet('Data Siswa', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
        properties: { tabColor: { argb: '1E3A8A' } }
    });

    sheet.columns = [
        { header: 'NISN', key: 'nisn', width: 20 },
        { header: 'Nama Lengkap', key: 'nama', width: 38 },
        { header: 'Panggilan', key: 'panggilan', width: 22 },
        { header: 'Kelas', key: 'kelas', width: 15 },
        { header: 'Kelompok', key: 'kelompok', width: 18 }
    ];

    styleHeaderRow(sheet.getRow(1), '1E3A8A');

    const examples = [
        ['0012345671', 'AHMAD FAUZI PRATAMA', 'Ahmad', '3A', 'Kelompok 1'],
        ['0012345672', 'BEATRIX NURUL HIKMAH', 'Nurul', '3A', 'Kelompok 1'],
        ['0012345673', 'CANDRA ADITYA NUGRAHA', 'Candra', '3A', 'Kelompok 2'],
        ['0012345674', 'DINA MARLIANA SARI', 'Dina', '3A', 'Kelompok 2'],
        ['0012345675', 'EKO PRASETYO WIBOWO', 'Eko', '3A', 'Kelompok 3']
    ];

    examples.forEach((rowValues, idx) => {
        const row = sheet.addRow(rowValues);
        styleDataRow(row, idx % 2 === 1, [
            { align: 'center', format: '@' },
            { align: 'left', format: '@' },
            { align: 'left', format: '@' },
            { align: 'center', format: '@' },
            { align: 'center', format: '@' }
        ]);
    });

    await saveWorkbook(wb, 'Template_Data_Siswa_1_Kelas.xlsx');
}

// 2. Generate Template Data Siswa (Per Kelas / 12 Kelas)
async function generateStudent12Classes() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIMNI Platform';
    wb.lastModifiedBy = 'SIMNI Administrator';
    wb.created = new Date();
    wb.modified = new Date();

    CLASSES.forEach((cls, classIdx) => {
        const sheet = wb.addWorksheet(cls, {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
            properties: { tabColor: { argb: TAB_COLORS[classIdx] } }
        });

        sheet.columns = [
            { header: 'NISN', key: 'nisn', width: 20 },
            { header: 'Nama Lengkap', key: 'nama', width: 38 },
            { header: 'Panggilan', key: 'panggilan', width: 22 },
            { header: 'Kelas', key: 'kelas', width: 15 },
            { header: 'Kelompok', key: 'kelompok', width: 18 }
        ];

        styleHeaderRow(sheet.getRow(1), '1E3A8A');

        const exampleRow = sheet.addRow([
            `00${classIdx + 1}2345671`,
            `CONTOH SISWA KELAS ${cls}`,
            'Siswa',
            cls,
            'Kelompok 1'
        ]);

        styleDataRow(exampleRow, false, [
            { align: 'center', format: '@' },
            { align: 'left', format: '@' },
            { align: 'left', format: '@' },
            { align: 'center', format: '@' },
            { align: 'center', format: '@' }
        ]);
    });

    await saveWorkbook(wb, 'Template_Data_Siswa_Per_Kelas.xlsx');
}

// 3. Generate Template Impor TP (1 Kelas)
async function generateTP1Class() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIMNI Platform';
    wb.lastModifiedBy = 'SIMNI Administrator';
    wb.created = new Date();
    wb.modified = new Date();

    const sheet = wb.addWorksheet('TP Kelas', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
        properties: { tabColor: { argb: '065F46' } }
    });

    sheet.columns = [
        { header: 'Mata Pelajaran', key: 'mapel', width: 26 },
        { header: 'Semester', key: 'semester', width: 14 },
        { header: 'Kode TP', key: 'kode', width: 16 },
        { header: 'Deskripsi TP', key: 'deskripsi', width: 55 },
        { header: 'Kelas', key: 'kelas', width: 14 }
    ];

    styleHeaderRow(sheet.getRow(1), '065F46');

    const examples = [
        ['Matematika', '1', 'MAT.1', 'Memahami bilangan cacah sampai 1000 dan nilai tempat.', '3A'],
        ['Matematika', '1', 'MAT.2', 'Melakukan operasi penjumlahan dan pengurangan bilangan cacah.', '3A'],
        ['Bahasa Indonesia', '1', 'BIN.1', 'Menemukan informasi penting dari teks narasi sederhana.', '3A'],
        ['Bahasa Indonesia', '1', 'BIN.2', 'Menulis paragraf deskriptif dengan ejaan dan tanda baca yang benar.', '3A'],
        ['Pendidikan Pancasila', '1', 'PAN.1', 'Mengidentifikasi makna sila-sila Pancasila dalam kehidupan sehari-hari.', '3A']
    ];

    examples.forEach((rowValues, idx) => {
        const row = sheet.addRow(rowValues);
        styleDataRow(row, idx % 2 === 1, [
            { align: 'left', format: '@' },
            { align: 'center', format: '@' },
            { align: 'center', format: '@' },
            { align: 'left', format: '@', wrap: true },
            { align: 'center', format: '@' }
        ]);
    });

    await saveWorkbook(wb, 'Template_Impor_TP_1_Kelas.xlsx');
}

// 4. Generate Template Impor TP (Per Kelas / 12 Kelas)
async function generateTP12Classes() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIMNI Platform';
    wb.lastModifiedBy = 'SIMNI Administrator';
    wb.created = new Date();
    wb.modified = new Date();

    CLASSES.forEach((cls, classIdx) => {
        const sheet = wb.addWorksheet(cls, {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
            properties: { tabColor: { argb: TAB_COLORS[classIdx] } }
        });

        sheet.columns = [
            { header: 'Mata Pelajaran', key: 'mapel', width: 26 },
            { header: 'Semester', key: 'semester', width: 14 },
            { header: 'Kode TP', key: 'kode', width: 16 },
            { header: 'Deskripsi TP', key: 'deskripsi', width: 55 },
            { header: 'Kelas', key: 'kelas', width: 14 }
        ];

        styleHeaderRow(sheet.getRow(1), '065F46');

        const exampleRow = sheet.addRow([
            'Matematika',
            '1',
            `MAT.${cls}.1`,
            `Capaian pembelajaran matematika fase aktif untuk kelas ${cls}.`,
            cls
        ]);

        styleDataRow(exampleRow, false, [
            { align: 'left', format: '@' },
            { align: 'center', format: '@' },
            { align: 'center', format: '@' },
            { align: 'left', format: '@', wrap: true },
            { align: 'center', format: '@' }
        ]);
    });

    await saveWorkbook(wb, 'Template_Impor_TP_Per_Kelas.xlsx');
}

function styleHeaderRow(row, bgHex) {
    row.height = 32;
    row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${bgHex}` }
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: false
        };
        cell.border = HEADER_BORDER;
    });
}

function styleDataRow(row, isZebra, colConfigs) {
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const config = colConfigs[colNumber - 1] || { align: 'left', format: '@' };
        cell.font = {
            name: 'Calibri',
            size: 10,
            color: { argb: 'FF1E293B' }
        };
        if (isZebra) {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8FAFC' }
            };
        }
        cell.alignment = {
            vertical: 'middle',
            horizontal: config.align,
            wrapText: Boolean(config.wrap)
        };
        cell.numFmt = config.format || '@';
        cell.border = THIN_BORDER;
    });
}

async function saveWorkbook(wb, filename) {
    const rootPath = path.join(root, filename);
    const publicPath = path.join(root, 'public', 'templates', filename);
    await wb.xlsx.writeFile(rootPath);
    await wb.xlsx.writeFile(publicPath);
    console.log(`Saved: ${filename} to root and public/templates/`);
}

async function main() {
    console.log('Generating aesthetic Excel templates...');
    await generateStudent1Class();
    await generateStudent12Classes();
    await generateTP1Class();
    await generateTP12Classes();
    console.log('All templates generated successfully!');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
