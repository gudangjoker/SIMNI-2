const DATABASE_NAME = 'simni-gadm-offline';
const DATABASE_VERSION = 1;
const DRAFT_STORE = 'drafts';
const DOCUMENT_STORE = 'documents';
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const ALLOWED_ROLES = new Set(['superuser', 'vip']);

function cleanScopePart(value, label) {
    const normalized = String(value || '').normalize('NFKC').trim();
    if (!normalized || normalized.length > 160 || /[|\u0000-\u001f\u007f]/.test(normalized)) {
        throw new Error(`${label} GADM tidak valid.`);
    }
    return normalized;
}

export function createGADMScope(context) {
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
        const result = await operation(transaction.objectStore(storeName));
        await transactionDone(transaction);
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
    return withStore(DRAFT_STORE, 'readwrite', (store) => requestResult(store.put(record), 'Draft GADM gagal disimpan.'));
}

export async function saveGADMDocument(scope, documentRecord) {
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
    return withStore(DOCUMENT_STORE, 'readwrite', (store) => requestResult(store.put(record), 'Dokumen GADM gagal disimpan.'));
}

export async function listGADMDocuments(scope) {
    const normalizedScope = createGADMScope(scope);
    return withStore(DOCUMENT_STORE, 'readonly', async (store) => {
        const records = await requestResult(store.index('scopeKey').getAll(normalizedScope.key), 'Riwayat GADM gagal dibaca.');
        return records
            .map((record) => clonePlain(record, 'Dokumen'))
            .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    });
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
    const normalizedScope = createGADMScope(scope);
    const id = validDocumentId(documentId);
    return withStore(DOCUMENT_STORE, 'readwrite', (store) => requestResult(store.delete(`${normalizedScope.key}|${id}`), 'Dokumen GADM gagal dihapus.'));
}

export const GADM_STORAGE_INFO = Object.freeze({
    databaseName: DATABASE_NAME,
    databaseVersion: DATABASE_VERSION,
    stores: Object.freeze([DRAFT_STORE, DOCUMENT_STORE])
});
