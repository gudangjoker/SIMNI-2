import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

XLSX.set_fs(fs);

const outputDirectory = path.resolve(process.cwd(), 'test-output', 'import-fixtures');
fs.mkdirSync(outputDirectory, { recursive: true });

const classes = [];
for (let grade = 1; grade <= 6; grade += 1) {
    classes.push(`${grade}A`, `${grade}B`);
}

function writeWorkbook(filename, sheetRows) {
    const workbook = XLSX.utils.book_new();
    for (const [sheetName, rows] of sheetRows) {
        const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
    const outputPath = path.join(outputDirectory, filename);
    XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', compression: true });
    process.stdout.write(`${outputPath}\n`);
}

writeWorkbook('students-one-class.xlsx', [['3A', [
    { NISN: '1111111111', 'Nama Lengkap': 'Alya Rahma', Panggilan: 'Alya', Kelompok: 'Kelompok 1', Kelas: '3A' },
    { NISN: '5555555555', 'Nama Lengkap': 'Eka Import', Panggilan: 'Eka', Kelompok: 'Kelompok 2', Kelas: '3A' },
    { NISN: '123', 'Nama Lengkap': 'NISN Invalid', Panggilan: 'Invalid', Kelompok: 'Kelompok 1', Kelas: '3A' },
    { NISN: '6666666666', 'Nama Lengkap': 'Salah Kelas', Panggilan: 'Salah', Kelompok: 'Kelompok 1', Kelas: '3B' }
]]]);

const studentMultiRows = new Map(classes.map((className) => [className, []]));
studentMultiRows.set('3A', [
    { NISN: '7000000001', 'Nama Lengkap': 'Siswa 3A Satu', Panggilan: 'A1', Kelompok: 'Kelompok 1', Kelas: '3A' },
    { NISN: '7000000002', 'Nama Lengkap': 'Siswa 3A Dua', Panggilan: 'A2', Kelompok: 'Kelompok 2', Kelas: '3A' },
    { NISN: '7000000003', 'Nama Lengkap': 'Siswa 3A Tiga', Panggilan: 'A3', Kelompok: 'Kelompok 3', Kelas: '3A' },
    { NISN: '7000000099', 'Nama Lengkap': 'Mismatch Sheet', Panggilan: 'Mismatch', Kelompok: 'Kelompok 1', Kelas: '3B' },
    { NISN: '7000000098', 'Nama Lengkap': 'Kelas Kosong', Panggilan: 'Kosong', Kelompok: 'Kelompok 1', Kelas: '' },
    { NISN: '7000000097', 'Nama Lengkap': 'Kelas Invalid', Panggilan: 'Invalid', Kelompok: 'Kelompok 1', Kelas: '9Z' }
]);
studentMultiRows.set('3B', [
    { NISN: '7100000001', 'Nama Lengkap': 'Siswa 3B Satu', Panggilan: 'B1', Kelompok: 'Kelompok 1', Kelas: '3B' },
    { NISN: '7100000002', 'Nama Lengkap': 'Siswa 3B Dua', Panggilan: 'B2', Kelompok: 'Kelompok 2', Kelas: '3B' },
    { NISN: '7100000099', 'Nama Lengkap': 'Kelas Unknown', Panggilan: 'Unknown', Kelompok: 'Kelompok 1', Kelas: 'UNKNOWN' }
]);
studentMultiRows.set('4A', [
    { NISN: '7200000001', 'Nama Lengkap': 'Siswa 4A Satu', Panggilan: 'C1', Kelompok: 'Kelompok 1', Kelas: '4A' },
    { NISN: '7200000002', 'Nama Lengkap': 'Siswa 4A Dua', Panggilan: 'C2', Kelompok: 'Kelompok 1', Kelas: '4A' },
    { NISN: '7200000003', 'Nama Lengkap': 'Siswa 4A Tiga', Panggilan: 'C3', Kelompok: 'Kelompok 2', Kelas: '4A' },
    { NISN: '7200000004', 'Nama Lengkap': 'Siswa 4A Empat', Panggilan: 'C4', Kelompok: 'Kelompok 3', Kelas: '4A' }
]);
writeWorkbook('students-multi-class.xlsx', classes.map((className) => [className, studentMultiRows.get(className)]));

writeWorkbook('tp-one-class.xlsx', [['3A', [
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.IMP.1', 'Deskripsi TP': 'TP impor satu kelas', Kelas: '3A' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.INVALID', 'Deskripsi TP': '', Kelas: '3A' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.WRONG', 'Deskripsi TP': 'TP salah kelas', Kelas: '3B' }
]]]);

const tpMultiRows = new Map(classes.map((className) => [className, []]));
tpMultiRows.set('3A', [
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.SHARED.1', 'Deskripsi TP': 'TP bersama kelas 3A', Kelas: '3A' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.EXTRA.1', 'Deskripsi TP': 'TP ekstra kelas 3A', Kelas: '3A' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.MISMATCH', 'Deskripsi TP': 'TP tidak cocok sheet', Kelas: '3B' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.BLANK', 'Deskripsi TP': 'TP kelas kosong', Kelas: '' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.9Z', 'Deskripsi TP': 'TP kelas invalid', Kelas: '9Z' }
]);
tpMultiRows.set('3B', [
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.SHARED.1', 'Deskripsi TP': 'TP bersama kelas 3B', Kelas: '3B' },
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.UNKNOWN', 'Deskripsi TP': 'TP kelas unknown', Kelas: 'UNKNOWN' }
]);
tpMultiRows.set('4A', [
    { 'Mata Pelajaran': 'Matematika', Semester: '1', 'Kode TP': 'MAT.SHARED.1', 'Deskripsi TP': 'TP bersama kelas 4A', Kelas: '4A' }
]);
writeWorkbook('tp-multi-class.xlsx', classes.map((className) => [className, tpMultiRows.get(className)]));
