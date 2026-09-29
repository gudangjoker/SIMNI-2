import { useEffect } from 'react';
import { ref, onValue, Unsubscribe } from 'firebase/database';
import { getFirebaseClient } from '@/lib/firebase/client';
import { resolveDatabasePath } from '@/lib/firebase/paths';
import { useAppStore } from '@/stores/app-store';
import { useSyncStore } from '@/stores/sync-store';

export function useFirebaseSync() {
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const setCollection = useAppStore((state) => state.setCollection);

  const setHealth = useSyncStore((state) => state.setHealth);
  const setIsConnected = useSyncStore((state) => state.setIsConnected);
  const setLastSyncedAt = useSyncStore((state) => state.setLastSyncedAt);
  const setErrorMessage = useSyncStore((state) => state.setErrorMessage);

  useEffect(() => {
    const { database } = getFirebaseClient();
    const unsubs: Unsubscribe[] = [];

    // 1. Connection Monitor (.info/connected)
    const connectedRef = ref(database, '.info/connected');
    const unsubConn = onValue(connectedRef, (snap) => {
      const connected = !!snap.val();
      setIsConnected(connected);
      if (!connected) {
        setHealth('degraded');
      }
    });
    unsubs.push(unsubConn);

    // 2. Realtime Node Bindings
    const nodes = [
      { key: 'students', logical: 'Siswa' },
      { key: 'presensi', logical: 'Presensi' },
      { key: 'mapelTP', logical: 'Mapel_TP' },
      { key: 'nilaiTP', logical: 'Nilai_TP' },
      { key: 'catatan', logical: 'Catatan' },
      { key: 'jurnal', logical: 'Jurnal' },
      { key: 'jadwal', logical: 'Jadwal' },
      { key: 'dokumen', logical: 'Dokumen' },
      { key: 'lpsTemplates', logical: 'LPS/Templates' },
      { key: 'lpsReports', logical: 'LPS/Reports' },
      { key: 'pengaturan', logical: 'Pengaturan/Identitas' }
    ] as const;

    let loadedCount = 0;
    setHealth('loading');

    nodes.forEach(({ key, logical }) => {
      try {
        const physical = resolveDatabasePath(logical, activeKelas, academicYear);
        const nodeRef = ref(database, physical);

        const unsub = onValue(
          nodeRef,
          (snapshot) => {
            const data = snapshot.val() || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setCollection(key as any, data);

            loadedCount++;
            setLastSyncedAt(new Date().toISOString());

            if (loadedCount >= nodes.length) {
              setHealth('ready');
            }
          },
          (error) => {
            console.error(`Gagal sync node [${key}]:`, error);
            setHealth('partial');
            setErrorMessage(error.message);
          }
        );

        unsubs.push(unsub);
      } catch (err) {
        console.error(`Error resolving path untuk [${key}]:`, err);
      }
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeKelas, academicYear, setCollection, setHealth, setIsConnected, setLastSyncedAt, setErrorMessage]);
}
