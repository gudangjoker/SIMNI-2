import GADM_ENGINE from '../features/gadm/gadm-engine.js';

const tests = [];

function run(name, input, expectedValid = true) {
    const result = GADM_ENGINE.generate(input);
    const passed = result.validation.ok === expectedValid;
    tests.push({
        name,
        passed,
        valid: result.validation.ok,
        errors: result.validation.errors.map((issue) => issue.code),
        warnings: result.validation.warnings.map((issue) => issue.code),
        title: result.title,
        score: result.data?.qualityAudit?.score ?? null
    });
}

const common = {
    seed: 'simni-integration-regression',
    kelasAtauFase: '3',
    mataPelajaran: 'IPAS'
};

run('modulAjar', {
    ...common,
    documentType: 'modulAjar',
    namaSekolah: 'SD Uji',
    namaGuru: 'Guru Uji',
    tahunPelajaran: '2026/2027',
    semester: '1',
    materiAtauUnit: 'Perubahan wujud benda',
    cpAtauTp: 'Peserta didik mengidentifikasi perubahan wujud benda melalui pengamatan dan menjelaskan hasil pengamatannya.',
    alokasiWaktu: '2 x 35 menit',
    kondisiAwalMurid: 'kemampuan murid beragam\nsebagian murid membutuhkan dukungan membaca',
    sumberDaya: 'sarana belajar terbatas\ntanpa internet',
    modelPembelajaran: 'otomatis'
});
run('prota', {
    ...common,
    documentType: 'prota',
    tahunPelajaran: '2026/2027',
    alokasiJamTahunan: '36',
    kalenderPendidikanAtauMingguEfektif: '18 minggu semester 1; 18 minggu semester 2',
    cpAtpTp: 'Unit A | 18 | 1\nUnit B | 18 | 2'
});
run('promes', {
    documentType: 'promes',
    seed: 'simni-integration-regression',
    semester: '1',
    hasilProtaAtauDistribusiTahunan: 'Unit A 18 JP semester 1',
    mingguEfektifSemester: '18 minggu efektif',
    tpAtauUnitSemester: 'Unit A1 | 8 | Minggu 1-4\nUnit A2 | 10 | Minggu 5-9'
});
run('silabus', {
    ...common,
    documentType: 'silabus',
    materiAtauLingkup: 'Perubahan wujud\nSuhu dan kalor',
    cpAtauTp: 'Mengidentifikasi perubahan wujud\nMenjelaskan pengaruh suhu',
    alokasiWaktu: '8 JP',
    kondisiAwalMurid: 'kemampuan murid beragam',
    sumberDaya: 'benda konkret dan halaman sekolah'
});
run('kokurikuler', {
    documentType: 'deskripsiKokurikuler',
    seed: 'simni-integration-regression',
    kegiatan: 'Gerakan sekolah minim sampah',
    targetDimensi: 'Kolaborasi, Kewargaan',
    evidenceObservasi: 'Murid membagi peran dalam kelompok dan memilah sampah sesuai kategori selama kegiatan.'
});
run('erapor', {
    documentType: 'deskripsiERapor',
    seed: 'simni-integration-regression',
    materiAtauTP: 'Perubahan wujud benda',
    kompetensi: 'menjelaskan perubahan wujud berdasarkan hasil pengamatan',
    statusCapaian: 'Tercapai',
    evidence: 'Mampu menjelaskan tiga contoh perubahan wujud dengan tepat pada asesmen praktik.',
    nextStep: 'melatih penjelasan sebab-akibat dengan contoh baru'
});
run('guard_missing_cp', {
    ...common,
    documentType: 'modulAjar',
    materiAtauUnit: 'Perubahan wujud benda',
    cpAtauTp: '',
    alokasiWaktu: '2 x 35 menit'
}, false);
run('guard_missing_erapor_evidence', {
    documentType: 'deskripsiERapor',
    materiAtauTP: 'Bilangan',
    statusCapaian: 'Tercapai',
    evidence: ''
}, false);

const officialCp = GADM_ENGINE.recommendOfficialCp({
    kelasAtauFase: 'Kelas 3 · Fase B',
    mataPelajaran: 'IPAS',
    materiAtauUnit: 'Pancaindra'
});
tests.push({
    name: 'official_cp_2026_routing',
    passed: officialCp.ok === true
        && officialCp.record?.decisionNumber === '046/H/KR/2025'
        && officialCp.record?.phase === 'faseB'
        && /pancaindra/i.test(officialCp.officialText || ''),
    valid: officialCp.ok === true,
    errors: [],
    warnings: [],
    title: 'CP resmi aktif tahun 2026',
    score: null
});

const verifiedCurriculumResult = GADM_ENGINE.generate({
    ...common,
    documentType: 'modulAjar',
    namaSekolah: 'SD Uji',
    namaGuru: 'Guru Uji',
    tahunPelajaran: '2026/2027',
    semester: '1',
    materiAtauUnit: 'Pancaindra',
    curriculumRecordId: officialCp.record?.id,
    cpResmiAtauManual: officialCp.officialText,
    tujuanPembelajaran: 'Murid mampu menjelaskan fungsi pancaindra melalui hasil pengamatan.',
    cpAtauTp: `CP: ${officialCp.officialText}\n\nTP: Murid mampu menjelaskan fungsi pancaindra melalui hasil pengamatan.`,
    alokasiWaktu: '2 x 35 menit'
});
tests.push({
    name: 'official_cp_provenance_preserved',
    passed: verifiedCurriculumResult.validation.ok === true
        && verifiedCurriculumResult.data?.curriculum?.provenance === 'verified_kb_record'
        && !verifiedCurriculumResult.validation.warnings.some((issue) => issue.code === 'CURRICULUM_TEXT_UNVERIFIED'),
    valid: verifiedCurriculumResult.validation.ok,
    errors: verifiedCurriculumResult.validation.errors.map((issue) => issue.code),
    warnings: verifiedCurriculumResult.validation.warnings.map((issue) => issue.code),
    title: 'Provenance record CP resmi dipertahankan',
    score: verifiedCurriculumResult.data?.qualityAudit?.score ?? null
});

const modifiedCurriculumResult = GADM_ENGINE.generate({
    ...common,
    documentType: 'modulAjar',
    materiAtauUnit: 'Pancaindra',
    curriculumRecordId: officialCp.record?.id,
    cpResmiAtauManual: `${officialCp.officialText} teks tambahan`,
    cpAtauTp: `${officialCp.officialText} teks tambahan`,
    alokasiWaktu: '2 x 35 menit'
});
tests.push({
    name: 'modified_cp_cannot_claim_official_provenance',
    passed: modifiedCurriculumResult.data?.curriculum?.provenance === 'teacher_supplied_unverified_text'
        && modifiedCurriculumResult.validation.warnings.some((issue) => issue.code === 'CURRICULUM_TEXT_UNVERIFIED'),
    valid: modifiedCurriculumResult.validation.ok,
    errors: modifiedCurriculumResult.validation.errors.map((issue) => issue.code),
    warnings: modifiedCurriculumResult.validation.warnings.map((issue) => issue.code),
    title: 'CP yang diedit tidak boleh diklaim sebagai record resmi',
    score: modifiedCurriculumResult.data?.qualityAudit?.score ?? null
});

const religionRoute = GADM_ENGINE.recommendOfficialCp({
    kelasAtauFase: '3',
    mataPelajaran: 'Pendidikan Agama Islam dan Budi Pekerti',
    materiAtauUnit: 'Akhlak'
});
tests.push({
    name: 'religion_2026_fail_closed',
    passed: religionRoute.ok === false && /020\/2026|2026/.test(religionRoute.reason || ''),
    valid: religionRoute.ok === true,
    errors: religionRoute.ok ? [] : ['CURRICULUM_020_2026_REQUIRES_VERIFIED_TEXT'],
    warnings: [],
    title: 'CP Agama 2026 tidak dipalsukan dari OCR',
    score: null
});

const suggestedTp = GADM_ENGINE.suggestLearningObjective({
    kelasAtauFase: '3A',
    mataPelajaran: 'IPAS',
    materiAtauUnit: 'Pancaindra'
});
tests.push({
    name: 'teacher_confirmed_tp_suggestion',
    passed: suggestedTp.ok === true
        && suggestedTp.status === 'gadm_suggestion_requires_teacher_confirmation'
        && /Pancaindra/.test(suggestedTp.text || ''),
    valid: suggestedTp.ok === true,
    errors: [],
    warnings: [],
    title: 'Saran TP memerlukan konfirmasi guru',
    score: null
});

const preflight = GADM_ENGINE.preflight();
const passed = tests.filter((test) => test.passed).length;
process.stdout.write(`${JSON.stringify({ preflight, passed, total: tests.length, tests }, null, 2)}\n`);
if (!preflight.ok || passed !== tests.length) process.exitCode = 1;
