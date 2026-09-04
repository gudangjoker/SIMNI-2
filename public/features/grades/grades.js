// ==========================================
// FILE: features/grades/grades.js
// Tujuan Pembelajaran, nilai, rekap dan buku induk.
// ==========================================

function tpId(tp) {
    return String(tp?.ID_mapel ?? tp?.learningObjectiveId ?? '').trim();
}

function gradeSubjectAllowed(subject) {
    const role = window.SIMNICurrentAccess?.role || null;
    return window.SIMNIAccessPolicy?.allowedSubject(role, subject) !== false;
}

function visibleLearningObjectives() {
    const activeClass = normalizeClassLabel(state?.activeKelas);
    return state.mapelTP.filter((tp) => {
        if (!gradeSubjectAllowed(tp.mapel)) return false;
        const objectiveClass = normalizeClassLabel(tp.kelas || tp.Kelas);
        return !activeClass || !objectiveClass || objectiveClass === activeClass;
    });
}

function applyGradeSubjectPolicy() {
    const role = window.SIMNICurrentAccess?.role || null;
    const vip = role === window.SIMNIAccessPolicy?.ROLES?.VIP;
    for (const id of ['filter-mapel-nilai', 'rekap-mapel-nilai', 'input-tp-mapel']) {
        const select = document.getElementById(id);
        if (!select) continue;
        [...select.options].forEach((option) => {
            const allowed = !option.value || gradeSubjectAllowed(option.value);
            option.hidden = !allowed;
            option.disabled = !allowed;
        });
        if (vip) select.value = 'PJOK';
    }
}

function getTPById(id) {
    return visibleLearningObjectives().find((tp) => tpId(tp) === String(id || '')) || null;
}

function legacyCodeUnique(code) {
    return state.mapelTP.filter((tp) => String(tp.kode_tp || '') === String(code || '')).length === 1;
}

function gradeMatchesTP(grade, tp) {
    const targetId = tpId(tp);
    if (grade?.learningObjectiveId && targetId) return String(grade.learningObjectiveId) === targetId;
    return legacyCodeUnique(tp?.kode_tp) && String(grade?.Deskripsi_TP || grade?.kode_tp || '') === String(tp?.kode_tp || '');
}

function gradeIdFor(student, tp) {
    const studentId = safeFirebaseKey(student?.ID_Siswa || `stu_${student?.NISN}`, 'studentId');
    const objectiveId = safeFirebaseKey(tpId(tp), 'learningObjectiveId');
    return `grade_${studentId}__${objectiveId}`;
}

function activeGradeStudents() {
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    return [...state.students]
        .filter((student) => currentKelas === '' || student.Kelas === currentKelas)
        .sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));
}

function gradeForStudentTP(student, tp) {
    const studentKeys = new Set([student?.ID_Siswa, student?.NISN].filter(Boolean).map(String));
    const matches = state.nilaiTP.filter((item) => {
        const itemKey = String(item?.ID_Siswa || item?.NISN || '');
        return studentKeys.has(itemKey) && gradeMatchesTP(item, tp);
    });
    if (!matches.length) return null;
    return matches.find((m) => Number.isFinite(Number(m.nilai))) || matches[0];
}

function gradeProgressForTP(tp) {
    const students = activeGradeStudents();
    const graded = students.filter((student) => {
        const grade = gradeForStudentTP(student, tp);
        return grade && Number.isFinite(Number(grade.nilai));
    }).length;
    return { total: students.length, graded, completed: students.length > 0 && graded === students.length };
}

function setNilaiTab(tab) {
    ['input', 'rekap', 'induk'].forEach((name) => {
        const button = document.getElementById(`tab-nilai-${name}`);
        if (button) button.className = `whitespace-nowrap px-4 py-2 border-b-2 text-sm font-bold ${tab === name ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`;
        const panel = document.getElementById(`nilai-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'rekap') updateRekapTPDropdown();
    if (tab === 'induk') renderBukuInduk();
}

function renderNilaiTPControls() {
    applyGradeSubjectPolicy();
    updateTPListModal();
    updateTPDropdown();
}

async function hapusTP(idMapel, kodeTP) {
    const tp = getTPById(idMapel);
    if (!tp) return toast('TP tidak ditemukan.', 'error');
    if (!confirm(`Hapus TP ${kodeTP}? Semua nilai pada TP ini di tahun aktif akan ikut dihapus.`)) return;

    const updates = { [`Mapel_TP/${safeFirebaseKey(tpId(tp), 'ID TP')}`]: null };
    state.nilaiTP.filter((grade) => gradeMatchesTP(grade, tp)).forEach((grade) => {
        const id = grade.ID_Nilai || gradeIdFor({ ID_Siswa: grade.ID_Siswa, NISN: grade.NISN }, tp);
        updates[`Nilai_TP/${safeFirebaseKey(id, 'ID nilai')}`] = null;
    });
    const result = await dbUpdate(updates);
    if (result?.ok) toast('TP dan nilai terkait berhasil dihapus.', 'success');
}

function updateTPListModal() {
    const list = document.getElementById('list-tp-modal');
    if (!list) return;
    list.replaceChildren();
    visibleLearningObjectives().forEach((tp) => {
        const row = document.createElement('div');
        row.className = 'bg-slate-50 p-2 rounded border border-slate-200 mb-2 flex justify-between items-start';
        const content = document.createElement('div'); content.className = 'flex-1';
        const code = document.createElement('span'); code.className = 'font-bold text-xs text-primary bg-indigo-50 px-2 py-0.5 rounded'; code.textContent = tp.kode_tp || '';
        const meta = document.createElement('span'); meta.className = 'text-[10px] text-slate-500 uppercase font-bold ml-1'; meta.textContent = `${tp.mapel || ''} Smt.${tp.semester || ''}`;
        const desc = document.createElement('p'); desc.className = 'text-xs mt-1 text-slate-700'; desc.textContent = tp.deskripsi_tp || '';
        content.append(code, meta, desc);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-red-400 hover:text-red-600 ml-2'; button.setAttribute('aria-label', `Hapus TP ${tp.kode_tp || ''}`);
        const icon = document.createElement('i'); icon.className = 'fas fa-trash text-xs'; button.appendChild(icon);
        button.addEventListener('click', () => hapusTP(tpId(tp), tp.kode_tp || ''));
        row.append(content, button); list.appendChild(row);
    });
}

async function submitTP(event) {
    event.preventDefault();
    const mapel = document.getElementById('input-tp-mapel').value;
    const semester = document.getElementById('input-tp-smt').value;
    const kode = document.getElementById('input-tp-kode').value.trim();
    const deskripsi = document.getElementById('input-tp-desc').value.trim();
    if (!kode || !deskripsi) return toast('Kode dan deskripsi TP wajib diisi.', 'warning');
    if (!gradeSubjectAllowed(mapel)) return toast('Role ini hanya diizinkan mengelola Pelajaran PJOK.', 'error');

    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const duplicate = state.mapelTP.some((tp) => tp.mapel === mapel && String(tp.semester) === String(semester) && String(tp.kode_tp).toLowerCase() === kode.toLowerCase() && (tp.kelas || tp.Kelas || '') === currentKelas);
    if (duplicate) return toast('Kode TP sudah digunakan pada mapel dan semester yang sama di kelas ini.', 'warning');

    const id = typeof crypto?.randomUUID === 'function' ? `tp_${crypto.randomUUID()}` : `tp_${Date.now()}`;
    const payload = { ID_mapel: id, mapel, semester, kode_tp: kode, deskripsi_tp: deskripsi, kelas: currentKelas };
    const result = await dbSet(`Mapel_TP/${safeFirebaseKey(id, 'ID TP')}`, payload);
    if (result?.ok) {
        state.mapelTP = state.mapelTP.filter((tp) => tpId(tp) !== id).concat(payload);
        event.target.reset();
        applyGradeSubjectPolicy();
        updateTPListModal();
        updateTPDropdown(true);
        updateRekapTPDropdown();
        toast('Berhasil disimpan.', 'success');
    }
}

let pendingTPImport = null;

function updateTPTemplateLink() {
    const mode = document.getElementById('tp-import-template')?.value || 'one';
    const link = document.getElementById('tp-import-template-download');
    if (!link) return;
    link.href = mode === 'multi'
        ? 'templates/Template_Impor_TP_Per_Kelas.xlsx'
        : 'templates/Template_Impor_TP_1_Kelas.xlsx';
}

function renderTPImportPreview(summary) {
    const stats = document.getElementById('preview-tp-stats');
    const body = document.getElementById('preview-tp-body');
    const errors = document.getElementById('preview-tp-errors');
    if (!stats || !body || !errors) throw new Error('Komponen pratinjau impor TP tidak lengkap.');
    stats.replaceChildren();
    [
        ['Mode', summary.mode, 'bg-blue-50', 'text-blue-700'],
        ['Valid', summary.valid, 'bg-emerald-50', 'text-emerald-700'],
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
        [item.code || '-', item.subject || '-', item.className || '-', item.status].forEach((value, index) => {
            const cell = document.createElement('td');
            cell.className = `p-2 ${index === 3 ? item.statusClass : ''}`.trim();
            cell.textContent = value;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
    errors.textContent = summary.mode === '12 kelas'
        ? 'Mode 12 kelas memvalidasi kecocokan kolom Kelas terhadap nama sheet. Duplikat tidak ditimpa.'
        : 'Mode 1 kelas hanya menerima TP untuk kelas aktif. Kolom Kelas wajib diisi dan duplikat tidak ditimpa.';
}

function importTPExcel(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!window.XLSX?.read) {
        input.value = '';
        return toast('Pustaka Excel belum tersedia.', 'error');
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const currentKelas = normalizeClassLabel(state?.activeKelas);
            const userRole = String(window.SIMNICurrentAccess?.role || '');
            if (!['superuser', 'vip'].includes(userRole)) throw new Error('Role aktif tidak diizinkan melakukan impor TP.');
            if (!currentKelas) throw new Error('Kelas aktif tidak valid. Pilih kelas sebelum melakukan impor.');
            const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
            const multiClass = workbook.SheetNames.length > 1;
            if (multiClass && workbook.SheetNames.length !== 12) throw new Error('Template banyak kelas wajib berisi tepat 12 sheet kelas.');
            const updates = {};
            const rows = [];
            const seenKeys = new Set();
            let valid = 0;
            let invalid = 0;
            let duplicates = 0;
            let rejected = 0;

            workbook.SheetNames.forEach((sheetName) => {
                const sheetClass = multiClass ? normalizeClassLabel(sheetName) : '';
                if (multiClass && !sheetClass) throw new Error(`Nama sheet "${sheetName}" bukan identitas kelas yang valid.`);
                XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).forEach((sourceRow) => {
                    const subject = String(sourceRow['Mata Pelajaran'] || sourceRow.Mapel || '').trim();
                    const semester = String(sourceRow.Semester || '').trim();
                    const code = String(sourceRow['Kode TP'] || sourceRow.Kode || '').trim();
                    const description = String(sourceRow['Deskripsi TP'] || sourceRow.Deskripsi || '').trim();
                    const className = normalizeClassLabel(sourceRow.Kelas);
                    const preview = { code, subject, className, status: '', statusClass: '' };
                    if (!subject || !['1', '2'].includes(semester) || !code || !description) {
                        invalid += 1;
                        preview.status = 'Tidak valid: mapel, semester 1/2, kode, dan deskripsi wajib diisi';
                        preview.statusClass = 'text-red-600';
                    } else if (!gradeSubjectAllowed(subject)) {
                        rejected += 1;
                        preview.status = 'Ditolak: mata pelajaran tidak diizinkan untuk role aktif';
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
                    } else {
                        const key = `${className}|${subject.toLocaleLowerCase('id-ID')}|${semester}|${code.toLocaleLowerCase('id-ID')}`;
                        const exists = seenKeys.has(key) || state.mapelTP.some((tp) => {
                            const tpClass = normalizeClassLabel(tp.kelas || tp.Kelas);
                            return tpClass === className
                                && String(tp.mapel || '').toLocaleLowerCase('id-ID') === subject.toLocaleLowerCase('id-ID')
                                && String(tp.semester || '') === semester
                                && String(tp.kode_tp || '').toLocaleLowerCase('id-ID') === code.toLocaleLowerCase('id-ID');
                        });
                        if (exists) {
                            duplicates += 1;
                            preview.status = 'Duplikat: tidak ditimpa';
                            preview.statusClass = 'text-amber-600';
                        } else {
                            seenKeys.add(key);
                            const id = typeof crypto?.randomUUID === 'function'
                                ? `tp_${crypto.randomUUID()}`
                                : `tp_${Date.now()}_${valid}`;
                            updates[`Mapel_TP/${safeFirebaseKey(id, 'ID TP')}`] = {
                                ID_mapel: id,
                                mapel: subject,
                                semester,
                                kode_tp: code,
                                deskripsi_tp: description,
                                kelas: className
                            };
                            valid += 1;
                            preview.status = 'Valid: siap diimpor';
                            preview.statusClass = 'text-emerald-600';
                        }
                    }
                    rows.push(preview);
                });
            });
            pendingTPImport = Object.keys(updates).length ? updates : null;
            renderTPImportPreview({ mode: multiClass ? '12 kelas' : '1 kelas', valid, invalid, duplicates, rejected, rows });
            const commit = document.getElementById('btn-commit-tp-import');
            if (commit) commit.disabled = !pendingTPImport;
            openModal('modal-preview-tp-import');
        } catch (error) {
            pendingTPImport = null;
            toast(`Import Excel gagal: ${error.message || error}`, 'error');
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

async function commitTPImport() {
    if (!pendingTPImport) return toast('Tidak ada TP valid yang dapat disimpan.', 'warning');
    try {
        const updates = pendingTPImport;
        const result = await dbUpdate(updates);
        if (!result?.ok) throw result?.error || new Error('Import TP gagal disimpan.');
        const imported = Object.values(updates);
        const ids = new Set(imported.map((item) => item.ID_mapel));
        state.mapelTP = state.mapelTP.filter((item) => !ids.has(item.ID_mapel)).concat(imported);
        pendingTPImport = null;
        updateTPListModal();
        updateTPDropdown(true);
        updateRekapTPDropdown();
        closeModal('modal-preview-tp-import');
        toast(`Berhasil disimpan: ${imported.length} TP.`, 'success');
    } catch (error) {
        toast(error.message || String(error), 'error');
    }
}

function updateTPDropdown(resetSelection = false) {
    const select = document.getElementById('filter-tp-nilai');
    if (!select) return;
    applyGradeSubjectPolicy();
    const mapel = document.getElementById('filter-mapel-nilai')?.value;
    const previousValue = resetSelection === true ? '' : select.value;
    const candidates = mapel ? visibleLearningObjectives().filter((tp) => tp.mapel === mapel) : [];
    const fragment = document.createDocumentFragment();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = mapel ? '-- Pilih TP yang akan diisi --' : 'Pilih Mapel Dahulu';
    fragment.appendChild(placeholder);
    candidates.forEach((tp) => {
        const progress = gradeProgressForTP(tp);
        const option = document.createElement('option');
        option.value = tpId(tp);
        option.disabled = progress.completed;
        option.style.color = progress.completed ? '#94a3b8' : '';
        option.dataset.gradeStatus = progress.completed ? 'completed' : (progress.graded ? 'partial' : 'empty');
        const status = progress.completed
            ? ' — Sudah dinilai'
            : (progress.graded ? ` — Belum lengkap (${progress.graded}/${progress.total})` : '');
        option.textContent = `${tp.kode_tp || ''} - ${String(tp.deskripsi_tp || '').substring(0, 70)}${status}`;
        fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
    if (previousValue && [...select.options].some((option) => option.value === previousValue && !option.disabled)) {
        select.value = previousValue;
    }
    renderNilaiGrid();
}

function renderNilaiGrid() {
    const selectedTpId = document.getElementById('filter-tp-nilai')?.value;
    const container = document.getElementById('nilai-grid-container');
    const empty = document.getElementById('nilai-empty-state');
    if (container) container.classList.toggle('hidden', !selectedTpId);
    if (empty) empty.classList.toggle('hidden', !!selectedTpId);
    if (!selectedTpId) return;

    const tp = getTPById(selectedTpId);
    const body = document.getElementById('nilai-table-body');
    if (!tp || !body || !gradeSubjectAllowed(tp.mapel)) return;

    body.innerHTML = activeGradeStudents()
        .map((student, index) => {
            const grade = gradeForStudentTP(student, tp);
        return `<tr class="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors"><td class="p-4 text-xs font-bold text-slate-400">${index + 1}</td><td class="p-4 font-bold text-sm">${escapeHTML(student['Nama Lengkap'])}<input type="hidden" class="n-nisn" data-student-id="${escapeHTML(student.ID_Siswa || student.NISN)}" value="${escapeHTML(student.NISN)}"><input type="hidden" class="n-nm" value="${escapeHTML(student['Nama Lengkap'])}"></td><td class="p-4 text-center"><input type="number" min="0" max="100" class="n-scr w-20 p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-black text-center rounded-lg font-bold focus:ring-2 focus:ring-primary focus:outline-none" value="${grade?.nilai !== undefined ? escapeHTML(grade.nilai) : ''}"></td></tr>`;
    }).join('');
}

async function saveNilaiBatch() {
    const selectedTpId = document.getElementById('filter-tp-nilai')?.value;
    const tp = getTPById(selectedTpId);
    if (!tp) return toast('Pilih TP terlebih dahulu.', 'warning');
    if (!gradeSubjectAllowed(tp.mapel)) return toast('Role ini hanya diizinkan menyimpan nilai PJOK.', 'error');

    try {
        const updates = {};
        const committed = [];
        for (const row of document.querySelectorAll('#nilai-table-body tr')) {
            const scoreRaw = row.querySelector('.n-scr')?.value;
            if (scoreRaw === '') continue;
            const nisn = row.querySelector('.n-nisn')?.value;
            const studentId = row.querySelector('.n-nisn')?.dataset.studentId || nisn;
            const student = { ID_Siswa: studentId, NISN: nisn };
            const id = gradeIdFor(student, tp);
            const studentKeys = new Set([studentId, nisn].filter(Boolean).map(String));
            const existingList = state.nilaiTP.filter((item) => {
                const itemKey = String(item?.ID_Siswa || item?.NISN || '');
                return studentKeys.has(itemKey) && gradeMatchesTP(item, tp);
            });
            const score = Number(scoreRaw);
            if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`Nilai ${nisn} harus 0-100.`);
            const payload = {
                ID_Nilai: id,
                ID_Siswa: studentId,
                NISN: nisn,
                nama: row.querySelector('.n-nm')?.value || '',
                learningObjectiveId: tpId(tp),
                mapel: tp.mapel,
                semester: String(tp.semester),
                kode_tp: tp.kode_tp,
                Deskripsi_TP: tp.kode_tp,
                tanggal: getJakartaDateString(),
                nilai: score,
                Kelas: typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : ''
            };
            updates[`Nilai_TP/${id}`] = payload;
            committed.push(payload);
            existingList.forEach((existing) => {
                if (existing?.ID_Nilai && existing.ID_Nilai !== id) updates[`Nilai_TP/${safeFirebaseKey(existing.ID_Nilai, 'ID nilai lama')}`] = null;
            });
        }
        if (!Object.keys(updates).length) return toast('Isi sedikitnya satu nilai sebelum menyimpan.', 'warning');
        const result = await dbUpdate(updates);
        if (!result?.ok) throw result?.error || new Error('Nilai gagal disimpan.');
        const committedIds = new Set(committed.map((item) => item.ID_Nilai));
        const committedPairs = new Set(committed.map((item) => `${item.ID_Siswa}|${item.learningObjectiveId}`));
        state.nilaiTP = state.nilaiTP.filter((item) => {
            const pair = `${item.ID_Siswa || item.NISN}|${item.learningObjectiveId || ''}`;
            return !committedIds.has(item.ID_Nilai) && !committedPairs.has(pair);
        }).concat(committed);
        updateTPDropdown(true);
        updateRekapTPDropdown();
        renderBukuInduk();
        toast('Berhasil disimpan.', 'success');
    } catch (error) {
        toast(error.message || String(error), 'error');
    }
}

function updateRekapTPDropdown() {
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    const select = document.getElementById('rekap-tp-nilai');
    if (!select) return;
    applyGradeSubjectPolicy();
    const visible = visibleLearningObjectives();
    const candidates = mapel ? visible.filter((tp) => tp.mapel === mapel) : visible;
    select.innerHTML = '<option value="">Semua TP</option>' + candidates.map((tp) => `<option value="${escapeHTML(tpId(tp))}">${escapeHTML(tp.kode_tp)} · ${escapeHTML(tp.mapel)} · Smt.${escapeHTML(tp.semester)}</option>`).join('');
    renderRekapNilai();
}

function renderRekapNilai() {
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    const selectedTpId = document.getElementById('rekap-tp-nilai')?.value;
    const nisn = document.getElementById('rekap-siswa-nilai')?.value;
    const body = document.getElementById('rekap-nilai-body');
    if (!body) return;

    let targetTPs = mapel ? visibleLearningObjectives().filter((tp) => tp.mapel === mapel) : visibleLearningObjectives();
    if (selectedTpId) targetTPs = targetTPs.filter((tp) => tpId(tp) === selectedTpId);
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    let filteredStudents = state.students;
    if (currentKelas) filteredStudents = filteredStudents.filter(s => s.Kelas === currentKelas);
    const students = nisn ? filteredStudents.filter((student) => student.NISN === nisn) : filteredStudents;
    const rows = [];

    [...students].sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || '')).forEach((student) => {
        targetTPs.forEach((tp) => {
            const grade = gradeForStudentTP(student, tp);
            if (!grade || grade.nilai === undefined) return;
            const gradeId = grade.ID_Nilai || gradeIdFor(student, tp);
            const editing = editingGradeId === gradeId;
            rows.push(`<tr data-grade-id="${escapeHTML(gradeId)}" data-student-id="${escapeHTML(student.ID_Siswa || student.NISN)}" data-tp-id="${escapeHTML(tpId(tp))}"><td class="p-4 font-bold text-sm whitespace-nowrap">${escapeHTML(student['Nama Lengkap'])}</td><td class="p-4 text-xs uppercase font-bold text-slate-500 whitespace-nowrap">${escapeHTML(tp.mapel)}</td><td class="p-4 font-bold text-primary whitespace-nowrap">${escapeHTML(tp.kode_tp)}</td><td class="p-4 text-[10px] italic max-w-xs truncate" title="${escapeHTML(tp.deskripsi_tp)}">${escapeHTML(tp.deskripsi_tp)}</td><td class="p-4 font-bold text-center text-lg">${editing ? `<input type="number" min="0" max="100" value="${escapeHTML(grade.nilai)}" class="edit-grade-score w-20 p-2 border border-primary rounded-lg text-center bg-white dark:bg-black">` : escapeHTML(grade.nilai)}</td><td class="p-4 text-center whitespace-nowrap">${editing ? '<button type="button" class="save-grade-edit px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold mr-1"><i class="fas fa-check"></i> Simpan</button><button type="button" class="cancel-grade-edit px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold">Batal</button>' : '<button type="button" class="start-grade-edit px-3 py-2 border border-primary text-primary rounded-lg text-xs font-bold"><i class="fas fa-pen"></i> Edit Nilai</button>'}</td></tr>`);
        });
    });

    body.innerHTML = rows.join('') || '<tr><td colspan="6" class="p-8 text-center text-slate-400">Tidak ada data nilai sesuai filter.</td></tr>';
    body.querySelectorAll('.start-grade-edit').forEach((button) => button.addEventListener('click', () => {
        editingGradeId = button.closest('tr')?.dataset.gradeId || '';
        renderRekapNilai();
    }));
    body.querySelectorAll('.cancel-grade-edit').forEach((button) => button.addEventListener('click', () => {
        editingGradeId = '';
        renderRekapNilai();
    }));
    body.querySelectorAll('.save-grade-edit').forEach((button) => button.addEventListener('click', () => {
        void saveEditedGrade(button.closest('tr'));
    }));
}

let editingGradeId = '';

async function saveEditedGrade(row) {
    try {
        const gradeId = row?.dataset.gradeId || '';
        const tp = getTPById(row?.dataset.tpId || '');
        const studentId = row?.dataset.studentId || '';
        const existing = state.nilaiTP.find((item) => {
            const sameStudent = String(item.ID_Siswa || item.NISN || '') === studentId;
            return sameStudent && tp && gradeMatchesTP(item, tp);
        });
        if (!existing) throw new Error('Data nilai yang akan diedit tidak ditemukan.');
        const score = Number(row.querySelector('.edit-grade-score')?.value);
        if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('Nilai harus berada pada rentang 0-100.');
        const payload = { ...existing, ID_Nilai: gradeId, nilai: score, tanggal_diperbarui: getJakartaDateString() };
        const result = await dbSet(`Nilai_TP/${safeFirebaseKey(gradeId, 'ID nilai')}`, payload);
        if (!result?.ok) throw result?.error || new Error('Perubahan nilai gagal disimpan.');
        state.nilaiTP = state.nilaiTP.filter((item) => item !== existing && item.ID_Nilai !== gradeId).concat(payload);
        editingGradeId = '';
        renderRekapNilai();
        updateTPDropdown();
        renderBukuInduk();
        toast('Berhasil disimpan.', 'success');
    } catch (error) {
        toast(error.message || String(error), 'error');
    }
}

function renderBukuInduk() {
    const nisn = document.getElementById('induk-siswa-select')?.value;
    const container = document.getElementById('induk-content-area');
    if (!container) return;
    if (!nisn) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400 absolute inset-0 flex flex-col items-center justify-center"><i class="fas fa-user-graduate text-6xl opacity-50 mb-4"></i><p class="font-bold">Pilih Siswa Terlebih Dahulu</p></div>';
        return;
    }

    const student = state.students.find((item) => item.NISN === nisn);
    if (!student) return;
    const attendance = state.presensi.filter((item) => item.NISN === nisn);
    const count = (status) => attendance.filter((item) => String(item.Status || '').toUpperCase() === status).length;
    const rows = [];

    const mapelList = [...new Set(visibleLearningObjectives().map((tp) => tp.mapel).filter(Boolean))];
    mapelList.forEach((mapel) => {
        const objectives = visibleLearningObjectives().filter((tp) => tp.mapel === mapel);
        const grades = objectives.map((tp) => ({ tp, grade: state.nilaiTP.find((item) => (item.ID_Siswa || item.NISN) === (student.ID_Siswa || student.NISN) && gradeMatchesTP(item, tp)) })).filter((item) => item.grade?.nilai !== undefined);
        if (!grades.length) return;
        const average = Math.round(grades.reduce((sum, item) => sum + Number(item.grade.nilai || 0), 0) / grades.length);
        const sorted = [...grades].sort((a, b) => Number(b.grade.nilai) - Number(a.grade.nilai));
        const top = sorted[0]?.tp?.deskripsi_tp || 'pemahaman materi';
        const bottom = sorted[sorted.length - 1]?.tp?.deskripsi_tp || 'penguasaan konsep lanjutan';
        const description = `Menunjukkan pemahaman yang sangat baik dalam ${top}. ${top !== bottom ? `Perlu bimbingan lebih lanjut dalam ${bottom}.` : ''}`;
        rows.push(`<tr><td class="p-3 border border-slate-300 font-bold">${escapeHTML(mapel)}</td><td class="p-3 border border-slate-300 text-center font-bold">${average}</td><td class="p-3 border border-slate-300 text-xs">${escapeHTML(description)}</td></tr>`);
    });

    const photo = escapeHTML(safeHTTPSUrl(student['Foto URL'], `https://ui-avatars.com/api/?name=${encodeURIComponent(student['Nama Lengkap'])}&background=fff&color=000`));
    container.innerHTML = `<div class="p-8 bg-white text-slate-800" id="cetak-induk-area"><div class="text-center border-b-2 border-black pb-4 mb-6"><h2 class="text-2xl font-bold uppercase tracking-wider">Buku Induk Siswa</h2><p class="font-medium text-sm">Kelas ${escapeHTML(state.pengaturan.nama_kelas)} - Tahun Pelajaran ${escapeHTML(state.pengaturan.tahun_pelajaran)}</p></div><div class="flex gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200"><img src="${photo}" alt="Foto siswa" class="w-32 h-40 object-cover border-4 border-white shadow-sm rounded bg-white"><div class="text-sm flex-1"><table class="w-full mb-4"><tr><td class="w-32 py-1 text-slate-500 font-bold">Nama Lengkap</td><td class="py-1">: <span class="font-bold text-base">${escapeHTML(student['Nama Lengkap'])}</span></td></tr><tr><td class="py-1 text-slate-500 font-bold">NISN</td><td class="py-1">: ${escapeHTML(student.NISN)}</td></tr><tr><td class="py-1 text-slate-500 font-bold">Nama Panggilan</td><td class="py-1">: ${escapeHTML(student['Nama Panggilan'] || '-')}</td></tr><tr><td class="py-1 text-slate-500 font-bold">Kelompok</td><td class="py-1">: ${escapeHTML(student.Kelompok || '-')}</td></tr></table><div class="inline-flex gap-4 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm"><span>Hadir: ${count('HADIR')}</span><span>Sakit: ${count('SAKIT')}</span><span>Izin: ${count('IZIN')}</span><span>Alpa: ${count('ALPA')}</span></div></div></div><h3 class="font-bold text-lg mb-3 border-b-2 border-primary pb-1 inline-block">Capaian Akademik</h3><table class="w-full text-left border-collapse border border-slate-300"><thead class="bg-slate-100"><tr><th class="p-3 border border-slate-300 w-1/4">Mata Pelajaran</th><th class="p-3 border border-slate-300 w-16 text-center">Nilai</th><th class="p-3 border border-slate-300">Deskripsi Capaian Pembelajaran</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

async function cetakBukuInduk() {
    const content = document.getElementById('cetak-induk-area');
    if (!content) return toast('Data profil induk tidak ditemukan!', 'error');
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    const nisn = document.getElementById('induk-siswa-select')?.value;
    const student = state.students.find((item) => item.NISN === nisn);
    showLoad('Membuat PDF Buku Induk...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: `${safeFilename(`Buku_Induk_${student?.['Nama Lengkap'] || 'Siswa'}`)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(content).save();
    } catch (error) {
        console.error(error);
        toast(`Gagal membuat PDF Buku Induk: ${error.message || error}`, 'error');
    } finally {
        hideLoad();
    }
}
