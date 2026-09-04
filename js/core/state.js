// ==========================================
// FILE: js/core/state.js
// FUNGSI: State global kompatibel selama transisi modular
// ==========================================

// State Global Aplikasi yang terekspos ke semua file
var state = { 
    pengaturan: { 
        nama_aplikasi: 'Administrasi Kelas', 
        nama_kelas: 'Kelas 3A', 
        tahun_pelajaran: '2026-2027', 
        ikon_kelas: 'fa-school', 
        logo_url: './icons/school-logo.png',
        nama_yayasan: 'YAYASAN SOSIAL DAN PENDIDIKAN BINA MUDA',
        jenjang_sekolah: 'SEKOLAH DASAR ISLAM TERPADU',
        nama_sekolah: 'SDIT BINA MUDA CICALENGKA',
        status_akreditasi: 'Terakreditasi "A"',
        nomor_izin: 'Ijin Operasional/RPS : No.421.2/1143-Disdikbud/2011',
        kota: 'Cicalengka',
        nama_wali_kelas: '',
        nuptk_wali_kelas: ''
    }, 
    pengaturanLPS_v2: [], 
    lpsTemplates: {}, lpsReports: [],
    students: [], presensi: [], mapelTP: [], nilaiTP: [], dokumen: [], 
    catatan: [], jurnal: [], jadwal: [], dataLPS: [], 
    currentView: 'dashboard', docTabActive: 'Administrasi', 
    tempSelectedSiswaNISN: null, scannerInstance: null,
    activeKelas: '' 
};

// Daftar Kelas untuk Paradigma Multi-Kelas (VIP PJOK)
window.daftarKelasDinamis = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];

// Variabel Pengendali Alur
var isFirebaseListening = false;
var isInitialLoad = true;
var lastJurnalDate = "";


function activeClassStorageKey() {
    const access = window.SIMNICurrentAccess;
    if (!access?.uid || !access?.workspaceId) return null;
    return `simniActiveKelas:${access.uid}:${access.workspaceId}`;
}

window.getSIMNIActiveClass = function getSIMNIActiveClass() {
    const key = activeClassStorageKey();
    if (!key) return '1A';
    try {
        const saved = localStorage.getItem(key);
        return window.daftarKelasDinamis.includes(saved) ? saved : '1A';
    } catch (_) {
        return '1A';
    }
};

window.setActiveKelas = function setActiveKelas(kelas) {
    if (window.daftarKelasDinamis && window.daftarKelasDinamis.includes(kelas)) {
        state.activeKelas = kelas;
        const key = activeClassStorageKey();
        if (key) {
            try {
                localStorage.setItem(key, kelas);
            } catch (_) {
                window.toast?.('Preferensi kelas hanya berlaku untuk sesi ini.', 'warning');
            }
        }
        
        const label = document.getElementById('navbar-active-kelas-label');
        if (label) label.textContent = 'Data Kelas ' + kelas;
        
        const desk = document.getElementById('global-kelas-select');
        if (desk) desk.value = kelas;
        const mob = document.getElementById('mobile-kelas-select');
        if (mob) mob.value = kelas;
        
        if (typeof populateAllDropdowns === 'function') populateAllDropdowns();
        
        if (typeof renderSiswaList === 'function' && state.currentView === 'siswa') renderSiswaList();
        if (typeof renderInputNilai === 'function' && state.currentView === 'nilai') renderInputNilai();
        if (typeof renderCatatanSiswa === 'function' && state.currentView === 'catatan') renderCatatanSiswa();
        if (typeof updateDashboardStats === 'function' && state.currentView === 'dashboard') updateDashboardStats();
        if (window.SIMNIGADM?.isMounted?.()) {
            void window.SIMNIGADM.refreshContext().catch((error) => window.toast?.(error.message || String(error), 'error'));
        }
    }
};
