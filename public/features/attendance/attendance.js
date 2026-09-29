// ==========================================
// FILE: features/attendance/attendance.js
// Presensi manual, QR scanner, rekap dan PDF.
// ==========================================

function setPresensiTab(tab) {
    ['input', 'rekap'].forEach((name) => {
        const button = document.getElementById(`tab-presensi-${name}`);
        if (button) button.className = `simni-tab ${tab === name ? 'active' : ''} flex-1 sm:flex-none`;
        const panel = document.getElementById(`presensi-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'rekap') renderRekapPresensi();
    else renderPresensiManual();
}

let attendanceEditDate = '';

function activeAttendanceStudents() {
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    return [...state.students]
        .filter((student) => {
            return Boolean(currentKelas && academicRecordClass(student) === currentKelas && student.status !== 'inactive');
        })
        .sort((a, b) => (a['Nama Lengkap'] || a?.nama || '').localeCompare(b['Nama Lengkap'] || b?.nama || ''));
}

function attendanceCompleteForDate(date, students = activeAttendanceStudents()) {
    return Boolean(date && students.length && students.every((student) => state.presensi.some(
        (item) => normalizeDate(item.Tanggal) === date && academicNisn(item.NISN) === academicNisn(student.NISN) && academicRecordClass(item) === academicRecordClass(student) && ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(item.Status)
    )));
}

function renderPresensiManual() {
    let date = document.getElementById('presensi-date')?.value;
    if (!date) {
        date = typeof getJakartaDateString === 'function' ? getJakartaDateString() : new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('presensi-date');
        if (dateInput) dateInput.value = date;
    }
    const body = document.getElementById('presensi-table-body');
    if (!body) return;
    if (!SIMNIFormDrafts.prepare(body, date)) return;
    const editKey = SIMNIFormDrafts.key('attendance-edit', date);
    if (attendanceEditDate && attendanceEditDate !== editKey) attendanceEditDate = '';

    const students = activeAttendanceStudents();
    const completed = attendanceCompleteForDate(date, students);
    const editing = completed && (attendanceEditDate === editKey || SIMNIFormDrafts.dirty(body));
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
            const existing = state.presensi.find((item) => normalizeDate(item.Tanggal) === date && academicNisn(item.NISN) === academicNisn(student.NISN) && academicRecordClass(item) === academicRecordClass(student));
            const status = existing?.Status || 'Hadir';
            const nisn = escapeHTML(academicNisn(student.NISN));
            return `<tr>
                <td class="p-4"><p class="font-bold text-sm">${index + 1}. ${escapeHTML(student['Nama Lengkap'])}</p><p class="text-[10px] text-slate-500">${nisn}</p><input type="hidden" class="p-nisn" value="${nisn}"><input type="hidden" class="p-nm" value="${escapeHTML(student['Nama Lengkap'])}"></td>
                ${['Hadir', 'Sakit', 'Izin', 'Alpa'].map((value) => `<td class="p-4 text-center"><input data-baseline="${status === value}" data-record-id="${date}_${nisn}" data-draft-key="${nisn}:${value}" type="radio" aria-label="${value} — ${escapeHTML(student['Nama Lengkap'])}" name="s_${nisn}" value="${value}" ${status === value ? 'checked' : ''} class="w-4 h-4 cursor-pointer"></td>`).join('')}
                <td class="p-4"><input data-baseline="${escapeHTML(existing?.Keterangan || '')}" data-record-id="${date}_${nisn}" data-draft-key="${nisn}:ket" type="text" aria-label="Keterangan presensi ${escapeHTML(student['Nama Lengkap'])}" class="p-ket w-full border border-slate-200 dark:border-[#222222] rounded text-xs p-2 bg-slate-50 dark:bg-[#000000]" value="${escapeHTML(existing?.Keterangan || '')}" placeholder="..."></td>
            </tr>`;
        }).join('');
    SIMNIFormDrafts.restore(body);
}

function editPresensiManual() {
    const date = document.getElementById('presensi-date')?.value || '';
    if (!attendanceCompleteForDate(date)) return;
    attendanceEditDate = SIMNIFormDrafts.key('attendance-edit', date);
    renderPresensiManual();
}

async function savePresensiManual() {
    let date = document.getElementById('presensi-date')?.value;
    if (!date) {
        date = typeof getJakartaDateString === 'function' ? getJakartaDateString() : new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('presensi-date');
        if (dateInput) dateInput.value = date;
    }
    if (!document.querySelectorAll('#presensi-table-body tr').length) {
        renderPresensiManual();
    }
    const updates = {};
    const committed = [];
    const invalid = activeAttendanceStudents().filter(student => !/^\d{10}$/.test(academicNisn(student.NISN)));
    if (invalid.length) return toast(`NISN harus tepat 10 digit: ${invalid.map(student => student['Nama Lengkap']).join(', ')}. Periksa data siswa.`, 'error');
    const currentKelas = normalizeClassLabel(state.activeKelas);
    const roster = activeAttendanceStudents();
    const displayedNisns = [...document.querySelectorAll('#presensi-table-body .p-nisn')].map(input => academicNisn(input.value));
    if (displayedNisns.length !== roster.length || roster.some(student => !displayedNisns.includes(academicNisn(student.NISN)))) return toast('Daftar siswa berubah saat form diisi. Draft dipertahankan; periksa daftar siswa sebelum menyimpan.', 'error');
    if (new Set(roster.map(student => academicNisn(student.NISN))).size !== roster.length) return toast('NISN ganda pada daftar siswa. Presensi ditahan.', 'error');
    if (state.presensi.some(item => normalizeDate(item.Tanggal) === date && roster.some(student => academicNisn(student.NISN) === academicNisn(item.NISN)) && academicRecordClass(item) !== currentKelas)) return toast('Riwayat siswa pada tanggal ini tercatat di kelas lain. Presensi ditahan agar riwayat tidak tertimpa.', 'error');
    document.querySelectorAll('#presensi-table-body tr').forEach((row) => {
        const nisnRaw = row.querySelector('.p-nisn')?.value;
        const nisn = String(nisnRaw || '').trim();
        if (!nisn) return;
        const validNisn = academicNisn(nisn);
        const status = row.querySelector('input[type="radio"]:checked')?.value || 'Hadir';
        const payload = {
            Tanggal: date,
            NISN: validNisn,
            Nama: row.querySelector('.p-nm')?.value || '',
            Status: status,
            Keterangan: row.querySelector('.p-ket')?.value.trim() || '',
            Kelas: currentKelas
        };
        updates[`Presensi/${date}_${validNisn}`] = payload;
        committed.push(payload);
    });
    if (!Object.keys(updates).length) return toast('Tidak ada data presensi untuk disimpan.', 'info');
    const body = document.getElementById('presensi-table-body');
    const token = SIMNIFormDrafts.begin(body);
    const result = await dbUpdate(updates);
    SIMNIFormDrafts.finish(token, result?.ok === true);
    if (!result?.ok) {
        toast(result?.error?.message || 'Gagal menyimpan presensi.', 'error');
        return;
    }
    if (!SIMNIFormDrafts.sameSession(token)) return;
    const committedNisn = new Set(committed.map((item) => item.NISN));
    state.presensi = state.presensi
        .filter((item) => normalizeDate(item.Tanggal) !== date || !committedNisn.has(item.NISN))
        .concat(committed);
    notifyCommittedSave(() => {
        if (SIMNIFormDrafts.isCurrent(body, token)) { attendanceEditDate = ''; renderPresensiManual(); }
        renderRekapPresensi();
        renderDashboard();
    });
}

let scannerTeardownPromise = null;
let scannerUIObserver = null;

function disconnectScannerUI() {
    scannerUIObserver?.disconnect();
    scannerUIObserver = null;
}

// Translate rendered controls without replacing library-owned elements/listeners.
function localizeScannerUI() {
    disconnectScannerUI();
    const reader = document.getElementById('reader');
    if (!reader) return;
    const labels = new Map([
        ['Request Camera Permissions', 'Aktifkan Kamera'],
        ['Requesting camera permissions...', 'Menunggu izin kamera…'],
        ['Start Scanning', 'Mulai Pindai'],
        ['Stop Scanning', 'Hentikan Kamera'],
        ['Launching Camera...', 'Membuka kamera…'],
        ['Scan an Image File', 'Pilih Foto QR'],
        ['Scan using camera directly', 'Gunakan Kamera'],
        ['Choose Image', 'Pilih Foto QR'],
        ['Choose Another', 'Pilih Foto Lain'],
        ['No image choosen', 'Belum ada foto dipilih'],
        ['No image chosen', 'Belum ada foto dipilih'],
        ['No camera found', 'Kamera tidak ditemukan'],
        ['Switch On Torch', 'Nyalakan Senter'],
        ['Switch Off Torch', 'Matikan Senter'],
        ['Requesting camera permissions', 'Menunggu izin kamera']
    ]);
    const refresh = () => {
        const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const original = node.nodeValue.trim();
            const translated = labels.get(original) || (original.startsWith('Select Camera') ? original.replace('Select Camera', 'Pilih Kamera') : null);
            if (translated && translated !== original) node.nodeValue = node.nodeValue.replace(original, translated);
        }
        const select = reader.querySelector('select');
        if (select) select.setAttribute('aria-label', 'Pilih kamera');
        const toggle = reader.querySelector('#html5-qrcode-anchor-scan-type-change');
        if (toggle) {
            toggle.setAttribute('role', 'button');
            toggle.tabIndex = 0;
            toggle.onkeydown = event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle.click(); }
            };
        }
    };
    refresh();
    scannerUIObserver = new MutationObserver(refresh);
    scannerUIObserver.observe(reader, { childList: true, subtree: true, characterData: true });
}

function stopQRScannerMediaTracks() {
    const reader = document.getElementById('reader');
    if (!reader) return;

    reader.querySelectorAll('video').forEach((video) => {
        const stream = video.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((track) => {
                try { track.stop(); } catch (_) {}
            });
        }
        try {
            video.pause?.();
            video.srcObject = null;
        } catch (_) {}
    });
}

async function teardownQRScanner({ closeUi = true, rerender = true } = {}) {
    disconnectScannerUI();
    if (closeUi) closeModal('modal-scanner');

    // Stop browser media tracks immediately. Html5QrcodeScanner.clear() is
    // asynchronous and can reject/hang during page backgrounding or teardown.
    stopQRScannerMediaTracks();

    if (scannerTeardownPromise) {
        try { await scannerTeardownPromise; } catch (_) {}
        if (rerender) renderPresensiManual();
        return;
    }

    const scanner = state.scannerInstance;
    state.scannerInstance = null;

    scannerTeardownPromise = (async () => {
        if (scanner?.clear) {
            try {
                await scanner.clear();
            } catch (error) {
                console.warn('Scanner gagal ditutup bersih:', error);
            }
        }

        // clear() normally stops the stream, but enforce it once more as a
        // defensive fallback for mobile Chromium/WebView lifecycle races.
        stopQRScannerMediaTracks();
    })();

    try {
        await scannerTeardownPromise;
    } finally {
        scannerTeardownPromise = null;
    }

    if (rerender) renderPresensiManual();
}

async function openQRScanner() {
    await window.ensureSIMNIVendors?.("scanner");
    if (typeof Html5QrcodeScanner !== 'function') return toast('Pustaka pemindai QR belum tersedia. Muat ulang saat online.', 'error');

    // A stale scanner from a previous modal/session must never retain camera
    // ownership when a new scanner is opened.
    if (state.scannerInstance || scannerTeardownPromise) {
        await teardownQRScanner({ closeUi: false, rerender: false });
    }

    openModal('modal-scanner');
    const status = document.getElementById('scan-result-text');
    if (status) status.textContent = 'Siap memindai QR siswa.';
    const dateLabel = document.getElementById('scan-date-label');
    const dateInput = document.getElementById('presensi-date');
    if (dateLabel && dateInput) dateLabel.innerText = dateInput.value;

    try {
        const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: (width, height) => { const side = Math.min(250, Math.floor(Math.min(width, height) * 0.75)); return { width: side, height: side }; } }, false);
        state.scannerInstance = scanner;
        scanner.render(onScanSuccess, () => {});
        localizeScannerUI();
    } catch (error) {
        state.scannerInstance = null;
        stopQRScannerMediaTracks();
        closeModal('modal-scanner');
        disconnectScannerUI();
        toast(`Gagal memuat kamera: ${error.message || error}`, 'error');
    }
}

async function closeQRScanner() {
    await teardownQRScanner({ closeUi: true, rerender: true });
}

function teardownQRScannerForPageLifecycle() {
    disconnectScannerUI();
    closeModal('modal-scanner');
    stopQRScannerMediaTracks();

    const scanner = state.scannerInstance;
    state.scannerInstance = null;

    // pagehide/visibilitychange cannot rely on awaited cleanup. Start clear()
    // best-effort after synchronously stopping every MediaStreamTrack.
    if (scanner?.clear) {
        try {
            const result = scanner.clear();
            result?.catch?.((error) => console.warn('Scanner lifecycle cleanup gagal:', error));
        } catch (error) {
            console.warn('Scanner lifecycle cleanup gagal:', error);
        }
    }
}

if (typeof window !== 'undefined' && !window.__SIMNIAttendanceScannerLifecycleInstalled) {
    window.__SIMNIAttendanceScannerLifecycleInstalled = true;
    window.addEventListener('pagehide', teardownQRScannerForPageLifecycle);
    window.addEventListener('beforeunload', teardownQRScannerForPageLifecycle);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && state.scannerInstance) {
            teardownQRScannerForPageLifecycle();
        }
    });
}

let lastScan = null;
let lastScanTime = 0;
async function onScanSuccess(decodedText) {
    const nisn = academicNisn(decodedText);
    if (nisn === lastScan && Date.now() - lastScanTime < 3000) return;
    lastScan = nisn;
    lastScanTime = Date.now();

    const student = activeAttendanceStudents().find((item) => academicNisn(item.NISN) === nisn);
    const date = document.getElementById('presensi-date')?.value;
    const resultText = document.getElementById('scan-result-text');
    if (!student || !/^\d{10}$/.test(nisn)) {
        if (resultText) resultText.textContent = 'NISN TIDAK DIKENAL';
        return;
    }
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    if (currentKelas && academicRecordClass(student) !== currentKelas) {
        if (resultText) resultText.textContent = `NISN BUKAN KELAS ${currentKelas}`;
        return;
    }
    if (!date) return toast('Tanggal presensi belum dipilih.', 'warning');

    if (state.presensi.some((item) => normalizeDate(item.Tanggal) === date && item.NISN === nisn)) {
        if (resultText) resultText.textContent = `${student['Nama Lengkap']} sudah tercatat pada ${date}.`;
        playBeep();
        return;
    }

    if (resultText) resultText.textContent = `Menyimpan presensi ${student['Nama Lengkap']}…`;
    try {
    const result = await dbSet(`Presensi/${date}_${nisn}`, {
        Tanggal: date,
        NISN: nisn,
        Nama: student['Nama Lengkap'],
        Status: 'Hadir',
        Keterangan: 'Scan QR',
        Kelas: currentKelas
    });
    if (result?.ok) {
        if (resultText) resultText.textContent = `${student['Nama Lengkap']} — presensi hadir tersimpan.`;
        playBeep();
    } else {
        if (resultText) resultText.textContent = 'Presensi belum tersimpan. Coba pindai kembali.';
    }
    } catch (error) {
        if (resultText) resultText.textContent = 'Gagal menyimpan presensi. Periksa koneksi lalu coba kembali.';
        toast(error.message || 'Gagal menyimpan presensi.', 'error');
    }
}

function filteredAttendance() {
    const period = document.getElementById('filter-presensi-waktu')?.value || 'hari';
    const nisn = document.getElementById('filter-presensi-siswa')?.value || '';
    const specificDate = document.getElementById('filter-presensi-tanggal')?.value || getJakartaDateString();
    const currentMonth = getJakartaMonthString();
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    let items = state.presensi.filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
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
    body.innerHTML = rows.join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-400 font-medium"><i class="fas fa-info-circle mr-1"></i> Tidak ada data untuk filter ini.<br><span class="text-xs text-slate-500 mt-1 block">Buka tab <b>Pencatatan</b> untuk mengisi kehadiran siswa.</span></td></tr>';

    const mapping = { 'rekap-hadir': 'HADIR', 'rekap-sakit': 'SAKIT', 'rekap-izin': 'IZIN', 'rekap-alpa': 'ALPA' };
    Object.entries(mapping).forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (element) element.innerText = counts[key];
    });
}

async function cetakRekapPresensiPDF() {
    await window.ensureSIMNIVendors?.("pdf");
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

if (typeof window !== 'undefined') {
    window.setPresensiTab = setPresensiTab;
    window.renderPresensiManual = renderPresensiManual;
    window.savePresensiManual = savePresensiManual;
    window.editPresensiManual = editPresensiManual;
    window.openQRScanner = openQRScanner;
    window.closeQRScanner = closeQRScanner;
    window.renderRekapPresensi = renderRekapPresensi;
    window.cetakRekapPresensiPDF = cetakRekapPresensiPDF;
}
