import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const targets = [path.join(root, 'index.html'), path.join(root, 'features')];

const none = (event, action, args = null) =>
    `${event}="${action}"`;

const declaration = (trigger, action, options = {}) => {
    const attributes = [
        `data-simni-action="${action}"`,
        `data-simni-trigger="${trigger}"`
    ];
    if (options.argument) attributes.push(`data-simni-argument="${options.argument}"`);
    if (options.args) attributes.push(`data-simni-args='${JSON.stringify(options.args)}'`);
    return attributes.join(' ');
};

const replacements = new Map([
    [none('onclick', "toast('Sistem Realtime Firebase terhubung otomatis dan terlindungi.', 'success')"), declaration('click', 'toast', { args: ['Sistem Realtime Firebase terhubung otomatis dan terlindungi.', 'success'] })],
    [none('onclick', "switchView('presensi'); openQRScanner();"), declaration('click', 'openAttendanceScanner')],
    [none('onclick', "switchView('siswa'); openAddSiswaModal();"), declaration('click', 'openStudentsCreate')],
    ...['nilai', 'jurnal', 'catatan', 'dokumen'].map((view) => [none('onclick', `switchView('${view}')`), declaration('click', 'switchView', { args: [view] })]),
    ...['input', 'rekap', 'jadwal'].map((tab) => [none('onclick', `setJurnalTab('${tab}')`), declaration('click', 'setJurnalTab', { args: [tab] })]),
    ...['input', 'rekap'].map((tab) => [none('onclick', `setPresensiTab('${tab}')`), declaration('click', 'setPresensiTab', { args: [tab] })]),
    ...['input', 'rekap'].map((tab) => [none('onclick', `setCatatanTab('${tab}')`), declaration('click', 'setCatatanTab', { args: [tab] })]),
    ...['input', 'rekap', 'induk'].map((tab) => [none('onclick', `setNilaiTab('${tab}')`), declaration('click', 'setNilaiTab', { args: [tab] })]),
    ...['Administrasi', 'LKPD'].map((tab) => [none('onclick', `setDokumenTab('${tab}')`), declaration('click', 'setDokumenTab', { args: [tab] })]),
    ...['modal-form-dokumen', 'modal-kelola-tp'].map((id) => [none('onclick', `openModal('${id}')`), declaration('click', 'openModal', { args: [id] })]),
    ...['modal-form-dokumen', 'modal-form-siswa', 'modal-profil-siswa', 'modal-pengaturan-lps', 'modal-pengaturan'].map((id) => [none('onclick', `closeModal('${id}')`), declaration('click', 'closeModal', { args: [id] })]),
    ...[
        'saveJurnalHarian', 'cetakJurnalPDF', 'saveJadwalMaster', 'openQRScanner',
        'savePresensiManual', 'cetakRekapPresensiPDF', 'closeQRScanner', 'cetakCatatanPDF',
        'openModalPengaturanLPS', 'previewLPS', 'cetakLPS', 'gunakanTemplateLPSAktif',
        'saveLPSData', 'finalisasiLPS', 'bukaRevisiLPS', 'salinTemplateLPS',
        'resetTemplateLPSKeAcuan', 'addLPSBuilderSection', 'closeLPSPreview',
        'refreshSIMNIAccounts', 'saveThemeFromDropdown', 'hapusLogo',
        'createAnnualArchiveCloud', 'exportArsipTotalExcel', 'exportDataLokal',
        'resetDataMurid', 'resetDataTP', 'resetDataJadwal', 'generatePrintQR',
        'unduhTemplateExcel', 'openAddSiswaModal', 'jumpToPresensi', 'jumpToBukuInduk',
        'editSiswa', 'hapusSiswaPaten', 'saveNilaiBatch', 'cetakBukuInduk'
    ].map((action) => [none('onclick', `${action}()`), declaration('click', action)]),
    [none('onclick', 'window.logoutAuth()'), declaration('click', 'logoutAuth')],
    [none('onchange', 'window.setActiveKelas(this.value)'), declaration('change', 'setActiveKelas', { argument: 'value' })],
    [none('onchange', "window.setActiveKelas(this.value); document.getElementById('global-kelas-select').value = this.value;"), declaration('change', 'setActiveKelas', { argument: 'value' })],
    ...[
        'renderRekapJurnal', 'renderPresensiManual', 'renderRekapPresensi', 'renderCatatanList',
        'populateLPSFilter', 'loadSiswaLPS', 'updateLPSHijriDate', 'updateTPDropdown',
        'renderNilaiGrid', 'updateRekapTPDropdown', 'renderRekapNilai', 'renderBukuInduk'
    ].map((action) => [none('onchange', `${action}()`), declaration('change', action)]),
    [none('onchange', 'checkJurnalDateChange(this.value)'), declaration('change', 'checkJurnalDateChange', { argument: 'value' })],
    [none('onchange', 'importDataLokal(event)'), declaration('change', 'importDataLokal', { argument: 'event' })],
    [none('onchange', 'importSiswaExcel(event)'), declaration('change', 'importSiswaExcel', { argument: 'event' })],
    [none('onkeyup', 'renderSiswaList()'), declaration('keyup', 'renderSiswaList')],
    ...[
        'submitDokumenMurni', 'submitCatatan', 'simpanPengaturanLPS', 'createSIMNIInvitation',
        'simpanIdentitas', 'submitSiswa', 'submitTP'
    ].map((action) => [none('onsubmit', `${action}(event)`), declaration('submit', action, { argument: 'event' })]),
    [none('onsubmit', 'window.updateCredentials(event)'), declaration('submit', 'updateCredentials', { argument: 'event' })],
    [none('onsubmit', 'return false'), declaration('submit', 'preventDefault')]
]);

async function htmlFiles(target) {
    const info = await import('node:fs/promises').then(({ stat }) => stat(target));
    if (info.isFile()) return [target];
    const entries = await readdir(target, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
        const absolute = path.join(target, entry.name);
        if (entry.isDirectory()) return htmlFiles(absolute);
        return entry.isFile() && entry.name.endsWith('.html') ? [absolute] : [];
    }));
    return nested.flat();
}

const files = (await Promise.all(targets.map(htmlFiles))).flat();
let changed = 0;

for (const file of files) {
    const original = await readFile(file, 'utf8');
    let output = original;
    for (const [from, to] of replacements) output = output.split(from).join(to);
    output = output.replace(
        /onclick="closeModal\('modal-kelola-tp'\)"/g,
        declaration('click', 'closeModal', { args: ['modal-kelola-tp'] })
    );
    output = output.replace(
        'src="" onerror="this.src=\'https://ui-avatars.com/api/?name=Siswa\'"',
        'src="https://ui-avatars.com/api/?name=Siswa"'
    );
    const leftovers = [...output.matchAll(/\son[a-z]+\s*=\s*"[^"]*"/gi)].map((match) => match[0]);
    if (leftovers.length) {
        throw new Error(`${path.relative(root, file)} masih memiliki inline handler: ${leftovers.join(', ')}`);
    }
    if (output !== original) {
        await writeFile(file, output, 'utf8');
        changed += 1;
    }
}

const indexPath = path.join(root, 'index.html');
let indexMarkup = await readFile(indexPath, 'utf8');
const inlineScript = indexMarkup.match(/<script>\s*([\s\S]*?)\s*<\/script>/i);
if (inlineScript) {
    const shellPath = path.join(root, 'js', 'core', 'shell.js');
    await writeFile(shellPath, `${inlineScript[1].trim()}\n`, 'utf8');
    indexMarkup = indexMarkup.replace(inlineScript[0], '<script src="js/core/shell.js"></script>');
}
const inlineStyle = indexMarkup.match(/<style>\s*([\s\S]*?)\s*<\/style>/i);
if (inlineStyle) {
    const shellStylePath = path.join(root, 'js', 'ui', 'shell.css');
    await writeFile(shellStylePath, `${inlineStyle[1].trim()}\n`, 'utf8');
    indexMarkup = indexMarkup.replace(inlineStyle[0], '<link rel="stylesheet" href="js/ui/shell.css">');
}
await writeFile(indexPath, indexMarkup, 'utf8');

console.log(`Secure markup refactor PASS: ${files.length} file diperiksa, ${changed} file diperbarui.`);
