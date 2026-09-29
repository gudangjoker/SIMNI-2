import GADM_ENGINE from './gadm-engine.js';
import { createDocxBlob } from './gadm-docx.js';
import {
    createGADMScope,
    loadGADMDraft,
    saveGADMDraft,
    saveGADMDocument,
    listGADMDocuments,
    getGADMDocument,
    deleteGADMDocument,
    listGADMStorageScopes,
    deleteGADMDraftAfterVerification
} from './gadm-storage.js';

const ALLOWED_ROLES = new Set(['superuser', 'vip', 'teacher']);
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
        throw new Error('Sesi SIMNI aktif diperlukan untuk mengakses GADM.');
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
    const scope = activeScope;
    const selectedClassId = cleanText(window.state?.activeKelas || currentContext().classId);
    // Repeated Save of identical content updates the same local document.
    const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([snapshot.input, snapshot.result.text])));
    const contentId = Array.from(new Uint8Array(fingerprint), byte => byte.toString(16).padStart(2, '0')).join('');
    const record = {
        id: contentId,
        title: cleanText(snapshot.result.title || 'Dokumen GADM'),
        documentType: cleanText(snapshot.input.documentType),
        selectedClassId,
        subject: cleanText(snapshot.input.mataPelajaran),
        qualityScore: Number(snapshot.result.data?.qualityAudit?.score || 0),
        input: snapshot.input,
        text: String(snapshot.result.text || ''),
        engineVersion: GADM_ENGINE.version,
        kbVersion: GADM_ENGINE.kbVersion
    };
    await saveGADMDocument(scope, record);
    notify('Berhasil disimpan: dokumen GADM tersimpan di workspace offline aktif.', 'success');
}

function downloadBlob(blob, filename) {
    if (typeof window.SIMNIDownloadService?.downloadBlob === 'function') {
        void window.SIMNIDownloadService.downloadBlob(blob, filename);
        return;
    }
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
    window.SIMNIAccess?.assertFeature?.('gadm', 'export');
    const snapshot = requireValidSnapshot();
    const blob = new Blob(['\ufeff', wordDocumentHTML(snapshot)], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `${safeFilename(snapshot.result.title)}.doc`);
}

function safeCell(value) {
    const text = String(value ?? '');
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

async function exportExcel() {
    window.SIMNIAccess?.assertFeature?.('gadm', 'export');
    await window.ensureSIMNIVendors?.("xlsx");
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

let historyGeneration = 0;
async function renderHistory(before = null, selectedScope = null) {
    const requestGeneration = ++historyGeneration;
    const status = document.getElementById('gadm-history-status');
    const list = document.getElementById('gadm-history-list');
    if (!status || !list) throw new Error('Panel riwayat GADM tidak tersedia.');
    status.textContent = 'Membaca penyimpanan offline…';
    list.replaceChildren();
    const activeKey = activeScope.key;
    const scope = selectedScope || activeScope;
    const scopes = await listGADMStorageScopes(activeScope);
    const { records, nextCursor } = await listGADMDocuments(scope, { before });
    if (activeScope?.key !== activeKey || requestGeneration !== historyGeneration) return;
    const selector = document.createElement('select'); selector.setAttribute('aria-label', 'Kelas dan tahun riwayat');
    for (const entry of scopes) {
        const option = document.createElement('option'); option.value = entry.key;
        option.textContent = `${entry.academicYearId} · Kelas ${entry.classId}`; option.selected = entry.key === scope.key; selector.append(option);
    }
    selector.onchange = () => renderHistory(null, scopes.find(entry => entry.key === selector.value)).catch(error => notify(error.message, 'error'));
    list.append(selector);
    const exportJson = (payload, filename) => {
        window.SIMNIAccess?.assertFeature?.('gadm', 'export');
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    const draft = await loadGADMDraft(scope);
    if (activeScope?.key !== activeKey || requestGeneration !== historyGeneration) return;
    if (draft) {
        const draftRow = document.createElement('p'); draftRow.textContent = 'Draft kelas/tahun pilihan: ';
        draftRow.append(historyButton('Ekspor draft JSON', 'gadm-tool-button', () => {
            if (activeScope?.key !== activeKey) return;
            exportJson({ format:'simni-gadm-draft-v1', scopeKey:scope.key, input:draft }, `SIMNI_draft_${scope.academicYearId}_${scope.classId}.json`);
        }));
        if (scope.key !== activeKey) {
            const label = document.createElement('label'); label.textContent = ' Pilih ekspor untuk verifikasi dan hapus draft lama: ';
            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.json,application/json';
            fileInput.onchange = async () => {
                try {
                    const file = fileInput.files?.[0]; if (!file) return;
                    if (file.size > 3 * 1024 * 1024) throw new Error('Berkas draft terlalu besar.');
                    const exported = JSON.parse(await file.text());
                    if (activeScope?.key !== activeKey) return;
                    if (!confirm('Hapus draft lama yang cocok dengan berkas ekspor? Draft aktif tetap dipertahankan.')) return;
                    await deleteGADMDraftAfterVerification(scope, exported);
                    await renderHistory(null, scope);
                } catch (error) { notify(error.message, 'error'); }
            };
            label.append(fileInput); draftRow.append(label);
        }
        list.append(draftRow);
    }
    status.textContent = records.length ? `${records.length} dokumen pada halaman ini. Batas 500 dokumen per kelas/tahun, 64 MiB per perangkat. Buka untuk mengekspor sebelum menghapus.` : 'Belum ada dokumen pada scope aktif.';
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
            historyButton(scope.key === activeKey ? 'Buka' : 'Buka sebagai salinan baru', 'gadm-tool-button', async () => {
                try {
                    const selected = await getGADMDocument(scope, record.id);
                    if (activeScope?.key !== activeKey) return;
                    if (!selected?.input) throw new Error('Dokumen GADM tidak ditemukan.');
                    GADM_ENGINE.loadInput(selected.input);
                    lockCanonicalFields();
                    updateCurriculumSuggestion();
                    closeHistory();
                } catch (error) {
                    notify(error.message || error, 'error');
                }
            }),
            historyButton('Ekspor JSON', 'gadm-tool-button', async () => {
                try {
                    const selected = await getGADMDocument(scope, record.id);
                    if (activeScope?.key !== activeKey) return;
                    if (!selected) throw new Error('Dokumen tidak ditemukan.');
                    exportJson(selected, `SIMNI_GADM_${scope.academicYearId}_${record.id}.json`);
                } catch (error) { notify(error.message, 'error'); }
            }),
            historyButton('Hapus', 'gadm-tool-button gadm-tool-button-danger', async () => {
                if (activeScope?.key !== activeKey) return;
                if (!window.confirm(`Hapus dokumen "${record.title || 'GADM'}" dari penyimpanan offline scope ini?`)) return;
                try {
                    await deleteGADMDocument(scope, record.id);
                    await renderHistory(null, scope);
                    notify('Dokumen GADM berhasil dihapus.', 'success');
                } catch (error) {
                    notify(error.message || error, 'error');
                }
            })
        );
        item.append(content, actions);
        list.appendChild(item);
    }
    if (before) list.append(historyButton('Kembali ke terbaru', 'gadm-tool-button', () => renderHistory(null, scope).catch(error => notify(error.message, 'error'))));
    if (nextCursor) list.append(historyButton('Halaman lebih lama', 'gadm-tool-button', () => renderHistory(nextCursor, scope).catch(error => notify(error.message, 'error'))));
}

async function openHistory() {
    const dialog = document.getElementById('gadm-history-dialog');
    if (!dialog) throw new Error('Dialog riwayat GADM tidak tersedia.');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    await renderHistory();
}

let selectedDocChoice = 'modulAjar';

function openSelectorModal() {
    const modal = document.getElementById('gadm-selector-modal');
    if (!modal) return;
    modal.removeAttribute('hidden');
    modal.classList.remove('gadm-modal-hidden');
    window.SIMNIDialog?.open(modal, closeSelectorModal);
    document.querySelectorAll('.gadm-entry-card').forEach((card) => {
        if (card.getAttribute('role') === 'group') return;
        const choice = card.dataset.gadmChoice;
        if (choice) card.setAttribute('data-gadm-document', choice);
    });
    document.querySelectorAll('.gadm-entry-sub-btn').forEach((btn) => {
        const choice = btn.dataset.gadmChoice;
        if (choice) btn.setAttribute('data-gadm-document', choice);
    });
    syncSelectorCardHighlights(selectedDocChoice);
}

function closeSelectorModal() {
    const modal = document.getElementById('gadm-selector-modal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    window.SIMNIDialog?.close(modal);
    modal.classList.add('gadm-modal-hidden');
    document.querySelectorAll('.gadm-entry-card').forEach((card) => {
        card.removeAttribute('data-gadm-document');
    });
    document.querySelectorAll('.gadm-entry-sub-btn').forEach((btn) => {
        btn.removeAttribute('data-gadm-document');
    });
}

function syncSelectorCardHighlights(choice) {
    const parentChoice = (choice === 'promes' || choice === 'silabus') ? 'prota' : choice;
    const cards = document.querySelectorAll('.gadm-entry-card');
    cards.forEach((card) => {
        const isTarget = (card.dataset.gadmChoice === parentChoice);
        card.classList.toggle('gadm-is-selected', isTarget);
        if (card.getAttribute('role') === 'radio') card.setAttribute('aria-checked', isTarget ? 'true' : 'false');
    });
    const subBtns = document.querySelectorAll('.gadm-entry-sub-btn');
    subBtns.forEach((btn) => {
        const isSubTarget = (btn.dataset.gadmChoice === choice || (choice === 'prota' && btn.dataset.gadmChoice === 'prota'));
        btn.classList.toggle('gadm-sub-active', isSubTarget);
    });
}

function selectAndStartChoice(choice) {
    selectedDocChoice = choice;
    syncSelectorCardHighlights(choice);
    GADM_ENGINE.startNewDocument();
    const typeSelect = document.getElementById('gadm-document-type');
    if (typeSelect) {
        typeSelect.value = choice;
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const subTypeSelect = document.getElementById('gadm-prota-sub-type');
    if (subTypeSelect && ['prota', 'promes', 'silabus'].includes(choice)) {
        subTypeSelect.value = choice;
    }
    lockCanonicalFields();
    updateCurriculumSuggestion();
    closeSelectorModal();
    const root = document.getElementById('gadm-root');
    if (root) root.dataset.gadmPane = 'form';
    document.querySelectorAll('[data-gadm-pane-value]').forEach((btn) => {
        btn.classList.toggle('gadm-is-active', btn.dataset.gadmPaneValue === 'form');
    });
    const mainScroll = document.getElementById('main-scroll-area');
    if (mainScroll && typeof mainScroll.scrollTo === 'function') {
        mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function bindIntegrationUI() {
    lifecycleController = new AbortController();
    const options = { signal: lifecycleController.signal };

    // Close button and overlay for selector modal
    document.getElementById('gadm-selector-close')?.addEventListener('click', closeSelectorModal, options);
    document.querySelector('.gadm-selector-overlay')?.addEventListener('click', closeSelectorModal, options);

    // Entry layer selector modal listeners
    document.querySelectorAll('.gadm-entry-card').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            const choice = card.dataset.gadmChoice || card.dataset.gadmDocument;
            if (!choice) return;
            selectAndStartChoice(choice);
        }, options);
        card.addEventListener('keydown', (e) => {
            if (e.target !== card || card.getAttribute('role') === 'group') return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const choice = card.dataset.gadmChoice || card.dataset.gadmDocument;
                if (choice) selectAndStartChoice(choice);
            }
        }, options);
    });

    document.querySelectorAll('.gadm-entry-sub-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const choice = btn.dataset.gadmChoice || btn.dataset.gadmDocument;
            if (choice) selectAndStartChoice(choice);
        }, options);
    });

    document.getElementById('gadm-btn-start-builder')?.addEventListener('click', () => {
        selectAndStartChoice(selectedDocChoice);
    }, options);

    document.getElementById('gadm-btn-change-doc')?.addEventListener('click', () => {
        openSelectorModal();
    }, options);

    document.getElementById('gadm-prota-sub-type')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const typeSelect = document.getElementById('gadm-document-type');
        if (typeSelect && ['prota', 'promes', 'silabus'].includes(val)) {
            typeSelect.value = val;
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, options);

    document.getElementById('gadm-document-type')?.addEventListener('change', (e) => {
        const val = e.target.value;
        selectedDocChoice = (val === 'promes' || val === 'silabus') ? 'prota' : val;
        syncSelectorCardHighlights(selectedDocChoice);
        const subTypeSelect = document.getElementById('gadm-prota-sub-type');
        if (subTypeSelect && ['prota', 'promes', 'silabus'].includes(val)) {
            subTypeSelect.value = val;
        }
        closeSelectorModal();
    }, options);

    document.querySelectorAll('[data-gadm-document]').forEach((btn) => {
        btn.addEventListener('click', () => {
            closeSelectorModal();
        }, options);
    });

    document.getElementById('gadm-save')?.addEventListener('click', () => void saveCurrentDocument().catch((error) => notify(error.message || error, 'error')), options);
    document.getElementById('gadm-history')?.addEventListener('click', () => void openHistory().catch((error) => notify(error.message || error, 'error')), options);
    document.getElementById('gadm-history-close')?.addEventListener('click', closeHistory, options);
    document.getElementById('gadm-new-document')?.addEventListener('click', () => {
        GADM_ENGINE.startNewDocument();
        openSelectorModal();
    }, options);
    document.getElementById('gadm-edit-form')?.addEventListener('click', () => {
        const root = document.getElementById('gadm-root');
        if (root) root.dataset.gadmPane = 'form';
        document.querySelectorAll('[data-gadm-pane-value]').forEach((btn) => {
            btn.classList.toggle('gadm-is-active', btn.dataset.gadmPaneValue === 'form');
        });
        const mainScroll = document.getElementById('main-scroll-area');
        if (mainScroll && typeof mainScroll.scrollTo === 'function') {
            mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
    for (const id of ['gadm-kelas-fase', 'gadm-mata-pelajaran', 'gadm-materi-unit', 'gadm-materi-lingkup', 'gadm-prota-sub-type']) {
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
    document.getElementById('gadm-download-excel')?.addEventListener('click', async (event) => {
        const button = event.currentTarget; button.disabled = true; button.setAttribute('aria-busy', 'true');
        try {
            await exportExcel();
        } catch (error) {
            notify(error.message || error, 'error');
        } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
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
            if (!GADM_ENGINE.snapshot().result) {
                openSelectorModal();
            } else {
                closeSelectorModal();
            }
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
    closeSelectorModal();
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
