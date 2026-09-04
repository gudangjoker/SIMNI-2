// ==========================================
// FILE: features/attendance/attendance.js
// Presensi manual, QR scanner, rekap dan PDF.
// ==========================================

function setPresensiTab(tab) {
    ['input', 'rekap'].forEach((name) => {
        const button = document.getElementById(`tab-presensi-${name}`);
        if (button) button.className = `px-4 py-2 border-b-2 text-sm font-bold ${tab === name ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`;
        const panel = document.getElementById(`presensi-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'rekap') renderRekapPresensi();
    else renderPresensiManual();
}

let attendanceEditDate = '';

function activeAttendanceStudents() {
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    return [...state.students]
        .filter((student) => currentKelas === '' || student.Kelas === currentKelas)
        .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));
}

function attendanceCompleteForDate(date, students = activeAttendanceStudents()) {
    return Boolean(date && students.length && students.every((student) => state.presensi.some(
        (item) => normalizeDate(item.Tanggal) === date && item.NISN === student.NISN
    )));
}

function renderPresensiManual() {
    const date = document.getElementById('presensi-date')?.value;
    const body = document.getElementById('presensi-table-body');
    if (!date || !body) return;
    if (attendanceEditDate && attendanceEditDate !== date) attendanceEditDate = '';

    const students = activeAttendanceStudents();
    const completed = attendanceCompleteForDate(date, students);
    const editing = completed && attendanceEditDate === date;
    const table = document.getElementById('presensi-entry-table');
    const completedState = document.getElementById('presensi-completed-state');
    const action = document.getElementById('presensi-primary-action');
    if (table) table.classList.toggle('hidden', completed && !editing);
    if (completedState) completedState.classList.toggle('hidden', !completed || editing);
    if (action) {
        action.dataset.simniAction = completed && !editing ? 'editPresensiManual' : 'savePresensiManual';
        const icon = action.querySelector('i');
        const label = action.querySelector('span');
        if (icon) icon.className = completed && !editing ? 'fas fa-pen' : 'fas fa-save';
        if (label) label.textContent = completed && !editing ? 'Edit Kehadiran' : (editing ? 'Simpan Perubahan' : 'Simpan Kehadiran');
    }

    body.innerHTML = students
        .map((student, index) => {
            const existing = state.presensi.find((item) => normalizeDate(item.Tanggal) === date && item.NISN === student.NISN);
            const status = existing?.Status || 'Hadir';
            const nisn = escapeHTML(student.NISN);
            return `<tr>
                <td class="p-4"><p class="font-bold text-sm">${index + 1}. ${escapeHTML(student['Nama Lengkap'])}</p><p class="text-[10px] text-slate-500">${nisn}</p><input type="hidden" class="p-nisn" value="${nisn}"><input type="hidden" class="p-nm" value="${escapeHTML(student['Nama Lengkap'])}"></td>
                ${['Hadir', 'Sakit', 'Izin', 'Alpa'].map((value) => `<td class="p-4 text-center"><input type="radio" name="s_${nisn}" value="${value}" ${status === value ? 'checked' : ''} class="w-4 h-4 cursor-pointer"></td>`).join('')}
                <td class="p-4"><input type="text" class="p-ket w-full border border-slate-200 dark:border-[#222222] rounded text-xs p-2 bg-slate-50 dark:bg-[#000000]" value="${escapeHTML(existing?.Keterangan || '')}" placeholder="..."></td>
            </tr>`;
        }).join('');
}

function editPresensiManual() {
    const date = document.getElementById('presensi-date')?.value || '';
    if (!attendanceCompleteForDate(date)) return;
    attendanceEditDate = date;
    renderPresensiManual();
}

async function savePresensiManual() {
    const date = document.getElementById('presensi-date')?.value;
    if (!date) return toast('Pilih tanggal!', 'warning');
    const updates = {};
    const committed = [];
    document.querySelectorAll('#presensi-table-body tr').forEach((row) => {
        const nisn = row.querySelector('.p-nisn')?.value;
        if (!/^\d{10}$/.test(nisn || '')) return;
        const status = row.querySelector('input[type="radio"]:checked')?.value || 'Hadir';
        const payload = {
            Tanggal: date,
            NISN: nisn,
            Nama: row.querySelector('.p-nm')?.value || '',
            Status: status,
            Keterangan: row.querySelector('.p-ket')?.value.trim() || '',
            Kelas: typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : ''
        };
        updates[`Presensi/${date}_${nisn}`] = payload;
        committed.push(payload);
    });
    if (!Object.keys(updates).length) return toast('Tidak ada data presensi untuk disimpan.', 'info');
    const result = await dbUpdate(updates);
    if (!result?.ok) return;
    const committedNisn = new Set(committed.map((item) => item.NISN));
    state.presensi = state.presensi
        .filter((item) => normalizeDate(item.Tanggal) !== date || !committedNisn.has(item.NISN))
        .concat(committed);
    attendanceEditDate = '';
    renderPresensiManual();
    renderRekapPresensi();
    renderDashboard();
    toast('Berhasil disimpan.', 'success');
}

function openQRScanner() {
    if (typeof Html5QrcodeScanner !== 'function') return toast('Pustaka pemindai QR belum tersedia. Muat ulang saat online.', 'error');
    openModal('modal-scanner');
    const dateLabel = document.getElementById('scan-date-label');
    const dateInput = document.getElementById('presensi-date');
    if (dateLabel && dateInput) dateLabel.innerText = dateInput.value;
    try {
        if (state.scannerInstance?.clear) state.scannerInstance.clear().catch?.(() => {});
        state.scannerInstance = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);
        state.scannerInstance.render(onScanSuccess, () => {});
    } catch (error) {
        state.scannerInstance = null;
        toast(`Gagal memuat kamera: ${error.message || error}`, 'error');
    }
}

async function closeQRScanner() {
    closeModal('modal-scanner');
    const scanner = state.scannerInstance;
    state.scannerInstance = null;
    if (scanner?.clear) {
        try { await scanner.clear(); } catch (error) { console.warn('Scanner gagal ditutup bersih:', error); }
    }
    renderPresensiManual();
}

let lastScan = null;
let lastScanTime = 0;
async function onScanSuccess(decodedText) {
    const nisn = String(decodedText || '').trim();
    if (nisn === lastScan && Date.now() - lastScanTime < 3000) return;
    lastScan = nisn;
    lastScanTime = Date.now();

    const student = state.students.find((item) => item.NISN === nisn);
    const date = document.getElementById('presensi-date')?.value;
    const resultText = document.getElementById('scan-result-text');
    if (!student || !/^\d{10}$/.test(nisn)) {
        if (resultText) resultText.textContent = 'NISN TIDAK DIKENAL';
        return;
    }
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    if (student.Kelas !== currentKelas) {
        if (resultText) resultText.textContent = `NISN BUKAN KELAS ${currentKelas}`;
        return;
    }
    if (!date) return toast('Tanggal presensi belum dipilih.', 'warning');

    if (state.presensi.some((item) => normalizeDate(item.Tanggal) === date && item.NISN === nisn)) {
        if (resultText) resultText.textContent = 'SUDAH ABSEN HARI INI';
        playBeep();
        return;
    }

    const result = await dbSet(`Presensi/${date}_${nisn}`, {
        Tanggal: date,
        NISN: nisn,
        Nama: student['Nama Lengkap'],
        Status: 'Hadir',
        Keterangan: 'Scan QR',
        Kelas: currentKelas
    });
    if (result?.ok) {
        if (resultText) resultText.textContent = `${student['Nama Lengkap']} HADIR`;
        playBeep();
    }
}

function filteredAttendance() {
    const period = document.getElementById('filter-presensi-waktu')?.value || 'hari';
    const nisn = document.getElementById('filter-presensi-siswa')?.value || '';
    const specificDate = document.getElementById('filter-presensi-tanggal')?.value || getJakartaDateString();
    const currentMonth = getJakartaMonthString();
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    let items = state.presensi.filter((item) => {
        if (currentKelas && item.Kelas && item.Kelas !== currentKelas) return false;
        const date = normalizeDate(item.Tanggal);
        if (period === 'hari') return date === specificDate;
        if (period === 'bulan') return date.startsWith(currentMonth);
        return true;
    });
    if (nisn) items = items.filter((item) => item.NISN === nisn);
    return { items, period, specificDate, currentMonth };
}

function renderRekapPresensi() {
    const { items, period } = filteredAttendance();
    const dateContainer = document.getElementById('container-filter-tanggal');
    if (dateContainer) dateContainer.classList.toggle('hidden', period !== 'hari');
    const body = document.getElementById('rekap-presensi-body');
    if (!body) return;

    const counts = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0 };
    const rows = [...items].sort((a, b) => (a.Nama || '').localeCompare(b.Nama || '')).map((item) => {
        const status = String(item.Status || '').toUpperCase();
        if (status in counts) counts[status] += 1;
        return `<tr><td class="p-4 text-xs font-bold">${escapeHTML(normalizeDate(item.Tanggal))}</td><td class="p-4 font-bold">${escapeHTML(item.Nama)}</td><td class="p-4 text-[10px] font-bold text-center">${escapeHTML(status)}</td><td class="p-4 text-xs italic opacity-80">${escapeHTML(item.Keterangan || '-')}</td></tr>`;
    });
    body.innerHTML = rows.join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-400">Tidak ada data untuk filter ini.</td></tr>';

    const mapping = { 'rekap-hadir': 'HADIR', 'rekap-sakit': 'SAKIT', 'rekap-izin': 'IZIN', 'rekap-alpa': 'ALPA' };
    Object.entries(mapping).forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (element) element.innerText = counts[key];
    });
}

async function cetakRekapPresensiPDF() {
    const { items, period, specificDate, currentMonth } = filteredAttendance();
    if (!items.length) return toast('Tidak ada data yang bisa dicetak pada filter ini.', 'error');
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');

    const rows = [...items].sort((a, b) => (a.Nama || '').localeCompare(b.Nama || '')).map((item, index) => `<tr><td style="border:1px solid #000;padding:5px;text-align:center">${index + 1}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(item.Nama)}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(normalizeDate(item.Tanggal))}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(item.Status)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(item.Keterangan || '-')}</td></tr>`).join('');
    const label = period === 'hari' ? `TANGGAL: ${specificDate}` : period === 'bulan' ? `BULAN: ${currentMonth}` : 'SEMESTER INI';
    const element = document.createElement('div');
    element.innerHTML = `<div style="padding:20px;font-family:'Times New Roman',serif;color:#000;background:#fff"><h2 style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:5px;text-transform:uppercase">Rekapitulasi Kehadiran Siswa<br>Kelas ${escapeHTML(state.pengaturan.nama_kelas)} - ${escapeHTML(state.pengaturan.tahun_pelajaran)}</h2><p style="text-align:center;margin-bottom:15px;font-weight:bold;font-size:13px">${escapeHTML(label)}</p><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="border:1px solid #000;padding:5px">No</th><th style="border:1px solid #000;padding:5px">Nama Siswa</th><th style="border:1px solid #000;padding:5px">Tanggal</th><th style="border:1px solid #000;padding:5px">Status</th><th style="border:1px solid #000;padding:5px">Keterangan</th></tr></thead><tbody>${rows}</tbody></table></div>`;

    showLoad('Membuat Rekap PDF...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: `${safeFilename(`Rekap_Presensi_${period}_${state.pengaturan.nama_kelas}`)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(element).save();
    } catch (error) {
        console.error(error);
        toast(`Gagal membuat PDF presensi: ${error.message || error}`, 'error');
    } finally {
        hideLoad();
    }
}
