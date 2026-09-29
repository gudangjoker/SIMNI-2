import ExcelJS from 'exceljs';

async function check() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('Template_Data_Siswa_1_Kelas.xlsx');
    wb.eachSheet((s) => {
        console.log('Sheet:', s.name);
        s.eachRow((r, i) => {
            if (i <= 5) console.log('  Row', i, r.values);
        });
    });

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile('Template_Impor_TP_1_Kelas.xlsx');
    wb2.eachSheet((s) => {
        console.log('Sheet TP:', s.name);
        s.eachRow((r, i) => {
            if (i <= 5) console.log('  Row', i, r.values);
        });
    });
}

check().catch(console.error);
