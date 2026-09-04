import GADM_ENGINE from './gadm-engine.js';
import {
    createGADMScope,
    loadGADMDraft,
    saveGADMDraft,
    saveGADMDocument,
    listGADMDocuments,
    getGADMDocument,
    deleteGADMDocument
} from './gadm-storage.js';

const ALLOWED_ROLES = new Set(['superuser', 'vip']);
let activeScope = null;
let lifecycleController = null;
let mountPromise = null;
let activeCurriculumSuggestion = null;
let activeLearningObjectiveSuggestion = null;

function cleanText(value) {
    return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function safeFilename(value) {
    const normalized = cleanText(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.+$/g, '');
    return normalized.slice(0, 120) || 'Dokumen-GADM';
}

function notify(message, type = 'info') {
    if (typeof window.toast === 'function') window.toast(cleanText(message), type);
}

function currentContext() {
    const context = window.SIMNICurrentAccess;
    if (!context || context.status !== 'active' || !ALLOWED_ROLES.has(context.role)) {
        throw new Error('Sesi Superuser atau VIP diperlukan untuk mengakses GADM.');
    }
    if (window.SIMNIAccess?.canAccess?.('gadm') !== true) {
        throw new Error('Role aktif tidak memiliki izin GADM.');
    }
    return context;
}

function currentClass(context) {
    const value = context.role === 'vip'
        ? (window.getSIMNIActiveClass?.() || window.state?.activeKelas || '')
        : context.classId;
    const match = cleanText(value).match(/^([1-6])/);
    if (!match) throw new Error('Kelas aktif GADM tidak valid.');
    return match[1];
}

function scopeForContext(context) {
    const scopedClassId = context.role === 'vip'
        ? cleanText(window.getSIMNIActiveClass?.() || window.state?.activeKelas)
        : cleanText(context.classId);
    return createGADMScope({ ...context, scopedClassId });
}

function canonicalIdentity(context) {
    const settings = window.state?.pengaturan || {};
    const configuredTeacher = cleanText(settings.nama_wali_kelas);
    const displayName = cleanText(context.displayName);
    const teacher = configuredTeacher || (!displayName.includes('@') ? displayName : '');
    return Object.freeze({
        school: cleanText(settings.nama_sekolah || settings.nama_aplikasi || 'SIMNI'),
        teacher,
        grade: currentClass(context),
        academicYear: cleanText(context.activeAcademicYearId).replace('-', '/')
    });
}

function normalizeInput(input) {
    const context = currentContext();
    const scope = scopeForContext(context);
    if (!activeScope || activeScope.key !== scope.key) {
        throw new Error('Scope GADM berubah. Muat ulang ruang kerja GADM.');
    }
    const source = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
    const identity = canonicalIdentity(context);
    const subject = context.role === 'vip' ? 'PJOK' : cleanText(source.mataPelajaran);
    if (subject && window.SIMNIAccessPolicy?.allowedSubject(context.role, subject) !== true) {
        throw new Error('Mata pelajaran tidak diizinkan untuk role aktif.');
    }
    return {
        ...source,
        namaSekolah: identity.school,
        namaGuru: cleanText(source.namaGuru) || identity.teacher,
        kelasAtauFase: identity.grade,
        mataPelajaran: subject,
        tahunPelajaran: identity.academicYear
    };
}

function lockCanonicalFields() {
    const context = currentContext();
    const identity = canonicalIdentity(context);
    const lockedFields = [
        ['gadm-nama-sekolah', identity.school],
        ['gadm-kelas-fase', identity.grade],
        ['gadm-tahun-pelajaran', identity.academicYear]
    ];
    if (context.role === 'vip') lockedFields.push(['gadm-mata-pelajaran', 'PJOK']);
    const subjectField = document.getElementById('gadm-mata-pelajaran');
    if (subjectField && context.role !== 'vip') {
        subjectField.disabled = false;
        subjectField.removeAttribute('aria-disabled');
        subjectField.removeAttribute('title');
    }
    const teacherField = document.getElementById('gadm-nama-guru');
    if (teacherField) {
        if (!cleanText(teacherField.value) || cleanText(teacherField.value).includes('@')) {
            teacherField.value = identity.teacher;
        }
        teacherField.disabled = false;
        teacherField.removeAttribute('aria-disabled');
        teacherField.removeAttribute('title');
    }
    for (const [id, value] of lockedFields) {
        const element = document.getElementById(id);
        if (!element) continue;
        element.value = value;
        element.disabled = true;
        element.setAttribute('aria-disabled', 'true');
        element.title = 'Nilai ini mengikuti identitas dan scope SIMNI aktif.';
    }
}

function curriculumContext() {
    const documentType = cleanText(document.getElementById('gadm-document-type')?.value);
    const topicField = documentType === 'silabus' ? 'gadm-materi-lingkup' : 'gadm-materi-unit';
    return {
        kelasAtauFase: cleanText(document.getElementById('gadm-kelas-fase')?.value),
        mataPelajaran: cleanText(document.getElementById('gadm-mata-pelajaran')?.value),
        materiAtauUnit: cleanText(document.getElementById(topicField)?.value)
    };
}

function updateCurriculumSuggestion() {
    const card = document.getElementById('gadm-curriculum-suggestion');
    const badge = document.getElementById('gadm-curriculum-badge');
    const status = document.getElementById('gadm-curriculum-status');
    const cpElement = document.getElementById('gadm-cp-suggestion');
    const sourceElement = document.getElementById('gadm-cp-source');
    const tpWrap = document.getElementById('gadm-tp-suggestion-wrap');
    const tpElement = document.getElementById('gadm-tp-suggestion');
    const useCp = document.getElementById('gadm-use-cp');
    const useTp = document.getElementById('gadm-use-tp');
    if (!card || !badge || !status || !cpElement || !sourceElement || !tpWrap || !tpElement || !useCp || !useTp) return;

    const context = curriculumContext();
    activeCurriculumSuggestion = GADM_ENGINE.recommendOfficialCp(context);
    activeLearningObjectiveSuggestion = GADM_ENGINE.suggestLearningObjective(context);
    const cpReady = activeCurriculumSuggestion?.ok === true;
    const tpReady = activeLearningObjectiveSuggestion?.ok === true;

    card.dataset.state = cpReady ? 'ready' : 'manual';
    badge.textContent = cpReady ? 'CP resmi tersedia' : 'Input manual';
    status.textContent = cpReady
        ? (activeCurriculumSuggestion.matched
            ? 'GADM menemukan bagian CP yang paling relevan dengan materi/topik.'
            : 'CP fase tersedia. Materi belum cocok dengan satu elemen tertentu sehingga CP fase ditampilkan utuh.')
        : activeCurriculumSuggestion?.reason || 'Lengkapi konteks pembelajaran.';
    cpElement.hidden = !cpReady;
    cpElement.textContent = cpReady ? activeCurriculumSuggestion.officialText : '';
    const source = activeCurriculumSuggestion?.source;
    const record = activeCurriculumSuggestion?.record;
    sourceElement.hidden = !cpReady;
    sourceElement.textContent = cpReady
        ? `Sumber: ${source?.authority || 'Kemendikdasmen'} · ${record.decisionNumber} · Fase ${String(record.phase).replace('fase', '')} · halaman ${record.sourcePages.join('–')}`
        : '';
    tpWrap.hidden = !tpReady;
    tpElement.textContent = tpReady ? activeLearningObjectiveSuggestion.text : '';
    useCp.disabled = !cpReady;
    useTp.disabled = !tpReady;
}

function applySuggestion(targetId, value) {
    const field = document.getElementById(targetId);
    if (!field || !cleanText(value)) return;
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

function adapterForScope(scope) {
    return Object.freeze({
        normalizeInput,
        loadDraft: () => loadGADMDraft(scope),
        saveDraft: (input) => saveGADMDraft(scope, input),
        onError: (error) => notify(error?.message || error, 'error')
    });
}

function uniqueDocumentId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function requireValidSnapshot() {
    const snapshot = GADM_ENGINE.snapshot();
    if (!snapshot.input || !snapshot.result || snapshot.validation?.ok !== true) {
        throw new Error('Buat dan validasi dokumen sebelum menyimpan atau mengekspor.');
    }
    return snapshot;
}

async function saveCurrentDocument() {
    const snapshot = requireValidSnapshot();
    const record = {
        id: uniqueDocumentId(),
        title: cleanText(snapshot.result.title || 'Dokumen GADM'),
        documentType: cleanText(snapshot.input.documentType),
        selectedClassId: cleanText(window.state?.activeKelas || currentContext().classId),
        subject: cleanText(snapshot.input.mataPelajaran),
        qualityScore: Number(snapshot.result.data?.qualityAudit?.score || 0),
        input: snapshot.input,
        text: String(snapshot.result.text || ''),
        engineVersion: GADM_ENGINE.version,
        kbVersion: GADM_ENGINE.kbVersion
    };
    await saveGADMDocument(activeScope, record);
    notify('Berhasil disimpan: dokumen GADM tersimpan di workspace offline aktif.', 'success');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function wordDocumentHTML(snapshot) {
    const container = document.createElement('div');
    container.innerHTML = snapshot.result.html;
    container.querySelectorAll('script,style,iframe,object,embed').forEach((element) => element.remove());
    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeFilename(snapshot.result.title)}</title><style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.45;color:#111}h1{text-align:center;font-size:18pt}h2{font-size:14pt;border-bottom:1px solid #999}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:6px;vertical-align:top}th{background:#eee}</style></head><body>${container.innerHTML}</body></html>`;
}

function exportWord() {
    const snapshot = requireValidSnapshot();
    const blob = new Blob(['\ufeff', wordDocumentHTML(snapshot)], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `${safeFilename(snapshot.result.title)}.doc`);
}

function safeCell(value) {
    const text = String(value ?? '');
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function exportExcel() {
    const snapshot = requireValidSnapshot();
    if (!window.XLSX?.utils || typeof window.XLSX.writeFile !== 'function') {
        throw new Error('Pustaka Excel SIMNI belum tersedia.');
    }
    const workbook = window.XLSX.utils.book_new();
    const summary = window.XLSX.utils.aoa_to_sheet([
        ['GADM', 'Generator Administrasi Pembelajaran Mendalam'],
        ['Judul', safeCell(snapshot.result.title)],
        ['Jenis', safeCell(snapshot.input.documentType)],
        ['Kelas', safeCell(snapshot.input.kelasAtauFase)],
        ['Mata Pelajaran', safeCell(snapshot.input.mataPelajaran)],
        ['Tahun Pelajaran', safeCell(snapshot.input.tahunPelajaran)],
        ['Engine', GADM_ENGINE.version],
        ['Knowledge Base', GADM_ENGINE.kbVersion],
        ['Quality Score', Number(snapshot.result.data?.qualityAudit?.score || 0)]
    ]);
    const inputSheet = window.XLSX.utils.aoa_to_sheet([
        ['Field', 'Nilai'],
        ...Object.entries(snapshot.input).map(([key, value]) => [safeCell(key), safeCell(value)])
    ]);
    const outputSheet = window.XLSX.utils.aoa_to_sheet([
        ['Dokumen Hasil'],
        ...String(snapshot.result.text || '').split('\n').map((line) => [safeCell(line)])
    ]);
    window.XLSX.utils.book_append_sheet(workbook, summary, 'Ringkasan');
    window.XLSX.utils.book_append_sheet(workbook, inputSheet, 'Input');
    window.XLSX.utils.book_append_sheet(workbook, outputSheet, 'Hasil');
    window.XLSX.writeFile(workbook, `${safeFilename(snapshot.result.title)}.xlsx`);
}

function closeHistory() {
    const dialog = document.getElementById('gadm-history-dialog');
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
}

function historyButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
}

async function renderHistory() {
    const status = document.getElementById('gadm-history-status');
    const list = document.getElementById('gadm-history-list');
    if (!status || !list) throw new Error('Panel riwayat GADM tidak tersedia.');
    status.textContent = 'Membaca penyimpanan offline…';
    list.replaceChildren();
    const records = await listGADMDocuments(activeScope);
    status.textContent = records.length ? `${records.length} dokumen tersimpan pada scope aktif.` : 'Belum ada dokumen pada scope aktif.';
    for (const record of records) {
        const item = document.createElement('article');
        item.className = 'gadm-history-item';
        const content = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = record.title || 'Dokumen GADM';
        const metadata = document.createElement('p');
        metadata.textContent = `${record.subject || '-'} · Kelas ${record.selectedClassId || '-'} · ${new Date(record.updatedAt).toLocaleString('id-ID')}`;
        content.append(title, metadata);
        const actions = document.createElement('div');
        actions.className = 'gadm-history-actions';
        actions.append(
            historyButton('Buka', 'gadm-tool-button', async () => {
                try {
                    const selected = await getGADMDocument(activeScope, record.id);
                    if (!selected?.input) throw new Error('Dokumen GADM tidak ditemukan.');
                    GADM_ENGINE.loadInput(selected.input);
                    lockCanonicalFields();
                    updateCurriculumSuggestion();
                    closeHistory();
                } catch (error) {
                    notify(error.message || error, 'error');
                }
            }),
            historyButton('Hapus', 'gadm-tool-button gadm-tool-button-danger', async () => {
                if (!window.confirm(`Hapus dokumen "${record.title || 'GADM'}" dari penyimpanan offline scope ini?`)) return;
                try {
                    await deleteGADMDocument(activeScope, record.id);
                    await renderHistory();
                    notify('Dokumen GADM berhasil dihapus.', 'success');
                } catch (error) {
                    notify(error.message || error, 'error');
                }
            })
        );
        item.append(content, actions);
        list.appendChild(item);
    }
}

async function openHistory() {
    const dialog = document.getElementById('gadm-history-dialog');
    if (!dialog) throw new Error('Dialog riwayat GADM tidak tersedia.');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    await renderHistory();
}

function bindIntegrationUI() {
    lifecycleController = new AbortController();
    const options = { signal: lifecycleController.signal };
    document.getElementById('gadm-save')?.addEventListener('click', () => void saveCurrentDocument().catch((error) => notify(error.message || error, 'error')), options);
    document.getElementById('gadm-history')?.addEventListener('click', () => void openHistory().catch((error) => notify(error.message || error, 'error')), options);
    document.getElementById('gadm-history-close')?.addEventListener('click', closeHistory, options);
    document.getElementById('gadm-new-document')?.addEventListener('click', () => {
        GADM_ENGINE.startNewDocument();
        lockCanonicalFields();
        updateCurriculumSuggestion();
    }, options);
    document.getElementById('gadm-refresh-curriculum')?.addEventListener('click', updateCurriculumSuggestion, options);
    document.getElementById('gadm-use-cp')?.addEventListener('click', () => {
        const recordId = document.getElementById('gadm-curriculum-record-id');
        if (recordId) recordId.value = cleanText(activeCurriculumSuggestion?.record?.id);
        applySuggestion('gadm-cp-tp', activeCurriculumSuggestion?.officialText);
    }, options);
    document.getElementById('gadm-use-tp')?.addEventListener('click', () => {
        applySuggestion('gadm-tp-manual', activeLearningObjectiveSuggestion?.text);
    }, options);
    for (const id of ['gadm-kelas-fase', 'gadm-mata-pelajaran', 'gadm-materi-unit', 'gadm-materi-lingkup']) {
        document.getElementById(id)?.addEventListener('change', updateCurriculumSuggestion, options);
    }
    document.getElementById('gadm-cp-tp')?.addEventListener('input', () => {
        const recordId = document.getElementById('gadm-curriculum-record-id');
        if (recordId) recordId.value = '';
    }, options);
    document.getElementById('gadm-download-word')?.addEventListener('click', () => {
        try {
            exportWord();
        } catch (error) {
            notify(error.message || error, 'error');
        }
    }, options);
    document.getElementById('gadm-download-excel')?.addEventListener('click', () => {
        try {
            exportExcel();
        } catch (error) {
            notify(error.message || error, 'error');
        }
    }, options);
}

export async function ensureGADMReady() {
    const context = currentContext();
    const requestedScope = scopeForContext(context);
    if (GADM_ENGINE.snapshot().mounted && activeScope?.key === requestedScope.key) {
        lockCanonicalFields();
        updateCurriculumSuggestion();
        return true;
    }
    if (mountPromise) return mountPromise;
    mountPromise = (async () => {
        unmountGADM();
        activeScope = requestedScope;
        try {
            await GADM_ENGINE.mount(adapterForScope(activeScope));
            bindIntegrationUI();
            lockCanonicalFields();
            updateCurriculumSuggestion();
            return true;
        } catch (error) {
            unmountGADM();
            throw error;
        }
    })().finally(() => {
        mountPromise = null;
    });
    return mountPromise;
}

export function unmountGADM() {
    lifecycleController?.abort();
    lifecycleController = null;
    closeHistory();
    GADM_ENGINE.unmount();
    activeScope = null;
    activeCurriculumSuggestion = null;
    activeLearningObjectiveSuggestion = null;
}

export async function refreshGADMContext() {
    if (!GADM_ENGINE.snapshot().mounted) return false;
    unmountGADM();
    return ensureGADMReady();
}

window.SIMNIGADM = Object.freeze({
    ensureReady: ensureGADMReady,
    unmount: unmountGADM,
    refreshContext: refreshGADMContext,
    isMounted: () => GADM_ENGINE.snapshot().mounted
});

export default window.SIMNIGADM;
