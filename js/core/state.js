// ==========================================
// FILE: js/core/state.js
// FUNGSI: State global kompatibel selama transisi modular
// ==========================================

// Identitas institusi kanonik SIMNI.
// Nilai ini bersifat permanen lintas tahun buku dan tidak diedit oleh guru.
// Tahun pelajaran tetap dinamis dan mengikuti access context/rollover sistem.
window.SIMNIInstitutionIdentity = Object.freeze({
    nama_aplikasi: 'SIMNI Administrasi Kelas',
    nama_yayasan: 'Yayasan Sosial dan Pendidikan Bina Muda',
    jenjang_sekolah: 'Sekolah Dasar',
    nama_sekolah: 'SDIT Bina Muda Cicalengka',
    status_akreditasi: 'A',
    kota: 'Cicalengka',
    nomor_izin: 'No.421.2/1143-Disdikbud/2011'
});

// State Global Aplikasi yang terekspos ke semua file
var state = { 
    pengaturan: { 
        ...window.SIMNIInstitutionIdentity,
        nama_kelas: 'Kelas 3A', 
        tahun_pelajaran: '2026-2027', 
        ikon_kelas: 'fa-school', 
        logo_url: './icons/school-logo.png',
        logo_public_id: null,
        logo_resource_type: null,
        nama_wali_kelas: '',
        nuptk_wali_kelas: ''
    }, 
    pengaturanLPS_v2: [], 
    lpsTemplates: {}, lpsReports: [],
    students: [], presensi: [], mapelTP: [], nilaiTP: [], dokumen: [], 
    catatan: [], jurnal: [], jadwal: [], dataLPS: [], 
    presensiScope: { scope: 'all', classId: '', isComplete: true, isClassComplete: true, count: 0 },
    nilaiScope: { scope: 'all', classId: '', isComplete: true, isClassComplete: true, count: 0 },
    jurnalScope: { scope: 'all', classId: '', isComplete: true, isClassComplete: true, count: 0 },
    currentView: 'dashboard', docTabActive: 'Administrasi', 
    tempSelectedSiswaNISN: null, scannerInstance: null,
    activeKelas: '' 
};

window.SIMNIDataScope = window.SIMNIDataScope || {};

// Daftar Kelas untuk Paradigma Multi-Kelas (VIP PJOK)
window.daftarKelasDinamis = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];

// Variabel Pengendali Alur
var isFirebaseListening = false;
var isInitialLoad = true;
var lastJurnalDate = "";

// Shared academic contracts. Missing class is attributable only to the
// single-class Superuser workspace; never infer a VIP class from its selector.
function academicRecordClass(record) {
    const value = record?.Kelas || record?.kelas || record?.id_kelas || '';
    if (value) return normalizeClassLabel(value);
    const nisn = record?.NISN || record?.nisn || '';
    if (nisn && Array.isArray(window.state?.students)) {
        const student = window.state.students.find((s) => academicNisn(s.NISN) === academicNisn(nisn));
        const studentClass = student?.Kelas || student?.kelas || student?.id_kelas || '';
        if (studentClass) return normalizeClassLabel(studentClass);
    }
    const access = window.SIMNICurrentAccess;
    return access?.role === 'superuser' ? normalizeClassLabel(access.classId) : '';
}

function academicNisn(value) {
    return String(value ?? '').trim().replace(/\s+/g, '');
}

function academicScore(value) {
    if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function academicSessionKey() {
    const access = window.SIMNICurrentAccess || {};
    return [access.uid, access.role, access.workspaceId, access.activeAcademicYearId].join('|');
}

// Persistent offline form drafts in IndexedDB with in-memory fast-path.
// Stable control keys preserve input across date/class navigation; dirty DOM is not rebuilt by sync.
window.SIMNIFormDrafts = (() => {
    const drafts = new Map();
    const pending = new Set();
    const cleanValues = new Map();
    const persistTimers = new Map();
    let session = '';
    let revision = 0;
    let hydration = Promise.resolve();

    const DB_NAME = 'SIMNIDraftsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'academicDrafts';
    const idb = typeof window !== 'undefined' ? (window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB) : null;
    let dbInstance = null;

    function openDB() {
        if (!idb) return Promise.resolve(null);
        if (dbInstance) return Promise.resolve(dbInstance);
        return new Promise((resolve) => {
            try {
                const request = idb.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        store.createIndex('session', 'session', { unique: false });
                        store.createIndex('uid', 'uid', { unique: false });
                    }
                };
                request.onsuccess = (event) => {
                    dbInstance = event.target.result;
                    dbInstance.onclose = () => { dbInstance = null; };
                    resolve(dbInstance);
                };
                request.onerror = (err) => {
                    console.warn('[SIMNI Drafts IDB] Gagal membuka IndexedDB:', err);
                    resolve(null);
                };
            } catch (err) {
                console.warn('[SIMNI Drafts IDB] Exception IndexedDB:', err);
                resolve(null);
            }
        });
    }

    async function persistDraftToStorage(record) {
        const db = await openDB();
        if (!db) return false;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                tx.oncomplete = () => resolve(true);
                tx.onabort = tx.onerror = (err) => {
                    console.warn('[SIMNI Drafts IDB] Gagal menyimpan draf:', err);
                    resolve(false);
                };
                store.put(record);
            } catch (err) {
                resolve(false);
            }
        });
    }

    async function deleteDraftFromStorage(id) {
        const db = await openDB();
        if (!db) return false;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                tx.oncomplete = () => resolve(true);
                tx.onabort = tx.onerror = () => resolve(false);
                store.delete(id);
            } catch (err) {
                resolve(false);
            }
        });
    }

    async function loadAllDraftsFromStorage(currentUid) {
        const db = await openDB();
        if (!db) return [];
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    if (currentUid) {
                        resolve(all.filter(item => item.uid === currentUid));
                    } else {
                        resolve(all);
                    }
                };
                req.onerror = () => resolve([]);
            } catch (err) {
                resolve([]);
            }
        });
    }

    async function clearDraftsFromStorage(uid) {
        const db = await openDB();
        if (!db) return;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                if (!uid) {
                    const req = store.clear();
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                } else {
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const items = req.result || [];
                        const deleteTx = db.transaction([STORE_NAME], 'readwrite');
                        const delStore = deleteTx.objectStore(STORE_NAME);
                        items.forEach(item => {
                            if (item.uid === uid) delStore.delete(item.id);
                        });
                        deleteTx.oncomplete = () => resolve();
                        deleteTx.onerror = () => resolve();
                    };
                    req.onerror = () => resolve();
                }
            } catch (err) {
                resolve();
            }
        });
    }

    function updateVisualStatus(element, status, customText) {
        if (!element || typeof document === 'undefined') return;
        let indicator = element.querySelector?.('[data-simni-draft-status]') ||
                        element.closest?.('.view-section')?.querySelector?.('[data-simni-draft-status]') ||
                        document.getElementById(`${element.id}-draft-status`);

        if (!indicator) {
            const targetContainer = element.closest?.('.view-section')?.querySelector?.('[data-draft-status-container]') ||
                                    element.closest?.('.bg-white, .dark\\:bg-\\[\\#111111\\]') ||
                                    element.parentElement;
            if (targetContainer) {
                indicator = document.createElement('div');
                indicator.dataset.simniDraftStatus = '';
                indicator.setAttribute('role', 'status');
                indicator.className = 'simni-draft-badge hidden text-xs font-semibold py-1 px-2.5 rounded-lg transition-all my-2';
                targetContainer.prepend(indicator);
            }
        }

        if (!indicator) return;
        // Reserve feedback space before editing so a delayed IDB acknowledgement
        // cannot move a Save button underneath an in-progress pointer click.
        indicator.style.minHeight = '1.5rem';
        indicator.classList.remove('hidden');
        indicator.classList.toggle('invisible', !status);

        if (status === 'saved-device') {
            indicator.classList.remove('hidden', 'text-emerald-600', 'dark:text-emerald-400', 'bg-emerald-50', 'dark:bg-emerald-950/30', 'border-emerald-200', 'dark:border-emerald-800');
            indicator.classList.add('flex', 'items-center', 'gap-1.5', 'text-amber-600', 'dark:text-amber-400', 'bg-amber-50', 'dark:bg-amber-950/30', 'border', 'border-amber-200', 'dark:border-amber-800');
            indicator.innerHTML = `<i class="fas fa-save" aria-hidden="true"></i> <span>${customText || 'Draf tersimpan di perangkat — belum terkirim'}</span>`;
        } else if (status === 'saved-db') {
            indicator.classList.remove('hidden', 'text-amber-600', 'dark:text-amber-400', 'bg-amber-50', 'dark:bg-amber-950/30', 'border-amber-200', 'dark:border-amber-800');
            indicator.classList.add('flex', 'items-center', 'gap-1.5', 'text-emerald-600', 'dark:text-emerald-400', 'bg-emerald-50', 'dark:bg-emerald-950/30', 'border', 'border-emerald-200', 'dark:border-emerald-800');
            indicator.innerHTML = `<i class="fas fa-check-circle" aria-hidden="true"></i> <span>${customText || 'Tersimpan di database'}</span>`;
            setTimeout(() => {
                if (indicator.textContent.includes('Tersimpan di database')) {
                    indicator.classList.add('invisible');
                }
            }, 3000);
        } else if (status === 'quota-warning') {
            indicator.classList.remove('hidden');
            indicator.classList.add('flex', 'items-center', 'gap-1.5', 'text-red-600', 'dark:text-red-400', 'bg-red-50', 'dark:bg-red-950/30', 'border', 'border-red-200', 'dark:border-red-800');
            indicator.innerHTML = `<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> <span>Penyimpanan lokal penuh. Draf aktif di memori sesi.</span>`;
        } else {
            indicator.classList.add('invisible');
            indicator.innerHTML = '';
        }
    }

    function currentSession() {
        const next = academicSessionKey();
        if (next !== session) {
            for (const [id, timer] of persistTimers) {
                clearTimeout(timer);
                const draft = drafts.get(id);
                if (draft) void persistDraftToStorage(draft);
            }
            persistTimers.clear();
            drafts.clear();
            pending.clear();
            cleanValues.clear();
            session = next;
            // Load persistent drafts for the new session asynchronously
            hydration = syncFromStorage().catch(() => {});
        }
        return next;
    }

    async function syncFromStorage() {
        const access = window.SIMNICurrentAccess;
        if (!access?.uid) return;
        const storedDrafts = await loadAllDraftsFromStorage(access.uid);
        const curSession = academicSessionKey();
        for (const item of storedDrafts) {
            if (item.session === curSession && !drafts.has(item.id)) {
                drafts.set(item.id, { ...item, persisted: true });
                if (item.revision > revision) revision = item.revision;
            }
        }
    }

    function key(id, discriminator = '') {
        return [currentSession(), normalizeClassLabel(state.activeKelas), id, discriminator].join('|');
    }

    function controls(element) { return [...element.querySelectorAll('[data-draft-key]')]; }
    function values(element) {
        return Object.fromEntries(controls(element).map(input => [
            input.dataset.draftKey,
            input.type === 'radio' || input.type === 'checkbox' ? input.checked : input.value
        ]));
    }

    function capture(element) {
        const id = element?.dataset.draftScope;
        if (!id) return;
        const baselines = [...element.querySelectorAll('[data-baseline]')].map(input => ({
            key: input.dataset.draftKey || input.querySelector?.('.j-jam')?.value,
            baseline: input.dataset.baseline,
            recordId: input.dataset.recordId
        }));
        const val = values(element);
        const access = window.SIMNICurrentAccess || {};
        const draftRecord = {
            id,
            session: currentSession(),
            uid: String(access.uid || ''),
            workspaceId: String(access.workspaceId || ''),
            academicYearId: String(access.activeAcademicYearId || ''),
            classId: normalizeClassLabel(state.activeKelas),
            revision: ++revision,
            baselines,
            values: val,
            updatedAt: new Date().toISOString()
        };
        drafts.set(id, draftRecord);

        // Schedule debounced persist to IndexedDB
        if (persistTimers.has(id)) clearTimeout(persistTimers.get(id));
        const timer = setTimeout(async () => {
            persistTimers.delete(id);
            const currentDraft = drafts.get(id);
            if (currentDraft && currentDraft.revision === draftRecord.revision) {
                const saved = await persistDraftToStorage(draftRecord);
                if (drafts.get(id)?.revision !== draftRecord.revision ||
                    element.dataset.draftScope !== id || academicSessionKey() !== draftRecord.session) return;
                if (saved) {
                    currentDraft.persisted = true;
                    updateVisualStatus(element, 'saved-device');
                } else {
                    updateVisualStatus(element, 'quota-warning');
                }
            }
        }, 150);
        persistTimers.set(id, timer);
    }

    if (typeof document !== 'undefined') {
        for (const type of ['input', 'change']) {
            document.addEventListener(type, event => {
                const element = event.target.closest?.('[data-draft-scope]');
                if (element && event.target.matches?.('[data-draft-key]')) capture(element);
            });
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            if (window.SIMNIFormDrafts?.hasUnsaved?.()) {
                window.toast?.('Koneksi kembali terhubung. Anda memiliki draf tersimpan di perangkat yang siap dikirim melalui tombol Simpan.', 'info');
            }
        });
        window.addEventListener('beforeunload', event => {
            if (window.SIMNIFormDrafts?.hasUnsaved?.()) { event.preventDefault(); event.returnValue = ''; }
        });
    }

    return Object.freeze({
        key,
        async ready() { currentSession(); await hydration; },
        prepare(element, discriminator = '') {
            if (!element) return false;
            const id = key(element.id, discriminator);
            if (element.dataset.draftScope === id && cleanValues.has(id) &&
                JSON.stringify(values(element)) !== JSON.stringify(cleanValues.get(id)) && !drafts.has(id)) capture(element);
            if (element.dataset.draftScope === id && (drafts.has(id) || pending.has(id))) return false;
            element.dataset.draftScope = id;
            return true;
        },
        restore(element) {
            cleanValues.set(element?.dataset.draftScope, values(element));
            const draft = drafts.get(element?.dataset.draftScope);
            if (draft) {
                for (const input of controls(element)) {
                    if (!Object.hasOwn(draft.values, input.dataset.draftKey)) continue;
                    if (input.type === 'radio' || input.type === 'checkbox') input.checked = draft.values[input.dataset.draftKey];
                    else input.value = draft.values[input.dataset.draftKey];
                }
                for (const input of element.querySelectorAll('[data-baseline]')) {
                    const baseline = draft.baselines?.find(item => item.key === (input.dataset.draftKey || input.querySelector?.('.j-jam')?.value));
                    if (baseline) { input.dataset.baseline = baseline.baseline; input.dataset.recordId = baseline.recordId || ''; }
                }
                updateVisualStatus(element, draft.persisted ? 'saved-device' : '');
            } else {
                updateVisualStatus(element, '');
            }
        },
        begin(element) {
            currentSession();
            const id = element?.dataset.draftScope;
            if (!id || pending.has(id)) throw new Error('Penyimpanan formulir masih berlangsung.');
            capture(element);
            pending.add(id);
            return { id, session, revision: drafts.get(id)?.revision, values: drafts.get(id)?.values };
        },
        finish(token, committed = false) {
            if (!token) return;
            pending.delete(token.id);
            if (committed && drafts.get(token.id)?.revision === token.revision) {
                cleanValues.set(token.id, token.values);
                drafts.delete(token.id);
                deleteDraftFromStorage(token.id).catch(() => {});
                if (typeof document !== 'undefined') {
                    const el = document.querySelector(`[data-draft-scope="${token.id}"]`);
                    if (el) updateVisualStatus(el, 'saved-db');
                }
            }
        },
        sameSession(token) { return token?.session === currentSession(); },
        isCurrent(element, token) { return element?.dataset.draftScope === token?.id && token?.session === currentSession(); },
        dirty(element) { currentSession(); return drafts.has(element?.dataset.draftScope); },
        hasUnsaved() { currentSession(); return drafts.size > 0 || pending.size > 0; },
        clear() {
            drafts.clear();
            pending.clear();
            cleanValues.clear();
            clearDraftsFromStorage().catch(() => {});
        },
        syncFromStorage,
        clearUserDrafts(uid) {
            drafts.clear();
            pending.clear();
            cleanValues.clear();
            return clearDraftsFromStorage(uid);
        },
        getDraft(id) { return drafts.get(id); },
        updateVisualStatus
    });
})();


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
        
        if (typeof renderCurrentView === 'function') renderCurrentView();
        if (typeof renderCatatanSiswa === 'function' && state.currentView === 'catatan') renderCatatanSiswa();
        if (typeof updateDashboardStats === 'function' && state.currentView === 'dashboard') updateDashboardStats();
        if (window.SIMNIGADM?.isMounted?.()) {
            void window.SIMNIGADM.refreshContext().catch((error) => window.toast?.(error.message || String(error), 'error'));
        }
    }
};
