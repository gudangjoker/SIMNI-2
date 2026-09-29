// ==========================================
// FILE: js/ui/render.js
// Orkestrasi render shell dan dropdown.
// ==========================================

function populateAllDropdowns() {
    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');
    let filteredStudents = Array.isArray(state?.students) ? state.students : [];
    if (currentKelas) {
        filteredStudents = filteredStudents.filter(s => {
            const sk = normalize(s.Kelas);
            return !sk || sk === currentKelas;
        });
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
    const normalized = window.SIMNILPSCore
        ? window.SIMNILPSCore.normalizeSettings(state.pengaturan)
        : (state.pengaturan || {});

    const shellBrand = 'SIMNI';
    const access = window.SIMNICurrentAccess || null;
    const institution = window.SIMNIInstitutionIdentity || {
        nama_aplikasi: 'SIMNI Administrasi Kelas',
        nama_yayasan: 'Yayasan Sosial dan Pendidikan Bina Muda',
        jenjang_sekolah: 'Sekolah Dasar',
        nama_sekolah: 'SDIT Bina Muda Cicalengka',
        status_akreditasi: 'A',
        kota: 'Cicalengka',
        nomor_izin: 'No.421.2/1143-Disdikbud/2011'
    };

    const activeAcademicYearId =
        access?.activeAcademicYearId ||
        normalized.tahun_pelajaran ||
        '2026-2027';

    const identityRequiresConfirmation =
        normalized.tahun_pelajaran !== activeAcademicYearId;

    const dynamicIdentity = identityRequiresConfirmation
        ? {
            ...normalized,
            nama_kelas:
                access?.role === 'vip'
                    ? 'PJOK'
                    : (`Kelas ${access?.classId || ''}`.trim() || normalized.nama_kelas || ''),
            tahun_pelajaran: activeAcademicYearId,
            nama_wali_kelas: '',
            nuptk_wali_kelas: ''
        }
        : {
            ...normalized,
            tahun_pelajaran: activeAcademicYearId
        };

    const p = {
        ...dynamicIdentity,
        ...institution,
        tahun_pelajaran: activeAcademicYearId,
        ikon_kelas: 'fa-school',
        logo_url: './icons/school-logo.png',
        logo_public_id: null,
        logo_resource_type: null
    };

    state.pengaturan = { ...state.pengaturan, ...p };

    document.title = `${shellBrand} - ${p.nama_kelas || ''}`;

    if (document.getElementById('ui-nama-kelas')) {
        document.getElementById('ui-nama-kelas').innerText = shellBrand;
    }
    if (document.getElementById('ui-mobile-nama-kelas')) {
        document.getElementById('ui-mobile-nama-kelas').innerText = shellBrand;
    }
    if (document.getElementById('ui-nama-aplikasi')) {
        document.getElementById('ui-nama-aplikasi').innerText = p.nama_aplikasi;
    }
    if (document.getElementById('ui-desktop-nama-kelas')) {
        document.getElementById('ui-desktop-nama-kelas').innerText = shellBrand || 'SIMNI';
    }
    if (document.getElementById('ui-desktop-nama-aplikasi')) {
        const rawApp = p.nama_aplikasi || '';
        const cleanedApp = rawApp.replace(/^SIMNI\s*/i, '').trim() || 'Administrasi Kelas Digital';
        document.getElementById('ui-desktop-nama-aplikasi').innerText = cleanedApp;
    }
    if (document.getElementById('ui-dash-title')) {
        document.getElementById('ui-dash-title').innerText = `Dashboard ${shellBrand}`;
    }
    if (document.getElementById('ui-dash-subtitle')) {
        document.getElementById('ui-dash-subtitle').innerText = `Tapel ${activeAcademicYearId}`;
    }

    const teacherGreeting = p.nama_wali_kelas || p.nama_guru || window.SIMNIAuthState?.displayName || (window.SIMNIAuthState?.email ? window.SIMNIAuthState.email.split('@')[0] : 'Guru SIMNI');
    const greetingEl = document.getElementById('ui-greeting-teacher');
    if (greetingEl) {
        greetingEl.textContent = teacherGreeting;
    }

    const shellLogo = './icons/simni-logo.png';
    const drawLogo = (container, rounding) => {
        if (!container) return;
        container.replaceChildren();
        const image = document.createElement('img');
        image.src = shellLogo;
        image.alt = 'Logo SIMNI';
        image.className = `w-full h-full object-contain ${rounding}`;
        image.width = (container.id === 'icon-mobile-container' || container.id === 'icon-desktop-container') ? 32 : 40;
        image.height = image.width;
        container.appendChild(image);
    };

    drawLogo(document.getElementById('icon-sidebar-container'), 'rounded-xl');
    drawLogo(document.getElementById('icon-desktop-container'), 'rounded-lg');
    drawLogo(document.getElementById('icon-mobile-container'), 'rounded-lg');

    const setValue = (id, value) => {
        const target = document.getElementById(id);
        if (target) target.value = value ?? '';
    };

    setValue('set-nama-app', p.nama_aplikasi);
    setValue('set-nama-kelas', p.nama_kelas);
    setValue('set-tapel', activeAcademicYearId);
    setValue('set-nama-yayasan', p.nama_yayasan);
    setValue('set-jenjang-sekolah', p.jenjang_sekolah);
    setValue('set-nama-sekolah', p.nama_sekolah);
    setValue('set-akreditasi', p.status_akreditasi);
    setValue('set-nomor-izin', p.nomor_izin);
    setValue('set-kota', p.kota);
    setValue('set-nama-wali-kelas', p.nama_wali_kelas);
    setValue('set-nuptk-wali-kelas', p.nuptk_wali_kelas);
    setValue('set-nama-kepala-sekolah', p.nama_kepala_sekolah || p.nama_kamad || 'Kepala SDIT Bina Muda');
    setValue('set-nuks-kepala-sekolah', p.nuks_kepala_sekolah || p.nuks_kamad || '-');
}

function renderAllViews() {
    if (window.SIMNIAccess?.canAccess('dashboard') && typeof renderDashboard === 'function') renderDashboard();
    if (window.SIMNIAccess?.canAccess('students') && typeof renderSiswaList === 'function') renderSiswaList();
    if (window.SIMNIAccess?.canAccess('attendance') && typeof renderPresensiManual === 'function') { renderPresensiManual(); renderRekapPresensi?.(); }
    if (window.SIMNIAccess?.canAccess('grades') && typeof renderNilaiTPControls === 'function') { renderNilaiTPControls(); renderBukuInduk?.(); }
    if (window.SIMNIAccess?.canAccess('documents') && typeof renderDokumenList === 'function') renderDokumenList();
    if (window.SIMNIAccess?.canAccess('notes') && typeof renderCatatanList === 'function') renderCatatanList();
    if (window.SIMNIAccess?.canAccess('journal') && typeof renderJadwalSetting === 'function') { renderJadwalSetting(); renderRekapJurnal?.(); }
}

function renderCurrentView() {
    const v = state.currentView;
    const feature = window.SIMNIAccessPolicy?.featureForView(v);
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        state.currentView = 'dashboard';
        if (window.SIMNIAccess?.canAccess('dashboard') && typeof renderDashboard === 'function') renderDashboard();
        return;
    }
    if (v === 'dashboard') { if (typeof renderDashboard === 'function') renderDashboard(); }
    else if (v === 'siswa') { if (typeof renderSiswaList === 'function') renderSiswaList(); }
    else if (v === 'presensi') { if (typeof renderPresensiManual === 'function') { renderPresensiManual(); renderRekapPresensi?.(); } }
    else if (v === 'nilai') { if (typeof renderNilaiTPControls === 'function') { renderNilaiTPControls(); renderRekapNilai?.(); renderBukuInduk?.(); } }
    else if (v === 'dokumen') { if (typeof renderDokumenList === 'function') renderDokumenList(); }
    else if (v === 'catatan') { if (typeof renderCatatanList === 'function') renderCatatanList(); }
    else if (v === 'jurnal') { if (typeof generateFormJurnal === 'function') generateFormJurnal(); if (typeof renderJadwalSetting === 'function') renderJadwalSetting(); if (typeof renderRekapJurnal === 'function') renderRekapJurnal(); }
    else if (v === 'lps') { if (typeof populateLPSFilter === 'function') populateLPSFilter(); if (typeof loadSiswaLPS === 'function') loadSiswaLPS(); }
    else if (v === 'gadm') { void window.SIMNIGADM?.ensureReady?.(); }
    else if (v === 'pengaturan') { window.renderSIMNISettingsActionState?.(); }
}
