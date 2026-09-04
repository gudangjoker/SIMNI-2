import ExcelJS from 'exceljs';
import path from 'node:path';

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

function fingerprintParts(worksheet) {
    const model = worksheet.model;
    const styles = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.isMerged && cell.master.address !== cell.address) return;
            if (cell.hasStyle) styles.push([cell.address, clone(cell.style)]);
        });
    });
    return {
        columns: (model.cols || []).map(({ min, max, width, hidden, outlineLevel, style }) => ({ min, max, width, hidden: hidden || false, outlineLevel: outlineLevel || 0, style: style || null })),
        rows: (model.rows || []).map(({ number, height, hidden, outlineLevel, style }) => ({ number, height, hidden: hidden || false, outlineLevel: outlineLevel || 0, style: style || null })),
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
    };
}

function fingerprint(worksheet) {
    return JSON.stringify(fingerprintParts(worksheet));
}

function differences(left, right) {
    const leftParts = fingerprintParts(left);
    const rightParts = fingerprintParts(right);
    return Object.keys(leftParts).filter((key) => JSON.stringify(leftParts[key]) !== JSON.stringify(rightParts[key]));
}

function duplicateWorksheet(workbook, templateModel, name) {
    const worksheet = workbook.addWorksheet(name);
    const model = clone(templateModel);
    model.id = worksheet.id;
    model.name = name;
    model.mergeCells = [...(model.merges || [])];
    worksheet.model = model;
    return worksheet;
}

for (const filename of ['LPS KLS 2 contoh.xlsx', 'BLP contoh.xlsx']) {
    const source = new ExcelJS.Workbook();
    await source.xlsx.readFile(path.resolve(process.cwd(), filename));
    const master = source.worksheets[0];
    const baseline = fingerprint(master);
    const templateModel = clone(master.model);
    const expectedImageCount = master.getImages().length;
    source.worksheets.slice().forEach((worksheet) => source.removeWorksheet(worksheet.id));
    const firstDuplicate = duplicateWorksheet(source, templateModel, 'Siswa Uji 1');
    const secondDuplicate = duplicateWorksheet(source, templateModel, 'Siswa Uji 2');
    const firstMemoryMatches = fingerprint(firstDuplicate) === baseline;
    const secondMemoryMatches = fingerprint(secondDuplicate) === baseline;
    assert(firstMemoryMatches, `${filename}: duplikasi pertama in-memory mempertahankan layout, style, merge, gambar, dan print setup`);
    assert(secondMemoryMatches, `${filename}: duplikasi kedua in-memory mempertahankan layout, style, merge, gambar, dan print setup`);
    const output = await source.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(output);
    assert(reloaded.worksheets.length === 2, `${filename}: jumlah sheet hasil sesuai jumlah duplikasi`);
    const serializedMatches = fingerprint(reloaded.worksheets[0]) === fingerprint(reloaded.worksheets[1]);
    assert(serializedMatches, `${filename}: kedua sheet tetap identik setelah serialisasi ExcelJS${serializedMatches ? '' : ` (${differences(reloaded.worksheets[0], reloaded.worksheets[1]).join(', ')})`}`);
    assert(reloaded.worksheets.every((worksheet) => worksheet.getImages().length === expectedImageCount), `${filename}: logo/gambar template dipertahankan pada setiap sheet`);
}

process.stdout.write(`\nEXCEL TEMPLATE REGRESSION: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) process.exitCode = 1;
