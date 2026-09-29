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

let isStudentSelectMode = false;
let selectedStudentNisns = new Set();

function getFilteredStudentsList() {
    const query = (document.getElementById('search-siswa')?.value || '').toLowerCase();
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    return [...state.students]
        .filter(student => !currentKelas || normalizeClassLabel(student?.Kelas) === currentKelas)
        .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''))
        .filter((student) => (student['Nama Lengkap'] || '').toLowerCase().includes(query) || String(student.NISN || '').includes(query));
}

function renderSiswaList() {
    const grid = document.getElementById('siswa-grid');
    if (!grid) return;
    
    const filtered = getFilteredStudentsList();

    if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Tidak ada data.</div>';
        updateStudentBatchBar();
        return;
    }

    grid.innerHTML = filtered.map((student) => {
        const nisn = normalizeNisn(student.NISN);
        const photo = escapeHTML(studentPhotoUrl(student));
        const isSelected = selectedStudentNisns.has(nisn);
        const cardBorderClass = isSelected
            ? 'border-primary ring-2 ring-primary/40 bg-indigo-50/70 dark:bg-indigo-950/30'
            : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111113] hover:border-primary/40';
        
        const checkboxHtml = isStudentSelectMode
            ? `<input type="checkbox" data-select-nisn="${nisn}" ${isSelected ? 'checked' : ''} class="w-5 h-5 rounded-lg text-primary focus:ring-primary border-slate-300 dark:border-slate-700 cursor-pointer">`
            : '';

        return `<div data-student-nisn="${nisn}" class="student-card simni-student-card ${cardBorderClass} p-4 rounded-2xl shadow-2xs border flex items-center gap-3 md:gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            ${checkboxHtml}
            <img src="${photo}" alt="Foto ${escapeHTML(student['Nama Lengkap'])}" class="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-800 shrink-0 shadow-2xs">
            <div class="flex-1 overflow-hidden">
                <h4 class="font-bold text-slate-900 dark:text-slate-100 truncate text-sm md:text-base leading-snug">${escapeHTML(student['Nama Lengkap'])}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 mb-1.5 truncate"><span class="font-bold text-slate-700 dark:text-slate-200">${escapeHTML(student['Nama Panggilan'] || '-')}</span> &bull; <span>${escapeHTML(student.Kelompok || 'Belum Diatur')}</span></p>
                <span class="simni-student-nisn">NISN: ${nisn}</span>
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.student-card[data-student-nisn]').forEach((card) => {
        const nisn = card.dataset.studentNisn || '';
        card.addEventListener('click', (e) => {
            if (isStudentSelectMode) {
                const isChecked = selectedStudentNisns.has(nisn);
                if (isChecked) selectedStudentNisns.delete(nisn);
                else selectedStudentNisns.add(nisn);
                renderSiswaList();
                updateStudentBatchBar();
            } else {
                openProfilSiswa(nisn);
            }
        });
        const chk = card.querySelector(`input[data-select-nisn]`);
        if (chk) {
            chk.addEventListener('click', (e) => e.stopPropagation());
            chk.addEventListener('change', (e) => {
                if (e.target.checked) selectedStudentNisns.add(nisn);
                else selectedStudentNisns.delete(nisn);
                renderSiswaList();
                updateStudentBatchBar();
            });
        }
    });

    updateStudentBatchBar();
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

function updateStudentBatchBar() {
    const bar = document.getElementById('student-batch-bar');
    const countEl = document.getElementById('student-batch-count');
    const toggleAllBtn = document.getElementById('btn-batch-select-all');
    if (!bar) return;

    if (isStudentSelectMode && selectedStudentNisns.size > 0) {
        bar.classList.remove('translate-y-28', 'opacity-0', 'pointer-events-none');
        bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        if (countEl) countEl.textContent = `${selectedStudentNisns.size} dipilih`;
        
        const filtered = getFilteredStudentsList();
        const allSelected = filtered.length > 0 && filtered.every(s => selectedStudentNisns.has(normalizeNisn(s.NISN)));
        if (toggleAllBtn) toggleAllBtn.textContent = allSelected ? 'Batal Semua' : 'Pilih Semua';
    } else {
        bar.classList.add('translate-y-28', 'opacity-0', 'pointer-events-none');
        bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }
}

function toggleStudentSelectMode() {
    isStudentSelectMode = !isStudentSelectMode;
    if (!isStudentSelectMode) {
        selectedStudentNisns.clear();
    }
    const btn = document.getElementById('btn-toggle-select-siswa');
    const label = document.getElementById('label-toggle-select-siswa');
    if (btn) {
        if (isStudentSelectMode) {
            btn.classList.add('bg-primary', 'text-white');
            btn.classList.remove('bg-white', 'dark:bg-[#111111]', 'text-slate-700', 'dark:text-slate-300');
        } else {
            btn.classList.remove('bg-primary', 'text-white');
            btn.classList.add('bg-white', 'dark:bg-[#111111]', 'text-slate-700', 'dark:text-slate-300');
        }
    }
    if (label) label.textContent = isStudentSelectMode ? 'Selesai Memilih' : 'Pilih Massal';
    renderSiswaList();
}

function toggleSelectAllStudents() {
    const filtered = getFilteredStudentsList();
    if (!filtered.length) return;
    const allSelected = filtered.every(s => selectedStudentNisns.has(normalizeNisn(s.NISN)));
    if (allSelected) {
        filtered.forEach(s => selectedStudentNisns.delete(normalizeNisn(s.NISN)));
    } else {
        filtered.forEach(s => selectedStudentNisns.add(normalizeNisn(s.NISN)));
    }
    renderSiswaList();
}

function clearStudentSelection() {
    selectedStudentNisns.clear();
    renderSiswaList();
}

function openBatchChangeClassModal() {
    if (!selectedStudentNisns.size) return toast('Pilih minimal satu siswa.', 'warning');
    const modeInput = document.getElementById('batch-update-mode');
    const fieldKelas = document.getElementById('batch-field-kelas');
    const fieldKelompok = document.getElementById('batch-field-kelompok');
    const titleEl = document.getElementById('modal-batch-update-title');
    const countInfo = document.getElementById('batch-update-count-info');

    if (modeInput) modeInput.value = 'kelas';
    if (fieldKelas) fieldKelas.classList.remove('hidden');
    if (fieldKelompok) fieldKelompok.classList.add('hidden');
    if (titleEl) titleEl.textContent = 'Ubah Kelas Massal';
    if (countInfo) countInfo.textContent = String(selectedStudentNisns.size);

    openModal('modal-batch-update-siswa');
}

function openBatchChangeKelompokModal() {
    if (!selectedStudentNisns.size) return toast('Pilih minimal satu siswa.', 'warning');
    const modeInput = document.getElementById('batch-update-mode');
    const fieldKelas = document.getElementById('batch-field-kelas');
    const fieldKelompok = document.getElementById('batch-field-kelompok');
    const titleEl = document.getElementById('modal-batch-update-title');
    const countInfo = document.getElementById('batch-update-count-info');

    if (modeInput) modeInput.value = 'kelompok';
    if (fieldKelas) fieldKelas.classList.add('hidden');
    if (fieldKelompok) fieldKelompok.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Ubah Kelompok BTQ Massal';
    if (countInfo) countInfo.textContent = String(selectedStudentNisns.size);

    openModal('modal-batch-update-siswa');
}

async function commitBatchUpdateStudents(event) {
    if (event) event.preventDefault();
    if (!selectedStudentNisns.size) return toast('Tidak ada siswa yang dipilih.', 'warning');

    const mode = document.getElementById('batch-update-mode')?.value || 'kelas';
    let newValue = '';
    if (mode === 'kelas') {
        newValue = document.getElementById('input-batch-kelas')?.value;
        if (!newValue) return toast('Silakan pilih kelas baru tujuan.', 'warning');
    } else {
        newValue = document.getElementById('input-batch-kelompok')?.value || '';
    }

    showLoad('Menerapkan perubahan massal...');
    try {
        const updates = {};
        selectedStudentNisns.forEach((nisn) => {
            if (mode === 'kelas') {
                updates[`Siswa/${nisn}/Kelas`] = newValue;
            } else {
                updates[`Siswa/${nisn}/Kelompok`] = newValue;
            }
        });

        const result = await dbUpdate(updates);
        if (!result?.ok) throw result?.error || new Error('Gagal memperbarui data massal.');

        // Update state lokal
        state.students.forEach((s) => {
            const n = normalizeNisn(s.NISN);
            if (selectedStudentNisns.has(n)) {
                if (mode === 'kelas') s.Kelas = newValue;
                else s.Kelompok = newValue;
            }
        });

        closeModal('modal-batch-update-siswa');
        selectedStudentNisns.clear();
        if (typeof populateAllDropdowns === 'function') populateAllDropdowns();
        renderSiswaList();
        if (typeof renderDashboard === 'function') renderDashboard();
        toast(`Berhasil memperbarui data ${Object.keys(updates).length} siswa.`, 'success');
    } catch (error) {
        console.error(error);
        toast(error.message || 'Gagal menerapkan perubahan massal.', 'error');
    } finally {
        hideLoad();
    }
}

async function deleteBatchStudents() {
    if (!selectedStudentNisns.size) return toast('Pilih minimal satu siswa untuk dihapus.', 'warning');
    const count = selectedStudentNisns.size;
    if (!confirm(`Hapus permanen ${count} siswa terpilih beserta seluruh data riwayat presensi, nilai, dan laporannya?`)) {
        return;
    }

    showLoad(`Menghapus ${count} siswa...`);
    try {
        let allUpdates = {};
        const selectedList = state.students.filter(s => selectedStudentNisns.has(normalizeNisn(s.NISN)));
        
        selectedList.forEach(student => {
            const studentUpdates = studentCascadeUpdates(student);
            Object.assign(allUpdates, studentUpdates);
        });

        const result = await dbUpdate(allUpdates);
        if (!result?.ok) throw result?.error || new Error('Gagal menghapus siswa terpilih.');

        const deletedNisns = new Set(selectedStudentNisns);
        state.students = state.students.filter(s => !deletedNisns.has(normalizeNisn(s.NISN)));

        selectedStudentNisns.clear();
        if (typeof populateAllDropdowns === 'function') populateAllDropdowns();
        renderSiswaList();
        if (typeof renderDashboard === 'function') renderDashboard();
        toast(`${count} siswa berhasil dihapus permanen.`, 'success');
    } catch (error) {
        console.error(error);
        toast(error.message || 'Gagal menghapus data siswa.', 'error');
    } finally {
        hideLoad();
    }
}

function previewPrintSiswa() {
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const students = [...state.students]
        .filter(s => !currentKelas || normalizeClassLabel(s?.Kelas) === currentKelas)
        .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));

    if (!students.length) return toast('Tidak ada data siswa untuk dicetak.', 'warning');

    const area = document.getElementById('area-preview-cetak-siswa');
    if (!area) return;

    const logoUrl = escapeHTML(state?.pengaturan?.logo_url || './icons/school-logo.png');
    const namaYayasan = escapeHTML(state?.pengaturan?.nama_yayasan || 'YAYASAN SOSIAL DAN PENDIDIKAN BINA MUDA');
    const jenjangSekolah = escapeHTML(state?.pengaturan?.jenjang_sekolah || 'SEKOLAH DASAR ISLAM TERPADU');
    const namaSekolah = escapeHTML(state?.pengaturan?.nama_sekolah || 'SDIT BINA MUDA CICALENGKA');
    const statusAkreditasiRaw = state?.pengaturan?.status_akreditasi || 'A';
    const statusAkreditasi = escapeHTML(statusAkreditasiRaw.toLowerCase().includes('terakreditasi') ? statusAkreditasiRaw : `Terakreditasi "${statusAkreditasiRaw}"`);
    const nomorIzinRaw = state?.pengaturan?.nomor_izin || 'No.421.2/1143-Disdikbud/2011';
    const nomorIzin = escapeHTML(nomorIzinRaw.toLowerCase().includes('ijin') || nomorIzinRaw.toLowerCase().includes('izin') ? nomorIzinRaw : `Ijin Operasional/RPS : ${nomorIzinRaw}`);
    const kotaSekolah = escapeHTML(state?.pengaturan?.kota || 'Cicalengka');
    const tahunPelajaran = escapeHTML(state?.pengaturan?.tahun_pelajaran || '2026/2027');
    const semester = escapeHTML(state?.pengaturan?.semester || '1 (Ganjil)');
    const namaKelas = escapeHTML(state?.pengaturan?.nama_kelas || currentKelas || 'Semua Kelas');
    const namaGuru = escapeHTML(state?.pengaturan?.nama_wali_kelas || state?.pengaturan?.nama_guru || state?.user?.displayName || 'Guru Kelas');
    const nuptkGuru = escapeHTML(state?.pengaturan?.nuptk_wali_kelas || state?.pengaturan?.nuptk_guru || state?.pengaturan?.nip_guru || '-');
    const namaKamad = escapeHTML(state?.pengaturan?.nama_kepala_sekolah || state?.pengaturan?.nama_kamad || 'Kepala SDIT Bina Muda');
    const nuksKamad = escapeHTML(state?.pengaturan?.nuks_kepala_sekolah || state?.pengaturan?.nuks_kamad || state?.pengaturan?.nip_kamad || '-');
    const tglCetak = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    const rowsHtml = students.map((s, idx) => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-family: monospace;">${escapeHTML(s.NISN || '-')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; font-weight: bold;">${escapeHTML(s['Nama Lengkap'] || '')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${escapeHTML(s['Nama Panggilan'] || '-')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-weight: bold;">${escapeHTML(s.Kelas || currentKelas || '-')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${escapeHTML(s.Kelompok || 'Belum Diatur')}</td>
        </tr>
    `).join('');

    area.innerHTML = `
        <div style="font-family: 'Times New Roman', serif; color: #111; line-height: 1.3;">
            <!-- KOP SURAT RESMI IDENTIK LPS / BLP -->
            <header class="lps-letterhead" style="display: grid; grid-template-columns: 80px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 85px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 16px;">
                <div class="lps-logo-box" style="display: flex; align-items: center; justify-content: center; width: 75px; height: 75px;">
                    <img src="${logoUrl}" alt="Logo sekolah" style="display: block; max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="lps-school-copy" style="min-width: 0; text-align: center;">
                    <p style="margin: 0; font-size: 10pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${namaYayasan}</p>
                    <p style="margin: 1px 0 0 0; font-size: 9.5pt; font-weight: 600; text-transform: uppercase;">${jenjangSekolah}</p>
                    <h1 style="margin: 3px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16pt; font-weight: bold; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.5px;">${namaSekolah}</h1>
                    <strong style="display: block; margin: 1px 0 0 0; font-size: 9pt; font-weight: bold;">${statusAkreditasi}</strong>
                    <em style="display: block; margin: 1px 0 0 0; font-size: 8.5pt; font-style: normal; font-weight: 500;">${nomorIzin}</em>
                </div>
            </header>

            <!-- JUDUL DOKUMEN -->
            <div style="text-align: center; margin-bottom: 16px;">
                <h3 style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">DAFTAR SISWA KELAS ${namaKelas}</h3>
                <p style="font-size: 10pt; font-weight: bold; margin: 4px 0 0 0;">Tahun Pelajaran ${tahunPelajaran} — Semester ${semester}</p>
            </div>

            <!-- TABEL DATA SISWA -->
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #f1f5f9; font-weight: bold; text-transform: uppercase;">
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 40px; text-align: center;">No</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 120px; text-align: center;">NISN</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; text-align: left;">Nama Lengkap</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 100px; text-align: center;">Panggilan</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 60px; text-align: center;">Kelas</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 110px; text-align: center;">Kelompok BTQ</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- TANDA TANGAN DOKUMEN -->
            <div style="display: flex; justify-content: space-between; page-break-inside: avoid; margin-top: 30px; font-size: 10pt;">
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">Mengetahui,</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Kepala SDIT Bina Muda</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaKamad}</p>
                    <p style="margin: 0; font-size: 9pt;">NUKS. ${nuksKamad}</p>
                </div>
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">Ditetapkan di ${kotaSekolah}, ${tglCetak}</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Wali Kelas / Guru</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaGuru}</p>
                    <p style="margin: 0; font-size: 9pt;">NUPTK. ${nuptkGuru}</p>
                </div>
            </div>
        </div>
    `;

    openModal('modal-preview-cetak-siswa');
}

async function executePrintSiswaPreview() {
    await window.ensureSIMNIVendors?.("pdf");
    const container = document.getElementById('area-preview-cetak-siswa');
    if (!container) return;

    if (typeof html2pdf === 'function') {
        showLoad('Membuat dokumen PDF...');
        const currentKelas = normalizeClassLabel(state?.activeKelas) || 'Semua';
        const dateStr = new Date().toISOString().slice(0, 10);
        try {
            await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `Daftar_Siswa_${currentKelas}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(container).save();
            toast('Dokumen PDF berhasil disimpan.', 'success');
        } catch (err) {
            console.error(err);
            window.print();
        } finally {
            hideLoad();
        }
    } else {
        window.print();
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
    window.toggleStudentSelectMode = toggleStudentSelectMode;
    window.toggleSelectAllStudents = toggleSelectAllStudents;
    window.clearStudentSelection = clearStudentSelection;
    window.openBatchChangeClassModal = openBatchChangeClassModal;
    window.openBatchChangeKelompokModal = openBatchChangeKelompokModal;
    window.commitBatchUpdateStudents = commitBatchUpdateStudents;
    window.deleteBatchStudents = deleteBatchStudents;
    window.previewPrintSiswa = previewPrintSiswa;
    window.executePrintSiswaPreview = executePrintSiswaPreview;
}
