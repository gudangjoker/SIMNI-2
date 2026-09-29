import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'SIMNIDraftsDB';
const STORE_NAME = 'academicDrafts';
const DB_VERSION = 1;

function openDraftsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function useFormDraft<T extends Record<string, unknown>>(formId: string, initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [isDirty, setIsDirty] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore on mount
  useEffect(() => {
    let active = true;
    openDraftsDB()
      .then((db) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(formId);
        req.onsuccess = () => {
          if (active && req.result && req.result.payload) {
            setValues(req.result.payload);
            setIsDirty(true);
            setIsRestored(true);
          }
        };
      })
      .catch((err) => console.warn('IndexedDB draft restore failed:', err));

    return () => {
      active = false;
    };
  }, [formId]);

  // Debounced save
  const capture = useCallback((newValues: Partial<T>) => {
    setValues((prev) => {
      const merged = { ...prev, ...newValues };
      setIsDirty(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const db = await openDraftsDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: formId,
            payload: merged,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Gagal menyimpan draf offline:', err);
        }
      }, 300);

      return merged;
    });
  }, [formId]);

  // Clear draft after successful submit
  const finish = useCallback(async () => {
    setIsDirty(false);
    try {
      const db = await openDraftsDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(formId);
    } catch (err) {
      console.warn('Gagal menghapus draf:', err);
    }
  }, [formId]);

  return {
    values,
    setValues,
    capture,
    finish,
    isDirty,
    isRestored
  };
}
