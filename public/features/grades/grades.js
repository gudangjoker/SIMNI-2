// ==========================================
// FILE: features/grades/grades.js
// Tujuan Pembelajaran, nilai, rekap dan buku induk.
// ==========================================

function tpId(tp) {
    return String(tp?.ID_mapel || tp?.learningObjectiveId || tp?.kode_tp || '').trim();
}

function gradeSubjectAllowed(subject) {
    const role = window.SIMNICurrentAccess?.role || null;
    return window.SIMNIAccessPolicy?.allowedSubject(role, subject) !== false;
}

function visibleLearningObjectives() {
    const activeClass = normalizeClassLabel(state?.activeKelas);
    return state.mapelTP.filter((tp) => {
        if (!gradeSubjectAllowed(tp.mapel)) return false;
        const objectiveClass = normalizeClassLabel(academicRecordClass(tp));
        if (!objectiveClass) return true;
        return objectiveClass === activeClass;
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
    const cleanId = String(id || '').trim();
    if (!cleanId) return null;
    return visibleLearningObjectives().find(tp => tpId(tp) === cleanId) || null;
}

function legacyCodeUnique(code) {
    return state.mapelTP.filter((tp) => String(tp.kode_tp || '') === String(code || '')).length === 1;
}

function gradeMatchesTP(grade, tp) {
    const targetId = tpId(tp);
    if (academicRecordClass(grade) !== academicRecordClass(tp)) return false;
    if (grade?.learningObjectiveId && targetId) return String(grade.learningObjectiveId) === targetId;

    // Fallback untuk grade legacy tanpa learningObjectiveId:
    // Cocokkan kode_tp serta mapel dan semester jika tersedia
    const gradeCode = String(grade?.Deskripsi_TP || grade?.kode_tp || '').trim();
    const tpCode = String(tp?.kode_tp || '').trim();
    if (!gradeCode || !tpCode || gradeCode !== tpCode) return false;

    if (grade?.mapel && tp?.mapel && String(grade.mapel).toLowerCase() !== String(tp.mapel).toLowerCase()) {
        return false;
    }
    if (grade?.semester && tp?.semester && String(grade.semester) !== String(tp.semester)) {
        return false;
    }
    const candidates = state.mapelTP.filter(item =>
        academicRecordClass(item) === academicRecordClass(grade) &&
        String(item.kode_tp || '') === gradeCode &&
        (!grade.mapel || item.mapel === grade.mapel) &&
        (!grade.semester || String(item.semester) === String(grade.semester)));
    return candidates.length === 1 && tpId(candidates[0]) === targetId;
}

function gradeIdFor(student, tp) {
    const studentId = safeFirebaseKey(student?.ID_Siswa || `stu_${student?.NISN}`, 'studentId');
    const rawObjective = tpId(tp) || String(tp?.kode_tp || '').trim();
    const objectiveId = String(rawObjective).replace(/[.#$\/\[\]]/g, '_');
    if (!objectiveId) throw new Error('learningObjectiveId tidak valid.');
    return `grade_${studentId}__${objectiveId}`;
}

function activeGradeStudents() {
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    return [...state.students]
        .filter((student) => {
            return Boolean(currentKelas && academicRecordClass(student) === currentKelas && student.status !== 'inactive');
        })
        .sort((a, b) => (a['Nama Lengkap'] || a?.nama || '').localeCompare(b['Nama Lengkap'] || b?.nama || ''));
}

function gradeForStudentTP(student, tp) {
    const studentKeys = new Set([student?.ID_Siswa, student?.NISN].filter(Boolean).map(String));
    const matches = state.nilaiTP.filter((item) => {
        const itemKey = String(item?.ID_Siswa || item?.NISN || '');
        return studentKeys.has(itemKey) && gradeMatchesTP(item, tp);
    });
    if (!matches.length) return null;
    return matches.find((m) => academicScore(m.nilai) !== null) || null;
}

function gradeProgressForTP(tp) {
    const students = activeGradeStudents();
    const graded = students.filter((student) => {
        const grade = gradeForStudentTP(student, tp);
        return grade && academicScore(grade.nilai) !== null;
    }).length;
    return { total: students.length, graded, completed: students.length > 0 && graded === students.length };
}

function setNilaiTab(tab) {
    ['input', 'rekap', 'induk'].forEach((name) => {
        const button = document.getElementById(`tab-nilai-${name}`);
        if (button) button.classList.toggle('active', tab === name);
        const panel = document.getElementById(`nilai-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'rekap') {
        updateRekapTPDropdown();
        if (typeof populateAllDropdowns === 'function') populateAllDropdowns();
    }
    if (tab === 'induk') {
        populateIndukDropdown();
        renderBukuInduk();
    }
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

    const cleanTpKey = safeFirebaseKey(String(tpId(tp)).replace(/[.#$\[\]\/]/g, '_'), 'ID TP');
    const updates = { [`Mapel_TP/${cleanTpKey}`]: null };
    state.nilaiTP.filter((grade) => gradeMatchesTP(grade, tp)).forEach((grade) => {
        const id = grade.ID_Nilai || gradeIdFor({ ID_Siswa: grade.ID_Siswa, NISN: grade.NISN }, tp);
        if (id) {
            const cleanGradeKey = safeFirebaseKey(String(id).replace(/[.#$\[\]\/]/g, '_'), 'ID nilai');
            updates[`Nilai_TP/${cleanGradeKey}`] = null;
        }
    });
    const result = await dbUpdate(updates);
    if (result?.ok) {
        toast('TP dan nilai terkait berhasil dihapus.', 'success');
    } else {
        toast(result?.error?.message || 'Gagal menghapus TP.', 'error');
    }
}

function resolveChapterNumber(tp) {
    if (tp.chapterDefined && tp.chapterNumber == null) return null;
    if (tp.chapterNumber != null) {
        const n = Number(tp.chapterNumber);
        return (Number.isInteger(n) && n >= 1 && n <= 10) ? n : null;
    }
    const legacyId = String(tp.bab_id || '').trim();
    if (legacyId) {
        const n = Number(legacyId);
        if (n >= 1 && n <= 10) return n;
        const match = String(tp.bab_nama || tp.bab || '').match(/\bBab\s+(\d{1,2})\b/i);
        if (match) {
            const m = Number(match[1]);
            if (m >= 1 && m <= 10) return m;
        }
    }
    return null;
}

function selectBabDropdown(selectId, chapterNumber) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.value = (chapterNumber != null && chapterNumber >= 1 && chapterNumber <= 10)
        ? String(chapterNumber)
        : '';
}

function updateTPListModal() {
    const list = document.getElementById('list-tp-modal');
    if (!list) return;
    list.replaceChildren();

    const currentMapel = document.getElementById('input-tp-mapel')?.value || '';
    const currentSmt = document.getElementById('input-tp-smt')?.value || '';

    const allTPs = visibleLearningObjectives();
    if (!allTPs.length) {
        const empty = document.createElement('div');
        empty.className = 'text-center p-6 text-slate-400 text-xs italic';
        empty.textContent = 'Belum ada Tujuan Pembelajaran yang tersimpan.';
        list.appendChild(empty);
        return;
    }

    const UNGROUPED_KEY = '__ungrouped__';
    const groups = new Map();
    groups.set(UNGROUPED_KEY, { name: 'Umum / Belum Dikelompokkan', items: [] });

    allTPs.forEach((tp) => {
        const ch = resolveChapterNumber(tp);
        const key = ch != null ? String(ch) : UNGROUPED_KEY;
        if (!groups.has(key)) {
            groups.set(key, { name: `Bab ${ch}`, items: [] });
        }
        groups.get(key).items.push(tp);
    });

    // Sort: Bab 1..10 first, then Ungrouped last
    const sortedGroups = [...groups.entries()].sort((a, b) => {
        if (a[0] === UNGROUPED_KEY) return 1;
        if (b[0] === UNGROUPED_KEY) return -1;
        return Number(a[0]) - Number(b[0]);
    });

    sortedGroups.forEach(([, group]) => {
        if (!group.items.length) return;

        const card = document.createElement('div');
        card.className = 'border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-3 bg-white dark:bg-[#111111] shadow-sm';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'w-full px-3 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 flex justify-between items-center text-left transition-colors cursor-pointer';

        const titleArea = document.createElement('div');
        titleArea.className = 'flex items-center gap-2 min-w-0';
        const titleText = document.createElement('span');
        titleText.className = 'text-xs font-bold text-slate-800 dark:text-slate-200 truncate';
        titleText.textContent = group.name;
        const countBadge = document.createElement('span');
        countBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0';
        countBadge.textContent = `${group.items.length} TP`;
        titleArea.append(titleText, countBadge);

        const chevron = document.createElement('i');
        chevron.className = 'fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 shrink-0 ml-2';
        header.append(titleArea, chevron);

        const body = document.createElement('div');
        body.className = 'p-2 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60';

        group.items.forEach((tp) => {
            const item = document.createElement('div');
            item.className = 'pt-2 first:pt-0 flex justify-between items-start gap-2';

            const content = document.createElement('div');
            content.className = 'flex-1 min-w-0';

            const badgeRow = document.createElement('div');
            badgeRow.className = 'flex flex-wrap items-center gap-1.5 mb-1';

            const code = document.createElement('span');
            code.className = 'font-bold text-[11px] text-primary bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded';
            code.textContent = tp.kode_tp || '';

            const meta = document.createElement('span');
            meta.className = 'text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase';
            meta.textContent = `${tp.mapel || ''} · Smt ${tp.semester || ''}`;

            badgeRow.append(code, meta);

            const desc = document.createElement('p');
            desc.className = 'text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words';
            desc.textContent = tp.deskripsi_tp || '';

            content.append(badgeRow, desc);

            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-1 shrink-0';

            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer';
            btnEdit.title = 'Edit TP';
            btnEdit.innerHTML = '<i class="fas fa-edit text-xs"></i>';
            btnEdit.addEventListener('click', () => openEditTPModal(tpId(tp)));

            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer';
            btnDelete.title = 'Hapus TP';
            btnDelete.innerHTML = '<i class="fas fa-trash text-xs"></i>';
            btnDelete.addEventListener('click', () => hapusTP(tpId(tp), tp.kode_tp || ''));

            actions.append(btnEdit, btnDelete);
            item.append(content, actions);
            body.appendChild(item);
        });

        header.addEventListener('click', () => {
            const isClosed = body.classList.contains('hidden');
            body.classList.toggle('hidden', !isClosed);
            chevron.style.transform = isClosed ? 'rotate(0deg)' : 'rotate(-90deg)';
        });

        card.append(header, body);
        list.appendChild(card);
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

    const babSelect = document.getElementById('input-tp-bab');
    const babVal = babSelect?.value || '';
    const chapterNumber = babVal ? Number(babVal) : null;

    const id = typeof crypto?.randomUUID === 'function' ? `tp_${crypto.randomUUID()}` : `tp_${Date.now()}`;
    const payload = {
        ID_mapel: id,
        mapel,
        semester,
        kode_tp: kode,
        deskripsi_tp: deskripsi,
        kelas: currentKelas,
        chapterNumber: chapterNumber
    };
    const result = await dbSet(`Mapel_TP/${safeFirebaseKey(id, 'ID TP')}`, payload);
    if (result?.ok) {
        state.mapelTP = state.mapelTP.filter((tp) => tpId(tp) !== id).concat(payload);
        event.target.reset();
        applyGradeSubjectPolicy();
        updateTPListModal();
        updateTPDropdown(true);
        updateRekapTPDropdown();
        toast('Berhasil disimpan.', 'success');
    } else {
        toast(result?.error?.message || 'Gagal menyimpan Tujuan Pembelajaran.', 'error');
    }
}

function openEditTPModal(idMapel) {
    const tp = getTPById(idMapel);
    if (!tp) return toast('TP tidak ditemukan.', 'error');

    const idInput = document.getElementById('edit-tp-id');
    const mapelInput = document.getElementById('edit-tp-mapel');
    const smtSelect = document.getElementById('edit-tp-smt');
    const kodeInput = document.getElementById('edit-tp-kode');
    const descInput = document.getElementById('edit-tp-desc');

    if (idInput) idInput.value = tpId(tp);
    if (mapelInput) mapelInput.value = tp.mapel || '';
    if (smtSelect) smtSelect.value = String(tp.semester || '1');
    if (kodeInput) kodeInput.value = tp.kode_tp || '';
    if (descInput) descInput.value = tp.deskripsi_tp || '';

    selectBabDropdown('edit-tp-bab', resolveChapterNumber(tp));
    closeModal('modal-kelola-tp');
    openModal('modal-edit-tp');
}

async function submitEditTP(event) {
    event.preventDefault();
    const id = document.getElementById('edit-tp-id')?.value;
    const tp = getTPById(id);
    if (!tp) return toast('TP tidak ditemukan.', 'error');

    const kode = document.getElementById('edit-tp-kode')?.value.trim();
    const deskripsi = document.getElementById('edit-tp-desc')?.value.trim();
    const semester = document.getElementById('edit-tp-smt')?.value;
    const babSelect = document.getElementById('edit-tp-bab');
    const babVal = babSelect?.value || '';
    const chapterNumber = babVal ? Number(babVal) : null;

    if (!kode || !deskripsi) return toast('Kode dan deskripsi TP wajib diisi.', 'warning');
    if (!gradeSubjectAllowed(tp.mapel)) return toast('Mata pelajaran tidak diizinkan.', 'error');
    if (chapterNumber !== null && (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 10)) return toast('Bab harus 1 sampai 10.', 'warning');
    if (visibleLearningObjectives().some(item => tpId(item) !== id && item.mapel === tp.mapel && String(item.semester) === String(semester) && String(item.kode_tp).toLowerCase() === kode.toLowerCase())) return toast('Kode TP sudah digunakan pada kelas, mapel dan semester ini.', 'warning');
    if ((kode !== tp.kode_tp || String(semester) !== String(tp.semester)) && state.nilaiTP.some(grade => gradeMatchesTP(grade, tp))) return toast('TP sudah memiliki nilai. Kode dan semester dipertahankan; Bab dan deskripsi tetap dapat diedit.', 'warning');

    const safeId = safeFirebaseKey(id, 'ID TP');

    const changes = {
        ID_mapel: safeId,
        kode_tp: kode,
        deskripsi_tp: deskripsi,
        semester,
        kelas: academicRecordClass(tp),
        chapterNumber: chapterNumber,
        chapterDefined: true,
        updated_at: new Date().toISOString()
    };
    const payload = { ...tp, ...changes };

    const session = academicSessionKey();
    const result = await dbUpdate(Object.fromEntries(Object.entries(changes).map(([field, value]) => [`Mapel_TP/${safeId}/${field}`, value])));
    if (result?.ok) {
        if (session !== academicSessionKey()) return;
        state.mapelTP = state.mapelTP.map((item) => (tpId(item) === id ? payload : item));
        notifyCommittedSave(() => {
            closeModal('modal-edit-tp');
            openModal('modal-kelola-tp');
            updateTPListModal();
            updateTPDropdown(true);
            updateRekapTPDropdown();
        }, 'Berhasil disimpan: Tujuan Pembelajaran diperbarui.');
    } else {
        toast(result?.error?.message || 'Gagal memperbarui Tujuan Pembelajaran.', 'error');
    }
}

function deleteTPEditModal() {
    const id = document.getElementById('edit-tp-id')?.value;
    const tp = getTPById(id);
    if (!tp) return;
    closeModal('modal-edit-tp');
    openModal('modal-kelola-tp');
    hapusTP(id, tp.kode_tp || '');
}

// --- SMART OCR & SIMNI LENS ---
let ocrWorkerInstance = null;
let activeLensStream = null;
let lensRotationDegree = 0;

function getActiveOCRWorker() {
    if (!ocrWorkerInstance) {
        ocrWorkerInstance = new Worker('./vendor/tesseract/ocr-worker.js');
        ocrWorkerInstance.onmessage = handleOCRWorkerMessage;
    }
    return ocrWorkerInstance;
}

function handleOCRWorkerMessage(e) {
    const { type, progress, message, rawText } = e.data || {};
    const statusLabel = document.getElementById('ocr-status-label');
    const pContainer = document.getElementById('ocr-progress-container');
    const pBar = document.getElementById('ocr-progress-bar');
    const pText = document.getElementById('ocr-progress-text');

    if (type === 'STATUS') {
        if (statusLabel) statusLabel.textContent = message || 'Menganalisis...';
        if (pText) pText.textContent = message || '';
    } else if (type === 'PROGRESS') {
        if (pBar) pBar.style.width = `${progress}%`;
        if (pText) pText.textContent = `Menganalisis teks: ${progress}%`;
    } else if (type === 'SUCCESS') {
        if (statusLabel) statusLabel.textContent = 'Pemindaian selesai!';
        if (pContainer) pContainer.classList.add('hidden');
        document.getElementById('ocr-shutter-controls')?.classList.add('hidden');

        const resultContainer = document.getElementById('ocr-result-container');
        if (resultContainer) {
            resultContainer.classList.remove('hidden');
            resultContainer.classList.add('flex');
        }

        const parsedTP = smartParseTP(rawText || '');
        const preview = document.getElementById('ocr-result-preview');
        const countBadge = document.getElementById('ocr-detected-count');
        if (preview) {
            preview.value = parsedTP.length ? parsedTP.join('\n\n') : (rawText || '').trim();
        }
        if (countBadge) {
            countBadge.textContent = `${parsedTP.length} TP Terdeteksi`;
        }
    } else if (type === 'ERROR') {
        if (pContainer) pContainer.classList.add('hidden');
        if (statusLabel) statusLabel.textContent = 'Gagal memproses gambar.';
        toast(`Error OCR: ${message || 'Gagal memindai.'}`, 'error');
    }
}

function smartParseTP(rawText) {
    const lines = String(rawText || '').split(/\r?\n/);
    const subjekRegex = /^(peserta didik|siswa|murid|anak)\s+(mampu|dapat|memahami|terampil|mempunyai)/i;
    const kkoRegex = /^(mengidentifikasi|menjelaskan|menganalisis|menyajikan|menerapkan|memahami|menghitung|mengevaluasi|mempraktikkan|membandingkan|mengklasifikasikan|menyimpulkan|merancang|membuat|mengembangkan|menentukan|mendeskripsikan|menemukan|menyelesaikan|membaca|menulis|menyimak|menceritakan|menunjukkan|membedakan)/i;

    const listHasilTP = [];
    let bufferTP = '';

    for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.length < 10) continue;

        const cleanWithoutBullet = cleanLine.replace(/^(\d+[\.\)]|[a-zA-Z][\.\)]|tp\s*\d*[:\.\-]?|[-•*])\s*/i, '').trim();
        const isMatch = subjekRegex.test(cleanWithoutBullet) || kkoRegex.test(cleanWithoutBullet);

        if (isMatch) {
            if (bufferTP.length > 0) listHasilTP.push(bufferTP);
            bufferTP = cleanWithoutBullet;
        } else if (bufferTP.length > 0) {
            if (!/^(bab|unit|semester|modul|kementerian|halaman|kurikulum|mata pelajaran|kelas|\d+$)/i.test(cleanLine)) {
                bufferTP += ` ${cleanLine}`;
            }
        }
    }

    if (bufferTP.length > 0) listHasilTP.push(bufferTP);
    return listHasilTP;
}

async function openSIMNILens() {
    const overlay = document.getElementById('simni-ocr-overlay');
    if (!overlay) return;

    closeModal('modal-kelola-tp');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    document.getElementById('ocr-result-container')?.classList.add('hidden');
    document.getElementById('ocr-progress-container')?.classList.add('hidden');
    document.getElementById('ocr-shutter-controls')?.classList.remove('hidden');

    const statusLabel = document.getElementById('ocr-status-label');
    if (statusLabel) statusLabel.textContent = 'Menghubungkan kamera...';
    lensRotationDegree = 0;

    const mapel = document.getElementById('input-tp-mapel')?.value || 'Matematika';
    const smt = document.getElementById('input-tp-smt')?.value || '1';
    const targetBabSelect = document.getElementById('ocr-target-bab-select');
    if (targetBabSelect) {
        targetBabSelect.replaceChildren();
        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '-- Tanpa Bab (Umum) --';
        targetBabSelect.appendChild(defOpt);
        for (let i = 1; i <= 10; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Bab ${i}`;
            targetBabSelect.appendChild(opt);
        }
        const currentInputBab = document.getElementById('input-tp-bab')?.value;
        if (currentInputBab) targetBabSelect.value = currentInputBab;
    }

    try {
        if (window.SIMNIPermissionService) {
            const status = await window.SIMNIPermissionService.request('camera', {
                rationale: 'SIMNI membutuhkan akses kamera untuk memindai dokumen Buku Paket via SIMNI Lens.'
            });
            if (status === 'permanently-denied' || status === 'denied') {
                throw new Error('Izin kamera ditolak oleh pengguna.');
            }
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Kamera tidak didukung pada browser ini.');
        }
        activeLensStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        const video = document.getElementById('ocr-video-feed');
        if (video) {
            video.srcObject = activeLensStream;
            await video.play().catch(() => {});
        }
        if (statusLabel) statusLabel.textContent = 'Arahkan ke butir TP di buku paket';
    } catch (err) {
        toast(`Kamera tidak dapat diakses: ${err.message || err}. Anda dapat memilih file foto dari tombol galeri.`, 'warning');
        if (statusLabel) statusLabel.textContent = 'Kamera tidak aktif. Gunakan tombol galeri di bawah.';
    }
}

function stopLensStream() {
    if (activeLensStream) {
        activeLensStream.getTracks().forEach((t) => t.stop());
        activeLensStream = null;
    }
}

function closeSIMNILens() {
    stopLensStream();
    const overlay = document.getElementById('simni-ocr-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
    document.getElementById('ocr-progress-container')?.classList.add('hidden');
    openModal('modal-kelola-tp');
}

function rotateLens90() {
    lensRotationDegree = (lensRotationDegree + 90) % 360;
    const label = document.getElementById('ocr-status-label');
    if (label) label.textContent = `Rotasi: ${lensRotationDegree}°`;
}

function restartLensCapture() {
    document.getElementById('ocr-result-container')?.classList.add('hidden');
    document.getElementById('ocr-shutter-controls')?.classList.remove('hidden');
    openSIMNILens();
}

async function captureLensFrameToRAM() {
    const video = document.getElementById('ocr-video-feed');
    if (!video || !video.videoWidth) {
        return toast('Video feed belum siap.', 'warning');
    }

    const pContainer = document.getElementById('ocr-progress-container');
    const pBar = document.getElementById('ocr-progress-bar');
    const pText = document.getElementById('ocr-progress-text');
    const statusLabel = document.getElementById('ocr-status-label');

    if (statusLabel) statusLabel.textContent = 'Membekukan frame teks ke RAM...';
    if (pContainer) pContainer.classList.remove('hidden');
    if (pBar) pBar.style.width = '10%';
    if (pText) pText.textContent = 'Mempersiapkan frame ke RAM...';

    let targetW = video.videoWidth;
    let targetH = video.videoHeight;
    const maxDimension = 1600;
    if (targetW > maxDimension || targetH > maxDimension) {
        if (targetW > targetH) {
            targetH = Math.round((targetH * maxDimension) / targetW);
            targetW = maxDimension;
        } else {
            targetW = Math.round((targetW * maxDimension) / targetH);
            targetH = maxDimension;
        }
    }

    let frameCanvas = document.createElement('canvas');
    frameCanvas.width = targetW;
    frameCanvas.height = targetH;
    const ctx = frameCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, targetW, targetH);

    stopLensStream();

    if (lensRotationDegree !== 0) {
        const rotCanvas = document.createElement('canvas');
        const rotCtx = rotCanvas.getContext('2d');
        if (lensRotationDegree === 90 || lensRotationDegree === 270) {
            rotCanvas.width = frameCanvas.height;
            rotCanvas.height = frameCanvas.width;
        } else {
            rotCanvas.width = frameCanvas.width;
            rotCanvas.height = frameCanvas.height;
        }
        rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        rotCtx.rotate((lensRotationDegree * Math.PI) / 180);
        rotCtx.drawImage(frameCanvas, -frameCanvas.width / 2, -frameCanvas.height / 2);
        frameCanvas.width = 0;
        frameCanvas.height = 0;
        frameCanvas = rotCanvas;
    }

    const worker = getActiveOCRWorker();
    const imageBitmap = await createImageBitmap(frameCanvas);
    frameCanvas.width = 0;
    frameCanvas.height = 0;

    worker.postMessage({ type: 'SCAN_IMAGE', imageBitmap }, [imageBitmap]);
}

async function handleLensGalleryFile(event) {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        if (input) input.value = '';
        return toast('Ukuran gambar tidak boleh melebihi 10 MB.', 'error');
    }

    if (!file.type || !file.type.startsWith('image/')) {
        if (input) input.value = '';
        return toast('File yang dipilih harus berupa gambar.', 'error');
    }

    const pContainer = document.getElementById('ocr-progress-container');
    const pBar = document.getElementById('ocr-progress-bar');
    const pText = document.getElementById('ocr-progress-text');
    const statusLabel = document.getElementById('ocr-status-label');

    stopLensStream();
    if (statusLabel) statusLabel.textContent = 'Membaca gambar dari galeri...';
    if (pContainer) pContainer.classList.remove('hidden');
    if (pBar) pBar.style.width = '10%';
    if (pText) pText.textContent = 'Memuat gambar...';

    try {
        const imageBitmap = await createImageBitmap(file);
        const worker = getActiveOCRWorker();
        worker.postMessage({ type: 'SCAN_IMAGE', imageBitmap }, [imageBitmap]);
    } catch (err) {
        toast(`Gagal membaca file gambar: ${err.message || err}`, 'error');
        if (pContainer) pContainer.classList.add('hidden');
    } finally {
        if (input) input.value = '';
    }
}

async function batchInsertScannedTP() {
    const preview = document.getElementById('ocr-result-preview');
    const rawText = String(preview?.value || '').trim();
    if (!rawText) return toast('Teks TP tidak boleh kosong.', 'warning');

    const targetBabSelect = document.getElementById('ocr-target-bab-select');
    const babVal = targetBabSelect?.value || '';
    const chapterNumber = babVal ? Number(babVal) : null;

    const mapel = document.getElementById('input-tp-mapel')?.value || 'Matematika';
    const semester = document.getElementById('input-tp-smt')?.value || '1';
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';

    const items = rawText.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t.length > 5);
    if (!items.length) return toast('Tidak ada butir TP valid yang terdeteksi.', 'warning');

    const prefix = mapel.substring(0, 3).toUpperCase();
    const existingMapelTPs = visibleLearningObjectives().filter((tp) => tp.mapel === mapel && String(tp.semester) === String(semester));
    let nextNum = existingMapelTPs.length + 1;

    const updates = {};
    const newItems = [];

    for (const desc of items) {
        const id = typeof crypto?.randomUUID === 'function' ? `tp_${crypto.randomUUID()}` : `tp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const code = `${prefix}.${nextNum}`;
        const payload = {
            ID_mapel: id,
            mapel,
            semester,
            kode_tp: code,
            deskripsi_tp: desc,
            kelas: currentKelas,
            chapterNumber: chapterNumber,
            created_at: new Date().toISOString()
        };
        updates[`Mapel_TP/${safeFirebaseKey(id, 'ID TP')}`] = payload;
        newItems.push(payload);
        nextNum++;
    }

    const result = await dbUpdate(updates);
    if (result?.ok) {
        state.mapelTP = state.mapelTP.concat(newItems);
        closeSIMNILens();
        updateTPListModal();
        updateTPDropdown(true);
        updateRekapTPDropdown();
        toast(`Berhasil menambahkan ${newItems.length} butir TP ke ${chapterNumber ? `Bab ${chapterNumber}` : 'daftar TP'}!`, 'success');
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

async function importTPExcel(event) {
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
            if (!['superuser', 'vip', 'teacher'].includes(userRole)) throw new Error('Role aktif tidak diizinkan melakukan impor TP.');
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
    const grid = document.getElementById('nilai-table-body');
    if (!resetSelection && grid?.dataset.draftScope === SIMNIFormDrafts.key('nilai-table-body', `${mapel}|${select.value}`) && SIMNIFormDrafts.dirty(grid)) return;
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
        option.textContent = `${resolveChapterNumber(tp) ? `Bab ${resolveChapterNumber(tp)} · ` : 'Tanpa Bab · '}${tp.kode_tp || ''} - ${String(tp.deskripsi_tp || '').substring(0, 70)}${status}`;
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
    if (!SIMNIFormDrafts.prepare(body, `${tp.mapel}|${selectedTpId}`)) return;

    const students = activeGradeStudents();
    if (!students.length) {
        body.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400 font-medium">Tidak ada data siswa untuk kelas ini.</td></tr>';
        return;
    }

    body.innerHTML = students
        .map((student, index) => {
            const grade = gradeForStudentTP(student, tp);
            const studentId = student.ID_Siswa || student.id_siswa || student.NISN || '';
            const nama = escapeHTML(student['Nama Lengkap'] || student.nama || student.Nama || 'Siswa');
            const nisn = escapeHTML(student.NISN || student.id_siswa || '');
            const baselineScore = academicScore(grade?.nilai) !== null ? escapeHTML(grade.nilai) : '';
            const recordId = grade?.ID_Nilai || '';
            return `<tr class="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors"><td class="p-4 text-xs font-bold text-slate-400">${index + 1}</td><td class="p-4 font-bold text-sm">${nama}<input type="hidden" class="n-nisn" data-student-id="${studentId}" value="${nisn}"><input type="hidden" class="n-nm" value="${nama}"></td><td class="p-4 text-center"><input data-baseline="${baselineScore}" data-record-id="${recordId}" data-draft-key="${studentId}:score" type="number" aria-label="Nilai ${nama}" min="0" max="100" class="n-scr w-20 p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-black text-center rounded-lg font-bold focus:ring-2 focus:ring-primary focus:outline-none" value="${baselineScore}"></td></tr>`;
        }).join('');
    SIMNIFormDrafts.restore(body);
}

async function saveNilaiBatch() {
    const selectedTpId = document.getElementById('filter-tp-nilai')?.value;
    const tp = getTPById(selectedTpId);
    if (!tp) return toast('Pilih TP terlebih dahulu.', 'warning');
    if (!gradeSubjectAllowed(tp.mapel)) return toast('Role ini hanya diizinkan menyimpan nilai PJOK.', 'error');

    let token;
    const body = document.getElementById('nilai-table-body');
    try {
        const updates = {};
        const committed = [];
        for (const row of document.querySelectorAll('#nilai-table-body tr')) {
            const scoreRaw = row.querySelector('.n-scr')?.value;
            if (scoreRaw === '') continue;
            const nisn = row.querySelector('.n-nisn')?.value;
            if (!/^\d{10}$/.test(academicNisn(nisn))) throw new Error(`NISN ${nisn} harus tepat 10 digit.`);
            const studentId = row.querySelector('.n-nisn')?.dataset.studentId || nisn;
            const student = { ID_Siswa: studentId, NISN: nisn };
            const id = gradeIdFor(student, tp);
            const studentKeys = new Set([studentId, nisn].filter(Boolean).map(String));
            const existingList = state.nilaiTP.filter((item) => {
                const itemKey = String(item?.ID_Siswa || item?.NISN || '');
                return studentKeys.has(itemKey) && gradeMatchesTP(item, tp);
            });
            const score = academicScore(scoreRaw);
            if (score === null) throw new Error(`Nilai ${nisn} harus 0-100.`);
            const payload = {
                ID_Nilai: id,
                ID_Siswa: studentId,
                NISN: nisn,
                nama: row.querySelector('.n-nm')?.value || '',
                learningObjectiveId: String(tpId(tp)).replace(/[.#$\[\]\/]/g, '_'),
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
                if (existing?.ID_Nilai && existing.ID_Nilai !== id) {
                    const cleanOldKey = safeFirebaseKey(String(existing.ID_Nilai).replace(/[.#$\[\]\/]/g, '_'), 'ID nilai lama');
                    updates[`Nilai_TP/${cleanOldKey}`] = null;
                }
            });
        }
        if (!Object.keys(updates).length) return toast('Isi sedikitnya satu nilai sebelum menyimpan.', 'warning');
        token = SIMNIFormDrafts.begin(body);
        const result = await dbUpdate(updates);
        if (!result?.ok) throw result?.error || new Error('Nilai gagal disimpan.');
        SIMNIFormDrafts.finish(token, true);
        if (!SIMNIFormDrafts.sameSession(token)) return;
        const committedIds = new Set(committed.map((item) => item.ID_Nilai));
        const committedPairs = new Set(committed.map((item) => `${item.ID_Siswa}|${item.learningObjectiveId}`));
        state.nilaiTP = state.nilaiTP.filter((item) => {
            const pair = `${item.ID_Siswa || item.NISN}|${item.learningObjectiveId || ''}`;
            return !Object.hasOwn(updates, `Nilai_TP/${item.ID_Nilai}`) && !committedIds.has(item.ID_Nilai) && !committedPairs.has(pair);
        }).concat(committed);
        notifyCommittedSave(() => {
            if (SIMNIFormDrafts.isCurrent(body, token) && !SIMNIFormDrafts.dirty(body)) updateTPDropdown(true);
            updateRekapTPDropdown(); renderBukuInduk();
        });
    } catch (error) {
        toast(error.message || String(error), 'error');
    } finally {
        SIMNIFormDrafts.finish(token);
    }
}

let rekapSelection = null;
function invalidateRekapNilai() {
    rekapSelection = null;
    editingGradeId = '';
    const result = document.getElementById('rekap-nilai-result');
    if (result) result.hidden = true;
    const hint = document.getElementById('rekap-nilai-hint');
    if (hint) hint.hidden = false;
}
function showRekapNilai() {
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    const id = document.getElementById('rekap-tp-nilai')?.value;
    if (!mapel || !id) return toast('Pilih mata pelajaran dan TP terlebih dahulu.', 'warning');
    rekapSelection = { mapel, id, nisn: document.getElementById('rekap-siswa-nilai')?.value || '', session: academicSessionKey() };
    editingGradeId = '';
    renderRekapNilai();
}
function updateRekapTPDropdown() {
    const select = document.getElementById('rekap-tp-nilai');
    if (!select) return;
    applyGradeSubjectPolicy();
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    const previous = select.value;
    const candidates = visibleLearningObjectives().filter(tp => mapel && tp.mapel === mapel);
    select.innerHTML = '<option value="">' + (mapel ? 'Pilih TP...' : 'Pilih Mapel Dahulu...') + '</option>' + candidates.map(tp => `<option value="${escapeHTML(tpId(tp))}">${escapeHTML(tp.kode_tp)} · Smt.${escapeHTML(tp.semester)} · ${escapeHTML(tp.deskripsi_tp || '')}</option>`).join('');
    select.disabled = !mapel;
    if (candidates.some(tp => tpId(tp) === previous)) select.value = previous;
    invalidateRekapNilai();
}

function renderRekapNilai() {
    if (!rekapSelection || rekapSelection.session !== academicSessionKey()) { invalidateRekapNilai(); return; }
    const { mapel, id: selectedTpId, nisn } = rekapSelection;
    const selectedTP = visibleLearningObjectives().find(tp => tpId(tp) === selectedTpId && tp.mapel === mapel);
    if (!selectedTP) { invalidateRekapNilai(); return; }
    document.getElementById('rekap-nilai-result').hidden = false;
    document.getElementById('rekap-nilai-hint').hidden = true;
    document.getElementById('rekap-tp-title').textContent = `${selectedTP.mapel} · ${selectedTP.kode_tp} · Semester ${selectedTP.semester}`;
    document.getElementById('rekap-tp-description').textContent = selectedTP.deskripsi_tp || 'Deskripsi TP belum tersedia.';
    const body = document.getElementById('rekap-nilai-body');
    if (!body) return;
    if (body.querySelector('.edit-grade-score') && body.dataset.editScope === SIMNIFormDrafts.key('rekap', editingGradeId)) return;

    let targetTPs = mapel ? visibleLearningObjectives().filter((tp) => tp.mapel === mapel) : visibleLearningObjectives();
    if (selectedTpId) targetTPs = targetTPs.filter((tp) => tpId(tp) === selectedTpId);
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    let filteredStudents = state.students;
    if (currentKelas) filteredStudents = filteredStudents.filter(s => s.Kelas === currentKelas);
    const students = nisn ? filteredStudents.filter((student) => String(student.NISN) === nisn) : filteredStudents;
    const rows = [];

    [...students].sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || '')).forEach((student) => {
        targetTPs.forEach((tp) => {
            const grade = gradeForStudentTP(student, tp);

            const gradeId = grade?.ID_Nilai || gradeIdFor(student, tp);
            const editing = editingGradeId === gradeId;
            rows.push(`<tr data-grade-id="${escapeHTML(gradeId)}" data-student-id="${escapeHTML(student.ID_Siswa || student.NISN)}" data-tp-id="${escapeHTML(tpId(tp))}"><td>${escapeHTML(student['Nama Lengkap'])}</td><td>${editing ? `<input aria-label="Nilai ${escapeHTML(student['Nama Lengkap'])}" type="number" min="0" max="100" value="${escapeHTML(grade?.nilai ?? '')}" class="edit-grade-score">` : escapeHTML(grade?.nilai ?? '—')}</td><td>${editing ? '<button type="button" class="save-grade-edit">Simpan</button><button type="button" class="cancel-grade-edit">Batal</button>' : `<button type="button" class="start-grade-edit">${grade ? 'Edit' : 'Isi'} nilai</button>`}</td></tr>`);
        });
    });

    body.innerHTML = rows.join('') || '<tr><td colspan="3" class="p-8 text-center text-slate-400">Tidak ada siswa sesuai filter.</td></tr>';
    body.dataset.editScope = SIMNIFormDrafts.key('rekap', editingGradeId);
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
    if (row?.dataset.saving === 'true') return;
    const session = academicSessionKey();
    try {
        row.dataset.saving = 'true';
        const gradeId = row?.dataset.gradeId || '';
        const tp = getTPById(row?.dataset.tpId || '');
        const studentId = row?.dataset.studentId || '';
        const existing = state.nilaiTP.find((item) => {
            const sameStudent = String(item.ID_Siswa || item.NISN || '') === studentId;
            return item.ID_Nilai === gradeId && sameStudent && tp && gradeMatchesTP(item, tp);
        });
        if (!tp || !gradeSubjectAllowed(tp.mapel)) throw new Error('TP tidak tersedia untuk akun ini.');
        const student = state.students.find(item => String(item.ID_Siswa || item.NISN) === studentId && (!state.activeKelas || item.Kelas === state.activeKelas));
        if (!student) throw new Error('Siswa tidak tersedia di kelas aktif.');
        if (!existing && !/^\d{10}$/.test(academicNisn(student.NISN))) throw new Error('NISN siswa harus tepat 10 digit.');
        const score = academicScore(row.querySelector('.edit-grade-score')?.value);
        if (score === null) throw new Error('Nilai harus berada pada rentang 0-100 dan tidak boleh kosong.');
        const cleanGradeKey = safeFirebaseKey(String(gradeId).replace(/[.#$\[\]\/]/g, '_'), 'ID nilai');
        const payload = { ...(existing || {
            ID_Siswa: studentId, NISN: student.NISN, nama: student['Nama Lengkap'],
            learningObjectiveId: String(tpId(tp)).replace(/[.#$\[\]\/]/g, '_'),
            mapel: tp.mapel, semester: String(tp.semester), kode_tp: tp.kode_tp, Deskripsi_TP: tp.kode_tp,
            tanggal: getJakartaDateString(), Kelas: student.Kelas || state.activeKelas || ''
        }), ID_Nilai: cleanGradeKey, nilai: score, tanggal_diperbarui: getJakartaDateString() };
        const result = await dbSet(`Nilai_TP/${cleanGradeKey}`, payload);
        if (!result?.ok) throw result?.error || new Error('Perubahan nilai gagal disimpan.');
        if (session !== academicSessionKey()) return;
        state.nilaiTP = state.nilaiTP.filter((item) => item !== existing && item.ID_Nilai !== gradeId && item.ID_Nilai !== cleanGradeKey).concat(payload);
        editingGradeId = '';
        notifyCommittedSave(() => { renderRekapNilai(); updateTPDropdown(); renderBukuInduk(); });
    } catch (error) {
        toast(error.message || String(error), 'error');
    } finally {
        if (row) row.dataset.saving = 'false';
    }
}

function populateIndukDropdown() {
    const el = document.getElementById('induk-siswa-select');
    if (!el) return;
    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');
    let filteredStudents = Array.isArray(state?.students) ? state.students : [];
    if (currentKelas) {
        filteredStudents = filteredStudents.filter(s => {
            const sk = normalize(s.Kelas);
            return !sk || sk === currentKelas;
        });
    }
    const sortedStudents = [...filteredStudents].sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));
    const currentVal = el.value;
    const fragment = document.createDocumentFragment();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '-- Sentuh untuk Pilih Siswa --';
    fragment.appendChild(empty);
    sortedStudents.forEach((student) => {
        const nisn = String(student.NISN || '').trim();
        if (!/^\d{10}$/.test(nisn)) return;
        const option = document.createElement('option');
        option.value = nisn;
        option.textContent = String(student['Nama Lengkap'] || '');
        fragment.appendChild(option);
    });
    el.replaceChildren(fragment);
    if (currentVal) el.value = currentVal;
}

function renderBukuInduk() {
    const select = document.getElementById('induk-siswa-select');
    if (select && select.options.length <= 1 && Array.isArray(state?.students) && state.students.length > 0) {
        populateIndukDropdown();
    }
    const nisn = select?.value;
    const container = document.getElementById('induk-content-area');
    if (!container) return;
    if (!nisn) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400 absolute inset-0 flex flex-col items-center justify-center"><i class="fas fa-user-graduate text-6xl opacity-50 mb-4"></i><p class="font-bold">Pilih Siswa Terlebih Dahulu</p></div>';
        return;
    }

    const student = state.students.find((item) => String(item.NISN || '').trim() === String(nisn).trim());
    if (!student) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400 absolute inset-0 flex flex-col items-center justify-center"><i class="fas fa-user-slash text-6xl opacity-50 mb-4"></i><p class="font-bold">Data siswa tidak ditemukan.</p></div>';
        return;
    }
    const attendance = state.presensi.filter((item) => String(item.NISN || '').trim() === String(nisn).trim());
    const count = (status) => attendance.filter((item) => String(item.Status || '').toUpperCase() === status).length;
    const rows = [];

    const mapelList = [...new Set(visibleLearningObjectives().map((tp) => tp.mapel).filter(Boolean))];
    mapelList.forEach((mapel) => {
        const objectives = visibleLearningObjectives().filter((tp) => tp.mapel === mapel);
        const grades = objectives.map((tp) => ({ tp, grade: gradeForStudentTP(student, tp) })).filter((item) => academicScore(item.grade?.nilai) !== null);
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
    const nisn = document.getElementById('induk-siswa-select')?.value;
    if (!nisn) return toast('Pilih siswa terlebih dahulu untuk mengunduh Buku Induk.', 'warning');
    await window.ensureSIMNIVendors?.("pdf");
    const content = document.getElementById('cetak-induk-area');
    if (!content) return toast('Data profil induk tidak ditemukan!', 'error');
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    const student = state.students.find((item) => String(item.NISN || '').trim() === String(nisn).trim());
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

async function unduhRekapNilai() {
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    if (!mapel) return toast('Pilih mata pelajaran terlebih dahulu.', 'warning');

    await window.ensureSIMNIVendors?.("xlsx");
    if (!window.XLSX?.utils) return toast('Pustaka Excel belum siap. Muat ulang saat online.', 'error');

    const selectedTpId = document.getElementById('rekap-tp-nilai')?.value;
    const filterNisn = document.getElementById('rekap-siswa-nilai')?.value;
    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');

    let targetTPs = visibleLearningObjectives().filter(tp => tp.mapel === mapel);
    if (selectedTpId) targetTPs = targetTPs.filter(tp => tpId(tp) === selectedTpId);
    if (!targetTPs.length) return toast('Tidak ada TP untuk mata pelajaran yang dipilih.', 'warning');

    let students = (state.students || []).filter(s => {
        const k = normalize(s.Kelas);
        return !currentKelas || !k || k === currentKelas;
    });
    if (filterNisn) students = students.filter(s => String(s.NISN || '').trim() === filterNisn);
    students.sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));

    if (!students.length) return toast('Tidak ada data siswa untuk diunduh.', 'warning');

    showLoad('Menyusun file Rekap Nilai Excel...');
    try {
        const rows = [];
        let no = 1;
        students.forEach(student => {
            targetTPs.forEach(tp => {
                const grade = gradeForStudentTP(student, tp);
                const score = (grade && academicScore(grade.nilai) !== null) ? Number(grade.nilai) : '';
                rows.push({
                    'No': no++,
                    'NISN': String(student.NISN || ''),
                    'Nama Siswa': student['Nama Lengkap'] || '',
                    'Kelas': student.Kelas || currentKelas || '',
                    'Mata Pelajaran': tp.mapel || mapel,
                    'Semester': tp.semester || '',
                    'Kode TP': tp.kode_tp || '',
                    'Deskripsi TP': tp.deskripsi_tp || '',
                    'Nilai': score,
                    'Status': score === '' ? 'Belum Dinilai' : (score >= 75 ? 'Tuntas' : 'Perlu Bimbingan')
                });
            });
        });

        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(rows);
        const safeSheetName = `${mapel.slice(0, 25)}`.replace(/[:\\/?*[\]]/g, '_');
        XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName);

        const activeTP = selectedTpId ? targetTPs[0] : null;
        const tpSuffix = activeTP ? `_${activeTP.kode_tp}` : '_Semua_TP';
        const filename = `Rekap_Nilai_${safeFilename(mapel)}${safeFilename(tpSuffix)}_${safeFilename(currentKelas || 'Kelas')}.xlsx`;

        XLSX.writeFile(workbook, filename);
        toast('Rekap nilai berhasil diunduh.', 'success');
    } catch (err) {
        console.error(err);
        toast(`Gagal mengunduh rekap nilai: ${err.message || err}`, 'error');
    } finally {
        hideLoad();
    }
}

async function exportTPExcel() {
    await window.ensureSIMNIVendors?.("xlsx");
    if (!window.XLSX?.utils) return toast('Pustaka Excel belum siap. Muat ulang saat online.', 'error');

    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');
    const tps = visibleLearningObjectives().sort((a, b) => 
        (a.mapel || '').localeCompare(b.mapel || '') || 
        Number(a.bab || 0) - Number(b.bab || 0) || 
        (a.kode_tp || '').localeCompare(b.kode_tp || '')
    );

    if (!tps.length) return toast('Tidak ada Tujuan Pembelajaran untuk diekspor.', 'warning');

    showLoad('Menyiapkan file Excel TP...');
    try {
        const rows = tps.map((tp, idx) => ({
            'No': idx + 1,
            'Mata Pelajaran': tp.mapel || '',
            'Bab / Unit': tp.bab ? `Bab ${tp.bab}` : 'Umum',
            'Kode TP': tp.kode_tp || '',
            'Semester': tp.semester || '',
            'Deskripsi Tujuan Pembelajaran': tp.deskripsi_tp || '',
            'Kelas': tp.kelas || currentKelas || ''
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 6 },   // No
            { wch: 22 },  // Mapel
            { wch: 12 },  // Bab
            { wch: 14 },  // Kode
            { wch: 10 },  // Semester
            { wch: 50 },  // Deskripsi
            { wch: 8 }    // Kelas
        ];

        const wb = XLSX.utils.book_new();
        const sheetName = currentKelas ? `TP_Kelas_${currentKelas}` : 'Daftar_TP';
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const filename = `Daftar_TP_${safeFilename(currentKelas || 'Semua')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        toast(`Berhasil mengekspor ${tps.length} butir TP.`, 'success');
    } catch (err) {
        console.error(err);
        toast(`Gagal mengekspor TP: ${err.message || err}`, 'error');
    } finally {
        hideLoad();
    }
}

function previewPrintTP() {
    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');
    const tps = visibleLearningObjectives().sort((a, b) => 
        (a.mapel || '').localeCompare(b.mapel || '') || 
        Number(a.bab || 0) - Number(b.bab || 0) || 
        (a.kode_tp || '').localeCompare(b.kode_tp || '')
    );

    if (!tps.length) return toast('Tidak ada data Tujuan Pembelajaran untuk dicetak.', 'warning');

    const area = document.getElementById('area-preview-cetak-tp');
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
    const namaGuru = escapeHTML(state?.pengaturan?.nama_wali_kelas || state?.pengaturan?.nama_guru || state?.user?.displayName || 'Guru Mata Pelajaran');
    const nuptkGuru = escapeHTML(state?.pengaturan?.nuptk_wali_kelas || state?.pengaturan?.nuptk_guru || state?.pengaturan?.nip_guru || '-');
    const namaKamad = escapeHTML(state?.pengaturan?.nama_kepala_sekolah || state?.pengaturan?.nama_kamad || 'Kepala SDIT Bina Muda');
    const nuksKamad = escapeHTML(state?.pengaturan?.nuks_kepala_sekolah || state?.pengaturan?.nuks_kamad || state?.pengaturan?.nip_kamad || '-');
    const tglCetak = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    const rowsHtml = tps.map((tp, idx) => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; font-weight: bold;">${escapeHTML(tp.mapel || '')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">${escapeHTML(tp.kode_tp || '')}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${tp.bab ? `Bab ${escapeHTML(String(tp.bab))}` : '-'}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${escapeHTML(String(tp.semester || ''))}</td>
            <td style="border: 1px solid #333; padding: 6px 8px; text-align: left; line-height: 1.4;">${escapeHTML(tp.deskripsi_tp || '')}</td>
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
                <h3 style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">DAFTAR TUJUAN PEMBELAJARAN (TP)</h3>
                <p style="font-size: 10pt; font-weight: bold; margin: 4px 0 0 0;">Kelas ${namaKelas} — Tahun Pelajaran ${tahunPelajaran} (Semester ${semester})</p>
            </div>

            <!-- TABEL TP -->
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #f1f5f9; font-weight: bold; text-transform: uppercase;">
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 35px; text-align: center;">No</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; width: 140px; text-align: left;">Mata Pelajaran</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 90px; text-align: center;">Kode TP</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 60px; text-align: center;">Bab</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 45px; text-align: center;">Smt</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; text-align: left;">Deskripsi Tujuan Pembelajaran</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- TANDA TANGAN -->
            <div style="display: flex; justify-content: space-between; page-break-inside: avoid; margin-top: 30px; font-size: 10pt;">
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">Mengetahui,</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Kepala SDIT Bina Muda</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaKamad}</p>
                    <p style="margin: 0; font-size: 9pt;">NUKS. ${nuksKamad}</p>
                </div>
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">${kotaSekolah}, ${tglCetak}</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Guru Pengampu / Wali Kelas</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaGuru}</p>
                    <p style="margin: 0; font-size: 9pt;">NUPTK. ${nuptkGuru}</p>
                </div>
            </div>
        </div>
    `;

    openModal('modal-preview-cetak-tp');
}

async function executePrintTPPreview() {
    await window.ensureSIMNIVendors?.("pdf");
    const container = document.getElementById('area-preview-cetak-tp');
    if (!container) return;

    if (typeof html2pdf === 'function') {
        showLoad('Membuat dokumen PDF TP...');
        const currentKelas = normalizeClassLabel(state?.activeKelas) || 'Semua';
        const dateStr = new Date().toISOString().slice(0, 10);
        try {
            await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `Daftar_TP_${currentKelas}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(container).save();
            toast('Dokumen PDF TP berhasil disimpan.', 'success');
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

function previewPrintRekapNilai() {
    const mapel = document.getElementById('rekap-mapel-nilai')?.value;
    if (!mapel) return toast('Pilih mata pelajaran terlebih dahulu.', 'warning');

    const selectedTpId = document.getElementById('rekap-tp-nilai')?.value;
    const filterNisn = document.getElementById('rekap-siswa-nilai')?.value;
    const normalize = typeof normalizeClassLabel === 'function' ? normalizeClassLabel : (v) => String(v || '').trim();
    const currentKelas = normalize(typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '');

    let targetTPs = visibleLearningObjectives().filter(tp => tp.mapel === mapel);
    if (selectedTpId) targetTPs = targetTPs.filter(tp => tpId(tp) === selectedTpId);
    if (!targetTPs.length) return toast('Tidak ada TP untuk mata pelajaran yang dipilih.', 'warning');

    let students = (state.students || []).filter(s => {
        const k = normalize(s.Kelas);
        return !currentKelas || !k || k === currentKelas;
    });
    if (filterNisn) students = students.filter(s => String(s.NISN || '').trim() === filterNisn);
    students.sort((a, b) => (a['Nama Lengkap'] || '').localeCompare(b['Nama Lengkap'] || ''));

    if (!students.length) return toast('Tidak ada data siswa untuk dicetak.', 'warning');

    const area = document.getElementById('area-preview-cetak-rekap-nilai');
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
    const namaGuru = escapeHTML(state?.pengaturan?.nama_wali_kelas || state?.pengaturan?.nama_guru || state?.user?.displayName || 'Guru Pengampu');
    const nuptkGuru = escapeHTML(state?.pengaturan?.nuptk_wali_kelas || state?.pengaturan?.nuptk_guru || state?.pengaturan?.nip_guru || '-');
    const namaKamad = escapeHTML(state?.pengaturan?.nama_kepala_sekolah || state?.pengaturan?.nama_kamad || 'Kepala SDIT Bina Muda');
    const nuksKamad = escapeHTML(state?.pengaturan?.nuks_kepala_sekolah || state?.pengaturan?.nuks_kamad || state?.pengaturan?.nip_kamad || '-');
    const tglCetak = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    const activeTP = selectedTpId ? targetTPs[0] : null;
    const tpSubtitle = activeTP ? `Kode TP: ${escapeHTML(activeTP.kode_tp || '')} - ${escapeHTML(activeTP.deskripsi_tp || '')}` : 'Semua Tujuan Pembelajaran';

    // Statistik nilai
    const scores = [];
    let rowsHtml = '';
    let no = 1;

    students.forEach((student) => {
        targetTPs.forEach((tp) => {
            const grade = gradeForStudentTP(student, tp);
            const score = (grade && academicScore(grade.nilai) !== null) ? Number(grade.nilai) : null;
            if (score !== null) scores.push(score);

            const scoreDisplay = score !== null ? score : '-';
            const statusDisplay = score === null ? 'Belum Dinilai' : (score >= 75 ? '<span style="color:#059669; font-weight:bold;">Tuntas</span>' : '<span style="color:#d97706; font-weight:bold;">Perlu Bimbingan</span>');

            rowsHtml += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${no++}</td>
                    <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-family: monospace;">${escapeHTML(String(student.NISN || '-'))}</td>
                    <td style="border: 1px solid #333; padding: 6px 8px; font-weight: bold;">${escapeHTML(student['Nama Lengkap'] || '')}</td>
                    <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${escapeHTML(tp.kode_tp || '')}</td>
                    <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-weight: bold; font-size: 11pt;">${scoreDisplay}</td>
                    <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${statusDisplay}</td>
                </tr>
            `;
        });
    });

    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
    const maxScore = scores.length ? Math.max(...scores) : '-';
    const minScore = scores.length ? Math.min(...scores) : '-';

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

            <!-- JUDUL REKAP -->
            <div style="text-align: center; margin-bottom: 14px;">
                <h3 style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">REKAPITULASI NILAI AKADEMIK</h3>
                <p style="font-size: 10.5pt; font-weight: bold; margin: 4px 0 0 0;">Mata Pelajaran: ${escapeHTML(mapel)} | Kelas: ${namaKelas}</p>
                <p style="font-size: 9.5pt; margin: 2px 0 0 0; color: #333;">${tpSubtitle}</p>
                <p style="font-size: 9pt; font-weight: bold; margin: 2px 0 0 0;">Tahun Pelajaran ${tahunPelajaran} (Semester ${semester})</p>
            </div>

            <!-- STATISTIK RINGKAS -->
            <div style="display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 16px; border-radius: 6px; font-size: 9.5pt;">
                <div>Total Siswa: <strong>${students.length}</strong></div>
                <div>Sudah Dinilai: <strong>${scores.length}</strong></div>
                <div>Rata-rata: <strong>${avgScore}</strong></div>
                <div>Tertinggi: <strong>${maxScore}</strong></div>
                <div>Terendah: <strong>${minScore}</strong></div>
            </div>

            <!-- TABEL NILAI -->
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #f1f5f9; font-weight: bold; text-transform: uppercase;">
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 35px; text-align: center;">No</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 110px; text-align: center;">NISN</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; text-align: left;">Nama Lengkap Siswa</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 80px; text-align: center;">Kode TP</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 70px; text-align: center;">Nilai</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; width: 120px; text-align: center;">Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- TANDA TANGAN -->
            <div style="display: flex; justify-content: space-between; page-break-inside: avoid; margin-top: 30px; font-size: 10pt;">
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">Mengetahui,</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Kepala SDIT Bina Muda</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaKamad}</p>
                    <p style="margin: 0; font-size: 9pt;">NUKS. ${nuksKamad}</p>
                </div>
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">${kotaSekolah}, ${tglCetak}</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Guru Mata Pelajaran</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaGuru}</p>
                    <p style="margin: 0; font-size: 9pt;">NUPTK. ${nuptkGuru}</p>
                </div>
            </div>
        </div>
    `;

    openModal('modal-preview-cetak-rekap-nilai');
}

async function executePrintRekapNilaiPreview() {
    await window.ensureSIMNIVendors?.("pdf");
    const container = document.getElementById('area-preview-cetak-rekap-nilai');
    if (!container) return;

    if (typeof html2pdf === 'function') {
        showLoad('Membuat dokumen PDF Rekap Nilai...');
        const mapel = document.getElementById('rekap-mapel-nilai')?.value || 'Nilai';
        const currentKelas = normalizeClassLabel(state?.activeKelas) || 'Semua';
        const dateStr = new Date().toISOString().slice(0, 10);
        try {
            await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `Rekap_Nilai_${safeFilename(mapel)}_${currentKelas}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(container).save();
            toast('Dokumen PDF Rekap Nilai berhasil disimpan.', 'success');
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
    window.openEditTPModal = openEditTPModal;
    window.submitEditTP = submitEditTP;
    window.deleteTPEditModal = deleteTPEditModal;
    window.openSIMNILens = openSIMNILens;
    window.closeSIMNILens = closeSIMNILens;
    window.rotateLens90 = rotateLens90;
    window.restartLensCapture = restartLensCapture;
    window.captureLensFrameToRAM = captureLensFrameToRAM;
    window.handleLensGalleryFile = handleLensGalleryFile;
    window.batchInsertScannedTP = batchInsertScannedTP;
    window.smartParseTP = smartParseTP;
    window.updateTPListModal = updateTPListModal;
    window.submitTP = submitTP;
    window.hapusTP = hapusTP;
    window.saveNilaiBatch = saveNilaiBatch;
    window.updateTPDropdown = updateTPDropdown;
    window.renderNilaiGrid = renderNilaiGrid;
    window.renderNilaiTPControls = renderNilaiTPControls;
    window.setNilaiTab = setNilaiTab;
    window.showRekapNilai = showRekapNilai;
    window.unduhRekapNilai = unduhRekapNilai;
    window.invalidateRekapNilai = invalidateRekapNilai;
    window.populateIndukDropdown = populateIndukDropdown;
    window.renderBukuInduk = renderBukuInduk;
    window.cetakBukuInduk = cetakBukuInduk;
    window.exportTPExcel = exportTPExcel;
    window.previewPrintTP = previewPrintTP;
    window.executePrintTPPreview = executePrintTPPreview;
    window.previewPrintRekapNilai = previewPrintRekapNilai;
    window.executePrintRekapNilaiPreview = executePrintRekapNilaiPreview;
}
