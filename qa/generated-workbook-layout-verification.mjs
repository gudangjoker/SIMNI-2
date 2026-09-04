import ExcelJS from 'exceljs';
import path from 'node:path';

const generatedPath = process.argv[2];
const templatePath = process.argv[3];
const expectedSheetCount = Number.parseInt(process.argv[4] || '0', 10);

if (!generatedPath || !templatePath) {
    throw new Error('Gunakan: node qa/generated-workbook-layout-verification.mjs <hasil.xlsx> <template.xlsx> [jumlah-sheet]');
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
            min,
            max,
            width,
            hidden: hidden || false,
            outlineLevel: outlineLevel || 0,
            style: style || null
        })),
        rows: (model.rows || []).map(({ number, height, hidden, outlineLevel, style }) => ({
            number,
            height,
            hidden: hidden || false,
            outlineLevel: outlineLevel || 0,
            style: style || null
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
const reference = normalizedTemplate.worksheets[0];
if (!reference) throw new Error('Template tidak memiliki worksheet acuan.');
const referenceFingerprint = fingerprint(reference);

const generated = new ExcelJS.Workbook();
await generated.xlsx.readFile(path.resolve(generatedPath));

assert(generated.worksheets.length > 0, 'Workbook hasil memiliki minimal satu sheet siswa');
if (expectedSheetCount > 0) {
    assert(generated.worksheets.length === expectedSheetCount, `Workbook hasil memiliki tepat ${expectedSheetCount} sheet siswa`);
}
assert(!generated.worksheets.some((worksheet) => /^(master|template)$/i.test(worksheet.name)), 'Workbook hasil tidak menyisakan sheet master/template');
assert(new Set(generated.worksheets.map((worksheet) => worksheet.name.toLowerCase())).size === generated.worksheets.length, 'Nama seluruh sheet siswa unik');

for (const worksheet of generated.worksheets) {
    assert(fingerprint(worksheet) === referenceFingerprint, `${worksheet.name}: layout, style, merge, gambar, dan print setup identik dengan template`);
    assert(plainCellValue(worksheet.getCell('D11')).replace(/^:\s*/, '') === worksheet.name, `${worksheet.name}: identitas nama siswa sesuai nama sheet`);
    assert(plainCellValue(worksheet.getCell('D12')).replace(/^:\s*/, '').trim().length > 0, `${worksheet.name}: NISN terisi pada anchor template`);
    assert(forbiddenExamples(worksheet).length === 0, `${worksheet.name}: data dummy workbook contoh telah dibersihkan`);
}

process.stdout.write(`\nGENERATED WORKBOOK LAYOUT VERIFICATION: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) process.exitCode = 1;
