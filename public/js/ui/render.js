// ==========================================
// FILE: js/ui/render.js
// Orkestrasi render shell dan dropdown.
// ==========================================

function populateAllDropdowns() {
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    let filteredStudents = state.students;
    if (currentKelas) {
        filteredStudents = filteredStudents.filter(s => s.Kelas === currentKelas);
    }
    const sortedStudents = [...filteredStudents].sort((a,b) => (a['Nama Lengkap']||'').localeCompare(b['Nama Lengkap']||''));
    const selects = [
        { id: 'filter-presensi-siswa', defaultText: 'Semua Siswa' },
        { id: 'filter-catatan-siswa', defaultText: 'Semua Siswa' },
        { id: 'rekap-siswa-nilai', defaultText: 'Semua Siswa' },
        { id: 'input-catatan-siswa', defaultText: '-- Pilih Siswa --' },
        { id: 'induk-siswa-select', defaultText: '-- Pilih Siswa --' },
        { id: 'lps-select-siswa', defaultText: '-- Pilih Siswa --' }
    ];

    selects.forEach((selData) => {
        const el = document.getElementById(selData.id);
        if (!el) return;
        const currentVal = el.value;
        const fragment = document.createDocumentFragment();
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = selData.defaultText;
        fragment.appendChild(empty);
        const kelompok = selData.id === 'lps-select-siswa' ? (document.getElementById('lps-filter-kelompok')?.value || 'Semua') : null;
        sortedStudents.filter((student) => kelompok === null || kelompok === 'Semua' || student.Kelompok === kelompok).forEach((student) => {
            const nisn = String(student.NISN || '').trim();
            if (!/^\d{10}$/.test(nisn)) return;
            const option = document.createElement('option');
            option.value = nisn;
            option.textContent = String(student['Nama Lengkap'] || '');
            fragment.appendChild(option);
        });
        el.replaceChildren(fragment);
        if (currentVal) el.value = currentVal;
    });
}
function renderIdentitas() {
    const normalized = window.SIMNILPSCore ? window.SIMNILPSCore.normalizeSettings(state.pengaturan) : state.pengaturan;
    const shellBrand = 'SIMNI';
    const access = window.SIMNICurrentAccess || null;
    const activeAcademicYearId = access?.activeAcademicYearId || normalized.tahun_pelajaran;
    const identityRequiresConfirmation = normalized.tahun_pelajaran !== activeAcademicYearId;
    const p = identityRequiresConfirmation ? {
        ...normalized,
        nama_kelas: access?.role === 'vip' ? 'PJOK' : `Kelas ${access?.classId || ''}`.trim(),
        tahun_pelajaran: activeAcademicYearId,
        nama_wali_kelas: '',
        nuptk_wali_kelas: ''
    } : normalized;
    state.pengaturan = { ...state.pengaturan, ...p };
    document.title = `${shellBrand} - ${p.nama_kelas}`;
    if (document.getElementById('ui-nama-kelas')) document.getElementById('ui-nama-kelas').innerText = shellBrand; 
    if (document.getElementById('ui-mobile-nama-kelas')) document.getElementById('ui-mobile-nama-kelas').innerText = shellBrand; 
    if (document.getElementById('ui-nama-aplikasi')) document.getElementById('ui-nama-aplikasi').innerText = p.nama_aplikasi; 
    if (document.getElementById('ui-dash-title')) document.getElementById('ui-dash-title').innerText = `Dashboard ${shellBrand}`; 
    if (document.getElementById('ui-dash-subtitle')) document.getElementById('ui-dash-subtitle').innerText = "Tapel " + activeAcademicYearId; 
    
    const shellLogo = './icons/simni-logo.png';
    const drawLogo = (container, rounding) => {
        if (!container) return;
        container.replaceChildren();
        const image = document.createElement('img');
        image.src = shellLogo;
        image.alt = 'Logo SIMNI';
        image.className = `w-full h-full object-contain ${rounding} shadow-sm bg-white`;
        image.width = container.id === 'icon-mobile-container' ? 32 : 40;
        image.height = image.width;
        container.appendChild(image);
    };
    drawLogo(document.getElementById('icon-sidebar-container'), 'rounded-xl');
    drawLogo(document.getElementById('icon-mobile-container'), 'rounded-lg');
    if (document.getElementById('set-nama-app')) document.getElementById('set-nama-app').value = p.nama_aplikasi; 
    if (document.getElementById('set-nama-kelas')) document.getElementById('set-nama-kelas').value = p.nama_kelas; 
    if (document.getElementById('set-tapel')) document.getElementById('set-tapel').value = activeAcademicYearId; 
    if (document.getElementById('set-ikon-kelas')) document.getElementById('set-ikon-kelas').value = p.ikon_kelas || 'fa-school';
    if (document.getElementById('set-nama-yayasan')) document.getElementById('set-nama-yayasan').value = p.nama_yayasan || '';
    if (document.getElementById('set-jenjang-sekolah')) document.getElementById('set-jenjang-sekolah').value = p.jenjang_sekolah || '';
    if (document.getElementById('set-nama-sekolah')) document.getElementById('set-nama-sekolah').value = p.nama_sekolah || '';
    if (document.getElementById('set-akreditasi')) document.getElementById('set-akreditasi').value = p.status_akreditasi || '';
    if (document.getElementById('set-nomor-izin')) document.getElementById('set-nomor-izin').value = p.nomor_izin || '';
    if (document.getElementById('set-kota')) document.getElementById('set-kota').value = p.kota || '';
    if (document.getElementById('set-nama-wali-kelas')) document.getElementById('set-nama-wali-kelas').value = p.nama_wali_kelas || '';
    if (document.getElementById('set-nuptk-wali-kelas')) document.getElementById('set-nuptk-wali-kelas').value = p.nuptk_wali_kelas || '';
}
function renderAllViews() {
    if (window.SIMNIAccess?.canAccess('dashboard')) renderDashboard();
    if (window.SIMNIAccess?.canAccess('students')) renderSiswaList();
    if (window.SIMNIAccess?.canAccess('attendance')) { renderPresensiManual(); renderRekapPresensi(); }
    if (window.SIMNIAccess?.canAccess('grades')) { renderNilaiTPControls(); renderBukuInduk(); }
    if (window.SIMNIAccess?.canAccess('documents')) renderDokumenList();
    if (window.SIMNIAccess?.canAccess('notes')) renderCatatanList();
    if (window.SIMNIAccess?.canAccess('journal')) { renderJadwalSetting(); renderRekapJurnal(); }
}

function renderCurrentView() {
    const v = state.currentView;
    const feature = window.SIMNIAccessPolicy?.featureForView(v);
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        state.currentView = 'dashboard';
        if (window.SIMNIAccess?.canAccess('dashboard')) renderDashboard();
        return;
    }
    if(v==='dashboard') renderDashboard();
    else if(v==='siswa') renderSiswaList();
    else if(v==='presensi'){ renderPresensiManual(); renderRekapPresensi(); }
    else if(v==='nilai') { renderNilaiTPControls(); renderRekapNilai(); renderBukuInduk(); }
    else if(v==='dokumen') renderDokumenList();
    else if(v==='catatan') renderCatatanList();
    else if(v==='jurnal') { generateFormJurnal(); renderRekapJurnal(); }
    else if(v==='lps') { populateLPSFilter(); loadSiswaLPS(); }
    else if(v==='gadm') { void window.SIMNIGADM?.ensureReady?.(); }
}
