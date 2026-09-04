import ExcelJS from 'exceljs';
import path from 'node:path';

const generatedPath = process.argv[2];
const templatePath = process.argv[3];
const reportType = path.basename(templatePath || '').toUpperCase().startsWith('BLP') ? 'BLP' : 'LPS';
if (!generatedPath || !templatePath) {
    throw new Error('Gunakan: node qa/generated-lps-excel-verification.mjs <hasil.xlsx> <template.xlsx>');
}

let passed = 0;
const failures = [];
function assert(condition, message) {
    if (condition) {
        passed += 1;
        process.stdout.write(`[PASS] ${message}\n`);
        return;
    }
    failures.push(message);
    process.stderr.write(`[FAIL] ${message}\n`);
}

function clone(value) {
    return structuredClone(value);
}

function fingerprint(worksheet) {
    const model = worksheet.model;
    const styles = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.isMerged && cell.master.address !== cell.address) return;
            if (cell.hasStyle) styles.push([cell.address, clone(cell.style)]);
        });
    });
    return JSON.stringify({
        columns: (model.cols || []).map(({ min, max, width, hidden, outlineLevel, style }) => ({
            min, max, width, hidden: hidden || false, outlineLevel: outlineLevel || 0, style: style || null
        })),
        rows: (model.rows || []).map(({ number, height, hidden, outlineLevel, style }) => ({
            number, height, hidden: hidden || false, outlineLevel: outlineLevel || 0, style: style || null
        })),
        merges: [...(model.merges || [])].sort(),
        pageSetup: model.pageSetup || null,
        pageMargins: model.pageMargins || null,
        headerFooter: model.headerFooter || null,
        views: model.views || null,
        properties: model.properties || null,
        images: worksheet.getImages().map((image) => ({
            imageId: image.imageId,
            tl: image.range?.tl ? {
                col: image.range.tl.col,
                row: image.range.tl.row,
                nativeCol: image.range.tl.nativeCol,
                nativeRow: image.range.tl.nativeRow,
                nativeColOff: image.range.tl.nativeColOff,
                nativeRowOff: image.range.tl.nativeRowOff
            } : null,
            br: image.range?.br ? {
                col: image.range.br.col,
                row: image.range.br.row,
                nativeCol: image.range.br.nativeCol,
                nativeRow: image.range.br.nativeRow,
                nativeColOff: image.range.br.nativeColOff,
                nativeRowOff: image.range.br.nativeRowOff
            } : null,
            ext: image.range?.ext ? clone(image.range.ext) : null,
            editAs: image.range?.editAs || null
        })),
        styles
    });
}

function plainCellValue(cell) {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
        if (value.text !== undefined) return String(value.text);
        if (value.result !== undefined) return String(value.result);
    }
    return String(value);
}

function forbiddenExamples(worksheet) {
    const hits = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            if (cell.isMerged && cell.master.address !== cell.address) return;
            const value = plainCellValue(cell);
            if (/\bcontoh\b|13131313131|: 123456|dddddddda|fwfwfwfw|eeggsdgsgsgsg|gdasgasass/i.test(value)) {
                hits.push(`${cell.address}=${value}`);
            }
        });
    });
    return hits;
}

const template = new ExcelJS.Workbook();
await template.xlsx.readFile(path.resolve(templatePath));
const normalizedTemplateBytes = await template.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
const normalizedTemplate = new ExcelJS.Workbook();
await normalizedTemplate.xlsx.load(normalizedTemplateBytes);
const referenceFingerprint = fingerprint(normalizedTemplate.worksheets[0]);
const generated = new ExcelJS.Workbook();
await generated.xlsx.readFile(path.resolve(generatedPath));

const expectedStudents = [
    ['Alya Rahma', '1111111111'],
    ['Bima Pratama', '2222222222'],
    ['Citra Lestari', '3333333333'],
    ['Dewi QA', '4444444444']
].slice(0, generated.worksheets.length);
assert([3, 4].includes(generated.worksheets.length), 'Workbook hasil berisi tepat satu sheet untuk setiap siswa mock aktif');
assert(generated.worksheets.map((sheet) => sheet.name).join('|') === expectedStudents.map(([name]) => name).join('|'),
    'Nama dan urutan sheet mengikuti data siswa aktif');

generated.worksheets.forEach((worksheet, index) => {
    assert(fingerprint(worksheet) === referenceFingerprint,
        `${worksheet.name}: layout, style, merge, gambar, dan print setup identik dengan template`);
    assert(plainCellValue(worksheet.getCell('D11')).replace(/^:\s*/, '') === worksheet.name,
        `${worksheet.name}: identitas nama siswa tertulis pada anchor template`);
    assert(plainCellValue(worksheet.getCell('D12')).replace(/^:\s*/, '') === expectedStudents[index]?.[1],
        `${worksheet.name}: NISN tertulis pada anchor template`);
    assert(forbiddenExamples(worksheet).length === 0,
        `${worksheet.name}: identitas dan data dummy dari workbook contoh telah dibersihkan`);
});

const first = generated.worksheets[0];
assert(/baca tulis/i.test(plainCellValue(first.getCell('B18'))), 'Label aspek BTQ tidak tertimpa nilai');
assert(plainCellValue(first.getCell('O18')) === 'C', 'Dropdown A-D tersimpan sebagai nilai C pada sel nilai BTQ');
assert(plainCellValue(first.getCell('B20')) === 'Iqro 5 / Hal 10', 'Isian teks detail tersimpan pada sel detail BTQ');
assert(plainCellValue(first.getCell('O20')) === 'Deskripsi BTQ hasil uji', 'Deskripsi BTQ tersimpan pada kolom deskripsi');
if (reportType === 'BLP') {
    assert(plainCellValue(first.getCell('O25')) === 'Murojaah lancar hasil uji', "Isian teks Muroja'ah tersimpan pada kolom teks template");
    assert(plainCellValue(first.getCell('G46')) === ''
        && ['✓', 'ü', '√'].includes(plainCellValue(first.getCell('J46')))
        && plainCellValue(first.getCell('O46')) === '',
        'Ceklis Sebagian tersimpan tepat pada kolom kriterianya dan pilihan lama dibersihkan');
    assert(!/dddd|fwfw|eegg|gdas/i.test(`${plainCellValue(first.getCell('R81'))} ${plainCellValue(first.getCell('R89'))}`),
        'Identitas tanda tangan dummy tidak tersisa');
} else {
    assert(['✓', 'ü', '√'].includes(plainCellValue(first.getCell('G27')))
        && plainCellValue(first.getCell('J27')) === '',
        'Ceklis Sudah Terbiasa tersimpan pada kolom observasi yang tepat');
    assert(plainCellValue(first.getCell('G37')) === ''
        && ['✓', 'ü', '√'].includes(plainCellValue(first.getCell('I37'))),
        'Dropdown B pada butir Pembiasaan dipetakan menjadi ceklis kolom B template');
    assert(plainCellValue(first.getCell('G56')) === ''
        && ['✓', 'ü', '√'].includes(plainCellValue(first.getCell('J56')))
        && plainCellValue(first.getCell('O56')) === '',
        'Ceklis Sebagian Tahfidz tersimpan tepat dan pilihan contoh dibersihkan');
    assert(!/eegg|gdas/i.test(`${plainCellValue(first.getCell('C105'))} ${plainCellValue(first.getCell('R105'))}`),
        'Identitas tanda tangan dummy LPS tidak tersisa');
}

process.stdout.write(`\nGENERATED LPS/BLP EXCEL VERIFICATION: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) process.exitCode = 1;
