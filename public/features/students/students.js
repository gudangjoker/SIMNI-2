// ==========================================
// FILE: features/students/students.js
// CRUD siswa, profil, QR, import, dan PDF.
// ==========================================

function studentPhotoUrl(student) {
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.['Nama Lengkap'] || 'Siswa')}&background=e0e7ff&color=4f46e5`;
    return safeHTTPSUrl(student?.['Foto URL'], fallback);
}

function normalizeNisn(value, strict = false) {
    const raw = String(value || '').trim().replace(/\s+/g, '');
    if (/^\d{10}$/.test(raw)) return raw;
    if (strict) throw new Error('NISN harus tepat 10 digit angka.');
    return raw;
}

function renderSiswaList() {
    const grid = document.getElementById('siswa-grid');
    if (!grid) return;
    const query = (document.getElementById('search-siswa')?.value || '').toLowerCase();
    
    // Multi-Class Isolation (normalizeClassLabel untuk konsistensi lintas fitur)
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    
    const filtered = [...state.students]
        .filter(student => !currentKelas || normalizeClassLabel(student?.Kelas) === currentKelas)
        .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''))
        .filter((student) => (student['Nama Lengkap'] || '').toLowerCase().includes(query) || String(student.NISN || '').includes(query));

    if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Tidak ada data.</div>';
        return;
    }

    grid.innerHTML = filtered.map((student) => {
        const nisn = normalizeNisn(student.NISN);
        const photo = escapeHTML(studentPhotoUrl(student));
        return `<div data-student-nisn="${nisn}" class="student-card bg-white dark:bg-[#111111] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 cursor-pointer hover:shadow-md transition">
            <img src="${photo}" alt="Foto ${escapeHTML(student['Nama Lengkap'])}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-50 dark:border-black">
            <div class="flex-1 overflow-hidden">
                <h4 class="font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHTML(student['Nama Lengkap'])}</h4>
                <p class="text-xs text-primary font-bold mb-1">${escapeHTML(student['Nama Panggilan'] || '-')} | ${escapeHTML(student.Kelompok || 'Belum Diatur')}</p>
                <p class="text-[10px] text-slate-500 bg-slate-50 dark:bg-[#000000] px-2 py-0.5 rounded inline-block border dark:border-slate-800">NISN: ${nisn}</p>
            </div>
        </div>`;
    }).join('');
    grid.querySelectorAll('.student-card[data-student-nisn]').forEach((card) => {
        card.addEventListener('click', () => openProfilSiswa(card.dataset.studentNisn || ''));
    });
}

async function submitSiswa(event) {
    event.preventDefault();
    try {
        const oldNisnRaw = document.getElementById('input-old-nisn').value;
        const oldNisn = oldNisnRaw ? normalizeNisn(oldNisnRaw, true) : '';
        const nisn = normalizeNisn(document.getElementById('input-nisn').value, true);
        const nama = document.getElementById('input-nama').value.trim();
        if (!nama) throw new Error('Nama lengkap wajib diisi.');

        if (oldNisn && oldNisn !== nisn) throw new Error('NISN adalah identitas tetap. Koreksi NISN memerlukan pemetaan riwayat; ubah data profil lainnya di formulir ini.');
        if (state.students.some(item => academicNisn(item.NISN) === nisn && (!oldNisn || academicNisn(item.NISN) !== oldNisn))) throw new Error('NISN sudah digunakan siswa lain.');
        const existing = state.students.find((item) => academicNisn(item.NISN) === oldNisn);
        const stableId = existing?.ID_Siswa || `stu_${nisn}`;
        const photoInput = document.getElementById('input-foto').value.trim();
        if (photoInput && !safeHTTPSUrl(photoInput, '')) throw new Error('URL foto harus berupa URL http/https yang valid.');

        const payload = {
            ID_Siswa: stableId,
            NISN: nisn,
            'Nama Lengkap': nama,
            'Nama Panggilan': document.getElementById('input-panggilan').value.trim(),
            Kelompok: document.getElementById('input-kelompok').value,
            'Foto URL': photoInput,
            foto_public_id: document.getElementById('input-foto-public-id')?.value.trim() || existing?.foto_public_id || '',
            Kelas: document.getElementById('input-kelas')?.value || (typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '')
        };

        const result = oldNisn && oldNisn !== nisn
            ? await dbUpdate({ [`Siswa/${oldNisn}`]: null, [`Siswa/${nisn}`]: payload })
            : await dbSet(`Siswa/${nisn}`, payload);
        if (!result?.ok) throw result?.error || new Error('Data siswa gagal disimpan.');

        state.students = state.students
            .filter((item) => item.NISN !== oldNisn && item.NISN !== nisn)
            .concat(payload);
        closeModal('modal-form-siswa');
        event.target.reset();
        const publicIdInput = document.getElementById('input-foto-public-id');
        if (publicIdInput) publicIdInput.value = '';
        populateAllDropdowns();
        renderSiswaList();
        renderDashboard();
        toast('Berhasil disimpan.', 'success');
    } catch (error) {
        toast(error.message || String(error), 'error');
    }
}

function openAddSiswaModal() {
    document.getElementById('form-add-siswa').reset();
    document.getElementById('input-old-nisn').value = '';
    const publicIdInput = document.getElementById('input-foto-public-id');
    if (publicIdInput) publicIdInput.value = '';
    document.getElementById('input-nisn').readOnly = false;
    const kelasSelect = document.getElementById('input-kelas');
    if (kelasSelect) kelasSelect.value = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const statusEl = document.getElementById('foto-upload-status');
    if (statusEl) statusEl.textContent = '';
    const title = document.getElementById('modal-form-siswa-title');
    if (title) title.innerText = 'Tambah Siswa';
    openModal('modal-form-siswa');
}

function editSiswa() {
    closeModal('modal-profil-siswa');
    const student = state.students.find((item) => item.NISN === state.tempSelectedSiswaNISN);
    if (!student) return;
    document.getElementById('input-old-nisn').value = student.NISN;
    document.getElementById('input-nisn').value = student.NISN;
    document.getElementById('input-nisn').readOnly = true;
    document.getElementById('input-nama').value = student['Nama Lengkap'];
    document.getElementById('input-panggilan').value = student['Nama Panggilan'] || '';
    document.getElementById('input-kelompok').value = student.Kelompok || '';
    document.getElementById('input-foto').value = student['Foto URL'] || '';
    const publicIdInput = document.getElementById('input-foto-public-id');
    if (publicIdInput) publicIdInput.value = student.foto_public_id || student.public_id || '';
    const kelasSelect = document.getElementById('input-kelas');
    if (kelasSelect) kelasSelect.value = student.Kelas || '';
    const statusEl = document.getElementById('foto-upload-status');
    if (statusEl) statusEl.textContent = '';
    const title = document.getElementById('modal-form-siswa-title');
    if (title) title.innerText = 'Edit Siswa';
    openModal('modal-form-siswa');
}

function legacyGradeKey(grade) {
    const code = String(grade?.Deskripsi_TP || '').replace(/[.#$\/\[\]]/g, '_');
    return `${grade?.NISN || 'tanpa_nisn'}_${code}`;
}

function studentCascadeUpdates(student) {
    const nisn = student.NISN;
    const studentId = student.ID_Siswa || `stu_${nisn}`;
    const updates = { [`Siswa/${nisn}`]: null };

    state.presensi.filter((item) => item.NISN === nisn).forEach((item) => {
        if (item.Tanggal) updates[`Presensi/${normalizeDate(item.Tanggal)}_${nisn}`] = null;
    });
    state.nilaiTP.filter((item) => item.NISN === nisn || item.ID_Siswa === studentId).forEach((item) => {
        updates[`Nilai_TP/${safeFirebaseKey(item.ID_Nilai || legacyGradeKey(item), 'ID nilai')}`] = null;
    });
    state.catatan.filter((item) => item.NISN === nisn).forEach((item) => {
        if (item.ID_Catatan) updates[`Catatan/${safeFirebaseKey(item.ID_Catatan, 'ID catatan')}`] = null;
    });
    state.dataLPS.filter((item) => item.NISN === nisn || item.studentId === studentId || item.ID_Siswa === studentId).forEach((item) => {
        const id = item.ID_LPS || item.id;
        if (id) updates[`Data_LPS/${safeFirebaseKey(id, 'ID LPS')}`] = null;
    });
    state.lpsReports.filter((item) => item.NISN === nisn || item.studentId === studentId || item.ID_Siswa === studentId).forEach((item) => {
        const reportId = item.reportId || item.ID_LPS || item.id;
        if (reportId) {
            const safeReportId = safeFirebaseKey(reportId, 'reportId');
            updates[`LPS/Reports/${safeReportId}`] = null;
            updates[`LPS/Revisions/${safeReportId}`] = null;
        }
    });
    return updates;
}

async function hapusSiswaPaten() {
    const student = state.students.find((item) => item.NISN === state.tempSelectedSiswaNISN);
    if (!student) return toast('Data siswa tidak ditemukan.', 'error');
    if (!confirm('Hapus siswa ini selamanya? Presensi, nilai, catatan, dan laporan siswa pada tahun aktif akan ikut dihapus.')) return;

    const updates = studentCascadeUpdates(student);
    const result = await dbUpdate(updates);
    if (!result?.ok) return;

    // Bersihkan foto di Cloudinary jika ada (best-effort)
    const photoPublicId = student.foto_public_id || student.public_id || null;
    if (photoPublicId && typeof window.SIMNICloudinary?.deleteCloudinaryAsset === 'function') {
        window.SIMNICloudinary.deleteCloudinaryAsset({
            purpose: 'student_photo',
            publicId: photoPublicId
        }).catch((err) => console.warn('[SIMNI Students] Gagal membersihkan foto siswa di Cloudinary:', err));
    }

    closeModal('modal-profil-siswa');
}

function openProfilSiswa(nisn) {
    let normalized;
    try { normalized = normalizeNisn(nisn); } catch (error) { return; }
    const student = state.students.find((item) => item.NISN === normalized);
    if (!student) return;
    state.tempSelectedSiswaNISN = normalized;
    document.getElementById('profil-nama').innerText = student['Nama Lengkap'];
    document.getElementById('profil-nisn').innerText = `NISN: ${student.NISN}`;
    document.getElementById('profil-foto').src = studentPhotoUrl(student);
    const qrContainer = document.getElementById('profil-qr');
    qrContainer.innerHTML = '';
    if (typeof QRCode === 'function') new QRCode(qrContainer, { text: student.NISN, width: 128, height: 128 });
    else qrContainer.textContent = 'Generator QR belum tersedia.';
    openModal('modal-profil-siswa');
}

function jumpToPresensi() {
    closeModal('modal-profil-siswa');
    switchView('presensi');
    document.getElementById('filter-presensi-siswa').value = state.tempSelectedSiswaNISN;
    setPresensiTab('rekap');
}

function jumpToBukuInduk() {
    closeModal('modal-profil-siswa');
    switchView('nilai');
    document.getElementById('induk-siswa-select').value = state.tempSelectedSiswaNISN;
    setNilaiTab('induk');
}

async function generatePrintQR() {
    await window.ensureSIMNIVendors?.("pdf");
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    if (typeof QRCode !== 'function') return toast('Pustaka QR belum tersedia. Muat ulang saat online.', 'error');

    printArea.innerHTML = `<div class="p-8"><h2 class="text-2xl font-bold mb-6 text-center text-black">Kartu QR Presensi - ${escapeHTML(state.pengaturan.nama_kelas)}</h2><div class="grid grid-cols-3 gap-6 text-black"></div></div>`;
    const grid = printArea.querySelector('.grid');
    [...state.students].sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || '')).forEach((student) => {
        const card = document.createElement('div');
        card.className = 'border border-black p-4 rounded flex flex-col items-center text-center break-inside-avoid';
        const qr = document.createElement('div');
        new QRCode(qr, { text: student.NISN, width: 100, height: 100 });
        card.appendChild(qr);
        const title = document.createElement('h4');
        title.className = 'font-bold text-sm mt-3';
        title.textContent = student['Nama Lengkap'];
        const nisn = document.createElement('p');
        nisn.className = 'text-[10px]';
        nisn.textContent = `NISN:${student.NISN}`;
        card.append(title, nisn);
        grid.appendChild(card);
    });

    printArea.classList.remove('hidden');
    showLoad('Membuat PDF...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: 'Kartu_QR.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(printArea).save();
    } catch (error) {
        console.error(error);
        toast(`Gagal membuat PDF QR: ${error.message || error}`, 'error');
    } finally {
        printArea.innerHTML = '';
        printArea.classList.add('hidden');
        hideLoad();
    }
}


let pendingSiswaImport = null;

function updateStudentTemplateLink() {
    const mode = document.getElementById('student-import-template')?.value || 'one';
    const link = document.getElementById('student-import-template-download');
    if (!link) return;
    link.href = mode === 'multi'
        ? 'templates/Template_Data_Siswa_Per_Kelas.xlsx'
        : 'templates/Template_Data_Siswa_1_Kelas.xlsx';
}

function renderStudentImportPreview(summary) {
    const stats = document.getElementById('preview-siswa-stats');
    const body = document.getElementById('preview-siswa-body');
    const errors = document.getElementById('preview-siswa-errors');
    if (!stats || !body || !errors) throw new Error('Komponen pratinjau impor siswa tidak lengkap.');
    stats.replaceChildren();
    [
        ['Mode', summary.mode, 'bg-blue-50', 'text-blue-700'],
        ['Baru', summary.valid, 'bg-emerald-50', 'text-emerald-700'],
        ['Duplikat', summary.duplicates, 'bg-amber-50', 'text-amber-700'],
        ['Ditolak', summary.invalid + summary.rejected, 'bg-red-50', 'text-red-700']
    ].forEach(([label, value, background, color]) => {
        const card = document.createElement('div');
        card.className = `${background} p-3 rounded-lg text-center`;
        const title = document.createElement('p');
        title.className = `text-xs ${color} font-bold uppercase`;
        title.textContent = label;
        const count = document.createElement('p');
        count.className = `text-lg font-bold ${color}`;
        count.textContent = String(value);
        card.append(title, count);
        stats.appendChild(card);
    });
    body.replaceChildren();
    summary.rows.forEach((item) => {
        const row = document.createElement('tr');
        [item.nisn || '-', item.name || '-', item.className || '-', item.status].forEach((value, index) => {
            const cell = document.createElement('td');
            cell.className = `p-2 ${index === 3 ? item.statusClass : ''}`.trim();
            cell.textContent = value;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
    errors.textContent = summary.mode === '12 kelas'
        ? 'Mode 12 kelas memvalidasi kecocokan kolom Kelas terhadap nama setiap sheet. Data duplikat tidak ditimpa.'
        : 'Mode 1 kelas hanya menerima baris untuk kelas aktif. Kolom Kelas wajib diisi dan data duplikat tidak ditimpa.';
}

async function importSiswaExcel(event) {
    await window.ensureSIMNIVendors?.("xlsx");
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        input.value = '';
        return toast('Ukuran file Excel tidak boleh melebihi 5 MB.', 'error');
    }
    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        input.value = '';
        return toast('Format file harus berupa Excel (.xlsx atau .xls).', 'error');
    }
    if (!window.XLSX?.read) {
        input.value = '';
        return toast('Pustaka Excel belum tersedia.', 'error');
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const currentKelas = normalizeClassLabel(state?.activeKelas);
            const userRole = String(window.SIMNICurrentAccess?.role || '');
            if (!['superuser', 'vip', 'teacher'].includes(userRole)) throw new Error('Role aktif tidak diizinkan melakukan impor siswa.');
            if (!currentKelas) throw new Error('Kelas aktif tidak valid. Pilih kelas sebelum melakukan impor.');
            const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
            const multiClass = workbook.SheetNames.length > 1;
            if (multiClass && workbook.SheetNames.length !== 12) throw new Error('Template banyak kelas wajib berisi tepat 12 sheet kelas.');
            const updates = {};
            const rows = [];
            const seenNisn = new Set();
            let valid = 0;
            let invalid = 0;
            let duplicates = 0;
            let rejected = 0;

            workbook.SheetNames.forEach((sheetName) => {
                const sheetClass = multiClass ? normalizeClassLabel(sheetName) : '';
                if (multiClass && !sheetClass) throw new Error(`Nama sheet "${sheetName}" bukan identitas kelas yang valid.`);
                XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).forEach((sourceRow) => {
                    const nisn = String(sourceRow.NISN || '').trim().replace(/\s+/g, '');
                    const name = String(sourceRow['Nama Lengkap'] || sourceRow.Nama || '').trim();
                    const className = normalizeClassLabel(sourceRow.Kelas);
                    const preview = { nisn, name, className, status: '', statusClass: '' };
                    if (!/^\d{10}$/.test(nisn) || !name) {
                        invalid += 1;
                        preview.status = 'Tidak valid: NISN harus 10 digit dan nama wajib diisi';
                        preview.statusClass = 'text-red-600';
                    } else if (!className) {
                        rejected += 1;
                        preview.status = 'Ditolak: kolom Kelas kosong atau tidak valid';
                        preview.statusClass = 'text-red-600';
                    } else if (multiClass && className !== sheetClass) {
                        rejected += 1;
                        preview.status = `Ditolak: kolom Kelas tidak cocok dengan sheet ${sheetName}`;
                        preview.statusClass = 'text-red-600';
                    } else if (!multiClass && className !== currentKelas) {
                        rejected += 1;
                        preview.status = `Ditolak: bukan kelas aktif ${currentKelas}`;
                        preview.statusClass = 'text-red-600';
                    } else if (seenNisn.has(nisn) || state.students.some((item) => String(item.NISN) === nisn)) {
                        duplicates += 1;
                        preview.status = 'Duplikat: tidak ditimpa';
                        preview.statusClass = 'text-amber-600';
                    } else {
                        seenNisn.add(nisn);
                        const payload = {
                            ID_Siswa: `stu_${nisn}`,
                            NISN: nisn,
                            'Nama Lengkap': name,
                            'Nama Panggilan': String(sourceRow.Panggilan || '').trim(),
                            Kelompok: String(sourceRow.Kelompok || 'Kelompok 1').trim() || 'Kelompok 1',
                            'Foto URL': '',
                            Kelas: className
                        };
                        updates[`Siswa/${nisn}`] = payload;
                        valid += 1;
                        preview.status = 'Valid: siap diimpor';
                        preview.statusClass = 'text-emerald-600';
                    }
                    rows.push(preview);
                });
            });
            pendingSiswaImport = Object.keys(updates).length ? updates : null;
            renderStudentImportPreview({ mode: multiClass ? '12 kelas' : '1 kelas', valid, invalid, duplicates, rejected, rows });
            const commit = document.getElementById('btn-commit-siswa-import');
            if (commit) commit.disabled = !pendingSiswaImport;
            openModal('modal-preview-siswa-import');
        } catch (error) {
            pendingSiswaImport = null;
            toast(error.message || String(error), 'error');
        } finally {
            input.value = '';
        }
    };
    reader.onerror = () => {
        input.value = '';
        toast('File Excel gagal dibaca.', 'error');
    };
    reader.readAsArrayBuffer(file);
}

async function commitSiswaImport() {
    if (!pendingSiswaImport || !Object.keys(pendingSiswaImport).length) {
        return toast('Tidak ada data siswa valid yang dapat disimpan.', 'warning');
    }
    const btn = document.getElementById('btn-commit-siswa-import');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }
    if (typeof showLoad === 'function') showLoad('Menyimpan data siswa ke database...');
    try {
        const updates = pendingSiswaImport;
        const result = await dbUpdate(updates);
        if (!result?.ok) throw result?.error || new Error('Import gagal disimpan.');
        
        const imported = Object.values(updates);
        const importedNisn = new Set(imported.map((item) => item.NISN));
        state.students = state.students.filter((item) => !importedNisn.has(item.NISN)).concat(imported);
        
        populateAllDropdowns();
        renderSiswaList();
        renderDashboard();
        
        toast('Berhasil disimpan: ' + imported.length + ' siswa.', 'success');
        
        closeModal('modal-preview-siswa-import');
        pendingSiswaImport = null;
    } catch (error) {
        toast(error.message || String(error), 'error');
    } finally {
        if (typeof hideLoad === 'function') hideLoad();
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan Data';
        }
    }
}

async function uploadStudentPhotoAction(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        if (input) input.value = '';
        return toast('Ukuran foto maksimal 2 MB.', 'error');
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
        if (input) input.value = '';
        return toast('Format foto harus PNG, JPEG, atau WebP.', 'error');
    }

    const statusEl = document.getElementById('foto-upload-status');
    const urlInput = document.getElementById('input-foto');
    const publicIdInput = document.getElementById('input-foto-public-id');
    try {
        if (statusEl) statusEl.textContent = 'Mengunggah ke Cloudinary...';
        if (typeof window.SIMNICloudinary?.uploadStudentPhoto === 'function') {
            const result = await window.SIMNICloudinary.uploadStudentPhoto(file);
            const url = result?.secureUrl || result?.url;
            const publicId = result?.publicId || result?.public_id || '';
            if (url) {
                if (urlInput) urlInput.value = url;
                if (publicIdInput) publicIdInput.value = publicId;
                if (statusEl) statusEl.textContent = '✓ Terunggah';
                toast('Foto berhasil diunggah ke Cloudinary.', 'success');
            } else {
                throw new Error('URL foto tidak diperoleh dari Cloudinary.');
            }
        } else {
            throw new Error('Modul Cloudinary belum aktif.');
        }
    } catch (error) {
        if (statusEl) statusEl.textContent = 'Gagal unggah';
        toast('Gagal mengunggah foto ke Cloudinary: ' + (error?.message || String(error)), 'error');
    } finally {
        if (input) input.value = '';
    }
}

async function exportSiswaExcel() {
    try {
        await window.ensureSIMNIVendors?.("xlsx");
        if (!window.XLSX?.utils) return toast('Pustaka Excel belum tersedia. Muat ulang saat online.', 'error');

        const currentKelas = normalizeClassLabel(state?.activeKelas);
        const students = [...state.students]
            .filter(s => !currentKelas || normalizeClassLabel(s?.Kelas) === currentKelas)
            .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));

        if (!students.length) return toast('Tidak ada data siswa untuk diunduh.', 'warning');

        // Build export rows — exclude QR Code, Foto URL, foto_public_id, ID_Siswa
        const exportData = students.map((s, i) => ({
            'No': i + 1,
            'NISN': s.NISN || '',
            'Nama Lengkap': s['Nama Lengkap'] || '',
            'Nama Panggilan': s['Nama Panggilan'] || '',
            'Kelas': s.Kelas || '',
            'Kelompok BTQ': s.Kelompok || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        // Set column widths for readability
        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 14 },  // NISN
            { wch: 30 },  // Nama Lengkap
            { wch: 18 },  // Nama Panggilan
            { wch: 8 },   // Kelas
            { wch: 14 }   // Kelompok BTQ
        ];

        const wb = XLSX.utils.book_new();
        const sheetName = currentKelas ? `Kelas ${currentKelas}` : 'Semua Siswa';
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const kelasLabel = currentKelas || 'Semua';
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `Data_Siswa_${kelasLabel}_${dateStr}.xlsx`;

        if (window.SIMNIDownloadService?.downloadBlob) {
            await window.SIMNIDownloadService.downloadBlob(blob, filename);
        } else {
            // Fallback browser download
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        toast(`Data ${students.length} siswa berhasil diunduh.`, 'success');
    } catch (error) {
        toast(error.message || 'Gagal mengunduh data siswa.', 'error');
    }
}

if (typeof window !== 'undefined') {
    window.renderSiswaList = renderSiswaList;
    window.openAddSiswaModal = openAddSiswaModal;
    window.submitSiswa = submitSiswa;
    window.editSiswa = editSiswa;
    window.hapusSiswaPaten = hapusSiswaPaten;
    window.importSiswaExcel = importSiswaExcel;
    window.commitSiswaImport = commitSiswaImport;
    window.uploadStudentPhotoAction = uploadStudentPhotoAction;
    window.exportSiswaExcel = exportSiswaExcel;
}
