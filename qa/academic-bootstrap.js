const excluded = new Set(['gadm', 'lps', 'chat', 'documents', 'archive', 'reset']);
window.SIMNIAccess = {
    canAccess: feature => !excluded.has(feature) && (window.SIMNICurrentAccess?.role === 'superuser' || feature !== 'notes'),
    applyAccessUI() {}
};
async function script(url) {
    await new Promise((resolve, reject) => {
        const element = document.createElement('script'); element.src = url;
        element.onload = resolve; element.onerror = reject; document.head.append(element);
    });
}
for (const path of ['js/core/state.js', 'js/auth/access-policy-core.js', 'js/database/workspace-paths-core.js', 'js/database/paged-query.js', 'js/utils/sanitize.js', 'js/ui/date.js', 'js/ui/feedback.js', 'js/ui/theme.js', 'js/ui/navigation.js', 'js/ui/actions.js', 'js/ui/render.js']) await script('/' + path);
window.QADraftTrace = [];
const realDrafts = window.SIMNIFormDrafts;
const traceDraft = (event, extra = {}) => {
    const element = document.getElementById('jurnal-form-container');
    if (!element) return;
    QADraftTrace.push({ event, scope: element.dataset.draftScope, session: academicSessionKey(), value: element.querySelector('.j-mat')?.value, dirty: realDrafts.dirty(element), ...extra });
    if (QADraftTrace.length > 100) QADraftTrace.shift();
};
window.SIMNIFormDrafts = { ...realDrafts,
    prepare(element, ...args) { const result = realDrafts.prepare(element, ...args); if(element?.id==='jurnal-form-container') traceDraft('prepare', {result}); return result; },
    begin(element) { const token = realDrafts.begin(element); if(element?.id==='jurnal-form-container') traceDraft('begin',{token}); return token; },
    finish(token, committed) { realDrafts.finish(token, committed); if(token?.id.includes('jurnal-form-container')) traceDraft('finish',{token,committed}); }
};
document.addEventListener('input', event => { if(event.target.matches('.j-mat')) traceDraft('input',{connected:event.target.isConnected}); });
const adapter = await import('/vendor/firebase/firebase-database.js');
await import('/js/database/repository.js');
await import('/js/database/sync.js');
await import('/js/database/local-cache.js');
const features = ['dashboard', 'students', 'attendance', 'grades', 'journal', 'notes'];
for (const feature of features) {
    const html = await (await fetch(`/features/${feature}/${feature}.html`)).text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const template of parsed.querySelectorAll('template')) document.body.append(document.importNode(template.content, true));
    await script(`/features/${feature}/${feature}.js`);
}
window.QALogin = async role => {
    window.stopFirebaseListener();
    window.SIMNICurrentAccess = Object.freeze({ uid: `qa-${role}`, email: `${role}@qa.invalid`, role, workspaceId: role === 'vip' ? 'ws_pjok' : 'ws_superuser', classId: role === 'vip' ? 'PJOK' : '3A', activeAcademicYearId: '2026-2027', status: 'active' });
    const access = window.SIMNICurrentAccess;
    window.SIMNIDatabaseTarget = { mode: 'mock', projectId: 'qa-indexeddb' };
    for (const key of ['students','mapelTP','nilaiTP','presensi','jurnal','jadwal','catatan']) state[key] = [];
    state.activeKelas = '3A';
    const base = `workspaces/${access.workspaceId}/academicYears/2026-2027`;
    window.QABase = base;
    if (!(await adapter.get(adapter.ref(null, base))).exists()) {
        const subject = role === 'vip' ? 'PJOK' : 'Matematika';
        await adapter.set(adapter.ref(null, base), {
            students: {
                '0123456789': { ID_Siswa:'stu_0123456789', NISN:'0123456789', 'Nama Lengkap':'Alya QA', Kelas:'3A' },
                '1123456789': { ID_Siswa:'stu_1123456789', NISN:'1123456789', 'Nama Lengkap':'Bima QA', Kelas:'3A' },
                '2123456789': { ID_Siswa:'stu_2123456789', NISN:'2123456789', 'Nama Lengkap':'Citra QA', Kelas:'3B' }
            },
            learningObjectives: {
                legacy_tp: { ID_mapel:'', mapel:subject, semester:'1', kode_tp:'TP.1', deskripsi_tp:'TP lama tanpa Bab', kelas:'3A' },
                other_class: { ID_mapel:'other_class', mapel:subject, semester:'1', kode_tp:'TP.1', deskripsi_tp:'TP kelas lain', kelas:'3B' },
                empty_tp: { ID_mapel:'empty_tp', mapel:subject, semester:'1', kode_tp:'TP.2', deskripsi_tp:'TP kosong', kelas:'3A' }
            },
            grades: { old_score: { ID_Nilai:'old_score', NISN:'0123456789', ID_Siswa:'stu_0123456789', mapel:subject, semester:'1', kode_tp:'TP.1', nilai:'', Kelas:'3A' } },
            schedule: { legacy_slot: { Hari:'Senin', Jam_Ke:1, Mapel:subject, ...(role === 'vip' ? {Kelas:'3A'} : {}) } },
            journals: { old_journal: { Tanggal:'2026-09-07', Jam_Ke:1, Mapel:subject, Materi:'Materi lama', Keterangan:'', ...(role === 'vip' ? {Kelas:'3A'} : {}) } }
        });
        for (const nisn of ['0123456789','1123456789','2123456789']) await adapter.set(adapter.ref(null, `${base}/students/${nisn}/Foto URL`), './icons/simni-logo.png');
    }
    document.getElementById('qa-login').hidden = true;
    document.getElementById('qa-nav').hidden = false;
    window.SIMNIAuthState = { phase:'session-ready', uid:access.uid, role };
    sessionStorage.setItem('qa-role', role);
    window.initFirebaseListener();
    window.initDates(); window.switchView('dashboard');
};
document.getElementById('qa-login').addEventListener('submit', event => { event.preventDefault(); void window.QALogin(document.getElementById('qa-role').value); });
document.getElementById('qa-class').addEventListener('change', event => window.setActiveKelas(event.target.value));
if (sessionStorage.getItem('qa-role')) await window.QALogin(sessionStorage.getItem('qa-role'));
window.QABootReady = true;
