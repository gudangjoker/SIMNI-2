import { ref, get, set, update, remove, runTransaction } from 'firebase/database';
import { getFirebaseClient } from './client';
import { resolveDatabasePath } from './paths';
import { ClassId } from '@/types/auth';

export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function dbGet<T>(
  logicalPath: string,
  classId: ClassId,
  academicYear: string
): Promise<RepositoryResult<T>> {
  try {
    const { database } = getFirebaseClient();
    const physicalPath = resolveDatabasePath(logicalPath, classId, academicYear);
    const dbRef = ref(database, physicalPath);
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      return { success: true, data: snapshot.val() as T };
    }
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membaca data dari database.';
    return { success: false, error: message };
  }
}

export async function dbSet<T>(
  logicalPath: string,
  value: T,
  classId: ClassId,
  academicYear: string
): Promise<RepositoryResult<T>> {
  try {
    const { database } = getFirebaseClient();
    const physicalPath = resolveDatabasePath(logicalPath, classId, academicYear);
    const dbRef = ref(database, physicalPath);
    await set(dbRef, value);
    return { success: true, data: value };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan data ke database.';
    return { success: false, error: message };
  }
}

export async function dbUpdate(
  logicalUpdates: Record<string, unknown>,
  classId: ClassId,
  academicYear: string
): Promise<RepositoryResult<void>> {
  try {
    const { database } = getFirebaseClient();
    const physicalUpdates: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(logicalUpdates)) {
      const physicalKey = resolveDatabasePath(key, classId, academicYear);
      physicalUpdates[physicalKey] = val;
    }

    await update(ref(database), physicalUpdates);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui data batch.';
    return { success: false, error: message };
  }
}

export async function dbRemove(
  logicalPath: string,
  classId: ClassId,
  academicYear: string
): Promise<RepositoryResult<void>> {
  try {
    const { database } = getFirebaseClient();
    const physicalPath = resolveDatabasePath(logicalPath, classId, academicYear);
    const dbRef = ref(database, physicalPath);
    await remove(dbRef);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus data dari database.';
    return { success: false, error: message };
  }
}

export async function dbCompareRecords<T extends Record<string, unknown>>(
  logicalRoot: string,
  changes: Partial<T>,
  classId: ClassId,
  academicYear: string
): Promise<RepositoryResult<T>> {
  try {
    const { database } = getFirebaseClient();
    const physicalPath = resolveDatabasePath(logicalRoot, classId, academicYear);
    const dbRef = ref(database, physicalPath);

    const txResult = await runTransaction(dbRef, (currentData) => {
      const base = (currentData || {}) as T;
      return { ...base, ...changes };
    });

    if (txResult.committed) {
      return { success: true, data: txResult.snapshot.val() as T };
    }
    return { success: false, error: 'Transaksi dibatalkan karena bentrok versi data.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengeksekusi atomic compare update.';
    return { success: false, error: message };
  }
}
