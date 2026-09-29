const DB_NAME = 'AdminKelasDB';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

export interface CacheEnvelope<T> {
  key: string;
  data: T;
  hash: string;
  timestamp: string;
}

async function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveOfflineSnapshot<T>(key: string, data: T): Promise<boolean> {
  try {
    const raw = JSON.stringify(data);
    const hash = await computeSHA256(raw);
    const envelope: CacheEnvelope<T> = {
      key,
      data,
      hash,
      timestamp: new Date().toISOString()
    };

    const db = await openCacheDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(envelope);
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan offline snapshot:', err);
    return false;
  }
}

export async function loadOfflineSnapshot<T>(key: string): Promise<T | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = async () => {
        if (!req.result) return resolve(null);
        const envelope = req.result as CacheEnvelope<T>;
        
        // Verify SHA-256 integrity
        const raw = JSON.stringify(envelope.data);
        const expectedHash = await computeSHA256(raw);
        if (expectedHash === envelope.hash) {
          resolve(envelope.data);
        } else {
          console.error('Integritas hash offline snapshot korup!');
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Gagal memuat offline snapshot:', err);
    return null;
  }
}
