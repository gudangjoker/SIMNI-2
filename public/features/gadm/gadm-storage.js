const DATABASE_NAME = 'simni-gadm-offline';
const DATABASE_VERSION = 1;
const DRAFT_STORE = 'drafts';
const DOCUMENT_STORE = 'documents';
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_DATABASE_BYTES = 64 * 1024 * 1024;
const MAX_SCOPE_DOCUMENTS = 500;
const ALLOWED_ROLES = new Set(['superuser', 'vip', 'teacher']);

function cleanScopePart(value, label) {
    const normalized = String(value || '').normalize('NFKC').trim();
    if (!normalized || normalized.length > 160 || /[|\u0000-\u001f\u007f]/.test(normalized)) {
        throw new Error(`${label} GADM tidak valid.`);
    }
    return normalized;
}

export function createGADMScope(context) {
    globalThis.SIMNIAccess?.assertFeature?.('gadm');
    const active = globalThis.SIMNICurrentAccess;
    if (active && (active.uid !== context?.uid || active.workspaceId !== context?.workspaceId || (active.role !== 'superuser' && active.activeAcademicYearId !== (context?.activeAcademicYearId || context?.academicYearId)))) throw new Error('Scope GADM tidak sesuai penugasan aktif.');
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
        throw new Error('Konteks akses GADM tidak tersedia.');
    }
    const uid = cleanScopePart(context.uid, 'UID');
    const role = cleanScopePart(context.role, 'Role').toLowerCase();
    const workspaceId = cleanScopePart(context.workspaceId, 'Workspace');
    const academicYearId = cleanScopePart(context.activeAcademicYearId || context.academicYearId, 'Tahun pelajaran');
    const classId = cleanScopePart(context.scopedClassId || context.classId, 'Kelas');
    if (!ALLOWED_ROLES.has(role)) throw new Error('Role tidak diizinkan mengakses GADM.');
    return Object.freeze({
        uid,
        role,
        workspaceId,
        academicYearId,
        classId,
        key: [uid, role, workspaceId, academicYearId, classId].join('|')
    });
}

function clonePlain(value, label) {
    let serialized;
    try {
        serialized = JSON.stringify(value);
    } catch (error) {
        throw new Error(`${label} GADM tidak dapat diserialisasi.`, { cause: error });
    }
    if (!serialized || new Blob([serialized]).size > MAX_RECORD_BYTES) {
        throw new Error(`${label} GADM melebihi batas penyimpanan lokal.`);
    }
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} GADM harus berupa objek.`);
    }
    return parsed;
}

function requestResult(request, errorMessage) {
    return new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(new Error(errorMessage, { cause: request.error })), { once: true });
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.addEventListener('complete', resolve, { once: true });
        transaction.addEventListener('abort', () => reject(new Error('Transaksi IndexedDB GADM dibatalkan.', { cause: transaction.error })), { once: true });
        transaction.addEventListener('error', () => reject(new Error('Transaksi IndexedDB GADM gagal.', { cause: transaction.error })), { once: true });
    });
}

function openDatabase() {
    if (!globalThis.indexedDB) throw new Error('IndexedDB tidak didukung oleh browser ini.');
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DRAFT_STORE)) {
            database.createObjectStore(DRAFT_STORE, { keyPath: 'scopeKey' });
        }
        if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
            const store = database.createObjectStore(DOCUMENT_STORE, { keyPath: 'storageKey' });
            store.createIndex('scopeKey', 'scopeKey', { unique: false });
            store.createIndex('scopeUpdatedAt', ['scopeKey', 'updatedAt'], { unique: false });
        }
    });
    request.addEventListener('blocked', () => {
        request.transaction?.abort();
    }, { once: true });
    return requestResult(request, 'Database lokal GADM gagal dibuka.');
}

async function withStore(storeName, mode, operation) {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(storeName, mode);
        const completed = transactionDone(transaction);
        completed.catch(() => undefined);
        const result = await operation(transaction.objectStore(storeName));
        await completed;
        return result;
    } finally {
        database.close();
    }
}

function validDocumentId(value) {
    const id = String(value || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new Error('ID dokumen GADM tidak valid.');
    return id;
}

export async function loadGADMDraft(scope) {
    const normalizedScope = createGADMScope(scope);
    return withStore(DRAFT_STORE, 'readonly', async (store) => {
        const record = await requestResult(store.get(normalizedScope.key), 'Draft GADM gagal dibaca.');
        return record?.input ? clonePlain(record.input, 'Draft') : null;
    });
}

export async function saveGADMDraft(scope, input) {
    globalThis.SIMNIAccess?.assertFeature?.('gadm', 'manage');
    const normalizedScope = createGADMScope(scope);
    const safeInput = clonePlain(input, 'Draft');
    const record = {
        scopeKey: normalizedScope.key,
        uid: normalizedScope.uid,
        role: normalizedScope.role,
        workspaceId: normalizedScope.workspaceId,
        academicYearId: normalizedScope.academicYearId,
        classId: normalizedScope.classId,
        updatedAt: new Date().toISOString(),
        input: safeInput
    };
    return withStore(DRAFT_STORE, 'readwrite', (store) => new Promise((resolve, reject) => {
        let bytes = new Blob([JSON.stringify(record)]).size;
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (cursor.key !== record.scopeKey) bytes += new Blob([JSON.stringify(cursor.value)]).size;
                cursor.continue(); return;
            }
            if (bytes > 16 * 1024 * 1024) { reject(new Error('Draft GADM mencapai batas 16 MiB perangkat. Ekspor hasil kerja dan hapus draft tahun/kelas lama yang sudah diamankan.')); return; }
            requestResult(store.put(record), 'Draft GADM gagal disimpan.').then(resolve, reject);
        };
    }));
}

export async function saveGADMDocument(scope, documentRecord) {
    globalThis.SIMNIAccess?.assertFeature?.('gadm', 'manage');
    const normalizedScope = createGADMScope(scope);
    const safeRecord = clonePlain(documentRecord, 'Dokumen');
    const id = validDocumentId(safeRecord.id);
    const timestamp = new Date().toISOString();
    const record = {
        ...safeRecord,
        id,
        storageKey: `${normalizedScope.key}|${id}`,
        scopeKey: normalizedScope.key,
        uid: normalizedScope.uid,
        role: normalizedScope.role,
        workspaceId: normalizedScope.workspaceId,
        academicYearId: normalizedScope.academicYearId,
        classId: normalizedScope.classId,
        createdAt: safeRecord.createdAt || timestamp,
        updatedAt: timestamp
    };
    record.storageBytes = new Blob([JSON.stringify(record)]).size;
    return withStore(DOCUMENT_STORE, 'readwrite', (store) => new Promise((resolve, reject) => {
        let totalBytes = record.storageBytes;
        let scopeCount = 1;
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                const old = cursor.value;
                if (old.storageKey !== record.storageKey) {
                    totalBytes += Number(old.storageBytes) || new Blob([JSON.stringify(old)]).size;
                    if (old.scopeKey === normalizedScope.key) scopeCount += 1;
                } else record.createdAt = old.createdAt || record.createdAt;
                cursor.continue();
                return;
            }
            if (totalBytes > MAX_DATABASE_BYTES || scopeCount > MAX_SCOPE_DOCUMENTS) {
                reject(new Error('Riwayat mencapai batas 64 MiB perangkat atau 500 dokumen per kelas/tahun. Ekspor dokumen lama melalui Buka, lalu hapus dokumen pilihan di Riwayat sebelum menyimpan.'));
                return;
            }
            requestResult(store.put(record), 'Dokumen GADM gagal disimpan.').then(resolve, reject);
        };
    }));
}

export async function listGADMDocuments(scope, { before = null, limit = 20 } = {}) {
    const normalizedScope = createGADMScope(scope);
    const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
    return withStore(DOCUMENT_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
        const records = [];
        const range = IDBKeyRange.bound([normalizedScope.key, ''], [normalizedScope.key, before?.updatedAt || '\uffff']);
        const request = store.index('scopeUpdatedAt').openCursor(range, 'prev');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) { resolve({ records, nextCursor: null }); return; }
            const record = cursor.value;
            if (before && record.updatedAt === before.updatedAt && record.storageKey >= before.storageKey) {
                cursor.continue(); return;
            }
            if (records.length === pageSize) {
                const last = records.at(-1);
                resolve({ records, nextCursor: { updatedAt: last.updatedAt, storageKey: last.storageKey } });
                return;
            }
            const { id, title, subject, selectedClassId, updatedAt, storageKey } = record;
            records.push({ id, title, subject, selectedClassId, updatedAt, storageKey });
            cursor.continue();
        };
    }));
}

export async function getGADMDocument(scope, documentId) {
    const normalizedScope = createGADMScope(scope);
    const id = validDocumentId(documentId);
    return withStore(DOCUMENT_STORE, 'readonly', async (store) => {
        const record = await requestResult(store.get(`${normalizedScope.key}|${id}`), 'Dokumen GADM gagal dibaca.');
        return record ? clonePlain(record, 'Dokumen') : null;
    });
}

export async function deleteGADMDocument(scope, documentId) {
    globalThis.SIMNIAccess?.assertFeature?.('gadm', 'manage');
    const normalizedScope = createGADMScope(scope);
    const id = validDocumentId(documentId);
    return withStore(DOCUMENT_STORE, 'readwrite', (store) => requestResult(store.delete(`${normalizedScope.key}|${id}`), 'Dokumen GADM gagal dihapus.'));
}

export async function listGADMStorageScopes(scope) {
    const owner = createGADMScope(scope);
    const prefix = `${owner.uid}|${owner.role}|${owner.workspaceId}|`;
    const keys = new Set([owner.key]);
    for (const name of [DRAFT_STORE, DOCUMENT_STORE]) {
        await withStore(name, 'readonly', store => new Promise((resolve, reject) => {
            const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
            const request = name === DOCUMENT_STORE
                ? store.index('scopeKey').openKeyCursor(range, 'nextunique') : store.openKeyCursor(range);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) { resolve(); return; }
                keys.add(cursor.key); cursor.continue();
            };
        }));
    }
    return [...keys].sort().map(key => {
        const [uid, role, workspaceId, academicYearId, classId] = key.split('|');
        return createGADMScope({ uid, role, workspaceId, academicYearId, classId });
    });
}

export async function deleteGADMDraftAfterVerification(scope, exported) {
    globalThis.SIMNIAccess?.assertFeature?.('gadm', 'manage');
    const selected = createGADMScope(scope);
    if (exported?.format !== 'simni-gadm-draft-v1' || exported.scopeKey !== selected.key) throw new Error('Berkas draft tidak cocok dengan kelas/tahun pilihan.');
    const expected = JSON.stringify(clonePlain(exported.input, 'Draft ekspor'));
    return withStore(DRAFT_STORE, 'readwrite', store => new Promise((resolve, reject) => {
        const request = store.get(selected.key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            if (!request.result || JSON.stringify(request.result.input) !== expected) {
                reject(new Error('Draft berubah atau berkas tidak cocok. Draft dipertahankan.')); return;
            }
            requestResult(store.delete(selected.key), 'Draft lama gagal dihapus.').then(resolve, reject);
        };
    }));
}

export const GADM_STORAGE_INFO = Object.freeze({
    databaseName: DATABASE_NAME,
    databaseVersion: DATABASE_VERSION,
    stores: Object.freeze([DRAFT_STORE, DOCUMENT_STORE])
});
