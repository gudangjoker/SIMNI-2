import ExcelJS from 'exceljs';
import path from 'node:path';

const filenames = ['LPS KLS 2 contoh.xlsx', 'BLP contoh.xlsx'];

function cellText(cell) {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
        if (value.text !== undefined) return String(value.text);
        if (value.result !== undefined) return String(value.result);
    }
    return String(value);
}

for (const filename of filenames) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.resolve(process.cwd(), filename));
    process.stdout.write(`\nFILE: ${filename}\n`);
    process.stdout.write(`MEDIA: ${workbook.media.length}\n`);
    for (const worksheet of workbook.worksheets) {
        process.stdout.write(`SHEET: ${worksheet.name}; ROWS: ${worksheet.rowCount}; COLS: ${worksheet.columnCount}; MERGES: ${worksheet.model.merges.length}; IMAGES: ${worksheet.getImages().length}\n`);
        process.stdout.write(`PAGE: ${JSON.stringify(worksheet.pageSetup)}\n`);
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            const values = [];
            row.eachCell({ includeEmpty: false }, (cell) => {
                const text = cellText(cell).replace(/\s+/g, ' ').trim();
                if (text) values.push(`${cell.address}=${text.slice(0, 160)}`);
            });
            if (values.length) process.stdout.write(`${values.join(' | ')}\n`);
        });
    }
}
