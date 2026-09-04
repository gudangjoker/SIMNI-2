const DB_NAME = 'simni-chat-auth-v1';
const STORE_NAME = 'account-unlock';
const KEY_VERSION = 1;
const PBKDF2_ITERATIONS = 600000;
const encoder = new TextEncoder();

function normalizeUid(uid) {
    const value = String(uid || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
        throw new Error('UID kunci akun Chat tidak valid.');
    }
    return value;
}

function normalizeEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value || !value.includes('@')) {
        throw new Error('Email kunci akun Chat tidak valid.');
    }
    return value;
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Penyimpanan kunci akun Chat gagal dibuka.'));
    });
}

async function databaseOperation(mode, operation) {
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, mode);
            const request = operation(transaction.objectStore(STORE_NAME));
            let requestResult = null;
            request.onsuccess = () => {
                requestResult = request.result ?? null;
                if (mode === 'readonly') resolve(requestResult);
            };
            request.onerror = () => reject(request.error || new Error('Operasi kunci akun Chat gagal.'));
            transaction.oncomplete = () => {
                if (mode !== 'readonly') resolve(requestResult);
            };
            transaction.onerror = () => reject(transaction.error || new Error('Transaksi kunci akun Chat gagal.'));
            transaction.onabort = () => reject(transaction.error || new Error('Operasi kunci akun Chat dibatalkan.'));
        });
    } finally {
        database.close();
    }
}

function recordKey(uid) {
    return `unlock:${normalizeUid(uid)}`;
}

async function deriveUnlockKey(uid, email, password) {
    const normalizedUid = normalizeUid(uid);
    const normalizedEmail = normalizeEmail(email);
    const secret = String(password || '');
    if (!secret) throw new Error('Kata sandi Firebase diperlukan untuk menyiapkan pemulihan Chat.');
    const salt = new Uint8Array(await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(`SIMNI_CHAT_ACCOUNT_UNLOCK|v${KEY_VERSION}|${normalizedUid}|${normalizedEmail}`)
    ));
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function establishChatAccountUnlock(user, password) {
    if (!user?.uid || !user?.email) throw new Error('Sesi Firebase belum siap untuk kunci akun Chat.');
    const key = await deriveUnlockKey(user.uid, user.email, password);
    const record = Object.freeze({
        version: KEY_VERSION,
        uid: normalizeUid(user.uid),
        email: normalizeEmail(user.email),
        key,
        updatedAt: new Date().toISOString()
    });
    await databaseOperation('readwrite', (store) => store.put(record, recordKey(user.uid)));
    return key;
}

export async function getChatAccountUnlock(uid) {
    const normalizedUid = normalizeUid(uid);
    const record = await databaseOperation('readonly', (store) => store.get(recordKey(normalizedUid)));
    if (
        Number(record?.version) !== KEY_VERSION
        || record?.uid !== normalizedUid
        || !(record?.key instanceof CryptoKey)
        || record.key.algorithm?.name !== 'AES-GCM'
    ) {
        return null;
    }
    return record.key;
}

export async function clearChatAccountUnlock(uid) {
    const normalizedUid = normalizeUid(uid);
    await databaseOperation('readwrite', (store) => store.delete(recordKey(normalizedUid)));
}

export const ChatAccountUnlock = Object.freeze({
    establish: establishChatAccountUnlock,
    get: getChatAccountUnlock,
    clear: clearChatAccountUnlock
});
