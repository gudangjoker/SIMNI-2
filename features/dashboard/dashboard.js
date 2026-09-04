// ==========================================
// FILE: features/dashboard/dashboard.js
// UI dan logika Dashboard.
// ==========================================

function renderDashboard() {
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const myStudents = currentKelas ? state.students.filter(s => s.Kelas === currentKelas) : state.students;
    const myJurnal = currentKelas ? state.jurnal.filter(j => j.Kelas === currentKelas) : state.jurnal;
    const myPresensi = currentKelas ? state.presensi.filter(p => p.Kelas === currentKelas) : state.presensi;
    const myNilai = currentKelas ? state.nilaiTP.filter(n => n.Kelas === currentKelas) : state.nilaiTP;

    if(document.getElementById('stat-siswa')) document.getElementById('stat-siswa').innerText = myStudents.length; 
    if(document.getElementById('stat-tp')) document.getElementById('stat-tp').innerText = state.mapelTP.length; 
    if(document.getElementById('stat-jurnal')) document.getElementById('stat-jurnal').innerText = myJurnal.length; 
    
    const today = getJakartaDateString(); 
    const hadir = myPresensi.filter(p => normalizeDate(p.Tanggal)===today && (p.Status||'').toLowerCase()==='hadir').length;
    if(document.getElementById('stat-hadir')) document.getElementById('stat-hadir').innerText = hadir; 

    // --- SISTEM PERINGATAN DINI AKADEMIK ---
    const pdCont = document.getElementById('peringatan-dini-container');
    const pdList = document.getElementById('peringatan-dini-list');
    if(!pdCont || !pdList) return;

    let warnings = '';
    const bulanIni = getJakartaMonthString();
    const rekapPresensi = {};
    const rekapNilai = {};

    myPresensi.filter(p => normalizeDate(p.Tanggal).startsWith(bulanIni)).forEach(p => {
        if(p.Status === 'Alpa' || p.Status === 'Sakit') rekapPresensi[p.NISN] = (rekapPresensi[p.NISN] || 0) + 1;
    });

    myNilai.forEach(n => {
        if(n.nilai < 60) rekapNilai[n.NISN] = (rekapNilai[n.NISN] || 0) + 1;
    });

    myStudents.forEach(s => {
        const totalAbsen = rekapPresensi[s.NISN] || 0;
        const totalRemedial = rekapNilai[s.NISN] || 0;

        if(totalAbsen >= 3) {
            warnings += `<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-xl flex items-start gap-3 shadow-sm"><div class="text-red-500 mt-1"><i class="fas fa-user-injured text-lg"></i></div><div><h4 class="font-bold text-sm text-red-700 dark:text-red-400">${escapeHTML(s['Nama Lengkap'])}</h4><p class="text-xs text-red-600 dark:text-red-300 mt-0.5">Tercatat absen (Sakit/Alpa) sebanyak <b>${totalAbsen} kali</b> bulan ini.</p></div></div>`;
        }
        if(totalRemedial >= 2) {
            warnings += `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl flex items-start gap-3 shadow-sm"><div class="text-amber-500 mt-1"><i class="fas fa-star-half-alt text-lg"></i></div><div><h4 class="font-bold text-sm text-amber-700 dark:text-amber-400">${escapeHTML(s['Nama Lengkap'])}</h4><p class="text-xs text-amber-600 dark:text-amber-300 mt-0.5">Nilai di bawah standar ketuntasan pada <b>${totalRemedial} TP</b>.</p></div></div>`;
        }
    });

    if(warnings) {
        pdList.innerHTML = warnings;
        pdCont.classList.remove('hidden');
    } else {
        pdCont.classList.add('hidden');
    }
}
