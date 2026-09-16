import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = process.cwd();
const core = require(path.join(root, 'features/lps/lps-core.js'));
const source = readFileSync(path.join(root, 'features/lps/lps.js'), 'utf8');
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

const settings = {
    nama_kelas: '3A',
    tahun_pelajaran: '2026-2027',
    nama_wali_kelas: 'Guru Uji',
    nuptk_wali_kelas: '1234567890'
};

for (const periodId of ['lps_mid_s1', 'blp_final_s1', 'lps_mid_s2', 'blp_final_s2']) {
    const template = core.createDefaultTemplate(settings, periodId);
    const aspects = template.sections.flatMap((section) => section.aspects);
    for (const aspect of aspects) {
        const signature = aspect.options.map((option) => option.toUpperCase()).join('|');
        if (signature === 'A|B|C|D') {
            assert(aspect.inputType === 'select', `${periodId}/${aspect.id}: nilai A-D menggunakan dropdown`);
        } else if (aspect.options.length) {
            assert(aspect.inputType === 'checklist', `${periodId}/${aspect.id}: kriteria template menggunakan ceklis`);
        } else {
            assert(aspect.inputType === 'text', `${periodId}/${aspect.id}: aspek naratif menggunakan teks`);
        }
    }
}

const lps = core.createDefaultTemplate(settings, 'lps_mid_s1');
const lpsAspects = lps.sections.flatMap((section) => section.aspects);
assert(lpsAspects.find((aspect) => aspect.id === 'aspect_doa')?.items.length === 10,
    'LPS memuat seluruh 10 butir doa dari template contoh');
assert(lpsAspects.find((aspect) => aspect.id === 'aspect_mahfudzat')?.items.length === 14,
    'LPS memuat seluruh 14 butir mahfudzat dari template contoh');

const blp = core.createDefaultTemplate(settings, 'blp_final_s1');
const murojaah = blp.sections.flatMap((section) => section.aspects)
    .find((aspect) => aspect.id === 'aspect_murojaah');
assert(murojaah?.inputType === 'text' && murojaah.descriptionEnabled === false,
    "BLP Muroja'ah memiliki tepat satu isian teks tanpa kolom deskripsi ganda");

assert(/function createResponseChecklist\(/.test(source)
    && /checkbox\.type\s*=\s*'checkbox'/.test(source)
    && /other !== checkbox\) other\.checked = false/.test(source),
    'UI ceklis memakai checkbox nyata dan satu pilihan aktif per butir');
assert(/function createResponseSelect\(/.test(source)
    && /'lps-response-overall'/.test(source) && /'lps-response-item'/.test(source),
    'UI dropdown dirender dari kontrak inputType select');
assert(/function createResponseTextInput\(/.test(source)
    && /inputType ===\s*'text'/.test(source),
    'UI teks dirender dari kontrak inputType text');
const sandbox={window:{SIMNILPSCore:core}};
vm.runInNewContext(readFileSync('features/lps/lps-reference-data.js','utf8')+'\n'+readFileSync('features/lps/lps-excel.js','utf8'),sandbox);
for (const periodId of ['lps_mid_s1','blp_final_s1']) {
    const base=sandbox.window.SIMNILPSExcel.createTemplate(settings,periodId);
    const renamed=core.deepClone(base);renamed.sections[0].aspects[0].title='Judul guru';
    assert(sandbox.window.SIMNILPSExcel.matchesStructure(renamed,base),'Ubah nama '+periodId+' tetap memakai layout acuan');
    renamed.sections[0].aspects[0].items.push({id:'new_item',label:'Butir tambahan'});
    assert(!sandbox.window.SIMNILPSExcel.matchesStructure(renamed,base),'Tambah butir '+periodId+' menggunakan layout yang memuat struktur baru');
}
assert(source.includes('window.SIMNILPSExcel.createWorkbook(reports,names)'), 'Controller meneruskan snapshot tiap siswa ke exporter native');
assert(/const activeClass\s*=\s*normalizeClassLabel\([\s\S]*?window\.state[\s\S]*?\.activeKelas[\s\S]*?normalizeClassLabel\([\s\S]*?student[\s\S]*?\.Kelas[\s\S]*?===\s*activeClass/.test(source),
    'Dropdown siswa LPS/BLP hanya memuat siswa dari kelas aktif');

process.stdout.write(`\nLPS/BLP CONTRACT REGRESSION: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) process.exitCode = 1;
